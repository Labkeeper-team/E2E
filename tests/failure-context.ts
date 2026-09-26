import type { BrowserContext, TestInfo } from '@playwright/test';
import { input } from './input';

// Enough to see what the pages went through before a failure while the line stays readable in the nightly log
const FAILURE_CONTEXT_ENTRIES = 30;
const FAILURE_CONTEXT_TEXT_LENGTH = 200;

interface FailureContextEntry {
    atMs: number;
    kind: 'response' | 'requestfailed' | 'pageerror' | 'console.error';
    request?: string;
    status?: number;
    error?: string;
    text?: string;
}

const secretPatterns = [
    input.captchaBypassToken,
    input.userEmail,
    input.userPassword,
    input.secondUserEmail,
    input.secondUserPassword,
]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => [value, encodeURIComponent(value)])
    .sort((first, second) => second.length - first.length)
    .map(
        (value) =>
            new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    );

function redact(text: string): string {
    return secretPatterns.reduce(
        (result, pattern) => result.replace(pattern, '<redacted>'),
        text
    );
}

// Redacted before the cut, so a secret split by the length limit cannot leave its beginning in the log
function clip(text: string | undefined): string | undefined {
    return text === undefined
        ? undefined
        : redact(text).slice(0, FAILURE_CONTEXT_TEXT_LENGTH);
}

// The cluster and runner logs outlive the pods and artifacts with screenshots and videos, so a failed test leaves there what its pages saw
export class FailureContext {
    private readonly startedAt = Date.now();
    private readonly origin = new URL(input.host).origin;
    private readonly entries: FailureContextEntry[] = [];
    private total = 0;
    private cleanupStartedAtMs?: number;

    // Listeners only: they keep a few fields of the rare bad events and never wait, so passing tests pay nothing but the event itself
    watch(context: BrowserContext): void {
        context.on('response', (response) => {
            if (response.status() < 400) {
                return;
            }
            const path = this.ownPath(response.url());
            if (path?.startsWith('/api/')) {
                this.add({
                    kind: 'response',
                    request: `${response.request().method()} ${path}`,
                    status: response.status(),
                });
            }
        });
        context.on('requestfailed', (request) => {
            // Every navigation aborts the instruction images still loading, and in Firefox they pushed everything else out of the kept entries
            if (request.resourceType() === 'image') {
                return;
            }
            const path = this.ownPath(request.url());
            if (path !== undefined) {
                this.add({
                    kind: 'requestfailed',
                    request: `${request.method()} ${path}`,
                    error: request.failure()?.errorText,
                });
            }
        });
        context.on('weberror', (webError) => {
            this.add({ kind: 'pageerror', text: String(webError.error()) });
        });
        context.on('console', (message) => {
            if (message.type() === 'error') {
                this.add({ kind: 'console.error', text: message.text() });
            }
        });
    }

    // Cleanup navigates after the failure too, so the report shows where the entries of the test end
    markCleanup(): void {
        this.cleanupStartedAtMs = this.elapsedMs();
    }

    report(testInfo: TestInfo): void {
        if (testInfo.status === testInfo.expectedStatus) {
            return;
        }
        const entries = this.entries.map((entry) => ({
            ...entry,
            request: clip(entry.request),
            error: clip(entry.error),
            text: clip(entry.text),
        }));
        const report = JSON.stringify({
            test: testInfo.titlePath.slice(1).join(' > '),
            project: testInfo.project.name,
            status: testInfo.status,
            events: this.total,
            cleanupStartedAtMs: this.cleanupStartedAtMs,
            last: entries,
        });
        console.log(`[failure-context] ${redact(report)}`);
    }

    // Only the path: the query may carry the captcha bypass token, and bodies, headers and cookies are never read
    private ownPath(url: string): string | undefined {
        try {
            const parsed = new URL(url);
            return parsed.origin === this.origin ? parsed.pathname : undefined;
        } catch {
            return undefined;
        }
    }

    private elapsedMs(): number {
        return Date.now() - this.startedAt;
    }

    private add(entry: Omit<FailureContextEntry, 'atMs'>): void {
        this.total += 1;
        this.entries.push({ atMs: this.elapsedMs(), ...entry });
        if (this.entries.length > FAILURE_CONTEXT_ENTRIES) {
            this.entries.shift();
        }
    }
}
