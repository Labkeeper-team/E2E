import { expect, type Page } from '@playwright/test';
import { ResultLocators } from './locators';
import { ProjectViewDsl } from './project-view.dsl';
import type { ResponseRecorder } from './response-recorder';

// A production PDF is compiled, downloaded and rendered before anything can be read from it, so every wait on the viewer gets the same long budget
const PDF_RENDER_TIMEOUT_MS = 60_000;
// A reader's drag along a line ends in the empty page after it, where Firefox and WebKit used to move the selection to the start of the page
const PDF_LINE_OVERSHOOT_PX = 40;
const PDF_DRAG_STEPS = 40;

interface PdfPoint {
    x: number;
    y: number;
}

export class ResultDsl {
    private readonly locators: ResultLocators;

    constructor(
        private readonly page: Page,
        private readonly projectView: ProjectViewDsl,
        private readonly responses: ResponseRecorder
    ) {
        this.locators = new ResultLocators(page);
    }

    async expectPdf(): Promise<void> {
        await this.projectView.showPdf();
        await expect(this.locators.visibleCanvas.first()).toBeVisible({
            timeout: PDF_RENDER_TIMEOUT_MS,
        });
        await expect(this.locators.loadingPdf).toBeHidden({
            timeout: PDF_RENDER_TIMEOUT_MS,
        });
    }

    async expectPdfFrom(pdfUri: string): Promise<void> {
        await expect
            .poll(() => this.responses.hasLoaded(pdfUri), {
                message: `The viewer did not load ${pdfUri}`,
                timeout: 60_000,
            })
            .toBe(true);
        await expect
            .poll(() => this.readPdfText(), { timeout: 60_000 })
            .not.toBe('');
    }

    async readPdfText(): Promise<string> {
        await this.expectPdf();
        // A repeated compilation clears the viewer and draws the canvas before the text layer, and expect.poll ends on a thrown error instead of polling again, so this wait may not be shorter than the poll around it
        await expect(this.locators.pdfTextLayers.first()).toBeAttached({
            timeout: PDF_RENDER_TIMEOUT_MS,
        });

        const fragments = await this.locators.pdfTextSpans.allTextContents();
        return fragments
            .map((fragment) => fragment.replace(/\s+/g, ' ').trim())
            .filter(Boolean)
            .join(' ')
            .trim();
    }

    async expectPdfText(expected: string): Promise<void> {
        await expect
            .poll(() => this.readPdfText(), { timeout: PDF_RENDER_TIMEOUT_MS })
            .toBe(expected);
    }

    async expectPdfTextContains(expected: string | RegExp): Promise<void> {
        await expect
            .poll(() => this.readPdfText(), { timeout: PDF_RENDER_TIMEOUT_MS })
            .toMatch(expected);
    }

    async matchPdfTextSnapshot(name: string): Promise<void> {
        expect(await this.readPdfText()).toMatchSnapshot(name);
    }

    async matchPdfPageSnapshot(
        pageNumber: number,
        name: string
    ): Promise<void> {
        await this.projectView.showPdf();
        const canvas = this.locators.pdfPageCanvas(pageNumber);
        await expect(canvas).toBeVisible({ timeout: PDF_RENDER_TIMEOUT_MS });
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
        await this.projectView.showPdf();
        const target = this.locators.pdfText(text);
        await expect(target).toBeVisible({ timeout: PDF_RENDER_TIMEOUT_MS });
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
        await this.projectView.showPdf();
        const target = this.locators.pdfText(text);
        await expect(target).toBeVisible({ timeout: PDF_RENDER_TIMEOUT_MS });
        const box = await target.boundingBox();
        expect(box).not.toBeNull();
        await target.click({
            position: {
                x: Math.max(1, (box?.width ?? 2) / 2),
                y: Math.max(1, (box?.height ?? 2) / 2),
            },
        });
        await this.page.waitForTimeout(250);
    }

    async followPdfLink(text: string): Promise<void> {
        await this.pressPdfPoint(await this.pdfLinkPoint(text));
    }

    async expectPdfLinkOpensTab(text: string, url: string): Promise<void> {
        const editorUrl = this.page.url();
        // The link is found before the wait for the tab starts, so a PDF still rendering does not spend the tab's timeout
        const point = await this.pdfLinkPoint(text);
        const [tab] = await Promise.all([
            this.page.context().waitForEvent('page', { timeout: 30_000 }),
            this.pressPdfPoint(point),
        ]);
        try {
            await expect(tab).toHaveURL(url);
        } finally {
            await tab.close();
        }
        await expect(this.page).toHaveURL(editorUrl);
    }

    async dragAlongPdfLine(text: string): Promise<void> {
        await this.projectView.showPdf();
        const line = this.locators.pdfText(text);
        await expect(line).toBeVisible({ timeout: PDF_RENDER_TIMEOUT_MS });
        await line.scrollIntoViewIfNeeded();
        const lineBox = await line.boundingBox();
        const pageBox = await this.locators.pdfPageWithText(text).boundingBox();
        if (!lineBox || !pageBox) {
            throw new Error(`PDF line "${text}" is not rendered`);
        }

        const y = lineBox.y + lineBox.height / 2;
        const pageEndX = pageBox.x + pageBox.width - 3;
        const lineEndX = Math.min(lineBox.x + lineBox.width - 1, pageEndX);
        const endX = Math.min(lineEndX + PDF_LINE_OVERSHOOT_PX, pageEndX);
        await this.page.evaluate(() =>
            window.getSelection()?.removeAllRanges()
        );
        await this.page.mouse.move(lineBox.x + 1, y);
        await this.page.mouse.down();
        // Firefox keeps the last letter the pointer touched, and evenly spaced steps may jump over the last one where a real hand does not
        await this.page.mouse.move(lineEndX, y, { steps: PDF_DRAG_STEPS });
        await this.page.mouse.move(endX, y, { steps: 5 });
        await this.page.mouse.up();
    }

    async expectPdfSelection(text: string): Promise<void> {
        await expect
            .poll(async () => {
                const selection = await this.page.evaluate(
                    () => window.getSelection()?.toString() ?? ''
                );
                return selection.replace(/\s+/g, ' ').trim();
            })
            .toBe(text);
    }

    // The link is found by its overlap with the text and clicked in its own middle, so a text layer out of scale does not fail the link check
    private async pdfLinkPoint(text: string): Promise<PdfPoint> {
        await this.projectView.showPdf();
        const target = this.locators.pdfText(text);
        await expect(target).toBeInViewport({
            timeout: PDF_RENDER_TIMEOUT_MS,
        });

        const found: { point?: PdfPoint } = {};
        await expect
            .poll(
                async () => {
                    // The text is measured together with the links, so a page redrawn in between does not leave a stale box
                    const textBox = await target.boundingBox();
                    if (!textBox) {
                        return false;
                    }

                    found.point = await this.locators.pdfLinks.evaluateAll(
                        (links, box) => {
                            let best: Element | undefined;
                            let bestArea = 0;
                            for (const link of links) {
                                const rect = link.getBoundingClientRect();
                                const width =
                                    Math.min(rect.right, box.x + box.width) -
                                    Math.max(rect.left, box.x);
                                const height =
                                    Math.min(rect.bottom, box.y + box.height) -
                                    Math.max(rect.top, box.y);
                                if (
                                    width > 0 &&
                                    height > 0 &&
                                    width * height > bestArea
                                ) {
                                    best = link;
                                    bestArea = width * height;
                                }
                            }
                            if (!best) {
                                return undefined;
                            }

                            const rect = best.getBoundingClientRect();
                            const x = rect.left + rect.width / 2;
                            const y = rect.top + rect.height / 2;
                            // A link under another layer is drawn but gets no clicks
                            return best.contains(
                                document.elementFromPoint(x, y)
                            )
                                ? { x, y }
                                : undefined;
                        },
                        textBox
                    );
                    return found.point !== undefined;
                },
                { message: `No clickable PDF link covers "${text}"` }
            )
            .toBe(true);
        return found.point as PdfPoint;
    }

    private async pressPdfPoint(point: PdfPoint): Promise<void> {
        if (this.projectView.isMobile()) {
            await this.page.touchscreen.tap(point.x, point.y);
        } else {
            await this.page.mouse.click(point.x, point.y);
        }
    }

    async expectMarkdownText(text: string | RegExp): Promise<void> {
        await this.projectView.showPdf();
        await expect(this.locators.markdown.getByText(text)).toBeVisible({
            timeout: 30_000,
        });
    }

    async expectPlot(title?: string | RegExp): Promise<void> {
        await this.projectView.showPdf();
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
        await this.projectView.showPdf();
        await expect(this.locators.plot).toHaveScreenshot(name);
    }

    async expectPlotGrid(): Promise<void> {
        await this.projectView.showPdf();
        await expect(this.locators.plotGridLines.first()).toBeAttached();
    }

    async expectTable(): Promise<void> {
        await this.projectView.showPdf();
        await expect(this.locators.resultTables.first()).toBeVisible({
            timeout: 30_000,
        });
    }

    async expectPdfExportAvailable(): Promise<void> {
        await this.projectView.showPdf();
        await expect(this.locators.saveToPdfButton).toBeVisible();
        await expect(this.locators.saveToPdfButton).toBeEnabled();
    }

    async openProblems(): Promise<void> {
        await this.projectView.showEditor();
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
        await this.projectView.showEditor();
        await expect(this.locators.problemsHeader).toContainText(`(${count})`);
    }

    async closeProblemsWithEscape(): Promise<void> {
        await this.projectView.showEditor();
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
