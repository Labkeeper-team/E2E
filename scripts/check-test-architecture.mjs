import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const testsDirectory = path.join(root, 'tests');

async function filesUnder(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const result = [];

    for (const entry of entries) {
        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            result.push(...(await filesUnder(absolutePath)));
        } else if (entry.name.endsWith('.ts')) {
            result.push(absolutePath);
        }
    }

    return result;
}

const testFiles = await filesUnder(testsDirectory);
const violations = [];

const forbiddenNetworkPatterns = [
    ['page.route', /\bpage\.route\s*\(/],
    ['context.route', /\bcontext\.route\s*\(/],
    ['route.fulfill', /\broute\.fulfill\s*\(/],
    ['route.abort', /\broute\.abort\s*\(/],
];

const forbiddenSpecPatterns = [
    ['page fixture', /\{[^}]*\bpage\b[^}]*\}/],
    ['direct locator', /\.locator\s*\(/],
    ['direct role query', /\.getByRole\s*\(/],
    ['direct text query', /\.getByText\s*\(/],
    ['direct placeholder query', /\.getByPlaceholder\s*\(/],
];

// Only production serves the landing, so a spec reaching it must stay behind ENABLE_LANDING_TESTS
const requiredSpecPatterns = [
    [
        'landing gate on landingTestsEnabled',
        /\bapp\.landing\b/,
        /\blandingTestsEnabled\b/,
    ],
];

for (const file of testFiles) {
    const source = await readFile(file, 'utf8');
    const relativePath = path.relative(root, file);

    for (const [label, pattern] of forbiddenNetworkPatterns) {
        if (pattern.test(source)) {
            violations.push(`${relativePath}: forbidden ${label}`);
        }
    }

    if (file.endsWith('.spec.ts')) {
        for (const [label, pattern] of forbiddenSpecPatterns) {
            if (pattern.test(source)) {
                violations.push(`${relativePath}: forbidden ${label}`);
            }
        }

        for (const [label, trigger, required] of requiredSpecPatterns) {
            if (trigger.test(source) && !required.test(source)) {
                violations.push(`${relativePath}: missing ${label}`);
            }
        }
    }
}

if (violations.length > 0) {
    process.stderr.write(`${violations.join('\n')}\n`);
    process.exitCode = 1;
} else {
    process.stdout.write('Test architecture checks passed\n');
}
