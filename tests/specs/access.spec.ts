import { test } from '../fixtures';

test.describe('Project access', () => {
    test('shows a real 404 for a missing project @anonymous', async ({
        app,
    }) => {
        await app.access.openMissingProject();
    });

    test('denies anonymous access to a private project @authenticated', async ({
        app,
    }) => {
        await app.openAuthenticatedEditor();
        const project = await app.projects.createManagedProject(
            'private-access',
            'Markdown'
        );
        await app.editor.addSegment('Markdown', 'private E2E content');
        await app.editor.waitForSaved();

        await app.auth.logout();
        await app.access.openForbiddenProject(project.path);
    });

    test('allows anonymous compilation of a public project @authenticated @conditional', async ({
        app,
    }) => {
        await app.openAuthenticatedEditor();
        const project = await app.projects.createManagedProject(
            'public-access',
            'Markdown'
        );
        await app.editor.addSegment('Computation', 'a = 10');
        await app.compilation.runSuccessfully();
        await app.editor.waitForSaved();
        await app.navigation.reload();
        await app.editor.expectSegmentTexts(['a = 10']);
        await app.editor.setPublicAccess(true);

        await app.auth.logout();
        await app.navigation.openEditor(project.path);
        await app.editor.expectReadOnlyPublicProject();
        await app.editor.expectSegmentTexts(['a = 10']);
        await app.compilation.runAnonymousSuccessfully();
    });

    test('rejects file usage in an anonymous public compilation @authenticated @conditional', async ({
        app,
    }) => {
        await app.openAuthenticatedEditor();
        const project = await app.projects.createManagedProject(
            'public-file-access',
            'Markdown'
        );
        await app.editor.addSegment(
            'Computation',
            'load_csv(file_name = "data.csv")'
        );
        await app.editor.waitForSaved();
        await app.files.open();
        await app.files.uploadTextFile('data.csv', 'value\n1\n2\n3\n');
        await app.files.close();
        await app.editor.waitForSaved();
        await app.navigation.reload();
        await app.editor.expectSegmentTexts([
            'load_csv(file_name = "data.csv")',
        ]);
        await app.editor.setPublicAccess(true);

        await app.auth.logout();
        await app.navigation.openEditor(project.path);
        await app.editor.expectReadOnlyPublicProject();
        await app.editor.expectSegmentTexts([
            'load_csv(file_name = "data.csv")',
        ]);
        await app.compilation.runAnonymousWithCompilationErrors();
        await app.results.expectCompilationError(
            'You may not use files unauthenticated'
        );
    });
});
