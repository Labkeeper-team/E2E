import type { Locator, Page } from '@playwright/test';

export type ProjectView = 'Files' | 'Editor' | 'PDF';

export class ProjectViewLocators {
    constructor(private readonly page: Page) {}

    get switcher(): Locator {
        return this.page.locator('.mobile-view-switcher-bar');
    }

    get toggle(): Locator {
        return this.switcher.locator('.mobile-view-switcher-bar__toggle');
    }

    option(view: ProjectView): Locator {
        return this.switcher.getByRole('option', {
            name: view,
            exact: true,
        });
    }

    pane(view: ProjectView): Locator {
        return this.page.locator(
            `.project-pane--${view.toLowerCase()}.project-pane--active`
        );
    }
}
