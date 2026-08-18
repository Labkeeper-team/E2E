import { expect, test, type Page, type Response } from '@playwright/test';
import { EditorLocators } from './locators';
import { ProjectViewDsl } from './project-view.dsl';

const isCompilationResponse = (response: Response): boolean => {
    if (response.request().method() !== 'POST') {
        return false;
    }

    const path = new URL(response.url()).pathname;
    return /\/api\/v\d+\/public\/(?:project\/[^/]+\/)?compile(?:\/pdf)?$/.test(
        path
    );
};

export interface CompilationResult {
    status: number;
    url: string;
}

export class CompilationDsl {
    private readonly locators: EditorLocators;

    constructor(
        private readonly page: Page,
        private readonly projectView: ProjectViewDsl
    ) {
        this.locators = new EditorLocators(page);
    }

    async run(): Promise<CompilationResult> {
        await this.projectView.showEditor();
        if (await this.locators.autocompletePopup.isVisible()) {
            await this.page.keyboard.press('Escape');
            await expect(this.locators.autocompletePopup).toBeHidden();
        }
        await this.waitForSaved();
        const responsePromise = this.page.waitForResponse(
            isCompilationResponse,
            { timeout: 60_000 }
        );

        await this.locators.runButton.click();
        const response = await responsePromise;
        await expect(this.locators.enabledRunButton).toBeAttached({
            timeout: 60_000,
        });

        return {
            status: response.status(),
            url: response.url(),
        };
    }

    private async waitForSaved(): Promise<void> {
        await expect(this.locators.saveStatus).toBeVisible({
            timeout: 30_000,
        });
        await this.page.waitForTimeout(1_100);
        await expect(this.locators.saveSpinner).toBeHidden({
            timeout: 30_000,
        });
    }

    async runSuccessfully(): Promise<void> {
        const result = await this.run();
        expect(result.status).toBe(200);
    }

    async runWithCompilationErrors(): Promise<void> {
        const result = await this.run();
        expect(result.status).toBe(203);
    }

    async runAnonymousSuccessfully(): Promise<void> {
        await this.runAnonymousWithExpectedStatus(200);
    }

    async runAnonymousWithCompilationErrors(): Promise<void> {
        await this.runAnonymousWithExpectedStatus(203);
    }

    private async runAnonymousWithExpectedStatus(
        expectedStatus: number
    ): Promise<void> {
        const result = await this.run();
        test.skip(
            result.status === 425,
            'Production anonymous compilation limit returned HTTP 425'
        );
        expect(result.status).toBe(expectedStatus);
    }
}
