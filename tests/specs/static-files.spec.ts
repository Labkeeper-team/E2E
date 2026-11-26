import { test } from '../fixtures';
import { landingTestsEnabled } from '../input';

test.describe('Static files', () => {
    // The headers come from the production server; the local stand and the editor job serve the build through their own nginx
    test.skip(
        () => !landingTestsEnabled,
        'Landing scenarios need ENABLE_LANDING_TESTS'
    );

    // GH-285: every full load of the editor downloaded about 10 MB without compression and cache
    test('the site and the editor come compressed, and the editor build stays in the cache @anonymous', async ({
        app,
    }) => {
        const checkingProfile = test.info().config.projects[0]?.name;
        test.skip(
            test.info().project.name !== checkingProfile,
            `Headers do not depend on the browser, so only ${checkingProfile} checks them`
        );

        app.staticFiles.startRecording();
        await test.step('opens the landing', async () => {
            await app.landing.open();
        });
        await test.step('opens the editor', async () => {
            await app.openAnonymousEditor();
        });
        await test.step('checks compression and caching of every file', async () => {
            await app.staticFiles.expectCachedAndCompressed();
        });
        await test.step('opens the editor in a second tab from the cache', async () => {
            await app.staticFiles.expectEditorReopensFromCache();
        });
    });
});
