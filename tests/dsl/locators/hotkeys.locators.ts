import type { Locator, Page } from '@playwright/test';

export class HotkeysLocators {
    constructor(private readonly page: Page) {}

    // The book icon in the editor header, between the project settings and the search
    get helpMenuButton(): Locator {
        return this.page
            .locator('.code-settings-header-container .action-button')
            .nth(1);
    }

    get shortcutsMenuItem(): Locator {
        return this.page.locator('.markdown-select-dropdown__hotkeys');
    }

    get shortcutsDialog(): Locator {
        return this.page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    }

    get shortcutsTitle(): Locator {
        return this.shortcutsDialog.locator('.hotkeys-help__title');
    }

    shortcutAction(text: string): Locator {
        return this.shortcutsDialog.getByText(text, { exact: true });
    }

    get agentTab(): Locator {
        return this.page.locator('.viewer-tabs__tab').first();
    }

    get finalDocumentTab(): Locator {
        return this.page
            .locator('.viewer-tabs__tab')
            .filter({ hasText: /^Final document$/ });
    }

    get promptEditor(): Locator {
        return this.page.locator('.agent-chat .cm-content').first();
    }
}
