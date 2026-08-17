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
 * or corruption) — and the caller re-plans against reality.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, O, pipe } from "@beep/utils";
import { Context, Effect, FileSystem, Layer, Path } from "effect";
import * as S from "effect/Schema";
import { optionalProp } from "../../../internal/cli/OptionRecord.ts";
import { PacketStreamError } from "./PacketCore.errors.ts";
import {
  PacketDerivedState,
  PacketEvent,
  PacketRevision,
  PacketStage,
  PacketStageOrdinal,
  PacketStatusToken,
  PacketTip,
  StoredPacketEvent,
} from "./PacketCore.schemas.ts";
import { packetEventDigest, packetEventFileName } from "./PacketDigest.ts";
import { PacketEventStore, PacketEventStoreLive, PacketStreamLocator } from "./PacketEventStore.ts";
import { foldPacketEvents, projectPacketTrace, renderPacketTraceFile } from "./PacketFold.ts";
import type { PacketCasConflictError } from "./PacketCore.errors.ts";

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
    actor: S.String,
    at: S.String,
  }).check(PacketTransitionGenesisPairCheck),
  $I.annote("PacketTransitionRequest", {
    description: "One requested status transition with caller-validated vocabulary and genesis stage info.",
  })
) {}

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
    request: PacketTransitionRequest,
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
    appended: PacketRevision,
    tip: S.optionalKey(PacketTip),
    tracePath: S.String,
    traceWritten: S.Boolean,
  },
  $I.annote("PacketTransitionOutcome", {
    description: "Committed-transition result: appended event count, new tip, trace projection path.",
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

const makePacketTransitionWriter = Effect.fn("PacketTransitionWriter.make")(function* () {
  const store = yield* PacketEventStore;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const tracePathFor = (packetPath: string): string => path.join(packetPath, ...PACKET_TRACE_SEGMENTS);

  const draftEvents: (
    request: PacketTransitionRequest,
    derived: PacketDerivedState
  ) => Effect.Effect<ReadonlyArray<PacketEvent>, PacketStreamError> = Effect.fnUntraced(function* (
    request: PacketTransitionRequest,
    derived: PacketDerivedState
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
          status: request.previousStatus,
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
    const statusSet = PacketEvent.make({
      schemaVersion: "packet-event/v1",
      packet: request.locator.packet,
      root: request.locator.root,
      seq: seq + 1,
      expectedRevision: seq,
      at: request.at,
      actor: request.actor,
      ...optionalProp("parent", parent),
      body: { type: "status-set", status: request.status, previous: request.previousStatus },
    });
    return A.append(events, statusSet);
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

  const plan = Effect.fn("PacketTransitionWriter.plan")(function* (request: PacketTransitionRequest) {
    const tracePath = tracePathFor(request.locator.packetPath);
    const streamPresent = yield* store.hasStream(request.locator.packetPath);
    if (!streamPresent) {
      return PacketTransitionPlan.make({
        request,
        streamPresent: false,
        currentRevision: 0,
        events: A.empty<PacketEvent>(),
        tracePath,
      });
    }
    const listing = yield* store.list(request.locator);
    if (A.isReadonlyArrayNonEmpty(listing.issues)) {
      return yield* PacketStreamError.new(
        request.locator.packet,
        `stream has ${A.length(listing.issues)} integrity issue(s); run \`bun run beep explore --check\` and repair before transitioning.`
      );
    }
    const derived = foldPacketEvents({
      packet: request.locator.packet,
      root: request.locator.root,
      events: listing.events,
    });
    if (A.isReadonlyArrayNonEmpty(derived.forks)) {
      return yield* PacketStreamError.new(
        request.locator.packet,
        "stream is forked (two children of one parent); repair the fork before transitioning."
      );
    }
    const events = yield* draftEvents(request, derived);
    const drafts = yield* storedDrafts(request.locator.packet, events);
    const derivedAfter = foldPacketEvents({
      packet: request.locator.packet,
      root: request.locator.root,
      events: A.appendAll(listing.events, drafts),
    });
    return PacketTransitionPlan.make({
      request,
      streamPresent: true,
      currentRevision: derived.revision,
      ...optionalProp("currentTip", O.fromUndefinedOr(derived.tip)),
      events,
      derivedAfter,
      tracePath,
    });
  });

  const commit = Effect.fn("PacketTransitionWriter.commit")(function* (transitionPlan: PacketTransitionPlan) {
    const locator = transitionPlan.request.locator;
    if (!transitionPlan.streamPresent) {
      return PacketTransitionOutcome.make({
        appended: 0,
        tracePath: transitionPlan.tracePath,
        traceWritten: false,
      });
    }
    for (const event of transitionPlan.events) {
      yield* store.append(locator, event);
    }
    const listing = yield* store.list(locator);
    const derived = foldPacketEvents({ packet: locator.packet, root: locator.root, events: listing.events });
    const traceText = yield* renderPacketTraceFile(projectPacketTrace(derived)).pipe(
      Effect.mapError(streamErrorFromSchema(locator.packet, "trace projection could not be rendered"))
    );
    yield* fs
      .writeFileString(transitionPlan.tracePath, traceText)
      .pipe(
        Effect.mapError((error) =>
          PacketStreamError.new(locator.packet, `trace projection write failed: ${String(error)}`)
        )
      );
    return PacketTransitionOutcome.make({
      appended: A.length(transitionPlan.events),
      ...optionalProp("tip", O.fromUndefinedOr(derived.tip)),
      tracePath: transitionPlan.tracePath,
      traceWritten: true,
    });
  });

  return PacketTransitionWriter.of({ plan, commit });
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
