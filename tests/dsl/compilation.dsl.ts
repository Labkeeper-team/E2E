import {
    expect,
    test,
    type Page,
    type Request,
    type Response,
} from '@playwright/test';
import { EditorLocators } from './locators';
import { ProjectViewDsl } from './project-view.dsl';

const isCompilationRequest = (request: Request): boolean => {
    if (request.method() !== 'POST') {
        return false;
    }

    const path = new URL(request.url()).pathname;
    return /\/api\/v\d+\/public\/(?:project\/[^/]+\/)?compile(?:\/pdf)?$/.test(
        path
    );
};

const isCompilationResponse = (response: Response): boolean =>
    isCompilationRequest(response.request());

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
        const response = await this.clickRunAndWaitForResponse();
        await expect(this.locators.enabledRunButton).toBeAttached({
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

    private async clickRunAndWaitForResponse(
        afterClick?: () => Promise<void>
    ): Promise<Response> {
        const requestSent = this.page
            .waitForRequest(isCompilationRequest, { timeout: 30_000 })
            .then(
                () => true,
                () => false
            );
        const responsePromise = this.page.waitForResponse(
            isCompilationResponse,
            { timeout: 120_000 }
        );
        responsePromise.catch(() => undefined);

        await this.locators.runButton.click();
        await afterClick?.();
        // A single timeout could not tell a lost click from a slow compiler, so the two waits fail separately
        if (!(await requestSent)) {
            const buttonText = await this.locators.runButton
                .or(this.locators.compilingRunButton)
                .first()
                .textContent()
                .catch(() => null);
            throw new Error(
                `Run did not send a compilation request within 30 s, the button shows "${buttonText}"`
            );
        }
        return responsePromise;
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
