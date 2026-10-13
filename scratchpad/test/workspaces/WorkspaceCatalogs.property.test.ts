import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
const JsonValue = S.fromJsonString(S.Unknown);

const runs = { arbitrary: fcRuns(100) };
const roundTrip = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(`${name}: decoding encoded values succeeds and preserves the value`, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assert.isTrue(S.toEquivalence(schema)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};
import { CatalogSet, ImporterVersions, WorkspaceCatalogsOptions } from "../../effected/workspaces/WorkspaceCatalogs.ts";
describe("WorkspaceCatalogs property floor", () => {
  roundTrip("CatalogSet", CatalogSet);
  roundTrip("ImporterVersions", ImporterVersions);
  roundTrip("WorkspaceCatalogsOptions", WorkspaceCatalogsOptions);
});

import { Yaml } from "../../effected/yaml/index.ts";
describe("catalog parser fidelity", () => {
  it.effect.prop("Bun's inline default overrides overlapping ranges and preserves other catalog entries", [Arbitrary.schema(S.Struct({
    recorded: S.Literals(["^3.0.0", "~3.1.0"]),
    inline: S.Literals(["^4.0.0", "~4.1.0"]),
    sibling: S.Literals(["^6.0.0", "~6.1.0"]),
  }))], ([{ recorded, inline, sibling }]) => Effect.gen(function* () {
    const blocks = {
      catalogs: {
        default: { effect: recorded, typescript: sibling },
        build: { effect: recorded },
      },
      catalog: { effect: inline },
    };
    const catalogs = CatalogSet.fromBunBlocks(blocks);
    assert.deepStrictEqual(catalogs.entries, {
      default: { effect: inline, typescript: sibling },
      build: { effect: recorded },
    });
    assert.deepStrictEqual(CatalogSet.fromBunBlocks({ catalogs: catalogs.entries }).entries, catalogs.entries);
    assert.deepStrictEqual(blocks.catalogs.default, { effect: recorded, typescript: sibling });
  }), runs);

  it.effect.prop("catalog normalization is idempotent and both manifest parsers preserve normalized ranges", [Arbitrary.schema(CatalogSet)], ([value]) => Effect.gen(function* () {
    const normalized = CatalogSet.fromCatalogs(value.entries);
    assert.deepStrictEqual(CatalogSet.fromCatalogs(normalized.entries).entries, normalized.entries);
    const json = yield* S.encodeEffect(JsonValue)({ catalogs: normalized.entries });
    const parsed = yield* CatalogSet.fromManifestWorkspaces(json);
    assert.deepStrictEqual(parsed.entries, normalized.entries);
    const reparsed = yield* CatalogSet.fromManifestWorkspaces(yield* S.encodeEffect(JsonValue)({ catalogs: parsed.entries }));
    assert.deepStrictEqual(reparsed.entries, parsed.entries);
    const yamlParsed = yield* CatalogSet.fromWorkspaceYaml(yield* Yaml.stringify({ catalogs: normalized.entries }));
    assert.deepStrictEqual(yamlParsed.entries, normalized.entries);
    const yamlReparsed = yield* CatalogSet.fromWorkspaceYaml(yield* Yaml.stringify({ catalogs: yamlParsed.entries }));
    assert.deepStrictEqual(yamlReparsed.entries, yamlParsed.entries);
  }), runs);
});
