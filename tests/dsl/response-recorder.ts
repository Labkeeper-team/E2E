import type { Page } from '@playwright/test';

const withoutQuery = (url: string): string => url.split('?')[0];

// A preview opens with the last stored PDF, so a new build is proven only by a download that followed its own run
export class ResponseRecorder {
    private readonly loadedUrls = new Set<string>();
    private listening = false;

    constructor(private readonly page: Page) {}

    restart(): void {
        this.loadedUrls.clear();
        if (this.listening) {
            return;
        }
        // Started lazily, so tests that never compile PDF do not forward every response to the runner
        this.listening = true;
        this.page.context().on('response', (response) => {
            if (response.ok()) {
                this.loadedUrls.add(withoutQuery(response.url()));
            }
        });
    }

    hasLoaded(url: string): boolean {
        return this.loadedUrls.has(withoutQuery(url));
    }
}
