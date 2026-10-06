/**
 * The assembled mail-tagging service: the use-cases over the Microsoft 365
 * mailbox, the practice knowledge graph, Box, and the private operator files.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { Effect, Layer } from "effect";
import * as S from "effect/Schema";
import { PosInt } from "../internal/PosInt.ts";
import { DocumentStoreBox } from "./MailTagging.documents.ts";
import { MailTaggingStateFile } from "./MailTagging.files.ts";
import { MatterFolderDirectoryFile, MatterFolderMapConfig, MatterFolderMapLocation } from "./MailTagging.folders.ts";
import { KnownDocumentsConfig, KnownDocumentsFile, KnownDocumentsLocation } from "./MailTagging.known.ts";
import { MailTaggingUseCasesLive } from "./MailTagging.layers.ts";
import { MailboxM365, MailboxM365Config, MailboxM365Options } from "./MailTagging.mailbox.ts";
import { MatterDirectoryPracticeKg } from "./MailTagging.matters.ts";
import { BoxCallLedgerConfig, BoxCallLedgerFile, BoxCallLedgerLocation } from "./MailTagging.metering.ts";
import { MailTaggingStateConfig, MailTaggingStateLocation } from "./MailTagging.state.ts";
import type { Box } from "@beep/box";
import type { DuckDb } from "@beep/duckdb";
import type {
  AttachmentFiler,
  MailTaggingJob,
  MailTaggingPortError,
  MailTaggingStateError,
  MailTaggingUndo,
} from "@beep/law-practice-use-cases/MailTagging";
import type { M365 } from "@beep/m365";
import type { FileSystem, Path } from "effect";
import type * as Crypto from "effect/Crypto";

const $I = $LawPracticeServerId.create("MailTagging/MailTagging.service");

const defaultPageSize = 50;
const defaultRunLabel = "practice-mail-tagging";

/**
 * Every setting of one mail-tagging run, in one value.
 *
 * **Details**
 *
 * The paths are private operator state and are never tracked. `runLabel`
 * names the run in the shared Box API-call ledger; give each run its own.
 * There is no environment lookup here: an entrypoint decodes this value and
 * hands it to {@link mailTaggingServiceConfigLayer}.
 *
 * **Example** (Configure a run)
 *
 * ```ts
 * import { MailTaggingServiceConfig } from "@beep/law-practice-server/MailTagging"
 *
 * const config = MailTaggingServiceConfig.make({
 *   stateDirectory: "state/practice-mail-tagging",
 *   mailboxUserId: "attorney@example.test",
 *   folderMapPath: "state/box-onboarding/matter-folders.json",
 *   knownDocumentsPath: "state/box-onboarding/box-files.jsonl",
 *   boxCallLedgerPath: "state/box-api-calls.jsonl"
 * })
 * console.log(config.pageSize) // 50
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class MailTaggingServiceConfig extends S.Class<MailTaggingServiceConfig>($I`MailTaggingServiceConfig`)(
  {
    stateDirectory: S.NonEmptyString.annotateKey({
      description: "Directory holding the ledgers, the checkpoint, and the contacts overlay.",
    }),
    mailboxUserId: S.NonEmptyString.annotateKey({
      description: "Mailbox address or object id the run tags.",
    }),
    excludedFolderIds: S.Array(S.String)
      .pipe(S.withDecodingDefaultKey(Effect.succeed([])), S.withConstructorDefault(Effect.succeed([])))
      .annotateKey({
        description: "Graph ids of extra mail folders to leave out, besides Deleted Items and Junk.",
      }),
    folderMapPath: S.NonEmptyString.annotateKey({
      description: "Full path of the matter folder-id map JSON file.",
    }),
    knownDocumentsPath: S.NonEmptyString.annotateKey({
      description: "Full path of the known-documents JSONL index.",
    }),
    boxCallLedgerPath: S.NonEmptyString.annotateKey({
      description: "Full path of the shared Box API-call JSONL ledger.",
    }),
    pageSize: PosInt.pipe(
      S.withDecodingDefaultKey(Effect.succeed(defaultPageSize)),
      S.withConstructorDefault(Effect.succeed(defaultPageSize))
    ).annotateKey({
      description: "Messages requested per mailbox listing page; defaults to 50.",
    }),
    runLabel: S.NonEmptyString.pipe(
      S.withDecodingDefaultKey(Effect.succeed(defaultRunLabel)),
      S.withConstructorDefault(Effect.succeed(defaultRunLabel))
    ).annotateKey({
      description: "Label of the run in the Box API-call ledger; defaults to the service name.",
    }),
  },
  $I.annote("MailTaggingServiceConfig", {
    description: "Every setting of one mail-tagging run.",
  })
) {}

/**
 * Every configuration tag {@link MailTaggingServiceLive} reads.
 *
 * @category configuration
 * @since 0.0.0
 */
export type MailTaggingServiceSettings =
  | MailTaggingStateLocation
  | MailboxM365Options
  | MatterFolderMapLocation
  | KnownDocumentsLocation
  | BoxCallLedgerLocation;

/**
 * Builds the layer of every configuration tag from one
 * {@link MailTaggingServiceConfig}.
 *
 * **Example** (Provide a run's configuration)
 *
 * ```ts
 * import { MailTaggingServiceConfig, mailTaggingServiceConfigLayer } from "@beep/law-practice-server/MailTagging"
 * import * as Layer from "effect/Layer"
 *
 * const Settings = mailTaggingServiceConfigLayer(
 *   MailTaggingServiceConfig.make({
 *     stateDirectory: "state/practice-mail-tagging",
 *     mailboxUserId: "attorney@example.test",
 *     folderMapPath: "state/box-onboarding/matter-folders.json",
 *     knownDocumentsPath: "state/box-onboarding/box-files.jsonl",
 *     boxCallLedgerPath: "state/box-api-calls.jsonl"
 *   })
 * )
 * console.log(Layer.isLayer(Settings)) // true
 * ```
 *
 * @param config - The run's settings.
 * @returns A layer providing the state, mailbox, folder-map, known-documents, and call-ledger tags.
 * @category configuration
 * @since 0.0.0
 */
export const mailTaggingServiceConfigLayer = (
  config: MailTaggingServiceConfig
): Layer.Layer<MailTaggingServiceSettings> =>
  Layer.mergeAll(
    Layer.succeed(MailTaggingStateLocation, MailTaggingStateConfig.make({ stateDirectory: config.stateDirectory })),
    Layer.succeed(
      MailboxM365Options,
      MailboxM365Config.make({
        userId: config.mailboxUserId,
        pageSize: config.pageSize,
        excludedFolderIds: config.excludedFolderIds,
      })
    ),
    Layer.succeed(MatterFolderMapLocation, MatterFolderMapConfig.make({ path: config.folderMapPath })),
    Layer.succeed(KnownDocumentsLocation, KnownDocumentsConfig.make({ path: config.knownDocumentsPath })),
    Layer.succeed(
      BoxCallLedgerLocation,
      BoxCallLedgerConfig.make({ path: config.boxCallLedgerPath, runLabel: config.runLabel })
    )
  );

/**
 * Layer providing the attachment filer, the tagging job, and the undo over
 * every live adapter.
 *
 * **Details**
 *
 * What remains to provide is the `M365` and `Box` drivers, a `DuckDb`
 * connection to the practice knowledge-graph bundle, `FileSystem`, `Path`,
 * `Crypto`, and the configuration tags of
 * {@link mailTaggingServiceConfigLayer}.
 *
 * The folder-id map, the known-documents index, and the contacts overlay are
 * read when the layer is built, and the Box API-call ledger line is written
 * when its scope closes. Building fails with a `MailTaggingStateError` when
 * one of those files is unusable, and with a `MailTaggingPortError` when the
 * mailbox cannot resolve its Deleted Items and Junk folders, before any
 * message is read.
 *
 * **Gotchas**
 *
 * Build this layer once per run and let its scope end with the run: provide
 * it to the run's effect, not to a long-lived process. That is what makes a
 * regenerated folder map or document index visible to the next run, and what
 * flushes one call-ledger line per run.
 *
 * **Example** (Reference the assembled service)
 *
 * ```ts
 * import { MailTaggingServiceLive } from "@beep/law-practice-server/MailTagging"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(MailTaggingServiceLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const MailTaggingServiceLive: Layer.Layer<
  AttachmentFiler | MailTaggingJob | MailTaggingUndo,
  MailTaggingStateError | MailTaggingPortError,
  M365 | Box | DuckDb | FileSystem.FileSystem | Path.Path | Crypto.Crypto | MailTaggingServiceSettings
> = MailTaggingUseCasesLive.pipe(
  Layer.provide(
    Layer.mergeAll(
      MailboxM365,
      MatterDirectoryPracticeKg,
      MatterFolderDirectoryFile,
      KnownDocumentsFile,
      Layer.provide(DocumentStoreBox, BoxCallLedgerFile),
      MailTaggingStateFile
    )
  )
);
