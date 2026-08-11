import { collectTsgoPluginProfileDiagnosticsForTesting } from "@beep/repo-cli/commands/Quality/Quality.command";
import { describe, expect, it } from "vitest";

const BaseDiagnosticSeverity = {
  missedPipeableOpportunity: "error",
  missingPipeableSignature: "error",
  correctnessRule: "error",
};

const BasePlugin = {
  name: "@effect/language-service",
  diagnosticSeverity: BaseDiagnosticSeverity,
};

const ecosystemConfig = (diagnosticSeverity: Readonly<Record<string, unknown>>) => ({
  compilerOptions: {
    plugins: [{ ...BasePlugin, diagnosticSeverity }],
  },
});

const ConformingDiagnosticSeverity = {
  ...BaseDiagnosticSeverity,
  missedPipeableOpportunity: "off",
  missingPipeableSignature: "off",
};

describe("quality tsgo ecosystem plugin profiles", () => {
  it("accepts the exact ecosystem family delta", () => {
    expect(
      collectTsgoPluginProfileDiagnosticsForTesting(BasePlugin, [
        ["packages/ecosystem/member/tsconfig.json", ecosystemConfig(ConformingDiagnosticSeverity)],
      ])
    ).toEqual([]);
  });

  it("rejects an extra disabled rule", () => {
    const diagnostics = collectTsgoPluginProfileDiagnosticsForTesting(BasePlugin, [
      [
        "packages/ecosystem/member/tsconfig.json",
        ecosystemConfig({ ...ConformingDiagnosticSeverity, correctnessRule: "off" }),
      ],
    ]);

    expect(diagnostics).toEqual([
      "packages/ecosystem/member/tsconfig.json: ecosystem diagnosticSeverity.correctnessRule must be error; found off",
    ]);
  });

  it("rejects a missing ecosystem rule", () => {
    const diagnostics = collectTsgoPluginProfileDiagnosticsForTesting(BasePlugin, [
      [
        "packages/ecosystem/member/tsconfig.test.json",
        ecosystemConfig({ missedPipeableOpportunity: "off", correctnessRule: "error" }),
      ],
    ]);

    expect(diagnostics).toEqual([
      "packages/ecosystem/member/tsconfig.test.json: ecosystem diagnosticSeverity is missing rule missingPipeableSignature",
    ]);
  });

  it("rejects non-ecosystem package plugin overrides", () => {
    const diagnostics = collectTsgoPluginProfileDiagnosticsForTesting(BasePlugin, [
      ["packages/shared/member/tsconfig.json", ecosystemConfig(BaseDiagnosticSeverity)],
    ]);

    expect(diagnostics).toEqual([
      "packages/shared/member/tsconfig.json: package tsconfigs may override @effect/language-service only under packages/ecosystem/<member>/tsconfig*.json",
    ]);
  });
});
