import {
    expect,
    request,
    type Page,
    type TestInfo,
} from '@playwright/test';
import {
    input,
    requireUserCredentials,
    type UserCredentials,
} from '../input';
import { EditorLocators, ProjectLocators } from './locators';

export type ProjectType = 'Markdown' | 'LaTeX';

export interface ManagedProjectSegment {
    type: 'md' | 'computational' | 'latex' | 'asciimath';
    text: string;
}

export class ProjectListUnauthorizedError extends Error {
    constructor() {
        super('Project list request returned 401');
        this.name = 'ProjectListUnauthorizedError';
    }
}

export class ProjectsDsl {
    private readonly locators: ProjectLocators;
    private readonly editorLocators: EditorLocators;
    private readonly managedProjectsById = new Map<string, Set<string>>();
    // Clones belong to users created by the test and get the source title, so they are tracked by id and owner
    private readonly clonedProjectsById = new Map<string, UserCredentials>();
    private apiBasePath?: string;
    private sequence = 0;

    constructor(
        private readonly page: Page,
        private readonly testInfo: TestInfo
    ) {
        this.locators = new ProjectLocators(page);
        this.editorLocators = new EditorLocators(page);
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
        let lastError: unknown;

        for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
                await this.openListOnce();
                return;
            } catch (error) {
                if (error instanceof ProjectListUnauthorizedError) {
                    throw error;
                }
                lastError = error;
            }
        }

        throw lastError;
    }

    private async openListOnce(): Promise<void> {
        const [response] = await Promise.all([
            this.page.waitForResponse(
                (response) =>
                    response.request().method() === 'GET' &&
                    /\/api\/v\d+\/public\/project\/all$/.test(
                        new URL(response.url()).pathname
                    ),
                { timeout: 60_000 }
            ),
            this.page.goto('/projects', {
                waitUntil: 'domcontentloaded',
                timeout: 60_000,
            }),
        ]);
        const responseStatus = response.status();

        if (responseStatus === 401) {
            throw new ProjectListUnauthorizedError();
        }
        expect(responseStatus).toBe(200);
        await expect(this.page).toHaveURL(/\/projects$/);
        await this.locators.addProjectButton.waitFor({
            state: 'visible',
            timeout: 60_000,
        });
    }

    async createManagedProject(
        label: string,
        type: ProjectType = 'LaTeX'
    ): Promise<{ id: string; name: string; path: string }> {
        const requestedName = this.uniqueProjectName(label);

        await this.openList();
        await this.openAddProjectModal();
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
        await this.locators.createProjectButton.click();
        const createResponse = await createResponsePromise;
        expect(createResponse.ok()).toBeTruthy();
        this.rememberApiBasePath(createResponse.url());
        await expect(this.page).toHaveURL(/\/project\/[A-Za-z0-9_-]+$/);

        const path = new URL(this.page.url()).pathname;
        const id = path.split('/').pop();
        if (!id || id === 'default') {
            throw new Error('Project creation did not return a project id');
        }

        this.managedProjectsById.set(id, new Set([name]));
        await this.locators.editorRoot.waitFor({
            state: 'visible',
            timeout: 60_000,
        });

        return { id, name, path };
    }

    async replaceManagedProjectProgram(
        id: string,
        segments: ManagedProjectSegment[]
    ): Promise<void> {
        if (!this.managedProjectsById.has(id)) {
            throw new Error(
                `Program setup refused unmanaged project ${id}`
            );
        }
        if (!this.apiBasePath) {
            throw new Error('Project API version was not discovered');
        }

        const endpoint = new URL(
            `${this.apiBasePath}/public/project/${encodeURIComponent(id)}/program`,
            this.page.url()
        ).toString();
        const response = await this.page.request.post(endpoint, {
            maxRetries: 2,
            data: {
                segments: segments.map((segment, index) => ({
                    ...segment,
                    id: index + 1,
                    parameters: { visible: true },
                })),
                parameters: { roundStrategy: 'noRound' },
            },
        });

        expect(
            response.ok(),
            `Managed project program setup returned HTTP ${response.status()}`
        ).toBeTruthy();
    }

    private async openAddProjectModal(): Promise<void> {
        let lastError: unknown;

        for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
                if (!(await this.locators.addProjectModal.isVisible())) {
                    await this.locators.addProjectButton.click();
                }
                await this.locators.addProjectModal.waitFor({
                    state: 'visible',
                    timeout: 5_000,
                });
                return;
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError;
    }

    async cloneOpenedProject(
        owner: UserCredentials
    ): Promise<{ id: string; title: string }> {
        const sourceId = new URL(this.page.url()).pathname.split('/').pop();
        const cloneResponsePromise = this.page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                new RegExp(`/api/v\\d+/public/project/${sourceId}/clone$`).test(
                    new URL(response.url()).pathname
                ),
            { timeout: 60_000 }
        );
        cloneResponsePromise.catch(() => undefined);
        await this.editorLocators.cloneProjectButton.click();
        const cloneResponse = await cloneResponsePromise;
        expect(
            cloneResponse.ok(),
            `Project clone returned HTTP ${cloneResponse.status()}`
        ).toBeTruthy();
        this.rememberApiBasePath(cloneResponse.url());

        const { projectId: id, title } = (await cloneResponse.json()) as {
            projectId: string;
            title: string;
        };
        expect(id).toBeTruthy();
        expect(id).not.toBe(sourceId);
        this.clonedProjectsById.set(id, owner);

        await expect(this.page).toHaveURL(
            (url) => url.pathname === `/project/${id}`,
            { timeout: 30_000 }
        );
        await this.locators.editorRoot.waitFor({
            state: 'visible',
            timeout: 60_000,
        });
        return { id, title };
    }

    async openListFromProject(): Promise<void> {
        const listResponse = this.page.waitForResponse(
            (response) =>
                response.request().method() === 'GET' &&
                /\/api\/v\d+\/public\/project\/all$/.test(
                    new URL(response.url()).pathname
                ),
            { timeout: 60_000 }
        );
        listResponse.catch(() => undefined);
        await this.locators.backToProjectsButton.click();
        expect((await listResponse).status()).toBe(200);
        await expect(this.page).toHaveURL(/\/projects$/);
        await this.locators.addProjectButton.waitFor({
            state: 'visible',
            timeout: 60_000,
        });
    }

    async expectProjectInCurrentList(title: string): Promise<void> {
        await expect(this.locators.projectRow(title)).toBeVisible({
            timeout: 30_000,
        });
    }

    async deleteClonedProjects(): Promise<void> {
        for (const [id, owner] of [...this.clonedProjectsById]) {
            await this.deleteProjectAsUser(id, owner);
            this.clonedProjectsById.delete(id);
        }
    }

    async openProjectFromList(title: string): Promise<void> {
        await this.openList();
        await this.openProjectFromCurrentList(title);
    }

    async openProjectFromCurrentList(title: string): Promise<void> {
        await this.locators.projectRow(title).click();
        await expect(this.page).toHaveURL(/\/project\/[A-Za-z0-9_-]+$/);
        await this.locators.editorRoot.waitFor({
            state: 'visible',
            timeout: 60_000,
        });
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

        const possibleNames = [...names].reverse();
        let lastFailure: string | undefined;
        for (let attempt = 0; attempt < 3; attempt += 1) {
            await this.openList();

            const currentName = await this.findExistingProjectName(
                possibleNames
            );
            if (currentName) {
                this.assertReservedProjectName(currentName);
                lastFailure = await this.deleteProjectRow(id, currentName);
                if (!lastFailure) {
                    this.managedProjectsById.delete(id);
                    return;
                }
            }

            await this.page.waitForTimeout(1_000);
        }

        // The row sometimes does not show up in the list, and a project left on production pollutes the account
        await this.deleteProjectAsUser(id, requireUserCredentials());
        this.managedProjectsById.delete(id);
        if (lastFailure) {
            throw new Error(lastFailure);
        }
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

    private async deleteProjectAsUser(
        id: string,
        owner: UserCredentials
    ): Promise<void> {
        expect(
            this.apiBasePath,
            'Project API version was not discovered'
        ).toBeTruthy();
        // The page may be logged out after a failure, so cleanup uses its own session of the project owner
        const api = await request.newContext({ baseURL: input.host });
        try {
            const login = await api.post(`${this.apiBasePath}/sec/formlogin`, {
                form: {
                    username: owner.email,
                    password: owner.password,
                    captcha: input.captchaBypassToken ?? '',
                },
            });
            expect(
                login.ok(),
                `Cleanup login returned HTTP ${login.status()}`
            ).toBeTruthy();

            const response = await api.delete(
                `${this.apiBasePath}/public/project/${encodeURIComponent(id)}/delete`
            );
            expect(
                response.ok() || response.status() === 404,
                `Project ${id} cleanup returned HTTP ${response.status()}`
            ).toBeTruthy();
        } finally {
            await api.dispose();
        }
    }

    private rememberApiBasePath(url: string): void {
        const path = new URL(url).pathname;
        const match = path.match(/^\/api\/v\d+/);
        if (!match) {
            throw new Error(`Could not discover API version from ${path}`);
        }
        this.apiBasePath = match[0];
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

    private async deleteProjectRow(
        id: string,
        title: string
    ): Promise<string | undefined> {
        const row = this.locators.projectRow(title);
        await expect(row).toBeVisible({ timeout: 30_000 });
        await this.locators.projectDeleteButton(title).click();
        const responsePromise = this.page.waitForResponse(
            (response) =>
                response.request().method() === 'DELETE' &&
                new RegExp(
                    `/api/v\\d+/public/project/${id}/delete$`
                ).test(new URL(response.url()).pathname),
            { timeout: 30_000 }
        );
        await this.locators.confirmDeleteButton.click();
        const response = await responsePromise;
        if (response.status() === 404) {
            return undefined;
        }
        // One production run got a failed delete right after the test worked with the project, so the caller retries
        if (!response.ok()) {
            const body = await response.text().catch(() => '');
            return `Deleting project ${id} returned HTTP ${response.status()}: ${body.slice(0, 200)}`;
        }
        await expect(row).toHaveCount(0, { timeout: 30_000 });
        return undefined;
    }
}
