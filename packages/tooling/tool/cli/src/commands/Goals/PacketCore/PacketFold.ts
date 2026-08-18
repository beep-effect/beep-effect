/**
 * Deterministic fold over one packet's CAS event stream.
 *
 * **Details**
 *
 * Pure derivations only: the fold orders stored events, verifies the parent
 * chain, surfaces forks (two children of one parent) as first-class
 * verdicts (with a deterministic read-only repair plan for the first fork),
 * and derives the D3 stage values — `furthestStage` as the
 * monotonic high-water mark by ordinal and `resumeStage` as the cursor from
 * the last stage-carrying event — plus the effective risk-tier override,
 * all over the unambiguous linear prefix. The
 * trace projection binds the fold result to a `sourceTip` and projector
 * version so staleness is always derivable.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O, pipe } from "@beep/utils";
import { Effect, MutableHashMap, Order } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { optionalProp } from "../../../internal/cli/OptionRecord.ts";
import { isJsonRecord } from "../Inventory.ts";
import {
  PACKET_PROJECTOR_VERSION,
  PacketChainIssue,
  PacketDerivedState,
  PacketEvent,
  PacketForkRepairPlan,
  PacketForkVerdict,
  PacketRiskTierOverrideState,
  PacketTip,
  PacketTraceEntry,
  PacketTraceProjection,
} from "./PacketCore.schemas.ts";
import { canonicalJsonTextPretty, packetEventDigest } from "./PacketDigest.ts";
import type {
  PacketRoot,
  PacketSlug,
  PacketStage,
  PacketStageOrdinal,
  PacketStatusToken,
  RiskTierOverriddenBody,
  StoredPacketEvent,
} from "./PacketCore.schemas.ts";

/**
 * Upcasters bridging older packet-event schema versions to the current one.
 *
 * **Details**
 *
 * v1 is current, so the registry holds only the identity upcaster. A future
 * `packet-event/v2` adds a `packet-event/v1` entry here that rewrites the v1
 * wire shape forward, and the golden replay fixtures prove the rewritten
 * stream still folds byte-identically.
 *
 * **Example** (Look up the identity upcaster)
 *
 * ```ts
 * import { PACKET_EVENT_UPCASTERS } from "@beep/repo-cli/test/Goals"
 *
 * console.log(typeof PACKET_EVENT_UPCASTERS["packet-event/v1"]) // "function"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const PACKET_EVENT_UPCASTERS: Readonly<Record<string, (raw: unknown) => unknown>> = {
  "packet-event/v1": (raw) => raw,
};

/**
 * Apply the registered upcaster chain to a raw parsed event value.
 *
 * **Details**
 *
 * A value without a recognizable `schemaVersion` string is returned
 * unchanged so the subsequent schema decode reports the real issue instead
 * of an upcast failure masking it.
 *
 * **Example** (Upcast a current-version value)
 *
 * ```ts
 * import { upcastPacketEventJson } from "@beep/repo-cli/test/Goals"
 *
 * const raw = { schemaVersion: "packet-event/v1", seq: 1 }
 * console.log(upcastPacketEventJson(raw) === raw) // true
 * ```
 *
 * @param raw - Parsed JSON value from an event file.
 * @returns The value rewritten to the current event version.
 * @category decoding
 * @since 0.0.0
 */
export const upcastPacketEventJson = (raw: unknown): unknown => {
  if (!isJsonRecord(raw)) {
    return raw;
  }
  const version = pipe(R.get(raw, "schemaVersion"), O.filter(P.isString));
  if (O.isNone(version)) {
    return raw;
  }
  return pipe(
    R.get(PACKET_EVENT_UPCASTERS, version.value),
    O.match({
      onNone: () => raw,
      onSome: (upcast) => upcast(raw),
    })
  );
};

const GENESIS_PARENT_KEY = "";

const storedBySeqThenId = Order.combine(
  Order.mapInput(Order.Number, (stored: StoredPacketEvent) => stored.event.seq),
  Order.mapInput(Order.String, (stored: StoredPacketEvent) => stored.id)
);

const parentKey = (stored: StoredPacketEvent): string => stored.event.parent ?? GENESIS_PARENT_KEY;

const buildChildIndex = (
  events: ReadonlyArray<StoredPacketEvent>
): MutableHashMap.MutableHashMap<string, ReadonlyArray<StoredPacketEvent>> => {
  const index = MutableHashMap.empty<string, ReadonlyArray<StoredPacketEvent>>();
  for (const stored of events) {
    const key = parentKey(stored);
    const existing = pipe(MutableHashMap.get(index, key), O.getOrElse(A.empty<StoredPacketEvent>));
    MutableHashMap.set(index, key, A.append(existing, stored));
  }
  return index;
};

const collectForkVerdicts = (
  index: MutableHashMap.MutableHashMap<string, ReadonlyArray<StoredPacketEvent>>
): ReadonlyArray<PacketForkVerdict> => {
  let verdicts = A.empty<PacketForkVerdict>();
  for (const key of MutableHashMap.keys(index)) {
    const children = pipe(MutableHashMap.get(index, key), O.getOrElse(A.empty<StoredPacketEvent>));
    if (A.length(children) < 2) {
      continue;
    }
    const sorted = A.sort(children, storedBySeqThenId);
    const childSeq = pipe(
      A.head(sorted),
      O.map((stored) => stored.event.seq),
      O.getOrElse(() => 1)
    );
    verdicts = A.append(
      verdicts,
      PacketForkVerdict.make({
        ...(key === GENESIS_PARENT_KEY ? {} : { parent: key }),
        parentSeq: childSeq - 1,
        children: A.map(sorted, (stored) => stored.id),
      })
    );
  }
  return A.sort(
    verdicts,
    Order.mapInput(Order.Number, (verdict: PacketForkVerdict) => verdict.parentSeq)
  );
};

const missingParentIssues = (events: ReadonlyArray<StoredPacketEvent>): ReadonlyArray<PacketChainIssue> => {
  const known = MutableHashMap.empty<string, boolean>();
  for (const stored of events) {
    MutableHashMap.set(known, stored.id, true);
  }
  let issues = A.empty<PacketChainIssue>();
  for (const stored of events) {
    const parent = stored.event.parent;
    if (parent !== undefined && O.isNone(MutableHashMap.get(known, parent))) {
      issues = A.append(
        issues,
        PacketChainIssue.make({
          kind: "missing-parent",
          fileName: stored.fileName,
          detail: `parent digest ${parent} not found in the stream.`,
        })
      );
    }
  }
  return issues;
};

const soleChildOf = (
  index: MutableHashMap.MutableHashMap<string, ReadonlyArray<StoredPacketEvent>>,
  key: string
): O.Option<StoredPacketEvent> => {
  const children = pipe(MutableHashMap.get(index, key), O.getOrElse(A.empty<StoredPacketEvent>));
  return A.length(children) === 1 ? A.head(children) : O.none();
};

type LinearPrefix = {
  readonly prefix: ReadonlyArray<StoredPacketEvent>;
  readonly issues: ReadonlyArray<PacketChainIssue>;
};

const walkLinearPrefix = (
  index: MutableHashMap.MutableHashMap<string, ReadonlyArray<StoredPacketEvent>>
): LinearPrefix => {
  let prefix = A.empty<StoredPacketEvent>();
  let issues = A.empty<PacketChainIssue>();
  let key = GENESIS_PARENT_KEY;
  let previous = O.none<StoredPacketEvent>();
  for (;;) {
    const next = O.getOrUndefined(soleChildOf(index, key));
    if (next === undefined) {
      break;
    }
    if (O.isSome(previous) && next.event.seq !== previous.value.event.seq + 1) {
      issues = A.append(
        issues,
        PacketChainIssue.make({
          kind: "parent-seq-mismatch",
          fileName: next.fileName,
          detail: `event seq ${next.event.seq} chains onto parent seq ${previous.value.event.seq}.`,
        })
      );
      break;
    }
    prefix = A.append(prefix, next);
    previous = O.some(next);
    key = next.id;
  }
  return { prefix, issues };
};

type StageCursor = {
  readonly furthestStage: O.Option<PacketStage>;
  readonly furthestOrdinal: O.Option<PacketStageOrdinal>;
  readonly resumeStage: O.Option<PacketStage>;
};

const stepStageCursor = (cursor: StageCursor, stage: PacketStage, ordinal: PacketStageOrdinal): StageCursor => {
  const advances = pipe(
    cursor.furthestOrdinal,
    O.match({ onNone: () => true, onSome: (current) => ordinal >= current })
  );
  return {
    furthestStage: advances ? O.some(stage) : cursor.furthestStage,
    furthestOrdinal: advances ? O.some(ordinal) : cursor.furthestOrdinal,
    resumeStage: O.some(stage),
  };
};

type PrefixDerivation = {
  readonly status: O.Option<PacketStatusToken>;
  readonly cursor: StageCursor;
  readonly riskTierOverride: O.Option<PacketRiskTierOverrideState>;
};

const overrideStateOf = (stored: StoredPacketEvent, body: RiskTierOverriddenBody): PacketRiskTierOverrideState =>
  PacketRiskTierOverrideState.make({
    tier: body.tier,
    reason: body.reason,
    actor: stored.event.actor,
    at: stored.event.at,
  });

const stepPrefixDerivation = (state: PrefixDerivation, stored: StoredPacketEvent): PrefixDerivation => {
  const body = stored.event.body;
  if (body.type === "stage-entered") {
    return { ...state, cursor: stepStageCursor(state.cursor, body.stage, body.ordinal) };
  }
  if (body.type === "status-set") {
    return { ...state, status: O.some(body.status) };
  }
  if (body.type === "risk-tier-overridden") {
    return { ...state, riskTierOverride: O.some(overrideStateOf(stored, body)) };
  }
  const cursor =
    body.stage !== undefined && body.ordinal !== undefined
      ? stepStageCursor(state.cursor, body.stage, body.ordinal)
      : state.cursor;
  return { ...state, status: O.some(body.status), cursor };
};

const emptyPrefixDerivation: PrefixDerivation = {
  status: O.none(),
  cursor: { furthestStage: O.none(), furthestOrdinal: O.none(), resumeStage: O.none() },
  riskTierOverride: O.none(),
};

const derivePrefixValues = (prefix: ReadonlyArray<StoredPacketEvent>): PrefixDerivation =>
  A.reduce(prefix, emptyPrefixDerivation, stepPrefixDerivation);

/**
 * Fold one packet's stored events into its deterministic derived state.
 *
 * **Details**
 *
 * Events are ordered by sequence then digest, so identical streams fold to
 * identical states regardless of read order. Forks and chain issues never
 * fail the fold — they are carried inside the derived state so read paths
 * stay advisory while the guarded writer refuses to extend an ambiguous
 * chain.
 *
 * **Example** (Fold an empty stream)
 *
 * ```ts
 * import { foldPacketEvents } from "@beep/repo-cli/test/Goals"
 *
 * const derived = foldPacketEvents({ packet: "demo", root: "goals", events: [] })
 * console.log(derived.revision) // 0
 * ```
 *
 * @param input - Packet identity plus its stored events.
 * @returns The deterministic derived state.
 * @category folding
 * @since 0.0.0
 */
export const foldPacketEvents = (input: {
  readonly packet: PacketSlug;
  readonly root: PacketRoot;
  readonly events: ReadonlyArray<StoredPacketEvent>;
}): PacketDerivedState => {
  const sorted = A.sort(input.events, storedBySeqThenId);
  const index = buildChildIndex(sorted);
  const forks = collectForkVerdicts(index);
  const { issues: prefixIssues, prefix } = walkLinearPrefix(index);
  const issues = A.appendAll(missingParentIssues(sorted), prefixIssues);
  const { cursor, riskTierOverride, status } = derivePrefixValues(prefix);
  const tip = pipe(
    A.last(prefix),
    O.map((stored) => PacketTip.make({ seq: stored.event.seq, id: stored.id }))
  );
  return PacketDerivedState.make({
    packet: input.packet,
    root: input.root,
    revision: A.length(prefix),
    ...optionalProp("tip", tip),
    ...optionalProp("status", status),
    ...optionalProp("furthestStage", cursor.furthestStage),
    ...optionalProp("furthestOrdinal", cursor.furthestOrdinal),
    ...optionalProp("resumeStage", cursor.resumeStage),
    ...optionalProp("riskTierOverride", riskTierOverride),
    forks,
    issues,
  });
};

const timelineOf = (events: ReadonlyArray<StoredPacketEvent>): ReadonlyArray<PacketTraceEntry> => {
  const sorted = A.sort(events, storedBySeqThenId);
  const { prefix } = walkLinearPrefix(buildChildIndex(sorted));
  return A.map(prefix, (stored) =>
    PacketTraceEntry.make({
      seq: stored.event.seq,
      id: stored.id,
      at: stored.event.at,
      actor: stored.event.actor,
      body: stored.event.body,
    })
  );
};

/**
 * Project a derived state plus its stored events into the trace projection.
 *
 * **Details**
 *
 * The projection carries the full event timeline of the unambiguous linear
 * prefix alongside the derived state, so a committed `ops/trace.json` shows
 * the packet's history without parsing CAS files. Events past a fork are
 * excluded from the timeline — they are ambiguous history and surface
 * through the derived state's fork verdicts instead.
 *
 * **Example** (Project an empty stream)
 *
 * ```ts
 * import { foldPacketEvents, projectPacketTrace } from "@beep/repo-cli/test/Goals"
 *
 * const trace = projectPacketTrace(foldPacketEvents({ packet: "demo", root: "goals", events: [] }), [])
 * console.log(trace.schemaVersion) // "packet-trace/v1"
 * ```
 *
 * @param derived - Fold result to project.
 * @param events - Stored events the fold consumed; the timeline source.
 * @returns The trace projection bound to the fold's tip and projector version.
 * @category folding
 * @since 0.0.0
 */
export const projectPacketTrace: {
  (derived: PacketDerivedState, events: ReadonlyArray<StoredPacketEvent>): PacketTraceProjection;
  (events: ReadonlyArray<StoredPacketEvent>): (derived: PacketDerivedState) => PacketTraceProjection;
} = dual(
  2,
  (derived: PacketDerivedState, events: ReadonlyArray<StoredPacketEvent>): PacketTraceProjection =>
    PacketTraceProjection.make({
      schemaVersion: "packet-trace/v1",
      projectorVersion: PACKET_PROJECTOR_VERSION,
      ...optionalProp("sourceTip", O.fromUndefinedOr(derived.tip)),
      timeline: timelineOf(events),
      derived,
    })
);

/**
 * Decide whether a committed trace projection is stale against a fresh fold.
 *
 * **Details**
 *
 * Stale means the committed `sourceTip` no longer matches the folded tip, or
 * the committed projector version differs from the current one. Both
 * directions are covered: a stream that moved past the trace and a trace
 * claiming a tip the stream does not have.
 *
 * **Example** (An empty stream matches an empty trace)
 *
 * ```ts
 * import { foldPacketEvents, packetTraceIsStale, projectPacketTrace } from "@beep/repo-cli/test/Goals"
 *
 * const derived = foldPacketEvents({ packet: "demo", root: "goals", events: [] })
 * console.log(packetTraceIsStale(projectPacketTrace(derived, []), derived)) // false
 * ```
 *
 * @param trace - Committed trace projection.
 * @param derived - Fresh fold of the same stream.
 * @returns Whether the trace no longer describes the stream.
 * @category folding
 * @since 0.0.0
 */
export const packetTraceIsStale: {
  (trace: PacketTraceProjection, derived: PacketDerivedState): boolean;
  (derived: PacketDerivedState): (trace: PacketTraceProjection) => boolean;
} = dual(2, (trace: PacketTraceProjection, derived: PacketDerivedState): boolean => {
  if (trace.projectorVersion !== PACKET_PROJECTOR_VERSION) {
    return true;
  }
  const traceTip = O.fromUndefinedOr(trace.sourceTip);
  const foldTip = O.fromUndefinedOr(derived.tip);
  if (O.isNone(traceTip) && O.isNone(foldTip)) {
    return false;
  }
  if (O.isNone(traceTip) || O.isNone(foldTip)) {
    return true;
  }
  return traceTip.value.id !== foldTip.value.id || traceTip.value.seq !== foldTip.value.seq;
});

const encodePacketTrace = S.encodeUnknownEffect(PacketTraceProjection);

/**
 * Render the canonical committed file content for a trace projection.
 *
 * **Example** (Build the render effect for a projection)
 *
 * ```ts
 * import { foldPacketEvents, projectPacketTrace, renderPacketTraceFile } from "@beep/repo-cli/test/Goals"
 * import { Effect } from "effect"
 *
 * const trace = projectPacketTrace(foldPacketEvents({ packet: "demo", root: "goals", events: [] }), [])
 * console.log(Effect.isEffect(renderPacketTraceFile(trace))) // true
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const renderPacketTraceFile: (trace: PacketTraceProjection) => Effect.Effect<string, S.SchemaError> =
  Effect.fnUntraced(function* (trace: PacketTraceProjection) {
    const encoded = yield* encodePacketTrace(trace);
    return canonicalJsonTextPretty(encoded);
  });

const walkChainFrom = (
  index: MutableHashMap.MutableHashMap<string, ReadonlyArray<StoredPacketEvent>>,
  startKey: string
): ReadonlyArray<StoredPacketEvent> => {
  let chain = A.empty<StoredPacketEvent>();
  let key = startKey;
  for (;;) {
    const next = O.getOrUndefined(soleChildOf(index, key));
    if (next === undefined) {
      break;
    }
    chain = A.append(chain, next);
    key = next.id;
  }
  return chain;
};

const subtreeOf = (
  index: MutableHashMap.MutableHashMap<string, ReadonlyArray<StoredPacketEvent>>,
  roots: ReadonlyArray<StoredPacketEvent>
): ReadonlyArray<StoredPacketEvent> => {
  let queue = roots;
  let all = A.empty<StoredPacketEvent>();
  for (;;) {
    const head = A.head(queue);
    if (O.isNone(head)) {
      break;
    }
    queue = A.drop(queue, 1);
    all = A.append(all, head.value);
    queue = A.appendAll(queue, pipe(MutableHashMap.get(index, head.value.id), O.getOrElse(A.empty<StoredPacketEvent>)));
  }
  return A.sort(all, storedBySeqThenId);
};

const rebaseDraftsOnto = Effect.fnUntraced(function* (
  packet: PacketSlug,
  root: PacketRoot,
  tip: PacketTip,
  losing: ReadonlyArray<StoredPacketEvent>
) {
  let drafts = A.empty<PacketEvent>();
  let parent = tip.id;
  let seq = tip.seq;
  for (const stored of losing) {
    seq += 1;
    const draft = PacketEvent.make({
      schemaVersion: "packet-event/v1",
      packet,
      root,
      seq,
      parent,
      expectedRevision: seq - 1,
      at: stored.event.at,
      actor: stored.event.actor,
      body: stored.event.body,
    });
    drafts = A.append(drafts, draft);
    parent = yield* packetEventDigest(draft);
  }
  return drafts;
});

type SurvivingWalk = {
  readonly survivorId: string;
  readonly tip: PacketTip;
};

const survivingWalkOf = (
  sorted: ReadonlyArray<StoredPacketEvent>,
  index: MutableHashMap.MutableHashMap<string, ReadonlyArray<StoredPacketEvent>>,
  fork: PacketForkVerdict
): O.Option<SurvivingWalk> => {
  const survivorId = pipe(
    A.head(fork.children),
    O.getOrElse(() => "")
  );
  const survivorStored = A.findFirst(sorted, (stored) => stored.id === survivorId);
  if (O.isNone(survivorStored)) {
    return O.none();
  }
  const chain = A.prepend(walkChainFrom(index, survivorId), survivorStored.value);
  const tip = pipe(
    A.last(chain),
    O.map((stored) => PacketTip.make({ seq: stored.event.seq, id: stored.id })),
    O.getOrElse(() => PacketTip.make({ seq: survivorStored.value.event.seq, id: survivorId }))
  );
  return O.some({ survivorId, tip });
};

type PlannableFork = SurvivingWalk & {
  readonly fork: PacketForkVerdict;
};

// Rebasing onto a tip that itself forks would ENLARGE the nested fork (a
// third child), so the plan descends the surviving path to the innermost
// fork: each applied plan strictly shrinks the fork set, and re-planning
// works outward one fork at a time.
const innermostPlannableFork = (
  sorted: ReadonlyArray<StoredPacketEvent>,
  index: MutableHashMap.MutableHashMap<string, ReadonlyArray<StoredPacketEvent>>,
  verdicts: ReadonlyArray<PacketForkVerdict>,
  first: PacketForkVerdict
): O.Option<PlannableFork> => {
  let fork = first;
  for (let depth = 0; depth <= A.length(verdicts); depth += 1) {
    const walk = survivingWalkOf(sorted, index, fork);
    if (O.isNone(walk)) {
      return O.none();
    }
    const nested = A.findFirst(verdicts, (verdict) => verdict.parent === walk.value.tip.id);
    if (O.isNone(nested)) {
      return O.some({ fork, survivorId: walk.value.survivorId, tip: walk.value.tip });
    }
    fork = nested.value;
  }
  return O.none();
};

/**
 * Compute the deterministic repair plan for one fork of a stream.
 *
 * **Details**
 *
 * Read-only and content-deterministic: the survivor is the fork's first
 * child in seq-then-digest order, the losing branches' bodies are re-drafted
 * onto the surviving chain's tip with their recorded timestamps and actors
 * preserved, and the losing event files are listed for removal. An unforked
 * stream plans to `None`. Applying the plan is not this function's job —
 * writers stay guarded and separate.
 *
 * **Example** (An unforked stream needs no repair)
 *
 * ```ts
 * import { planForkRepair } from "@beep/repo-cli/test/Goals"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const program = planForkRepair({ packet: "demo", root: "goals", events: [] })
 * Effect.runPromise(program).then((plan) => console.log(O.isNone(plan))) // true
 * ```
 *
 * @param input - Packet identity plus its stored events.
 * @returns The first-fork repair plan, or `None` for an unforked stream.
 * @category folding
 * @since 0.0.0
 */
export const planForkRepair: (input: {
  readonly packet: PacketSlug;
  readonly root: PacketRoot;
  readonly events: ReadonlyArray<StoredPacketEvent>;
}) => Effect.Effect<O.Option<PacketForkRepairPlan>, S.SchemaError> = Effect.fnUntraced(function* (input: {
  readonly packet: PacketSlug;
  readonly root: PacketRoot;
  readonly events: ReadonlyArray<StoredPacketEvent>;
}) {
  const sorted = A.sort(input.events, storedBySeqThenId);
  const index = buildChildIndex(sorted);
  const verdicts = collectForkVerdicts(index);
  const firstFork = A.head(verdicts);
  if (O.isNone(firstFork)) {
    return O.none<PacketForkRepairPlan>();
  }
  const plannable = innermostPlannableFork(sorted, index, verdicts, firstFork.value);
  if (O.isNone(plannable)) {
    return O.none<PacketForkRepairPlan>();
  }
  const { fork, survivorId, tip } = plannable.value;
  const losingRoots = pipe(
    A.drop(fork.children, 1),
    A.map((id) => A.findFirst(sorted, (stored) => stored.id === id)),
    A.getSomes
  );
  const losing = subtreeOf(index, losingRoots);
  const rebaseDrafts = yield* rebaseDraftsOnto(input.packet, input.root, tip, losing);
  return O.some(
    PacketForkRepairPlan.make({
      packet: input.packet,
      root: input.root,
      fork,
      survivor: survivorId,
      survivorTip: tip,
      rebaseDrafts,
      filesToRemove: A.map(losing, (stored) => stored.fileName),
    })
  );
});
