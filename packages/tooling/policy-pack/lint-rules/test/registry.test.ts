import { RULE_NAMES, RULES, RuleRegistrySchema, rulePath, rulesDir } from "@beep/lint-rules";
import { fcRuns } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Path } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { describe, expect, it } from "vitest";
import { provideScopedLayer } from "./harness.ts";

const run = <A, E>(program: Effect.Effect<A, E, NodeServices.NodeServices>): Promise<A> =>
  Effect.runPromise(program.pipe(provideScopedLayer(NodeServices.layer)));

const sortedRuleNames = [...RULE_NAMES].sort();
const RuleRegistryArbitrary = S.toArbitrary(RuleRegistrySchema)(fc);
const decodeRuleRegistry = S.decodeUnknownSync(RuleRegistrySchema);
const encodeRuleRegistry = S.encodeSync(RuleRegistrySchema);

/** Repo root (five levels up from `test/registry.test.ts`). */
const repoRoot = decodeURIComponent(new URL("../../../../../", import.meta.url).pathname);

describe("rule registry", () => {
  it("RULES keys match RULE_NAMES exactly", () => {
    expect(Object.keys(RULES).sort()).toEqual(sortedRuleNames);
  });

  it("every registered rule has a non-empty .grit file declaring `language js`", () =>
    run(
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
    ));

  it("has no orphan .grit files missing from the registry", () =>
    run(
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
    ));

  it("every rule metadata entry is self-consistent", () => {
    for (const name of RULE_NAMES) {
      expect(RULES[name].name).toBe(name);
      expect(["warn", "error"]).toContain(RULES[name].severity);
      expect(RULES[name].summary.length).toBeGreaterThan(0);
    }
    expect(O.isSome(RULES["no-native-error"].replaces)).toBe(true);
    expect(O.isNone(RULES["no-bigint-literals"].replaces)).toBe(true);
  });

  it("preserves the encoded rule registry wire shape", () => {
    expect(JSON.stringify(encodeRuleRegistry(RULES))).toBe(
      JSON.stringify({
        "no-native-error": {
          name: "no-native-error",
          severity: "error",
          replaces: "lint tooling-tagged-errors",
          summary: "Disallow native Error construction in tooling source; use TaggedErrorClass.",
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
      })
    );
  });

  it("round-trips schema-derived rule registries", () => {
    fc.assert(
      fc.property(RuleRegistryArbitrary, (registry) => {
        expect(decodeRuleRegistry(encodeRuleRegistry(registry))).toEqual(registry);
      }),
      fcRuns(50)
    );
  });

  it("every rule is wired into the repo-root biome.jsonc lint pass", () =>
    run(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        // biome.jsonc is JSONC (comments); assert the plugin path substring is present —
        // this covers both the top-level `plugins` array and any `overrides[].plugins`.
        const biomeConfig = yield* fs.readFileString(path.join(repoRoot, "biome.jsonc"));
        for (const name of RULE_NAMES) {
          const pluginRef = `rules/${name}.grit`;
          expect(biomeConfig.includes(pluginRef), `${name} must be registered in biome.jsonc (${pluginRef})`).toBe(
            true
          );
        }
      })
    ));
});
