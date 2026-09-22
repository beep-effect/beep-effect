/**
 * The operator-manifest store for `beep models`.
 *
 * **Details**
 *
 * Slice 1 reads the manifest and, with `init`, creates one that does not exist
 * yet; it never overwrites an existing manifest and never writes a projection
 * target.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as Context from "effect/Context";
import * as S from "effect/Schema";
import { parseDocument, stringify as stringifyYaml } from "yaml";
import { ModelsManifestError } from "./Models.errors.ts";
import { ModelsManifest } from "./Models.manifest.schemas.ts";

const $I = $RepoCliId.create("commands/Models/Models.manifest.service");

const decodeManifest = S.decodeUnknownEffect(ModelsManifest);
const encodeManifest = S.encodeUnknownEffect(ModelsManifest);

// ── Manifest store ──────────────────────────────────────────────────────────

/**
 * Loads and seeds the operator manifest.
 *
 * @category services
 * @since 0.0.0
 */
export interface ModelsManifestStoreShape {
  readonly init: (path: string, manifest: ModelsManifest) => Effect.Effect<string, ModelsManifestError>;
  readonly load: (path: string) => Effect.Effect<ModelsManifest, ModelsManifestError>;
}

/**
 * The operator manifest at `$HOME/.config/beep/models.yaml`.
 *
 * **Example** (Describe a manifest load)
 *
 * ```ts
 * import { ModelsManifestStore } from "@beep/repo-cli/commands/Models"
 * import * as Effect from "effect/Effect"
 *
 * const program = ModelsManifestStore.use((store) => store.load("/home/op/.config/beep/models.yaml"))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ModelsManifestStore extends Context.Service<ModelsManifestStore, ModelsManifestStoreShape>()(
  $I`ModelsManifestStore`
) {}

const makeManifestStore = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const load: ModelsManifestStoreShape["load"] = Effect.fnUntraced(function* (file: string) {
    const text = yield* fs
      .readFileString(file)
      .pipe(ModelsManifestError.mapError(`Failed to read the models manifest at ${file}`, file));
    const parsed = yield* Effect.try({
      try: () => parseDocument(text).toJS() as unknown,
      catch: (cause) =>
        ModelsManifestError.make({
          message: `Failed to parse YAML in ${file}.`,
          path: file,
          cause,
        }),
    });

    return yield* decodeManifest(parsed).pipe(
      ModelsManifestError.mapError(`Failed to decode the models manifest at ${file}`, file)
    );
  });

  const init: ModelsManifestStoreShape["init"] = Effect.fnUntraced(function* (file: string, manifest: ModelsManifest) {
    const exists = yield* fs
      .exists(file)
      .pipe(ModelsManifestError.mapError(`Failed to check whether ${file} exists`, file));
    if (exists) {
      return yield* ModelsManifestError.make({
        message: `A models manifest already exists at ${file}; slice 1 never overwrites one.`,
        path: file,
      });
    }

    const encoded = yield* encodeManifest(manifest).pipe(
      ModelsManifestError.mapError("Failed to encode the seed models manifest", file)
    );
    const directory = path.dirname(file);
    yield* fs
      .makeDirectory(directory, { recursive: true })
      .pipe(ModelsManifestError.mapError(`Failed to create ${directory}`, directory));
    yield* fs
      .writeFileString(file, stringifyYaml(encoded, { lineWidth: 0 }))
      .pipe(ModelsManifestError.mapError(`Failed to write ${file}`, file));

    return file;
  });

  return ModelsManifestStore.of({ load, init });
});

/**
 * Live manifest store over the platform file system.
 *
 * **Example** (Confirm the layer)
 *
 * ```ts
 * import { ModelsManifestStoreLive } from "@beep/repo-cli/commands/Models"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(ModelsManifestStoreLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ModelsManifestStoreLive: Layer.Layer<ModelsManifestStore, never, FileSystem.FileSystem | Path.Path> =
  Layer.effect(ModelsManifestStore, makeManifestStore());
