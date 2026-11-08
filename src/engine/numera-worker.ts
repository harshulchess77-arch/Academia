/* Academia · numera-worker.ts
   Off-thread vectorized math evaluator for the Numera Graphing Engine.
   Evaluates exactly 2,000 sampling points per expression using Float64Array
   and streams pixel coordinates back via Transferable Objects. */

import { evalRpn, type RpnToken } from "./math";

export interface ViewportBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  width: number;
  height: number;
}

export interface WorkerPlotRequest {
  id: string;
  rpn: RpnToken[];
  viewport: ViewportBounds;
  scope: Record<string, number>;
}

export interface WorkerPlotResponse {
  id: string;
  buffer: ArrayBuffer;
  count: number;
  durationMs: number;
}

export const NUMERA_SAMPLE_COUNT = 2000;

/** Computes exactly 2,000 sampling points as a contiguous Float64Array [xPix0, yPix0, xPix1, yPix1, ...] */
export function computeSamplingPoints(
  rpn: RpnToken[],
  viewport: ViewportBounds,
  scope: Record<string, number> = {},
): Float64Array {
  const { xMin, xMax, yMin, yMax, width, height } = viewport;
  const count = NUMERA_SAMPLE_COUNT;
  // 2 numbers (x, y) per point
  const data = new Float64Array(count * 2);

  const xSpan = xMax - xMin;
  const ySpan = yMax - yMin;
  const xStep = xSpan / (count - 1);

  const ppuX = width / (xSpan || 1);
  const ppuY = height / (ySpan || 1);

  const localScope: Record<string, number> = { ...scope };

  for (let i = 0; i < count; i++) {
    const x = xMin + i * xStep;
    localScope.x = x;

    let y: number;
    try {
      y = evalRpn(rpn, localScope);
    } catch {
      y = NaN;
    }

    const offset = i * 2;
    if (!isFinite(y)) {
      data[offset] = NaN;
      data[offset + 1] = NaN;
    } else {
      // Convert world (x, y) to pixel coordinates
      const px = (x - xMin) * ppuX;
      const py = height - (y - yMin) * ppuY;

      // Filter extreme out-of-bounds coordinates to prevent canvas overflow
      if (py < -5000 || py > height + 5000) {
        data[offset] = NaN;
        data[offset + 1] = NaN;
      } else {
        data[offset] = px;
        data[offset + 1] = py;
      }
    }
  }

  return data;
}

// Background worker message listener (active when executed inside a Web Worker context)
if (typeof self !== "undefined" && typeof (self as unknown as Worker).postMessage === "function" && typeof window === "undefined") {
  self.onmessage = (e: MessageEvent<WorkerPlotRequest>) => {
    const t0 = performance.now();
    const { id, rpn, viewport, scope } = e.data;
    const points = computeSamplingPoints(rpn, viewport, scope);
    const durationMs = performance.now() - t0;

    const response: WorkerPlotResponse = {
      id,
      buffer: points.buffer as ArrayBuffer,
      count: NUMERA_SAMPLE_COUNT,
      durationMs,
    };

    // Zero-copy transfer of the underlying ArrayBuffer
    (self as unknown as Worker).postMessage(response, [points.buffer as ArrayBuffer]);
  };
}
