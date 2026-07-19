import { test as base } from '@playwright/test';
import { LabkeeperDsl } from './dsl';

interface E2EFixtures {
    app: LabkeeperDsl;
}

export const test = base.extend<E2EFixtures>({
    app: async ({ page }, use, testInfo) => {
        const app = new LabkeeperDsl(page, testInfo);

        try {
            await use(app);
        } finally {
            await app.cleanup();
        }
    },
});
