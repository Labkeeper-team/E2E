import { test, expect } from '@playwright/test';

const host = process.env.E2E_HOST
const captchaBypassToken = process.env.E2E_CAPTCHA_BYPASS_TOKEN
const userEmail = process.env.E2E_USER_EMAIL
const userPassword = process.env.E2E_USER_PASSWORD

console.info(`
    Initializing e2e with:
    - host=${host}
    - captchaBypassToken=${captchaBypassToken}
    - userEmail=${userEmail}
    - userPassword=${userPassword}
`)

test('has title', async ({ page }) => {
    await page.goto(`${host}?captcha=${captchaBypassToken}`);

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/Labkeeper/);
});