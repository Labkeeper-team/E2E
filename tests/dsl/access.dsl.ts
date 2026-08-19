import { randomUUID } from 'node:crypto';
import { expect, type Locator, type Page } from '@playwright/test';
import { AccessLocators } from './locators';

export class AccessDsl {
    private readonly locators: AccessLocators;

    constructor(private readonly page: Page) {
        this.locators = new AccessLocators(page);
    }

    async openMissingProject(): Promise<void> {
        const path = `/project/${randomUUID()}`;
        await this.expectAfterNavigation(
            path,
            this.locators.notFoundPageMessage.or(
                this.locators.toast.filter({ hasText: 'Project not found' })
            )
        );
    }

    async openForbiddenProject(path: string): Promise<void> {
        await this.expectAfterNavigation(
            path,
            this.locators.forbiddenPageMessage.or(
                this.locators.toast.filter({
                    hasText: "You don't have enough rights to view the project",
                })
            )
        );
    }

    async expectAccessDenied(): Promise<void> {
        const accessDenied = this.locators.forbiddenPageMessage.or(
            this.locators.toast.filter({
                hasText: "You don't have enough rights to view the project",
            })
        );
        await expect(accessDenied.first()).toBeVisible({ timeout: 60_000 });
    }

    private async expectAfterNavigation(
        path: string,
        result: Locator
    ): Promise<void> {
        let lastError: unknown;

        for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
                await this.page.goto(path, {
                    waitUntil: 'domcontentloaded',
                    timeout: 60_000,
                });
                await expect(result.first()).toBeVisible({ timeout: 60_000 });
                return;
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError;
    }
}
