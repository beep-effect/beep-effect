/**
 * Machine-wide weighted admission for resource-heavy Yeet work.
 *
 * @since 0.0.0
 */

import { createHash, randomUUID } from "node:crypto";
import { userInfo } from "node:os";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, PosInt } from "@beep/schema";
import { Clock, Console, DateTime, Effect, Fiber, FileSystem, Order, Path, pipe, Schedule } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { withAdmissionWorkloadBinding } from "../../../internal/process/index.ts";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import { buildContestedIndex, parseProcStatStartTime } from "../../Worktree/Fleet.service.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { runGitPathList } from "./GitExec.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/Admission");
const textEncoder = new TextEncoder();

/**
 * Kinds of work governed by the machine-wide admission budget.
 *
 * @category schemas
 */
export const AdmissionKind = LiteralKit(["review-fix", "full-proof", "merged-preview", "publish"]).pipe(
  $I.annoteSchema("AdmissionKind", {
    description: "Resource class used to assign one Yeet admission weight.",
  })
);

/**
 * Decoded admission kind.
 *
 * @category models
 */
export type AdmissionKind = typeof AdmissionKind.Type;

const AdmissionContentionFamily = LiteralKit([
  "goal-portfolio",
  "exploration-atlas",
  "workspace-topology",
  "quality-policy",
  "quality-cli",
]);
type AdmissionContentionFamily = typeof AdmissionContentionFamily.Type;

const admissionOwnerFields = {
  id: S.String,
  pid: PosInt,
  procStart: S.String,
  kind: AdmissionKind,
  weightTokens: PosInt,
  checkoutRoot: S.String,
  branch: S.String,
  hotPaths: S.Array(S.String),
  contentionFamilies: S.Array(AdmissionContentionFamily),
};

class AdmissionWaiter extends S.Class<AdmissionWaiter>($I`AdmissionWaiter`)(
  {
    schemaVersion: S.Literal("yeet-admission-waiter/v1"),
    ...admissionOwnerFields,
    enqueuedAtEpochMs: NonNegativeInt,
  },
  $I.annote("AdmissionWaiter", {
    description: "One FIFO admission request with publish priority and aging metadata.",
  })
) {}

class AdmissionLeaseState extends S.Class<AdmissionLeaseState>($I`AdmissionLeaseState`)(
  {
    schemaVersion: S.Literal("yeet-admission-lease/v1"),
    ...admissionOwnerFields,
    acquiredAt: S.String,
    heartbeatAt: S.String,
  },
  $I.annote("AdmissionLeaseState", {
    description: "One active machine-wide admission lease guarded by PID starttime and heartbeats.",
  })
) {}

class AdmissionLease extends S.Class<AdmissionLease>($I`AdmissionLease`)(
  {
    leasePath: S.String,
    state: AdmissionLeaseState,
    contended: S.Boolean,
    capacityTokens: NonNegativeInt,
  },
  $I.annote("AdmissionLease", {
    description: "Admission lease handle held while one resource-governed operation executes.",
  })
) {}

class AdmissionProcessNotFoundError extends S.TaggedError<AdmissionProcessNotFoundError>(
  $I`AdmissionProcessNotFoundError`
)(
  "AdmissionProcessNotFoundError",
  { processGroupId: PosInt },
  $I.annoteError<AdmissionProcessNotFoundError>("AdmissionProcessNotFoundError", {
    description: "The exact admission workload process group no longer exists.",
  })
) {}

const AdmissionWorkloadPending = S.Struct({
  schemaVersion: S.Literal("yeet-admission-workload/v1"),
  leaseId: S.String,
  status: S.Literal("pending"),
});

const AdmissionWorkloadIdle = S.Struct({
  schemaVersion: S.Literal("yeet-admission-workload/v1"),
  leaseId: S.String,
  status: S.Literal("idle"),
});

const AdmissionWorkloadActive = S.Struct({
  schemaVersion: S.Literal("yeet-admission-workload/v1"),
  leaseId: S.String,
  status: S.Literal("active"),
  processGroupId: PosInt,
  procStart: S.String,
});

const AdmissionWorkloadState = S.Union([AdmissionWorkloadIdle, AdmissionWorkloadPending, AdmissionWorkloadActive]);
type AdmissionWorkloadState = typeof AdmissionWorkloadState.Type;

const AdmissionWaiterJson = JsonStringCodec(AdmissionWaiter);
const AdmissionLeaseJson = JsonStringCodec(AdmissionLeaseState);
const AdmissionWorkloadJson = JsonStringCodec(AdmissionWorkloadState);
const ADMISSION_TOKEN_GIB = 5;
const ADMISSION_RESERVED_GIB = 10;
const ADMISSION_HARD_FLOOR_GIB = 15;
const ADMISSION_MAX_TOKENS = 10;
const ADMISSION_PUBLISH_AGING_MS = 2 * 60 * 1000;
const ADMISSION_PROGRESS_INTERVAL_MS = 10_000;
const ADMISSION_HEARTBEAT_INTERVAL = "15 seconds";
const ADMISSION_PSI_AVG10_LIMIT = 10;
const ADMISSION_MUTEX_STALE_MS = 30_000;
const ADMISSION_WORKLOAD_TERM_GRACE_MS = 3_000;
const ADMISSION_WORKLOAD_KILL_GRACE_MS = 2_000;

const hashAdmissionText = (text: string): string => createHash("sha256").update(text).digest("hex");

/**
 * Return the token weight assigned to one admission kind.
 *
 * @param kind - Admission class to weigh.
 * @returns The number of machine-wide admission tokens required.
 * @category utilities
 */
export const admissionWeight = (kind: AdmissionKind): PosInt =>
  PosInt.make(
    AdmissionKind.$match(kind, {
      "review-fix": () => 1,
      "full-proof": () => 3,
      "merged-preview": () => 5,
      publish: () => 1,
    })
  );

/**
 * Calculate admission capacity from Linux `MemAvailable`, expressed in KiB.
 *
 * @param availableKiB - Linux `MemAvailable` in KiB.
 * @returns The safe number of machine-wide admission tokens.
 * @category utilities
 */
export const admissionCapacityForMemAvailableKiB = (availableKiB: number): NonNegativeInt => {
  const availableGiB = availableKiB / (1024 * 1024);
  return NonNegativeInt.make(
    availableGiB < ADMISSION_HARD_FLOOR_GIB
      ? 0
      : Math.min(ADMISSION_MAX_TOKENS, Math.floor((availableGiB - ADMISSION_RESERVED_GIB) / ADMISSION_TOKEN_GIB))
  );
};

const pathMatches = (path: string, exact: string, prefix: string): boolean =>
  path === exact || Str.startsWith(prefix)(path);

/**
 * Classify changed paths into the hot-file families serialized at publish.
 *
 * @param paths - Repository-relative changed paths.
 * @returns The deduplicated contention families claimed by those paths.
 * @category utilities
 */
export const admissionContentionFamilies = (paths: ReadonlyArray<string>): ReadonlyArray<AdmissionContentionFamily> => {
  const families: Array<AdmissionContentionFamily> = [];
  if (A.some(paths, (path) => Str.startsWith("goals/")(path))) families.push("goal-portfolio");
  if (A.some(paths, (path) => Str.startsWith("explorations/")(path))) families.push("exploration-atlas");
  if (
    A.some(
      paths,
      (path) => path === "package.json" || path === "bun.lock" || /^tsconfig(?:\.[^/]+)?\.json$/u.test(path)
    )
  ) {
    families.push("workspace-topology");
  }
  if (A.some(paths, (path) => Str.startsWith("standards/")(path))) families.push("quality-policy");
  if (
    A.some(paths, (path) =>
      pathMatches(
        path,
        "packages/tooling/tool/cli/src/commands/Quality/Tasks.ts",
        "packages/tooling/tool/cli/test/quality-"
      )
    )
  ) {
    families.push("quality-cli");
  }
  return A.dedupe(families);
};

/**
 * Detect whether two publish surfaces claim a common contention family.
 *
 * @category predicates
 */
export const admissionFamiliesConflict: {
  (right: ReadonlyArray<AdmissionContentionFamily>): (left: ReadonlyArray<AdmissionContentionFamily>) => boolean;
  (left: ReadonlyArray<AdmissionContentionFamily>, right: ReadonlyArray<AdmissionContentionFamily>): boolean;
} = dual(
  2,
  (left: ReadonlyArray<AdmissionContentionFamily>, right: ReadonlyArray<AdmissionContentionFamily>): boolean =>
    A.isReadonlyArrayNonEmpty(
      buildContestedIndex([
        ["left", left],
        ["right", right],
      ])
    )
);

const waiterOrder = Order.mapInput(Order.Number, (waiter: AdmissionWaiter) => waiter.enqueuedAtEpochMs);

const orderAdmissionWaiters = (
  waiters: ReadonlyArray<AdmissionWaiter>,
  nowEpochMs: number
): ReadonlyArray<AdmissionWaiter> => {
  const ordered = A.sort(waiters, waiterOrder);
  const aged = A.filter(ordered, (waiter) => nowEpochMs - waiter.enqueuedAtEpochMs >= ADMISSION_PUBLISH_AGING_MS);
  const fresh = A.filter(ordered, (waiter) => nowEpochMs - waiter.enqueuedAtEpochMs < ADMISSION_PUBLISH_AGING_MS);
  return A.appendAll(
    aged,
    A.appendAll(
      A.filter(fresh, (waiter) => waiter.kind === "publish"),
      A.filter(fresh, (waiter) => waiter.kind !== "publish")
    )
  );
};

/**
 * Select the first waiter in policy order that can run against current leases.
 *
 * **Details**
 *
 * The predicate lets admission skip a blocked contention family without
 * allowing that waiter to reorder otherwise-admissible work behind it.
 *
 * @category scheduling
 */
export const selectFirstAdmissibleAdmissionWaiter: {
  (
    nowEpochMs: number,
    isAdmissible: (waiter: AdmissionWaiter) => boolean
  ): (waiters: ReadonlyArray<AdmissionWaiter>) => O.Option<AdmissionWaiter>;
  (
    waiters: ReadonlyArray<AdmissionWaiter>,
    nowEpochMs: number,
    isAdmissible: (waiter: AdmissionWaiter) => boolean
  ): O.Option<AdmissionWaiter>;
} = dual(
  3,
  (
    waiters: ReadonlyArray<AdmissionWaiter>,
    nowEpochMs: number,
    isAdmissible: (waiter: AdmissionWaiter) => boolean
  ): O.Option<AdmissionWaiter> => A.findFirst(orderAdmissionWaiters(waiters, nowEpochMs), isAdmissible)
);

/**
 * Select the next waiter under publish priority with two-minute FIFO aging.
 *
 * @category scheduling
 */
export const selectAdmissionWaiter: {
  (nowEpochMs: number): (waiters: ReadonlyArray<AdmissionWaiter>) => O.Option<AdmissionWaiter>;
  (waiters: ReadonlyArray<AdmissionWaiter>, nowEpochMs: number): O.Option<AdmissionWaiter>;
} = dual(
  2,
  (waiters: ReadonlyArray<AdmissionWaiter>, nowEpochMs: number): O.Option<AdmissionWaiter> =>
    selectFirstAdmissibleAdmissionWaiter(waiters, nowEpochMs, () => true)
);

const admissionRuntimeRoot = Effect.fn("Admission.runtimeRoot")(function* () {
  const path = yield* Path.Path;
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: Declared in turbo.json global.passThroughEnv.
  const configured = Bun.env.XDG_RUNTIME_DIR;
  return configured !== undefined && path.isAbsolute(configured)
    ? path.join(configured, "beep", "admit")
    : path.join("/tmp", `beep-${userInfo().uid}`, "admit");
});

const ensurePrivateDirectory = Effect.fn("Admission.ensurePrivateDirectory")(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(directory, { recursive: true, mode: 0o700 });
  const [observed, real] = yield* Effect.all([fs.stat(directory), fs.realPath(directory)]);
  if (observed.type !== "Directory" || path.normalize(real) !== path.normalize(directory)) {
    return yield* YeetCommandError.make({ message: `Unsafe admission directory ${directory}.` });
  }
  if (O.exists(observed.uid, (uid) => uid !== userInfo().uid)) {
    return yield* YeetCommandError.make({ message: `Admission directory ${directory} is owned by another user.` });
  }
  if ((observed.mode & 0o077) !== 0) yield* fs.chmod(directory, 0o700);
});

const procStartForPid = Effect.fn("Admission.procStartForPid")(function* (pid: number) {
  const fs = yield* FileSystem.FileSystem;
  const statPath = `/proc/${pid}/stat`;
  const exists = yield* fs.exists(statPath).pipe(Effect.orElseSucceed(() => false));
  if (!exists) return { status: "dead" as const, start: O.none<string>() };
  const stat = yield* fs.readFileString(statPath).pipe(Effect.option);
  return O.match(stat, {
    onNone: () => ({ status: "unknown" as const, start: O.none<string>() }),
    onSome: (text) => ({ status: "observed" as const, start: parseProcStatStartTime(text) }),
  });
});

const processGenerationAlive = Effect.fn("Admission.processGenerationAlive")(function* (
  pid: number,
  procStart: string
) {
  const observed = yield* procStartForPid(pid);
  return observed.status === "unknown" || O.exists(observed.start, (start) => start === procStart);
});

const requireProcessGeneration = Effect.fn("Admission.requireProcessGeneration")(function* (
  pid: number,
  description: string
) {
  const observed = yield* procStartForPid(pid);
  if (observed.status === "observed" && O.isSome(observed.start)) return observed.start.value;
  return yield* YeetCommandError.make({
    message: `Could not read the exact process generation for ${description} pid ${pid}; ownership acquisition failed closed.`,
  });
});

/**
 * Read an exact process generation through the production fail-closed path.
 *
 * @category testing
 */
export const requireAdmissionProcessGenerationForTesting = requireProcessGeneration;

const writeExclusive = Effect.fn("Admission.writeExclusive")(function* (filePath: string, text: string) {
  const fs = yield* FileSystem.FileSystem;
  const temporaryPath = `${filePath}.${process.pid}-${randomUUID()}.tmp`;
  yield* fs
    .writeFile(temporaryPath, textEncoder.encode(text), { flag: "wx", mode: 0o600 })
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to prepare admission record for ${filePath}.`)));
  return yield* fs.link(temporaryPath, filePath).pipe(
    Effect.as(true),
    Effect.catchTag("PlatformError", (error) =>
      error.reason._tag === "AlreadyExists"
        ? Effect.succeed(false)
        : Effect.fail(YeetCommandError.new(`Failed to atomically publish admission record at ${filePath}.`)(error))
    ),
    Effect.ensuring(fs.remove(temporaryPath).pipe(Effect.ignore))
  );
});

type AdmissionMutexLease = { readonly path: string; readonly ownerText: string };

const readAdmissionFile = Effect.fn("Admission.readFile")(function* (filePath: string, description: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(filePath).pipe(
    Effect.map(O.some),
    Effect.catchTag("PlatformError", (error) =>
      error.reason._tag === "NotFound"
        ? Effect.succeed(O.none<string>())
        : Effect.fail(YeetCommandError.new(`Failed to read ${description} at ${filePath}.`)(error))
    )
  );
});

const admissionMutexOwner = (text: string): O.Option<readonly [pid: number, procStart: string]> => {
  const fields = Str.split(text, "\n");
  const pid = globalThis.Number.parseInt(fields[0] ?? "", 10);
  const procStart = fields[1] ?? "";
  return globalThis.Number.isFinite(pid) && Str.isNonEmpty(procStart) ? O.some([pid, procStart] as const) : O.none();
};

const reclaimClaimPath = (mutexPath: string, observedText: string): string =>
  `${mutexPath}.reap-${hashAdmissionText(observedText)}.claim`;

const tryReclaimObservedMutex = Effect.fn("Admission.tryReclaimObservedMutex")(function* (
  mutexPath: string,
  observedText: string,
  replacementText: string
) {
  const fs = yield* FileSystem.FileSystem;
  const claimPath = reclaimClaimPath(mutexPath, observedText);
  if (!(yield* writeExclusive(claimPath, replacementText))) {
    const claim = yield* readAdmissionFile(claimPath, "admission mutex reclamation claim");
    if (O.isNone(claim)) return false;
    const owner = admissionMutexOwner(claim.value);
    if (O.isNone(owner)) {
      return yield* YeetCommandError.make({
        message: `Admission found an unreadable mutex reclamation claim at ${claimPath}; reclamation failed closed. Remove it only after confirming no admission contender is active.`,
      });
    }
    if (!(yield* processGenerationAlive(owner.value[0], owner.value[1]))) {
      return yield* YeetCommandError.make({
        message: `Admission found a dead-owner mutex reclamation claim at ${claimPath}; reclamation failed closed. Remove it only after confirming no admission contender is active.`,
      });
    }
    return false;
  }

  return yield* Effect.gen(function* () {
    const current = yield* readAdmissionFile(mutexPath, "admission mutex");
    if (O.isNone(current) || !Str.Equivalence(current.value, observedText)) return false;
    const reapedPath = `${mutexPath}.reaped-${process.pid}-${randomUUID()}`;
    const moved = yield* fs.rename(mutexPath, reapedPath).pipe(
      Effect.as(true),
      Effect.catchTag("PlatformError", (error) =>
        error.reason._tag === "NotFound"
          ? Effect.succeed(false)
          : Effect.fail(YeetCommandError.new(`Failed to atomically reclaim admission mutex at ${mutexPath}.`)(error))
      )
    );
    if (!moved) return false;
    yield* fs
      .remove(reapedPath)
      .pipe(
        Effect.catchTag("PlatformError", (error) =>
          error.reason._tag === "NotFound"
            ? Effect.void
            : Effect.fail(YeetCommandError.new(`Failed to remove reclaimed admission mutex at ${reapedPath}.`)(error))
        )
      );
    return yield* writeExclusive(mutexPath, replacementText);
  }).pipe(Effect.ensuring(fs.remove(claimPath).pipe(Effect.ignore)));
});

/**
 * Attempt to replace exactly one observed admission-mutex generation.
 *
 * **Details**
 *
 * This test seam exercises the same observation-bound claim used by live
 * admission contenders.
 *
 * @category testing
 */
export const tryReclaimObservedAdmissionMutexForTesting = tryReclaimObservedMutex;

/**
 * Atomically publish one complete admission record without replacing a peer.
 *
 * **Details**
 *
 * This test seam exposes the hard-link commit used by waiter, lease, and mutex
 * records. `false` means the final path already existed.
 *
 * @category testing
 */
export const writeAdmissionRecordExclusiveForTesting = writeExclusive;

const tryAcquireMutex = Effect.fn("Admission.tryAcquireMutex")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const mutexPath = path.join(root, "mutex.lock");
  const procStart = yield* requireProcessGeneration(process.pid, "admission mutex owner");
  const ownerText = `${process.pid}\n${procStart}\n`;
  if (yield* writeExclusive(mutexPath, ownerText)) return O.some<AdmissionMutexLease>({ path: mutexPath, ownerText });

  const now = yield* Clock.currentTimeMillis;
  const owner = yield* readAdmissionFile(mutexPath, "admission mutex");
  if (O.isNone(owner)) return O.none<AdmissionMutexLease>();
  const info = yield* fs.stat(mutexPath).pipe(
    Effect.map((value) => ({ _tag: "Found" as const, value })),
    Effect.catchTag("PlatformError", (error) =>
      error.reason._tag === "NotFound"
        ? Effect.succeed({ _tag: "Missing" as const })
        : Effect.fail(YeetCommandError.new(`Failed to inspect admission mutex at ${mutexPath}.`)(error))
    )
  );
  if (info._tag === "Missing") return O.none<AdmissionMutexLease>();
  const ageMs = pipe(
    info.value.mtime,
    O.map((mtime) => now - mtime.getTime()),
    O.getOrElse(() => 0)
  );
  if (ageMs < ADMISSION_MUTEX_STALE_MS) return O.none<AdmissionMutexLease>();

  const observedOwner = admissionMutexOwner(owner.value);
  if (O.isNone(observedOwner)) {
    return yield* YeetCommandError.make({
      message: `Admission found an unreadable stale mutex at ${mutexPath}; reclamation failed closed. Remove it only after confirming no admission contender is active.`,
    });
  }
  const stale = !(yield* processGenerationAlive(observedOwner.value[0], observedOwner.value[1]));
  if (stale && (yield* tryReclaimObservedMutex(mutexPath, owner.value, ownerText))) {
    return O.some<AdmissionMutexLease>({ path: mutexPath, ownerText });
  }
  return O.none<AdmissionMutexLease>();
});

const releaseMutex = Effect.fn("Admission.releaseMutex")(function* (lease: AdmissionMutexLease) {
  const fs = yield* FileSystem.FileSystem;
  const observed = yield* fs.readFileString(lease.path).pipe(Effect.option);
  if (O.exists(observed, (text) => text === lease.ownerText)) yield* fs.remove(lease.path).pipe(Effect.ignore);
});

const acquireMutex = Effect.fn("Admission.acquireMutex")(function* (root: string) {
  while (true) {
    const lease = yield* tryAcquireMutex(root);
    if (O.isSome(lease)) return lease.value;
    yield* Effect.sleep("100 millis");
  }
});

const withAdmissionMutex = <A, E, R>(
  root: string,
  use: Effect.Effect<A, E, R>
): Effect.Effect<A, E | YeetCommandError, R | FileSystem.FileSystem | Path.Path> =>
  Effect.acquireUseRelease(acquireMutex(root), () => use, releaseMutex);

type DecodedRows<Value> = { readonly values: ReadonlyArray<Value> };

const quarantineUnreadableAdmissionRow = Effect.fn("Admission.quarantineUnreadableRow")(function* (
  directory: string,
  name: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const sourcePath = path.join(directory, name);
  const quarantineDirectory = path.join(directory, "quarantine");
  const quarantinePath = path.join(quarantineDirectory, `${name}.${randomUUID()}.invalid`);
  yield* fs
    .makeDirectory(quarantineDirectory, { recursive: true, mode: 0o700 })
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to create admission quarantine at ${quarantineDirectory}.`)));
  const moved = yield* fs.rename(sourcePath, quarantinePath).pipe(
    Effect.as(true),
    Effect.catchTag("PlatformError", (error) =>
      error.reason._tag === "NotFound"
        ? Effect.succeed(false)
        : Effect.fail(YeetCommandError.new(`Failed to quarantine unreadable admission row at ${sourcePath}.`)(error))
    )
  );
  if (!moved) return;
  return yield* YeetCommandError.make({
    message: `Admission quarantined an unreadable row from ${sourcePath} to ${quarantinePath}; rerun after checking that no legacy admission process is active.`,
    file: quarantinePath,
  });
});

const readSchemaFiles = Effect.fn("Admission.readSchemaFiles")(function* <Value>(
  directory: string,
  decode: (text: string) => O.Option<Value>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const names = yield* fs
    .readDirectory(directory)
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to list admission records in ${directory}.`)));
  const rows = yield* Effect.forEach(A.filter(names, Str.endsWith(".json")), (name) =>
    readAdmissionFile(path.join(directory, name), "admission record").pipe(
      Effect.flatMap(
        O.match({
          onNone: () => Effect.succeed(O.none<Value>()),
          onSome: (text) => {
            const decoded = decode(text);
            return O.isSome(decoded)
              ? Effect.succeed(decoded)
              : quarantineUnreadableAdmissionRow(directory, name).pipe(Effect.as(O.none<Value>()));
          },
        })
      )
    )
  );
  return {
    values: A.getSomes(rows),
  } satisfies DecodedRows<Value>;
});

/**
 * Read waiter rows through the production quarantine path.
 *
 * **Details**
 *
 * The helper exists so malformed-row recovery remains covered without exposing
 * the private waiter schema through the runtime command surface.
 *
 * @param directory - Admission waiter directory to inspect.
 * @returns An effect yielding every decoded waiter row that remains readable.
 * @category testing
 * @since 0.0.0
 */
export const readAdmissionWaiterRowsForTesting = (directory: string) =>
  readSchemaFiles(directory, AdmissionWaiterJson.decodeOption);

const admissionWorkloadPath = (leasePath: string): string => `${leasePath}.workload`;

const writeIdleAdmissionWorkload = Effect.fn("Admission.writeIdleWorkload")(function* (
  leasePath: string,
  leaseId: string
) {
  const workloadPath = admissionWorkloadPath(leasePath);
  const text = yield* AdmissionWorkloadJson.encode({
    schemaVersion: "yeet-admission-workload/v1",
    leaseId,
    status: "idle",
  }).pipe(Effect.mapError(YeetCommandError.new(`Failed to encode admission workload ${leaseId}.`)));
  if (!(yield* writeExclusive(workloadPath, `${text}\n`))) {
    return yield* YeetCommandError.make({
      message: `Admission workload generation already exists at ${workloadPath}.`,
      file: workloadPath,
    });
  }
  return workloadPath;
});

/**
 * Write the idle workload marker used before the first admitted subprocess.
 *
 * **Details**
 *
 * StepExec replaces this marker with pending before spawn. A dead owner with an
 * idle marker has no detached process group to terminate.
 *
 * @category testing
 */
export const writeIdleAdmissionWorkloadForTesting = writeIdleAdmissionWorkload;

const isNoSuchProcess = (cause: unknown): boolean =>
  cause instanceof Error && "code" in cause && cause.code === "ESRCH";

const processGroupAlive = Effect.fn("Admission.processGroupAlive")(function* (processGroupId: number) {
  return yield* Effect.try({
    try: () => {
      process.kill(-processGroupId, 0);
      return true;
    },
    catch: (cause) =>
      isNoSuchProcess(cause)
        ? AdmissionProcessNotFoundError.make({ processGroupId: PosInt.make(processGroupId) })
        : YeetCommandError.new(`Failed to inspect admission workload process group ${processGroupId}.`)(cause),
  }).pipe(Effect.catchTag("AdmissionProcessNotFoundError", () => Effect.succeed(false)));
});

const signalProcessGroup = Effect.fn("Admission.signalProcessGroup")(function* (
  processGroupId: number,
  signal: NodeJS.Signals
) {
  return yield* Effect.try({
    try: () => {
      process.kill(-processGroupId, signal);
      return true;
    },
    catch: (cause) =>
      isNoSuchProcess(cause)
        ? AdmissionProcessNotFoundError.make({ processGroupId: PosInt.make(processGroupId) })
        : YeetCommandError.new(`Failed to signal admission workload process group ${processGroupId} with ${signal}.`)(
            cause
          ),
  }).pipe(Effect.catchTag("AdmissionProcessNotFoundError", () => Effect.succeed(false)));
});

const waitForProcessGroupExit = Effect.fn("Admission.waitForProcessGroupExit")(function* (
  processGroupId: number,
  timeoutMs: number
) {
  const startedAt = yield* Clock.currentTimeMillis;
  while (yield* processGroupAlive(processGroupId)) {
    const now = yield* Clock.currentTimeMillis;
    if (now - startedAt >= timeoutMs) return false;
    yield* Effect.sleep("100 millis");
  }
  return true;
});

const removeAdmissionFile = Effect.fn("Admission.removeFile")(function* (filePath: string, description: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs
    .remove(filePath)
    .pipe(
      Effect.catchTag("PlatformError", (error) =>
        error.reason._tag === "NotFound"
          ? Effect.void
          : Effect.fail(YeetCommandError.new(`Failed to remove ${description} at ${filePath}.`)(error))
      )
    );
});

const retireAdmissionGenerationFiles = Effect.fn("Admission.retireGenerationFiles")(function* (leasePath: string) {
  yield* removeAdmissionFile(leasePath, "admission lease");
  yield* removeAdmissionFile(admissionWorkloadPath(leasePath), "admission workload companion");
});

/**
 * Retire an admission generation in the production crash-consistent order.
 *
 * @category testing
 */
export const retireAdmissionGenerationFilesForTesting = retireAdmissionGenerationFiles;

const reapAdmissionWorkload = Effect.fn("Admission.reapWorkload")(function* (
  leaseDirectory: string,
  lease: AdmissionLeaseState
) {
  const path = yield* Path.Path;
  const leasePath = path.join(leaseDirectory, `${lease.id}.json`);
  const workloadPath = admissionWorkloadPath(leasePath);
  const workloadText = yield* readAdmissionFile(workloadPath, "admission workload companion");
  if (O.isNone(workloadText)) {
    return yield* YeetCommandError.make({
      message: `Admission owner ${lease.id} is dead but workload companion ${workloadPath} is missing; token reclamation failed closed. Confirm the detached workload is gone before removing the lease.`,
    });
  }
  const workload = AdmissionWorkloadJson.decodeOption(workloadText.value);
  if (O.isNone(workload) || workload.value.leaseId !== lease.id) {
    return yield* YeetCommandError.make({
      message: `Admission owner ${lease.id} has an unreadable or mismatched workload companion at ${workloadPath}; token reclamation failed closed.`,
      file: workloadPath,
    });
  }
  if (workload.value.status === "idle") {
    return;
  }
  if (workload.value.status === "pending") {
    return yield* YeetCommandError.make({
      message: `Admission owner ${lease.id} died while workload registration at ${workloadPath} was pending; token reclamation failed closed because detached-process ownership is unknown.`,
      file: workloadPath,
    });
  }

  const processGroupId = workload.value.processGroupId;
  const observed = yield* procStartForPid(processGroupId);
  const exactLeader = observed.status === "observed" && O.contains(observed.start, workload.value.procStart);
  if (!exactLeader) {
    if (yield* processGroupAlive(processGroupId)) {
      return yield* YeetCommandError.make({
        message: `Admission workload process group ${processGroupId} still exists but its leader generation no longer matches ${workload.value.procStart}; token reclamation failed closed.`,
        file: workloadPath,
      });
    }
    return;
  }

  yield* signalProcessGroup(processGroupId, "SIGTERM");
  if (!(yield* waitForProcessGroupExit(processGroupId, ADMISSION_WORKLOAD_TERM_GRACE_MS))) {
    yield* signalProcessGroup(processGroupId, "SIGKILL");
    if (!(yield* waitForProcessGroupExit(processGroupId, ADMISSION_WORKLOAD_KILL_GRACE_MS))) {
      return yield* YeetCommandError.make({
        message: `Admission workload process group ${processGroupId} survived SIGTERM and SIGKILL; token reclamation failed closed.`,
        file: workloadPath,
      });
    }
  }
});

const reapDeadOwners = Effect.fn("Admission.reapDeadOwners")(function* <
  Value extends { readonly id: string; readonly pid: number; readonly procStart: string },
>(directory: string, rows: DecodedRows<Value>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const live: Array<Value> = [];
  for (const value of rows.values) {
    if (yield* processGenerationAlive(value.pid, value.procStart)) {
      live.push(value);
    } else {
      yield* fs.remove(path.join(directory, `${value.id}.json`)).pipe(Effect.ignore);
    }
  }
  return { values: live } satisfies DecodedRows<Value>;
});

const reapDeadLeaseOwners = Effect.fn("Admission.reapDeadLeaseOwners")(function* (
  directory: string,
  rows: DecodedRows<AdmissionLeaseState>
) {
  const path = yield* Path.Path;
  const live: Array<AdmissionLeaseState> = [];
  for (const value of rows.values) {
    if (yield* processGenerationAlive(value.pid, value.procStart)) {
      live.push(value);
    } else {
      yield* reapAdmissionWorkload(directory, value);
      const leasePath = path.join(directory, `${value.id}.json`);
      yield* retireAdmissionGenerationFiles(leasePath);
    }
  }
  return { values: live } satisfies DecodedRows<AdmissionLeaseState>;
});

const memAvailableKiB = Effect.fn("Admission.memAvailableKiB")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString("/proc/meminfo").pipe(Effect.orElseSucceed(() => ""));
  const line = A.findFirst(Str.split(text, "\n"), Str.startsWith("MemAvailable:"));
  return pipe(
    line,
    O.flatMap((value) => O.fromNullishOr(/MemAvailable:\s+(\d+)\s+kB/u.exec(value)?.[1])),
    O.map((value) => globalThis.Number.parseInt(value, 10)),
    O.filter(globalThis.Number.isFinite),
    O.getOrElse(() => 0)
  );
});

const memoryPsiAvg10 = Effect.fn("Admission.memoryPsiAvg10")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString("/proc/pressure/memory").pipe(Effect.orElseSucceed(() => ""));
  const some = A.findFirst(Str.split(text, "\n"), Str.startsWith("some "));
  return pipe(
    some,
    O.flatMap((line) => O.fromNullishOr(/\bavg10=([0-9.]+)/u.exec(line)?.[1])),
    O.map((value) => globalThis.Number.parseFloat(value)),
    O.filter(globalThis.Number.isFinite),
    O.getOrElse(() => 0)
  );
});

const changedPaths = Effect.fn("Admission.changedPaths")(function* (
  context: RepoRunContext
): Effect.fn.Return<ReadonlyArray<string>, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const commands: ReadonlyArray<ReadonlyArray<string>> = [
    ["diff", "--name-only", "-z", `${context.base}...HEAD`],
    ["diff", "--name-only", "-z"],
    ["diff", "--cached", "--name-only", "-z"],
    ["ls-files", "--others", "--exclude-standard", "-z"],
  ];
  const paths = yield* Effect.forEach(commands, (args) => runGitPathList(context.repoRoot, args), { concurrency: 1 });
  return A.dedupe(A.flatten(paths));
});

/**
 * Collect admission hot paths through the production fail-closed Git boundary.
 *
 * @category testing
 */
export const collectAdmissionChangedPathsForTesting = changedPaths;

type AdmissionAttempt = {
  readonly lease: O.Option<AdmissionLease>;
  readonly queuePosition: number;
  readonly usedTokens: number;
  readonly capacityTokens: NonNegativeInt;
  readonly memAvailableGiB: number;
  readonly psiAvg10: number;
  readonly reason: string;
};

const admissionBlockReason = (conditions: {
  readonly selectedSelf: boolean;
  readonly fits: boolean;
  readonly pressureSafe: boolean;
  readonly reviewSlot: boolean;
  readonly familyConflict: boolean;
}): O.Option<string> => {
  if (!conditions.fits) return O.some("token capacity");
  if (!conditions.pressureSafe) return O.some("memory PSI watermark");
  if (!conditions.reviewSlot) return O.some("three review-fix slots are active");
  if (conditions.familyConflict) return O.some("contention family overlap");
  if (!conditions.selectedSelf) return O.some("FIFO/priority queue");
  return O.none();
};

const blockedAdmissionAttempt = (
  reason: string,
  queuePosition: number,
  usedTokens: number,
  capacityTokens: NonNegativeInt,
  availableKiB: number,
  psiAvg10: number
): AdmissionAttempt => ({
  lease: O.none<AdmissionLease>(),
  queuePosition,
  usedTokens,
  capacityTokens,
  memAvailableGiB: availableKiB / (1024 * 1024),
  psiAvg10,
  reason,
});

const persistAdmissionLease = Effect.fn("Admission.persistLease")(function* (input: {
  readonly waiter: AdmissionWaiter;
  readonly waiterDir: string;
  readonly leaseDir: string;
  readonly contended: boolean;
  readonly queuePosition: number;
  readonly usedTokens: number;
  readonly capacityTokens: NonNegativeInt;
  readonly availableKiB: number;
  readonly psiAvg10: number;
}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const timestamp = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const state = AdmissionLeaseState.make({
    schemaVersion: "yeet-admission-lease/v1",
    id: input.waiter.id,
    pid: input.waiter.pid,
    procStart: input.waiter.procStart,
    kind: input.waiter.kind,
    weightTokens: input.waiter.weightTokens,
    checkoutRoot: input.waiter.checkoutRoot,
    branch: input.waiter.branch,
    hotPaths: input.waiter.hotPaths,
    contentionFamilies: input.waiter.contentionFamilies,
    acquiredAt: timestamp,
    heartbeatAt: timestamp,
  });
  const text = yield* AdmissionLeaseJson.encode(state);
  const leasePath = path.join(input.leaseDir, `${input.waiter.id}.json`);
  if (!(yield* writeExclusive(leasePath, `${text}\n`))) {
    return yield* YeetCommandError.make({
      message: `Admission lease generation already exists at ${leasePath}.`,
    });
  }
  yield* fs.remove(path.join(input.waiterDir, `${input.waiter.id}.json`)).pipe(Effect.ignore);
  return {
    lease: O.some(
      AdmissionLease.make({
        leasePath,
        state,
        contended: input.contended,
        capacityTokens: input.capacityTokens,
      })
    ),
    queuePosition: input.queuePosition,
    usedTokens: input.usedTokens,
    capacityTokens: input.capacityTokens,
    memAvailableGiB: input.availableKiB / (1024 * 1024),
    psiAvg10: input.psiAvg10,
    reason: "admitted",
  } satisfies AdmissionAttempt;
});

const tryAdmitWithinMutex = Effect.fn("Admission.tryAdmitWithinMutex")(function* (
  root: string,
  waiter: AdmissionWaiter
) {
  const path = yield* Path.Path;
  const waiterDir = path.join(root, "waiters");
  const leaseDir = path.join(root, "leases");
  const waiters = yield* readSchemaFiles(waiterDir, AdmissionWaiterJson.decodeOption).pipe(
    Effect.flatMap((rows) => reapDeadOwners(waiterDir, rows))
  );
  const leases = yield* readSchemaFiles(leaseDir, AdmissionLeaseJson.decodeOption).pipe(
    Effect.flatMap((rows) => reapDeadLeaseOwners(leaseDir, rows))
  );
  const now = yield* Clock.currentTimeMillis;
  const usedTokens = A.reduce(leases.values, 0, (total, lease) => total + lease.weightTokens);
  const availableKiB = yield* memAvailableKiB();
  const capacityTokens = admissionCapacityForMemAvailableKiB(availableKiB);
  const psiAvg10 = yield* memoryPsiAvg10();
  const orderedWaiters = A.sort(waiters.values, waiterOrder);
  const queuePosition = pipe(
    A.findFirstIndex(orderedWaiters, (row) => row.id === waiter.id),
    O.map((index) => index + 1),
    O.getOrElse(() => 1)
  );
  const reviewFixCount = A.length(A.filter(leases.values, (lease) => lease.kind === "review-fix"));
  const conflictsWithActiveFamily = (candidate: AdmissionWaiter): boolean =>
    A.some(leases.values, (lease) => admissionFamiliesConflict(candidate.contentionFamilies, lease.contentionFamilies));
  const fitsCapacity = (candidate: AdmissionWaiter): boolean => usedTokens + candidate.weightTokens <= capacityTokens;
  const hasReviewSlot = (candidate: AdmissionWaiter): boolean => candidate.kind !== "review-fix" || reviewFixCount < 3;
  const pressureSafe = psiAvg10 < ADMISSION_PSI_AVG10_LIMIT;
  const selected = selectFirstAdmissibleAdmissionWaiter(
    waiters.values,
    now,
    (candidate) =>
      fitsCapacity(candidate) && pressureSafe && hasReviewSlot(candidate) && !conflictsWithActiveFamily(candidate)
  );
  const familyConflict = conflictsWithActiveFamily(waiter);
  const selectedSelf = O.exists(selected, (candidate) => candidate.id === waiter.id);
  const fits = fitsCapacity(waiter);
  const reviewSlot = hasReviewSlot(waiter);
  const reason = admissionBlockReason({
    selectedSelf,
    fits,
    pressureSafe,
    reviewSlot,
    familyConflict,
  });
  if (O.isSome(reason)) {
    return blockedAdmissionAttempt(reason.value, queuePosition, usedTokens, capacityTokens, availableKiB, psiAvg10);
  }
  return yield* persistAdmissionLease({
    waiter,
    waiterDir,
    leaseDir,
    contended: A.isReadonlyArrayNonEmpty(leases.values),
    queuePosition,
    usedTokens,
    capacityTokens,
    availableKiB,
    psiAvg10,
  });
});

const tryAdmit = Effect.fn("Admission.tryAdmit")((root: string, waiter: AdmissionWaiter) =>
  withAdmissionMutex(root, tryAdmitWithinMutex(root, waiter))
);

const writeWaiter = Effect.fn("Admission.writeWaiter")(function* (root: string, waiter: AdmissionWaiter) {
  const path = yield* Path.Path;
  const text = yield* AdmissionWaiterJson.encode(waiter);
  const waiterPath = path.join(root, "waiters", `${waiter.id}.json`);
  if (!(yield* writeExclusive(waiterPath, `${text}\n`))) {
    return yield* YeetCommandError.make({
      message: `Admission waiter generation already exists at ${waiterPath}.`,
    });
  }
  return waiterPath;
});

const acquireAdmissionLease = Effect.fn("Admission.acquire")(function* (
  context: RepoRunContext,
  kind: AdmissionKind,
  weightTokens: PosInt
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* admissionRuntimeRoot();
  yield* ensurePrivateDirectory(root);
  yield* ensurePrivateDirectory(path.join(root, "waiters"));
  yield* ensurePrivateDirectory(path.join(root, "leases"));
  const hotPaths = yield* changedPaths(context);
  const procStart = yield* requireProcessGeneration(process.pid, "admission lease owner");
  const now = yield* Clock.currentTimeMillis;
  const waiter = AdmissionWaiter.make({
    schemaVersion: "yeet-admission-waiter/v1",
    id: randomUUID(),
    pid: PosInt.make(process.pid),
    procStart,
    kind,
    weightTokens,
    checkoutRoot: context.repoRoot,
    branch: context.branch,
    hotPaths,
    contentionFamilies: kind === "publish" ? admissionContentionFamilies(hotPaths) : [],
    enqueuedAtEpochMs: NonNegativeInt.make(now),
  });
  const waiterPath = yield* writeWaiter(root, waiter);
  let lastProgressAt = 0;
  return yield* Effect.gen(function* () {
    while (true) {
      const attempt = yield* tryAdmit(root, waiter);
      if (O.isSome(attempt.lease)) {
        yield* Console.log(
          `[admit] ${kind} acquired ${waiter.weightTokens}/${attempt.capacityTokens} token(s)` +
            `; Check c2 safe profile${attempt.lease.value.contended ? ", contended" : ", currently solo"}`
        );
        return attempt.lease.value;
      }
      const current = yield* Clock.currentTimeMillis;
      if (current - lastProgressAt >= ADMISSION_PROGRESS_INTERVAL_MS) {
        yield* Console.log(
          `[admit] ${kind} waiting at queue position ${attempt.queuePosition}: ${attempt.reason}; ` +
            `${attempt.usedTokens}/${attempt.capacityTokens} tokens active, ` +
            `MemAvailable=${attempt.memAvailableGiB.toFixed(1)}GiB, PSI avg10=${attempt.psiAvg10.toFixed(2)}`
        );
        lastProgressAt = current;
      }
      yield* Effect.sleep("1 second");
    }
  }).pipe(Effect.ensuring(fs.remove(waiterPath).pipe(Effect.ignore)));
});

const heartbeatAdmissionLease = Effect.fn("Admission.heartbeat")(function* (lease: AdmissionLease) {
  const fs = yield* FileSystem.FileSystem;
  const heartbeatAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const state = AdmissionLeaseState.make({ ...lease.state, heartbeatAt });
  const text = yield* AdmissionLeaseJson.encode(state);
  if (!(yield* fs.exists(lease.leasePath))) return;
  const temporary = `${lease.leasePath}.${randomUUID()}.tmp`;
  yield* fs.writeFileString(temporary, `${text}\n`, { mode: 0o600 });
  yield* fs.rename(temporary, lease.leasePath);
});

const releaseAdmissionLease = Effect.fn("Admission.release")(function* (lease: AdmissionLease) {
  const observed = yield* readAdmissionFile(lease.leasePath, "admission lease");
  if (
    O.exists(observed, (text) =>
      O.exists(AdmissionLeaseJson.decodeOption(text), (state) => state.id === lease.state.id)
    )
  ) {
    yield* retireAdmissionGenerationFiles(lease.leasePath);
  }
});

const acquireInitializedAdmissionLease = Effect.fn("Admission.acquireInitialized")(function* (
  context: RepoRunContext,
  kind: AdmissionKind,
  weightTokens: PosInt
) {
  const lease = yield* acquireAdmissionLease(context, kind, weightTokens);
  return yield* writeIdleAdmissionWorkload(lease.leasePath, lease.state.id).pipe(
    Effect.as(lease),
    Effect.tapError(() => releaseAdmissionLease(lease))
  );
});

const withWeightedAdmissionLease = <A, E, R>(
  context: RepoRunContext,
  kind: AdmissionKind,
  weightTokens: PosInt,
  use: (lease: AdmissionLease) => Effect.Effect<A, E, R>
): Effect.Effect<
  A,
  E | YeetCommandError,
  R | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> =>
  Effect.acquireUseRelease(
    acquireInitializedAdmissionLease(context, kind, weightTokens).pipe(
      Effect.mapError(YeetCommandError.new(`Failed to acquire ${kind} admission lease.`))
    ),
    Effect.fnUntraced(function* (lease) {
      const heartbeat = yield* heartbeatAdmissionLease(lease).pipe(
        Effect.repeat(Schedule.spaced(ADMISSION_HEARTBEAT_INTERVAL)),
        Effect.catch(() => Effect.void),
        Effect.forkChild
      );
      return yield* use(lease).pipe(
        withAdmissionWorkloadBinding(admissionWorkloadPath(lease.leasePath), lease.state.id),
        Effect.ensuring(Fiber.interrupt(heartbeat))
      );
    }),
    (lease) =>
      releaseAdmissionLease(lease).pipe(
        Effect.mapError(YeetCommandError.new(`Failed to release ${kind} admission lease.`))
      )
  );

/**
 * Run one operation while holding its weighted machine-wide admission lease.
 *
 * @category scheduling
 */
export const withAdmissionLease: {
  <A, E, R>(
    kind: AdmissionKind,
    use: (lease: AdmissionLease) => Effect.Effect<A, E, R>
  ): (
    context: RepoRunContext
  ) => Effect.Effect<
    A,
    E | YeetCommandError,
    R | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
  >;
  <A, E, R>(
    context: RepoRunContext,
    kind: AdmissionKind,
    use: (lease: AdmissionLease) => Effect.Effect<A, E, R>
  ): Effect.Effect<
    A,
    E | YeetCommandError,
    R | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
  >;
} = dual(
  3,
  <A, E, R>(context: RepoRunContext, kind: AdmissionKind, use: (lease: AdmissionLease) => Effect.Effect<A, E, R>) =>
    withWeightedAdmissionLease(context, kind, admissionWeight(kind), use)
);

/**
 * Run one publication transaction under a family-aware weighted lease.
 *
 * **Details**
 *
 * Normal publication uses three tokens because it includes a full proof.
 * Push-only publication uses one token. Both keep their contention families
 * until the publication transaction ends.
 *
 * @category scheduling
 */
export const withPublicationAdmissionLease: {
  <A, E, R>(
    weightTokens: 1 | 3,
    use: (lease: AdmissionLease) => Effect.Effect<A, E, R>
  ): (
    context: RepoRunContext
  ) => Effect.Effect<
    A,
    E | YeetCommandError,
    R | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
  >;
  <A, E, R>(
    context: RepoRunContext,
    weightTokens: 1 | 3,
    use: (lease: AdmissionLease) => Effect.Effect<A, E, R>
  ): Effect.Effect<
    A,
    E | YeetCommandError,
    R | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
  >;
} = dual(
  3,
  <A, E, R>(
    context: RepoRunContext,
    weightTokens: 1 | 3,
    use: (lease: AdmissionLease) => Effect.Effect<A, E, R>
  ): Effect.Effect<
    A,
    E | YeetCommandError,
    R | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
  > => withWeightedAdmissionLease(context, "publish", PosInt.make(weightTokens), use)
);

/**
 * Return the safe Check concurrency for an admission lease.
 *
 * **Details**
 *
 * A lease cannot be downgraded after a second proof arrives, so both the solo
 * and already-contended observations use the measured-safe contended profile.
 *
 * @param _contended - Whether another proof was observed after lease acquisition.
 * @returns The measured-safe Check concurrency.
 * @category scheduling
 * @since 0.0.0
 */
export const admissionCheckConcurrency = (_contended: boolean): "2" => "2";

/**
 * Bind a detached workload registration path to one admission generation.
 *
 * **Details**
 *
 * Step execution writes a pending marker before spawn and upgrades it to the
 * exact detached process-group generation before the workload may proceed.
 *
 * @category scheduling
 */
export const admissionWorkloadEnvironment: {
  (
    leaseId: string,
    environment: Readonly<Record<string, string | undefined>>
  ): (leasePath: string) => Readonly<Record<string, string | undefined>>;
  (
    leasePath: string,
    leaseId: string,
    environment: Readonly<Record<string, string | undefined>>
  ): Readonly<Record<string, string | undefined>>;
} = dual(
  3,
  (
    leasePath: string,
    leaseId: string,
    environment: Readonly<Record<string, string | undefined>>
  ): Readonly<Record<string, string | undefined>> => ({
    ...environment,
    BEEP_YEET_ADMISSION_WORKLOAD_PATH: admissionWorkloadPath(leasePath),
    BEEP_YEET_ADMISSION_LEASE_ID: leaseId,
  })
);

/**
 * Apply the safe Check concurrency and workload registration carried by a lease.
 *
 * @category scheduling
 */
export const admissionStepEnvironment: {
  (
    environment: Readonly<Record<string, string | undefined>>
  ): (lease: AdmissionLease) => Readonly<Record<string, string | undefined>>;
  (
    lease: AdmissionLease,
    environment: Readonly<Record<string, string | undefined>>
  ): Readonly<Record<string, string | undefined>>;
} = dual(
  2,
  (
    lease: AdmissionLease,
    environment: Readonly<Record<string, string | undefined>>
  ): Readonly<Record<string, string | undefined>> => ({
    ...admissionWorkloadEnvironment(lease.leasePath, lease.state.id, environment),
    BEEP_QUALITY_CHECK_CONCURRENCY: admissionCheckConcurrency(lease.contended),
  })
);
