import { expect, type Page } from '@playwright/test';
import { requireUserCredentials, type UserCredentials } from '../input';
import { AuthLocators } from './locators';

export class AuthDsl {
    private readonly locators: AuthLocators;

    constructor(private readonly page: Page) {
        this.locators = new AuthLocators(page);
    }

    async login(
        credentials: UserCredentials = requireUserCredentials()
    ): Promise<void> {
        if (await this.locators.accountMenu(credentials.email).isVisible()) {
            await this.acceptPrivacyPolicyIfRequired();
            return;
        }

        if (!(await this.locators.loginButton.isVisible())) {
            await this.logoutCurrentAccount();
        }

        await this.locators.loginButton.click();
        await this.locators.loginInput.fill(credentials.email);
        await this.locators.passwordInput.fill(credentials.password);
        await this.locators.submitLoginButton.click();

        try {
            await expect(
                this.locators.accountMenu(credentials.email)
            ).toBeVisible({ timeout: 30_000 });
            await this.acceptPrivacyPolicyIfRequired();
        } catch (error) {
            await Promise.all([
                this.locators.loginInput
                    .fill('', { timeout: 1_000 })
                    .catch(() => undefined),
                this.locators.passwordInput
                    .fill('', { timeout: 1_000 })
                    .catch(() => undefined),
            ]);
            throw error;
        }
    }

    async expectLoggedIn(
        credentials: UserCredentials = requireUserCredentials()
    ): Promise<void> {
        await expect(this.locators.accountMenu(credentials.email)).toBeVisible();
    }

    async expectLoggedOut(): Promise<void> {
        await expect(this.locators.loginButton).toBeVisible();
    }

    async logout(
        credentials: UserCredentials = requireUserCredentials()
    ): Promise<void> {
        await this.locators.accountMenu(credentials.email).click();
        await this.completeLogout();
    }

    private async logoutCurrentAccount(): Promise<void> {
        await expect(this.locators.currentAccountMenu).toBeVisible();
        await this.locators.currentAccountMenu.click();
        await this.completeLogout();
    }

    private async completeLogout(): Promise<void> {
        await this.locators.logoutOption.click();
        await this.locators.confirmLogoutButton.click();
        await expect(this.locators.loginButton).toBeVisible();
    }

    async expireSession(): Promise<void> {
        await this.page.context().clearCookies();
    }

    private async acceptPrivacyPolicyIfRequired(): Promise<void> {
        if (!(await this.locators.privacyPolicyModal.isVisible())) {
            return;
        }

        const responsePromise = this.page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                /\/api\/v\d+\/public\/privacy-policy\/accept$/.test(
                    new URL(response.url()).pathname
                ),
            { timeout: 30_000 }
        );
        await this.locators.acceptPrivacyPolicyButton.click();
        expect((await responsePromise).ok()).toBeTruthy();
        await expect(this.locators.privacyPolicyModal).toBeHidden();
    }
}
