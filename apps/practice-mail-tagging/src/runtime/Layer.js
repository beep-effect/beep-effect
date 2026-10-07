/**
 * Process wiring of the mail-tagging job: the Microsoft 365 app-only lane,
 * Box, the read-only practice knowledge-graph bundle, and the private state
 * files.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Box, BoxCcgConfig } from "@beep/box";
import { DuckDb, DuckDbConnectionOptions } from "@beep/duckdb";
import {
  MailTaggingServiceConfig,
  MailTaggingServiceLive,
  MailTaggingStateConfig,
  MailTaggingStateFile,
  MailTaggingStateLocation,
  mailTaggingServiceConfigLayer,
} from "@beep/law-practice-server/MailTagging";
import { M365 } from "@beep/m365";
import { Effect, Layer, Path } from "effect";
import * as S from "effect/Schema";
import {
  boxCredentialConfig,
  m365AppOnlyConfig,
  practiceMailTaggingConfig,
  stateDirectoryConfig,
} from "../PracticeMailTagging.config.ts";
import { PracticeMailTaggingError } from "../PracticeMailTagging.errors.ts";
import { makeStateLock, ProcessProbeLive, StateLock } from "../PracticeMailTagging.lock.ts";
import { MailTaggingPasses, MailTaggingPassSchedule, makeMailTaggingPasses } from "../PracticeMailTagging.passes.ts";

const kgDatabaseFile = "practice.duckdb";
const isClientCredentials = S.is(BoxCcgConfig);
const boxLayer = (credential) =>
  isClientCredentials(credential) ? Box.makeCcgLayer(credential) : Box.makeLayer(credential);
const practiceKgLayer = (bundleDirectory) =>
  Layer.unwrap(
    Effect.map(Path.Path, (path) =>
      DuckDb.makeNodeLayer(
        DuckDbConnectionOptions.make({
          databaseOptions: { access_mode: "READ_ONLY" },
          databasePath: path.join(bundleDirectory, kgDatabaseFile),
        })
      )
    )
  );
/**
 * Reads the provider credentials and answers the live driver layer.
 *
 * **Details**
 *
 * The Microsoft 365 driver runs on the app-only lane with the certificate of
 * the shared Entra registration. The knowledge-graph bundle's DuckDB file is
 * opened read-only, and only when a pass first queries it. Reading the
 * credentials is the only thing this effect does: no driver is built and no
 * provider is called until a pass runs.
 *
 * **Example** (Reference the live drivers)
 *
 * ```ts
 * import * as P from "effect/Predicate"
 * import { liveMailTaggingDrivers } from "@/runtime/Layer"
 *
 * console.log(P.isFunction(liveMailTaggingDrivers)) // true
 * ```
 *
 * @param settings - The app's settings; names the bundle directory.
 * @returns An effect answering the driver layer, failing when a credential is missing.
 * @category layers
 * @since 0.0.0
 */
export const liveMailTaggingDrivers = Effect.fn("PracticeMailTagging.liveDrivers")(function* (settings) {
  const m365 = yield* m365AppOnlyConfig;
  const box = yield* boxCredentialConfig;
  return Layer.mergeAll(M365.makeAppOnlyLiveLayer(m365), boxLayer(box), practiceKgLayer(settings.kgBundleDirectory));
});
// Each pass gets its own label in the shared Box call ledger, so a ledger line names its run.
const passSettings = (settings, runId) =>
  mailTaggingServiceConfigLayer(
    MailTaggingServiceConfig.make({
      stateDirectory: settings.stateDirectory,
      mailboxUserId: settings.mailboxUserId,
      excludedFolderIds: settings.excludedFolderIds,
      folderMapPath: settings.folderMapPath,
      knownDocumentsPath: settings.knownDocumentsPath,
      boxCallLedgerPath: settings.boxCallLedgerPath,
      pageSize: settings.pageSize,
      contactEvidence: settings.contactEvidence,
      runLabel: `${settings.runLabel}:${runId}`,
    })
  );
/**
 * Builds the pass runner over a driver source.
 *
 * **When to use**
 *
 * Use with {@link liveMailTaggingDrivers} in the process entrypoint, and with
 * stub drivers in a test that must not reach a provider.
 *
 * **Details**
 *
 * The settings and the driver layer are read once, when this layer is built,
 * so a missing setting fails before the first pass. The mail-tagging service
 * itself is assembled anew for every pass.
 *
 * **Example** (Reference the pass runner layer)
 *
 * ```ts
 * import * as Layer from "effect/Layer"
 * import { liveMailTaggingDrivers, makeMailTaggingPassesLayer } from "@/runtime/Layer"
 *
 * console.log(Layer.isLayer(makeMailTaggingPassesLayer(liveMailTaggingDrivers))) // true
 * ```
 *
 * @param drivers - Answers the driver layer for the settings.
 * @returns A layer providing the pass runner.
 * @category layers
 * @since 0.0.0
 */
export const makeMailTaggingPassesLayer = (drivers) =>
  Layer.effect(
    MailTaggingPasses,
    Effect.gen(function* () {
      const settings = yield* practiceMailTaggingConfig;
      const driverLayer = yield* drivers(settings);
      const platform = Layer.succeedContext(yield* Effect.context());
      return makeMailTaggingPasses(
        MailTaggingPassSchedule.make({
          since: settings.since,
          pollInterval: settings.pollInterval,
          maxBackoff: settings.maxBackoff,
        }),
        (runId) =>
          MailTaggingServiceLive.pipe(
            Layer.provide(passSettings(settings, runId)),
            Layer.provide(Layer.provideMerge(driverLayer, platform))
          )
      );
    }).pipe(Effect.mapError(PracticeMailTaggingError.fromConfig))
  );
/**
 * Pass runner over the live Microsoft 365, Box, and knowledge-graph drivers.
 *
 * **Example** (Reference the live pass runner)
 *
 * ```ts
 * import * as Layer from "effect/Layer"
 * import { MailTaggingPassesLive } from "@/runtime/Layer"
 *
 * console.log(Layer.isLayer(MailTaggingPassesLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const MailTaggingPassesLive = makeMailTaggingPassesLayer(liveMailTaggingDrivers);
/**
 * The file-backed ledgers and checkpoint of the configured state directory.
 *
 * **When to use**
 *
 * Use when a command only reads state, such as `report`: it needs the state
 * directory and nothing else.
 *
 * **Example** (Reference the state layer)
 *
 * ```ts
 * import * as Layer from "effect/Layer"
 * import { MailTaggingStateLive } from "@/runtime/Layer"
 *
 * console.log(Layer.isLayer(MailTaggingStateLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const MailTaggingStateLive = MailTaggingStateFile.pipe(
  Layer.provide(
    Layer.effect(
      MailTaggingStateLocation,
      Effect.gen(function* () {
        return MailTaggingStateConfig.make({ stateDirectory: yield* stateDirectoryConfig });
      }).pipe(Effect.mapError(PracticeMailTaggingError.fromConfig))
    )
  )
);
/**
 * The writer lock of the configured state directory, over the running
 * process.
 *
 * **When to use**
 *
 * Use with the writing commands (`apply`, `watch`, `undo` without
 * `--dry-run`), so two writers never share a state directory.
 *
 * **Example** (Reference the lock layer)
 *
 * ```ts
 * import * as Layer from "effect/Layer"
 * import { StateLockLive } from "@/runtime/Layer"
 *
 * console.log(Layer.isLayer(StateLockLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const StateLockLive = Layer.effect(
  StateLock,
  Effect.gen(function* () {
    return yield* makeStateLock(yield* stateDirectoryConfig);
  }).pipe(Effect.mapError(PracticeMailTaggingError.fromConfig))
).pipe(Layer.provide(ProcessProbeLive));
