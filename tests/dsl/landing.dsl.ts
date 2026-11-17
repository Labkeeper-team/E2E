import { expect, type Page } from '@playwright/test';
import { EditorLocators, LandingLocators } from './locators';

// The blog example button opens the editor with the program the API keeps for the article
export interface BlogExample {
    slug: string;
    segments: { type: string; text: string }[];
}

export type SiteLanguage = 'ru' | 'en';

export interface TemplateCard {
    slug: string;
    title: string;
    projectId: string;
}

// Labels the site translates; article titles are content and stay as written
const SITE_LABELS: Record<
    SiteLanguage,
    { knowledgeTitle: string; exampleButton: string; exampleHint: string }
> = {
    ru: {
        knowledgeTitle: 'База знаний',
        exampleButton: 'Просмотреть пример',
        exampleHint: 'в редакторе',
    },
    en: {
        knowledgeTitle: 'Knowledge Base',
        exampleButton: 'View example',
        exampleHint: 'in editor',
    },
};
const BLOG_PAGE_LIMIT = 30;
const PROJECT_LINK = /\/project\/([0-9a-f-]{36})$/;
// The site and the editor share the language through this localStorage key
const SHARED_LANGUAGE_KEY = 'labkeeper_lang';

export class LandingDsl {
    private readonly locators: LandingLocators;
    // A fresh browser opens the site in Russian, which the site stores as the shared language
    private language: SiteLanguage = 'ru';

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
        await this.waitForBrowserLanguageReload();
        await expect(this.locators.preloader).toHaveClass(/preloader--hidden/, {
            timeout: 30_000,
        });
        await expect(this.locators.loginLink).toBeVisible({ timeout: 30_000 });
    }

    /**
     * On the first visit the site reloads itself in the language of an English
     * or Chinese browser, and the test browsers are English. The language goes
     * to localStorage before the reload, so until the page matches it, steps
     * would act on a page that is about to go away
     */
    private async waitForBrowserLanguageReload(): Promise<void> {
        await expect
            .poll(
                async () => {
                    try {
                        return await this.page.evaluate((key) => {
                            const stored = window.localStorage.getItem(key);
                            return (
                                stored === null ||
                                stored === document.documentElement.lang
                            );
                        }, SHARED_LANGUAGE_KEY);
                    } catch {
                        // the context went away with the reload
                        return false;
                    }
                },
                { timeout: 60_000 }
            )
            .toBe(true);
    }

    async declineCookies(): Promise<void> {
        await expect(this.locators.cookieBanner).not.toHaveClass(/\bhidden\b/);
        await this.locators.cookieDeclineButton.click();
        // The banner slides away by a class and stays in the layout
        await expect(this.locators.cookieBanner).toHaveClass(/\bhidden\b/);
    }

    /**
     * Picks the language with the switcher in the site header. The editor
     * follows the site language since LabkeeperEditor#175, and the editor
     * steps read it in English
     */
    async chooseLanguage(language: SiteLanguage): Promise<void> {
        const html = this.page.locator('html');
        // A browser in English gets the English page on its first visit
        // already, and the switcher ignores the current language: the menu
        // opened for it would stay open over the page
        if ((await html.getAttribute('lang')) !== language) {
            await this.setNavigationOpen(true);
            await this.locators.languageButton(language).click();
            // The server renders the page in the language of a cookie, so the switch reloads the page with the menu closed
            await expect(html).toHaveAttribute('lang', language, {
                timeout: 60_000,
            });
            await expect(this.locators.preloader).toHaveClass(
                /preloader--hidden/,
                { timeout: 30_000 }
            );
        }
        await this.setNavigationOpen(false);
        expect(
            await this.page.evaluate(
                (key) => window.localStorage.getItem(key),
                SHARED_LANGUAGE_KEY
            )
        ).toBe(language);
        this.language = language;
    }

    async openTemplates(): Promise<void> {
        await this.setNavigationOpen(true);
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

    /**
     * Every template of the catalog with its project, read from the page so
     * that a new template is checked without touching the tests (GH-265)
     */
    async listTemplates(): Promise<TemplateCard[]> {
        await expect(this.locators.allTemplateCards.first()).toBeAttached({
            timeout: 30_000,
        });
        const cards = await this.locators.allTemplateCards.evaluateAll(
            (items) =>
                items.map((item) => ({
                    title:
                        item
                            .querySelector('.blog-card__title')
                            ?.textContent?.trim() ?? '',
                    page:
                        item
                            .querySelector('a.template-card__body')
                            ?.getAttribute('href') ?? '',
                    project:
                        item
                            .querySelector('a.blog-card__footer')
                            ?.getAttribute('href') ?? '',
                }))
        );
        return cards.map((card) => {
            const projectId = card.project.match(PROJECT_LINK)?.[1];
            expect(
                projectId,
                `The template card "${card.title}" links to ${card.project}`
            ).toBeTruthy();
            return {
                slug: card.page.split('/').filter(Boolean).pop() || card.title,
                title: card.title,
                projectId: projectId as string,
            };
        });
    }

    async openKnowledgeBase(): Promise<void> {
        // the open menu of a narrow page covers the section and takes its clicks
        await this.setNavigationOpen(false);
        await this.locators.knowledgeSection.scrollIntoViewIfNeeded();
        await expect(this.locators.knowledgeTitle).toHaveText(
            SITE_LABELS[this.language].knowledgeTitle
        );
        await expect(this.locators.allArticlesLink).toBeVisible();
    }

    async openAllArticles(): Promise<void> {
        await this.setNavigationOpen(false);
        await this.locators.allArticlesLink.click();
        await expect(this.page).toHaveURL(/\/blog\/?$/, { timeout: 60_000 });
    }

    /**
     * A narrow page hides the navigation behind the burger, and the burger
     * toggles it. Pressing it without looking closes a menu that is already
     * open, so the state is checked first
     */
    private async setNavigationOpen(open: boolean): Promise<void> {
        if (!(await this.locators.burgerButton.isVisible())) {
            return;
        }
        if ((await this.locators.openNavigation.isVisible()) !== open) {
            await this.locators.burgerButton.click();
        }
        if (open) {
            await expect(this.locators.openNavigation).toBeVisible();
        } else {
            await expect(this.locators.openNavigation).toHaveCount(0);
        }
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
        await expect(button).toContainText(
            SITE_LABELS[this.language].exampleButton
        );
        await expect(button).toContainText(
            SITE_LABELS[this.language].exampleHint
        );
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
