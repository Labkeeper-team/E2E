import type { Locator, Page } from '@playwright/test';

export type SegmentType =
    | 'Markdown'
    | 'Computation'
    | 'Simple-math'
    | 'Latex';

export class EditorLocators {
    constructor(private readonly page: Page) {}

    get editorRoot(): Locator {
        return this.page.locator('.project-container');
    }

    get addSegmentSelect(): Locator {
        return this.page
            .locator('.ide-header .labkeeper_select.computation .select-header')
            .first();
    }

    get emptyProjectAddSegmentSelect(): Locator {
        return this.page
            .locator(
                '.empty-project-placeholder-container .labkeeper_select.computation .select-header'
            )
            .first();
    }

    get addLatexToEmptyProjectButton(): Locator {
        return this.page
            .locator('.empty-project-placeholder-container')
            .getByRole('button', { name: 'Latex', exact: true });
    }

    segmentOption(type: SegmentType): Locator {
        return this.page
            .getByRole('listitem')
            .filter({ hasText: new RegExp(`^${type}$`, 'i') });
    }

    get segmentEditors(): Locator {
        return this.page.locator('.segment-editor-container .cm-content');
    }

    get errorDecorations(): Locator {
        return this.page.locator('.highlight-text-editor-error');
    }

    segmentEditor(index: number): Locator {
        return this.segmentEditors.nth(index);
    }

    segmentLines(index: number): Locator {
        return this.segmentEditor(index).locator('.cm-line');
    }

    get segmentContainers(): Locator {
        return this.page.locator('.segment-editor-container');
    }

    segmentContainer(index: number): Locator {
        return this.segmentContainers.nth(index);
    }

    segmentMenu(index: number): Locator {
        return this.segmentContainer(index).locator('.dropdown-menu-container');
    }

    segmentDeleteOption(index: number): Locator {
        return this.segmentContainer(index).getByText('Delete', {
            exact: true,
        });
    }

    get dividerButtons(): Locator {
        return this.page.locator('.segment-divider .divider-button');
    }

    dividerButton(index: number): Locator {
        return this.dividerButtons.nth(index);
    }

    dividerOption(index: number, type: SegmentType): Locator {
        return this.page
            .locator('.segment-divider')
            .nth(index)
            .locator('.divider-dropdown button')
            .filter({ hasText: new RegExp(`^${type}$`, 'i') });
    }

    get moveButtons(): Locator {
        return this.page.locator('.change-position-button');
    }

    moveButton(index: number): Locator {
        return this.moveButtons.nth(index);
    }

    moveSegmentUpButton(index: number): Locator {
        return this.segmentContainer(index).locator(
            '.change-position-button:not(.rotate)'
        );
    }

    moveSegmentDownButton(index: number): Locator {
        return this.segmentContainer(index).locator(
            '.change-position-button.rotate'
        );
    }

    get runButton(): Locator {
        return this.page.getByRole('button', { name: /^Run$/ });
    }

    get enabledRunButton(): Locator {
        return this.page.locator('.run-button:not(.disabled)');
    }

    get settingsButton(): Locator {
        return this.page
            .locator('.code-settings-header-container .action-button')
            .first();
    }

    projectTypeOption(type: 'markdown' | 'latex'): Locator {
        return this.settingsButton
            .locator('.project-settings-dropdown')
            .getByText(type, { exact: true });
    }

    get searchButton(): Locator {
        return this.page
            .locator('.code-settings-header-container .action-button')
            .last();
    }

    get searchInput(): Locator {
        return this.page.getByPlaceholder('Enter text to search...', {
            exact: true,
        });
    }

    get clearSearchButton(): Locator {
        return this.page.locator('.input-delete-icon');
    }

    get instructionsHeader(): Locator {
        return this.page.getByText('Instructions', { exact: true }).first();
    }

    get fileManagerButton(): Locator {
        return this.page.locator('.file-manager-button');
    }

    get undoButton(): Locator {
        return this.page.locator('.history-button.revert');
    }

    get redoButton(): Locator {
        return this.page.locator(
            '.history-code-header-container .history-button:not(.revert)'
        );
    }

    get saveStatus(): Locator {
        return this.page.getByLabel('save-status');
    }

    get saveSpinner(): Locator {
        return this.saveStatus.locator('.ide-clone-spinner');
    }

    get readOnlyBadge(): Locator {
        return this.page.getByText('readonly public project', {
            exact: true,
        });
    }

    get projectTitleInput(): Locator {
        return this.page.locator(
            '.labkeeper_header__center input.change-title-input'
        );
    }

    get editProjectTitleButton(): Locator {
        return this.page.locator(
            '.labkeeper_header__center .change-titlepress-button'
        );
    }

    get shareButton(): Locator {
        return this.page.locator('.labkeeper_header__center .share-button');
    }

    get privateAccessOption(): Locator {
        return this.page
            .locator('.share-modal .labkeeper-radio')
            .filter({ hasText: /^Access is only for me$/ });
    }

    get publicAccessOption(): Locator {
        return this.page
            .locator('.share-modal .labkeeper-radio')
            .filter({ hasText: /^Access for everyone$/ });
    }

    get closeModalArea(): Locator {
        return this.page.locator('.modal-overlay');
    }
}
