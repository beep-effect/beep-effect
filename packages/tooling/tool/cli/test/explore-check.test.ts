import { exploreCommand, packetForkFindingKey } from "@beep/repo-cli/test/Explore";
import {
  foldPacketEvents,
  PacketEvent,
  PacketForkVerdict,
  packetEventDigest,
  packetEventFileName,
  projectPacketTrace,
  renderPacketEventFile,
  renderPacketTraceFile,
  StoredPacketEvent,
} from "@beep/repo-cli/test/Goals";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { Effect, Exit, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { Command } from "effect/unstable/cli";
import { describe, expect, it } from "vitest";
import { withTempWorkingDirectory, writeProjectFile } from "./support/CommandTest.ts";

const runExploreCommand = Command.runWith(exploreCommand, { version: "0.0.0" });

const testLayer = Layer.mergeAll(NodeServices.layer, TestConsole.layer);

const writeEvent = Effect.fnUntraced(function* (packetPath: string, event: PacketEvent) {
  const id = yield* packetEventDigest(event);
  const content = yield* renderPacketEventFile(event);
  yield* writeProjectFile(`${packetPath}/ops/events/${packetEventFileName(event, id)}`, content);
  return id;
});

const consoleText = Effect.fnUntraced(function* () {
  const logs = yield* TestConsole.logLines;
  const errors = yield* TestConsole.errorLines;
  return A.join(A.filter([...logs, ...errors], P.isString), "\n");
});

describe("explore --check", () => {
  it(
    "reports a clean repository with no streams",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeProjectFile("goals/plain/README.md", "# plain\n");
            const exit = yield* Effect.exit(runExploreCommand(["--check"]));
            expect(Exit.isSuccess(exit)).toBe(true);
            const output = yield* consoleText();
            expect(output).toContain("streams=0 findings=0");
            expect(output).toContain("OK: no stream findings");
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    30_000
  );

  it(
    "reports forks, missing traces, and stale traces as advisory findings without failing",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            // Exploration-root stream with a genesis fork and no trace file.
            const genesisA = PacketEvent.make({
              schemaVersion: "packet-event/v1",
              packet: "twin",
              root: "explorations",
              seq: 1,
              expectedRevision: 0,
              at: "2026-08-17T00:00:00.000Z",
              actor: "test",
              body: { type: "packet-created", status: "active" },
            });
            const genesisB = PacketEvent.make({ ...genesisA, at: "2026-08-17T00:00:01.000Z" });
            yield* writeEvent("explorations/twin", genesisA);
            yield* writeEvent("explorations/twin", genesisB);

            // Goals-root stream whose committed trace no longer matches the fold.
            const solo = PacketEvent.make({
              schemaVersion: "packet-event/v1",
              packet: "solo",
              root: "goals",
              seq: 1,
              expectedRevision: 0,
              at: "2026-08-17T00:00:00.000Z",
              actor: "test",
              body: { type: "packet-created", status: "active", stage: "P0", ordinal: 0 },
            });
            const soloId = yield* writeEvent("goals/solo", solo);
            yield* writeProjectFile(
              "goals/solo/ops/trace.json",
              `{"schemaVersion":"packet-trace/v1","projectorVersion":2,"sourceTip":{"seq":9,"id":"${"c".repeat(64)}"},"timeline":[],"derived":{"packet":"solo","root":"goals","revision":9,"forks":[],"issues":[]}}\n`
            );

            // Third stream: healthy events with the byte-exact derived trace.
            const healthy = PacketEvent.make({
              schemaVersion: "packet-event/v1",
              packet: "sound",
              root: "goals",
              seq: 1,
              expectedRevision: 0,
              at: "2026-08-17T00:00:00.000Z",
              actor: "test",
              body: { type: "packet-created", status: "active", stage: "P0", ordinal: 0 },
            });
            const healthyId = yield* writeEvent("goals/sound", healthy);
            const healthyStored = [
              StoredPacketEvent.make({
                id: healthyId,
                fileName: packetEventFileName(healthy, healthyId),
                event: healthy,
              }),
            ];
            const healthyDerived = foldPacketEvents({
              packet: "sound",
              root: "goals",
              events: healthyStored,
            });
            yield* writeProjectFile(
              "goals/sound/ops/trace.json",
              yield* renderPacketTraceFile(projectPacketTrace(healthyDerived, healthyStored))
            );

            // Fourth stream: trace that is not JSON at all.
            const garbled = PacketEvent.make({ ...healthy, packet: "garbled" });
            yield* writeEvent("goals/garbled", garbled);
            yield* writeProjectFile("goals/garbled/ops/trace.json", "not json\n");

            const exit = yield* Effect.exit(runExploreCommand(["--check"]));
            expect(Exit.isSuccess(exit)).toBe(true);
            const output = yield* consoleText();
            expect(output).toContain("streams=4");
            expect(output).toContain("[packet-stream-fork]");
            expect(output).toContain("repair plan (read-only): keep ");
            expect(output).toContain("rebase 1 event(s), remove 1 file(s)");
            expect(output).toContain("[packet-trace-missing]");
            expect(output).toContain("[packet-trace-stale]");
            expect(output).toContain("does not parse as JSON");
            expect(output).not.toContain("- sound [");
            expect(O.isSome(O.fromNullishOr(soloId))).toBe(true);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    30_000
  );

  it(
    "attaches the repair-plan summary to exactly one of two same-parentSeq forks",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            // Two distinct orphan parents, each with two seq-2 children: two
            // fork verdicts share parentSeq 1, but only the planned fork may
            // carry the summary (identity is the parent digest, not the seq).
            for (const parentByte of ["a", "b"]) {
              for (const at of ["2026-08-17T00:00:00.000Z", "2026-08-17T00:00:01.000Z"]) {
                const event = PacketEvent.make({
                  schemaVersion: "packet-event/v1",
                  packet: "twinned",
                  root: "goals",
                  seq: 2,
                  parent: parentByte.repeat(64),
                  expectedRevision: 1,
                  at,
                  actor: "test",
                  body: { type: "status-set", status: "paused", previous: "active" },
                });
                yield* writeEvent("goals/twinned", event);
              }
            }
            const exit = yield* Effect.exit(runExploreCommand(["--check"]));
            expect(Exit.isSuccess(exit)).toBe(true);
            const output = yield* consoleText();
            const forkCount = A.length(Str.split(output, "[packet-stream-fork]")) - 1;
            const summaryCount = A.length(Str.split(output, "repair plan (read-only)")) - 1;
            expect(forkCount).toBe(2);
            expect(summaryCount).toBe(1);
            const parentA = "a".repeat(64);
            const parentB = "b".repeat(64);
            const forkA = PacketForkVerdict.make({ parent: parentA, parentSeq: 1, children: [] });
            const forkB = PacketForkVerdict.make({ parent: parentB, parentSeq: 1, children: [] });
            expect(packetForkFindingKey("twinned", forkA)).toBe(`twinned packet-stream-fork ${parentA}`);
            expect(packetForkFindingKey("twinned", forkB)).toBe(`twinned packet-stream-fork ${parentB}`);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    30_000
  );

  it(
    "reports root-specific manifest status drift for goals and explorations without blocking",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const goalEvent = PacketEvent.make({
              schemaVersion: "packet-event/v1",
              packet: "goal-drift",
              root: "goals",
              seq: 1,
              expectedRevision: 0,
              at: "2026-08-17T00:00:00.000Z",
              actor: "test",
              body: { type: "packet-created", status: "paused" },
            });
            yield* writeEvent("goals/goal-drift", goalEvent);
            yield* writeProjectFile(
              "goals/goal-drift/ops/manifest.json",
              '{"initiative":{"status":"active"},"exploration":{"status":"paused"}}\n'
            );

            const explorationEvent = PacketEvent.make({
              ...goalEvent,
              packet: "exploration-drift",
              root: "explorations",
            });
            yield* writeEvent("explorations/exploration-drift", explorationEvent);
            yield* writeProjectFile(
              "explorations/exploration-drift/ops/manifest.json",
              '{"initiative":{"status":"paused"},"exploration":{"status":"graduated"}}\n'
            );

            const alignedEvent = PacketEvent.make({ ...goalEvent, packet: "aligned" });
            yield* writeEvent("goals/aligned", alignedEvent);
            yield* writeProjectFile(
              "goals/aligned/ops/manifest.json",
              '{"initiative":{"status":"paused"},"exploration":{"status":"active"}}\n'
            );

            const exit = yield* Effect.exit(runExploreCommand(["--check"]));
            expect(Exit.isSuccess(exit)).toBe(true);
            const output = yield* consoleText();
            expect(A.length(Str.split(output, "[packet-status-drift]")) - 1).toBe(2);
            expect(output).toContain("goals/goal-drift/ops/manifest.json status active");
            expect(output).toContain("explorations/exploration-drift/ops/manifest.json status graduated");
            expect(output).not.toContain("- aligned [packet-status-drift]");
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    30_000
  );

  it(
    "flags a decodable trace whose content drifts from the folded stream",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const event = PacketEvent.make({
              schemaVersion: "packet-event/v1",
              packet: "drift",
              root: "goals",
              seq: 1,
              expectedRevision: 0,
              at: "2026-08-17T00:00:00.000Z",
              actor: "test",
              body: { type: "packet-created", status: "active", stage: "P0", ordinal: 0 },
            });
            const id = yield* writeEvent("goals/drift", event);
            const driftStored = [StoredPacketEvent.make({ id, fileName: packetEventFileName(event, id), event })];
            const derived = foldPacketEvents({
              packet: "drift",
              root: "goals",
              events: driftStored,
            });
            const traceText = yield* renderPacketTraceFile(projectPacketTrace(derived, driftStored));
            // sourceTip stays intact; the derived body is tampered.
            yield* writeProjectFile(
              "goals/drift/ops/trace.json",
              Str.replace('"resumeStage": "P0"', '"resumeStage": "P5"')(traceText)
            );

            const exit = yield* Effect.exit(runExploreCommand(["--check"]));
            expect(Exit.isSuccess(exit)).toBe(true);
            const output = yield* consoleText();
            expect(output).toContain("content drifts from the folded stream");
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    30_000
  );

  it(
    "prints usage when invoked without --check",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const exit = yield* Effect.exit(runExploreCommand([]));
            expect(Exit.isSuccess(exit)).toBe(true);
            const output = yield* consoleText();
            expect(output).toContain("Explore commands:");
            expect(output).toContain("beep explore --check");
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    30_000
  );
});
