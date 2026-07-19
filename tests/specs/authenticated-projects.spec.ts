import { test } from '../fixtures';

test.describe('Authenticated projects', () => {
    test('persists segments after compilation and reload @authenticated', async ({
        app,
    }) => {
        await app.openAuthenticatedEditor();
        await app.projects.createManagedProject('save-project', 'Markdown');
        await app.editor.addSegment('Markdown', 'persistent markdown');
        await app.editor.addSegment('Computation', 'a = 10');

        await app.compilation.runSuccessfully();
        await app.editor.waitForSaved();
        await app.navigation.reload();
        await app.editor.expectSegmentTexts([
            'persistent markdown',
            'a = 10',
        ]);
    });

    test('renames a project in editor with Enter @authenticated', async ({
        app,
    }) => {
        await app.openAuthenticatedEditor();
        const project = await app.projects.createManagedProject(
            'editor-rename-enter'
        );
        const renamed = `${project.name}-renamed`;

        app.projects.updateManagedProjectName(project.name, renamed);
        await app.editor.renameProjectWithEnter(renamed);
        await app.navigation.reload();
        await app.editor.expectProjectTitle(renamed);
    });

    test('renames a project in editor on blur @authenticated', async ({
        app,
    }) => {
        await app.openAuthenticatedEditor();
        const project = await app.projects.createManagedProject(
            'editor-rename-blur'
        );
        const renamed = `${project.name}-renamed`;

        app.projects.updateManagedProjectName(project.name, renamed);
        await app.editor.renameProjectWithBlur(renamed);
        await app.navigation.reload();
        await app.editor.expectProjectTitle(renamed);
    });

    test('renames a project in list with Enter @authenticated', async ({
        app,
    }) => {
        await app.openAuthenticatedEditor();
        const project = await app.projects.createManagedProject(
            'list-rename-enter'
        );
        const renamed = `${project.name}-renamed`;

        await app.projects.renameFromListWithEnter(project.name, renamed);
        await app.projects.expectProjectInList(renamed);
    });

    test('renames a project in list on blur @authenticated', async ({
        app,
    }) => {
        await app.openAuthenticatedEditor();
        const project = await app.projects.createManagedProject(
            'list-rename-blur'
        );
        const renamed = `${project.name}-renamed`;

        await app.projects.renameFromListWithBlur(project.name, renamed);
        await app.projects.expectProjectInList(renamed);
    });
});
