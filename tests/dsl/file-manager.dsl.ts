import { expect, type Page } from '@playwright/test';
import { EditorLocators, FileManagerLocators } from './locators';
import { ProjectViewDsl } from './project-view.dsl';

const TEXT_FILE_INPUT_ATTEMPTS = 3;

export class FileManagerDsl {
    private readonly editor: EditorLocators;
    private readonly files: FileManagerLocators;
    private openTextFileName?: string;

    constructor(
        private readonly page: Page,
        private readonly projectView: ProjectViewDsl
    ) {
        this.editor = new EditorLocators(page);
        this.files = new FileManagerLocators(page);
    }

    async open(): Promise<void> {
        if (this.projectView.isMobile()) {
            await this.projectView.showFiles();
        } else {
            await this.editor.fileManagerButton.click();
        }
        await expect(this.files.panel).toBeVisible();
        await expect(this.files.loadingSpinner).toBeHidden({ timeout: 30_000 });
        await expect(this.files.tree).toBeVisible({ timeout: 30_000 });
    }

    async close(): Promise<void> {
        await this.projectView.showFiles();
        await this.files.closeButton.click();
        await expect(this.files.panel).toBeHidden();
    }

    async closeFromStack(): Promise<void> {
        await this.projectView.showFiles();
        if (this.projectView.isMobile()) {
            await this.files.closeButton.click();
        } else {
            await this.page.keyboard.press('Escape');
        }
        await expect(this.files.panel).toBeHidden();
    }

    async uploadTextFile(name: string, contents: string): Promise<void> {
        await this.projectView.showFiles();
        await this.files.uploadInput.setInputFiles({
            name,
            mimeType: 'text/plain',
            buffer: Buffer.from(contents),
        });
        await expect(this.files.userFile(name)).toBeVisible({
            timeout: 30_000,
        });
    }

    async createFile(expectedName = 'new.txt'): Promise<void> {
        await this.projectView.showFiles();
        const responsePromise = this.waitForFileMutation('PUT', 'upload', {
            name: expectedName,
        });
        await this.files.createFileButton.click();
        expect((await responsePromise).ok()).toBeTruthy();
        await expect(this.files.fileRow(expectedName)).toBeVisible({
            timeout: 30_000,
        });
        this.openTextFileName = expectedName;
    }

    async renameFile(currentName: string, newName: string): Promise<void> {
        await this.projectView.showFiles();
        await this.files.fileMenuButton(currentName).click();
        await this.files.visibleEditMenuItem.click();
        await expect(this.files.editingNameInput).toBeVisible();
        await this.files.editingNameInput.fill(newName);

        const responsePromise = this.waitForFileMutation('POST', 'rename');
        await this.files.editingNameInput.press('Enter');
        expect((await responsePromise).ok()).toBeTruthy();
        await expect(this.files.fileRow(newName)).toBeVisible({
            timeout: 30_000,
        });
        await expect(this.files.fileRow(currentName)).toHaveCount(0);
        if (this.openTextFileName === currentName) {
            this.openTextFileName = newName;
        }
    }

    async openTextFile(name: string): Promise<void> {
        await this.projectView.showFiles();
        await this.files.fileRow(name).click();
        await this.projectView.showEditor();
        await expect(this.files.textFileEditor).toBeVisible({
            timeout: 30_000,
        });
        await expect(this.files.textFileEditorTitle).toHaveText(name);
        await expect(this.files.textFileEditorContent).toBeVisible({
            timeout: 30_000,
        });
        this.openTextFileName = name;
    }

    async editOpenTextFile(contents: string): Promise<void> {
        await this.projectView.showEditor();
        if (!this.openTextFileName) {
            throw new Error('No text file is open for editing');
        }
        const responsePromise = this.waitForFileMutation('PUT', 'upload', {
            name: this.openTextFileName,
        });
        try {
            await this.fillOpenTextFile(contents);
        } catch (error) {
            void responsePromise.catch(() => undefined);
            throw error;
        }
        expect((await responsePromise).ok()).toBeTruthy();
        await expect(this.files.textFileSaveSpinner).toBeHidden({
            timeout: 30_000,
        });
        await this.expectOpenTextFileContents(contents);
    }

    async closeTextFile(): Promise<void> {
        await this.projectView.showEditor();
        await this.files.closeTextFileEditorButton.click();
        await expect(this.files.textFileEditor).toBeHidden();
        this.openTextFileName = undefined;
        await this.projectView.showFiles();
    }

    async expectOpenTextFileContents(
        contents: string,
        timeout = 15_000
    ): Promise<void> {
        await this.projectView.showEditor();
        await expect
            .poll(
                async () => {
                    const lines =
                        await this.files.textFileEditorLines.allTextContents();
                    return lines.join('\n');
                },
                { timeout }
            )
            .toBe(contents);
    }

    async expectOpenTextFileContainsText(text: string): Promise<void> {
        await this.projectView.showEditor();
        await expect(this.files.textFileEditorContent).toContainText(text);
    }

    async waitForOpenTextFileSaved(): Promise<void> {
        await this.projectView.showEditor();
        if (!this.openTextFileName) {
            throw new Error('No text file is open for editing');
        }

        await expect(this.files.textFileSaveStatus).toBeVisible();
        await this.page.waitForTimeout(1_100);
        await expect(this.files.textFileSaveSpinner).toBeHidden({
            timeout: 30_000,
        });
    }

    async expectLatexSyntaxHighlighting(): Promise<void> {
        await this.projectView.showEditor();
        await expect(this.files.textFileSyntaxTokens.first()).toBeVisible();
        const tokens = await this.files.textFileSyntaxTokens.evaluateAll(
            (elements) =>
                elements.map((element) => ({
                    className: element.className,
                    text: element.textContent ?? '',
                }))
        );

        expect(tokens.map((token) => token.text).join('')).toContain(
            '\\section'
        );
        expect(
            tokens.some((token) => token.className.trim().length > 0)
        ).toBeTruthy();
    }

    async createFolder(name: string): Promise<void> {
        await this.projectView.showFiles();
        await this.files.createFolderButton.click();
        await expect(this.files.creatingFolderInput).toBeVisible();
        await this.files.creatingFolderInput.fill(name);
        await this.files.creatingFolderInput.press('Enter');
        const folder = this.files.folderRow(name);
        await expect(folder).toBeVisible();
        await expect(folder).toHaveClass(/tree-row-selected/);
    }

    async selectRootFolder(): Promise<void> {
        await this.projectView.showFiles();
        await this.files.rootFolderRow.click();
    }

    async renameFolder(currentName: string, newName: string): Promise<void> {
        await this.projectView.showFiles();
        await this.files.folderRow(currentName).hover();
        await this.files.folderEditButton(currentName).click();
        await expect(this.files.editingNameInput).toBeVisible();
        await this.files.editingNameInput.fill(newName);

        const responsePromise = this.waitForFolderMutation('POST', 'rename');
        await this.files.editingNameInput.press('Enter');
        expect((await responsePromise).ok()).toBeTruthy();
        await expect(this.files.folderRow(newName)).toBeVisible({
            timeout: 30_000,
        });
        await expect(this.files.folderRow(currentName)).toHaveCount(0);
    }

    async deleteFolder(name: string): Promise<void> {
        await this.projectView.showFiles();
        const responsePromise = this.waitForFolderMutation('DELETE', 'delete');
        await this.files.folderRow(name).hover();
        await this.files.folderDeleteButton(name).click();
        expect((await responsePromise).ok()).toBeTruthy();
        await expect(this.files.folderRow(name)).toHaveCount(0, {
            timeout: 30_000,
        });
    }

    async dragTextFileToRoot(
        name: string,
        contents: string
    ): Promise<void> {
        await this.projectView.showFiles();
        const dataTransfer = await this.page.evaluateHandle(
            ({ fileName, fileContents }) => {
                const transfer = new DataTransfer();
                transfer.items.add(
                    new File([fileContents], fileName, {
                        type: 'text/plain',
                    })
                );
                return transfer;
            },
            { fileName: name, fileContents: contents }
        );

        try {
            await this.files.rootFolderRow.dispatchEvent('dragenter', {
                dataTransfer,
            });
            await expect
                .poll(async () => {
                    await this.files.rootFolderRow.dispatchEvent('dragover', {
                        dataTransfer,
                    });
                    return this.files.rootDropZone.getAttribute('class');
                })
                .toContain('file-tree-root-drop-zone-active');

            const responsePromise = this.waitForFileMutation('PUT', 'upload', {
                name,
            });
            await this.files.rootFolderRow.dispatchEvent('drop', {
                dataTransfer,
            });
            expect((await responsePromise).ok()).toBeTruthy();
        } finally {
            await dataTransfer.dispose();
        }

        await expect(this.files.fileRow(name)).toBeVisible({
            timeout: 30_000,
        });
    }

    async expectFile(name: string): Promise<void> {
        await this.projectView.showFiles();
        await expect(this.files.fileRow(name)).toBeVisible({
            timeout: 30_000,
        });
    }

    async expectFileInFolder(
        folderName: string,
        fileName: string
    ): Promise<void> {
        await this.projectView.showFiles();
        await expect(this.files.folderRow(folderName)).toBeVisible({
            timeout: 30_000,
        });
        if ((await this.files.folderChildren(folderName).count()) === 0) {
            await this.files.folderToggleButton(folderName).click();
        }
        await expect(
            this.files.fileInFolder(folderName, fileName)
        ).toBeVisible({ timeout: 30_000 });
    }

    async expectFileMissing(name: string): Promise<void> {
        await this.projectView.showFiles();
        await expect(this.files.fileRow(name)).toHaveCount(0);
    }

    async uploadOversizedFile(): Promise<void> {
        await this.projectView.showFiles();
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
        await this.projectView.showFiles();
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
        await this.projectView.showFiles();
        await expect(this.files.generatedCsvFiles.first()).toBeVisible({
            timeout: 30_000,
        });
    }

    private async fillOpenTextFile(contents: string): Promise<void> {
        let lastError: unknown;

        for (let attempt = 0; attempt < TEXT_FILE_INPUT_ATTEMPTS; attempt += 1) {
            try {
                const editor = this.files.textFileEditorContent;
                await expect(editor).toBeEditable({ timeout: 30_000 });
                await editor.focus();

                if (attempt === 1) {
                    await editor.fill(contents);
                } else {
                    await editor.press('Control+a');
                    await editor.press('Backspace');
                    await this.expectStableOpenTextFileContents('');

                    if (contents) {
                        await editor.focus();
                        await this.page.keyboard.insertText(contents);
                    }
                }

                await this.expectStableOpenTextFileContents(
                    contents,
                    attempt < TEXT_FILE_INPUT_ATTEMPTS - 1 ? 5_000 : 15_000
                );
                return;
            } catch (error) {
                lastError = error;
                if (attempt < TEXT_FILE_INPUT_ATTEMPTS - 1) {
                    await this.page.waitForTimeout(250);
                }
            }
        }

        throw lastError;
    }

    private async expectStableOpenTextFileContents(
        contents: string,
        timeout = 5_000
    ): Promise<void> {
        await this.expectOpenTextFileContents(contents, timeout);
        await this.page.waitForTimeout(100);
        await this.expectOpenTextFileContents(contents, timeout);
    }

    private waitForFileMutation(
        method: string,
        operation: string,
        expected?: { name?: string }
    ) {
        return this.page.waitForResponse(
            (response) => {
                if (
                    response.request().method() !== method ||
                    !new RegExp(
                        `/api/v\\d+/public/project/[^/]+/file/${operation}$`
                    ).test(new URL(response.url()).pathname)
                ) {
                    return false;
                }

                const url = new URL(response.url());
                if (expected?.name) {
                    const requestName = url.searchParams
                        .get('name')
                        ?.split('/')
                        .pop();
                    if (requestName !== expected.name) {
                        return false;
                    }
                }

                return true;
            },
            { timeout: 30_000 }
        );
    }

    private waitForFolderMutation(method: string, operation: string) {
        return this.page.waitForResponse(
            (response) =>
                response.request().method() === method &&
                new RegExp(
                    `/api/v\\d+/public/project/[^/]+/file/folder/${operation}$`
                ).test(new URL(response.url()).pathname),
            { timeout: 30_000 }
        );
    }
}
