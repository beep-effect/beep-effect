/**
 * Guarded transition writer over the packet-core fold.
 *
 * **Details**
 *
 * The writer separates preview from write the way Yeet's publish-time index
 * guard separates disposition from action: `plan` folds the live stream and
 * produces the exact events a transition would append plus the derived state
 * after them, writing nothing; `commit` appends those events one at a time,
 * each under its own compare-and-set, and regenerates the derived trace
 * projection only after every append lands. A stream that moved, forked, or
 * broke between plan and commit refuses the failing append — events already
 * appended by the same commit remain as a valid linear chain (never a fork
 * or corruption) — and the caller re-plans against reality. Operator
 * risk-tier overrides plan through the same guard: `planRiskTierOverride`
 * drafts the `risk-tier-overridden` event (refusing on streamless packets,
 * whose overrides would otherwise have no record), and `commit` lands it
 * exactly like a status transition.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { A, O, pipe } from "@beep/utils";
import { Context, Effect, Equal, FileSystem, Layer, Path } from "effect";
import * as S from "effect/Schema";
import { optionalProp } from "../../../internal/cli/OptionRecord.ts";
import { PacketStreamError } from "./PacketCore.errors.ts";
import {
  PacketDerivedState,
  PacketEvent,
  PacketEventActor,
  PacketEventTimestamp,
  PacketRevision,
  PacketRiskTier,
  PacketStage,
  PacketStageOrdinal,
  PacketStatusToken,
  PacketTip,
  RiskTierOverrideReason,
  StoredPacketEvent,
} from "./PacketCore.schemas.ts";
import { packetEventDigest, packetEventFileName } from "./PacketDigest.ts";
import {
  foldUnambiguousStream,
  PacketEventStore,
  PacketEventStoreLive,
  PacketStreamLocator,
} from "./PacketEventStore.ts";
import { foldPacketEvents, projectPacketTrace, renderPacketTraceFile } from "./PacketFold.ts";
import type { PacketCasConflictError } from "./PacketCore.errors.ts";
import type { PacketEventId } from "./PacketCore.schemas.ts";
import type { PacketStreamListing } from "./PacketEventStore.ts";

const $I = $RepoCliId.create("commands/Goals/PacketCore/PacketTransitionWriter");

/**
 * File segments of the derived trace projection below a packet path.
 *
 * **Example** (Read the trace segments)
 *
 * ```ts
 * import { PACKET_TRACE_SEGMENTS } from "@beep/repo-cli/test/Goals"
 *
 * console.log(PACKET_TRACE_SEGMENTS) // ["ops", "trace.json"]
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const PACKET_TRACE_SEGMENTS = ["ops", "trace.json"] as const;

const PacketTransitionDisposition = LiteralKit(["append", "skipped", "streamless"]).pipe(
  $I.annoteSchema("PacketTransitionDisposition", {
    description: "Guarded transition disposition: append events, skip an idempotent transition, or no stream.",
  })
);

const PacketTransitionGenesisPairCheck = S.makeFilter(
  (request: { readonly genesisStage?: PacketStage; readonly genesisOrdinal?: PacketStageOrdinal }) =>
    (request.genesisStage === undefined) === (request.genesisOrdinal === undefined),
  {
    identifier: $I`PacketTransitionGenesisPairCheck`,
    title: "Packet Transition Genesis Pair",
    description: "Genesis stage and ordinal are supplied together or not at all.",
    message: "Expected genesisStage and genesisOrdinal to be present together or absent together",
  }
);

/**
 * One requested status transition against a packet stream.
 *
 * **Details**
 *
 * The caller owns the packet-kind vocabulary: `status`/`previousStatus` are
 * already validated against the caller's domain (the goal 5-state lifecycle
 * for `beep goals set-status`), and the genesis stage/ordinal pair describes
 * where the packet currently stands in case the stream needs its genesis
 * event.
 *
 * **Example** (Construct a transition request)
 *
 * ```ts
 * import { PacketStreamLocator, PacketTransitionRequest } from "@beep/repo-cli/test/Goals"
 *
 * const request = PacketTransitionRequest.make({
 *   locator: PacketStreamLocator.make({ packet: "demo", root: "goals", packetPath: "goals/demo" }),
 *   status: "paused",
 *   previousStatus: "active",
 *   actor: "operator",
 *   at: "2026-08-17T00:00:00.000Z",
 * })
 * console.log(request.status) // "paused"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PacketTransitionRequest extends S.Class<PacketTransitionRequest>($I`PacketTransitionRequest`)(
  S.Struct({
    locator: PacketStreamLocator,
    status: PacketStatusToken,
    previousStatus: PacketStatusToken,
    genesisStage: S.optionalKey(PacketStage),
    genesisOrdinal: S.optionalKey(PacketStageOrdinal),
    actor: PacketEventActor,
    at: PacketEventTimestamp,
  }).check(PacketTransitionGenesisPairCheck),
  $I.annote("PacketTransitionRequest", {
    description: "One requested status transition with caller-validated vocabulary and genesis stage info.",
  })
) {}

/**
 * One requested operator risk-tier override against a packet stream.
 *
 * **Details**
 *
 * Overrides are operator-only, recorded, and challengeable: `reason` is the
 * recorded, disputable rationale. Unlike a status transition — which falls
 * back to the manifest on a streamless packet — an override exists only as a
 * stream event, so planning one against a packet without `ops/events/`
 * refuses instead of degrading to a no-op. `genesisStatus` (plus the
 * optional stage/ordinal pair) seeds the genesis event when the override is
 * the stream's first write.
 *
 * **Example** (Construct an override request)
 *
 * ```ts
 * import { PacketRiskTierOverrideRequest, PacketStreamLocator } from "@beep/repo-cli/test/Goals"
 *
 * const request = PacketRiskTierOverrideRequest.make({
 *   locator: PacketStreamLocator.make({ packet: "demo", root: "goals", packetPath: "goals/demo" }),
 *   tier: "full",
 *   reason: "touches the release pipeline",
 *   genesisStatus: "active",
 *   actor: "operator",
 *   at: "2026-08-17T00:00:00.000Z",
 * })
 * console.log(request.tier) // "full"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PacketRiskTierOverrideRequest extends S.Class<PacketRiskTierOverrideRequest>(
  $I`PacketRiskTierOverrideRequest`
)(
  S.Struct({
    locator: PacketStreamLocator,
    tier: PacketRiskTier,
    reason: RiskTierOverrideReason,
    genesisStatus: PacketStatusToken,
    genesisStage: S.optionalKey(PacketStage),
    genesisOrdinal: S.optionalKey(PacketStageOrdinal),
    actor: PacketEventActor,
    at: PacketEventTimestamp,
  }).check(PacketTransitionGenesisPairCheck),
  $I.annote("PacketRiskTierOverrideRequest", {
    description: "One requested operator risk-tier override with its recorded reason and genesis fallback.",
  })
) {}

/**
 * Union of the requests a guarded-writer plan can carry.
 *
 * **Example** (A status transition is a plan request)
 *
 * ```ts
 * import { PacketPlanRequest, PacketStreamLocator, PacketTransitionRequest } from "@beep/repo-cli/test/Goals"
 * import * as S from "effect/Schema"
 *
 * const request = PacketTransitionRequest.make({
 *   locator: PacketStreamLocator.make({ packet: "demo", root: "goals", packetPath: "goals/demo" }),
 *   status: "paused",
 *   previousStatus: "active",
 *   actor: "operator",
 *   at: "2026-08-17T00:00:00.000Z",
 * })
 * console.log(S.is(PacketPlanRequest)(request)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PacketPlanRequest = S.Union([PacketTransitionRequest, PacketRiskTierOverrideRequest]).pipe(
  $I.annoteSchema("PacketPlanRequest", {
    description: "Requests a guarded-writer plan can carry: status transition or risk-tier override.",
  })
);

/**
 * Request carried by a guarded-writer plan.
 *
 * **Example** (Annotate a plan request)
 *
 * ```ts
 * import { PacketStreamLocator, PacketTransitionRequest } from "@beep/repo-cli/test/Goals"
 * import type { PacketPlanRequest } from "@beep/repo-cli/test/Goals"
 *
 * const request: PacketPlanRequest = PacketTransitionRequest.make({
 *   locator: PacketStreamLocator.make({ packet: "demo", root: "goals", packetPath: "goals/demo" }),
 *   status: "paused",
 *   previousStatus: "active",
 *   actor: "operator",
 *   at: "2026-08-17T00:00:00.000Z",
 * })
 * console.log(request.locator.packet)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type PacketPlanRequest = typeof PacketPlanRequest.Type;

/**
 * The exact effect of one transition, computed without writing.
 *
 * **Example** (Inspect a plan's shape)
 *
 * ```ts
 * import { PacketStreamLocator, PacketTransitionPlan, PacketTransitionRequest } from "@beep/repo-cli/test/Goals"
 *
 * const plan = PacketTransitionPlan.make({
 *   request: PacketTransitionRequest.make({
 *     locator: PacketStreamLocator.make({ packet: "demo", root: "goals", packetPath: "goals/demo" }),
 *     status: "paused",
 *     previousStatus: "active",
 *     actor: "operator",
 *     at: "2026-08-17T00:00:00.000Z",
 *   }),
 *   disposition: "streamless",
 *   streamPresent: false,
 *   currentRevision: 0,
 *   events: [],
 *   tracePath: "goals/demo/ops/trace.json",
 * })
 * console.log(plan.streamPresent) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PacketTransitionPlan extends S.Class<PacketTransitionPlan>($I`PacketTransitionPlan`)(
  {
    request: PacketPlanRequest,
    disposition: PacketTransitionDisposition,
    streamPresent: S.Boolean,
    currentRevision: PacketRevision,
    currentTip: S.optionalKey(PacketTip),
    events: S.Array(PacketEvent),
    derivedAfter: S.optionalKey(PacketDerivedState),
    tracePath: S.String,
  },
  $I.annote("PacketTransitionPlan", {
    description: "The exact events and derived state one transition would produce, computed without writing.",
  })
) {}

/**
 * Result of committing a transition plan.
 *
 * **Example** (Construct a no-stream outcome)
 *
 * ```ts
 * import { PacketTransitionOutcome } from "@beep/repo-cli/test/Goals"
 *
 * const outcome = PacketTransitionOutcome.make({
 *   disposition: "streamless",
 *   appended: 0,
 *   tracePath: "goals/demo/ops/trace.json",
 *   traceWritten: false,
 * })
 * console.log(outcome.appended) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PacketTransitionOutcome extends S.Class<PacketTransitionOutcome>($I`PacketTransitionOutcome`)(
  {
    disposition: PacketTransitionDisposition,
    appended: PacketRevision,
    tip: S.optionalKey(PacketTip),
    tracePath: S.String,
    traceWritten: S.Boolean,
  },
  $I.annote("PacketTransitionOutcome", {
    description: "Committed-transition result with an explicit append, skipped, or streamless disposition.",
  })
) {}

/**
 * Contract of the guarded transition writer.
 *
 * @category models
 * @since 0.0.0
 */
export interface PacketTransitionWriterShape {
  /**
   * Append a plan's events under compare-and-set and regenerate the trace
   * projection. Refuses whole on a moved tip, fork, or integrity issue.
   *
   * @since 0.0.0
   */
  readonly commit: (
    plan: PacketTransitionPlan
  ) => Effect.Effect<PacketTransitionOutcome, PacketCasConflictError | PacketStreamError>;
  /**
   * Fold the live stream and compute the exact events plus derived state a
   * transition would produce. Writes nothing.
   *
   * @since 0.0.0
   */
  readonly plan: (request: PacketTransitionRequest) => Effect.Effect<PacketTransitionPlan, PacketStreamError>;
  /**
   * Fold the live stream and compute the exact events an operator risk-tier
   * override would append. Writes nothing; refuses on a streamless packet
   * because the stream is the override's only record.
   *
   * @since 0.0.0
   */
  readonly planRiskTierOverride: (
    request: PacketRiskTierOverrideRequest
  ) => Effect.Effect<PacketTransitionPlan, PacketStreamError>;
}

/**
 * Service tag for the guarded transition writer.
 *
 * **Example** (Yield the writer inside an Effect)
 *
 * ```ts
 * import { PacketTransitionWriter } from "@beep/repo-cli/test/Goals"
 * import { Effect } from "effect"
 *
 * const program = Effect.map(PacketTransitionWriter, (writer) => typeof writer.plan)
 * console.log(program.pipe !== undefined) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PacketTransitionWriter extends Context.Service<PacketTransitionWriter, PacketTransitionWriterShape>()(
  $I`PacketTransitionWriter`
) {}

const streamErrorFromSchema =
  (packet: string, context: string) =>
  (error: S.SchemaError): PacketStreamError =>
    PacketStreamError.new(packet, `${context}: ${error.message}`);

type DraftBase = {
  readonly events: ReadonlyArray<PacketEvent>;
  readonly seq: number;
  readonly parent: O.Option<PacketEventId>;
};

// Both drafters append exactly one event past the drafted base; the CAS
// envelope (sequence, expected revision, parent digest, actor, timestamp) is
// identical either way — only the body differs.
const draftAppendedEvent = (request: PacketPlanRequest, base: DraftBase, body: PacketEvent["body"]): PacketEvent =>
  PacketEvent.make({
    schemaVersion: "packet-event/v1",
    packet: request.locator.packet,
    root: request.locator.root,
    seq: base.seq + 1,
    expectedRevision: base.seq,
    at: request.at,
    actor: request.actor,
    ...optionalProp("parent", base.parent),
    body,
  });

const tipDigest = (tip: PacketTip | undefined): O.Option<string> =>
  pipe(
    O.fromUndefinedOr(tip),
    O.map((value) => value.id)
  );

const packetStreamMoved = (transitionPlan: PacketTransitionPlan, derived: PacketDerivedState): boolean =>
  derived.revision !== transitionPlan.currentRevision ||
  !Equal.equals(tipDigest(derived.tip), tipDigest(transitionPlan.currentTip));

const makePacketTransitionWriter = Effect.fn("PacketTransitionWriter.make")(function* () {
  const store = yield* PacketEventStore;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const tracePathFor = (packetPath: string): string => path.join(packetPath, ...PACKET_TRACE_SEGMENTS);

  const draftBase: (
    request: PacketPlanRequest,
    derived: PacketDerivedState,
    genesisStatus: PacketStatusToken
  ) => Effect.Effect<DraftBase, PacketStreamError> = Effect.fnUntraced(function* (
    request: PacketPlanRequest,
    derived: PacketDerivedState,
    genesisStatus: PacketStatusToken
  ) {
    let events = A.empty<PacketEvent>();
    let seq = derived.revision;
    let parent = pipe(
      O.fromUndefinedOr(derived.tip),
      O.map((tip) => tip.id)
    );
    if (derived.revision === 0) {
      const genesis = PacketEvent.make({
        schemaVersion: "packet-event/v1",
        packet: request.locator.packet,
        root: request.locator.root,
        seq: 1,
        expectedRevision: 0,
        at: request.at,
        actor: request.actor,
        body: {
          type: "packet-created",
          status: genesisStatus,
          ...optionalProp("stage", O.fromUndefinedOr(request.genesisStage)),
          ...optionalProp("ordinal", O.fromUndefinedOr(request.genesisOrdinal)),
        },
      });
      events = A.append(events, genesis);
      seq = 1;
      parent = O.some(
        yield* packetEventDigest(genesis).pipe(
          Effect.mapError(streamErrorFromSchema(request.locator.packet, "genesis event could not be encoded"))
        )
      );
    }
    return { events, seq, parent };
  });

  const draftEvents: (
    request: PacketTransitionRequest,
    derived: PacketDerivedState
  ) => Effect.Effect<ReadonlyArray<PacketEvent>, PacketStreamError> = Effect.fnUntraced(function* (
    request: PacketTransitionRequest,
    derived: PacketDerivedState
  ) {
    const base = yield* draftBase(request, derived, request.previousStatus);
    // The stream is the system of record for its own history: when it already
    // derives a status (e.g. a retry after a partial failure left the manifest
    // behind), that derived status is the accurate `previous`, not the
    // caller's manifest snapshot.
    const previous = derived.status ?? request.previousStatus;
    const statusSet = draftAppendedEvent(request, base, { type: "status-set", status: request.status, previous });
    return A.append(base.events, statusSet);
  });

  const draftOverrideEvents: (
    request: PacketRiskTierOverrideRequest,
    derived: PacketDerivedState
  ) => Effect.Effect<ReadonlyArray<PacketEvent>, PacketStreamError> = Effect.fnUntraced(function* (
    request: PacketRiskTierOverrideRequest,
    derived: PacketDerivedState
  ) {
    const base = yield* draftBase(request, derived, request.genesisStatus);
    const previous = pipe(
      O.fromUndefinedOr(derived.riskTierOverride),
      O.map((override) => override.tier)
    );
    const overridden = draftAppendedEvent(request, base, {
      type: "risk-tier-overridden",
      tier: request.tier,
      ...optionalProp("previous", previous),
      reason: request.reason,
    });
    return A.append(base.events, overridden);
  });

  const storedDrafts: (
    packet: string,
    events: ReadonlyArray<PacketEvent>
  ) => Effect.Effect<ReadonlyArray<StoredPacketEvent>, PacketStreamError> = Effect.fnUntraced(function* (
    packet: string,
    events: ReadonlyArray<PacketEvent>
  ) {
    let stored = A.empty<StoredPacketEvent>();
    for (const event of events) {
      const id = yield* packetEventDigest(event).pipe(
        Effect.mapError(streamErrorFromSchema(packet, "draft event could not be encoded"))
      );
      stored = A.append(stored, StoredPacketEvent.make({ id, fileName: packetEventFileName(event, id), event }));
    }
    return stored;
  });

  type GuardedStream = {
    readonly listing: PacketStreamListing;
    readonly derived: PacketDerivedState;
  };

  const foldGuardedStream: (locator: PacketStreamLocator) => Effect.Effect<GuardedStream, PacketStreamError> =
    Effect.fnUntraced(function* (locator: PacketStreamLocator) {
      const listing = yield* store.list(locator);
      const derived = yield* foldUnambiguousStream(locator, listing);
      return { listing, derived };
    });

  const sealedPlan: (
    request: PacketPlanRequest,
    stream: GuardedStream,
    events: ReadonlyArray<PacketEvent>,
    tracePath: string,
    disposition: typeof PacketTransitionDisposition.Type
  ) => Effect.Effect<PacketTransitionPlan, PacketStreamError> = Effect.fnUntraced(function* (
    request: PacketPlanRequest,
    stream: GuardedStream,
    events: ReadonlyArray<PacketEvent>,
    tracePath: string,
    disposition: typeof PacketTransitionDisposition.Type
  ) {
    const drafts = yield* storedDrafts(request.locator.packet, events);
    const derivedAfter = foldPacketEvents({
      packet: request.locator.packet,
      root: request.locator.root,
      events: A.appendAll(stream.listing.events, drafts),
    });
    return PacketTransitionPlan.make({
      request,
      disposition,
      streamPresent: true,
      currentRevision: stream.derived.revision,
      ...optionalProp("currentTip", O.fromUndefinedOr(stream.derived.tip)),
      events,
      derivedAfter,
      tracePath,
    });
  });

  const plan = Effect.fn("PacketTransitionWriter.plan")(function* (request: PacketTransitionRequest) {
    const tracePath = tracePathFor(request.locator.packetPath);
    const streamPresent = yield* store.hasStream(request.locator.packetPath);
    if (!streamPresent) {
      return PacketTransitionPlan.make({
        request,
        disposition: "streamless",
        streamPresent: false,
        currentRevision: 0,
        events: A.empty<PacketEvent>(),
        tracePath,
      });
    }
    const stream = yield* foldGuardedStream(request.locator);
    if (stream.derived.status === request.status) {
      return yield* sealedPlan(request, stream, A.empty<PacketEvent>(), tracePath, "skipped");
    }
    const events = yield* draftEvents(request, stream.derived);
    return yield* sealedPlan(request, stream, events, tracePath, "append");
  });

  const planRiskTierOverride = Effect.fn("PacketTransitionWriter.planRiskTierOverride")(function* (
    request: PacketRiskTierOverrideRequest
  ) {
    const tracePath = tracePathFor(request.locator.packetPath);
    const streamPresent = yield* store.hasStream(request.locator.packetPath);
    if (!streamPresent) {
      return yield* PacketStreamError.new(
        request.locator.packet,
        "packet has no event stream (ops/events/); a risk-tier override is recorded only in the stream, so opt in before overriding."
      );
    }
    const stream = yield* foldGuardedStream(request.locator);
    const events = yield* draftOverrideEvents(request, stream.derived);
    return yield* sealedPlan(request, stream, events, tracePath, "append");
  });

  const traceTextFor: (
    packet: string,
    derived: PacketDerivedState,
    events: ReadonlyArray<StoredPacketEvent>
  ) => Effect.Effect<string, PacketStreamError> = Effect.fnUntraced(function* (
    packet: string,
    derived: PacketDerivedState,
    events: ReadonlyArray<StoredPacketEvent>
  ) {
    return yield* renderPacketTraceFile(projectPacketTrace(derived, events)).pipe(
      Effect.mapError(streamErrorFromSchema(packet, "trace projection could not be rendered"))
    );
  });

  const writeTraceFile: (packet: string, tracePath: string, text: string) => Effect.Effect<void, PacketStreamError> =
    Effect.fnUntraced(function* (packet: string, tracePath: string, text: string) {
      yield* fs
        .writeFileString(tracePath, text)
        .pipe(
          Effect.mapError((error) => PacketStreamError.new(packet, `trace projection write failed: ${String(error)}`))
        );
    });

  const writeTraceWhenStale: (
    packet: string,
    tracePath: string,
    text: string
  ) => Effect.Effect<boolean, PacketStreamError> = Effect.fnUntraced(function* (
    packet: string,
    tracePath: string,
    text: string
  ) {
    const committed = yield* fs.readFileString(tracePath).pipe(Effect.asSome, Effect.orElseSucceed(O.none<string>));
    if (Equal.equals(committed, O.some(text))) {
      return false;
    }
    yield* writeTraceFile(packet, tracePath, text);
    return true;
  });

  const commitSkipped: (
    transitionPlan: PacketTransitionPlan
  ) => Effect.Effect<PacketTransitionOutcome, PacketStreamError> = Effect.fnUntraced(function* (
    transitionPlan: PacketTransitionPlan
  ) {
    const locator = transitionPlan.request.locator;
    const stream = yield* foldGuardedStream(locator);
    if (packetStreamMoved(transitionPlan, stream.derived)) {
      return yield* PacketStreamError.new(
        locator.packet,
        `stream moved between plan and commit (planned revision ${transitionPlan.currentRevision}, found ${stream.derived.revision}); re-plan the transition.`
      );
    }
    const traceText = yield* traceTextFor(locator.packet, stream.derived, stream.listing.events);
    const traceWritten = yield* writeTraceWhenStale(locator.packet, transitionPlan.tracePath, traceText);
    return PacketTransitionOutcome.make({
      disposition: "skipped",
      appended: 0,
      ...optionalProp("tip", O.fromUndefinedOr(stream.derived.tip)),
      tracePath: transitionPlan.tracePath,
      traceWritten,
    });
  });

  const commit = Effect.fn("PacketTransitionWriter.commit")(function* (transitionPlan: PacketTransitionPlan) {
    const locator = transitionPlan.request.locator;
    if (transitionPlan.disposition === "streamless") {
      return PacketTransitionOutcome.make({
        disposition: "streamless",
        appended: 0,
        ...optionalProp("tip", O.fromUndefinedOr(transitionPlan.currentTip)),
        tracePath: transitionPlan.tracePath,
        traceWritten: false,
      });
    }
    if (transitionPlan.disposition === "skipped") {
      return yield* commitSkipped(transitionPlan);
    }
    for (const event of transitionPlan.events) {
      yield* store.append(locator, event);
    }
    const listing = yield* store.list(locator);
    const derived = foldPacketEvents({ packet: locator.packet, root: locator.root, events: listing.events });
    const traceText = yield* traceTextFor(locator.packet, derived, listing.events);
    yield* writeTraceFile(locator.packet, transitionPlan.tracePath, traceText);
    return PacketTransitionOutcome.make({
      disposition: "append",
      appended: A.length(transitionPlan.events),
      ...optionalProp("tip", O.fromUndefinedOr(derived.tip)),
      tracePath: transitionPlan.tracePath,
      traceWritten: true,
    });
  });

  return PacketTransitionWriter.of({ commit, plan, planRiskTierOverride });
});

/**
 * Live layer for {@link PacketTransitionWriter} over the live event store.
 *
 * **Example** (Reference the live writer layer)
 *
 * ```ts
 * import { PacketTransitionWriterLive } from "@beep/repo-cli/test/Goals"
 *
 * console.log(typeof PacketTransitionWriterLive) // "object"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const PacketTransitionWriterLive: Layer.Layer<
  PacketTransitionWriter,
  never,
  PacketEventStore | FileSystem.FileSystem | Path.Path
> = Layer.effect(PacketTransitionWriter, makePacketTransitionWriter());

/**
 * Combined live layer for the packet-core services (store plus writer).
 *
 * **Example** (Reference the combined layer)
 *
 * ```ts
 * import { PacketCoreLive } from "@beep/repo-cli/test/Goals"
 *
 * console.log(typeof PacketCoreLive) // "object"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const PacketCoreLive: Layer.Layer<
  PacketTransitionWriter | PacketEventStore,
  never,
  FileSystem.FileSystem | Path.Path
> = PacketTransitionWriterLive.pipe(Layer.provideMerge(PacketEventStoreLive));
