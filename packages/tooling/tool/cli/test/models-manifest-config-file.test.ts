// The models manifest store reads through `@beep/config-file` (`ConfigFile.read`
// with `YamlCodec`, effected-promotion wave 3, W3-e). These cases pin the
// adoption:
//
// - parity: every manifest fixture loads to the manifest an independent reader
//   produces (`effect/encoding/Yaml` `parse`, then the schema decode; until R4
//   the npm `yaml` `parseDocument(...).toJS()` the store used before W3-e);
// - round trip: what the writers emit (the `@beep/yaml` stringifier since R4)
//   loads back to the same manifest, for every fixture and for the seed;
// - failures stay typed and keep their messages: a YAML syntax error is a
//   parse failure, a well-formed document of the wrong shape a decode failure.

import {
  ModelsManifest,
  ModelsManifestStore,
  ModelsManifestStoreLive,
  seedModelsManifest,
} from "@beep/repo-cli/commands/Models";
import { Yaml, YamlStringifyOptions } from "@beep/yaml/Yaml";
import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as EffectYaml from "effect/encoding/Yaml";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { readFixtureText } from "./helpers/models-fixtures.ts";

class ModelsManifestConfigFileTestOperationError extends S.TaggedError<
  ModelsManifestConfigFileTestOperationError,
  { readonly brand: unique symbol }
>()(
  "ModelsManifestConfigFileTestOperationError",
  { cause: S.Defect({ includeStack: true }) },
  { description: "A failed external operation in models-manifest-config-file.test.ts." }
) {}

const manifestFixtures = [
  "manifest.yaml",
  "manifest-codex-current.yaml",
  "manifest-junie.yaml",
  "manifest-proxy.yaml",
  "manifest-retired-effort.yaml",
];

const decodeManifest = S.decodeUnknownEffect(ModelsManifest);
const encodeManifest = S.encodeUnknownEffect(ModelsManifest);

// An independent reader: Effect's YAML parser, then the schema decode.
const independentLoad = (text: string) =>
  Effect.try({
    try: () => EffectYaml.parse(text),
    catch: (cause) => ModelsManifestConfigFileTestOperationError.make({ cause }),
  }).pipe(Effect.flatMap(decodeManifest));

const writeTemp = Effect.fnUntraced(function* (name: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const home = yield* fs.makeTempDirectoryScoped({ prefix: "models-config-file-" });
  const file = path.join(home, name);
  yield* fs.writeFileString(file, content);
  return file;
});

const freshTarget = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const home = yield* fs.makeTempDirectoryScoped({ prefix: "models-config-file-" });
  return path.join(home, "models.yaml");
});

const storeLayer = Layer.provide(ModelsManifestStoreLive, NodeServices.layer);

// The retired-role cases stand in for a manifest already on disk, which the
// npm `yaml` writer produced before R4. These options reproduce that layout
// byte for byte (sequences indented under their key, quotes chosen per value;
// the R4 parity oracle pins it), so the fixtures keep the on-disk shape.
const legacyLayout = YamlStringifyOptions.make({ indentSequences: true, quoteStyle: "auto" });

layer(Layer.mergeAll(storeLayer, NodeServices.layer), { timeout: "30 seconds" })(
  "models manifest store on config-file",
  (it) => {
    for (const fixture of manifestFixtures) {
      it.effect(`loads ${fixture} to the manifest an independent reader produces`, () =>
        Effect.gen(function* () {
          const store = yield* ModelsManifestStore;
          const text = yield* readFixtureText(fixture);
          const file = yield* writeTemp("models.yaml", text);
          const loaded = yield* store.load(file);
          const independent = yield* independentLoad(text);
          const encodedManifest = yield* encodeManifest(loaded);
          const expectation = expect(encodedManifest);
          const encodedManifest1 = yield* encodeManifest(independent);
          expectation.toEqual(encodedManifest1);
        })
      );

      it.effect(`round-trips ${fixture} through the writer and the reader`, () =>
        Effect.gen(function* () {
          const store = yield* ModelsManifestStore;
          const readFixtureText10 = yield* readFixtureText(fixture);
          const writeTemp1 = yield* writeTemp("models.yaml", readFixtureText10);
          const loaded = yield* store.load(writeTemp1);
          const target = yield* freshTarget();
          yield* store.init(target, loaded);
          const loaded11 = yield* store.load(target);
          const encodedManifest2 = yield* encodeManifest(loaded11);
          const expectation1 = expect(encodedManifest2);
          const encodedManifest4 = yield* encodeManifest(loaded);
          expectation1.toEqual(encodedManifest4);
        })
      );
    }

    it.effect("round-trips the seed manifest through the writer and the reader", () =>
      Effect.gen(function* () {
        const store = yield* ModelsManifestStore;
        const target = yield* freshTarget();
        yield* store.init(target, seedModelsManifest);
        const loaded12 = yield* store.load(target);
        const encodedManifest3 = yield* encodeManifest(loaded12);
        const expectation2 = expect(encodedManifest3);
        const encodedManifest6 = yield* encodeManifest(seedModelsManifest);
        expectation2.toEqual(encodedManifest6);
      })
    );

    it.effect("drops bindings and targets of a retired role instead of failing the manifest", () =>
      Effect.gen(function* () {
        const store = yield* ModelsManifestStore;
        const seed = yield* encodeManifest(seedModelsManifest);
        const retiredBinding = { role: "graft.deep", surface: "proxy-workflow", modelId: "claude-opus-5-5" };
        const retiredTarget = {
          id: "home.beep-graft.env",
          root: "home",
          path: "$HOME/.config/beep-graft/env",
          optional: true,
          locators: [
            {
              _tag: "env-key",
              binding: { role: "graft.deep", surface: "proxy-workflow", field: "model" },
              render: { _tag: "verbatim" },
              key: "GRAFT_MODEL",
            },
          ],
        };
        const legacy = {
          ...seed,
          bindings: [...seed.bindings, retiredBinding],
          targets: [...seed.targets, retiredTarget],
        };
        const stringify13 = yield* Yaml.stringify(legacy, legacyLayout);
        const writeTemp4 = yield* writeTemp("models.yaml", stringify13);
        const loaded = yield* store.load(writeTemp4);
        const encodedManifest5 = yield* encodeManifest(loaded);
        expect(encodedManifest5).toEqual(seed);
      })
    );

    it.effect("drops a retired target id whose role stays active", () =>
      Effect.gen(function* () {
        const store = yield* ModelsManifestStore;
        const seed = yield* encodeManifest(seedModelsManifest);
        const retiredTarget = {
          id: "repo.examples.docgen-worker",
          root: "repo",
          path: "packages/tooling/tool/cli/src/commands/Docgen/internal/QualityWorkerEval.ts",
          optional: false,
          locators: [
            {
              _tag: "ts-literal",
              binding: { role: "codex.heavy", surface: "codex-plugin", field: "model" },
              render: { _tag: "verbatim" },
              symbol: "retiredExampleModel",
            },
          ],
        };
        const legacy = { ...seed, targets: [...seed.targets, retiredTarget] };
        const stringify14 = yield* Yaml.stringify(legacy, legacyLayout);
        const writeTemp6 = yield* writeTemp("models.yaml", stringify14);
        const loaded = yield* store.load(writeTemp6);
        const encodedManifest7 = yield* encodeManifest(loaded);
        expect(encodedManifest7).toEqual(seed);
      })
    );

    it.effect("keeps the active roles of a target that mixes them with a retired role", () =>
      Effect.gen(function* () {
        const store = yield* ModelsManifestStore;
        const seed = yield* encodeManifest(seedModelsManifest);
        const block = (blockId: string, roles: ReadonlyArray<string>) => ({
          _tag: "md-generated-block",
          blockId,
          filter: { roles, surfaces: [] },
          includeSuperseded: false,
        });
        const mixedTarget = {
          id: "home.mixed.doctrine",
          root: "home",
          path: "$HOME/.mixed/AGENTS.md",
          optional: true,
          locators: [
            block("mixed-roles", ["qa.judge", "jsdoc.migrate-titles"]),
            block("retired-only", ["jsdoc.migrate-titles"]),
            {
              _tag: "env-key",
              binding: { role: "jsdoc.migrate-titles", surface: "grok-cli", field: "model" },
              render: { _tag: "verbatim" },
              key: "JSDOC_MODEL",
            },
          ],
        };
        const retiredOnlyTarget = {
          id: "home.retired-only.doctrine",
          root: "home",
          path: "$HOME/.retired-only/AGENTS.md",
          optional: true,
          locators: [block("retired-only", ["jsdoc.migrate-titles"])],
        };
        const legacy = { ...seed, targets: [...seed.targets, mixedTarget, retiredOnlyTarget] };
        const stringify15 = yield* Yaml.stringify(legacy, legacyLayout);
        const writeTemp8 = yield* writeTemp("models.yaml", stringify15);
        const loaded = yield* store.load(writeTemp8);
        const expected = {
          ...seed,
          targets: [...seed.targets, { ...mixedTarget, locators: [block("mixed-roles", ["qa.judge"])] }],
        };
        const encodedManifest9 = yield* encodeManifest(loaded);
        expect(encodedManifest9).toEqual(expected);
      })
    );

    it.effect("still rejects a target that is not a target shape after pruning", () =>
      Effect.gen(function* () {
        const seed = yield* encodeManifest(seedModelsManifest);
        const error = yield* Effect.flip(decodeManifest({ ...seed, targets: [...seed.targets, "not-a-target"] }));
        expect(error._tag).toBe("SchemaError");
      })
    );

    it.effect("reports a YAML syntax error as a typed parse failure", () =>
      Effect.gen(function* () {
        const store = yield* ModelsManifestStore;
        const file = yield* writeTemp("models.yaml", "version: beep-models/v1\nbindings: [unclosed\n");
        const error = yield* Effect.flip(store.load(file));
        expect(error).toMatchObject({ _tag: "ModelsManifestError", path: file });
        expect(error.message).toBe(`Failed to parse YAML in ${file}.`);
      })
    );

    it.effect("reports a well-formed manifest of the wrong shape as a decode failure", () =>
      Effect.gen(function* () {
        const store = yield* ModelsManifestStore;
        const file = yield* writeTemp("models.yaml", "version: beep-models/v1\nbindings: 3\n");
        const error = yield* Effect.flip(store.load(file));
        expect(error).toMatchObject({ _tag: "ModelsManifestError", path: file });
        expect(error.message).toContain(`Failed to decode the models manifest at ${file}`);
        expect(error.message).toContain("bindings");
      })
    );
  }
);
