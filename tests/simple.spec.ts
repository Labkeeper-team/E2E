import { test, expect } from '@playwright/test';
import {input} from "./input";
import {
    addComputeWithText,
    addFirstMdSegment, addMdWithText, deleteAllProjectsFromProjectsPage,
    doInLoggedEditor, goToProjectsPageFromEditor,
    hideInstructions,
    startCompilationAndGetResult,
    switchToLatexMode, waitForExitButtonToAppear
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
        await waitForExitButtonToAppear(page)
        await hideInstructions(page)
        await addFirstMdSegment(page, "first md");
        await switchToLatexMode(page);
        await addComputeWithText(page, "a = 10");
        await addMdWithText(page, "my md")
        await addMdWithText(page, "my md last")
        const pdf = await startCompilationAndGetResult(page);
        expect(pdf).toContain("md")
        expect(pdf).toContain("= 10")
    })
});