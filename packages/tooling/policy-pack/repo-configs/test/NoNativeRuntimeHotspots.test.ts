import {
  isNoNativeRuntimeErrorFile,
  isNoNativeRuntimeExtraCheckHotspot,
  NO_NATIVE_RUNTIME_ERROR_FILES,
  NO_NATIVE_RUNTIME_EXTRA_CHECK_PATTERNS,
} from "@beep/repo-configs/eslint/NoNativeRuntimeHotspots";
import { describe, expect, it } from "@effect/vitest";

describe("NoNativeRuntimeHotspots", () => {
  it("keeps ontology files and explicit legacy files in blocking scope", () => {
    expect(isNoNativeRuntimeErrorFile("scratchpad/effect-ontology/Runtime/HttpServer.ts")).toBe(true);
    expect(isNoNativeRuntimeErrorFile(NO_NATIVE_RUNTIME_ERROR_FILES[0])).toBe(true);
    expect(isNoNativeRuntimeErrorFile("packages/law-practice/domain/src/index.ts")).toBe(false);
  });

  it("matches ontology TypeScript files and explicit extra-check hotspots", () => {
    expect(isNoNativeRuntimeExtraCheckHotspot("scratchpad/effect-ontology/Runtime/HttpServer.ts")).toBe(true);
    expect(isNoNativeRuntimeExtraCheckHotspot("scratchpad/effect-ontology/App.tsx")).toBe(true);
    expect(isNoNativeRuntimeExtraCheckHotspot("tooling/cli/src/commands/Laws/index.ts")).toBe(true);
    expect(isNoNativeRuntimeExtraCheckHotspot("scratchpad/effect-ontology/README.md")).toBe(false);
    expect(isNoNativeRuntimeExtraCheckHotspot("packages/law-practice/domain/src/index.ts")).toBe(false);
    expect(NO_NATIVE_RUNTIME_EXTRA_CHECK_PATTERNS).not.toHaveLength(0);
  });
});
