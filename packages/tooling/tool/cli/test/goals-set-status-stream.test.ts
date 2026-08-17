import {
  goalsCommand,
  PacketEvent,
  PacketEventStore,
  PacketEventStoreLive,
  PacketStreamLocator,
  packetEventDigest,
  packetEventFileName,
  renderPacketEventFile,
} from "@beep/repo-cli/test/Goals";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { Cause, Effect, Exit, FileSystem, Layer, Runtime } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Command } from "effect/unstable/cli";
import { describe, expect, it } from "vitest";
import { withTempWorkingDirectory, writeProjectFile } from "./support/CommandTest.ts";

const runGoalsCommand = Command.runWith(goalsCommand, { version: "0.0.0" });
const encodeJson = S.encodeUnknownSync(S.fromJsonString(S.Unknown));

const testLayer = Layer.mergeAll(NodeServices.layer, PacketEventStoreLive.pipe(Layer.provideMerge(NodeServices.layer)));

const COMPLETION_GATE = {
  operator: "yeet",
  requiresPullRequest: true,
  requiresMergeable: true,
  statement: "Ship via yeet.",
  grandfathered: false,
};

const writeStreamPacket = Effect.fnUntraced(function* (slug: string) {
  yield* writeProjectFile(
    `goals/${slug}/ops/manifest.json`,
    `${encodeJson({
      schemaVersion: "initiative-manifest/v2",
      initiative: { id: slug, title: slug, status: "active" },
      lifecycle: "active",
      completionGate: COMPLETION_GATE,
      phases: [
        { id: "P0", status: "complete" },
        { id: "P1", status: "in-progress" },
      ],
    })}\n`
  );
  yield* writeProjectFile(`goals/${slug}/README.md`, `# ${slug}\n\n## Status\n\nLifecycle: \`active\`\n`);
  yield* writeProjectFile(`goals/${slug}/ops/events/.gitkeep`, "");
});

const listEventFiles = Effect.fnUntraced(function* (slug: string) {
  const fs = yield* FileSystem.FileSystem;
  const entries = yield* fs.readDirectory(`goals/${slug}/ops/events`).pipe(Effect.orElseSucceed(A.empty<string>));
  return A.filter(entries, (name) => name !== ".gitkeep");
});

const expectReportedFailure = (exit: Exit.Exit<unknown, unknown>) => {
  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isFailure(exit)) {
    const error = Cause.squash(exit.cause);
    expect(Runtime.getErrorExitCode(error)).toBe(1);
  }
};

describe("set-status guarded stream writer", () => {
  it(
    "seeds genesis plus status-set, writes the trace, and keeps appending on later transitions",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* writeStreamPacket("stream-demo");

            const first = yield* Effect.exit(runGoalsCommand(["set-status", "stream-demo", "paused"]));
            expect(Exit.isSuccess(first)).toBe(true);

            const afterFirst = yield* listEventFiles("stream-demo");
            expect(A.length(afterFirst)).toBe(2);
            expect(A.some(afterFirst, Str.startsWith("00001-packet-created-"))).toBe(true);
            expect(A.some(afterFirst, Str.startsWith("00002-status-set-"))).toBe(true);

            const trace = yield* fs.readFileString("goals/stream-demo/ops/trace.json");
            expect(trace).toContain('"revision": 2');
            expect(trace).toContain('"status": "paused"');
            expect(trace).toContain('"furthestStage": "P1"');

            const manifest = yield* fs.readFileString("goals/stream-demo/ops/manifest.json");
            expect(manifest).toContain('"status": "paused"');

            const second = yield* Effect.exit(runGoalsCommand(["set-status", "stream-demo", "active"]));
            expect(Exit.isSuccess(second)).toBe(true);
            const afterSecond = yield* listEventFiles("stream-demo");
            expect(A.length(afterSecond)).toBe(3);
            const traceAfter = yield* fs.readFileString("goals/stream-demo/ops/trace.json");
            expect(traceAfter).toContain('"revision": 3');
            expect(traceAfter).toContain('"status": "active"');
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    30_000
  );

  it(
    "writes nothing in --preview mode",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* writeStreamPacket("preview-demo");

            const exit = yield* Effect.exit(runGoalsCommand(["set-status", "preview-demo", "paused", "--preview"]));
            expect(Exit.isSuccess(exit)).toBe(true);

            expect(A.length(yield* listEventFiles("preview-demo"))).toBe(0);
            const traceExists = yield* fs.exists("goals/preview-demo/ops/trace.json");
            expect(traceExists).toBe(false);
            const manifest = yield* fs.readFileString("goals/preview-demo/ops/manifest.json");
            expect(manifest).not.toContain("paused");
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    30_000
  );

  it(
    "refuses the whole transition when the stream is forked",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* writeStreamPacket("forked-demo");

            const seeded = yield* Effect.exit(runGoalsCommand(["set-status", "forked-demo", "paused"]));
            expect(Exit.isSuccess(seeded)).toBe(true);

            // Handcraft a second child of the genesis event (a fork).
            const store = yield* PacketEventStore;
            const locator = PacketStreamLocator.make({
              packet: "forked-demo",
              root: "goals",
              packetPath: "goals/forked-demo",
            });
            const listing = yield* store.list(locator);
            const genesisId = O.getOrUndefined(O.map(A.get(listing.events, 0), (stored) => stored.id));
            const sibling = PacketEvent.make({
              schemaVersion: "packet-event/v1",
              packet: "forked-demo",
              root: "goals",
              seq: 2,
              ...(genesisId === undefined ? {} : { parent: genesisId }),
              expectedRevision: 1,
              at: "2026-08-17T09:00:00.000Z",
              actor: "test",
              body: { type: "status-set", status: "reference", previous: "active" },
            });
            const siblingId = yield* packetEventDigest(sibling);
            const siblingContent = yield* renderPacketEventFile(sibling);
            yield* fs.writeFileString(
              `goals/forked-demo/ops/events/${packetEventFileName(sibling, siblingId)}`,
              siblingContent
            );

            const beforeCount = A.length(yield* listEventFiles("forked-demo"));
            const refused = yield* Effect.exit(runGoalsCommand(["set-status", "forked-demo", "active"]));
            expectReportedFailure(refused);
            expect(A.length(yield* listEventFiles("forked-demo"))).toBe(beforeCount);
            const manifest = yield* fs.readFileString("goals/forked-demo/ops/manifest.json");
            expect(manifest).toContain('"status": "paused"');
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    30_000
  );

  it(
    "refuses a compare-and-set append whose expected revision is stale",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeStreamPacket("cas-demo");
            const store = yield* PacketEventStore;
            const locator = PacketStreamLocator.make({
              packet: "cas-demo",
              root: "goals",
              packetPath: "goals/cas-demo",
            });
            const genesis = PacketEvent.make({
              schemaVersion: "packet-event/v1",
              packet: "cas-demo",
              root: "goals",
              seq: 1,
              expectedRevision: 0,
              at: "2026-08-17T09:00:00.000Z",
              actor: "test",
              body: { type: "packet-created", status: "active" },
            });
            const appended = yield* store.append(locator, genesis);
            expect(appended.event.seq).toBe(1);

            const rival = PacketEvent.make({
              schemaVersion: "packet-event/v1",
              packet: "cas-demo",
              root: "goals",
              seq: 1,
              expectedRevision: 0,
              at: "2026-08-17T09:00:01.000Z",
              actor: "test",
              body: { type: "packet-created", status: "active" },
            });
            const conflict = yield* Effect.exit(store.append(locator, rival));
            expect(Exit.isFailure(conflict)).toBe(true);
            if (Exit.isFailure(conflict)) {
              const error = Cause.squash(conflict.cause);
              expect(String(error)).toContain("revision");
            }
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    30_000
  );
});
