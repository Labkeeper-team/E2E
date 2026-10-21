import { test } from '../../fixtures';

// The same word stands in two segments, so the search has a match in each of them
const SEARCH_WORD = 'lantern';
const FIRST_SEGMENT = String.raw`\pagestyle{empty}
The lantern stands on the first page.
\newpage
content before the marker`;
const SECOND_SEGMENT = String.raw`\section*{sync target}
The lantern is mentioned again here.`;
const NEW_SEGMENT_TEXT = 'Typed with hotkeys';
const APPENDED_WORD = ' later';
const LATEX_ERROR = '\n\\test';
const FIRST_EDIT = ' one';
const SECOND_EDIT = ' two';

test.describe('Old user hotkey scenarios', () => {
    test('uses the project keyboard shortcuts @authenticated @scenario', async ({
        app,
    }) => {
        test.setTimeout(10 * 60_000);
        // A phone has no keyboard, and its help menu does not list the shortcuts
        test.skip(
            test.info().project.use.isMobile === true,
            'Keyboard shortcuts are a desktop scenario'
        );

        let projectName = '';
        // After Ctrl+Shift+L the new segment stands between the two
        const newSegment = 1;
        const syncSegment = 2;

        await test.step('opens a LaTeX project with the same word in two segments from My projects', async () => {
            await app.openAuthenticatedEditor();
            const project = await app.projects.createManagedProject(
                'project-hotkeys',
                'LaTeX'
            );
            projectName = project.name;
            await app.projects.replaceManagedProjectProgram(project.id, [
                { type: 'latex', text: FIRST_SEGMENT },
                { type: 'latex', text: SECOND_SEGMENT },
            ]);
            await app.projects.openProjectFromList(projectName);
            await app.editor.expectSegmentCount(2);
            await app.editor.waitForSaved();
        });

        await test.step('opens the shortcut list from the help menu and closes it with Esc', async () => {
            await app.hotkeys.openShortcutsFromHelpMenu();
            await app.hotkeys.expectShortcutsListed([
                'Search in segments',
                'Build the project',
                'Previous and next segment',
            ]);
            await app.hotkeys.closeShortcutsWithEscape();
        });

        await test.step('searches the word and steps between its matches with F3 and Shift+F3', async () => {
            await app.hotkeys.openSearch();
            await app.hotkeys.typeSearch(SEARCH_WORD);
            // each segment has one match, so every step moves the current match to the other segment
            const next = await app.hotkeys.stepSearch('F3');
            const previous = await app.hotkeys.stepSearch('Shift+F3');
            test.expect(previous).toBe(1 - next);
            await app.hotkeys.closeSearchWithEscape();
        });

        await test.step('shows and hides the file manager with Ctrl+Shift+E', async () => {
            await app.hotkeys.toggleFileManager();
            await app.hotkeys.expectFileManagerShown(true);
            await app.hotkeys.toggleFileManager();
            await app.hotkeys.expectFileManagerShown(false);
        });

        await test.step('moves between segments with Alt+Down and Alt+Up', async () => {
            await app.editor.placeCursorAtSegmentEnd(0);
            await app.hotkeys.press('Alt+ArrowDown');
            await app.hotkeys.expectFocusedSegment(1);
            await app.hotkeys.press('Alt+ArrowUp');
            await app.hotkeys.expectFocusedSegment(0);
        });

        await test.step('adds a LaTeX segment under the current one with Ctrl+Shift+L', async () => {
            await app.hotkeys.addLatexSegmentBelow();
            await app.editor.expectSegmentCount(3);
            await app.editor.expectSegmentType(newSegment, 'Latex');
            await app.hotkeys.expectFocusedSegment(newSegment);
            await app.editor.typeInFocusedSegment(NEW_SEGMENT_TEXT);
            await app.editor.expectSegmentContainsText(
                newSegment,
                NEW_SEGMENT_TEXT
            );
        });

        await test.step('builds the project with Ctrl+Enter', async () => {
            await app.editor.waitForSaved();
            await app.compilation.runWithKeys(
                await app.hotkeys.withMod('Enter')
            );
            await app.results.expectPdfTextContains(NEW_SEGMENT_TEXT);
        });

        await test.step('builds again with Ctrl+S after one more word', async () => {
            await app.editor.appendToSegment(newSegment, APPENDED_WORD);
            await app.compilation.runWithKeys(
                await app.hotkeys.withMod('KeyS')
            );
            await app.results.expectPdfTextContains(
                `${NEW_SEGMENT_TEXT}${APPENDED_WORD}`
            );
        });

        await test.step('goes from a source line to the PDF with Ctrl+Alt+J', async () => {
            await app.results.scrollPdfToTop();
            await app.editor.selectSegmentLine(syncSegment, 1);
            await app.hotkeys.syncToPdf();
            await app.results.expectPdfScrolledToText('sync target');
        });

        await test.step('goes from a PDF place back to the source with Ctrl+Alt+K', async () => {
            await app.results.selectPdfText('sync target');
            const target = await app.hotkeys.syncToSource();
            test.expect(target.segmentId).toBe(syncSegment + 1);
            await app.editor.expectCursorNearSegmentLine(syncSegment, 1);
        });

        await test.step('keeps the PDF and lists the problem of a LaTeX error', async () => {
            await app.editor.appendToSegment(newSegment, LATEX_ERROR);
            await app.editor.waitForSaved();
            await app.compilation.runWithKeys(
                await app.hotkeys.withMod('Enter'),
                203
            );
            await app.results.expectPdf();
            await app.results.expectCompilationError(
                /Undefined control sequence|\\test/
            );
        });

        await test.step('sends the errors to the agent with Ctrl+.', async () => {
            await app.hotkeys.sendErrorsToAgent();
            await app.hotkeys.expectAgentTabShown();
            await app.hotkeys.expectAgentPromptStartingWith(
                'Fix the compilation errors:'
            );
        });

        await test.step('opens the final document with Ctrl+Alt+P', async () => {
            await app.hotkeys.showFinalDocument();
            await app.hotkeys.expectFinalDocumentShown();
        });

        await test.step('removes the error and builds without problems', async () => {
            await app.editor.deleteCharactersFromEnd(
                newSegment,
                LATEX_ERROR.length
            );
            await app.editor.waitForSaved();
            await app.compilation.runWithKeys(
                await app.hotkeys.withMod('Enter')
            );
            await app.results.expectPdf();
            await app.results.expectProblemCount(0);
        });

        await test.step('undoes two edits with Ctrl+Z and brings them back with Ctrl+Y', async () => {
            const original = await app.editor.readSegmentText(newSegment);
            await app.editor.appendToSegment(newSegment, FIRST_EDIT);
            await app.editor.waitForSaved();
            await app.editor.appendToSegment(newSegment, SECOND_EDIT);
            await app.editor.waitForSaved();

            await app.hotkeys.undo();
            await app.editor.expectSegmentTexts([
                FIRST_SEGMENT,
                `${original}${FIRST_EDIT}`,
                SECOND_SEGMENT,
            ]);
            await app.hotkeys.undo();
            await app.editor.expectSegmentTexts([
                FIRST_SEGMENT,
                original,
                SECOND_SEGMENT,
            ]);
            await app.hotkeys.redo();
            await app.editor.expectSegmentTexts([
                FIRST_SEGMENT,
                `${original}${FIRST_EDIT}`,
                SECOND_SEGMENT,
            ]);
            await app.hotkeys.redo();
            await app.editor.expectSegmentTexts([
                FIRST_SEGMENT,
                `${original}${FIRST_EDIT}${SECOND_EDIT}`,
                SECOND_SEGMENT,
            ]);
        });
    });
});
