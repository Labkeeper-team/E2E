import { expect, type Page } from '@playwright/test';
import { AgentLocators } from './locators';

// A run stops by itself after ten minutes, so a little more than that is the longest wait for an answer
const AGENT_RUN_TIMEOUT_MS = 11 * 60_000;
const CONTEXT_SIZES = ['100k', '200k', '300k'];
const MAX_ITERATIONS = ['200', '500', '1000'];
const FILE_MENTION = 'Add the file {name} that I uploaded to the document';

/** The agent chat, its settings and the agent mode of a project */
export class AgentDsl {
    private readonly locators: AgentLocators;

    constructor(private readonly page: Page) {
        this.locators = new AgentLocators(page);
    }

    async openAgentTab(): Promise<void> {
        await this.locators.agentTab.click();
        await expect(this.locators.agentTab).toHaveClass(
            /viewer-tabs__tab--active/
        );
    }

    async expectHelpFirstSlide(title: string): Promise<void> {
        await expect(this.locators.helpHeader).toBeVisible();
        if (!(await this.locators.helpBody.isVisible())) {
            await this.locators.helpHeader.click();
        }
        await expect(this.locators.helpSlideTitle(title)).toBeVisible();
    }

    async enterAgentMode(): Promise<void> {
        await this.locators.enterAgentModeButton.click();
        await expect(this.page).toHaveURL(/\/agent$/);
        await expect(this.locators.agentModePane).toBeVisible();
        await expect(this.locators.promptEditor).toBeVisible();
        await expect(this.locators.finalDocumentTitle).toBeVisible();
        // the chat is the left column and the final document the right one
        const chat = await this.locators.agentModePane.boundingBox();
        const document = await this.locators.finalDocumentTitle.boundingBox();
        expect(chat && document && chat.x < document.x).toBeTruthy();
    }

    async leaveAgentMode(): Promise<void> {
        await this.locators.leaveAgentModeButton.click();
        await expect(this.page).not.toHaveURL(/\/agent$/);
        await expect(this.locators.agentModePane).toBeHidden();
    }

    async expectDefaultSettings(): Promise<void> {
        await this.locators.settingsButton.click();
        await expect(this.locators.settingsPanel).toBeVisible();
        for (const size of CONTEXT_SIZES) {
            await expect(
                this.locators
                    .segmentedGroup('Context Size')
                    .getByRole('button', { name: size, exact: true })
            ).toBeVisible();
        }
        for (const iterations of MAX_ITERATIONS) {
            await expect(
                this.locators
                    .segmentedGroup('Max Iterations')
                    .getByRole('button', { name: iterations, exact: true })
            ).toBeVisible();
        }
        await expect(this.locators.compileCheckbox).toBeChecked();
    }

    async closeSettings(): Promise<void> {
        await this.locators.closeSettingsButton.click();
        await expect(this.locators.settingsPanel).toBeHidden();
    }

    async typePrompt(text: string): Promise<void> {
        await this.locators.promptEditor.click();
        await this.page.keyboard.insertText(text);
    }

    async expectPromptText(text: string): Promise<void> {
        await expect(this.locators.promptEditor).toHaveText(text);
    }

    /** Sends the prompt and returns once the agent has started, consenting to DeepSeek if the editor asks */
    async send(): Promise<void> {
        const requestsBefore = await this.locators.requests.count();
        await this.locators.sendButton.click();
        await expect
            .poll(
                async () => {
                    if (await this.locators.consentModal.isVisible()) {
                        return 'consent';
                    }
                    return (await this.locators.requests.count()) >
                        requestsBefore
                        ? 'sent'
                        : 'waiting';
                },
                { timeout: 30_000 }
            )
            .not.toBe('waiting');
        if (await this.locators.consentModal.isVisible()) {
            await this.locators.consentCheckbox.check();
            await this.locators.consentContinueButton.click();
            await expect(this.locators.consentModal).toBeHidden();
        }
        await expect(this.locators.requests).toHaveCount(requestsBefore + 1, {
            timeout: 30_000,
        });
    }

    async expectRunning(): Promise<void> {
        await expect(this.locators.stopButton).toBeVisible({ timeout: 30_000 });
    }

    async waitForAnswer(): Promise<void> {
        await expect(this.locators.stopButton).toBeHidden({
            timeout: AGENT_RUN_TIMEOUT_MS,
        });
        await expect(this.locators.responses.last()).toBeVisible();
    }

    async expectSteps(labels: (string | RegExp)[]): Promise<void> {
        for (const label of labels) {
            await expect(
                this.locators.events.filter({ hasText: label }).first()
            ).toBeVisible();
        }
    }

    async uploadFile(
        name: string,
        mimeType: string,
        buffer: Buffer
    ): Promise<void> {
        await expect(this.locators.uploadButton).toBeVisible();
        await this.locators.uploadInput.setInputFiles({
            name,
            mimeType,
            buffer,
        });
        await expect(this.locators.attachedFile(name)).toBeVisible({
            timeout: 30_000,
        });
    }

    async expectFileMentioned(typed: string, name: string): Promise<void> {
        const mention = FILE_MENTION.replace('{name}', name);
        await expect(this.locators.promptEditor).toContainText(typed);
        await expect
            .poll(async () =>
                (
                    (await this.locators.promptEditor.textContent()) ?? ''
                ).trimEnd()
            )
            .toMatch(
                new RegExp(`${mention.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
            );
    }

    /** Steps of a finished run fold under the toggle of its request once the next request is sent */
    async expectStepsCollapsed(requestIndex: number): Promise<void> {
        await expect(this.locators.stepsToggle(requestIndex)).toHaveText(
            /^Agent steps: \d+$/
        );
        await expect(this.locators.stepsToggle(requestIndex)).toHaveAttribute(
            'aria-expanded',
            'false'
        );
    }

    async expandSteps(requestIndex: number): Promise<void> {
        const toggle = this.locators.stepsToggle(requestIndex);
        const shown = await this.locators.events.count();
        const folded = Number(
            ((await toggle.textContent()) ?? '').match(/\d+/)?.[0]
        );
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await expect(this.locators.events).toHaveCount(shown + folded);
    }

    async clearHistoryConfirmingOnce(): Promise<void> {
        await this.locators.clearHistoryButton.click();
        await expect(this.locators.clearHistoryDialog).toBeVisible();
        await expect(this.locators.dontAskAgainCheckbox).toBeVisible();
        await this.locators.dontAskAgainCheckbox.check();
        await this.locators.confirmClearButton.click();
        await this.expectHistoryCleared();
    }

    async clearHistoryWithoutConfirmation(): Promise<void> {
        await this.locators.clearHistoryButton.click();
        await expect(this.locators.clearHistoryDialog).toBeHidden();
        await this.expectHistoryCleared();
    }

    private async expectHistoryCleared(): Promise<void> {
        await expect(this.locators.requests).toHaveCount(0, {
            timeout: 30_000,
        });
        await expect(this.locators.responses).toHaveCount(0);
    }

    async expectEditsWithButtons(): Promise<number> {
        await expect(this.locators.hunkAcceptButtons.first()).toBeVisible({
            timeout: 30_000,
        });
        await expect(this.locators.hunkRevertButtons.first()).toBeVisible();
        await expect(this.locators.hunkTotal).toHaveText(/^Total \d+ changes$/);
        const label = (await this.locators.hunkTotal.textContent()) ?? '';
        return Number(label.match(/\d+/)?.[0]);
    }

    async acceptAll(): Promise<void> {
        await this.locators.acceptAllButton.click();
        await expect(this.locators.acceptAllButton).toBeHidden({
            timeout: 30_000,
        });
        await expect(this.locators.hunkAcceptButtons).toHaveCount(0);
    }
}
