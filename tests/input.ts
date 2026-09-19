const DEFAULT_HOST = 'https://labkeeper.io';
const DEFAULT_PROJECT_PREFIX = 'e2e-autotest';

// Without them a flag could only be switched off by deleting its line from .env
const disabledFlagValues = new Set(['0', 'false', 'off', 'no']);

const placeholderValues = new Set([
    '',
    'ваша_почта',
    'ваш_пароль',
    'your_email',
    'your_password',
]);

function optionalEnvironmentValue(name: string): string | undefined {
    const rawValue = process.env[name]?.trim();
    const value =
        rawValue &&
        ((rawValue.startsWith('"') && rawValue.endsWith('"')) ||
            (rawValue.startsWith("'") && rawValue.endsWith("'")))
            ? rawValue.slice(1, -1)
            : rawValue;
    return value && !placeholderValues.has(value) ? value : undefined;
}

function normalizeHost(value: string): string {
    const parsed = new URL(value);

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('E2E_HOST must use http or https');
    }

    return parsed.toString().replace(/\/$/, '');
}

function normalizeProjectPrefix(value: string): string {
    const normalized = value
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');

    if (!normalized) {
        throw new Error('E2E_PROJECT_PREFIX must contain letters or numbers');
    }

    if (normalized.length > 20) {
        throw new Error('E2E_PROJECT_PREFIX must not exceed 20 characters');
    }

    return normalized;
}

const userEmail = optionalEnvironmentValue('E2E_USER_EMAIL');
const userPassword = optionalEnvironmentValue('E2E_USER_PASSWORD');

export const input = Object.freeze({
    host: normalizeHost(process.env.E2E_HOST?.trim() || DEFAULT_HOST),
    captchaBypassToken: optionalEnvironmentValue(
        'E2E_CAPTCHA_BYPASS_TOKEN'
    ),
    userEmail,
    userPassword,
    secondUserEmail: optionalEnvironmentValue('E2E_SECOND_USER_EMAIL'),
    secondUserPassword: optionalEnvironmentValue('E2E_SECOND_USER_PASSWORD'),
    projectPrefix: normalizeProjectPrefix(
        process.env.E2E_PROJECT_PREFIX?.trim() || DEFAULT_PROJECT_PREFIX
    ),
    landingTests: optionalEnvironmentValue('ENABLE_LANDING_TESTS'),
});

// Only production serves the landing, so stands answering / with the editor bundle leave the flag unset
export const landingTestsEnabled =
    input.landingTests !== undefined &&
    !disabledFlagValues.has(input.landingTests.toLowerCase());

export interface UserCredentials {
    email: string;
    password: string;
}

export function requireUserCredentials(): UserCredentials {
    if (!input.userEmail || !input.userPassword) {
        throw new Error(
            'Authenticated tests require E2E_USER_EMAIL and E2E_USER_PASSWORD'
        );
    }

    return {
        email: input.userEmail,
        password: input.userPassword,
    };
}

export function secondUserCredentials(): UserCredentials | undefined {
    if (!input.secondUserEmail && !input.secondUserPassword) {
        return undefined;
    }

    if (!input.secondUserEmail || !input.secondUserPassword) {
        throw new Error(
            'Both E2E_SECOND_USER_EMAIL and E2E_SECOND_USER_PASSWORD are required'
        );
    }

    if (input.secondUserEmail === input.userEmail) {
        throw new Error('The second E2E user must use a different email');
    }

    return {
        email: input.secondUserEmail,
        password: input.secondUserPassword,
    };
}

export function editorPath(path = '/project/default'): string {
    if (!input.captchaBypassToken) {
        return path;
    }

    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}captcha=${encodeURIComponent(input.captchaBypassToken)}`;
}
