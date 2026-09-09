import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  AdmissionConfig,
  AdmissionEvictionJournal,
  AdmissionJournalEvent,
  AdmissionRequest,
  admissionCapacityTokensFor,
  admissionJournalPath,
  appendAdmissionEvictionJournalEvent,
  attemptJournalPathForCheckout,
  decodeAdmissionJournalEvent,
  MemoryStats,
  noAdmissionOriginGate,
  processIdentityStatus,
  processStartIdentityForPid,
  provideRuntimeRootForTesting,
  QualitySchedulerError,
  RuntimeRootChoice,
  reapAdmissionState,
  setAdmissionEvictionProtocol,
  withQualityAdmission,
  YeetAdmissionLease,
  YeetAdmissionTicket,
} from "@beep/repo-cli/test/RepoRun";
import { decodeYeetAttemptJournalEvent } from "@beep/repo-cli/test/Yeet";
import { UUID } from "@beep/schema/String";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import {
  Clock,
  Config,
  ConfigProvider,
  DateTime,
  Deferred,
  Effect,
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
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";
import { FastCheck as fc } from "effect/testing";

// Ruling 10's synthetic producer: admission rows come from the real scheduler.
const producerPath = "packages/tooling/tool/cli/test/quality-scheduler-synthetic-scenario.test.ts";
const decodeUUID = S.decodeEffect(UUID);
const encodeLease = S.encodeEffect(S.fromJsonString(YeetAdmissionLease));
const encodeTicket = S.encodeEffect(S.fromJsonString(YeetAdmissionTicket));
const encodeLeaseSync = S.encodeSync(S.fromJsonString(YeetAdmissionLease));
const decodeLeaseSync = S.decodeUnknownSync(S.fromJsonString(YeetAdmissionLease));
const encodeTicketSync = S.encodeSync(S.fromJsonString(YeetAdmissionTicket));
const decodeTicketSync = S.decodeUnknownSync(S.fromJsonString(YeetAdmissionTicket));
const decodeJsonObject = S.decodeUnknownEffect(S.fromJsonString(S.JsonObject));
const encodeScenario = S.encodeUnknownEffect(S.fromJsonString(S.JsonObject, { space: 2 }));
const fastConfig = AdmissionConfig.make({
  capacityMaxTokens: 3,
  heartbeatSeconds: 0.02,
  progressSeconds: 0.4,
  publishAgingSeconds: 0.25,
  suspectAfterSeconds: 0.5,
});
const expectedTags = {
  "admission-enqueued": 2,
  "admission-admitted": 1,
  "admission-withdrawn": 1,
  "admission-lease-evicted": 1,
  "admission-ticket-evicted": 1,
  "admission-released": 1,
};
const steps = [
  "Publish protocol v2 with eviction on under the runtime-root test override.",
  "Admit contender A with an attemptId, checkout root, and branch into the only slot; hold its lease.",
  "Wait for contender B to enqueue behind A, then interrupt B while waiting.",
  "Write synthetic dead-owner lease and ticket fixtures with distinct checkout roots and attemptIds.",
  "Reap both fixtures through the real eviction and attempt-termination writers; acknowledge all claims.",
  "Finish A, assert the complete per-nonce chains, then reap again to prove idempotence and lock cleanup.",
];
type ScenarioChain = { readonly label: string; readonly nonce: string; readonly tags: ReadonlyArray<string> };

const eventTag = (event: AdmissionJournalEvent) => event._tag;
const journalLines = (text: string) => pipe(text, Str.split("\n"), A.filter(Str.isNonEmpty));
const isLockPath = Str.includes(".lock");
const isStagingPath = Str.includes(".tmp-");
// Locks and atomic-write staging files are process residue, never scenario state.
const isTransientPath = (entry: string) => isLockPath(entry) || isStagingPath(entry);

const listDirectory = Effect.fnUntraced(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  // A live contender can be publishing an atomic heartbeat when its directory is observed.
  return A.filter(yield* fs.readDirectory(directory), (name) => !isStagingPath(name));
});

const readJournalEvents = Effect.fnUntraced(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* Effect.forEach(journalLines(yield* fs.readFileString(yield* admissionJournalPath(root))), (line) =>
    decodeAdmissionJournalEvent(line)
  );
});

const readAttemptJournalEvents = Effect.fnUntraced(function* (checkoutRoot: string, branch: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* Effect.forEach(
    journalLines(yield* fs.readFileString(yield* attemptJournalPathForCheckout(checkoutRoot, branch))),
    (line) => decodeYeetAttemptJournalEvent(line)
  );
});

const request = (checkoutRoot: string, branch: string, attemptId: UUID) =>
  AdmissionRequest.make({
    kind: "full-proof",
    weightTokens: 3,
    priority: "verify",
    originKey: "synthetic-admission-origin",
    checkoutRoot,
    branch,
    command: "synthetic admission scenario",
    attemptId: O.some(attemptId),
  });

const withPrependedPath = <Value, Failure, Requirements>(
  binDirectory: string,
  use: Effect.Effect<Value, Failure, Requirements>
) =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const previousPath = Bun.env.PATH;
      Bun.env.PATH = previousPath === undefined ? binDirectory : `${binDirectory}:${previousPath}`;
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

const withAdmissionTempRoot = Effect.fn("SyntheticAdmission.withTempRoot")(
  function* <Value, Failure, Requirements>(
    use: (runtimeDir: string, exportTarget: O.Option<string>) => Effect.Effect<Value, Failure, Requirements>
  ) {
    const fs = yield* FileSystem.FileSystem;
    const runtimeDir = yield* fs.makeTempDirectoryScoped();
    const exportTarget = O.filter(yield* Config.option(Config.string("BEEP_CIOPS_SYNTHETIC_ROOT")), Str.isNonEmpty);
    return yield* use(runtimeDir, exportTarget).pipe(
      provideRuntimeRootForTesting(RuntimeRootChoice.make({ kind: "test-override", root: runtimeDir })),
      provideScopedLayer(ConfigProvider.layer(ConfigProvider.fromUnknown({ BEEP_RUN_SCOPES: "0" }))),
      provideScopedLayer(
        Layer.succeed(MemoryStats, MemoryStats.of({ availableGib: Effect.succeed(25), totalGib: Effect.succeed(128) }))
      )
    );
  },
  Effect.scoped,
  provideScopedLayer(NodeServices.layer)
);

const copySettledState = Effect.fn("SyntheticAdmission.copySettledState")(function* (source: string, target: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(target, { recursive: true });
  const entries = yield* fs.readDirectory(source, { recursive: true });
  yield* Effect.forEach(
    A.filter(entries, (entry) => !isTransientPath(entry)),
    Effect.fnUntraced(function* (entry) {
      const from = path.join(source, entry);
      const to = path.join(target, entry);
      if ((yield* fs.stat(from)).type === "Directory") {
        yield* fs.makeDirectory(to, { recursive: true });
      } else {
        yield* fs.makeDirectory(path.dirname(to), { recursive: true });
        yield* fs.copy(from, to, { overwrite: false });
      }
    }),
    { discard: true }
  );
});

const exportScenario = Effect.fn("SyntheticAdmission.exportScenario")(function* (
  runtimeDir: string,
  target: string,
  chains: ReadonlyArray<ScenarioChain>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  if ((yield* fs.exists(target)) && A.isArrayNonEmpty(yield* fs.readDirectory(target))) {
    return yield* QualitySchedulerError.make({
      message: "BEEP_CIOPS_SYNTHETIC_ROOT must be empty; refusing to overwrite a non-empty export target.",
    });
  }
  yield* fs.makeDirectory(target, { recursive: true });
  const admissionRoot = path.join(runtimeDir, "beep", "admit");
  const admissionTarget = path.join(target, "admission");
  yield* fs.makeDirectory(admissionTarget);
  for (const file of ["journal.ndjson", "protocol.json"]) {
    yield* fs.copy(path.join(admissionRoot, file), path.join(admissionTarget, file), { overwrite: false });
  }
  for (const directory of ["leases", "queue", "claims", "quarantine"]) {
    yield* copySettledState(path.join(admissionRoot, directory), path.join(admissionTarget, directory));
  }
  for (const label of ["contender-a", "dead-lease", "dead-ticket"]) {
    const relative = path.join("checkouts", label, ".beep", "yeet", "runs");
    yield* copySettledState(path.join(runtimeDir, relative), path.join(target, relative));
  }
  const source = yield* fs.readFile(fileURLToPath(import.meta.url));
  const scenario = yield* encodeScenario({
    producer: { path: producerPath, sha256: createHash("sha256").update(source).digest("hex") },
    steps,
    capturedAt: DateTime.formatIso(yield* DateTime.now),
    expected: { tags: expectedTags, chains },
  });
  yield* fs.writeFileString(path.join(target, "scenario.json"), `${scenario}\n`);
  // Stage B may consume the export only once every copy and the manifest have completed.
  yield* fs.writeFileString(path.join(target, "READY"), "");
});

const expectV3ExceptAdmitted = (events: ReadonlyArray<AdmissionJournalEvent>): void => {
  for (const event of events) {
    expect(AdmissionJournalEvent.guards[event._tag](event)).toBe(true);
    expect(event.schemaVersion).toBe(
      AdmissionJournalEvent.guards["admission-admitted"](event)
        ? "yeet-admission-journal/v1"
        : "yeet-admission-journal/v3"
    );
  }
};

const expectExportCheck = Effect.fnUntraced(function* (
  runtimeDir: string,
  root: string,
  chains: ReadonlyArray<ScenarioChain>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  // Exercise export completeness and refusal within the disposable root on ordinary regression runs too.
  const exportCheck = path.join(runtimeDir, "export-check");
  yield* fs.makeDirectory(exportCheck);
  yield* exportScenario(runtimeDir, exportCheck, chains);
  expect(yield* fs.readFileString(path.join(exportCheck, "READY"))).toBe("");
  expect(yield* fs.readFileString(path.join(exportCheck, "admission", "journal.ndjson"))).toBe(
    yield* fs.readFileString(yield* admissionJournalPath(root))
  );
  const manifest = yield* fs.readFileString(path.join(exportCheck, "scenario.json"));
  expect(yield* decodeJsonObject(manifest)).toMatchObject({
    producer: {
      path: producerPath,
      sha256: createHash("sha256")
        .update(yield* fs.readFile(fileURLToPath(import.meta.url)))
        .digest("hex"),
    },
    steps,
    expected: { tags: expectedTags, chains },
  });
  for (const label of ["contender-a", "dead-lease", "dead-ticket"]) {
    const relative = path.join("checkouts", label, ".beep", "yeet", "runs");
    expect(yield* fs.readDirectory(path.join(exportCheck, relative), { recursive: true })).toStrictEqual(
      yield* fs.readDirectory(path.join(runtimeDir, relative), { recursive: true })
    );
  }
  for (const directory of ["leases", "queue", "claims", "quarantine"]) {
    expect(yield* fs.readDirectory(path.join(exportCheck, "admission", directory))).toStrictEqual([]);
  }
  const refusal = yield* exportScenario(runtimeDir, exportCheck, chains).pipe(Effect.flip);
  expect(refusal.message).toContain("refusing to overwrite a non-empty export target");
  expect(yield* fs.readFileString(path.join(exportCheck, "scenario.json"))).toBe(manifest);
  expect(A.filter(yield* fs.readDirectory(exportCheck, { recursive: true }), isLockPath)).toStrictEqual([]);
});

describe("synthetic admission scenario", () => {
  it("journals contention, withdrawal, fixture evictions, and release with an optional synthetic export", () =>
    Effect.runPromise(
      withAdmissionTempRoot(
        Effect.fnUntraced(function* (runtimeDir, exportTarget) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const root = path.join(runtimeDir, "beep", "admit");
          const checkoutA = path.join(runtimeDir, "checkouts", "contender-a");
          const checkoutB = path.join(runtimeDir, "checkouts", "contender-b");
          const checkoutLease = path.join(runtimeDir, "checkouts", "dead-lease");
          const checkoutTicket = path.join(runtimeDir, "checkouts", "dead-ticket");
          const branchA = "feat/synthetic-contender-a";
          const branchB = "feat/synthetic-contender-b";
          const branchLease = "feat/synthetic-dead-lease";
          const branchTicket = "feat/synthetic-dead-ticket";
          const attemptA = yield* decodeUUID(randomUUID());
          const attemptB = yield* decodeUUID(randomUUID());
          const attemptLease = yield* decodeUUID(randomUUID());
          const attemptTicket = yield* decodeUUID(randomUUID());
          // Admission alone does not write normal attempt rows. Keep A's empty run directory as a receipt.
          for (const checkout of [checkoutA, checkoutB, checkoutLease, checkoutTicket]) {
            yield* fs.makeDirectory(path.join(checkout, ".beep", "yeet", "runs"), { recursive: true });
          }
          expect(yield* setAdmissionEvictionProtocol("on")).toMatchObject({
            schemaVersion: "yeet-admission-protocol/v2",
            eviction: "on",
          });
          expect(admissionCapacityTokensFor(25, fastConfig)).toBe(3);
          const admittedA = yield* Deferred.make<void>();
          const finishA = yield* Deferred.make<void>();
          const holder = yield* Effect.forkChild(
            withQualityAdmission(
              request(checkoutA, branchA, attemptA),
              noAdmissionOriginGate,
              Deferred.succeed(admittedA, undefined).pipe(Effect.andThen(Deferred.await(finishA))),
              fastConfig
            )
          );
          yield* Deferred.await(admittedA).pipe(Effect.timeout("5 seconds"));
          expect(yield* listDirectory(path.join(root, "leases"))).toHaveLength(1);
          const ranB = yield* Ref.make(false);
          const waiter = yield* Effect.forkChild(
            withQualityAdmission(
              request(checkoutB, branchB, attemptB),
              noAdmissionOriginGate,
              Ref.set(ranB, true),
              fastConfig
            )
          );
          yield* readJournalEvents(root).pipe(
            Effect.repeat({
              until: (events) =>
                A.some(
                  events,
                  (event) =>
                    AdmissionJournalEvent.guards["admission-enqueued"](event) && event.checkoutRoot === checkoutB
                ),
              schedule: Schedule.spaced("10 millis"),
            }),
            Effect.timeout("5 seconds")
          );
          expect(yield* listDirectory(path.join(root, "queue"))).toHaveLength(1);
          yield* Fiber.interrupt(waiter);
          expect(yield* Ref.get(ranB)).toBe(false);
          expect(yield* listDirectory(path.join(root, "queue"))).toStrictEqual([]);

          const binDirectory = path.join(runtimeDir, "bin");
          yield* fs.makeDirectory(binDirectory);
          const systemctl = path.join(binDirectory, "systemctl");
          yield* fs.writeFileString(systemctl, "#!/bin/sh\nexit 0\n");
          yield* fs.chmod(systemctl, 0o755);
          // A same-source start mismatch is definitive dead/reused-owner evidence, without a host PID literal.
          const liveStart = O.getOrThrow(yield* processStartIdentityForPid(process.pid));
          const owner = { pid: process.pid, procStart: `${liveStart}-synthetic-dead-owner` };
          expect(yield* processIdentityStatus(owner)).toBe("dead");
          const fixtureInstant = yield* Clock.currentTimeMillis;
          const fixture = {
            ...owner,
            weightTokens: 3,
            originKey: "synthetic-dead-owner",
            enqueuedAtMillis: fixtureInstant,
            heartbeatAtMillis: fixtureInstant,
          };
          const lease = YeetAdmissionLease.make({
            ...fixture,
            schemaVersion: "yeet-admission-lease/v1",
            kind: "full-proof",
            priority: "verify",
            checkoutRoot: checkoutLease,
            branch: branchLease,
            command: "synthetic dead lease",
            nonce: "synthetic-dead-lease",
            attemptId: O.some(attemptLease),
            admittedAtMillis: fixtureInstant,
            startedAt: DateTime.formatIso(yield* DateTime.now),
          });
          const ticket = YeetAdmissionTicket.make({
            ...fixture,
            schemaVersion: "yeet-admission-ticket/v1",
            kind: "full-proof",
            priority: "verify",
            checkoutRoot: checkoutTicket,
            branch: branchTicket,
            nonce: "synthetic-dead-ticket",
            attemptId: O.some(attemptTicket),
          });
          yield* fs.writeFileString(path.join(root, "leases", `${lease.nonce}.lease.json`), yield* encodeLease(lease));
          yield* fs.writeFileString(
            path.join(root, "queue", `${ticket.nonce}.ticket.json`),
            yield* encodeTicket(ticket)
          );
          const reap = withPrependedPath(binDirectory, reapAdmissionState({ apply: true })).pipe(
            Effect.provideService(
              AdmissionEvictionJournal,
              AdmissionEvictionJournal.of({ appendOnce: appendAdmissionEvictionJournalEvent })
            )
          );
          yield* reap;
          expect(yield* listDirectory(path.join(root, "claims"))).toStrictEqual([]);
          expect(yield* listDirectory(path.join(root, "queue"))).toStrictEqual([]);
          expect(yield* listDirectory(path.join(root, "leases"))).toHaveLength(1);
          const leaseAttempts = yield* readAttemptJournalEvents(checkoutLease, branchLease);
          const ticketAttempts = yield* readAttemptJournalEvents(checkoutTicket, branchTicket);
          expect(leaseAttempts).toMatchObject([
            { _tag: "attempt-terminated", attemptId: attemptLease, reason: "lease-eviction" },
          ]);
          expect(ticketAttempts).toMatchObject([
            { _tag: "attempt-terminated", attemptId: attemptTicket, reason: "queued-submitter-death" },
          ]);
          expect(leaseAttempts).toHaveLength(1);
          expect(ticketAttempts).toHaveLength(1);
          yield* Deferred.succeed(finishA, undefined);
          yield* Fiber.join(holder);

          const events = yield* readJournalEvents(root);
          expect(events).toHaveLength(7);
          expect(
            R.map(expectedTags, (_count, tag) => A.countBy(events, AdmissionJournalEvent.guards[tag]))
          ).toStrictEqual(expectedTags);
          expectV3ExceptAdmitted(events);
          const enqueues = A.filter(events, AdmissionJournalEvent.guards["admission-enqueued"]);
          const enqueuedA = O.getOrThrow(A.findFirst(enqueues, (event) => event.checkoutRoot === checkoutA));
          const enqueuedB = O.getOrThrow(A.findFirst(enqueues, (event) => event.checkoutRoot === checkoutB));
          expect(enqueuedA).toMatchObject({ branch: branchA, attemptId: O.some(attemptA), weightTokens: 3 });
          expect(enqueuedB).toMatchObject({ branch: branchB, attemptId: O.some(attemptB), weightTokens: 3 });
          const withdrawn = O.getOrThrow(A.findFirst(events, AdmissionJournalEvent.guards["admission-withdrawn"]));
          expect(withdrawn).toMatchObject(Struct.omit(enqueuedB, ["_tag", "weightTokens"]));
          expect(withdrawn.withdrawnAtMillis).toBeGreaterThanOrEqual(enqueuedB.enqueuedAtMillis);
          const wire = yield* Effect.forEach(
            journalLines(yield* fs.readFileString(yield* admissionJournalPath(root))),
            (line) => decodeJsonObject(line)
          );
          const withdrawnWire = O.getOrThrow(A.findFirst(wire, (row) => row._tag === "admission-withdrawn"));
          expect(withdrawnWire).not.toHaveProperty("weightTokens");
          expect(withdrawnWire).not.toHaveProperty("reason");
          expect(
            O.getOrThrow(A.findFirst(events, AdmissionJournalEvent.guards["admission-lease-evicted"]))
          ).toMatchObject({
            checkoutRoot: checkoutLease,
            branch: branchLease,
            lastHeartbeatAtMillis: fixtureInstant,
            reason: "owner-dead-or-reused",
            attemptId: O.some(attemptLease),
          });
          expect(
            O.getOrThrow(A.findFirst(events, AdmissionJournalEvent.guards["admission-ticket-evicted"]))
          ).toMatchObject({
            checkoutRoot: checkoutTicket,
            branch: branchTicket,
            reason: "queued-submitter-death",
            attemptId: O.some(attemptTicket),
          });
          expect(O.getOrThrow(A.findFirst(events, AdmissionJournalEvent.guards["admission-released"]))).toMatchObject({
            checkoutRoot: checkoutA,
            branch: branchA,
            attemptId: O.some(attemptA),
          });
          const chains = [
            {
              label: "contender-a",
              nonce: enqueuedA.nonce,
              tags: ["admission-enqueued", "admission-admitted", "admission-released"],
            },
            { label: "contender-b", nonce: enqueuedB.nonce, tags: ["admission-enqueued", "admission-withdrawn"] },
            { label: "dead-lease", nonce: lease.nonce, tags: ["admission-lease-evicted"] },
            { label: "dead-ticket", nonce: ticket.nonce, tags: ["admission-ticket-evicted"] },
          ];
          for (const chain of chains) {
            expect(
              A.map(
                A.filter(events, (event) => event.nonce === chain.nonce),
                eventTag
              )
            ).toStrictEqual(chain.tags);
          }
          yield* reap;
          expect(yield* readJournalEvents(root)).toStrictEqual(events);
          expect(yield* readAttemptJournalEvents(checkoutLease, branchLease)).toStrictEqual(leaseAttempts);
          expect(yield* readAttemptJournalEvents(checkoutTicket, branchTicket)).toStrictEqual(ticketAttempts);
          for (const directory of ["leases", "queue", "claims", "quarantine", "promotions"]) {
            expect(yield* listDirectory(path.join(root, directory))).toStrictEqual([]);
          }
          expect(A.filter(yield* fs.readDirectory(runtimeDir, { recursive: true }), isLockPath)).toStrictEqual([]);

          yield* expectExportCheck(runtimeDir, root, chains);

          if (O.isSome(exportTarget)) {
            yield* exportScenario(runtimeDir, exportTarget.value, chains);
          }
        })
      )
    ));
  it("property: dead-owner lease and ticket fixtures round-trip through the JSON codecs the scenario writes", () => {
    fc.assert(
      fc.property(S.toArbitrary(YeetAdmissionLease)(fc), (lease) => {
        const encoded = encodeLeaseSync(lease);
        const decoded = decodeLeaseSync(encoded);
        expect(decoded.nonce).toBe(lease.nonce);
        expect(decoded.checkoutRoot).toBe(lease.checkoutRoot);
        // JSON drops the sign of -0, so the codec law is encode-stability rather than deep identity.
        expect(encodeLeaseSync(decoded)).toBe(encoded);
      }),
      fcRuns(32)
    );
    fc.assert(
      fc.property(S.toArbitrary(YeetAdmissionTicket)(fc), (ticket) => {
        const encoded = encodeTicketSync(ticket);
        const decoded = decodeTicketSync(encoded);
        expect(decoded.nonce).toBe(ticket.nonce);
        expect(decoded.checkoutRoot).toBe(ticket.checkoutRoot);
        expect(encodeTicketSync(decoded)).toBe(encoded);
      }),
      fcRuns(32)
    );
  });
});
