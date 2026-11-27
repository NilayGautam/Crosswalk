import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const PORT = 8899;
const dataDir = join(here, "test-results", "server-data");

export const SERVER_URL = `http://localhost:${PORT}`;

// The tests run against the real thing: the built web app served by the API
// server with a fresh database, and the real command line tool.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  use: {
    baseURL: SERVER_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `rm -rf "${dataDir}" && pnpm --filter @crosswalk/api start`,
    cwd: join(here, "..", ".."),
    url: `${SERVER_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      CROSSWALK_PORT: String(PORT),
      CROSSWALK_DATA_DIR: dataDir,
      CROSSWALK_WEB_DIST: join(here, "out"),
    },
  },
});
