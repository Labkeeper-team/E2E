import { test, expect } from '@playwright/test';
import {input} from "./input";
import {
    addComputeWithText,
    addFirstMdSegment, addMdWithText, doInLoggedEditor, hideInstructions, openGptModalAndPrompt,
    startCompilationAndGetResult,
    switchToLatexMode
} from "./dsl";

console.info(`
    Initializing e2e with:
    - host=${input.host}
    - captchaBypassToken=${input.captchaBypassToken}
    - userEmail=${input.userEmail}
    - userPassword=${input.userPassword}
`)

test('has title', async ({ page }) => {
    await page.goto(`${input.host}/project/default?captcha=${input.captchaBypassToken}`);
    await expect(page).toHaveTitle(/Labkeeper/);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText("Add").first()).toBeVisible();
    await expect(page).toHaveScreenshot('simple-test.png');
});

test('simple pdf compile', async ({ page }) => {
    await doInLoggedEditor(page, async () => {
        await hideInstructions(page)
        await addFirstMdSegment(page, "first md");
        await switchToLatexMode(page);
        await addComputeWithText(page, "a = 10");
        await addMdWithText(page, "my md")
        await addMdWithText(page, "my md last")
        await startCompilationAndGetResult(page);
    })
});