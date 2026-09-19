import { test } from '../../fixtures';
import {
    input,
    landingTestsEnabled,
    requireUserCredentials,
} from '../../input';

// Each guest run spends the shared daily anonymous limit, so the scenario stops after a few of them
const GUEST_RUNS = 3;
// access.spec needs the same per-address limit in every profile, so the guest runs happen in one of them
const GUEST_COMPILATION_PROFILE = 'Google Chrome';
// Other LaTeX examples include project files, which a guest compilation cannot read
const GUEST_COMPILABLE_CATEGORY = 'diploma';
const LOGIN_REQUIRED_PROBLEM = 'Login is required to proceed';

test.describe('New user LaTeX preview scenarios', () => {
    // The landing comes from production alone, so a stand serving the editor bundle on / never reaches it
    test.skip(
        () => !landingTestsEnabled,
        'Landing scenarios need ENABLE_LANDING_TESTS'
    );

    test('compiles a LaTeX example as a guest, logs in and compiles its clone @authenticated @scenario', async ({
        app,
    }) => {
        test.setTimeout(10 * 60_000);
        // The login form of the modal asks for a captcha exactly like registration does
        test.skip(
            !input.captchaBypassToken,
            'Logging in from the example needs E2E_CAPTCHA_BYPASS_TOKEN'
        );

        const user = requireUserCredentials();
        let exampleId = '';
        let guestCompilations = 0;
        let guestLimitReached = false;
        let cloneName = '';

        await test.step('opens a LaTeX example from the landing examples', async () => {
            const examples = await app.landing.open();
            await app.landing.declineCookies();
            await app.landing.openExamples();
            exampleId = (
                await app.landing.chooseLatexExample(
                    examples,
                    GUEST_COMPILABLE_CATEGORY
                )
            ).id;
            await app.landing.clickExample(exampleId);
            await app.navigation.openEditor(`/project/${exampleId}`);
            await app.editor.expectReadOnlyPublicProject();
        });

        const runsAsGuest =
            test.info().project.name === GUEST_COMPILATION_PROFILE;

        await test.step('compiles the example as a guest several times', async () => {
            if (!runsAsGuest) {
                test.info().annotations.push({
                    type: 'guest compilations',
                    description: `checked only in ${GUEST_COMPILATION_PROFILE} to keep the anonymous limit`,
                });
                return;
            }
            while (guestCompilations < GUEST_RUNS) {
                const result = await app.compilation.runPdfAsGuest();
                if (result.outcome === 'loginRequired') {
                    guestLimitReached = true;
                    break;
                }
                await app.results.expectPdfFrom(result.pdfUri);
                guestCompilations += 1;
            }

            test.info().annotations.push({
                type: 'guest compilations',
                description: guestLimitReached
                    ? `${guestCompilations} compiled before the anonymous limit`
                    : `${guestCompilations} compiled, the anonymous limit was not reached`,
            });
        });

        await test.step('asks the guest to log in after the run limit', async () => {
            if (!guestLimitReached) {
                test.info().annotations.push({
                    type: 'anonymous limit',
                    description:
                        'not reached, the login prompt after runs was not checked',
                });
                return;
            }
            await app.auth.expectLoginRequired();
            await app.results.expectCompilationError(LOGIN_REQUIRED_PROBLEM);
            await app.auth.closeAuthModal();
        });

        await test.step('asks the guest to log in before cloning', async () => {
            await app.editor.requestCloneAsGuest();
            await app.auth.expectLoginRequired();
        });

        await test.step('logs in with the test account in the same modal', async () => {
            await app.auth.loginInOpenAuthModal(user);
            const privacyPolicyShown =
                await app.auth.acceptPrivacyPolicyIfShown();
            test.info().annotations.push({
                type: 'privacy policy',
                description: privacyPolicyShown
                    ? 'a new version was accepted in the modal after the login'
                    : 'the test account had accepted it before the run',
            });
        });

        await test.step('returns to the example and clones it', async () => {
            await app.navigation.openEditor(`/project/${exampleId}`);
            await app.editor.expectReadOnlyPublicProject();
            await app.projects.cloneOpenedProject(user);
            await app.editor.expectOwnEditableProject();
            // The clone keeps the example title, which matches several rows in the list of a permanent account
            cloneName = app.projects.uniqueProjectName('preview-clone');
            await app.editor.renameProjectWithEnter(cloneName);
        });

        await test.step('compiles the cloned project', async () => {
            const pdfUri = await app.compilation.runPdfSuccessfully();
            await app.results.expectPdfFrom(pdfUri);
        });

        await test.step('finds the clone in My projects', async () => {
            await app.projects.openListFromProject();
            await app.projects.expectProjectInCurrentList(cloneName);
        });
    });
});
