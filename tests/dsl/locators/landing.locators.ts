import type { Locator, Page } from '@playwright/test';

export class LandingLocators {
    constructor(private readonly page: Page) {}

    get preloader(): Locator {
        return this.page.locator('.js-preloader');
    }

    get loginLink(): Locator {
        return this.page.locator('a.header__login');
    }

    get cookieBanner(): Locator {
        return this.page.locator('#cookie-banner');
    }

    get cookieDeclineButton(): Locator {
        return this.cookieBanner.locator('#cookie-decline');
    }

    get burgerButton(): Locator {
        return this.page.locator('.js-burger-btn');
    }

    get openNavigation(): Locator {
        return this.page.locator('nav.js-nav.header__nav--open');
    }

    get templatesLink(): Locator {
        return this.page.locator('nav.js-nav a[href="/templates"]');
    }

    templatesFilter(filter: string): Locator {
        return this.page.locator(`#blog-categories a[data-filter="${filter}"]`);
    }

    // Each card lists its categories, project type included, in data-category
    templateCards(category: string): Locator {
        return this.page.locator(
            `#blog-grid article.blog-item[data-category~="${category}"]:visible`
        );
    }

    // The card opens the template project in a new tab
    templateProjectLink(projectId: string): Locator {
        return this.page.locator(
            `#blog-grid a.blog-card__footer[href$="/project/${projectId}"]`
        );
    }

    get knowledgeSection(): Locator {
        return this.page.locator('section#knowledge');
    }

    get knowledgeTitle(): Locator {
        return this.knowledgeSection.locator('.knowledge__title');
    }

    get allArticlesLink(): Locator {
        return this.knowledgeSection.locator('a[href="/blog"]');
    }

    blogCard(slug: string): Locator {
        return this.page.locator(`a.blog-card[href="/blog/${slug}"]`);
    }

    get blogNextPageButton(): Locator {
        return this.page
            .locator('#blog-pagination .blog-pagination__btn')
            .filter({ hasText: /^→$/ });
    }

    get articleTitle(): Locator {
        return this.page.locator('h1').first();
    }

    // The article repeats the button in its sidebar, which a narrow page hides
    get visibleExampleButton(): Locator {
        return this.page.locator('a[data-blog-example]:visible').first();
    }
}
