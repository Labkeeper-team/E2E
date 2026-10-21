import { expect } from '@playwright/test';
import { test } from '../../fixtures';
import { landingTestsEnabled } from '../../input';
import type { AutomaticCompilation } from '../../dsl/compilation.dsl';

const INTERVAL_ARTICLE = {
    slug: 'student-confidence-intervals-error-calculation',
    title: 'Расчет и оформление доверительных интервалов (погрешности Стьюдента)',
};
const MARKUP_ARTICLE = {
    slug: 'word-formatting-issues-diploma-lightweight-markup-alternative',
    title: 'Съезжает верстка в Word при написании диплома? Переходим на легковесную разметку',
};
const MEASUREMENTS = '9.8, 9.8, 10.2, 10.6, 10.6';
// The changed measurement keeps the rest, so the new interval differs from the first one
const CHANGED_MEASUREMENTS = '9.0, 9.8, 10.2, 10.6, 10.6';

// The interval the example prints: mean ± t·s/√n over the measurements of the computation segment
function expectedInterval(computation: string): [number, number] {
    const values = (computation.match(/x = \[([^\]]+)\]/)?.[1] ?? '')
        .split(',')
        .map(Number);
    const t = Number(computation.match(/^t = ([\d.]+)$/m)?.[1]);
    const n = values.length;
    const mean = values.reduce((sum, value) => sum + value, 0) / n;
    const s = Math.sqrt(
        values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1)
    );
    const delta = (t * s) / Math.sqrt(n);
    return [mean - delta, mean + delta];
}

// The calculator keeps three significant digits and goes on from the rounded values: a mean of 10.04 prints as 10
// and its upper bound as 10 + 0.834 = 10.8 instead of 10.87, so the PDF matches the formula only to a tenth
const PRINTED_PRECISION = 0.1;

// The PDF text layer splits formulas into glyphs, so the interval is read with the spaces removed
function intervalInPdf(text: string): [number, number] | undefined {
    const match = text
        .replace(/\s+/g, '')
        .match(/Interval:\[(-?\d+(?:\.\d+)?);(-?\d+(?:\.\d+)?)\]/);
    return match ? [Number(match[1]), Number(match[2])] : undefined;
}

function expectSameInterval(
    actual: [number, number] | undefined,
    expected: [number, number]
): void {
    expect(actual, 'The PDF shows no confidence interval').toBeDefined();
    const [low, high] = actual as [number, number];
    expect(Math.abs(low - expected[0])).toBeLessThanOrEqual(PRINTED_PRECISION);
    expect(Math.abs(high - expected[1])).toBeLessThanOrEqual(PRINTED_PRECISION);
}

function endsOnLoginRequest(compilation: AutomaticCompilation): boolean {
    if (compilation.outcome !== 'loginRequired') {
        return false;
    }
    test.info().annotations.push({
        type: 'anonymous limit',
        description: 'reached, the scenario ended on the login request',
    });
    return true;
}

test.describe('New user blog example scenarios', () => {
    // The landing and the blog come from production alone
    test.skip(
        () => !landingTestsEnabled,
        'Landing scenarios need ENABLE_LANDING_TESTS'
    );

    test('opens blog examples in the editor and compiles them as a guest @anonymous @scenario', async ({
        app,
    }) => {
        test.setTimeout(10 * 60_000);
        // Opening an example compiles it as a guest, and access.spec spends the same per-address limit in every profile
        const profileNames = test
            .info()
            .config.projects.map((project) => project.name);
        const guestProfile = profileNames.at(-1);
        test.skip(
            test.info().project.name !== guestProfile,
            `Guest compilations run only in ${guestProfile} to keep the anonymous limit`
        );

        let computationIndex = -1;
        let firstInterval: [number, number] | undefined;

        await test.step('finds the knowledge base on the landing and opens the blog', async () => {
            await app.landing.open();
            await app.landing.declineCookies();
            await app.landing.openKnowledgeBase();
            await app.landing.openAllArticles();
        });

        let compilation: AutomaticCompilation = { outcome: 'markdown' };
        await test.step('opens the confidence interval example in the editor', async () => {
            await app.landing.openArticle(
                INTERVAL_ARTICLE.slug,
                INTERVAL_ARTICLE.title
            );
            const startup = app.compilation.waitForAutomaticCompilation();
            const example = await app.landing.openArticleExample();
            expect(example.open).toBe('latex');

            await app.editor.expectLatexBoundaryCards();
            await app.editor.expectSegmentCount(2);
            computationIndex = 0;
            await app.editor.expectSegmentType(computationIndex, 'Computation');
            await app.editor.expectSegmentContainsText(
                computationIndex,
                example.compute as string
            );
            await app.editor.expectSegmentContainsText(
                computationIndex,
                `x = [${MEASUREMENTS}]`
            );
            await app.editor.expectSegmentType(1, 'Latex');
            await app.editor.expectSegmentContainsText(
                1,
                example.latex as string
            );
            compilation = await startup;
        });
        if (endsOnLoginRequest(compilation)) {
            return;
        }

        await test.step('shows the confidence interval of the five measurements in the PDF', async () => {
            expect(compilation.outcome).toBe('pdf');
            await app.results.expectPdfFrom(
                (compilation as { pdfUri: string }).pdfUri
            );
            const computation =
                await app.editor.readSegmentText(computationIndex);
            firstInterval = intervalInPdf(await app.results.readPdfText());
            expectSameInterval(firstInterval, expectedInterval(computation));
        });

        await test.step('changes a measurement and gets the interval recalculated', async () => {
            const computation =
                await app.editor.readSegmentText(computationIndex);
            const changed = computation.replace(
                `x = [${MEASUREMENTS}]`,
                `x = [${CHANGED_MEASUREMENTS}]`
            );
            await app.editor.fillSegment(computationIndex, changed);
            const result = await app.compilation.runPdfAsGuest();
            if (result.outcome === 'loginRequired') {
                endsOnLoginRequest(result);
                return;
            }
            await app.results.expectPdfFrom(result.pdfUri);
            const interval = intervalInPdf(await app.results.readPdfText());
            expectSameInterval(interval, expectedInterval(changed));
            expect(interval).not.toEqual(firstInterval);
        });

        await test.step('opens the markup example from the blog', async () => {
            await app.landing.openBlog();
            await app.landing.openArticle(
                MARKUP_ARTICLE.slug,
                MARKUP_ARTICLE.title
            );
            const startup = app.compilation.waitForAutomaticCompilation();
            const example = await app.landing.openArticleExample();
            // This link opens a Markdown project with one segment, unlike the scenario text that expects a LaTeX segment and a PDF
            expect(example.open).toBe('markdown');

            await app.editor.expectSegmentCount(1);
            await app.editor.expectSegmentType(0, 'Markdown');
            await app.editor.expectSegmentContainsText(
                0,
                example.markdown as string
            );
            await app.editor.expectSegmentContainsText(0, '## Введение');
            // The guest's previous example is replaced, so its measurements are gone
            expect(await app.editor.readSegmentText(0)).not.toContain(
                MEASUREMENTS
            );
            compilation = await startup;
        });
        if (endsOnLoginRequest(compilation)) {
            return;
        }

        await test.step('shows the introduction of the markup example in the final document', async () => {
            expect(compilation.outcome).toBe('markdown');
            await app.results.expectMarkdownText('Введение');
        });
    });
});
