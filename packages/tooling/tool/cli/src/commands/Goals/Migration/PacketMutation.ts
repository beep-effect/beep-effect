/**
 * Staged fork repair and honest packet-stream genesis seeding.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, O, pipe } from "@beep/utils";
import { Context, Effect, FileSystem, flow, Layer, Order, Path } from "effect";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { isGoalStatus } from "../Goals.schemas.ts";
import { isJsonRecord, parseGoalManifestText } from "../Inventory.ts";
import { PacketStreamError } from "../PacketCore/PacketCore.errors.ts";
import {
  isPacketStage,
  PacketEvent,
  PacketForkRepairPlan,
  StoredPacketEvent,
} from "../PacketCore/PacketCore.schemas.ts";
import { packetEventDigest, packetEventFileName, renderPacketEventFile } from "../PacketCore/PacketDigest.ts";
import { PACKET_EVENTS_SEGMENTS, PacketEventStore, PacketStreamLocator } from "../PacketCore/PacketEventStore.ts";
import {
  foldPacketEvents,
  planForkRepair,
  projectPacketTrace,
  renderPacketTraceFile,
} from "../PacketCore/PacketFold.ts";
import { PACKET_TRACE_SEGMENTS } from "../PacketCore/PacketTransitionWriter.ts";
import { PacketGenesisSeed } from "./Migration.schemas.ts";
import type { GoalPacketRecord } from "../Inventory.ts";
import type { PacketDerivedState } from "../PacketCore/PacketCore.schemas.ts";
import type { PacketStreamListing } from "../PacketCore/PacketEventStore.ts";

const $I = $RepoCliId.create("commands/Goals/Migration/PacketMutation");

/**
 * Result of applying one staged fork-repair plan.
 *
 * **Example** (Construct an applied result)
 *
 * ```ts
 * import { PacketForkRepairOutcome } from "@beep/repo-cli/commands/Goals/Migration/PacketMutation"
 * import { PacketForkRepairPlan, PacketForkVerdict } from "@beep/repo-cli/test/Goals"
 *
 * const outcome = PacketForkRepairOutcome.make({
 *   plan: PacketForkRepairPlan.make({
 *     packet: "demo",
 *     root: "goals",
 *     fork: PacketForkVerdict.make({ parentSeq: 1, children: ["a".repeat(64), "b".repeat(64)] }),
 *     survivor: "a".repeat(64),
 *     rebaseDrafts: [],
 *     filesToRemove: [],
 *   }),
 *   revision: 2,
 * })
 * console.log(outcome.revision) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PacketForkRepairOutcome extends S.Class<PacketForkRepairOutcome>($I`PacketForkRepairOutcome`)(
  { plan: PacketForkRepairPlan, revision: S.Int },
  $I.annote("PacketForkRepairOutcome", { description: "Verified result of one staged packet-fork repair." })
) {}

/**
 * Service contract for staged single-packet fork repair.
 *
 * @category models
 * @since 0.0.0
 */
export interface PacketForkRepairApplierShape {
  readonly apply: (locator: PacketStreamLocator) => Effect.Effect<O.Option<PacketForkRepairOutcome>, PacketStreamError>;
  readonly preview: (locator: PacketStreamLocator) => Effect.Effect<O.Option<PacketForkRepairPlan>, PacketStreamError>;
}

/**
 * Service tag for the staged fork-repair applier.
 *
 * **Example** (Yield the applier service)
 *
 * ```ts
 * import { PacketForkRepairApplier } from "@beep/repo-cli/commands/Goals/Migration/PacketMutation"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(Effect.map(PacketForkRepairApplier, (service) => service.preview)))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PacketForkRepairApplier extends Context.Service<PacketForkRepairApplier, PacketForkRepairApplierShape>()(
  $I`PacketForkRepairApplier`
) {}

const streamError = (packet: string, message: string): PacketStreamError => PacketStreamError.new(packet, message);

const listingIdentity = flow(
  A.map((stored: StoredPacketEvent) => `${stored.fileName}:${stored.id}`),
  A.sort(Order.String)
);

const sameListing = (left: ReadonlyArray<StoredPacketEvent>, right: ReadonlyArray<StoredPacketEvent>): boolean => {
  const a = listingIdentity(left);
  const b = listingIdentity(right);
  return A.length(a) === A.length(b) && A.every(a, (value, index) => value === b[index]);
};

const makePacketForkRepairApplier = Effect.fn("PacketForkRepairApplier.make")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const store = yield* PacketEventStore;

  const preview = Effect.fn("PacketForkRepairApplier.preview")(function* (locator: PacketStreamLocator) {
    const listing = yield* store.list(locator);
    if (A.isReadonlyArrayNonEmpty(listing.issues)) {
      return yield* streamError(locator.packet, "stream has integrity issues; fork repair refuses ambiguous bytes");
    }
    return yield* planForkRepair({ packet: locator.packet, root: locator.root, events: listing.events }).pipe(
      Effect.mapError((error) => streamError(locator.packet, `repair plan could not be encoded: ${error.message}`))
    );
  });

  const copySurvivorEvents = Effect.fn("PacketForkRepairApplier.copySurvivorEvents")(function* (input: {
    readonly eventsDirectory: string;
    readonly original: PacketStreamListing;
    readonly repair: PacketForkRepairPlan;
    readonly stagedEvents: string;
    readonly packet: string;
  }) {
    for (const stored of input.original.events) {
      if (!A.contains(input.repair.filesToRemove, stored.fileName)) {
        yield* fs
          .copyFile(path.join(input.eventsDirectory, stored.fileName), path.join(input.stagedEvents, stored.fileName))
          .pipe(Effect.mapError((error) => streamError(input.packet, `event copy failed: ${String(error)}`)));
      }
    }
  });

  const writeRebaseDrafts = Effect.fn("PacketForkRepairApplier.writeRebaseDrafts")(function* (input: {
    readonly repair: PacketForkRepairPlan;
    readonly stagedEvents: string;
    readonly packet: string;
  }) {
    for (const event of input.repair.rebaseDrafts) {
      const id = yield* packetEventDigest(event).pipe(
        Effect.mapError((error) => streamError(input.packet, `rebased event digest failed: ${error.message}`))
      );
      const content = yield* renderPacketEventFile(event).pipe(
        Effect.mapError((error) => streamError(input.packet, `rebased event render failed: ${error.message}`))
      );
      yield* fs
        .writeFileString(path.join(input.stagedEvents, packetEventFileName(event, id)), content)
        .pipe(Effect.mapError((error) => streamError(input.packet, `rebased event write failed: ${String(error)}`)));
    }
  });

  const foldListing = (locator: PacketStreamLocator, listing: PacketStreamListing): PacketDerivedState =>
    foldPacketEvents({ packet: locator.packet, root: locator.root, events: listing.events });

  const apply = Effect.fn("PacketForkRepairApplier.apply")(function* (locator: PacketStreamLocator) {
    const original = yield* store.list(locator);
    if (A.isReadonlyArrayNonEmpty(original.issues)) {
      return yield* streamError(locator.packet, "stream has integrity issues; fork repair refuses ambiguous bytes");
    }
    const planned = yield* planForkRepair({ packet: locator.packet, root: locator.root, events: original.events }).pipe(
      Effect.mapError((error) => streamError(locator.packet, `repair plan could not be encoded: ${error.message}`))
    );
    if (O.isNone(planned)) return O.none<PacketForkRepairOutcome>();
    const repair = planned.value;
    const tempRoot = yield* fs
      .makeTempDirectory({ directory: locator.packetPath, prefix: ".tmp-packet-repair-" })
      .pipe(Effect.mapError((error) => streamError(locator.packet, `repair staging failed: ${String(error)}`)));
    const stagedPacketPath = path.join(tempRoot, "staged-packet");
    const stagedEvents = path.join(stagedPacketPath, ...PACKET_EVENTS_SEGMENTS);
    const eventsDirectory = path.join(locator.packetPath, ...PACKET_EVENTS_SEGMENTS);
    const backupDirectory = path.join(tempRoot, "previous-events");
    const tracePath = path.join(locator.packetPath, ...PACKET_TRACE_SEGMENTS);
    const previousTrace = yield* Effect.option(fs.readFileString(tracePath));

    const cleanup = Effect.fnUntraced(function* () {
      const backupPresent = yield* fs.exists(backupDirectory).pipe(Effect.orElseSucceed(() => false));
      const currentPresent = yield* fs.exists(eventsDirectory).pipe(Effect.orElseSucceed(() => false));
      if (backupPresent) {
        if (currentPresent) yield* fs.remove(eventsDirectory, { recursive: true, force: true }).pipe(Effect.ignore);
        yield* fs.rename(backupDirectory, eventsDirectory).pipe(Effect.ignore);
      }
      yield* O.match(previousTrace, {
        onNone: () => fs.remove(tracePath, { force: true }).pipe(Effect.ignore),
        onSome: (content) => fs.writeFileString(tracePath, content).pipe(Effect.ignore),
      });
      yield* fs.remove(tempRoot, { recursive: true, force: true }).pipe(Effect.ignore);
    });

    return yield* Effect.onError(
      Effect.gen(function* () {
        yield* fs
          .makeDirectory(stagedEvents, { recursive: true })
          .pipe(Effect.mapError((error) => streamError(locator.packet, `repair staging failed: ${String(error)}`)));
        yield* copySurvivorEvents({ eventsDirectory, original, repair, stagedEvents, packet: locator.packet });
        yield* writeRebaseDrafts({ repair, stagedEvents, packet: locator.packet });
        const stagedLocator = PacketStreamLocator.make({ ...locator, packetPath: stagedPacketPath });
        const staged = yield* store.list(stagedLocator);
        const derived = foldListing(locator, staged);
        if (A.isReadonlyArrayNonEmpty(staged.issues) || A.isReadonlyArrayNonEmpty(derived.issues)) {
          return yield* streamError(locator.packet, "staged repair does not pass event integrity checks");
        }
        if (A.isReadonlyArrayNonEmpty(derived.forks)) {
          return yield* streamError(
            locator.packet,
            "staged repair still contains a fork; apply one innermost plan first"
          );
        }
        const fresh = yield* store.list(locator);
        if (!sameListing(original.events, fresh.events) || A.isReadonlyArrayNonEmpty(fresh.issues)) {
          return yield* streamError(locator.packet, "stream changed during repair staging; re-run preview");
        }
        yield* fs
          .rename(eventsDirectory, backupDirectory)
          .pipe(
            Effect.mapError((error) => streamError(locator.packet, `existing stream move failed: ${String(error)}`))
          );
        yield* fs
          .rename(stagedEvents, eventsDirectory)
          .pipe(
            Effect.mapError((error) => streamError(locator.packet, `staged stream promotion failed: ${String(error)}`))
          );
        const committed = yield* store.list(locator);
        const committedDerived = foldListing(locator, committed);
        if (
          A.isReadonlyArrayNonEmpty(committed.issues) ||
          A.isReadonlyArrayNonEmpty(committedDerived.issues) ||
          A.isReadonlyArrayNonEmpty(committedDerived.forks)
        ) {
          yield* fs.remove(eventsDirectory, { recursive: true, force: true }).pipe(Effect.ignore);
          yield* fs.rename(backupDirectory, eventsDirectory).pipe(Effect.ignore);
          return yield* streamError(locator.packet, "promoted stream failed verification; prior stream restored");
        }
        const traceText = yield* renderPacketTraceFile(projectPacketTrace(committedDerived, committed.events)).pipe(
          Effect.mapError((error) => streamError(locator.packet, `repaired trace render failed: ${error.message}`))
        );
        yield* fs
          .writeFileString(tracePath, traceText)
          .pipe(
            Effect.mapError((error) => streamError(locator.packet, `repaired trace write failed: ${String(error)}`))
          );
        yield* fs.remove(backupDirectory, { recursive: true, force: true }).pipe(Effect.ignore);
        yield* fs.remove(tempRoot, { recursive: true, force: true }).pipe(Effect.ignore);
        return O.some(PacketForkRepairOutcome.make({ plan: repair, revision: committedDerived.revision }));
      }),
      cleanup
    );
  });

  return PacketForkRepairApplier.of({ preview, apply });
});

/**
 * Live staged fork-repair service.
 *
 * **Example** (Reference the live layer)
 *
 * ```ts
 * import { PacketForkRepairApplierLive } from "@beep/repo-cli/commands/Goals/Migration/PacketMutation"
 *
 * console.log(typeof PacketForkRepairApplierLive) // "object"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const PacketForkRepairApplierLive: Layer.Layer<
  PacketForkRepairApplier,
  never,
  PacketEventStore | FileSystem.FileSystem | Path.Path
> = Layer.effect(PacketForkRepairApplier, makePacketForkRepairApplier());

type PhaseSnapshot = { readonly stage: string; readonly ordinal: number };

const phaseSnapshot = (manifest: Readonly<Record<string, unknown>>): O.Option<PhaseSnapshot> => {
  const phases = R.get(manifest, "phases");
  const entries = pipe(
    phases,
    O.flatMap((value) => {
      if (A.isArray(value)) return O.some(value);
      return isJsonRecord(value) ? O.some(A.map(R.toEntries(value), ([id, entry]) => ({ id, entry }))) : O.none();
    }),
    O.getOrElse(A.empty<unknown>)
  );
  const normalized = A.getSomes(
    A.map(entries, (entry, index) => {
      const candidate = isJsonRecord(entry) && isJsonRecord(entry.entry) ? { ...entry.entry, id: entry.id } : entry;
      if (!isJsonRecord(candidate))
        return O.none<{ readonly id: string; readonly status: string; readonly index: number }>();
      const id = R.get(candidate, "id");
      const status = R.get(candidate, "status");
      return O.isSome(id) &&
        P.isString(id.value) &&
        isPacketStage(id.value) &&
        O.isSome(status) &&
        P.isString(status.value)
        ? O.some({ id: id.value, status: status.value, index })
        : O.none();
    })
  );
  const current = pipe(
    A.findFirst(normalized, (entry) => entry.status === "in-progress"),
    O.orElse(() => A.findFirst(normalized, (entry) => entry.status === "pending")),
    O.orElse(() => A.last(normalized))
  );
  return O.map(current, (entry) => ({ stage: entry.id, ordinal: entry.index }));
};

/**
 * Plan one honest genesis seed from the current translated manifest.
 *
 * **Details**
 *
 * Only the current lifecycle and optional declared phase snapshot enter the
 * event. No pre-adoption actor, timestamp, or transition is synthesized.
 *
 * **Example** (Build a genesis seed effect)
 *
 * ```ts
 * import { planPacketGenesisSeed } from "@beep/repo-cli/commands/Goals/Migration/PacketMutation"
 * import { GoalPacketRecord } from "@beep/repo-cli/commands/Goals/Inventory"
 * import { Effect } from "effect"
 *
 * const record = GoalPacketRecord.make({
 *   slug: "demo",
 *   packetPath: "goals/demo",
 *   manifestPath: "goals/demo/ops/manifest.json",
 *   readmePath: "goals/demo/README.md",
 * })
 * console.log(Effect.isEffect(planPacketGenesisSeed(record, "{}", "2026-08-26T00:00:00.000Z")))
 * ```
 *
 * @param record - Packet receiving the new stream.
 * @param manifestText - Post-translation manifest text.
 * @param at - Explicit adoption timestamp shared by the migration run.
 * @returns Optional seed; existing streams produce `None`.
 * @category use-cases
 * @since 0.0.0
 */
export const planPacketGenesisSeed = Effect.fn("Goals.planPacketGenesisSeed")(function* (
  record: GoalPacketRecord,
  manifestText: string,
  at: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const eventsDirectory = path.join(record.packetPath, ...PACKET_EVENTS_SEGMENTS);
  const present = yield* fs.exists(eventsDirectory).pipe(Effect.orElseSucceed(() => false));
  if (present) return O.none<PacketGenesisSeed>();
  const parsed = parseGoalManifestText(manifestText);
  if (O.isNone(parsed) || !isJsonRecord(parsed.value)) {
    return yield* streamError(record.slug, "translated manifest cannot seed genesis because it is invalid JSON");
  }
  const initiative = R.get(parsed.value, "initiative");
  if (O.isNone(initiative) || !isJsonRecord(initiative.value)) {
    return yield* streamError(record.slug, "translated manifest cannot seed genesis without initiative");
  }
  const status = R.get(initiative.value, "status");
  if (O.isNone(status) || !isGoalStatus(status.value)) {
    return yield* streamError(record.slug, "translated manifest cannot seed genesis without canonical status");
  }
  const position = phaseSnapshot(parsed.value);
  const event = PacketEvent.make({
    schemaVersion: "packet-event/v1",
    packet: record.slug,
    root: "goals",
    seq: 1,
    expectedRevision: 0,
    at,
    actor: "convention-migration",
    body: {
      type: "packet-created",
      status: status.value,
      ...(O.isSome(position) ? { stage: position.value.stage, ordinal: position.value.ordinal } : {}),
    },
  });
  const id = yield* packetEventDigest(event).pipe(
    Effect.mapError((error) => streamError(record.slug, `genesis digest failed: ${error.message}`))
  );
  const eventText = yield* renderPacketEventFile(event).pipe(
    Effect.mapError((error) => streamError(record.slug, `genesis render failed: ${error.message}`))
  );
  const stored = StoredPacketEvent.make({ id, fileName: packetEventFileName(event, id), event });
  const derived = foldPacketEvents({ packet: record.slug, root: "goals", events: [stored] });
  const traceText = yield* renderPacketTraceFile(projectPacketTrace(derived, [stored])).pipe(
    Effect.mapError((error) => streamError(record.slug, `genesis trace render failed: ${error.message}`))
  );
  return O.some(
    PacketGenesisSeed.make({
      slug: record.slug,
      eventsDirectory,
      eventFileName: stored.fileName,
      eventText,
      tracePath: path.join(record.packetPath, ...PACKET_TRACE_SEGMENTS),
      traceText,
    })
  );
});

/**
 * Apply one precomputed genesis seed.
 *
 * **Example** (Build the filesystem effect)
 *
 * ```ts
 * import { applyPacketGenesisSeed } from "@beep/repo-cli/commands/Goals/Migration/PacketMutation"
 * import { PacketGenesisSeed } from "@beep/repo-cli/commands/Goals/Migration/Migration.schemas"
 * import * as Effect from "effect/Effect"
 *
 * const program = applyPacketGenesisSeed(PacketGenesisSeed.make({
 *   slug: "demo",
 *   eventsDirectory: "goals/demo/ops/events",
 *   eventFileName: "00001-packet-created-deadbeef.json",
 *   eventText: "{}\n",
 *   tracePath: "goals/demo/ops/trace.json",
 *   traceText: "{}\n",
 * }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param seed - Seed payload planned against an absent stream.
 * @returns An Effect that creates the stream event and trace.
 * @category use-cases
 * @since 0.0.0
 */
export const applyPacketGenesisSeed = Effect.fn("Goals.applyPacketGenesisSeed")(function* (seed: PacketGenesisSeed) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const present = yield* fs.exists(seed.eventsDirectory).pipe(Effect.orElseSucceed(() => false));
  if (present) return yield* streamError(seed.slug, "event stream appeared after preview; refusing to reseed");
  yield* fs
    .makeDirectory(seed.eventsDirectory, { recursive: true })
    .pipe(Effect.mapError((error) => streamError(seed.slug, `genesis directory write failed: ${String(error)}`)));
  yield* fs
    .writeFileString(path.join(seed.eventsDirectory, seed.eventFileName), seed.eventText)
    .pipe(Effect.mapError((error) => streamError(seed.slug, `genesis event write failed: ${String(error)}`)));
  yield* fs
    .writeFileString(seed.tracePath, seed.traceText)
    .pipe(Effect.mapError((error) => streamError(seed.slug, `genesis trace write failed: ${String(error)}`)));
});
