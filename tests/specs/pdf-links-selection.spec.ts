import { test } from '../fixtures';
import { input } from '../input';

const EXTERNAL_LINK_TEXT = 'Open the project list';
const INTERNAL_LINK_TEXT = 'Go to the second page';
const SECOND_PAGE_TEXT = 'Second page target';
// Close to the full text width, so a text layer drawn wider than the glyphs leaves the page before this line ends
const SELECTED_LINE =
    'Middle line of the selected paragraph runs on with plain words until it nearly fills the page width';
// The external link stays on the tested host, so following it never leads to a third-party site
const EXTERNAL_URL = `${input.host}/projects`;

// The editor header template plus hyperref, which new projects do not load, so the PDF has link annotations like a user's document
const DOCUMENT = String.raw`\documentclass[a4paper,12pt]{article}
\usepackage{comment,cmap,amsmath,longtable,mathtools}
\usepackage{booktabs,geometry,graphicx,listings}
\usepackage[T2A]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage[english,russian]{babel}
\geometry{a4paper,top=3mm,right=5mm,bottom=3mm,left=5mm}
\setcounter{secnumdepth}{0}
\mathtoolsset{showonlyrefs}
\newcounter{none}
\usepackage{hyperref}
\begin{document}
\pagestyle{empty}
\noindent\href{${EXTERNAL_URL}}{${EXTERNAL_LINK_TEXT}}

\noindent\hyperlink{e2e-link-target}{${INTERNAL_LINK_TEXT}}

\noindent First line of the selected paragraph\\
${SELECTED_LINE}\\
Last line of the selected paragraph

\newpage
\noindent\hypertarget{e2e-link-target}{${SECOND_PAGE_TEXT}}
\end{document}`;

test.describe('PDF links and text selection', () => {
    test.beforeEach(async ({ app }) => {
        await app.openAuthenticatedEditor();
        const project = await app.projects.createManagedProject(
            'pdf-links-selection',
            'LaTeX'
        );
        await app.projects.replaceManagedProjectProgram(project.id, [
            { type: 'latex', text: DOCUMENT },
        ]);
        await app.navigation.reload();
        await app.editor.expectSegmentCount(1);
        await app.editor.waitForSaved();
        await app.compilation.runSuccessfully();
        await app.results.expectPdfTextContains(SECOND_PAGE_TEXT);
    });

    test('follows internal and external links of a PDF @authenticated', async ({
        app,
    }) => {
        await app.results.scrollPdfToTop();
        await app.results.followPdfLink(INTERNAL_LINK_TEXT);
        await app.results.expectPdfScrolledToText(SECOND_PAGE_TEXT);

        await app.results.scrollPdfToTop();
        await app.results.expectPdfLinkOpensTab(
            EXTERNAL_LINK_TEXT,
            EXTERNAL_URL
        );
    });

    test('selects one line of a PDF paragraph by dragging along it @authenticated', async ({
        app,
    }) => {
        await app.results.dragAlongPdfLine(SELECTED_LINE);
        await app.results.expectPdfSelection(SELECTED_LINE);
    });
});
