import { test } from '../fixtures';
import { secondUserCredentials } from '../input';

test.describe('Scenarios requiring additional production conditions', () => {
    test('error-test-quota @conditional', async () => {
        test.skip(
            true,
            'A safe deterministic quota fixture is not available on production'
        );
    });

    test('425-display @conditional', async () => {
        test.skip(
            true,
            'HTTP 425 depends on an accumulated anonymous limit and is not idempotent'
        );
    });

    test('default-project-401-test @conditional', async () => {
        test.skip(
            true,
            'Production opens the default project anonymously after the session is removed'
        );
    });

    test('phystech-icon-test @conditional', async () => {
        test.skip(true, 'A dedicated phystech.edu account is required');
    });

    test('llm-prompt-ok-request-test @conditional', async () => {
        test.skip(
            true,
            'Token spending and a rule for nondeterministic output must be approved'
        );
    });

    test('llm-prompt-bad-request-test @conditional', async () => {
        test.skip(
            true,
            'No real prompt that deterministically returns HTTP 400 is documented'
        );
    });

    test('compilation-500-test @conditional', async () => {
        test.skip(
            true,
            'Production cannot be safely forced to return HTTP 500 without a stub'
        );
    });

    test('oauth2-code-offline-provider @conditional', async () => {
        test.skip(
            true,
            'The source scenario requires aborting the provider request'
        );
    });

    test('public-project-different-user-compilation-ok @conditional', async ({
        app,
    }) => {
        const secondUser = secondUserCredentials();
        test.skip(!secondUser, 'A second production account is required');

        if (!secondUser) {
            return;
        }

        await app.openAuthenticatedEditor();
        const project = await app.projects.createManagedProject(
            'public-second-user',
            'Markdown'
        );
        await app.editor.addSegment('Computation', 'a = 10');
        await app.compilation.runSuccessfully();
        await app.editor.setPublicAccess(true);

        await app.auth.logout();
        await app.navigation.openEditor(project.path);
        await app.auth.login(secondUser);
        await app.navigation.openEditor(project.path);
        await app.editor.expectReadOnlyPublicProject();
        await app.compilation.runSuccessfully();
        await app.auth.logout(secondUser);
    });
});
