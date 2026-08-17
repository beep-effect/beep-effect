/**
 * Deterministic fold over one packet's CAS event stream.
 *
 * **Details**
 *
 * Pure derivations only: the fold orders stored events, verifies the parent
 * chain, surfaces forks (two children of one parent) as first-class
 * verdicts, and derives the D3 stage values — `furthestStage` as the
 * monotonic high-water mark by ordinal and `resumeStage` as the cursor from
 * the last stage-carrying event — over the unambiguous linear prefix. The
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
  PacketForkVerdict,
  PacketTip,
  PacketTraceProjection,
} from "./PacketCore.schemas.ts";
import { canonicalJsonTextPretty } from "./PacketDigest.ts";
import type {
  PacketEventBody,
  PacketRoot,
  PacketSlug,
  PacketStage,
  PacketStageOrdinal,
  PacketStatusToken,
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
    const children = pipe(MutableHashMap.get(index, key), O.getOrElse(A.empty<StoredPacketEvent>));
    if (A.length(children) !== 1) {
      break;
    }
    const next = pipe(A.head(children), O.getOrUndefined);
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
};

const stepPrefixDerivation = (state: PrefixDerivation, body: PacketEventBody): PrefixDerivation => {
  if (body.type === "stage-entered") {
    return { status: state.status, cursor: stepStageCursor(state.cursor, body.stage, body.ordinal) };
  }
  if (body.type === "status-set") {
    return { status: O.some(body.status), cursor: state.cursor };
  }
  const cursor =
    body.stage !== undefined && body.ordinal !== undefined
      ? stepStageCursor(state.cursor, body.stage, body.ordinal)
      : state.cursor;
  return { status: O.some(body.status), cursor };
};

const emptyPrefixDerivation: PrefixDerivation = {
  status: O.none(),
  cursor: { furthestStage: O.none(), furthestOrdinal: O.none(), resumeStage: O.none() },
};

const derivePrefixValues = (prefix: ReadonlyArray<StoredPacketEvent>): PrefixDerivation =>
  A.reduce(prefix, emptyPrefixDerivation, (state, stored) => stepPrefixDerivation(state, stored.event.body));

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
  const { cursor, status } = derivePrefixValues(prefix);
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
    forks,
    issues,
  });
};

/**
 * Project a derived state into the read-only trace projection.
 *
 * **Example** (Project an empty stream)
 *
 * ```ts
 * import { foldPacketEvents, projectPacketTrace } from "@beep/repo-cli/test/Goals"
 *
 * const trace = projectPacketTrace(foldPacketEvents({ packet: "demo", root: "goals", events: [] }))
 * console.log(trace.schemaVersion) // "packet-trace/v1"
 * ```
 *
 * @param derived - Fold result to project.
 * @returns The trace projection bound to the fold's tip and projector version.
 * @category folding
 * @since 0.0.0
 */
export const projectPacketTrace = (derived: PacketDerivedState): PacketTraceProjection =>
  PacketTraceProjection.make({
    schemaVersion: "packet-trace/v1",
    projectorVersion: PACKET_PROJECTOR_VERSION,
    ...optionalProp("sourceTip", O.fromUndefinedOr(derived.tip)),
    derived,
  });

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
 * console.log(packetTraceIsStale(projectPacketTrace(derived), derived)) // false
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
 * const trace = projectPacketTrace(foldPacketEvents({ packet: "demo", root: "goals", events: [] }))
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
