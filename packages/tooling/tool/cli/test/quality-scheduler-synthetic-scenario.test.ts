import * as NodeURL from "node:url";
import {
  AdmissionConfig,
  AdmissionEvictionJournal,
  AdmissionJournalEvent,
  AdmissionJournalLeaseEvictedV3,
  AdmissionJournalReleasedV3,
  AdmissionJournalTicketEvictedV3,
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
import { UUID } from "@beep/repo-cli/test/SharedInternals";
import { decodeYeetAttemptJournalEvent } from "@beep/repo-cli/test/Yeet";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { assertDefined, assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Digest from "effect/crypto/Digest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";
import * as TestClock from "effect/testing/TestClock";

// Ruling 10's synthetic producer: admission rows come from the real scheduler.
const producerPath = "packages/tooling/tool/cli/test/quality-scheduler-synthetic-scenario.test.ts";
const isAdmissionJournalLeaseEvictedV3 = S.is(AdmissionJournalLeaseEvictedV3);
const isAdmissionJournalTicketEvictedV3 = S.is(AdmissionJournalTicketEvictedV3);
const isAdmissionJournalReleasedV3 = S.is(AdmissionJournalReleasedV3);
const decodeUUID = S.decodeEffect(UUID);
const encodeLease = S.encodeEffect(S.fromJsonString(YeetAdmissionLease));
const encodeTicket = S.encodeEffect(S.fromJsonString(YeetAdmissionTicket));
const encodeLeaseEffect = S.encodeEffect(S.fromJsonString(YeetAdmissionLease));
const decodeLeaseEffect = S.decodeUnknownEffect(S.fromJsonString(YeetAdmissionLease));
const encodeTicketEffect = S.encodeEffect(S.fromJsonString(YeetAdmissionTicket));
const decodeTicketEffect = S.decodeUnknownEffect(S.fromJsonString(YeetAdmissionTicket));
const decodeJsonObject = S.decodeUnknownEffect(S.fromJsonString(S.JsonObject));
const encodeScenario = S.encodeUnknownEffect(S.fromJsonString(S.JsonObject, { space: 2 }));
const sha256Hex = Effect.fnUntraced(function* (bytes: Uint8Array) {
  const crypto = yield* Digest.Digest;
  const digest1 = yield* crypto.digest(Digest.sha256, bytes);
  return Hex.encode(digest1);
});
const randomAttemptId = Effect.fnUntraced(function* () {
  const crypto = yield* SecureRandom.SecureRandom;
  const uuidV42 = yield* crypto.uuidV4();
  return yield* decodeUUID(uuidV42);
});
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
  const readDirectory3 = yield* fs.readDirectory(directory);
  return A.filter(readDirectory3, (name) => !isStagingPath(name));
});

const readJournalEvents = Effect.fnUntraced(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const admissionJournalPath28 = yield* admissionJournalPath(root);
  const readFileString4 = yield* fs.readFileString(admissionJournalPath28);
  return yield* Effect.forEach(journalLines(readFileString4), (line) => decodeAdmissionJournalEvent(line));
});

const readAttemptJournalEvents = Effect.fnUntraced(function* (checkoutRoot: string, branch: string) {
  const fs = yield* FileSystem.FileSystem;
  const attemptJournalPathForCheckout29 = yield* attemptJournalPathForCheckout(checkoutRoot, branch);
  const readFileString5 = yield* fs.readFileString(attemptJournalPathForCheckout29);
  return yield* Effect.forEach(journalLines(readFileString5), (line) => decodeYeetAttemptJournalEvent(line));
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
  if ((yield* fs.exists(target)) && (yield* Effect.map(fs.readDirectory(target), A.isArrayNonEmpty))) {
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
  const source = yield* fs.readFile(NodeURL.fileURLToPath(import.meta.url));
  const argument = { path: producerPath, sha256: yield* sha256Hex(source) };
  const now1 = yield* DateTime.now;
  const scenario = yield* encodeScenario({
    producer: argument,
    steps,
    capturedAt: DateTime.formatIso(now1),
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
  const readFileString6 = yield* fs.readFileString(path.join(exportCheck, "READY"));
  expect(readFileString6).toBe("");
  const readFileString7 = yield* fs.readFileString(path.join(exportCheck, "admission", "journal.ndjson"));
  const expectation = expect(readFileString7);
  const admissionJournalPath6 = yield* admissionJournalPath(root);
  const readFileString2 = yield* fs.readFileString(admissionJournalPath6);
  expectation.toBe(readFileString2);
  const manifest = yield* fs.readFileString(path.join(exportCheck, "scenario.json"));
  const decodedJsonObject = yield* decodeJsonObject(manifest);
  const expectation1 = expect(decodedJsonObject);
  const readFile3 = yield* fs.readFile(NodeURL.fileURLToPath(import.meta.url));
  expectation1.toMatchObject({
    producer: {
      path: producerPath,
      sha256: yield* sha256Hex(readFile3),
    },
    steps,
    expected: { tags: expectedTags, chains },
  });
  for (const label of ["contender-a", "dead-lease", "dead-ticket"]) {
    const relative = path.join("checkouts", label, ".beep", "yeet", "runs");
    const readDirectory8 = yield* fs.readDirectory(path.join(exportCheck, relative), { recursive: true });
    const expectation2 = expect(A.sort(readDirectory8, Str.Order));
    const readDirectory4 = yield* fs.readDirectory(path.join(runtimeDir, relative), { recursive: true });
    expectation2.toStrictEqual(A.sort(readDirectory4, Str.Order));
  }
  for (const directory of ["leases", "queue", "claims", "quarantine"]) {
    const readDirectory9 = yield* fs.readDirectory(path.join(exportCheck, "admission", directory));
    expect(readDirectory9).toStrictEqual([]);
  }
  const refusal = yield* exportScenario(runtimeDir, exportCheck, chains).pipe(Effect.flip);
  expect(refusal.message).toContain("refusing to overwrite a non-empty export target");
  const readFileString10 = yield* fs.readFileString(path.join(exportCheck, "scenario.json"));
  expect(readFileString10).toBe(manifest);
  const readDirectory11 = yield* fs.readDirectory(exportCheck, { recursive: true });
  expect(A.filter(readDirectory11, isLockPath)).toStrictEqual([]);
});

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { concurrent: false, timeout: "30 seconds" })(
  "synthetic admission scenario",
  (it) => {
    it.effect("journals contention, withdrawal, fixture evictions, and release with an optional synthetic export", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const runtimeDir = yield* fs.makeTempDirectoryScoped();
        const option12 = yield* Config.option(Config.String("BEEP_CIOPS_SYNTHETIC_ROOT"));
        const exportTarget = O.filter(option12, Str.isNonEmpty);
        return yield* Effect.gen(function* () {
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
          const attemptA = yield* randomAttemptId();
          const attemptB = yield* randomAttemptId();
          const attemptLease = yield* randomAttemptId();
          const attemptTicket = yield* randomAttemptId();
          // Admission alone does not write normal attempt rows. Keep A's empty run directory as a receipt.
          for (const checkout of [checkoutA, checkoutB, checkoutLease, checkoutTicket]) {
            yield* fs.makeDirectory(path.join(checkout, ".beep", "yeet", "runs"), { recursive: true });
          }
          const setAdmissionEvictionProtocol13 = yield* setAdmissionEvictionProtocol("on");
          expect(setAdmissionEvictionProtocol13).toMatchObject({
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
          const listDirectory14 = yield* listDirectory(path.join(root, "leases"));
          expect(listDirectory14).toHaveLength(1);
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
          const listDirectory15 = yield* listDirectory(path.join(root, "queue"));
          expect(listDirectory15).toHaveLength(1);
          yield* Fiber.interrupt(waiter);
          const got = yield* Ref.get(ranB);
          expect(got).toBe(false);
          const listDirectory16 = yield* listDirectory(path.join(root, "queue"));
          expect(listDirectory16).toStrictEqual([]);

          const binDirectory = path.join(runtimeDir, "bin");
          yield* fs.makeDirectory(binDirectory);
          const systemctl = path.join(binDirectory, "systemctl");
          yield* fs.writeFileString(systemctl, "#!/bin/sh\nexit 0\n");
          yield* fs.chmod(systemctl, 0o755);
          // A same-source start mismatch is definitive dead/reused-owner evidence, without a host PID literal.
          const processStartIdentityForPid17 = yield* processStartIdentityForPid(process.pid);
          const liveStart = O.getOrThrow(processStartIdentityForPid17);
          const owner = { pid: process.pid, procStart: `${liveStart}-synthetic-dead-owner` };
          const processIdentityStatus18 = yield* processIdentityStatus(owner);
          expect(processIdentityStatus18).toBe("dead");
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
            startedAt: yield* Effect.map(DateTime.now, DateTime.formatIso),
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
          const argument1 = path.join(root, "leases", `${lease.nonce}.lease.json`);
          const encodedLease5 = yield* encodeLease(lease);
          yield* fs.writeFileString(argument1, encodedLease5);
          const argument2 = path.join(root, "queue", `${ticket.nonce}.ticket.json`);
          const encodedTicket = yield* encodeTicket(ticket);
          yield* fs.writeFileString(argument2, encodedTicket);
          const reap = withPrependedPath(binDirectory, reapAdmissionState({ apply: true })).pipe(
            Effect.provideService(
              AdmissionEvictionJournal,
              AdmissionEvictionJournal.of({ appendOnce: appendAdmissionEvictionJournalEvent })
            )
          );
          yield* reap;
          const listDirectory19 = yield* listDirectory(path.join(root, "claims"));
          expect(listDirectory19).toStrictEqual([]);
          const listDirectory20 = yield* listDirectory(path.join(root, "queue"));
          expect(listDirectory20).toStrictEqual([]);
          const listDirectory21 = yield* listDirectory(path.join(root, "leases"));
          expect(listDirectory21).toHaveLength(1);
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
          {
            const actualProjection = enqueuedA;
            const expectedProjection = { branch: branchA, attemptId: O.some(attemptA), weightTokens: 3 };
            assertDefined(actualProjection);
            deepStrictEqual<typeof expectedProjection>(
              Struct.pick(actualProjection, ["branch", "attemptId", "weightTokens"]),
              expectedProjection
            );
          }
          {
            const actualProjection = enqueuedB;
            const expectedProjection = { branch: branchB, attemptId: O.some(attemptB), weightTokens: 3 };
            assertDefined(actualProjection);
            deepStrictEqual<typeof expectedProjection>(
              Struct.pick(actualProjection, ["branch", "attemptId", "weightTokens"]),
              expectedProjection
            );
          }
          const withdrawn = O.getOrThrow(A.findFirst(events, AdmissionJournalEvent.guards["admission-withdrawn"]));
          expect(withdrawn).toMatchObject(Struct.omit(enqueuedB, ["_tag", "weightTokens"]));
          expect(withdrawn.withdrawnAtMillis).toBeGreaterThanOrEqual(enqueuedB.enqueuedAtMillis);
          const admissionJournalPath30 = yield* admissionJournalPath(root);
          const readFileString22 = yield* fs.readFileString(admissionJournalPath30);
          const wire = yield* Effect.forEach(journalLines(readFileString22), (line) => decodeJsonObject(line));
          const withdrawnWire = O.getOrThrow(A.findFirst(wire, (row) => row._tag === "admission-withdrawn"));
          expect(withdrawnWire).not.toHaveProperty("weightTokens");
          expect(withdrawnWire).not.toHaveProperty("reason");
          {
            const actualProjection = O.getOrThrow(
              A.findFirst(events, AdmissionJournalEvent.guards["admission-lease-evicted"])
            );
            const expectedProjection = {
              checkoutRoot: checkoutLease,
              branch: branchLease,
              lastHeartbeatAtMillis: fixtureInstant,
              reason: "owner-dead-or-reused",
              attemptId: O.some(attemptLease),
            };
            assertDefined(actualProjection);
            const expectedVariant = isAdmissionJournalLeaseEvictedV3(actualProjection);
            assertTrue(expectedVariant);
            deepStrictEqual<typeof expectedProjection>(
              Struct.pick(actualProjection, ["checkoutRoot", "branch", "lastHeartbeatAtMillis", "reason", "attemptId"]),
              expectedProjection
            );
          }
          {
            const actualProjection = O.getOrThrow(
              A.findFirst(events, AdmissionJournalEvent.guards["admission-ticket-evicted"])
            );
            const expectedProjection = {
              checkoutRoot: checkoutTicket,
              branch: branchTicket,
              reason: "queued-submitter-death",
              attemptId: O.some(attemptTicket),
            };
            assertDefined(actualProjection);
            const expectedVariant = isAdmissionJournalTicketEvictedV3(actualProjection);
            assertTrue(expectedVariant);
            deepStrictEqual<typeof expectedProjection>(
              Struct.pick(actualProjection, ["checkoutRoot", "branch", "reason", "attemptId"]),
              expectedProjection
            );
          }
          {
            const actualProjection = O.getOrThrow(
              A.findFirst(events, AdmissionJournalEvent.guards["admission-released"])
            );
            const expectedProjection = {
              checkoutRoot: checkoutA,
              branch: branchA,
              attemptId: O.some(attemptA),
            };
            assertDefined(actualProjection);
            const expectedVariant = isAdmissionJournalReleasedV3(actualProjection);
            assertTrue(expectedVariant);
            deepStrictEqual<typeof expectedProjection>(
              Struct.pick(actualProjection, ["checkoutRoot", "branch", "attemptId"]),
              expectedProjection
            );
          }
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
          const readJournalEvents23 = yield* readJournalEvents(root);
          expect(readJournalEvents23).toStrictEqual(events);
          const readAttemptJournalEvents24 = yield* readAttemptJournalEvents(checkoutLease, branchLease);
          expect(readAttemptJournalEvents24).toStrictEqual(leaseAttempts);
          const readAttemptJournalEvents25 = yield* readAttemptJournalEvents(checkoutTicket, branchTicket);
          expect(readAttemptJournalEvents25).toStrictEqual(ticketAttempts);
          for (const directory of ["leases", "queue", "claims", "quarantine", "promotions"]) {
            const listDirectory26 = yield* listDirectory(path.join(root, directory));
            expect(listDirectory26).toStrictEqual([]);
          }
          const readDirectory27 = yield* fs.readDirectory(runtimeDir, { recursive: true });
          expect(A.filter(readDirectory27, isLockPath)).toStrictEqual([]);

          yield* expectExportCheck(runtimeDir, root, chains);

          if (O.isSome(exportTarget)) {
            yield* exportScenario(runtimeDir, exportTarget.value, chains);
          }
        }).pipe(
          provideRuntimeRootForTesting(RuntimeRootChoice.make({ kind: "test-override", root: runtimeDir })),
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ BEEP_RUN_SCOPES: "0" })),
          Effect.provideService(
            MemoryStats,
            MemoryStats.of({ availableGib: Effect.succeed(25), totalGib: Effect.succeed(128) })
          )
        );
      }).pipe(TestClock.withLive)
    );
    it.effect.prop(
      "property: dead-owner lease and ticket fixtures round-trip through the JSON codecs the scenario writes",
      [Arbitrary.schema(YeetAdmissionLease), Arbitrary.schema(YeetAdmissionTicket)],
      Effect.fnUntraced(function* ([lease, ticket]) {
        const encodedLease = yield* encodeLeaseEffect(lease);
        const decodedLease = yield* decodeLeaseEffect(encodedLease);
        expect(decodedLease.nonce).toBe(lease.nonce);
        expect(decodedLease.checkoutRoot).toBe(lease.checkoutRoot);
        const encodedLeaseEffect = yield* encodeLeaseEffect(decodedLease);
        expect(encodedLeaseEffect).toBe(encodedLease);

        const encoded = yield* encodeTicketEffect(ticket);
        const decoded = yield* decodeTicketEffect(encoded);
        expect(decoded.nonce).toBe(ticket.nonce);
        expect(decoded.checkoutRoot).toBe(ticket.checkoutRoot);
        const encodedTicketEffect = yield* encodeTicketEffect(decoded);
        expect(encodedTicketEffect).toBe(encoded);
      }),
      { arbitrary: fcRuns(32) }
    );
  }
);
