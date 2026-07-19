import type { Page, TestInfo } from '@playwright/test';
import { AccessDsl } from './access.dsl';
import { AuthDsl } from './auth.dsl';
import { CompilationDsl } from './compilation.dsl';
import { EditorDsl } from './editor.dsl';
import { FileManagerDsl } from './file-manager.dsl';
import { NavigationDsl } from './navigation.dsl';
import { ProjectsDsl } from './projects.dsl';
import { ResultDsl } from './result.dsl';

export class LabkeeperDsl {
    readonly access: AccessDsl;
    readonly auth: AuthDsl;
    readonly compilation: CompilationDsl;
    readonly editor: EditorDsl;
    readonly files: FileManagerDsl;
    readonly navigation: NavigationDsl;
    readonly projects: ProjectsDsl;
    readonly results: ResultDsl;

    constructor(
        private readonly page: Page,
        testInfo: TestInfo
    ) {
        this.access = new AccessDsl(page);
        this.auth = new AuthDsl(page);
        this.compilation = new CompilationDsl(page);
        this.editor = new EditorDsl(page);
        this.files = new FileManagerDsl(page);
        this.navigation = new NavigationDsl(page);
        this.projects = new ProjectsDsl(page, testInfo);
        this.results = new ResultDsl(page);
    }

    async openAnonymousEditor(): Promise<void> {
        await this.navigation.openEditor();
    }

    async openAuthenticatedEditor(): Promise<void> {
        await this.navigation.openEditor();
        await this.auth.login();
    }

    async cleanup(): Promise<void> {
        const projects = this.projects.managedProjects();
        if (projects.length === 0) {
            return;
        }

        await this.navigation.openEditor();
        await this.auth.login();

        for (const project of projects.reverse()) {
            await this.projects.deleteManagedProject(project.id, project.names);
        }
    }
}

export type { SegmentType } from './locators';
