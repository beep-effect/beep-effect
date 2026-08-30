/**
 * Machine-wide weighted admission scheduler for heavyweight repository work
 * (ship-velocity D1).
 *
 * Contenders enqueue a durable ticket under the per-user runtime directory,
 * wait with visible progress, and are admitted strictly in priority + FIFO
 * order whenever their token weight fits the live memory-derived capacity.
 * Admitted work holds a heartbeated lease; leases are reaped only when the
 * owner pid is dead or its `/proc` start time no longer matches (pid reuse),
 * and malformed state is quarantined visibly instead of blocking forever.
 *
 * The per-origin full-proof lock (`Yeet/internal/ProofState.ts`) is retained:
 * callers pass an {@link AdmissionOriginGate} so a contender whose origin is
 * already proving stays queued without blocking unrelated origins.
 *
 * @since 0.0.0
 */

import { randomUUID } from "node:crypto";
import { freemem, totalmem } from "node:os";
import { $RepoCliId } from "@beep/identity/packages";
import * as OptionUtils from "@beep/utils/Option";
import {
  Clock,
  Console,
  Context,
  DateTime,
  Duration,
  Effect,
  Fiber,
  FileSystem,
  Layer,
  MutableHashSet,
  Order,
  Path,
  pipe,
} from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { AdmissionJournalAdmitted, AdmissionJournalReleased, appendAdmissionJournalEvent } from "./AdmissionJournal.ts";
import {
  AdmissionConfig,
  AdmissionRequest,
  AdmissionSnapshot,
  QualitySchedulerError,
  YeetAdmissionLease,
  YeetAdmissionTicket,
} from "./QualityScheduler.schemas.ts";
import { RunScopeRecord, RunScopeSupport, RunScopeTelemetry } from "./RunScope.schemas.ts";
import {
  enterRunScope,
  listRunScopeUnits,
  readRunScopeOwnerRoot,
  readRunScopeTelemetry,
  runScopeUnitName,
  stopRunScopeForReap,
} from "./RunScope.ts";
import { admissionRootFor, perUserRuntimeRoot } from "./RuntimeRoot.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";

const $I = $RepoCliId.create("internal/repo-run/QualityScheduler");

const decodeLease = S.decodeUnknownEffect(S.fromJsonString(YeetAdmissionLease));
const encodeLease = S.encodeUnknownEffect(S.fromJsonString(YeetAdmissionLease));
const decodeTicket = S.decodeUnknownEffect(S.fromJsonString(YeetAdmissionTicket));
const encodeTicket = S.encodeUnknownEffect(S.fromJsonString(YeetAdmissionTicket));

const GIB = 1024 * 1024 * 1024;
const MEMINFO_PATH = "/proc/meminfo";

/**
 * Shape of the {@link MemoryStats} service.
 *
 * @category services
 * @since 0.0.0
 */
export interface MemoryStatsShape {
  /** Currently available memory in GiB, re-read on every evaluation. */
  readonly availableGib: Effect.Effect<number>;
  /** Installed physical memory in GiB. */
  readonly totalGib: Effect.Effect<number>;
}

/**
 * Service reporting live machine memory availability for admission decisions.
 *
 * **Example** (Provide a fixed reading in tests)
 *
 * ```ts
 * import { MemoryStats } from "@beep/repo-cli/test/RepoRun"
 * import { Effect, Layer } from "effect"
 *
 * const fixed = Layer.succeed(
 *   MemoryStats,
 *   MemoryStats.of({ availableGib: Effect.succeed(50), totalGib: Effect.succeed(128) })
 * )
 * console.log(Layer.isLayer(fixed)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class MemoryStats extends Context.Service<MemoryStats, MemoryStatsShape>()($I`MemoryStats`) {}

const parseMeminfoFieldGib = (meminfo: string, field: string): O.Option<number> =>
  pipe(
    Str.split(meminfo, "\n"),
    A.findFirst(Str.startsWith(field)),
    O.flatMap((line) => A.get(A.filter(Str.split(line, /\s+/), Str.isNonEmpty), 1)),
    O.map(Number),
    O.filter((kib) => !Number.isNaN(kib)),
    O.map((kib) => (kib * 1024) / GIB)
  );

const makeMemoryStats = Effect.fnUntraced(function* (): Effect.fn.Return<
  MemoryStatsShape,
  never,
  FileSystem.FileSystem
> {
  const fs = yield* FileSystem.FileSystem;
  const meminfoFieldGib = (field: string, fallback: () => number) =>
    fs.readFileString(MEMINFO_PATH).pipe(
      Effect.map((meminfo) => parseMeminfoFieldGib(meminfo, field)),
      Effect.orElseSucceed(O.none<number>),
      Effect.map(O.getOrElse(fallback))
    );
  return {
    // Non-Linux fallback: freemem() under-reports (no reclaimable cache), which
    // only makes admission more conservative.
    availableGib: meminfoFieldGib("MemAvailable:", () => freemem() / GIB),
    totalGib: meminfoFieldGib("MemTotal:", () => totalmem() / GIB),
  };
});

/**
 * Production {@link MemoryStats} layer reading `/proc/meminfo` `MemAvailable`.
 *
 * **Example** (Reference the live layer)
 *
 * ```ts
 * import { MemoryStatsLive } from "@beep/repo-cli/test/RepoRun"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(MemoryStatsLive)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const MemoryStatsLive: Layer.Layer<MemoryStats, never, FileSystem.FileSystem> = Layer.effect(
  MemoryStats,
  Effect.map(makeMemoryStats(), MemoryStats.of)
);

/**
 * Compute the admission capacity in tokens for one memory reading.
 *
 * Chartered formula (SPEC D1): `min(capacityMax, floor((available − reserve) / slot))`,
 * with a hard zero below the admission floor.
 *
 * **Example** (Capacity at 50 GiB available)
 *
 * ```ts
 * import { AdmissionConfig, admissionCapacityTokensFor } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(admissionCapacityTokensFor(50, AdmissionConfig.make({}))) // 8
 * ```
 *
 * @param availableGib - Live `MemAvailable` reading in GiB.
 * @param config - Admission policy knobs.
 * @returns Whole token capacity, never negative.
 * @category admission
 * @since 0.0.0
 */
export const admissionCapacityTokensFor: {
  (availableGib: number, config: AdmissionConfig): number;
  (config: AdmissionConfig): (availableGib: number) => number;
} = dual(2, (availableGib: number, config: AdmissionConfig): number => {
  if (availableGib < config.hardFloorGib) {
    return 0;
  }
  const raw = Math.floor((availableGib - config.reserveGib) / config.slotSizeGib);
  return Math.max(0, Math.min(config.capacityMaxTokens, raw));
});

/**
 * Parse the process start time (field 22) out of `/proc/<pid>/stat` content.
 *
 * Splits after the final `)` so executable names containing spaces or
 * parentheses cannot shift the field index. Mirrors the fleet-registry
 * pid-reuse guard in `Worktree/Fleet.service.ts`.
 *
 * **Example** (Parse a stat line)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { parseAdmissionProcStatStartTime } from "@beep/repo-cli/test/RepoRun"
 *
 * const stat = "1234 (bun) S 1 1234 1234 0 -1 4194560 0 0 0 0 0 0 0 0 20 0 1 0 8241991 0 0"
 * console.log(O.getOrElse(parseAdmissionProcStatStartTime(stat), () => "none")) // "8241991"
 * ```
 *
 * @param stat - Raw `/proc/<pid>/stat` file content.
 * @returns The start-time field when present.
 * @category liveness
 * @since 0.0.0
 */
export const parseAdmissionProcStatStartTime = (stat: string): O.Option<string> =>
  pipe(
    Str.lastIndexOf(")")(stat),
    O.flatMap((closeParen) =>
      O.fromUndefinedOr(A.filter(Str.split(Str.trim(Str.slice(closeParen + 1)(stat)), /\s+/), Str.isNonEmpty)[19])
    )
  );

/**
 * Probe whether a pid is alive, counting `EPERM` as alive (foreign-uid pids).
 *
 * Shared liveness primitive for the admission scheduler and the per-origin
 * proof coordinator.
 *
 * **Example** (Probe the current process)
 *
 * ```ts
 * import { isProcessPidAlive } from "@beep/repo-cli/test/RepoRun"
 * import { Effect } from "effect"
 *
 * console.log(Effect.runSync(isProcessPidAlive(process.pid))) // true
 * ```
 *
 * @param pid - Process id to probe with signal 0.
 * @returns Whether a process with this pid currently exists.
 * @category liveness
 * @since 0.0.0
 */
export const isProcessPidAlive = (pid: number): Effect.Effect<boolean> =>
  Effect.sync(() => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return P.hasProperty(error, "code") && error.code === "EPERM";
    }
  });

const procStartTimeForPid = Effect.fnUntraced(function* (
  pid: number
): Effect.fn.Return<O.Option<string>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs
    .readFileString(`/proc/${pid}/stat`)
    .pipe(Effect.map(parseAdmissionProcStatStartTime), Effect.orElseSucceed(O.none<string>));
});

// An owner is dead when its pid is gone, or when the pid is alive but its
// recorded /proc start time no longer matches (pid reuse). An unreadable
// current start time (non-Linux, permission) degrades to the pid-only check.
const isAdmissionOwnerAlive = Effect.fnUntraced(function* (owner: {
  readonly pid: number;
  readonly procStart: string;
}): Effect.fn.Return<boolean, never, FileSystem.FileSystem> {
  const alive = yield* isProcessPidAlive(owner.pid);
  if (!alive) {
    return false;
  }
  if (Str.isEmpty(owner.procStart)) {
    return true;
  }
  const current = yield* procStartTimeForPid(owner.pid);
  return O.match(current, {
    onNone: () => true,
    onSome: (start) => start === owner.procStart,
  });
});

interface AdmissionDirectories {
  readonly leases: string;
  readonly quarantine: string;
  readonly queue: string;
  readonly root: string;
}

// The base root is shared with the proof-lock coordinator (RuntimeRoot.ts), so
// every session on the machine coordinates under one tree.
const admissionRuntimeRoot = Effect.fnUntraced(function* (): Effect.fn.Return<
  string,
  never,
  FileSystem.FileSystem | Path.Path
> {
  const path = yield* Path.Path;
  return admissionRootFor(path, yield* perUserRuntimeRoot());
});

/**
 * Effective uid of the current process, when the platform exposes one.
 *
 * **Example** (Read the effective uid option)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { currentEffectiveUserIdOption } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(O.isOption(currentEffectiveUserIdOption())) // true
 * ```
 *
 * @returns The effective uid, or `None` where `process.geteuid` is absent.
 * @category liveness
 * @since 0.0.0
 */
export const currentEffectiveUserIdOption = (): O.Option<number> =>
  pipe(
    O.fromUndefinedOr(process.geteuid),
    O.map((getEffectiveUserId) => getEffectiveUserId())
  );

/**
 * Options for {@link validatePrivateCoordinationDirectory}.
 *
 * @category coordination
 * @since 0.0.0
 */
export interface PrivateCoordinationDirectoryOptions<DirectoryError> {
  /** Effective uid to require as owner; `None` skips the ownership check. */
  readonly effectiveUserId: O.Option<number>;
  /** Human label used verbatim in refusal messages, e.g. `Admission directory`. */
  readonly label: string;
  /** Build the failure for an unreadable directory. */
  readonly onStatError: (cause: unknown) => DirectoryError;
  /** Build the failure for one violated invariant message. */
  readonly onViolation: (message: string) => DirectoryError;
}

/**
 * Fail-closed validation for a private (0700, self-owned) coordination
 * directory, shared by the admission scheduler and the proof coordinator.
 *
 * **Example** (Reference the validator)
 *
 * ```ts
 * import { validatePrivateCoordinationDirectory } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof validatePrivateCoordinationDirectory) // "function"
 * ```
 *
 * @param directory - Directory whose safety invariants are checked.
 * @param options - Label, required owner, and error constructors.
 * @returns An Effect that fails when the directory is unsafe to coordinate in.
 * @category coordination
 * @since 0.0.0
 */
export const validatePrivateCoordinationDirectory = Effect.fnUntraced(function* <DirectoryError>(
  directory: string,
  options: PrivateCoordinationDirectoryOptions<DirectoryError>
): Effect.fn.Return<void, DirectoryError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const require = (satisfied: boolean, message: string) =>
    satisfied ? Effect.void : Effect.fail(options.onViolation(message));
  const symbolicLinkTarget = yield* fs.readLink(directory).pipe(Effect.option);
  const info = yield* fs.stat(directory).pipe(Effect.mapError(options.onStatError));
  yield* require(O.isNone(symbolicLinkTarget), `${options.label} ${directory} is a symbolic link. Refusing to use it.`);
  yield* require(info.type === "Directory", `${options.label} ${directory} is not a directory. Refusing to use it.`);
  const mode = info.mode & 0o777;
  yield* require(mode ===
    0o700, `${options.label} ${directory} has mode ${mode.toString(8)}; expected 0700. Refusing to use it.`);
  const reportedOwner = O.match(info.uid, {
    onNone: () => "no owner",
    onSome: (owner) => `uid ${owner}`,
  });
  yield* O.match(options.effectiveUserId, {
    onNone: () => Effect.void,
    onSome: (userId) =>
      require(O.exists(
        info.uid,
        (owner) => owner === userId
      ), `${options.label} ${directory} reported ${reportedOwner}; expected effective uid ${userId}. Refusing to use it.`),
  });
});

const validateAdmissionDirectory = (directory: string) =>
  validatePrivateCoordinationDirectory(directory, {
    label: "Admission directory",
    effectiveUserId: currentEffectiveUserIdOption(),
    onViolation: (message) => QualitySchedulerError.make({ message }),
    onStatError: QualitySchedulerError.new(`Failed to inspect Admission directory ${directory}.`),
  });

const ensureAdmissionDirectories = Effect.fnUntraced(function* (): Effect.fn.Return<
  AdmissionDirectories,
  QualitySchedulerError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* admissionRuntimeRoot();
  const directories: AdmissionDirectories = {
    root,
    leases: path.join(root, "leases"),
    queue: path.join(root, "queue"),
    quarantine: path.join(root, "quarantine"),
  };
  yield* Effect.forEach(
    [directories.root, directories.leases, directories.queue, directories.quarantine],
    (directory) =>
      fs
        .makeDirectory(directory, { recursive: true, mode: 0o700 })
        .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to create admission directory ${directory}.`))),
    { discard: true }
  );
  yield* validateAdmissionDirectory(directories.root);
  return directories;
});

// Stage the complete content in a sibling temp file so publication (rename or
// hard link) is atomic and a concurrent repair scan can never observe (and
// quarantine) a partial write.
const stageTemporaryFile = Effect.fnUntraced(function* (
  filePath: string,
  content: string
): Effect.fn.Return<string, QualitySchedulerError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const temporary = `${filePath}.tmp-${process.pid}-${randomUUID()}`;
  yield* fs
    .writeFileString(temporary, content)
    .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to stage admission state at ${temporary}.`)));
  return temporary;
});

const writeFileAtomic = Effect.fnUntraced(function* (
  filePath: string,
  content: string
): Effect.fn.Return<void, QualitySchedulerError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const temporary = yield* stageTemporaryFile(filePath, content);
  yield* fs
    .rename(temporary, filePath)
    .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to publish admission state at ${filePath}.`)));
});

const tryCreateExclusive = Effect.fnUntraced(function* (
  filePath: string,
  content: string
): Effect.fn.Return<boolean, QualitySchedulerError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const temporary = yield* stageTemporaryFile(filePath, content);
  const linked = yield* fs.link(temporary, filePath).pipe(
    Effect.as(true),
    Effect.catchTag("PlatformError", (error) =>
      error.reason._tag === "AlreadyExists"
        ? Effect.succeed(false)
        : Effect.fail(QualitySchedulerError.new(`Failed to atomically create ${filePath}.`)(error))
    )
  );
  yield* fs.remove(temporary, { force: true }).pipe(Effect.ignore);
  return linked;
});

interface LiveAdmissionState {
  readonly dead: ReadonlyArray<string>;
  readonly deadLeases: ReadonlyArray<{ readonly path: string; readonly lease: YeetAdmissionLease }>;
  readonly leases: ReadonlyArray<{ readonly path: string; readonly lease: YeetAdmissionLease }>;
  readonly quarantined: ReadonlyArray<string>;
  readonly tickets: ReadonlyArray<{ readonly path: string; readonly ticket: YeetAdmissionTicket }>;
}

const quarantineEntry = Effect.fnUntraced(function* (
  directories: AdmissionDirectories,
  entryPath: string,
  reason: string
): Effect.fn.Return<void, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const nowMillis = yield* Clock.currentTimeMillis;
  const destination = path.join(directories.quarantine, `${path.basename(entryPath)}.${nowMillis}`);
  yield* Console.error(`[yeet] quarantined malformed admission state ${entryPath} (${reason}) -> ${destination}`);
  yield* fs.rename(entryPath, destination).pipe(Effect.ignore);
});

interface AdmissionEntryCodec<Entry, DecodeError> {
  readonly decode: (text: string) => Effect.Effect<Entry, DecodeError>;
  readonly describe: (entry: Entry) => string;
  readonly ownerOf: (entry: Entry) => { readonly pid: number; readonly procStart: string };
}

type AdmissionEntryClass<Entry> =
  | { readonly kind: "skip" }
  | { readonly kind: "malformed" }
  | { readonly kind: "dead"; readonly entry: Entry }
  | { readonly kind: "live"; readonly entry: Entry };

const classifyAdmissionEntry = Effect.fnUntraced(function* <Entry, DecodeError>(
  entryPath: string,
  codec: AdmissionEntryCodec<Entry, DecodeError>
): Effect.fn.Return<AdmissionEntryClass<Entry>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(entryPath).pipe(Effect.orElseSucceed(() => ""));
  if (Str.isEmpty(text)) {
    return { kind: "skip" };
  }
  const decoded = yield* codec.decode(text).pipe(Effect.map(O.some), Effect.orElseSucceed(O.none<Entry>));
  if (O.isNone(decoded)) {
    return { kind: "malformed" };
  }
  const alive = yield* isAdmissionOwnerAlive(codec.ownerOf(decoded.value));
  return alive ? { kind: "live", entry: decoded.value } : { kind: "dead", entry: decoded.value };
});

const reapDeadAdmissionEntry = Effect.fnUntraced(function* <Entry, DecodeError>(
  entryPath: string,
  entry: Entry,
  codec: AdmissionEntryCodec<Entry, DecodeError>
): Effect.fn.Return<void, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  yield* Console.error(`[yeet] reaping dead admission state for ${codec.describe(entry)} at ${entryPath}`);
  yield* fs.remove(entryPath, { force: true }).pipe(Effect.ignore);
});

const repairAdmissionEntries = Effect.fnUntraced(function* <Entry, DecodeError>(
  directories: AdmissionDirectories,
  classified: ReadonlyArray<{ readonly entryPath: string; readonly outcome: AdmissionEntryClass<Entry> }>,
  codec: AdmissionEntryCodec<Entry, DecodeError>
): Effect.fn.Return<void, never, FileSystem.FileSystem | Path.Path> {
  yield* Effect.forEach(
    classified,
    ({ entryPath, outcome }) =>
      outcome.kind === "malformed"
        ? quarantineEntry(directories, entryPath, "undecodable")
        : outcome.kind === "dead"
          ? reapDeadAdmissionEntry(entryPath, outcome.entry, codec)
          : Effect.void,
    { discard: true }
  );
});

const collectAdmissionEntries = Effect.fnUntraced(function* <Entry, DecodeError>(
  directories: AdmissionDirectories,
  directory: string,
  codec: AdmissionEntryCodec<Entry, DecodeError>,
  repair: boolean
): Effect.fn.Return<
  {
    readonly live: ReadonlyArray<{ readonly path: string; readonly entry: Entry }>;
    readonly dead: ReadonlyArray<{ readonly path: string; readonly entry: Entry }>;
    readonly quarantined: ReadonlyArray<string>;
  },
  QualitySchedulerError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  // Fail closed: an unlistable coordination directory must never masquerade
  // as an empty one, or every active lease would vanish from capacity math.
  const names = yield* fs
    .readDirectory(directory)
    .pipe(Effect.mapError(QualitySchedulerError.new(`Failed to list admission state in ${directory}.`)));
  const classified = yield* Effect.forEach(A.filter(names, Str.endsWith(".json")), (name) => {
    const entryPath = path.join(directory, name);
    return Effect.map(classifyAdmissionEntry(entryPath, codec), (outcome) => ({ entryPath, outcome }));
  });
  yield* repair ? repairAdmissionEntries(directories, classified, codec) : Effect.void;
  return {
    live: A.getSomes(
      A.map(classified, ({ entryPath, outcome }) =>
        outcome.kind === "live" ? O.some({ path: entryPath, entry: outcome.entry }) : O.none()
      )
    ),
    dead: A.getSomes(
      A.map(classified, ({ entryPath, outcome }) =>
        outcome.kind === "dead" ? O.some({ path: entryPath, entry: outcome.entry }) : O.none()
      )
    ),
    quarantined: A.getSomes(
      A.map(classified, ({ entryPath, outcome }) => (outcome.kind === "malformed" ? O.some(entryPath) : O.none()))
    ),
  };
});

const scanAdmissionState = Effect.fnUntraced(function* (
  directories: AdmissionDirectories,
  repair: boolean
): Effect.fn.Return<LiveAdmissionState, QualitySchedulerError, FileSystem.FileSystem | Path.Path> {
  const leases = yield* collectAdmissionEntries(
    directories,
    directories.leases,
    {
      decode: decodeLease,
      ownerOf: (lease: YeetAdmissionLease) => lease,
      describe: (lease: YeetAdmissionLease) => `pid ${lease.pid} (${lease.kind}, ${lease.checkoutRoot})`,
    },
    repair
  );
  const tickets = yield* collectAdmissionEntries(
    directories,
    directories.queue,
    {
      decode: decodeTicket,
      ownerOf: (ticket: YeetAdmissionTicket) => ticket,
      describe: (ticket: YeetAdmissionTicket) => `pid ${ticket.pid} (queued ${ticket.kind}, ${ticket.checkoutRoot})`,
    },
    repair
  );
  return {
    leases: A.map(leases.live, ({ entry, path: entryPath }) => ({ path: entryPath, lease: entry })),
    tickets: A.map(tickets.live, ({ entry, path: entryPath }) => ({ path: entryPath, ticket: entry })),
    dead: A.appendAll(
      A.map(leases.dead, ({ path: entryPath }) => entryPath),
      A.map(tickets.dead, ({ path: entryPath }) => entryPath)
    ),
    deadLeases: A.map(leases.dead, ({ entry, path: entryPath }) => ({ path: entryPath, lease: entry })),
    quarantined: A.appendAll(leases.quarantined, tickets.quarantined),
  };
});

const effectivePriorityRank = (ticket: YeetAdmissionTicket, nowMillis: number, config: AdmissionConfig): number =>
  ticket.priority === "publish" || nowMillis - ticket.enqueuedAtMillis >= config.publishAgingSeconds * 1000 ? 0 : 1;

const ticketOrder = (nowMillis: number, config: AdmissionConfig): Order.Order<YeetAdmissionTicket> =>
  pipe(
    Order.mapInput(Order.Number, (ticket: YeetAdmissionTicket) => effectivePriorityRank(ticket, nowMillis, config)),
    Order.combine(Order.mapInput(Order.Number, (ticket: YeetAdmissionTicket) => ticket.enqueuedAtMillis)),
    Order.combine(Order.mapInput(Order.Number, (ticket: YeetAdmissionTicket) => ticket.pid)),
    Order.combine(Order.mapInput(Order.String, (ticket: YeetAdmissionTicket) => ticket.nonce))
  );

const activeTokenTotal = (state: LiveAdmissionState): number =>
  A.reduce(state.leases, 0, (total, { lease }) => total + lease.weightTokens);

// A ticket is skippable (stays queued without blocking later tickets) when
// its origin is already proving under an admission lease, when it recently
// reported its origin lock busy (held by a process without a lease, e.g. a
// sibling checkout on the previous Yeet release), or when the review-fix
// class cap is saturated. Stamps expire so a crashed holder cannot leave a
// permanent skip.
const isTicketSkippable = (
  state: LiveAdmissionState,
  ticket: YeetAdmissionTicket,
  nowMillis: number,
  config: AdmissionConfig,
  ignoreOriginStamp: boolean
): boolean => {
  if (Str.isNonEmpty(ticket.originKey) && A.some(state.leases, ({ lease }) => lease.originKey === ticket.originKey)) {
    return true;
  }
  const stampFresh =
    ticket.blockedOnOriginAtMillis > 0 &&
    nowMillis - ticket.blockedOnOriginAtMillis <= 3 * config.heartbeatSeconds * 1000;
  if (!ignoreOriginStamp && stampFresh) {
    return true;
  }
  if (ticket.kind === "review-fix") {
    const activeReviewFix = A.length(A.filter(state.leases, ({ lease }) => lease.kind === "review-fix"));
    return activeReviewFix >= config.reviewFixClassCap;
  }
  return false;
};

// Deterministic self-selection: a contender attempts promotion only when no
// earlier live ticket is unblocked (head-of-line waiting for capacity stays
// chartered FIFO). A ticket blocked on its origin keeps retrying — its own
// stamp is ignored for itself — while later origins may proceed; concurrent
// attempts are resolved by the overshoot rollback in tryAdmitSelf.
const selfMayAttempt = (
  state: LiveAdmissionState,
  capacityTokens: number,
  nowMillis: number,
  config: AdmissionConfig,
  self: YeetAdmissionTicket
): boolean => {
  const ordered = A.sort(
    A.map(state.tickets, ({ ticket }) => ticket),
    ticketOrder(nowMillis, config)
  );
  for (const ticket of ordered) {
    if (ticket.pid === self.pid && ticket.nonce === self.nonce) {
      return (
        !isTicketSkippable(state, ticket, nowMillis, config, true) &&
        activeTokenTotal(state) + ticket.weightTokens <= capacityTokens
      );
    }
    if (!isTicketSkippable(state, ticket, nowMillis, config, false)) {
      return false;
    }
  }
  return false;
};

/**
 * Gate coordinating one origin-scoped resource (the per-origin full-proof
 * lock) underneath machine-wide admission.
 *
 * `tryAcquire` succeeds with `None` when the origin is busy — the contender
 * then stays queued instead of failing. Corruption states keep failing
 * through the error channel.
 *
 * @category admission
 * @since 0.0.0
 */
export interface AdmissionOriginGate<OriginLease, GateError, GateRequirements> {
  readonly release: (lease: OriginLease) => Effect.Effect<void, never, GateRequirements>;
  readonly tryAcquire: Effect.Effect<O.Option<OriginLease>, GateError, GateRequirements>;
}

/**
 * Origin gate for admission kinds that take no origin-scoped resource.
 *
 * **Example** (Reference the no-op gate)
 *
 * ```ts
 * import { noAdmissionOriginGate } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof noAdmissionOriginGate.release) // "function"
 * ```
 *
 * @category admission
 * @since 0.0.0
 */
export const noAdmissionOriginGate: AdmissionOriginGate<Record<string, never>, never, never> = {
  tryAcquire: Effect.succeed(O.some({})),
  release: () => Effect.void,
};

interface AdmittedState<OriginLease> {
  readonly lease: YeetAdmissionLease;
  readonly leasePath: string;
  readonly originLease: OriginLease;
}

const admissionProgressReport = Effect.fnUntraced(function* (
  request: AdmissionRequest,
  state: LiveAdmissionState,
  capacityTokens: number,
  availableGib: number,
  position: number,
  waitedMillis: number,
  nowMillis: number,
  config: AdmissionConfig
): Effect.fn.Return<void> {
  const owners = A.join(
    A.map(state.leases, ({ lease }) => {
      const suspect =
        nowMillis - lease.heartbeatAtMillis > config.suspectAfterSeconds * 1000 ? " [suspect: heartbeat stale]" : "";
      return `pid ${lease.pid} ${lease.kind}(${lease.weightTokens}) ${lease.checkoutRoot} @ ${lease.branch}${suspect}`;
    }),
    "; "
  );
  const waitedSeconds = Math.round(waitedMillis / 1000);
  yield* Console.log(
    `[yeet] admission: waiting ${waitedSeconds}s for ${request.kind}(${request.weightTokens}) — position ${position}, tokens ${activeTokenTotal(state)}/${capacityTokens}, MemAvailable ${availableGib.toFixed(1)} GiB${Str.isNonEmpty(owners) ? `, holders: ${owners}` : ""}`
  );
});

const admissionEscalation = (waitedMillis: number, alreadyEscalated: number): O.Option<string> =>
  waitedMillis >= 600_000 && alreadyEscalated < 2
    ? O.some(
        "[yeet] admission: waited 10 minutes; inspect holders with `bun run beep quality scheduler status` and reap dead state with `bun run beep quality scheduler reap`"
      )
    : waitedMillis >= 120_000 && alreadyEscalated < 1
      ? O.some(
          "[yeet] admission: waited 2 minutes; heavy work is holding the machine budget (this is backpressure, not a failure)"
        )
      : O.none();

const escalationLevelFor = (waitedMillis: number): number =>
  waitedMillis >= 600_000 ? 2 : waitedMillis >= 120_000 ? 1 : 0;

const refreshHeartbeat = Effect.fnUntraced(function* (
  entryPath: string,
  encoded: string
): Effect.fn.Return<void, QualitySchedulerError, FileSystem.FileSystem> {
  yield* writeFileAtomic(entryPath, `${encoded}\n`);
});

const encodeTicketText = Effect.fnUntraced(function* (
  ticket: YeetAdmissionTicket
): Effect.fn.Return<string, QualitySchedulerError> {
  return yield* encodeTicket(ticket).pipe(
    Effect.mapError(QualitySchedulerError.new("Failed to encode admission ticket state."))
  );
});

const encodeLeaseText = Effect.fnUntraced(function* (
  lease: YeetAdmissionLease
): Effect.fn.Return<string, QualitySchedulerError> {
  return yield* encodeLease(lease).pipe(
    Effect.mapError(QualitySchedulerError.new("Failed to encode admission lease state."))
  );
});

// Roll back an admission that overshot capacity because two observers promoted
// in the same tick. The deterministic loser is the lease with the newest
// immutable admission instant (never the heartbeat, which established leases
// refresh continuously); rollback happens before `use` starts, so running
// work is never preempted.
const admissionInstantOrder: Order.Order<YeetAdmissionLease> = pipe(
  Order.mapInput(Order.Number, (lease: YeetAdmissionLease) => lease.admittedAtMillis),
  Order.combine(Order.mapInput(Order.Number, (lease: YeetAdmissionLease) => lease.pid)),
  Order.combine(Order.mapInput(Order.String, (lease: YeetAdmissionLease) => lease.startedAt))
);

const isOvershootLoser = (state: LiveAdmissionState, capacityTokens: number, own: YeetAdmissionLease): boolean => {
  const ordered = A.sort(
    A.map(state.leases, ({ lease }) => lease),
    admissionInstantOrder
  );
  let cumulative = 0;
  for (const lease of ordered) {
    cumulative = cumulative + lease.weightTokens;
    if (lease.pid === own.pid && lease.startedAt === own.startedAt) {
      return cumulative > capacityTokens;
    }
  }
  return false;
};

/**
 * Whether one lease sits outside the capacity-fitting admission prefix.
 *
 * Leases are ordered by their immutable admission instant; every racing
 * contender whose cumulative weight exceeds capacity rolls itself back, so a
 * three-way over-admission cannot leave two excess proofs running.
 *
 * **Example** (Reference the overshoot predicate)
 *
 * ```ts
 * import { isOvershootLoserForTesting } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof isOvershootLoserForTesting) // "function"
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const isOvershootLoserForTesting: {
  (capacityTokens: number, own: YeetAdmissionLease): (state: LiveAdmissionState) => boolean;
  (state: LiveAdmissionState, capacityTokens: number, own: YeetAdmissionLease): boolean;
} = dual(3, isOvershootLoser);

interface AdmissionAttempt<OriginLease> {
  readonly admitted: O.Option<AdmittedState<OriginLease>>;
  readonly originBusy: boolean;
}

const tryAdmitSelf = Effect.fnUntraced(function* <OriginLease, GateError, GateRequirements>(
  directories: AdmissionDirectories,
  request: AdmissionRequest,
  ticket: YeetAdmissionTicket,
  gate: AdmissionOriginGate<OriginLease, GateError, GateRequirements>,
  config: AdmissionConfig
): Effect.fn.Return<
  AdmissionAttempt<OriginLease>,
  QualitySchedulerError | GateError,
  FileSystem.FileSystem | Path.Path | MemoryStats | ChildProcessSpawner.ChildProcessSpawner | GateRequirements
> {
  const originLease = yield* gate.tryAcquire;
  if (O.isNone(originLease)) {
    return { admitted: O.none(), originBusy: true };
  }
  // From here the origin lease is owned: any failure before ownership hands
  // over to the admitted-state finalizer must release it (both review bots
  // flagged the leak on encode/stage/link failures); the overshoot rollback
  // success path releases it explicitly below.
  const selfLease = yield* stageSelfLease(directories, request, ticket, config).pipe(
    Effect.onError(() => gate.release(originLease.value).pipe(Effect.ignore))
  );
  if (O.isNone(selfLease)) {
    yield* gate.release(originLease.value);
    return { admitted: O.none(), originBusy: false };
  }
  return {
    admitted: O.some({
      leasePath: selfLease.value.leasePath,
      lease: selfLease.value.lease,
      originLease: originLease.value,
    }),
    originBusy: false,
  };
});

const stageSelfLease = Effect.fnUntraced(function* (
  directories: AdmissionDirectories,
  request: AdmissionRequest,
  ticket: YeetAdmissionTicket,
  config: AdmissionConfig
): Effect.fn.Return<
  O.Option<{ readonly lease: YeetAdmissionLease; readonly leasePath: string }>,
  QualitySchedulerError,
  FileSystem.FileSystem | Path.Path | MemoryStats | ChildProcessSpawner.ChildProcessSpawner
> {
  const path = yield* Path.Path;
  const nowMillis = yield* Clock.currentTimeMillis;
  const lease = YeetAdmissionLease.make({
    schemaVersion: "yeet-admission-lease/v1",
    pid: ticket.pid,
    procStart: ticket.procStart,
    kind: ticket.kind,
    weightTokens: ticket.weightTokens,
    priority: ticket.priority,
    originKey: ticket.originKey,
    checkoutRoot: ticket.checkoutRoot,
    branch: ticket.branch,
    command: request.command,
    startedAt: yield* DateTime.now.pipe(Effect.map(DateTime.formatIso)),
    admittedAtMillis: nowMillis,
    heartbeatAtMillis: nowMillis,
    enqueuedAtMillis: ticket.enqueuedAtMillis,
    nonce: ticket.nonce,
  });
  const leasePath = path.join(directories.leases, `${ticket.nonce}-${ticket.pid}.lease.json`);
  const created = yield* tryCreateExclusive(leasePath, `${yield* encodeLeaseText(lease)}\n`);
  if (!created) {
    return yield* QualitySchedulerError.make({
      message: `Admission lease ${leasePath} already exists for this ticket; remove it and retry.`,
    });
  }
  const rescanned = yield* scanAdmissionState(directories, false);
  const stats = yield* MemoryStats;
  const capacityNow = admissionCapacityTokensFor(yield* stats.availableGib, config);
  if (isOvershootLoser(rescanned, capacityNow, lease)) {
    const fs = yield* FileSystem.FileSystem;
    yield* fs.remove(leasePath, { force: true }).pipe(Effect.ignore);
    return O.none();
  }
  const scopedLease = YeetAdmissionLease.make({
    ...lease,
    runScope: yield* enterRunScope(ticket.nonce, directories.root),
  });
  yield* refreshHeartbeat(leasePath, yield* encodeLeaseText(scopedLease));
  return O.some({ lease: scopedLease, leasePath });
});

const heartbeatLoop = Effect.fnUntraced(function* (
  leasePath: string,
  lease: YeetAdmissionLease,
  config: AdmissionConfig
): Effect.fn.Return<never, QualitySchedulerError, FileSystem.FileSystem> {
  let current = lease;
  while (true) {
    yield* Effect.sleep(Duration.millis(config.heartbeatSeconds * 1000));
    const nowMillis = yield* Clock.currentTimeMillis;
    current = YeetAdmissionLease.make({ ...current, heartbeatAtMillis: nowMillis });
    yield* refreshHeartbeat(leasePath, yield* encodeLeaseText(current));
  }
});

// One promotion attempt: admit self when first in the shared order and the
// weight fits live capacity; the ticket is removed only after admission.
interface PromotionTickInfo {
  readonly availableGib: number;
  readonly capacityTokens: number;
  readonly nowMillis: number;
  readonly state: LiveAdmissionState;
}

interface PromotionTick<OriginLease> {
  readonly admitted: O.Option<AdmittedState<OriginLease>>;
  readonly info: PromotionTickInfo;
  readonly originBusy: boolean;
}

const tryPromoteTicket = Effect.fnUntraced(function* <OriginLease, GateError, GateRequirements>(
  directories: AdmissionDirectories,
  request: AdmissionRequest,
  ticketPath: string,
  ticket: YeetAdmissionTicket,
  gate: AdmissionOriginGate<OriginLease, GateError, GateRequirements>,
  config: AdmissionConfig
): Effect.fn.Return<
  PromotionTick<OriginLease>,
  QualitySchedulerError | GateError,
  FileSystem.FileSystem | Path.Path | MemoryStats | ChildProcessSpawner.ChildProcessSpawner | GateRequirements
> {
  const state = yield* scanAdmissionState(directories, true);
  const stats = yield* MemoryStats;
  const availableGib = yield* stats.availableGib;
  const capacityTokens = admissionCapacityTokensFor(availableGib, config);
  const nowMillis = yield* Clock.currentTimeMillis;
  const info: PromotionTickInfo = { availableGib, capacityTokens, nowMillis, state };
  if (!selfMayAttempt(state, capacityTokens, nowMillis, config, ticket)) {
    return { admitted: O.none(), info, originBusy: false };
  }
  const attempt = yield* tryAdmitSelf(directories, request, ticket, gate, config);
  if (O.isNone(attempt.admitted)) {
    return { admitted: O.none(), info, originBusy: attempt.originBusy };
  }
  yield* appendAdmissionJournalEvent(
    directories.root,
    AdmissionJournalAdmitted.make({
      schemaVersion: "yeet-admission-journal/v1",
      _tag: "admission-admitted",
      nonce: ticket.nonce,
      pid: ticket.pid,
      procStart: ticket.procStart,
      kind: ticket.kind,
      weightTokens: ticket.weightTokens,
      priority: ticket.priority,
      originKey: ticket.originKey,
      enqueuedAtMillis: ticket.enqueuedAtMillis,
      admittedAtMillis: attempt.admitted.value.lease.admittedAtMillis,
    })
  ).pipe(Effect.catch((error) => Console.warn(`[yeet] admission journal append failed: ${error.message}`)));
  const fs = yield* FileSystem.FileSystem;
  yield* fs.remove(ticketPath, { force: true }).pipe(Effect.ignore);
  return { admitted: attempt.admitted, info, originBusy: false };
});

interface AdmissionWaitProgress {
  readonly escalated: number;
  readonly lastProgressMillis: number;
}

const noteAdmissionWait = Effect.fnUntraced(function* (
  request: AdmissionRequest,
  ticket: YeetAdmissionTicket,
  startMillis: number,
  progress: AdmissionWaitProgress,
  config: AdmissionConfig,
  info: PromotionTickInfo
): Effect.fn.Return<AdmissionWaitProgress, never> {
  const waitedMillis = info.nowMillis - startMillis;
  let next = progress;
  if (info.nowMillis - progress.lastProgressMillis >= config.progressSeconds * 1000) {
    const ordered = A.sort(
      A.map(info.state.tickets, ({ ticket: queued }) => queued),
      ticketOrder(info.nowMillis, config)
    );
    const position =
      1 +
      O.getOrElse(
        A.findFirstIndex(ordered, (queued) => queued.nonce === ticket.nonce),
        () => 0
      );
    yield* admissionProgressReport(
      request,
      info.state,
      info.capacityTokens,
      info.availableGib,
      position,
      waitedMillis,
      info.nowMillis,
      config
    );
    next = { ...next, lastProgressMillis: info.nowMillis };
  }
  const escalation = admissionEscalation(waitedMillis, next.escalated);
  yield* O.match(escalation, {
    onNone: () => Effect.void,
    onSome: (message) => Console.log(message),
  });
  return O.isSome(escalation) ? { ...next, escalated: escalationLevelFor(waitedMillis) } : next;
});

// Interruption is masked around promotion (so a lease and origin lock can
// never be created without their release installed) and restored across the
// sleep, which is where a Ctrl-C lands and unwinds to the ticket finalizer.
const waitForAdmission = Effect.fnUntraced(function* <OriginLease, GateError, GateRequirements>(
  directories: AdmissionDirectories,
  request: AdmissionRequest,
  ticketPath: string,
  initialTicket: YeetAdmissionTicket,
  gate: AdmissionOriginGate<OriginLease, GateError, GateRequirements>,
  config: AdmissionConfig,
  restore: <RestoredA, RestoredE, RestoredR>(
    effect: Effect.Effect<RestoredA, RestoredE, RestoredR>
  ) => Effect.Effect<RestoredA, RestoredE, RestoredR>
): Effect.fn.Return<
  AdmittedState<OriginLease>,
  QualitySchedulerError | GateError,
  FileSystem.FileSystem | Path.Path | MemoryStats | ChildProcessSpawner.ChildProcessSpawner | GateRequirements
> {
  const startMillis = yield* Clock.currentTimeMillis;
  let ticket = initialTicket;
  // Back-dated so the first loop iteration prints the queue position immediately.
  let progress: AdmissionWaitProgress = {
    lastProgressMillis: startMillis - config.progressSeconds * 1000,
    escalated: 0,
  };
  while (true) {
    const tick = yield* tryPromoteTicket(directories, request, ticketPath, ticket, gate, config);
    if (O.isSome(tick.admitted)) {
      return tick.admitted.value;
    }
    progress = yield* noteAdmissionWait(request, ticket, startMillis, progress, config, tick.info);
    yield* restore(Effect.sleep(Duration.millis(config.heartbeatSeconds * 1000)));
    const refreshedMillis = yield* Clock.currentTimeMillis;
    ticket = YeetAdmissionTicket.make({
      ...ticket,
      heartbeatAtMillis: refreshedMillis,
      blockedOnOriginAtMillis: tick.originBusy ? refreshedMillis : ticket.blockedOnOriginAtMillis,
    });
    yield* refreshHeartbeat(ticketPath, yield* encodeTicketText(ticket));
  }
});

const matchActiveRunScope = <Success, Requirements>(
  lease: YeetAdmissionLease,
  options: {
    readonly onNone: () => Effect.Effect<Success, never, Requirements>;
    readonly onSome: (scope: RunScopeRecord) => Effect.Effect<Success, never, Requirements>;
  }
): Effect.Effect<Success, never, Requirements> =>
  pipe(
    O.fromUndefinedOr(lease.runScope),
    O.filter((scope) => RunScopeSupport.is.active(scope.support)),
    O.match(options)
  );

const readLeaseRunScopeTelemetry = (
  lease: YeetAdmissionLease
): Effect.Effect<RunScopeTelemetry, never, ChildProcessSpawner.ChildProcessSpawner> =>
  matchActiveRunScope(lease, {
    onNone: () => Effect.succeed(RunScopeTelemetry.make({})),
    onSome: (scope) => readRunScopeTelemetry(scope.unitName),
  });

const runAdmitted = Effect.fnUntraced(function* <Success, UseError, UseRequirements, OriginLease, GateRequirements>(
  directories: AdmissionDirectories,
  admitted: AdmittedState<OriginLease>,
  releaseOrigin: (lease: OriginLease) => Effect.Effect<void, never, GateRequirements>,
  use: Effect.Effect<Success, UseError, UseRequirements>,
  config: AdmissionConfig,
  restore: <RestoredA, RestoredE, RestoredR>(
    effect: Effect.Effect<RestoredA, RestoredE, RestoredR>
  ) => Effect.Effect<RestoredA, RestoredE, RestoredR>
): Effect.fn.Return<
  Success,
  UseError | QualitySchedulerError,
  UseRequirements | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner | GateRequirements
> {
  return yield* Effect.acquireUseRelease(
    Effect.forkChild(heartbeatLoop(admitted.leasePath, admitted.lease, config)),
    () => restore(use),
    Effect.fnUntraced(function* (heartbeat) {
      yield* Fiber.interrupt(heartbeat);
      const releasedAtMillis = yield* Clock.currentTimeMillis;
      const telemetry = yield* readLeaseRunScopeTelemetry(admitted.lease);
      yield* appendAdmissionJournalEvent(
        directories.root,
        AdmissionJournalReleased.make({
          schemaVersion: "yeet-admission-journal/v1",
          _tag: "admission-released",
          nonce: admitted.lease.nonce,
          pid: admitted.lease.pid,
          releasedAtMillis,
          ...OptionUtils.getSomesStruct({
            memoryPeakBytes: O.fromUndefinedOr(telemetry.memoryPeakBytes),
          }),
        })
      ).pipe(Effect.catch((error) => Console.warn(`[yeet] admission journal append failed: ${error.message}`)));
      const fs = yield* FileSystem.FileSystem;
      yield* fs.remove(admitted.leasePath, { force: true }).pipe(Effect.ignore);
      yield* releaseOrigin(admitted.originLease);
    })
  );
});

/**
 * Run one unit of heavy repository work under machine-wide weighted admission.
 *
 * Enqueues a durable ticket, waits (with visible progress) until the request
 * is first in priority/FIFO order and its token weight fits live capacity,
 * acquires the caller's origin gate, then runs `use` while heartbeating the
 * lease. Ticket, lease, and origin lease are all released on success, failure,
 * and interruption — `Ctrl-C` removes the ticket.
 *
 * **Example** (Reference the admission bracket)
 *
 * ```ts
 * import { withQualityAdmission } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof withQualityAdmission) // "function"
 * ```
 *
 * @param request - Kind, weight, priority, and provenance of the work.
 * @param gate - Origin-scoped gate acquired at promotion time.
 * @param use - The admitted work.
 * @param config - Optional policy override; defaults to chartered D1 values.
 * @returns The result of `use`, guarded by ticket/lease/gate lifecycles.
 * @category admission
 * @since 0.0.0
 */
export const withQualityAdmission = Effect.fn("QualityScheduler.withQualityAdmission")(function* <
  Success,
  UseError,
  UseRequirements,
  OriginLease,
  GateError,
  GateRequirements,
>(
  request: AdmissionRequest,
  gate: AdmissionOriginGate<OriginLease, GateError, GateRequirements>,
  use: Effect.Effect<Success, UseError, UseRequirements>,
  config?: AdmissionConfig
): Effect.fn.Return<
  Success,
  UseError | GateError | QualitySchedulerError,
  | UseRequirements
  | GateRequirements
  | FileSystem.FileSystem
  | Path.Path
  | MemoryStats
  | ChildProcessSpawner.ChildProcessSpawner
> {
  const resolved = config ?? AdmissionConfig.make({});
  const path = yield* Path.Path;
  const stats = yield* MemoryStats;
  // Machines whose installed memory can never reach the requested weight must
  // not wait forever: clamp the weight to the machine ceiling, or fall back to
  // origin-gate-only coordination (the pre-scheduler behavior) when even one
  // token can never be admitted.
  const totalGib = yield* stats.totalGib;
  const machineCeiling = admissionCapacityTokensFor(totalGib, AdmissionConfig.make({ ...resolved, hardFloorGib: 0 }));
  // A host must be able to hold the hard floor PLUS one slot of available
  // memory; kernel and resident overhead keep MemAvailable well below the
  // installed total, so a total near the floor can never admit anything.
  const floorAttainable = totalGib >= resolved.hardFloorGib + resolved.slotSizeGib;
  if (machineCeiling <= 0 || !floorAttainable) {
    yield* Console.log(
      `[yeet] admission: installed memory is below the scheduling envelope; coordinating ${request.kind} through the origin gate only`
    );
    return yield* bypassAdmission(gate, use, resolved);
  }
  const weightTokens = Math.min(request.weightTokens, machineCeiling);
  if (weightTokens < request.weightTokens) {
    yield* Console.log(
      `[yeet] admission: clamping ${request.kind} weight ${request.weightTokens} -> ${weightTokens} (machine ceiling)`
    );
  }
  const admittedRequest = AdmissionRequest.make({ ...request, weightTokens });
  const directories = yield* ensureAdmissionDirectories();
  const nowMillis = yield* Clock.currentTimeMillis;
  const procStart = O.getOrElse(yield* procStartTimeForPid(process.pid), () => "");
  const ticket = YeetAdmissionTicket.make({
    schemaVersion: "yeet-admission-ticket/v1",
    pid: process.pid,
    procStart,
    kind: admittedRequest.kind,
    weightTokens: admittedRequest.weightTokens,
    priority: admittedRequest.priority,
    originKey: admittedRequest.originKey,
    checkoutRoot: admittedRequest.checkoutRoot,
    branch: admittedRequest.branch,
    enqueuedAtMillis: nowMillis,
    heartbeatAtMillis: nowMillis,
    nonce: randomUUID().slice(0, 8),
  });
  const ticketPath = path.join(directories.queue, `${ticket.nonce}-${ticket.pid}.ticket.json`);
  return yield* Effect.uninterruptibleMask((restore) =>
    Effect.acquireUseRelease(
      Effect.gen(function* () {
        const created = yield* tryCreateExclusive(ticketPath, `${yield* encodeTicketText(ticket)}\n`);
        if (!created) {
          return yield* QualitySchedulerError.make({
            message: `Admission ticket ${ticketPath} already exists; remove it and retry.`,
          });
        }
        return ticket;
      }),
      Effect.fnUntraced(function* (enqueued) {
        const admitted = yield* waitForAdmission(
          directories,
          admittedRequest,
          ticketPath,
          enqueued,
          gate,
          resolved,
          restore
        );
        return yield* runAdmitted(directories, admitted, gate.release, use, resolved, restore);
      }),
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.remove(ticketPath, { force: true }).pipe(Effect.ignore);
      })
    )
  );
});

// Origin-gate-only fallback for machines below the scheduling envelope:
// poll the gate until it grants, then run with a guaranteed release.
const bypassAdmission = Effect.fnUntraced(function* <
  Success,
  UseError,
  UseRequirements,
  OriginLease,
  GateError,
  GateRequirements,
>(
  gate: AdmissionOriginGate<OriginLease, GateError, GateRequirements>,
  use: Effect.Effect<Success, UseError, UseRequirements>,
  config: AdmissionConfig
): Effect.fn.Return<Success, UseError | GateError | QualitySchedulerError, UseRequirements | GateRequirements> {
  return yield* Effect.uninterruptibleMask(
    Effect.fnUntraced(function* (restore) {
      let origin = yield* gate.tryAcquire;
      while (O.isNone(origin)) {
        yield* restore(Effect.sleep(Duration.millis(config.heartbeatSeconds * 1000)));
        origin = yield* gate.tryAcquire;
      }
      return yield* Effect.acquireUseRelease(
        Effect.succeed(origin.value),
        () => restore(use),
        (lease) => gate.release(lease)
      );
    })
  );
});

/**
 * Read the current machine-wide admission state without mutating it.
 *
 * **Example** (Reference the status reader)
 *
 * ```ts
 * import { admissionStatus } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof admissionStatus) // "function"
 * ```
 *
 * @param config - Optional policy override; defaults to chartered D1 values.
 * @returns A point-in-time capacity/lease/queue snapshot.
 * @category admission
 * @since 0.0.0
 */
export const admissionStatus = Effect.fn("QualityScheduler.admissionStatus")(function* (
  config?: AdmissionConfig
): Effect.fn.Return<
  AdmissionSnapshot,
  QualitySchedulerError,
  FileSystem.FileSystem | Path.Path | MemoryStats | ChildProcessSpawner.ChildProcessSpawner
> {
  const resolved = config ?? AdmissionConfig.make({});
  const directories = yield* ensureAdmissionDirectories();
  return yield* snapshotAdmissionState(directories, resolved, false);
});

const enrichLeaseRunScopeTelemetry = (
  lease: YeetAdmissionLease
): Effect.Effect<YeetAdmissionLease, never, ChildProcessSpawner.ChildProcessSpawner> =>
  matchActiveRunScope(lease, {
    onNone: () => Effect.succeed(lease),
    onSome: (scope) =>
      readRunScopeTelemetry(scope.unitName).pipe(
        Effect.map((telemetry) =>
          YeetAdmissionLease.make({
            ...lease,
            runScope: RunScopeRecord.make({
              ...scope,
              ...OptionUtils.getSomesStruct({
                memoryPeakBytes: O.fromUndefinedOr(telemetry.memoryPeakBytes),
                tasksCurrent: O.fromUndefinedOr(telemetry.tasksCurrent),
              }),
            }),
          })
        )
      ),
  });

const snapshotAdmissionState = Effect.fnUntraced(function* (
  directories: AdmissionDirectories,
  config: AdmissionConfig,
  repair: boolean
): Effect.fn.Return<
  AdmissionSnapshot,
  QualitySchedulerError,
  FileSystem.FileSystem | Path.Path | MemoryStats | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const state = yield* scanAdmissionState(directories, repair);
  const leases = yield* Effect.forEach(state.leases, ({ lease }) => enrichLeaseRunScopeTelemetry(lease), {
    concurrency: 4,
  });
  const stats = yield* MemoryStats;
  const availableGib = yield* stats.availableGib;
  // Files already moved into quarantine stay on the operator's inspection
  // surface until they are removed by hand.
  const persistedQuarantine = yield* fs
    .readDirectory(directories.quarantine)
    .pipe(Effect.map(A.map((name) => path.join(directories.quarantine, name))), Effect.orElseSucceed(A.empty<string>));
  return AdmissionSnapshot.make({
    capacityTokens: admissionCapacityTokensFor(availableGib, config),
    activeTokens: activeTokenTotal(state),
    memAvailableGib: availableGib,
    hardFloorEngaged: availableGib < config.hardFloorGib,
    leases,
    tickets: A.map(state.tickets, ({ ticket }) => ticket),
    dead: state.dead,
    quarantined: A.appendAll(state.quarantined, persistedQuarantine),
  });
});

const derivedRunScopeUnitName = (lease: YeetAdmissionLease): ReadonlyArray<string> =>
  Str.isNonEmpty(lease.nonce) ? [runScopeUnitName(lease.nonce)] : A.empty();

const recordedRunScopeUnitName = (lease: YeetAdmissionLease): ReadonlyArray<string> =>
  pipe(O.fromUndefinedOr(lease.runScope), O.match({ onNone: A.empty<string>, onSome: (scope) => [scope.unitName] }));

// Only scopes that record this reaper's admission root as owner are candidates:
// a scope from another root (another XDG_RUNTIME_DIR, an env-scrubbed session,
// a test fixture) is someone else's live work, never a leak from here.
const ownedByRoot = (ownerRoot: string) =>
  Effect.fnUntraced(function* (
    unitName: string
  ): Effect.fn.Return<O.Option<string>, never, ChildProcessSpawner.ChildProcessSpawner> {
    const recorded = yield* readRunScopeOwnerRoot(unitName);
    return O.exists(recorded, (root) => root === ownerRoot) ? O.some(unitName) : O.none();
  });

const stopLeakedRunScopes = Effect.fnUntraced(function* (
  state: LiveAdmissionState,
  ownerRoot: string
): Effect.fn.Return<void, never, ChildProcessSpawner.ChildProcessSpawner> {
  // A live lease protects both its recorded unit and the nonce-derived unit,
  // which covers the window before enterRunScope's record reaches the lease.
  const liveUnits = MutableHashSet.fromIterable(
    A.flatMap(state.leases, ({ lease }) => A.appendAll(derivedRunScopeUnitName(lease), recordedRunScopeUnitName(lease)))
  );
  const deadTargets = A.flatMap(state.deadLeases, ({ lease }) =>
    pipe(
      recordedRunScopeUnitName(lease),
      A.match({ onEmpty: () => derivedRunScopeUnitName(lease), onNonEmpty: (recorded) => recorded })
    )
  );
  const unowned = A.filter(yield* listRunScopeUnits(), (unitName) => !MutableHashSet.has(liveUnits, unitName));
  const ownedTargets = A.getSomes(yield* Effect.forEach(unowned, ownedByRoot(ownerRoot), { concurrency: 4 }));
  const targets = MutableHashSet.fromIterable(A.appendAll(deadTargets, ownedTargets));
  yield* Effect.forEach(targets, stopRunScopeForReap, { concurrency: 4, discard: true });
});

/**
 * Reap dead admission state (dead pid or `/proc` start-time mismatch).
 *
 * Dry-run by default: reports what would be removed without touching state.
 *
 * **Example** (Reference the reaper)
 *
 * ```ts
 * import { reapAdmissionState } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof reapAdmissionState) // "function"
 * ```
 *
 * @param options - Pass `apply: true` to actually remove dead state.
 * @returns The post-scan snapshot (after removal when applied).
 * @category admission
 * @since 0.0.0
 */
export const reapAdmissionState = Effect.fn("QualityScheduler.reapAdmissionState")(function* (options: {
  readonly apply: boolean;
}): Effect.fn.Return<
  AdmissionSnapshot,
  QualitySchedulerError,
  FileSystem.FileSystem | Path.Path | MemoryStats | ChildProcessSpawner.ChildProcessSpawner
> {
  const directories = yield* ensureAdmissionDirectories();
  if (options.apply) {
    yield* stopLeakedRunScopes(yield* scanAdmissionState(directories, false), directories.root);
  }
  return yield* snapshotAdmissionState(directories, AdmissionConfig.make({}), options.apply);
});
