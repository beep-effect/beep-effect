import { effectDiagnosticsAffectedPackages } from "@beep/repo-cli/commands/Quality/EffectDiagnostics";
import {
  collectTsgoSeverityDiagnosticsForTesting,
  TsgoDisabledRule,
  tsgoDisabledRules,
} from "@beep/repo-cli/commands/Quality/Quality.command";
import { CoverageScopeOwner, workspaceDependentOwners } from "@beep/repo-cli/test/Quality";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";

const pluginWith = (diagnosticSeverity: Readonly<Record<string, unknown>>, overrides: ReadonlyArray<unknown> = []) => ({
  name: "@effect/language-service",
  overrides,
  diagnosticSeverity,
});

describe("quality tsgo rule severities", () => {
  it("declares stability and import-style exceptions explicitly", () => {
    expect(A.map(tsgoDisabledRules, (disabled) => disabled.rule)).toEqual([
      "apiStabilityLeak",
      "experimentalApiUsage",
      "unstableApiUsage",
      "preferNamespaceImport",
      "preferBarrelImport",
    ]);
    expect(TsgoDisabledRule.make({ rule: "unstableApiUsage", reason: "by design" }).rule).toBe("unstableApiUsage");
  });

  it("accepts error rules and the declared-off rules", () => {
    const severity = {
      floatingEffect: "error",
      apiStabilityLeak: "off",
      experimentalApiUsage: "off",
      unstableApiUsage: "off",
      preferNamespaceImport: "off",
      preferBarrelImport: "off",
      schemaClassMissingBrand: "error",
    };
    expect(
      collectTsgoSeverityDiagnosticsForTesting({ plugin: pluginWith(severity), diagnosticSeverity: severity })
    ).toEqual({
      nonErrorSeverities: [],
      disabledSeverityEntries: [],
    });
  });

  it("rejects a declared-off rule configured at any other severity", () => {
    const severity = { experimentalApiUsage: "warning", unstableApiUsage: "error" };
    expect(
      collectTsgoSeverityDiagnosticsForTesting({ plugin: pluginWith(severity), diagnosticSeverity: severity })
        .nonErrorSeverities
    ).toEqual(["experimentalApiUsage: warning (expected off)", "unstableApiUsage: error (expected off)"]);
  });

  it("rejects an undeclared rule that is not error, and reports its off entry", () => {
    const severity = { floatingEffect: "off", catchIfTagToCatchTag: "suggestion" };
    const result = collectTsgoSeverityDiagnosticsForTesting({
      plugin: pluginWith(severity),
      diagnosticSeverity: severity,
    });
    expect(result.nonErrorSeverities).toEqual([
      "catchIfTagToCatchTag: suggestion (expected error)",
      "floatingEffect: off (expected error)",
    ]);
    expect(result.disabledSeverityEntries).toEqual([
      "compilerOptions.plugins.@effect/language-service.diagnosticSeverity.floatingEffect",
    ]);
  });

  it("reports a declared-off rule switched off inside an override", () => {
    const severity = { unstableApiUsage: "off" };
    const plugin = pluginWith(severity, [{ include: ["test/**"], diagnosticSeverity: { unstableApiUsage: "off" } }]);
    expect(
      collectTsgoSeverityDiagnosticsForTesting({ plugin, diagnosticSeverity: severity }).disabledSeverityEntries
    ).toEqual(["compilerOptions.plugins.@effect/language-service.overrides.[0].diagnosticSeverity.unstableApiUsage"]);
  });
});

describe("Effect diagnostics affected selection", () => {
  const owners = [
    CoverageScopeOwner.make({ packageName: "core", packagePath: "packages/core", hasCoverage: false }),
    CoverageScopeOwner.make({
      packageName: "mid",
      packagePath: "packages/mid",
      hasCoverage: true,
      workspaceDependencies: ["core"],
    }),
    CoverageScopeOwner.make({
      packageName: "lab",
      packagePath: "apps/labs/demo",
      hasCoverage: false,
      workspaceDependencies: ["mid"],
    }),
    CoverageScopeOwner.make({ packageName: "other", packagePath: "packages/other", hasCoverage: true }),
  ];
  it("includes transitive dependents without requiring coverage scripts", () => {
    expect(effectDiagnosticsAffectedPackages(owners, ["packages/core/src/index.ts"])).toEqual(["core", "lab", "mid"]);
  });
  it("supports data-last selection and transitive graph traversal", () => {
    expect(effectDiagnosticsAffectedPackages(["packages/core/src/index.ts"])(owners)).toEqual(["core", "lab", "mid"]);
    expect(workspaceDependentOwners(["core"])(owners)).toEqual(["lab", "mid"]);
  });
  it("selects an edited leaf without unrelated workspaces", () => {
    expect(effectDiagnosticsAffectedPackages(owners, ["apps/labs/demo/test/a.ts"])).toEqual(["lab"]);
  });
  it("treats compiler policy and lockfile changes as global", () => {
    for (const file of [
      "tsconfig.base.json",
      "bun.lock",
      "package.json",
      "packages/tooling/tool/cli/src/commands/Quality/EffectDiagnostics.ts",
    ])
      expect(effectDiagnosticsAffectedPackages(owners, [file])).toEqual(["core", "lab", "mid", "other"]);
  });
  it("does not match sibling prefixes or repository documentation", () => {
    expect(effectDiagnosticsAffectedPackages(owners, ["packages/core-extra/src/a.ts", "docs/a.md"])).toEqual([]);
  });
  it("handles deleted workspace source and duplicate changed paths", () => {
    expect(
      effectDiagnosticsAffectedPackages(owners, ["packages/core/src/deleted.ts", "packages/core/src/deleted.ts"])
    ).toEqual(["core", "lab", "mid"]);
  });
});
