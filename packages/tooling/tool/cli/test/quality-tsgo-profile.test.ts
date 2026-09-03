import {
  collectTsconfigInheritanceDiagnosticsForTesting,
  collectTsgoPluginProfileDiagnosticsForTesting,
} from "@beep/repo-cli/commands/Quality/Quality.command";
import { describe, expect, it } from "vitest";

const BaseDiagnosticSeverity = {
  missedPipeableOpportunity: "error",
  missingPipeableSignature: "error",
  correctnessRule: "error",
};

const BasePlugin = {
  name: "@effect/language-service",
  effectFn: ["span"],
  diagnosticSeverity: BaseDiagnosticSeverity,
};

const configWithPlugins = (plugins: ReadonlyArray<unknown>) => ({
  compilerOptions: { plugins },
});

const EffectDrizzlePlugin = {
  ...BasePlugin,
  diagnosticSeverity: {
    ...BaseDiagnosticSeverity,
    missedPipeableOpportunity: "off",
  },
};

describe("quality tsgo plugin profiles", () => {
  it("accepts the sole Effect Drizzle severity exception", () => {
    expect(
      collectTsgoPluginProfileDiagnosticsForTesting({
        basePlugin: BasePlugin,
        configs: [["packages/ecosystem/effect-drizzle/tsconfig.json", configWithPlugins([EffectDrizzlePlugin])]],
      })
    ).toEqual([]);
  });

  it("rejects another disabled Effect Drizzle rule", () => {
    const diagnostics = collectTsgoPluginProfileDiagnosticsForTesting({
      basePlugin: BasePlugin,
      configs: [
        [
          "packages/ecosystem/effect-drizzle/tsconfig.test.json",
          configWithPlugins([
            {
              ...EffectDrizzlePlugin,
              diagnosticSeverity: { ...EffectDrizzlePlugin.diagnosticSeverity, missingPipeableSignature: "off" },
            },
          ]),
        ],
      ],
    });

    expect(diagnostics).toEqual([
      "packages/ecosystem/effect-drizzle/tsconfig.test.json: Effect Drizzle diagnosticSeverity.missingPipeableSignature must be error; found off",
    ]);
  });

  it("rejects an empty local plugin override", () => {
    expect(
      collectTsgoPluginProfileDiagnosticsForTesting({
        basePlugin: BasePlugin,
        configs: [["scratchpad/example/tsconfig.json", configWithPlugins([])]],
      })
    ).toEqual([
      "scratchpad/example/tsconfig.json: local compilerOptions.plugins replaces the inherited @effect/language-service profile",
    ]);
  });

  it("accepts an exact Effect profile alongside Next", () => {
    expect(
      collectTsgoPluginProfileDiagnosticsForTesting({
        basePlugin: BasePlugin,
        configs: [["apps/example/tsconfig.json", configWithPlugins([BasePlugin, { name: "next" }])]],
      })
    ).toEqual([]);
  });

  it("rejects a stale local profile copy", () => {
    expect(
      collectTsgoPluginProfileDiagnosticsForTesting({
        basePlugin: BasePlugin,
        configs: [["apps/example/tsconfig.json", configWithPlugins([{ ...BasePlugin, effectFn: [] }])]],
      })
    ).toEqual([
      "apps/example/tsconfig.json: local @effect/language-service profile must exactly match tsconfig.base.json",
    ]);
  });

  it("rejects a duplicate Effect plugin", () => {
    expect(
      collectTsgoPluginProfileDiagnosticsForTesting({
        basePlugin: BasePlugin,
        configs: [["apps/example/tsconfig.json", configWithPlugins([BasePlugin, BasePlugin])]],
      })
    ).toEqual([
      "apps/example/tsconfig.json: compilerOptions.plugins must contain @effect/language-service exactly once",
    ]);
  });
});

describe("quality tsgo inheritance", () => {
  it("accepts indirect inheritance through a root tsconfig", () => {
    expect(
      collectTsconfigInheritanceDiagnosticsForTesting([
        ["tsconfig.base.json", {}],
        ["tsconfig.json", { extends: "./tsconfig.base.json" }],
        ["packages/shared/example/tsconfig.json", { extends: "../../../tsconfig.json" }],
      ])
    ).toEqual([]);
  });

  it("rejects an extends chain with a missing base config", () => {
    expect(
      collectTsconfigInheritanceDiagnosticsForTesting([
        ["packages/shared/example/tsconfig.json", { extends: "../../../tsconfig.base.json" }],
      ])
    ).toEqual([
      "packages/shared/example/tsconfig.json: tsconfig extends chain references missing config tsconfig.base.json",
    ]);
  });

  it("rejects a config that bypasses the base profile", () => {
    expect(
      collectTsconfigInheritanceDiagnosticsForTesting([
        ["tsconfig.base.json", {}],
        ["packages/shared/example/tsconfig.json", {}],
      ])
    ).toEqual(["packages/shared/example/tsconfig.json: tsconfig extends chain does not reach tsconfig.base.json"]);
  });

  it("excludes deliberate fixture and standalone infrastructure configs", () => {
    expect(
      collectTsconfigInheritanceDiagnosticsForTesting([
        ["packages/tooling/example/test/fixtures/project/tsconfig.json", {}],
        ["infra/lambda/turbo-cache/tsconfig.json", {}],
        ["infra/ci-runners/sdks/ghaRunners/tsconfig.json", {}],
      ])
    ).toEqual([]);
  });
});
