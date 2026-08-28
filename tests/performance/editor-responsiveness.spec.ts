import { test } from '../fixtures';

test.use({ trace: 'off', video: 'off' });

test.describe('Editor responsiveness', () => {
    test.describe.configure({ timeout: 5 * 60_000 });

    test('edits a 1000-line segment without UI stalls @authenticated @performance', async ({
        app,
    }) => {
        await app.openAuthenticatedEditor();
        const project = await app.projects.createManagedProject(
            'perf-segment',
            'Markdown'
        );

        await app.performance.expectLongSegmentEditingResponsive(project.id);
    });

    test('edits a 1000-line file without UI stalls @authenticated @performance', async ({
        app,
    }) => {
        await app.openAuthenticatedEditor();
        await app.projects.createManagedProject('perf-file', 'Markdown');

        await app.performance.expectLongFileEditingResponsive();
    });

    test('scrolls and edits 100 segments without UI stalls @authenticated @performance', async ({
        app,
    }) => {
        await app.openAuthenticatedEditor();
        const project = await app.projects.createManagedProject(
            'perf-segments',
            'Markdown'
        );

        await app.performance.expectManySegmentsResponsive(project.id);
    });

    test('handles sustained key input in segment and file editors @authenticated @performance', async ({
        app,
    }) => {
        await app.openAuthenticatedEditor();
        await app.projects.createManagedProject('perf-held-key', 'Markdown');

        await app.performance.expectHeldKeyInputResponsive();
    });
});
