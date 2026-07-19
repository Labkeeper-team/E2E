import { expect, type Page } from '@playwright/test';
import { EditorLocators, FileManagerLocators } from './locators';

export class FileManagerDsl {
    private readonly editor: EditorLocators;
    private readonly files: FileManagerLocators;

    constructor(private readonly page: Page) {
        this.editor = new EditorLocators(page);
        this.files = new FileManagerLocators(page);
    }

    async open(): Promise<void> {
        await this.editor.fileManagerButton.click();
        await expect(this.files.panel).toBeVisible();
        await expect(this.files.loadingSpinner).toBeHidden({ timeout: 30_000 });
        await expect(this.files.tree).toBeVisible({ timeout: 30_000 });
    }

    async close(): Promise<void> {
        await this.files.closeButton.click();
        await expect(this.files.panel).toBeHidden();
    }

    async closeWithEscape(): Promise<void> {
        await this.page.keyboard.press('Escape');
        await expect(this.files.panel).toBeHidden();
    }

    async uploadTextFile(name: string, contents: string): Promise<void> {
        await this.files.uploadInput.setInputFiles({
            name,
            mimeType: 'text/plain',
            buffer: Buffer.from(contents),
        });
        await expect(this.files.userFile(name)).toBeVisible({
            timeout: 30_000,
        });
    }

    async uploadOversizedFile(): Promise<void> {
        const maximumSize = 10 * 1024 * 1024;
        await this.files.uploadInput.setInputFiles({
            name: 'oversized-e2e.csv',
            mimeType: 'text/csv',
            buffer: Buffer.alloc(maximumSize + 1, '0'),
        });
        await expect(this.files.toast.first()).toContainText('Too big file', {
            timeout: 30_000,
        });
        await expect(this.files.userFile('oversized-e2e.csv')).toHaveCount(0);
    }

    async uploadFileWithExpiredSession(): Promise<void> {
        await this.files.uploadInput.setInputFiles({
            name: 'expired-session.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('expired session'),
        });
        await expect(this.files.toast.first()).toContainText(
            'Session has expired',
            { timeout: 30_000 }
        );
    }

    async expectGeneratedCsv(): Promise<void> {
        await expect(this.files.generatedCsvFiles.first()).toBeVisible({
            timeout: 30_000,
        });
    }
}
