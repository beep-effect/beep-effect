import { reduceEvents } from "@beep/gate-report/Reducer";
import {
  CI_ANNOTATIONS_USED_PATH,
  CI_LANE_GATE,
  CI_LANE_RECORDED_ENV,
  CiLaneProcess,
  CiLaneRecorder,
  CiLaneRecordingRequest,
  CiLaneRun,
  CiLaneSelfCommand,
  ciLaneRecordTarget,
  ciLaneSelfCommand,
  currentCiLaneProcess,
  findJobGateRecords,
  gateRecordStamps,
  laneRunEvents,
  readAnnotationsUsed,
  recordCiLaneStep,
  stepWroteGateRecords,
} from "@beep/repo-cli/commands/Ci";
import { recordLocation } from "@beep/repo-gate-record/GatePaths";
import { NodeServices } from "@effect/platform-node";
import { describe, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as Sink from "effect/Sink";
import * as Stdio from "effect/Stdio";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";

const ENTRY = "/home/alice/beep-effect/packages/tooling/tool/cli/src/bin.ts";

const hostedProcess = (overrides: Partial<Parameters<typeof CiLaneProcess.make>[0]> = {}) =>
  CiLaneProcess.make({
    githubActions: O.some("true"),
    recorded: O.none(),
    execPath: "/usr/bin/bun",
    argv: ["/usr/bin/bun", ENTRY, "ci", "lane", "nix"],
    ...overrides,
  });

const laneRun = (exitCode: number) =>
  CiLaneRun.make({
    lane: "nix",
    runId: "20261122T100000000Z-0001",
    startedAt: DateTime.makeUnsafe(0),
    durationMs: 1200,
    exitCode,
    inputFingerprint: "local:20261122T100000000Z-0001",
  });

describe("which ci lane process records its lane", () => {
  it("the CLI entry on a runner records through itself, run again with the same arguments", () => {
    assertSome(
      ciLaneSelfCommand(hostedProcess()),
      CiLaneSelfCommand.make({ command: "/usr/bin/bun", args: [ENTRY, "ci", "lane", "nix"] })
    );
  });

  it("off a runner, in the recorded child and outside the CLI entry the lane runs in place", () => {
    assertNone(ciLaneSelfCommand(hostedProcess({ githubActions: O.none() })));
    assertNone(ciLaneSelfCommand(hostedProcess({ githubActions: O.some("false") })));
    assertNone(ciLaneSelfCommand(hostedProcess({ recorded: O.some("1") })));
    assertNone(ciLaneSelfCommand(hostedProcess({ argv: ["/usr/bin/node", "/home/alice/vitest.mjs"] })));
    assertNone(ciLaneSelfCommand(hostedProcess({ argv: ["/usr/bin/bun"] })));
  });

  it.effect("the current process reads both markers from the environment", () =>
    Effect.gen(function* () {
      const current = yield* currentCiLaneProcess.pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({ GITHUB_ACTIONS: "true", [CI_LANE_RECORDED_ENV]: "1" })
        )
      );
      assertSome(current.githubActions, "true");
      assertSome(current.recorded, "1");
      assertNone(ciLaneSelfCommand(current));
    })
  );
});

describe("the lane run's report", () => {
  it("a zero exit is one passed step under the lane gate", () => {
    const report = Result.getOrThrow(reduceEvents(laneRunEvents(laneRun(0))));
    deepStrictEqual(
      [report.gate, report.subject, report.itemKind, report.reason, report.outcome],
      [CI_LANE_GATE, "nix", "step", "passed", "all-pass"]
    );
    deepStrictEqual(
      A.map(report.items, (item) => [item.name, item.outcome]),
      [["ci lane nix", "passed"]]
    );
  });

  it("any other exit is an errored run whose fault names the exit", () => {
    const report = Result.getOrThrow(reduceEvents(laneRunEvents(laneRun(3))));
    deepStrictEqual([report.reason, report.outcome], ["errored", "some-fail"]);
    deepStrictEqual(
      A.map(report.items, (item) => [item.name, item.outcome]),
      [["errored", "failed"]]
    );
  });

  it("the record is a root run of the lane gate", () => {
    deepStrictEqual(recordLocation(ciLaneRecordTarget("20261122T100000000Z-0001")), {
      record: ".beep/gates/lane/20261122T100000000Z-0001.json",
      log: ".beep/gates/lane/20261122T100000000Z-0001.log",
    });
  });

  it("a step wrote a record when one is new or written again", () => {
    const before = HashMap.make(["packages/a/.beep/gates/test/report.json", 1]);
    assertTrue(stepWroteGateRecords(before, HashMap.make(["packages/a/.beep/gates/test/report.json", 2])));
    assertTrue(stepWroteGateRecords(HashMap.make(["packages/b/.beep/gates/test/report.json", 1]))(before));
    strictEqual(stepWroteGateRecords(before, before), false);
  });
});

const childScript = (lines: ReadonlyArray<string>, exitCode: number, writesRecord = false) =>
  A.join(
    [
      ...(writesRecord
        ? [
            'require("node:fs").mkdirSync("pkg/.beep/gates/test", { recursive: true });',
            'require("node:fs").writeFileSync("pkg/.beep/gates/test/report.json", "{}");',
          ]
        : []),
      `process.stdout.write(${JSON.stringify(A.join(lines, "\n"))} + "\\n");`,
      `process.stderr.write("recorded=" + process.env.${CI_LANE_RECORDED_ENV} + "\\n");`,
      `process.exit(${exitCode});`,
    ],
    "\n"
  );

const requestFor = (repoRoot: string, script: string, command = process.execPath) =>
  CiLaneRecordingRequest.make({
    repoRoot,
    lane: "docs-policy",
    self: CiLaneSelfCommand.make({ command, args: ["-e", script] }),
  });

const capturedStdout = Effect.gen(function* () {
  const chunks = yield* Ref.make(A.empty<string>());
  const decoder = new TextDecoder();
  const layer = Stdio.layerTest({
    stdout: () =>
      Sink.forEach((chunk: string | Uint8Array) =>
        Ref.update(chunks, A.append(typeof chunk === "string" ? chunk : decoder.decode(chunk)))
      ),
  });
  return { chunks, layer };
});

const withRecorder = <A, E, R>(stdio: Layer.Layer<Stdio.Stdio>, effect: Effect.Effect<A, E, R | CiLaneRecorder>) =>
  effect.pipe(
    Effect.provide(CiLaneRecorder.layer.pipe(Layer.provide(stdio))),
    Effect.provideServiceEffect(Console.Console, TestConsole.make)
  );

const record = (request: CiLaneRecordingRequest) => CiLaneRecorder.use((recorder) => recorder.record(request));

it.layer(NodeServices.layer, { timeout: "60 seconds" })("a recorded lane step", (it) => {
  it.effect("tees the child's output, counts its annotation commands and records a passing lane", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const temp = yield* fs.makeTempDirectoryScoped({ prefix: "beep-ci-lane-recording-pass-" });
      const root = yield* fs.realPath(temp);
      const stdout = yield* capturedStdout;
      const recording = yield* withRecorder(
        stdout.layer,
        record(requestFor(root, childScript(["::error file=a.ts::x", "::warning::y", "plain"], 0)))
      );
      strictEqual(recording.exitCode, 0);
      deepStrictEqual([recording.commands.errors, recording.commands.warnings, recording.commands.notices], [1, 1, 0]);
      const teed = A.join(yield* Ref.get(stdout.chunks), "");
      assertTrue(Str.includes("::warning::y")(teed));
      assertTrue(Str.includes("recorded=1")(teed));
      assertTrue(O.isSome(recording.record));
      const found = yield* findJobGateRecords(root);
      deepStrictEqual(
        A.map(found, (entry) => [entry.report.gate, entry.report.subject, entry.report.outcome]),
        [[CI_LANE_GATE, "docs-policy", "all-pass"]]
      );
      const log = yield* fs.readFileString(path.join(root, recordLocation(O.getOrThrow(recording.record)).log));
      assertTrue(Str.includes("::error file=a.ts::x")(log));
      const used = yield* readAnnotationsUsed(root);
      deepStrictEqual([used.errors, used.warnings, used.notices], [1, 1, 0]);
    })
  );

  it.effect("records a failing lane as errored with its log excerpt and adds to the annotation count", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const temp = yield* fs.makeTempDirectoryScoped({ prefix: "beep-ci-lane-recording-fail-" });
      const root = yield* fs.realPath(temp);
      const stdout = yield* capturedStdout;
      const noisy = A.makeBy(12, (index) => `::error::red ${index}`);
      yield* withRecorder(stdout.layer, record(requestFor(root, childScript(["::notice::first"], 0))));
      const recording = yield* withRecorder(stdout.layer, record(requestFor(root, childScript(noisy, 3))));
      strictEqual(recording.exitCode, 3);
      strictEqual(recording.commands.errors, 12);
      const found = yield* findJobGateRecords(root);
      deepStrictEqual(
        A.sort(
          A.map(found, (entry) => entry.report.reason),
          Order.String
        ),
        ["errored", "passed"]
      );
      const messages = A.flatMap(found, (entry) =>
        A.flatMap(entry.report.items, (item) => A.fromOption(O.map(item.detail, (detail) => detail.message)))
      );
      assertTrue(A.some(messages, Str.includes("::error::red 11")));
      const used = yield* readAnnotationsUsed(root);
      deepStrictEqual([used.errors, used.warnings, used.notices], [10, 0, 1]);
    })
  );

  it.effect("writes no lane record when the step wrote a gate record of its own", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const temp = yield* fs.makeTempDirectoryScoped({ prefix: "beep-ci-lane-recording-own-" });
      const root = yield* fs.realPath(temp);
      const stdout = yield* capturedStdout;
      const recording = yield* withRecorder(stdout.layer, record(requestFor(root, childScript(["ok"], 0, true))));
      assertNone(recording.record);
      const laneDir = yield* fs.exists(path.join(root, ".beep", "gates", CI_LANE_GATE));
      strictEqual(laneDir, false);
      const stamps = yield* gateRecordStamps(root);
      deepStrictEqual(A.fromIterable(HashMap.keys(stamps)), ["pkg/.beep/gates/test/report.json"]);
    })
  );

  it.effect("a broken annotation count is reported and the lane is still recorded", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const temp = yield* fs.makeTempDirectoryScoped({ prefix: "beep-ci-lane-recording-broken-" });
      const root = yield* fs.realPath(temp);
      yield* fs.makeDirectory(path.join(root, ".beep", "ci"), { recursive: true });
      yield* fs.writeFileString(path.join(root, CI_ANNOTATIONS_USED_PATH), "not json");
      const stdout = yield* capturedStdout;
      const errors = yield* withRecorder(
        stdout.layer,
        record(requestFor(root, childScript(["ok"], 0))).pipe(Effect.andThen(TestConsole.errorLines))
      );
      deepStrictEqual(A.map(errors, String), [
        "[ci] lane recording: .beep/ci/annotations-used.json is not a ci-annotations-used/v1 record.",
      ]);
      const found = yield* findJobGateRecords(root);
      strictEqual(found.length, 1);
    })
  );

  it.effect("stops reading a lane whose descendant keeps its output open after it exited", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const temp = yield* fs.makeTempDirectoryScoped({ prefix: "beep-ci-lane-recording-linger-" });
      const root = yield* fs.realPath(temp);
      const stdout = yield* capturedStdout;
      const lingering = A.join(
        [
          `require("node:child_process").spawn(process.execPath, ["-e", "setTimeout(() => {}, 30000)"], { stdio: "inherit" });`,
          `process.stdout.write("::notice::left running\\n");`,
          "process.exit(0);",
        ],
        "\n"
      );
      const started = yield* Clock.currentTimeMillis;
      const errors = yield* withRecorder(
        stdout.layer,
        record(CiLaneRecordingRequest.make({ ...requestFor(root, lingering), drainGraceMs: 300 })).pipe(
          Effect.andThen((recording) => Effect.map(TestConsole.errorLines, (lines) => ({ recording, lines })))
        )
      );
      const finished = yield* Clock.currentTimeMillis;
      assertTrue(finished - started < 20_000);
      strictEqual(errors.recording.exitCode, 0);
      strictEqual(errors.recording.commands.notices, 1);
      deepStrictEqual(A.map(errors.lines, String), [
        "[ci] docs-policy: the lane exited and its output stayed open 300 ms more; its process group is stopped.",
      ]);
    }).pipe(TestClock.withLive)
  );

  it.effect("a lane that cannot start fails the step", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const temp = yield* fs.makeTempDirectoryScoped({ prefix: "beep-ci-lane-recording-missing-" });
      const stdout = yield* capturedStdout;
      const error = yield* withRecorder(
        stdout.layer,
        record(requestFor(temp, "", "/home/alice/no-such-executable")).pipe(Effect.flip)
      );
      strictEqual(error.message, "Failed to run /home/alice/no-such-executable -e .");
    })
  );

  it.effect("the step exits with the lane child's exit code", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const temp = yield* fs.makeTempDirectoryScoped({ prefix: "beep-ci-lane-recording-exit-" });
      const root = yield* fs.realPath(temp);
      const stdout = yield* capturedStdout;
      yield* withRecorder(stdout.layer, recordCiLaneStep(requestFor(root, childScript(["ok"], 0))));
      const failure = yield* withRecorder(
        stdout.layer,
        recordCiLaneStep(requestFor(root, childScript(["red"], 2))).pipe(Effect.flip)
      );
      deepStrictEqual(
        [failure._tag, failure.exitCode, failure.gate, failure.subject],
        ["GateToolExit", 2, CI_LANE_GATE, "docs-policy"]
      );
    })
  );
});
