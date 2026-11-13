import { defineConfig, devices } from "@playwright/test";

const output = process.env.PENABLE_E2E_DIST ?? "dist";
if (!/^[\w./-]+$/.test(output))
  throw new Error("Invalid owned E2E output directory");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  outputDir: ".artifacts/e2e/results",
  reporter: [["list"], ["json", { outputFile: ".artifacts/e2e/results.json" }]],
  use: {
    baseURL: "http://127.0.0.1:4185/penable/",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    acceptDownloads: true,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
      },
    },
  ],
  webServer: {
    command: `npm run preview:pages -- --outDir ${output} --port 4185 --strictPort`,
    wait: { stdout: /Local:\s+http:\/\/127\.0\.0\.1:4185\/penable\// },
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
