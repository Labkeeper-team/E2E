import { test } from '../fixtures';

// Every compilation gets its own word, so an exact page text check cannot pass on the PDF of the previous run
const FIRST_TEXT = 'alpha';
const SECOND_TEXT = 'omega';
const THIRD_TEXT = 'sigma';

// \pagestyle{empty} drops the page number, so the text of the whole page equals the text of the segment
const latexBody = (text: string): string => String.raw`\pagestyle{empty}
${text}`;

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

    test('updates the PDF text after each of three compilations @authenticated', async ({
        app,
    }) => {
        // One compilation waits up to 120 s for the answer and up to 60 s more for the Run button to unlock, and the fixture teardown that logs in and deletes the project counts into the same budget
        test.setTimeout(10 * 60_000);

        await app.openAuthenticatedEditor();
        await app.projects.createManagedProject('sequential-pdf', 'LaTeX');
        let bodySegment = await app.editor.addSegment(
            'Latex',
            latexBody(FIRST_TEXT)
        );
        await app.editor.insertLatexHeader();
        bodySegment += 1;
        await app.editor.insertLatexFooter();
        await app.editor.waitForSaved();

        await app.compilation.runSuccessfully();
        await app.results.expectPdfText(FIRST_TEXT);

        await app.editor.fillSegment(bodySegment, latexBody(SECOND_TEXT));
        await app.editor.waitForSaved();
        await app.compilation.runSuccessfully();
        await app.results.expectPdfText(SECOND_TEXT);

        await app.editor.fillSegment(bodySegment, latexBody(THIRD_TEXT));
        await app.editor.waitForSaved();
        await app.compilation.runSuccessfully();
        await app.results.expectPdfText(THIRD_TEXT);
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
