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
import { Clock, Console, Duration, Effect, Encoding, FileSystem, Number as N, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import { constant, dual, flow } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
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
const LOCK_FILE_NAME = "journal.lock";
const RETAINED_ADMISSIONS = 200;
const LOCK_RETRY_ATTEMPTS = 8;
const LOCK_RETRY_DELAY_MILLIS = 25;
// No legitimate writer publishes an unparseable token. The age backstop
// therefore applies only to malformed generations, never a parseable live
// owner whose lock could still be released concurrently.
const LOCK_REUSE_BACKSTOP_MILLIS = 300_000;
const textEncoder = new TextEncoder();

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
  S.Tuple([S.String, S.StringFromBase64Url, S.StringFromBase64Url])
);

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

const journalLockReapClaimPath = (lockPath: string, observedToken: string): string =>
  `${lockPath}.reap-${createHash("sha256").update(observedToken).digest("hex")}`;

const journalLockReapAdopterPrefix = (claimPath: string): string => `${claimPath}.adopt-`;

const journalLockReapAdopterPath = (claimPath: string, generation: AdmissionJournalLockGeneration): string =>
  `${journalLockReapAdopterPrefix(claimPath)}${generation.pid}.${Encoding.encodeBase64Url(generation.procStart)}.${Encoding.encodeBase64Url(generation.ownerToken)}`;

const journalLockReapTombstonePath = (claimPath: string): string =>
  `${claimPath}.tombstone-${process.pid}-${randomUUID()}`;

const decodeReapAdopterGeneration = Effect.fnUntraced(function* (
  adopterPath: string,
  claimPath: string
): Effect.fn.Return<O.Option<AdmissionJournalLockGeneration>> {
  const prefix = journalLockReapAdopterPrefix(claimPath);
  const parts = yield* decodeReapAdopterPathParts(Str.split(".")(Str.slice(prefix.length)(adopterPath))).pipe(
    Effect.option
  );
  if (O.isNone(parts)) {
    return O.none();
  }
  const pid = N.parse(parts.value[0]);
  return O.map(pid, (value) =>
    AdmissionJournalLockGeneration.make({
      schemaVersion: "yeet-admission-journal-lock/v1",
      pid: value,
      procStart: parts.value[1],
      ownerToken: parts.value[2],
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

const recoverJournalLockReapTombstone = Effect.fnUntraced(function* (
  lockPath: string,
  tombstonePath: string
): Effect.fn.Return<void, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  if (yield* fs.exists(lockPath).pipe(Effect.orElseSucceed(constant(true)))) {
    yield* fs.remove(tombstonePath, { force: true }).pipe(Effect.ignore);
    return;
  }
  const restored = yield* fs.link(tombstonePath, lockPath).pipe(Effect.as(true), Effect.orElseSucceed(constant(false)));
  if (restored) {
    yield* fs.remove(tombstonePath, { force: true }).pipe(Effect.ignore);
    return;
  }
  if (yield* fs.exists(lockPath).pipe(Effect.orElseSucceed(constant(false)))) {
    yield* fs.remove(tombstonePath, { force: true }).pipe(Effect.ignore);
  }
});

const sweepOrphanJournalLockClaims = Effect.fnUntraced(function* (
  lockPath: string
): Effect.fn.Return<void, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const sidecars = yield* journalLockReapSidecars(lockPath);
  const tombstones = A.filter(sidecars, isJournalLockReapTombstone);
  yield* Effect.forEach(tombstones, (tombstonePath) => recoverJournalLockReapTombstone(lockPath, tombstonePath), {
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
  const generation = yield* decodeReapAdopterGeneration(adopterPath, claimPath);
  if (O.isSome(generation)) {
    return !(yield* lockGenerationIsDead(generation.value));
  }
  const info = yield* fs.stat(adopterPath).pipe(Effect.option);
  return !pipe(
    info,
    O.flatMap((fileInfo) => fileInfo.mtime),
    O.exists((mtime) => nowMillis - mtime.getTime() > LOCK_REUSE_BACKSTOP_MILLIS)
  );
});

const activeReapAdopterExists = Effect.fnUntraced(function* (
  claimPath: string,
  nowMillis: number
): Effect.fn.Return<boolean, never, FileSystem.FileSystem | Path.Path> {
  const adopterPrefix = journalLockReapAdopterPrefix(claimPath);
  const adopters = yield* pathsWithPrefix(adopterPrefix);
  if (O.isNone(adopters)) {
    return true;
  }
  for (const adopterPath of adopters.value) {
    if (yield* reapAdopterMayStillAct(adopterPath, claimPath, nowMillis)) {
      return true;
    }
  }
  return false;
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
  if (yield* activeReapAdopterExists(claimPath, nowMillis)) {
    return O.none();
  }
  yield* fs.link(lockPath, claimPath).pipe(Effect.ignore);
  const claimedToken = yield* fs.readFileString(claimPath).pipe(Effect.option);
  if (!O.exists(claimedToken, (token) => token === observedToken)) {
    return O.none();
  }
  const adopterGeneration = yield* makeLockGeneration(`${process.pid}:${randomUUID()}`);
  if (O.isNone(adopterGeneration)) {
    return O.none();
  }
  const adopterPath = journalLockReapAdopterPath(claimPath, adopterGeneration.value);
  return yield* fs
    .rename(claimPath, adopterPath)
    .pipe(Effect.as(O.some(adopterPath)), Effect.orElseSucceed(O.none<string>));
});

const finishJournalLockReap = Effect.fnUntraced(function* (
  lockPath: string,
  claimPath: string,
  adopterPath: string,
  observedToken: string
): Effect.fn.Return<void, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const adopterToken = yield* fs.readFileString(adopterPath).pipe(Effect.option);
  if (!O.exists(adopterToken, (token) => token === observedToken)) {
    yield* fs.remove(adopterPath, { force: true }).pipe(Effect.ignore);
    return;
  }
  const tombstonePath = journalLockReapTombstonePath(claimPath);
  const moved = yield* fs.rename(lockPath, tombstonePath).pipe(Effect.as(true), Effect.orElseSucceed(constant(false)));
  if (!moved) {
    yield* fs.remove(adopterPath, { force: true }).pipe(Effect.ignore);
    return;
  }
  const tombstoneToken = yield* fs.readFileString(tombstonePath).pipe(Effect.option);
  const adopterInfo = yield* fs.stat(adopterPath).pipe(Effect.option);
  const tombstoneInfo = yield* fs.stat(tombstonePath).pipe(Effect.option);
  const reclaimedObservedGeneration =
    O.exists(tombstoneToken, (token) => token === observedToken) &&
    O.exists(adopterInfo, (claim) => O.exists(tombstoneInfo, (tombstone) => sameFileIdentity(claim, tombstone)));
  if (reclaimedObservedGeneration) {
    yield* fs.remove(tombstonePath, { force: true }).pipe(Effect.ignore);
  } else {
    const restored = yield* fs
      .link(tombstonePath, lockPath)
      .pipe(Effect.as(true), Effect.orElseSucceed(constant(false)));
    if (restored) {
      yield* fs.remove(tombstonePath, { force: true }).pipe(Effect.ignore);
    } else {
      yield* Console.error(
        `[yeet] journal lock generation displaced during reclaim; recovery retained ${tombstonePath}`
      );
    }
  }
  yield* fs.remove(adopterPath, { force: true }).pipe(Effect.ignore);
});

// A generation-specific hard link is the immutable claim snapshot. Renaming
// that deterministic name elects exactly one source-fenced adopter. The winner
// takes the published path first, then validates the tombstoned inode and
// restores a displaced replacement without clobbering a third writer.
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
  const adopterPath = yield* adoptJournalLockReapClaim(lockPath, claimPath, observedToken.value, nowMillis);
  if (O.isSome(adopterPath)) {
    yield* finishJournalLockReap(lockPath, claimPath, adopterPath.value, observedToken.value);
  }
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
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs.readFileString(lockPath).pipe(Effect.option);
  // Remove only the generation this writer created; a lock reaped and
  // replaced mid-write belongs to its new owner and stays.
  const owned = yield* O.match(content, {
    onNone: () => Effect.succeed(false),
    onSome: (current) => isOwnedLockGeneration(current, token),
  });
  if (owned) {
    yield* fs.remove(lockPath, { force: true }).pipe(Effect.ignore);
  }
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
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs.readFileString(lockPath).pipe(Effect.option);
  const owned = yield* O.match(content, {
    onNone: () => Effect.succeed(false),
    onSome: (current) => isOwnedLockGeneration(current, token),
  });
  if (!owned) {
    return yield* QualitySchedulerError.make({
      message: `Admission journal lock "${lockPath}" was lost before publication; retry the locked operation.`,
    });
  }
});

const publishJournalAtomic = Effect.fnUntraced(function* (
  journalPath: string,
  lockPath: string,
  lockToken: string,
  content: string
): Effect.fn.Return<void, QualitySchedulerError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const stagingPath = `${journalPath}.tmp-${process.pid}-${randomUUID()}`;
  yield* Effect.ensuring(
    Effect.gen(function* () {
      yield* Effect.scoped(
        Effect.gen(function* () {
          const file = yield* fs.open(stagingPath, { flag: "w" });
          yield* file.writeAll(textEncoder.encode(content));
          yield* file.sync;
        })
      ).pipe(Effect.mapError(QualitySchedulerError.new(`Failed to stage admission journal "${journalPath}".`)));
      yield* assertJournalFileLockOwned(lockPath, lockToken);
      yield* fs
        .rename(stagingPath, journalPath)
        .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to publish admission journal "${journalPath}".`)));
    }),
    fs.remove(stagingPath, { force: true }).pipe(Effect.ignore)
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
): Effect.fn.Return<void, QualitySchedulerError, FileSystem.FileSystem> {
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
  event: AdmissionJournalEvent,
  idempotent: boolean
): Effect.fn.Return<void, QualitySchedulerError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const journalPath = path.join(root, JOURNAL_FILE_NAME);
  const lockPath = path.join(root, LOCK_FILE_NAME);
  const token = `${process.pid}:${randomUUID()}`;
  const line = yield* encodeEvent(event).pipe(
    Effect.mapError(QualitySchedulerError.new("Failed to encode admission journal event."))
  );
  yield* fs
    .makeDirectory(root, { recursive: true, mode: 0o700 })
    .pipe(Effect.mapError(QualitySchedulerError.new("Failed to create admission journal directory.")));
  if (!(yield* acquireJournalFileLock(lockPath, token))) {
    return yield* QualitySchedulerError.make({
      message: `Admission journal lock "${lockPath}" stayed busy; dropping one ${event._tag} event.`,
    });
  }
  yield* Effect.ensuring(
    rewriteJournalLocked(journalPath, lockPath, token, event, line, idempotent),
    releaseJournalFileLock(lockPath, token)
  );
});

export const appendAdmissionJournalEvent = Effect.fn("AdmissionJournal.append")(function* (
  root: string,
  event: AdmissionJournalEvent
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
  event: AdmissionJournalEvent
): Effect.fn.Return<void, QualitySchedulerError, FileSystem.FileSystem | Path.Path> {
  yield* appendAdmissionJournalEventWithMode(root, event, true);
});
