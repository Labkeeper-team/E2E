import { expect, type Page, type Request } from '@playwright/test';
import {
    ProjectViewLocators,
    type ProjectView,
} from './locators/project-view.locators';

const MOBILE_BREAKPOINT = 767;
const STARTUP_QUIET_MS = 500;

// Startup also waits for analytics calls to other hosts, so every data request counts, not only /api
const isDataRequest = (request: Request): boolean =>
    ['fetch', 'xhr'].includes(request.resourceType());

export class ProjectViewDsl {
    private readonly locators: ProjectViewLocators;
    private navigation = 0;
    private settledNavigation = -1;
    private pendingDataRequests = 0;
    private lastDataActivityAt = 0;

    constructor(private readonly page: Page) {
        this.locators = new ProjectViewLocators(page);
        page.on('framenavigated', (frame) => {
            if (frame === page.mainFrame()) {
                this.navigation += 1;
            }
        });
        page.on('request', (request) => {
            if (isDataRequest(request)) {
                this.pendingDataRequests += 1;
                this.lastDataActivityAt = Date.now();
            }
        });
        const finish = (request: Request) => {
            if (isDataRequest(request)) {
                this.pendingDataRequests = Math.max(
                    0,
                    this.pendingDataRequests - 1
                );
                this.lastDataActivityAt = Date.now();
            }
        };
        page.on('requestfinished', finish);
        page.on('requestfailed', finish);
    }

    isMobile(): boolean {
        return (this.page.viewportSize()?.width ?? Infinity) <= MOBILE_BREAKPOINT;
    }

    async showFiles(): Promise<void> {
        await this.show('Files');
    }

    async showEditor(): Promise<void> {
        await this.show('Editor');
    }

    async showPdf(): Promise<void> {
        await this.show('PDF');
    }

    private async show(view: ProjectView): Promise<void> {
        if (!this.isMobile()) {
            return;
        }

        await expect(this.locators.switcher).toBeVisible({ timeout: 60_000 });
        await this.waitForStartupScreen();
        const pane = this.locators.pane(view);
        if (await pane.isVisible()) {
            return;
        }

        const option = this.locators.option(view);
        if (!(await option.isVisible())) {
            await this.locators.toggle.click();
        }
        await option.click();
        await expect(pane).toBeVisible({ timeout: 60_000 });
    }

    private async waitForStartupScreen(): Promise<void> {
        if (this.settledNavigation === this.navigation) {
            return;
        }
        // A never-compiled project moves a phone to the agent screen after its last startup request, so a pane chosen earlier gets hidden
        await expect
            .poll(
                () =>
                    this.pendingDataRequests === 0 &&
                    Date.now() - this.lastDataActivityAt >= STARTUP_QUIET_MS,
                { timeout: 60_000 }
            )
            .toBe(true);
        this.settledNavigation = this.navigation;
    }
}
