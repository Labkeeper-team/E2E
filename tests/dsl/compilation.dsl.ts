import {
    expect,
    test,
    type Page,
    type Request,
    type Response,
} from '@playwright/test';
import { EditorLocators } from './locators';
import { ProjectViewDsl } from './project-view.dsl';
import type { ResponseRecorder } from './response-recorder';

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

export type AutomaticCompilation =
    | { outcome: 'pdf'; pdfUri: string }
    | { outcome: 'markdown' }
    | { outcome: 'loginRequired' };

export type GuestPdfRunResult =
    | { outcome: 'compiled'; pdfUri: string }
    | { outcome: 'loginRequired' };

export class CompilationDsl {
    private readonly locators: EditorLocators;

    constructor(
        private readonly page: Page,
        private readonly projectView: ProjectViewDsl,
        private readonly responses: ResponseRecorder
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

    /**
     * Starts waiting for the compilation the editor sends by itself, for example right after an example link opens it.
     * Call it before the action that opens the editor and await the result after
     */
    waitForAutomaticCompilation(): Promise<AutomaticCompilation> {
        this.responses.restart();
        const compilation = this.page
            .waitForResponse(isCompilationResponse, { timeout: 120_000 })
            .then(async (response) => {
                // HTTP 425 is the daily anonymous limit, and the editor answers it with the login modal
                if (response.status() === 425) {
                    return { outcome: 'loginRequired' } as const;
                }
                if (!new URL(response.url()).pathname.endsWith('/pdf')) {
                    expect(
                        response.status(),
                        `Markdown compilation returned HTTP ${response.status()}`
                    ).toBe(200);
                    return { outcome: 'markdown' } as const;
                }
                return {
                    outcome: 'pdf',
                    pdfUri: await this.pdfUriOf(response),
                } as const;
            });
        // A step failing before the await would otherwise leave the rejection unhandled
        compilation.catch(() => undefined);
        return compilation;
    }

    async runPdfAsGuest(): Promise<GuestPdfRunResult> {
        const response = await this.runShowingProgress();
        // HTTP 425 is the daily anonymous limit, and the editor answers it with the login modal
        if (response.status() === 425) {
            return { outcome: 'loginRequired' };
        }

        return { outcome: 'compiled', pdfUri: await this.pdfUriOf(response) };
    }

    async runPdfSuccessfully(): Promise<string> {
        return this.pdfUriOf(await this.runShowingProgress());
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

    private async runShowingProgress(): Promise<Response> {
        await this.projectView.showEditor();
        this.responses.restart();
        const response = await this.clickRunAndWaitForResponse(async () => {
            await expect(this.locators.compilingRunButton).toBeVisible();
        });
        // A guest's default project has no id and compiles at /public/compile/pdf
        expect(new URL(response.url()).pathname).toMatch(
            /\/public\/(?:project\/[^/]+\/)?compile\/pdf$/
        );
        await expect(this.locators.enabledRunButton).toBeAttached({
            timeout: 60_000,
        });
        return response;
    }

    /** Compiles with a keyboard shortcut instead of the Run button and expects the given HTTP status */
    async runWithKeys(keys: string, expectedStatus = 200): Promise<void> {
        await this.projectView.showEditor();
        const response = await this.clickRunAndWaitForResponse(
            undefined,
            () => this.page.keyboard.press(keys)
        );
        expect(response.status()).toBe(expectedStatus);
        await expect(this.locators.enabledRunButton).toBeAttached({
            timeout: 60_000,
        });
    }

    private async clickRunAndWaitForResponse(
        afterClick?: () => Promise<void>,
        start: () => Promise<void> = () => this.locators.runButton.click()
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

        await start();
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

    private async pdfUriOf(response: Response): Promise<string> {
        expect(
            response.status(),
            `LaTeX compilation returned HTTP ${response.status()}`
        ).toBe(200);
        const { pdfUri } = (await response.json()) as { pdfUri: string };
        expect(pdfUri).toBeTruthy();
        return pdfUri;
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
