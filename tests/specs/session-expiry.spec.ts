import { test } from '../fixtures';

test.describe('Real expired sessions', () => {
    test('denies a private project after the session expires @authenticated', async ({
        app,
    }) => {
        await app.openAuthenticatedEditor();
        const project = await app.projects.createManagedProject(
            'expired-project'
        );
        await app.auth.expireSession();
        await app.navigation.openPath(project.path);
        await app.auth.expectLoggedOut();
        await app.access.expectAccessDenied();
    });

    test('handles an expired session during compilation @authenticated @conditional', async ({
        app,
    }) => {
        await app.openAuthenticatedEditor();
        await app.projects.createManagedProject(
            'expired-compilation',
            'Markdown'
        );
        await app.editor.addSegment('Computation', 'a = 10');
        await app.editor.waitForSaved();

        await app.auth.expireSession();
        await app.compilation.runWithExpiredSession();
        await app.access.expectSessionExpired();
    });

    test('handles an expired session in the file manager @authenticated', async ({
        app,
    }) => {
        await app.openAuthenticatedEditor();
        await app.projects.createManagedProject('expired-files');
        await app.files.open();

        await app.auth.expireSession();
        await app.files.uploadFileWithExpiredSession();
    });
});
