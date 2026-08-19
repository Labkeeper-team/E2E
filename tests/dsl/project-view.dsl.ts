import { expect, type Page } from '@playwright/test';
import {
    ProjectViewLocators,
    type ProjectView,
} from './locators/project-view.locators';

const MOBILE_BREAKPOINT = 767;

export class ProjectViewDsl {
    private readonly locators: ProjectViewLocators;

    constructor(private readonly page: Page) {
        this.locators = new ProjectViewLocators(page);
    }

    isMobile(): boolean {
        return (this.page.viewportSize()?.width ?? Infinity) <= MOBILE_BREAKPOINT;
    }

    async showFiles(): Promise<void> {
        await this.show('Files');
    }

    async showEditor(): Promise<void> {
        await this.show('Editor');
    }

    async showPdf(): Promise<void> {
        await this.show('PDF');
    }

    private async show(view: ProjectView): Promise<void> {
        if (!this.isMobile()) {
            return;
        }

        await expect(this.locators.switcher).toBeVisible({ timeout: 60_000 });
        const pane = this.locators.pane(view);
        if (await pane.isVisible()) {
            return;
        }

        const option = this.locators.option(view);
        if (!(await option.isVisible())) {
            await this.locators.toggle.click();
        }
        await option.click();
        await expect(pane).toBeVisible({ timeout: 60_000 });
    }
}
