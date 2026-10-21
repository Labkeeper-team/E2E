import { expect, type Page, type Response } from '@playwright/test';
import {
    EditorLocators,
    FileManagerLocators,
    HotkeysLocators,
} from './locators';

// The search paints every match and marks the current one with its own class
const CURRENT_MATCH = '.highlight-text-editor--current';

const navigationResponse = (page: Page, target: 'pdf' | 'doc') =>
    page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' &&
            new RegExp(
                `/api/v\\d+/public/project/[^/]+/navigation/${target}$`
            ).test(new URL(response.url()).pathname),
        { timeout: 30_000 }
    );

/** Keyboard shortcuts of the project page, pressed the way a desktop user presses them */
export class HotkeysDsl {
    private readonly locators: HotkeysLocators;
    private readonly editor: EditorLocators;
    private readonly files: FileManagerLocators;
    private mod?: 'Meta' | 'Control';

    constructor(private readonly page: Page) {
        this.locators = new HotkeysLocators(page);
        this.editor = new EditorLocators(page);
        this.files = new FileManagerLocators(page);
    }

    /**
     * The editor takes mod as Cmd when the user agent says macOS, which the Desktop Safari profile does,
     * and as Ctrl elsewhere. Playwright's ControlOrMeta follows the machine running the test instead
     */
    async modKey(): Promise<'Meta' | 'Control'> {
        this.mod ??= (await this.page.evaluate(
            () =>
                /mac/i.test(navigator.userAgent) &&
                !/iphone|ipad|ipod/i.test(navigator.userAgent)
        ))
            ? 'Meta'
            : 'Control';
        return this.mod;
    }

    async withMod(key: string): Promise<string> {
        return `${await this.modKey()}+${key}`;
    }

    async press(keys: string): Promise<void> {
        await this.page.keyboard.press(keys);
    }

    async openShortcutsFromHelpMenu(): Promise<void> {
        await this.locators.helpMenuButton.click();
        await this.locators.shortcutsMenuItem.click();
        await expect(this.locators.shortcutsDialog).toBeVisible();
        await expect(this.locators.shortcutsTitle).toHaveText(
            'Keyboard shortcuts'
        );
    }

    async expectShortcutsListed(actions: string[]): Promise<void> {
        for (const action of actions) {
            await expect(this.locators.shortcutAction(action)).toBeVisible();
        }
    }

    async closeShortcutsWithEscape(): Promise<void> {
        await this.page.keyboard.press('Escape');
        await expect(this.locators.shortcutsDialog).toBeHidden();
    }

    async openSearch(): Promise<void> {
        await this.press(await this.withMod('KeyF'));
        await expect(this.editor.searchInput).toBeVisible();
        await expect(this.editor.searchInput).toBeFocused();
    }

    async typeSearch(text: string): Promise<void> {
        await this.page.keyboard.insertText(text);
        await expect(this.editor.searchInput).toHaveValue(text);
    }

    async closeSearchWithEscape(): Promise<void> {
        await this.page.keyboard.press('Escape');
        await expect(this.editor.searchInput).toBeHidden();
    }

    /** Index of the segment holding the current search match, or -1 */
    private async currentMatchSegment(): Promise<number> {
        return this.editor.segmentContainers.evaluateAll(
            (containers, selector) =>
                containers.findIndex((container) =>
                    container.querySelector(selector)
                ),
            CURRENT_MATCH
        );
    }

    /** Presses a search step and returns the segment its current match moved to */
    async stepSearch(keys: 'F3' | 'Shift+F3'): Promise<number> {
        const before = await this.currentMatchSegment();
        await this.press(keys);
        let after = -1;
        await expect
            .poll(
                async () => {
                    after = await this.currentMatchSegment();
                    return after !== -1 && after !== before;
                },
                { message: `${keys} did not move the current search match` }
            )
            .toBe(true);
        return after;
    }

    async expectFocusedSegment(index: number): Promise<void> {
        await expect(this.editor.segmentCodeMirror(index)).toHaveClass(
            /cm-focused/
        );
    }

    async toggleFileManager(): Promise<void> {
        await this.press(await this.withMod('Shift+KeyE'));
    }

    async expectFileManagerShown(shown: boolean): Promise<void> {
        if (shown) {
            await expect(this.files.panel).toBeVisible();
        } else {
            await expect(this.files.panel).toBeHidden();
        }
    }

    async addLatexSegmentBelow(): Promise<void> {
        await this.press(await this.withMod('Shift+KeyL'));
    }

    async syncToPdf(): Promise<void> {
        const response = navigationResponse(this.page, 'pdf');
        await this.press('Control+Alt+KeyJ');
        expect((await response).ok()).toBeTruthy();
    }

    async syncToSource(): Promise<{ segmentId?: number; line?: number }> {
        const response: Promise<Response> = navigationResponse(
            this.page,
            'doc'
        );
        await this.press('Control+Alt+KeyK');
        const answer = await response;
        expect(answer.ok()).toBeTruthy();
        return (await answer.json()) as { segmentId?: number; line?: number };
    }

    async sendErrorsToAgent(): Promise<void> {
        await this.press(await this.withMod('Period'));
    }

    /** The prompt starts with the text, the errors follow it, and the caret stands at the very end */
    async expectAgentPromptStartingWith(text: string): Promise<void> {
        await expect(this.locators.promptEditor).toBeFocused();
        await expect(this.locators.promptEditor).toHaveText(
            new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
        );
        // the caret stands after the text, so typing goes on from its end
        await expect
            .poll(() =>
                this.page.evaluate(() => {
                    const selection = document.getSelection();
                    const range = selection?.rangeCount
                        ? selection.getRangeAt(0)
                        : undefined;
                    if (!range?.collapsed) {
                        return false;
                    }
                    const after = range.cloneRange();
                    const root = (range.startContainer.parentElement?.closest(
                        '.cm-content'
                    ) ?? null) as Element | null;
                    if (!root) {
                        return false;
                    }
                    after.setEndAfter(root.lastChild as Node);
                    return after.toString() === '';
                })
            )
            .toBe(true);
    }

    async showFinalDocument(): Promise<void> {
        await this.press('Control+Alt+KeyP');
    }

    async expectFinalDocumentShown(): Promise<void> {
        await expect(this.locators.finalDocumentTab).toHaveClass(
            /viewer-tabs__tab--active/
        );
    }

    async expectAgentTabShown(): Promise<void> {
        await expect(this.locators.agentTab).toHaveClass(
            /viewer-tabs__tab--active/
        );
    }

    async undo(): Promise<void> {
        await this.press(await this.withMod('KeyZ'));
    }

    async redo(): Promise<void> {
        // Ctrl+Y is redo on macOS too, where it stays on Control
        await this.press('Control+KeyY');
    }
}
