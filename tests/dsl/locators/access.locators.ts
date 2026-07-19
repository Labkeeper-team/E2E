import type { Locator, Page } from '@playwright/test';

export class AccessLocators {
    constructor(private readonly page: Page) {}

    get toast(): Locator {
        return this.page.locator('.Toastify__toast');
    }

    get sessionExpiredPageMessage(): Locator {
        return this.page.getByText('Session expired. Please reload the page', {
            exact: true,
        });
    }

    get forbiddenPageMessage(): Locator {
        return this.page.getByText(
            "You don't have enough rights to view the project",
            { exact: true }
        );
    }
}
