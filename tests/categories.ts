import { agentTestsEnabled, input, landingTestsEnabled } from './input';

export interface TestCategory {
    name: string;
    enabled: boolean;
    variables: string;
}

// Categories that environment variables switch on and off, in the order the run log prints them
export function testCategories(): TestCategory[] {
    return [
        {
            name: 'Authenticated tests',
            enabled: Boolean(input.userEmail && input.userPassword),
            variables: 'E2E_USER_EMAIL, E2E_USER_PASSWORD',
        },
        {
            name: 'Second user scenarios',
            enabled: Boolean(input.secondUserEmail && input.secondUserPassword),
            variables: 'E2E_SECOND_USER_EMAIL, E2E_SECOND_USER_PASSWORD',
        },
        {
            name: 'Login with the captcha bypass',
            enabled: Boolean(input.captchaBypassToken),
            variables: 'E2E_CAPTCHA_BYPASS_TOKEN',
        },
        {
            name: 'Landing and blog scenarios',
            enabled: landingTestsEnabled,
            variables: 'ENABLE_LANDING_TESTS',
        },
        {
            name: 'Agent scenarios (spend tokens)',
            enabled: agentTestsEnabled,
            variables: 'ENABLE_AGENT_TESTS',
        },
    ];
}

export function describeTestCategories(): string {
    const lines = testCategories().map(
        ({ name, enabled, variables }) =>
            `  ${enabled ? 'run ' : 'skip'}  ${name} (${variables})`
    );
    return ['Test categories:', ...lines].join('\n');
}
