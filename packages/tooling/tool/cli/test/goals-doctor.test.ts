import { lintCommand } from "@beep/repo-cli";
import {
  classifyGoalDoctorFindings,
  GoalDoctorFinding,
  goalsCommand,
  PacketEventStoreLive,
} from "@beep/repo-cli/test/Goals";
import { FsUtilsLive, TSMorphServiceLive } from "@beep/repo-utils";
import { Unknown } from "@beep/schema/Unknown";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { Cause, Effect, Exit, Layer, Runtime } from "effect";
import { Command } from "effect/unstable/cli";
import { describe, expect, it } from "vitest";
import { withTempWorkingDirectory, writeProjectFile } from "./support/CommandTest.ts";

const runGoalsCommand = Command.runWith(goalsCommand, { version: "0.0.0" });
const runLintCommand = Command.runWith(lintCommand, { version: "0.0.0" });
const encodeJson = Unknown.encodeUnknownSyncFromJsonString;

const testLayer = Layer.mergeAll(
  NodeServices.layer,
  PacketEventStoreLive.pipe(Layer.provideMerge(NodeServices.layer)),
  FsUtilsLive.pipe(Layer.provideMerge(NodeServices.layer)),
  TSMorphServiceLive.pipe(Layer.provideMerge(NodeServices.layer))
);

const expectReportedFailure = (exit: Exit.Exit<unknown, unknown>) => {
  expect(Exit.isFailure(exit)).toBe(true);
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

const writeBaseline = (keys: ReadonlyArray<string>) =>
  writeProjectFile(
    "goals/goals-doctor.baseline.jsonc",
    `${encodeJson({ schemaVersion: "goals-doctor-baseline/v1", findings: keys })}\n`
  );

describe("goals doctor baseline ratchet", () => {
  it(
    "ignores hidden editor directories under goals",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeProjectFile("goals/.idea/workspace.xml", "<project />\n");
            yield* writeBaseline([]);
            const exit = yield* Effect.exit(runGoalsCommand(["doctor"]));
            expect(Exit.isSuccess(exit)).toBe(true);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    20_000
  );

  it(
    "fails with exit 1 on a synthetic new blocking finding absent from the baseline",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeDriftedPacket("demo");
            yield* writeBaseline([]);
            const exit = yield* Effect.exit(runGoalsCommand(["doctor"]));
            expectReportedFailure(exit);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    20_000
  );

  it(
    "exits 0 when the same finding is inherited from the committed baseline",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeDriftedPacket("demo");
            yield* writeBaseline(["demo lifecycle-mismatch"]);
            const exit = yield* Effect.exit(runGoalsCommand(["doctor"]));
            expect(Exit.isSuccess(exit)).toBe(true);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
    20_000
  );

  it(
    "exposes the same ratchet through the beep lint goal-packets alias",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeDriftedPacket("demo");
            yield* writeBaseline([]);
            const exit = yield* Effect.exit(runLintCommand(["goal-packets"]));
            expectReportedFailure(exit);
          })
        ).pipe(provideScopedLayer(testLayer))
      ),
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
