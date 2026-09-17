import { expect, type Page } from '@playwright/test';
import { LandingLocators } from './locators';

export interface ExampleProject {
    id: string;
    category: string;
    projectType: string;
}

export class LandingDsl {
    private readonly locators: LandingLocators;

    constructor(private readonly page: Page) {
        this.locators = new LandingLocators(page);
    }

    async open(): Promise<ExampleProject[]> {
        let lastError: unknown;

        // Same as NavigationDsl: the first navigation of a fresh browser is occasionally aborted
        for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
                return await this.openOnce();
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError;
    }

    private async openOnce(): Promise<ExampleProject[]> {
        const previewResponse = this.page.waitForResponse(
            (response) =>
                response.request().method() === 'GET' &&
                /\/api\/v\d+\/public\/preview$/.test(
                    new URL(response.url()).pathname
                ),
            { timeout: 60_000 }
        );
        previewResponse.catch(() => undefined);
        await this.page.goto('/', {
            waitUntil: 'domcontentloaded',
            timeout: 60_000,
        });
        const response = await previewResponse;
        // The landing silently falls back to bundled examples, so a failed request must fail here
        expect(
            response.ok(),
            `Landing examples returned HTTP ${response.status()}`
        ).toBeTruthy();
        await expect(this.locators.preloader).toHaveClass(/preloader--hidden/, {
            timeout: 30_000,
        });
        await expect(this.locators.loginLink).toBeVisible({ timeout: 30_000 });

        const { projects } = (await response.json()) as {
            projects: ExampleProject[];
        };
        return projects;
    }

    async declineCookies(): Promise<void> {
        await expect(this.locators.cookieBanner).not.toHaveClass(/\bhidden\b/);
        await this.locators.cookieDeclineButton.click();
        // The banner slides away by a class and stays in the layout
        await expect(this.locators.cookieBanner).toHaveClass(/\bhidden\b/);
    }

    async openExamples(): Promise<void> {
        if (await this.locators.burgerButton.isVisible()) {
            await this.locators.burgerButton.click();
            await expect(this.locators.openNavigation).toBeVisible();
        }
        await this.locators.examplesLink.click();
        await expect(this.page).toHaveURL(/#examples$/);
        await this.waitForScrollToStop();
        await expect(this.locators.examplesSection).toBeInViewport();
    }

    async chooseLatexExample(
        projects: ExampleProject[],
        category: string
    ): Promise<ExampleProject> {
        const example = projects.find(
            (project) =>
                project.category === category && project.projectType === 'latex'
        );
        expect(
            example,
            `The landing has no LaTeX example in the ${category} category`
        ).toBeDefined();
        const inCategory = projects.filter(
            (project) => project.category === category
        );
        // Only the first cards of a category are inside the slider viewport on a phone
        expect(inCategory[0]).toBe(example);

        const chosen = example as ExampleProject;
        await this.locators.categoryTab(category).click();
        await expect(this.locators.categoryTab(category)).toHaveClass(
            /header__nav-link--active/
        );
        const card = this.locators.exampleCard(chosen.id);
        await card.scrollIntoViewIfNeeded();
        await expect(card).toBeInViewport();
        return chosen;
    }

    private async waitForScrollToStop(): Promise<void> {
        // The examples link scrolls smoothly, and a click during the animation lands on a moving layout
        let previous = -1;
        await expect
            .poll(
                async () => {
                    const current = await this.page.evaluate(
                        () => window.scrollY
                    );
                    const stopped = current === previous;
                    previous = current;
                    return stopped;
                },
                { intervals: [250], timeout: 15_000 }
            )
            .toBe(true);
    }

    async clickExample(projectId: string): Promise<void> {
        const card = this.locators.exampleCard(projectId);
        await expect(card).toHaveAttribute('target', '_blank');

        const [preview] = await Promise.all([
            this.page.context().waitForEvent('page'),
            card.click(),
        ]);
        // The card always opens production in a new tab, while the scenario continues in the tested host with the captcha bypass
        await preview.waitForURL(
            (url) => url.pathname === `/project/${projectId}`,
            { waitUntil: 'commit', timeout: 60_000 }
        );
        await preview.close();
    }
}
