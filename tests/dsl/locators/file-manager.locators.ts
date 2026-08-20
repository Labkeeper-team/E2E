import type { Locator, Page } from '@playwright/test';

export class FileManagerLocators {
    constructor(private readonly page: Page) {}

    private exactText(text: string): RegExp {
        return new RegExp(
            `^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`
        );
    }

    get panel(): Locator {
        return this.page.locator('.manager-container');
    }

    get tree(): Locator {
        return this.panel.locator('.file-tree-view');
    }

    get closeButton(): Locator {
        return this.panel.locator('.close-icon-container');
    }

    get uploadInput(): Locator {
        return this.panel.locator('input[type="file"]');
    }

    get addFilesButton(): Locator {
        return this.panel.getByRole('button', { name: /Add files/ });
    }

    get createFileButton(): Locator {
        return this.panel.getByRole('button', { name: /Create file/ });
    }

    get createFolderButton(): Locator {
        return this.panel.getByRole('button', { name: /New folder/ });
    }

    userFile(name: string | RegExp): Locator {
        return this.panel
            .locator('.file-tree-user-branch .tree-row-file')
            .filter({ hasText: name });
    }

    fileRow(name: string): Locator {
        return this.panel
            .locator('.file-tree-user-branch .tree-row-file')
            .filter({
                has: this.page
                    .locator('.tree-row-label')
                    .filter({ hasText: this.exactText(name) }),
            });
    }

    folderRow(name: string): Locator {
        return this.panel.locator('.tree-row-folder').filter({
            has: this.page
                .locator('.tree-row-label')
                .filter({ hasText: this.exactText(name) }),
        });
    }

    folderBranch(name: string): Locator {
        return this.panel.locator('.tree-folder-drop-zone').filter({
            has: this.page
                .locator('.tree-row-folder > .tree-row-label')
                .filter({ hasText: this.exactText(name) }),
        });
    }

    fileInFolder(folderName: string, fileName: string): Locator {
        return this.folderBranch(folderName).locator('.tree-row-file').filter({
            has: this.page
                .locator('.tree-row-label')
                .filter({ hasText: this.exactText(fileName) }),
        });
    }

    folderToggleButton(name: string): Locator {
        return this.folderRow(name).locator('.tree-toggle');
    }

    folderChildren(name: string): Locator {
        return this.folderBranch(name).locator(':scope > .tree-children');
    }

    fileMenuButton(name: string): Locator {
        return this.fileRow(name).locator('.dropdown-menu-container');
    }

    get visibleEditMenuItem(): Locator {
        return this.page
            .locator('.tree-menu-item:visible')
            .filter({ hasText: /^Edit$/ });
    }

    folderEditButton(name: string): Locator {
        return this.folderRow(name).getByRole('button', {
            name: 'Edit',
            exact: true,
        });
    }

    folderDeleteButton(name: string): Locator {
        return this.folderRow(name).getByRole('button', {
            name: 'Delete',
            exact: true,
        });
    }

    get editingNameInput(): Locator {
        return this.panel.locator('.tree-row-label-editing input');
    }

    get creatingFolderInput(): Locator {
        return this.panel.locator('.tree-row-creating input');
    }

    get rootFolderRow(): Locator {
        return this.panel.locator('.tree-root-zone');
    }

    get rootDropZone(): Locator {
        return this.panel.locator('.file-tree-root-drop-zone');
    }

    get textFileEditor(): Locator {
        return this.page.locator('.text-file-editor-panel');
    }

    get textFileEditorTitle(): Locator {
        return this.textFileEditor.locator('.text-file-editor-title');
    }

    get closeTextFileEditorButton(): Locator {
        return this.textFileEditor.getByRole('button', {
            name: 'Close',
            exact: true,
        });
    }

    get textFileEditorContent(): Locator {
        return this.textFileEditor.locator('.cm-content');
    }

    get textFileEditorLines(): Locator {
        return this.textFileEditorContent.locator('.cm-line');
    }

    get textFileSyntaxTokens(): Locator {
        return this.textFileEditorLines.locator('span');
    }

    get textFileSaveStatus(): Locator {
        return this.textFileEditor.getByLabel('save-status');
    }

    get textFileSaveSpinner(): Locator {
        return this.textFileSaveStatus.locator('.text-file-editor-save-spinner');
    }

    systemFile(name: string | RegExp): Locator {
        return this.panel
            .locator('.file-tree-system-section .tree-row-file')
            .filter({ hasText: name });
    }

    get generatedCsvFiles(): Locator {
        return this.panel
            .locator('.file-tree-system-section .tree-row-file')
            .filter({ hasText: /\.csv$/ });
    }

    get loadingSpinner(): Locator {
        return this.panel.locator('.ide-loading-spinner');
    }

    get emptyMessage(): Locator {
        return this.panel.getByText('No files yet', { exact: true });
    }

    get toast(): Locator {
        return this.page.locator('.Toastify__toast');
    }
}
