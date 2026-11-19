import { defineConfig, devices } from "@playwright/test";

const metricsReporter = "./src/reporters/platform-metrics-reporter.ts";
const useBlobReporter = process.env.PW_BLOB === "1";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 30_000,
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    testIdAttribute: "data-qa",
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: "api",
      grep: /@api/,
      grepInvert: /@quarantine/,
      use: {
        baseURL: "https://automationexercise.com",
      },
    },
    {
      name: "ui",
      grep: /@ui/,
      grepInvert: /@quarantine/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "https://automationexercise.com",
      },
    },
    {
      name: "quarantine",
      grep: /@quarantine/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://uitestingplayground.com",
      },
    },
  ],
  reporter: useBlobReporter
    ? [["blob"], [metricsReporter]]
    : [["list"], ["html", { open: "never" }], [metricsReporter]],
});
