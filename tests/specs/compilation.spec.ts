import { test } from '../fixtures';

test.describe('Production compilation', () => {
    test('renders Markdown content for PDF export @authenticated', async ({
        app,
    }) => {
        await app.openAuthenticatedEditor();
        await app.projects.createManagedProject('markdown-pdf', 'Markdown');
        await app.editor.addSegment(
            'Markdown',
            [
                '# Playwright production check',
                '',
                '| Value | Result |',
                '| --- | --- |',
                '| 2 | 4 |',
                '',
                '```javascript',
                'const result = 2 * 2;',
                '```',
            ].join('\n')
        );
        await app.editor.addSegment('Computation', 'a = 10');

        await app.compilation.runSuccessfully();
        await app.results.expectMarkdownText('Playwright production check');
        await app.results.expectTable();
        await app.results.expectPdfExportAvailable();
    });

    test('shows a real compiler error @authenticated', async ({ app }) => {
        await app.openAuthenticatedEditor();
        await app.projects.createManagedProject('compiler-error', 'Markdown');
        await app.editor.addSegment('Computation', 'missing_function(1)');

        await app.compilation.runWithCompilationErrors();
        await app.results.expectProblemCount(1);
        await app.results.expectCompilationError(
            'No such function missing_function'
        );
    });
});
