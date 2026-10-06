/**
 * The matter-folder directory over the private folder-id map the Box
 * onboarding workstream emits.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { DocumentFolderId, FilingDestination } from "@beep/law-practice-domain/values/MailTagging";
import { MatterFolderDirectory, MatterFolderDirectoryShape } from "@beep/law-practice-use-cases/MailTagging";
import { Context, Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { makeStateFileAt } from "../internal/MailTaggingStateFile.ts";
import type { MailTaggingStateError, MatterFolderRequest } from "@beep/law-practice-use-cases/MailTagging";
import type { FileSystem, Path } from "effect";

const $I = $LawPracticeServerId.create("MailTagging/MailTagging.folders");

/**
 * The filing folders of one matter: one row of the private folder-id map.
 *
 * **Details**
 *
 * The row is keyed by the practice-KG family key and carries document-store
 * folder ids only. A key the adapter does not read, such as the matter
 * folder's own id, is accepted and ignored, so the emitting workstream can
 * add columns without breaking a run.
 *
 * **Example** (Describe one row)
 *
 * ```ts
 * import { DocumentFolderId } from "@beep/law-practice-domain/values/MailTagging"
 * import { MatterFolders } from "@beep/law-practice-server/MailTagging"
 *
 * const folders = MatterFolders.make({
 *   familyKey: "1234.10001",
 *   usptoIncomingFolderId: DocumentFolderId.make("9001"),
 *   fromClientFolderId: DocumentFolderId.make("9002"),
 *   matterFolderId: "9000"
 * })
 * console.log(folders.fromClientFolderId) // "9002"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MatterFolders extends S.Class<MatterFolders>($I`MatterFolders`)(
  {
    familyKey: S.NonEmptyString.annotateKey({
      description: "Practice-KG family key of the matter.",
    }),
    usptoIncomingFolderId: DocumentFolderId.annotateKey({
      description: "Folder that receives USPTO correspondence.",
    }),
    fromClientFolderId: DocumentFolderId.annotateKey({
      description: "Folder that receives documents a client contact sent.",
    }),
    matterFolderId: S.optionalKey(S.String).annotateKey({
      description: "Id of the matter folder itself; carried by the map and not read.",
    }),
  },
  $I.annote("MatterFolders", {
    description: "Document-store folder ids of one matter's filing destinations.",
  })
) {}

/**
 * JSON codec of the whole folder-id map: an array of {@link MatterFolders}.
 *
 * **Example** (Guard a decoded map)
 *
 * ```ts
 * import { MatterFolderMapJson } from "@beep/law-practice-server/MailTagging"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MatterFolderMapJson)([])) // true
 * console.log(S.is(MatterFolderMapJson)([{ familyKey: "" }])) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MatterFolderMapJson = MatterFolders.pipe(
  S.Array,
  S.fromJsonString,
  $I.annoteSchema("MatterFolderMapJson", {
    description: "JSON document mapping every provisioned matter to its filing folder ids.",
  })
);

/**
 * Runtime type for {@link MatterFolderMapJson}.
 *
 * @category models
 * @since 0.0.0
 */
export type MatterFolderMapJson = typeof MatterFolderMapJson.Type;

/**
 * Where the private folder-id map lives.
 *
 * **Example** (Name the map file)
 *
 * ```ts
 * import { MatterFolderMapConfig } from "@beep/law-practice-server/MailTagging"
 *
 * const config = MatterFolderMapConfig.make({ path: "state/box-onboarding/matter-folders.json" })
 * console.log(config.path) // "state/box-onboarding/matter-folders.json"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class MatterFolderMapConfig extends S.Class<MatterFolderMapConfig>($I`MatterFolderMapConfig`)(
  {
    path: S.NonEmptyString.annotateKey({
      description: "Full path of the folder-id map JSON file.",
    }),
  },
  $I.annote("MatterFolderMapConfig", {
    description: "Location of the private matter folder-id map.",
  })
) {}

/**
 * Service tag carrying the folder-id map's location.
 *
 * **Example** (Provide the map location)
 *
 * ```ts
 * import { MatterFolderMapConfig, MatterFolderMapLocation } from "@beep/law-practice-server/MailTagging"
 * import * as Layer from "effect/Layer"
 *
 * const Location = Layer.succeed(
 *   MatterFolderMapLocation,
 *   MatterFolderMapConfig.make({ path: "state/box-onboarding/matter-folders.json" })
 * )
 * console.log(Layer.isLayer(Location)) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class MatterFolderMapLocation extends Context.Service<MatterFolderMapLocation, MatterFolderMapConfig>()(
  $I`MatterFolderMapLocation`
) {}

const decodeFolderMap = S.decodeUnknownEffect(MatterFolderMapJson);

// The destination names a column of the map; no folder name or path exists in code.
const folderOf: (destination: FilingDestination) => (folders: MatterFolders) => DocumentFolderId =
  FilingDestination.$match({
    "uspto-incoming": () => (folders: MatterFolders) => folders.usptoIncomingFolderId,
    "from-client": () => (folders: MatterFolders) => folders.fromClientFolderId,
  });

const keyed = (folders: MatterFolders): readonly [string, MatterFolders] => [folders.familyKey, folders];

const makeMatterFolderDirectory = Effect.gen(function* () {
  const location = yield* MatterFolderMapLocation;
  const file = yield* makeStateFileAt("matter-folders", location.path);
  const text = yield* file.readRequired;
  const rows = yield* Effect.mapError(decodeFolderMap(text), file.corrupt(O.none()));
  const byFamily = HashMap.fromIterable(A.map(rows, keyed));

  return MatterFolderDirectoryShape.make({
    folderFor: (request: MatterFolderRequest) =>
      Effect.succeed(O.map(HashMap.get(byFamily, request.matterKey), folderOf(request.destination))),
  });
});

/**
 * Layer providing the matter-folder directory from the private folder-id map.
 *
 * **Details**
 *
 * The map is a JSON array of {@link MatterFolders}, read and decoded once
 * when the layer is built. `folderFor` looks the matter up by family key and
 * picks the id the destination names; a matter the map does not list has no
 * folder, so its attachments are not filed. A later row for the same family
 * key replaces an earlier one. A map that is missing or does not decode fails
 * the layer with a `MailTaggingStateError` naming the file, never its content.
 *
 * **Gotchas**
 *
 * Build the layer once per run. The map is regenerated between runs, and an
 * instance kept alive across runs would keep resolving the folders of the map
 * it was built from.
 *
 * **Example** (Wire the directory over a map file)
 *
 * ```ts
 * import {
 *   MatterFolderDirectoryFile,
 *   MatterFolderMapConfig,
 *   MatterFolderMapLocation
 * } from "@beep/law-practice-server/MailTagging"
 * import * as Layer from "effect/Layer"
 *
 * const Folders = MatterFolderDirectoryFile.pipe(
 *   Layer.provide(
 *     Layer.succeed(
 *       MatterFolderMapLocation,
 *       MatterFolderMapConfig.make({ path: "state/box-onboarding/matter-folders.json" })
 *     )
 *   )
 * )
 * console.log(Layer.isLayer(Folders)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const MatterFolderDirectoryFile: Layer.Layer<
  MatterFolderDirectory,
  MailTaggingStateError,
  MatterFolderMapLocation | FileSystem.FileSystem | Path.Path
> = Layer.effect(MatterFolderDirectory, makeMatterFolderDirectory);
