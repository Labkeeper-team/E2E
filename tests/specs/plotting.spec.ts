import { test } from '../fixtures';

const plots = [
    {
        title: 'renders a line plot',
        expectedTitle: 'Line plot',
        code: `plot(
    title="Line plot",
    x_1=[1, 2, 3, 4, 5],
    y_1=[1, 2, 1, 3, 1],
    type_1="line",
    color_1="red",
    name_1="MyLine"
)`,
    },
    {
        title: 'renders a dotted plot',
        expectedTitle: 'Dotted plot',
        code: `plot(
    title="Dotted plot",
    x_1=[1, 2, 3, 4, 5],
    y_1=[1, 2, 1, 3, 1],
    type_1="dotted",
    color_1="red"
)`,
    },
    {
        title: 'renders a scatter plot',
        expectedTitle: 'Scatter plot',
        code: `plot(
    title="Scatter plot",
    x_1=[1, 2, 3, 4, 5],
    y_1=[1, 2, 1, 3, 1],
    type_1="scatter",
    color_1="blue"
)`,
    },
    {
        title: 'renders a plot with grid',
        expectedTitle: 'Grid plot',
        verifyGrid: true,
        code: `plot(
    title="Grid plot",
    x_name="MyX",
    y_name="MyY",
    x_1=[1, 2, 3, 4, 5],
    y_1=[1, 2, 1, 3, 1],
    type_1="line"
)`,
    },
    {
        title: 'renders MathJax in a plot title',
        expectedTitle: /integrals/,
        code: `plot(
    title="\\int f(x) dx\\:integrals",
    x_1=[1, 2, 3, 4, 5],
    y_1=[1, 2, 1, 3, 1],
    type_1="line"
)`,
    },
    {
        title: 'renders several histograms',
        expectedTitle: 'Several histograms',
        code: `plot(
    title="Several histograms",
    x_1=[1], type_1="histogram", color_1="blue", size_1=1,
    x_2=[2, 2], type_2="histogram", color_2="red", size_2=1,
    x_3=[3, 3, 3], type_3="histogram", color_3="green", size_3=1,
    x_4=[4, 4, 4, 4], type_4="histogram", color_4="orange", size_4=1,
    x_5=[5, 5, 5, 5, 5], type_5="histogram", color_5="black", size_5=1
)`,
    },
    {
        title: 'renders a histogram with explicit heights',
        expectedTitle: 'Histogram bars',
        code: `plot(
    title="Histogram bars",
    x_1=[1, 2, 3, 4, 5],
    y_1=[1, 2, 3, 4, 5],
    type_1="histogram",
    color_1="blue"
)`,
    },
    {
        title: 'renders a histogram from a large sample',
        expectedTitle: 'Large histogram',
        code: `x = range(from=0, to=500, step=1)
x = x ^ 2 / 500 ^ 2
plot(title="Large histogram", x_1=x, type_1="histogram", size_1=25)`,
    },
    {
        title: 'renders a two-dimensional histogram',
        expectedTitle: 'Two dimensional histogram',
        code: `plot(
    title="Two dimensional histogram",
    x_1=[1, 2, 3, 4, 5, 6],
    y_1=[5, 4, 3, 2, 1, 0],
    type_1="histogram"
)`,
    },
    {
        title: 'renders a ladder histogram',
        expectedTitle: 'Ladder histogram',
        code: `plot(
    title="Ladder histogram",
    x_1=[1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    type_1="histogram"
)`,
    },
    {
        title: 'renders scatter errors',
        expectedTitle: 'Scatter errors',
        code: `x = [1, 2, 3, 4, 5] # 0.1
y = [1, 2, 1, 3, 1] # 0.1
plot(title="Scatter errors", x_1=x, y_1=y, type_1="scatter")`,
    },
    {
        title: 'renders the laboratory histogram',
        expectedTitle: 'Laboratory histogram',
        code: `plot(
    title="Laboratory histogram",
    x_1=[4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 27],
    y_1=[4, 1, 9, 20, 19, 25, 39, 33, 41, 43, 47, 36, 23, 11, 27, 6, 6, 3, 2, 4, 1],
    type_1="histogram"
)`,
    },
    {
        title: 'renders fractional histogram coordinates',
        expectedTitle: 'Fractional coordinates',
        code: `plot(
    title="Fractional coordinates",
    x_1=[0, 0.2, 0.5, 0.7, 1, 2],
    y_1=[0.1, 0.4, 0.5, 0.33, 0.2, 0.6],
    type_1="histogram"
)`,
    },
    {
        title: 'renders duplicate coordinates and negative values',
        expectedTitle: 'Duplicate coordinates',
        code: `plot(
    title="Duplicate coordinates",
    x_1=[0, 1, 1, 2, 3, 3, 3, 4, 4],
    y_1=[5, -4, 6, 3, -1, -3, 1, 0, 4],
    type_1="histogram"
)`,
    },
] as const;

test.describe('Production plots', () => {
    for (const plot of plots) {
        test(`${plot.title} @authenticated`, async ({ app }) => {
            await app.openAuthenticatedEditor();
            await app.projects.createManagedProject(
                `plot-${plot.title}`,
                'Markdown'
            );
            await app.editor.addSegment('Computation', plot.code);

            await app.compilation.runSuccessfully();
            await app.results.expectPlot(plot.expectedTitle);

            if ('verifyGrid' in plot && plot.verifyGrid) {
                await app.results.expectPlotGrid();
            }
        });
    }
});
