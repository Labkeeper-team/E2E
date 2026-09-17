import { expect, request, type APIRequestContext } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { input } from '../input';

export interface Mailbox {
    address: string;
}

interface MailTmDomain {
    domain: string;
    isActive: boolean;
    isPrivate: boolean;
}

interface MailTmMessage {
    id: string;
    subject: string;
}

const REGISTRATION_SUBJECT = /registration/i;
const REGISTRATION_CODE = /class="code"[^>]*>\s*([A-Za-z0-9]+)\s*</;
const MESSAGE_TIMEOUT_MS = 90_000;
const MESSAGE_POLL_INTERVAL_MS = 2_000;

// Production sends a real confirmation email, so registration reads it from a disposable mail.tm inbox
export class MailboxDsl {
    private api?: APIRequestContext;
    private accountId?: string;

    async create(): Promise<Mailbox> {
        const api = await this.context();
        const domainsResponse = await api.get('/domains');
        expect(
            domainsResponse.ok(),
            `Mailbox domains returned HTTP ${domainsResponse.status()}`
        ).toBeTruthy();
        const domains = (await domainsResponse.json())[
            'hydra:member'
        ] as MailTmDomain[];
        const domain = domains.find(
            (candidate) => candidate.isActive && !candidate.isPrivate
        )?.domain;
        expect(domain, 'Mailbox service has no public domain').toBeTruthy();

        // mail.tm rejects some words in a username, including the "auto" of the project prefix
        const address = `lk-e2e-${randomBytes(6).toString('hex')}@${domain}`;
        const password = randomBytes(18).toString('base64url');
        const accountResponse = await api.post('/accounts', {
            data: { address, password },
        });
        expect(
            accountResponse.ok(),
            `Mailbox creation returned HTTP ${accountResponse.status()}`
        ).toBeTruthy();
        this.accountId = (await accountResponse.json()).id;

        const tokenResponse = await api.post('/token', {
            data: { address, password },
        });
        expect(
            tokenResponse.ok(),
            `Mailbox login returned HTTP ${tokenResponse.status()}`
        ).toBeTruthy();
        const { token } = await tokenResponse.json();
        await api.dispose();
        this.api = await request.newContext({
            baseURL: input.mailboxApi,
            extraHTTPHeaders: { Authorization: `Bearer ${token}` },
        });

        return { address };
    }

    async waitForRegistrationCode(): Promise<string> {
        const api = await this.context();
        let code: string | undefined;
        let problem = 'the registration email did not arrive';

        const readCode = async (): Promise<string | undefined> => {
            const listResponse = await api.get('/messages');
            if (!listResponse.ok()) {
                problem = `mail.tm messages returned HTTP ${listResponse.status()}`;
                return undefined;
            }
            const messages = (await listResponse.json())[
                'hydra:member'
            ] as MailTmMessage[];
            const message = messages.find((candidate) =>
                REGISTRATION_SUBJECT.test(candidate.subject)
            );
            if (!message) {
                return undefined;
            }

            const messageResponse = await api.get(`/messages/${message.id}`);
            if (!messageResponse.ok()) {
                problem = `mail.tm message returned HTTP ${messageResponse.status()}`;
                return undefined;
            }
            const { html } = await messageResponse.json();
            const body = [html ?? []].flat().join('');
            const found = body.match(REGISTRATION_CODE)?.[1];
            if (!found) {
                // A changed template must not look like a lost email
                problem = `email "${message.subject}" has no code: ${body.slice(0, 300)}`;
            }
            return found;
        };

        await expect
            .poll(
                async () => {
                    try {
                        code = await readCode();
                    } catch (error) {
                        // expect.poll does not retry a throwing callback, and one network hiccup must not end the wait
                        problem = `mail.tm request failed: ${String(error)}`;
                    }
                    return code;
                },
                {
                    timeout: MESSAGE_TIMEOUT_MS,
                    intervals: [MESSAGE_POLL_INTERVAL_MS],
                }
            )
            .toBeTruthy()
            .catch((error: Error) => {
                throw new Error(
                    `Registration code was not received, last problem: ${problem}`,
                    { cause: error }
                );
            });

        return code as string;
    }

    async dispose(): Promise<void> {
        if (this.api && this.accountId) {
            // The inbox is useless after registration and mail.tm keeps it otherwise
            await this.api
                .delete(`/accounts/${this.accountId}`)
                .catch(() => undefined);
        }
        await this.api?.dispose();
        this.api = undefined;
        this.accountId = undefined;
    }

    private async context(): Promise<APIRequestContext> {
        this.api ??= await request.newContext({ baseURL: input.mailboxApi });
        return this.api;
    }
}
