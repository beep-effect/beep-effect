import { afterAll } from "vitest";

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

// Regression guard: react-grab must never initialize in the browser test
// runtime. `.storybook/preview.tsx` only imports it when `MODE !== "test"`;
// if that guard breaks, the overlay enters addon-a11y's document.body scan and
// freezes React updates mid-play-function. Checked in `afterAll` so any
// dynamic import kicked off during preview evaluation has resolved by then.
afterAll(() => {
  if ((globalThis as { __REACT_GRAB__?: unknown }).__REACT_GRAB__ !== undefined) {
    throw new Error(
      "react-grab leaked into the Storybook browser test runtime; check the MODE guard in .storybook/preview.tsx"
    );
  }
});
