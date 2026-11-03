import {
  compileGraduationPlan,
  exploreCommand,
  GraduationPendingEvents,
  GraduationReceipt,
  GraduationRequest,
  GraduationResumeReceipt,
  parseGraduationGoal,
  readExplorationSnapshot,
  resumeGraduationEvents,
  runExploreCheck,
  writeGraduationPlan,
} from "@beep/repo-cli/test/Explore";
import {
  foldPacketEvents,
  PacketEvent,
  PacketEventStore,
  PacketEventStoreLive,
  PacketStreamError,
  PacketStreamLocator,
} from "@beep/repo-cli/test/Goals";
import { it } from "@beep/test-runner";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertTrue, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { identity } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import {
  expectReportedExit,
  readProjectFile,
  temporaryWorkingDirectory,
  writeProjectFile,
} from "./support/CommandTest.ts";

const EXPLORATION = "graduation-fixture";
const PROVENANCE = `explorations/${EXPLORATION}`;
const MANIFEST_PATH = `${PROVENANCE}/ops/manifest.json`;
const TODAY = "2026-10-14";
const AT = "2026-10-14T12:00:00.000Z";

const decodeReceiptJson = S.decodeUnknownEffect(S.fromJsonString(GraduationReceipt));
const decodeResumeReceiptJson = S.decodeUnknownEffect(S.fromJsonString(GraduationResumeReceipt));
const PendingEventsJson = S.fromJsonString(GraduationPendingEvents);
const decodePendingEventsJson = S.decodeUnknownEffect(PendingEventsJson);
const encodePendingEventsJson = S.encodeEffect(PendingEventsJson);
const PENDING_PATH = `${PROVENANCE}/ops/.graduation-pending.json`;
const decodeManifestJson = S.decodeUnknownEffect(
  S.fromJsonString(
    S.Struct({
      extension: S.String,
      exploration: S.Struct({
        status: S.String,
        stage: S.String,
        updated: S.String,
        links: S.Struct({ goals: S.Array(S.String) }),
      }),
    })
  )
);
const runExploreCommand = Command.runWith(exploreCommand, { version: "0.0.0" });
const layer = Layer.provideMerge(PacketEventStoreLive, Layer.mergeAll(NodeServices.layer, NodeCrypto.layer));

const manifestText = `${Result.getOrThrowWith(
  S.encodeUnknownResult(S.fromJsonString(S.Unknown, { space: 2 }))({
    schemaVersion: "exploration-manifest/v1",
    extension: "kept",
    exploration: {
      slug: EXPLORATION,
      title: "Graduation Fixture",
      status: "active",
      stage: "decompose",
      openQuestions: [],
      links: { goals: ["goals/earlier-child"], docs: [], supersededBy: null },
      created: "2026-10-01",
      updated: "2026-10-01",
    },
  }),
  identity
)}\n`;

const seedFixture = Effect.gen(function* () {
  yield* writeProjectFile(MANIFEST_PATH, manifestText);
  yield* writeProjectFile("goals/.keep", "");
});

const lastLogLine = Effect.gen(function* () {
  const logLines1 = yield* TestConsole.logLines;
  return O.getOrElse(A.last(A.filter(logLines1, P.isString)), () => "");
});

const planFor = Effect.fn(function* (goals: ReadonlyArray<string>) {
  const children = yield* Effect.forEach(goals, parseGraduationGoal);
  const snapshot = yield* readExplorationSnapshot(EXPLORATION);
  return yield* compileGraduationPlan(snapshot, GraduationRequest.make({ children, today: TODAY }));
});

const graduateArgs = (goals: ReadonlyArray<string>, mode: ReadonlyArray<string>) => [
  "graduate",
  EXPLORATION,
  ...A.flatMap(goals, (goal) => ["--goal", goal]),
  "--today",
  TODAY,
  ...mode,
];

const exists = Effect.fn(function* (relativePath: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.exists(relativePath);
});

const locator = PacketStreamLocator.make({ packet: EXPLORATION, root: "explorations", packetPath: PROVENANCE });

// Stands in for a crash between the manifest flip and the first append: the
// live store, except that every append fails.
const crashingAppendStore = Effect.gen(function* () {
  const live = yield* PacketEventStore;
  return PacketEventStore.of({
    ...live,
    append: Effect.fn("CrashingPacketEventStore.append")(function* (target: PacketStreamLocator) {
      return yield* PacketStreamError.new(target.packet, "injected crash before the append");
    }),
  });
});

const streamBodies = Effect.gen(function* () {
  const store = yield* PacketEventStore;
  return A.map((yield* store.list(locator)).events, (stored) => stored.event.body);
});

// Moves the manifest's pre-image while the first child is being published:
// the live filesystem, except that renaming onto goals/first-child also
// rewrites the exploration manifest.
const manifestMovingFileSystem = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  return FileSystem.FileSystem.of({
    ...fs,
    rename: Effect.fn("ManifestMovingFileSystem.rename")(function* (from: string, to: string) {
      yield* fs.rename(from, to);
      if (Str.endsWith("goals/first-child")(to)) {
        yield* fs.writeFileString(MANIFEST_PATH, `${manifestText}\n`);
      }
    }),
  });
});

const crashAfterManifestFlip = Effect.gen(function* () {
  yield* seedFixture;
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory(`${PROVENANCE}/ops/events`, { recursive: true });
  const plan = yield* planFor(["first-child=First Child"]);
  const crashed = yield* Effect.exit(
    writeGraduationPlan(plan, O.some(plan.planId), AT).pipe(
      Effect.provideServiceEffect(PacketEventStore, crashingAppendStore)
    )
  );
  crashed.pipe(Exit.isFailure, assertTrue);
  return plan;
});

it.layer(layer, { concurrent: false, timeout: "60 seconds" })((it) => {
  describe("explore graduate --write", { concurrent: false }, () => {
    it.effect(
      "publishes the child, then flips the manifest, and prints the receipt",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            yield* seedFixture;
            const goals = ["first-child=First Child"];
            const plan = yield* planFor(goals);

            const unexpected = yield* Effect.exit(runExploreCommand(graduateArgs(goals, ["--write"])));
            expectReportedExit(unexpected);
            const wrong = yield* Effect.exit(
              runExploreCommand(
                graduateArgs(goals, ["--write", "--expect", `graduation-plan/v1:${Str.repeat(64)("0")}`])
              )
            );
            expectReportedExit(wrong);
            const exists2 = yield* exists("goals/first-child");
            strictEqual(exists2, false);

            const written = yield* Effect.exit(
              runExploreCommand(graduateArgs(goals, ["--write", "--expect", plan.planId]))
            );
            written.pipe(Exit.isSuccess, assertTrue);
            const lastLogLine3 = yield* lastLogLine;
            const receipt = yield* decodeReceiptJson(lastLogLine3);
            strictEqual(receipt.planId, plan.planId);
            expect(A.map(receipt.children, (row) => [row.slug, row.outcome])).toEqual([["first-child", "published"]]);
            strictEqual(receipt.manifestBeforeDigest, plan.explorationEdit?.preImageDigest);
            strictEqual(receipt.eventsAppended, 0);

            const readProjectFile4 = yield* readProjectFile("goals/first-child/ops/manifest.json");
            expect(readProjectFile4).toContain(PROVENANCE);
            const readProjectFile5 = yield* readProjectFile(MANIFEST_PATH);
            const manifest = yield* decodeManifestJson(readProjectFile5);
            expect(manifest).toMatchObject({
              extension: "kept",
              exploration: {
                status: "graduated",
                stage: "graduate",
                updated: TODAY,
                links: { goals: ["goals/earlier-child", "goals/first-child"] },
              },
            });
            const exists6 = yield* exists(`${PROVENANCE}/ops/events`);
            strictEqual(exists6, false);
            const fs = yield* FileSystem.FileSystem;
            const readDirectory7 = yield* fs.readDirectory(`${PROVENANCE}/ops`);
            expect(A.filter(readDirectory7, Str.includes(".staging-"))).toEqual([]);

            const again = yield* Effect.exit(
              runExploreCommand(graduateArgs(goals, ["--write", "--expect", plan.planId]))
            );
            expectReportedExit(again);
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      30_000
    );

    it.effect(
      "resumes after a crash between children and keeps a foreign same-slug packet a hard conflict",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            yield* seedFixture;
            const goals = ["first-child=First Child", "second-child=Second Child"];
            const plan = yield* planFor(goals);

            // A packet that appears after review blocks the second publish, so the
            // write fails after the first child landed: the crash state E15 covers.
            yield* writeProjectFile("goals/second-child/stray.txt", "blocker\n");
            const crashed = yield* Effect.exit(writeGraduationPlan(plan, O.some(plan.planId), AT));
            crashed.pipe(Exit.isFailure, assertTrue);
            const exists8 = yield* exists("goals/first-child/ops/manifest.json");
            strictEqual(exists8, true);
            const readProjectFile9 = yield* readProjectFile(MANIFEST_PATH);
            strictEqual(readProjectFile9, manifestText);

            // The blocker is a foreign packet (no provenance): the replay refuses.
            const foreign = yield* planFor(goals);
            expect(A.map(foreign.conflicts, (conflict) => [conflict.reason, conflict.child])).toEqual([
              ["foreign-slug", "second-child"],
            ]);
            const refused = yield* Effect.exit(writeGraduationPlan(foreign, O.some(foreign.planId), AT));
            refused.pipe(Exit.isFailure, assertTrue);
            const readProjectFile10 = yield* readProjectFile(MANIFEST_PATH);
            strictEqual(readProjectFile10, manifestText);

            const fs = yield* FileSystem.FileSystem;
            yield* fs.remove("goals/second-child", { recursive: true });
            const resumed = yield* planFor(goals);
            expect(A.map(resumed.alreadyPublished, (child) => child.slug)).toEqual(["first-child"]);
            expect(A.map(resumed.children, (child) => child.slug)).toEqual(["second-child"]);

            const written = yield* Effect.exit(
              runExploreCommand(graduateArgs(goals, ["--write", "--expect", resumed.planId]))
            );
            written.pipe(Exit.isSuccess, assertTrue);
            const lastLogLine11 = yield* lastLogLine;
            const receipt = yield* decodeReceiptJson(lastLogLine11);
            expect(A.map(receipt.children, (row) => [row.slug, row.outcome])).toEqual([
              ["first-child", "already-published"],
              ["second-child", "published"],
            ]);
            const readProjectFile12 = yield* readProjectFile(MANIFEST_PATH);
            const manifest = yield* decodeManifestJson(readProjectFile12);
            expect(manifest.exploration.links.goals).toEqual([
              "goals/earlier-child",
              "goals/first-child",
              "goals/second-child",
            ]);
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      30_000
    );

    it.effect(
      "appends stage-entered and status-set to an opted-in exploration stream",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            yield* seedFixture;
            const fs = yield* FileSystem.FileSystem;
            yield* fs.makeDirectory(`${PROVENANCE}/ops/events`, { recursive: true });
            const store = yield* PacketEventStore;
            yield* store.append(
              locator,
              PacketEvent.make({
                schemaVersion: "packet-event/v1",
                packet: EXPLORATION,
                root: "explorations",
                seq: 1,
                expectedRevision: 0,
                at: "2026-10-01T00:00:00.000Z",
                actor: "fixture",
                body: { type: "packet-created", status: "active", stage: "decompose", ordinal: 5 },
              })
            );

            const plan = yield* planFor(["first-child=First Child"]);
            const receipt = yield* writeGraduationPlan(plan, O.some(plan.planId), AT);
            strictEqual(receipt.eventsAppended, 2);

            const listing = yield* store.list(locator);
            expect(A.map(listing.events, (stored) => stored.event.body.type)).toEqual([
              "packet-created",
              "stage-entered",
              "status-set",
            ]);
            const derived = foldPacketEvents({ packet: EXPLORATION, root: "explorations", events: listing.events });
            strictEqual(derived.status, "graduated");
            strictEqual(derived.resumeStage, "graduate");
            strictEqual(derived.furthestOrdinal, 6);
            const exists13 = yield* exists(PENDING_PATH);
            strictEqual(exists13, false);
            const readProjectFile14 = yield* readProjectFile(`${PROVENANCE}/ops/trace.json`);
            expect(readProjectFile14).toContain(
              O.getOrElse(
                O.map(O.fromUndefinedOr(derived.tip), (tip) => tip.id),
                () => "missing-tip"
              )
            );
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      30_000
    );
  });

  describe("explore graduate --resume-events", { concurrent: false }, () => {
    it.effect("refuses mixed resume modes and invalid exploration slugs", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          yield* seedFixture;
          for (const extra of [["--plan"], ["--write"], ["--goal", "first-child=First Child"]]) {
            const result = yield* Effect.exit(
              runExploreCommand(["graduate", EXPLORATION, "--resume-events", ...extra])
            );
            expectReportedExit(result);
          }
          const invalid = yield* Effect.exit(runExploreCommand(["graduate", "../outside", "--resume-events"]));
          expectReportedExit(invalid);
          const readProjectFile15 = yield* readProjectFile(MANIFEST_PATH);
          strictEqual(readProjectFile15, manifestText);
          const exists16 = yield* exists(PENDING_PATH);
          strictEqual(exists16, false);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("keeps a pending record for another exploration without appending", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          yield* crashAfterManifestFlip;
          const readProjectFile17 = yield* readProjectFile(PENDING_PATH);
          const pending = yield* decodePendingEventsJson(readProjectFile17);
          const { schemaVersion: _schemaVersion, ...input } = pending;
          const encodedPendingEventsJson = yield* encodePendingEventsJson(
            GraduationPendingEvents.make({ ...input, exploration: "another-exploration" })
          );
          yield* writeProjectFile(PENDING_PATH, encodedPendingEventsJson);
          const refused = yield* Effect.flip(resumeGraduationEvents(EXPLORATION));
          strictEqual(refused._tag, "GraduationRecoveryError");
          expect(refused.message).toContain('records exploration "another-exploration"');
          const streamBodies18 = yield* streamBodies;
          strictEqual(A.length(streamBodies18), 0);
          const exists19 = yield* exists(PENDING_PATH);
          strictEqual(exists19, true);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("keeps pending events when the stream or graduated manifest is missing", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          yield* crashAfterManifestFlip;
          const fs = yield* FileSystem.FileSystem;
          yield* fs.remove(`${PROVENANCE}/ops/events`, { recursive: true });
          const noStream = yield* Effect.flip(resumeGraduationEvents(EXPLORATION));
          expect(noStream.message).toContain("has no ops/events/ stream");
          yield* fs.makeDirectory(`${PROVENANCE}/ops/events`);
          yield* fs.remove(MANIFEST_PATH);
          const noManifest = yield* Effect.flip(resumeGraduationEvents(EXPLORATION));
          expect(noManifest.message).toContain("Failed to read");
          const streamBodies20 = yield* streamBodies;
          strictEqual(A.length(streamBodies20), 0);
          const exists21 = yield* exists(PENDING_PATH);
          strictEqual(exists21, true);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("refuses a stream that moved away from the recorded event suffix", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          yield* crashAfterManifestFlip;
          const store = yield* PacketEventStore;
          yield* store.append(
            locator,
            PacketEvent.make({
              schemaVersion: "packet-event/v1",
              packet: EXPLORATION,
              root: "explorations",
              seq: 1,
              expectedRevision: 0,
              at: AT,
              actor: "fixture",
              body: { type: "packet-created", status: "graduated", stage: "decompose", ordinal: 5 },
            })
          );
          const refused = yield* Effect.flip(resumeGraduationEvents(EXPLORATION));
          strictEqual(refused._tag, "GraduationRecoveryError");
          expect(refused.message).toContain("moved since the pending graduation events were recorded");
          const streamBodies22 = yield* streamBodies;
          strictEqual(A.length(streamBodies22), 1);
          const exists23 = yield* exists(PENDING_PATH);
          strictEqual(exists23, true);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect(
      "appends the pending events exactly once, with the pre-image genesis, after a crash past the manifest flip",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            yield* crashAfterManifestFlip;
            const readProjectFile24 = yield* readProjectFile(MANIFEST_PATH);
            const flipped = yield* decodeManifestJson(readProjectFile24);
            strictEqual(flipped.exploration.status, "graduated");
            const exists25 = yield* exists(PENDING_PATH);
            strictEqual(exists25, true);
            const streamBodies26 = yield* streamBodies;
            strictEqual(A.length(streamBodies26), 0);

            yield* runExploreCheck();
            const errorLines27 = yield* TestConsole.errorLines;
            expect(A.join(A.filter(errorLines27, P.isString), "\n")).toContain("[packet-graduation-pending]");

            const resumed = yield* Effect.exit(runExploreCommand(["graduate", EXPLORATION, "--resume-events"]));
            resumed.pipe(Exit.isSuccess, assertTrue);
            const lastLogLine28 = yield* lastLogLine;
            const receipt = yield* decodeResumeReceiptJson(lastLogLine28);
            strictEqual(receipt.eventsAppended, 3);
            const streamBodies29 = yield* streamBodies;
            expect(streamBodies29).toMatchObject([
              { type: "packet-created", status: "active", stage: "decompose", ordinal: 5 },
              { type: "stage-entered", stage: "graduate", ordinal: 6 },
              { type: "status-set", status: "graduated", previous: "active" },
            ]);
            const exists30 = yield* exists(PENDING_PATH);
            strictEqual(exists30, false);
            const exists31 = yield* exists(`${PROVENANCE}/ops/trace.json`);
            strictEqual(exists31, true);

            const again = yield* Effect.exit(runExploreCommand(["graduate", EXPLORATION, "--resume-events"]));
            expectReportedExit(again);
            const direct = yield* Effect.flip(resumeGraduationEvents(EXPLORATION));
            strictEqual(direct._tag, "GraduationRecoveryError");
            const streamBodies32 = yield* streamBodies;
            strictEqual(A.length(streamBodies32), 3);
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      30_000
    );

    it.effect(
      "refuses to resume against a manifest that changed after the flip",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            yield* crashAfterManifestFlip;
            yield* writeProjectFile(MANIFEST_PATH, `${yield* readProjectFile(MANIFEST_PATH)}\n`);
            const refused = yield* Effect.flip(resumeGraduationEvents(EXPLORATION));
            strictEqual(refused._tag, "GraduationRecoveryError");
            expect(refused.message).toContain("is not the graduated manifest recorded");
            const streamBodies33 = yield* streamBodies;
            strictEqual(A.length(streamBodies33), 0);
            const exists34 = yield* exists(PENDING_PATH);
            strictEqual(exists34, true);
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      30_000
    );
  });

  describe("explore graduate --write stream guards", { concurrent: false }, () => {
    it.effect("records an absent manifest and reports an unreadable manifest as an operational failure", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          yield* seedFixture;
          const fs = yield* FileSystem.FileSystem;
          yield* fs.remove(MANIFEST_PATH);
          const snapshot = yield* readExplorationSnapshot(EXPLORATION);
          strictEqual(snapshot.exists, true);
          strictEqual(snapshot.manifestText, undefined);
          strictEqual(snapshot.manifestDigest, undefined);
          yield* fs.makeDirectory(MANIFEST_PATH);
          const refused = yield* Effect.flip(readExplorationSnapshot(EXPLORATION));
          strictEqual(refused._tag, "GoalPlanOperationalError");
          expect(refused.message).toContain("Failed to read");
          const exists35 = yield* exists("goals/first-child");
          strictEqual(exists35, false);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("flips the manifest without duplicating an already complete stream", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          yield* seedFixture;
          const fs = yield* FileSystem.FileSystem;
          yield* fs.makeDirectory(`${PROVENANCE}/ops/events`, { recursive: true });
          const store = yield* PacketEventStore;
          yield* store.append(
            locator,
            PacketEvent.make({
              schemaVersion: "packet-event/v1",
              packet: EXPLORATION,
              root: "explorations",
              seq: 1,
              expectedRevision: 0,
              at: AT,
              actor: "fixture",
              body: { type: "packet-created", status: "graduated", stage: "graduate", ordinal: 6 },
            })
          );
          const plan = yield* planFor(["first-child=First Child"]);
          const receipt = yield* writeGraduationPlan(plan, O.some(plan.planId), AT);
          strictEqual(receipt.eventsAppended, 0);
          const streamBodies36 = yield* streamBodies;
          strictEqual(A.length(streamBodies36), 1);
          const exists37 = yield* exists(PENDING_PATH);
          strictEqual(exists37, false);
          const readProjectFile38 = yield* readProjectFile(MANIFEST_PATH);
          const manifest = yield* decodeManifestJson(readProjectFile38);
          strictEqual(manifest.exploration.status, "graduated");
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect(
      "refuses a corrupt stream before publishing any child",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            yield* seedFixture;
            yield* writeProjectFile(
              `${PROVENANCE}/ops/events/00001-packet-created-${Str.repeat(64)("0")}.json`,
              "{ not json"
            );
            const plan = yield* planFor(["first-child=First Child"]);
            const refused = yield* Effect.flip(writeGraduationPlan(plan, O.some(plan.planId), AT));
            expect(refused.message).toContain("failed before anything was written");
            const exists39 = yield* exists("goals/first-child");
            strictEqual(exists39, false);
            const exists40 = yield* exists(PENDING_PATH);
            strictEqual(exists40, false);
            const readProjectFile41 = yield* readProjectFile(MANIFEST_PATH);
            strictEqual(readProjectFile41, manifestText);
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      30_000
    );

    it.effect(
      "removes the pending sidecar when the flip fails because the pre-image moved",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            yield* seedFixture;
            const fs = yield* FileSystem.FileSystem;
            yield* fs.makeDirectory(`${PROVENANCE}/ops/events`, { recursive: true });
            const plan = yield* planFor(["first-child=First Child"]);
            const failed = yield* Effect.flip(
              writeGraduationPlan(plan, O.some(plan.planId), AT).pipe(
                Effect.provideServiceEffect(FileSystem.FileSystem, manifestMovingFileSystem)
              )
            );
            expect(failed.message).toContain("changed since the plan was reviewed");
            const exists42 = yield* exists("goals/first-child/ops/manifest.json");
            strictEqual(exists42, true);
            const readProjectFile43 = yield* readProjectFile(MANIFEST_PATH);
            strictEqual(readProjectFile43, `${manifestText}\n`);
            const exists44 = yield* exists(PENDING_PATH);
            strictEqual(exists44, false);
            const streamBodies45 = yield* streamBodies;
            strictEqual(A.length(streamBodies45), 0);
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      30_000
    );
  });
});
