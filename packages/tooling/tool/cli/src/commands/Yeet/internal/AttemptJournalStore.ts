/**
 * Workstation store of the Yeet attempt journals of removed checkouts (PERIL-11).
 *
 * **Details**
 *
 * A checkout's attempt journals live in its git-ignored
 * `.beep/yeet/runs/<runId>/attempts.ndjson`. Removing the checkout deletes
 * them, and an archive retirement does not keep `.beep/yeet` as material, so
 * `yeet economics --fleet` lost every retired lane. Before the worktree
 * removal service deletes a checkout, and before residue-reap deletes a
 * directory that holds checkouts, {@link AttemptJournalStore} files each
 * readable journal under
 * `<yeet state>/attempts/<host__owner__name>/runs/<runId>/attempts.ndjson`:
 * the checkout's own run layout, so economics reads the store with the reader
 * it uses for a live checkout. The yeet state root is `BEEP_YEET_STATE_ROOT`,
 * else `$XDG_STATE_HOME/beep/yeet`, else `$HOME/.local/state/beep/yeet` (the
 * PR session registry's root), outside every root residue-reap cleans.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { yeetStateRootEnvVar } from "@beep/repo-cli-kit/cli/Flags";
import { ContainedFileRead, readContainedFileStringNoFollow } from "@beep/repo-cli-kit/cli/FsGuards";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { resolveWorkstationStateDir } from "../../../internal/state/WorkstationState.ts";
import { fleetRepositoryKey, readCheckoutClone, readCloneFleetRepository } from "../../Worktree/internal/FleetRoots.ts";
import {
  AttemptJournalExport,
  AttemptJournalExported,
  AttemptJournalExportUnpartitioned,
  AttemptJournalStoreError,
} from "./AttemptJournalStore.schemas.ts";
import { DEFAULT_YEET_PACKET_DIR } from "./Planner.schemas.ts";
import type * as PlatformError from "effect/PlatformError";
import type { PrRepository } from "./Provenance.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/AttemptJournalStore");

const STORE_DIRECTORY_NAME = "attempts";
const RUNS_DIRECTORY_NAME = "runs";
const JOURNAL_FILE_NAME = "attempts.ndjson";

const isNotFound = (error: PlatformError.PlatformError): boolean => error.reason._tag === "NotFound";

// A runs path that is missing, or that crosses a file (`.beep` written as a file),
// holds no journal any reader could count; any other listing failure fails the export.
const isNoJournalsReason = S.is(S.Literals(["NotFound", "BadResource"]));
const holdsNoJournals = (error: PlatformError.PlatformError): boolean => isNoJournalsReason(error.reason._tag);

const storeError =
  (message: string, path: string) =>
  (cause: unknown): AttemptJournalStoreError =>
    AttemptJournalStoreError.make({ message, path, cause });

// Non-empty lines, verbatim: the store keeps the checkout's bytes, a torn tail included.
const journalLines: (text: string) => ReadonlyArray<string> = flow(
  Str.split("\n"),
  A.filter(flow(Str.trim, Str.isNonEmpty))
);

const unread = ContainedFileRead.make({ exists: false, contents: O.none() });

type CheckoutJournal = {
  readonly runId: string;
  readonly lines: ReadonlyArray<string>;
};

// A run's journal as the economics reader sees it: a symlinked run directory or
// journal is refused by the no-follow read and skipped, as economics skips it; a
// run directory without a journal is skipped; a journal that exists but cannot be
// read fails the export, so the removal keeps the checkout.
const readCheckoutJournal = Effect.fnUntraced(function* (runsDirectory: string, runId: string) {
  const path = yield* Path.Path;
  const journal = path.join(runsDirectory, runId, JOURNAL_FILE_NAME);
  const read = yield* readContainedFileStringNoFollow(runsDirectory, journal).pipe(
    Effect.catchTag("FsGuardError", () => Effect.succeed(unread))
  );
  if (read.exists && O.isNone(read.contents)) {
    return yield* AttemptJournalStoreError.make({
      message: `Could not read the attempt journal ${journal}.`,
      path: journal,
    });
  }
  return O.map(read.contents, (text): CheckoutJournal => ({ runId, lines: journalLines(text) }));
});

const readCheckoutJournals = Effect.fnUntraced(function* (checkout: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const runsDirectory = path.join(checkout, DEFAULT_YEET_PACKET_DIR, RUNS_DIRECTORY_NAME);
  const names = yield* fs.readDirectory(runsDirectory).pipe(
    Effect.catchIf(holdsNoJournals, () => Effect.succeed(A.empty<string>())),
    Effect.mapError(storeError(`Could not list the attempt journals under ${runsDirectory}.`, runsDirectory))
  );
  const journals = yield* Effect.forEach(A.sort(names, Order.String), (runId) =>
    readCheckoutJournal(runsDirectory, runId)
  );
  return A.getSomes(journals);
});

// Rows the store's journal does not hold yet are appended in one write that
// starts with a newline, the admission archive's rule, so a torn tail left by an
// interrupted append stays on its own line. Two removals racing on one run may
// both append a row; economics folds a run journal by attempt id, so a repeated
// row counts as a duplicate, never as a second attempt.
const fileJournal = Effect.fnUntraced(function* (storeRunsDirectory: string, journal: CheckoutJournal) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = path.join(storeRunsDirectory, journal.runId);
  const target = path.join(directory, JOURNAL_FILE_NAME);
  yield* fs
    .makeDirectory(directory, { recursive: true, mode: 0o700 })
    .pipe(Effect.mapError(storeError(`Could not create the retained run directory ${directory}.`, directory)));
  const stored = yield* fs.readFileString(target).pipe(
    Effect.catchIf(isNotFound, () => Effect.succeed(Str.empty)),
    Effect.mapError(storeError(`Could not read the retained journal ${target}.`, target))
  );
  const held = HashSet.fromIterable(journalLines(stored));
  const appended = A.dedupe(A.filter(journal.lines, (line) => !HashSet.has(held, line)));
  yield* A.isReadonlyArrayEmpty(appended)
    ? Effect.void
    : fs
        .writeFileString(target, `\n${A.join(appended, "\n")}\n`, { flag: "a", mode: 0o600 })
        .pipe(Effect.mapError(storeError(`Could not append to the retained journal ${target}.`, target)));
  return { appendedRows: A.length(appended), retainedRows: A.length(journal.lines) - A.length(appended) };
});

/**
 * Resolve the store's runs directory for a repository.
 *
 * **Details**
 *
 * `<yeet state>/attempts/<host__owner__name>/runs`, where the yeet state root
 * is `BEEP_YEET_STATE_ROOT`, else `$XDG_STATE_HOME/beep/yeet`, else
 * `$HOME/.local/state/beep/yeet`. Fails when neither variable holds an
 * absolute path.
 *
 * **Example** (Locate a repository's retained journals)
 *
 * ```ts
 * import { attemptJournalStoreRunsDirectory, PrRepository } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const repository = PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" })
 * console.log(Effect.isEffect(attemptJournalStoreRunsDirectory(repository))) // true
 * ```
 *
 * @param repository - The repository the store is partitioned by.
 * @returns The absolute runs directory of the repository's partition.
 * @category utilities
 * @since 0.0.0
 */
export const attemptJournalStoreRunsDirectory = Effect.fn("AttemptJournalStore.runsDirectory")(function* (
  repository: PrRepository
): Effect.fn.Return<string, AttemptJournalStoreError, Path.Path> {
  const path = yield* Path.Path;
  const root = yield* resolveWorkstationStateDir({ override: yeetStateRootEnvVar, store: "yeet" }).pipe(
    Effect.mapError((cause) =>
      AttemptJournalStoreError.make({ message: "Could not resolve the yeet state root for attempt journals.", cause })
    )
  );
  return path.join(root, STORE_DIRECTORY_NAME, fleetRepositoryKey(repository), RUNS_DIRECTORY_NAME);
});

// The partition comes from the checkout's own git metadata: a linked worktree's
// `.git` file names its clone, even for a fenced or nested copy, so no caller can
// file a lane under another repository.
const retainAttemptJournals = Effect.fnUntraced(function* (checkout: string) {
  const journals = yield* readCheckoutJournals(checkout);
  if (A.isReadonlyArrayEmpty(journals)) return O.none<AttemptJournalExport>();
  const clone = yield* readCheckoutClone(checkout);
  const repository = yield* readCloneFleetRepository(O.getOrElse(clone, () => checkout));
  if (O.isNone(repository)) {
    return O.some<AttemptJournalExport>(AttemptJournalExportUnpartitioned.make({ journals: A.length(journals) }));
  }
  const runsDirectory = yield* attemptJournalStoreRunsDirectory(repository.value);
  const filed = yield* Effect.forEach(journals, (journal) => fileJournal(runsDirectory, journal));
  return O.some<AttemptJournalExport>(
    AttemptJournalExported.make({
      runsDirectory,
      journals: A.length(journals),
      appendedRows: Num.sumAll(A.map(filed, (rows) => rows.appendedRows)),
      retainedRows: Num.sumAll(A.map(filed, (rows) => rows.retainedRows)),
    })
  );
});

/**
 * Operations the attempt-journal store provides.
 *
 * **Example** (Describe an export)
 *
 * ```ts
 * import type { AttemptJournalStoreShape } from "@beep/repo-cli/test/Yeet"
 *
 * const retainLane = (store: AttemptJournalStoreShape) => store.retain("/repo/.claude/worktrees/lane")
 * console.log(retainLane.length) // 1
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface AttemptJournalStoreShape {
  /**
   * File a checkout's attempt journals in the store before the checkout is removed.
   *
   * @param checkout - The checkout whose `.beep/yeet/runs` journals are exported; the `origin` of the clone its git metadata names is the store partition.
   * @returns What the export did, or `O.none()` when the checkout holds no journal.
   * @since 0.0.0
   */
  readonly retain: (checkout: string) => Effect.Effect<O.Option<AttemptJournalExport>, AttemptJournalStoreError>;
}

/**
 * Service that files a checkout's attempt journals in the workstation store.
 *
 * **Details**
 *
 * `retain` reads every readable `.beep/yeet/runs/<runId>/attempts.ndjson` of
 * the checkout and appends each row its store journal does not hold yet, so
 * exporting the same journals twice, or a restored lane's grown journal,
 * stores each row once. The partition is the GitHub repository named by the
 * `origin` of the clone the checkout's git metadata points to; a clone with no
 * such origin has no partition, so its journals are reported `unpartitioned`
 * and not copied. Any read or write failure fails the call: the worktree
 * removal service then deletes nothing, and residue-reap leaves the directory
 * in place.
 *
 * **Example** (Export a lane's journals)
 *
 * ```ts
 * import { AttemptJournalStore } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const program = AttemptJournalStore.use((store) => store.retain("/repo/.claude/worktrees/lane"))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class AttemptJournalStore extends Context.Service<AttemptJournalStore, AttemptJournalStoreShape>()(
  $I`AttemptJournalStore`
) {
  /**
   * The filesystem store. Only the filesystem and path services are captured,
   * so the caller's `ConfigProvider` still resolves the state root.
   */
  static readonly layer: Layer.Layer<AttemptJournalStore, never, FileSystem.FileSystem | Path.Path> = Layer.effect(
    AttemptJournalStore,
    Effect.map(Effect.context<FileSystem.FileSystem | Path.Path>(), (runtime) => {
      const context = Context.pick(FileSystem.FileSystem, Path.Path)(runtime);
      return AttemptJournalStore.of({
        retain: Effect.fn("AttemptJournalStore.retain")((checkout: string) =>
          retainAttemptJournals(checkout).pipe(Effect.provide(context))
        ),
      });
    })
  );
}

/**
 * Render an export as the one summary line removal receipts print.
 *
 * **Example** (Render an export)
 *
 * ```ts
 * import { AttemptJournalExported, renderAttemptJournalExport } from "@beep/repo-cli/test/Yeet"
 *
 * const line = renderAttemptJournalExport(
 *   AttemptJournalExported.make({ runsDirectory: "/state/runs", journals: 1, appendedRows: 4, retainedRows: 0 })
 * )
 * console.log(line) // "attempt journals: 1 exported to /state/runs (4 new rows, 0 already retained)"
 * ```
 *
 * @param journalExport - What the export did.
 * @returns The summary line, without indentation.
 * @category formatting
 * @since 0.0.0
 */
export const renderAttemptJournalExport: (journalExport: AttemptJournalExport) => string = AttemptJournalExport.match({
  exported: ({ journals, runsDirectory, appendedRows, retainedRows }) =>
    `attempt journals: ${journals} exported to ${runsDirectory} (${appendedRows} new rows, ${retainedRows} already retained)`,
  unpartitioned: ({ journals }) =>
    `attempt journals: ${journals} not exported; the owning clone's origin names no GitHub repository to file them under`,
});
