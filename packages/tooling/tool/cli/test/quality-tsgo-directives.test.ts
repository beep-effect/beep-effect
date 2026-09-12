import {
  effectDiagnosticsDirectiveExemptions,
  isEffectDiagnosticsDirectiveForTesting,
  isRejectedEffectDiagnosticsDirectiveForTesting,
} from "@beep/repo-cli/commands/Quality/Quality.command";
import { pipe } from "effect";
import * as A from "effect/Array";
import { describe, expect, it } from "vitest";

describe("Effect diagnostics directive policy", () => {
  const directive = ["@effect", "diagnostics"].join("-");
  const conformancePath = "packages/tooling/test-kit/test-utils/src/FileSystemConformance.ts";
  const conformanceDirective = `// ${directive} strictEffectProvide:skip-file`;
  const shimPath = "vitest.setup.ts";
  const shimRules = ["nodeBuiltinImport", "asyncFunction", "newPromise", "processEnv", "globalTimers", "globalRandom"];

  it("declares exactly two exemptions: the root Bun shim and the D14 conformance entrypoint", () => {
    expect(A.map(effectDiagnosticsDirectiveExemptions, (exemption) => exemption.path)).toEqual([
      shimPath,
      conformancePath,
    ]);
    expect(A.map(effectDiagnosticsDirectiveExemptions, (exemption) => [...exemption.rules])).toEqual([
      shimRules,
      ["strictEffectProvide"],
    ]);
  });

  it.each(shimRules)("admits the exact %s skip-file line at the root Bun shim only", (rule) => {
    const line = `// ${directive} ${rule}:skip-file`;
    expect(isEffectDiagnosticsDirectiveForTesting(line)).toBe(true);
    expect(isRejectedEffectDiagnosticsDirectiveForTesting(line, shimPath)).toBe(false);
    expect(isRejectedEffectDiagnosticsDirectiveForTesting(line, conformancePath)).toBe(true);
    expect(isRejectedEffectDiagnosticsDirectiveForTesting(line, "packages/example/src/main.ts")).toBe(true);
    expect(isRejectedEffectDiagnosticsDirectiveForTesting(`${line} -- reason`, shimPath)).toBe(true);
    expect(isRejectedEffectDiagnosticsDirectiveForTesting(`// ${directive}-next-line ${rule}:off`, shimPath)).toBe(
      true
    );
  });

  it("rejects the conformance rule at the shim path and unrelated rules at both exempt paths", () => {
    expect(isRejectedEffectDiagnosticsDirectiveForTesting(conformanceDirective, shimPath)).toBe(true);
    expect(isRejectedEffectDiagnosticsDirectiveForTesting(`// ${directive} schemaNumber:skip-file`, shimPath)).toBe(
      true
    );
    expect(
      isRejectedEffectDiagnosticsDirectiveForTesting(`// ${directive} schemaNumber:skip-file`, conformancePath)
    ).toBe(true);
  });

  it.each([
    `// ${directive} strictEffectProvide:off`,
    `/** ${directive} nodeBuiltinImport:skip-file */`,
    `/* ${directive} */`,
    `  // ${directive}-next-line globalConsole:off`,
    `// ${directive}-next-line`,
  ])("recognizes every directive form and rejects it by default: %s", (line) => {
    expect(isEffectDiagnosticsDirectiveForTesting(line)).toBe(true);
    expect(isRejectedEffectDiagnosticsDirectiveForTesting(line, "packages/example/src/main.ts")).toBe(true);
  });

  it("allows only the canonical conformance entrypoint directive without changing recognition", () => {
    expect(isEffectDiagnosticsDirectiveForTesting(conformanceDirective)).toBe(true);
    expect(isRejectedEffectDiagnosticsDirectiveForTesting(conformanceDirective, conformancePath)).toBe(false);
    expect(pipe(conformanceDirective, isRejectedEffectDiagnosticsDirectiveForTesting(conformancePath))).toBe(false);
  });

  it.each([
    "packages/tooling/test-kit/test-utils/src/MemoryFileSystem.ts",
    "packages/example/src/FileSystemConformance.ts",
    "packages/tooling/test-kit/test-utils/src/internal/FileSystemConformance.ts",
    "packages/tooling/test-kit/test-utils/test/fixtures/FileSystemConformance.ts",
    `fixtures/${conformancePath}`,
    `${conformancePath}x`,
    `${conformancePath}/index.ts`,
    `./${conformancePath}`,
    `/${conformancePath}`,
    "packages/tooling/test-kit/test-utils/src/filesystemConformance.ts",
  ])("rejects the canonical directive at another path: %s", (filePath) => {
    expect(isRejectedEffectDiagnosticsDirectiveForTesting(conformanceDirective, filePath)).toBe(true);
    expect(pipe(conformanceDirective, isRejectedEffectDiagnosticsDirectiveForTesting(filePath))).toBe(true);
  });

  it.each([
    `// ${directive} nodeBuiltinImport:skip-file`,
    `${conformanceDirective} nodeBuiltinImport:skip-file`,
    `${conformanceDirective},nodeBuiltinImport:skip-file`,
    `// ${directive} nodeBuiltinImport:skip-file strictEffectProvide:skip-file`,
    `${conformanceDirective} strictEffectProvide:skip-file`,
    `// ${directive}-next-line strictEffectProvide:skip-file`,
    `// ${directive}-next-line strictEffectProvide:off`,
    `// ${directive}-next-line`,
    `// ${directive} strictEffectProvide:off`,
    `// ${directive} off`,
    `// ${directive} *:off`,
    `// ${directive}`,
    `/* ${directive} strictEffectProvide:skip-file */`,
    `/** ${directive} strictEffectProvide:skip-file */`,
    `//${directive} strictEffectProvide:skip-file`,
    `// ${directive}  strictEffectProvide:skip-file`,
    `// ${directive} strictEffectProvide: skip-file`,
    `// ${directive} strictEffectProvide:skip-next-line`,
    ` ${conformanceDirective}`,
    `${conformanceDirective} `,
    `${conformanceDirective} // reason`,
  ])("rejects unapproved directives even at the conformance path: %s", (line) => {
    expect(isEffectDiagnosticsDirectiveForTesting(line)).toBe(true);
    expect(isRejectedEffectDiagnosticsDirectiveForTesting(line, conformancePath)).toBe(true);
  });

  it.each([
    `const prefix = "${directive}";`,
    `Historical prose mentions ${directive} without being a directive.`,
    "// ordinary comment",
  ])("ignores non-directive mentions: %s", (line) => {
    expect(isEffectDiagnosticsDirectiveForTesting(line)).toBe(false);
    expect(isRejectedEffectDiagnosticsDirectiveForTesting(line, conformancePath)).toBe(false);
    expect(isRejectedEffectDiagnosticsDirectiveForTesting(line, "packages/example/src/main.ts")).toBe(false);
  });
});
