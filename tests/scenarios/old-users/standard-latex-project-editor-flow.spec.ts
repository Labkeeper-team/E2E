import { test } from '../../fixtures';

const INITIAL_LATEX_BODY = String.raw`\pagestyle{empty}
hello`;

const NAVIGATION_LATEX_BODY = String.raw`\pagestyle{empty}
hello
\newpage
content before the marker
\section*{sync target}
content after the sync target
\vfill
end of the document`;

const LATEX_FILE_CONTENTS = String.raw`\section{File editor}
Text saved from the project file editor.`;

const LATEX_ERROR = '\n\\test';

test.describe('Old user LaTeX scenarios', () => {
    test('completes the standard LaTeX project editor flow @authenticated @scenario', async ({
        app,
    }) => {
        test.setTimeout(10 * 60_000);

        let projectName = '';
        let bodySegment = 0;

        await test.step('opens a managed LaTeX project from My projects', async () => {
            await app.openAuthenticatedEditor();
            const project = await app.projects.createManagedProject(
                'standard-latex-flow',
                'LaTeX'
            );
            projectName = project.name;
            await app.projects.openProjectFromList(projectName);
        });

        await test.step('creates a LaTeX body and converts header and footer cards into segments', async () => {
            await app.editor.expectSegmentCount(0);
            bodySegment = await app.editor.addSegment(
                'Latex',
                INITIAL_LATEX_BODY
            );
            await app.editor.expectLatexBoundaryCards();
            await app.editor.insertLatexHeader();
            bodySegment += 1;
            await app.editor.insertLatexFooter();
            await app.editor.expectSegmentCount(3);
            await app.editor.waitForSaved();
        });

        await test.step('creates, renames and edits a LaTeX file with syntax highlighting', async () => {
            await app.files.open();
            await app.files.createFile();
            await app.files.renameFile('new.txt', 'document.tex');
            await app.files.openTextFile('document.tex');
            await app.files.editOpenTextFile(LATEX_FILE_CONTENTS);
            await app.files.expectLatexSyntaxHighlighting();
            await app.files.closeTextFile();
        });

        await test.step('creates a folder and a file inside it', async () => {
            await app.files.createFolder('scenario-folder');
            await app.files.createFile();
            await app.files.expectFileInFolder('scenario-folder', 'new.txt');
            await app.files.closeTextFile();
        });

        await test.step('uploads a file by dragging it into the file manager', async () => {
            await app.files.selectRootFolder();
            await app.files.dragTextFileToRoot(
                'dragged-file.txt',
                'uploaded through a drag and drop event'
            );
            await app.files.expectFile('dragged-file.txt');
        });

        await test.step('renames and deletes a non-empty folder', async () => {
            await app.files.renameFolder(
                'scenario-folder',
                'renamed-scenario-folder'
            );
            await app.files.expectFileInFolder(
                'renamed-scenario-folder',
                'new.txt'
            );
            await app.files.deleteFolder('renamed-scenario-folder');
            await app.files.expectFileMissing('new.txt');
            await app.files.close();
        });

        await test.step('compiles and verifies the PDF text and page snapshots', async () => {
            await app.compilation.runSuccessfully();
            await app.results.expectPdfText('hello');
            await app.results.matchPdfTextSnapshot(
                'standard-latex-initial.txt'
            );
            await app.results.matchPdfPageSnapshot(
                1,
                'standard-latex-initial.png'
            );
        });

        await test.step('keeps the PDF visible and reports a LaTeX error', async () => {
            await app.editor.fillSegment(
                bodySegment,
                NAVIGATION_LATEX_BODY
            );
            await app.editor.appendToSegment(bodySegment, LATEX_ERROR);
            await app.editor.waitForSaved();
            await app.compilation.runWithCompilationErrors();
            await app.results.expectPdf();
            await app.results.expectPdfTextContains('hello');
            await app.results.expectAnyCompilationError();
            await app.results.expectCompilationError(
                /Undefined control sequence|\\test/
            );
        });

        await test.step('removes the error and recompiles without problems', async () => {
            await app.editor.deleteCharactersFromEnd(
                bodySegment,
                LATEX_ERROR.length
            );
            await app.editor.waitForSaved();
            await app.compilation.runSuccessfully();
            await app.results.expectPdfTextContains('sync target');
            await app.results.expectProblemCount(0);
            await app.results.closeProblemsWithEscape();
        });

        await test.step('navigates from the selected source line to its PDF position', async () => {
            await app.results.scrollPdfToTop();
            await app.editor.selectSegmentLine(bodySegment, 5);
            await app.editor.navigateSelectionToPdf();
            await app.results.expectPdfScrolledToText('sync target');
        });

        await test.step('navigates from the selected PDF position back to the source line', async () => {
            await app.results.selectPdfText('sync target');
            await app.editor.navigatePdfSelectionToSource({
                segmentIndex: bodySegment,
                line: 5,
            });
            await app.editor.expectCursorNearSegmentLine(bodySegment, 5);
        });
    });
});
