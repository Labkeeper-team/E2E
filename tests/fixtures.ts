import { test as base } from '@playwright/test';
import { LabkeeperDsl } from './dsl';

// совпадает с ANALYTICS_DISABLED_STORAGE_KEY во FrontendContract
const OPENPANEL_DISABLED_STORAGE_KEY = 'labkeeper_analytics_disabled';

interface E2EFixtures {
    app: LabkeeperDsl;
}

export const test = base.extend<E2EFixtures>({
    context: async ({ context }, use) => {
        await context.addInitScript((key) => {
            window.localStorage.setItem(key, '1');
        }, OPENPANEL_DISABLED_STORAGE_KEY);
        await use(context);
    },
    app: async ({ page }, use, testInfo) => {
        const app = new LabkeeperDsl(page, testInfo);

        try {
            await use(app);
        } finally {
            await app.cleanup();
        }
    },
});
