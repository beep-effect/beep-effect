import { createHash } from "node:crypto";
import { qualityCommand, renderAdmissionSnapshotLinesForTesting } from "@beep/repo-cli/test/Quality";
import {
  AdmissionAttemptTerminationJournal,
  AdmissionConfig,
  AdmissionEvictionJournal,
  AdmissionJournalAdmitted,
  AdmissionJournalEvent,
  AdmissionJournalLeaseEvicted,
  AdmissionJournalLockGeneration,
  AdmissionLeaseReapClaim,
  AdmissionPromotionTransition,
  AdmissionReapClaim,
  AdmissionRequest,
  AdmissionSnapshot,
  acquireJournalFileLock,
  admissionCapacityTokensFor,
  admissionJournalPath,
  admissionProtocolStatus,
  admissionStatus,
  admissionTokenWeight,
  appendAdmissionEvictionJournalEvent,
  appendAdmissionJournalEvent,
  attemptJournalPathForCheckout,
  decodeAdmissionJournalEvent,
  finishAdmissionJournalLockReapForTesting,
  isOvershootLoserForTesting,
  isProcessIdentityAliveWithStartForTesting,
  MemoryStats,
  MemoryStatsLive,
  noAdmissionOriginGate,
  orderAdmissionTicketsForTesting,
  parseAdmissionProcStatStartTime,
  processIdentityStatus,
  processIdentityStatusWithStartForTesting,
  processStartIdentityForPid,
  processStartIdentityProbeForTesting,
  provideRuntimeRootForTesting,
  publishAdmissionJournalForTesting,
  QualitySchedulerError,
  qualitySchedulerForTesting,
  RunScopeRecord,
  RuntimeRootChoice,
  reapAdmissionState,
  releaseAdmissionJournalLockForTesting,
  repoRunSafeArtifactName,
  setAdmissionEvictionProtocol,
  validatePrivateCoordinationDirectory,
  withQualityAdmission,
  YeetAdmissionLease,
  YeetAdmissionTicket,
} from "@beep/repo-cli/test/RepoRun";
import {
  attemptJournalPath,
  decodeYeetAttemptJournalEvent,
  RepoRunContext,
  TurboPlanSnapshot,
} from "@beep/repo-cli/test/Yeet";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { UUID } from "@beep/schema/String";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { NodeChildProcessSpawner, NodeServices } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import {
  Clock,
  ConfigProvider,
  Deferred,
  Duration,
  Effect,
  Encoding,
  Fiber,
  FileSystem,
  Layer,
  Path,
  pipe,
  Ref,
  Schedule,
} from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";
import { FastCheck as fc, TestClock } from "effect/testing";
import * as TestConsole from "effect/testing/TestConsole";
import { Command } from "effect/unstable/cli";

const PlatformLayer = NodeChildProcessSpawner.layer.pipe(
  Layer.provideMerge(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer))
);
const SchedulerCommandLayer = Layer.mergeAll(NodeServices.layer, FsUtilsLive.pipe(Layer.provide(NodeServices.layer)));
const runQualityCommand = Command.runWith(qualityCommand, { version: "0.0.0" });

const DEAD_PID = 2_147_483_647;
const JOURNALED_ATTEMPT_ID = S.decodeSync(UUID)("550e8400-e29b-41d4-a716-446655440020");
const reapClaimPath = (lockPath: string, observedToken: string): string =>
  `${lockPath}.reap-${createHash("sha256").update(observedToken).digest("hex")}`;
const reapAdopterPath = (
  claimPath: string,
  generation: Pick<AdmissionJournalLockGeneration, "ownerToken" | "pid" | "procStart">,
  claimedAtMillis: number
): string =>
  `${claimPath}.adopt-${generation.pid}.${Encoding.encodeBase64Url(generation.procStart)}.${Encoding.encodeBase64Url(generation.ownerToken)}.${claimedAtMillis}`;

describe("admission escalation", () => {
  it("maps each wait threshold to its escalation level", () => {
    expect(qualitySchedulerForTesting.escalationLevel(0)).toBe(0);
    expect(qualitySchedulerForTesting.escalationLevel(120_000)).toBe(1);
    expect(qualitySchedulerForTesting.escalationLevel(600_000)).toBe(2);
  });
});

describe("memory stats", () => {
  it("parses valid meminfo fields and rejects missing or invalid values", () => {
    expect(qualitySchedulerForTesting.parseMeminfoFieldGib("MemTotal: 2097152 kB\n", "MemTotal:")).toEqual(O.some(2));
    expect(qualitySchedulerForTesting.parseMeminfoFieldGib("MemTotal: unavailable kB\n", "MemTotal:")).toEqual(
      O.none()
    );
    expect(qualitySchedulerForTesting.parseMeminfoFieldGib("MemFree: 1024 kB\n", "MemTotal:")).toEqual(O.none());
  });
});

describe("process identity liveness", () => {
  it("builds both portable process-inspector probes", () => {
    expect(processStartIdentityProbeForTesting({ pid: 42, platform: "linux" })).toStrictEqual({
      prefix: "ps",
      command: ["ps", "-o", "lstart=", "-p", "42"],
    });
    expect(processStartIdentityProbeForTesting({ pid: 42, platform: "win32" })).toStrictEqual({
      prefix: "win",
      command: [
        "powershell.exe",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "(Get-Process -Id 42 -ErrorAction Stop).StartTime.ToUniversalTime().Ticks",
      ],
    });
  });

  it.effect("uses a portable process identity when procfs is unavailable", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const withoutProcfs = FileSystem.FileSystem.of({
        ...fs,
        readFileString: Effect.fn("FileSystem.FileSystem.readFileString")((target, encoding) =>
          Str.startsWith("/proc/")(target) ? Effect.succeed("") : fs.readFileString(target, encoding)
        ),
      });
      const identity = yield* processStartIdentityForPid(process.pid).pipe(
        Effect.provideService(FileSystem.FileSystem, withoutProcfs)
      );

      expect(O.isSome(identity)).toBe(true);
      if (O.isSome(identity)) {
        expect(Str.startsWith(process.platform === "win32" ? "win:" : "ps:")(identity.value)).toBe(true);
        expect(
          yield* processIdentityStatus({ pid: process.pid, procStart: identity.value }).pipe(
            Effect.provideService(FileSystem.FileSystem, withoutProcfs)
          )
        ).toBe("alive");
      }
      expect(O.isNone(yield* processStartIdentityForPid(DEAD_PID))).toBe(true);
    }).pipe(provideScopedLayer(PlatformLayer))
  );

  it.effect("classifies a recorded identity as unknown when the current process start is unreadable", () =>
    Effect.gen(function* () {
      expect(
        yield* processIdentityStatusWithStartForTesting({ pid: process.pid, procStart: "recorded-start" }, O.none())
      ).toBe("unknown");
    })
  );

  it.effect("retains an unverifiable recorded identity during admission repair", () =>
    Effect.gen(function* () {
      expect(
        yield* isProcessIdentityAliveWithStartForTesting({ pid: process.pid, procStart: "recorded-start" }, O.none())
      ).toBe(true);
    })
  );

  it.effect("retains PID-only liveness for legacy identities", () =>
    Effect.gen(function* () {
      expect(yield* isProcessIdentityAliveWithStartForTesting({ pid: process.pid, procStart: "" }, O.none())).toBe(
        true
      );
    })
  );
});

// Millisecond-scale intervals so queue loops resolve fast under the real clock.
const fastConfig = AdmissionConfig.make({
  heartbeatSeconds: 0.02,
  progressSeconds: 0.4,
  publishAgingSeconds: 0.25,
  suspectAfterSeconds: 0.5,
});

const encodeLease = S.encodeUnknownEffect(S.fromJsonString(YeetAdmissionLease));
const encodeTicket = S.encodeUnknownEffect(S.fromJsonString(YeetAdmissionTicket));
const decodeLease = S.decodeUnknownEffect(S.fromJsonString(YeetAdmissionLease));
const decodeTicket = S.decodeUnknownEffect(S.fromJsonString(YeetAdmissionTicket));
const encodeJournalLockGeneration = S.encodeUnknownEffect(S.fromJsonString(AdmissionJournalLockGeneration));
const decodeJournalLockGeneration = S.decodeUnknownEffect(S.fromJsonString(AdmissionJournalLockGeneration));
const decodeAdmissionReapClaim = S.decodeUnknownEffect(S.fromJsonString(AdmissionReapClaim));
const encodeAdmissionReapClaim = S.encodeUnknownEffect(S.fromJsonString(AdmissionReapClaim));
const encodePromotionTransition = S.encodeUnknownEffect(S.fromJsonString(AdmissionPromotionTransition));
const decodePromotionTransition = S.decodeUnknownEffect(S.fromJsonString(AdmissionPromotionTransition));
const decodeJsonObject = S.decodeUnknownEffect(S.fromJsonString(S.JsonObject));
const encodeJsonObject = S.encodeUnknownEffect(S.fromJsonString(S.JsonObject));

const writeExecutable = Effect.fn("QualitySchedulerTest.writeExecutable")(function* (
  filePath: string,
  content: string
) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(filePath, content);
  yield* fs.chmod(filePath, 0o755);
});

const withProcessPath = <Value, Failure, Requirements>(
  nextPath: string,
  use: Effect.Effect<Value, Failure, Requirements>
) =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const previousPath = Bun.env.PATH;
      Bun.env.PATH = nextPath;
      return previousPath;
    }),
    () => use,
    (previousPath) =>
      Effect.sync(() => {
        if (previousPath === undefined) {
          delete Bun.env.PATH;
        } else {
          Bun.env.PATH = previousPath;
        }
      })
  );

const withPrependedPath = <Value, Failure, Requirements>(
  binDirectory: string,
  use: Effect.Effect<Value, Failure, Requirements>
) =>
  Effect.suspend(() =>
    withProcessPath(Bun.env.PATH === undefined ? binDirectory : `${binDirectory}:${Bun.env.PATH}`, use)
  );

const readJournalEvents = Effect.fnUntraced(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const journalPath = yield* admissionJournalPath(root);
  const text = yield* fs.readFileString(journalPath).pipe(Effect.orElseSucceed(() => Str.empty));
  const lines = pipe(text, Str.split("\n"), A.filter(Str.isNonEmpty));
  return yield* Effect.forEach(lines, (line) => decodeAdmissionJournalEvent(line));
});

const readAttemptJournalEvents = Effect.fnUntraced(function* (checkoutRoot: string, branch: string) {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(yield* attemptJournalPathForCheckout(checkoutRoot, branch));
  return yield* Effect.forEach(pipe(text, Str.split("\n"), A.filter(Str.isNonEmpty)), (line) =>
    decodeYeetAttemptJournalEvent(line)
  );
});

const journalAdmitted = (index: number) =>
  AdmissionJournalAdmitted.make({
    schemaVersion: "yeet-admission-journal/v1",
    _tag: "admission-admitted",
    nonce: `nonce-${index}`,
    pid: index,
    procStart: `${index}`,
    kind: "full-proof",
    weightTokens: 3,
    priority: "verify",
    originKey: `origin-${index}`,
    enqueuedAtMillis: index,
    admittedAtMillis: index,
  });

const journalLeaseEvicted = AdmissionJournalLeaseEvicted.make({
  schemaVersion: "yeet-admission-journal/v2",
  _tag: "admission-lease-evicted",
  nonce: "evicted-lease",
  pid: DEAD_PID,
  evictedAtMillis: 1,
  reason: "owner-dead-or-reused",
});

const request = (overrides: Partial<Parameters<typeof AdmissionRequest.make>[0]> = {}) =>
  AdmissionRequest.make({
    kind: "full-proof",
    weightTokens: admissionTokenWeight("full-proof"),
    priority: "verify",
    originKey: "originaaa111",
    checkoutRoot: "/repo/a",
    branch: "feat/a",
    command: "bun run beep yeet verify",
    ...overrides,
  });

const orderingTicket = (overrides: Partial<Parameters<typeof YeetAdmissionTicket.make>[0]> = {}) =>
  YeetAdmissionTicket.make({
    schemaVersion: "yeet-admission-ticket/v1",
    pid: process.pid,
    procStart: "proc:test",
    kind: "full-proof",
    weightTokens: 3,
    priority: "verify",
    originKey: "ordering-origin",
    checkoutRoot: "/repo/ordering",
    branch: "feat/ordering",
    enqueuedAtMillis: 0,
    heartbeatAtMillis: 0,
    nonce: "ordering-ticket",
    ...overrides,
  });

const memoryLayer = (gibRef: Ref.Ref<number>, totalGib = 128) =>
  Layer.succeed(MemoryStats, MemoryStats.of({ availableGib: Ref.get(gibRef), totalGib: Effect.succeed(totalGib) }));

const ownProcStart = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const stat = yield* fs.readFileString(`/proc/${process.pid}/stat`).pipe(Effect.orElseSucceed(() => ""));
  return O.getOrElse(parseAdmissionProcStatStartTime(stat), () => "");
});

interface AdmissionTempRoot {
  readonly claims: string;
  readonly leases: string;
  readonly promotions: string;
  readonly quarantine: string;
  readonly queue: string;
  readonly root: string;
}

const withAdmissionTempRoot = Effect.fn("withAdmissionTempRoot")(
  function* <Result, Error2, Requirements>(
    gibRef: Ref.Ref<number>,
    use: (tempRoot: AdmissionTempRoot) => Effect.Effect<Result, Error2, Requirements>,
    totalGib = 128,
    runScopesEnabled = false
  ) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const runtimeDir = yield* fs.makeTempDirectory();
    const root = path.join(runtimeDir, "beep", "admit");
    const tempRoot: AdmissionTempRoot = {
      root,
      claims: path.join(root, "claims"),
      leases: path.join(root, "leases"),
      promotions: path.join(root, "promotions"),
      queue: path.join(root, "queue"),
      quarantine: path.join(root, "quarantine"),
    };
    return yield* use(tempRoot).pipe(
      provideRuntimeRootForTesting(RuntimeRootChoice.make({ kind: "test-override", root: runtimeDir })),
      provideScopedLayer(
        ConfigProvider.layer(
          ConfigProvider.fromUnknown({
            BEEP_RUN_SCOPES: runScopesEnabled ? "1" : "0",
          })
        )
      ),
      provideScopedLayer(memoryLayer(gibRef, totalGib)),
      Effect.onExit(() => fs.remove(runtimeDir, { recursive: true, force: true }).pipe(Effect.ignore))
    );
  },
  (effect) => effect.pipe(provideScopedLayer(PlatformLayer), Effect.scoped)
);

const writeFakeLease = Effect.fnUntraced(function* (
  tempRoot: AdmissionTempRoot,
  overrides: Partial<Parameters<typeof YeetAdmissionLease.make>[0]>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const procStart = yield* ownProcStart();
  const lease = YeetAdmissionLease.make({
    schemaVersion: "yeet-admission-lease/v1",
    pid: process.pid,
    procStart,
    kind: "full-proof",
    weightTokens: 3,
    priority: "verify",
    originKey: "origin-other",
    checkoutRoot: "/repo/other",
    branch: "feat/other",
    command: "bun run beep yeet verify",
    startedAt: "2026-08-27T00:00:00Z",
    admittedAtMillis: 0,
    heartbeatAtMillis: 0,
    ...overrides,
  });
  yield* fs.makeDirectory(tempRoot.leases, { recursive: true, mode: 0o700 });
  const name = `fake-${Math.abs(lease.weightTokens)}-${lease.originKey}-${lease.kind}.lease.json`;
  const filePath = path.join(tempRoot.leases, name);
  yield* fs.writeFileString(filePath, `${yield* encodeLease(lease)}\n`);
  return filePath;
});

const writeFakeTicket = Effect.fnUntraced(function* (
  tempRoot: AdmissionTempRoot,
  overrides: Partial<Parameters<typeof YeetAdmissionTicket.make>[0]>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const ticket = YeetAdmissionTicket.make({
    schemaVersion: "yeet-admission-ticket/v1",
    pid: process.pid,
    procStart: yield* ownProcStart(),
    kind: "full-proof",
    weightTokens: 3,
    priority: "verify",
    originKey: "origin-ticket",
    checkoutRoot: "/repo/ticket",
    branch: "feat/ticket",
    enqueuedAtMillis: 0,
    heartbeatAtMillis: 0,
    nonce: "ticket-nonce",
    ...overrides,
  });
  yield* fs.makeDirectory(tempRoot.queue, { recursive: true, mode: 0o700 });
  const filePath = path.join(tempRoot.queue, `${ticket.nonce}.ticket.json`);
  yield* fs.writeFileString(filePath, `${yield* encodeTicket(ticket)}\n`);
  return filePath;
});

const writeProtocolDeferredLeaseFixture = Effect.fnUntraced(function* (tempRoot: AdmissionTempRoot) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const binDirectory = path.join(path.dirname(path.dirname(tempRoot.root)), "bin");
  const checkoutRoot = path.join(path.dirname(path.dirname(tempRoot.root)), "checkout");
  yield* fs.makeDirectory(binDirectory, { recursive: true });
  yield* fs.makeDirectory(checkoutRoot, { recursive: true });
  yield* writeExecutable(path.join(binDirectory, "systemctl"), "#!/bin/sh\nexit 0\n");
  yield* writeFakeLease(tempRoot, {
    pid: DEAD_PID,
    nonce: "protocol-deferred-lease",
    originKey: "origin-protocol-deferred",
    checkoutRoot,
    branch: "feat/protocol-deferred",
    attemptId: O.some(JOURNALED_ATTEMPT_ID),
  });
  return { binDirectory, checkoutRoot };
});

const readOnlyReapClaim = Effect.fnUntraced(function* (tempRoot: AdmissionTempRoot) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const names = yield* listDirectory(tempRoot.claims);
  const name = O.getOrThrow(A.head(names));
  const claim = yield* fs
    .readFileString(path.join(tempRoot.claims, name))
    .pipe(Effect.flatMap(decodeAdmissionReapClaim));
  return { claim, name, names };
});

const writeLegacyTicket = Effect.fnUntraced(function* (
  tempRoot: AdmissionTempRoot,
  options: {
    readonly enqueuedAtMillis: number;
    readonly nonce: string;
    readonly originKey: string;
  }
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const ticketPath = path.join(tempRoot.queue, `legacy-${options.nonce}.ticket.json`);
  const ticketText = yield* encodeJsonObject({
    schemaVersion: "yeet-admission-ticket/v1",
    pid: process.pid,
    procStart: yield* ownProcStart(),
    kind: "full-proof",
    weightTokens: 3,
    priority: "verify",
    originKey: options.originKey,
    checkoutRoot: "/repo/legacy",
    branch: "feat/legacy",
    command: "bun run beep yeet verify",
    enqueuedAtMillis: options.enqueuedAtMillis,
    heartbeatAtMillis: options.enqueuedAtMillis,
    blockedOnOriginAtMillis: 0,
    nonce: options.nonce,
  });
  yield* fs.makeDirectory(tempRoot.queue, { recursive: true, mode: 0o700 });
  yield* fs.writeFileString(ticketPath, `${ticketText}\n`);
  return ticketPath;
});

// Transient .tmp- staging files are atomically renamed away; only settled
// state files count.
const listDirectory = Effect.fnUntraced(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const names = yield* fs.readDirectory(directory).pipe(Effect.orElseSucceed(A.empty<string>));
  return A.filter(names, (name) => !Str.includes(".tmp-")(name));
});

const writePromotionTransition = Effect.fnUntraced(function* (
  tempRoot: AdmissionTempRoot,
  transition: AdmissionPromotionTransition
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(tempRoot.promotions, { recursive: true, mode: 0o700 });
  const transitionPath = path.join(tempRoot.promotions, `${transition.nonce}.promotion.json`);
  yield* fs.writeFileString(transitionPath, `${yield* encodePromotionTransition(transition)}\n`);
  return transitionPath;
});

const writePromotionFixture = Effect.fnUntraced(function* (
  tempRoot: AdmissionTempRoot,
  options: {
    readonly keepLease: boolean;
    readonly keepTicket: boolean;
    readonly nonce: string;
    readonly phase: AdmissionPromotionTransition["phase"];
    readonly pid?: number;
  }
) {
  const fs = yield* FileSystem.FileSystem;
  const originKey = `${options.nonce}-origin`;
  const pid = O.getOrElse(O.fromUndefinedOr(options.pid), () => process.pid);
  const leasePath = yield* writeFakeLease(tempRoot, {
    pid,
    nonce: options.nonce,
    originKey,
  });
  const ticketPath = yield* writeFakeTicket(tempRoot, {
    pid,
    nonce: options.nonce,
    originKey,
  });
  const lease = yield* fs.readFileString(leasePath).pipe(Effect.flatMap(decodeLease));
  const ticket = yield* fs.readFileString(ticketPath).pipe(Effect.flatMap(decodeTicket));
  yield* options.keepLease ? Effect.void : fs.remove(leasePath, { force: true });
  yield* options.keepTicket ? Effect.void : fs.remove(ticketPath, { force: true });
  const promotionPath = yield* writePromotionTransition(
    tempRoot,
    AdmissionPromotionTransition.make({
      schemaVersion: "yeet-admission-promotion/v1",
      nonce: options.nonce,
      ticketPath,
      leasePath,
      ticket,
      lease,
      phase: options.phase,
      createdAtMillis: 1,
    })
  );
  return { lease, leasePath, promotionPath, ticket, ticketPath };
});

const writeLeaseReapClaim = Effect.fnUntraced(function* (
  tempRoot: AdmissionTempRoot,
  name: string,
  nonce: string,
  sinks: {
    readonly admissionJournal: AdmissionLeaseReapClaim["admissionJournal"];
    readonly attemptJournal: AdmissionLeaseReapClaim["attemptJournal"];
  }
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const sourcePath = yield* writeFakeLease(tempRoot, {
    pid: DEAD_PID,
    nonce,
    originKey: `${nonce}-origin`,
  });
  const lease = yield* fs.readFileString(sourcePath).pipe(Effect.flatMap(decodeLease));
  yield* fs.remove(sourcePath, { force: true });
  const claimPath = path.join(tempRoot.claims, name);
  yield* fs.writeFileString(
    claimPath,
    `${yield* encodeAdmissionReapClaim(
      AdmissionLeaseReapClaim.make({
        schemaVersion: "yeet-admission-reap-claim/v1",
        _tag: "lease",
        sourcePath,
        nonce: lease.nonce,
        claimedAtMillis: 1,
        attemptJournal: sinks.attemptJournal,
        admissionJournal: sinks.admissionJournal,
        lease,
      })
    )}\n`
  );
  return claimPath;
});

const fileSystemWithMissingExists = (fs: FileSystem.FileSystem, hiddenPath: string): FileSystem.FileSystem =>
  FileSystem.FileSystem.of({
    ...fs,
    exists: Effect.fn("FileSystem.FileSystem.exists")((target) =>
      Str.Equivalence(target, hiddenPath) ? Effect.succeed(false) : fs.exists(target)
    ),
  });

const fileSystemWithReadUnavailableAfterFirst = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  targetPath: string,
  missingPath: string
) {
  const reads = yield* Ref.make(0);
  return FileSystem.FileSystem.of({
    ...fs,
    readFileString: Effect.fn("QualitySchedulerTest.readFileString")(function* (target, encoding) {
      if (Str.Equivalence(target, targetPath) && (yield* Ref.updateAndGet(reads, (count) => count + 1)) > 1) {
        return yield* fs.readFileString(missingPath, encoding);
      }
      return yield* fs.readFileString(target, encoding);
    }),
  });
});

const fileSystemWithLostJournalReapClaim = Effect.fnUntraced(function* (fs: FileSystem.FileSystem, lossAtRead: number) {
  const adopterReads = yield* Ref.make(0);
  const fileSystem = FileSystem.FileSystem.of({
    ...fs,
    readFileString: Effect.fn("FileSystem.FileSystem.readFileString")(function* (target, encoding) {
      if (Str.includes(".adopt-")(target)) {
        const read = yield* Ref.updateAndGet(adopterReads, (count) => count + 1);
        if (read === lossAtRead) {
          yield* fs.remove(target, { force: true });
        }
      }
      return yield* fs.readFileString(target, encoding);
    }),
  });
  return { adopterReads, fileSystem };
});

describe("quality-scheduler", () => {
  it.effect("reads the live memory inputs used by the scheduler capacity model", () =>
    Effect.gen(function* () {
      const stats = yield* MemoryStats;

      expect(yield* stats.availableGib).toBeGreaterThan(0);
      expect(yield* stats.totalGib).toBeGreaterThan(0);
    }).pipe(provideScopedLayer(MemoryStatsLive), provideScopedLayer(NodeFileSystem.layer))
  );

  it.effect("accepts an owner-agnostic private directory and rejects an unsafe mode", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* fs.makeTempDirectoryScoped({ prefix: "quality-scheduler-private-directory-" });
      yield* fs.chmod(directory, 0o700);

      const options = {
        effectiveUserId: O.none<number>(),
        label: "Test coordination directory",
        onStatError: () => "stat failed",
        onViolation: (message: string) => message,
      };

      yield* validatePrivateCoordinationDirectory(directory, options);
      yield* fs.chmod(directory, 0o755);
      const failure = yield* validatePrivateCoordinationDirectory(directory, options).pipe(Effect.flip);

      expect(failure).toContain("expected 0700");
    }).pipe(provideScopedLayer(NodeFileSystem.layer))
  );

  describe("capacity formula", () => {
    it("matches the chartered D1 table", () => {
      const config = AdmissionConfig.make({});
      expect(admissionCapacityTokensFor(50, config)).toBe(8);
      expect(admissionCapacityTokensFor(60, config)).toBe(10);
      expect(admissionCapacityTokensFor(14.9, config)).toBe(0);
      expect(admissionCapacityTokensFor(15, config)).toBe(1);
      expect(admissionCapacityTokensFor(1000, config)).toBe(10);
    });

    it("never exceeds the cap and never goes negative", () => {
      fc.assert(
        fc.property(fc.double({ min: 0, max: 4096, noNaN: true }), (availableGib) => {
          const config = AdmissionConfig.make({});
          const capacity = admissionCapacityTokensFor(availableGib, config);
          expect(capacity).toBeGreaterThanOrEqual(0);
          expect(capacity).toBeLessThanOrEqual(config.capacityMaxTokens);
          expect(Number.isInteger(capacity)).toBe(true);
          if (availableGib < config.hardFloorGib) {
            expect(capacity).toBe(0);
          }
        }),
        fcRuns()
      );
    });
  });

  it("pins the chartered token weights", () => {
    expect(admissionTokenWeight("full-proof")).toBe(3);
    expect(admissionTokenWeight("merged-preview")).toBe(5);
    expect(admissionTokenWeight("review-fix")).toBe(1);
    expect(admissionTokenWeight("publish")).toBe(1);
  });

  it("parses /proc stat start time past executable names with spaces and parens", () => {
    const stat = "77 (a (weird) name) S 1 77 77 0 -1 4194560 0 0 0 0 0 0 0 0 20 0 1 0 424242 0 0";
    expect(O.getOrElse(parseAdmissionProcStatStartTime(stat), () => "none")).toBe("424242");
    expect(O.isNone(parseAdmissionProcStatStartTime("garbage"))).toBe(true);
  });

  it("runs scheduler status and reap command paths", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            yield* runQualityCommand(["scheduler"]);
            yield* runQualityCommand(["scheduler", "status", "--no-json"]);
            yield* runQualityCommand(["scheduler", "status", "--json"]);
            yield* runQualityCommand(["scheduler", "reap", "--no-apply"]);
            yield* writeFakeTicket(tempRoot, {
              pid: DEAD_PID,
              procStart: "dead-command-owner",
              nonce: "dead-command-ticket",
              originKey: "dead-command-origin",
            });
            yield* runQualityCommand(["scheduler", "reap", "--no-apply"]);
            yield* runQualityCommand(["scheduler", "reap", "--apply"]);

            const output = A.join(A.map(yield* TestConsole.logLines, String), "\n");
            expect(output).toContain("Quality scheduler commands:");
            expect(output).toContain("admission capacity:");
            expect(output).toContain('"capacityTokens": 8');
            expect(output).toContain("dry run — would reap:");
            expect(output).toContain("dead-command-ticket");
            expect(output).toContain("reaped dead admission state:");
          })
        );
      }).pipe(provideScopedLayer(TestConsole.layer), provideScopedLayer(SchedulerCommandLayer))
    ));

  it("admits immediately at free capacity and cleans up every artifact", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const during = yield* withQualityAdmission(
              request(),
              noAdmissionOriginGate,
              Effect.gen(function* () {
                const leases = yield* listDirectory(tempRoot.leases);
                const queue = yield* listDirectory(tempRoot.queue);
                return { leases: A.length(leases), queue: A.length(queue) };
              }),
              fastConfig
            );
            expect(during.leases).toBe(1);
            expect(during.queue).toBe(0);
            expect(A.length(yield* listDirectory(tempRoot.leases))).toBe(0);
            expect(A.length(yield* listDirectory(tempRoot.queue))).toBe(0);
          })
        );
      })
    ));

  it("copies ticket nonce and enqueuedAtMillis onto the published lease", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          withQualityAdmission(
            request(),
            noAdmissionOriginGate,
            Effect.gen(function* () {
              const fs = yield* FileSystem.FileSystem;
              const path = yield* Path.Path;
              const leases = yield* listDirectory(tempRoot.leases);
              expect(leases).toHaveLength(1);
              const leaseName = pipe(
                A.head(leases),
                O.getOrElse(() => Str.empty)
              );
              const lease = yield* fs
                .readFileString(path.join(tempRoot.leases, leaseName))
                .pipe(Effect.flatMap(decodeLease));
              expect(lease.nonce).toHaveLength(36);
              expect(lease.nonce).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
              expect(leaseName).toBe(`${lease.nonce}-${lease.pid}.lease.json`);
              expect(lease.enqueuedAtMillis).toBeGreaterThan(0);
              expect(lease.enqueuedAtMillis).toBeLessThanOrEqual(lease.admittedAtMillis);
              expect(O.getOrThrow(O.fromUndefinedOr(lease.runScope)).support).toBe("disabled");
            }),
            fastConfig
          )
        );
      })
    ));

  it("carries immutable attempt facts from a waiting ticket onto its admitted lease", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(10);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const attemptId = yield* S.decodeEffect(UUID)("550e8400-e29b-41d4-a716-446655440023");
            const facts = {
              attemptId: O.some(attemptId),
              resolvedHeadSha: O.some("0123456789abcdef0123456789abcdef01234567"),
              diffFingerprint: O.some("abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd"),
              proofTier: O.some("full" as const),
              envProfile: O.some("local" as const),
              stage: O.some("pre-push" as const),
            };
            const admitted = yield* Effect.forkChild(
              withQualityAdmission(
                request(facts),
                noAdmissionOriginGate,
                Effect.gen(function* () {
                  const leaseName = pipe(yield* listDirectory(tempRoot.leases), A.head, O.getOrThrow);
                  return yield* fs
                    .readFileString(path.join(tempRoot.leases, leaseName))
                    .pipe(Effect.flatMap(decodeLease));
                }),
                fastConfig
              )
            );

            let ticketNames = A.empty<string>();
            for (let attempt = 0; attempt < 100 && A.isReadonlyArrayEmpty(ticketNames); attempt++) {
              yield* Effect.sleep("5 millis");
              ticketNames = yield* listDirectory(tempRoot.queue);
            }
            const ticketName = pipe(ticketNames, A.head, O.getOrThrow);
            const ticket = yield* fs
              .readFileString(path.join(tempRoot.queue, ticketName))
              .pipe(Effect.flatMap(decodeTicket));
            expect(ticket).toMatchObject(facts);

            yield* Ref.set(gibRef, 50);
            const lease = yield* Fiber.join(admitted);
            expect(lease).toMatchObject(facts);
          })
        );
      })
    ));

  it("journals admitted and released events that outlive every ticket and lease file", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const admissionRequest = request({ attemptId: O.some(JOURNALED_ATTEMPT_ID) });
            yield* withQualityAdmission(admissionRequest, noAdmissionOriginGate, Effect.void, fastConfig);
            expect(yield* listDirectory(tempRoot.leases)).toHaveLength(0);
            expect(yield* listDirectory(tempRoot.queue)).toHaveLength(0);
            const events = yield* readJournalEvents(tempRoot.root);
            expect(A.map(events, (event) => event._tag)).toStrictEqual(["admission-admitted", "admission-released"]);
            const admitted = pipe(
              events,
              A.findFirst(AdmissionJournalEvent.guards["admission-admitted"]),
              O.getOrThrow
            );
            const released = pipe(
              events,
              A.findFirst(AdmissionJournalEvent.guards["admission-released"]),
              O.getOrThrow
            );
            expect(admitted.kind).toBe(admissionRequest.kind);
            expect(admitted.weightTokens).toBe(admissionRequest.weightTokens);
            expect(admitted.priority).toBe(admissionRequest.priority);
            expect(admitted.originKey).toBe(admissionRequest.originKey);
            expect(admitted.pid).toBe(process.pid);
            expect(released.nonce).toBe(admitted.nonce);
            expect(released.pid).toBe(admitted.pid);
            expect(admitted.attemptId).toStrictEqual(O.some(JOURNALED_ATTEMPT_ID));
            expect(released.attemptId).toStrictEqual(O.some(JOURNALED_ATTEMPT_ID));
            expect(admitted.enqueuedAtMillis).toBeLessThanOrEqual(admitted.admittedAtMillis);
            expect(admitted.admittedAtMillis).toBeLessThanOrEqual(released.releasedAtMillis);
          })
        );
      })
    ));

  it("journals a released event when the admitted work fails", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const failed = yield* withQualityAdmission(
              request(),
              noAdmissionOriginGate,
              Effect.fail("boom" as const),
              fastConfig
            ).pipe(Effect.flip);
            expect(failed).toBe("boom");
            const events = yield* readJournalEvents(tempRoot.root);
            expect(A.map(events, (event) => event._tag)).toStrictEqual(["admission-admitted", "admission-released"]);
            const admitted = pipe(
              events,
              A.findFirst(AdmissionJournalEvent.guards["admission-admitted"]),
              O.getOrThrow
            );
            const released = pipe(
              events,
              A.findFirst(AdmissionJournalEvent.guards["admission-released"]),
              O.getOrThrow
            );
            expect(released.nonce).toBe(admitted.nonce);
          })
        );
      })
    ));

  it("journals peak memory when an active run scope releases", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(
          gibRef,
          (tempRoot) =>
            Effect.gen(function* () {
              const fs = yield* FileSystem.FileSystem;
              const path = yield* Path.Path;
              const binDirectory = path.join(path.dirname(path.dirname(tempRoot.root)), "bin");
              yield* fs.makeDirectory(binDirectory, { recursive: true });
              const unitStatePath = path.join(binDirectory, "busctl.unit");
              yield* writeExecutable(
                path.join(binDirectory, "busctl"),
                `#!/bin/sh\nnext_is_unit=0\nfor argument do\n  [ "$next_is_unit" = 1 ] && { printf '%s' "$argument" > '${unitStatePath}'; next_is_unit=0; }\n  [ "$argument" = "ssa(sv)a(sa(sv))" ] && next_is_unit=1\ndone\nfor argument do\n  if [ "$argument" = "GetUnitByPID" ] && [ -f '${unitStatePath}' ]; then\n    printf 'o "/org/freedesktop/systemd1/unit/%s"\\n' "$(sed 's/-/_2d/g; s/\\./_2e/g' '${unitStatePath}')"\n  fi\ndone\nexit 0\n`
              );
              yield* writeExecutable(
                path.join(binDirectory, "systemctl"),
                "#!/bin/sh\nprintf 'MemoryPeak=8192\\nTasksCurrent=5\\n'\n"
              );

              yield* withPrependedPath(
                binDirectory,
                withQualityAdmission(request(), noAdmissionOriginGate, Effect.void, fastConfig)
              );
              const events = yield* readJournalEvents(tempRoot.root);
              const released = pipe(
                events,
                A.findFirst(AdmissionJournalEvent.guards["admission-released"]),
                O.getOrThrow
              );
              expect(released.memoryPeakBytes).toBe(8192);
            }),
          128,
          true
        );
      })
    ));

  it("retains the newest bounded set of admitted transitions", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            yield* Effect.forEach(
              A.makeBy(201, (index) => index),
              (index) => appendAdmissionJournalEvent(tempRoot.root, journalAdmitted(index)),
              { discard: true, concurrency: 1 }
            );
            const events = yield* readJournalEvents(tempRoot.root);
            expect(events).toHaveLength(200);
            expect(events[0]?.nonce).toBe("nonce-1");
            expect(events[199]?.nonce).toBe("nonce-200");
          })
        );
      })
    ));

  it("preserves an unknown protocol row byte-for-byte through a v1 append", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const journalPath = yield* admissionJournalPath(tempRoot.root);
            yield* appendAdmissionJournalEvent(tempRoot.root, journalAdmitted(1));
            const intact = yield* fs.readFileString(journalPath);
            const unknown =
              '{"schemaVersion":"yeet-admission-journal/v3","_tag":"admission-future","opaque":"keep  bytes"}';
            yield* fs.writeFileString(journalPath, `${intact}${unknown}\n`);
            yield* appendAdmissionJournalEvent(tempRoot.root, journalAdmitted(2));
            const rewritten = yield* fs.readFileString(journalPath);
            const second = yield* S.encodeUnknownEffect(S.fromJsonString(AdmissionJournalEvent))(journalAdmitted(2));
            expect(pipe(rewritten, Str.split("\n"), A.filter(Str.isNonEmpty))).toStrictEqual([
              Str.trim(intact),
              unknown,
              second,
            ]);
          })
        );
      })
    ));

  it("reacquires after crash recovery displaces its lock and publishes exactly once", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const lockPath = path.join(tempRoot.root, "journal.lock");
            const tombstonePath = `${lockPath}.reap-crashed-reclaimer.tombstone-${process.pid}`;
            const lockReads = yield* Ref.make(0);
            const displacedFileSystem = FileSystem.FileSystem.of({
              ...fs,
              readFileString: Effect.fn("FileSystem.FileSystem.readFileString")(function* (target, encoding) {
                if (!Str.Equivalence(target, lockPath)) {
                  return yield* fs.readFileString(target, encoding);
                }
                if ((yield* Ref.updateAndGet(lockReads, (count) => count + 1)) === 2) {
                  yield* fs.rename(lockPath, tombstonePath);
                }
                return yield* fs.readFileString(target, encoding);
              }),
            });

            yield* appendAdmissionJournalEvent(tempRoot.root, journalAdmitted(1)).pipe(
              Effect.provideService(FileSystem.FileSystem, displacedFileSystem)
            );

            expect(yield* fs.exists(tombstonePath)).toBe(false);
            expect(A.map(yield* readJournalEvents(tempRoot.root), (event) => event.nonce)).toStrictEqual(["nonce-1"]);
          })
        );
      })
    ));

  it("surfaces typed retry exhaustion without publishing a partial event", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const lockPath = path.join(tempRoot.root, "journal.lock");
            const journalPath = yield* admissionJournalPath(tempRoot.root);
            const repeatedlyDisplacedFileSystem = FileSystem.FileSystem.of({
              ...fs,
              readFileString: Effect.fn("FileSystem.FileSystem.readFileString")(function* (target, encoding) {
                if (Str.Equivalence(target, lockPath)) {
                  yield* fs.remove(lockPath, { force: true });
                }
                return yield* fs.readFileString(target, encoding);
              }),
            });

            const failure = yield* appendAdmissionJournalEvent(tempRoot.root, journalAdmitted(1)).pipe(
              Effect.provideService(FileSystem.FileSystem, repeatedlyDisplacedFileSystem),
              Effect.flip
            );

            expect(failure.reason).toBe("journal-lock-retry-exhausted");
            expect(failure.message).toContain("retry bound exhausted");
            expect(yield* fs.exists(journalPath)).toBe(false);
          })
        );
      })
    ));

  it("fails under live or fresh malformed locks and reaps dead or aged malformed generations", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const lockPath = path.join(tempRoot.root, "journal.lock");
            yield* fs.makeDirectory(tempRoot.root, { recursive: true, mode: 0o700 });
            yield* fs.writeFileString(lockPath, `${process.pid}:live-holder`);
            const busy = yield* appendAdmissionJournalEvent(tempRoot.root, journalAdmitted(0)).pipe(Effect.flip);
            expect(busy.message).toContain("stayed busy");
            const protocolBusy = yield* setAdmissionEvictionProtocol("on").pipe(Effect.flip);
            expect(protocolBusy.message).toContain("could not change the protocol marker");
            const evictionBusy = yield* appendAdmissionEvictionJournalEvent(tempRoot.root, journalLeaseEvicted).pipe(
              Effect.flip
            );
            expect(evictionBusy.message).toContain("dropping one admission-lease-evicted event");
            expect(yield* readJournalEvents(tempRoot.root)).toHaveLength(0);
            const agedLiveSeconds = ((yield* Clock.currentTimeMillis) - 301_000) / 1_000;
            yield* fs.utimes(lockPath, agedLiveSeconds, agedLiveSeconds);
            const agedLive = yield* appendAdmissionJournalEvent(tempRoot.root, journalAdmitted(0)).pipe(Effect.flip);
            expect(agedLive.message).toContain("stayed busy");
            // A fresh unparseable lock is a just-published generation mid-race,
            // never insta-reaped.
            yield* fs.writeFileString(lockPath, "not-a-pid");
            const unparseable = yield* appendAdmissionJournalEvent(tempRoot.root, journalAdmitted(0)).pipe(Effect.flip);
            expect(unparseable.message).toContain("stayed busy");
            yield* fs.writeFileString(lockPath, `${DEAD_PID}:dead-holder`);
            yield* appendAdmissionJournalEvent(tempRoot.root, journalAdmitted(1));
            expect(O.isNone(yield* fs.stat(lockPath).pipe(Effect.option))).toBe(true);
            // Only a malformed generation can age through the backstop; a
            // parseable live owner is never raced by time-based reclamation.
            yield* fs.writeFileString(lockPath, "aged-malformed-token");
            const agedSeconds = ((yield* Clock.currentTimeMillis) - 301_000) / 1_000;
            yield* fs.utimes(lockPath, agedSeconds, agedSeconds);
            yield* appendAdmissionJournalEvent(tempRoot.root, journalAdmitted(2));
            expect(O.isNone(yield* fs.stat(lockPath).pipe(Effect.option))).toBe(true);
            const events = yield* readJournalEvents(tempRoot.root);
            expect(A.map(events, (event) => event.nonce)).toStrictEqual(["nonce-1", "nonce-2"]);
          })
        );
      })
    ));

  it("binds concurrent stale-lock reclamation to one observed generation", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const lockPath = path.join(tempRoot.root, "journal.lock");
            const contenderTokens = A.makeBy(16, (index) => `${process.pid}:contender-${index}`);
            yield* fs.makeDirectory(tempRoot.root, { recursive: true, mode: 0o700 });
            yield* fs.writeFileString(lockPath, `${DEAD_PID}:abandoned-generation`);

            const acquired = yield* Effect.forEach(
              contenderTokens,
              (token) => acquireJournalFileLock(lockPath, token, 16),
              { concurrency: "unbounded" }
            );
            expect(A.filter(acquired, (value) => value)).toHaveLength(1);
            const winnerIndex = A.findFirstIndex(acquired, (value) => value);
            const winnerToken = pipe(
              winnerIndex,
              O.flatMap((index) => A.get(contenderTokens, index)),
              O.getOrThrow
            );
            const lockGeneration = yield* fs.readFileString(lockPath).pipe(Effect.flatMap(decodeJournalLockGeneration));
            expect(lockGeneration.ownerToken).toBe(winnerToken);
            expect(lockGeneration.pid).toBe(process.pid);
            expect(Str.isNonEmpty(lockGeneration.procStart)).toBe(true);
            yield* releaseAdmissionJournalLockForTesting(lockPath, winnerToken);
          })
        );
      })
    ));

  it("adopts an existing generation-specific reap claim after the first reaper crashes", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const lockPath = path.join(tempRoot.root, "journal.lock");
            const observedToken = `${DEAD_PID}:abandoned-generation`;
            const claimPath = `${lockPath}.reap-${createHash("sha256").update(observedToken).digest("hex")}`;
            yield* fs.makeDirectory(tempRoot.root, { recursive: true, mode: 0o700 });
            yield* fs.writeFileString(lockPath, observedToken);
            yield* fs.link(lockPath, claimPath);

            yield* appendAdmissionJournalEvent(tempRoot.root, journalAdmitted(1));

            expect(O.isNone(yield* fs.stat(claimPath).pipe(Effect.option))).toBe(true);
            expect(A.filter(yield* fs.readDirectory(tempRoot.root), Str.includes(".tombstone-"))).toHaveLength(0);
            expect(A.map(yield* readJournalEvents(tempRoot.root), (event) => event.nonce)).toStrictEqual(["nonce-1"]);
          })
        );
      })
    ));

  it("finishes an adopted lock reclaim before honoring interruption", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const lockPath = path.join(tempRoot.root, "journal.lock");
            const observedToken = `${DEAD_PID}:interrupted-adoption`;
            const adopted = yield* Deferred.make<void>();
            const finishAdoption = yield* Deferred.make<void>();
            yield* fs.makeDirectory(tempRoot.root, { recursive: true, mode: 0o700 });
            yield* fs.writeFileString(lockPath, observedToken);
            const pausedFileSystem = FileSystem.FileSystem.of({
              ...fs,
              rename: Effect.fn("FileSystem.FileSystem.rename")(function* (oldPath, newPath) {
                yield* fs.rename(oldPath, newPath);
                if (Str.includes(".reap-")(oldPath) && Str.includes(".adopt-")(newPath)) {
                  yield* Deferred.succeed(adopted, undefined);
                  yield* Deferred.await(finishAdoption);
                }
              }),
            });
            const reaper = yield* Effect.forkChild(
              acquireJournalFileLock(lockPath, `${process.pid}:interrupted-contender`, 1).pipe(
                Effect.provideService(FileSystem.FileSystem, pausedFileSystem)
              )
            );
            yield* Deferred.await(adopted);
            const interrupter = yield* Effect.forkChild(Fiber.interrupt(reaper));
            yield* Effect.yieldNow;
            yield* Deferred.succeed(finishAdoption, undefined);
            yield* Fiber.join(interrupter);

            expect(yield* fs.exists(lockPath)).toBe(false);
            expect(A.filter(yield* fs.readDirectory(tempRoot.root), Str.includes(".reap-"))).toHaveLength(0);
          })
        );
      })
    ));

  it.effect("invalidates a timed-out adopter before the suspended owner resumes", () =>
    Effect.gen(function* () {
      const gibRef = yield* Ref.make(50);
      yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const lockPath = path.join(tempRoot.root, "timed-out-adopter.lock");
          const observedToken = `${DEAD_PID}:timed-out-adopter-generation`;
          const firstAdopted = yield* Deferred.make<void>();
          const resumeFirst = yield* Deferred.make<void>();
          yield* fs.makeDirectory(tempRoot.root, { recursive: true, mode: 0o700 });
          yield* fs.writeFileString(lockPath, observedToken);
          const pausedFileSystem = FileSystem.FileSystem.of({
            ...fs,
            rename: Effect.fn("FileSystem.FileSystem.rename")(function* (oldPath, newPath) {
              yield* fs.rename(oldPath, newPath);
              if (Str.includes(".reap-")(oldPath) && Str.includes(".adopt-")(newPath)) {
                yield* Deferred.succeed(firstAdopted, undefined);
                yield* Deferred.await(resumeFirst);
              }
            }),
          });
          const first = yield* Effect.forkChild(
            acquireJournalFileLock(lockPath, `${process.pid}:first-adopter`, 1).pipe(
              Effect.provideService(FileSystem.FileSystem, pausedFileSystem)
            )
          );
          yield* Deferred.await(firstAdopted);
          yield* TestClock.adjust("31001 millis");

          const takeover = yield* Effect.forkChild(
            acquireJournalFileLock(lockPath, `${process.pid}:takeover-adopter`, 1)
          );
          for (let attempt = 0; attempt < 100 && (yield* fs.exists(lockPath)); attempt++) {
            yield* Effect.yieldNow;
          }
          expect(yield* fs.exists(lockPath)).toBe(false);

          const replacementToken = `${process.pid}:replacement-after-takeover`;
          expect(yield* acquireJournalFileLock(lockPath, replacementToken, 1)).toBe(true);
          yield* Deferred.succeed(resumeFirst, undefined);
          yield* Effect.yieldNow;
          yield* TestClock.adjust("25 millis");

          expect(yield* Fiber.join(first)).toBe(false);
          expect(yield* Fiber.join(takeover)).toBe(false);
          const replacement = yield* fs.readFileString(lockPath).pipe(Effect.flatMap(decodeJournalLockGeneration));
          expect(replacement.ownerToken).toBe(replacementToken);
          expect(A.join(A.map(yield* TestConsole.errorLines, String), "\n")).toContain("reap claim lost");
          expect(A.filter(yield* fs.readDirectory(tempRoot.root), Str.includes(".reap-"))).toHaveLength(0);
          yield* releaseAdmissionJournalLockForTesting(lockPath, replacementToken);
        })
      );
    })
  );

  it("fences every destructive reap step when claim ownership is lost", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        for (const lossAtRead of A.make(1, 2, 4)) {
          const gibRef = yield* Ref.make(50);
          yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
            Effect.gen(function* () {
              const fs = yield* FileSystem.FileSystem;
              const path = yield* Path.Path;
              const lockPath = path.join(tempRoot.root, `claim-loss-${lossAtRead}.lock`);
              const observedToken = `${DEAD_PID}:claim-loss-${lossAtRead}`;
              yield* fs.makeDirectory(tempRoot.root, { recursive: true, mode: 0o700 });
              yield* fs.writeFileString(lockPath, observedToken);
              const claimLoss = yield* fileSystemWithLostJournalReapClaim(fs, lossAtRead);

              expect(
                yield* acquireJournalFileLock(lockPath, `${process.pid}:claim-loss-contender`, 1).pipe(
                  Effect.provideService(FileSystem.FileSystem, claimLoss.fileSystem)
                )
              ).toBe(false);

              expect(yield* Ref.get(claimLoss.adopterReads)).toBe(lossAtRead);
            })
          );
        }
      })
    ));

  it("retains the reclaimed tombstone when ownership is lost before completion", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const lockPath = path.join(tempRoot.root, "claim-lost-before-completion.lock");
            const observedToken = `${DEAD_PID}:claim-lost-before-completion`;
            yield* fs.makeDirectory(tempRoot.root, { recursive: true, mode: 0o700 });
            yield* fs.writeFileString(lockPath, observedToken);
            const claimLoss = yield* fileSystemWithLostJournalReapClaim(fs, 3);

            expect(
              yield* acquireJournalFileLock(lockPath, `${process.pid}:claim-loss-contender`, 1).pipe(
                Effect.provideService(FileSystem.FileSystem, claimLoss.fileSystem)
              )
            ).toBe(false);

            expect(yield* Ref.get(claimLoss.adopterReads)).toBe(3);
            expect(yield* fs.exists(lockPath)).toBe(false);
            expect(A.filter(yield* fs.readDirectory(tempRoot.root), Str.includes(".tombstone-"))).toHaveLength(1);
          })
        );
      })
    ));

  it("releases the adopter claim after completing a journal lock reap", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const lockPath = path.join(tempRoot.root, "completed-reap.lock");
            const observedToken = `${DEAD_PID}:completed-reap-generation`;
            const claimPath = reapClaimPath(lockPath, observedToken);
            const adopterPath = `${claimPath}.adopt-direct`;
            yield* fs.makeDirectory(tempRoot.root, { recursive: true, mode: 0o700 });
            yield* fs.writeFileString(lockPath, observedToken);
            yield* fs.link(lockPath, adopterPath);

            yield* finishAdmissionJournalLockReapForTesting(lockPath, claimPath, adopterPath, observedToken);

            expect(yield* fs.exists(lockPath)).toBe(false);
            expect(yield* fs.exists(adopterPath)).toBe(false);
            expect(A.filter(yield* fs.readDirectory(tempRoot.root), Str.includes(".tombstone-"))).toHaveLength(0);
          })
        );
      })
    ));

  it("refuses to restore a displaced generation after its reap claim is lost", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const lockPath = path.join(tempRoot.root, "restore-without-claim.lock");
            const replacementSeedPath = path.join(tempRoot.root, "restore-without-claim-replacement.lock");
            const observedToken = `${DEAD_PID}:restore-without-claim`;
            const replacementToken = `${process.pid}:restore-without-claim-replacement`;
            const adopterReads = yield* Ref.make(0);
            yield* fs.makeDirectory(tempRoot.root, { recursive: true, mode: 0o700 });
            yield* fs.writeFileString(lockPath, observedToken);
            expect(yield* acquireJournalFileLock(replacementSeedPath, replacementToken, 1)).toBe(true);
            const replacementGeneration = yield* fs.readFileString(replacementSeedPath);
            yield* releaseAdmissionJournalLockForTesting(replacementSeedPath, replacementToken);
            const claimLosingFileSystem = FileSystem.FileSystem.of({
              ...fs,
              readFileString: Effect.fn("FileSystem.FileSystem.readFileString")(function* (target, encoding) {
                if (Str.includes(".adopt-")(target)) {
                  const read = yield* Ref.updateAndGet(adopterReads, (count) => count + 1);
                  if (read === 3) {
                    yield* fs.remove(target, { force: true });
                  }
                }
                return yield* fs.readFileString(target, encoding);
              }),
              rename: Effect.fn("FileSystem.FileSystem.rename")(function* (oldPath, newPath) {
                if (Str.Equivalence(oldPath, lockPath) && Str.includes(".tombstone-")(newPath)) {
                  yield* fs.remove(lockPath, { force: true });
                  yield* fs.writeFileString(lockPath, replacementGeneration);
                }
                yield* fs.rename(oldPath, newPath);
              }),
            });

            expect(
              yield* acquireJournalFileLock(lockPath, `${process.pid}:restore-without-claim-contender`, 1).pipe(
                Effect.provideService(FileSystem.FileSystem, claimLosingFileSystem)
              )
            ).toBe(false);

            expect(yield* fs.exists(lockPath)).toBe(false);
            expect(yield* Ref.get(adopterReads)).toBe(3);
            expect(A.filter(yield* fs.readDirectory(tempRoot.root), Str.includes(".tombstone-"))).toHaveLength(1);
          })
        );
      })
    ));

  it("elects one claim adopter and restores a replacement published before the reclaim rename", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const lockPath = path.join(tempRoot.root, "journal.lock");
            const replacementSeedPath = path.join(tempRoot.root, "replacement-seed.lock");
            const replacementToken = `${process.pid}:replacement-writer`;
            yield* fs.makeDirectory(tempRoot.root, { recursive: true, mode: 0o700 });
            expect(yield* acquireJournalFileLock(replacementSeedPath, replacementToken, 1)).toBe(true);
            const replacementGeneration = yield* fs.readFileString(replacementSeedPath);
            yield* releaseAdmissionJournalLockForTesting(replacementSeedPath, replacementToken);
            yield* fs.writeFileString(lockPath, `${DEAD_PID}:abandoned-generation`);

            const stageLinks = yield* Ref.make(0);
            const bothContendersReady = yield* Deferred.make<void>();
            const lockTombstones = yield* Ref.make(0);
            const interleavedFileSystem = FileSystem.FileSystem.of({
              ...fs,
              link: Effect.fn("FileSystem.FileSystem.link")(function* (existingPath, newPath) {
                if (Str.includes(".stage-")(existingPath) && Str.Equivalence(newPath, lockPath)) {
                  const count = yield* Ref.updateAndGet(stageLinks, (value) => value + 1);
                  if (count === 2) {
                    yield* Deferred.succeed(bothContendersReady, undefined);
                  }
                  yield* Deferred.await(bothContendersReady);
                }
                return yield* fs.link(existingPath, newPath);
              }),
              rename: Effect.fn("FileSystem.FileSystem.rename")(function* (oldPath, newPath) {
                if (Str.Equivalence(oldPath, lockPath) && Str.includes(".tombstone-")(newPath)) {
                  yield* Ref.update(lockTombstones, (value) => value + 1);
                  yield* fs.remove(lockPath, { force: true });
                  yield* fs.writeFileString(lockPath, replacementGeneration);
                }
                yield* fs.rename(oldPath, newPath);
              }),
            });

            const acquired = yield* Effect.forEach(
              ["first-adopter", "second-adopter"],
              (token) =>
                acquireJournalFileLock(lockPath, `${process.pid}:${token}`, 1).pipe(
                  Effect.provideService(FileSystem.FileSystem, interleavedFileSystem)
                ),
              { concurrency: "unbounded" }
            );

            expect(acquired).toStrictEqual([false, false]);
            expect(yield* Ref.get(lockTombstones)).toBe(1);
            expect(yield* fs.readFileString(lockPath)).toBe(replacementGeneration);
            yield* releaseAdmissionJournalLockForTesting(lockPath, replacementToken);
          })
        );
      })
    ));

  it("retains a displaced generation when a third writer wins and fences its stale publish", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const lockPath = path.join(tempRoot.root, "journal.lock");
            const journalPath = yield* admissionJournalPath(tempRoot.root);
            const replacementSeedPath = path.join(tempRoot.root, "replacement-seed.lock");
            const thirdSeedPath = path.join(tempRoot.root, "third-seed.lock");
            const replacementToken = `${process.pid}:displaced-writer`;
            const thirdToken = `${process.pid}:third-writer`;
            yield* fs.makeDirectory(tempRoot.root, { recursive: true, mode: 0o700 });
            expect(yield* acquireJournalFileLock(replacementSeedPath, replacementToken, 1)).toBe(true);
            expect(yield* acquireJournalFileLock(thirdSeedPath, thirdToken, 1)).toBe(true);
            const replacementGeneration = yield* fs.readFileString(replacementSeedPath);
            const thirdGeneration = yield* fs.readFileString(thirdSeedPath);
            yield* releaseAdmissionJournalLockForTesting(replacementSeedPath, replacementToken);
            yield* releaseAdmissionJournalLockForTesting(thirdSeedPath, thirdToken);
            yield* fs.writeFileString(lockPath, `${DEAD_PID}:abandoned-generation`);
            const interleavedFileSystem = FileSystem.FileSystem.of({
              ...fs,
              rename: Effect.fn("FileSystem.FileSystem.rename")(function* (oldPath, newPath) {
                if (Str.Equivalence(oldPath, lockPath) && Str.includes(".tombstone-")(newPath)) {
                  yield* fs.remove(lockPath, { force: true });
                  yield* fs.writeFileString(lockPath, replacementGeneration);
                  yield* fs.rename(lockPath, newPath);
                  yield* fs.writeFileString(lockPath, thirdGeneration);
                  return;
                }
                yield* fs.rename(oldPath, newPath);
              }),
            });

            expect(
              yield* acquireJournalFileLock(lockPath, `${process.pid}:reclaimer`, 1).pipe(
                Effect.provideService(FileSystem.FileSystem, interleavedFileSystem)
              )
            ).toBe(false);

            expect(yield* fs.readFileString(lockPath)).toBe(thirdGeneration);
            const tombstones = A.filter(yield* fs.readDirectory(tempRoot.root), Str.includes(".tombstone-"));
            expect(tombstones).toHaveLength(1);
            const lockLost = yield* publishAdmissionJournalForTesting(
              journalPath,
              lockPath,
              replacementToken,
              "displaced writer must not publish\n"
            ).pipe(Effect.flip);
            expect(lockLost.message).toContain("was lost before publication");
            expect(yield* fs.exists(journalPath)).toBe(false);
            expect(A.filter(yield* fs.readDirectory(tempRoot.root), Str.includes(".tombstone-"))).toHaveLength(1);
            yield* releaseAdmissionJournalLockForTesting(lockPath, thirdToken);
            const recoveryToken = `${process.pid}:recovery-contender`;
            expect(yield* acquireJournalFileLock(lockPath, recoveryToken, 1)).toBe(true);
            expect(A.filter(yield* fs.readDirectory(tempRoot.root), Str.includes(".tombstone-"))).toHaveLength(0);
            yield* publishAdmissionJournalForTesting(journalPath, lockPath, recoveryToken, "fresh recovery writer\n");
            expect(yield* fs.readFileString(journalPath)).toBe("fresh recovery writer\n");
            yield* releaseAdmissionJournalLockForTesting(lockPath, recoveryToken);
          })
        );
      })
    ));

  it("probes only the process-identity source recorded by each live lock generation", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const withoutProcfs = FileSystem.FileSystem.of({
              ...fs,
              readFileString: Effect.fn("FileSystem.FileSystem.readFileString")((target, encoding) =>
                Str.startsWith("/proc/")(target) ? Effect.succeed("") : fs.readFileString(target, encoding)
              ),
            });
            yield* fs.makeDirectory(tempRoot.root, { recursive: true, mode: 0o700 });

            const systemLockPath = path.join(tempRoot.root, "system-source.lock");
            const systemOwner = `${process.pid}:system-source-owner`;
            expect(
              yield* acquireJournalFileLock(systemLockPath, systemOwner, 1).pipe(
                Effect.provideService(FileSystem.FileSystem, withoutProcfs)
              )
            ).toBe(true);
            const systemGeneration = yield* fs
              .readFileString(systemLockPath)
              .pipe(Effect.flatMap(decodeJournalLockGeneration));
            expect(Str.startsWith(process.platform === "win32" ? "win:" : "ps:")(systemGeneration.procStart)).toBe(
              true
            );
            expect(yield* acquireJournalFileLock(systemLockPath, `${process.pid}:proc-contender`, 1)).toBe(false);
            expect(Str.includes(systemOwner)(yield* fs.readFileString(systemLockPath))).toBe(true);
            yield* releaseAdmissionJournalLockForTesting(systemLockPath, systemOwner);

            const procLockPath = path.join(tempRoot.root, "proc-source.lock");
            const procOwner = `${process.pid}:proc-source-owner`;
            expect(yield* acquireJournalFileLock(procLockPath, procOwner, 1)).toBe(true);
            const procGeneration = yield* fs
              .readFileString(procLockPath)
              .pipe(Effect.flatMap(decodeJournalLockGeneration));
            expect(Str.startsWith("proc:")(procGeneration.procStart)).toBe(true);
            expect(
              yield* acquireJournalFileLock(procLockPath, `${process.pid}:system-contender`, 1).pipe(
                Effect.provideService(FileSystem.FileSystem, withoutProcfs)
              )
            ).toBe(false);
            expect(Str.includes(procOwner)(yield* fs.readFileString(procLockPath))).toBe(true);
            yield* releaseAdmissionJournalLockForTesting(procLockPath, procOwner);
          })
        );
      })
    ));

  it("sweeps stale reap sidecars before acquiring an absent journal lock", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const lockPath = path.join(tempRoot.root, "journal.lock");
            const claimPath = `${lockPath}.reap-stale-claim`;
            const ownerToken = `${process.pid}:orphan-sweeper`;
            yield* fs.makeDirectory(tempRoot.root, { recursive: true, mode: 0o700 });
            yield* fs.writeFileString(claimPath, `${DEAD_PID}:orphaned-claim`);

            expect(yield* acquireJournalFileLock(lockPath, ownerToken, 1)).toBe(true);

            expect(yield* fs.exists(claimPath)).toBe(false);
            yield* releaseAdmissionJournalLockForTesting(lockPath, ownerToken);
          })
        );
      })
    ));

  it("sweeps orphaned tombstones without reviving an abandoned generation", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const liveLockPath = path.join(tempRoot.root, "live-tombstone.lock");
            const liveOwnerToken = `${process.pid}:live-tombstone-owner`;
            const liveTombstonePath = `${liveLockPath}.reap-stale.tombstone-orphan`;
            yield* fs.makeDirectory(tempRoot.root, { recursive: true, mode: 0o700 });
            expect(yield* acquireJournalFileLock(liveLockPath, liveOwnerToken, 1)).toBe(true);
            yield* fs.writeFileString(liveTombstonePath, `${DEAD_PID}:stale-tombstone`);

            expect(yield* acquireJournalFileLock(liveLockPath, `${process.pid}:live-contender`, 1)).toBe(false);
            expect(yield* fs.exists(liveTombstonePath)).toBe(false);
            yield* releaseAdmissionJournalLockForTesting(liveLockPath, liveOwnerToken);

            const crashLockPath = path.join(tempRoot.root, "crashed-reclaimer.lock");
            const crashTombstonePath = `${crashLockPath}.reap-stale.tombstone-orphan`;
            const recoveryOwnerToken = `${process.pid}:post-crash-writer`;
            const journalPath = yield* admissionJournalPath(tempRoot.root);
            yield* fs.writeFileString(crashTombstonePath, `${process.pid}:abandoned-live-generation`);

            expect(yield* acquireJournalFileLock(crashLockPath, recoveryOwnerToken, 1)).toBe(true);
            expect(yield* fs.exists(crashTombstonePath)).toBe(false);
            yield* publishAdmissionJournalForTesting(
              journalPath,
              crashLockPath,
              recoveryOwnerToken,
              "post-crash writer\n"
            );
            expect(yield* fs.readFileString(journalPath)).toBe("post-crash writer\n");
            expect(A.join(A.map(yield* TestConsole.errorLines, String), "\n")).toContain(crashTombstonePath);
            yield* releaseAdmissionJournalLockForTesting(crashLockPath, recoveryOwnerToken);
          })
        );
      }).pipe(provideScopedLayer(TestConsole.layer))
    ));

  it("reaps a journal lock when its live PID has a different process start identity", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const lockPath = path.join(tempRoot.root, "journal.lock");
            const reusedGeneration = AdmissionJournalLockGeneration.make({
              schemaVersion: "yeet-admission-journal-lock/v1",
              pid: process.pid,
              procStart: "not-the-current-process-start",
              ownerToken: `${process.pid}:reused-generation`,
            });
            yield* fs.makeDirectory(tempRoot.root, { recursive: true, mode: 0o700 });
            yield* fs.writeFileString(lockPath, yield* encodeJournalLockGeneration(reusedGeneration));

            yield* appendAdmissionJournalEvent(tempRoot.root, journalAdmitted(1));

            expect(A.map(yield* readJournalEvents(tempRoot.root), (event) => event.nonce)).toStrictEqual(["nonce-1"]);
          })
        );
      })
    ));

  it("preserves an abandoned lock when its reaper claim token cannot be verified", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const lockPath = path.join(tempRoot.root, "journal.lock");
            const observedToken = `${DEAD_PID}:abandoned-generation`;
            yield* fs.makeDirectory(tempRoot.root, { recursive: true, mode: 0o700 });
            yield* fs.writeFileString(lockPath, observedToken);
            const mismatchedClaimFileSystem = FileSystem.FileSystem.of({
              ...fs,
              readFileString: Effect.fn("FileSystem.FileSystem.readFileString")((target, encoding) =>
                Str.includes(".reap-")(target)
                  ? Effect.succeed(`${process.pid}:replacement-generation`)
                  : fs.readFileString(target, encoding)
              ),
            });

            const acquired = yield* acquireJournalFileLock(lockPath, `${process.pid}:contender`, 1).pipe(
              Effect.provideService(FileSystem.FileSystem, mismatchedClaimFileSystem)
            );

            expect(acquired).toBe(false);
            expect(yield* fs.readFileString(lockPath)).toBe(observedToken);
          })
        );
      })
    ));

  it("waits for live, fresh, unreadable, and concurrently vanished claim adopters", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            yield* fs.makeDirectory(tempRoot.root, { recursive: true, mode: 0o700 });
            const procStart = O.getOrThrow(yield* processStartIdentityForPid(process.pid));
            const nowMillis = yield* Clock.currentTimeMillis;

            const liveLockPath = path.join(tempRoot.root, "live-adopter.lock");
            const liveToken = `${DEAD_PID}:live-adopter-generation`;
            const liveClaimPath = reapClaimPath(liveLockPath, liveToken);
            const liveAdopterPath = reapAdopterPath(
              liveClaimPath,
              AdmissionJournalLockGeneration.make({
                schemaVersion: "yeet-admission-journal-lock/v1",
                pid: process.pid,
                procStart,
                ownerToken: `${process.pid}:live-adopter`,
              }),
              nowMillis
            );
            yield* fs.writeFileString(liveLockPath, liveToken);
            yield* fs.writeFileString(liveAdopterPath, liveToken);
            expect(yield* acquireJournalFileLock(liveLockPath, `${process.pid}:contender-live`, 1)).toBe(false);
            expect(yield* fs.exists(liveLockPath)).toBe(true);

            const legacyLockPath = path.join(tempRoot.root, "legacy-live-adopter.lock");
            const legacyToken = `${DEAD_PID}:legacy-live-adopter-generation`;
            const legacyClaimPath = reapClaimPath(legacyLockPath, legacyToken);
            const legacyAdopterPath = `${legacyClaimPath}.adopt-${process.pid}.${Encoding.encodeBase64Url(procStart)}.${Encoding.encodeBase64Url(`${process.pid}:legacy-live-adopter`)}`;
            yield* fs.writeFileString(legacyLockPath, legacyToken);
            yield* fs.link(legacyLockPath, legacyAdopterPath);
            expect(yield* acquireJournalFileLock(legacyLockPath, `${process.pid}:contender-legacy`, 1)).toBe(false);
            expect(yield* fs.exists(legacyLockPath)).toBe(true);

            const freshLockPath = path.join(tempRoot.root, "fresh-malformed-adopter.lock");
            const freshToken = `${DEAD_PID}:fresh-malformed-generation`;
            yield* fs.writeFileString(freshLockPath, freshToken);
            yield* fs.writeFileString(`${reapClaimPath(freshLockPath, freshToken)}.adopt-malformed`, freshToken);
            expect(yield* acquireJournalFileLock(freshLockPath, `${process.pid}:contender-fresh`, 1)).toBe(false);
            expect(yield* fs.exists(freshLockPath)).toBe(true);

            const unreadableLockPath = path.join(tempRoot.root, "unreadable-adopter-directory.lock");
            const unreadableToken = `${DEAD_PID}:unreadable-adopter-generation`;
            yield* fs.writeFileString(unreadableLockPath, unreadableToken);
            const unavailableDirectory = fs.readDirectory(path.join(tempRoot.root, "missing-directory"));
            const unreadableFileSystem = FileSystem.FileSystem.of({
              ...fs,
              readDirectory: Effect.fn("ProcessIdentityTest.readDirectory")((target) =>
                Str.Equivalence(target, tempRoot.root) ? unavailableDirectory : fs.readDirectory(target)
              ),
            });
            expect(
              yield* acquireJournalFileLock(unreadableLockPath, `${process.pid}:contender-unreadable`, 1).pipe(
                Effect.provideService(FileSystem.FileSystem, unreadableFileSystem)
              )
            ).toBe(false);
            expect(yield* fs.exists(unreadableLockPath)).toBe(true);

            const vanishedLockPath = path.join(tempRoot.root, "vanished-adopter.lock");
            const vanishedToken = `${DEAD_PID}:vanished-adopter-generation`;
            const vanishedAdopterName = path.basename(
              `${reapClaimPath(vanishedLockPath, vanishedToken)}.adopt-vanished`
            );
            yield* fs.writeFileString(vanishedLockPath, vanishedToken);
            const vanishedFileSystem = FileSystem.FileSystem.of({
              ...fs,
              readDirectory: Effect.fn("ProcessIdentityTest.readDirectory")((target) =>
                Str.Equivalence(target, tempRoot.root)
                  ? fs.readDirectory(target).pipe(Effect.map((entries) => A.append(entries, vanishedAdopterName)))
                  : fs.readDirectory(target)
              ),
            });
            expect(
              yield* acquireJournalFileLock(vanishedLockPath, `${process.pid}:contender-vanished`, 1).pipe(
                Effect.provideService(FileSystem.FileSystem, vanishedFileSystem)
              )
            ).toBe(false);
            expect(yield* fs.exists(vanishedLockPath)).toBe(true);
          })
        );
      })
    ));

  it("retires stale malformed and dead claim adopters", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            yield* fs.makeDirectory(tempRoot.root, { recursive: true, mode: 0o700 });
            const nowMillis = yield* Clock.currentTimeMillis;
            const agedSeconds = (nowMillis - 31_000) / 1_000;

            const staleLiveLockPath = path.join(tempRoot.root, "stale-live-adopter.lock");
            const staleLiveToken = `${DEAD_PID}:stale-live-adopter-generation`;
            const staleLiveClaimPath = reapClaimPath(staleLiveLockPath, staleLiveToken);
            const staleLiveAdopterPath = reapAdopterPath(
              staleLiveClaimPath,
              AdmissionJournalLockGeneration.make({
                schemaVersion: "yeet-admission-journal-lock/v1",
                pid: process.pid,
                procStart: O.getOrThrow(yield* processStartIdentityForPid(process.pid)),
                ownerToken: `${process.pid}:stale-live-adopter`,
              }),
              nowMillis - 31_000
            );
            yield* fs.writeFileString(staleLiveLockPath, staleLiveToken);
            yield* fs.link(staleLiveLockPath, staleLiveAdopterPath);
            const staleLiveContender = `${process.pid}:stale-live-contender`;
            expect(yield* acquireJournalFileLock(staleLiveLockPath, staleLiveContender, 2)).toBe(true);
            expect(yield* fs.exists(staleLiveAdopterPath)).toBe(false);
            yield* releaseAdmissionJournalLockForTesting(staleLiveLockPath, staleLiveContender);

            const staleLockPath = path.join(tempRoot.root, "stale-malformed-adopter.lock");
            const staleToken = `${DEAD_PID}:stale-malformed-generation`;
            const staleAdopterPath = `${reapClaimPath(staleLockPath, staleToken)}.adopt-not-a-number.cHJvYzpzdGFydA.b3duZXI`;
            yield* fs.writeFileString(staleLockPath, staleToken);
            yield* fs.link(staleLockPath, staleAdopterPath);
            yield* fs.utimes(staleAdopterPath, agedSeconds, agedSeconds);
            expect(yield* acquireJournalFileLock(staleLockPath, `${process.pid}:contender-stale`, 1)).toBe(false);
            expect(yield* fs.exists(staleLockPath)).toBe(false);

            const deadLockPath = path.join(tempRoot.root, "dead-adopter.lock");
            const deadToken = `${DEAD_PID}:dead-adopter-generation`;
            const deadClaimPath = reapClaimPath(deadLockPath, deadToken);
            const deadAdopterPath = reapAdopterPath(
              deadClaimPath,
              AdmissionJournalLockGeneration.make({
                schemaVersion: "yeet-admission-journal-lock/v1",
                pid: DEAD_PID,
                procStart: "proc:dead-start",
                ownerToken: `${DEAD_PID}:dead-adopter`,
              }),
              nowMillis
            );
            yield* fs.writeFileString(deadLockPath, deadToken);
            yield* fs.link(deadLockPath, deadAdopterPath);
            expect(yield* acquireJournalFileLock(deadLockPath, `${process.pid}:contender-dead`, 1)).toBe(false);
            expect(yield* fs.exists(deadLockPath)).toBe(false);
          })
        );
      })
    ));

  it("keeps the observed generation when claim validation or tombstoning loses its race", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            yield* fs.makeDirectory(tempRoot.root, { recursive: true, mode: 0o700 });

            const changedLockPath = path.join(tempRoot.root, "changed-before-finish.lock");
            const changedToken = `${DEAD_PID}:changed-before-finish-generation`;
            yield* fs.writeFileString(changedLockPath, changedToken);
            const changedFileSystem = FileSystem.FileSystem.of({
              ...fs,
              readFileString: Effect.fn("ProcessIdentityTest.readFileString")((target, encoding) =>
                Str.includes(".adopt-")(target)
                  ? Effect.succeed(`${process.pid}:different-claim-generation`)
                  : fs.readFileString(target, encoding)
              ),
            });
            expect(
              yield* acquireJournalFileLock(changedLockPath, `${process.pid}:contender-changed`, 1).pipe(
                Effect.provideService(FileSystem.FileSystem, changedFileSystem)
              )
            ).toBe(false);
            expect(yield* fs.readFileString(changedLockPath)).toBe(changedToken);

            const tombstoneLockPath = path.join(tempRoot.root, "failed-tombstone.lock");
            const tombstoneToken = `${DEAD_PID}:failed-tombstone-generation`;
            yield* fs.writeFileString(tombstoneLockPath, tombstoneToken);
            const failedRename = fs.rename(
              path.join(tempRoot.root, "missing-source"),
              path.join(tempRoot.root, "unused")
            );
            const tombstoneFileSystem = FileSystem.FileSystem.of({
              ...fs,
              rename: Effect.fn("ProcessIdentityTest.rename")((oldPath, newPath) =>
                Str.Equivalence(oldPath, tombstoneLockPath) && Str.includes(".tombstone-")(newPath)
                  ? failedRename
                  : fs.rename(oldPath, newPath)
              ),
            });
            expect(
              yield* acquireJournalFileLock(tombstoneLockPath, `${process.pid}:contender-tombstone`, 1).pipe(
                Effect.provideService(FileSystem.FileSystem, tombstoneFileSystem)
              )
            ).toBe(false);
            expect(yield* fs.readFileString(tombstoneLockPath)).toBe(tombstoneToken);
          })
        );
      })
    ));

  it("handles unavailable generation identity, vanished contention, and absent release", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            yield* fs.makeDirectory(tempRoot.root, { recursive: true, mode: 0o700 });

            const unavailableLockPath = path.join(tempRoot.root, "unavailable-identity.lock");
            const unavailableFileSystem = FileSystem.FileSystem.of({
              ...fs,
              readFileString: Effect.fn("ProcessIdentityTest.readFileString")((target, encoding) =>
                Str.startsWith("/proc/")(target) ? Effect.succeed("") : fs.readFileString(target, encoding)
              ),
            });
            const platform = Object.getOwnPropertyDescriptor(process, "platform");
            Object.defineProperty(process, "platform", { configurable: true, value: "win32" });
            try {
              expect(
                yield* acquireJournalFileLock(unavailableLockPath, `${process.pid}:unavailable`, 1).pipe(
                  Effect.provideService(FileSystem.FileSystem, unavailableFileSystem)
                )
              ).toBe(false);
            } finally {
              Object.defineProperty(process, "platform", platform ?? { configurable: true, value: "linux" });
            }

            const unavailableAdopterPath = path.join(tempRoot.root, "unavailable-adopter-identity.lock");
            const unavailableAdopterToken = `${DEAD_PID}:unavailable-adopter-generation`;
            const procReads = yield* Ref.make(0);
            yield* fs.writeFileString(unavailableAdopterPath, unavailableAdopterToken);
            const unavailableAdopterFileSystem = FileSystem.FileSystem.of({
              ...fs,
              readFileString: Effect.fn("ProcessIdentityTest.readFileString")(function* (target, encoding) {
                if (!Str.startsWith("/proc/")(target)) {
                  return yield* fs.readFileString(target, encoding);
                }
                const readCount = yield* Ref.updateAndGet(procReads, (count) => count + 1);
                return readCount === 1 ? yield* fs.readFileString(target, encoding) : Str.empty;
              }),
            });
            Object.defineProperty(process, "platform", { configurable: true, value: "win32" });
            try {
              expect(
                yield* withProcessPath(
                  Str.empty,
                  acquireJournalFileLock(unavailableAdopterPath, `${process.pid}:adopter-unavailable`, 1).pipe(
                    Effect.provideService(FileSystem.FileSystem, unavailableAdopterFileSystem)
                  )
                )
              ).toBe(false);
            } finally {
              Object.defineProperty(process, "platform", platform ?? { configurable: true, value: "linux" });
            }
            expect(yield* fs.readFileString(unavailableAdopterPath)).toBe(unavailableAdopterToken);

            const vanishedLockPath = path.join(tempRoot.root, "vanished-contention.lock");
            const missingSource = path.join(tempRoot.root, "missing-link-source");
            const vanishedFileSystem = FileSystem.FileSystem.of({
              ...fs,
              link: Effect.fn("ProcessIdentityTest.link")((existingPath, newPath) =>
                Str.includes(".stage-")(existingPath) ? fs.link(missingSource, newPath) : fs.link(existingPath, newPath)
              ),
            });
            expect(
              yield* acquireJournalFileLock(vanishedLockPath, `${process.pid}:vanished`, 1).pipe(
                Effect.provideService(FileSystem.FileSystem, vanishedFileSystem)
              )
            ).toBe(false);
            expect(yield* fs.exists(vanishedLockPath)).toBe(false);
          })
        );
      })
    ));

  it("restores a replacement generation taken while its predecessor releases", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const lockPath = path.join(tempRoot.root, "release-race.lock");
            const replacementSeedPath = path.join(tempRoot.root, "release-race-replacement.lock");
            const ownerToken = `${process.pid}:release-race-owner`;
            const replacementToken = `${process.pid}:release-race-replacement`;
            yield* fs.makeDirectory(tempRoot.root, { recursive: true, mode: 0o700 });
            expect(yield* acquireJournalFileLock(lockPath, ownerToken, 1)).toBe(true);
            expect(yield* acquireJournalFileLock(replacementSeedPath, replacementToken, 1)).toBe(true);
            const replacementGeneration = yield* fs.readFileString(replacementSeedPath);
            yield* releaseAdmissionJournalLockForTesting(replacementSeedPath, replacementToken);

            const replacementPublished = yield* Ref.make(false);
            const publishReplacement = Effect.fnUntraced(function* () {
              const shouldPublish = yield* Ref.modify(replacementPublished, (published) => [!published, true]);
              if (shouldPublish) {
                yield* fs.remove(lockPath, { force: true });
                yield* fs.writeFileString(lockPath, replacementGeneration);
              }
            });
            const interleavedFileSystem = FileSystem.FileSystem.of({
              ...fs,
              readFileString: Effect.fn("FileSystem.FileSystem.readFileString")(function* (target, encoding) {
                const content = yield* fs.readFileString(target, encoding);
                if (Str.Equivalence(target, lockPath)) {
                  yield* publishReplacement();
                }
                return content;
              }),
              rename: Effect.fn("FileSystem.FileSystem.rename")(function* (oldPath, newPath) {
                if (Str.Equivalence(oldPath, lockPath) && Str.includes(".tombstone-")(newPath)) {
                  yield* publishReplacement();
                }
                yield* fs.rename(oldPath, newPath);
              }),
            });

            yield* releaseAdmissionJournalLockForTesting(lockPath, ownerToken).pipe(
              Effect.provideService(FileSystem.FileSystem, interleavedFileSystem)
            );

            expect(yield* fs.readFileString(lockPath)).toBe(replacementGeneration);
            expect(A.filter(yield* fs.readDirectory(tempRoot.root), Str.includes(".tombstone-"))).toHaveLength(0);
            yield* releaseAdmissionJournalLockForTesting(lockPath, replacementToken);
          })
        );
      })
    ));

  it("retains a taken release tombstone when a third writer wins the vacant path", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const lockPath = path.join(tempRoot.root, "release-third-writer.lock");
            const replacementToken = `${process.pid}:release-displaced-replacement`;
            const thirdToken = `${process.pid}:release-third-writer`;
            yield* fs.makeDirectory(tempRoot.root, { recursive: true, mode: 0o700 });
            expect(yield* acquireJournalFileLock(lockPath, replacementToken, 1)).toBe(true);

            const interleavedFileSystem = FileSystem.FileSystem.of({
              ...fs,
              link: Effect.fn("FileSystem.FileSystem.link")(function* (existingPath, newPath) {
                if (Str.includes(".tombstone-")(existingPath) && Str.Equivalence(newPath, lockPath)) {
                  yield* fs.writeFileString(lockPath, thirdToken);
                }
                yield* fs.link(existingPath, newPath);
              }),
            });
            yield* releaseAdmissionJournalLockForTesting(lockPath, `${process.pid}:released-predecessor`).pipe(
              Effect.provideService(FileSystem.FileSystem, interleavedFileSystem)
            );

            expect(yield* fs.readFileString(lockPath)).toBe(thirdToken);
            expect(A.filter(yield* fs.readDirectory(tempRoot.root), Str.includes(".tombstone-"))).toHaveLength(1);
            yield* releaseAdmissionJournalLockForTesting(lockPath, thirdToken);
            const recoveryToken = `${process.pid}:release-recovery`;
            expect(yield* acquireJournalFileLock(lockPath, recoveryToken, 1)).toBe(true);
            expect(A.filter(yield* fs.readDirectory(tempRoot.root), Str.includes(".tombstone-"))).toHaveLength(0);
            yield* releaseAdmissionJournalLockForTesting(lockPath, recoveryToken);
          })
        );
      })
    ));

  it("releases only the owned journal lock generation", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const lockPath = path.join(tempRoot.root, "journal.lock");
            yield* fs.makeDirectory(tempRoot.root, { recursive: true, mode: 0o700 });
            const ownerToken = `${process.pid}:owned-release`;
            expect(yield* acquireJournalFileLock(lockPath, ownerToken, 1)).toBe(true);

            yield* releaseAdmissionJournalLockForTesting(lockPath, `${process.pid}:not-the-owner`);

            expect(
              (yield* fs.readFileString(lockPath).pipe(Effect.flatMap(decodeJournalLockGeneration))).ownerToken
            ).toBe(ownerToken);
            yield* releaseAdmissionJournalLockForTesting(lockPath, ownerToken);
            expect(O.isNone(yield* fs.stat(lockPath).pipe(Effect.option))).toBe(true);
          })
        );
      })
    ));

  it("leaves an absent journal lock absent when releasing", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const lockPath = path.join(tempRoot.root, "absent-release.lock");
            yield* fs.makeDirectory(tempRoot.root, { recursive: true, mode: 0o700 });

            yield* releaseAdmissionJournalLockForTesting(lockPath, "absent");

            expect(yield* fs.exists(lockPath)).toBe(false);
            expect(
              A.filter(yield* fs.readDirectory(tempRoot.root), Str.startsWith("absent-release.lock.reap-"))
            ).toHaveLength(0);
          })
        );
      })
    ));

  it("uses a stable fallback for an empty artifact-safe name", () => {
    expect(repoRunSafeArtifactName("///")).toBe("repo");
  });

  it("serializes protocol disablement behind the admission journal lock", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const path = yield* Path.Path;
            yield* setAdmissionEvictionProtocol("on");
            const lockPath = path.join(tempRoot.root, "journal.lock");
            const lockToken = `${process.pid}:00000000-0000-4000-8000-000000000124`;
            expect(yield* acquireJournalFileLock(lockPath, lockToken, 1)).toBe(true);
            const disabling = yield* Effect.forkChild(setAdmissionEvictionProtocol("off"));
            yield* Effect.sleep("75 millis");
            expect(disabling.pollUnsafe()).toBeUndefined();
            expect((yield* admissionProtocolStatus()).eviction).toBe("on");
            yield* releaseAdmissionJournalLockForTesting(lockPath, lockToken);
            expect((yield* Fiber.join(disabling)).eviction).toBe("off");
          })
        );
      })
    ));

  it("executes every scheduler CLI mutation and reporting route", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, () =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const repositoryMarker = path.join(process.cwd(), ".git");
            const repositoryMarkerFileSystem = FileSystem.FileSystem.of({
              ...fs,
              exists: Effect.fnUntraced(function* (target: string) {
                return target === repositoryMarker ? true : yield* fs.exists(target);
              }),
            });

            yield* Effect.gen(function* () {
              const expectCommandSuccess = Effect.fnUntraced(function* (args: ReadonlyArray<string>) {
                const exit = yield* Effect.exit(runQualityCommand(args));
                expect(exit._tag, `${A.join(args, " ")}: ${String(exit)}`).toBe("Success");
              });
              yield* expectCommandSuccess(["scheduler"]);
              yield* expectCommandSuccess(["scheduler", "status", "--json"]);
              yield* expectCommandSuccess(["scheduler", "reap", "--apply"]);
              yield* expectCommandSuccess(["scheduler", "protocol"]);
              yield* expectCommandSuccess(["scheduler", "protocol", "--enable-evictions"]);
              expect((yield* admissionProtocolStatus()).eviction).toBe("on");
              yield* expectCommandSuccess(["scheduler", "protocol", "--disable-evictions"]);
              expect((yield* admissionProtocolStatus()).eviction).toBe("off");
              yield* expectCommandSuccess(["scheduler", "reconcile-attempts"]);
              const conflict = yield* Effect.exit(
                runQualityCommand(["scheduler", "protocol", "--enable-evictions", "--disable-evictions"])
              );
              expect(conflict._tag).toBe("Failure");
            }).pipe(Effect.provideService(FileSystem.FileSystem, repositoryMarkerFileSystem));
          }).pipe(provideScopedLayer(TestConsole.layer))
        );
      }).pipe(provideScopedLayer(SchedulerCommandLayer))
    ));

  it("claims dead tickets when terminal publication is absent or cannot be written", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const blockedCheckoutRoot = path.join(tempRoot.root, "blocked-checkout");
            yield* fs.makeDirectory(tempRoot.root, { recursive: true, mode: 0o700 });
            yield* fs.writeFileString(blockedCheckoutRoot, "not a directory");
            yield* writeFakeTicket(tempRoot, {
              pid: DEAD_PID,
              nonce: "dead-without-attempt",
              attemptId: O.none(),
            });
            yield* writeFakeTicket(tempRoot, {
              pid: DEAD_PID,
              nonce: "dead-unwritable-attempt",
              checkoutRoot: blockedCheckoutRoot,
              attemptId: O.some(JOURNALED_ATTEMPT_ID),
            });

            const failure = yield* reapAdmissionState({ apply: true }).pipe(Effect.flip);

            expect(failure.message).toContain("Failed to create Yeet attempt journal directory");
            const queued = yield* listDirectory(tempRoot.queue);
            const claims = yield* Effect.forEach(yield* listDirectory(tempRoot.claims), (name) =>
              fs.readFileString(path.join(tempRoot.claims, name)).pipe(Effect.flatMap(decodeAdmissionReapClaim))
            );
            expect(queued).not.toContain("dead-unwritable-attempt.ticket.json");
            expect(A.some(claims, ({ nonce }) => nonce === "dead-unwritable-attempt")).toBe(true);
            if (A.contains(queued, "dead-without-attempt.ticket.json")) {
              expect(A.some(claims, ({ nonce }) => nonce === "dead-without-attempt")).toBe(true);
            }
          }).pipe(provideScopedLayer(TestConsole.layer))
        );
      })
    ));

  it("decodes legacy lease files without nonce or enqueuedAtMillis", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const procStart = yield* ownProcStart();
            const encoded = yield* encodeLease(
              YeetAdmissionLease.make({
                schemaVersion: "yeet-admission-lease/v1",
                pid: process.pid,
                procStart,
                kind: "full-proof",
                weightTokens: 3,
                priority: "verify",
                originKey: "origin-legacy",
                checkoutRoot: "/repo/legacy",
                branch: "feat/legacy",
                command: "bun run beep yeet verify",
                startedAt: "2026-08-27T00:00:00Z",
                admittedAtMillis: 100,
                heartbeatAtMillis: 100,
              })
            );
            const legacy = pipe(yield* decodeJsonObject(encoded), Struct.omit(["nonce", "enqueuedAtMillis"]));
            yield* fs.makeDirectory(tempRoot.leases, { recursive: true, mode: 0o700 });
            const leasePath = path.join(tempRoot.leases, `legacy-${process.pid}.lease.json`);
            yield* fs.writeFileString(leasePath, yield* encodeJsonObject(legacy));
            const raw = yield* fs.readFileString(leasePath);
            const decoded = yield* decodeLease(raw);
            expect(decoded.nonce).toBe("");
            expect(decoded.enqueuedAtMillis).toBe(0);
            const snapshot = yield* admissionStatus(fastConfig);
            expect((yield* admissionProtocolStatus()).eviction).toBe("off");
            expect(snapshot.leases).toHaveLength(1);
          })
        );
      })
    ));

  it("keeps admission green when the journal cannot be written", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const journalPath = yield* admissionJournalPath(tempRoot.root);
            // A directory squatting on the journal path fails every append;
            // admission stays usable while the durable promotion remains.
            yield* fs.makeDirectory(tempRoot.root, { recursive: true, mode: 0o700 });
            yield* fs.makeDirectory(journalPath, { mode: 0o700 });
            const during = yield* withQualityAdmission(
              request(),
              noAdmissionOriginGate,
              admissionStatus(fastConfig),
              fastConfig
            );
            expect(during.leases).toHaveLength(1);
            expect(yield* listDirectory(tempRoot.leases)).toHaveLength(0);
            expect(yield* listDirectory(tempRoot.queue)).toHaveLength(0);
            expect(yield* listDirectory(tempRoot.promotions)).toHaveLength(1);
            yield* fs.remove(journalPath, { force: true, recursive: true });
            yield* reapAdmissionState({ apply: true });
            expect(yield* listDirectory(tempRoot.promotions)).toHaveLength(0);
            expect(A.map(yield* readJournalEvents(tempRoot.root), (event) => event._tag)).toStrictEqual([
              "admission-admitted",
            ]);
          })
        );
      })
    ));

  it("property: admission journal events round-trip through the NDJSON codec", () => {
    const EventArbitrary = S.toArbitrary(AdmissionJournalEvent)(fc);
    fc.assert(
      fc.property(EventArbitrary, (event) => {
        const encoded = S.encodeSync(S.fromJsonString(AdmissionJournalEvent))(event);
        const decoded = S.decodeSync(S.fromJsonString(AdmissionJournalEvent))(encoded);
        expect(decoded._tag).toBe(event._tag);
        expect(decoded.nonce).toBe(event.nonce);
        // JSON drops the sign of -0, so the codec law is encode-stability
        // rather than Object.is identity on numeric fields.
        expect(S.encodeSync(S.fromJsonString(AdmissionJournalEvent))(decoded)).toBe(encoded);
      }),
      fcRuns(32)
    );
  });

  it("queues while tokens are held and admits when the holder releases", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const blocking = yield* writeFakeLease(tempRoot, { weightTokens: 6, originKey: "origin-other" });
            const fiber = yield* Effect.forkChild(
              withQualityAdmission(request(), noAdmissionOriginGate, Effect.succeed("ran"), fastConfig)
            );
            yield* Effect.sleep("120 millis");
            expect(A.length(yield* listDirectory(tempRoot.queue))).toBe(1);
            expect(fiber.pollUnsafe()).toBeUndefined();
            yield* fs.remove(blocking, { force: true });
            expect(yield* Fiber.join(fiber)).toBe("ran");
            expect(A.length(yield* listDirectory(tempRoot.queue))).toBe(0);
          })
        );
      })
    ));

  it("admits a same-origin contender when its weight fits beside the active lease", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            yield* writeFakeLease(tempRoot, { weightTokens: 3, originKey: "origin-busy" });
            const sameOrigin = yield* withQualityAdmission(
              request({ originKey: "origin-busy", checkoutRoot: "/repo/busy" }),
              noAdmissionOriginGate,
              Effect.succeed("same"),
              fastConfig
            );
            expect(sameOrigin).toBe("same");
            const otherOrigin = yield* withQualityAdmission(
              request({ originKey: "origin-free", checkoutRoot: "/repo/free" }),
              noAdmissionOriginGate,
              Effect.succeed("other"),
              fastConfig
            );
            expect(otherOrigin).toBe("other");
          })
        );
      })
    ));

  it("serializes a same-checkout contender while allowing a sibling checkout", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const blocking = yield* writeFakeLease(tempRoot, {
              checkoutRoot: "/repo/shared",
              originKey: "origin-active",
              weightTokens: 3,
            });
            const sameCheckout = yield* Effect.forkChild(
              withQualityAdmission(
                request({ checkoutRoot: "/repo/shared", originKey: "origin-contender" }),
                noAdmissionOriginGate,
                Effect.succeed("same-checkout"),
                fastConfig
              )
            );

            yield* Effect.sleep("120 millis");
            expect(A.length(yield* listDirectory(tempRoot.queue))).toBe(1);
            expect(sameCheckout.pollUnsafe()).toBeUndefined();

            const sibling = yield* withQualityAdmission(
              request({ checkoutRoot: "/repo/sibling", originKey: "origin-contender" }),
              noAdmissionOriginGate,
              Effect.succeed("sibling"),
              fastConfig
            );
            expect(sibling).toBe("sibling");

            yield* fs.remove(blocking, { force: true });
            expect(yield* Fiber.join(sameCheckout)).toBe("same-checkout");
          })
        );
      })
    ));

  it("keeps a current contender queued until a same-origin legacy lease drains", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const procStart = yield* ownProcStart();
            yield* fs.makeDirectory(tempRoot.leases, { recursive: true, mode: 0o700 });
            const legacyPath = path.join(tempRoot.leases, "legacy-origin.lease.json");
            const legacyText = yield* encodeJsonObject({
              schemaVersion: "yeet-admission-lease/v1",
              pid: process.pid,
              procStart,
              kind: "full-proof",
              weightTokens: 3,
              priority: "verify",
              originKey: "origin-legacy",
              checkoutRoot: "/repo/legacy",
              branch: "feat/legacy",
              command: "bun run beep yeet verify",
              startedAt: "2026-08-27T00:00:00Z",
              admittedAtMillis: 0,
              heartbeatAtMillis: 0,
            });
            yield* fs.writeFileString(legacyPath, `${legacyText}\n`);

            expect((yield* decodeLease(`${legacyText}\n`)).coordinationProtocol).toBe("legacy-origin-lock/v1");
            const current = yield* Effect.forkChild(
              withQualityAdmission(
                request({ originKey: "origin-legacy", checkoutRoot: "/repo/current" }),
                noAdmissionOriginGate,
                Effect.succeed("current"),
                fastConfig
              )
            );
            yield* Effect.sleep("100 millis");
            expect(current.pollUnsafe()).toBeUndefined();
            yield* fs.remove(legacyPath, { force: true });
            expect(yield* Fiber.join(current)).toBe("current");
          })
        );
      })
    ));

  it("keeps a current contender queued behind an older same-origin legacy ticket", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const legacyPath = yield* writeLegacyTicket(tempRoot, {
              enqueuedAtMillis: 1,
              nonce: "legacy01",
              originKey: "origin-legacy-ticket",
            });
            const current = yield* Effect.forkChild(
              withQualityAdmission(
                request({ originKey: "origin-legacy-ticket", checkoutRoot: "/repo/current" }),
                noAdmissionOriginGate,
                Effect.succeed("current"),
                fastConfig
              )
            );

            yield* Effect.sleep("100 millis");
            expect(current.pollUnsafe()).toBeUndefined();
            const currentName = pipe(
              yield* listDirectory(tempRoot.queue),
              A.findFirst((name) => !Str.startsWith("legacy-")(name)),
              O.getOrThrow
            );
            const currentTicket = yield* fs
              .readFileString(path.join(tempRoot.queue, currentName))
              .pipe(Effect.flatMap(decodeTicket));
            expect(currentTicket.coordinationProtocol).toBe("scheduler-origin-concurrency/v1");
            expect(currentTicket.blockedOnOriginAtMillis).toBeGreaterThan(0);

            yield* fs.remove(legacyPath, { force: true });
            expect(yield* Fiber.join(current)).toBe("current");
          })
        );
      })
    ));

  it("stamps an older current ticket so a younger legacy client can drain", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(20);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const current = yield* Effect.forkChild(
              withQualityAdmission(
                request({ originKey: "origin-current-first", checkoutRoot: "/repo/current" }),
                noAdmissionOriginGate,
                Effect.succeed("current"),
                fastConfig
              )
            );

            yield* Effect.sleep("80 millis");
            const currentName = pipe(yield* listDirectory(tempRoot.queue), A.head, O.getOrThrow);
            const currentPath = path.join(tempRoot.queue, currentName);
            const firstCurrent = yield* fs.readFileString(currentPath).pipe(Effect.flatMap(decodeTicket));
            expect(firstCurrent.coordinationProtocol).toBe("scheduler-origin-concurrency/v1");

            const legacyPath = yield* writeLegacyTicket(tempRoot, {
              enqueuedAtMillis: firstCurrent.enqueuedAtMillis + 1,
              nonce: "legacy02",
              originKey: "origin-current-first",
            });
            expect((yield* fs.readFileString(legacyPath).pipe(Effect.flatMap(decodeTicket))).coordinationProtocol).toBe(
              "legacy-origin-lock/v1"
            );

            const stampedCurrent = yield* Effect.repeat(
              fs.readFileString(currentPath).pipe(Effect.flatMap(decodeTicket)),
              {
                until: (ticket) => ticket.blockedOnOriginAtMillis > 0,
                schedule: Schedule.spaced(Duration.millis(10)),
              }
            ).pipe(Effect.timeout(Duration.seconds(5)));
            expect(stampedCurrent.blockedOnOriginAtMillis).toBeGreaterThan(0);

            yield* fs.remove(legacyPath, { force: true });
            yield* Ref.set(gibRef, 50);
            expect(yield* Fiber.join(current)).toBe("current");
          })
        );
      })
    ));

  it.effect("gives publish priority over a newer verify before its aging threshold", () =>
    Effect.gen(function* () {
      const priorityConfig = AdmissionConfig.make({ ...fastConfig, publishAgingSeconds: 60 });
      yield* TestClock.setTime(1_000);
      const verifyAt = yield* Clock.currentTimeMillis;
      yield* TestClock.adjust("1 millis");
      const publishAt = yield* Clock.currentTimeMillis;
      const ordered = orderAdmissionTicketsForTesting(
        [
          orderingTicket({ enqueuedAtMillis: verifyAt, nonce: "verify", priority: "verify" }),
          orderingTicket({ enqueuedAtMillis: publishAt, nonce: "publish", priority: "publish" }),
        ],
        publishAt,
        priorityConfig
      );

      expect(A.map(ordered, (ticket) => ticket.nonce)).toStrictEqual(["publish", "verify"]);
    })
  );

  it.effect("keeps an aged verify ahead of a newer publish at the same effective rank", () =>
    Effect.gen(function* () {
      const agedConfig = AdmissionConfig.make({ ...fastConfig, publishAgingSeconds: 60 });
      yield* TestClock.setTime(1_000);
      const verifyAt = yield* Clock.currentTimeMillis;
      yield* TestClock.adjust("60001 millis");
      const publishAt = yield* Clock.currentTimeMillis;
      const ordered = orderAdmissionTicketsForTesting(
        [
          orderingTicket({ enqueuedAtMillis: publishAt, nonce: "publish", priority: "publish" }),
          orderingTicket({ enqueuedAtMillis: verifyAt, nonce: "verify", priority: "verify" }),
        ],
        publishAt,
        agedConfig
      );

      expect(A.map(ordered, (ticket) => ticket.nonce)).toStrictEqual(["verify", "publish"]);
    })
  );

  it.effect("uses the admission nonce as the stable same-instant tie-break", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(1_000);
      const enqueuedAtMillis = yield* Clock.currentTimeMillis;
      const ordered = orderAdmissionTicketsForTesting(
        [
          orderingTicket({ enqueuedAtMillis, nonce: "nonce-b", priority: "publish" }),
          orderingTicket({ enqueuedAtMillis, nonce: "nonce-a", priority: "publish" }),
        ],
        enqueuedAtMillis,
        fastConfig
      );

      expect(A.map(ordered, (ticket) => ticket.nonce)).toStrictEqual(["nonce-a", "nonce-b"]);
    })
  );

  it("caps concurrent review-fix admissions at the chartered class cap", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(60);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const capLeases = yield* Effect.forEach(A.range(1, 3), (index) =>
              writeFakeLease(tempRoot, {
                kind: "review-fix",
                weightTokens: 1,
                originKey: `origin-rf-${index}`,
              })
            );
            const fiber = yield* Effect.forkChild(
              withQualityAdmission(
                request({ kind: "review-fix", weightTokens: 1, originKey: "" }),
                noAdmissionOriginGate,
                Effect.succeed("review"),
                fastConfig
              )
            );
            yield* Effect.sleep("100 millis");
            expect(fiber.pollUnsafe()).toBeUndefined();
            yield* fs.remove(A.headNonEmpty(capLeases as A.NonEmptyReadonlyArray<string>), { force: true });
            expect(yield* Fiber.join(fiber)).toBe("review");
          })
        );
      })
    ));

  it("reaps dead-pid state, reaps start-time mismatches, and quarantines garbage", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            yield* writeFakeLease(tempRoot, { pid: DEAD_PID, weightTokens: 9, originKey: "origin-dead" });
            yield* writeFakeLease(tempRoot, { procStart: "1", weightTokens: 9, originKey: "origin-reused" });
            yield* fs.writeFileString(path.join(tempRoot.leases, "garbage.lease.json"), "{not json");
            const result = yield* withQualityAdmission(
              request(),
              noAdmissionOriginGate,
              Effect.succeed("ran"),
              fastConfig
            );
            expect(result).toBe("ran");
            const quarantined = yield* listDirectory(tempRoot.quarantine);
            expect(A.some(quarantined, Str.startsWith("garbage.lease.json"))).toBe(true);
            expect(A.length(yield* listDirectory(tempRoot.leases))).toBe(0);
          })
        );
      })
    ));

  it("stays queued while the origin gate is busy and releases it after use", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const busy = yield* Ref.make(true);
            const releases = yield* Ref.make(0);
            const tryAcquire = Effect.gen(function* () {
              return (yield* Ref.get(busy)) ? O.none<string>() : O.some("origin-lease");
            });
            const gate = {
              tryAcquire,
              tryAcquireFallback: tryAcquire,
              release: (_: string) => Ref.update(releases, (count) => count + 1),
            };
            const fiber = yield* Effect.forkChild(
              withQualityAdmission(request(), gate, Effect.succeed("ran"), fastConfig)
            );
            yield* Effect.sleep("100 millis");
            expect(fiber.pollUnsafe()).toBeUndefined();
            expect(A.length(yield* listDirectory(tempRoot.queue))).toBe(1);
            yield* Ref.set(busy, false);
            expect(yield* Fiber.join(fiber)).toBe("ran");
            expect(yield* Ref.get(releases)).toBe(1);
          })
        );
      })
    ));

  it("hard-floors admission below 15 GiB and recovers when memory frees", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(10);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fiber = yield* Effect.forkChild(
              withQualityAdmission(request(), noAdmissionOriginGate, Effect.succeed("ran"), fastConfig)
            );
            yield* Effect.sleep("100 millis");
            expect(fiber.pollUnsafe()).toBeUndefined();
            expect(A.length(yield* listDirectory(tempRoot.queue))).toBe(1);
            yield* Ref.set(gibRef, 50);
            expect(yield* Fiber.join(fiber)).toBe("ran");
          })
        );
      })
    ));

  it("removes its ticket when the waiting contender is interrupted", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(10);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fiber = yield* Effect.forkChild(
              withQualityAdmission(request(), noAdmissionOriginGate, Effect.succeed("ran"), fastConfig)
            );
            yield* Effect.sleep("80 millis");
            expect(A.length(yield* listDirectory(tempRoot.queue))).toBe(1);
            yield* Fiber.interrupt(fiber);
            expect(A.length(yield* listDirectory(tempRoot.queue))).toBe(0);
          })
        );
      })
    ));

  it("releases the lease when the admitted work fails", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const failed = yield* withQualityAdmission(
              request(),
              noAdmissionOriginGate,
              Effect.fail("boom" as const),
              fastConfig
            ).pipe(Effect.flip);
            expect(failed).toBe("boom");
            expect(A.length(yield* listDirectory(tempRoot.leases))).toBe(0);
            expect(A.length(yield* listDirectory(tempRoot.queue))).toBe(0);
          })
        );
      })
    ));

  it("status reports without mutating and reap is dry-run by default", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            // Keep scope-stop attempts off the host bus while exercising apply.
            const binDirectory = path.join(path.dirname(path.dirname(tempRoot.root)), "bin");
            const checkoutRoot = path.join(path.dirname(path.dirname(tempRoot.root)), "checkout");
            yield* fs.makeDirectory(binDirectory, { recursive: true });
            yield* fs.makeDirectory(checkoutRoot, { recursive: true });
            yield* writeExecutable(path.join(binDirectory, "systemctl"), "#!/bin/sh\nexit 0\n");
            const live = yield* writeFakeLease(tempRoot, { weightTokens: 3, originKey: "origin-live" });
            const dead = yield* writeFakeLease(tempRoot, {
              pid: DEAD_PID,
              weightTokens: 5,
              originKey: "origin-dead",
              checkoutRoot,
              attemptId: O.some(JOURNALED_ATTEMPT_ID),
            });
            const snapshot = yield* admissionStatus(fastConfig);
            expect(A.length(snapshot.leases)).toBe(1);
            expect(snapshot.activeTokens).toBe(3);
            expect(snapshot.dead).toStrictEqual([dead]);
            expect(A.length(yield* listDirectory(tempRoot.leases))).toBe(2);

            const dryRun = yield* reapAdmissionState({ apply: false });
            expect(dryRun.dead).toStrictEqual([dead]);
            expect(A.length(yield* listDirectory(tempRoot.leases))).toBe(2);

            const applied = yield* withPrependedPath(binDirectory, reapAdmissionState({ apply: true }));
            expect(applied.dead).toStrictEqual([dead]);
            const remaining = yield* listDirectory(tempRoot.leases);
            expect(remaining).toStrictEqual([path.basename(live)]);
            const events = yield* readJournalEvents(tempRoot.root);
            expect(events).toHaveLength(0);
            const attemptLines = pipe(
              yield* fs.readFileString(yield* attemptJournalPathForCheckout(checkoutRoot, "feat/other")),
              Str.split("\n"),
              A.filter(Str.isNonEmpty)
            );
            expect(attemptLines).toHaveLength(1);
            expect(yield* decodeYeetAttemptJournalEvent(attemptLines[0])).toMatchObject({
              _tag: "attempt-terminated",
              reason: "lease-eviction",
            });
          })
        );
      })
    ));

  it("atomically claims dead leases and tickets before journaling each death once", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const checkoutRoot = path.join(path.dirname(path.dirname(tempRoot.root)), "checkout");
            const leaseAttemptId = yield* S.decodeEffect(UUID)("550e8400-e29b-41d4-a716-446655440021");
            const ticketAttemptId = yield* S.decodeEffect(UUID)("550e8400-e29b-41d4-a716-446655440022");
            yield* fs.makeDirectory(checkoutRoot, { recursive: true });
            yield* writeFakeLease(tempRoot, {
              pid: DEAD_PID,
              nonce: "",
              checkoutRoot,
              branch: "feat/dead-lease",
              attemptId: O.some(leaseAttemptId),
              resolvedHeadSha: O.some("0123456789abcdef0123456789abcdef01234567"),
              diffFingerprint: O.some("abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd"),
              proofTier: O.some("full"),
              envProfile: O.some("local"),
              stage: O.some("pre-push"),
            });
            yield* writeFakeTicket(tempRoot, {
              pid: DEAD_PID,
              nonce: "dead-ticket",
              checkoutRoot,
              branch: "feat/dead-ticket",
              attemptId: O.some(ticketAttemptId),
              resolvedHeadSha: O.some("fedcba9876543210fedcba9876543210fedcba98"),
              diffFingerprint: O.some("1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"),
              proofTier: O.some("review-fix"),
              envProfile: O.some("hosted"),
              stage: O.some("hosted"),
            });

            yield* setAdmissionEvictionProtocol("on");

            yield* Effect.all([reapAdmissionState({ apply: true }), reapAdmissionState({ apply: true })], {
              concurrency: "unbounded",
            });

            const admissionEvents = yield* readJournalEvents(tempRoot.root);
            expect(A.filter(admissionEvents, AdmissionJournalEvent.guards["admission-lease-evicted"])).toHaveLength(1);
            expect(A.filter(admissionEvents, AdmissionJournalEvent.guards["admission-ticket-evicted"])).toHaveLength(1);
            const attemptEvents = yield* Effect.forEach(
              [
                ["feat/dead-lease", "lease-eviction"],
                ["feat/dead-ticket", "queued-submitter-death"],
              ] as const,
              ([branch, reason]) =>
                Effect.gen(function* () {
                  const context = RepoRunContext.make({
                    repoRoot: checkoutRoot,
                    cwd: checkoutRoot,
                    base: "origin/main",
                    head: "HEAD",
                    branch,
                    packetDir: ".beep/yeet",
                    originalArgv: [],
                    turbo: TurboPlanSnapshot.make({
                      graphHealthStatus: "ok",
                      graphHealthWarnings: [],
                      tasks: [],
                    }),
                  });
                  const text = yield* fs.readFileString(yield* attemptJournalPath(context));
                  const rows = yield* Effect.forEach(pipe(text, Str.split("\n"), A.filter(Str.isNonEmpty)), (line) =>
                    decodeYeetAttemptJournalEvent(line)
                  );
                  expect(rows).toHaveLength(1);
                  expect(rows[0]).toMatchObject({ _tag: "attempt-terminated", reason });
                  return rows[0];
                })
            );
            expect(attemptEvents).toHaveLength(2);
            expect(attemptEvents[0]).toMatchObject({
              resolvedHeadSha: O.some("0123456789abcdef0123456789abcdef01234567"),
              diffFingerprint: O.some("abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd"),
              proofTier: O.some("full"),
              envProfile: O.some("local"),
              stage: O.some("pre-push"),
            });
            expect(attemptEvents[1]).toMatchObject({
              resolvedHeadSha: O.some("fedcba9876543210fedcba9876543210fedcba98"),
              diffFingerprint: O.some("1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"),
              proofTier: O.some("review-fix"),
              envProfile: O.some("hosted"),
              stage: O.some("hosted"),
            });
            expect(yield* listDirectory(tempRoot.leases)).toHaveLength(0);
            expect(yield* listDirectory(tempRoot.queue)).toHaveLength(0);
          })
        );
      })
    ));

  it("acknowledges completed reap claims and quarantines malformed recovery records", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            yield* admissionStatus(fastConfig);
            yield* writeLeaseReapClaim(tempRoot, "completed.reap.json", "completed-claim", {
              attemptJournal: "complete",
              admissionJournal: "complete",
            });
            const malformedClaimPath = path.join(tempRoot.claims, "malformed.reap.json");
            const malformedPromotionPath = path.join(tempRoot.promotions, "malformed.promotion.json");
            yield* fs.writeFileString(malformedClaimPath, "not-json");
            yield* fs.writeFileString(malformedPromotionPath, "not-json");

            const snapshot = yield* reapAdmissionState({ apply: true });

            expect(yield* listDirectory(tempRoot.claims)).toHaveLength(0);
            expect(yield* listDirectory(tempRoot.promotions)).toHaveLength(0);
            expect(yield* readJournalEvents(tempRoot.root)).toHaveLength(0);
            expect(
              A.some(snapshot.quarantined, (entry) => Str.startsWith("malformed.reap.json.")(path.basename(entry)))
            ).toBe(true);
            expect(
              A.some(snapshot.quarantined, (entry) => Str.startsWith("malformed.promotion.json.")(path.basename(entry)))
            ).toBe(true);
          })
        );
      })
    ));

  it("leaves a reap claim retryable when it vanishes from the recovery read", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            yield* admissionStatus(fastConfig);
            const claimPath = path.join(tempRoot.claims, "vanished.reap.json");
            yield* fs.writeFileString(claimPath, "temporarily unreadable");
            const unreadableClaimFileSystem = FileSystem.FileSystem.of({
              ...fs,
              readFileString: Effect.fn("QualitySchedulerTest.readFileString")((target, encoding) =>
                Str.Equivalence(target, claimPath)
                  ? fs.readFileString(path.join(tempRoot.claims, "missing.reap.json"), encoding)
                  : fs.readFileString(target, encoding)
              ),
            });

            yield* reapAdmissionState({ apply: true }).pipe(
              Effect.provideService(FileSystem.FileSystem, unreadableClaimFileSystem)
            );

            expect(yield* fs.exists(claimPath)).toBe(true);
          })
        );
      })
    ));

  it("rejects a reap claim whose lifecycle identity changes while awaiting its lock", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            yield* admissionStatus(fastConfig);
            const sourcePath = yield* writeFakeLease(tempRoot, {
              pid: DEAD_PID,
              nonce: "observed-claim",
              originKey: "observed-claim-origin",
            });
            const lease = yield* fs.readFileString(sourcePath).pipe(Effect.flatMap(decodeLease));
            yield* fs.remove(sourcePath, { force: true });
            const claimPath = path.join(tempRoot.claims, "changed.reap.json");
            const observed = AdmissionLeaseReapClaim.make({
              schemaVersion: "yeet-admission-reap-claim/v1",
              _tag: "lease",
              sourcePath,
              nonce: lease.nonce,
              claimedAtMillis: 1,
              attemptJournal: "complete",
              admissionJournal: "complete",
              lease,
            });
            const changed = AdmissionLeaseReapClaim.make({ ...observed, nonce: "replacement-claim" });
            const observedText = `${yield* encodeAdmissionReapClaim(observed)}\n`;
            const changedText = `${yield* encodeAdmissionReapClaim(changed)}\n`;
            yield* fs.writeFileString(claimPath, observedText);
            const reads = yield* Ref.make(0);
            const changedClaimFileSystem = FileSystem.FileSystem.of({
              ...fs,
              readFileString: Effect.fn("QualitySchedulerTest.readFileString")(function* (target, encoding) {
                if (!Str.Equivalence(target, claimPath)) {
                  return yield* fs.readFileString(target, encoding);
                }
                return (yield* Ref.updateAndGet(reads, (count) => count + 1)) === 1 ? observedText : changedText;
              }),
            });

            const failure = yield* reapAdmissionState({ apply: true }).pipe(
              Effect.provideService(FileSystem.FileSystem, changedClaimFileSystem),
              Effect.flip
            );

            expect(failure.message).toContain("changed lifecycle identity");
            expect(yield* fs.exists(claimPath)).toBe(true);
          })
        );
      })
    ));

  it("distinguishes busy recovery records from records that vanished behind their locks", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* admissionStatus(fastConfig);
            const claimPath = yield* writeLeaseReapClaim(tempRoot, "busy.reap.json", "busy-reap-claim", {
              attemptJournal: "complete",
              admissionJournal: "complete",
            });
            const claimLockPath = `${claimPath}.lock`;
            const claimLockToken = `${process.pid}:busy-reap-claim-lock`;
            expect(yield* acquireJournalFileLock(claimLockPath, claimLockToken, 1)).toBe(true);

            const busyClaim = yield* reapAdmissionState({ apply: true }).pipe(Effect.flip);
            expect(busyClaim.message).toContain("outputs remain pending");
            const vanishedClaimFileSystem = fileSystemWithMissingExists(fs, claimPath);
            yield* reapAdmissionState({ apply: true }).pipe(
              Effect.provideService(FileSystem.FileSystem, vanishedClaimFileSystem)
            );
            yield* releaseAdmissionJournalLockForTesting(claimLockPath, claimLockToken);
            yield* fs.remove(claimPath, { force: true });

            const promotion = yield* writePromotionFixture(tempRoot, {
              keepLease: true,
              keepTicket: true,
              nonce: "busy-promotion",
              phase: "lease-published",
            });
            const promotionLockPath = `${promotion.promotionPath}.lock`;
            const promotionLockToken = `${process.pid}:busy-promotion-lock`;
            expect(yield* acquireJournalFileLock(promotionLockPath, promotionLockToken, 1)).toBe(true);

            const busyPromotion = yield* reapAdmissionState({ apply: true }).pipe(Effect.flip);
            expect(busyPromotion.message).toContain("recovery remains pending");
            const vanishedPromotionFileSystem = fileSystemWithMissingExists(fs, promotion.promotionPath);
            yield* reapAdmissionState({ apply: true }).pipe(
              Effect.provideService(FileSystem.FileSystem, vanishedPromotionFileSystem)
            );
            yield* releaseAdmissionJournalLockForTesting(promotionLockPath, promotionLockToken);
          })
        );
      })
    ));

  it("leaves recovery records retryable when their locked reread is unavailable", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            yield* admissionStatus(fastConfig);
            const claimPath = yield* writeLeaseReapClaim(tempRoot, "reread.reap.json", "reread-reap-claim", {
              attemptJournal: "complete",
              admissionJournal: "complete",
            });
            const unreadableClaimFileSystem = yield* fileSystemWithReadUnavailableAfterFirst(
              fs,
              claimPath,
              path.join(tempRoot.claims, "missing.reap.json")
            );

            yield* reapAdmissionState({ apply: true }).pipe(
              Effect.provideService(FileSystem.FileSystem, unreadableClaimFileSystem)
            );
            expect(yield* fs.exists(claimPath)).toBe(true);
            yield* fs.remove(claimPath, { force: true });

            const promotion = yield* writePromotionFixture(tempRoot, {
              keepLease: true,
              keepTicket: true,
              nonce: "reread-promotion",
              phase: "lease-published",
            });
            const unreadablePromotionFileSystem = yield* fileSystemWithReadUnavailableAfterFirst(
              fs,
              promotion.promotionPath,
              path.join(tempRoot.promotions, "missing.promotion.json")
            );

            yield* reapAdmissionState({ apply: true }).pipe(
              Effect.provideService(FileSystem.FileSystem, unreadablePromotionFileSystem)
            );
            expect(yield* fs.exists(promotion.promotionPath)).toBe(true);
          })
        );
      })
    ));

  it("rejects a promotion whose nonce changes while awaiting its lock", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const promotion = yield* writePromotionFixture(tempRoot, {
              keepLease: true,
              keepTicket: true,
              nonce: "observed-promotion",
              phase: "lease-published",
            });
            const observedText = yield* fs.readFileString(promotion.promotionPath);
            const observed = yield* decodePromotionTransition(observedText);
            const changedText = `${yield* encodePromotionTransition(
              AdmissionPromotionTransition.make({ ...observed, nonce: "replacement-promotion" })
            )}\n`;
            yield* fs.writeFileString(promotion.promotionPath, observedText);
            const reads = yield* Ref.make(0);
            const changedPromotionFileSystem = FileSystem.FileSystem.of({
              ...fs,
              readFileString: Effect.fn("QualitySchedulerTest.readFileString")(function* (target, encoding) {
                if (!Str.Equivalence(target, promotion.promotionPath)) {
                  return yield* fs.readFileString(target, encoding);
                }
                return (yield* Ref.updateAndGet(reads, (count) => count + 1)) === 1 ? observedText : changedText;
              }),
            });

            const failure = yield* reapAdmissionState({ apply: true }).pipe(
              Effect.provideService(FileSystem.FileSystem, changedPromotionFileSystem),
              Effect.flip
            );

            expect(failure.message).toContain("changed nonce");
            expect(yield* fs.exists(promotion.promotionPath)).toBe(true);
          })
        );
      })
    ));

  it("recovers an overlapping promotion as one nonce lifecycle with idempotent publication", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const nonce = "promotion-crash-nonce";
            const binDirectory = path.join(path.dirname(path.dirname(tempRoot.root)), "bin");
            yield* fs.makeDirectory(binDirectory, { recursive: true });
            yield* writeExecutable(path.join(binDirectory, "systemctl"), "#!/bin/sh\nexit 0\n");
            const leasePath = yield* writeFakeLease(tempRoot, {
              pid: DEAD_PID,
              nonce,
              originKey: "promotion-crash-origin",
            });
            const ticketPath = yield* writeFakeTicket(tempRoot, {
              pid: DEAD_PID,
              nonce,
              originKey: "promotion-crash-origin",
            });
            const lease = yield* fs.readFileString(leasePath).pipe(Effect.flatMap(decodeLease));
            const ticket = yield* fs.readFileString(ticketPath).pipe(Effect.flatMap(decodeTicket));
            const promotionPath = path.join(tempRoot.promotions, `${nonce}.promotion.json`);
            const transition = AdmissionPromotionTransition.make({
              schemaVersion: "yeet-admission-promotion/v1",
              nonce,
              ticketPath,
              leasePath,
              ticket,
              lease,
              phase: "lease-published",
              createdAtMillis: lease.admittedAtMillis,
            });
            yield* fs.makeDirectory(tempRoot.promotions, { recursive: true, mode: 0o700 });
            yield* fs.writeFileString(promotionPath, `${yield* encodePromotionTransition(transition)}\n`);
            yield* setAdmissionEvictionProtocol("on");
            yield* appendAdmissionJournalEvent(
              tempRoot.root,
              AdmissionJournalAdmitted.make({
                schemaVersion: "yeet-admission-journal/v1",
                _tag: "admission-admitted",
                nonce,
                pid: ticket.pid,
                procStart: ticket.procStart,
                kind: ticket.kind,
                weightTokens: ticket.weightTokens,
                priority: ticket.priority,
                originKey: ticket.originKey,
                enqueuedAtMillis: ticket.enqueuedAtMillis,
                admittedAtMillis: lease.admittedAtMillis,
                attemptId: ticket.attemptId,
              })
            );

            yield* withPrependedPath(
              binDirectory,
              Effect.all([reapAdmissionState({ apply: true }), reapAdmissionState({ apply: true })], {
                concurrency: "unbounded",
              })
            );

            const events = yield* readJournalEvents(tempRoot.root);
            expect(A.filter(events, AdmissionJournalEvent.guards["admission-admitted"])).toHaveLength(1);
            expect(A.filter(events, AdmissionJournalEvent.guards["admission-lease-evicted"])).toHaveLength(1);
            expect(A.filter(events, AdmissionJournalEvent.guards["admission-ticket-evicted"])).toHaveLength(0);
            expect(yield* listDirectory(tempRoot.promotions)).toHaveLength(0);
            expect(yield* listDirectory(tempRoot.queue)).toHaveLength(0);
            expect(yield* listDirectory(tempRoot.leases)).toHaveLength(0);
            expect(yield* listDirectory(tempRoot.claims)).toHaveLength(0);
          })
        );
      })
    ));

  it("finishes a prepared promotion when its lease is already published by a live owner", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const nonce = "prepared-live-promotion";
            const leasePath = yield* writeFakeLease(tempRoot, { nonce, originKey: "prepared-live-origin" });
            const ticketPath = yield* writeFakeTicket(tempRoot, { nonce, originKey: "prepared-live-origin" });
            const lease = yield* fs.readFileString(leasePath).pipe(Effect.flatMap(decodeLease));
            const ticket = yield* fs.readFileString(ticketPath).pipe(Effect.flatMap(decodeTicket));
            const promotionPath = path.join(tempRoot.promotions, `${nonce}.promotion.json`);
            yield* fs.makeDirectory(tempRoot.promotions, { recursive: true, mode: 0o700 });
            yield* fs.writeFileString(
              promotionPath,
              `${yield* encodePromotionTransition(
                AdmissionPromotionTransition.make({
                  schemaVersion: "yeet-admission-promotion/v1",
                  nonce,
                  ticketPath,
                  leasePath,
                  ticket,
                  lease,
                  phase: "prepared",
                  createdAtMillis: lease.admittedAtMillis,
                })
              )}\n`
            );

            yield* reapAdmissionState({ apply: true });

            expect(yield* listDirectory(tempRoot.promotions)).toHaveLength(0);
            expect(yield* listDirectory(tempRoot.queue)).toHaveLength(0);
            expect(yield* listDirectory(tempRoot.leases)).toHaveLength(1);
            expect(
              A.filter(yield* readJournalEvents(tempRoot.root), AdmissionJournalEvent.guards["admission-admitted"])
            ).toHaveLength(1);
          })
        );
      })
    ));

  it("recovers prepared, ticket-removed, and already-journaled promotion phases", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const live = yield* writePromotionFixture(tempRoot, {
              keepLease: false,
              keepTicket: true,
              nonce: "prepared-live-without-lease",
              phase: "prepared",
            });
            const dead = yield* writePromotionFixture(tempRoot, {
              keepLease: false,
              keepTicket: true,
              nonce: "prepared-dead-without-lease",
              phase: "prepared",
              pid: DEAD_PID,
            });
            const removed = yield* writePromotionFixture(tempRoot, {
              keepLease: false,
              keepTicket: false,
              nonce: "ticket-removed-without-lease",
              phase: "ticket-removed",
            });
            const journaled = yield* writePromotionFixture(tempRoot, {
              keepLease: false,
              keepTicket: false,
              nonce: "already-journaled-without-lease",
              phase: "admission-journaled",
            });
            yield* setAdmissionEvictionProtocol("on");
            yield* appendAdmissionJournalEvent(
              tempRoot.root,
              AdmissionJournalAdmitted.make({
                schemaVersion: "yeet-admission-journal/v1",
                _tag: "admission-admitted",
                nonce: journaled.ticket.nonce,
                pid: journaled.ticket.pid,
                procStart: journaled.ticket.procStart,
                kind: journaled.ticket.kind,
                weightTokens: journaled.ticket.weightTokens,
                priority: journaled.ticket.priority,
                originKey: journaled.ticket.originKey,
                enqueuedAtMillis: journaled.ticket.enqueuedAtMillis,
                admittedAtMillis: journaled.lease.admittedAtMillis,
                attemptId: journaled.ticket.attemptId,
              })
            );

            yield* reapAdmissionState({ apply: true });

            expect(yield* fs.exists(live.promotionPath)).toBe(true);
            expect(yield* fs.exists(live.ticketPath)).toBe(true);
            expect(yield* fs.exists(dead.promotionPath)).toBe(false);
            expect(yield* fs.exists(dead.ticketPath)).toBe(false);
            expect(yield* fs.exists(removed.promotionPath)).toBe(false);
            expect(yield* fs.exists(journaled.promotionPath)).toBe(false);
            const events = yield* readJournalEvents(tempRoot.root);
            expect(A.filter(events, AdmissionJournalEvent.guards["admission-admitted"])).toHaveLength(2);
            expect(A.filter(events, AdmissionJournalEvent.guards["admission-ticket-evicted"])).toHaveLength(1);
          })
        );
      })
    ));

  it("retains a promotion until its admission receipt can be published", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const promotion = yield* writePromotionFixture(tempRoot, {
              keepLease: false,
              keepTicket: false,
              nonce: "promotion-journal-retry",
              phase: "ticket-removed",
            });
            const journalPath = yield* admissionJournalPath(tempRoot.root);
            yield* fs.makeDirectory(journalPath);

            yield* reapAdmissionState({ apply: true });

            expect(yield* fs.exists(promotion.promotionPath)).toBe(true);
            yield* fs.remove(journalPath, { recursive: true });
            yield* reapAdmissionState({ apply: true });
            expect(yield* fs.exists(promotion.promotionPath)).toBe(false);
            expect(
              A.filter(yield* readJournalEvents(tempRoot.root), AdmissionJournalEvent.guards["admission-admitted"])
            ).toHaveLength(1);
          })
        );
      })
    ));

  it("coalesces legacy overlapping ticket and lease artifacts before terminal publication", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const nonce = "legacy-overlap-nonce";
            const binDirectory = path.join(path.dirname(path.dirname(tempRoot.root)), "bin");
            yield* fs.makeDirectory(binDirectory, { recursive: true });
            yield* writeExecutable(path.join(binDirectory, "systemctl"), "#!/bin/sh\nexit 0\n");
            yield* writeFakeLease(tempRoot, { pid: DEAD_PID, nonce, originKey: "legacy-overlap" });
            yield* writeFakeTicket(tempRoot, { pid: DEAD_PID, nonce, originKey: "legacy-overlap" });
            yield* setAdmissionEvictionProtocol("on");

            yield* withPrependedPath(binDirectory, reapAdmissionState({ apply: true }));

            const events = yield* readJournalEvents(tempRoot.root);
            expect(A.filter(events, AdmissionJournalEvent.guards["admission-lease-evicted"])).toHaveLength(1);
            expect(A.filter(events, AdmissionJournalEvent.guards["admission-ticket-evicted"])).toHaveLength(0);
            expect(yield* listDirectory(tempRoot.queue)).toHaveLength(0);
            expect(yield* listDirectory(tempRoot.leases)).toHaveLength(0);
          })
        );
      })
    ));

  it("keeps a protocol-disabled eviction sink pending until one enabled pass acknowledges it", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const { binDirectory, checkoutRoot } = yield* writeProtocolDeferredLeaseFixture(tempRoot);
            const evictionJournal = AdmissionEvictionJournal.of({
              appendOnce: appendAdmissionEvictionJournalEvent,
            });
            const reap = Effect.fnUntraced(function* () {
              return yield* withPrependedPath(binDirectory, reapAdmissionState({ apply: true })).pipe(
                Effect.provideService(AdmissionEvictionJournal, evictionJournal)
              );
            });

            yield* reap();

            expect(yield* listDirectory(tempRoot.leases)).toHaveLength(0);
            const first = yield* readOnlyReapClaim(tempRoot);
            expect(first.names).toHaveLength(1);
            expect(first.name).toMatch(/\.reap\.pending-protocol-off\.json$/u);
            expect(A.filter(first.names, Str.endsWith(".reap.json"))).toHaveLength(0);
            expect(first.claim.attemptJournal).toBe("complete");
            expect(first.claim.admissionJournal).toBe("pending-protocol-off");
            expect(yield* readJournalEvents(tempRoot.root)).toHaveLength(0);
            expect(
              A.filter(
                yield* readAttemptJournalEvents(checkoutRoot, "feat/protocol-deferred"),
                (event) => event._tag === "attempt-terminated"
              )
            ).toHaveLength(1);

            yield* reap();

            const second = yield* readOnlyReapClaim(tempRoot);
            expect(second.names).toStrictEqual(first.names);
            expect(second.claim.admissionJournal).toBe("pending-protocol-off");
            expect(yield* readJournalEvents(tempRoot.root)).toHaveLength(0);

            yield* setAdmissionEvictionProtocol("on");
            yield* reap();

            expect(yield* listDirectory(tempRoot.claims)).toHaveLength(0);
            expect(
              A.filter(yield* readJournalEvents(tempRoot.root), AdmissionJournalEvent.guards["admission-lease-evicted"])
            ).toHaveLength(1);
            expect(yield* readAttemptJournalEvents(checkoutRoot, "feat/protocol-deferred")).toHaveLength(1);

            yield* reap();
            expect(
              A.filter(yield* readJournalEvents(tempRoot.root), AdmissionJournalEvent.guards["admission-lease-evicted"])
            ).toHaveLength(1);
          })
        );
      })
    ));

  it("moves a legacy-visible claim behind the protocol-off reader fence", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* admissionStatus(fastConfig);
            const legacyPath = yield* writeLeaseReapClaim(
              tempRoot,
              "legacy-visible.reap.json",
              "legacy-visible-claim",
              { attemptJournal: "pending", admissionJournal: "pending" }
            );

            yield* reapAdmissionState({ apply: true });

            expect(yield* fs.exists(legacyPath)).toBe(false);
            const deferred = yield* readOnlyReapClaim(tempRoot);
            expect(deferred.name).toMatch(/\.reap\.pending-protocol-off\.json$/u);
            expect(deferred.claim.attemptJournal).toBe("complete");
            expect(deferred.claim.admissionJournal).toBe("pending-protocol-off");
            expect(yield* readJournalEvents(tempRoot.root)).toHaveLength(0);

            yield* setAdmissionEvictionProtocol("on");
            yield* reapAdmissionState({ apply: true });

            expect(yield* listDirectory(tempRoot.claims)).toHaveLength(0);
            expect(
              A.filter(yield* readJournalEvents(tempRoot.root), AdmissionJournalEvent.guards["admission-lease-evicted"])
            ).toHaveLength(1);
          })
        );
      })
    ));

  it("retains and retries a dead-lease claim when its eviction receipt cannot be published", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const binDirectory = path.join(path.dirname(path.dirname(tempRoot.root)), "bin");
            const checkoutRoot = path.join(path.dirname(path.dirname(tempRoot.root)), "checkout");
            yield* fs.makeDirectory(binDirectory, { recursive: true });
            yield* fs.makeDirectory(checkoutRoot, { recursive: true });
            yield* writeExecutable(path.join(binDirectory, "systemctl"), "#!/bin/sh\nexit 0\n");
            yield* writeFakeLease(tempRoot, {
              pid: DEAD_PID,
              weightTokens: 5,
              originKey: "origin-dead-journal-failure",
              checkoutRoot,
              attemptId: O.some(JOURNALED_ATTEMPT_ID),
            });
            yield* setAdmissionEvictionProtocol("on");
            yield* fs.makeDirectory(path.join(tempRoot.root, "journal.ndjson"));

            const failure = yield* withPrependedPath(binDirectory, reapAdmissionState({ apply: true })).pipe(
              Effect.flip
            );

            expect(failure.message).toContain("Failed to read admission journal");
            expect(yield* listDirectory(tempRoot.leases)).toHaveLength(0);
            const pendingClaims = yield* listDirectory(tempRoot.claims);
            expect(pendingClaims).toHaveLength(1);
            const pendingClaim = yield* fs
              .readFileString(path.join(tempRoot.claims, O.getOrThrow(A.head(pendingClaims))))
              .pipe(Effect.flatMap(decodeAdmissionReapClaim));
            expect(pendingClaim.attemptJournal).toBe("complete");
            expect(pendingClaim.admissionJournal).toBe("pending");
            yield* fs.remove(path.join(tempRoot.root, "journal.ndjson"), { force: true, recursive: true });
            yield* withPrependedPath(binDirectory, reapAdmissionState({ apply: true }));
            expect(yield* listDirectory(tempRoot.claims)).toHaveLength(0);
            expect(
              A.filter(yield* readJournalEvents(tempRoot.root), AdmissionJournalEvent.guards["admission-lease-evicted"])
            ).toHaveLength(1);
            const attemptRows = yield* readAttemptJournalEvents(checkoutRoot, "feat/other");
            expect(A.filter(attemptRows, (event) => event._tag === "attempt-terminated")).toHaveLength(1);
          })
        );
      })
    ));

  it("retains both pending sinks when attempt termination fails before admission eviction", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const binDirectory = path.join(path.dirname(path.dirname(tempRoot.root)), "bin");
            const checkoutRoot = path.join(path.dirname(path.dirname(tempRoot.root)), "checkout");
            yield* fs.makeDirectory(binDirectory, { recursive: true });
            yield* fs.makeDirectory(checkoutRoot, { recursive: true });
            yield* writeExecutable(path.join(binDirectory, "systemctl"), "#!/bin/sh\nexit 0\n");
            yield* writeFakeLease(tempRoot, {
              pid: DEAD_PID,
              originKey: "origin-attempt-sink-failure",
              checkoutRoot,
              attemptId: O.some(JOURNALED_ATTEMPT_ID),
            });
            const unavailableAttemptJournal = AdmissionAttemptTerminationJournal.of({
              appendOnce: Effect.fn("AdmissionAttemptTerminationJournal.appendOnce")(() =>
                Effect.fail(QualitySchedulerError.make({ message: "attempt termination sink unavailable" }))
              ),
            });
            yield* setAdmissionEvictionProtocol("on");

            const failure = yield* withPrependedPath(binDirectory, reapAdmissionState({ apply: true })).pipe(
              Effect.provideService(AdmissionAttemptTerminationJournal, unavailableAttemptJournal),
              Effect.flip
            );

            expect(failure.message).toContain("attempt termination sink unavailable");
            expect(yield* listDirectory(tempRoot.leases)).toHaveLength(0);
            const pendingClaims = yield* listDirectory(tempRoot.claims);
            expect(pendingClaims).toHaveLength(1);
            const pendingClaim = yield* fs
              .readFileString(path.join(tempRoot.claims, O.getOrThrow(A.head(pendingClaims))))
              .pipe(Effect.flatMap(decodeAdmissionReapClaim));
            expect(pendingClaim.attemptJournal).toBe("pending");
            expect(pendingClaim.admissionJournal).toBe("pending");
            expect(yield* readJournalEvents(tempRoot.root)).toHaveLength(0);

            yield* withPrependedPath(binDirectory, reapAdmissionState({ apply: true }));
            expect(yield* listDirectory(tempRoot.claims)).toHaveLength(0);
            expect(
              A.filter(yield* readJournalEvents(tempRoot.root), AdmissionJournalEvent.guards["admission-lease-evicted"])
            ).toHaveLength(1);
          })
        );
      })
    ));

  it("does not journal an eviction when the dead lease file cannot be removed", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const binDirectory = path.join(path.dirname(path.dirname(tempRoot.root)), "bin");
            const checkoutRoot = path.join(path.dirname(path.dirname(tempRoot.root)), "checkout");
            yield* fs.makeDirectory(binDirectory, { recursive: true });
            yield* fs.makeDirectory(checkoutRoot, { recursive: true });
            yield* writeExecutable(path.join(binDirectory, "systemctl"), "#!/bin/sh\nexit 0\n");
            const dead = yield* writeFakeLease(tempRoot, {
              pid: DEAD_PID,
              weightTokens: 5,
              originKey: "origin-dead-remove-failure",
              checkoutRoot,
              attemptId: O.some(JOURNALED_ATTEMPT_ID),
            });
            yield* setAdmissionEvictionProtocol("on");

            const failure = yield* Effect.acquireUseRelease(
              fs.chmod(tempRoot.leases, 0o500),
              () => withPrependedPath(binDirectory, reapAdmissionState({ apply: true })).pipe(Effect.flip),
              () => fs.chmod(tempRoot.leases, 0o700)
            );

            expect(failure.message).toContain("Failed to remove claimed admission state");
            expect(yield* listDirectory(tempRoot.leases)).toStrictEqual([path.basename(dead)]);
            expect(yield* listDirectory(tempRoot.claims)).toHaveLength(1);
            expect(yield* readJournalEvents(tempRoot.root)).toHaveLength(0);
            yield* withPrependedPath(binDirectory, reapAdmissionState({ apply: true }));
            expect(yield* listDirectory(tempRoot.claims)).toHaveLength(0);
            expect(yield* listDirectory(tempRoot.leases)).toHaveLength(0);
            expect(
              A.filter(yield* readJournalEvents(tempRoot.root), AdmissionJournalEvent.guards["admission-lease-evicted"])
            ).toHaveLength(1);
          })
        );
      })
    ));

  it("enriches active lease scopes with live memory and task telemetry", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(
          gibRef,
          (tempRoot) =>
            Effect.gen(function* () {
              const fs = yield* FileSystem.FileSystem;
              const path = yield* Path.Path;
              const binDirectory = path.join(path.dirname(path.dirname(tempRoot.root)), "bin");
              yield* fs.makeDirectory(binDirectory, { recursive: true });
              yield* writeExecutable(
                path.join(binDirectory, "systemctl"),
                "#!/bin/sh\nprintf 'MemoryPeak=16384\\nTasksCurrent=7\\n'\n"
              );
              yield* writeFakeLease(tempRoot, {
                weightTokens: 10,
                runScope: RunScopeRecord.make({
                  unitName: "agent-run-telemetry.scope",
                  support: "active",
                  attachedPid: process.pid,
                  attachedAt: "2026-08-29T00:00:00.000Z",
                }),
              });

              const queued = yield* Effect.forkChild(
                withQualityAdmission(
                  request({ originKey: "origin-telemetry-contender" }),
                  noAdmissionOriginGate,
                  Effect.void,
                  fastConfig
                )
              );
              yield* Effect.sleep("100 millis");

              const snapshot = yield* withPrependedPath(binDirectory, admissionStatus());
              expect(snapshot.leases[0]?.runScope).toMatchObject({
                memoryPeakBytes: 16_384,
                tasksCurrent: 7,
              });
              expect(snapshot.tickets).toHaveLength(1);
              yield* Fiber.interrupt(queued);
              yield* writeExecutable(path.join(binDirectory, "systemctl"), "#!/bin/sh\nexit 0\n");
              const unavailable = yield* withPrependedPath(binDirectory, admissionStatus(fastConfig));
              expect(unavailable.leases[0]?.runScope).not.toHaveProperty("memoryPeakBytes");
              expect(unavailable.leases[0]?.runScope).not.toHaveProperty("tasksCurrent");
            }),
          128,
          true
        );
      })
    ));

  it("stops a dead lease scope only when reap applies", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const runtimeDirectory = path.dirname(path.dirname(tempRoot.root));
            const binDirectory = path.join(runtimeDirectory, "bin");
            const capturePath = path.join(runtimeDirectory, "systemctl.argv");
            const unitName = "agent-run-deadbeef.scope";
            yield* fs.makeDirectory(binDirectory, { recursive: true });
            yield* writeExecutable(
              path.join(binDirectory, "systemctl"),
              `#!/bin/sh\nprintf '%s\\n' "$@" >> '${capturePath}'\nexit 0\n`
            );
            const dead = yield* writeFakeLease(tempRoot, {
              pid: DEAD_PID,
              weightTokens: 5,
              originKey: "origin-dead-scope",
              nonce: "deadbeef",
              runScope: RunScopeRecord.make({
                unitName,
                support: "active",
                attachedPid: DEAD_PID,
                attachedAt: "2026-08-29T00:00:00.000Z",
              }),
            });

            yield* withPrependedPath(
              binDirectory,
              Effect.gen(function* () {
                const dryRun = yield* reapAdmissionState({ apply: false });
                expect(dryRun.dead).toStrictEqual([dead]);
                expect(yield* fs.exists(capturePath)).toBe(false);

                const applied = yield* reapAdmissionState({ apply: true });
                expect(applied.dead).toStrictEqual([dead]);
                expect(yield* fs.readFileString(capturePath)).toBe(`--user\nstop\n${unitName}\n`);
              })
            );
          })
        );
      })
    ));

  it("stops the derived scope for a dead lease without a persisted record", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const runtimeDirectory = path.dirname(path.dirname(tempRoot.root));
            const binDirectory = path.join(runtimeDirectory, "bin");
            const capturePath = path.join(runtimeDirectory, "systemctl.argv");
            yield* fs.makeDirectory(binDirectory, { recursive: true });
            yield* writeExecutable(
              path.join(binDirectory, "systemctl"),
              `#!/bin/sh\nprintf '%s\\n' "$@" >> '${capturePath}'\nexit 0\n`
            );
            yield* writeFakeLease(tempRoot, {
              pid: DEAD_PID,
              weightTokens: 5,
              originKey: "origin-dead-unpersisted",
              nonce: "deadbeef",
            });

            yield* withPrependedPath(
              binDirectory,
              Effect.gen(function* () {
                yield* reapAdmissionState({ apply: true });
                expect(yield* fs.readFileString(capturePath)).toBe("--user\nstop\nagent-run-deadbeef.scope\n");
              })
            );
          })
        );
      })
    ));

  it("retains a dead lease until its run scope stops successfully", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const runtimeDirectory = path.dirname(path.dirname(tempRoot.root));
            const binDirectory = path.join(runtimeDirectory, "bin");
            const systemctl = path.join(binDirectory, "systemctl");
            yield* fs.makeDirectory(binDirectory, { recursive: true });
            yield* writeExecutable(systemctl, "#!/bin/sh\nexit 1\n");
            const dead = yield* writeFakeLease(tempRoot, {
              pid: DEAD_PID,
              weightTokens: 5,
              originKey: "origin-dead-stop-retry",
              nonce: "dead-stop-retry",
              runScope: RunScopeRecord.make({
                unitName: "agent-run-dead-stop-retry.scope",
                support: "failed",
                attachedPid: DEAD_PID,
                attachedAt: "2026-08-29T00:00:00.000Z",
              }),
            });

            yield* withPrependedPath(
              binDirectory,
              Effect.gen(function* () {
                yield* reapAdmissionState({ apply: true });
                expect(yield* fs.exists(dead)).toBe(true);

                yield* fs.remove(systemctl);
                yield* withProcessPath(
                  binDirectory,
                  Effect.gen(function* () {
                    yield* reapAdmissionState({ apply: true });
                    expect(yield* fs.exists(dead)).toBe(true);
                  })
                );

                yield* writeExecutable(systemctl, "#!/bin/sh\nexit 0\n");
                yield* reapAdmissionState({ apply: true });
                expect(yield* fs.exists(dead)).toBe(false);
              })
            );
          })
        );
      })
    ));

  it("stops a deduplicated scope once and retains every associated lease on failure", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const runtimeDirectory = path.dirname(path.dirname(tempRoot.root));
            const binDirectory = path.join(runtimeDirectory, "bin");
            const capturePath = path.join(runtimeDirectory, "systemctl.argv");
            const systemctl = path.join(binDirectory, "systemctl");
            yield* fs.makeDirectory(binDirectory, { recursive: true });
            yield* writeExecutable(systemctl, `#!/bin/sh\nprintf '%s\n' "$@" >> '${capturePath}'\nexit 1\n`);
            const first = yield* writeFakeLease(tempRoot, {
              pid: DEAD_PID,
              originKey: "origin-dead-duplicate-first",
              nonce: "duplicate",
              weightTokens: 5,
            });
            const second = yield* writeFakeLease(tempRoot, {
              pid: DEAD_PID,
              originKey: "origin-dead-duplicate-second",
              nonce: "duplicate",
              weightTokens: 5,
            });

            yield* withPrependedPath(
              binDirectory,
              Effect.gen(function* () {
                yield* reapAdmissionState({ apply: true });
                expect(yield* fs.readFileString(capturePath)).toBe(
                  "--user\nstop\nagent-run-duplicate.scope\n" +
                    "--user\nshow\nagent-run-duplicate.scope\n--property=LoadState\n--value\n"
                );
                expect(yield* fs.exists(first)).toBe(true);
                expect(yield* fs.exists(second)).toBe(true);
              })
            );
          })
        );
      })
    ));

  it("reaps disabled and unsupported scope records without invoking systemctl", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const runtimeDirectory = path.dirname(path.dirname(tempRoot.root));
            const binDirectory = path.join(runtimeDirectory, "bin");
            const capturePath = path.join(runtimeDirectory, "systemctl.argv");
            yield* fs.makeDirectory(binDirectory, { recursive: true });
            yield* writeExecutable(
              path.join(binDirectory, "systemctl"),
              `#!/bin/sh\nprintf '%s\n' "$@" >> '${capturePath}'\nexit 0\n`
            );
            const disabled = yield* writeFakeLease(tempRoot, {
              pid: DEAD_PID,
              originKey: "origin-dead-disabled",
              nonce: "disabled",
              runScope: RunScopeRecord.make({
                unitName: "agent-run-disabled.scope",
                support: "disabled",
                attachedPid: DEAD_PID,
                attachedAt: "2026-08-29T00:00:00.000Z",
              }),
              weightTokens: 5,
            });
            const unsupported = yield* writeFakeLease(tempRoot, {
              pid: DEAD_PID,
              originKey: "origin-dead-unsupported",
              nonce: "unsupported",
              runScope: RunScopeRecord.make({
                unitName: "agent-run-unsupported.scope",
                support: "unsupported",
                attachedPid: DEAD_PID,
                attachedAt: "2026-08-29T00:00:00.000Z",
              }),
              weightTokens: 5,
            });

            yield* withPrependedPath(
              binDirectory,
              Effect.gen(function* () {
                yield* reapAdmissionState({ apply: true });
                expect(yield* fs.exists(capturePath)).toBe(false);
                expect(yield* fs.exists(disabled)).toBe(false);
                expect(yield* fs.exists(unsupported)).toBe(false);
              })
            );
          })
        );
      })
    ));

  it("reaps a dead lease when its transient scope was already collected", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const runtimeDirectory = path.dirname(path.dirname(tempRoot.root));
            const binDirectory = path.join(runtimeDirectory, "bin");
            yield* fs.makeDirectory(binDirectory, { recursive: true });
            yield* writeExecutable(
              path.join(binDirectory, "systemctl"),
              '#!/bin/sh\n[ "$2" = "stop" ] && exit 5\n[ "$2" = "show" ] && { printf "not-found\\n"; exit 0; }\nexit 1\n'
            );
            const dead = yield* writeFakeLease(tempRoot, {
              pid: DEAD_PID,
              originKey: "origin-dead-collected",
              nonce: "collected",
              weightTokens: 5,
            });

            yield* withPrependedPath(
              binDirectory,
              Effect.gen(function* () {
                yield* reapAdmissionState({ apply: true });
                expect(yield* fs.exists(dead)).toBe(false);
              })
            );
          })
        );
      })
    ));

  it("never stops a scope represented by a live lease with the same nonce", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const runtimeDirectory = path.dirname(path.dirname(tempRoot.root));
            const binDirectory = path.join(runtimeDirectory, "bin");
            const capturePath = path.join(runtimeDirectory, "systemctl.argv");
            yield* fs.makeDirectory(binDirectory, { recursive: true });
            yield* writeExecutable(
              path.join(binDirectory, "systemctl"),
              `#!/bin/sh\nprintf '%s\n' "$@" >> '${capturePath}'\nexit 0\n`
            );
            const dead = yield* writeFakeLease(tempRoot, {
              pid: DEAD_PID,
              originKey: "origin-dead-collision",
              nonce: "shared-nonce",
              weightTokens: 5,
            });
            const live = yield* writeFakeLease(tempRoot, {
              originKey: "origin-live-collision",
              nonce: "shared-nonce",
              runScope: RunScopeRecord.make({
                unitName: "agent-run-shared-nonce.scope",
                support: "active",
                attachedPid: process.pid,
                attachedAt: "2026-08-29T00:00:00.000Z",
              }),
              weightTokens: 5,
            });

            yield* withPrependedPath(
              binDirectory,
              Effect.gen(function* () {
                yield* reapAdmissionState({ apply: true });
                const systemctlArguments = yield* fs
                  .readFileString(capturePath)
                  .pipe(Effect.orElseSucceed(() => Str.empty));
                expect(Str.includes("stop")(systemctlArguments)).toBe(false);
                expect(yield* fs.exists(dead)).toBe(true);
                expect(yield* fs.exists(live)).toBe(true);
              })
            );
          })
        );
      })
    ));

  it("never stops a recorded scope that does not match the dead lease nonce", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const runtimeDirectory = path.dirname(path.dirname(tempRoot.root));
            const binDirectory = path.join(runtimeDirectory, "bin");
            const capturePath = path.join(runtimeDirectory, "systemctl.argv");
            yield* fs.makeDirectory(binDirectory, { recursive: true });
            yield* writeExecutable(
              path.join(binDirectory, "systemctl"),
              `#!/bin/sh\nprintf '%s\n' "$@" >> '${capturePath}'\nexit 0\n`
            );
            const dead = yield* writeFakeLease(tempRoot, {
              pid: DEAD_PID,
              originKey: "origin-dead-mismatch",
              nonce: "dead",
              runScope: RunScopeRecord.make({
                unitName: "agent-run-live.scope",
                support: "active",
                attachedPid: DEAD_PID,
                attachedAt: "2026-08-29T00:00:00.000Z",
              }),
              weightTokens: 5,
            });

            yield* withPrependedPath(
              binDirectory,
              Effect.gen(function* () {
                yield* reapAdmissionState({ apply: true });
                expect(yield* fs.exists(capturePath)).toBe(false);
                expect(yield* fs.exists(dead)).toBe(true);
              })
            );
          })
        );
      })
    ));

  it("retains a legacy recorded scope when the lease has no nonce authority", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const runtimeDirectory = path.dirname(path.dirname(tempRoot.root));
            const binDirectory = path.join(runtimeDirectory, "bin");
            const capturePath = path.join(runtimeDirectory, "systemctl.argv");
            yield* fs.makeDirectory(binDirectory, { recursive: true });
            yield* writeExecutable(
              path.join(binDirectory, "systemctl"),
              `#!/bin/sh\nprintf '%s\n' "$@" >> '${capturePath}'\nexit 0\n`
            );
            const dead = yield* writeFakeLease(tempRoot, {
              pid: DEAD_PID,
              originKey: "origin-dead-legacy-recorded",
              nonce: "",
              runScope: RunScopeRecord.make({
                unitName: "agent-run-legacy-recorded.scope",
                support: "active",
                attachedPid: DEAD_PID,
                attachedAt: "2026-08-29T00:00:00.000Z",
              }),
              weightTokens: 5,
            });

            yield* withPrependedPath(
              binDirectory,
              Effect.gen(function* () {
                yield* reapAdmissionState({ apply: true });
                expect(yield* fs.exists(capturePath)).toBe(false);
                expect(yield* fs.exists(dead)).toBe(true);
              })
            );
          })
        );
      })
    ));

  it("renders run-scope details on lease status lines", () => {
    const base = {
      schemaVersion: "yeet-admission-lease/v1" as const,
      pid: 4242,
      procStart: "1",
      kind: "full-proof" as const,
      weightTokens: 3,
      priority: "verify" as const,
      originKey: "origin-render",
      checkoutRoot: "/repo/render",
      branch: "feat/render",
      command: "bun run beep yeet verify",
      startedAt: "2026-08-30T00:00:00Z",
      admittedAtMillis: 0,
      heartbeatAtMillis: 0,
    };
    const snapshot = AdmissionSnapshot.make({
      capacityTokens: 10,
      activeTokens: 9,
      memAvailableGib: 64,
      hardFloorEngaged: false,
      leases: [
        YeetAdmissionLease.make({
          ...base,
          runScope: RunScopeRecord.make({
            unitName: "agent-run-peak.scope",
            support: "active",
            attachedPid: 4242,
            attachedAt: "2026-08-30T00:00:01Z",
            memoryPeakBytes: 4096,
          }),
        }),
        YeetAdmissionLease.make({
          ...base,
          pid: 4243,
          runScope: RunScopeRecord.make({
            unitName: "agent-run-nopeak.scope",
            support: "failed",
            attachedPid: 4243,
            attachedAt: "2026-08-30T00:00:01Z",
          }),
        }),
        YeetAdmissionLease.make({ ...base, pid: 4244 }),
      ],
      tickets: [],
      dead: [],
      quarantined: [],
    });

    const lines = renderAdmissionSnapshotLinesForTesting(snapshot, 0);
    expect(lines[0]).toBe("admission capacity: 9/10 tokens (MemAvailable 64.0 GiB)");
    expect(lines[1]).toContain(" scope=agent-run-peak.scope support=active peak=4096 bytes");
    expect(lines[2]).toContain(" scope=agent-run-nopeak.scope support=failed");
    expect(lines[2]).not.toContain("peak=");
    expect(lines[3]).not.toContain("scope=");
  });

  it("never stops a loaded scope merely because the lease scan did not see it", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const runtimeDirectory = path.dirname(path.dirname(tempRoot.root));
            const binDirectory = path.join(runtimeDirectory, "bin");
            const capturePath = path.join(runtimeDirectory, "systemctl.argv");
            yield* fs.makeDirectory(binDirectory, { recursive: true });
            yield* writeExecutable(
              path.join(binDirectory, "systemctl"),
              `#!/bin/sh\nprintf '%s\\n' "$@" >> '${capturePath}'\nprintf 'agent-run-racing.scope loaded active running\\n'\nexit 0\n`
            );

            yield* withPrependedPath(
              binDirectory,
              Effect.gen(function* () {
                yield* reapAdmissionState({ apply: true });
                expect(yield* fs.exists(capturePath)).toBe(false);
              })
            );
          })
        );
      })
    ));

  it("skips a head ticket stuck on an externally held origin lock so later origins still admit", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            // Origin lock held by a process with no admission lease (e.g. a
            // sibling checkout on the previous Yeet release).
            const stuckGate = {
              tryAcquire: Effect.succeed(O.none<string>()),
              tryAcquireFallback: Effect.succeed(O.none<string>()),
              release: (_: string) => Effect.void,
            };
            const stuck = yield* Effect.forkChild(
              withQualityAdmission(
                request({ originKey: "origin-external", checkoutRoot: "/repo/external" }),
                stuckGate,
                Effect.succeed("never"),
                fastConfig
              )
            );
            yield* Effect.sleep("120 millis");
            expect(stuck.pollUnsafe()).toBeUndefined();
            const other = yield* withQualityAdmission(
              request({ originKey: "origin-elsewhere", checkoutRoot: "/repo/elsewhere" }),
              noAdmissionOriginGate,
              Effect.succeed("elsewhere"),
              fastConfig
            );
            expect(other).toBe("elsewhere");
            expect(A.length(yield* listDirectory(tempRoot.queue))).toBe(1);
            yield* Fiber.interrupt(stuck);
          })
        );
      })
    ));

  it("rolls back every lease outside the capacity-fitting admission prefix", () => {
    const lease = (pid: number, admittedAtMillis: number, weightTokens: number) =>
      YeetAdmissionLease.make({
        schemaVersion: "yeet-admission-lease/v1",
        pid,
        procStart: "1",
        kind: "merged-preview",
        weightTokens,
        priority: "verify",
        originKey: `origin-${pid}`,
        checkoutRoot: `/repo/${pid}`,
        branch: "feat/x",
        command: "bun run beep yeet verify",
        startedAt: `2026-08-27T00:00:0${pid}Z`,
        admittedAtMillis,
        heartbeatAtMillis: admittedAtMillis + 5000,
      });
    const first = lease(1, 100, 5);
    const second = lease(2, 200, 5);
    const third = lease(3, 300, 5);
    const state = {
      leases: [
        { path: "/a", lease: third },
        { path: "/b", lease: first },
        { path: "/c", lease: second },
      ],
      tickets: [],
      dead: [],
      deadLeases: [],
      deadTickets: [],
      quarantined: [],
    };
    // 5 + 5 + 5 against capacity 8: only the oldest admission fits the prefix.
    expect(isOvershootLoserForTesting(state, 8, first)).toBe(false);
    expect(isOvershootLoserForTesting(state, 8, second)).toBe(true);
    expect(isOvershootLoserForTesting(state, 8, third)).toBe(true);
    // Within capacity nothing rolls back.
    expect(isOvershootLoserForTesting(state, 15, third)).toBe(false);
  });

  it("fails closed when the admission state directory cannot be listed", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            // Materialize the directories, then make the queue unlistable.
            yield* withQualityAdmission(request(), noAdmissionOriginGate, Effect.void, fastConfig);
            yield* fs.chmod(tempRoot.queue, 0o000);
            const failure = yield* admissionStatus(fastConfig).pipe(Effect.flip);
            expect(failure._tag).toBe("QualitySchedulerError");
            expect(failure.message).toContain("Failed to list admission state");
            yield* fs.chmod(tempRoot.queue, 0o700);
          })
        );
      })
    ));

  it("releases the origin gate when lease staging fails after acquisition", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const releases = yield* Ref.make(0);
            const gate = {
              tryAcquire: Effect.succeedSome("origin-lease"),
              tryAcquireFallback: Effect.succeedSome("origin-lease"),
              release: (_: string) => Ref.update(releases, (count) => count + 1),
            };
            // Materialize the directories, then make the leases dir unwritable
            // so staging the lease fails after the gate has been acquired.
            yield* withQualityAdmission(request(), noAdmissionOriginGate, Effect.void, fastConfig);
            yield* fs.chmod(tempRoot.leases, 0o500);
            const failure = yield* withQualityAdmission(request(), gate, Effect.succeed("never"), fastConfig).pipe(
              Effect.flip
            );
            expect(failure._tag).toBe("QualitySchedulerError");
            expect(yield* Ref.get(releases)).toBe(1);
            yield* fs.chmod(tempRoot.leases, 0o700);
            expect(A.length(yield* listDirectory(tempRoot.queue))).toBe(0);
          })
        );
      })
    ));

  it("keeps persisted quarantine contents on the status surface", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            yield* withQualityAdmission(request(), noAdmissionOriginGate, Effect.void, fastConfig);
            const parked = path.join(tempRoot.quarantine, "old.lease.json.123");
            yield* fs.writeFileString(parked, "{not json");
            const snapshot = yield* admissionStatus(fastConfig);
            expect(snapshot.quarantined).toContain(parked);
          })
        );
      })
    ));

  it("bypasses weighted admission when the hard floor is unattainable", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(14);
        yield* withAdmissionTempRoot(
          gibRef,
          (tempRoot) =>
            Effect.gen(function* () {
              // 18 GiB total clears one slot numerically but can never hold the
              // 15 GiB floor plus a 5 GiB slot of available memory.
              const result = yield* withQualityAdmission(
                request(),
                noAdmissionOriginGate,
                Effect.succeed("ran"),
                fastConfig
              );
              expect(result).toBe("ran");
              expect(A.length(yield* listDirectory(tempRoot.queue))).toBe(0);
              expect(A.length(yield* listDirectory(tempRoot.leases))).toBe(0);
            }),
          18
        );
      })
    ));

  it("bypasses weighted admission on machines below the scheduling envelope", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(6);
        yield* withAdmissionTempRoot(
          gibRef,
          (tempRoot) =>
            Effect.gen(function* () {
              const releases = yield* Ref.make(0);
              const gate = {
                tryAcquire: Effect.succeedSome("origin-lease"),
                tryAcquireFallback: Effect.succeedSome("origin-lease"),
                release: (_: string) => Ref.update(releases, (count) => count + 1),
              };
              const result = yield* withQualityAdmission(request(), gate, Effect.succeed("ran"), fastConfig);
              expect(result).toBe("ran");
              expect(yield* Ref.get(releases)).toBe(1);
              // No ticket or lease bookkeeping happens below the envelope.
              expect(A.length(yield* listDirectory(tempRoot.queue))).toBe(0);
              expect(A.length(yield* listDirectory(tempRoot.leases))).toBe(0);
            }),
          8
        );
      })
    ));

  it("clamps work to the installed-memory token ceiling", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(
          gibRef,
          (tempRoot) =>
            Effect.gen(function* () {
              const admissionRequest = request({ kind: "merged-preview", weightTokens: 5 });
              yield* withQualityAdmission(admissionRequest, noAdmissionOriginGate, Effect.void, fastConfig);
              const admitted = pipe(
                yield* readJournalEvents(tempRoot.root),
                A.findFirst(AdmissionJournalEvent.guards["admission-admitted"]),
                O.getOrThrow
              );

              expect(admitted.kind).toBe(admissionRequest.kind);
              expect(admitted.weightTokens).toBe(2);
            }),
          20
        );
      })
    ));

  it("holds two full proofs at 8-token capacity but refuses a merged preview beside one", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            yield* writeFakeLease(tempRoot, { weightTokens: 3, originKey: "origin-one" });
            // Second full proof (3 + 3 <= 8) admits immediately.
            const second = yield* withQualityAdmission(
              request({ originKey: "origin-two", checkoutRoot: "/repo/two" }),
              noAdmissionOriginGate,
              Effect.succeed("second"),
              fastConfig
            );
            expect(second).toBe("second");
            yield* writeFakeLease(tempRoot, { weightTokens: 5, originKey: "origin-three", kind: "merged-preview" });
            // 3 + 5 = 8 tokens held; another merged preview (5) must wait.
            const preview = yield* Effect.forkChild(
              withQualityAdmission(
                request({ kind: "merged-preview", weightTokens: 5, originKey: "origin-four" }),
                noAdmissionOriginGate,
                Effect.succeed("preview"),
                fastConfig
              )
            );
            yield* Effect.sleep("100 millis");
            expect(preview.pollUnsafe()).toBeUndefined();
            yield* Fiber.interrupt(preview);
          })
        );
      })
    ));
});
