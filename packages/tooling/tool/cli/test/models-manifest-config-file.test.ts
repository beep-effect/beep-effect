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
import { Yaml } from "@beep/yaml/Yaml";
import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as EffectYaml from "effect/encoding/Yaml";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { readFixtureText } from "./helpers/models-fixtures.ts";

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
const independentLoad = (text: string) => Effect.try(() => EffectYaml.parse(text)).pipe(Effect.flatMap(decodeManifest));

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
          expect(yield* encodeManifest(loaded)).toEqual(yield* encodeManifest(independent));
        })
      );

      it.effect(`round-trips ${fixture} through the writer and the reader`, () =>
        Effect.gen(function* () {
          const store = yield* ModelsManifestStore;
          const loaded = yield* store.load(yield* writeTemp("models.yaml", yield* readFixtureText(fixture)));
          const target = yield* freshTarget();
          yield* store.init(target, loaded);
          expect(yield* encodeManifest(yield* store.load(target))).toEqual(yield* encodeManifest(loaded));
        })
      );
    }

    it.effect("round-trips the seed manifest through the writer and the reader", () =>
      Effect.gen(function* () {
        const store = yield* ModelsManifestStore;
        const target = yield* freshTarget();
        yield* store.init(target, seedModelsManifest);
        expect(yield* encodeManifest(yield* store.load(target))).toEqual(yield* encodeManifest(seedModelsManifest));
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
        const loaded = yield* store.load(yield* writeTemp("models.yaml", yield* Yaml.stringify(legacy)));
        expect(yield* encodeManifest(loaded)).toEqual(seed);
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
        const loaded = yield* store.load(yield* writeTemp("models.yaml", stringify(legacy)));
        expect(yield* encodeManifest(loaded)).toEqual(seed);
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
        const loaded = yield* store.load(yield* writeTemp("models.yaml", stringify(legacy)));
        const expected = {
          ...seed,
          targets: [...seed.targets, { ...mixedTarget, locators: [block("mixed-roles", ["qa.judge"])] }],
        };
        expect(yield* encodeManifest(loaded)).toEqual(expected);
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
