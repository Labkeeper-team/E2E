import {
    expect,
    type Locator,
    type Page,
    type TestInfo,
} from '@playwright/test';
import { readFile } from 'node:fs/promises';
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
const MINIMUM_BLOCKING_ENTRY_COUNT = 3;
// The first characters after the probe starts or after a jump through the document pay for rendering the new region,
// so they stay out of the percentiles. Counting characters rather than input events keeps the iPhone Enter out as well
const WARMUP_CHARACTERS_PER_SERIES = 2;
// One series gives about fifty key presses, so p95 would again be decided by the third slowest one
const LONG_SEGMENT_SERIES = 3;
const MODIFIER_KEYS = ['Alt', 'Control', 'Meta', 'Shift'];
// cgroup v2 first, then the two usual cgroup v1 mount points
const CGROUP_CPU_STAT_PATHS = [
    '/sys/fs/cgroup/cpu.stat',
    '/sys/fs/cgroup/cpu/cpu.stat',
    '/sys/fs/cgroup/cpu,cpuacct/cpu.stat',
];

interface PerformanceBudget {
    assertAnimationFrameTiming: boolean;
    blockingEntryP50Ms: number;
    frameGapP95Ms: number;
    inputToFrameHardLimitMs: number;
    inputToFrameP95Ms: number;
    inputToUpdateHardLimitMs: number;
    inputToUpdateP50Ms?: number;
    inputToUpdateP95Ms: number;
}

const DEFAULT_PERFORMANCE_BUDGET: PerformanceBudget = Object.freeze({
    assertAnimationFrameTiming: true,
    inputToFrameP95Ms: 200,
    inputToFrameHardLimitMs: 2_000,
    inputToUpdateP95Ms: 100,
    inputToUpdateHardLimitMs: 2_000,
    frameGapP95Ms: 100,
    blockingEntryP50Ms: 500,
});

// Nightly WebKit latencies cluster near multiples of 100 ms: the median stays about 100 and p95 is either about 200
// or about 290. Our hypothesis, until cpuThrottling confirms it, is CFS quantization in the one-CPU container.
// The former p95 limit of 250 ms sat between those two modes and failed almost half of the runs. The median catches
// a slow typical key press. p95 catches only recurring delays: more than 5% of the key presses after the warm-up,
// at least eight of 141 in the long segment, must exceed 350 ms. A single stall or a slow warm-up character
// is caught only by the hard limit. The p95 limit of 350 ms is temporary: revisit it after the first nightly runs
// with raw samples
const WEBKIT_PERFORMANCE_BUDGET: PerformanceBudget = Object.freeze({
    ...DEFAULT_PERFORMANCE_BUDGET,
    assertAnimationFrameTiming: false,
    inputToUpdateP50Ms: 150,
    inputToUpdateP95Ms: 350,
});

interface RawPerformanceMetrics {
    durationMs: number;
    frameGapsMs: number[];
    inputToFrameMs: number[];
    inputToUpdateMs: number[];
    inputToUpdateSeriesPositions: number[];
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

interface CgroupCpuStat {
    path: string;
    values: Record<string, number>;
}

interface CpuThrottling {
    after: Record<string, number>;
    before: Record<string, number>;
    path: string;
    periods: number | null;
    throttledMs: number | null;
    throttledPeriods: number | null;
    usageMs: number | null;
}

interface PerformanceReport {
    browser: string;
    budget: PerformanceBudget;
    cpuThrottling: CpuThrottling | null;
    durationMs: number;
    frameGaps: DistributionSummary;
    inputToFrame: DistributionSummary;
    inputToUpdate: DistributionSummary;
    inputToUpdateSamples: {
        latencyMs: number[];
        seriesPosition: number[];
    };
    inputToUpdateSteady: DistributionSummary;
    label: string;
    longAnimationFrames: DistributionSummary;
    longTasks: DistributionSummary;
    measuredAt: string;
    support: {
        longAnimationFrames: boolean;
        longTasks: boolean;
    };
    warmupCharactersPerSeries: number;
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
        // Markers differ between series but keep one length, so each check waits for the text of its own series
        const seriesMarkers = Array.from(
            { length: LONG_SEGMENT_SERIES },
            (_, index) => ({
                head: `head-performance-marker-${index + 1} `,
                tail: `tail-performance-marker-${index + 1}`,
            })
        );
        const firstLine = this.largeDocumentLine('Segment', 1);
        const lastLine = this.largeDocumentLine(
            'Segment',
            LARGE_DOCUMENT_LINE_COUNT
        );

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
        await this.editor.expectSegmentContainsText(0, lastLine);

        const report = await this.measure(
            'long-segment-editing',
            segment,
            async () => {
                // A missed jump still leaves the marker in the rendered lines, so each check includes its neighbour
                let previousTail = lastLine;
                let previousHead = firstLine;
                for (const [index, { head, tail }] of seriesMarkers.entries()) {
                    if (index > 0) {
                        await this.moveToDocumentEnd(segment);
                    }
                    await segment.press('Enter');
                    await segment.pressSequentially(tail, { delay: 10 });
                    await this.editor.expectSegmentContainsText(
                        0,
                        `${previousTail}\n${tail}`
                    );

                    await this.moveToDocumentStart(segment);
                    await segment.pressSequentially(head, { delay: 10 });
                    await this.editor.expectSegmentContainsText(
                        0,
                        `${head}${previousHead}`
                    );

                    previousTail = tail;
                    previousHead = head;
                }
            }
        );

        // Each series types after a jump to the end and after a jump to the start
        this.expectResponsive(
            report,
            seriesMarkers.reduce(
                (count, { head, tail }) => count + head.length + tail.length,
                0
            ),
            2 * LONG_SEGMENT_SERIES
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
            this.largeDocumentLine('% File', LARGE_DOCUMENT_LINE_COUNT)
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
            headMarker.length + tailMarker.length,
            2
        );
        await this.files.waitForOpenTextFileSaved();
    }

    async expectManySegmentsResponsive(projectId: string): Promise<void> {
        // With eleven key presses p95 was simply the slowest one, so a single scheduler stall decided the result
        const marker = ' responsive typing in the last of one hundred segments';
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
        await this.reportLargeProjectReadiness(projectId);
        // A never-compiled project opens on the agent screen of a phone, and the list is scrolled only in the editor
        await this.projectView.showEditor();

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
        return Array.from({ length: LARGE_DOCUMENT_LINE_COUNT }, (_, index) =>
            this.largeDocumentLine(prefix, index + 1)
        ).join('\n');
    }

    private largeDocumentLine(prefix: string, lineNumber: number): string {
        return `${prefix} ${lineNumber.toString().padStart(4, '0')}`;
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

    private async reportLargeProjectReadiness(
        projectId: string
    ): Promise<void> {
        const responseToEditorReadyMs = await this.page.evaluate((id) => {
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
            responseToEditorReadyMs,
            'Could not find the managed project resource timing'
        ).not.toBeNull();
        await this.attachReport('many-segments-editor-readiness', {
            browser: this.testInfo.project.name,
            label: 'many-segments-editor-readiness',
            linesPerSegment: 1,
            measuredAt: new Date().toISOString(),
            responseToEditorReadyMs: this.round(
                responseToEditorReadyMs ?? Number.POSITIVE_INFINITY
            ),
            segmentCount: LARGE_PROJECT_SEGMENT_COUNT,
        });
    }

    private async measure(
        label: string,
        target: Locator,
        action: () => Promise<void>
    ): Promise<PerformanceReport> {
        await this.startProbe(target);
        const cpuStatBefore = await this.readCgroupCpuStat();
        let report: PerformanceReport | undefined;

        try {
            await action();
        } finally {
            const cpuStatAfter = await this.readCgroupCpuStat();
            const rawMetrics = await this.stopProbe();
            report = this.createReport(
                label,
                rawMetrics,
                this.cpuThrottling(cpuStatBefore, cpuStatAfter)
            );
            await this.attachReport(label, report);
        }

        return report;
    }

    private async startProbe(target: Locator): Promise<void> {
        await target.evaluate(async (element, modifierKeys) => {
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
            const inputToUpdateMs: number[] = [];
            const inputToUpdateSeriesPositions: number[] = [];
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
            let startedAt = 0;
            let previousFrameAt = 0;
            let pendingInputAt: number | undefined;
            // Characters typed since the probe started or since the last jump through the document
            let seriesCharacters = 0;
            let pendingSeriesPosition = 0;
            let pendingCharacterCounted = false;
            let animationFrame = 0;
            let recordFrameGaps = false;

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
                if (pendingInputAt === undefined) {
                    return;
                }

                const inputAt = pendingInputAt;
                const seriesPosition = pendingSeriesPosition;
                pendingInputAt = undefined;
                pendingCharacterCounted = false;
                queueMicrotask(() => {
                    inputToUpdateMs.push(performance.now() - inputAt);
                    inputToUpdateSeriesPositions.push(seriesPosition);
                    requestAnimationFrame(() => {
                        inputToFrameMs.push(performance.now() - inputAt);
                    });
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
                    !(event instanceof KeyboardEvent) ||
                    !containsTarget(event)
                ) {
                    return;
                }
                if (isTextProducingKey(event)) {
                    attachEditContextsFromEvent(event);
                    pendingInputAt = performance.now();
                    pendingSeriesPosition = seriesCharacters;
                    pendingCharacterCounted = event.key.length === 1;
                    if (pendingCharacterCounted) {
                        seriesCharacters += 1;
                    }
                } else if (!modifierKeys.includes(event.key)) {
                    // A jump through the document starts a new series with its own warm-up
                    seriesCharacters = 0;
                }
            };
            const onBeforeInput = (event: Event) => {
                if (!containsTarget(event)) {
                    return;
                }
                if (pendingInputAt === undefined) {
                    attachEditContextsFromEvent(event);
                    pendingInputAt = performance.now();
                    pendingSeriesPosition = seriesCharacters;
                }
                // Playwright types characters outside the US layout without a keydown, so they are counted here
                if (!pendingCharacterCounted && event instanceof InputEvent) {
                    seriesCharacters += event.data?.length ?? 0;
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
            // Headless WebKit may pause animation frames even while timers and
            // editor input remain responsive. Keep probe setup and teardown
            // bounded so a missing frame cannot consume the action timeout.
            const nextFrameOrTimeout = () =>
                new Promise<void>((resolve) => {
                    let settled = false;
                    let frameId = 0;
                    let timeoutId = 0;
                    const finish = () => {
                        if (settled) {
                            return;
                        }

                        settled = true;
                        window.clearTimeout(timeoutId);
                        cancelAnimationFrame(frameId);
                        resolve();
                    };

                    timeoutId = window.setTimeout(() => finish(), 250);
                    frameId = requestAnimationFrame(() => finish());
                });

            if (supportsLongTasks) {
                observe('longtask', longTasksMs);
            }
            if (supportsLongAnimationFrames) {
                observe('long-animation-frame', longAnimationFramesMs);
            }

            attachEditContext(element);
            element.addEventListener('keydown', onKeyDown, true);
            element.addEventListener('beforeinput', onBeforeInput, true);
            element.addEventListener('input', onInput, true);

            // Let probe setup and any rendering it triggers finish before the
            // measured interval. Descendant EditContexts are attached lazily
            // from the input event path, so large editors are not scanned here.
            await nextFrameOrTimeout();
            await nextFrameOrTimeout();
            for (const { durations, observer } of observerRecords) {
                observer.takeRecords();
                durations.length = 0;
            }

            startedAt = performance.now();
            previousFrameAt = startedAt;
            recordFrameGaps = true;
            animationFrame = requestAnimationFrame(onAnimationFrame);

            probeWindow.__labkeeperE2EPerformanceProbe = {
                stop: async () => {
                    const stoppedAt = performance.now();
                    recordFrameGaps = false;
                    await nextFrameOrTimeout();
                    await nextFrameOrTimeout();

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
                        inputToUpdateMs,
                        inputToUpdateSeriesPositions,
                        longAnimationFramesMs,
                        longTasksMs,
                        supportsLongAnimationFrames,
                        supportsLongTasks,
                    };
                },
            };
        }, MODIFIER_KEYS);
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
        metrics: RawPerformanceMetrics,
        cpuThrottling: CpuThrottling | null
    ): PerformanceReport {
        const steadyInputToUpdateMs = metrics.inputToUpdateMs.filter(
            (_, index) =>
                metrics.inputToUpdateSeriesPositions[index] >=
                WARMUP_CHARACTERS_PER_SERIES
        );
        return {
            browser: this.testInfo.project.name,
            budget: this.performanceBudget(),
            cpuThrottling,
            durationMs: this.round(metrics.durationMs),
            frameGaps: this.summarize(metrics.frameGapsMs),
            inputToFrame: this.summarize(metrics.inputToFrameMs),
            inputToUpdate: this.summarize(metrics.inputToUpdateMs),
            // Raw samples show whether slow key presses open a series or land anywhere in it
            inputToUpdateSamples: {
                latencyMs: metrics.inputToUpdateMs.map((value) =>
                    Math.round(value)
                ),
                seriesPosition: metrics.inputToUpdateSeriesPositions,
            },
            inputToUpdateSteady: this.summarize(steadyInputToUpdateMs),
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
            warmupCharactersPerSeries: WARMUP_CHARACTERS_PER_SERIES,
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
        minimumInputEvents: number,
        warmupCount = 1
    ): void {
        expect(
            report.inputToUpdate.count,
            `${report.label}: not all expected input events updated the editor`
        ).toBeGreaterThanOrEqual(minimumInputEvents);
        // Characters the probe fails to count stay in the warm-up and would leave the budgets below an empty sample
        expect(
            report.inputToUpdateSteady.count,
            `${report.label}: not all characters after the warm-up were measured`
        ).toBeGreaterThanOrEqual(
            minimumInputEvents - warmupCount * WARMUP_CHARACTERS_PER_SERIES
        );
        expect(
            report.inputToUpdateSteady.p95Ms,
            `${report.label}: p95 input-to-update latency exceeded the budget`
        ).toBeLessThanOrEqual(report.budget.inputToUpdateP95Ms);
        if (report.budget.inputToUpdateP50Ms !== undefined) {
            expect(
                report.inputToUpdateSteady.p50Ms,
                `${report.label}: median input-to-update latency exceeded the budget`
            ).toBeLessThanOrEqual(report.budget.inputToUpdateP50Ms);
        }
        expect(
            report.inputToUpdate.maxMs,
            `${report.label}: input-to-update latency exceeded the hard freeze limit`
        ).toBeLessThanOrEqual(report.budget.inputToUpdateHardLimitMs);
        if (report.budget.assertAnimationFrameTiming) {
            expect(
                report.inputToFrame.count,
                `${report.label}: not all expected input events reached an animation frame`
            ).toBeGreaterThanOrEqual(minimumInputEvents);
            expect(
                report.inputToFrame.p95Ms,
                `${report.label}: p95 input-to-frame latency exceeded the budget`
            ).toBeLessThanOrEqual(report.budget.inputToFrameP95Ms);
            expect(
                report.inputToFrame.maxMs,
                `${report.label}: input-to-frame latency exceeded the hard freeze limit`
            ).toBeLessThanOrEqual(report.budget.inputToFrameHardLimitMs);
            expect(
                report.frameGaps.p95Ms,
                `${report.label}: p95 frame gap exceeded the budget`
            ).toBeLessThanOrEqual(report.budget.frameGapP95Ms);
        }
        this.expectBlockingEntriesResponsive(
            report.longTasks,
            report.support.longTasks,
            report.budget.blockingEntryP50Ms,
            `${report.label}: recurring long tasks exceeded the blocking budget`
        );
        this.expectBlockingEntriesResponsive(
            report.longAnimationFrames,
            report.support.longAnimationFrames,
            report.budget.blockingEntryP50Ms,
            `${report.label}: recurring long animation frames exceeded the blocking budget`
        );
    }

    private expectBlockingEntriesResponsive(
        summary: DistributionSummary,
        supported: boolean,
        p50LimitMs: number,
        message: string
    ): void {
        if (!supported || summary.count < MINIMUM_BLOCKING_ENTRY_COUNT) {
            return;
        }
        expect(summary.p50Ms, message).toBeLessThanOrEqual(p50LimitMs);
    }

    // The runner and the browsers share one container, and its cgroup shows how often the action hit the CPU quota
    private async readCgroupCpuStat(): Promise<CgroupCpuStat | null> {
        for (const path of CGROUP_CPU_STAT_PATHS) {
            try {
                const text = await readFile(path, 'utf8');
                return {
                    path,
                    values: Object.fromEntries(
                        text
                            .trim()
                            .split('\n')
                            .map((line) => line.trim().split(/\s+/))
                            .map(([key, value]) => [key, Number(value)])
                    ),
                };
            } catch {
                // Try the next cgroup layout; local runs outside Linux have none of them
            }
        }
        return null;
    }

    private cpuThrottling(
        before: CgroupCpuStat | null,
        after: CgroupCpuStat | null
    ): CpuThrottling | null {
        if (!before || !after || before.path !== after.path) {
            return null;
        }
        const delta = (key: string): number | null =>
            key in before.values && key in after.values
                ? after.values[key] - before.values[key]
                : null;
        // cgroup v2 reports throttled_usec in microseconds, cgroup v1 reports throttled_time in nanoseconds
        const throttledUsec = delta('throttled_usec');
        const throttledNs = delta('throttled_time');
        const usageUsec = delta('usage_usec');
        return {
            after: after.values,
            before: before.values,
            path: after.path,
            periods: delta('nr_periods'),
            throttledMs:
                throttledUsec !== null
                    ? this.round(throttledUsec / 1_000)
                    : throttledNs !== null
                      ? this.round(throttledNs / 1_000_000)
                      : null,
            throttledPeriods: delta('nr_throttled'),
            usageMs: usageUsec === null ? null : this.round(usageUsec / 1_000),
        };
    }

    private performanceBudget(): PerformanceBudget {
        return this.testInfo.project.name.includes('Safari')
            ? WEBKIT_PERFORMANCE_BUDGET
            : DEFAULT_PERFORMANCE_BUDGET;
    }

    private async attachReport(label: string, report: object): Promise<void> {
        console.log(`[performance:${label}] ${JSON.stringify(report)}`);
        await this.testInfo.attach(`performance-${label}.json`, {
            body: Buffer.from(JSON.stringify(report, null, 2)),
            contentType: 'application/json',
        });
    }
}
