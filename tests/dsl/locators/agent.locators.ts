import type { Locator, Page } from '@playwright/test';

export class AgentLocators {
    constructor(private readonly page: Page) {}

    get agentTab(): Locator {
        return this.page.locator('.viewer-tabs__tab').first();
    }

    get helpPanel(): Locator {
        return this.page.locator('.labkeeper-instruction-container');
    }

    get helpHeader(): Locator {
        return this.helpPanel.getByText('Instructions', { exact: true });
    }

    get helpBody(): Locator {
        return this.helpPanel.locator('.labkeeper-instruction-body');
    }

    helpSlideTitle(title: string): Locator {
        return this.helpBody.getByText(title, { exact: true }).first();
    }

    get enterAgentModeButton(): Locator {
        return this.page.getByRole('button', {
            name: 'Agent mode',
            exact: true,
        });
    }

    get agentModePane(): Locator {
        return this.page.locator('.agent-mode-pane');
    }

    get leaveAgentModeButton(): Locator {
        return this.agentModePane.locator('.agent-mode-pane__leave');
    }

    get finalDocumentTitle(): Locator {
        return this.page.getByText('Final document', { exact: true }).first();
    }

    get settingsButton(): Locator {
        return this.page.getByRole('button', {
            name: 'Agent settings',
            exact: true,
        });
    }

    get settingsPanel(): Locator {
        return this.page.locator('.agent-settings__panel');
    }

    get closeSettingsButton(): Locator {
        return this.page.getByRole('button', {
            name: 'Close settings',
            exact: true,
        });
    }

    segmentedGroup(name: string): Locator {
        return this.page.getByRole('group', { name, exact: true });
    }

    get compileCheckbox(): Locator {
        return this.page.getByRole('checkbox', {
            name: 'Allow the agent to compile',
        });
    }

    get consentModal(): Locator {
        return this.page.locator('.cross-border-consent-modal');
    }

    get consentCheckbox(): Locator {
        return this.consentModal.getByRole('checkbox');
    }

    get consentContinueButton(): Locator {
        return this.consentModal.getByRole('button', {
            name: 'Continue',
            exact: true,
        });
    }

    get promptEditor(): Locator {
        return this.page.locator('.agent-chat__input .cm-content').first();
    }

    get sendButton(): Locator {
        return this.page.locator(
            '.agent-chat__submit:not(.agent-chat__submit--stop)'
        );
    }

    get stopButton(): Locator {
        return this.page.locator('.agent-chat__submit--stop');
    }

    get requests(): Locator {
        return this.page.locator('.agent-chat__request');
    }

    get responses(): Locator {
        return this.page.locator('.agent-chat__response');
    }

    get events(): Locator {
        return this.page.locator('.agent-chat__event-label');
    }

    // The toggle stands under the request whose finished run it folds, in the order of the requests
    stepsToggle(index: number): Locator {
        return this.page.locator('.agent-chat__steps-toggle').nth(index);
    }

    get emptyTranscript(): Locator {
        return this.page.locator('.agent-chat__transcript--empty');
    }

    get uploadButton(): Locator {
        return this.page.getByRole('button', {
            name: 'Upload file',
            exact: true,
        });
    }

    get uploadInput(): Locator {
        return this.page.locator('.agent-files__input');
    }

    attachedFile(name: string): Locator {
        return this.page.locator(`.agent-files__file[title="${name}"]`);
    }

    get clearHistoryButton(): Locator {
        return this.page
            .getByRole('button', { name: 'Clear history', exact: true })
            .first();
    }

    get clearHistoryDialog(): Locator {
        return this.page.getByRole('dialog', {
            name: 'Are you sure you want to clear the history?',
        });
    }

    get dontAskAgainCheckbox(): Locator {
        return this.clearHistoryDialog.getByRole('checkbox', {
            name: "Don't ask again",
        });
    }

    get confirmClearButton(): Locator {
        return this.clearHistoryDialog.getByRole('button', {
            name: 'Yes',
            exact: true,
        });
    }

    get hunkAcceptButtons(): Locator {
        return this.page.locator(
            '.cm-hunk-btn--accept, .segment-hunk-btn--accept'
        );
    }

    get hunkRevertButtons(): Locator {
        return this.page.locator(
            '.cm-hunk-btn--revert, .segment-hunk-btn--revert'
        );
    }

    get hunkTotal(): Locator {
        return this.page.locator('.hunk-global-bar__label');
    }

    get acceptAllButton(): Locator {
        return this.page.getByRole('button', {
            name: 'Accept all',
            exact: true,
        });
    }
}
