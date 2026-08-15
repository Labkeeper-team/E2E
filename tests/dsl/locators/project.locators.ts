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
            .locator(
                'button.add-project-button:visible, .add-project-button-footer button:visible'
            )
            .first();
    }

    get addProjectModal(): Locator {
        return this.page.locator('.add-project-modal');
    }

    get editorRoot(): Locator {
        return this.page.locator('.project-container');
    }

    get projectListSurface(): Locator {
        return this.page.locator('.project-content-container');
    }

    get projectNameInput(): Locator {
        return this.addProjectModal.getByRole('textbox');
    }

    projectTypeOption(type: 'Markdown' | 'LaTeX'): Locator {
        return this.addProjectModal.locator('.labkeeper-radio').filter({
            hasText: new RegExp(`^${type}$`),
        });
    }

    get createProjectButton(): Locator {
        return this.addProjectModal.getByRole('button', {
            name: 'Create',
            exact: true,
        });
    }

    projectRow(title: string): Locator {
        return this.page.locator('tr, .projects-card').filter({
            hasText: title,
        });
    }

    projectTitleInput(title: string): Locator {
        return this.projectRow(title).locator('input.input-base');
    }

    projectEditTitleButton(title: string): Locator {
        return this.projectRow(title).locator('.change-icon-container');
    }

    get editingProjectTitleInput(): Locator {
        return this.page.locator(
            '.projects-list-wrapper input.input-base:not([disabled])'
        );
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
