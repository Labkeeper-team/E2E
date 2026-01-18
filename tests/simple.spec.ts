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
    await page.getByText('Add more').click();
    await page.getByText('Computation', { exact: true }).click();
    await page.locator('#ide-segment-0').getByRole('textbox').click();
    await page.locator('#ide-segment-0').getByRole('textbox').fill('a = 10 # 2\n\n\nb = a ^ 2');
    await page.locator('#segments-container > div:nth-child(2)').click();
    await page.getByRole('button', { name: 'Run' }).click();
    await page.locator('div').filter({ hasText: /^Instructions$/ }).first().click();
    await page
        .getByRole('button', { name: /Run/i })
        .waitFor({ state: 'attached' });
    await page.locator('div.dropdown-menu-container').nth(2).click();
    await page.getByText('Delete').last().click();
    await page.locator('div:nth-child(4) > .dropdown-menu-container > svg').click();
    await page.getByRole('button', { name: 'Exit' }).click();
});