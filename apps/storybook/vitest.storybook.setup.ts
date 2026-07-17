// Minimal `process` shim for the headless Storybook browser test environment.
// Some components pull in Next.js modules (e.g. `next/link` in the tour component)
// whose module-level code references the Node `process` global. In the browser
// test runtime `process` is undefined, so importing those story files throws
// `ReferenceError: process is not defined`. Defining a minimal stub before any
// story module is imported lets those imports succeed (the Next-specific code
// paths are never exercised by the stories themselves).
const globalWithProcess = globalThis as unknown as {
  process?: unknown;
};

if (globalWithProcess.process === undefined) {
  globalWithProcess.process = { env: { NODE_ENV: "production" } };
}
