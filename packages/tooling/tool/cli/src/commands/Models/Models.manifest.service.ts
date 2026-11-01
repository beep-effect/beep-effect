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

import { ConfigFile } from "@beep/config-file/ConfigFile";
import { YamlCodec } from "@beep/config-file/YamlCodec";
import { $RepoCliId } from "@beep/identity/packages";
import { Yaml, YamlStringifyOptions } from "@beep/yaml/Yaml";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Random from "effect/Random";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { messageWithCause } from "../../internal/cli/CommandErrorFields.ts";
import { ModelsManifestError } from "./Models.errors.ts";
import { ModelsManifest } from "./Models.manifest.schemas.ts";

const $I = $RepoCliId.create("commands/Models/Models.manifest.service");

const encodeManifest = S.encodeUnknownEffect(ModelsManifest);

// The `yaml` npm writer's layout (sequences indented under their key, quotes
// chosen per value as that package chooses them, no folding), so an adopted
// manifest keeps the shape the operator already has on disk byte for byte.
const manifestYamlOptions = YamlStringifyOptions.make({ indentSequences: true, quoteStyle: "auto" });

// ── Manifest store ──────────────────────────────────────────────────────────

/**
 * Where `adopt` left the manifest and the copy it preserved first.
 *
 * **Example** (Read an adoption record)
 *
 * ```ts
 * import { ManifestAdoption } from "@beep/repo-cli/commands/Models/Models.manifest.service"
 * import * as O from "effect/Option"
 *
 * const adoption = ManifestAdoption.make({ file: "/home/op/.config/beep/models.yaml", backup: O.none() })
 * console.log(O.isNone(adoption.backup)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ManifestAdoption extends S.Opaque<ManifestAdoption, { readonly brand: unique symbol }>()(
  S.Struct({
    file: S.NonEmptyString,
    backup: S.Option(S.NonEmptyString),
  }).pipe(
    $I.annoteSchema("ManifestAdoption", {
      description: "The manifest path `adopt` rewrote and the timestamped backup of the prior file, when one existed.",
    })
  )
) {}

/**
 * The manifest store contract: seed an empty slot, adopt the seed over an
 * existing file, or load what is there.
 *
 * **Details**
 *
 * `init` keeps the slice-1 promise and refuses to touch an existing manifest;
 * `adopt` is the sanctioned rewrite that preserves the prior file as a
 * timestamped sibling first.
 *
 * **Example** (Name the store operations)
 *
 * ```ts
 * import type { ModelsManifestStoreShape } from "@beep/repo-cli/commands/Models/Models.manifest.service"
 *
 * const operations: ReadonlyArray<keyof ModelsManifestStoreShape> = ["init", "adopt", "load"]
 * console.log(operations.length) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface ModelsManifestStoreShape {
  readonly adopt: (path: string, manifest: ModelsManifest) => Effect.Effect<ManifestAdoption, ModelsManifestError>;
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

  // The manifest is read through `ConfigFile.read` and `YamlCodec` (wave 3,
  // W3-e) and written through the `@beep/yaml` stringifier with the atomic
  // rename (R4). The three failure messages are the ones the store always raised.
  const load: ModelsManifestStoreShape["load"] = (file: string) =>
    ConfigFile.read(file, { schema: ModelsManifest, codec: YamlCodec }).pipe(
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.catchTags({
        ConfigFileReadError: (error) =>
          Effect.fail(
            ModelsManifestError.make({
              message: messageWithCause(`Failed to read the models manifest at ${file}`, error.cause),
              path: file,
              cause: error.cause,
            })
          ),
        ConfigCodecError: (error) =>
          Effect.fail(
            ModelsManifestError.make({ message: `Failed to parse YAML in ${file}.`, path: file, cause: error.cause })
          ),
        ConfigValidationError: (error) =>
          // A schema-only read always carries a `SchemaIssue`; anything else
          // breaks the `ConfigFile.read` contract, so it is a defect.
          Effect.fromOption(error.schemaIssue).pipe(
            Effect.orDie,
            Effect.flatMap((issue) => Effect.fail(new S.SchemaError(issue))),
            ModelsManifestError.mapError(`Failed to decode the models manifest at ${file}`, file)
          ),
      })
    );

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

    yield* writeManifest(file, manifest);
    return file;
  });

  // The policy seed moved (2026-10-01) while `init` kept its never-overwrite
  // promise, so an installation holding the old manifest could not take the
  // new bindings. `adopt` is the sanctioned rewrite: the prior file survives
  // as a timestamped sibling and the seed lands in its place.
  const adopt: ModelsManifestStoreShape["adopt"] = Effect.fnUntraced(function* (
    file: string,
    manifest: ModelsManifest
  ) {
    const exists = yield* fs
      .exists(file)
      .pipe(ModelsManifestError.mapError(`Failed to check whether ${file} exists`, file));
    const backup = yield* exists ? backupManifest(file) : Effect.succeed(O.none<string>());
    yield* writeManifest(file, manifest);
    return ManifestAdoption.make({ file, backup });
  });

  // A timestamp alone is not unique (two adoptions can land in the same
  // millisecond, and a TestClock pins it), so every sibling name carries a
  // random suffix and is created with the exclusive `wx` flag: a collision
  // fails loudly instead of overwriting an earlier backup.
  const uniqueSuffix = Effect.fnUntraced(function* () {
    const now = yield* DateTime.now;
    const stamp = pipe(now, DateTime.formatIso, Str.replace(/[:.]/g, ""), Str.replace(/-/g, ""));
    const salt = yield* Random.nextIntBetween(0, 0xffffff);
    return `${stamp}-${Str.padStart(6, "0")(salt.toString(16))}`;
  });

  const backupManifest = Effect.fnUntraced(function* (file: string) {
    const target = `${file}.bak-${yield* uniqueSuffix()}`;
    const content = yield* fs
      .readFileString(file)
      .pipe(ModelsManifestError.mapError(`Failed to read ${file} for backup`, file));
    yield* fs
      .writeFileString(target, content, { flag: "wx" })
      .pipe(ModelsManifestError.mapError(`Failed to back up ${file} to ${target}`, file));
    return O.some(target);
  });

  // The manifest is replaced through a same-directory temporary file and a
  // rename, so an interrupted or failed write never leaves a truncated
  // manifest at the live path.
  const writeManifest = Effect.fnUntraced(function* (file: string, manifest: ModelsManifest) {
    const encoded = yield* encodeManifest(manifest).pipe(
      ModelsManifestError.mapError("Failed to encode the seed models manifest", file)
    );
    const directory = path.dirname(file);
    yield* fs
      .makeDirectory(directory, { recursive: true })
      .pipe(ModelsManifestError.mapError(`Failed to create ${directory}`, directory));
    const text = yield* Yaml.stringify(encoded, manifestYamlOptions).pipe(
      ModelsManifestError.mapError("Failed to render the seed models manifest as YAML", file)
    );
    const temporary = `${file}.tmp-${yield* uniqueSuffix()}`;
    yield* fs.writeFileString(temporary, text, { flag: "wx" }).pipe(
      Effect.flatMap(() => fs.rename(temporary, file)),
      Effect.onError(() => Effect.ignore(fs.remove(temporary))),
      ModelsManifestError.mapError(`Failed to write ${file}`, file)
    );
  });

  return ModelsManifestStore.of({ load, init, adopt });
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
