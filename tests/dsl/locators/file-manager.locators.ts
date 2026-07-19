import type { Locator, Page } from '@playwright/test';

export class FileManagerLocators {
    constructor(private readonly page: Page) {}

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
