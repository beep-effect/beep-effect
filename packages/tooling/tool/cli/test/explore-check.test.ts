import { exploreCommand } from "@beep/repo-cli/test/Explore";
import { PacketEvent, packetEventDigest, packetEventFileName, renderPacketEventFile } from "@beep/repo-cli/test/Goals";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { Effect, Exit, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
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
              `{"schemaVersion":"packet-trace/v1","projectorVersion":1,"sourceTip":{"seq":9,"id":"${"c".repeat(64)}"},"derived":{"packet":"solo","root":"goals","revision":9,"forks":[],"issues":[]}}\n`
            );

            const exit = yield* Effect.exit(runExploreCommand(["--check"]));
            expect(Exit.isSuccess(exit)).toBe(true);
            const output = yield* consoleText();
            expect(output).toContain("streams=2");
            expect(output).toContain("[packet-stream-fork]");
            expect(output).toContain("[packet-trace-missing]");
            expect(output).toContain("[packet-trace-stale]");
            expect(O.isSome(O.fromNullishOr(soloId))).toBe(true);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    30_000
  );
});
