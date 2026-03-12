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
    await page.goto(`${input.host}?captcha=${input.captchaBypassToken}`);
    await expect(page).toHaveTitle(/Labkeeper/);
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

test('simple prompt test', async ({ page }) => {
    await doInLoggedEditor(page, async () => {
        await openGptModalAndPrompt(page, "Add Pushkin biography")
        await addFirstMdSegment(page, "first md");
        await addComputeWithText(page, "a = 10");
        await switchToLatexMode(page);
        await startCompilationAndGetResult(page)
    })
})