import { RULE_NAMES, RULES, RuleRegistrySchema, rulePath, rulesDir } from "@beep/lint-rules";
import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import { Effect, FileSystem, Path } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const BiomePluginSection = S.Struct({ plugins: S.Array(S.String).pipe(S.optionalKey) });
const BiomePluginConfig = S.Struct({
  ...BiomePluginSection.fields,
  overrides: S.Array(BiomePluginSection).pipe(S.optionalKey),
});
const decodeBiomePluginConfig = decodeJsoncTextAs(BiomePluginConfig);

const sortedRuleNames = [...RULE_NAMES].sort();
const RuleRegistryArbitrary = Arbitrary.schema(RuleRegistrySchema);
const decodeRuleRegistry = S.decodeUnknownEffect(RuleRegistrySchema);
const encodeRuleRegistry = S.encodeEffect(RuleRegistrySchema);

/** Repo root (five levels up from `test/registry.test.ts`). */
const repoRoot = decodeURIComponent(new URL("../../../../../", import.meta.url).pathname);

describe("rule registry", () => {
  it("RULES keys match RULE_NAMES exactly", () => {
    expect(Object.keys(RULES).sort()).toEqual(sortedRuleNames);
  });

  it.layer(NodeServices.layer, { timeout: "10 seconds" })((it) =>
    it.effect("every registered rule has a non-empty .grit file declaring `language js`", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        for (const name of RULE_NAMES) {
          const file = rulePath(name);
          const exists = yield* fs.exists(file);
          expect(exists, `${name}.grit must exist`).toBe(true);
          const content = yield* fs.readFileString(file);
          expect(content.includes("language js"), `${name}.grit must declare language js`).toBe(true);
          expect(content.includes("register_diagnostic"), `${name}.grit must register a diagnostic`).toBe(true);
        }
      })
    )
  );

  it.layer(NodeServices.layer, { timeout: "10 seconds" })((it) =>
    it.effect("has no orphan .grit files missing from the registry", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const entries = yield* fs.readDirectory(rulesDir());
        const gritFiles = entries
          .filter((f) => f.endsWith(".grit"))
          .map((f) => path.basename(f, ".grit"))
          .sort();
        expect(gritFiles).toEqual(sortedRuleNames);
      })
    )
  );

  it("every rule metadata entry is self-consistent", () => {
    for (const name of RULE_NAMES) {
      expect(RULES[name].name).toBe(name);
      expect(["warn", "error"]).toContain(RULES[name].severity);
      expect(RULES[name].summary.length).toBeGreaterThan(0);
    }
    RULES["no-native-error"].replaces.pipe(O.isSome, assertTrue);
    assertNone(RULES["no-bigint-literals"].replaces);
  });

  it.effect(
    "preserves the encoded rule registry wire shape",
    Effect.fnUntraced(function* () {
      expect(yield* encodeRuleRegistry(RULES)).toEqual({
        "no-native-error": {
          name: "no-native-error",
          severity: "error",
          replaces: "lint tooling-tagged-errors",
          summary: "Disallow native Error construction in tooling source; use S.TaggedError from effect/Schema.",
          scope: "packages/tooling/**/src/**",
        },
        "no-bigint-literals": {
          name: "no-bigint-literals",
          severity: "warn",
          replaces: null,
          summary: "Disallow bigint literals (1n, 0xFFn, ...); use BigInt(value).",
          scope: "**/src/**",
        },
        "no-empty-named-blocks": {
          name: "no-empty-named-blocks",
          severity: "error",
          replaces: null,
          summary: 'Disallow empty named import blocks: `import {} from "..."`.',
          scope: null,
        },
        "prefer-array-flat-map": {
          name: "prefer-array-flat-map",
          severity: "error",
          replaces: null,
          summary: "Prefer `.flatMap(f)` over `.map(f).flat()`.",
          scope: null,
        },
      });
    })
  );

  it.effect.prop(
    "round-trips schema-derived rule registries",
    [RuleRegistryArbitrary],
    Effect.fnUntraced(function* ([registry]) {
      expect(yield* decodeRuleRegistry(yield* encodeRuleRegistry(registry))).toEqual(registry);
    }),
    { arbitrary: fcRuns(50) }
  );

  it.layer(NodeServices.layer, { timeout: "10 seconds" })((it) =>
    it.effect("every rule is wired into the repo-root biome.jsonc lint pass", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const biomeConfig = yield* fs.readFileString(path.join(repoRoot, "biome.jsonc"));
        const config = yield* decodeBiomePluginConfig(biomeConfig);
        const plugins = [
          ...(config.plugins ?? []),
          ...(config.overrides ?? []).flatMap((override) => override.plugins ?? []),
        ].map((plugin) => path.resolve(repoRoot, plugin));
        for (const name of RULE_NAMES) {
          expect(plugins, `${name} must be registered in biome.jsonc`).toContain(rulePath(name));
        }
      })
    )
  );
});
