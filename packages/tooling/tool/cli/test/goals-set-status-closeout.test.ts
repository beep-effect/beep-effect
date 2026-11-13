import {
  GoalFinalPullRequestCandidate,
  GoalFinalPullRequestResolver,
} from "@beep/repo-cli/commands/Goals/FinalPullRequest";
import { GoalManifest, goalsCommand, PacketCoreLive } from "@beep/repo-cli/test/Goals";
import { it } from "@beep/test-runner";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { NodeTestLayer, temporaryWorkingDirectory, writeProjectFile } from "./support/CommandTest.ts";
import { withLayer } from "./support/GithubLedgerFakes.ts";
import type { GoalFinalPullRequestState } from "@beep/repo-cli/commands/Goals/FinalPullRequest";

const runGoalsCommand = Command.runWith(goalsCommand, { version: "0.0.0" });
const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
const decodeManifestJson = S.decodeUnknownEffect(S.fromJsonString(GoalManifest));

const testLayer = Layer.mergeAll(
  NodeTestLayer,
  NodeCrypto.layer,
  PacketCoreLive.pipe(Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)))
);

const COMPLETION_GATE = {
  operator: "yeet",
  requiresPullRequest: true,
  requiresMergeable: true,
  statement: "Ship via yeet.",
  grandfathered: false,
};

const SLUG = "bind-demo";
const MANIFEST_PATH = `goals/${SLUG}/ops/manifest.json`;
const README_PATH = `goals/${SLUG}/README.md`;

const candidate = (number: number, state: GoalFinalPullRequestState, headRefName = "feat/bind-demo") =>
  GoalFinalPullRequestCandidate.make({ number, state, headRefName });

// Writes a streamless packet and returns the exact manifest bytes, so a refusal can prove nothing was written.
const writePacket = Effect.fnUntraced(function* (manifest: Readonly<Record<string, unknown>>, lifecycle = "active") {
  const text = `${yield* encodeJson(manifest)}\n`;
  yield* writeProjectFile(MANIFEST_PATH, text);
  yield* writeProjectFile(README_PATH, `# ${SLUG}\n\n## Status\n\nLifecycle: \`${lifecycle}\`\n`);
  return text;
});

const activeManifest = (
  gate: Readonly<Record<string, unknown>> = {},
  extra: Readonly<Record<string, unknown>> = {}
): Readonly<Record<string, unknown>> => ({
  initiative: { id: SLUG, status: "active" },
  completionGate: { ...COMPLETION_GATE, ...gate },
  ...extra,
});

const runSetStatus = (args: ReadonlyArray<string>, candidates: ReadonlyArray<GoalFinalPullRequestCandidate>) =>
  Effect.exit(
    runGoalsCommand(["set-status", SLUG, ...args]).pipe(withLayer(GoalFinalPullRequestResolver.layerTest(candidates)))
  );

const readManifest = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(MANIFEST_PATH);
  return yield* decodeManifestJson(text);
});

const loggedLine = Effect.fnUntraced(function* (fragment: string) {
  const lines = yield* TestConsole.logLines;
  return A.some(A.map(lines, String), Str.includes(fragment));
});

// A refusal exits 1, names the reason on stderr and leaves the manifest bytes untouched.
const expectRefused = Effect.fnUntraced(function* (
  exit: Exit.Exit<unknown, unknown>,
  fragment: string,
  manifestBefore: string
) {
  exit.pipe(Exit.isFailure, assertTrue);
  if (Exit.isFailure(exit)) {
    expect(exit.cause.pipe(Cause.squash, Runtime.getErrorExitCode)).toBe(1);
  }
  const errorLines = yield* TestConsole.errorLines;
  assertTrue(
    A.some(
      A.map(errorLines, String),
      (line) => Str.startsWith("[goals:set-status]")(line) && Str.includes(fragment)(line)
    )
  );
  const fs = yield* FileSystem.FileSystem;
  const after = yield* fs.readFileString(MANIFEST_PATH);
  expect(after).toBe(manifestBefore);
});

const inTempPacket = <A, E, R>(body: Effect.Effect<A, E, R>) =>
  Effect.andThen(temporaryWorkingDirectory, body).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make));

it.layer(testLayer, { concurrent: false, timeout: "30 seconds" })((it) => {
  describe("set-status completed-retained binds the final PR", () => {
    it.effect("binds the checked-out branch's open PR and writes closeout, refs, status and README together", () =>
      inTempPacket(
        Effect.gen(function* () {
          yield* writePacket(activeManifest({ pullRequests: [{ number: 3100, role: "supporting" }] }));
          const exit = yield* runSetStatus(["completed-retained"], [candidate(3150, "OPEN")]);
          exit.pipe(Exit.isSuccess, assertTrue);

          const after = yield* readManifest;
          expect(after.initiative.status).toBe("completed-retained");
          expect(after.closeout).toEqual({ status: "completed-retained", finalPullRequest: 3150 });
          expect(after.completionGate.pullRequests).toEqual([
            { number: 3100, role: "supporting" },
            { number: 3150, role: "final" },
          ]);
          const fs = yield* FileSystem.FileSystem;
          const readme = yield* fs.readFileString(README_PATH);
          expect(readme).toContain("Lifecycle: `completed-retained`");
          const logged = yield* loggedLine(
            `${SLUG} closeout: binds #3150 as the final PR (the open PR of branch feat/bind-demo)`
          );
          assertTrue(logged);
        })
      )
    );

    it.effect("refuses with publish-first advice when the branch has no PR", () =>
      inTempPacket(
        Effect.gen(function* () {
          const before = yield* writePacket(activeManifest());
          const exit = yield* runSetStatus(["completed-retained"], []);
          yield* expectRefused(exit, "publish first", before);
        })
      )
    );

    it.effect("refuses the branch's merged PR with the --adopt-merged form, and its closed PR", () =>
      inTempPacket(
        Effect.gen(function* () {
          const before = yield* writePacket(activeManifest());
          const merged = yield* runSetStatus(["completed-retained"], [candidate(3150, "MERGED")]);
          yield* expectRefused(merged, "bind it with `--final-pr 3150 --adopt-merged`", before);
          const closed = yield* runSetStatus(["completed-retained"], [candidate(3150, "CLOSED")]);
          yield* expectRefused(closed, "The branch's PR #3150 was closed without merging", before);
        })
      )
    );

    it.effect("refuses a closed --final-pr and a number GitHub does not know", () =>
      inTempPacket(
        Effect.gen(function* () {
          const before = yield* writePacket(activeManifest());
          const candidates = [candidate(3150, "OPEN"), candidate(3140, "CLOSED", "feat/abandoned")];
          const closed = yield* runSetStatus(["completed-retained", "--final-pr", "3140"], candidates);
          yield* expectRefused(closed, "#3140 was closed without merging", before);
          const unknown = yield* runSetStatus(["completed-retained", "--final-pr", "9999"], candidates);
          yield* expectRefused(unknown, "found no pull request #9999", before);
        })
      )
    );

    it.effect("refuses a merged --final-pr without --adopt-merged and binds it with the flag", () =>
      inTempPacket(
        Effect.gen(function* () {
          const before = yield* writePacket(activeManifest());
          const candidates = [candidate(3001, "MERGED", "feat/work")];
          const refused = yield* runSetStatus(["completed-retained", "--final-pr", "3001"], candidates);
          yield* expectRefused(refused, "bind a merged PR only with `--final-pr 3001 --adopt-merged`", before);

          const adopted = yield* runSetStatus(
            ["completed-retained", "--final-pr", "3001", "--adopt-merged"],
            candidates
          );
          adopted.pipe(Exit.isSuccess, assertTrue);
          const after = yield* readManifest;
          expect(after.closeout).toEqual({ status: "completed-retained", finalPullRequest: 3001 });
          expect(after.completionGate.pullRequests).toEqual([{ number: 3001, role: "final" }]);
          const logged = yield* loggedLine("(--final-pr 3001 --adopt-merged, merged)");
          assertTrue(logged);
        })
      )
    );

    it.effect("binds an open --final-pr instead of the branch's PR", () =>
      inTempPacket(
        Effect.gen(function* () {
          yield* writePacket(activeManifest());
          const exit = yield* runSetStatus(
            ["completed-retained", "--final-pr", "3160"],
            [candidate(3150, "OPEN"), candidate(3160, "OPEN", "feat/other")]
          );
          exit.pipe(Exit.isSuccess, assertTrue);
          const after = yield* readManifest;
          expect(after.closeout).toEqual({ status: "completed-retained", finalPullRequest: 3160 });
          const logged = yield* loggedLine("(--final-pr 3160, open)");
          assertTrue(logged);
        })
      )
    );

    it.effect("refuses an open PR when pullRequests already names a different final that merged", () =>
      inTempPacket(
        Effect.gen(function* () {
          const before = yield* writePacket(activeManifest({ pullRequests: [{ number: 3001, role: "final" }] }));
          const candidates = [candidate(3150, "OPEN"), candidate(3001, "MERGED", "feat/work")];
          const fromBranch = yield* runSetStatus(["completed-retained"], candidates);
          yield* expectRefused(fromBranch, "bind it with `--final-pr 3001 --adopt-merged` instead of #3150", before);
          const fromFlag = yield* runSetStatus(["completed-retained", "--final-pr", "3150"], candidates);
          yield* expectRefused(fromFlag, "names #3001 as the final and it already merged", before);
        })
      )
    );

    it.effect("refuses an open PR when the declared final's state cannot be read", () =>
      inTempPacket(
        Effect.gen(function* () {
          const before = yield* writePacket(activeManifest({ pullRequests: [{ number: 3001, role: "final" }] }));
          const exit = yield* runSetStatus(["completed-retained"], [candidate(3150, "OPEN")]);
          yield* expectRefused(exit, "names #3001 as the final and its state cannot be read", before);
        })
      )
    );

    it.effect("demotes an old open final to supporting and drops a duplicate of the new one", () =>
      inTempPacket(
        Effect.gen(function* () {
          yield* writePacket(
            activeManifest({
              pullRequests: [
                { number: 3001, role: "final" },
                { number: 3150, role: "supporting" },
                { number: 3150, role: "supporting" },
              ],
            })
          );
          const exit = yield* runSetStatus(
            ["completed-retained"],
            [candidate(3150, "OPEN"), candidate(3001, "OPEN", "feat/old")]
          );
          exit.pipe(Exit.isSuccess, assertTrue);
          const after = yield* readManifest;
          expect(after.completionGate.pullRequests).toEqual([
            { number: 3001, role: "supporting" },
            { number: 3150, role: "final" },
          ]);
          const logged = yield* loggedLine("demotes #3001 to supporting");
          assertTrue(logged);
        })
      )
    );

    it.effect(
      "binds a legacy proposal's own final, accepting a matching --final-pr and refusing a conflicting one",
      () =>
        inTempPacket(
          Effect.gen(function* () {
            const before = yield* writePacket(
              activeManifest({}, { proposedCloseout: { status: "completed-retained", finalPullRequest: 1429 } })
            );
            const conflicting = yield* runSetStatus(["completed-retained", "--final-pr", "1500"], []);
            yield* expectRefused(conflicting, "--final-pr 1500 conflicts", before);

            const matching = yield* runSetStatus(["completed-retained", "--final-pr", "1429"], []);
            matching.pipe(Exit.isSuccess, assertTrue);
            const fs = yield* FileSystem.FileSystem;
            const text = yield* fs.readFileString(MANIFEST_PATH);
            expect(text).not.toContain("proposedCloseout");
            const after = yield* readManifest;
            expect(after.closeout).toEqual({ status: "completed-retained", finalPullRequest: 1429 });
            expect(after.completionGate.pullRequests).toEqual([{ number: 1429, role: "final" }]);
            const logged = yield* loggedLine("deletes proposedCloseout");
            assertTrue(logged);
          })
        )
    );

    it.effect("keeps a legacy proposal on paused and refuses a status that is neither active, paused nor its own", () =>
      inTempPacket(
        Effect.gen(function* () {
          const before = yield* writePacket(
            activeManifest({}, { proposedCloseout: { status: "completed-retained", finalPullRequest: 1429 } })
          );
          const superseded = yield* runSetStatus(["superseded"], []);
          yield* expectRefused(superseded, "A legacy proposedCloseout keeps active/paused", before);

          const paused = yield* runSetStatus(["paused"], []);
          paused.pipe(Exit.isSuccess, assertTrue);
          const fs = yield* FileSystem.FileSystem;
          const text = yield* fs.readFileString(MANIFEST_PATH);
          expect(text).toContain("proposedCloseout");
          const after = yield* readManifest;
          expect(after.initiative.status).toBe("paused");
          expect(after.closeout).toBeUndefined();
        })
      )
    );

    it.effect("flips a grandfathered packet's status only and refuses --final-pr for it", () =>
      inTempPacket(
        Effect.gen(function* () {
          const before = yield* writePacket(activeManifest({ grandfathered: true }));
          const withFinal = yield* runSetStatus(
            ["completed-retained", "--final-pr", "3150"],
            [candidate(3150, "OPEN")]
          );
          yield* expectRefused(withFinal, "is grandfathered and carries no closeout record", before);

          const flipped = yield* runSetStatus(["completed-retained"], []);
          flipped.pipe(Exit.isSuccess, assertTrue);
          const after = yield* readManifest;
          expect(after.initiative.status).toBe("completed-retained");
          expect(after.closeout).toBeUndefined();
          expect(after.completionGate.pullRequests).toBeUndefined();
        })
      )
    );

    it.effect("--preview prints the bind and writes nothing", () =>
      inTempPacket(
        Effect.gen(function* () {
          const before = yield* writePacket(activeManifest());
          const exit = yield* runSetStatus(["completed-retained", "--preview"], [candidate(3150, "OPEN")]);
          exit.pipe(Exit.isSuccess, assertTrue);
          const fs = yield* FileSystem.FileSystem;
          const after = yield* fs.readFileString(MANIFEST_PATH);
          expect(after).toBe(before);
          const logged = yield* loggedLine(
            "closeout: binds #3150 as the final PR (the open PR of branch feat/bind-demo): sets closeout and marks #3150 final in completionGate.pullRequests."
          );
          assertTrue(logged);
          const previewOnly = yield* loggedLine("preview only — nothing written.");
          assertTrue(previewOnly);
        })
      )
    );

    it.effect("keeps a committed closeout on a repeat and refuses rebinding it to another PR", () =>
      inTempPacket(
        Effect.gen(function* () {
          const before = yield* writePacket(
            {
              initiative: { id: SLUG, status: "completed-retained" },
              completionGate: { ...COMPLETION_GATE, pullRequests: [{ number: 3150, role: "final" }] },
              closeout: { status: "completed-retained", finalPullRequest: 3150 },
            },
            "completed-retained"
          );
          const rebind = yield* runSetStatus(["completed-retained", "--final-pr", "3200"], [candidate(3200, "OPEN")]);
          yield* expectRefused(rebind, "reopen with `bun run beep goals set-status bind-demo active`", before);

          const repeat = yield* runSetStatus(["completed-retained", "--final-pr", "3150"], []);
          repeat.pipe(Exit.isSuccess, assertTrue);
          const after = yield* readManifest;
          expect(after.closeout).toEqual({ status: "completed-retained", finalPullRequest: 3150 });
          expect(after.completionGate.pullRequests).toEqual([{ number: 3150, role: "final" }]);
        })
      )
    );

    it.effect("reopening a closeout with no declared refs keeps its final as a supporting PR", () =>
      inTempPacket(
        Effect.gen(function* () {
          yield* writePacket(
            {
              initiative: { id: SLUG, status: "completed-retained" },
              completionGate: COMPLETION_GATE,
              closeout: { status: "completed-retained", finalPullRequest: 2985 },
            },
            "completed-retained"
          );
          const exit = yield* runSetStatus(["paused"], []);
          exit.pipe(Exit.isSuccess, assertTrue);
          const after = yield* readManifest;
          expect(after.initiative.status).toBe("paused");
          expect(after.closeout).toBeUndefined();
          expect(after.completionGate.pullRequests).toEqual([{ number: 2985, role: "supporting" }]);
          const logged = yield* loggedLine("closeout: reopens from #2985");
          assertTrue(logged);
        })
      )
    );

    it.effect("deletes a stale proposedCloseout beside a committed closeout and refuses one naming another final", () =>
      inTempPacket(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const committed = (proposed: number) => ({
            initiative: { id: SLUG, status: "completed-retained" },
            completionGate: { ...COMPLETION_GATE, pullRequests: [{ number: 3150, role: "final" }] },
            closeout: { status: "completed-retained", finalPullRequest: 3150 },
            proposedCloseout: { status: "completed-retained", finalPullRequest: proposed },
          });
          const disagreeing = yield* writePacket(committed(3100), "completed-retained");
          const refused = yield* runSetStatus(["completed-retained"], []);
          yield* expectRefused(refused, "a stale proposedCloseout names #3100", disagreeing);

          yield* writePacket(committed(3150), "completed-retained");
          const kept = yield* runSetStatus(["completed-retained"], []);
          kept.pipe(Exit.isSuccess, assertTrue);
          const keptText = yield* fs.readFileString(MANIFEST_PATH);
          assertFalse(Str.includes("proposedCloseout")(keptText));
          const after = yield* readManifest;
          expect(after.closeout).toEqual({ status: "completed-retained", finalPullRequest: 3150 });

          // Reopening deletes it too, whatever final it names.
          yield* writePacket(committed(3100), "completed-retained");
          const reopened = yield* runSetStatus(["active"], []);
          reopened.pipe(Exit.isSuccess, assertTrue);
          const reopenedText = yield* fs.readFileString(MANIFEST_PATH);
          assertFalse(Str.includes("proposedCloseout")(reopenedText));
          const logged = yield* loggedLine("Also deletes the stale proposedCloseout.");
          assertTrue(logged);
        })
      )
    );

    it.effect("refuses a malformed proposedCloseout before writing anything", () =>
      inTempPacket(
        Effect.gen(function* () {
          const before = yield* writePacket(activeManifest({}, { proposedCloseout: { status: "active" } }));
          const exit = yield* runSetStatus(["completed-retained"], [candidate(3150, "OPEN")]);
          yield* expectRefused(exit, "fix or delete it and rerun", before);
        })
      )
    );

    it.effect("deletes a stale proposedCloseout on a grandfathered gate", () =>
      inTempPacket(
        Effect.gen(function* () {
          yield* writePacket(
            activeManifest(
              { grandfathered: true },
              { proposedCloseout: { status: "completed-retained", finalPullRequest: 3150 } }
            )
          );
          const exit = yield* runSetStatus(["completed-retained"], []);
          exit.pipe(Exit.isSuccess, assertTrue);
          const fs = yield* FileSystem.FileSystem;
          const text = yield* fs.readFileString(MANIFEST_PATH);
          assertFalse(Str.includes("proposedCloseout")(text));
          const after = yield* readManifest;
          expect([after.initiative.status, after.closeout]).toEqual(["completed-retained", undefined]);
          const logged = yield* loggedLine("closeout: deletes the stale proposedCloseout.");
          assertTrue(logged);
        })
      )
    );

    it.effect("refuses --final-pr on a status other than completed-retained before reading the packet", () =>
      inTempPacket(
        Effect.gen(function* () {
          const before = yield* writePacket(activeManifest());
          const exit = yield* runSetStatus(["paused", "--final-pr", "3150"], [candidate(3150, "OPEN")]);
          yield* expectRefused(exit, "paused takes no final", before);
        })
      )
    );
  });
});
