import { expect, type Page } from '@playwright/test';
import { editorPath } from '../input';
import { EditorLocators } from './locators';

export class NavigationDsl {
    private readonly editorLocators: EditorLocators;

    constructor(private readonly page: Page) {
        this.editorLocators = new EditorLocators(page);
    }

    async openEditor(path = '/project/default'): Promise<void> {
        const target = editorPath(path);
        await this.retryNavigation(async () => {
            await this.page.goto(target, {
                waitUntil: 'domcontentloaded',
                timeout: 60_000,
            });
            await expect(this.page).toHaveTitle(/Labkeeper/);
            await this.editorLocators.editorRoot.waitFor({
                state: 'visible',
                timeout: 60_000,
            });
        });
    }

    async openPath(path: string): Promise<void> {
        await this.retryNavigation(async () => {
            await this.page.goto(path, {
                waitUntil: 'domcontentloaded',
                timeout: 60_000,
            });
            await expect(this.page).toHaveTitle(/Labkeeper/);
        });
    }

    async reload(): Promise<void> {
        await this.retryNavigation(async () => {
            await this.page.reload({
                waitUntil: 'domcontentloaded',
                timeout: 60_000,
            });
            await this.editorLocators.editorRoot.waitFor({
                state: 'visible',
                timeout: 60_000,
            });
        });
    }

    async expectPath(path: string | RegExp): Promise<void> {
        await expect(this.page).toHaveURL(path);
    }

    currentProjectPath(): string {
        const url = new URL(this.page.url());
        return url.pathname;
    }

    currentProjectId(): string {
        const match = this.currentProjectPath().match(/^\/project\/([^/]+)$/);

        if (!match || match[1] === 'default') {
            throw new Error('The current page is not a persisted project');
        }

        return match[1];
    }

    private async retryNavigation(action: () => Promise<void>): Promise<void> {
        let lastError: unknown;

        for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
                await action();
                return;
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError;
    }
}
