import { collectTsgoPluginProfileDiagnosticsForTesting } from "@beep/repo-cli/commands/Quality/Quality.command";
import { describe, expect, it } from "vitest";

const BaseDiagnosticSeverity = {
  missedPipeableOpportunity: "error",
  missingPipeableSignature: "error",
  correctnessRule: "error",
};

const BasePlugin = {
  name: "@effect/language-service",
  includeSuggestionsInTsc: true,
  diagnosticSeverity: BaseDiagnosticSeverity,
};

const ecosystemConfig = (diagnosticSeverity: Readonly<Record<string, unknown>>) => ({
  compilerOptions: {
    plugins: [{ ...BasePlugin, diagnosticSeverity }],
  },
});

const workspaceConfig = (
  plugins: ReadonlyArray<Readonly<Record<string, unknown>>>
): Readonly<Record<string, unknown>> => ({ compilerOptions: { plugins } });

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
      "packages/ecosystem/member/tsconfig.json: ecosystem @effect/language-service profile.diagnosticSeverity does not match tsconfig.base.json",
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
      "packages/ecosystem/member/tsconfig.test.json: ecosystem @effect/language-service profile.diagnosticSeverity does not match tsconfig.base.json",
    ]);
  });

  it("rejects an ecosystem member tsconfig without a local plugin profile", () => {
    const diagnostics = collectTsgoPluginProfileDiagnosticsForTesting(BasePlugin, [
      ["packages/ecosystem/member/tsconfig.test.json", { compilerOptions: {} }],
    ]);

    expect(diagnostics).toEqual([
      "ecosystem member tsconfig packages/ecosystem/member/tsconfig.test.json is missing the @effect/language-service family profile",
    ]);
  });

  it("accepts a canonical Effect profile alongside another compiler plugin", () => {
    expect(
      collectTsgoPluginProfileDiagnosticsForTesting(BasePlugin, [
        ["apps/web/tsconfig.json", workspaceConfig([BasePlugin, { name: "next" }])],
      ])
    ).toEqual([]);
  });

  it("rejects a compiler plugin override that drops the Effect profile", () => {
    const diagnostics = collectTsgoPluginProfileDiagnosticsForTesting(BasePlugin, [
      ["apps/web/tsconfig.json", workspaceConfig([{ name: "next" }])],
      ["packages/shared/member/tsconfig.json", workspaceConfig([])],
    ]);

    expect(diagnostics).toEqual([
      "apps/web/tsconfig.json: compilerOptions.plugins overrides and removes the inherited @effect/language-service plugin",
      "packages/shared/member/tsconfig.json: compilerOptions.plugins overrides and removes the inherited @effect/language-service plugin",
    ]);
  });

  it("rejects drift in a non-ecosystem local Effect profile", () => {
    const diagnostics = collectTsgoPluginProfileDiagnosticsForTesting(BasePlugin, [
      ["apps/web/tsconfig.json", ecosystemConfig({ ...BaseDiagnosticSeverity, missedPipeableOpportunity: "off" })],
    ]);

    expect(diagnostics).toEqual([
      "apps/web/tsconfig.json: @effect/language-service profile.diagnosticSeverity does not match tsconfig.base.json",
    ]);
  });

  it("rejects an inherited config whose extends chain never provides the Effect profile", () => {
    const diagnostics = collectTsgoPluginProfileDiagnosticsForTesting(BasePlugin, [
      ["infra/tsconfig.json", { extends: "./standalone.json" }, []],
    ]);

    expect(diagnostics).toEqual([
      "infra/tsconfig.json: tsconfig inheritance chain does not provide @effect/language-service",
    ]);
  });

  it("rejects a config whose extends chain bypasses the repository base config", () => {
    const diagnostics = collectTsgoPluginProfileDiagnosticsForTesting(BasePlugin, [
      ["packages/example/tsconfig.json", workspaceConfig([BasePlugin]), [BasePlugin], false],
    ]);

    expect(diagnostics).toEqual([
      "packages/example/tsconfig.json: tsconfig extends chain does not reach the repository tsconfig.base.json",
    ]);
  });

  it("rejects a divergent Effect profile inherited from an intermediate config", () => {
    const diagnostics = collectTsgoPluginProfileDiagnosticsForTesting(BasePlugin, [
      [
        "apps/web/tsconfig.json",
        { extends: "./tsconfig.framework.json" },
        [{ ...BasePlugin, includeSuggestionsInTsc: false }],
      ],
    ]);

    expect(diagnostics).toEqual([
      "apps/web/tsconfig.json: inherited @effect/language-service profile.includeSuggestionsInTsc does not match tsconfig.base.json",
    ]);
  });

  it("rejects duplicate Effect language-service entries", () => {
    const diagnostics = collectTsgoPluginProfileDiagnosticsForTesting(BasePlugin, [
      ["apps/web/tsconfig.json", workspaceConfig([BasePlugin, BasePlugin])],
    ]);

    expect(diagnostics).toEqual([
      "apps/web/tsconfig.json: compilerOptions.plugins contains duplicate @effect/language-service entries",
    ]);
  });

  it("rejects drift outside diagnosticSeverity", () => {
    const diagnostics = collectTsgoPluginProfileDiagnosticsForTesting(BasePlugin, [
      ["apps/web/tsconfig.json", workspaceConfig([{ ...BasePlugin, includeSuggestionsInTsc: false }])],
    ]);

    expect(diagnostics).toEqual([
      "apps/web/tsconfig.json: @effect/language-service profile.includeSuggestionsInTsc does not match tsconfig.base.json",
    ]);
  });
});
