import { doctestFenceInfo, doctestSourceMarker, isDoctestSourcePath } from "@beep/repo-utils/JSDoc/DoctestSource";
import { describe, expect, it } from "@effect/vitest";

describe("DoctestSource", () => {
  it("admits only workspace source files under src, in either TypeScript flavour", () => {
    expect(isDoctestSourcePath("packages/example/src/index.ts")).toBe(true);
    expect(isDoctestSourcePath("apps/example/src/App.tsx")).toBe(true);
    expect(isDoctestSourcePath("packages/example/src/index.d.ts")).toBe(false);
    expect(isDoctestSourcePath("packages/example/src/index.js")).toBe(false);
    expect(isDoctestSourcePath("scripts/src/index.ts")).toBe(false);
    expect(isDoctestSourcePath("packages/example/test/index.ts")).toBe(false);
    expect(isDoctestSourcePath("packages/example/src/test/fixtures/index.ts")).toBe(false);
    expect(isDoctestSourcePath("packages/example/src/node_modules/dep/index.ts")).toBe(false);
    expect(isDoctestSourcePath("packages/example/src/.context/index.ts")).toBe(false);
  });

  it("names the in-source marker and builds a named doctest fence", () => {
    expect(doctestSourceMarker).toBe("import.meta.vitest");
    expect(doctestFenceInfo("Add numbers")).toBe('ts import.meta.vitest name="Add numbers"');
  });
});
