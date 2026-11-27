import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The files in e2e/ belong to Playwright.
    include: ["src/**/*.test.ts"],
  },
});
