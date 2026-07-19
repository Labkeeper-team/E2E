import { test } from '../fixtures';

test.describe('Advanced editor behavior', () => {
    test('updates tables and plots after a second compilation @authenticated', async ({
        app,
    }) => {
        await app.openAuthenticatedEditor();
        await app.projects.createManagedProject('double-compilation', 'Markdown');
        const segment = await app.editor.addSegment(
            'Computation',
            `a = [0, 1, 2, 3, 4]
table(a)
plot(title="First plot", x_1=a, y_1=a, type_1="line")`
        );

        await app.compilation.runSuccessfully();
        await app.results.expectTable();
        await app.results.expectPlot('First plot');

        await app.editor.fillSegment(
            segment,
            `a = [0, 1, 2, 3, 4]
b = a ^ 2
table(a, b)
plot(title="Second plot", x_1=a, y_1=b, type_1="line")`
        );
        await app.compilation.runSuccessfully();
        await app.results.expectTable();
        await app.results.expectPlot('Second plot');
    });

    test('clears a large set of real errors after editing @authenticated', async ({
        app,
    }) => {
        await app.openAuthenticatedEditor();
        await app.projects.createManagedProject('many-errors', 'Markdown');
        const code = Array.from(
            { length: 20 },
            (_, index) => `result_${index} = missing_${index}`
        ).join('\n');
        const segment = await app.editor.addSegment('Computation', code);

        await app.compilation.runWithCompilationErrors();
        await app.results.expectProblemCount(20);
        await app.editor.expectErrorDecorations();

        await app.editor.appendToSegment(segment, '\nresolved = 1');
        await app.editor.expectNoErrorDecorations();
    });

    test('clears error decorations after three text deletion methods @authenticated', async ({
        app,
    }) => {
        await app.openAuthenticatedEditor();
        await app.projects.createManagedProject('remove-error-lines', 'Markdown');
        const code = 'missing_function(1)';
        const segment = await app.editor.addSegment('Computation', code);

        await app.compilation.runWithCompilationErrors();
        await app.results.expectProblemCount(1);
        await app.editor.expectErrorDecorations();
        await app.editor.deleteCharactersFromEnd(segment, code.length);
        await app.editor.expectNoErrorDecorations();

        await app.editor.fillSegment(segment, code);
        await app.compilation.runWithCompilationErrors();
        await app.results.expectProblemCount(1);
        await app.editor.expectErrorDecorations();
        await app.editor.selectAllAndDelete(segment);
        await app.editor.expectNoErrorDecorations();

        await app.editor.fillSegment(segment, code);
        await app.compilation.runWithCompilationErrors();
        await app.results.expectProblemCount(1);
        await app.editor.expectErrorDecorations();
        await app.editor.selectPreviousCharactersAndDelete(
            segment,
            code.length
        );
        await app.editor.expectNoErrorDecorations();
    });
});
