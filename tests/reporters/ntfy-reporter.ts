import type {
    FullConfig,
    FullResult,
    Reporter,
    Suite,
    TestCase,
} from '@playwright/test/reporter';

export interface NtfyReporterOptions {
    /** Полный URL топика, например https://ntfy.mipt.io/tests */
    url: string;
    username?: string;
    password?: string;
    /** Отображаемое имя окружения, попадает в заголовок и тело сообщения */
    host?: string;
}

// Стандартный лимит ntfy на тело сообщения - 4096 байт.
const MAX_MESSAGE_BYTES = 4000;
const MAX_FAILURES_LISTED = 15;
const REQUEST_TIMEOUT_MS = 15_000;

interface FailureSummary {
    title: string;
    error: string;
}

/**
 * Отправляет итог прогона в ntfy одним HTTP-запросом после завершения тестов.
 * Репортер не пишет в stdout, поэтому используется вместе с `list`.
 */
export default class NtfyReporter implements Reporter {
    private readonly options: NtfyReporterOptions;
    private suite: Suite | undefined;
    private startedAt = 0;

    constructor(options: NtfyReporterOptions) {
        this.options = options;
    }

    printsToStdio(): boolean {
        return false;
    }

    onBegin(_config: FullConfig, suite: Suite): void {
        this.suite = suite;
        this.startedAt = Date.now();
    }

    async onEnd(result: FullResult): Promise<void> {
        const tests = this.suite?.allTests() ?? [];
        const counts = { passed: 0, failed: 0, flaky: 0, skipped: 0 };
        const failures: FailureSummary[] = [];

        for (const test of tests) {
            switch (test.outcome()) {
                case 'expected':
                    counts.passed += 1;
                    break;
                case 'flaky':
                    counts.flaky += 1;
                    break;
                case 'skipped':
                    counts.skipped += 1;
                    break;
                case 'unexpected':
                    counts.failed += 1;
                    failures.push(describeFailure(test));
                    break;
            }
        }

        const isSuccess = result.status === 'passed' && counts.failed === 0;
        const environment = this.options.host ?? 'unknown host';
        const title = isSuccess
            ? `Labkeeper E2E passed (${environment})`
            : `Labkeeper E2E ${describeStatus(result.status, counts.failed)} (${environment})`;

        const lines = [
            `Host: ${environment}`,
            `Status: ${result.status}`,
            `Duration: ${formatDuration(Date.now() - this.startedAt)}`,
            `Total: ${tests.length} | Passed: ${counts.passed} | Failed: ${counts.failed} | Flaky: ${counts.flaky} | Skipped: ${counts.skipped}`,
        ];

        if (failures.length > 0) {
            lines.push('', 'Failed tests:');
            for (const failure of failures.slice(0, MAX_FAILURES_LISTED)) {
                lines.push(`- ${failure.title}`);
                if (failure.error) {
                    lines.push(`  ${failure.error}`);
                }
            }
            if (failures.length > MAX_FAILURES_LISTED) {
                lines.push(`... and ${failures.length - MAX_FAILURES_LISTED} more`);
            }
        }

        await this.publish({
            title,
            message: truncateToBytes(lines.join('\n'), MAX_MESSAGE_BYTES),
            priority: isSuccess ? 'default' : 'high',
            tags: isSuccess ? 'white_check_mark' : 'x',
        });
    }

    private async publish(notification: {
        title: string;
        message: string;
        priority: 'default' | 'high';
        tags: string;
    }): Promise<void> {
        const headers: Record<string, string> = {
            'Content-Type': 'text/plain; charset=utf-8',
            Title: notification.title,
            Priority: notification.priority,
            Tags: notification.tags,
        };

        if (this.options.username) {
            const credentials = Buffer.from(
                `${this.options.username}:${this.options.password ?? ''}`,
                'utf8'
            ).toString('base64');
            headers.Authorization = `Basic ${credentials}`;
        }

        try {
            const response = await fetch(this.options.url, {
                method: 'POST',
                headers,
                body: notification.message,
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });

            if (!response.ok) {
                const body = await response.text().catch(() => '');
                process.stderr.write(
                    `[ntfy-reporter] Publish failed: HTTP ${response.status} ${body}\n`
                );
            }
        } catch (error) {
            process.stderr.write(
                `[ntfy-reporter] Publish failed: ${describeError(error)}\n`
            );
        }
    }
}

function describeFailure(test: TestCase): FailureSummary {
    const lastResult = test.results.at(-1);
    const firstError = lastResult?.errors[0]?.message ?? lastResult?.error?.message ?? '';
    const errorLine = stripAnsi(firstError)
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.length > 0);

    return {
        title: test.titlePath().filter(Boolean).join(' › '),
        error: errorLine ? shorten(errorLine, 200) : '',
    };
}

function describeError(error: unknown): string {
    if (!(error instanceof Error)) {
        return String(error);
    }
    // У ошибок fetch реальная причина (ECONNREFUSED, ENOTFOUND и т.п.) лежит в cause.
    const cause =
        error.cause instanceof Error ? error.cause.message : error.cause;
    return cause ? `${error.message} (${String(cause)})` : error.message;
}

function describeStatus(status: FullResult['status'], failed: number): string {
    if (status === 'failed' && failed > 0) {
        return `failed: ${failed}`;
    }
    return status;
}

function formatDuration(milliseconds: number): string {
    const totalSeconds = Math.round(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function shorten(text: string, maxLength: number): string {
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function stripAnsi(text: string): string {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\u001b\[[0-9;]*m/g, '');
}

function truncateToBytes(text: string, maxBytes: number): string {
    if (Buffer.byteLength(text, 'utf8') <= maxBytes) {
        return text;
    }
    const suffix = '\n…';
    let result = text;
    while (Buffer.byteLength(result + suffix, 'utf8') > maxBytes) {
        result = result.slice(0, -100);
    }
    return result + suffix;
}
