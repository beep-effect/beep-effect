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
  deriveHarnessHash,
  HarnessEditRefKind,
  HarnessFingerprintParts,
  HarnessLedgerRow,
  harnessFingerprintFromParts,
  isStale,
  LedgerDisposition,
  makeHarnessLedgerRowId,
} from "@beep/repo-ai-metrics";
import { LiteralKit } from "@beep/schema";
import { A, O, pipe, Str } from "@beep/utils";
import { Context, DateTime, Effect, Layer, Result } from "effect";
import * as Bool from "effect/Boolean";
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
import type { HarnessFingerprint, HarnessHash } from "@beep/repo-ai-metrics";
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
   * Propose retiring every skill and MCP server with zero touches in the last
   * N hook-pulse sessions under the current harness hash. With `write` and a
   * full window (N sessions observed), the fresh proposals are appended under
   * the ledger write fence; otherwise nothing is written. A surface is not
   * proposed again while an open `proposed` chain targets it, or while a
   * decision on it stands under the current harness hash.
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
  fingerprint: HarnessFingerprint,
  candidates: ReadonlyArray<PruneSurfaceCandidate>,
  observed: ObservedSessionWindow,
  windowEnd: DateTime.Utc
) {
  const createdAt = yield* DateTime.now;
  // Names the regime by a hash prefix, never by a path.
  const evidence = `zero touches across ${observed.sessionsObserved} sessions under harness hash ${Str.slice(
    0,
    12
  )(observed.harnessHash)} ending ${DateTime.formatIso(windowEnd)}`;
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
            windowSessions: O.some(observed.sessionsObserved),
          }),
        })
      )
    )
  );
});

// Why a chain head keeps its target surface from a fresh proposal: an open
// `proposed` head blocks under any regime; a human decision blocks only while
// it was recorded under the current harness hash, because evidence gathered
// under an older harness has expired. A tombstone never blocks.
const ProposalBlock = LiteralKit(["open-proposal", "standing-decision"]);
type ProposalBlock = typeof ProposalBlock.Type;

const blockOf = Effect.fn("HarnessLedger.blockOf")(function* (head: HarnessLedgerRow, harnessHash: HarnessHash) {
  const decided: Effect.Effect<O.Option<ProposalBlock>, HarnessLedgerIoError> = deriveHarnessHash(
    head.fingerprint
  ).pipe(
    Effect.mapError(HarnessLedgerIoError.wrap(`Failed to derive the harness hash of ledger row ${head.rowId}.`)),
    Effect.map((recorded) => O.liftPredicate(ProposalBlock.Enum["standing-decision"], () => recorded === harnessHash))
  );
  return yield* LedgerDisposition.$match(head.disposition, {
    proposed: () => Effect.succeedSome<ProposalBlock>(ProposalBlock.Enum["open-proposal"]),
    accepted: () => decided,
    rejected: () => decided,
    deferred: () => decided,
    waived: () => decided,
    tombstoned: () => Effect.succeedNone,
  });
});

// Target surfaces of every chain head that blocks a fresh proposal, split by why.
const blockedTargets = Effect.fn("HarnessLedger.blockedTargets")(function* (
  rows: ReadonlyArray<HarnessLedgerRow>,
  harnessHash: HarnessHash
) {
  const blocks = yield* Effect.forEach(
    A.filterMap(chainHeads(rows), (head) =>
      O.match(head.targetSurface, {
        onNone: () => Result.failVoid,
        onSome: (target) => Result.succeed([head, target] as const),
      })
    ),
    ([head, target]) =>
      Effect.map(
        blockOf(head, harnessHash),
        O.map((block) => [block, target] as const)
      )
  );
  const targetsBlockedBy = (block: ProposalBlock): HashSet.HashSet<string> =>
    pipe(
      A.getSomes(blocks),
      A.filterMap(([reason, target]) => (reason === block ? Result.succeed(target) : Result.failVoid)),
      HashSet.fromIterable
    );
  return {
    open: targetsBlockedBy(ProposalBlock.Enum["open-proposal"]),
    decided: targetsBlockedBy(ProposalBlock.Enum["standing-decision"]),
  };
});

// Reads blocking chain heads and plans fresh proposals without writing. With
// `write` it runs under the ledger write fence, so the read and the append
// cannot interleave with another writer and propose one surface twice.
const planPruneProposals = Effect.fn("HarnessLedger.planPruneProposals")(function* (
  options: HarnessLedgerPruneOptions,
  fingerprint: HarnessFingerprint,
  candidates: ReadonlyArray<PruneSurfaceCandidate>,
  observed: ObservedSessionWindow
) {
  const rows = yield* readLedgerRows(options.repoRoot);
  const blocked = yield* blockedTargets(rows, observed.harnessHash);
  const untouched = A.filter(candidates, (candidate) => !HashSet.has(observed.touched, candidate.surfaceId));
  // No observed session is no evidence, not zero touches: propose nothing.
  const zeroTouch = observed.sessionsObserved === 0 ? A.empty<PruneSurfaceCandidate>() : untouched;
  const notOpen = A.filter(zeroTouch, (candidate) => !HashSet.has(blocked.open, candidate.surfaceId));
  const fresh = A.filter(notOpen, (candidate) => !HashSet.has(blocked.decided, candidate.surfaceId));
  const proposals = yield* O.match(observed.windowEnd, {
    onNone: () => Effect.succeed(A.empty<PruneProposal>()),
    onSome: (windowEnd) => buildPruneProposals(fingerprint, fresh, observed, windowEnd),
  });
  return HarnessLedgerPruneReport.make({
    windowSessions: options.windowSessions,
    harnessHash: observed.harnessHash,
    sessionsObserved: observed.sessionsObserved,
    windowFull: observed.sessionsObserved >= options.windowSessions,
    sessionsSkippedOutOfRegime: observed.sessionsSkippedOutOfRegime,
    sessionsSkippedUnstamped: observed.sessionsSkippedUnstamped,
    windowEnd: observed.windowEnd,
    shardsRead: observed.shardsRead,
    undecodableLines: observed.undecodableLines,
    candidates: A.length(candidates),
    touchedCandidates: A.length(candidates) - A.length(untouched),
    alreadyProposed: A.length(zeroTouch) - A.length(notOpen),
    decidedUnderHarness: A.length(notOpen) - A.length(fresh),
    proposals,
    written: false,
  });
});

// Plans and appends inside one fence; an empty plan appends nothing and
// reports `written: false`.
const appendPruneProposals = Effect.fn("HarnessLedger.appendPruneProposals")(function* (
  options: HarnessLedgerPruneOptions,
  fingerprint: HarnessFingerprint,
  candidates: ReadonlyArray<PruneSurfaceCandidate>,
  observed: ObservedSessionWindow
) {
  const report = yield* planPruneProposals(options, fingerprint, candidates, observed);
  return yield* A.match(report.proposals, {
    onEmpty: () => Effect.succeed(report),
    onNonEmpty: (proposals) =>
      appendLedgerRows(
        options.repoRoot,
        A.map(proposals, (proposal) => proposal.row)
      ).pipe(Effect.as(HarnessLedgerPruneReport.make({ ...report, written: true }))),
  });
});

const pruneProposalsImpl = Effect.fn("HarnessLedger.pruneProposals")(function* (options: HarnessLedgerPruneOptions) {
  const candidates = yield* enumeratePruneCandidates(options.repoRoot);
  const fingerprint = yield* captureHarnessFingerprint(options.repoRoot, options.modelId, options.reasoningEffort);
  const harnessHash = yield* deriveHarnessHash(fingerprint).pipe(
    Effect.mapError(HarnessLedgerIoError.wrap("Failed to derive the current harness hash."))
  );
  const observed = yield* observeSessionWindow(options.stateDir, options.windowSessions, harnessHash);
  // A partial window is shown but never written: a stored row must carry a
  // full window of evidence, so a written row's `windowSessions` (the observed
  // count) always equals the requested window.
  return yield* Bool.match(options.write && observed.sessionsObserved >= options.windowSessions, {
    onFalse: () => planPruneProposals(options, fingerprint, candidates, observed),
    onTrue: () =>
      withLedgerWriteFence(options.repoRoot, appendPruneProposals(options, fingerprint, candidates, observed)),
  });
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
