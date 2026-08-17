import {
  goalsCommand,
  PacketCoreLive,
  PacketEvent,
  PacketEventStore,
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

const testLayer = Layer.mergeAll(NodeServices.layer, PacketCoreLive.pipe(Layer.provideMerge(NodeServices.layer)));

const COMPLETION_GATE = {
  operator: "yeet",
  requiresPullRequest: true,
  requiresMergeable: true,
  statement: "Ship via yeet.",
  grandfathered: false,
};

const writePacket = Effect.fnUntraced(function* (slug: string, options?: { readonly stream?: boolean }) {
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
  if (options?.stream !== false) {
    yield* writeProjectFile(`goals/${slug}/ops/events/.gitkeep`, "");
  }
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

describe("set-risk-tier guarded override writer", () => {
  it(
    "seeds genesis plus the override on an empty stream and writes the trace, touching no manifest surface",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* writePacket("override-demo");
            const manifestBefore = yield* fs.readFileString("goals/override-demo/ops/manifest.json");

            const exit = yield* Effect.exit(
              runGoalsCommand(["set-risk-tier", "override-demo", "standard", "--reason", "pilot routing"])
            );
            expect(Exit.isSuccess(exit)).toBe(true);

            const files = yield* listEventFiles("override-demo");
            expect(A.length(files)).toBe(2);
            expect(A.some(files, Str.startsWith("00001-packet-created-"))).toBe(true);
            const firstOverride = A.findFirst(files, Str.startsWith("00002-risk-tier-overridden-"));
            expect(firstOverride._tag).toBe("Some");
            if (firstOverride._tag === "Some") {
              // The first override replaces nothing: the writer must omit
              // `previous` entirely, not stamp a placeholder.
              const content = yield* fs.readFileString(`goals/override-demo/ops/events/${firstOverride.value}`);
              expect(content).toContain('"tier": "standard"');
              expect(content).not.toContain('"previous"');
            }

            const trace = yield* fs.readFileString("goals/override-demo/ops/trace.json");
            expect(trace).toContain('"riskTierOverride"');
            expect(trace).toContain('"tier": "standard"');
            expect(trace).toContain('"reason": "pilot routing"');

            const manifestAfter = yield* fs.readFileString("goals/override-demo/ops/manifest.json");
            expect(manifestAfter).toBe(manifestBefore);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    30_000
  );

  it(
    "appends to an existing stream and records the override it replaces",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* writePacket("replace-demo");

            const first = yield* Effect.exit(
              runGoalsCommand(["set-risk-tier", "replace-demo", "standard", "--reason", "initial routing"])
            );
            expect(Exit.isSuccess(first)).toBe(true);
            const second = yield* Effect.exit(
              runGoalsCommand(["set-risk-tier", "replace-demo", "full", "--reason", "scope grew"])
            );
            expect(Exit.isSuccess(second)).toBe(true);

            const files = yield* listEventFiles("replace-demo");
            expect(A.length(files)).toBe(3);

            const overrideFile = A.findFirst(files, Str.startsWith("00003-risk-tier-overridden-"));
            expect(overrideFile._tag).toBe("Some");
            if (overrideFile._tag === "Some") {
              const content = yield* fs.readFileString(`goals/replace-demo/ops/events/${overrideFile.value}`);
              expect(content).toContain('"previous": "standard"');
              expect(content).toContain('"tier": "full"');
            }

            const trace = yield* fs.readFileString("goals/replace-demo/ops/trace.json");
            expect(trace).toContain('"tier": "full"');
            expect(trace).toContain('"reason": "scope grew"');
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
            yield* writePacket("preview-override");

            const exit = yield* Effect.exit(
              runGoalsCommand(["set-risk-tier", "preview-override", "full", "--reason", "just looking", "--preview"])
            );
            expect(Exit.isSuccess(exit)).toBe(true);

            expect(A.length(yield* listEventFiles("preview-override"))).toBe(0);
            expect(yield* fs.exists("goals/preview-override/ops/trace.json")).toBe(false);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    30_000
  );

  it(
    "refuses a packet that has not opted into event sourcing",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* writePacket("streamless-demo", { stream: false });

            const exit = yield* Effect.exit(
              runGoalsCommand(["set-risk-tier", "streamless-demo", "standard", "--reason", "no home for this"])
            );
            expectReportedFailure(exit);
            expect(yield* fs.exists("goals/streamless-demo/ops/events")).toBe(false);
            expect(yield* fs.exists("goals/streamless-demo/ops/trace.json")).toBe(false);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    30_000
  );

  it(
    "refuses to plan an override on a forked stream",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* writePacket("forked-override");
            const seeded = yield* Effect.exit(
              runGoalsCommand(["set-risk-tier", "forked-override", "standard", "--reason", "initial routing"])
            );
            expect(Exit.isSuccess(seeded)).toBe(true);

            // Handcraft a second child of the genesis event (a fork).
            const store = yield* PacketEventStore;
            const locator = PacketStreamLocator.make({
              packet: "forked-override",
              root: "goals",
              packetPath: "goals/forked-override",
            });
            const listing = yield* store.list(locator);
            const genesisId = O.getOrUndefined(O.map(A.get(listing.events, 0), (stored) => stored.id));
            const sibling = PacketEvent.make({
              schemaVersion: "packet-event/v1",
              packet: "forked-override",
              root: "goals",
              seq: 2,
              ...(genesisId === undefined ? {} : { parent: genesisId }),
              expectedRevision: 1,
              at: "2026-08-17T09:00:00.000Z",
              actor: "test",
              body: { type: "status-set", status: "paused", previous: "active" },
            });
            const siblingId = yield* packetEventDigest(sibling);
            const siblingContent = yield* renderPacketEventFile(sibling);
            yield* fs.writeFileString(
              `goals/forked-override/ops/events/${packetEventFileName(sibling, siblingId)}`,
              siblingContent
            );

            const beforeCount = A.length(yield* listEventFiles("forked-override"));
            const refused = yield* Effect.exit(
              runGoalsCommand(["set-risk-tier", "forked-override", "full", "--reason", "should never land"])
            );
            expectReportedFailure(refused);
            expect(A.length(yield* listEventFiles("forked-override"))).toBe(beforeCount);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    30_000
  );

  it(
    "refuses an unknown tier and an empty reason as usage errors",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writePacket("usage-demo");

            const badTier = yield* Effect.exit(
              runGoalsCommand(["set-risk-tier", "usage-demo", "extreme", "--reason", "nope"])
            );
            expectReportedFailure(badTier);

            const noReason = yield* Effect.exit(runGoalsCommand(["set-risk-tier", "usage-demo", "standard"]));
            expectReportedFailure(noReason);

            const blankReason = yield* Effect.exit(
              runGoalsCommand(["set-risk-tier", "usage-demo", "standard", "--reason", "   "])
            );
            expectReportedFailure(blankReason);

            expect(A.length(yield* listEventFiles("usage-demo"))).toBe(0);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    30_000
  );
});
