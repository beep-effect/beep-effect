/**
 * Per-event CAS store for packet streams (`ops/events/`).
 *
 * **Details**
 *
 * A packet opts into event sourcing by carrying an `ops/events/` directory;
 * each event is one immutable file named `<seq>-<type>-<digest>.json` (D1).
 * Reads are advisory — unreadable, invalid, or tampered files surface as
 * chain issues, never failures — while appends are guarded: a compare-and-set
 * against the folded revision, refused outright on integrity issues or an
 * unresolved fork. Digests are computed over the compact canonical encoding
 * of the decoded event, not the raw file bytes. Reformatting a file does not
 * change its identity. Unknown input keys are discarded by the event schema
 * before identity is computed, so untrusted extension data cannot drive the
 * recursive canonical encoder.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, O, pipe, Str, thunkFalse } from "@beep/utils";
import { Context, Effect, FileSystem, Layer, Order, Path } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { PacketCasConflictError, PacketStreamError } from "./PacketCore.errors.ts";
import { PacketChainIssue, PacketEvent, PacketRoot, PacketSlug, StoredPacketEvent } from "./PacketCore.schemas.ts";
import {
  packetEventDigest,
  packetEventFileName,
  parsePacketEventFileName,
  renderPacketEventFile,
} from "./PacketDigest.ts";
import { foldPacketEvents, upcastPacketEventJson } from "./PacketFold.ts";
import type { PacketDerivedState } from "./PacketCore.schemas.ts";
import type { PacketEventFileNameParts } from "./PacketDigest.ts";

const $I = $RepoCliId.create("commands/Goals/PacketCore/PacketEventStore");

/**
 * Directory segments of a packet's event stream below its packet path.
 *
 * **Example** (Read the stream segments)
 *
 * ```ts
 * import { PACKET_EVENTS_SEGMENTS } from "@beep/repo-cli/test/Goals"
 *
 * console.log(PACKET_EVENTS_SEGMENTS) // ["ops", "events"]
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const PACKET_EVENTS_SEGMENTS = ["ops", "events"] as const;

/**
 * Identity of one packet stream on disk.
 *
 * **Example** (Construct a stream locator)
 *
 * ```ts
 * import { PacketStreamLocator } from "@beep/repo-cli/test/Goals"
 *
 * const locator = PacketStreamLocator.make({
 *   packet: "packet-control-plane-core",
 *   root: "goals",
 *   packetPath: "goals/packet-control-plane-core",
 * })
 * console.log(locator.root) // "goals"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PacketStreamLocator extends S.Class<PacketStreamLocator>($I`PacketStreamLocator`)(
  {
    packet: PacketSlug,
    root: PacketRoot,
    packetPath: S.String,
  },
  $I.annote("PacketStreamLocator", {
    description: "Identity of one packet stream on disk (slug, root, packet directory path).",
  })
) {}

/**
 * Result of reading one packet stream: verified events plus chain issues.
 *
 * **Example** (Construct an empty listing)
 *
 * ```ts
 * import { PacketStreamListing } from "@beep/repo-cli/test/Goals"
 *
 * const listing = PacketStreamListing.make({ events: [], issues: [] })
 * console.log(listing.events.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PacketStreamListing extends S.Class<PacketStreamListing>($I`PacketStreamListing`)(
  {
    events: S.Array(StoredPacketEvent),
    issues: S.Array(PacketChainIssue),
  },
  $I.annote("PacketStreamListing", {
    description: "Verified events plus chain issues from one packet-stream read.",
  })
) {}

/**
 * Contract of the per-event CAS store.
 *
 * @category models
 * @since 0.0.0
 */
export interface PacketEventStoreShape {
  /**
   * Append one event with compare-and-set semantics against the folded
   * revision. Refused on integrity issues, forks, or a moved tip.
   *
   * @since 0.0.0
   */
  readonly append: (
    locator: PacketStreamLocator,
    event: PacketEvent
  ) => Effect.Effect<StoredPacketEvent, PacketCasConflictError | PacketStreamError>;
  /**
   * Whether the packet has opted into event sourcing (`ops/events/` exists).
   *
   * @since 0.0.0
   */
  readonly hasStream: (packetPath: string) => Effect.Effect<boolean>;

  /**
   * Read and verify every event file in the stream. Never fails: unreadable
   * or invalid files become chain issues.
   *
   * @since 0.0.0
   */
  readonly list: (locator: PacketStreamLocator) => Effect.Effect<PacketStreamListing>;
}

/**
 * Service tag for the per-event CAS store.
 *
 * **Example** (Yield the store inside an Effect)
 *
 * ```ts
 * import { PacketEventStore } from "@beep/repo-cli/test/Goals"
 * import { Effect } from "effect"
 *
 * const program = Effect.map(PacketEventStore, (store) => typeof store.list)
 * console.log(program.pipe !== undefined) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PacketEventStore extends Context.Service<PacketEventStore, PacketEventStoreShape>()(
  $I`PacketEventStore`
) {}

const decodeJsonUnknown = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));
const decodePacketEventEffect = S.decodeUnknownEffect(PacketEvent);

const issue = (kind: PacketChainIssue["kind"], fileName: string, detail: string): PacketChainIssue =>
  PacketChainIssue.make({ kind, fileName, detail });

type ReadEventOutcome = {
  readonly stored: O.Option<StoredPacketEvent>;
  readonly issues: ReadonlyArray<PacketChainIssue>;
};

const readOutcome = (stored: StoredPacketEvent): ReadEventOutcome => ({
  stored: O.some(stored),
  issues: A.empty<PacketChainIssue>(),
});
const issueOutcome = (item: PacketChainIssue): ReadEventOutcome => ({ stored: O.none(), issues: A.of(item) });

const storedEventIdentityIssue = (
  locator: PacketStreamLocator,
  fileName: string,
  parts: PacketEventFileNameParts,
  digest: string,
  event: PacketEvent
): O.Option<PacketChainIssue> => {
  if (digest !== parts.id) {
    return O.some(issue("digest-mismatch", fileName, `recomputed digest ${digest} disagrees with the file name.`));
  }
  if (parts.seq !== event.seq || parts.type !== event.body.type) {
    return O.some(issue("file-name-mismatch", fileName, "file-name seq/type disagree with the event content."));
  }
  if (event.packet !== locator.packet || event.root !== locator.root) {
    return O.some(
      issue(
        "packet-mismatch",
        fileName,
        `event identifies ${event.root}/${event.packet}, not locator ${locator.root}/${locator.packet}.`
      )
    );
  }
  return O.none();
};

/**
 * Fold a listing and refuse ambiguity: integrity issues or a forked chain.
 *
 * **Details**
 *
 * The shared write-side guard: reads never fail on a broken stream (issues
 * and forks ride inside the derived state), but every write path — appends
 * and guarded-writer plans alike — refuses to extend a stream whose history
 * is ambiguous. Succeeds with the deterministic derived state of an
 * issue-free, unforked stream.
 *
 * **Example** (Guard an empty listing)
 *
 * ```ts
 * import { foldUnambiguousStream, PacketStreamListing, PacketStreamLocator } from "@beep/repo-cli/test/Goals"
 * import { Effect } from "effect"
 *
 * const locator = PacketStreamLocator.make({ packet: "demo", root: "goals", packetPath: "goals/demo" })
 * const listing = PacketStreamListing.make({ events: [], issues: [] })
 * console.log(Effect.isEffect(foldUnambiguousStream(locator, listing))) // true
 * ```
 *
 * @param locator - Stream identity being written.
 * @param listing - Stored events plus advisory issues from a fresh list.
 * @returns The derived state, or a typed refusal on issues or forks.
 * @category folding
 * @since 0.0.0
 */
export const foldUnambiguousStream: {
  (locator: PacketStreamLocator, listing: PacketStreamListing): Effect.Effect<PacketDerivedState, PacketStreamError>;
  (
    listing: PacketStreamListing
  ): (locator: PacketStreamLocator) => Effect.Effect<PacketDerivedState, PacketStreamError>;
} = dual(
  2,
  Effect.fnUntraced(function* (locator: PacketStreamLocator, listing: PacketStreamListing) {
    if (A.isReadonlyArrayNonEmpty(listing.issues)) {
      return yield* PacketStreamError.new(
        locator.packet,
        `stream has ${A.length(listing.issues)} integrity issue(s); run \`bun run beep explore --check\` and repair before writing (first: ${pipe(
          A.head(listing.issues),
          O.match({ onNone: () => "unknown", onSome: (item) => `${item.fileName} ${item.kind}` })
        )}).`
      );
    }
    const derived = foldPacketEvents({ packet: locator.packet, root: locator.root, events: listing.events });
    if (A.isReadonlyArrayNonEmpty(derived.forks)) {
      return yield* PacketStreamError.new(
        locator.packet,
        "stream is forked (two children of one parent); repair the fork before writing."
      );
    }
    return derived;
  })
);

const makePacketEventStore = Effect.fn("PacketEventStore.make")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const eventsDir = (packetPath: string): string => path.join(packetPath, ...PACKET_EVENTS_SEGMENTS);

  const readEventFile: (
    locator: PacketStreamLocator,
    directory: string,
    fileName: string
  ) => Effect.Effect<ReadEventOutcome> = Effect.fn("PacketEventStore.readEventFile")(function* (
    locator: PacketStreamLocator,
    directory: string,
    fileName: string
  ) {
    const parts = parsePacketEventFileName(fileName);
    if (O.isNone(parts)) {
      return issueOutcome(
        issue("file-name-mismatch", fileName, "file name is not a <seq>-<type>-<digest>.json CAS name.")
      );
    }
    const text = yield* fs
      .readFileString(path.join(directory, fileName))
      .pipe(Effect.asSome, Effect.orElseSucceed(O.none<string>));
    if (O.isNone(text)) {
      return issueOutcome(issue("event-unreadable", fileName, "event file could not be read."));
    }
    const raw = yield* decodeJsonUnknown(text.value).pipe(Effect.asSome, Effect.orElseSucceed(O.none<unknown>));
    if (O.isNone(raw)) {
      return issueOutcome(issue("event-invalid", fileName, "event file is not valid JSON."));
    }
    const event = yield* decodePacketEventEffect(upcastPacketEventJson(raw.value)).pipe(
      Effect.asSome,
      Effect.orElseSucceed(O.none<PacketEvent>)
    );
    if (O.isNone(event)) {
      return issueOutcome(issue("event-invalid", fileName, "event file does not decode as PacketEvent."));
    }
    const digest = yield* packetEventDigest(event.value).pipe(Effect.option);
    if (O.isNone(digest)) {
      return issueOutcome(issue("event-invalid", fileName, "decoded PacketEvent could not be canonically encoded."));
    }
    const identity = storedEventIdentityIssue(locator, fileName, parts.value, digest.value, event.value);
    if (O.isSome(identity)) {
      return issueOutcome(identity.value);
    }
    return readOutcome(StoredPacketEvent.make({ id: digest.value, fileName, event: event.value }));
  });

  const hasStream = Effect.fn("PacketEventStore.hasStream")(function* (packetPath: string) {
    return yield* fs.exists(eventsDir(packetPath)).pipe(Effect.orElseSucceed(thunkFalse));
  });

  const list = Effect.fn("PacketEventStore.list")(function* (locator: PacketStreamLocator) {
    const directory = eventsDir(locator.packetPath);
    const entries = yield* fs.readDirectory(directory).pipe(Effect.orElseSucceed(A.empty<string>));
    const fileNames = pipe(entries, A.filter(Str.endsWith(".json")), A.sort(Order.String));
    let events = A.empty<StoredPacketEvent>();
    let issues = A.empty<PacketChainIssue>();
    for (const fileName of fileNames) {
      const outcome = yield* readEventFile(locator, directory, fileName);
      events = pipe(outcome.stored, O.match({ onNone: () => events, onSome: (stored) => A.append(events, stored) }));
      issues = A.appendAll(issues, outcome.issues);
    }
    return PacketStreamListing.make({ events, issues });
  });

  const append = Effect.fn("PacketEventStore.append")(function* (locator: PacketStreamLocator, event: PacketEvent) {
    const directory = eventsDir(locator.packetPath);
    const present = yield* hasStream(locator.packetPath);
    if (!present) {
      return yield* PacketStreamError.new(
        locator.packet,
        `"${directory}" does not exist; a packet opts into event sourcing by carrying an ops/events/ directory.`
      );
    }
    const listing = yield* list(locator);
    const derived = yield* foldUnambiguousStream(locator, listing);
    if (event.expectedRevision !== derived.revision) {
      return yield* PacketCasConflictError.make({
        packet: locator.packet,
        expectedRevision: event.expectedRevision,
        actualRevision: derived.revision,
        message: `stream is at revision ${derived.revision}, not ${event.expectedRevision}; re-plan the transition.`,
      });
    }
    const tipId = pipe(
      O.fromUndefinedOr(derived.tip),
      O.map((tip) => tip.id)
    );
    if (O.getOrUndefined(tipId) !== event.parent) {
      return yield* PacketCasConflictError.make({
        packet: locator.packet,
        expectedRevision: event.expectedRevision,
        actualRevision: derived.revision,
        message: "event parent digest does not match the current tip; re-plan the transition.",
      });
    }
    const digest = yield* packetEventDigest(event).pipe(
      Effect.mapError((error) => PacketStreamError.new(locator.packet, `event could not be encoded: ${error.message}`))
    );
    const content = yield* renderPacketEventFile(event).pipe(
      Effect.mapError((error) => PacketStreamError.new(locator.packet, `event could not be rendered: ${error.message}`))
    );
    const fileName = packetEventFileName(event, digest);
    yield* fs
      .writeFileString(path.join(directory, fileName), content)
      .pipe(Effect.mapError((error) => PacketStreamError.new(locator.packet, `event write failed: ${String(error)}`)));
    return StoredPacketEvent.make({ id: digest, fileName, event });
  });

  return PacketEventStore.of({ hasStream, list, append });
});

/**
 * Live layer for {@link PacketEventStore} over the platform filesystem.
 *
 * **Example** (Reference the live store layer)
 *
 * ```ts
 * import { PacketEventStoreLive } from "@beep/repo-cli/test/Goals"
 *
 * console.log(typeof PacketEventStoreLive) // "object"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const PacketEventStoreLive: Layer.Layer<PacketEventStore, never, FileSystem.FileSystem | Path.Path> =
  Layer.effect(PacketEventStore, makePacketEventStore());
