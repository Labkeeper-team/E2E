import { expect, type Page, type Request } from '@playwright/test';
import {
    ProjectViewLocators,
    type ProjectView,
} from './locators/project-view.locators';

const MOBILE_BREAKPOINT = 767;
const STARTUP_QUIET_MS = 500;
const STARTUP_SETTLED = 'settled';

export class ProjectViewDsl {
    private readonly locators: ProjectViewLocators;
    private navigation = 0;
    private settledNavigation = -1;
    private readonly pendingApiRequests = new Set<Request>();
    private lastApiActivityAt = 0;

    constructor(private readonly page: Page) {
        this.locators = new ProjectViewLocators(page);
        page.on('framenavigated', (frame) => {
            if (frame === page.mainFrame()) {
                this.navigation += 1;
            }
        });
        page.on('request', (request) => {
            if (this.isAppApiRequest(request)) {
                this.pendingApiRequests.add(request);
                this.lastApiActivityAt = Date.now();
            }
        });
        const finish = (request: Request) => {
            if (this.pendingApiRequests.delete(request)) {
                this.lastApiActivityAt = Date.now();
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

    // Only the app's own /api/ calls on the page origin decide the startup screen (uri = '' in FrontendContract src/constants.ts)
    // In Chromium, Playwright never reports the end of a request whose worker or cross-site iframe session closed before the response
    private isAppApiRequest(request: Request): boolean {
        if (!['fetch', 'xhr'].includes(request.resourceType())) {
            return false;
        }
        const url = new URL(request.url());
        if (!url.pathname.startsWith('/api/')) {
            return false;
        }
        try {
            return url.origin === new URL(this.page.url()).origin;
        } catch {
            return false;
        }
    }

    private startupState(): string {
        if (this.pendingApiRequests.size > 0) {
            const pending = [...this.pendingApiRequests].map(
                (request) =>
                    `${request.method()} ${new URL(request.url()).pathname}`
            );
            return `waiting for ${pending.join(', ')}`;
        }
        const quietFor = Date.now() - this.lastApiActivityAt;
        return quietFor >= STARTUP_QUIET_MS
            ? STARTUP_SETTLED
            : `quiet for ${quietFor} ms`;
    }

    private async waitForStartupScreen(): Promise<void> {
        if (this.settledNavigation === this.navigation) {
            return;
        }
        // A never-compiled project moves a phone to the agent screen after its last startup request, so a pane chosen earlier gets hidden
        await expect
            .poll(() => this.startupState(), {
                message: 'Project startup API requests did not settle',
                timeout: 60_000,
            })
            .toBe(STARTUP_SETTLED);
        this.settledNavigation = this.navigation;
    }
}
