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

    get authModal(): Locator {
        return this.page.locator('.modal-container-overlay .auth-modal');
    }

    get authModalTitle(): Locator {
        return this.authModal.locator('.auth-header');
    }

    get closeAuthModalButton(): Locator {
        return this.page.locator(
            '.modal-container-overlay button.close-button-container[aria-label="Close"]'
        );
    }

    get modalLoginInput(): Locator {
        return this.authModal.getByPlaceholder('Login', { exact: true });
    }

    get modalPasswordInput(): Locator {
        return this.authModal.getByPlaceholder('Password', { exact: true });
    }

    get modalSubmitLoginButton(): Locator {
        return this.authModal
            .locator('form')
            .getByRole('button', { name: 'Login', exact: true });
    }

    get registrationButton(): Locator {
        return this.authModal.getByRole('button', {
            name: 'Registration',
            exact: true,
        });
    }

    get registrationEmailInput(): Locator {
        return this.authModal.getByPlaceholder('Email', { exact: true });
    }

    get personalDataConsentCheckbox(): Locator {
        return this.authModal.getByRole('checkbox');
    }

    get sendCodeButton(): Locator {
        return this.authModal.getByRole('button', {
            name: 'Send code',
            exact: true,
        });
    }

    get confirmationCodeInput(): Locator {
        return this.authModal.getByPlaceholder('Confirm code', {
            exact: true,
        });
    }

    get confirmCodeButton(): Locator {
        return this.authModal.getByRole('button', {
            name: 'Confirm code',
            exact: true,
        });
    }

    get newPasswordInput(): Locator {
        return this.authModal.getByPlaceholder('Password', { exact: true });
    }

    get confirmPasswordInput(): Locator {
        return this.authModal.getByPlaceholder('Confirm password', {
            exact: true,
        });
    }

    get savePasswordButton(): Locator {
        return this.authModal.getByRole('button', {
            name: 'Save',
            exact: true,
        });
    }

    get continueButton(): Locator {
        return this.authModal.getByRole('button', {
            name: 'Continue',
            exact: true,
        });
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
