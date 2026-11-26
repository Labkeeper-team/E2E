import { expect, type Page, type Response } from '@playwright/test';
import { editorPath, input } from '../input';
import { EditorLocators } from './locators';

type FileKind = 'page' | 'editorBuild' | 'landing';

interface ServedFile {
    kind: FileKind;
    path: string;
    status: number;
    cacheControl: string;
    contentEncoding: string;
    /** Bytes on the wire: compressed size when compressed */
    bodySize: number;
}

// The editor build puts every file right in /assets/ and names it name-HASH.ext, so a release changes the name
const EDITOR_BUILD_FILE = /^\/assets\/[^/]+-[A-Za-z0-9_-]{8}\.[A-Za-z0-9]+$/;
// The landing keeps its names across releases
const LANDING_FILE = /^\/assets\/(?:js|css|img)\//;
const TEXT_FILE = /\.(?:js|css|svg|ttf|dic|aff)$/;
const COMPRESSED = /^(?:gzip|br|zstd|deflate)$/;
const YEAR_SECONDS = 31_536_000;
const DAY_SECONDS = 86_400;
// Smaller responses gain less than the gzip header costs, the server sends them as they are
const MIN_COMPRESSED_SIZE = 1024;

const maxAgeOf = (cacheControl: string): number | null => {
    const match = /(?:^|,)\s*max-age=(\d+)/.exec(cacheControl);
    return match ? Number(match[1]) : null;
};

const kindOf = (response: Response, path: string): FileKind | null => {
    if (response.request().resourceType() === 'document') {
        return 'page';
    }
    if (EDITOR_BUILD_FILE.test(path)) {
        return 'editorBuild';
    }
    if (LANDING_FILE.test(path)) {
        return 'landing';
    }
    return null;
};

/**
 * GH-285: every full load of the editor downloaded about 10 MB without compression and cache.
 * Records what the server says about its files and checks it against the rules of the issue
 */
export class StaticFilesDsl {
    private readonly recorded: Promise<ServedFile | null>[] = [];
    private recording = false;

    constructor(private readonly page: Page) {}

    startRecording(): void {
        if (this.recording) {
            return;
        }
        this.recording = true;
        this.page.on('response', (response) => {
            const pending = this.describe(response);
            // A closed page drops the headers, the check then has nothing to say about that file
            pending.catch(() => undefined);
            this.recorded.push(pending);
        });
    }

    async expectCachedAndCompressed(): Promise<void> {
        const files = (await Promise.allSettled(this.recorded))
            .map((result) => (result.status === 'fulfilled' ? result.value : null))
            .filter((file): file is ServedFile => file !== null && file.status === 200);
        // The landing reloads itself on the browser language, so a file can come twice
        const problems = [...new Set(files.flatMap((file) => this.problemsOf(file)))];

        // Without these the rules below would pass on an empty list
        expect(
            files.filter((file) => file.kind === 'page').map((file) => file.path),
            'Pages the check saw'
        ).toEqual(expect.arrayContaining(['/', '/project/default']));
        for (const extension of ['.js', '.css']) {
            expect(
                files.some(
                    (file) => file.kind === 'editorBuild' && file.path.endsWith(extension)
                ),
                `An editor build file ${extension} was loaded`
            ).toBe(true);
            expect(
                files.some(
                    (file) => file.kind === 'landing' && file.path.endsWith(extension)
                ),
                `A landing file ${extension} was loaded`
            ).toBe(true);
        }
        expect(problems, 'Files served against the caching rules').toEqual([]);
    }

    /**
     * A second tab of the same browser opens the editor again. Its scripts and styles must come
     * from the cache: the Resource Timing API reports nothing transferred for them
     */
    async expectEditorReopensFromCache(): Promise<void> {
        const secondTab = await this.page.context().newPage();
        try {
            await secondTab.goto(editorPath('/project/default'), {
                waitUntil: 'load',
                timeout: 60_000,
            });
            await new EditorLocators(secondTab).editorRoot.waitFor({
                state: 'visible',
                timeout: 60_000,
            });
            const downloaded = await secondTab.evaluate(
                (pattern) =>
                    performance
                        .getEntriesByType('resource')
                        .map((entry) => entry as PerformanceResourceTiming)
                        .filter((entry) => new RegExp(pattern).test(new URL(entry.name).pathname))
                        .map((entry) => ({
                            path: new URL(entry.name).pathname,
                            transferred: entry.transferSize,
                        })),
                EDITOR_BUILD_FILE.source
            );
            expect(
                downloaded.filter((entry) => /\.(?:js|css)$/.test(entry.path)).length,
                'Editor scripts and styles in the second tab'
            ).toBeGreaterThan(0);
            expect(
                downloaded.filter((entry) => entry.transferred > 0).map((entry) => entry.path),
                'Editor build files downloaded again in the second tab'
            ).toEqual([]);
        } finally {
            await secondTab.close();
        }
    }

    private async describe(response: Response): Promise<ServedFile | null> {
        const url = new URL(response.url());
        if (url.origin !== new URL(input.host).origin) {
            return null;
        }
        const kind = kindOf(response, url.pathname);
        if (!kind) {
            return null;
        }
        const headers = await response.allHeaders();
        const sizes = await response.request().sizes();
        return {
            kind,
            path: url.pathname,
            status: response.status(),
            cacheControl: (headers['cache-control'] ?? '').toLowerCase(),
            contentEncoding: (headers['content-encoding'] ?? '').toLowerCase(),
            bodySize: sizes.responseBodySize,
        };
    }

    private problemsOf(file: ServedFile): string[] {
        const problems: string[] = [];
        const name = `${file.path} (Cache-Control: ${file.cacheControl || 'none'})`;
        const maxAge = maxAgeOf(file.cacheControl);
        if (file.kind === 'editorBuild') {
            if (
                !file.cacheControl.includes('immutable') ||
                maxAge === null ||
                maxAge < YEAR_SECONDS ||
                /no-store|no-cache/.test(file.cacheControl)
            ) {
                problems.push(`${name}: a build file with a hash must be cached for a year`);
            }
        } else if (file.cacheControl.includes('immutable') || (maxAge ?? 0) > DAY_SECONDS) {
            // A page or a landing file keeps its address across releases, a long cache would hide the release
            problems.push(`${name}: a file without a hash in its name is cached for too long`);
        }

        const isText = file.kind === 'page' || TEXT_FILE.test(file.path);
        if (
            isText &&
            !COMPRESSED.test(file.contentEncoding) &&
            file.bodySize >= MIN_COMPRESSED_SIZE
        ) {
            problems.push(`${file.path}: ${file.bodySize} bytes sent without compression`);
        }
        return problems;
    }
}
