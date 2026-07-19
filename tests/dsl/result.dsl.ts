import { expect, type Page } from '@playwright/test';
import { ResultLocators } from './locators';

export class ResultDsl {
    private readonly locators: ResultLocators;

    constructor(private readonly page: Page) {
        this.locators = new ResultLocators(page);
    }

    async expectPdf(): Promise<void> {
        await expect(this.locators.visibleCanvas.first()).toBeVisible({
            timeout: 60_000,
        });
    }

    async expectMarkdownText(text: string | RegExp): Promise<void> {
        await expect(this.locators.markdown.getByText(text)).toBeVisible({
            timeout: 30_000,
        });
    }

    async expectPlot(title?: string | RegExp): Promise<void> {
        await expect(this.locators.plot).toBeVisible({ timeout: 30_000 });
        await expect(this.locators.plotGraphic).toBeVisible({
            timeout: 30_000,
        });

        if (title !== undefined) {
            const expectedTitle =
                typeof title === 'string'
                    ? new RegExp(
                          title
                              .split(/\s+/)
                              .map((part) =>
                                  part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                              )
                              .join('\\s*')
                      )
                    : title;
            await expect(this.locators.plotTitle).toContainText(expectedTitle);
        }
    }

    async matchPlotSnapshot(name: string): Promise<void> {
        await expect(this.locators.plot).toHaveScreenshot(name);
    }

    async expectPlotGrid(): Promise<void> {
        await expect(this.locators.plotGridLines.first()).toBeAttached();
    }

    async expectTable(): Promise<void> {
        await expect(this.locators.resultTables.first()).toBeVisible({
            timeout: 30_000,
        });
    }

    async expectPdfExportAvailable(): Promise<void> {
        await expect(this.locators.saveToPdfButton).toBeVisible();
        await expect(this.locators.saveToPdfButton).toBeEnabled();
    }

    async openProblems(): Promise<void> {
        const currentClass =
            (await this.locators.problemsList.getAttribute('class')) || '';

        if (!currentClass.includes('problem-list-container-expanded')) {
            await this.locators.problemsHeader.click();
        }

        await expect(this.locators.problemsList).toHaveClass(
            /problem-list-container-expanded/
        );
    }

    async expectProblemCount(count: number): Promise<void> {
        await expect(this.locators.problemsHeader).toContainText(`(${count})`);
    }

    async closeProblemsWithEscape(): Promise<void> {
        await this.page.keyboard.press('Escape');
        await expect(this.locators.problemsList).not.toHaveClass(
            /problem-list-container-expanded/
        );
    }

    async expectCompilationError(text: string | RegExp): Promise<void> {
        await this.openProblems();
        await expect(this.locators.errorText(text)).toBeVisible();
    }

    async expectToast(text?: string | RegExp): Promise<void> {
        await expect(this.locators.toast.first()).toBeVisible();

        if (text !== undefined) {
            await expect(this.locators.toast.first()).toContainText(text);
        }
    }
}
