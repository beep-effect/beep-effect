/**
 * The authored fleet registry: store, scan adoption, explicit registration,
 * and the joins behind `fleet --join` and `fleet describe`.
 *
 * The registry lives at `<state>/beep/fleet/<repo-key>/registry.json` beside
 * the session ledger. It never duplicates a ledger field: the joined views
 * read lane, PR and state from the ledger's newest rows for each checkout.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Git } from "@beep/git/Git";
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Str from "effect/String";
import { acquireJournalFileLock, releaseJournalFileLock } from "../../../internal/repo-run/AdmissionJournal.ts";
import { publishJournalTextAtomically } from "../../../internal/repo-run/JournalFile.ts";
import { SessionLedger } from "../../Session/SessionLedger.service.ts";
import { FleetMirrorService } from "../Fleet.service.ts";
import { WorktreeCommandError } from "../Worktree.errors.ts";
import {
  FleetAdoptionCandidate,
  FleetCheckoutDescription,
  FleetJoin,
  FleetJoinedRow,
  FleetRegistryDocument,
  FleetRegistryRow,
  FleetSeatRole,
} from "./FleetRegistry.schemas.ts";
import { fleetStateDirectory, readOptionalFleetStateFile } from "./FleetRoots.ts";
import type { SessionLedgerRow } from "../../Session/Session.schemas.ts";
import type { PrRepository } from "../../Yeet/internal/Provenance.ts";
import type { FleetCheckout, FleetScanOptions } from "../Worktree.schemas.ts";
import type { ConfiguredFleetRoots } from "./FleetRoots.schemas.ts";

const $I = $RepoCliId.create("commands/Worktree/internal/FleetRegistry");

/**
 * The registry document a repository starts from before anything is written.
 *
 * @category constants
 * @since 0.0.0
 */
export const EMPTY_FLEET_REGISTRY: FleetRegistryDocument = FleetRegistryDocument.make({
  schemaVersion: "fleet-registry/v1",
  rows: [],
});

const sortRows = (rows: ReadonlyArray<FleetRegistryRow>): ReadonlyArray<FleetRegistryRow> =>
  A.sortWith(rows, (row) => row.checkout, Order.String);

/**
 * Add a row for every candidate the registry does not know yet.
 *
 * **Details**
 *
 * Adoption is idempotent and additive: a checkout that already has a row
 * keeps it untouched (an explicit `register` therefore survives every
 * rescan), and no row is ever removed, even for a checkout the scan no longer
 * sees. Rows stay sorted by checkout path.
 *
 * **Example** (A registered row survives adoption)
 *
 * ```ts
 * import {
 *   adoptFleetRegistryRows,
 *   EMPTY_FLEET_REGISTRY,
 *   FleetAdoptionCandidate,
 *   FleetRegistryDocument,
 *   FleetRegistryRow,
 * } from "@beep/repo-cli/test/Worktree"
 *
 * const registered = FleetRegistryDocument.make({
 *   schemaVersion: "fleet-registry/v1",
 *   rows: [FleetRegistryRow.make({ checkout: "/p/beep-effect0", seatRole: "main" })],
 * })
 * const result = adoptFleetRegistryRows(registered, [
 *   FleetAdoptionCandidate.make({ checkout: "/p/beep-effect0", role: "legacy", owningSeat: null }),
 * ])
 * console.log(result.document.rows[0]?.seatRole, result.adopted.length) // "main" 0
 * console.log(EMPTY_FLEET_REGISTRY.rows.length) // 0
 * ```
 *
 * @param document - The current registry.
 * @param candidates - Every checkout the scan saw.
 * @returns The extended document and the rows it added.
 * @category utilities
 * @since 0.0.0
 */
export const adoptFleetRegistryRows: {
  (
    candidates: ReadonlyArray<FleetAdoptionCandidate>
  ): (document: FleetRegistryDocument) => {
    readonly document: FleetRegistryDocument;
    readonly adopted: ReadonlyArray<FleetRegistryRow>;
  };
  (
    document: FleetRegistryDocument,
    candidates: ReadonlyArray<FleetAdoptionCandidate>
  ): { readonly document: FleetRegistryDocument; readonly adopted: ReadonlyArray<FleetRegistryRow> };
} = dual(2, (document: FleetRegistryDocument, candidates: ReadonlyArray<FleetAdoptionCandidate>) => {
  const known = HashSet.fromIterable(A.map(document.rows, (row) => row.checkout));
  const adopted = pipe(
    candidates,
    A.dedupeWith((left, right) => left.checkout === right.checkout),
    A.filter((candidate) => !HashSet.has(known, candidate.checkout)),
    A.map((candidate) =>
      FleetRegistryRow.make({
        checkout: candidate.checkout,
        seatRole: candidate.role,
        owningSeat: candidate.owningSeat,
      })
    )
  );
  return {
    document: FleetRegistryDocument.make({
      schemaVersion: document.schemaVersion,
      rows: sortRows(A.appendAll(document.rows, adopted)),
    }),
    adopted,
  };
});

/**
 * Insert or replace one checkout's row.
 *
 * **Example** (Override an adopted role)
 *
 * ```ts
 * import { EMPTY_FLEET_REGISTRY, FleetRegistryRow, registerFleetRegistryRow } from "@beep/repo-cli/test/Worktree"
 *
 * const next = registerFleetRegistryRow(
 *   EMPTY_FLEET_REGISTRY,
 *   FleetRegistryRow.make({ checkout: "/p/beep/seats/review", seatRole: "review" })
 * )
 * console.log(next.rows[0]?.seatRole) // "review"
 * ```
 *
 * @param document - The current registry.
 * @param row - The row to write.
 * @returns The registry with exactly one row for `row.checkout`.
 * @category utilities
 * @since 0.0.0
 */
export const registerFleetRegistryRow: {
  (row: FleetRegistryRow): (document: FleetRegistryDocument) => FleetRegistryDocument;
  (document: FleetRegistryDocument, row: FleetRegistryRow): FleetRegistryDocument;
} = dual(2, (document: FleetRegistryDocument, row: FleetRegistryRow) =>
  FleetRegistryDocument.make({
    schemaVersion: document.schemaVersion,
    rows: sortRows(
      A.append(
        A.filter(document.rows, (existing) => existing.checkout !== row.checkout),
        row
      )
    ),
  })
);

/**
 * The adoption role for one mirror row.
 *
 * **Details**
 *
 * A clone whose parent is a legacy root is `legacy`; every other checkout is
 * `adopted`. Legacy roots are the prefix-matched entries of a configured list,
 * or the single root when the list was derived.
 *
 * **Example** (Classify a legacy clone)
 *
 * ```ts
 * import { ConfiguredFleetRoots, fleetAdoptionRole, FleetRootEntry } from "@beep/repo-cli/test/Worktree"
 *
 * const roots = ConfiguredFleetRoots.make({ source: "derived", roots: [FleetRootEntry.make({ path: "/p" })] })
 * console.log(fleetAdoptionRole({ roots, checkout: "/p/beep-effect0", kind: "clone" })) // "legacy"
 * console.log(fleetAdoptionRole({ roots, checkout: "/p/beep-effect0-worktrees/x", kind: "linked-worktree" })) // "adopted"
 * ```
 *
 * @param input - The roots the scan read, the checkout's absolute path and its mirror kind.
 * @returns `legacy` or `adopted`.
 * @category utilities
 * @since 0.0.0
 */
export const fleetAdoptionRole = ({
  roots,
  checkout,
  kind,
}: {
  readonly roots: ConfiguredFleetRoots;
  readonly checkout: string;
  readonly kind: FleetCheckout["kind"];
}): FleetSeatRole => {
  const legacyRoots = A.filter(roots.roots, (root) => roots.source === "derived" || root.namePrefix !== undefined);
  const parent = pipe(
    Str.lastIndexOf("/")(checkout),
    O.map((slash) => Str.slice(0, slash)(checkout))
  );
  const inLegacyRoot = O.exists(parent, (dir) => A.some(legacyRoots, (root) => root.path === dir));
  return kind === "clone" && inLegacyRoot ? FleetSeatRole.Enum.legacy : FleetSeatRole.Enum.adopted;
};

/**
 * Derive each linked worktree's owning seat from `git rev-parse --git-common-dir`.
 *
 * **Details**
 *
 * The owning seat is the clone whose `.git` holds the lane's state, the same
 * directory `yeet sweep --retire` and Codex `--add-dir` resolve. A clone owns
 * itself, so it gets `null`; a lane whose common dir cannot be read gets
 * `null` too, never a guess.
 *
 * **Example** (Build the derivation)
 *
 * ```ts
 * import { fleetAdoptionCandidates } from "@beep/repo-cli/test/Worktree"
 *
 * console.log(typeof fleetAdoptionCandidates) // "function"
 * ```
 *
 * @param roots - The roots the scan read.
 * @param checkouts - The mirror rows of that scan.
 * @returns One adoption candidate per mirror row.
 * @category utilities
 * @since 0.0.0
 */
export const fleetAdoptionCandidates = Effect.fn("FleetRegistry.adoptionCandidates")(function* (
  roots: ConfiguredFleetRoots,
  checkouts: ReadonlyArray<FleetCheckout>
): Effect.fn.Return<ReadonlyArray<FleetAdoptionCandidate>, never, Git | Path.Path> {
  const git = yield* Git;
  const path = yield* Path.Path;
  return yield* Effect.forEach(
    checkouts,
    Effect.fnUntraced(function* (row): Effect.fn.Return<FleetAdoptionCandidate> {
      const role = fleetAdoptionRole({ roots, checkout: row.path, kind: row.kind });
      if (row.kind === "clone") {
        return FleetAdoptionCandidate.make({ checkout: row.path, role, owningSeat: null });
      }
      const commonDir = yield* git.commonDir(row.path).pipe(Effect.option);
      const owningSeat = O.getOrNull(
        O.map(commonDir, (output) => path.dirname(path.resolve(row.path, Str.trim(output))))
      );
      return FleetAdoptionCandidate.make({ checkout: row.path, role, owningSeat });
    }),
    { concurrency: 8 }
  );
});

const newestFirst = Order.flip(Order.mapInput(DateTime.Order, (row: SessionLedgerRow) => row.recordedAt));

/**
 * The newest ledger rows recorded for one checkout, newest first.
 *
 * **Example** (No history reads empty)
 *
 * ```ts
 * import { ledgerRowsForCheckout } from "@beep/repo-cli/test/Worktree"
 *
 * console.log(ledgerRowsForCheckout({ rows: [], checkout: "/p/beep-effect0", limit: 5 })) // []
 * ```
 *
 * @param input - Every ledger row of the repository, the checkout's absolute path, and how many rows to keep.
 * @returns At most `limit` rows for `checkout`, newest first.
 * @category utilities
 * @since 0.0.0
 */
export const ledgerRowsForCheckout = ({
  rows,
  checkout,
  limit,
}: {
  readonly rows: ReadonlyArray<SessionLedgerRow>;
  readonly checkout: string;
  readonly limit: number;
}): ReadonlyArray<SessionLedgerRow> =>
  A.take(
    A.sort(
      A.filter(rows, (row) => row.checkout === checkout),
      newestFirst
    ),
    limit
  );

const latestLedgerByCheckout = (rows: ReadonlyArray<SessionLedgerRow>): HashMap.HashMap<string, SessionLedgerRow> =>
  A.reduce(A.sort(rows, Order.flip(newestFirst)), HashMap.empty<string, SessionLedgerRow>(), (latest, row) =>
    HashMap.set(latest, row.checkout, row)
  );

const fallbackRow = (row: FleetCheckout): FleetRegistryRow =>
  FleetRegistryRow.make({ checkout: row.path, seatRole: FleetSeatRole.Enum.adopted });

/**
 * Join mirror rows with registry rows and each checkout's newest ledger row.
 *
 * **Details**
 *
 * One output row per mirror row, in mirror order. A mirror row with no
 * registry row (only possible when the caller skipped adoption) reads as
 * `adopted` with defaults; a checkout with no ledger history has `null` lane,
 * PR and state.
 *
 * **Example** (Join an empty fleet)
 *
 * ```ts
 * import { EMPTY_FLEET_REGISTRY, joinFleetRows } from "@beep/repo-cli/test/Worktree"
 *
 * console.log(joinFleetRows({ checkouts: [], registry: EMPTY_FLEET_REGISTRY, ledger: [] })) // []
 * ```
 *
 * @param input - The mirror's checkout rows, the authored registry, and every session-ledger row of the repository.
 * @returns One compact joined row per checkout.
 * @category utilities
 * @since 0.0.0
 */
export const joinFleetRows = ({
  checkouts,
  registry,
  ledger,
}: {
  readonly checkouts: ReadonlyArray<FleetCheckout>;
  readonly registry: FleetRegistryDocument;
  readonly ledger: ReadonlyArray<SessionLedgerRow>;
}): ReadonlyArray<FleetJoinedRow> => {
  const registered = HashMap.fromIterable(A.map(registry.rows, (row) => [row.checkout, row] as const));
  const latest = latestLedgerByCheckout(ledger);
  return A.map(checkouts, (row) => {
    const authored = O.getOrElse(HashMap.get(registered, row.path), () => fallbackRow(row));
    const session = HashMap.get(latest, row.path);
    return FleetJoinedRow.make({
      path: row.path,
      kind: row.kind,
      branch: row.branch,
      liveness: row.liveness,
      dirtyCount: row.dirtyCount,
      seatRole: authored.seatRole,
      owningSeat: authored.owningSeat,
      drainStatus: authored.drainStatus,
      retentionExempt: authored.retentionExempt,
      lane: O.getOrNull(O.map(session, (entry) => entry.lane)),
      pr: O.getOrNull(O.flatMap(session, (entry) => entry.pr)),
      state: O.getOrNull(O.map(session, (entry) => entry.state)),
    });
  });
};

/**
 * Expand one checkout into its full mirror record, registry row and newest
 * ledger rows.
 *
 * **Example** (A checkout the mirror does not know)
 *
 * ```ts
 * import { describeFleetCheckout, EMPTY_FLEET_REGISTRY } from "@beep/repo-cli/test/Worktree"
 * import * as O from "effect/Option"
 *
 * const description = describeFleetCheckout({
 *   checkouts: [],
 *   registry: EMPTY_FLEET_REGISTRY,
 *   ledger: [],
 *   checkout: "/p/x",
 *   ledgerLimit: 5,
 * })
 * console.log(O.isNone(description)) // true
 * ```
 *
 * @param input - The mirror rows, registry, ledger rows, the checkout to expand, and how many ledger rows to include.
 * @returns The description, or `O.none()` when the mirror has no such checkout.
 * @category utilities
 * @since 0.0.0
 */
export const describeFleetCheckout = ({
  checkouts,
  registry,
  ledger,
  checkout,
  ledgerLimit,
}: {
  readonly checkouts: ReadonlyArray<FleetCheckout>;
  readonly registry: FleetRegistryDocument;
  readonly ledger: ReadonlyArray<SessionLedgerRow>;
  readonly checkout: string;
  readonly ledgerLimit: number;
}): O.Option<FleetCheckoutDescription> =>
  O.map(
    A.findFirst(checkouts, (row) => row.path === checkout),
    (row) =>
      FleetCheckoutDescription.make({
        checkout: row,
        registry: O.getOrElse(
          A.findFirst(registry.rows, (entry) => entry.checkout === checkout),
          () => fallbackRow(row)
        ),
        ledger: ledgerRowsForCheckout({ rows: ledger, checkout, limit: ledgerLimit }),
      })
  );

/**
 * Service contract for the file-backed registry.
 *
 * @category services
 * @since 0.0.0
 */
export interface FleetRegistryStoreShape {
  /**
   * Read a repository's registry; a missing file reads as an empty registry.
   *
   * @since 0.0.0
   */
  readonly read: (repository: PrRepository) => Effect.Effect<FleetRegistryDocument, WorktreeCommandError>;
  /**
   * Read-modify-write a repository's registry under its lock file.
   *
   * **Details**
   *
   * The lock spans the re-read, `transform` and the atomic publish, so a
   * concurrent `fleet register` and `fleet --join` never overwrite each other's
   * rows. The file is rewritten only when the document changed. `transform`
   * returns the next document and a value handed back to the caller.
   *
   * @since 0.0.0
   */
  readonly update: <A>(
    repository: PrRepository,
    transform: (current: FleetRegistryDocument) => readonly [FleetRegistryDocument, A]
  ) => Effect.Effect<readonly [FleetRegistryDocument, A], WorktreeCommandError>;
}

/**
 * Service tag for the fleet registry store.
 *
 * **Example** (Access the store)
 *
 * ```ts
 * import { FleetRegistryStore } from "@beep/repo-cli/test/Worktree"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.flatMap(FleetRegistryStore.asEffect(), (store) =>
 *   store.read({ host: "github.com", owner: "beep-effect", name: "beep-effect" })
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class FleetRegistryStore extends Context.Service<FleetRegistryStore, FleetRegistryStoreShape>()(
  $I`FleetRegistryStore`
) {}

const RegistryJson = S.fromJsonString(FleetRegistryDocument, { space: 2 });
const decodeRegistry = S.decodeUnknownEffect(RegistryJson);
const encodeRegistry = S.encodeEffect(RegistryJson);

const registryFile = Effect.fn("FleetRegistry.file")(function* (repository: PrRepository) {
  const path = yield* Path.Path;
  const directory = yield* fleetStateDirectory(repository);
  return { directory, file: path.join(directory, "registry.json") };
});

const readRegistry = Effect.fn("FleetRegistryStore.read")(function* (repository: PrRepository) {
  const { file } = yield* registryFile(repository);
  const content = yield* readOptionalFleetStateFile(file);
  if (O.isNone(content)) {
    return EMPTY_FLEET_REGISTRY;
  }
  return yield* decodeRegistry(content.value).pipe(
    Effect.mapError(WorktreeCommandError.new(`Failed to decode ${file} as a fleet registry.`, { path: file }))
  );
});

const encodeRegistryText = (document: FleetRegistryDocument, file: string) =>
  encodeRegistry(document).pipe(
    Effect.mapError(WorktreeCommandError.new("Failed to encode the fleet registry.", { path: file }))
  );

const updateRegistry = Effect.fn("FleetRegistryStore.update")(function* <A>(
  repository: PrRepository,
  transform: (current: FleetRegistryDocument) => readonly [FleetRegistryDocument, A]
) {
  const fs = yield* FileSystem.FileSystem;
  const random = yield* SecureRandom.SecureRandom;
  const { directory, file } = yield* registryFile(repository);
  yield* fs
    .makeDirectory(directory, { recursive: true })
    .pipe(Effect.mapError(WorktreeCommandError.new(`Failed to create ${directory}.`, { path: directory })));
  const lockPath = `${file}.lock`;
  const token = yield* random.uuidV4();
  if (!(yield* acquireJournalFileLock(lockPath, token))) {
    return yield* WorktreeCommandError.make({
      message: `Timed out waiting for the fleet registry lock ${lockPath}.`,
      path: lockPath,
    });
  }
  return yield* Effect.ensuring(
    Effect.gen(function* () {
      const current = yield* readRegistry(repository);
      const [next, value] = transform(current);
      const before = yield* encodeRegistryText(current, file);
      const after = yield* encodeRegistryText(next, file);
      if (after !== before) {
        yield* publishJournalTextAtomically(file, `${after}\n`, "fleet registry").pipe(
          Effect.mapError(WorktreeCommandError.new(`Failed to write ${file}.`, { path: file }))
        );
      }
      return [next, value] as const;
    }),
    releaseJournalFileLock(lockPath, token)
  );
});

/**
 * Live file-backed layer for {@link FleetRegistryStore}.
 *
 * **Example** (Reference the live layer)
 *
 * ```ts
 * import { FleetRegistryStoreLive } from "@beep/repo-cli/test/Worktree"
 *
 * console.log(typeof FleetRegistryStoreLive) // "object"
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const FleetRegistryStoreLive: Layer.Layer<
  FleetRegistryStore,
  never,
  FileSystem.FileSystem | Path.Path | SecureRandom.SecureRandom | Digest.Digest
> = Layer.effect(
  FleetRegistryStore,
  Effect.gen(function* () {
    // Only the services the store uses: the caller's Clock and ConfigProvider must stay in effect, so a store
    // built under a test clock or one environment never overrides the caller's.
    const runtime = yield* Effect.context<
      FileSystem.FileSystem | Path.Path | SecureRandom.SecureRandom | Digest.Digest
    >();
    const context = Context.pick(FileSystem.FileSystem, Path.Path, SecureRandom.SecureRandom, Digest.Digest)(runtime);
    // The lock file serializes processes; this permit serializes fibers of one process, which a
    // same-process lock-file contender would otherwise spin against.
    const writer = yield* Semaphore.make(1);
    return FleetRegistryStore.of({
      read: Effect.fn("FleetRegistryStore.read")((repository) =>
        readRegistry(repository).pipe(Effect.provide(context))
      ),
      update: Effect.fn("FleetRegistryStore.update")(function* <A>(
        repository: PrRepository,
        transform: (current: FleetRegistryDocument) => readonly [FleetRegistryDocument, A]
      ) {
        return yield* updateRegistry(repository, transform).pipe(Effect.provide(context), writer.withPermits(1));
      }),
    });
  })
);

/**
 * Scan the fleet, adopt unregistered checkouts into the registry, and read
 * the repository's session ledger.
 *
 * **Details**
 *
 * This is the only fleet path that writes: it persists adopted rows, and only
 * when adoption added any. Plain `beep worktree fleet` never calls it.
 *
 * **Example** (Build the join)
 *
 * ```ts
 * import { FleetScanOptions, loadFleetJoin } from "@beep/repo-cli/test/Worktree"
 * import * as Effect from "effect/Effect"
 *
 * const join = loadFleetJoin(FleetScanOptions.make({}), { host: "github.com", owner: "beep-effect", name: "beep-effect" })
 * console.log(Effect.isEffect(join)) // true
 * ```
 *
 * @param options - Scan options; discovery roots resolve from them as for `fleet --json`.
 * @param repository - The repository keying the registry and the session ledger.
 * @returns The roots, snapshot, persisted registry, rows adopted by this scan, and ledger rows.
 * @category utilities
 * @since 0.0.0
 */
export const loadFleetJoin = Effect.fn("FleetRegistry.loadJoin")(function* (
  options: FleetScanOptions,
  repository: PrRepository
): Effect.fn.Return<
  FleetJoin,
  WorktreeCommandError,
  FleetMirrorService | FleetRegistryStore | SessionLedger | Git | Path.Path
> {
  const mirror = yield* FleetMirrorService;
  const store = yield* FleetRegistryStore;
  const ledgerStore = yield* SessionLedger;
  const roots = yield* mirror.roots(options);
  const snapshot = yield* mirror.scan(options);
  const candidates = yield* fleetAdoptionCandidates(roots, snapshot.checkouts);
  // Adoption runs on the registry as it is under the lock, so a concurrent register is never overwritten.
  const [document, adopted] = yield* store.update(repository, (current) => {
    const result = adoptFleetRegistryRows(current, candidates);
    return [result.document, result.adopted] as const;
  });
  const ledger = yield* ledgerStore
    .list(repository)
    .pipe(Effect.mapError(WorktreeCommandError.new("Failed to read the session ledger.")));
  return FleetJoin.make({ roots, snapshot, registry: document, adopted, ledger });
});
