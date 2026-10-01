import {
  collectTsgoSeverityDiagnosticsForTesting,
  TsgoDisabledRule,
  tsgoDisabledRules,
} from "@beep/repo-cli/commands/Quality/Quality.command";
import { describe, expect, it } from "vitest";

const pluginWith = (diagnosticSeverity: Readonly<Record<string, unknown>>, overrides: ReadonlyArray<unknown> = []) => ({
  name: "@effect/language-service",
  overrides,
  diagnosticSeverity,
});

describe("quality tsgo rule severities", () => {
  it("declares exactly the two stability rules as off", () => {
    expect(tsgoDisabledRules.map((disabled) => disabled.rule)).toEqual(["experimentalApiUsage", "unstableApiUsage"]);
    expect(TsgoDisabledRule.make({ rule: "unstableApiUsage", reason: "by design" }).rule).toBe("unstableApiUsage");
  });

  it("accepts error rules and the declared-off stability rules", () => {
    const severity = { floatingEffect: "error", experimentalApiUsage: "off", unstableApiUsage: "off" };
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
