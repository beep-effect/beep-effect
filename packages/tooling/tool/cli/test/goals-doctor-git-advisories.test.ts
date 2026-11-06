import { CommitLogEntry, Git, GitCommandError } from "@beep/git/Git";
import { goalsCommand, layerGoalCompletionReceiptStoreMemory, PacketEventStoreLive } from "@beep/repo-cli/test/Goals";
import { FsUtilsLive, TSMorphServiceLive } from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { NodeTestLayer, temporaryWorkingDirectory, writeProjectFile } from "./support/CommandTest.ts";
import type { GitStubs } from "@beep/git/Git";

// The doctor's git advisories read history through the kit (W7b, SPEC D-19). The staleness window's path walk
// sat at 438 KB of the old capture's 512 KiB bound, which truncated silently; the kit's bound fails closed, so
// an oversized read must skip the advisories it feeds, never read as a partial (here: empty) window.

const runGoalsCommand = Command.runWith(goalsCommand, { version: "0.0.0" });
const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);

const platform = Layer.mergeAll(
  NodeTestLayer,
  layerGoalCompletionReceiptStoreMemory,
  PacketEventStoreLive.pipe(Layer.provideMerge(NodeTestLayer)),
  FsUtilsLive.pipe(Layer.provideMerge(NodeTestLayer)),
  TSMorphServiceLive.pipe(Layer.provideMerge(NodeTestLayer))
);

const OVERFLOW = GitCommandError.make({ kind: "truncated", args: ["log"], cwd: ".", stderr: "" });
const AT = DateTime.makeUnsafe("2026-11-03T00:00:00Z");
const subject = (text: string) =>
  CommitLogEntry.make({
    sha: "1111111111111111111111111111111111111111",
    authoredAt: AT,
    committedAt: AT,
    authorName: "Fixture",
    authorEmail: "fixture@example.invalid",
    subject: text,
    paths: [],
  });

// A consistent active packet with no open context: an empty staleness window makes it `stale-active`.
const writeActivePacket = Effect.fn("GoalsDoctorGitTest.writeActivePacket")(function* () {
  yield* writeProjectFile(
    "goals/quiet/ops/manifest.json",
    `${encodeJson({
      schemaVersion: "initiative-manifest/v2",
      initiative: { id: "quiet", title: "quiet", status: "active" },
      lifecycle: "active",
      completionGate: {
        operator: "yeet",
        requiresPullRequest: true,
        requiresMergeable: true,
        statement: "Ship via yeet.",
        grandfathered: false,
      },
    })}\n`
  );
  yield* writeProjectFile("goals/quiet/README.md", "# quiet\n\nLifecycle: `active`\n");
  yield* writeProjectFile(
    "goals/goals-doctor.baseline.jsonc",
    `${encodeJson({ schemaVersion: "goals-doctor-baseline/v1", findings: [] })}\n`
  );
});

const doctorOutput = Effect.fnUntraced(function* (stubs: Partial<GitStubs>) {
  const current = yield* Console.Console;
  let output = A.empty<string>();
  const capture = (...values: ReadonlyArray<unknown>) => {
    output = A.appendAll(output, A.map(values, String));
  };
  yield* runGoalsCommand(["doctor"]).pipe(
    Effect.provideService(Git, Git.makeTest(stubs)),
    Effect.provideService(Console.Console, { ...current, log: capture, error: capture }),
    Effect.exit
  );
  return A.join(output, "\n");
});

it.layer(platform, { timeout: "20 seconds" })("goals doctor git advisories over the kit", (it) => {
  it.effect("an empty staleness window flags the untouched active packet", () =>
    Effect.gen(function* () {
      yield* temporaryWorkingDirectory;
      yield* writeActivePacket();
      const output = yield* doctorOutput({
        isShallow: () => Effect.succeed(false),
        log: () => Effect.succeed([]),
      });
      expect(output).toContain("quiet [stale-active]");
      expect(output).not.toContain("advisories skipped");
    })
  );

  it.effect("an oversized staleness window skips its advisories instead of reading a partial window", () =>
    Effect.gen(function* () {
      yield* temporaryWorkingDirectory;
      yield* writeActivePacket();
      const output = yield* doctorOutput({
        isShallow: () => Effect.succeed(false),
        log: (_cwd, options) =>
          options?.omitPaths === true ? Effect.succeed([subject("chore: unrelated")]) : Effect.fail(OVERFLOW),
      });
      expect(output).toContain("git log for staleness failed; staleness advisories skipped.");
      expect(output).not.toContain("quiet [stale-active]");
    })
  );

  it.effect("an oversized subject read skips the completion-gate advisories", () =>
    Effect.gen(function* () {
      yield* temporaryWorkingDirectory;
      yield* writeActivePacket();
      const output = yield* doctorOutput({
        isShallow: () => Effect.succeed(false),
        log: (_cwd, options) => (options?.omitPaths === true ? Effect.fail(OVERFLOW) : Effect.succeed([])),
      });
      expect(output).toContain("git log for completion gates failed; completion-gate advisories skipped.");
    })
  );

  it.effect("a shallow or unreadable checkout skips every history advisory", () =>
    Effect.gen(function* () {
      yield* temporaryWorkingDirectory;
      yield* writeActivePacket();
      const shallow = yield* doctorOutput({ isShallow: () => Effect.succeed(true) });
      expect(shallow).toContain("shallow git checkout; staleness/completion-gate advisories skipped.");
      const unreadable = yield* doctorOutput({ isShallow: () => Effect.fail(OVERFLOW) });
      expect(unreadable).toContain("git history unavailable; staleness/completion-gate advisories skipped.");
    })
  );
});
