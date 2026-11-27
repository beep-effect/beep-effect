import { afterAll } from "vitest";

// decision: preview-only-component-grabbing
// decision: browser-process-shim
const globalWithProcess = globalThis as unknown as {
  process?: unknown;
};

if (globalWithProcess.process === undefined) {
  globalWithProcess.process = { env: { NODE_ENV: "production" } };
}

afterAll(() => {
  if ((globalThis as { __REACT_GRAB__?: unknown }).__REACT_GRAB__ !== undefined) {
    throw new Error(
      "react-grab leaked into the Storybook browser test runtime; check the MODE guard in .storybook/preview.tsx"
    );
  }
});
