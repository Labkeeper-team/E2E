import { expect, type Page, type Response } from '@playwright/test';
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
        await this.waitForInitialUserInfo();
        let state = await this.authenticationState(credentials.email);
        if (state === 'expected') {
            await this.acceptPrivacyPolicyIfRequired();
            return;
        }

        if (state === 'authenticated') {
            await expect(
                this.locators.accountIdentity(credentials.email).first()
            )
                .toBeAttached({ timeout: 5_000 })
                .catch(() => undefined);

            if (
                (await this.locators.accountIdentity(credentials.email).count()) >
                0
            ) {
                await this.acceptPrivacyPolicyIfRequired();
                return;
            }

            await this.logoutCurrentAccount();
            state = 'anonymous';
        }

        expect(state).toBe('anonymous');
        await expect(this.locators.loginButton).toBeVisible();
        await this.locators.loginButton.click();
        await this.locators.loginInput.fill(credentials.email);
        await this.locators.passwordInput.fill(credentials.password);
        await this.locators.submitLoginButton.click();

        try {
            await expect(
                this.locators.accountIdentity(credentials.email).first()
            ).toBeAttached({ timeout: 30_000 });
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
        await expect(
            this.locators.accountIdentity(credentials.email).first()
        ).toBeAttached();
    }

    async expectLoggedOut(): Promise<void> {
        await expect(this.locators.loginButton).toBeVisible();
    }

    async logout(
        credentials: UserCredentials = requireUserCredentials()
    ): Promise<void> {
        await expect(
            this.locators.accountIdentity(credentials.email).first()
        ).toBeAttached();
        await this.locators.headerMenu.click();
        await this.completeLogout();
    }

    private async logoutCurrentAccount(): Promise<void> {
        await expect(
            this.locators.authenticatedMenuMarker.first()
        ).toBeAttached();
        await this.locators.headerMenu.click();
        await this.completeLogout();
    }

    private async completeLogout(): Promise<void> {
        await this.locators.logoutOption.click();
        await this.locators.confirmLogoutButton.click();
        await expect(this.locators.loginButton).toBeVisible();
    }

    async expectLoginRequired(): Promise<void> {
        await expect(this.locators.authModalTitle).toHaveText(
            'Authorization',
            { timeout: 30_000 }
        );
    }

    async closeAuthModal(): Promise<void> {
        await this.locators.closeAuthModalButton.click();
        await expect(this.locators.authModal).toBeHidden();
    }

    async register(
        credentials: UserCredentials,
        readCode: () => Promise<string>
    ): Promise<void> {
        await this.expectLoginRequired();
        await this.locators.registrationButton.click();
        await expect(this.locators.authModalTitle).toHaveText(
            'Enter your email'
        );
        await this.locators.registrationEmailInput.fill(credentials.email);
        await this.locators.personalDataConsentCheckbox.check();
        // Without the bypass in the email step a hidden captcha keeps the button disabled, which reads like a timeout otherwise
        await expect(
            this.locators.sendCodeButton,
            'The editor does not apply E2E_CAPTCHA_BYPASS_TOKEN to registration, so the code cannot be requested'
        ).toBeEnabled();
        const emailResponse = this.waitForAuthResponse('email');
        await this.locators.sendCodeButton.click();
        await this.expectAuthResponseOk(await emailResponse);
        await expect(this.locators.authModalTitle).toHaveText(
            'Enter the code',
            { timeout: 30_000 }
        );

        await this.locators.confirmationCodeInput.fill(await readCode());
        const codeResponse = this.waitForAuthResponse('code');
        await this.locators.confirmCodeButton.click();
        const codeResult = await codeResponse;
        await this.expectAuthResponseOk(codeResult);
        expect((await codeResult.json()).valid).toBe(true);
        await expect(this.locators.authModalTitle).toHaveText('Set password');

        await this.locators.newPasswordInput.fill(credentials.password);
        await this.locators.confirmPasswordInput.fill(credentials.password);
        const passwordResponse = this.waitForAuthResponse('password');
        await this.locators.savePasswordButton.click();
        await this.expectAuthResponseOk(await passwordResponse);
        await expect(this.locators.authModalTitle).toHaveText('Success');

        await this.locators.continueButton.click();
        await this.expectLoginRequired();
    }

    async loginInOpenAuthModal(credentials: UserCredentials): Promise<void> {
        await this.expectLoginRequired();
        await this.locators.modalLoginInput.fill(credentials.email);
        await this.locators.modalPasswordInput.fill(credentials.password);
        const loginResponse = this.page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                /\/api\/v\d+\/sec\/formlogin$/.test(
                    new URL(response.url()).pathname
                ),
            { timeout: 30_000 }
        );
        loginResponse.catch(() => undefined);
        await this.locators.modalSubmitLoginButton.click();
        await this.expectAuthResponseOk(await loginResponse);
        await expect(
            this.locators.accountIdentity(credentials.email).first()
        ).toBeAttached({ timeout: 30_000 });
    }

    async expectPrivacyPolicyRequired(): Promise<void> {
        await expect(this.locators.privacyPolicyModal).toBeVisible({
            timeout: 30_000,
        });
    }

    async acceptPrivacyPolicyIfShown(): Promise<boolean> {
        // Email registration already asks for consent, so production may not show the modal at all
        const shown = await expect(this.locators.privacyPolicyModal)
            .toBeVisible({ timeout: 5_000 })
            .then(() => true)
            .catch(() => false);
        if (shown) {
            await this.acceptPrivacyPolicy();
        }
        return shown;
    }

    async acceptPrivacyPolicy(): Promise<void> {
        await this.expectPrivacyPolicyRequired();
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

    async expectPrivacyPolicyNotRequired(
        credentials: UserCredentials
    ): Promise<void> {
        await this.waitForInitialUserInfo();
        await expect(
            this.locators.accountIdentity(credentials.email).first()
        ).toBeAttached({ timeout: 30_000 });
        // The modal is opened by startup after user-info, so give it the time it would need to appear
        await this.page.waitForTimeout(2_000);
        await expect(this.locators.privacyPolicyModal).toBeHidden();
    }

    async expireSession(): Promise<void> {
        await this.page.context().clearCookies();
    }

    private async acceptPrivacyPolicyIfRequired(): Promise<void> {
        if (!(await this.locators.privacyPolicyModal.isVisible())) {
            return;
        }

        await this.acceptPrivacyPolicy();
    }

    private waitForAuthResponse(endpoint: 'email' | 'code' | 'password') {
        const response = this.page.waitForResponse(
            (candidate) =>
                candidate.request().method() === 'POST' &&
                new RegExp(`/api/v\\d+/public/${endpoint}$`).test(
                    new URL(candidate.url()).pathname
                ),
            { timeout: 30_000 }
        );
        // A failed click leaves the wait pending, and its rejection at test end would hide the real error
        response.catch(() => undefined);
        return response;
    }

    private async expectAuthResponseOk(response: Response): Promise<void> {
        expect(
            response.ok(),
            `${new URL(response.url()).pathname} returned HTTP ${response.status()}`
        ).toBeTruthy();
    }

    private async authenticationState(
        email: string
    ): Promise<'expected' | 'authenticated' | 'anonymous'> {
        const readState = async () => {
            if ((await this.locators.accountIdentity(email).count()) > 0) {
                return 'expected';
            }
            if ((await this.locators.authenticatedMenuMarker.count()) > 0) {
                return 'authenticated';
            }
            if (await this.locators.loginButton.isVisible()) {
                return 'anonymous';
            }
            return 'loading';
        };

        await expect
            .poll(readState, { timeout: 30_000 })
            .not.toBe('loading');

        return (await readState()) as
            | 'expected'
            | 'authenticated'
            | 'anonymous';
    }

    private async waitForInitialUserInfo(): Promise<void> {
        await expect
            .poll(
                () =>
                    this.page.evaluate(() =>
                        performance
                            .getEntriesByType('resource')
                            .some((entry) =>
                                /\/api\/v\d+\/public\/user-info$/.test(
                                    new URL(entry.name).pathname
                                )
                            )
                    ),
                { timeout: 60_000 }
            )
            .toBeTruthy();
        await this.page.waitForTimeout(100);
    }
}
