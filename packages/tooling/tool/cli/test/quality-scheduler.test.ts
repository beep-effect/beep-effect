import { renderAdmissionSnapshotLinesForTesting } from "@beep/repo-cli/test/Quality";
import {
  AdmissionConfig,
  AdmissionJournalAdmitted,
  AdmissionJournalEvent,
  AdmissionRequest,
  AdmissionSnapshot,
  acquireJournalFileLock,
  admissionCapacityTokensFor,
  admissionJournalPath,
  admissionProtocolStatus,
  admissionStatus,
  admissionTokenWeight,
  appendAdmissionJournalEvent,
  attemptJournalPathForCheckout,
  decodeAdmissionJournalEvent,
  isOvershootLoserForTesting,
  isProcessIdentityAliveWithStartForTesting,
  MemoryStats,
  noAdmissionOriginGate,
  parseAdmissionProcStatStartTime,
  processIdentityStatus,
  processIdentityStatusWithStartForTesting,
  processStartIdentityForPid,
  provideRuntimeRootForTesting,
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
import { UUID } from "@beep/schema/String";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { NodeChildProcessSpawner } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Clock, ConfigProvider, Effect, Fiber, FileSystem, Layer, Path, pipe, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";
import { FastCheck as fc } from "effect/testing";

const PlatformLayer = NodeChildProcessSpawner.layer.pipe(
  Layer.provideMerge(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer))
);

const DEAD_PID = 2_147_483_647;
const JOURNALED_ATTEMPT_ID = S.decodeSync(UUID)("550e8400-e29b-41d4-a716-446655440020");

describe("process identity liveness", () => {
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

const memoryLayer = (gibRef: Ref.Ref<number>, totalGib = 128) =>
  Layer.succeed(MemoryStats, MemoryStats.of({ availableGib: Ref.get(gibRef), totalGib: Effect.succeed(totalGib) }));

const ownProcStart = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const stat = yield* fs.readFileString(`/proc/${process.pid}/stat`).pipe(Effect.orElseSucceed(() => ""));
  return O.getOrElse(parseAdmissionProcStatStartTime(stat), () => "");
});

interface AdmissionTempRoot {
  readonly leases: string;
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
      leases: path.join(root, "leases"),
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

describe("quality-scheduler", () => {
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
            const lockToken = yield* fs.readFileString(lockPath);
            expect(lockToken).toBe(
              pipe(
                winnerIndex,
                O.flatMap((index) => A.get(contenderTokens, index)),
                O.getOrThrow
              )
            );
            yield* releaseAdmissionJournalLockForTesting(lockPath, lockToken);
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
            yield* fs.writeFileString(lockPath, "999:replacement-owner");
            yield* releaseAdmissionJournalLockForTesting(lockPath, `${process.pid}:mine`);
            expect(O.isSome(yield* fs.stat(lockPath).pipe(Effect.option))).toBe(true);
            yield* releaseAdmissionJournalLockForTesting(lockPath, "999:replacement-owner");
            expect(O.isNone(yield* fs.stat(lockPath).pipe(Effect.option))).toBe(true);
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
            // admission and release must still complete and clean up.
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
            expect(yield* readJournalEvents(tempRoot.root)).toHaveLength(0);
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

            yield* Effect.sleep("100 millis");
            const stampedCurrent = yield* fs.readFileString(currentPath).pipe(Effect.flatMap(decodeTicket));
            expect(stampedCurrent.blockedOnOriginAtMillis).toBeGreaterThan(0);

            yield* fs.remove(legacyPath, { force: true });
            yield* Ref.set(gibRef, 50);
            expect(yield* Fiber.join(current)).toBe("current");
          })
        );
      })
    ));

  it("gives publish priority over a newer verify but lets an aged verify keep its place", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const blocking = yield* writeFakeLease(tempRoot, { weightTokens: 6, originKey: "origin-other" });
            const order = yield* Ref.make(A.empty<string>());
            const record = (label: string) => Ref.update(order, A.append(label));
            const verify = yield* Effect.forkChild(
              withQualityAdmission(
                request({ originKey: "origin-v", checkoutRoot: "/repo/v" }),
                noAdmissionOriginGate,
                record("verify"),
                fastConfig
              )
            );
            yield* Effect.sleep("60 millis");
            const publish = yield* Effect.forkChild(
              withQualityAdmission(
                request({ originKey: "origin-p", checkoutRoot: "/repo/p", priority: "publish" }),
                noAdmissionOriginGate,
                record("publish"),
                fastConfig
              )
            );
            yield* Effect.sleep("60 millis");
            yield* fs.remove(blocking, { force: true });
            yield* Fiber.join(verify);
            yield* Fiber.join(publish);
            // Publish enqueued later but outranks the young verify ticket.
            // (The verify ticket ages to publish rank only after 250ms here,
            // and the blocker was released before that.)
            expect(yield* Ref.get(order)).toStrictEqual(["publish", "verify"]);
          })
        );
      })
    ));

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
            yield* fs.makeDirectory(binDirectory, { recursive: true });
            yield* writeExecutable(path.join(binDirectory, "systemctl"), "#!/bin/sh\nexit 0\n");
            const checkoutRoot = path.join(path.dirname(path.dirname(tempRoot.root)), "off-checkout");
            yield* fs.makeDirectory(checkoutRoot, { recursive: true });
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

  it("still frees a dead lease when its eviction receipt cannot be published", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const gibRef = yield* Ref.make(50);
        yield* withAdmissionTempRoot(gibRef, (tempRoot) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const binDirectory = path.join(path.dirname(path.dirname(tempRoot.root)), "bin");
            yield* fs.makeDirectory(binDirectory, { recursive: true });
            yield* writeExecutable(path.join(binDirectory, "systemctl"), "#!/bin/sh\nexit 0\n");
            const dead = yield* writeFakeLease(tempRoot, {
              pid: DEAD_PID,
              weightTokens: 5,
              originKey: "origin-dead-journal-failure",
              attemptId: O.some(JOURNALED_ATTEMPT_ID),
            });
            yield* fs.makeDirectory(path.join(tempRoot.root, "journal.ndjson"));

            const applied = yield* withPrependedPath(binDirectory, reapAdmissionState({ apply: true }));

            expect(applied.dead).toStrictEqual([dead]);
            expect(yield* listDirectory(tempRoot.leases)).toHaveLength(0);
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
            yield* fs.makeDirectory(binDirectory, { recursive: true });
            yield* writeExecutable(path.join(binDirectory, "systemctl"), "#!/bin/sh\nexit 0\n");
            const dead = yield* writeFakeLease(tempRoot, {
              pid: DEAD_PID,
              weightTokens: 5,
              originKey: "origin-dead-remove-failure",
              attemptId: O.some(JOURNALED_ATTEMPT_ID),
            });

            const applied = yield* Effect.acquireUseRelease(
              fs.chmod(tempRoot.leases, 0o500),
              () => withPrependedPath(binDirectory, reapAdmissionState({ apply: true })),
              () => fs.chmod(tempRoot.leases, 0o700)
            );

            expect(applied.dead).toStrictEqual([dead]);
            expect(yield* listDirectory(tempRoot.leases)).toStrictEqual([path.basename(dead)]);
            expect(yield* readJournalEvents(tempRoot.root)).toHaveLength(0);
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
