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
    await expect(page).toHaveTitle(/Labkeeper/);
});

test('simple login', async ({ page }) => {
    await page.goto(`${host}?captcha=${captchaBypassToken}`);

    await expect(page).toHaveTitle(/Labkeeper/);
    await page.getByRole('button', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Login' }).fill(userEmail);
    await page.getByRole('textbox', { name: 'Password' }).click();
    await page.getByRole('textbox', { name: 'Password' }).fill(userPassword);
    await page.locator('form').getByRole('button', { name: 'Login' }).click();

    // TODO compute

    await page.getByRole('button', { name: 'Exit' }).click();
});