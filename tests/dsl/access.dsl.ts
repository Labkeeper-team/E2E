import { randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import { AccessLocators } from './locators';

export class AccessDsl {
    private readonly locators: AccessLocators;

    constructor(private readonly page: Page) {
        this.locators = new AccessLocators(page);
    }

    async openMissingProject(): Promise<void> {
        await this.page.goto(`/project/${randomUUID()}`, {
            waitUntil: 'domcontentloaded',
        });
        await this.expectToast('Project not found');
    }

    async openForbiddenProject(path: string): Promise<void> {
        await this.page.goto(path, { waitUntil: 'domcontentloaded' });
        await this.expectToast("You don't have enough rights to view the project");
    }

    async expectSessionExpired(): Promise<void> {
        const sessionExpired = this.locators.sessionExpiredPageMessage.or(
            this.locators.toast.filter({ hasText: 'Session has expired' })
        );
        await expect(sessionExpired.first()).toBeVisible({ timeout: 30_000 });
    }

    async expectAccessDenied(): Promise<void> {
        const accessDenied = this.locators.forbiddenPageMessage.or(
            this.locators.toast.filter({
                hasText: "You don't have enough rights to view the project",
            })
        );
        await expect(accessDenied.first()).toBeVisible({ timeout: 30_000 });
    }

    private async expectToast(text: string): Promise<void> {
        await expect(this.locators.toast.first()).toContainText(text, {
            timeout: 30_000,
        });
    }
}
