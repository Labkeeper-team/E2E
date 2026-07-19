import type { Locator, Page } from '@playwright/test';

export class ResultLocators {
    constructor(private readonly page: Page) {}

    get container(): Locator {
        return this.page.locator('.result-container');
    }

    get visibleCanvas(): Locator {
        return this.container.locator('canvas:visible');
    }

    get markdown(): Locator {
        return this.container.locator('.result-markdown');
    }

    get plot(): Locator {
        return this.container.locator('.plot-container');
    }

    get plotTitle(): Locator {
        return this.plot.locator('.plot-title');
    }

    get plotGraphic(): Locator {
        return this.plot.locator('svg:visible');
    }

    get plotGridLines(): Locator {
        return this.plot.locator(
            'path[stroke="#d1d5db"], path[stroke="rgb(209, 213, 219)"]'
        );
    }

    get resultTables(): Locator {
        return this.container.locator('.markdown-body table');
    }

    get saveToPdfButton(): Locator {
        return this.container.getByRole('button', {
            name: 'Save to PDF',
            exact: true,
        });
    }

    get loadingPdf(): Locator {
        return this.page.getByText('Loading PDF…', { exact: true });
    }

    get problemsHeader(): Locator {
        return this.page.locator('.header-problem-title');
    }

    get problemsList(): Locator {
        return this.page.locator('.problem-list');
    }

    get errorGroups(): Locator {
        return this.problemsList.locator('.error-group-item-container');
    }

    errorText(text: string | RegExp): Locator {
        return this.problemsList.getByText(text);
    }

    get toast(): Locator {
        return this.page.locator('.Toastify__toast');
    }
}
