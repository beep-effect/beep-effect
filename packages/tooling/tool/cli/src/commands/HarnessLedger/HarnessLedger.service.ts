/**
 * Harness ledger service: propose, disposition, list, and pruning proposals
 * over the append-only `harness-ledger/rows/*.jsonl` store.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import {
  contextSurfaceId,
  HarnessEditRefKind,
  HarnessFingerprintParts,
  HarnessLedgerRow,
  harnessFingerprintFromParts,
  isStale,
  LedgerDisposition,
  makeHarnessLedgerRowId,
} from "@beep/repo-ai-metrics";
import { A, O, pipe } from "@beep/utils";
import { Context, DateTime, Effect, Layer } from "effect";
import * as HashSet from "effect/HashSet";
import { HarnessLedgerChainError, HarnessLedgerInputError, HarnessLedgerIoError } from "./HarnessLedger.errors.ts";
import {
  HarnessLedgerListEntry,
  HarnessLedgerPruneReport,
  PruneProposal,
  prunableSurfaceMechanism,
} from "./HarnessLedger.schemas.ts";
import { captureHarnessFingerprint } from "./internal/Fingerprint.ts";
import { chainHeads, chainLength, successorOf } from "./internal/LedgerChains.ts";
import {
  appendLedgerRows,
  findLedgerRow,
  ledgerMonthOf,
  readLedgerRows,
  withLedgerWriteFence,
} from "./internal/LedgerFiles.ts";
import { enumeratePruneCandidates, observeSessionWindow } from "./internal/PruneWindow.ts";
import type { FileSystem, Path } from "effect";
import type { HarnessLedgerCommandError } from "./HarnessLedger.errors.ts";
import type {
  HarnessLedgerDispositionOptions,
  HarnessLedgerListOptions,
  HarnessLedgerProposeOptions,
  HarnessLedgerPruneOptions,
  ObservedSessionWindow,
  PruneSurfaceCandidate,
} from "./HarnessLedger.schemas.ts";

const $I = $RepoCliId.create("commands/HarnessLedger/HarnessLedger.service");

/**
 * Operations of {@link HarnessLedgerService}.
 *
 * @category services
 * @since 0.0.0
 */
export interface HarnessLedgerServiceShape {
  /**
   * Append a row superseding the latest row of a chain with a human disposition.
   *
   * @since 0.0.0
   */
  readonly disposition: (
    options: HarnessLedgerDispositionOptions
  ) => Effect.Effect<HarnessLedgerRow, HarnessLedgerCommandError>;

  /**
   * Fold every chain to its latest row and apply the list filters.
   *
   * Staleness compares the harness hashes captured now plus only the model
   * and reasoning-effort components the options supply; an unset component
   * is not compared, so each row's own recorded value stands in for it.
   *
   * @since 0.0.0
   */
  readonly list: (
    options: HarnessLedgerListOptions
  ) => Effect.Effect<ReadonlyArray<HarnessLedgerListEntry>, HarnessLedgerCommandError>;
  /**
   * Capture the current fingerprint and append one `proposed` row.
   *
   * @since 0.0.0
   */
  readonly propose: (
    options: HarnessLedgerProposeOptions
  ) => Effect.Effect<HarnessLedgerRow, HarnessLedgerCommandError>;

  /**
   * Propose retiring every skill and MCP server with zero touches in
   * the last N hook-pulse sessions for read-only inspection. Writes fail until
   * sessions can be filtered by the current harness hash.
   *
   * @since 0.0.0
   */
  readonly pruneProposals: (
    options: HarnessLedgerPruneOptions
  ) => Effect.Effect<HarnessLedgerPruneReport, HarnessLedgerCommandError>;
}

/**
 * Service tag for harness ledger operations.
 *
 * **Example** (Proposing through the service)
 *
 * ```ts
 * import { HarnessLedgerProposeOptions, HarnessLedgerService } from "@beep/repo-cli/commands/HarnessLedger"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.flatMap(HarnessLedgerService, (ledger) =>
 *   ledger.propose(
 *     HarnessLedgerProposeOptions.make({ repoRoot: "/repo", mechanismClass: "skill", edit: { kind: "pending" } })
 *   )
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class HarnessLedgerService extends Context.Service<HarnessLedgerService, HarnessLedgerServiceShape>()(
  $I`HarnessLedgerService`
) {}

const proposeImpl = Effect.fn("HarnessLedger.propose")(function* (options: HarnessLedgerProposeOptions) {
  const fingerprint = yield* captureHarnessFingerprint(options.repoRoot, options.modelId, options.reasoningEffort);
  const createdAt = yield* DateTime.now;
  const rowId = yield* makeHarnessLedgerRowId(createdAt);
  const row = HarnessLedgerRow.make({
    rowId,
    createdAt,
    edit: options.edit,
    hypothesis: options.hypothesis,
    mechanismClass: options.mechanismClass,
    fingerprint,
    repoRevision: options.repoRevision,
    disposition: LedgerDisposition.Enum.proposed,
  });
  yield* withLedgerWriteFence(options.repoRoot, appendLedgerRows(options.repoRoot, [row]));
  return row;
});

// Runs under the ledger write fence: the successor check and the append must
// not interleave with another writer, or two dispositions of one head fork
// the chain.
const appendDisposition = Effect.fn("HarnessLedger.appendDisposition")(function* (
  options: HarnessLedgerDispositionOptions
) {
  const rows = yield* readLedgerRows(options.repoRoot);
  const previous = yield* Effect.fromOption(findLedgerRow(rows, options.rowId)).pipe(
    Effect.mapError(() => HarnessLedgerChainError.new(options.rowId, `No ledger row ${options.rowId}.`))
  );
  const successor = successorOf(rows, previous.rowId);
  if (O.isSome(successor)) {
    return yield* HarnessLedgerChainError.new(
      previous.rowId,
      `${previous.rowId} is superseded by ${successor.value.rowId}; disposition the latest row of its chain.`
    );
  }
  const declared = yield* Effect.forEach(options.touched, (surface) =>
    contextSurfaceId(surface.kind, surface.name).pipe(
      Effect.mapError(HarnessLedgerIoError.wrap(`Failed to hash surface ${surface.kind}:${surface.name}.`))
    )
  );
  const createdAt = yield* DateTime.now;
  const rowId = yield* makeHarnessLedgerRowId(createdAt);
  const row = HarnessLedgerRow.make({
    rowId,
    createdAt,
    edit: previous.edit,
    hypothesis: previous.hypothesis,
    mechanismClass: previous.mechanismClass,
    touched: HashSet.union(previous.touched, HashSet.fromIterable(declared)),
    fingerprint: previous.fingerprint,
    repoRevision: previous.repoRevision,
    delta: O.orElse(options.delta, () => previous.delta),
    disposition: options.to,
    dispositionEvidence: O.some(options.evidence),
    resurrectWhen: options.resurrectWhen,
    previousRowId: O.some(previous.rowId),
    targetSurface: previous.targetSurface,
    windowSessions: previous.windowSessions,
  });
  yield* appendLedgerRows(options.repoRoot, [row]);
  return row;
});

const dispositionImpl = Effect.fn("HarnessLedger.disposition")(function* (options: HarnessLedgerDispositionOptions) {
  if (O.isSome(options.resurrectWhen) && options.to !== LedgerDisposition.Enum.tombstoned) {
    return yield* HarnessLedgerInputError.new("--resurrect-when is only accepted with --to tombstoned.");
  }
  return yield* withLedgerWriteFence(options.repoRoot, appendDisposition(options));
});

const passesFilter = <A>(filter: O.Option<A>, predicate: (value: A) => boolean): boolean =>
  O.match(filter, { onNone: () => true, onSome: predicate });

const listImpl = Effect.fn("HarnessLedger.list")(function* (options: HarnessLedgerListOptions) {
  const rows = yield* readLedgerRows(options.repoRoot);
  const current = yield* captureHarnessFingerprint(options.repoRoot, options.modelId, options.reasoningEffort);
  // An unset --model / --reasoning-effort is not compared: substitute the
  // row's own recorded component so only supplied components and the harness
  // hashes can make a row stale.
  const entries = yield* Effect.forEach(chainHeads(rows), (head) =>
    harnessFingerprintFromParts(
      HarnessFingerprintParts.make({
        modelId: O.getOrElse(options.modelId, () => head.fingerprint.modelId),
        reasoningEffort: O.getOrElse(options.reasoningEffort, () => head.fingerprint.reasoningEffort),
        harnessSessionHash: current.harnessSessionHash,
        harnessBaselineHash: current.harnessBaselineHash,
      })
    ).pipe(
      Effect.mapError(HarnessLedgerIoError.wrap("Failed to derive the row's current harness fingerprint.")),
      Effect.map((fingerprint) =>
        HarnessLedgerListEntry.make({
          row: head,
          stale: isStale(head, fingerprint),
          chainLength: chainLength(rows, head),
        })
      )
    )
  );
  return pipe(
    entries,
    A.filter(
      (entry) =>
        (!options.staleOnly || entry.stale) &&
        passesFilter(options.disposition, (disposition) => entry.row.disposition === disposition) &&
        passesFilter(options.month, (month) => ledgerMonthOf(entry.row.createdAt) === month)
    )
  );
});

const buildPruneProposals = Effect.fn("HarnessLedger.buildPruneProposals")(function* (
  options: HarnessLedgerPruneOptions,
  candidates: ReadonlyArray<PruneSurfaceCandidate>,
  sessionsObserved: number,
  windowEnd: DateTime.Utc
) {
  const fingerprint = yield* captureHarnessFingerprint(options.repoRoot, options.modelId, options.reasoningEffort);
  const createdAt = yield* DateTime.now;
  const evidence = `zero touches across ${sessionsObserved} sessions ending ${DateTime.formatIso(windowEnd)}`;
  return yield* Effect.forEach(candidates, (candidate) =>
    makeHarnessLedgerRowId(createdAt).pipe(
      Effect.map((rowId) =>
        PruneProposal.make({
          candidate,
          row: HarnessLedgerRow.make({
            rowId,
            createdAt,
            edit: { kind: HarnessEditRefKind.Enum.pending },
            mechanismClass: prunableSurfaceMechanism(candidate.kind),
            fingerprint,
            disposition: LedgerDisposition.Enum.proposed,
            dispositionEvidence: O.some(evidence),
            targetSurface: O.some(candidate.surfaceId),
            windowSessions: O.some(options.windowSessions),
          }),
        })
      )
    )
  );
});

// Reads open proposals and plans fresh ones without writing. Appending waits
// on hook-pulse sessions being scoped by the current harness hash; until then
// `pruneProposalsImpl` refuses `write` before this runs.
const planPruneProposals = Effect.fn("HarnessLedger.planPruneProposals")(function* (
  options: HarnessLedgerPruneOptions,
  candidates: ReadonlyArray<PruneSurfaceCandidate>,
  observed: ObservedSessionWindow
) {
  const rows = yield* readLedgerRows(options.repoRoot);
  const openTargets = pipe(
    chainHeads(rows),
    A.filter((head) => head.disposition === LedgerDisposition.Enum.proposed),
    A.map((head) => head.targetSurface),
    A.getSomes,
    HashSet.fromIterable
  );
  const untouched = A.filter(candidates, (candidate) => !HashSet.has(observed.touched, candidate.surfaceId));
  // No observed session is no evidence, not zero touches: propose nothing.
  const zeroTouch = observed.sessionsObserved === 0 ? A.empty<PruneSurfaceCandidate>() : untouched;
  const fresh = A.filter(zeroTouch, (candidate) => !HashSet.has(openTargets, candidate.surfaceId));
  const proposals = yield* O.match(observed.windowEnd, {
    onNone: () => Effect.succeed(A.empty<PruneProposal>()),
    onSome: (windowEnd) => buildPruneProposals(options, fresh, observed.sessionsObserved, windowEnd),
  });
  return HarnessLedgerPruneReport.make({
    windowSessions: options.windowSessions,
    sessionsObserved: observed.sessionsObserved,
    windowEnd: observed.windowEnd,
    shardsRead: observed.shardsRead,
    undecodableLines: observed.undecodableLines,
    candidates: A.length(candidates),
    touchedCandidates: A.length(candidates) - A.length(untouched),
    alreadyProposed: A.length(zeroTouch) - A.length(fresh),
    proposals,
  });
});

const pruneProposalsImpl = Effect.fn("HarnessLedger.pruneProposals")(function* (options: HarnessLedgerPruneOptions) {
  if (options.write) {
    return yield* HarnessLedgerInputError.new(
      "Cannot append pruning proposals until hook-pulse sessions are scoped by the current harness hash."
    );
  }
  const candidates = yield* enumeratePruneCandidates(options.repoRoot);
  const observed = yield* observeSessionWindow(options.stateDir, options.windowSessions);
  return yield* planPruneProposals(options, candidates, observed);
});

/**
 * Services the live harness ledger layer needs.
 *
 * @category services
 * @since 0.0.0
 */
export type HarnessLedgerServiceRequirements = FileSystem.FileSystem | Path.Path;

const makeHarnessLedgerService = Effect.fn("HarnessLedgerService.make")(function* () {
  const context = yield* Effect.context<HarnessLedgerServiceRequirements>();
  return HarnessLedgerService.of({
    propose: Effect.fn("HarnessLedgerService.propose")((options) => proposeImpl(options).pipe(Effect.provide(context))),
    disposition: Effect.fn("HarnessLedgerService.disposition")((options) =>
      dispositionImpl(options).pipe(Effect.provide(context))
    ),
    list: Effect.fn("HarnessLedgerService.list")((options) => listImpl(options).pipe(Effect.provide(context))),
    pruneProposals: Effect.fn("HarnessLedgerService.pruneProposals")((options) =>
      pruneProposalsImpl(options).pipe(Effect.provide(context))
    ),
  });
});

/**
 * Live harness ledger layer over the platform file system.
 *
 * **Example** (Providing the live layer)
 *
 * ```ts
 * import { HarnessLedgerServiceLive } from "@beep/repo-cli/commands/HarnessLedger"
 * import { NodeServices } from "@effect/platform-node"
 * import * as Layer from "effect/Layer"
 *
 * const layer = HarnessLedgerServiceLive.pipe(Layer.provide(NodeServices.layer))
 * console.log(Layer.isLayer(layer)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const HarnessLedgerServiceLive: Layer.Layer<HarnessLedgerService, never, HarnessLedgerServiceRequirements> =
  Layer.effect(HarnessLedgerService, makeHarnessLedgerService());
