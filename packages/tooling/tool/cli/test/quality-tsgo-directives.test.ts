import {
  isEffectDiagnosticsDirectiveForTesting,
  isRejectedEffectDiagnosticsDirectiveForTesting,
} from "@beep/repo-cli/commands/Quality/Quality.command";
import { pipe } from "effect";
import { describe, expect, it } from "vitest";

describe("Effect diagnostics directive policy", () => {
  const directive = ["@effect", "diagnostics"].join("-");
  const conformancePath = "packages/tooling/test-kit/test-utils/src/FileSystemConformance.ts";
  const conformanceDirective = `// ${directive} strictEffectProvide:skip-file`;

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
