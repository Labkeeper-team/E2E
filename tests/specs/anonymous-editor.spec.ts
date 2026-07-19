import { test } from '../fixtures';

test.describe('Anonymous editor', () => {
    test('opens an isolated default project @anonymous', async ({ app }) => {
        await app.openAnonymousEditor();
        await app.editor.expectSegmentCount(0);
    });

    test('inserts and removes segments between existing segments @anonymous', async ({
        app,
    }) => {
        await app.openAnonymousEditor();

        await app.editor.addSegment('Computation', 'computation');
        await app.editor.addSegment('Simple-math', 'asciimath');
        await app.editor.addSegmentBetween(0, 'Markdown', 'markdown');
        await app.editor.addSegmentBetween(1, 'Latex', '\\text{latex}');

        await app.editor.expectSegmentTexts([
            'computation',
            'markdown',
            '\\text{latex}',
            'asciimath',
        ]);

        await app.editor.deleteSegment(2);
        await app.editor.deleteSegment(1);
        await app.editor.deleteSegment(1);
        await app.editor.deleteSegment(0);
        await app.editor.expectSegmentCount(0);
    });

    test('supports many Markdown segments @anonymous', async ({ app }) => {
        await app.openAnonymousEditor();

        for (let index = 0; index < 10; index += 1) {
            await app.editor.addSegment(
                'Markdown',
                index === 0 ? 'first segment\n'.repeat(20).trim() : undefined
            );
        }

        await app.editor.expectSegmentCount(10);
    });

    test('closes search with Escape and clear button @anonymous', async ({
        app,
    }) => {
        await app.openAnonymousEditor();
        await app.editor.addSegment('Markdown', 'alpha alpha beta');

        await app.editor.openSearch('alpha');
        await app.editor.closeSearchWithEscape();

        await app.editor.openSearch('beta');
        await app.editor.closeSearchWithButton();
    });

    test('moves segments without losing their text @anonymous', async ({
        app,
    }) => {
        await app.openAnonymousEditor();
        await app.editor.addSegment('Markdown', 'aaaa');
        await app.editor.addSegment('Computation', 'bbbb');
        await app.editor.addSegment('Markdown', 'cccc');
        await app.editor.addSegment('Computation', 'dddd');

        await app.editor.moveSegmentUp(1);
        await app.editor.expectSegmentTexts(['bbbb', 'aaaa', 'cccc', 'dddd']);

        await app.editor.moveSegmentUp(3);
        await app.editor.expectSegmentTexts(['bbbb', 'aaaa', 'dddd', 'cccc']);

        await app.editor.moveSegmentUp(2);
        await app.editor.expectSegmentTexts(['bbbb', 'dddd', 'aaaa', 'cccc']);

        await app.editor.moveSegmentUp(3);
        await app.editor.expectSegmentTexts(['bbbb', 'dddd', 'cccc', 'aaaa']);

        await app.editor.moveSegmentDown(0);
        await app.editor.expectSegmentTexts(['dddd', 'bbbb', 'cccc', 'aaaa']);
    });
});
