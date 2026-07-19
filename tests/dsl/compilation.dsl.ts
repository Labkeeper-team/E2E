import { expect, test, type Page, type Response } from '@playwright/test';
import { EditorLocators } from './locators';

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

    constructor(private readonly page: Page) {
        this.locators = new EditorLocators(page);
    }

    async run(): Promise<CompilationResult> {
        const responsePromise = this.page.waitForResponse(
            isCompilationResponse,
            { timeout: 60_000 }
        );

        await this.locators.runButton.click();
        const response = await responsePromise;
        await expect(this.locators.enabledRunButton).toBeVisible({
            timeout: 60_000,
        });

        return {
            status: response.status(),
            url: response.url(),
        };
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

    async runWithExpiredSession(): Promise<void> {
        const responsePromise = this.page.waitForResponse(
            isCompilationResponse,
            { timeout: 60_000 }
        );

        await this.locators.runButton.click();
        const response = await responsePromise;
        test.skip(
            response.status() === 425,
            'Production anonymous compilation limit returned HTTP 425 before the session check'
        );
        expect(response.status()).toBe(401);
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
