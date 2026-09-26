import { test as base } from '@playwright/test';
import { LabkeeperDsl } from './dsl';
import { FailureContext } from './failure-context';

// совпадает с ANALYTICS_DISABLED_STORAGE_KEY во FrontendContract
const OPENPANEL_DISABLED_STORAGE_KEY = 'labkeeper_analytics_disabled';

interface E2EFixtures {
    app: LabkeeperDsl;
    failureContext: FailureContext;
}

export const test = base.extend<E2EFixtures>({
    // Depends on nothing, so a test that never opens a page does not get a browser context just for the report
    failureContext: [
        async ({}, use, testInfo) => {
            const failureContext = new FailureContext();
            await use(failureContext);
            failureContext.report(testInfo);
        },
        { auto: true },
    ],
    context: async ({ context, failureContext }, use) => {
        failureContext.watch(context);
        await context.addInitScript((key) => {
            try {
                window.localStorage.setItem(key, '1');
            } catch {
                // Chromium denies storage to the blank page a new tab starts with, and the uncaught error opened every failure context
            }
        }, OPENPANEL_DISABLED_STORAGE_KEY);
        await use(context);
    },
    app: async ({ page, failureContext }, use, testInfo) => {
        const app = new LabkeeperDsl(page, testInfo);

        try {
            await use(app);
        } finally {
            failureContext.markCleanup();
            await app.cleanup();
        }
    },
});
