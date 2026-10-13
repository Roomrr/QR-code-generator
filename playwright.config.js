import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: "http://localhost:5179",
    headless: true,
    launchOptions: process.env.BROWSER_EXECUTABLE
      ? { executablePath: process.env.BROWSER_EXECUTABLE }
      : {},
  },
  webServer: [
    {
      command: "node server/index.js",
      url: "http://localhost:3019/api/health",
      env: {
        APP_ORIGIN: "http://localhost:5179",
        QR_BASE_URL: "http://localhost:3019",
        NODE_ENV: "test",
        COOKIE_SECURE: "false",
        ALLOW_REGISTRATION: "true",
      },
    },
    {
      command: "npm run dev:web -- --port 5179 --strictPort",
      url: "http://localhost:5179",
    },
  ],
});
