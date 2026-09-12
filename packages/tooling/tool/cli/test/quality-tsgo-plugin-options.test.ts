import {
  collectTsgoPluginOptionParityDiagnosticsForTesting,
  extractEffectTsgoReadmePluginOptionNamesForTesting,
} from "@beep/repo-cli/commands/Quality/Quality.command";
import { describe, expect, it } from "vitest";

const readmeWithExample = (pluginJsonc: string): string =>
  [
    "# Effect Language Service",
    "",
    "## Plugin Options",
    "",
    "<!-- example-config:start -->",
    "```jsonc",
    "{",
    '  "compilerOptions": {',
    '    "plugins": [',
    "      {",
    pluginJsonc,
    "      }",
    "    ]",
    "  }",
    "}",
    "```",
    "<!-- example-config:end -->",
    "",
  ].join("\n");

describe("quality tsgo plugin option parity", () => {
  it("reads the documented option names from the README example config, ignoring name and comments", () => {
    const readme = readmeWithExample(
      [
        '        "name": "@effect/language-service",',
        "        // Controls Effect refactors. (default: true)",
        '        "refactors": true,',
        '        "keyPatterns": [{ "target": "service", "pattern": "default", "skipLeadingPath": ["src/"] }],',
        '        "diagnosticSeverity": {},',
        '        "overrides": [],',
      ].join("\n")
    );
    expect(extractEffectTsgoReadmePluginOptionNamesForTesting(readme)).toEqual([
      "diagnosticSeverity",
      "keyPatterns",
      "overrides",
      "refactors",
    ]);
  });

  it("returns no names when the README has no example config", () => {
    expect(extractEffectTsgoReadmePluginOptionNamesForTesting("# README without an example")).toEqual([]);
    expect(
      extractEffectTsgoReadmePluginOptionNamesForTesting(
        "<!-- example-config:start -->\nno fence here\n<!-- example-config:end -->"
      )
    ).toEqual([]);
  });

  it("reports options that are documented but unset, and set but undocumented", () => {
    expect(
      collectTsgoPluginOptionParityDiagnosticsForTesting({
        documentedOptionNames: ["diagnosticSeverity", "overrides", "refactors"],
        plugin: { name: "@effect/language-service", diagnosticSeverity: {}, legacyOption: true },
      })
    ).toEqual([
      "overrides: documented by the installed @effect/tsgo but not set in tsconfig.base.json",
      "refactors: documented by the installed @effect/tsgo but not set in tsconfig.base.json",
      "legacyOption: set in tsconfig.base.json but not documented by the installed @effect/tsgo",
    ]);
  });

  it("is silent when the configured option set equals the documented one", () => {
    expect(
      collectTsgoPluginOptionParityDiagnosticsForTesting({
        documentedOptionNames: ["diagnosticSeverity", "refactors"],
        plugin: { name: "@effect/language-service", refactors: true, diagnosticSeverity: {} },
      })
    ).toEqual([]);
  });
});
