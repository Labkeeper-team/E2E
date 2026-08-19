import { test } from '../fixtures';

test.describe('Files and editor panels', () => {
    test('rejects a file larger than the production limit @authenticated', async ({
        app,
    }) => {
        await app.openAuthenticatedEditor();
        await app.projects.createManagedProject('oversized-file', 'Markdown');

        await app.files.open();
        await app.files.uploadOversizedFile();
    });

    test('refreshes generated files after compilation @authenticated', async ({
        app,
    }) => {
        await app.openAuthenticatedEditor();
        await app.projects.createManagedProject('generated-file', 'Markdown');
        await app.editor.addSegment('Computation', 'save_csv([1, 2, 3])');

        await app.files.open();
        await app.compilation.runSuccessfully();
        await app.files.expectGeneratedCsv();
    });

    test('closes stacked panels in the expected order @authenticated', async ({
        app,
    }) => {
        await app.openAuthenticatedEditor();
        await app.projects.createManagedProject('escape-panels', 'Markdown');
        await app.editor.addSegment('Markdown', 'alpha ${missing_variable}');
        await app.editor.addSegment(
            'Computation',
            'missing_function(1)'
        );
        await app.compilation.runWithCompilationErrors();
        await app.results.openProblems();

        await app.files.open();
        await app.editor.openSearch('alpha');

        await app.editor.closeSearchWithEscape();
        await app.results.closeProblemsWithEscape();
        await app.files.closeFromStack();
    });
});
