import type { Page, TestInfo } from '@playwright/test';
import { AccessDsl } from './access.dsl';
import { AuthDsl } from './auth.dsl';
import { CompilationDsl } from './compilation.dsl';
import { EditorPerformanceDsl } from './editor-performance.dsl';
import { EditorDsl } from './editor.dsl';
import { FileManagerDsl } from './file-manager.dsl';
import { LandingDsl } from './landing.dsl';
import { NavigationDsl } from './navigation.dsl';
import { ProjectViewDsl } from './project-view.dsl';
import {
    ProjectListUnauthorizedError,
    ProjectsDsl,
} from './projects.dsl';
import { ResponseRecorder } from './response-recorder';
import { ResultDsl } from './result.dsl';

export class LabkeeperDsl {
    readonly access: AccessDsl;
    readonly auth: AuthDsl;
    readonly compilation: CompilationDsl;
    readonly editor: EditorDsl;
    readonly files: FileManagerDsl;
    readonly landing: LandingDsl;
    readonly navigation: NavigationDsl;
    readonly performance: EditorPerformanceDsl;
    readonly projects: ProjectsDsl;
    readonly results: ResultDsl;

    constructor(
        private readonly page: Page,
        testInfo: TestInfo
    ) {
        const projectView = new ProjectViewDsl(page);
        const responses = new ResponseRecorder(page);

        this.access = new AccessDsl(page);
        this.auth = new AuthDsl(page);
        this.compilation = new CompilationDsl(page, projectView, responses);
        this.editor = new EditorDsl(page, projectView);
        this.files = new FileManagerDsl(page, projectView);
        this.landing = new LandingDsl(page);
        this.navigation = new NavigationDsl(page);
        this.projects = new ProjectsDsl(page, testInfo);
        this.performance = new EditorPerformanceDsl(
            page,
            testInfo,
            projectView,
            this.editor,
            this.files,
            this.navigation,
            this.projects
        );
        this.results = new ResultDsl(page, projectView, responses);
    }

    async openAnonymousEditor(): Promise<void> {
        await this.navigation.openEditor();
    }

    async openAuthenticatedEditor(): Promise<void> {
        await this.navigation.openEditor();
        await this.auth.login();
    }

    async cleanup(): Promise<void> {
        try {
            await this.deleteManagedProjects();
        } finally {
            await this.projects.deleteClonedProjects();
        }
    }

    private async deleteManagedProjects(): Promise<void> {
        const projects = this.projects.managedProjects();
        if (projects.length === 0) {
            return;
        }

        await this.navigation.openEditor();
        await this.auth.login();
        // /project/default opens the last changed project of the account, possibly the test project itself, so lock reports show whether the editor had opened one before cleanup left
        const editorPath = this.navigation.currentProjectPath();

        for (const project of projects.reverse()) {
            try {
                await this.projects.deleteManagedProject(
                    project.id,
                    project.names,
                    editorPath
                );
            } catch (error) {
                if (!(error instanceof ProjectListUnauthorizedError)) {
                    throw error;
                }

                await this.auth.login();
                await this.projects.deleteManagedProject(
                    project.id,
                    project.names,
                    editorPath
                );
            }
        }
    }
}

export type { SegmentType } from './locators';
