import { expect, type Page } from '@playwright/test';
import { EditorLocators, LandingLocators } from './locators';

// The blog example button opens the editor with the program the API keeps for the article
export interface BlogExample {
    slug: string;
    segments: { type: string; text: string }[];
}

const EXAMPLE_BUTTON_LABEL = 'Просмотреть пример';
const EXAMPLE_BUTTON_HINT = 'в редакторе';
const BLOG_PAGE_LIMIT = 30;
const PROJECT_LINK = /\/project\/([0-9a-f-]{36})$/;

export class LandingDsl {
    private readonly locators: LandingLocators;

    constructor(private readonly page: Page) {
        this.locators = new LandingLocators(page);
    }

    async open(): Promise<void> {
        let lastError: unknown;

        // Same as NavigationDsl: the first navigation of a fresh browser is occasionally aborted
        for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
                await this.openOnce();
                return;
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError;
    }

    private async openOnce(): Promise<void> {
        await this.page.goto('/', {
            waitUntil: 'domcontentloaded',
            timeout: 60_000,
        });
        await expect(this.locators.preloader).toHaveClass(/preloader--hidden/, {
            timeout: 30_000,
        });
        await expect(this.locators.loginLink).toBeVisible({ timeout: 30_000 });
    }

    async declineCookies(): Promise<void> {
        await expect(this.locators.cookieBanner).not.toHaveClass(/\bhidden\b/);
        await this.locators.cookieDeclineButton.click();
        // The banner slides away by a class and stays in the layout
        await expect(this.locators.cookieBanner).toHaveClass(/\bhidden\b/);
    }

    async openTemplates(): Promise<void> {
        if (await this.locators.burgerButton.isVisible()) {
            await this.locators.burgerButton.click();
            await expect(this.locators.openNavigation).toBeVisible();
        }
        await this.locators.templatesLink.click();
        await expect(this.page).toHaveURL(/\/templates\/?$/, {
            timeout: 60_000,
        });
        // The filters get their handlers on DOMContentLoaded, and an earlier click only follows href="#"
        await this.page.waitForLoadState('domcontentloaded', {
            timeout: 60_000,
        });
    }

    /** The first template under the filter whose project has the given type, in catalog order */
    async chooseTemplate(
        filter: string,
        projectType: 'latex' | 'markdown'
    ): Promise<string> {
        const tab = this.locators.templatesFilter(filter);
        await tab.click();
        await expect(tab).toHaveClass(/header__nav-link--active/);
        const card = this.locators
            .templateCards(filter)
            .and(this.locators.templateCards(projectType))
            .first();
        await expect(
            card,
            `The catalog has no ${projectType} template under ${filter}`
        ).toBeVisible();
        const href = await card
            .locator('a.blog-card__footer')
            .getAttribute('href');
        const projectId = href?.match(PROJECT_LINK)?.[1];
        expect(projectId, `The template card links to ${href}`).toBeTruthy();
        return projectId as string;
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
        const slug = new URL(href as string, this.page.url()).searchParams.get(
            'example'
        );
        expect(slug, `The example link ${href} names no article`).toBeTruthy();
        const programResponse = this.page.waitForResponse(
            (response) =>
                response.request().method() === 'GET' &&
                new URL(response.url()).pathname.endsWith(
                    `/public/blog/${slug}/program`
                ),
            { timeout: 60_000 }
        );
        programResponse.catch(() => undefined);
        await button.click();
        const response = await programResponse;
        // Without the program the editor silently opens the previous draft, so a failed request must fail here
        expect(
            response.ok(),
            `The example program returned HTTP ${response.status()}`
        ).toBeTruthy();
        const program = (await response.json()) as {
            segments: BlogExample['segments'];
        };
        await expect(this.page).toHaveURL(/\/project\//, { timeout: 60_000 });
        await new EditorLocators(this.page).editorRoot.waitFor({
            state: 'visible',
            timeout: 60_000,
        });
        return { slug: slug as string, segments: program.segments };
    }

    async clickTemplate(projectId: string): Promise<void> {
        const link = this.locators.templateProjectLink(projectId);
        await expect(link).toHaveAttribute('target', '_blank');

        const [project] = await Promise.all([
            this.page.context().waitForEvent('page'),
            link.click(),
        ]);
        // The card opens the project on the same host in a new tab, while the scenario continues in its own tab with the captcha bypass
        await project.waitForURL(
            (url) => url.pathname === `/project/${projectId}`,
            { waitUntil: 'commit', timeout: 60_000 }
        );
        await project.close();
    }
}
