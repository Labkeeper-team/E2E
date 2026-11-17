import { expect } from '@playwright/test';
import type { TemplateCard } from '../dsl/landing.dsl';
import { test } from '../fixtures';
import { landingTestsEnabled } from '../input';

// The first line of an assertion error names what failed; the rest is the call log
const shortError = (error: unknown): string =>
    String(error instanceof Error ? error.message : error)
        .replace(/\u001b\[[0-9;]*m/g, '')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 3)
        .join(' ');

test.describe('Template catalog', () => {
    // The catalog lives on the production landing alone
    test.skip(
        () => !landingTestsEnabled,
        'Landing scenarios need ENABLE_LANDING_TESTS'
    );

    // GH-265: a manual run on 14.11.2026 found 5 of 41 templates that do not compile
    test('every template from /templates compiles for a logged-in user @authenticated', async ({
        app,
    }) => {
        // Every run spends tokens of the test account, so one browser checks the catalog
        const catalogProfile = test.info().config.projects[0]?.name;
        test.skip(
            test.info().project.name !== catalogProfile,
            `The catalog compiles only in ${catalogProfile} to spare the tokens`
        );
        test.setTimeout(60 * 60_000);

        let templates: TemplateCard[] = [];
        await test.step('reads the template catalog from the page', async () => {
            await app.landing.open();
            await app.landing.declineCookies();
            // The editor takes the site language, and its steps below read English labels
            await app.landing.chooseLanguage('en');
            await app.landing.openTemplates();
            templates = await app.landing.listTemplates();
            expect(templates.length).toBeGreaterThan(0);
        });

        await test.step('logs in with the test account', async () => {
            await app.openAuthenticatedEditor();
        });

        // A failing template must not hide the others, so each runs in its own step and the list goes to the end
        const failed: string[] = [];
        for (const template of templates) {
            const name = `${template.slug} «${template.title}»`;
            try {
                await test.step(`runs the template ${name}`, async () => {
                    await app.navigation.openEditor(
                        `/project/${template.projectId}`
                    );
                    await app.editor.expectReadOnlyPublicProject();
                    if (await app.compilation.hasSomethingToRun()) {
                        await app.compilation.runSuccessfully();
                        await app.results.expectProblemCount(0);
                    } else {
                        await app.results.expectMarkdownPreview();
                    }
                });
            } catch (error) {
                failed.push(`${name}: ${shortError(error)}`);
            }
        }

        test.info().annotations.push({
            type: 'templates',
            description: `${templates.length - failed.length} of ${templates.length} compiled`,
        });
        expect(failed, 'Templates that do not compile').toEqual([]);
    });
});
