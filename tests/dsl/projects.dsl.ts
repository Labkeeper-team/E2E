import { expect, type Page, type TestInfo } from '@playwright/test';
import { input } from '../input';
import { ProjectLocators } from './locators';

export type ProjectType = 'Markdown' | 'LaTeX';

export class ProjectListUnauthorizedError extends Error {
    constructor() {
        super('Project list request returned 401');
        this.name = 'ProjectListUnauthorizedError';
    }
}

export class ProjectsDsl {
    private readonly locators: ProjectLocators;
    private readonly managedProjectsById = new Map<string, Set<string>>();
    private sequence = 0;

    constructor(
        private readonly page: Page,
        private readonly testInfo: TestInfo
    ) {
        this.locators = new ProjectLocators(page);
    }

    uniqueProjectName(label: string): string {
        this.sequence += 1;
        const safeLabel = label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 14);
        const browser = this.testInfo.project.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .slice(0, 8);
        const run = Date.now().toString(36);
        return `${input.projectPrefix}-${safeLabel}-${browser}-${run}-${this.sequence}`.slice(
            0,
            50
        );
    }

    async openList(): Promise<void> {
        const projectsResponse = this.page.waitForResponse(
            (response) =>
                response.request().method() === 'GET' &&
                /\/api\/v\d+\/public\/project\/all$/.test(
                    new URL(response.url()).pathname
                ),
            { timeout: 30_000 }
        );
        await this.page.goto('/projects', { waitUntil: 'domcontentloaded' });
        const responseStatus = (await projectsResponse).status();
        if (responseStatus === 401) {
            throw new ProjectListUnauthorizedError();
        }
        expect(responseStatus).toBe(200);
        await expect(this.page).toHaveURL(/\/projects$/);
        await this.locators.addProjectButton.waitFor({ state: 'visible' });
    }

    async createManagedProject(
        label: string,
        type: ProjectType = 'LaTeX'
    ): Promise<{ id: string; name: string; path: string }> {
        const requestedName = this.uniqueProjectName(label);

        await this.openList();
        await this.locators.addProjectButton.click();
        await this.locators.addProjectModal.waitFor({ state: 'visible' });
        await this.locators.projectNameInput.fill(requestedName);
        const name = await this.locators.projectNameInput.inputValue();
        const projectTypeOption = this.locators.projectTypeOption(type);
        await projectTypeOption.click();
        await expect(projectTypeOption).toHaveClass(/checked/);

        const createResponsePromise = this.page.waitForResponse(
            (response) =>
                response.request().method() === 'PUT' &&
                /\/api\/v\d+\/public\/project\/create$/.test(
                    new URL(response.url()).pathname
                ),
            { timeout: 30_000 }
        );
        const typeResponsePromise = this.page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                /\/api\/v\d+\/public\/project\/[^/]+\/type$/.test(
                    new URL(response.url()).pathname
                ),
            { timeout: 30_000 }
        );
        await this.locators.createProjectButton.click();
        expect((await createResponsePromise).ok()).toBeTruthy();
        expect((await typeResponsePromise).ok()).toBeTruthy();
        await expect(this.page).toHaveURL(/\/project\/[A-Za-z0-9_-]+$/);

        const path = new URL(this.page.url()).pathname;
        const id = path.split('/').pop();
        if (!id || id === 'default') {
            throw new Error('Project creation did not return a project id');
        }

        this.managedProjectsById.set(id, new Set([name]));

        return { id, name, path };
    }

    async openProjectFromList(title: string): Promise<void> {
        await this.openList();
        await this.openProjectFromCurrentList(title);
    }

    async openProjectFromCurrentList(title: string): Promise<void> {
        await this.locators.projectRow(title).click();
        await expect(this.page).toHaveURL(/\/project\/[A-Za-z0-9_-]+$/);
    }

    async openEditorFromCurrentPageMenu(): Promise<void> {
        await this.locators.headerMenu.click();
        await this.locators.menuOption('Editor').click();
    }

    async renameFromListWithEnter(
        currentTitle: string,
        newTitle: string
    ): Promise<void> {
        this.addManagedNameAlias(currentTitle, newTitle);
        await this.openList();
        await this.locators.projectEditTitleButton(currentTitle).click();
        const inputLocator = this.locators.editingProjectTitleInput;
        await expect(inputLocator).toBeVisible();
        await inputLocator.fill(newTitle);
        const renameResponse = this.waitForTitleChangeResponse();
        await inputLocator.press('Enter');
        expect((await renameResponse).ok()).toBeTruthy();
        await expect(this.locators.projectRow(newTitle)).toBeVisible();
    }

    async renameFromListWithBlur(
        currentTitle: string,
        newTitle: string
    ): Promise<void> {
        this.addManagedNameAlias(currentTitle, newTitle);
        await this.openList();
        await this.locators.projectEditTitleButton(currentTitle).click();
        const inputLocator = this.locators.editingProjectTitleInput;
        await expect(inputLocator).toBeVisible();
        await inputLocator.fill(newTitle);
        const renameResponse = this.waitForTitleChangeResponse();
        await this.locators.projectListSurface.click({
            position: { x: 5, y: 5 },
        });
        expect((await renameResponse).ok()).toBeTruthy();
        await expect(this.locators.projectRow(newTitle)).toBeVisible();
    }

    async expectProjectInList(title: string): Promise<void> {
        await this.openList();
        await expect(this.locators.projectRow(title)).toBeVisible();
    }

    async deleteProject(title: string): Promise<void> {
        this.assertReservedProjectName(title);
        await this.openList();
        const row = this.locators.projectRow(title);
        await expect(row).toBeVisible({ timeout: 30_000 });
        await this.locators.projectDeleteButton(title).click();
        await this.locators.confirmDeleteButton.click();
        await expect(row).toHaveCount(0);

        for (const [id, names] of this.managedProjectsById) {
            if (names.has(title)) {
                this.managedProjectsById.delete(id);
                break;
            }
        }
    }

    managedProjects(): Array<{ id: string; names: string[] }> {
        return [...this.managedProjectsById].map(([id, names]) => ({
            id,
            names: [...names],
        }));
    }

    updateManagedProjectName(currentTitle: string, newTitle: string): void {
        this.addManagedNameAlias(currentTitle, newTitle);
    }

    async deleteManagedProject(id: string, names: string[]): Promise<void> {
        for (const name of names) {
            this.assertReservedProjectName(name);
        }

        await this.openList();

        const possibleNames = [...names].reverse();
        await expect
            .poll(
                async () => {
                    for (const name of possibleNames) {
                        if ((await this.locators.projectRow(name).count()) > 0) {
                            return name;
                        }
                    }

                    return undefined;
                },
                { timeout: 30_000 }
            )
            .toBeDefined();

        const currentName = await this.findExistingProjectName(possibleNames);
        if (!currentName) {
            throw new Error(`Managed project ${id} was not found for cleanup`);
        }

        const row = this.locators.projectRow(currentName);
        await this.locators.projectDeleteButton(currentName).click();
        await this.locators.confirmDeleteButton.click();
        await expect(row).toHaveCount(0);
        this.managedProjectsById.delete(id);
    }

    private async findExistingProjectName(
        possibleNames: string[]
    ): Promise<string | undefined> {
        for (const name of possibleNames) {
            if ((await this.locators.projectRow(name).count()) > 0) {
                return name;
            }
        }

        return undefined;
    }

    private addManagedNameAlias(
        currentTitle: string,
        newTitle: string
    ): void {
        this.assertReservedProjectName(currentTitle);
        this.assertReservedProjectName(newTitle);

        for (const names of this.managedProjectsById.values()) {
            if (names.has(currentTitle)) {
                names.add(newTitle);
                return;
            }
        }

        throw new Error(`Managed project ${currentTitle} is not registered`);
    }

    private assertReservedProjectName(name: string): void {
        if (!name.startsWith(`${input.projectPrefix}-`)) {
            throw new Error(
                `Cleanup refused project outside ${input.projectPrefix} prefix`
            );
        }
    }

    private waitForTitleChangeResponse() {
        return this.page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                /\/api\/v\d+\/public\/project\/[^/]+\/title$/.test(
                    new URL(response.url()).pathname
                ),
            { timeout: 30_000 }
        );
    }
}
