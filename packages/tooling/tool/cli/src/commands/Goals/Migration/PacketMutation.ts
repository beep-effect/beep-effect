/**
 * Staged fork repair and honest packet-stream genesis seeding.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, O } from "@beep/utils";
import { Context, Effect, FileSystem, flow, Layer, Order, Path } from "effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { writeContainedFileString } from "../../../internal/cli/FsGuards.ts";
import { decodeGoalManifest } from "../Goals.schemas.ts";
import { parseGoalManifestText } from "../Inventory.ts";
import { PacketStreamError } from "../PacketCore/PacketCore.errors.ts";
import {
  isPacketSlug,
  PacketEvent,
  PacketEventTimestamp,
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
import { goalStagePosition } from "../SetStatus.ts";
import { PacketGenesisSeed } from "./Migration.schemas.ts";
import type { GoalManifest } from "../Goals.schemas.ts";
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

const FORK_TRACE_PUBLICATION_ATTEMPTS = 8;

const listingIdentity = flow(
  A.map((stored: StoredPacketEvent) => `${stored.fileName}:${stored.id}`),
  A.sort(Order.String)
);

const sameListing = (left: ReadonlyArray<StoredPacketEvent>, right: ReadonlyArray<StoredPacketEvent>): boolean => {
  const a = listingIdentity(left);
  const b = listingIdentity(right);
  return A.length(a) === A.length(b) && A.every(a, (value, index) => value === b[index]);
};

const forkRepairMadeProgress = (
  before: PacketDerivedState,
  after: PacketDerivedState,
  repair: PacketForkRepairPlan
): boolean =>
  A.length(after.forks) < A.length(before.forks) &&
  !A.some(after.forks, (fork) => fork.parentSeq === repair.fork.parentSeq && fork.parent === repair.fork.parent);

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
          .pipe(Effect.mapError((error) => streamError(input.packet, `event copy failed: ${error.message}`)));
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
        .pipe(Effect.mapError((error) => streamError(input.packet, `rebased event write failed: ${error.message}`)));
    }
  });

  const foldListing = (locator: PacketStreamLocator, listing: PacketStreamListing): PacketDerivedState =>
    foldPacketEvents({ packet: locator.packet, root: locator.root, events: listing.events });

  const publishCurrentForkTrace = Effect.fn("PacketForkRepairApplier.publishCurrentTrace")(function* (input: {
    readonly locator: PacketStreamLocator;
    readonly tracePath: string;
    readonly listing: PacketStreamListing;
    readonly derived: PacketDerivedState;
  }) {
    let listing = input.listing;
    let derived = input.derived;
    const publication = yield* Effect.repeat(
      Effect.gen(function* () {
        const traceText = yield* renderPacketTraceFile(projectPacketTrace(derived, listing.events)).pipe(
          Effect.mapError((error) =>
            streamError(input.locator.packet, `repaired trace render failed: ${error.message}`)
          )
        );
        yield* fs
          .writeFileString(input.tracePath, traceText)
          .pipe(
            Effect.mapError((error) =>
              streamError(input.locator.packet, `repaired trace write failed: ${error.message}`)
            )
          );
        const observed = yield* store.list(input.locator);
        const observedDerived = foldListing(input.locator, observed);
        if (A.isReadonlyArrayNonEmpty(observed.issues) || A.isReadonlyArrayNonEmpty(observedDerived.issues)) {
          return yield* streamError(
            input.locator.packet,
            "stream changed invalidly during trace publication; current bytes preserved"
          );
        }
        const stable = sameListing(listing.events, observed.events);
        listing = observed;
        derived = observedDerived;
        return { stable, derived };
      }),
      { until: (attempt) => attempt.stable, times: FORK_TRACE_PUBLICATION_ATTEMPTS - 1 }
    );
    if (!publication.stable) {
      return yield* streamError(
        input.locator.packet,
        "stream kept changing during trace publication; current bytes preserved"
      );
    }
    return publication.derived;
  });

  const restoreIsolatedForkRepair = Effect.fnUntraced(function* (input: {
    readonly backupDirectory: string;
    readonly eventsDirectory: string;
    readonly failedEventsDirectory: string;
    readonly failedLocator: PacketStreamLocator;
    readonly promotedListing: O.Option<PacketStreamListing>;
  }) {
    const isolated = yield* Effect.option(fs.rename(input.eventsDirectory, input.failedEventsDirectory));
    if (O.isNone(isolated)) return false;
    const isolatedListing = yield* Effect.option(store.list(input.failedLocator));
    const stillOwned =
      O.isSome(input.promotedListing) &&
      O.isSome(isolatedListing) &&
      A.isReadonlyArrayEmpty(isolatedListing.value.issues) &&
      sameListing(input.promotedListing.value.events, isolatedListing.value.events);
    if (!stillOwned) {
      yield* fs.rename(input.failedEventsDirectory, input.eventsDirectory).pipe(Effect.ignore);
      return false;
    }
    return O.isSome(yield* Effect.option(fs.rename(input.backupDirectory, input.eventsDirectory)));
  });

  const restorePreviousForkStream = Effect.fnUntraced(function* (input: {
    readonly backupDirectory: string;
    readonly eventsDirectory: string;
    readonly failedEventsDirectory: string;
    readonly failedLocator: PacketStreamLocator;
    readonly promotedListing: O.Option<PacketStreamListing>;
  }) {
    const backupPresent = yield* fs.exists(input.backupDirectory).pipe(Effect.orElseSucceed(() => false));
    if (!backupPresent) return false;
    const currentPresent = yield* fs.exists(input.eventsDirectory).pipe(Effect.orElseSucceed(() => false));
    if (!currentPresent) {
      return O.isSome(yield* Effect.option(fs.rename(input.backupDirectory, input.eventsDirectory)));
    }
    yield* fs.makeDirectory(path.dirname(input.failedEventsDirectory), { recursive: true }).pipe(Effect.ignore);
    return yield* restoreIsolatedForkRepair(input);
  });

  const restorePreviousForkTrace = Effect.fnUntraced(function* (tracePath: string, previousTrace: O.Option<string>) {
    if (O.isSome(previousTrace)) {
      yield* fs.writeFileString(tracePath, previousTrace.value).pipe(Effect.ignore);
      return;
    }
    yield* fs.remove(tracePath, { force: true }).pipe(Effect.ignore);
  });

  const discardEmptyForkRepairRoot = Effect.fnUntraced(function* (
    tempRoot: string,
    backupDirectory: string,
    failedEventsDirectory: string
  ) {
    const backupRemaining = yield* fs.exists(backupDirectory).pipe(Effect.orElseSucceed(() => true));
    const failedRemaining = yield* fs.exists(failedEventsDirectory).pipe(Effect.orElseSucceed(() => true));
    if (!backupRemaining && !failedRemaining) {
      yield* fs.remove(tempRoot, { recursive: true, force: true }).pipe(Effect.ignore);
    }
  });

  const verifyMovedForkStream = Effect.fnUntraced(function* (
    locator: PacketStreamLocator,
    original: PacketStreamListing
  ) {
    const moved = yield* store.list(locator);
    if (!sameListing(original.events, moved.events) || A.isReadonlyArrayNonEmpty(moved.issues)) {
      return yield* streamError(locator.packet, "stream changed during final promotion; current bytes preserved");
    }
  });

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
    const originalDerived = foldListing(locator, original);
    const tempRoot = yield* fs
      .makeTempDirectory({ directory: locator.packetPath, prefix: ".tmp-packet-repair-" })
      .pipe(Effect.mapError((error) => streamError(locator.packet, `repair staging failed: ${error.message}`)));
    const stagedPacketPath = path.join(tempRoot, "staged-packet");
    const stagedEvents = path.join(stagedPacketPath, ...PACKET_EVENTS_SEGMENTS);
    const eventsDirectory = path.join(locator.packetPath, ...PACKET_EVENTS_SEGMENTS);
    const backupDirectory = path.join(tempRoot, ...PACKET_EVENTS_SEGMENTS);
    const backupLocator = PacketStreamLocator.make({ ...locator, packetPath: tempRoot });
    const failedPacketPath = path.join(tempRoot, "failed-packet");
    const failedEventsDirectory = path.join(failedPacketPath, ...PACKET_EVENTS_SEGMENTS);
    const failedLocator = PacketStreamLocator.make({ ...locator, packetPath: failedPacketPath });
    const tracePath = path.join(locator.packetPath, ...PACKET_TRACE_SEGMENTS);
    const previousTrace = yield* Effect.option(fs.readFileString(tracePath));
    let promotedListing = O.none<PacketStreamListing>();

    const cleanup = Effect.fnUntraced(function* () {
      const restoredPrevious = yield* restorePreviousForkStream({
        backupDirectory,
        eventsDirectory,
        failedEventsDirectory,
        failedLocator,
        promotedListing,
      });
      if (restoredPrevious) yield* restorePreviousForkTrace(tracePath, previousTrace);
      yield* discardEmptyForkRepairRoot(tempRoot, backupDirectory, failedEventsDirectory);
    });

    return yield* Effect.onError(
      Effect.gen(function* () {
        yield* fs
          .makeDirectory(stagedEvents, { recursive: true })
          .pipe(Effect.mapError((error) => streamError(locator.packet, `repair staging failed: ${error.message}`)));
        yield* copySurvivorEvents({ eventsDirectory, original, repair, stagedEvents, packet: locator.packet });
        yield* writeRebaseDrafts({ repair, stagedEvents, packet: locator.packet });
        const stagedLocator = PacketStreamLocator.make({ ...locator, packetPath: stagedPacketPath });
        const staged = yield* store.list(stagedLocator);
        const derived = foldListing(locator, staged);
        if (A.isReadonlyArrayNonEmpty(staged.issues) || A.isReadonlyArrayNonEmpty(derived.issues)) {
          return yield* streamError(locator.packet, "staged repair does not pass event integrity checks");
        }
        if (!forkRepairMadeProgress(originalDerived, derived, repair)) {
          return yield* streamError(locator.packet, "staged repair did not remove the targeted fork");
        }
        promotedListing = O.some(staged);
        const fresh = yield* store.list(locator);
        if (!sameListing(original.events, fresh.events) || A.isReadonlyArrayNonEmpty(fresh.issues)) {
          return yield* streamError(locator.packet, "stream changed during repair staging; re-run preview");
        }
        yield* fs
          .makeDirectory(path.dirname(backupDirectory), { recursive: true })
          .pipe(
            Effect.mapError((error) => streamError(locator.packet, `repair backup staging failed: ${error.message}`))
          );
        yield* fs
          .rename(eventsDirectory, backupDirectory)
          .pipe(
            Effect.mapError((error) => streamError(locator.packet, `existing stream move failed: ${error.message}`))
          );
        yield* verifyMovedForkStream(backupLocator, original);
        yield* fs
          .rename(stagedEvents, eventsDirectory)
          .pipe(
            Effect.mapError((error) => streamError(locator.packet, `staged stream promotion failed: ${error.message}`))
          );
        const committed = yield* store.list(locator);
        const committedDerived = foldListing(locator, committed);
        if (
          A.isReadonlyArrayNonEmpty(committed.issues) ||
          A.isReadonlyArrayNonEmpty(committedDerived.issues) ||
          !forkRepairMadeProgress(originalDerived, committedDerived, repair)
        ) {
          return yield* streamError(locator.packet, "promoted stream failed verification; current bytes preserved");
        }
        const publishedDerived = yield* publishCurrentForkTrace({
          locator,
          tracePath,
          listing: committed,
          derived: committedDerived,
        });
        // A concurrent writer can still hold an open handle into the renamed
        // original stream. Retain that recovery backup because its ownership
        // cannot be revalidated and deleted atomically.
        return O.some(PacketForkRepairOutcome.make({ plan: repair, revision: publishedDerived.revision }));
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

const ownsGenesisEvent = Effect.fnUntraced(function* (seed: PacketGenesisSeed) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entries = yield* fs
    .readDirectory(seed.eventsDirectory)
    .pipe(Effect.mapError((error) => streamError(seed.slug, `genesis recovery scan failed: ${error.message}`)));
  if (A.length(entries) !== 1 || entries[0] !== seed.eventFileName) return false;
  const existingEvent = yield* fs
    .readFileString(path.join(seed.eventsDirectory, seed.eventFileName))
    .pipe(Effect.mapError((error) => streamError(seed.slug, `genesis recovery read failed: ${error.message}`)));
  return existingEvent === seed.eventText;
});

const readGenesisTrace = Effect.fnUntraced(function* (seed: PacketGenesisSeed) {
  const fs = yield* FileSystem.FileSystem;
  const tracePresent = yield* fs
    .exists(seed.tracePath)
    .pipe(Effect.mapError((error) => streamError(seed.slug, `genesis trace inspection failed: ${error.message}`)));
  if (!tracePresent) return O.none<string>();
  return O.some(
    yield* fs
      .readFileString(seed.tracePath)
      .pipe(Effect.mapError((error) => streamError(seed.slug, `genesis trace read failed: ${error.message}`)))
  );
});

/**
 * Whether a seed describes the exact owned event of an incomplete stream.
 *
 * **Example** (Build a recovery check)
 *
 * ```ts
 * import { isRecoverableGenesisSeed } from "@beep/repo-cli/commands/Goals/Migration/PacketMutation"
 * import { PacketGenesisSeed } from "@beep/repo-cli/commands/Goals/Migration/Migration.schemas"
 * import { Effect } from "effect"
 *
 * const seed = PacketGenesisSeed.make({
 *   slug: "demo",
 *   eventsDirectory: "goals/demo/ops/events",
 *   eventFileName: "00001-packet-created-deadbeef.json",
 *   eventText: "{}\n",
 *   tracePath: "goals/demo/ops/trace.json",
 *   traceText: "{}\n",
 * })
 * console.log(Effect.isEffect(isRecoverableGenesisSeed(seed)))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const isRecoverableGenesisSeed = Effect.fn("Goals.isRecoverableGenesisSeed")(function* (
  seed: PacketGenesisSeed
) {
  if (!(yield* ownsGenesisEvent(seed))) return false;
  const trace = yield* readGenesisTrace(seed);
  return O.isNone(trace) || trace.value !== seed.traceText;
});

const decodeGenesisManifest = Effect.fnUntraced(function* (record: GoalPacketRecord, manifestText: string) {
  const parsed = parseGoalManifestText(manifestText);
  if (O.isNone(parsed)) {
    return yield* streamError(record.slug, "translated manifest cannot seed genesis because it is invalid JSON");
  }
  return yield* decodeGoalManifest(parsed.value).pipe(
    Effect.mapError((error) =>
      streamError(
        record.slug,
        `translated manifest cannot seed genesis because schema decoding failed: ${error.message}`
      )
    )
  );
});

const genesisEvent = (packet: PacketEvent["packet"], manifest: GoalManifest, at: PacketEvent["at"]): PacketEvent => {
  const position = goalStagePosition(manifest);
  return PacketEvent.make({
    schemaVersion: "packet-event/v1",
    packet,
    root: "goals",
    seq: 1,
    expectedRevision: 0,
    at,
    actor: "convention-migration",
    body: {
      type: "packet-created",
      status: manifest.initiative.status,
      ...(O.isSome(position) ? { stage: position.value.stage, ordinal: position.value.ordinal } : {}),
    },
  });
};

const renderGenesisSeed = Effect.fnUntraced(function* (
  slug: PacketEvent["packet"],
  eventsDirectory: string,
  tracePath: string,
  event: PacketEvent
) {
  const id = yield* packetEventDigest(event).pipe(
    Effect.mapError((error) => streamError(slug, `genesis digest failed: ${error.message}`))
  );
  const eventText = yield* renderPacketEventFile(event).pipe(
    Effect.mapError((error) => streamError(slug, `genesis render failed: ${error.message}`))
  );
  const stored = StoredPacketEvent.make({ id, fileName: packetEventFileName(event, id), event });
  const derived = foldPacketEvents({ packet: slug, root: "goals", events: [stored] });
  const traceText = yield* renderPacketTraceFile(projectPacketTrace(derived, [stored])).pipe(
    Effect.mapError((error) => streamError(slug, `genesis trace render failed: ${error.message}`))
  );
  return PacketGenesisSeed.make({
    slug,
    eventsDirectory,
    eventFileName: stored.fileName,
    eventText,
    tracePath,
    traceText,
  });
});

const planExistingGenesisRecovery = Effect.fnUntraced(function* (
  record: GoalPacketRecord,
  manifest: GoalManifest,
  eventsDirectory: string,
  tracePath: string
) {
  const store = yield* PacketEventStore;
  const listing = yield* store.list(
    PacketStreamLocator.make({ packet: record.slug, root: "goals", packetPath: record.packetPath })
  );
  if (A.length(listing.events) !== 1 || A.isReadonlyArrayNonEmpty(listing.issues)) {
    return O.none<PacketGenesisSeed>();
  }
  const stored = listing.events[0];
  if (stored === undefined) return O.none<PacketGenesisSeed>();
  const seed = yield* renderGenesisSeed(
    record.slug,
    eventsDirectory,
    tracePath,
    genesisEvent(record.slug, manifest, stored.event.at)
  );
  if (!(yield* isRecoverableGenesisSeed(seed))) {
    return O.none<PacketGenesisSeed>();
  }
  return O.some(seed);
});

/**
 * Plan trace recovery for an already translated packet carrying an owned
 * genesis event but a missing or incomplete trace projection.
 *
 * **Example** (Build a recovery plan)
 *
 * ```ts
 * import { planPacketGenesisRecovery } from "@beep/repo-cli/commands/Goals/Migration/PacketMutation"
 * import { GoalPacketRecord } from "@beep/repo-cli/commands/Goals/Inventory"
 * import { Effect } from "effect"
 *
 * const record = GoalPacketRecord.make({
 *   slug: "demo",
 *   packetPath: "goals/demo",
 *   manifestPath: "goals/demo/ops/manifest.json",
 *   readmePath: "goals/demo/README.md",
 * })
 * console.log(Effect.isEffect(planPacketGenesisRecovery(record, "{}")))
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const planPacketGenesisRecovery = Effect.fn("Goals.planPacketGenesisRecovery")(function* (
  record: GoalPacketRecord,
  manifestText: string
) {
  if (!isPacketSlug(record.slug)) {
    return yield* streamError(record.slug, `directory name "${record.slug}" is not a valid packet slug`);
  }
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const eventsDirectory = path.join(record.packetPath, ...PACKET_EVENTS_SEGMENTS);
  const eventsPresent = yield* fs.exists(eventsDirectory).pipe(Effect.orElseSucceed(() => false));
  if (!eventsPresent) return O.none<PacketGenesisSeed>();
  const manifest = yield* decodeGenesisManifest(record, manifestText);
  return yield* planExistingGenesisRecovery(
    record,
    manifest,
    eventsDirectory,
    path.join(record.packetPath, ...PACKET_TRACE_SEGMENTS)
  );
});

/**
 * Plan one honest genesis seed from the current translated manifest.
 *
 * **Details**
 *
 * Only the current lifecycle and optional declared phase snapshot enter the
 * event. No pre-adoption actor, timestamp, or transition is synthesized. An
 * exact owned genesis event with a missing or incomplete trace is planned
 * again so an interrupted write remains recoverable.
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
 * @returns Optional seed; unrelated or complete existing streams produce `None`.
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
  const tracePath = path.join(record.packetPath, ...PACKET_TRACE_SEGMENTS);
  const eventsPresent = yield* fs.exists(eventsDirectory).pipe(Effect.orElseSucceed(() => false));
  if (!isPacketSlug(record.slug)) {
    return yield* streamError(record.slug, `directory name "${record.slug}" is not a valid packet slug`);
  }
  const manifest = yield* decodeGenesisManifest(record, manifestText);
  if (eventsPresent) return yield* planExistingGenesisRecovery(record, manifest, eventsDirectory, tracePath);
  if (!S.is(PacketEventTimestamp)(at)) {
    return yield* streamError(record.slug, `adoption timestamp "${at}" is not a full ISO-8601 date-time`);
  }
  return O.some(
    yield* renderGenesisSeed(record.slug, eventsDirectory, tracePath, genesisEvent(record.slug, manifest, at))
  );
});

const removeQuarantinedGenesisEvent = Effect.fnUntraced(function* (
  seed: PacketGenesisSeed,
  context: "genesis rollback" | "seed rollback",
  quarantineDirectory: string,
  entries: ReadonlyArray<string>
) {
  if (A.isReadonlyArrayEmpty(entries)) return;
  if (A.length(entries) !== 1 || entries[0] !== seed.eventFileName) {
    return yield* streamError(seed.slug, `${context} conflict: foreign bytes preserved at ${quarantineDirectory}`);
  }
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const quarantinedEventPath = path.join(quarantineDirectory, seed.eventFileName);
  const content = yield* fs
    .readFileString(quarantinedEventPath)
    .pipe(Effect.mapError((error) => streamError(seed.slug, `${context} event read failed: ${error.message}`)));
  if (content !== seed.eventText) {
    return yield* streamError(
      seed.slug,
      `${context} conflict: changed event bytes preserved at ${quarantineDirectory}`
    );
  }
  yield* fs
    .remove(quarantinedEventPath)
    .pipe(Effect.mapError((error) => streamError(seed.slug, `${context} event remove failed: ${error.message}`)));
});

/**
 * Atomically isolates and removes one owned genesis event directory.
 *
 * **Gotchas**
 *
 * Foreign bytes are never removed. Bytes observed before the rename remain in
 * quarantine, while writers targeting the canonical path after the rename use
 * a separate directory.
 *
 * **Example** (Build a rollback effect)
 *
 * ```ts
 * import { quarantineOwnedGenesisEvents } from "@beep/repo-cli/commands/Goals/Migration/PacketMutation"
 * import { PacketGenesisSeed } from "@beep/repo-cli/commands/Goals/Migration/Migration.schemas"
 * import { Effect } from "effect"
 *
 * const seed = PacketGenesisSeed.make({
 *   slug: "demo",
 *   eventsDirectory: "goals/demo/ops/events",
 *   eventFileName: "00001-packet-created-deadbeef.json",
 *   eventText: "{}\n",
 *   tracePath: "goals/demo/ops/trace.json",
 *   traceText: "{}\n",
 * })
 *
 * console.log(Effect.isEffect(quarantineOwnedGenesisEvents(seed, "genesis rollback"))) // true
 * ```
 *
 * @internal
 * @param seed - Genesis event ownership record.
 * @param context - Error-message prefix for the calling rollback operation.
 * @returns An Effect that removes only the exact owned event directory.
 * @category error-handling
 * @since 0.0.0
 */
export const quarantineOwnedGenesisEvents = Effect.fn("Goals.quarantineOwnedGenesisEvents")(function* (
  seed: PacketGenesisSeed,
  context: "genesis rollback" | "seed rollback"
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entries = yield* fs
    .readDirectory(seed.eventsDirectory)
    .pipe(Effect.mapError((error) => streamError(seed.slug, `${context} scan failed: ${error.message}`)));
  if (A.isReadonlyArrayNonEmpty(entries) && (A.length(entries) !== 1 || entries[0] !== seed.eventFileName)) {
    return yield* streamError(seed.slug, `${context} conflict: event directory contains foreign bytes`);
  }
  const rollbackRoot = yield* fs
    .makeTempDirectory({ directory: path.dirname(seed.eventsDirectory), prefix: ".genesis-rollback-" })
    .pipe(Effect.mapError((error) => streamError(seed.slug, `${context} quarantine failed: ${error.message}`)));
  const quarantineDirectory = path.join(rollbackRoot, "events");
  yield* fs
    .rename(seed.eventsDirectory, quarantineDirectory)
    .pipe(Effect.mapError((error) => streamError(seed.slug, `${context} quarantine failed: ${error.message}`)));
  const quarantinedEntries = yield* fs
    .readDirectory(quarantineDirectory)
    .pipe(Effect.mapError((error) => streamError(seed.slug, `${context} rescan failed: ${error.message}`)));
  yield* removeQuarantinedGenesisEvent(seed, context, quarantineDirectory, quarantinedEntries);
  const remaining = yield* fs
    .readDirectory(quarantineDirectory)
    .pipe(Effect.mapError((error) => streamError(seed.slug, `${context} rescan failed: ${error.message}`)));
  if (A.isReadonlyArrayNonEmpty(remaining)) {
    return yield* streamError(seed.slug, `${context} conflict: foreign bytes preserved at ${quarantineDirectory}`);
  }
  yield* fs
    .remove(rollbackRoot, { recursive: true })
    .pipe(Effect.mapError((error) => streamError(seed.slug, `${context} event remove failed: ${error.message}`)));
});

const publishGenesisTrace = Effect.fnUntraced(function* (seed: PacketGenesisSeed) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const tracePath = path.resolve(seed.tracePath);
  yield* Effect.scoped(
    Effect.gen(function* () {
      const stagingRoot = yield* fs
        .makeTempDirectoryScoped({ directory: path.dirname(tracePath), prefix: ".genesis-trace-publish-" })
        .pipe(Effect.mapError((error) => streamError(seed.slug, `genesis trace write failed: ${error.message}`)));
      const stagedTracePath = path.join(stagingRoot, "trace.json");
      yield* fs
        .writeFileString(stagedTracePath, seed.traceText)
        .pipe(Effect.mapError((error) => streamError(seed.slug, `genesis trace write failed: ${error.message}`)));
      yield* fs
        .link(stagedTracePath, tracePath)
        .pipe(
          Effect.catch((error) =>
            readGenesisTrace(seed).pipe(
              Effect.flatMap((trace) =>
                O.isSome(trace) && trace.value === seed.traceText
                  ? Effect.void
                  : Effect.fail(streamError(seed.slug, `genesis trace write failed: ${error.message}`))
              )
            )
          )
        );
    })
  );
});

const recoverMismatchedGenesisTrace = Effect.fnUntraced(function* (seed: PacketGenesisSeed, observed: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const tracePath = path.resolve(seed.tracePath);
  if (!Str.startsWith(observed)(seed.traceText)) {
    return yield* streamError(
      seed.slug,
      `genesis trace recovery conflict: nonmatching bytes preserved at ${tracePath}`
    );
  }
  const recoveryRoot = yield* fs
    .makeTempDirectory({ directory: path.dirname(tracePath), prefix: ".genesis-trace-recovery-" })
    .pipe(Effect.mapError((error) => streamError(seed.slug, `genesis trace quarantine failed: ${error.message}`)));
  const quarantinedTracePath = path.join(recoveryRoot, "trace.json");
  const discardRecoveryRoot = fs
    .remove(recoveryRoot, { recursive: true })
    .pipe(
      Effect.mapError((error) => streamError(seed.slug, `genesis trace quarantine remove failed: ${error.message}`))
    );
  const quarantined = yield* fs.rename(tracePath, quarantinedTracePath).pipe(
    Effect.matchEffect({
      onFailure: (error) =>
        readGenesisTrace(seed).pipe(
          Effect.flatMap((trace) => {
            if (O.isSome(trace) && trace.value === seed.traceText) {
              return discardRecoveryRoot.pipe(Effect.as(false));
            }
            if (O.isNone(trace)) {
              return discardRecoveryRoot.pipe(Effect.andThen(publishGenesisTrace(seed)), Effect.as(false));
            }
            return Effect.fail(streamError(seed.slug, `genesis trace quarantine failed: ${error.message}`));
          })
        ),
      onSuccess: () => Effect.succeed(true),
    })
  );
  if (!quarantined) return;
  const isolated = yield* fs
    .readFileString(quarantinedTracePath)
    .pipe(Effect.mapError((error) => streamError(seed.slug, `genesis trace quarantine read failed: ${error.message}`)));
  if (isolated !== observed && isolated !== seed.traceText) {
    yield* fs
      .link(quarantinedTracePath, tracePath)
      .pipe(
        Effect.catch((error) =>
          readGenesisTrace(seed).pipe(
            Effect.flatMap((trace) =>
              O.isSome(trace)
                ? Effect.void
                : Effect.fail(streamError(seed.slug, `genesis trace restore failed: ${error.message}`))
            )
          )
        )
      );
    return yield* streamError(
      seed.slug,
      `genesis trace quarantine conflict: changed bytes restored at ${tracePath}; recovery copy preserved at ${quarantinedTracePath}`
    );
  }
  yield* publishGenesisTrace(seed).pipe(
    Effect.mapError((error) =>
      streamError(seed.slug, `${error.message}; incomplete trace preserved at ${quarantinedTracePath}`)
    )
  );
  const preserved = yield* fs
    .readFileString(quarantinedTracePath)
    .pipe(Effect.mapError((error) => streamError(seed.slug, `genesis trace quarantine read failed: ${error.message}`)));
  if (preserved !== isolated) {
    return yield* streamError(
      seed.slug,
      `genesis trace quarantine conflict: changed bytes preserved at ${quarantinedTracePath}`
    );
  }
  yield* discardRecoveryRoot;
});

const recoverGenesisTrace = Effect.fnUntraced(function* (seed: PacketGenesisSeed) {
  const trace = yield* readGenesisTrace(seed);
  if (O.isNone(trace)) return yield* publishGenesisTrace(seed);
  if (trace.value === seed.traceText) return;
  yield* recoverMismatchedGenesisTrace(seed, trace.value);
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
  const present = yield* fs
    .exists(seed.eventsDirectory)
    .pipe(Effect.mapError((error) => streamError(seed.slug, `genesis stream inspection failed: ${error.message}`)));
  const eventPath = path.join(seed.eventsDirectory, seed.eventFileName);
  if (present) {
    if (!(yield* ownsGenesisEvent(seed))) {
      return yield* streamError(seed.slug, "event stream appeared after preview; refusing to reseed");
    }
    return yield* recoverGenesisTrace(seed);
  }
  let createdEventsDirectory = false;
  const rollback = Effect.fnUntraced(function* () {
    if (!createdEventsDirectory) return;
    yield* quarantineOwnedGenesisEvents(seed, "genesis rollback");
  });
  const mutation = Effect.gen(function* () {
    yield* fs
      .makeDirectory(seed.eventsDirectory)
      .pipe(Effect.mapError((error) => streamError(seed.slug, `genesis directory write failed: ${error.message}`)));
    createdEventsDirectory = true;
    yield* writeContainedFileString(path.resolve(seed.eventsDirectory), path.resolve(eventPath), seed.eventText).pipe(
      Effect.mapError((error) => streamError(seed.slug, `genesis event write failed: ${error.message}`))
    );
    yield* publishGenesisTrace(seed);
  });
  yield* mutation.pipe(
    Effect.matchEffect({
      onFailure: (original) =>
        rollback().pipe(
          Effect.matchEffect({
            onFailure: (cleanup) =>
              Effect.fail(streamError(seed.slug, `${original.message}; rollback incomplete: ${cleanup.message}`)),
            onSuccess: () => Effect.fail(original),
          })
        ),
      onSuccess: Effect.succeed,
    })
  );
});
