import {expect, Page} from "@playwright/test";
import {input} from "../input";

export async function doInLoggedEditor(page: Page, action: () => Promise<void>) {
    await page.goto(`${input.host}?captcha=${input.captchaBypassToken}`);

    await expect(page).toHaveTitle(/Labkeeper/);
    await page.getByRole('button', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Login' }).click();
    await page.getByRole('textbox', { name: 'Login' }).fill(input.userEmail);
    await page.getByRole('textbox', { name: 'Password' }).click();
    await page.getByRole('textbox', { name: 'Password' }).fill(input.userPassword);
    await page.locator('form').getByRole('button', { name: 'Login' }).click();

    await action()

    await goToProjectsPageFromEditor(page)
    await deleteAllProjectsFromProjectsPage(page)
    await page.getByRole('button', { name: 'Exit' }).click();
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
    await page.locator('div').filter({ hasText: /^markdown$/ }).nth(1).click();
    await page.getByText('latex', {exact: true}).click();
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
    await page.waitForTimeout(3000)
    return await page.locator('div[style="overflow: auto; height: 100%; width: 100%;"]').ariaSnapshot()
}

export async function waitForExitButtonToAppear(page: Page) {
    await page.getByText("Exit").waitFor({state: "visible"})
}

export async function goToProjectsPageFromEditor(page: Page) {
    await page.locator('button.image-button').first().click();
}

export async function deleteAllProjectsFromProjectsPage(page: Page) {
    await page.getByText("Projects").waitFor({state: "visible"})
    while (await page.getByText("Delete").count() > 0) {
        await page.getByText("Delete").first().click()
        await page.getByText("Yes").click()
        await page.getByText("Yes").waitFor({state: "hidden"})
    }
}