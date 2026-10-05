import { lintCommand } from "@beep/repo-cli";
import {
  classifyGoalDoctorFindings,
  GoalDoctorFinding,
  goalsCommand,
  PacketEventStoreLive,
} from "@beep/repo-cli/test/Goals";
import { FsUtilsLive, TSMorphServiceLive } from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Cause, Console, DateTime, Effect, Exit, flow, Layer, Result, Runtime } from "effect";
import * as A from "effect/Array";
import { Command } from "effect/cli";
import { ChildProcess } from "effect/process";
import * as S from "effect/Schema";
import { temporaryWorkingDirectory, writeProjectFile } from "./support/CommandTest.ts";

const runGoalsCommand = Command.runWith(goalsCommand, { version: "0.0.0" });
const runLintCommand = Command.runWith(lintCommand, { version: "0.0.0" });
const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);

const testLayer = Layer.mergeAll(
  NodeServices.layer,
  PacketEventStoreLive.pipe(Layer.provideMerge(NodeServices.layer)),
  FsUtilsLive.pipe(Layer.provideMerge(NodeServices.layer)),
  TSMorphServiceLive.pipe(Layer.provideMerge(NodeServices.layer))
);

const expectReportedFailure = (exit: Exit.Exit<unknown, unknown>) => {
  assertTrue(Exit.isFailure(exit));
  if (Exit.isFailure(exit)) {
    const error = Cause.squash(exit.cause);
    expect(Runtime.getErrorExitCode(error)).toBe(1);
  }
};

const COMPLETION_GATE = {
  operator: "yeet",
  requiresPullRequest: true,
  requiresMergeable: true,
  statement: "Ship via yeet.",
  grandfathered: false,
};

// One packet with exactly one blocking finding: initiative.status "active"
// disagrees with lifecycle "paused" (the yeet-pr-closeout-loop failure mode).
const writeDriftedPacket = Effect.fn("writeDriftedPacket")(function* (slug: string) {
  yield* writeProjectFile(
    `goals/${slug}/ops/manifest.json`,
    `${encodeJson({
      schemaVersion: "initiative-manifest/v2",
      initiative: { id: slug, title: slug, status: "active" },
      lifecycle: "paused",
      completionGate: COMPLETION_GATE,
    })}\n`
  );
  yield* writeProjectFile(`goals/${slug}/README.md`, `# ${slug}\n\n## Status\n\nLifecycle: \`active\`\n`);
});

const runGit = Effect.fn("GoalsDoctorTest.runGit")(function* (
  args: ReadonlyArray<string>,
  env: Record<string, string> = {}
) {
  const handle = yield* ChildProcess.make("git", [...args], {
    cwd: process.cwd(),
    env,
    extendEnv: true,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "inherit",
  });
  expect(yield* handle.exitCode).toBe(0);
});

const captureOutput = Effect.fnUntraced(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
  const current = yield* Console.Console;
  let output: ReadonlyArray<unknown> = [];
  yield* effect.pipe(
    Effect.provideService(Console.Console, {
      ...current,
      log: (...values: ReadonlyArray<unknown>) => {
        output = A.appendAll(output, values);
      },
      error: (...values: ReadonlyArray<unknown>) => {
        output = A.appendAll(output, values);
      },
    })
  );
  return A.join(A.map(output, String), "\n");
});

// A consistent active packet whose shipping PR could already have merged.
const writeActivePacket = Effect.fn("writeActivePacket")(function* (slug: string) {
  yield* writeProjectFile(
    `goals/${slug}/ops/manifest.json`,
    `${encodeJson({
      schemaVersion: "initiative-manifest/v2",
      initiative: { id: slug, title: slug, status: "active" },
      lifecycle: "active",
      completionGate: COMPLETION_GATE,
    })}\n`
  );
  yield* writeProjectFile(`goals/${slug}/README.md`, `# ${slug}\n\n## Status\n\nLifecycle: \`active\`\n`);
  yield* writeProjectFile(`goals/${slug}/GOAL.md`, `# ${slug}\n`);
});

const writeBaseline = (keys: ReadonlyArray<string>) =>
  writeProjectFile(
    "goals/goals-doctor.baseline.jsonc",
    `${encodeJson({ schemaVersion: "goals-doctor-baseline/v1", findings: keys })}\n`
  );

it.layer(testLayer, { timeout: "20 seconds" })("goals doctor baseline ratchet", (it) => {
  it.effect(
    "ignores hidden editor directories under goals",
    () =>
      Effect.gen(function* () {
        yield* temporaryWorkingDirectory;
        yield* writeProjectFile("goals/.idea/workspace.xml", "<project />\n");
        yield* writeBaseline([]);
        const exit = yield* Effect.exit(runGoalsCommand(["doctor"]));
        assertTrue(Exit.isSuccess(exit));
      }),
    20_000
  );

  it.effect(
    "fails with exit 1 on a synthetic new blocking finding absent from the baseline",
    () =>
      Effect.gen(function* () {
        yield* temporaryWorkingDirectory;
        yield* writeDriftedPacket("demo");
        yield* writeBaseline([]);
        const exit = yield* Effect.exit(runGoalsCommand(["doctor"]));
        expectReportedFailure(exit);
      }),
    20_000
  );

  it.effect(
    "exits 0 when the same finding is inherited from the committed baseline",
    () =>
      Effect.gen(function* () {
        yield* temporaryWorkingDirectory;
        yield* writeDriftedPacket("demo");
        yield* writeBaseline(["demo lifecycle-mismatch"]);
        const exit = yield* Effect.exit(runGoalsCommand(["doctor"]));
        assertTrue(Exit.isSuccess(exit));
      }),
    20_000
  );

  it.effect(
    "flags an active packet a squash merge cited and nobody touched since, and nothing else",
    () =>
      Effect.gen(function* () {
        yield* temporaryWorkingDirectory;
        yield* runGit(["init", "-b", "main"]);
        yield* runGit(["config", "user.email", "goals-doctor-test@example.com"]);
        yield* runGit(["config", "user.name", "Goals Doctor Test"]);
        yield* runGit(["config", "commit.gpgsign", "false"]);
        yield* writeBaseline([]);
        // The wall clock, not the test clock: git compares the backdated commits
        // against real time when the doctor asks for the last 21 days.
        const backdated = DateTime.formatIso(DateTime.subtract(DateTime.nowUnsafe(), { days: 40 }));
        const oldEnv = { GIT_AUTHOR_DATE: backdated, GIT_COMMITTER_DATE: backdated };
        // Cited by a squash subject, untouched since: the shipped-but-open shape.
        yield* writeActivePacket("shipped");
        yield* runGit(["add", "."]);
        yield* runGit(["commit", "-m", "feat(demo): ship shipped (#1)"], oldEnv);
        // Cited only by an ordinary commit: stale, but no merge is evidenced.
        yield* writeActivePacket("mentioned");
        yield* runGit(["add", "."]);
        yield* runGit(["commit", "-m", "chore(demo): mention mentioned in passing"], oldEnv);
        // Cited by a squash subject only inside a longer hyphenated token, and only by a
        // PR number that merely contains the one it recorded: neither is a citation.
        yield* writeActivePacket("cargo");
        yield* writeProjectFile(
          "goals/cargo/ops/manifest.json",
          `${encodeJson({
            schemaVersion: "initiative-manifest/v2",
            initiative: { id: "cargo", title: "cargo", status: "active" },
            lifecycle: "active",
            completionGate: COMPLETION_GATE,
            mergedPullRequest: 7,
          })}\n`
        );
        yield* runGit(["add", "."]);
        yield* runGit(["commit", "-m", "feat(demo): ship cargo-bay (#70)"], oldEnv);
        // Cited by a squash subject but touched inside the window: not stale.
        yield* writeActivePacket("fresh");
        yield* runGit(["add", "."]);
        yield* runGit(["commit", "-m", "feat(demo): ship fresh (#2)"]);
        const output = yield* captureOutput(runGoalsCommand(["doctor"]));
        expect(output).toContain("shipped [active-after-merge]");
        expect(output).not.toContain("shipped [stale-active]");
        expect(output).toContain("mentioned [stale-active]");
        expect(output).not.toContain("mentioned [active-after-merge]");
        expect(output).toContain("cargo [stale-active]");
        expect(output).not.toContain("cargo [active-after-merge]");
        expect(output).not.toContain("fresh [active-after-merge]");
        expect(output).not.toContain("fresh [stale-active]");
      }),
    20_000
  );

  it.effect(
    "exposes the same ratchet through the beep lint goal-packets alias",
    () =>
      Effect.gen(function* () {
        yield* temporaryWorkingDirectory;
        yield* writeDriftedPacket("demo");
        yield* writeBaseline([]);
        const exit = yield* Effect.exit(runLintCommand(["goal-packets"]));
        expectReportedFailure(exit);
      }),
    20_000
  );
});

describe("classifyGoalDoctorFindings", () => {
  const findingFor = (key: string): GoalDoctorFinding =>
    GoalDoctorFinding.make({
      slug: "demo",
      kind: "lifecycle-mismatch",
      severity: "blocking",
      key,
      message: "synthetic",
    });

  it("splits current findings into introduced and inherited, and reports resolved keys", () => {
    const result = classifyGoalDoctorFindings([findingFor("demo a"), findingFor("demo b")], ["demo b", "demo gone"]);
    expect(result.introduced.map((item) => item.key)).toEqual(["demo a"]);
    expect(result.inherited.map((item) => item.key)).toEqual(["demo b"]);
    expect(result.resolved).toEqual(["demo gone"]);
  });

  it("treats an empty baseline as all-new", () => {
    const result = classifyGoalDoctorFindings([findingFor("demo a")], []);
    expect(result.introduced.length).toBe(1);
    expect(result.inherited.length).toBe(0);
    expect(result.resolved).toEqual([]);
  });
});
