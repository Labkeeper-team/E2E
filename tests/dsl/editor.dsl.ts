import { expect, type Page } from '@playwright/test';
import { EditorLocators, type SegmentType } from './locators';

export class EditorDsl {
    private readonly locators: EditorLocators;

    constructor(private readonly page: Page) {
        this.locators = new EditorLocators(page);
    }

    async hideInstructions(): Promise<void> {
        if (await this.locators.instructionsHeader.isVisible()) {
            await this.locators.instructionsHeader.click();
        }
    }

    async setProjectType(type: 'markdown' | 'latex'): Promise<void> {
        await this.locators.settingsButton.click();
        await this.locators.projectTypeOption(type).click();
        await this.page.keyboard.press('Escape');
    }

    async addSegment(type: SegmentType, text?: string): Promise<number> {
        const index = await this.locators.segmentEditors.count();

        if (index === 0 && type === 'Latex') {
            await this.locators.addLatexToEmptyProjectButton.click();
        } else {
            const select =
                index === 0
                    ? this.locators.emptyProjectAddSegmentSelect
                    : this.locators.addSegmentSelect;
            await select.click();
            await this.locators.segmentOption(type).click();
        }

        await expect(this.locators.segmentEditors).toHaveCount(index + 1);

        if (text !== undefined) {
            await this.fillSegment(index, text);
        }

        return index;
    }

    async addSegmentBetween(
        dividerIndex: number,
        type: SegmentType,
        text?: string
    ): Promise<number> {
        const previousCount = await this.locators.segmentEditors.count();
        await this.locators.dividerButton(dividerIndex).click();
        await this.locators.dividerOption(dividerIndex, type).click();
        await expect(this.locators.segmentEditors).toHaveCount(
            previousCount + 1
        );

        const insertedIndex = dividerIndex + 1;
        if (text !== undefined) {
            await this.fillSegment(insertedIndex, text);
        }

        return insertedIndex;
    }

    async fillSegment(index: number, text: string): Promise<void> {
        const editor = this.locators.segmentEditor(index);
        await editor.click();
        await editor.fill(text);
        await this.expectSegmentText(index, text);
    }

    async appendToSegment(index: number, text: string): Promise<void> {
        const editor = this.locators.segmentEditor(index);
        await editor.click();
        await editor.press('Control+End');
        await editor.pressSequentially(text);
    }

    async deleteCharactersFromEnd(
        index: number,
        characterCount: number
    ): Promise<void> {
        const editor = this.locators.segmentEditor(index);
        await editor.click();
        await editor.press('Control+End');

        for (let count = 0; count < characterCount; count += 1) {
            await editor.press('Backspace');
        }
    }

    async selectAllAndDelete(index: number): Promise<void> {
        const editor = this.locators.segmentEditor(index);
        await editor.click();
        await editor.press('Control+a');
        await editor.press('Backspace');
    }

    async selectPreviousCharactersAndDelete(
        index: number,
        characterCount: number
    ): Promise<void> {
        const editor = this.locators.segmentEditor(index);
        await editor.click();
        await editor.press('Control+End');
        await this.page.keyboard.down('Shift');

        for (let count = 0; count < characterCount; count += 1) {
            await this.page.keyboard.press('ArrowLeft');
        }

        await this.page.keyboard.up('Shift');
        await editor.press('Backspace');
    }

    async deleteSegment(index: number): Promise<void> {
        const previousCount = await this.locators.segmentEditors.count();
        const deleteOption = this.locators.segmentDeleteOption(index);

        await this.page.keyboard.press('Escape');
        await this.locators.segmentMenu(index).click();
        await expect(deleteOption).toBeVisible();
        await deleteOption.click({ force: true });
        await expect(this.locators.segmentEditors).toHaveCount(
            previousCount - 1
        );
    }

    async moveSegmentUp(index: number): Promise<void> {
        await this.locators.moveSegmentUpButton(index).click();
    }

    async moveSegmentDown(index: number): Promise<void> {
        await this.locators.moveSegmentDownButton(index).click();
    }

    async undo(): Promise<void> {
        await this.locators.undoButton.click();
    }

    async redo(): Promise<void> {
        await this.locators.redoButton.click();
    }

    async expectSegmentCount(count: number): Promise<void> {
        await expect(this.locators.segmentEditors).toHaveCount(count);
    }

    async expectErrorDecorations(): Promise<void> {
        await expect(this.locators.errorDecorations.first()).toBeVisible();
    }

    async expectNoErrorDecorations(): Promise<void> {
        await expect(this.locators.errorDecorations).toHaveCount(0);
    }

    async expectSegmentTexts(texts: string[]): Promise<void> {
        await expect(this.locators.segmentEditors).toHaveCount(texts.length);

        for (const [index, text] of texts.entries()) {
            await this.expectSegmentText(index, text);
        }
    }

    async expectSegmentContainsText(
        index: number,
        text: string
    ): Promise<void> {
        await expect
            .poll(async () => {
                const lines = await this.locators
                    .segmentLines(index)
                    .allTextContents();
                return lines.join('\n');
            })
            .toContain(text);
    }

    async expectLatexBoundaryCards(): Promise<void> {
        await expect(this.locators.latexHeaderBoundary).toBeVisible();
        await expect(this.locators.latexFooterBoundary).toBeVisible();
    }

    async insertLatexHeader(): Promise<void> {
        const previousCount = await this.locators.segmentEditors.count();
        await expect(this.locators.latexHeaderBoundary).toBeVisible();
        await this.locators.latexHeaderBoundary.click();
        await expect(this.locators.segmentEditors).toHaveCount(
            previousCount + 1
        );
        await expect(this.locators.latexHeaderBoundary).toBeHidden();
        await this.expectSegmentContainsText(0, '\\begin{document}');
    }

    async insertLatexFooter(): Promise<void> {
        const previousCount = await this.locators.segmentEditors.count();
        await expect(this.locators.latexFooterBoundary).toBeVisible();
        await this.locators.latexFooterBoundary.click();
        await expect(this.locators.segmentEditors).toHaveCount(
            previousCount + 1
        );
        await expect(this.locators.latexFooterBoundary).toBeHidden();
        await this.expectSegmentContainsText(previousCount, '\\end{document}');
    }

    async selectSegmentLine(index: number, lineNumber: number): Promise<void> {
        const line = this.locators.segmentLine(index, lineNumber);
        await expect(line).toBeVisible();
        await line.click({ position: { x: 4, y: 4 } });
        await this.page.keyboard.press('Home');
        await this.page.keyboard.down('Shift');
        await this.page.keyboard.press('End');
        await this.page.keyboard.up('Shift');
    }

    async navigateSelectionToPdf(): Promise<void> {
        const responsePromise = this.page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                /\/api\/v\d+\/public\/project\/[^/]+\/navigation\/pdf$/.test(
                    new URL(response.url()).pathname
                ),
            { timeout: 30_000 }
        );

        await expect(this.locators.syncToPdfButton).toBeEnabled();
        await this.locators.syncToPdfButton.click();
        expect((await responsePromise).ok()).toBeTruthy();
    }

    async navigatePdfSelectionToSource(): Promise<void> {
        const responsePromise = this.page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                /\/api\/v\d+\/public\/project\/[^/]+\/navigation\/doc$/.test(
                    new URL(response.url()).pathname
                ),
            { timeout: 30_000 }
        );

        await expect(this.locators.syncToEditorButton).toBeEnabled();
        await this.locators.syncToEditorButton.click();
        expect((await responsePromise).ok()).toBeTruthy();
    }

    async expectCursorNearSegmentLine(
        index: number,
        lineNumber: number,
        tolerance = 1
    ): Promise<void> {
        await expect(this.locators.segmentCodeMirror(index)).toHaveClass(
            /cm-focused/
        );
        await expect
            .poll(async () => {
                const actualLine = await this.locators
                    .segmentLines(index)
                    .evaluateAll((lines) => {
                        const anchor = document.getSelection()?.anchorNode;
                        if (!anchor) {
                            return 0;
                        }

                        return (
                            lines.findIndex(
                                (line) =>
                                    line === anchor || line.contains(anchor)
                            ) + 1
                        );
                    });
                return Math.abs(actualLine - lineNumber);
            })
            .toBeLessThanOrEqual(tolerance);

        await expect
            .poll(async () => {
                const containerBox =
                    await this.locators.segmentsScrollContainer.boundingBox();
                const lineBox = await this.locators
                    .segmentLine(index, lineNumber)
                    .boundingBox();

                if (!containerBox || !lineBox) {
                    return false;
                }

                return (
                    lineBox.y >= containerBox.y &&
                    lineBox.y + lineBox.height <=
                        containerBox.y + containerBox.height
                );
            })
            .toBe(true);
    }

    async openSearch(text?: string): Promise<void> {
        await this.locators.searchButton.click();
        await expect(this.locators.searchInput).toBeVisible();

        if (text !== undefined) {
            await this.locators.searchInput.fill(text);
        }
    }

    async closeSearchWithEscape(): Promise<void> {
        await this.page.keyboard.press('Escape');
        await expect(this.locators.searchInput).toBeHidden();
    }

    async closeSearchWithButton(): Promise<void> {
        await this.locators.clearSearchButton.click();
        await expect(this.locators.searchInput).toBeHidden();
    }

    async pressEscape(): Promise<void> {
        await this.page.keyboard.press('Escape');
    }

    async renameProjectWithEnter(title: string): Promise<void> {
        await this.locators.editProjectTitleButton.click();
        await this.locators.projectTitleInput.fill(title);
        const renameResponse = this.waitForTitleChangeResponse();
        await this.locators.projectTitleInput.press('Enter');
        expect((await renameResponse).ok()).toBeTruthy();
        await expect(this.locators.projectTitleInput).toBeDisabled();
    }

    async renameProjectWithBlur(title: string): Promise<void> {
        await this.locators.editProjectTitleButton.click();
        await this.locators.projectTitleInput.fill(title);
        const renameResponse = this.waitForTitleChangeResponse();
        await this.locators.editorRoot.click({ position: { x: 5, y: 5 } });
        expect((await renameResponse).ok()).toBeTruthy();
        await expect(this.locators.projectTitleInput).toBeDisabled();
    }

    async expectProjectTitle(title: string): Promise<void> {
        await expect(this.locators.projectTitleInput).toHaveValue(title);
    }

    private waitForTitleChangeResponse() {
        return this.page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                /\/api\/v\d+\/public\/project\/[^/]+\/title$/.test(
                    new URL(response.url()).pathname
                ),
            { timeout: 30_000 }
        );
    }

    async waitForSaved(): Promise<void> {
        await expect(this.locators.saveStatus).toBeVisible();
        await this.page.waitForTimeout(1_100);
        await expect(this.locators.saveSpinner).toBeHidden({ timeout: 30_000 });
    }

    async expectReadOnlyPublicProject(): Promise<void> {
        await expect(this.locators.readOnlyBadge).toBeVisible();
        await expect(this.locators.addSegmentSelect).toBeHidden();

        const editorCount = await this.locators.segmentEditors.count();
        for (let index = 0; index < editorCount; index += 1) {
            await expect(this.locators.segmentEditor(index)).toHaveAttribute(
                'aria-readonly',
                'true'
            );
        }
    }

    async setPublicAccess(isPublic: boolean): Promise<void> {
        await this.locators.shareButton.click();
        const option = isPublic
            ? this.locators.publicAccessOption
            : this.locators.privateAccessOption;

        if (!(await option.getAttribute('class'))?.includes('checked')) {
            const visibilityResponse = this.page.waitForResponse(
                (response) =>
                    response.request().method() === 'POST' &&
                    /\/api\/v\d+\/public\/project\/[^/]+\/visibility$/.test(
                        new URL(response.url()).pathname
                    ),
                { timeout: 30_000 }
            );
            await option.click();
            expect((await visibilityResponse).ok()).toBeTruthy();
        }

        await expect(option).toHaveClass(/checked/);
        await this.page.keyboard.press('Escape');
    }

    private async expectSegmentText(index: number, text: string): Promise<void> {
        await expect
            .poll(async () => {
                const lines = await this.locators
                    .segmentLines(index)
                    .allTextContents();
                return lines.join('\n');
            })
            .toBe(text);
    }
}
