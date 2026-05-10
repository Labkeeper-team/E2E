import {expect, Page} from "@playwright/test";
import {input} from "../input";

export async function doInLoggedEditor(page: Page, action: () => Promise<void>) {
    await page.goto(`${input.host}/project/default?captcha=${input.captchaBypassToken}`);

    await expect(page).toHaveTitle(/Labkeeper/);
    await page.getByRole('button', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Login' }).fill(input.userEmail);
    await page.getByRole('textbox', { name: 'Password' }).click();
    await page.getByRole('textbox', { name: 'Password' }).fill(input.userPassword);
    await page.locator('form').getByRole('button', { name: 'Login' }).click();

    await page.locator("span.selected-value").getByText(input.userEmail).waitFor({state: "visible"})

    await action()

    await page.locator("span.selected-value").getByText(input.userEmail).click()
    await page.locator("li").getByText("Log out").first().click();
    await page.locator("div").getByText("Yes").click()
}

export async function hideInstructions(page: Page) {
    await page.locator('div').filter({ hasText: /^Instructions$/ }).first().click();
}

export async function addFirstMdSegment(page: Page, text: string) {
    await page.getByRole('button', { name: 'Add markdown' }).click();
    const editor = page.locator('.cm-content').last()
    await editor.click();
    await editor.fill(text);
}

export async function switchToLatexMode(page: Page) {
    await page.locator("div.dropdown-menu-container").first().click()
    await page.getByText('latex', {exact: true}).click();
    await page.getByText("Labkeeper").first().click();
}

export async function addMdWithText(page: Page, text: string) {
    await page.getByRole('button', { name: 'Add markdown' }).click();
    const editor = page.locator('.cm-content').last()
    await editor.click();
    await editor.fill(text);
}

export async function addComputeWithText(page: Page, text: string) {
    await page.getByText('Add more').click();
    await page.getByRole('list').getByText('Computation').click()
    const editor = page.locator('.cm-content').last()
    await editor.click();
    await editor.fill(text);
}

export async function startCompilationAndGetResult(page: Page) {
    await page.getByRole('button', { name: 'Run' }).click();
    await page
        .getByRole('button', { name: /Run/i })
        .waitFor({ state: 'attached' });
    await page.waitForTimeout(10000)
    return await page.locator('div.result-container').ariaSnapshot()
}

export async function openGptModalAndPrompt(page: Page, prompt: string) {
    await page.getByText("GPT").click()
    await page.getByRole('textbox', { name: 'Enter prompt' }).fill(prompt);
    await page.getByText("Send").click()
}