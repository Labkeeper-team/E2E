import { test } from '../fixtures';

const compilerErrorCases = [
    {
        title: 'shows an error without extra details',
        code: 'a = "unterminated',
        expected: 'No closing quotes',
    },
    {
        title: 'shows a single expected operator',
        code: 'a = (1 2)',
        expected: 'Operator expected )',
    },
    {
        title: 'shows an expected line separator operator',
        code: 'a = 1 2',
        expected: /Operator expected/,
    },
    {
        title: 'shows the missing variable name',
        code: 'a = missing_variable + 1',
        expected: 'No such variable missing_variable',
    },
    {
        title: 'shows the missing function name',
        code: 'missing_function(1)',
        expected: 'No such function missing_function',
    },
] as const;

test.describe('Real compiler errors', () => {
    for (const errorCase of compilerErrorCases) {
        test(`${errorCase.title} @authenticated`, async ({ app }) => {
            await app.openAuthenticatedEditor();
            await app.projects.createManagedProject(
                `compiler-${errorCase.title}`,
                'Markdown'
            );
            await app.editor.addSegment('Computation', errorCase.code);

            await app.compilation.runWithCompilationErrors();
            await app.results.expectProblemCount(1);
            await app.results.expectCompilationError(errorCase.expected);
        });
    }
});
