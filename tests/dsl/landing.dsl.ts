import { expect, type Page } from '@playwright/test';
import { EditorLocators, LandingLocators } from './locators';

// What the blog example button puts into the editor, read from its link
export interface BlogExample {
    open?: string;
    compute?: string;
    latex?: string;
    markdown?: string;
}

const EXAMPLE_BUTTON_LABEL = 'Просмотреть пример';
const EXAMPLE_BUTTON_HINT = 'в редакторе';
const BLOG_PAGE_LIMIT = 30;

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

    async openKnowledgeBase(): Promise<void> {
        await this.locators.knowledgeSection.scrollIntoViewIfNeeded();
        await expect(this.locators.knowledgeTitle).toHaveText('База знаний');
        await expect(this.locators.allArticlesLink).toBeVisible();
    }

    async openAllArticles(): Promise<void> {
        await this.locators.allArticlesLink.click();
        await expect(this.page).toHaveURL(/\/blog\/?$/, { timeout: 60_000 });
    }

    async openBlog(): Promise<void> {
        await this.page.goto('/blog', {
            waitUntil: 'domcontentloaded',
            timeout: 60_000,
        });
    }

    async openArticle(slug: string, title: string): Promise<void> {
        const card = this.locators.blogCard(slug);
        await expect(this.locators.blogNextPageButton).toBeAttached({
            timeout: 30_000,
        });
        // The list shows nine articles per page, newest first, so the page of an article moves as the blog grows
        for (let page = 1; !(await card.isVisible()); page += 1) {
            expect(
                await this.locators.blogNextPageButton.isEnabled(),
                `No blog page lists /blog/${slug}`
            ).toBe(true);
            expect(page, `/blog/${slug} is not on the first pages`).toBeLessThan(
                BLOG_PAGE_LIMIT
            );
            await this.locators.blogNextPageButton.click();
        }
        await card.scrollIntoViewIfNeeded();
        await card.click();
        await expect(this.page).toHaveURL(new RegExp(`/blog/${slug}$`), {
            timeout: 60_000,
        });
        // The list card carries a shorter title than the article itself
        await expect(this.locators.articleTitle).toHaveText(title);
    }

    async openArticleExample(): Promise<BlogExample> {
        const button = this.locators.visibleExampleButton;
        await button.scrollIntoViewIfNeeded();
        await expect(button).toContainText(EXAMPLE_BUTTON_LABEL);
        await expect(button).toContainText(EXAMPLE_BUTTON_HINT);
        const href = await button.getAttribute('href');
        expect(href, 'The example button has no link').toBeTruthy();
        const query = new URL(href as string, this.page.url()).searchParams;
        const example: BlogExample = {
            open: query.get('open') ?? undefined,
            compute: query.get('compute') ?? undefined,
            latex: query.get('latex') ?? undefined,
            markdown: query.get('markdown') ?? undefined,
        };
        await button.click();
        await expect(this.page).toHaveURL(/\/project\//, { timeout: 60_000 });
        await new EditorLocators(this.page).editorRoot.waitFor({
            state: 'visible',
            timeout: 60_000,
        });
        return example;
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
