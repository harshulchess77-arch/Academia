import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: [
      "src/**/*.{test,spec}.?(c|m)[jt]s?(x)",
      "test/**/*.{test,spec}.?(c|m)[jt]s?(x)",
    ],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/external/**",
      "**/.{idea,git,cache,output,temp}/**",
    ],
  },
});
