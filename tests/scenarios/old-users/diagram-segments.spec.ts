import { test } from '../../fixtures';

const MERMAID = `flowchart LR
    A[Старт] --> B[Готово]`;
const PLANTUML = 'Alice -> Bob: привет';
const DRAWIO = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="2" value="Схема" style="rounded=1;whiteSpace=wrap;" vertex="1" parent="1"><mxGeometry x="20" y="20" width="160" height="60" as="geometry"/></mxCell></root></mxGraphModel>`;
const NOT_A_DIAGRAM = 'не схема';
const BAD_DRAWIO_XML =
    'This is not draw.io diagram XML: mxfile or mxGraphModel is expected';

// Segments of the Markdown project after the computation and the text
const MERMAID_SEGMENT = 2;
const DRAWIO_SEGMENT = 4;
// Diagrams of the final document in the same order
const MERMAID_DIAGRAM = 0;
const PLANTUML_DIAGRAM = 1;
const DRAWIO_DIAGRAM = 2;

test.describe('Old user diagram scenarios', () => {
    test('adds Mermaid, PlantUML and draw.io segments to Markdown and LaTeX projects @authenticated @scenario', async ({
        app,
    }) => {
        test.setTimeout(10 * 60_000);

        await test.step('creates a Markdown project from My projects', async () => {
            await app.openAuthenticatedEditor();
            await app.projects.createManagedProject(
                'diagram-markdown',
                'Markdown'
            );
            await app.editor.expectSegmentCount(0);
        });

        await test.step('finds the diagram segments in the Add menu', async () => {
            await app.editor.expectAddSegmentOptions([
                'Mermaid',
                'PlantUML',
                'draw.io',
            ]);
        });

        await test.step('adds a computation, a text and three diagrams', async () => {
            await app.editor.addSegment('Computation', 'a = 1');
            await app.editor.addSegment('Markdown', 'Схемы ниже');
            await app.editor.addSegment('Mermaid', MERMAID);
            await app.editor.addSegment('PlantUML', PLANTUML);
            await app.editor.addSegment('draw.io', DRAWIO);
            await app.editor.expectSegmentCount(5);
            await app.editor.waitForSaved();
        });

        await test.step('runs the project and sees every diagram drawn', async () => {
            await app.compilation.runSuccessfully();
            await app.results.expectResultTextContains('a = 1');
            await app.results.expectMarkdownText('Схемы ниже');
            await app.results.expectDiagramText(MERMAID_DIAGRAM, [
                'Старт',
                'Готово',
            ]);
            await app.results.expectDiagramText(PLANTUML_DIAGRAM, ['привет']);
            await app.results.expectDiagramText(DRAWIO_DIAGRAM, ['Схема']);
        });

        await test.step('shows a diagram error for a Mermaid source that is not a diagram', async () => {
            await app.editor.fillSegment(MERMAID_SEGMENT, NOT_A_DIAGRAM);
            await app.editor.waitForSaved();
            await app.compilation.runSuccessfully();
            await app.results.expectDiagramError(MERMAID_DIAGRAM);
            await app.editor.expectSegmentContainsText(
                MERMAID_SEGMENT,
                NOT_A_DIAGRAM
            );
            await app.results.expectDiagramText(PLANTUML_DIAGRAM, ['привет']);
            await app.results.expectDiagramText(DRAWIO_DIAGRAM, ['Схема']);
        });

        await test.step('explains a draw.io source that is not diagram XML', async () => {
            await app.editor.fillSegment(DRAWIO_SEGMENT, NOT_A_DIAGRAM);
            await app.editor.waitForSaved();
            await app.compilation.runSuccessfully();
            await app.results.expectDiagramError(
                DRAWIO_DIAGRAM,
                BAD_DRAWIO_XML
            );
        });

        await test.step('draws the draw.io diagram again from the XML', async () => {
            await app.editor.fillSegment(DRAWIO_SEGMENT, DRAWIO);
            await app.editor.waitForSaved();
            await app.compilation.runSuccessfully();
            await app.results.expectDiagramText(DRAWIO_DIAGRAM, ['Схема']);
        });

        await test.step('creates a LaTeX project with a Mermaid segment', async () => {
            await app.projects.openListFromProject();
            await app.projects.createManagedProject('diagram-latex', 'LaTeX');
            await app.editor.addSegment('Mermaid', MERMAID);
            await app.editor.waitForSaved();
        });

        await test.step('compiles the LaTeX project and sees the diagram in the PDF', async () => {
            const pdfUri = await app.compilation.runPdfSuccessfully();
            // The server puts the diagram into the PDF as a picture, so its labels are not text and only the drawing is checked
            await app.results.expectPdfLoadedFrom(pdfUri);
            await app.results.expectPdfPageDrawing(1);
        });
    });
});
