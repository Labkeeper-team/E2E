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

    // старая страница: кнопка под таблицей; новая (LabkeeperEditor#251): в боковой
    // панели, на телефоне в шапке, без проектов посередине страницы
    get addProjectButton(): Locator {
        return this.page
            .locator(
                [
                    'button.add-project-button:visible',
                    '.add-project-button-footer button:visible',
                    'button.projects-sidebar__add:visible',
                    'button.projects-header__add:visible',
                ].join(', ')
            )
            .first();
    }

    // окно создания заменила своя страница /projects/new
    get newProjectPage(): Locator {
        return this.page.locator('.new-project');
    }

    get editorRoot(): Locator {
        return this.page.locator('.project-container');
    }

    get projectListSurface(): Locator {
        return this.page.locator('.project-content-container');
    }

    get projectNameInput(): Locator {
        return this.newProjectPage.getByRole('textbox');
    }

    projectTypeOption(type: 'Markdown' | 'LaTeX'): Locator {
        return this.newProjectPage.locator('.new-project__type').filter({
            has: this.page.locator('.new-project__type-name', {
                hasText: new RegExp(`^${type}$`),
            }),
        });
    }

    get createProjectButton(): Locator {
        return this.newProjectPage.locator('.new-project__create');
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

    // старая страница: корзина прямо в строке
    projectDeleteButton(title: string): Locator {
        return this.projectRow(title).locator('.delete-project-container');
    }

    // новая страница: «⋯» в строке открывает меню проекта
    projectActionsButton(title: string): Locator {
        return this.projectRow(title).locator('button[aria-haspopup="menu"]');
    }

    // меню рисуется в body, пункт ищем по действию, а не по тексту языка
    get deleteMenuItem(): Locator {
        return this.page.locator(
            '[role="menu"] [role="menuitem"][data-action="delete"]'
        );
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
