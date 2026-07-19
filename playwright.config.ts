import {
    defineConfig,
    devices,
    type Project,
    type ReporterDescription,
} from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env'), quiet: true });

const host = new URL(
    process.env.E2E_HOST?.trim() || 'https://labkeeper.io'
)
    .toString()
    .replace(/\/$/, '');

const brandedBrowserProjects: Project[] = [
    {
        name: 'Microsoft Edge',
        use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
        name: 'Google Chrome',
        use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
];

const projects: Project[] =
    process.env.E2E_BROWSER === 'chromium'
        ? [
              {
                  name: 'Local Chromium',
                  use: { ...devices['Desktop Chrome'] },
              },
          ]
        : brandedBrowserProjects;

const reporter: ReporterDescription[] = process.env.E2E_TELEGRAM_BOT_TOKEN
    ? [
          ['list'],
          [
              '@b3nab/playwright-telegram-reporter',
              {
                  botToken: process.env.E2E_TELEGRAM_BOT_TOKEN,
                  chatId: process.env.E2E_TELEGRAM_CHAT_ID,
              },
          ],
      ]
    : [
          ['list'],
          ['html', { open: 'never', outputFolder: 'playwright-report' }],
      ];

export default defineConfig({
    testDir: './tests',
    testMatch: '**/*.spec.ts',
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    timeout: 120_000,
    outputDir: 'test-results',
    reporter,
    expect: {
        timeout: 15_000,
        toHaveScreenshot: {
            animations: 'disabled',
            caret: 'hide',
            maxDiffPixelRatio: 0.01,
        },
    },
    use: {
        baseURL: host,
        locale: 'en-US',
        timezoneId: 'UTC',
        actionTimeout: 15_000,
        navigationTimeout: 30_000,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    projects,
});
