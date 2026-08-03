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
        await expect(this.locators.loadingPdf).toBeHidden({ timeout: 60_000 });
    }

    async readPdfText(): Promise<string> {
        await this.expectPdf();
        await expect(this.locators.pdfTextLayers.first()).toBeAttached();

        const fragments = await this.locators.pdfTextSpans.allTextContents();
        return fragments
            .map((fragment) => fragment.replace(/\s+/g, ' ').trim())
            .filter(Boolean)
            .join(' ')
            .trim();
    }

    async expectPdfText(expected: string): Promise<void> {
        await expect.poll(() => this.readPdfText(), { timeout: 60_000 }).toBe(
            expected
        );
    }

    async expectPdfTextContains(expected: string | RegExp): Promise<void> {
        await expect
            .poll(() => this.readPdfText(), { timeout: 60_000 })
            .toMatch(expected);
    }

    async matchPdfTextSnapshot(name: string): Promise<void> {
        expect(await this.readPdfText()).toMatchSnapshot(name);
    }

    async matchPdfPageSnapshot(
        pageNumber: number,
        name: string
    ): Promise<void> {
        const canvas = this.locators.pdfPageCanvas(pageNumber);
        await expect(canvas).toBeVisible({ timeout: 60_000 });
        const encodedPng = await canvas.evaluate((element) => {
            if (!(element instanceof HTMLCanvasElement)) {
                throw new Error('PDF page canvas was not found');
            }

            return element.toDataURL('image/png').split(',')[1];
        });
        expect(Buffer.from(encodedPng, 'base64')).toMatchSnapshot(name);
    }

    async scrollPdfToTop(): Promise<void> {
        await this.expectPdf();
        await this.locators.pdfScrollContainer.evaluate((container) => {
            container.scrollTop = 0;
        });
        await expect
            .poll(() =>
                this.locators.pdfScrollContainer.evaluate(
                    (container) => container.scrollTop
                )
            )
            .toBe(0);
    }

    async expectPdfScrolledToText(text: string): Promise<void> {
        const target = this.locators.pdfText(text);
        await expect(target).toBeVisible({ timeout: 60_000 });
        await expect
            .poll(async () => {
                const [scrollTop, containerBox, targetBox] = await Promise.all([
                    this.locators.pdfScrollContainer.evaluate(
                        (container) => container.scrollTop
                    ),
                    this.locators.pdfScrollContainer.boundingBox(),
                    target.boundingBox(),
                ]);

                return {
                    scrolled: scrollTop > 0,
                    targetVisible: Boolean(
                        containerBox &&
                            targetBox &&
                            targetBox.y + targetBox.height > containerBox.y &&
                            targetBox.y < containerBox.y + containerBox.height
                    ),
                };
            })
            .toEqual({ scrolled: true, targetVisible: true });
    }

    async selectPdfText(text: string): Promise<void> {
        const target = this.locators.pdfText(text);
        await expect(target).toBeVisible({ timeout: 60_000 });
        const box = await target.boundingBox();
        expect(box).not.toBeNull();
        await target.click({
            position: {
                x: Math.max(1, (box?.width ?? 2) / 2),
                y: Math.max(1, (box?.height ?? 2) - 1),
            },
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

    async expectAnyCompilationError(): Promise<void> {
        await this.openProblems();
        await expect(this.locators.errorGroups.first()).toBeVisible();
    }

    async expectToast(text?: string | RegExp): Promise<void> {
        await expect(this.locators.toast.first()).toBeVisible();

        if (text !== undefined) {
            await expect(this.locators.toast.first()).toContainText(text);
        }
    }
}
