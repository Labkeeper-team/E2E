import { test } from '../../fixtures';
import { agentTestsEnabled } from '../../input';

const DOCUMENT_BODY = String.raw`\pagestyle{empty}
\section*{Введение}
Этот документ дописывает агент.`;
const SECTION_TITLE = 'Проверка агента';
const SECTION_PROMPT = `Допиши в конец документа короткий раздел «${SECTION_TITLE}» из одного предложения и собери документ. Больше ничего не меняй.`;
const TYPED_WORDS = 'Вот картинка.';
const PICTURE_NAME = 'agent-picture.png';
// A 4×4 red square, small enough for any upload limit
const PICTURE = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGO4IycHRwzEcQDTIxGBFNCZswAAAABJRU5ErkJggg==',
    'base64'
);
const SHORT_PROMPT =
    'Ничего не меняй в документе, просто ответь одним словом: готово.';

test.describe('Old user agent mode scenarios', () => {
    // Every request to the agent is paid from the test account
    test.skip(
        () => !agentTestsEnabled,
        'Agent scenarios spend tokens and need ENABLE_AGENT_TESTS'
    );

    test('builds a document in the agent mode @authenticated @scenario @agent', async ({
        app,
    }) => {
        test.setTimeout(40 * 60_000);
        // The agent mode of a phone is one screen at a time, and each profile would spend the same tokens again
        test.skip(
            test.info().project.use.isMobile === true,
            'The agent mode scenario describes the desktop layout'
        );

        await test.step('opens an own LaTeX project without agent requests from My projects', async () => {
            await app.openAuthenticatedEditor();
            const project = await app.projects.createManagedProject(
                'agent-mode',
                'LaTeX'
            );
            await app.projects.replaceManagedProjectProgram(project.id, [
                { type: 'latex', text: DOCUMENT_BODY },
            ]);
            await app.projects.openProjectFromList(project.name);
            await app.editor.expectSegmentCount(1);
        });

        await test.step('sees the first help slide on the agent tab', async () => {
            await app.agent.openAgentTab();
            await app.agent.expectHelpFirstSlide('Create your first document');
        });

        await test.step('switches to the agent mode', async () => {
            await app.agent.enterAgentMode();
        });

        await test.step('checks the agent settings', async () => {
            await app.agent.expectDefaultSettings();
            await app.agent.closeSettings();
        });

        await test.step('asks the agent for a short section and its build', async () => {
            await app.agent.typePrompt(SECTION_PROMPT);
            await app.agent.send();
            await app.agent.expectRunning();
            await app.agent.waitForAnswer();
        });

        await test.step('sees the agent steps with the edits and the build', async () => {
            await app.agent.expectSteps([
                'Calling the model',
                /segment|Added a|Changed a|Replaced lines/,
                /Building the document|Document built/,
                'Finishing up',
            ]);
        });

        await test.step('sees the new section in the final document', async () => {
            await app.results.expectPdfTextContains(SECTION_TITLE);
            await app.results.expectPdfScrolledToText(SECTION_TITLE);
        });

        await test.step('attaches a picture to a typed prompt', async () => {
            await app.agent.typePrompt(TYPED_WORDS);
            await app.agent.uploadFile(PICTURE_NAME, 'image/png', PICTURE);
            await app.agent.expectFileMentioned(TYPED_WORDS, PICTURE_NAME);
        });

        await test.step('sends it and finds the previous steps collapsed', async () => {
            await app.agent.send();
            await app.agent.waitForAnswer();
            await app.agent.expectStepsCollapsed(0);
            await app.agent.expandSteps(0);
        });

        await test.step('clears the history and asks not to confirm again', async () => {
            await app.agent.clearHistoryConfirmingOnce();
        });

        await test.step('clears the history of a new short request without the question', async () => {
            await app.agent.typePrompt(SHORT_PROMPT);
            await app.agent.send();
            await app.agent.waitForAnswer();
            await app.agent.clearHistoryWithoutConfirmation();
        });

        await test.step('opens the full code editor', async () => {
            await app.agent.leaveAgentMode();
        });

        // The agent mode gets its own accept and revert buttons with GH-189, until then the edits are accepted here
        await test.step('accepts all edits of the agent in the editor', async () => {
            const total = await app.agent.expectEditsWithButtons();
            test.expect(total).toBeGreaterThan(0);
            await app.agent.acceptAll();
            await app.editor.waitForSaved();
            await app.editor.expectAnySegmentContainsText(SECTION_TITLE);
        });
    });
});
