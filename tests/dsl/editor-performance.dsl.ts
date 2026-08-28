import {
    expect,
    type Locator,
    type Page,
    type TestInfo,
} from '@playwright/test';
import { EditorDsl } from './editor.dsl';
import { FileManagerDsl } from './file-manager.dsl';
import { EditorLocators, FileManagerLocators } from './locators';
import { NavigationDsl } from './navigation.dsl';
import { ProjectsDsl } from './projects.dsl';
import { ProjectViewDsl } from './project-view.dsl';

const LARGE_DOCUMENT_LINE_COUNT = 1_000;
const LARGE_PROJECT_SEGMENT_COUNT = 100;
const HELD_KEY_PRESS_COUNT = 120;
const HELD_KEY_INTERVAL_MS = 16;
const SCROLL_STEPS_PER_DIRECTION = 45;

interface PerformanceBudget {
    blockingEntryMaxMs: number;
    frameGapP95Ms: number;
    inputToFrameMaxMs: number;
    inputToFrameP95Ms: number;
    postResponseRenderMs: number;
}

const DEFAULT_PERFORMANCE_BUDGET: PerformanceBudget = Object.freeze({
    postResponseRenderMs: 5_000,
    inputToFrameP95Ms: 200,
    inputToFrameMaxMs: 500,
    frameGapP95Ms: 100,
    blockingEntryMaxMs: 500,
});

const WEBKIT_PERFORMANCE_BUDGET: PerformanceBudget = Object.freeze({
    ...DEFAULT_PERFORMANCE_BUDGET,
    inputToFrameP95Ms: 250,
    frameGapP95Ms: 250,
});

interface RawPerformanceMetrics {
    durationMs: number;
    frameGapsMs: number[];
    inputToFrameMs: number[];
    longAnimationFramesMs: number[];
    longTasksMs: number[];
    supportsLongAnimationFrames: boolean;
    supportsLongTasks: boolean;
}

interface DistributionSummary {
    count: number;
    maxMs: number;
    p50Ms: number;
    p95Ms: number;
}

interface PerformanceReport {
    browser: string;
    budget: PerformanceBudget;
    durationMs: number;
    frameGaps: DistributionSummary;
    inputToFrame: DistributionSummary;
    label: string;
    longAnimationFrames: DistributionSummary;
    longTasks: DistributionSummary;
    measuredAt: string;
    support: {
        longAnimationFrames: boolean;
        longTasks: boolean;
    };
}

export class EditorPerformanceDsl {
    private readonly editorLocators: EditorLocators;
    private readonly fileLocators: FileManagerLocators;

    constructor(
        private readonly page: Page,
        private readonly testInfo: TestInfo,
        private readonly projectView: ProjectViewDsl,
        private readonly editor: EditorDsl,
        private readonly files: FileManagerDsl,
        private readonly navigation: NavigationDsl,
        private readonly projects: ProjectsDsl
    ) {
        this.editorLocators = new EditorLocators(page);
        this.fileLocators = new FileManagerLocators(page);
    }

    async expectLongSegmentEditingResponsive(projectId: string): Promise<void> {
        const initialText = this.largeDocument('Segment');
        const headMarker = 'head-performance-marker ';
        const tailMarker = 'tail-performance-marker';

        await this.projects.replaceManagedProjectProgram(projectId, [
            { type: 'md', text: initialText },
        ]);
        await this.navigation.reload();
        await this.projectView.showEditor();
        await expect(this.editorLocators.segmentEditors).toHaveCount(1, {
            timeout: 60_000,
        });

        const segment = this.editorLocators.segmentEditor(0);
        await this.focusSegment(0);
        await this.moveToDocumentEnd(segment);
        await this.editor.expectSegmentContainsText(
            0,
            `Segment ${LARGE_DOCUMENT_LINE_COUNT.toString().padStart(4, '0')}`
        );

        const report = await this.measure(
            'long-segment-editing',
            segment,
            async () => {
                await segment.press('Enter');
                await segment.pressSequentially(tailMarker, { delay: 10 });
                await this.editor.expectSegmentContainsText(0, tailMarker);

                await this.moveToDocumentStart(segment);
                await segment.pressSequentially(headMarker, { delay: 10 });
                await this.editor.expectSegmentContainsText(0, headMarker);
            }
        );

        this.expectResponsive(
            report,
            headMarker.length + tailMarker.length
        );
        await this.editor.waitForSaved();
    }

    async expectLongFileEditingResponsive(): Promise<void> {
        const fileName = 'performance-large-file.tex';
        const headMarker = '% head-performance-marker ';
        const tailMarker = '% tail-performance-marker';

        await this.files.open();
        await this.files.uploadTextFile(
            fileName,
            this.largeDocument('% File')
        );
        await this.files.openTextFile(fileName);

        const fileEditor = this.fileLocators.textFileEditorContent;
        await expect(fileEditor).toBeEditable({ timeout: 30_000 });
        await fileEditor.focus();
        await this.moveToDocumentEnd(fileEditor);
        await this.files.expectOpenTextFileContainsText(
            `% File ${LARGE_DOCUMENT_LINE_COUNT.toString().padStart(4, '0')}`
        );

        const report = await this.measure(
            'long-file-editing',
            fileEditor,
            async () => {
                await fileEditor.press('Enter');
                await fileEditor.pressSequentially(tailMarker, { delay: 10 });
                await this.files.expectOpenTextFileContainsText(tailMarker);

                await this.moveToDocumentStart(fileEditor);
                await fileEditor.pressSequentially(headMarker, { delay: 10 });
                await this.files.expectOpenTextFileContainsText(headMarker);
            }
        );

        this.expectResponsive(
            report,
            headMarker.length + tailMarker.length
        );
        await this.files.waitForOpenTextFileSaved();
    }

    async expectManySegmentsResponsive(projectId: string): Promise<void> {
        const marker = ' responsive';
        const segments = Array.from(
            { length: LARGE_PROJECT_SEGMENT_COUNT },
            (_, index) => ({
                type: 'md' as const,
                text: `Performance segment ${(index + 1)
                    .toString()
                    .padStart(3, '0')}`,
            })
        );

        await this.projects.replaceManagedProjectProgram(projectId, segments);
        await this.navigation.reload();
        await this.projectView.showEditor();
        await expect(this.editorLocators.segmentEditors).toHaveCount(
            LARGE_PROJECT_SEGMENT_COUNT,
            { timeout: 60_000 }
        );
        await this.expectLargeProjectRenderWithinBudget(projectId);

        const report = await this.measure(
            'many-segments-scrolling-and-editing',
            this.editorLocators.editorRoot,
            async () => {
                await this.scrollThroughSegmentList();

                const lastIndex = LARGE_PROJECT_SEGMENT_COUNT - 1;
                const lastSegment =
                    this.editorLocators.segmentEditor(lastIndex);
                await this.focusSegment(lastIndex);
                await this.moveToDocumentEnd(lastSegment);
                await lastSegment.pressSequentially(marker, { delay: 10 });
                await this.editor.expectSegmentContainsText(
                    lastIndex,
                    marker
                );
            }
        );

        this.expectResponsive(report, marker.length);
        await this.editor.waitForSaved();
    }

    async expectHeldKeyInputResponsive(): Promise<void> {
        const segmentPrefix = 'Held key segment: ';
        const filePrefix = 'Held key file: ';
        const segmentKey = 'x';
        const fileKey = 'y';
        const segment = await this.editor.addSegment(
            'Markdown',
            segmentPrefix
        );

        await this.focusSegment(segment);
        const segmentEditor = this.editorLocators.segmentEditor(segment);
        await this.moveToDocumentEnd(segmentEditor);
        const segmentReport = await this.measure(
            'held-key-segment-input',
            segmentEditor,
            async () => this.holdKey(segmentKey)
        );

        this.expectResponsive(segmentReport, HELD_KEY_PRESS_COUNT);
        await this.editor.expectSegmentTexts([
            `${segmentPrefix}${segmentKey.repeat(HELD_KEY_PRESS_COUNT)}`,
        ]);
        await this.editor.waitForSaved();

        const fileName = 'performance-held-key.txt';
        await this.files.open();
        await this.files.uploadTextFile(fileName, filePrefix);
        await this.files.openTextFile(fileName);

        const fileEditor = this.fileLocators.textFileEditorContent;
        await expect(fileEditor).toBeEditable({ timeout: 30_000 });
        await fileEditor.focus();
        await this.moveToDocumentEnd(fileEditor);
        const fileReport = await this.measure(
            'held-key-file-input',
            fileEditor,
            async () => this.holdKey(fileKey)
        );

        this.expectResponsive(fileReport, HELD_KEY_PRESS_COUNT);
        await this.files.expectOpenTextFileContents(
            `${filePrefix}${fileKey.repeat(HELD_KEY_PRESS_COUNT)}`
        );
        await this.files.waitForOpenTextFileSaved();
    }

    private largeDocument(prefix: string): string {
        return Array.from(
            { length: LARGE_DOCUMENT_LINE_COUNT },
            (_, index) =>
                `${prefix} ${(index + 1).toString().padStart(4, '0')}`
        ).join('\n');
    }

    private async focusSegment(index: number): Promise<void> {
        await this.projectView.showEditor();
        const segment = this.editorLocators.segmentEditor(index);
        await expect(segment).toBeEditable({ timeout: 30_000 });
        await segment.scrollIntoViewIfNeeded();
        await segment.focus();
        await expect(this.editorLocators.segmentCodeMirror(index)).toHaveClass(
            /cm-focused/
        );
        await expect(this.editorLocators.segmentContainer(index)).toHaveClass(
            /is-active/
        );
    }

    private async holdKey(key: string): Promise<void> {
        try {
            for (let index = 0; index < HELD_KEY_PRESS_COUNT; index += 1) {
                await this.page.keyboard.down(key);
                if (index < HELD_KEY_PRESS_COUNT - 1) {
                    await this.page.waitForTimeout(HELD_KEY_INTERVAL_MS);
                }
            }
        } finally {
            await this.page.keyboard.up(key);
        }
    }

    private async moveToDocumentEnd(editor: Locator): Promise<void> {
        await editor.press(
            this.testInfo.project.name === 'iPhone Safari'
                ? 'Meta+ArrowDown'
                : 'Control+End'
        );
    }

    private async moveToDocumentStart(editor: Locator): Promise<void> {
        await editor.press(
            this.testInfo.project.name === 'iPhone Safari'
                ? 'Meta+ArrowUp'
                : 'Control+Home'
        );
    }

    private async scrollThroughSegmentList(): Promise<void> {
        await this.editorLocators.segmentsScrollContainer.evaluate(
            async (element, steps) => {
                if (!(element instanceof HTMLElement)) {
                    throw new Error('Segments scroll container is not an element');
                }

                const maximum = element.scrollHeight - element.clientHeight;
                if (maximum <= 0) {
                    throw new Error('Segments list is not scrollable');
                }

                const nextFrame = () =>
                    new Promise<void>((resolve) => {
                        requestAnimationFrame(() => resolve());
                    });
                const scroll = async (from: number, to: number) => {
                    for (let step = 0; step <= steps; step += 1) {
                        element.scrollTop =
                            from + ((to - from) * step) / steps;
                        await nextFrame();
                    }
                };

                element.scrollTop = 0;
                await nextFrame();
                await scroll(0, maximum);
                await scroll(maximum, 0);
            },
            SCROLL_STEPS_PER_DIRECTION
        );
    }

    private async expectLargeProjectRenderWithinBudget(
        projectId: string
    ): Promise<void> {
        const durationMs = await this.page.evaluate((id) => {
            const resources = performance.getEntriesByType(
                'resource'
            ) as PerformanceResourceTiming[];
            const resource = resources
                .filter((entry) => {
                    const path = new URL(entry.name).pathname;
                    return new RegExp(
                        `/api/v\\d+/public/project/${id}/get$`
                    ).test(path);
                })
                .at(-1);

            return resource ? performance.now() - resource.responseEnd : null;
        }, projectId);

        expect(
            durationMs,
            'Could not find the managed project resource timing'
        ).not.toBeNull();
        const roundedDurationMs = this.round(durationMs ?? Number.POSITIVE_INFINITY);
        const budget = this.performanceBudget();
        await this.attachReport('many-segments-initial-render', {
            browser: this.testInfo.project.name,
            budgetMs: budget.postResponseRenderMs,
            durationMs: roundedDurationMs,
            measuredAt: new Date().toISOString(),
        });
        expect(
            roundedDurationMs,
            'Rendering 100 segments after the project response exceeded the budget'
        ).toBeLessThanOrEqual(budget.postResponseRenderMs);
    }

    private async measure(
        label: string,
        target: Locator,
        action: () => Promise<void>
    ): Promise<PerformanceReport> {
        await this.startProbe(target);
        let report: PerformanceReport | undefined;

        try {
            await action();
        } finally {
            const rawMetrics = await this.stopProbe();
            report = this.createReport(label, rawMetrics);
            await this.attachReport(label, report);
        }

        return report;
    }

    private async startProbe(target: Locator): Promise<void> {
        await target.evaluate((element) => {
            type Probe = {
                stop: () => Promise<RawPerformanceMetrics>;
            };
            const probeWindow = window as typeof window & {
                __labkeeperE2EPerformanceProbe?: Probe;
            };

            if (probeWindow.__labkeeperE2EPerformanceProbe) {
                throw new Error('A performance probe is already active');
            }

            const frameGapsMs: number[] = [];
            const inputToFrameMs: number[] = [];
            const longAnimationFramesMs: number[] = [];
            const longTasksMs: number[] = [];
            const observerRecords: Array<{
                durations: number[];
                observer: PerformanceObserver;
            }> = [];
            const supportedEntryTypes =
                PerformanceObserver.supportedEntryTypes ?? [];
            const supportsLongAnimationFrames = supportedEntryTypes.includes(
                'long-animation-frame'
            );
            const supportsLongTasks = supportedEntryTypes.includes('longtask');
            const startedAt = performance.now();
            let previousFrameAt = startedAt;
            let pendingInputAt: number | undefined;
            let animationFrame = 0;
            let recordFrameGaps = true;

            const containsTarget = (event: Event): boolean =>
                event.composedPath().some(
                    (node) =>
                        node === element ||
                        (node instanceof Node && element.contains(node))
                );
            const isTextProducingKey = (event: KeyboardEvent): boolean =>
                !event.ctrlKey &&
                !event.metaKey &&
                !event.altKey &&
                (event.key.length === 1 ||
                    ['Backspace', 'Delete', 'Enter'].includes(event.key));
            const recordRenderedInput = () => {
                const inputAt = pendingInputAt ?? performance.now();
                pendingInputAt = undefined;
                requestAnimationFrame(() => {
                    inputToFrameMs.push(performance.now() - inputAt);
                });
            };
            const onTextUpdate = () => recordRenderedInput();
            const editContexts = new Set<EventTarget>();
            const attachEditContext = (host: Element) => {
                const editContext = (
                    host as Element & { editContext?: EventTarget | null }
                ).editContext;
                if (!editContext || editContexts.has(editContext)) {
                    return;
                }

                editContext.addEventListener('textupdate', onTextUpdate);
                editContexts.add(editContext);
            };
            const attachEditContextsFromEvent = (event: Event) => {
                for (const node of event.composedPath()) {
                    if (node instanceof Element) {
                        attachEditContext(node);
                    }
                }
            };
            const onKeyDown = (event: Event) => {
                if (
                    event instanceof KeyboardEvent &&
                    containsTarget(event) &&
                    isTextProducingKey(event)
                ) {
                    attachEditContextsFromEvent(event);
                    pendingInputAt = performance.now();
                }
            };
            const onBeforeInput = (event: Event) => {
                if (containsTarget(event) && pendingInputAt === undefined) {
                    attachEditContextsFromEvent(event);
                    pendingInputAt = performance.now();
                }
            };
            const onInput = (event: Event) => {
                if (!containsTarget(event)) {
                    return;
                }

                recordRenderedInput();
            };
            const onAnimationFrame = (now: number) => {
                if (recordFrameGaps) {
                    frameGapsMs.push(now - previousFrameAt);
                }
                previousFrameAt = now;
                animationFrame = requestAnimationFrame(onAnimationFrame);
            };
            const observe = (type: string, durations: number[]) => {
                try {
                    const observer = new PerformanceObserver((list) => {
                        durations.push(
                            ...list
                                .getEntries()
                                .map((entry) => entry.duration)
                        );
                    });
                    observer.observe({ type });
                    observerRecords.push({ durations, observer });
                } catch {
                    // The requestAnimationFrame probe remains available as a fallback.
                }
            };

            if (supportsLongTasks) {
                observe('longtask', longTasksMs);
            }
            if (supportsLongAnimationFrames) {
                observe('long-animation-frame', longAnimationFramesMs);
            }

            attachEditContext(element);
            for (const descendant of element.querySelectorAll('*')) {
                attachEditContext(descendant);
            }
            element.addEventListener('keydown', onKeyDown, true);
            element.addEventListener('beforeinput', onBeforeInput, true);
            element.addEventListener('input', onInput, true);
            animationFrame = requestAnimationFrame(onAnimationFrame);

            probeWindow.__labkeeperE2EPerformanceProbe = {
                stop: async () => {
                    const stoppedAt = performance.now();
                    recordFrameGaps = false;
                    await new Promise<void>((resolve) => {
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => resolve());
                        });
                    });

                    cancelAnimationFrame(animationFrame);
                    element.removeEventListener('keydown', onKeyDown, true);
                    element.removeEventListener(
                        'beforeinput',
                        onBeforeInput,
                        true
                    );
                    element.removeEventListener('input', onInput, true);
                    for (const editContext of editContexts) {
                        editContext.removeEventListener(
                            'textupdate',
                            onTextUpdate
                        );
                    }
                    for (const { durations, observer } of observerRecords) {
                        durations.push(
                            ...observer.takeRecords().map((entry) => entry.duration)
                        );
                        observer.disconnect();
                    }

                    const durationMs = stoppedAt - startedAt;
                    delete probeWindow.__labkeeperE2EPerformanceProbe;
                    return {
                        durationMs,
                        frameGapsMs,
                        inputToFrameMs,
                        longAnimationFramesMs,
                        longTasksMs,
                        supportsLongAnimationFrames,
                        supportsLongTasks,
                    };
                },
            };
        });
    }

    private async stopProbe(): Promise<RawPerformanceMetrics> {
        return this.page.evaluate(async () => {
            const probeWindow = window as typeof window & {
                __labkeeperE2EPerformanceProbe?: {
                    stop: () => Promise<RawPerformanceMetrics>;
                };
            };
            const probe = probeWindow.__labkeeperE2EPerformanceProbe;
            if (!probe) {
                throw new Error('No performance probe is active');
            }
            return probe.stop();
        });
    }

    private createReport(
        label: string,
        metrics: RawPerformanceMetrics
    ): PerformanceReport {
        return {
            browser: this.testInfo.project.name,
            budget: this.performanceBudget(),
            durationMs: this.round(metrics.durationMs),
            frameGaps: this.summarize(metrics.frameGapsMs),
            inputToFrame: this.summarize(metrics.inputToFrameMs),
            label,
            longAnimationFrames: this.summarize(
                metrics.longAnimationFramesMs
            ),
            longTasks: this.summarize(metrics.longTasksMs),
            measuredAt: new Date().toISOString(),
            support: {
                longAnimationFrames: metrics.supportsLongAnimationFrames,
                longTasks: metrics.supportsLongTasks,
            },
        };
    }

    private summarize(values: number[]): DistributionSummary {
        const sorted = [...values].sort((left, right) => left - right);
        return {
            count: sorted.length,
            maxMs: this.round(sorted.at(-1) ?? 0),
            p50Ms: this.round(this.percentile(sorted, 0.5)),
            p95Ms: this.round(this.percentile(sorted, 0.95)),
        };
    }

    private percentile(sorted: number[], percentile: number): number {
        if (sorted.length === 0) {
            return 0;
        }
        const index = Math.max(
            0,
            Math.ceil(sorted.length * percentile) - 1
        );
        return sorted[index];
    }

    private round(value: number): number {
        return Math.round(value * 100) / 100;
    }

    private expectResponsive(
        report: PerformanceReport,
        minimumInputEvents: number
    ): void {
        expect(
            report.inputToFrame.count,
            `${report.label}: not all expected input events were rendered`
        ).toBeGreaterThanOrEqual(minimumInputEvents);
        expect(
            report.inputToFrame.p95Ms,
            `${report.label}: p95 input-to-frame latency exceeded the budget`
        ).toBeLessThanOrEqual(report.budget.inputToFrameP95Ms);
        expect(
            report.inputToFrame.maxMs,
            `${report.label}: maximum input-to-frame latency exceeded the budget`
        ).toBeLessThanOrEqual(report.budget.inputToFrameMaxMs);
        expect(
            report.frameGaps.p95Ms,
            `${report.label}: p95 frame gap exceeded the budget`
        ).toBeLessThanOrEqual(report.budget.frameGapP95Ms);
        if (report.support.longTasks) {
            expect(
                report.longTasks.maxMs,
                `${report.label}: a long task exceeded the blocking budget`
            ).toBeLessThanOrEqual(report.budget.blockingEntryMaxMs);
        }
        if (report.support.longAnimationFrames) {
            expect(
                report.longAnimationFrames.maxMs,
                `${report.label}: a long animation frame exceeded the blocking budget`
            ).toBeLessThanOrEqual(report.budget.blockingEntryMaxMs);
        }
    }

    private performanceBudget(): PerformanceBudget {
        return this.testInfo.project.name.includes('Safari')
            ? WEBKIT_PERFORMANCE_BUDGET
            : DEFAULT_PERFORMANCE_BUDGET;
    }

    private async attachReport(label: string, report: object): Promise<void> {
        await this.testInfo.attach(`performance-${label}.json`, {
            body: Buffer.from(JSON.stringify(report, null, 2)),
            contentType: 'application/json',
        });
    }
}
