import { describeTestCategories } from './categories';

// Runs once in the main process before any worker starts, so the list is printed once per run.
// It goes to stderr: a reporter writing JSON to stdout would otherwise get it mixed into the report
export default function globalSetup(): void {
    process.stderr.write(`${describeTestCategories()}\n`);
}
