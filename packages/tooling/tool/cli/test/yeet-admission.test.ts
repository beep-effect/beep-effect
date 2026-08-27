import { parseProcStatStartTime } from "@beep/repo-cli/commands/Worktree";
import {
  admissionCapacityForMemAvailableKiB,
  admissionCheckConcurrency,
  admissionContentionFamilies,
  admissionFamiliesConflict,
  admissionWeight,
  admissionWorkloadEnvironment,
  collectAdmissionChangedPathsForTesting,
  currentCommitSha,
  RepoRunContext,
  readAdmissionWaiterRowsForTesting,
  replacePublishedPrLeaseGenerationForTesting,
  requireAdmissionProcessGenerationForTesting,
  retireAdmissionGenerationFilesForTesting,
  retirePublishedPrLeaseAtPathForTesting,
  selectAdmissionWaiter,
  selectFirstAdmissibleAdmissionWaiter,
  tryReclaimObservedAdmissionMutexForTesting,
  writeAdmissionRecordExclusiveForTesting,
  writeIdleAdmissionWorkloadForTesting,
} from "@beep/repo-cli/test/Yeet";
import { NonNegativeInt, PosInt } from "@beep/schema";
import { Unknown } from "@beep/schema/Unknown";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeChildProcessSpawner } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, PlatformError } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const waiter = (
  id: string,
  kind: "review-fix" | "publish",
  enqueuedAtEpochMs: number,
  contentionFamilies: ReadonlyArray<
    "goal-portfolio" | "exploration-atlas" | "workspace-topology" | "quality-policy" | "quality-cli"
  > = []
) => ({
  schemaVersion: "yeet-admission-waiter/v1" as const,
  id,
  pid: PosInt.make(42),
  procStart: "100",
  kind,
  weightTokens: admissionWeight(kind),
  checkoutRoot: `/repo/${id}`,
  branch: `feature/${id}`,
  hotPaths: [],
  contentionFamilies,
  enqueuedAtEpochMs: NonNegativeInt.make(enqueuedAtEpochMs),
});

const PlatformLayer = NodeChildProcessSpawner.layer.pipe(
  Layer.provideMerge(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer))
);

const encodeJson = Unknown.encodeUnknownEffectFromJsonString;
const decodeLeaseObservation = S.decodeUnknownEffect(
  S.fromJsonString(
    S.Struct({
      generationId: S.String,
      headSha: S.String,
      prNumber: S.Number,
      status: S.String,
    })
  )
);

const prLeaseFixture = (
  generationId: string,
  status: "active" | "claiming" | "retired",
  headSha: string,
  prNumber = 900
) => ({
  schemaVersion: "yeet-pr-lease/v1",
  generationId,
  sessionId: "codex:test-owner",
  pid: process.pid,
  procStart: "test-generation",
  checkoutRoot: process.cwd(),
  branch: "feature/admission-cas",
  headSha,
  prNumber,
  acquiredAt: "2026-08-27T00:00:00Z",
  refreshedAt: "2026-08-27T00:00:00Z",
  status,
  ...(status === "retired" ? { retiredAt: "2026-08-27T00:01:00Z", retireReason: "test-terminal" } : {}),
});

const currentCheckoutHead = currentCommitSha(
  RepoRunContext.make({
    base: "origin/main",
    branch: "feature/admission-cas",
    cwd: process.cwd(),
    head: "HEAD",
    originalArgv: [],
    packetDir: ".beep/yeet",
    repoRoot: process.cwd(),
    turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
  })
);

const inTempDirectory = Effect.fn("AdmissionTest.inTempDirectory")(function* <Value, Failure, Requirements>(
  use: (root: string) => Effect.Effect<Value, Failure, Requirements>
) {
  const fs = yield* FileSystem.FileSystem;
  return yield* Effect.acquireUseRelease(fs.makeTempDirectory(), use, (root) =>
    fs.remove(root, { recursive: true }).pipe(Effect.ignore)
  );
});

describe("Yeet weighted admission", () => {
  it("assigns the packet token weights", () => {
    expect(admissionWeight("review-fix")).toBe(1);
    expect(admissionWeight("full-proof")).toBe(3);
    expect(admissionWeight("merged-preview")).toBe(5);
    expect(admissionWeight("publish")).toBe(1);
  });

  it("enforces the 15 GiB floor and 10-token cap", () => {
    const gib = 1024 * 1024;
    expect(admissionCapacityForMemAvailableKiB(14.9 * gib)).toBe(0);
    expect(admissionCapacityForMemAvailableKiB(15 * gib)).toBe(1);
    expect(admissionCapacityForMemAvailableKiB(50 * gib)).toBe(8);
    expect(admissionCapacityForMemAvailableKiB(80 * gib)).toBe(10);
  });

  it("prioritizes publish until an older waiter reaches the two-minute aging bound", () => {
    const oldReview = waiter("old-review", "review-fix", 0);
    const publish = waiter("publish", "publish", 1_000);
    const freshReview = waiter("fresh-review", "review-fix", 2_000);
    expect(O.getOrThrow(selectAdmissionWaiter([oldReview, publish, freshReview], 60_000)).id).toBe("publish");
    expect(O.getOrThrow(selectAdmissionWaiter([oldReview, publish, freshReview], 120_000)).id).toBe("old-review");
  });

  it("selects the first admissible waiter without head-of-line blocking a disjoint family", () => {
    const blockedPublish = waiter("blocked", "publish", 1_000, ["goal-portfolio"]);
    const disjointPublish = waiter("disjoint", "publish", 2_000, ["quality-policy"]);
    const review = waiter("review", "review-fix", 3_000);
    const selected = selectFirstAdmissibleAdmissionWaiter(
      [blockedPublish, disjointPublish, review],
      60_000,
      (candidate) => !admissionFamiliesConflict(candidate.contentionFamilies, ["goal-portfolio"])
    );

    expect(O.getOrThrow(selected).id).toBe("disjoint");
  });

  it("uses the measured-safe c2 profile before and after contention appears", () => {
    expect(admissionCheckConcurrency(false)).toBe("2");
    expect(admissionCheckConcurrency(true)).toBe("2");
  });

  it("binds StepExec workload registration to the exact lease generation", () => {
    expect(admissionWorkloadEnvironment("/runtime/lease.json", "lease-123", { KEEP: "yes" })).toEqual({
      KEEP: "yes",
      BEEP_YEET_ADMISSION_WORKLOAD_PATH: "/runtime/lease.json.workload",
      BEEP_YEET_ADMISSION_LEASE_ID: "lease-123",
    });
  });

  it("classifies and intersects only named contention families", () => {
    const goalFamilies = admissionContentionFamilies(["goals/ship-velocity/PLAN.md"]);
    const qualityFamilies = admissionContentionFamilies([
      "packages/tooling/tool/cli/src/commands/Quality/Tasks.ts",
      "standards/architecture/DECISIONS.md",
    ]);
    expect(goalFamilies).toEqual(["goal-portfolio"]);
    expect(qualityFamilies).toEqual(["quality-policy", "quality-cli"]);
    expect(admissionFamiliesConflict(goalFamilies, ["goal-portfolio"])).toBe(true);
    expect(admissionFamiliesConflict(goalFamilies, qualityFamilies)).toBe(false);
  });

  it.live("publishes complete records exclusively and never replaces an existing generation", () =>
    inTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const recordPath = `${root}/record.json`;
        const first = '{"generation":"first"}\n';
        const second = '{"generation":"second"}\n';

        expect(yield* writeAdmissionRecordExclusiveForTesting(recordPath, first)).toBe(true);
        expect(yield* fs.readFileString(recordPath)).toBe(first);
        expect(yield* writeAdmissionRecordExclusiveForTesting(recordPath, second)).toBe(false);
        expect(yield* fs.readFileString(recordPath)).toBe(first);
        expect(A.some(yield* fs.readDirectory(root), (name) => name.endsWith(".tmp"))).toBe(false);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("writes an exact idle companion before the first admitted subprocess", () =>
    inTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const leasePath = `${root}/lease.json`;
        const workloadPath = yield* writeIdleAdmissionWorkloadForTesting(leasePath, "lease-123");

        expect(workloadPath).toBe(`${leasePath}.workload`);
        expect(JSON.parse(yield* fs.readFileString(workloadPath))).toEqual({
          schemaVersion: "yeet-admission-workload/v1",
          leaseId: "lease-123",
          status: "idle",
        });
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("fails closed when an exact owner process generation cannot be observed", () =>
    Effect.gen(function* () {
      const failure = yield* requireAdmissionProcessGenerationForTesting(2_147_483_647, "test owner").pipe(Effect.flip);
      expect(failure._tag).toBe("YeetCommandError");
      expect(failure.message).toContain("failed closed");
    }).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("fails admission path discovery when a required Git inventory cannot run", () =>
    inTempDirectory((root) =>
      Effect.gen(function* () {
        const context = RepoRunContext.make({
          base: "origin/main",
          branch: "feature/admission",
          cwd: root,
          head: "HEAD",
          originalArgv: [],
          packetDir: `${root}/.beep/yeet`,
          repoRoot: `${root}/missing`,
          turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
        });
        const failure = yield* collectAdmissionChangedPathsForTesting(context).pipe(Effect.flip);
        expect(failure._tag).toBe("YeetCommandError");
        expect(failure.message).toContain("git diff");
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("retires the lease before companion cleanup can fail", () =>
    inTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const leasePath = `${root}/lease.json`;
        const workloadPath = `${leasePath}.workload`;
        yield* fs.writeFileString(leasePath, "lease\n");
        yield* fs.makeDirectory(workloadPath);
        yield* fs.writeFileString(`${workloadPath}/blocker`, "occupied\n");

        const failure = yield* retireAdmissionGenerationFilesForTesting(leasePath).pipe(Effect.flip);
        expect(failure._tag).toBe("YeetCommandError");
        expect(yield* fs.exists(leasePath)).toBe(false);
        expect(yield* fs.exists(workloadPath)).toBe(true);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("surfaces record publication failures as typed errors and cleans the prepared file", () =>
    inTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const denied = PlatformError.systemError({
          _tag: "PermissionDenied",
          module: "AdmissionTest",
          method: "link",
          pathOrDescriptor: root,
        });
        const failingFileSystem = FileSystem.FileSystem.of({
          ...fs,
          link: () => Effect.fail(denied),
        });
        const failure = yield* writeAdmissionRecordExclusiveForTesting(`${root}/record.json`, "complete\n").pipe(
          Effect.provideService(FileSystem.FileSystem, failingFileSystem),
          Effect.flip
        );

        expect(failure._tag).toBe("YeetCommandError");
        expect(failure.message).toContain("atomically publish admission record");
        expect(yield* fs.readDirectory(root)).toEqual([]);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("quarantines an unreadable row and fails loudly instead of wedging the queue", () =>
    inTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const brokenPath = `${root}/broken.json`;
        yield* fs.writeFileString(brokenPath, '{"schemaVersion":');

        const failure = yield* readAdmissionWaiterRowsForTesting(root).pipe(Effect.flip);
        expect(failure._tag).toBe("YeetCommandError");
        expect(failure.message).toContain("quarantined an unreadable row");
        expect(yield* fs.exists(brokenPath)).toBe(false);
        const quarantined = yield* fs.readDirectory(`${root}/quarantine`);
        expect(quarantined).toHaveLength(1);
        expect(quarantined[0]).toContain("broken.json");
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("allows only one stale-mutex reclaimer to replace an observed generation", () =>
    inTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const mutexPath = `${root}/mutex.lock`;
        const staleText = "2147483647\n100\n";
        const procStart = O.getOrThrow(parseProcStatStartTime(yield* fs.readFileString(`/proc/${process.pid}/stat`)));
        const replacements = [`${process.pid}\n${procStart}\n`, `${process.pid}\n${procStart}\n`] as const;
        yield* fs.writeFileString(mutexPath, staleText);

        const outcomes = yield* Effect.all(
          A.map(replacements, (replacement) =>
            tryReclaimObservedAdmissionMutexForTesting(mutexPath, staleText, replacement)
          ),
          { concurrency: "unbounded" }
        );
        expect(A.length(A.filter(outcomes, (outcome) => outcome))).toBe(1);
        expect(replacements).toContain(yield* fs.readFileString(mutexPath));
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("does not reclaim a mutex whose bytes changed after observation", () =>
    inTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const mutexPath = `${root}/mutex.lock`;
        const staleText = "2147483647\n100\n";
        const freshText = `${process.pid}\n400\n`;
        yield* fs.writeFileString(mutexPath, freshText);

        expect(yield* tryReclaimObservedAdmissionMutexForTesting(mutexPath, staleText, `${process.pid}\n500\n`)).toBe(
          false
        );
        expect(yield* fs.readFileString(mutexPath)).toBe(freshText);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("allows exactly one mutex-protected PR lease generation transition", () =>
    inTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const headSha = yield* currentCheckoutHead;
        const leasePath = `${root}/pr-lease.json`;
        const firstTemporary = `${root}/first.tmp`;
        const secondTemporary = `${root}/second.tmp`;
        yield* fs.writeFileString(leasePath, yield* encodeJson(prLeaseFixture("base", "active", headSha)));
        yield* fs.writeFileString(firstTemporary, yield* encodeJson(prLeaseFixture("first", "active", headSha)));
        yield* fs.writeFileString(secondTemporary, yield* encodeJson(prLeaseFixture("second", "active", headSha)));

        const outcomes = yield* Effect.all(
          A.map([firstTemporary, secondTemporary], (temporary) =>
            replacePublishedPrLeaseGenerationForTesting(
              root,
              O.some("base"),
              ["active"],
              temporary,
              leasePath,
              process.cwd(),
              headSha
            ).pipe(
              Effect.as(true),
              Effect.catch(() => Effect.succeed(false))
            )
          ),
          { concurrency: "unbounded" }
        );
        expect(A.length(A.filter(outcomes, (outcome) => outcome))).toBe(1);
        const observed = yield* decodeLeaseObservation(yield* fs.readFileString(leasePath));
        expect(["first", "second"]).toContain(observed.generationId);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("preserves newer active, claiming, and retired PR lease generations from stale writers", () =>
    inTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const headSha = yield* currentCheckoutHead;
        const leasePath = `${root}/pr-lease.json`;
        for (const status of A.make("active", "claiming", "retired")) {
          const generationId = `newer-${status}`;
          const temporary = `${root}/stale-${status}.tmp`;
          yield* fs.writeFileString(leasePath, yield* encodeJson(prLeaseFixture(generationId, status, headSha)));
          yield* fs.writeFileString(temporary, yield* encodeJson(prLeaseFixture(`stale-${status}`, "active", headSha)));

          const failure = yield* replacePublishedPrLeaseGenerationForTesting(
            root,
            O.some("older-observation"),
            ["active"],
            temporary,
            leasePath,
            process.cwd(),
            headSha
          ).pipe(Effect.flip);
          expect(failure._tag).toBe("PrLeaseTransitionContendedError");
          expect(yield* decodeLeaseObservation(yield* fs.readFileString(leasePath))).toMatchObject({
            generationId,
            status,
          });
        }
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("rejects a PR lease transition whose checkout head changed before the mutex commit", () =>
    inTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const headSha = yield* currentCheckoutHead;
        const leasePath = `${root}/pr-lease.json`;
        const temporary = `${root}/stale-head.tmp`;
        yield* fs.writeFileString(leasePath, yield* encodeJson(prLeaseFixture("base", "active", headSha)));
        yield* fs.writeFileString(temporary, yield* encodeJson(prLeaseFixture("stale-head", "active", headSha)));

        const failure = yield* replacePublishedPrLeaseGenerationForTesting(
          root,
          O.some("base"),
          ["active"],
          temporary,
          leasePath,
          process.cwd(),
          "stale-checkout-head"
        ).pipe(Effect.flip);
        expect(failure._tag).toBe("YeetCommandError");
        expect(failure.message).toContain("Checkout HEAD changed");
        expect(yield* decodeLeaseObservation(yield* fs.readFileString(leasePath))).toMatchObject({
          generationId: "base",
          status: "active",
        });
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("retires whichever same-PR/head generation wins a concurrent mutex race", () =>
    inTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const headSha = yield* currentCheckoutHead;
        const leasePath = `${root}/pr-lease.json`;
        const takeoverTemporary = `${root}/takeover.tmp`;
        yield* fs.writeFileString(leasePath, yield* encodeJson(prLeaseFixture("base", "active", headSha)));
        yield* fs.writeFileString(takeoverTemporary, yield* encodeJson(prLeaseFixture("takeover", "active", headSha)));

        const [retirement] = yield* Effect.all(
          [
            retirePublishedPrLeaseAtPathForTesting(
              process.cwd(),
              root,
              leasePath,
              PosInt.make(900),
              headSha,
              "pr-merged"
            ).pipe(
              Effect.as(true),
              Effect.catch(() => Effect.succeed(false))
            ),
            replacePublishedPrLeaseGenerationForTesting(
              root,
              O.some("base"),
              ["active"],
              takeoverTemporary,
              leasePath,
              process.cwd(),
              headSha
            ).pipe(
              Effect.as(true),
              Effect.catch(() => Effect.succeed(false))
            ),
          ],
          { concurrency: "unbounded" }
        );
        expect(retirement).toBe(true);
        const observed = yield* decodeLeaseObservation(yield* fs.readFileString(leasePath));
        expect(observed.status).toBe("retired");
        expect(observed.prNumber).toBe(900);
        expect(observed.headSha).toBe(headSha);
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );

  it.live("fails retirement loudly when no matching current PR lease exists", () =>
    inTempDirectory((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const headSha = yield* currentCheckoutHead;
        const leasePath = `${root}/pr-lease.json`;
        const missing = yield* retirePublishedPrLeaseAtPathForTesting(
          process.cwd(),
          root,
          leasePath,
          PosInt.make(900),
          headSha,
          "pr-closed"
        ).pipe(Effect.flip);
        expect(missing._tag).toBe("YeetCommandError");
        expect(missing.message).toContain("disappeared while retiring");

        yield* fs.writeFileString(leasePath, yield* encodeJson(prLeaseFixture("new-pr", "active", headSha, 901)));
        const mismatched = yield* retirePublishedPrLeaseAtPathForTesting(
          process.cwd(),
          root,
          leasePath,
          PosInt.make(900),
          headSha,
          "pr-closed"
        ).pipe(Effect.flip);
        expect(mismatched._tag).toBe("YeetCommandError");
        expect(mismatched.message).toContain("newer PR or head");
        expect(yield* decodeLeaseObservation(yield* fs.readFileString(leasePath))).toMatchObject({
          generationId: "new-pr",
          status: "active",
        });

        yield* fs.writeFileString(
          leasePath,
          yield* encodeJson(prLeaseFixture("claim-in-progress", "claiming", headSha))
        );
        const claiming = yield* retirePublishedPrLeaseAtPathForTesting(
          process.cwd(),
          root,
          leasePath,
          PosInt.make(900),
          headSha,
          "pr-closed"
        ).pipe(Effect.flip);
        expect(claiming._tag).toBe("YeetCommandError");
        expect(claiming.message).toContain("claiming generation");
        expect(yield* decodeLeaseObservation(yield* fs.readFileString(leasePath))).toMatchObject({
          generationId: "claim-in-progress",
          status: "claiming",
        });
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );
});
