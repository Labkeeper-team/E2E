import type { Locator, Page } from '@playwright/test';

export class AuthLocators {
    constructor(private readonly page: Page) {}

    get loginButton(): Locator {
        return this.page.getByRole('button', {
            name: 'Login',
            exact: true,
        });
    }

    get loginForm(): Locator {
        return this.page.locator('form').filter({ has: this.loginInput });
    }

    get loginInput(): Locator {
        return this.page.getByPlaceholder('Login', { exact: true });
    }

    get passwordInput(): Locator {
        return this.page.getByPlaceholder('Password', { exact: true });
    }

    get submitLoginButton(): Locator {
        return this.loginForm.getByRole('button', {
            name: 'Login',
            exact: true,
        });
    }

    get headerMenu(): Locator {
        return this.page.locator('.header-menu-select .select-header');
    }

    accountIdentity(email: string): Locator {
        return this.page
            .locator('.header-menu-select')
            .getByText(email, { exact: true });
    }

    get authenticatedMenuMarker(): Locator {
        return this.page
            .locator('.header-menu-select')
            .getByText('Log out', { exact: true });
    }

    get logoutOption(): Locator {
        return this.page
            .getByRole('listitem')
            .filter({ hasText: /^Log out$/ });
    }

    get confirmLogoutButton(): Locator {
        return this.page.getByRole('button', { name: 'Yes', exact: true });
    }

    get privacyPolicyModal(): Locator {
        return this.page.locator('.privacy-policy-acceptance-modal');
    }

    get acceptPrivacyPolicyButton(): Locator {
        return this.privacyPolicyModal.getByRole('button', {
            name: 'Accept',
            exact: true,
        });
    }
}
