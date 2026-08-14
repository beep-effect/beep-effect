import { isEffectDiagnosticsDirectiveForTesting } from "@beep/repo-cli/commands/Quality/Quality.command";
import { describe, expect, it } from "vitest";

describe("Effect diagnostics directive policy", () => {
  const directive = ["@effect", "diagnostics"].join("-");

  it.each([
    `// ${directive} strictEffectProvide:off`,
    `/** ${directive} nodeBuiltinImport:skip-file */`,
    `/* ${directive} */`,
    `  // ${directive}-next-line globalConsole:off`,
    `// ${directive}-next-line`,
  ])("rejects every directive form: %s", (line) => {
    expect(isEffectDiagnosticsDirectiveForTesting(line)).toBe(true);
  });

  it.each([
    `const prefix = "${directive}";`,
    `Historical prose mentions ${directive} without being a directive.`,
    "// ordinary comment",
  ])("ignores non-directive mentions: %s", (line) => {
    expect(isEffectDiagnosticsDirectiveForTesting(line)).toBe(false);
  });
});
