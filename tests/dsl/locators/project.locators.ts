import type { Locator, Page } from '@playwright/test';

export class ProjectLocators {
    constructor(private readonly page: Page) {}

    get headerMenu(): Locator {
        return this.page.locator('.header-menu-select .select-header');
    }

    menuOption(title: string): Locator {
        return this.page
            .locator('.header-menu-select')
            .getByRole('listitem')
            .filter({ hasText: new RegExp(`^${title}$`) });
    }

    get addProjectButton(): Locator {
        return this.page
            .locator('.add-project-button, .add-project-button-footer')
            .first();
    }

    get addProjectModal(): Locator {
        return this.page.locator('.add-project-modal');
    }

    get projectListSurface(): Locator {
        return this.page.locator('table').first();
    }

    get projectNameInput(): Locator {
        return this.addProjectModal.getByRole('textbox');
    }

    projectTypeOption(type: 'Markdown' | 'LaTeX'): Locator {
        return this.addProjectModal.getByText(type, { exact: true });
    }

    get createProjectButton(): Locator {
        return this.addProjectModal.getByRole('button', {
            name: 'Create',
            exact: true,
        });
    }

    projectRow(title: string): Locator {
        return this.page.locator('tr').filter({
            has: this.page.getByText(title, { exact: true }),
        });
    }

    projectTitleInput(title: string): Locator {
        return this.projectRow(title).locator('input.input-base');
    }

    projectEditTitleButton(title: string): Locator {
        return this.projectRow(title).locator('.change-icon-container');
    }

    get editingProjectTitleInput(): Locator {
        return this.page.locator('table input.input-base:not([disabled])');
    }

    projectDeleteButton(title: string): Locator {
        return this.projectRow(title).locator('.delete-project-container');
    }

    get confirmDeleteButton(): Locator {
        return this.page
            .locator('.delete-project-modal')
            .getByRole('button', { name: 'Yes', exact: true });
    }

    get backToProjectsButton(): Locator {
        return this.page.locator(
            '.labkeeper_header__left button.image-button.rotate'
        );
    }
}
