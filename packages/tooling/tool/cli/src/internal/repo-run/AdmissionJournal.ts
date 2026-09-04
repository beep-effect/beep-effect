/**
 * Machine-wide best-effort admission-transition journal at
 * `<admission root>/journal.ndjson`.
 *
 * Every write serializes under `<admission root>/journal.lock`: the writer
 * reads the journal, preserves undecodable records byte-for-byte, appends its event, ring-trims
 * to the newest admitted transitions, and publishes the result with an atomic
 * temp-file rename. Scheduler correctness lives exclusively in ticket and
 * lease files; `bypassAdmission` on sub-envelope machines mints neither file
 * and journals no transition.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { createHash, randomUUID } from "node:crypto";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { UUID } from "@beep/schema/String";
import { Clock, Console, Duration, Effect, Encoding, FileSystem, Number as N, Order, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import { constant, dual, flow } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { publishJournalTextAtomically } from "./JournalFile.ts";
import {
  isProcessPidAlive,
  ProcessIdentityStatus,
  processIdentityStatus,
  processStartIdentityForPid,
} from "./ProcessIdentity.ts";
import { AdmissionPriority, AdmissionWorkKind, QualitySchedulerError } from "./QualityScheduler.schemas.ts";
import type * as SchemaAST from "effect/SchemaAST";

const $I = $RepoCliId.create("internal/repo-run/AdmissionJournal");
const JOURNAL_FILE_NAME = "journal.ndjson";
const PROTOCOL_FILE_NAME = "protocol.json";
const LOCK_FILE_NAME = "journal.lock";
const RETAINED_ADMISSIONS = 200;
const LOCK_RETRY_ATTEMPTS = 8;
const LOCK_RETRY_DELAY_MILLIS = 25;
const LOCKED_OPERATION_RETRY_ATTEMPTS = 5;
const LOCK_REAP_ADOPTION_BOUND_MILLIS = 30_000;
// No legitimate writer publishes an unparseable token. The age backstop
// therefore applies only to malformed generations, never a parseable live
// owner whose lock could still be released concurrently.
const LOCK_REUSE_BACKSTOP_MILLIS = 300_000;

/**
 * Whether v2 eviction events may be emitted into the shared admission journal.
 *
 * **Example** (Recognize the rollout-safe default)
 *
 * ```ts
 * import { AdmissionEvictionEmission } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(AdmissionEvictionEmission.is.off("off")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AdmissionEvictionEmission = LiteralKit(["off", "on"]).pipe(
  $I.annoteSchema("AdmissionEvictionEmission", {
    description: "Whether current scheduler writers may emit v2 admission eviction events.",
  })
);

/**
 * Whether current scheduler writers may emit v2 admission eviction events.
 *
 * @category models
 * @since 0.0.0
 */
export type AdmissionEvictionEmission = typeof AdmissionEvictionEmission.Type;

/**
 * Versioned mixed-checkout protocol marker stored in the admission root.
 *
 * **Example** (Construct the disabled protocol)
 *
 * ```ts
 * import { AdmissionProtocol } from "@beep/repo-cli/test/RepoRun"
 *
 * const protocol = AdmissionProtocol.make({
 *   schemaVersion: "yeet-admission-protocol/v1",
 *   eviction: "off",
 * })
 * console.log(protocol.eviction) // "off"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AdmissionProtocol extends S.Class<AdmissionProtocol>($I`AdmissionProtocol`)(
  {
    schemaVersion: S.Literal("yeet-admission-protocol/v1"),
    eviction: AdmissionEvictionEmission,
  },
  $I.annote("AdmissionProtocol", {
    description: "Versioned rollout marker controlling admission-journal eviction event emission.",
  })
) {}

const disabledAdmissionProtocol = AdmissionProtocol.make({
  schemaVersion: "yeet-admission-protocol/v1",
  eviction: AdmissionEvictionEmission.Enum.off,
});
const decodeAdmissionProtocol = S.decodeUnknownOption(S.fromJsonString(AdmissionProtocol));
const encodeAdmissionProtocol = S.encodeUnknownEffect(S.fromJsonString(AdmissionProtocol));

/**
 * One ownership generation published in a serialized journal lock.
 *
 * The process start identity fences the lock against PID reuse while
 * `ownerToken` preserves the caller-owned generation used for safe release.
 *
 * **Example** (Construct a lock generation)
 *
 * ```ts
 * import { AdmissionJournalLockGeneration } from "@beep/repo-cli/test/RepoRun"
 *
 * const generation = AdmissionJournalLockGeneration.make({
 *   schemaVersion: "yeet-admission-journal-lock/v1",
 *   pid: 1234,
 *   procStart: "proc:8241991",
 *   ownerToken: "1234:5a47b2ac"
 * })
 * console.log(generation.pid) // 1234
 * ```
 *
 * @category coordination
 * @since 0.0.0
 */
export class AdmissionJournalLockGeneration extends S.Class<AdmissionJournalLockGeneration>(
  $I`AdmissionJournalLockGeneration`
)(
  {
    schemaVersion: S.Literal("yeet-admission-journal-lock/v1"),
    pid: S.Finite,
    procStart: S.NonEmptyString,
    ownerToken: S.NonEmptyString,
  },
  $I.annote("AdmissionJournalLockGeneration", {
    description: "PID-reuse-fenced ownership generation stored in a serialized journal lock.",
  })
) {}

const encodeLockGeneration = S.encodeUnknownEffect(S.fromJsonString(AdmissionJournalLockGeneration));
const decodeLockGeneration = S.decodeUnknownEffect(S.fromJsonString(AdmissionJournalLockGeneration));
const decodeReapAdopterPathParts = S.decodeUnknownEffect(
  S.Tuple([S.FiniteFromString, S.StringFromBase64Url, S.StringFromBase64Url, S.FiniteFromString])
);
const decodeLegacyReapAdopterPathParts = S.decodeUnknownEffect(
  S.Tuple([S.FiniteFromString, S.StringFromBase64Url, S.StringFromBase64Url])
);

class AdmissionJournalLockReapAdopter extends S.Class<AdmissionJournalLockReapAdopter>(
  $I`AdmissionJournalLockReapAdopter`
)(
  {
    schemaVersion: S.Literal("yeet-admission-journal-lock-reap-adopter/v1"),
    generation: AdmissionJournalLockGeneration,
    claimedAtMillis: S.Finite,
  },
  $I.annote("AdmissionJournalLockReapAdopter", {
    description: "Process-fenced ownership record for one journal-lock reap adoption.",
  })
) {}

/**
 * Durable transition recorded when a queued ticket becomes an active lease.
 *
 * **Example** (Reference an admitted transition)
 *
 * ```ts
 * import { AdmissionJournalAdmitted } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof AdmissionJournalAdmitted) // "function"
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class AdmissionJournalAdmitted extends S.Class<AdmissionJournalAdmitted>($I`AdmissionJournalAdmitted`)(
  {
    schemaVersion: S.Literal("yeet-admission-journal/v1"),
    _tag: S.Literal("admission-admitted"),
    nonce: S.String,
    pid: S.Finite,
    procStart: S.String,
    kind: AdmissionWorkKind,
    weightTokens: S.Finite,
    priority: AdmissionPriority,
    originKey: S.String,
    enqueuedAtMillis: S.Finite,
    admittedAtMillis: S.Finite,
    attemptId: UUID.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("AdmissionJournalAdmitted", {
    description: "Durable transition recorded when a queued ticket becomes an active admission lease.",
  })
) {}

/**
 * Durable transition recorded when an active admission lease is released.
 *
 * **Example** (Reference a released transition)
 *
 * ```ts
 * import { AdmissionJournalReleased } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof AdmissionJournalReleased) // "function"
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class AdmissionJournalReleased extends S.Class<AdmissionJournalReleased>($I`AdmissionJournalReleased`)(
  {
    schemaVersion: S.Literal("yeet-admission-journal/v1"),
    _tag: S.Literal("admission-released"),
    nonce: S.String,
    pid: S.Finite,
    releasedAtMillis: S.Finite,
    memoryPeakBytes: S.optionalKey(S.Finite),
    attemptId: UUID.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("AdmissionJournalReleased", {
    description: "Durable transition recorded when an active admission lease is released.",
  })
) {}

/**
 * Why a dead scheduler lease was evicted from capacity accounting.
 *
 * **Example** (Recognize an owner death)
 *
 * ```ts
 * import { AdmissionLeaseEvictionReason } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(AdmissionLeaseEvictionReason.is["owner-dead-or-reused"]("owner-dead-or-reused")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AdmissionLeaseEvictionReason = LiteralKit(["owner-dead-or-reused"]).pipe(
  $I.annoteSchema("AdmissionLeaseEvictionReason", {
    description: "Reason a dead admission lease was evicted from scheduler capacity accounting.",
  })
);

/**
 * Reason a dead admission lease was evicted from scheduler capacity accounting.
 *
 * **Example** (Name an eviction reason)
 *
 * ```ts
 * import type { AdmissionLeaseEvictionReason } from "@beep/repo-cli/test/RepoRun"
 *
 * const reason: AdmissionLeaseEvictionReason = "owner-dead-or-reused"
 * console.log(reason) // "owner-dead-or-reused"
 * ```
 *
 * @see {@link AdmissionLeaseEvictionReason} for the runtime schema and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type AdmissionLeaseEvictionReason = typeof AdmissionLeaseEvictionReason.Type;

/**
 * Durable transition recorded after the scheduler reaps a verified dead lease.
 *
 * **Example** (Reference an eviction transition)
 *
 * ```ts
 * import { AdmissionJournalLeaseEvicted } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof AdmissionJournalLeaseEvicted) // "function"
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class AdmissionJournalLeaseEvicted extends S.Class<AdmissionJournalLeaseEvicted>(
  $I`AdmissionJournalLeaseEvicted`
)(
  {
    schemaVersion: S.Literal("yeet-admission-journal/v2"),
    _tag: S.Literal("admission-lease-evicted"),
    nonce: S.String,
    pid: S.Finite,
    attemptId: UUID.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    evictedAtMillis: S.Finite,
    reason: AdmissionLeaseEvictionReason,
  },
  $I.annote("AdmissionJournalLeaseEvicted", {
    description: "Durable transition recorded after the scheduler reaps a verified dead admission lease.",
  })
) {}

/**
 * Why a dead scheduler ticket was evicted from the admission queue.
 *
 * **Example** (Recognize a queued submitter death)
 *
 * ```ts
 * import { AdmissionTicketEvictionReason } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(AdmissionTicketEvictionReason.is["queued-submitter-death"]("queued-submitter-death")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AdmissionTicketEvictionReason = LiteralKit(["queued-submitter-death"]).pipe(
  $I.annoteSchema("AdmissionTicketEvictionReason", {
    description: "Reason a dead admission ticket was evicted from the scheduler queue.",
  })
);

/**
 * Reason a dead admission ticket was evicted from the scheduler queue.
 *
 * **Example** (Name a queued submitter death)
 *
 * ```ts
 * import type { AdmissionTicketEvictionReason } from "@beep/repo-cli/test/RepoRun"
 *
 * const reason: AdmissionTicketEvictionReason = "queued-submitter-death"
 * console.log(reason) // "queued-submitter-death"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AdmissionTicketEvictionReason = typeof AdmissionTicketEvictionReason.Type;

/**
 * Durable transition recorded after the scheduler claims a dead queue ticket.
 *
 * **Example** (Reference a ticket eviction transition)
 *
 * ```ts
 * import { AdmissionJournalTicketEvicted } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof AdmissionJournalTicketEvicted) // "function"
 * ```
 *
 * @category domain-events
 * @since 0.0.0
 */
export class AdmissionJournalTicketEvicted extends S.Class<AdmissionJournalTicketEvicted>(
  $I`AdmissionJournalTicketEvicted`
)(
  {
    schemaVersion: S.Literal("yeet-admission-journal/v2"),
    _tag: S.Literal("admission-ticket-evicted"),
    nonce: S.String,
    pid: S.Finite,
    attemptId: UUID.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    evictedAtMillis: S.Finite,
    reason: AdmissionTicketEvictionReason,
  },
  $I.annote("AdmissionJournalTicketEvicted", {
    description: "Durable transition recorded after the scheduler atomically claims a dead queue ticket.",
  })
) {}

/**
 * Schema-decoded transition stored in the machine-wide admission journal.
 *
 * **Example** (Reference the admission event schema)
 *
 * ```ts
 * import { AdmissionJournalEvent } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof AdmissionJournalEvent) // "object"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AdmissionJournalEvent = S.Union([
  AdmissionJournalAdmitted,
  AdmissionJournalReleased,
  AdmissionJournalLeaseEvicted,
  AdmissionJournalTicketEvicted,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("AdmissionJournalEvent", {
    description: "Schema-decoded transition stored in the machine-wide admission journal.",
  })
);

/**
 * Decoded admission-transition event retained by {@link AdmissionJournalEvent}.
 *
 * **Example** (Read an admission event tag)
 *
 * ```ts
 * import type { AdmissionJournalEvent } from "@beep/repo-cli/test/RepoRun"
 *
 * const tagOf = (event: AdmissionJournalEvent) => event._tag
 * console.log(typeof tagOf) // "function"
 * ```
 *
 * @see {@link AdmissionJournalEvent} for the runtime schema and decoding behavior.
 * @category models
 * @since 0.0.0
 */
export type AdmissionJournalEvent = typeof AdmissionJournalEvent.Type;

type AdmissionJournalV1Event = AdmissionJournalAdmitted | AdmissionJournalReleased;

const encodeEvent = S.encodeUnknownEffect(S.fromJsonString(AdmissionJournalEvent));

/**
 * Decodes one NDJSON record into an admission-transition event.
 *
 * **Example** (Reference the journal decoder)
 *
 * ```ts
 * import { decodeAdmissionJournalEvent } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof decodeAdmissionJournalEvent) // "function"
 * ```
 *
 * @param input - One raw admission-journal line.
 * @returns The decoded admission-transition event effect.
 * @category decoding
 * @since 0.0.0
 */
export const decodeAdmissionJournalEvent: {
  (options?: SchemaAST.ParseOptions): (input: unknown) => Effect.Effect<AdmissionJournalEvent, S.SchemaError>;
  (input: unknown, options?: SchemaAST.ParseOptions): Effect.Effect<AdmissionJournalEvent, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(S.fromJsonString(AdmissionJournalEvent)));

/**
 * Resolves the machine-wide admission journal path beneath a scheduler root.
 *
 * **Example** (Reference the path resolver)
 *
 * ```ts
 * import { admissionJournalPath } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof admissionJournalPath) // "function"
 * ```
 *
 * @param root - Machine-wide admission root directory.
 * @returns The admission journal path effect.
 * @category utilities
 * @since 0.0.0
 */
export const admissionJournalPath = Effect.fn("AdmissionJournal.path")(function* (
  root: string
): Effect.fn.Return<string, never, Path.Path> {
  const path = yield* Path.Path;
  return path.join(root, JOURNAL_FILE_NAME);
});

/**
 * Resolve the admission protocol marker path beneath a scheduler root.
 *
 * **Example** (Reference the protocol path resolver)
 *
 * ```ts
 * import { admissionProtocolPath } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof admissionProtocolPath) // "function"
 * ```
 *
 * @param root - Machine-wide admission root directory.
 * @returns The protocol marker path effect.
 * @category utilities
 * @since 0.0.0
 */
export const admissionProtocolPath = Effect.fn("AdmissionJournal.protocolPath")(function* (
  root: string
): Effect.fn.Return<string, never, Path.Path> {
  const path = yield* Path.Path;
  return path.join(root, PROTOCOL_FILE_NAME);
});

/**
 * Read the admission protocol, failing closed to eviction emission off.
 *
 * **Details**
 *
 * A missing, unreadable, or undecodable marker means the mixed-checkout
 * preservation rollout is not proven, so v2 eviction rows remain disabled.
 *
 * **Example** (Read a protocol marker)
 *
 * ```ts
 * import { readAdmissionProtocol } from "@beep/repo-cli/test/RepoRun"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(readAdmissionProtocol("/tmp/admission"))) // true
 * ```
 *
 * @param root - Machine-wide admission root directory.
 * @returns The decoded protocol or the disabled default.
 * @category utilities
 * @since 0.0.0
 */
export const readAdmissionProtocol = Effect.fn("AdmissionJournal.readProtocol")(function* (
  root: string
): Effect.fn.Return<AdmissionProtocol, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const protocolPath = yield* admissionProtocolPath(root);
  const text = yield* fs.readFileString(protocolPath).pipe(Effect.option);
  return pipe(
    text,
    O.flatMap(decodeAdmissionProtocol),
    O.getOrElse(() => disabledAdmissionProtocol)
  );
});

const prepareAdmissionJournalPaths = Effect.fnUntraced(function* (
  root: string
): Effect.fn.Return<
  { readonly journalPath: string; readonly lockPath: string; readonly protocolPath: string },
  QualitySchedulerError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs
    .makeDirectory(root, { recursive: true, mode: 0o700 })
    .pipe(Effect.mapError(QualitySchedulerError.new("Failed to create admission journal directory.")));
  return {
    journalPath: path.join(root, JOURNAL_FILE_NAME),
    lockPath: path.join(root, LOCK_FILE_NAME),
    protocolPath: path.join(root, PROTOCOL_FILE_NAME),
  };
});

const legacyLockOwnerPid = flow(Str.split(":"), A.head, O.flatMap(N.parse));

const lockGenerationIsDead = Effect.fnUntraced(function* (
  generation: AdmissionJournalLockGeneration
): Effect.fn.Return<boolean, never, FileSystem.FileSystem> {
  return ProcessIdentityStatus.is.dead(yield* processIdentityStatus(generation));
});

const isOwnedLockGeneration = Effect.fnUntraced(function* (
  content: string,
  ownerToken: string
): Effect.fn.Return<boolean> {
  const generation = yield* decodeLockGeneration(content).pipe(Effect.option);
  return O.exists(generation, (current) => current.ownerToken === ownerToken) || content === ownerToken;
});

const takenJournalLockIsOwned = Effect.fnUntraced(function* (
  content: O.Option<string>,
  ownerToken: string
): Effect.fn.Return<boolean> {
  return yield* O.match(content, {
    onNone: () => Effect.succeed(false),
    onSome: (current) => isOwnedLockGeneration(current, ownerToken),
  });
});

const journalLockReapClaimPath = (lockPath: string, observedToken: string): string =>
  `${lockPath}.reap-${createHash("sha256").update(observedToken).digest("hex")}`;

const journalLockReapAdopterPrefix = (claimPath: string): string => `${claimPath}.adopt-`;

const journalLockReapAdopterPath = (claimPath: string, adopter: AdmissionJournalLockReapAdopter): string =>
  `${journalLockReapAdopterPrefix(claimPath)}${adopter.generation.pid}.${Encoding.encodeBase64Url(adopter.generation.procStart)}.${Encoding.encodeBase64Url(adopter.generation.ownerToken)}.${adopter.claimedAtMillis}`;

const journalLockReapTombstonePath = (claimPath: string): string =>
  `${claimPath}.tombstone-${process.pid}-${randomUUID()}`;

interface TakenJournalLockGeneration {
  readonly content: O.Option<string>;
  readonly info: O.Option<FileSystem.File.Info>;
}

const decodeReapAdopter = Effect.fnUntraced(function* (
  adopterPath: string,
  claimPath: string
): Effect.fn.Return<O.Option<AdmissionJournalLockReapAdopter>> {
  const prefix = journalLockReapAdopterPrefix(claimPath);
  const parts = yield* decodeReapAdopterPathParts(Str.split(".")(Str.slice(prefix.length)(adopterPath))).pipe(
    Effect.option
  );
  return O.map(parts, ([pid, procStart, ownerToken, claimedAtMillis]) =>
    AdmissionJournalLockReapAdopter.make({
      schemaVersion: "yeet-admission-journal-lock-reap-adopter/v1",
      generation: AdmissionJournalLockGeneration.make({
        schemaVersion: "yeet-admission-journal-lock/v1",
        pid,
        procStart,
        ownerToken,
      }),
      claimedAtMillis,
    })
  );
});

const decodeLegacyReapAdopterGeneration = Effect.fnUntraced(function* (
  adopterPath: string,
  claimPath: string
): Effect.fn.Return<O.Option<AdmissionJournalLockGeneration>> {
  const prefix = journalLockReapAdopterPrefix(claimPath);
  const parts = yield* decodeLegacyReapAdopterPathParts(Str.split(".")(Str.slice(prefix.length)(adopterPath))).pipe(
    Effect.option
  );
  return O.map(parts, ([pid, procStart, ownerToken]) =>
    AdmissionJournalLockGeneration.make({
      schemaVersion: "yeet-admission-journal-lock/v1",
      pid,
      procStart,
      ownerToken,
    })
  );
});

const pathsWithPrefix = Effect.fnUntraced(function* (
  prefixPath: string
): Effect.fn.Return<O.Option<ReadonlyArray<string>>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = path.dirname(prefixPath);
  const prefix = path.basename(prefixPath);
  const entries = yield* fs.readDirectory(directory).pipe(Effect.option);
  return O.map(
    entries,
    flow(
      A.filter(Str.startsWith(prefix)),
      A.map((entry) => path.join(directory, entry))
    )
  );
});

const journalLockReapSidecars = (
  lockPath: string
): Effect.Effect<ReadonlyArray<string>, never, FileSystem.FileSystem | Path.Path> =>
  pathsWithPrefix(`${lockPath}.reap-`).pipe(Effect.map(O.getOrElse(A.empty<string>)));

const isJournalLockReapTombstone = Str.includes(".tombstone-");

const takeJournalLockGeneration = Effect.fnUntraced(function* (
  lockPath: string,
  tombstonePath: string
): Effect.fn.Return<O.Option<TakenJournalLockGeneration>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const moved = yield* fs.rename(lockPath, tombstonePath).pipe(Effect.as(true), Effect.orElseSucceed(constant(false)));
  if (!moved) {
    return O.none();
  }
  return O.some({
    content: yield* fs.readFileString(tombstonePath).pipe(Effect.option),
    info: yield* fs.stat(tombstonePath).pipe(Effect.option),
  });
});

const restoreJournalLockReapTombstone = Effect.fnUntraced(function* (
  lockPath: string,
  tombstonePath: string
): Effect.fn.Return<boolean, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.link(tombstonePath, lockPath).pipe(Effect.as(true), Effect.orElseSucceed(constant(false)));
});

const discardTakenJournalLock = Effect.fnUntraced(function* (
  tombstonePath: string
): Effect.fn.Return<void, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.remove(tombstonePath, { force: true }).pipe(Effect.ignore);
});

const discardOrphanJournalLockReapTombstone = Effect.fnUntraced(function* (
  tombstonePath: string
): Effect.fn.Return<void, never, FileSystem.FileSystem> {
  yield* discardTakenJournalLock(tombstonePath);
  yield* Console.error(
    `[yeet] swept orphaned journal lock tombstone ${tombstonePath}; its displaced writer must reacquire.`
  );
});

const sweepOrphanJournalLockClaims = Effect.fnUntraced(function* (
  lockPath: string
): Effect.fn.Return<void, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const sidecars = yield* journalLockReapSidecars(lockPath);
  const tombstones = A.filter(sidecars, isJournalLockReapTombstone);
  yield* Effect.forEach(tombstones, discardOrphanJournalLockReapTombstone, {
    discard: true,
  });
  if (yield* fs.exists(lockPath).pipe(Effect.orElseSucceed(constant(true)))) {
    return;
  }
  yield* Effect.forEach(
    A.filter(sidecars, (sidecar) => !isJournalLockReapTombstone(sidecar)),
    (sidecar) => fs.remove(sidecar, { force: true, recursive: true }).pipe(Effect.ignore),
    {
      discard: true,
    }
  );
});

const reapAdopterMayStillAct = Effect.fnUntraced(function* (
  adopterPath: string,
  claimPath: string,
  nowMillis: number
): Effect.fn.Return<boolean, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const adopter = yield* decodeReapAdopter(adopterPath, claimPath);
  const info = yield* fs.stat(adopterPath).pipe(Effect.option);
  const claimedAtMillis = O.match(adopter, {
    onNone: () =>
      pipe(
        info,
        O.flatMap((fileInfo) => fileInfo.mtime),
        O.map((mtime) => mtime.getTime())
      ),
    onSome: (claim) => O.some(claim.claimedAtMillis),
  });
  if (O.exists(claimedAtMillis, (claimedAt) => nowMillis - claimedAt > LOCK_REAP_ADOPTION_BOUND_MILLIS)) {
    return false;
  }
  const generation = yield* O.match(adopter, {
    onNone: () => decodeLegacyReapAdopterGeneration(adopterPath, claimPath),
    onSome: (claim) => Effect.succeedSome(claim.generation),
  });
  return !O.exists(
    yield* O.match(generation, {
      onNone: () => Effect.succeed(O.none<boolean>()),
      onSome: (current) => lockGenerationIsDead(current).pipe(Effect.asSome),
    }),
    (dead) => dead
  );
});

type ReapAdopterElection =
  | { readonly _tag: "blocked" }
  | { readonly _tag: "unclaimed" }
  | { readonly _tag: "takeover"; readonly adopterPath: string };

const electReapAdopter = Effect.fnUntraced(function* (
  claimPath: string,
  nowMillis: number
): Effect.fn.Return<ReapAdopterElection, never, FileSystem.FileSystem | Path.Path> {
  const adopterPrefix = journalLockReapAdopterPrefix(claimPath);
  const adopters = yield* pathsWithPrefix(adopterPrefix);
  if (O.isNone(adopters)) {
    return { _tag: "blocked" };
  }
  const ordered = A.sort(adopters.value, Order.String);
  for (const adopterPath of ordered) {
    if (yield* reapAdopterMayStillAct(adopterPath, claimPath, nowMillis)) {
      return { _tag: "blocked" };
    }
  }
  return O.match(A.head(ordered), {
    onNone: () => ({ _tag: "unclaimed" as const }),
    onSome: (adopterPath) => ({ _tag: "takeover" as const, adopterPath }),
  });
});

const makeLockGeneration = Effect.fnUntraced(function* (
  token: string
): Effect.fn.Return<O.Option<AdmissionJournalLockGeneration>, never, FileSystem.FileSystem> {
  const procStart = yield* processStartIdentityForPid(process.pid);
  return O.map(procStart, (identity) =>
    AdmissionJournalLockGeneration.make({
      schemaVersion: "yeet-admission-journal-lock/v1",
      pid: process.pid,
      procStart: identity,
      ownerToken: token,
    })
  );
});

const sameFileIdentity = (left: FileSystem.File.Info, right: FileSystem.File.Info): boolean =>
  left.dev === right.dev && O.exists(left.ino, (leftIno) => O.exists(right.ino, (rightIno) => leftIno === rightIno));

const adoptJournalLockReapClaim = Effect.fnUntraced(function* (
  lockPath: string,
  claimPath: string,
  observedToken: string,
  nowMillis: number
): Effect.fn.Return<O.Option<string>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const election = yield* electReapAdopter(claimPath, nowMillis);
  if (election._tag === "blocked") {
    return O.none();
  }
  const sourcePath =
    election._tag === "takeover"
      ? election.adopterPath
      : yield* fs.link(lockPath, claimPath).pipe(Effect.as(claimPath), Effect.orElseSucceed(constant(claimPath)));
  const claimedToken = yield* fs.readFileString(sourcePath).pipe(Effect.option);
  if (!O.exists(claimedToken, (token) => token === observedToken)) {
    return O.none();
  }
  const adopterGeneration = yield* makeLockGeneration(`${process.pid}:${randomUUID()}`);
  if (O.isNone(adopterGeneration)) {
    return O.none();
  }
  const adopterPath = journalLockReapAdopterPath(
    claimPath,
    AdmissionJournalLockReapAdopter.make({
      schemaVersion: "yeet-admission-journal-lock-reap-adopter/v1",
      generation: adopterGeneration.value,
      claimedAtMillis: nowMillis,
    })
  );
  return yield* fs
    .rename(sourcePath, adopterPath)
    .pipe(Effect.as(O.some(adopterPath)), Effect.orElseSucceed(O.none<string>));
});

const journalLockReapClaimIsOwned = Effect.fnUntraced(function* (
  adopterPath: string,
  observedToken: string
): Effect.fn.Return<boolean, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return O.contains(yield* fs.readFileString(adopterPath).pipe(Effect.option), observedToken);
});

const reportLostJournalLockReapClaim = (adopterPath: string): Effect.Effect<void, never> =>
  Console.error(`[yeet] journal lock reap claim lost before a fenced step: ${adopterPath}`);

const releaseJournalLockReapClaim = Effect.fnUntraced(function* (
  adopterPath: string,
  observedToken: string
): Effect.fn.Return<void, never, FileSystem.FileSystem> {
  if (!(yield* journalLockReapClaimIsOwned(adopterPath, observedToken))) {
    yield* reportLostJournalLockReapClaim(adopterPath);
    return;
  }
  const fs = yield* FileSystem.FileSystem;
  yield* fs.remove(adopterPath, { force: true }).pipe(Effect.ignore);
});

const discardReclaimedJournalLock = Effect.fnUntraced(function* (
  tombstonePath: string,
  adopterPath: string,
  observedToken: string
): Effect.fn.Return<boolean, never, FileSystem.FileSystem> {
  if (!(yield* journalLockReapClaimIsOwned(adopterPath, observedToken))) {
    yield* reportLostJournalLockReapClaim(adopterPath);
    return false;
  }
  yield* discardTakenJournalLock(tombstonePath);
  return true;
});

const restoreDisplacedJournalLock = Effect.fnUntraced(function* (
  lockPath: string,
  tombstonePath: string,
  adopterPath: string,
  observedToken: string
): Effect.fn.Return<boolean, never, FileSystem.FileSystem> {
  if (!(yield* journalLockReapClaimIsOwned(adopterPath, observedToken))) {
    yield* reportLostJournalLockReapClaim(adopterPath);
    return false;
  }
  if (!(yield* restoreJournalLockReapTombstone(lockPath, tombstonePath))) {
    yield* Console.error(`[yeet] journal lock generation displaced during reclaim; recovery retained ${tombstonePath}`);
    return true;
  }
  return yield* discardReclaimedJournalLock(tombstonePath, adopterPath, observedToken);
});

const finishJournalLockReap = Effect.fnUntraced(function* (
  lockPath: string,
  claimPath: string,
  adopterPath: string,
  observedToken: string
): Effect.fn.Return<void, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  if (!(yield* journalLockReapClaimIsOwned(adopterPath, observedToken))) {
    yield* reportLostJournalLockReapClaim(adopterPath);
    return;
  }
  const tombstonePath = journalLockReapTombstonePath(claimPath);
  const taken = yield* takeJournalLockGeneration(lockPath, tombstonePath);
  if (O.isNone(taken)) {
    yield* releaseJournalLockReapClaim(adopterPath, observedToken);
    return;
  }
  if (!(yield* journalLockReapClaimIsOwned(adopterPath, observedToken))) {
    yield* reportLostJournalLockReapClaim(adopterPath);
    return;
  }
  const adopterInfo = yield* fs.stat(adopterPath).pipe(Effect.option);
  const reclaimedObservedGeneration =
    O.exists(taken.value.content, (token) => token === observedToken) &&
    O.exists(adopterInfo, (claim) => O.exists(taken.value.info, (tombstone) => sameFileIdentity(claim, tombstone)));
  const completed = reclaimedObservedGeneration
    ? yield* discardReclaimedJournalLock(tombstonePath, adopterPath, observedToken)
    : yield* restoreDisplacedJournalLock(lockPath, tombstonePath, adopterPath, observedToken);
  // Both arms stay explicit: V8 credited the trailing implicit guard of this
  // generator unreliably across suite orders, which read as a coverage drop.
  if (completed) {
    yield* releaseJournalLockReapClaim(adopterPath, observedToken);
  } else {
    return;
  }
});

const claimAndFinishJournalLockReap = Effect.fnUntraced(function* (
  lockPath: string,
  claimPath: string,
  observedToken: string,
  nowMillis: number
): Effect.fn.Return<void, never, FileSystem.FileSystem | Path.Path> {
  const adopterPath = yield* adoptJournalLockReapClaim(lockPath, claimPath, observedToken, nowMillis);
  if (O.isSome(adopterPath)) {
    yield* finishJournalLockReap(lockPath, claimPath, adopterPath.value, observedToken);
  }
});

// A generation-specific hard link is the immutable claim snapshot. Renaming
// that deterministic name elects exactly one source-fenced adopter. A timed-out
// adoption transfers ownership by renaming its old adopter path, invalidating
// the suspended owner before the winner touches the published lock generation.
const reapAbandonedJournalLock = Effect.fnUntraced(function* (
  lockPath: string
): Effect.fn.Return<void, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs.readFileString(lockPath).pipe(Effect.option);
  if (O.isNone(content)) {
    yield* sweepOrphanJournalLockClaims(lockPath);
    return;
  }
  const info = yield* fs.stat(lockPath).pipe(Effect.option);
  const nowMillis = yield* Clock.currentTimeMillis;
  // A decoded owner that died or no longer matches its recorded process start
  // identity abandons the lock immediately. Legacy pid-only tokens remain
  // readable during rollout but cannot prove PID reuse.
  const generation = yield* decodeLockGeneration(content.value).pipe(Effect.option);
  const ownerDead = yield* O.match(generation, {
    onNone: () =>
      O.match(O.flatMap(content, legacyLockOwnerPid), {
        onNone: () => Effect.succeed(false),
        onSome: (pid) => isProcessPidAlive(pid).pipe(Effect.map((alive) => !alive)),
      }),
    onSome: lockGenerationIsDead,
  });
  const outlivedBackstop = pipe(
    info,
    O.flatMap((fileInfo) => fileInfo.mtime),
    O.exists((mtime) => nowMillis - mtime.getTime() > LOCK_REUSE_BACKSTOP_MILLIS)
  );
  const legacyOwner = O.flatMap(content, legacyLockOwnerPid);
  const observedToken = O.filter(
    content,
    () => ownerDead || (O.isNone(generation) && O.isNone(legacyOwner) && outlivedBackstop)
  );
  if (O.isNone(observedToken)) {
    return;
  }
  const claimPath = journalLockReapClaimPath(lockPath, observedToken.value);
  yield* Effect.uninterruptible(claimAndFinishJournalLockReap(lockPath, claimPath, observedToken.value, nowMillis));
});

const tryAcquireJournalLock = Effect.fnUntraced(function* (
  lockPath: string,
  token: string
): Effect.fn.Return<boolean, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  yield* sweepOrphanJournalLockClaims(lockPath);
  const generation = yield* makeLockGeneration(token);
  if (O.isNone(generation)) {
    return false;
  }
  const generationText = yield* encodeLockGeneration(generation.value).pipe(Effect.orDie);
  // Publish the lock via hard link so it never exists without its token: a
  // contender reading a just-created lock always sees a full generation.
  const stagingPath = `${lockPath}.stage-${process.pid}-${randomUUID()}`;
  const acquired = yield* fs
    .writeFileString(stagingPath, generationText)
    .pipe(Effect.andThen(fs.link(stagingPath, lockPath)), Effect.as(true), Effect.orElseSucceed(constant(false)));
  yield* fs.remove(stagingPath, { force: true }).pipe(Effect.ignore);
  // Contention fails this attempt; reaping an abandoned lock lets a later
  // attempt acquire it.
  if (!acquired) {
    yield* reapAbandonedJournalLock(lockPath);
  }
  return acquired;
});

/**
 * Acquire an owned-generation lock for a serialized journal rewrite.
 *
 * **Details**
 *
 * A hard link publishes the complete PID/start-time generation atomically.
 * Contenders retry briefly and reclaim a dead or PID-reused owner's exact
 * observed generation. An unparseable generation can age through the
 * corruption backstop, while a decoded live owner is never reaped by age.
 *
 * **Example** (Acquire a journal lock)
 *
 * ```ts
 * import { acquireJournalFileLock } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof acquireJournalFileLock) // "function"
 * ```
 *
 * @param lockPath - Exclusive lock path adjacent to the serialized journal.
 * @param token - Unique caller token wrapped by the persisted PID/start-time generation.
 * @param retryAttempts - Maximum atomic-acquisition attempts before returning false.
 * @returns Whether the caller acquired the lock within the retry window.
 * @category utilities
 * @since 0.0.0
 */
export const acquireJournalFileLock = Effect.fnUntraced(function* (
  lockPath: string,
  token: string,
  retryAttempts = LOCK_RETRY_ATTEMPTS
): Effect.fn.Return<boolean, never, FileSystem.FileSystem | Path.Path> {
  for (let attempt = 0; attempt < retryAttempts; attempt++) {
    if (yield* tryAcquireJournalLock(lockPath, token)) {
      return true;
    }
    yield* Effect.sleep(Duration.millis(LOCK_RETRY_DELAY_MILLIS));
  }
  return false;
});

/**
 * Release a serialized journal lock only while its generation is still owned.
 *
 * **Example** (Release a journal lock)
 *
 * ```ts
 * import { releaseJournalFileLock } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof releaseJournalFileLock) // "function"
 * ```
 *
 * @param lockPath - Exclusive lock path adjacent to the serialized journal.
 * @param token - Unique caller token previously wrapped by the acquired generation.
 * @returns An effect that removes only the caller's lock generation.
 * @category utilities
 * @since 0.0.0
 */
export const releaseJournalFileLock = Effect.fnUntraced(function* (
  lockPath: string,
  token: string
): Effect.fn.Return<void, never, FileSystem.FileSystem> {
  const tombstonePath = journalLockReapTombstonePath(journalLockReapClaimPath(lockPath, token));
  const taken = yield* takeJournalLockGeneration(lockPath, tombstonePath);
  if (O.isNone(taken)) {
    return;
  }
  const owned = yield* takenJournalLockIsOwned(taken.value.content, token);
  if (owned) {
    yield* discardTakenJournalLock(tombstonePath);
    return;
  }
  if (!(yield* restoreJournalLockReapTombstone(lockPath, tombstonePath))) {
    yield* Console.error(`[yeet] journal lock generation displaced during release; recovery retained ${tombstonePath}`);
    return;
  }
  yield* discardTakenJournalLock(tombstonePath);
});

/**
 * Test-only handle for the owned-generation journal lock release.
 *
 * **Example** (Reference the test-only release)
 *
 * ```ts
 * import { releaseAdmissionJournalLockForTesting } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof releaseAdmissionJournalLockForTesting) // "function"
 * ```
 *
 * @param lockPath - Journal lock path.
 * @param token - The owning writer's caller token.
 * @returns An effect that removes the lock only while the token still owns it.
 * @category utilities
 * @since 0.0.0
 */
export const releaseAdmissionJournalLockForTesting = releaseJournalFileLock;

/**
 * Test-only handle for completing an already-adopted journal-lock reap.
 *
 * **Example** (Reference the test-only finisher)
 *
 * ```ts
 * import { finishAdmissionJournalLockReapForTesting } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof finishAdmissionJournalLockReapForTesting) // "function"
 * ```
 *
 * @param lockPath - Published journal lock path.
 * @param claimPath - Generation-specific reap claim path.
 * @param adopterPath - Elected adopter path for the claim.
 * @param observedToken - Exact lock generation observed by the reaper.
 * @returns An effect that completes the fenced reap and releases its adopter claim.
 * @category utilities
 * @since 0.0.0
 */
export const finishAdmissionJournalLockReapForTesting = finishJournalLockReap;

const journalLockIsOwned = Effect.fnUntraced(function* (
  lockPath: string,
  token: string
): Effect.fn.Return<boolean, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs.readFileString(lockPath).pipe(Effect.option);
  return yield* takenJournalLockIsOwned(content, token);
});

/**
 * Require that a caller still owns the published journal-lock generation.
 *
 * **Example** (Fence a locked journal rewrite)
 *
 * ```ts
 * import { assertJournalFileLockOwned } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof assertJournalFileLockOwned) // "function"
 * ```
 *
 * @param lockPath - Published journal-lock path.
 * @param token - Unique token used to acquire the expected generation.
 * @returns An effect that fails with a typed scheduler error when ownership was lost.
 * @category utilities
 * @since 0.0.0
 */
export const assertJournalFileLockOwned = Effect.fnUntraced(function* (
  lockPath: string,
  token: string
): Effect.fn.Return<void, QualitySchedulerError, FileSystem.FileSystem> {
  if (!(yield* journalLockIsOwned(lockPath, token))) {
    return yield* QualitySchedulerError.make({
      message: `Admission journal lock "${lockPath}" was lost before publication; retry the locked operation.`,
      reason: "journal-lock-lost",
    });
  }
});

const acquireFencedGeneration = Effect.fnUntraced(function* (
  lockPath: string,
  busyMessage: string
): Effect.fn.Return<string, QualitySchedulerError, FileSystem.FileSystem | Path.Path> {
  const lockToken = `${process.pid}:${randomUUID()}`;
  if (yield* acquireJournalFileLock(lockPath, lockToken)) {
    return lockToken;
  }
  return yield* QualitySchedulerError.make({
    message: busyMessage,
  });
});

const runFencedOperation = Effect.fnUntraced(function* <Success, Requirements>(
  lockPath: string,
  operation: (lockToken: string) => Effect.Effect<Success, QualitySchedulerError, Requirements>,
  busyMessage: string
): Effect.fn.Return<
  Result.Result<Success, QualitySchedulerError>,
  QualitySchedulerError,
  FileSystem.FileSystem | Path.Path | Requirements
> {
  const lockToken = yield* acquireFencedGeneration(lockPath, busyMessage);
  return yield* Effect.ensuring(operation(lockToken), releaseJournalFileLock(lockPath, lockToken)).pipe(Effect.result);
});

const pauseBeforeLockRetry = (attempt: number, retryAttempts: number): Effect.Effect<void, never, never> =>
  attempt + 1 < retryAttempts ? Effect.sleep(Duration.millis(LOCK_RETRY_DELAY_MILLIS)) : Effect.void;

/**
 * Run one journal operation under a fenced lock generation with bounded replay.
 *
 * **Details**
 *
 * A lost generation never acknowledges the operation. The boundary releases
 * any surviving generation, reacquires with a fresh token, and reruns the
 * operation from its durable read state. Only lock-loss failures retry; an I/O
 * failure is surfaced unchanged.
 *
 * **Example** (Reference the locked journal boundary)
 *
 * ```ts
 * import { withJournalFileLock } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof withJournalFileLock) // "function"
 * ```
 *
 * @param lockPath - Exclusive lock path adjacent to the journal.
 * @param operation - Complete read-and-publish operation fenced by the supplied token.
 * @param retryAttempts - Maximum fresh generations after repeated ownership loss.
 * @param busyMessage - Typed error message when the initial generation cannot be acquired.
 * @returns The operation result after one successful fenced publication.
 * @category utilities
 * @since 0.0.0
 */
export const withJournalFileLock = Effect.fnUntraced(function* <Success, Requirements>(
  lockPath: string,
  operation: (lockToken: string) => Effect.Effect<Success, QualitySchedulerError, Requirements>,
  retryAttempts = LOCKED_OPERATION_RETRY_ATTEMPTS,
  busyMessage = `Journal lock "${lockPath}" stayed busy; could not start the locked operation.`
): Effect.fn.Return<Success, QualitySchedulerError, FileSystem.FileSystem | Path.Path | Requirements> {
  for (let attempt = 0; attempt < retryAttempts; attempt++) {
    const outcome = yield* runFencedOperation(lockPath, operation, busyMessage);
    if (Result.isSuccess(outcome)) {
      return outcome.success;
    }
    if (outcome.failure.reason !== "journal-lock-lost") {
      return yield* outcome.failure;
    }
    yield* pauseBeforeLockRetry(attempt, retryAttempts);
  }
  return yield* QualitySchedulerError.make({
    message: `Journal lock "${lockPath}" was lost ${retryAttempts} times; retry bound exhausted.`,
    reason: "journal-lock-retry-exhausted",
  });
});

/**
 * Atomically write the admission protocol marker under the fenced journal lock.
 *
 * **Example** (Enable eviction emission)
 *
 * ```ts
 * import { writeAdmissionProtocol } from "@beep/repo-cli/test/RepoRun"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(writeAdmissionProtocol("/tmp/admission", "on"))) // true
 * ```
 *
 * @param root - Machine-wide admission root directory.
 * @param eviction - Desired v2 eviction-event emission state.
 * @returns The protocol that was durably published.
 * @category utilities
 * @since 0.0.0
 */
export const writeAdmissionProtocol = Effect.fn("AdmissionJournal.writeProtocol")(function* (
  root: string,
  eviction: AdmissionEvictionEmission
): Effect.fn.Return<AdmissionProtocol, QualitySchedulerError, FileSystem.FileSystem | Path.Path> {
  const { lockPath, protocolPath } = yield* prepareAdmissionJournalPaths(root);
  const protocol = AdmissionProtocol.make({ schemaVersion: "yeet-admission-protocol/v1", eviction });
  const content = yield* encodeAdmissionProtocol(protocol).pipe(
    Effect.mapError(QualitySchedulerError.new("Failed to encode the admission protocol marker."))
  );
  yield* withJournalFileLock(
    lockPath,
    (lockToken) =>
      publishJournalTextAtomically(
        protocolPath,
        `${content}\n`,
        "admission protocol marker",
        assertJournalFileLockOwned(lockPath, lockToken)
      ),
    LOCKED_OPERATION_RETRY_ATTEMPTS,
    `Admission journal lock "${lockPath}" stayed busy; could not change the protocol marker.`
  );
  return protocol;
});

const publishJournalAtomic = Effect.fnUntraced(function* (
  journalPath: string,
  lockPath: string,
  lockToken: string,
  content: string
): Effect.fn.Return<void, QualitySchedulerError, FileSystem.FileSystem | Path.Path> {
  yield* publishJournalTextAtomically(
    journalPath,
    content,
    "admission journal",
    assertJournalFileLockOwned(lockPath, lockToken)
  );
});

/**
 * Test-only handle for the fenced admission-journal publication boundary.
 *
 * **Example** (Reference the test-only publisher)
 *
 * ```ts
 * import { publishAdmissionJournalForTesting } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof publishAdmissionJournalForTesting) // "function"
 * ```
 *
 * @param journalPath - Admission journal path to replace atomically.
 * @param lockPath - Adjacent lock path whose generation fences the publish.
 * @param lockToken - Writer token that must still own the published lock generation.
 * @param content - Complete journal content to publish.
 * @returns An effect that fails when the writer lost its lock generation.
 * @category testing
 * @since 0.0.0
 */
export const publishAdmissionJournalForTesting = publishJournalAtomic;

const rewriteJournalLocked = Effect.fnUntraced(function* (
  journalPath: string,
  lockPath: string,
  lockToken: string,
  event: AdmissionJournalEvent,
  line: string,
  idempotent: boolean
): Effect.fn.Return<void, QualitySchedulerError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  yield* assertJournalFileLockOwned(lockPath, lockToken);
  const text = yield* fs
    .readFileString(journalPath)
    .pipe(
      Effect.catchTag("PlatformError", (error) =>
        error.reason._tag === "NotFound"
          ? Effect.succeed(Str.empty)
          : Effect.fail(QualitySchedulerError.new(`Failed to read admission journal "${journalPath}".`)(error))
      )
    );
  const rawLines = pipe(Str.split("\n")(text), A.filter(Str.isNonEmpty));
  // Mixed fleet revisions share this journal. Preserve rows this revision does
  // not understand byte-for-byte so an older locked rewrite cannot erase a
  // newer protocol event before all checkouts have rolled forward.
  const retained = yield* Effect.forEach(rawLines, (raw) =>
    decodeAdmissionJournalEvent(raw).pipe(
      Effect.option,
      Effect.map((decoded) => ({ event: decoded, line: raw }))
    )
  );
  const alreadyRecorded = A.some(retained, ({ event: recorded }) =>
    O.exists(
      recorded,
      (candidate) =>
        candidate._tag === event._tag &&
        candidate.nonce === event.nonce &&
        candidate.pid === event.pid &&
        Eq.equals(candidate.attemptId, event.attemptId)
    )
  );
  if (idempotent && alreadyRecorded) {
    return;
  }
  const records = A.append(retained, { event: O.some(event), line });
  const admittedIndexes = pipe(
    A.zip(
      A.map(records, (record) => record.event),
      A.range(0, A.length(records) - 1)
    ),
    A.map(([recorded, index]) =>
      O.exists(recorded, AdmissionJournalEvent.guards["admission-admitted"]) ? O.some(index) : O.none()
    ),
    A.getSomes
  );
  const firstRetainedIndex =
    A.length(admittedIndexes) <= RETAINED_ADMISSIONS
      ? 0
      : pipe(admittedIndexes, A.takeRight(RETAINED_ADMISSIONS), A.head, O.getOrElse(constant(0)));
  const retainedRecords = A.filter(records, (record, index) => index >= firstRetainedIndex || O.isNone(record.event));
  yield* publishJournalAtomic(
    journalPath,
    lockPath,
    lockToken,
    pipe(
      retainedRecords,
      A.map((record) => `${record.line}\n`),
      A.join(Str.empty)
    )
  );
});

/**
 * Appends one admission transition through a serialized journal rewrite.
 *
 * The writer takes `journal.lock` with a bounded wait, publishing its
 * PID/start-time-fenced generation by hard link so the lock never exists
 * without an owner. A lock whose owner process is dead or PID-reused is
 * reaped, and release removes only the generation this writer stamped. The
 * A writer displaced during publication reacquires a fresh generation and
 * reruns the whole read-and-publish operation through a bounded retry. The
 * rewrite drops undecodable records, ring-trims to the
 * newest admitted transitions, and publishes atomically via temp-file
 * rename. A lock that stays busy fails the append with a typed error;
 * scheduler correctness never depends on this operation, so callers treat
 * that failure as a best-effort diagnostic write. Unknown journal rows remain
 * byte-identical across rewrites so older fleet writers cannot erase newer
 * protocol variants during a rolling upgrade.
 *
 * **Example** (Reference the journal append entry point)
 *
 * ```ts
 * import { appendAdmissionJournalEvent } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof appendAdmissionJournalEvent) // "function"
 * ```
 *
 * @param root - Machine-wide admission root directory.
 * @param event - Admission transition to append.
 * @returns An effect that appends to the serialized admission journal.
 * @category utilities
 * @since 0.0.0
 */
const appendAdmissionJournalEventWithMode = Effect.fnUntraced(function* (
  root: string,
  event: AdmissionJournalV1Event,
  idempotent: boolean
): Effect.fn.Return<void, QualitySchedulerError, FileSystem.FileSystem | Path.Path> {
  const { journalPath, lockPath } = yield* prepareAdmissionJournalPaths(root);
  const line = yield* encodeEvent(event).pipe(
    Effect.mapError(QualitySchedulerError.new("Failed to encode admission journal event."))
  );
  yield* withJournalFileLock(
    lockPath,
    (lockToken) => rewriteJournalLocked(journalPath, lockPath, lockToken, event, line, idempotent),
    LOCKED_OPERATION_RETRY_ATTEMPTS,
    `Admission journal lock "${lockPath}" stayed busy; dropping one ${event._tag} event.`
  );
});

export const appendAdmissionJournalEvent = Effect.fn("AdmissionJournal.append")(function* (
  root: string,
  event: AdmissionJournalV1Event
): Effect.fn.Return<void, QualitySchedulerError, FileSystem.FileSystem | Path.Path> {
  yield* appendAdmissionJournalEventWithMode(root, event, false);
});

/**
 * Publish one admission transition at most once for its lifecycle identity.
 *
 * The journal lock makes the identity check and append one serialized
 * operation. Identity is the event tag plus admission nonce, owner PID, and
 * optional attempt ID, so replaying a durable claim or promotion transition
 * cannot create a duplicate row.
 *
 * **Example** (Reference the idempotent journal writer)
 *
 * ```ts
 * import { appendAdmissionJournalEventOnce } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof appendAdmissionJournalEventOnce) // "function"
 * ```
 *
 * @param root - Machine-wide admission root directory.
 * @param event - Admission transition to publish once.
 * @returns An effect that acknowledges an existing matching row or appends it durably.
 * @category utilities
 * @since 0.0.0
 */
export const appendAdmissionJournalEventOnce = Effect.fn("AdmissionJournal.appendOnce")(function* (
  root: string,
  event: AdmissionJournalV1Event
): Effect.fn.Return<void, QualitySchedulerError, FileSystem.FileSystem | Path.Path> {
  yield* appendAdmissionJournalEventWithMode(root, event, true);
});

/**
 * Append one eviction event idempotently while the serialized protocol gate is on.
 *
 * **Details**
 *
 * The protocol read and admission-journal rewrite share the fenced journal
 * lock. A displaced writer retries the complete gate read and rewrite under a
 * fresh generation, so disabling eviction emission cannot race a delayed row.
 *
 * **Example** (Reference the gated eviction writer)
 *
 * ```ts
 * import { appendAdmissionEvictionJournalEvent } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof appendAdmissionEvictionJournalEvent) // "function"
 * ```
 *
 * @param root - Machine-wide admission root directory.
 * @param event - Version-two lease or ticket eviction event.
 * @returns Whether the enabled protocol admitted or already contained the event.
 * @category utilities
 * @since 0.0.0
 */
export const appendAdmissionEvictionJournalEvent = Effect.fn("AdmissionJournal.appendEviction")(function* (
  root: string,
  event: AdmissionJournalLeaseEvicted | AdmissionJournalTicketEvicted
): Effect.fn.Return<boolean, QualitySchedulerError, FileSystem.FileSystem | Path.Path> {
  const { journalPath, lockPath } = yield* prepareAdmissionJournalPaths(root);
  const line = yield* encodeEvent(event).pipe(
    Effect.mapError(QualitySchedulerError.new("Failed to encode admission eviction journal event."))
  );
  return yield* withJournalFileLock(
    lockPath,
    Effect.fnUntraced(function* (lockToken) {
      if (AdmissionEvictionEmission.is.off((yield* readAdmissionProtocol(root)).eviction)) {
        return false;
      }
      yield* rewriteJournalLocked(journalPath, lockPath, lockToken, event, line, true);
      return true;
    }),
    LOCKED_OPERATION_RETRY_ATTEMPTS,
    `Admission journal lock "${lockPath}" stayed busy; dropping one ${event._tag} event.`
  );
});
