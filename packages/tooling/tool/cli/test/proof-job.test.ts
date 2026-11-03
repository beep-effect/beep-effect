import { Git } from "@beep/git/Git";
import { $RepoCliId } from "@beep/identity/packages";
import { yeetCommand } from "@beep/repo-cli/commands/Yeet";
import { acquireJournalFileLock, MemoryStats, releaseJournalFileLock } from "@beep/repo-cli/test/RepoRun";
import { UUID } from "@beep/repo-cli/test/SharedInternals";
import * as Job from "@beep/repo-cli/test/Yeet";
import {
  attemptJournalPathForCheckout,
  ProofJobLauncher,
  readYeetAckState,
  YeetInboxRowJson,
  yeetProofJobRowId,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Command from "effect/cli/Command";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import { commandArgs } from "./support/commandArgs.ts";
import { waitTimesOut } from "./support/ProofJobWait.ts";

// `Git` rides beside the platform services: repo-cli's typed git readers take it from the context (W1a).
const gitLayer = Git.layer.pipe(Layer.provide(NodeServices.layer));

const $I = $RepoCliId.create("test/proof-job.test");
const stamp = "2026-09-15T00:00:00.000Z";
const encodeJsonLine = S.encodeEffect(S.fromJsonString(S.Unknown));
const encodeRecordJson = S.encodeEffect(S.fromJsonString(Job.ProofJobRecord));
const decodeServiceResult = S.decodeUnknownEffect(Job.ProofJobServiceResult);
const attemptId = UUID.make("0f5c9a3e-6d3b-4c1e-9a8f-2b7d1c4e5a60");
const submission = (root: string) =>
  Job.ProofJobSubmission.make({
    request: Job.ProofJobRequest.make({
      mode: "verify",
      argv: ["verify", "--detach", "--job-max-runtime=1h", "--tier", "cheap-gates"],
      checkout: root,
      branch: "feat/job",
      base: "main",
      head: "abc123",
      forwardedEnvNames: [],
    }),
    submitter: Job.ProofJobSubmitter.make({ pid: process.pid, cwd: root }),
    execPath: "/opt/bun with spaces",
    entrypoint: "/repo/cli.ts",
    maxRuntimeSeconds: O.some(3600),
  });
const monitorSubmission = (root: string) =>
  Job.ProofJobSubmission.make({
    ...submission(root),
    request: Job.ProofJobRequest.make({
      ...submission(root).request,
      mode: "monitor",
      argv: ["monitor", "--until-ready"],
    }),
  });
const writeExecutable = Effect.fnUntraced(function* (path: string, text: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(path, text);
  yield* fs.chmod(path, 0o755);
});
const terminalUnit = Effect.fnUntraced(function* (root: string, overrides: Readonly<Record<string, string>> = {}) {
  const properties = {
    ActiveState: "failed",
    SubState: "failed",
    MainPID: "0",
    ControlPID: "0",
    TasksCurrent: "0",
    ControlGroup: "/user.slice/owned.service",
    Result: "timeout",
    ExecMainCode: "1",
    ExecMainStatus: "130",
    InvocationID: "11111111111111111111111111111111",
    ...overrides,
  };
  const lines = A.join(
    A.map(R.toEntries(properties), ([key, value]) => `${key}=${value}`),
    "\n"
  );
  yield* writeExecutable(
    `${root}/systemctl`,
    `#!/bin/sh\n[ "$5" = LoadState ] && { printf 'loaded\\n'; exit 0; }\nprintf '%s\\n' '${lines}'\n`
  );
});
const runFixture = Effect.fnUntraced(function* <Value, Error, Requirements>(
  use: (root: string) => Effect.Effect<Value, Error, Requirements>,
  exitCode: number
) {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "proof-job-test-" });
  yield* writeExecutable(`${root}/busctl`, "#!/bin/sh\nexit 0\n");
  yield* writeExecutable(
    `${root}/systemd-run`,
    `#!/bin/sh\nprintf '%s\\n' "$@" > '${root}/launch.argv'\nprintf 'launch result\\n'\nexit ${exitCode}\n`
  );
  yield* writeExecutable(
    `${root}/systemctl`,
    `#!/bin/sh\nprintf '%s\\n' "$@" >> '${root}/systemctl.argv'\nprintf 'loaded\\n'\n`
  );
  return yield* use(root).pipe(
    provideScopedLayer(
      ConfigProvider.layer(
        ConfigProvider.fromUnknown({
          PATH: root,
          BEEP_RUN_SCOPES: "1",
          BEEP_QUALITY_CHEAP_GATE_CONCURRENCY: "1",
          TURBO_TOKEN: "private",
          OP_SERVICE_ACCOUNT_TOKEN: "private",
          BEEP_FOO_KEY: "private",
        })
      )
    )
  );
});
const fixture = <Value, Error, Requirements>(
  use: (root: string) => Effect.Effect<Value, Error, Requirements>,
  exitCode = 0
) => runFixture(use, exitCode).pipe(provideScopedLayer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, gitLayer)));
const running = Effect.fnUntraced(function* (root: string, launcher: Job.ProofJobLauncherShape, id: UUID) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const journal = yield* attemptJournalPathForCheckout(root, "feat/job");
  yield* fs.makeDirectory(path.dirname(journal), { recursive: true });
  const start = yield* encodeJsonLine({
    schemaVersion: "yeet-attempt-journal/v1",
    _tag: "attempt-started",
    attemptId,
    startedAt: stamp,
    ownerPid: process.pid,
  });
  yield* fs.writeFileString(journal, `${start}\n`);
  yield* launcher.markRunning(
    id,
    Job.ProofJobRunner.make({
      pid: 2147483647,
      procStart: O.some("proc:1"),
      attemptId: O.some(attemptId),
      startedAt: stamp,
    })
  );
  return journal;
});
const inbox = Effect.fnUntraced(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(`${root}/.beep/inbox/failures.ndjson`);
  return A.getSomes(A.map(A.filter(Str.split(text, "\n"), Str.isNonEmpty), YeetInboxRowJson.decodeOption));
});

const waveRow = Effect.fnUntraced(function* (root: string, prNumber: number, lane: string) {
  const capsule = Job.YeetFailureCapsule.make({
    bucket: "fail",
    headSha: "abc123",
    lane,
    link: `https://github.com/beep/repo/actions/runs/${prNumber}`,
    observedAt: stamp,
    prNumber,
    state: "FAILURE",
    workflow: "CI",
  });
  const row = Job.YeetCheckFailedRow.make({
    capsule,
    checkout: root,
    id: yield* Job.yeetInboxRowId(capsule),
    severity: "P0",
    ts: stamp,
  });
  yield* Job.appendYeetInboxRow(root, row);
  return row;
});

// A top-level comment row (pr-event-awareness W4): P1, wave-exempt, on one pull request.
const commentRow = Effect.fnUntraced(function* (root: string, prNumber: number, commentId: number) {
  const capsule = Job.YeetPrCommentCapsule.make({
    author: "reviewer",
    commentId,
    createdAt: stamp,
    excerpt: "Please rebase onto main.",
    headSha: "abc123",
    link: `https://github.com/beep/repo/pull/${prNumber}#issuecomment-${commentId}`,
    prNumber,
    source: "issue",
  });
  const row = Job.YeetPrCommentRow.make({
    capsule,
    checkout: root,
    id: yield* Job.yeetPrCommentRowId(capsule),
    severity: "P1",
    ts: stamp,
  });
  yield* Job.appendYeetInboxRow(root, row);
  return row;
});

describe("proof job schemas", () => {
  it.effect.prop(
    "round trips ProofJobPhase",
    [Arbitrary.schema(Job.ProofJobPhase)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobPhase);
      const json = yield* S.encodeEffect(codec)(value);
      const argument = S.toEquivalence(Job.ProofJobPhase);
      const value1 = yield* S.decodeEffect(codec)(json);
      expect(argument(value1, value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobServiceResult",
    [Arbitrary.schema(Job.ProofJobServiceResult)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobServiceResult);
      const json = yield* S.encodeEffect(codec)(value);
      const argument1 = S.toEquivalence(Job.ProofJobServiceResult);
      const value2 = yield* S.decodeEffect(codec)(json);
      expect(argument1(value2, value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobExitCode",
    [Arbitrary.schema(Job.ProofJobExitCode)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobExitCode);
      const json = yield* S.encodeEffect(codec)(value);
      const argument2 = S.toEquivalence(Job.ProofJobExitCode);
      const value3 = yield* S.decodeEffect(codec)(json);
      expect(argument2(value3, value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobTerminationReason",
    [Arbitrary.schema(Job.ProofJobTerminationReason)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobTerminationReason);
      const json = yield* S.encodeEffect(codec)(value);
      const argument3 = S.toEquivalence(Job.ProofJobTerminationReason);
      const value4 = yield* S.decodeEffect(codec)(json);
      expect(argument3(value4, value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobRowSeverity",
    [Arbitrary.schema(Job.ProofJobRowSeverity)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobRowSeverity);
      const json = yield* S.encodeEffect(codec)(value);
      const argument4 = S.toEquivalence(Job.ProofJobRowSeverity);
      const value5 = yield* S.decodeEffect(codec)(json);
      expect(argument4(value5, value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobObservedVia",
    [Arbitrary.schema(Job.ProofJobObservedVia)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobObservedVia);
      const json = yield* S.encodeEffect(codec)(value);
      const argument5 = S.toEquivalence(Job.ProofJobObservedVia);
      const value6 = yield* S.decodeEffect(codec)(json);
      expect(argument5(value6, value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobCancelOutcome",
    [Arbitrary.schema(Job.ProofJobCancelOutcome)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobCancelOutcome);
      const json = yield* S.encodeEffect(codec)(value);
      const argument6 = S.toEquivalence(Job.ProofJobCancelOutcome);
      const value7 = yield* S.decodeEffect(codec)(json);
      expect(argument6(value7, value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobRequest",
    [Arbitrary.schema(Job.ProofJobRequest)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobRequest);
      const json = yield* S.encodeEffect(codec)(value);
      const argument7 = S.toEquivalence(Job.ProofJobRequest);
      const value8 = yield* S.decodeEffect(codec)(json);
      expect(argument7(value8, value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobSubmitter",
    [Arbitrary.schema(Job.ProofJobSubmitter)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobSubmitter);
      const json = yield* S.encodeEffect(codec)(value);
      const argument8 = S.toEquivalence(Job.ProofJobSubmitter);
      const value9 = yield* S.decodeEffect(codec)(json);
      expect(argument8(value9, value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobUnit",
    [Arbitrary.schema(Job.ProofJobUnit)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobUnit);
      const json = yield* S.encodeEffect(codec)(value);
      const argument9 = S.toEquivalence(Job.ProofJobUnit);
      const value10 = yield* S.decodeEffect(codec)(json);
      expect(argument9(value10, value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobRunner",
    [Arbitrary.schema(Job.ProofJobRunner)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobRunner);
      const json = yield* S.encodeEffect(codec)(value);
      const argument10 = S.toEquivalence(Job.ProofJobRunner);
      const value11 = yield* S.decodeEffect(codec)(json);
      expect(argument10(value11, value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobOutcome",
    [Arbitrary.schema(Job.ProofJobOutcome)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobOutcome);
      const json = yield* S.encodeEffect(codec)(value);
      const argument11 = S.toEquivalence(Job.ProofJobOutcome);
      const value12 = yield* S.decodeEffect(codec)(json);
      expect(argument11(value12, value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobSystemdResult",
    [Arbitrary.schema(Job.ProofJobSystemdResult)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobSystemdResult);
      const json = yield* S.encodeEffect(codec)(value);
      const argument12 = S.toEquivalence(Job.ProofJobSystemdResult);
      const value13 = yield* S.decodeEffect(codec)(json);
      expect(argument12(value13, value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobRecord",
    [Arbitrary.schema(Job.ProofJobRecord)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobRecord);
      const json = yield* S.encodeEffect(codec)(value);
      const argument13 = S.toEquivalence(Job.ProofJobRecord);
      const value14 = yield* S.decodeEffect(codec)(json);
      expect(argument13(value14, value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips YeetProofJobCapsule",
    [Arbitrary.schema(Job.YeetProofJobCapsule)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.YeetProofJobCapsule);
      const json = yield* S.encodeEffect(codec)(value);
      const argument14 = S.toEquivalence(Job.YeetProofJobCapsule);
      const value15 = yield* S.decodeEffect(codec)(json);
      expect(argument14(value15, value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobSubmission",
    [Arbitrary.schema(Job.ProofJobSubmission)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobSubmission);
      const json = yield* S.encodeEffect(codec)(value);
      const argument15 = S.toEquivalence(Job.ProofJobSubmission);
      const value16 = yield* S.decodeEffect(codec)(json);
      expect(argument15(value16, value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobWaitOptions",
    [Arbitrary.schema(Job.ProofJobWaitOptions)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobWaitOptions);
      const json = yield* S.encodeEffect(codec)(value);
      const argument16 = S.toEquivalence(Job.ProofJobWaitOptions);
      const value17 = yield* S.decodeEffect(codec)(json);
      expect(argument16(value17, value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobFinalization",
    [Arbitrary.schema(Job.ProofJobFinalization)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobFinalization);
      const json = yield* S.encodeEffect(codec)(value);
      const argument17 = S.toEquivalence(Job.ProofJobFinalization);
      const value18 = yield* S.decodeEffect(codec)(json);
      expect(argument17(value18, value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it("strips only submission flags and denies credential-shaped names", () => {
    expect(
      Job.stripProofJobSubmitFlags(["verify", "--detach", "--job-max-runtime", "1h", "--job-max-runtime=2h", "--json"])
    ).toEqual(["verify", "--json"]);
    expect(
      Job.forwardedProofJobEnvironment({
        PATH: "/bin",
        BEEP_RUN_SCOPES: "1",
        TURBO_TOKEN: "secret",
        OP_SERVICE_ACCOUNT_TOKEN: "secret",
        BEEP_FOO_KEY: "secret",
        OTHER: "x",
      })
    ).toEqual({ PATH: "/bin", BEEP_RUN_SCOPES: "1" });
    expect(
      Job.forwardedProofJobEnvironment({
        CLAUDE_CODE_SESSION_ID: "claude-session",
        CODEX_THREAD_ID: "codex-thread",
        CLAUDE_CODE_ENTRYPOINT: "cli",
      })
    ).toEqual({ CLAUDE_CODE_SESSION_ID: "claude-session", CODEX_THREAD_ID: "codex-thread" });
  });
});

describe("proof job launcher", () => {
  it.layer(TestConsole.layer, { timeout: "30 seconds" })((it) => {
    it.effect("treats an invalid detached job identity as attached and reports the read failure", () =>
      fixture(
        Effect.fnUntraced(function* (root) {
          const found = yield* Job.readCurrentProofJobRecord(root).pipe(
            Effect.provideService(
              ConfigProvider.ConfigProvider,
              ConfigProvider.fromUnknown({ BEEP_YEET_JOB_ID: "invalid-job-id" })
            )
          );
          assertNone(found);
          const errors = yield* TestConsole.errorLines;
          expect(A.join(A.filter(errors, P.isString), "\n")).toContain(
            "[yeet] job record read failed: Invalid proof job id."
          );
        })
      )
    );
  });

  it.effect("submits a durable record and exact service arguments without secret values", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const fs = yield* FileSystem.FileSystem;
        const launcher = yield* ProofJobLauncher.make(root);
        const record = yield* launcher.submit(submission(root));
        expect(record.phase).toBe("submitted");
        expect(record.request.forwardedEnvNames).toContain("BEEP_QUALITY_CHEAP_GATE_CONCURRENCY");
        const args = yield* fs.readFileString(`${root}/launch.argv`);
        for (const text of [
          "--collect",
          "--service-type=exec",
          "--expand-environment=no",
          "--slice=agent-runs.slice",
          "--setenv=BEEP_QUALITY_CHEAP_GATE_CONCURRENCY=1",
          "TimeoutStopSec=60",
          "RuntimeMaxSec=3600",
          `StandardOutput=append:${record.unit.logPath}`,
          `StandardError=append:${record.unit.logPath}`,
          `--working-directory=${root}`,
          `--unit=${record.unit.unitName}`,
          'ExecStopPost="/opt/bun with spaces" "/repo/cli.ts" "yeet" "job" "finalize"',
        ])
          expect(args).toContain(text);
        expect(args).not.toContain("--detach");
        expect(args).not.toContain("private");
        expect(args).toContain("--\n/opt/bun with spaces\n/repo/cli.ts\nyeet\nverify\n--tier\ncheap-gates");
        const readFileString1 = yield* fs.readFileString(`${root}/.beep/yeet/jobs/${record.jobId}.json`);
        expect(readFileString1).not.toContain("private");
      })
    )
  );
  it.effect("retains a failed launch record and captured output", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const launcher = yield* ProofJobLauncher.make(root);
        const failure = yield* launcher.submit(submission(root)).pipe(Effect.flip);
        expect(failure.message).toContain("launch result");
        const records = yield* launcher.list;
        expect(records[0]?.phase).toBe("terminated");
        expect(O.getOrNull(records[0]?.terminationReason ?? O.none())).toBe("job-start-failed");
      }),
      1
    )
  );
  it.effect("refuses unsupported detachment before writing a record", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const fs = yield* FileSystem.FileSystem;
        yield* writeExecutable(`${root}/busctl`, "#!/bin/sh\nexit 1\n");
        const launcher = yield* ProofJobLauncher.make(root);
        expect((yield* launcher.submit(submission(root)).pipe(Effect.flip)).message).toContain("systemd");
        const exists2 = yield* fs.exists(`${root}/.beep/yeet/jobs`);
        expect(exists2).toBe(false);
      })
    )
  );
  for (const [result, reason] of [
    ["signal", "signal"],
    ["oom-kill", "oom-killed"],
    ["timeout", "timeout"],
    ["protocol", "job-start-failed"],
  ]) {
    it.effect(`finalizes ${result} once in the journal and inbox`, () =>
      fixture(
        Effect.fnUntraced(function* (root) {
          const fs = yield* FileSystem.FileSystem;
          const launcher = yield* ProofJobLauncher.make(root);
          const record = yield* launcher.submit(submission(root));
          const journal = yield* running(root, launcher, record.jobId);
          const serviceResult = yield* decodeServiceResult(result);
          const systemd = Job.ProofJobSystemdResult.make({
            serviceResult,
            exitCode: O.some("killed"),
            exitStatus: O.some("KILL"),
            finalizedAt: stamp,
          });
          const finalized = yield* launcher.finalize(record.jobId, systemd);
          expect(finalized.record.phase).toBe("terminated");
          expect(O.getOrNull(finalized.record.terminationReason)).toBe(reason);
          expect(finalized.attemptTerminated).toBe(true);
          expect((yield* launcher.finalize(record.jobId, systemd)).duplicate).toBe(true);
          const readFileString3 = yield* fs.readFileString(journal);
          expect(A.length(Str.split(readFileString3, '"attempt-terminated"'))).toBe(2);
          const rows = yield* inbox(root);
          expect(rows).toHaveLength(1);
          expect(rows[0]?.severity).toBe("P1");
        })
      )
    );
  }
  it.effect("republishes a settled record whose publication never landed", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const fs = yield* FileSystem.FileSystem;
        const launcher = yield* ProofJobLauncher.make(root);
        const record = yield* launcher.submit(submission(root));
        const journal = yield* running(root, launcher, record.jobId);
        const finalized = yield* launcher.finalize(
          record.jobId,
          Job.ProofJobSystemdResult.make({ serviceResult: "signal", finalizedAt: stamp })
        );
        finalized.record.publishedAt.pipe(O.isSome, assertTrue);
        // Simulate a crash between the stamp and the publish: drop the publication stamp and
        // the inbox row, then let an ordinary read repair both.
        const recordPath = `${root}/.beep/yeet/jobs/${record.jobId}.json`;
        yield* fs.writeFileString(
          recordPath,
          `${yield* encodeRecordJson(Job.ProofJobRecord.make({ ...finalized.record, publishedAt: O.none() }))}\n`
        );
        yield* fs.remove(`${root}/.beep/inbox/failures.ndjson`, { force: true });
        yield* fs.remove(`${root}/.beep/inbox/active.ndjson`, { force: true });
        const read4 = yield* launcher.read(record.jobId);
        const repaired = O.getOrThrow(read4);
        repaired.publishedAt.pipe(O.isSome, assertTrue);
        const inbox5 = yield* inbox(root);
        expect(inbox5).toHaveLength(1);
        const readFileString6 = yield* fs.readFileString(journal);
        expect(A.length(Str.split(readFileString6, '"attempt-terminated"'))).toBe(2);
        yield* launcher.read(record.jobId);
        const inbox7 = yield* inbox(root);
        expect(inbox7).toHaveLength(1);
        const readFileString8 = yield* fs.readFileString(journal);
        expect(A.length(Str.split(readFileString8, '"attempt-terminated"'))).toBe(2);
      })
    )
  );
  it.effect("preserves a normal verdict, reports P2, and wait acknowledges observation", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const launcher = yield* ProofJobLauncher.make(root);
        const record = yield* launcher.submit(submission(root));
        yield* launcher.markFinished(
          record.jobId,
          Job.ProofJobOutcome.make({ verdictOutcome: "success", endedAt: stamp })
        );
        const finalized = yield* launcher.finalize(
          record.jobId,
          Job.ProofJobSystemdResult.make({ serviceResult: "success", finalizedAt: stamp })
        );
        expect(finalized.attemptTerminated).toBe(false);
        expect((yield* inbox(root))[0]?.severity).toBe("P2");
        expect(
          (yield* launcher.wait(record.jobId, Job.ProofJobWaitOptions.make({ pollIntervalMs: 1 }))).record.phase
        ).toBe("finished");
        const ack = yield* readYeetAckState(root, yeetProofJobRowId(record));
        expect(ack.receipt?.resolution).toMatchObject({ kind: "observed", via: "job-wait" });
      })
    )
  );
  it.effect("records cancel before stop and cancellation wins the systemd reason", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const fs = yield* FileSystem.FileSystem;
        const launcher = yield* ProofJobLauncher.make(root);
        const record = yield* launcher.submit(submission(root));
        const cancel9 = yield* launcher.cancel(record.jobId);
        expect(cancel9).toBe("stop-requested");
        const readFileString10 = yield* fs.readFileString(`${root}/systemctl.argv`);
        expect(readFileString10).toContain(`--user\nstop\n${record.unit.unitName}`);
        const result = yield* launcher.finalize(
          record.jobId,
          Job.ProofJobSystemdResult.make({ serviceResult: "signal", finalizedAt: stamp })
        );
        expect(O.getOrNull(result.record.terminationReason)).toBe("cancelled");
      })
    )
  );
  it.effect("stops a retiring lane's live jobs and leaves its settled ones", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const fs = yield* FileSystem.FileSystem;
        const launcher = yield* ProofJobLauncher.make(root);
        const monitor = yield* launcher.submit(monitorSubmission(root));
        const settled = yield* launcher.submit(submission(root));
        yield* launcher.finalize(
          settled.jobId,
          Job.ProofJobSystemdResult.make({ serviceResult: "success", finalizedAt: stamp })
        );
        const plan = Job.YeetRetirePlan.make({
          worktreePath: root,
          owningClone: "/clone",
          name: "lane",
          branch: "feat/job",
        });

        const stopped = yield* Job.stopLaneJobs(plan);

        expect(stopped).toStrictEqual([Job.StoppedLaneJob.make({ jobId: monitor.jobId, outcome: "stop-requested" })]);
        const argv = yield* fs.readFileString(`${root}/systemctl.argv`);
        expect(argv).toContain(`--user\nstop\n${monitor.unit.unitName}`);
        expect(argv).not.toContain(settled.unit.unitName);
        expect(Job.renderStoppedLaneJobs(stopped)).toBe(`  lane job ${monitor.jobId}: stop-requested`);
        expect(Job.renderStoppedLaneJobs([])).toBe("");
      })
    )
  );
  it.effect("stops a finished lane job's unit before its finalizer ran, keeping its outcome", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const fs = yield* FileSystem.FileSystem;
        const launcher = yield* ProofJobLauncher.make(root);
        const finished = yield* launcher.submit(submission(root));
        // The loop ended, but systemd has not run the finalizer: the unit is still loaded.
        yield* launcher.markFinished(
          finished.jobId,
          Job.ProofJobOutcome.make({ verdictOutcome: "success", endedAt: stamp })
        );
        const plan = Job.YeetRetirePlan.make({
          worktreePath: root,
          owningClone: "/clone",
          name: "lane",
          branch: "feat/job",
        });

        const stopped = yield* Job.stopLaneJobs(plan);

        expect(stopped).toStrictEqual([Job.StoppedLaneJob.make({ jobId: finished.jobId, outcome: "stop-requested" })]);
        const readFileString11 = yield* fs.readFileString(`${root}/systemctl.argv`);
        expect(readFileString11).toContain(`--user\nstop\n${finished.unit.unitName}`);
        const read12 = yield* launcher.read(finished.jobId);
        const saved = O.getOrThrow(read12);
        assertNone(saved.cancelRequestedAt);
        assertSome(
          O.map(saved.outcome, (outcome) => outcome.verdictOutcome),
          "success"
        );
      })
    )
  );
  it.effect("leaves a settled job's unit alone when asked to stop it", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const launcher = yield* ProofJobLauncher.make(root);
        const record = yield* launcher.submit(submission(root));
        yield* launcher.finalize(
          record.jobId,
          Job.ProofJobSystemdResult.make({ serviceResult: "success", finalizedAt: stamp })
        );

        const stopUnit13 = yield* launcher.stopUnit(record.jobId);
        expect(stopUnit13).toBe("already-terminal");
      })
    )
  );
  it.effect("stops nothing when a retiring lane's job listing cannot be read", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const fs = yield* FileSystem.FileSystem;
        // A file where the jobs directory belongs: the listing fails.
        yield* fs.makeDirectory(`${root}/.beep/yeet`, { recursive: true });
        yield* fs.writeFileString(`${root}/.beep/yeet/jobs`, "not a directory");
        const plan = Job.YeetRetirePlan.make({
          worktreePath: root,
          owningClone: "/clone",
          name: "lane",
          branch: "feat/job",
        });

        const stopLaneJobs14 = yield* Job.stopLaneJobs(plan);
        expect(stopLaneJobs14).toStrictEqual([]);
      })
    )
  );
  it.effect("rolls the cancel stamp back when the stop fails and the unit is still loaded", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const launcher = yield* ProofJobLauncher.make(root);
        const record = yield* launcher.submit(monitorSubmission(root));
        yield* launcher.bindPullRequest(record.jobId, 1427);
        // `systemctl --user stop` exits non-zero; `systemctl --user show -p LoadState` still says loaded.
        yield* writeExecutable(
          `${root}/systemctl`,
          `#!/bin/sh\nprintf '%s\\n' "$@" >> '${root}/systemctl.argv'\n[ "$2" = stop ] && exit 1\nprintf 'loaded\\n'\n`
        );
        const cancel15 = yield* launcher.cancel(record.jobId);
        expect(cancel15).toBe("stop-failed");
        const read16 = yield* launcher.read(record.jobId);
        const saved = O.getOrThrow(read16);
        assertNone(saved.cancelRequestedAt);
        expect(saved.phase).toBe("submitted");
        // Publish reuses the monitor again instead of submitting a second one for the same pull request.
        expect(Job.isLiveReadyMonitorJob(saved, { branch: "feat/job", prNumber: 1427 })).toBe(true);
      })
    )
  );
  it.effect("keeps the cancel stamp when the stop fails because the unit is absent", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const launcher = yield* ProofJobLauncher.make(root);
        const record = yield* launcher.submit(monitorSubmission(root));
        yield* writeExecutable(`${root}/systemctl`, `#!/bin/sh\n[ "$2" = stop ] && exit 1\nprintf 'not-found\\n'\n`);
        const cancel17 = yield* launcher.cancel(record.jobId);
        expect(cancel17).toBe("unit-absent");
        const read18 = yield* launcher.read(record.jobId);
        const saved = O.getOrThrow(read18);
        saved.cancelRequestedAt.pipe(O.isSome, assertTrue);
        expect(Job.isLiveReadyMonitorJob(saved, { branch: "feat/job", prNumber: 1427 })).toBe(false);
      })
    )
  );
  it.effect("reconciles a missing unit with a dead runner identity", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const launcher = yield* ProofJobLauncher.make(root);
        const record = yield* launcher.submit(submission(root));
        yield* running(root, launcher, record.jobId);
        yield* writeExecutable(`${root}/systemctl`, "#!/bin/sh\nprintf 'not-found\\n'\n");
        const result = yield* launcher.read(record.jobId);
        expect(O.getOrNull(O.flatMap(result, (value) => value.terminationReason))).toBe("finalizer-missing");
        expect((yield* inbox(root))[0]?.severity).toBe("P1");
      })
    )
  );
  it.effect("recovers a loaded failed unit without reset and retains timeout evidence", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const fs = yield* FileSystem.FileSystem;
        const launcher = yield* ProofJobLauncher.make(root);
        const record = yield* launcher.submit(submission(root));
        const journal = yield* running(root, launcher, record.jobId);
        yield* terminalUnit(root);
        const waited = yield* launcher.wait(record.jobId, Job.ProofJobWaitOptions.make({ timeoutMs: O.some(1000) }));
        expect(waited.record.phase).toBe("terminated");
        assertSome(waited.record.terminationReason, "timeout");
        const observed = O.getOrThrow(waited.record.systemd);
        expect(observed.serviceResult).toBe("timeout");
        assertSome(observed.exitCode, "exited");
        assertSome(observed.exitStatus, "130");
        assertSome(observed.invocationId, "11111111111111111111111111111111");
        const readFileString19 = yield* fs.readFileString(journal);
        expect(readFileString19).toContain('"attempt-terminated"');
        yield* launcher.read(record.jobId);
        expect((yield* inbox(root)).length).toBe(1);
      })
    )
  );
  it.effect("retains an OOM result instead of replacing it with finalizer-missing", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const launcher = yield* ProofJobLauncher.make(root);
        const record = yield* launcher.submit(submission(root));
        yield* running(root, launcher, record.jobId);
        yield* terminalUnit(root, { Result: "oom-kill", ExecMainCode: "2", ExecMainStatus: "9" });
        const read20 = yield* launcher.read(record.jobId);
        const result = O.getOrThrow(read20);
        assertSome(result.terminationReason, "oom-killed");
        assertSome(O.getOrThrow(result.systemd).exitCode, "killed");
      })
    )
  );
  it.effect("an inactive unit's exit zero never fabricates a green proof", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const launcher = yield* ProofJobLauncher.make(root);
        const record = yield* launcher.submit(submission(root));
        yield* running(root, launcher, record.jobId);
        yield* terminalUnit(root, {
          ActiveState: "inactive",
          SubState: "dead",
          Result: "success",
          ExecMainCode: "0",
          ExecMainStatus: "0",
          InvocationID: "",
        });
        const read21 = yield* launcher.read(record.jobId);
        const result = O.getOrThrow(read21);
        expect(result.phase).toBe("terminated");
        assertNone(result.outcome);
        assertNone(O.getOrThrow(result.systemd).exitCode);
        assertNone(O.getOrThrow(result.systemd).exitStatus);
        assertSome(result.terminationReason, "finalizer-missing");
      })
    )
  );
  for (const [name, properties] of [
    ["active runner", { ActiveState: "active", SubState: "running" }],
    ["stopping finalizer", { ActiveState: "deactivating", SubState: "stop-post" }],
    ["main process", { MainPID: "42" }],
    ["control process", { ControlPID: "42" }],
    ["remaining descendants", { TasksCurrent: "2" }],
    ["inconsistent absent-cgroup task count", { ControlGroup: "", TasksCurrent: "2" }],
    ["missing accounting", { TasksCurrent: "" }],
    ["unavailable accounting for an existing cgroup", { TasksCurrent: "[not set]" }],
    ["malformed PID", { MainPID: "invalid" }],
    ["unrecognized result", { Result: "new-result" }],
  ] as const) {
    it.effect(`retains the job when observation shows ${name}`, () =>
      fixture(
        Effect.fnUntraced(function* (root) {
          const launcher = yield* ProofJobLauncher.make(root);
          const record = yield* launcher.submit(submission(root));
          yield* running(root, launcher, record.jobId);
          yield* terminalUnit(root, properties);
          const read22 = yield* launcher.read(record.jobId);
          expect(O.getOrThrow(read22).phase).toBe("running");
        })
      )
    );
  }
  it.effect("recovers a unit with no cgroup when systemd no longer exposes task accounting", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const launcher = yield* ProofJobLauncher.make(root);
        const record = yield* launcher.submit(submission(root));
        yield* running(root, launcher, record.jobId);
        yield* terminalUnit(root, { ControlGroup: "", TasksCurrent: "[not set]" });
        const read23 = yield* launcher.read(record.jobId);
        assertSome(O.getOrThrow(read23).terminationReason, "timeout");
      })
    )
  );
  it.effect("retains a live recorded identity despite an empty failed unit", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const launcher = yield* ProofJobLauncher.make(root);
        const record = yield* launcher.submit(submission(root));
        yield* launcher.markRunning(record.jobId, Job.ProofJobRunner.make({ pid: process.pid, startedAt: stamp }));
        yield* terminalUnit(root);
        const read24 = yield* launcher.read(record.jobId);
        expect(O.getOrThrow(read24).phase).toBe("running");
      })
    )
  );
  it.effect("does not assign another invocation's failure to the recorded job", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const fs = yield* FileSystem.FileSystem;
        const launcher = yield* ProofJobLauncher.make(root);
        const record = yield* launcher.submit(submission(root));
        yield* running(root, launcher, record.jobId);
        const read25 = yield* launcher.read(record.jobId);
        const current = O.getOrThrow(read25);
        const bound = Job.ProofJobRecord.make({
          ...current,
          unit: Job.ProofJobUnit.make({ ...current.unit, invocationId: O.some("22222222222222222222222222222222") }),
        });
        const argument18 = `${root}/.beep/yeet/jobs/${record.jobId}.json`;
        const encodedRecordJson = yield* encodeRecordJson(bound);
        yield* fs.writeFileString(argument18, encodedRecordJson);
        yield* terminalUnit(root);
        const read26 = yield* launcher.read(record.jobId);
        expect(O.getOrThrow(read26).phase).toBe("running");
      })
    )
  );
  // The wait arms its 15 ms deadline on this test's own TestClock as it starts. A delegating
  // Clock counts each 1 ms poll sleep, which the loop requests only after a full read of the
  // still-running record. The clock advances only once that first poll has completed, so the
  // timeout is proven to fire against an observed active unit rather than before any read.
  it.effect("times out while a unit remains active", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const launcher = yield* ProofJobLauncher.make(root);
        const record = yield* launcher.submit(submission(root));
        const completedPolls = yield* Ref.make(0);
        const firstPollCompleted = yield* Deferred.make<void>();
        const clock = yield* Clock.Clock;
        const pollObservingClock: Clock.Clock = {
          ...clock,
          sleep: (duration) =>
            Duration.toMillis(duration) === 1
              ? Ref.update(completedPolls, (n) => n + 1).pipe(
                  Effect.andThen(Deferred.succeed(firstPollCompleted, undefined)),
                  Effect.andThen(clock.sleep(duration))
                )
              : clock.sleep(duration),
        };
        const waiting = yield* launcher
          .wait(record.jobId, Job.ProofJobWaitOptions.make({ timeoutMs: O.some(15), pollIntervalMs: 1 }))
          .pipe(
            Effect.flip,
            Effect.provideService(Clock.Clock, pollObservingClock),
            Effect.forkChild({ startImmediately: true })
          );
        // A regression that makes wait return before its first poll ends the fiber without the
        // 1 ms sleep, so the signal would never come: fail at once with what wait returned.
        yield* Effect.raceFirst(
          Deferred.await(firstPollCompleted),
          Fiber.await(waiting).pipe(
            Effect.flatMap((exit) =>
              Effect.die(
                `wait returned before its first poll: ${Exit.match(exit, {
                  onSuccess: (error) => error.message,
                  onFailure: Cause.pretty,
                })}`
              )
            )
          )
        );
        yield* TestClock.adjust("15 millis");
        const error = yield* Fiber.join(waiting);
        expect(error.message).toContain("Timed out");
        const got = yield* Ref.get(completedPolls);
        expect(got).toBeGreaterThanOrEqual(1);
      })
    )
  );
});

describe("proof job recovery boundaries", () => {
  it.effect("does not append a second terminal event for an already-finished attempt", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const fs = yield* FileSystem.FileSystem;
        const launcher = yield* ProofJobLauncher.make(root);
        const record = yield* launcher.submit(submission(root));
        const journal = yield* running(root, launcher, record.jobId);
        const terminal = yield* encodeJsonLine({
          schemaVersion: "yeet-attempt-journal/v1",
          _tag: "attempt-finished",
          attemptId,
          recordedAt: stamp,
        });
        yield* fs.writeFileString(journal, `${yield* fs.readFileString(journal)}${terminal}\n`);
        const finalized = yield* launcher.finalize(
          record.jobId,
          Job.ProofJobSystemdResult.make({ serviceResult: "signal", finalizedAt: stamp })
        );
        expect(finalized.attemptTerminated).toBe(false);
        const readFileString27 = yield* fs.readFileString(journal);
        expect(readFileString27).not.toContain('"attempt-terminated"');
      })
    )
  );
  it.effect("retains live identities even when a unit lookup says not-found", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const launcher = yield* ProofJobLauncher.make(root);
        const record = yield* launcher.submit(submission(root));
        yield* launcher.markRunning(record.jobId, Job.ProofJobRunner.make({ pid: process.pid, startedAt: stamp }));
        yield* writeExecutable(`${root}/systemctl`, "#!/bin/sh\nprintf 'not-found\\n'\n");
        const read28 = yield* launcher.read(record.jobId);
        expect(O.getOrThrow(read28).phase).toBe("running");
      })
    )
  );
  it.effect("sorts newest first and prunes only the oldest completed records and logs", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const fs = yield* FileSystem.FileSystem;
        const launcher = yield* ProofJobLauncher.make(root);
        const first = yield* launcher.submit(submission(root));
        const second = yield* launcher.submit(submission(root));
        const active = yield* launcher.submit(submission(root));
        const dated: ReadonlyArray<readonly [Job.ProofJobRecord, string]> = [
          [first, "2026-09-14T00:00:00Z"],
          [second, "2026-09-15T00:00:00Z"],
        ];
        for (const [record, submittedAt] of dated) {
          yield* launcher.finalize(
            record.jobId,
            Job.ProofJobSystemdResult.make({ serviceResult: "signal", finalizedAt: stamp })
          );
          const read29 = yield* launcher.read(record.jobId);
          const finished = O.getOrThrow(read29);
          const argument19 = `${root}/.beep/yeet/jobs/${record.jobId}.json`;
          const encodedRecordJson19 = yield* encodeRecordJson(Job.ProofJobRecord.make({ ...finished, submittedAt }));
          yield* fs.writeFileString(argument19, encodedRecordJson19);
        }
        const list30 = yield* launcher.list;
        expect(A.map(list30, (record) => record.jobId)).toContain(active.jobId);
        const prune31 = yield* launcher.prune(1);
        expect(prune31).toEqual([first.jobId]);
        const exists32 = yield* fs.exists(first.unit.logPath);
        expect(exists32).toBe(false);
        const exists33 = yield* fs.exists(second.unit.logPath);
        expect(exists33).toBe(true);
        const retained = yield* launcher.read(active.jobId);
        retained.pipe(O.isSome, assertTrue);
      })
    )
  );
  // TestClock.withLive: the finalizer lands between real poll ticks; the TestClock would
  // freeze the polling loop before the stamp appears.
  it.effect("wait observes a finalizer that completes after polling begins", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const launcher = yield* ProofJobLauncher.make(root);
        const record = yield* launcher.submit(submission(root));
        const finalizer = yield* launcher
          .finalize(record.jobId, Job.ProofJobSystemdResult.make({ serviceResult: "timeout", finalizedAt: stamp }))
          .pipe(Effect.delay("10 millis"), Effect.forkChild);
        const done = yield* launcher.wait(
          record.jobId,
          Job.ProofJobWaitOptions.make({ timeoutMs: O.some(2000), pollIntervalMs: 1 })
        );
        // The terminal record becomes visible before finalize finishes its other
        // writes. Join it before the fixture removes the job directory.
        yield* Fiber.join(finalizer);
        expect(done.kind).toBe("settled");
        expect(done.record.phase).toBe("terminated");
      })
    ).pipe(TestClock.withLive)
  );
  it.effect("quotes systemd command words and omits an absent runtime ceiling", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const launcher = yield* ProofJobLauncher.make(root);
        const record = yield* launcher.submit(submission(root));
        const changed = Job.ProofJobRecord.make({
          ...record,
          unit: Job.ProofJobUnit.make({
            ...record.unit,
            maxRuntimeSeconds: O.none(),
            execStopPost: ["/opt/a b", 'a"b', "$NAME", "%n", "line\nbreak"],
          }),
        });
        const args = Job.proofJobSystemdRunArguments(changed, {});
        expect(A.some(args, Str.startsWith("RuntimeMaxSec="))).toBe(false);
        expect(O.getOrThrow(A.findFirst(args, Str.startsWith("ExecStopPost=")))).toBe(
          'ExecStopPost="/opt/a b" "a\\"b" "$$NAME" "%%n" "line\\nbreak"'
        );
      })
    )
  );
});

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, gitLayer), {
  timeout: "30 seconds",
  excludeTestServices: true,
})("review round 1 transitions", (it) => {
  for (const cancelFirst of [true, false]) {
    for (const interleaving of [1, 2, 3]) {
      // Real clock: lock contention retries use real time; the save waits for the competing lock acquisition.
      it.effect(`serializes ${cancelFirst ? "cancel" : "finalize"} first with save barrier ${interleaving}`, () =>
        fixture(
          Effect.fnUntraced(function* (root) {
            const fs = yield* FileSystem.FileSystem;
            const original = yield* ProofJobLauncher.make(root);
            const record = yield* original.submit(submission(root));
            const saving = yield* Deferred.make<void>();
            const releaseSave = yield* Deferred.make<void>();
            const slowFs = FileSystem.FileSystem.of({
              ...fs,
              link: Effect.fnUntraced(function* (from, to) {
                if (to === `${root}/.beep/yeet/jobs/${record.jobId}.lock` && (yield* fs.exists(to))) {
                  yield* Deferred.succeed(releaseSave, undefined);
                }
                return yield* fs.link(from, to);
              }),
              rename: Effect.fnUntraced(function* (from, to) {
                if (to === `${root}/.beep/yeet/jobs/${record.jobId}.json`) {
                  yield* Deferred.succeed(saving, undefined);
                  yield* Deferred.await(releaseSave);
                }
                return yield* fs.rename(from, to);
              }),
            });
            const launcher = yield* ProofJobLauncher.make(root).pipe(
              Effect.provideService(FileSystem.FileSystem, slowFs)
            );
            const finalize = launcher
              .finalize(record.jobId, Job.ProofJobSystemdResult.make({ serviceResult: "signal", finalizedAt: stamp }))
              .pipe(
                Effect.tap(() =>
                  original.read(record.jobId).pipe(
                    Effect.tap((found) =>
                      Effect.sync(() => {
                        expect(O.getOrThrow(found).phase).toBe("terminated");
                        O.getOrThrow(found).systemd.pipe(O.isSome, assertTrue);
                      })
                    )
                  )
                )
              );
            const cancel = launcher.cancel(record.jobId).pipe(Effect.asVoid);
            yield* Effect.all(
              [
                cancelFirst ? cancel : finalize,
                Deferred.await(saving).pipe(Effect.andThen(cancelFirst ? finalize.pipe(Effect.asVoid) : cancel)),
              ],
              { concurrency: "unbounded" }
            );
            const read34 = yield* original.read(record.jobId);
            const final = O.getOrThrow(read34);
            expect(final.phase).toBe("terminated");
            expect(O.getOrThrow(final.systemd).serviceResult).toBe("signal");
            expect(O.getOrThrow(final.terminationReason)).toBe(cancelFirst ? "cancelled" : "signal");
            const exists35 = yield* fs.exists(`${root}/.beep/yeet/jobs/${record.jobId}.lock`);
            expect(exists35).toBe(false);
            const cancel36 = yield* launcher.cancel(record.jobId);
            expect(cancel36).toBe("already-terminal");
            const markFinished37 = yield* launcher.markFinished(
              record.jobId,
              Job.ProofJobOutcome.make({ verdictOutcome: "success", endedAt: stamp })
            );
            expect(markFinished37).toEqual(final);
            const markRunning38 = yield* launcher.markRunning(
              record.jobId,
              Job.ProofJobRunner.make({ pid: process.pid, startedAt: stamp })
            );
            expect(markRunning38).toEqual(final);
            const inbox39 = yield* inbox(root);
            expect(inbox39).toHaveLength(1);
          })
        )
      );
    }
  }
  // Real clock: stale-generation takeover uses bounded real-clock lock retries.
  it.effect("takes over a dead lock and removes the lock after each transition", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const fs = yield* FileSystem.FileSystem;
        const launcher = yield* ProofJobLauncher.make(root);
        const record = yield* launcher.submit(submission(root));
        const lock = `${root}/.beep/yeet/jobs/${record.jobId}.lock`;
        yield* fs.writeFileString(lock, "2147483647:dead-holder");
        yield* running(root, launcher, record.jobId);
        const exists40 = yield* fs.exists(lock);
        expect(exists40).toBe(false);
        yield* launcher.cancel(record.jobId);
        const exists41 = yield* fs.exists(lock);
        expect(exists41).toBe(false);
        yield* launcher.markFinished(
          record.jobId,
          Job.ProofJobOutcome.make({ verdictOutcome: "success", endedAt: stamp })
        );
        const exists42 = yield* fs.exists(lock);
        expect(exists42).toBe(false);
        yield* launcher.finalize(
          record.jobId,
          Job.ProofJobSystemdResult.make({ serviceResult: "success", finalizedAt: stamp })
        );
        const exists43 = yield* fs.exists(lock);
        expect(exists43).toBe(false);
        yield* launcher.read(record.jobId);
        const exists44 = yield* fs.exists(lock);
        expect(exists44).toBe(false);
      })
    )
  );
  for (const verdictOutcome of ["success", "failure"] as const) {
    it.effect(`settles an orphaned finished ${verdictOutcome} verdict and wait acknowledges it`, () =>
      fixture(
        Effect.fnUntraced(function* (root) {
          const fs = yield* FileSystem.FileSystem;
          const launcher = yield* ProofJobLauncher.make(root);
          const record = yield* launcher.submit(submission(root));
          yield* running(root, launcher, record.jobId);
          yield* launcher.markFinished(record.jobId, Job.ProofJobOutcome.make({ verdictOutcome, endedAt: stamp }));
          yield* writeExecutable(`${root}/systemctl`, "#!/bin/sh\nprintf 'not-found\\n'\n");
          const read45 = yield* launcher.read(record.jobId);
          const reconciled = O.getOrThrow(read45);
          expect(reconciled.phase).toBe("finished");
          expect(O.getOrThrow(reconciled.systemd).serviceResult).toBe("unknown");
          const wait46 = yield* launcher.wait(record.jobId, Job.ProofJobWaitOptions.make({}));
          expect(wait46).toEqual(Job.ProofJobWaitSettled.make({ record: reconciled }));
          const rows = yield* inbox(root);
          expect(rows).toHaveLength(1);
          expect(rows[0]?.severity).toBe(verdictOutcome === "success" ? "P2" : "P1");
          expect((yield* readYeetAckState(root, yeetProofJobRowId(record))).receipt?.resolution).toMatchObject({
            kind: "observed",
            via: "job-wait",
          });
          const exists47 = yield* fs.exists(`${root}/.beep/yeet/jobs/${record.jobId}.lock`);
          expect(exists47).toBe(false);
        })
      )
    );
  }
});

describe("job wait wave return", () => {
  it.layer(TestConsole.layer, { timeout: "30 seconds" })((it) => {
    it.effect("returns the live wave when its bookkeeping write fails and reports that a retry may repeat it", () =>
      fixture(
        Effect.fnUntraced(function* (root) {
          const fs = yield* FileSystem.FileSystem;
          const original = yield* ProofJobLauncher.make(root);
          const record = yield* original.submit(submission(root));
          yield* original.bindPullRequest(record.jobId, 7);
          const red = yield* waveRow(root, 7, "Check");
          const unavailableStorage = FileSystem.FileSystem.of({
            ...fs,
            rename: Effect.fn("ProofJobTest.rename")((from, to) =>
              to === `${root}/.beep/yeet/jobs/${record.jobId}.json`
                ? Effect.fail(
                    PlatformError.systemError({
                      _tag: "PermissionDenied",
                      module: "ProofJobTest",
                      method: "rename",
                      pathOrDescriptor: to,
                    })
                  )
                : fs.rename(from, to)
            ),
          });
          const launcher = yield* ProofJobLauncher.make(root).pipe(
            Effect.provideService(FileSystem.FileSystem, unavailableStorage)
          );
          const returned = yield* launcher.wait(record.jobId, Job.ProofJobWaitOptions.make({}));
          expect(returned.kind === "wave" ? A.map(returned.wave.entries, (entry) => entry.row.id) : []).toEqual([
            red.id,
          ]);
          const read48 = yield* original.read(record.jobId);
          expect(O.getOrThrow(read48).returnedWaveRowIds).toEqual([]);
          expect((yield* readYeetAckState(root, red.id)).acked).toBe(false);
          const errorLines49 = yield* TestConsole.errorLines;
          expect(A.join(A.filter(errorLines49, P.isString), "\n")).toContain(
            "a re-run of job wait may return it again"
          );
        })
      )
    );
  });

  it("maps every wait outcome through one exit table, with the wave on 2", () => {
    expect(A.map(Job.proofJobWaitExitTable, (row) => row.outcome)).toEqual(Job.ProofJobWaitOutcome.literals);
    expect(A.map(Job.proofJobWaitExitTable, (row) => [row.outcome, row.exitCode])).toEqual([
      ["success", 0],
      ["failure", 1],
      ["wave", 2],
      ["terminated", 3],
    ]);
  });
  it("selects only unacknowledged, not superseded P0/P1 rows on the job's own pull request", () => {
    const head = "abc123";
    const failed = (id: string, prNumber: number) =>
      Job.YeetCheckFailedRow.make({
        capsule: Job.YeetFailureCapsule.make({
          bucket: "fail",
          headSha: head,
          lane: id,
          link: null,
          observedAt: stamp,
          prNumber,
          state: "FAILURE",
          workflow: null,
        }),
        checkout: "/repo",
        id,
        severity: "P0",
        ts: stamp,
      });
    const open = Job.YeetAckState.make({ acked: false, receipt: null });
    const entry = (
      row: Job.YeetInboxRow,
      liveness: Job.YeetInboxLiveness = "live",
      ack: Job.YeetAckState = open
    ): Job.YeetInboxEntry => Job.YeetInboxEntry.make({ ack, liveness, row });
    const thread = Job.YeetReviewThreadRow.make({
      capsule: Job.YeetReviewThreadCapsule.make({ headSha: head, link: null, prNumber: 7, threadId: "T1" }),
      checkout: "/repo",
      id: "review-thread-t1",
      severity: "P1",
      ts: stamp,
    });
    const drift = Job.YeetBaseDriftRow.make({
      capsule: Job.YeetBaseDriftCapsule.make({ base: "origin/main", headSha: head, prNumber: 7 }),
      checkout: "/repo",
      id: "base-drift-7",
      severity: "P2",
      ts: stamp,
    });
    const ready = Job.YeetPrMergeReadyRow.make({
      capsule: Job.YeetPrMergeReadyCapsule.make({
        headSha: head,
        prNumber: 7,
        url: null,
        readyAt: stamp,
        pushedAt: null,
        settledAt: null,
        closeoutAt: null,
        pushToReadyMs: null,
      }),
      checkout: "/repo",
      id: "pr-merge-ready-7",
      severity: "P1",
      ts: stamp,
    });
    const entries = [
      entry(failed("mine", 7)),
      entry(failed("other-pr", 8)),
      entry(thread, "unknown"),
      entry(failed("acked", 7), "live", Job.YeetAckState.make({ acked: true, receipt: null })),
      entry(failed("superseded", 7), "superseded"),
      entry(drift),
      entry(ready),
      entry(failed("returned", 7)),
    ];
    const wave = Job.selectYeetPrWave(entries, 7, HashSet.make("returned"));
    assertSome(
      O.map(wave, (value) => A.map(value.entries, (item) => item.row.id)),
      ["mine", "review-thread-t1"]
    );
    assertNone(Job.selectYeetPrWave(entries, 9, HashSet.empty()));
  });
  it.effect(
    "returns a wave only for its own pull request, leaves the rows live, and never twice for the same rows",
    () =>
      fixture(
        Effect.fnUntraced(function* (root) {
          const launcher = yield* ProofJobLauncher.make(root);
          const seven = yield* launcher.submit(submission(root));
          const eight = yield* launcher.submit(submission(root));
          yield* launcher.bindPullRequest(seven.jobId, 7);
          yield* launcher.bindPullRequest(eight.jobId, 8);
          const quick = Job.ProofJobWaitOptions.make({ timeoutMs: O.some(1_000), pollIntervalMs: 1 });
          const awaitReturn = Job.ProofJobWaitOptions.make({ timeoutMs: O.none(), pollIntervalMs: 1 });
          const redOnEight = yield* waveRow(root, 8, "Check");
          // Two monitors share this checkout: PR 8's red must not wake PR 7's waiter.
          yield* waitTimesOut(launcher, seven.jobId, quick);
          const eightWave = yield* launcher.wait(eight.jobId, awaitReturn);
          if (eightWave.kind !== "wave") {
            return yield* Effect.die("Expected a wave return");
          }
          expect(eightWave.wave.prNumber).toBe(8);
          expect(A.map(eightWave.wave.entries, (entry) => entry.row.id)).toEqual([redOnEight.id]);
          // The return is not an acknowledgement: the row and the job row stay open.
          expect((yield* readYeetAckState(root, redOnEight.id)).acked).toBe(false);
          expect((yield* readYeetAckState(root, yeetProofJobRowId(eight))).acked).toBe(false);
          const read50 = yield* launcher.read(eight.jobId);
          expect(O.getOrThrow(read50).returnedWaveRowIds).toEqual([redOnEight.id]);
          // A re-run on the same running job waits past the wave it already returned.
          yield* waitTimesOut(launcher, eight.jobId, quick);
          const redOnSeven = yield* waveRow(root, 7, "Lint");
          const sevenWave = yield* launcher.wait(seven.jobId, awaitReturn);
          expect(sevenWave.kind === "wave" ? A.map(sevenWave.wave.entries, (entry) => entry.row.id) : []).toEqual([
            redOnSeven.id,
          ]);
          // Settling still returns settled and observes only the proof-job row.
          yield* launcher.markFinished(
            seven.jobId,
            Job.ProofJobOutcome.make({ verdictOutcome: "success", endedAt: stamp })
          );
          yield* launcher.finalize(
            seven.jobId,
            Job.ProofJobSystemdResult.make({ serviceResult: "success", finalizedAt: stamp })
          );
          expect((yield* launcher.wait(seven.jobId, awaitReturn)).kind).toBe("settled");
          expect((yield* readYeetAckState(root, yeetProofJobRowId(seven))).receipt?.resolution).toMatchObject({
            kind: "observed",
            via: "job-wait",
          });
          expect((yield* readYeetAckState(root, redOnSeven.id)).acked).toBe(false);
        })
      )
  );
  // A comment row never joins the per-head wave record; the waiter reads the
  // inbox, so a new comment wakes it like a new red, even after a push.
  it.effect("returns a wave for a new comment row on its own pull request, whatever head the wave record holds", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const launcher = yield* ProofJobLauncher.make(root);
        const job = yield* launcher.submit(submission(root));
        yield* launcher.bindPullRequest(job.jobId, 7);
        const quick = Job.ProofJobWaitOptions.make({ timeoutMs: O.some(1_000), pollIntervalMs: 1 });
        const awaitReturn = Job.ProofJobWaitOptions.make({ timeoutMs: O.none(), pollIntervalMs: 1 });
        yield* commentRow(root, 8, 40);
        yield* waitTimesOut(launcher, job.jobId, quick);
        // The fix push moved the wave record to a new head before the comment landed.
        yield* Job.supersedeYeetDispatchState(root, "def456", 7, stamp);
        const comment = yield* commentRow(root, 7, 41);
        const returned = yield* launcher.wait(job.jobId, awaitReturn);
        if (returned.kind !== "wave") {
          return yield* Effect.die("Expected a wave return");
        }
        expect(A.map(returned.wave.entries, (entry) => [entry.row.id, entry.liveness])).toStrictEqual([
          [comment.id, "live"],
        ]);
        expect((yield* readYeetAckState(root, comment.id)).acked).toBe(false);
        yield* waitTimesOut(launcher, job.jobId, quick);
      })
    )
  );
  // The negative oracle must be able to fail: a wait that hands back a wave fails
  // waitTimesOut. The fork-and-adjust form it replaced timed this wait out and passed.
  it.effect("fails waitTimesOut when the wait hands back a wave instead of timing out", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const launcher = yield* ProofJobLauncher.make(root);
        const job = yield* launcher.submit(submission(root));
        yield* launcher.bindPullRequest(job.jobId, 7);
        const quick = Job.ProofJobWaitOptions.make({ timeoutMs: O.some(1_000), pollIntervalMs: 1 });
        yield* waveRow(root, 7, "Lint");
        const defect = yield* waitTimesOut(launcher, job.jobId, quick).pipe(
          Effect.as("waitTimesOut passed"),
          Effect.catchDefect(Effect.succeed)
        );
        expect(defect).toBe("the wait returned wave where it had to time out");
      })
    )
  );
});

const runJobCommand = Command.runWith(yeetCommand, { version: "0.0.0" });
class CommandCheckout extends Context.Service<
  CommandCheckout,
  { readonly root: string; readonly launcher: Job.ProofJobLauncherShape }
>()($I`CommandCheckout`) {}
const commandCheckoutLayer = Layer.effectContext(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const root = yield* fs.makeTempDirectoryScoped({ prefix: "proof-job-command-" });
    yield* fs.writeFileString(`${root}/bun.lock`, "");
    yield* writeExecutable(`${root}/busctl`, "#!/bin/sh\nexit 0\n");
    yield* writeExecutable(`${root}/systemd-run`, "#!/bin/sh\nexit 0\n");
    yield* writeExecutable(`${root}/systemctl`, "#!/bin/sh\nprintf 'loaded\\n'\n");
    const previousCwd = process.cwd;
    const previousArgv = process.argv;
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        process.cwd = previousCwd;
        process.argv = previousArgv;
      })
    );
    process.cwd = () => root;
    return Context.make(CommandCheckout, { root, launcher: yield* ProofJobLauncher.make(root) }).pipe(
      Context.add(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ PATH: root, BEEP_RUN_SCOPES: "1" }))
    );
  })
).pipe(
  Layer.provideMerge(
    Layer.merge(
      Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, gitLayer),
      Layer.succeed(MemoryStats, MemoryStats.of({ availableGib: Effect.succeed(50), totalGib: Effect.succeed(128) }))
    )
  )
);
const jobEnvironment = (root: string, record: Job.ProofJobRecord, extra: Readonly<Record<string, string>> = {}) =>
  ConfigProvider.fromUnknown({
    PATH: root,
    BEEP_RUN_SCOPES: "1",
    BEEP_YEET_JOB_ID: record.jobId,
    BEEP_YEET_JOB_UNIT: record.unit.unitName,
    ...extra,
  });

it.layer(commandCheckoutLayer, { timeout: "30 seconds" })("proof job command handlers", (it) => {
  it.effect(
    "renders active and failed telemetry, lists, logs, missing records, and terminal observations",
    Effect.fnUntraced(function* () {
      const { root, launcher } = yield* CommandCheckout;
      const fs = yield* FileSystem.FileSystem;
      yield* runJobCommand(["job", "list"]);
      yield* runJobCommand(["job", "list", "--json"]);
      const record = yield* launcher.submit(submission(root));
      yield* runJobCommand(["job", "list"]);
      yield* runJobCommand(["job", "list", "--json"]);
      yield* runJobCommand(["job", "status", record.jobId]);
      yield* runJobCommand(["job", "status", record.jobId, "--json", "--ack"]);
      yield* writeExecutable(`${root}/systemctl`, "#!/bin/sh\nprintf 'unit lookup failed\\n'\nexit 1\n");
      yield* runJobCommand(["job", "status", record.jobId, "--json"]);
      const jsonOutput = yield* TestConsole.logLines;
      expect(A.join(A.filter(jsonOutput, P.isString), "\n")).toContain('"telemetry":null');
      expect(A.join(A.filter(jsonOutput, P.isString), "\n")).not.toContain('"telemetry":"unit lookup failed');
      yield* runJobCommand(["job", "status", record.jobId]);
      const logLines51 = yield* TestConsole.logLines;
      expect(A.join(A.filter(logLines51, P.isString), "\n")).toContain("unit not loaded");
      for (const content of ["first\nsecond\n", "last", ""]) {
        yield* fs.writeFileString(record.unit.logPath, content);
        yield* runJobCommand(["job", "logs", record.jobId, "--tail", "1"]);
      }
      yield* fs.remove(record.unit.logPath);
      yield* runJobCommand(["job", "logs", record.jobId]);
      const pipe52 = yield* runJobCommand(["job", "logs", record.jobId, "--tail=-1"]).pipe(Effect.flip);
      expect(pipe52).toMatchObject({
        message: "--tail must be nonnegative.",
      });
      const pipe53 = yield* runJobCommand(["job", "status", attemptId]).pipe(Effect.flip);
      expect(pipe53).toMatchObject({
        message: `Unknown proof job ${attemptId}.`,
      });
      const pipe54 = yield* runJobCommand(["job", "wait", attemptId]).pipe(Effect.flip);
      expect(pipe54).toMatchObject({
        message: `Unknown proof job ${attemptId}.`,
      });
      yield* launcher.finalize(
        record.jobId,
        Job.ProofJobSystemdResult.make({ serviceResult: "signal", finalizedAt: stamp })
      );
      yield* runJobCommand(["job", "status", record.jobId, "--ack"]);
      yield* runJobCommand(["job", "status", record.jobId, "--json", "--ack"]);
      expect((yield* readYeetAckState(root, yeetProofJobRowId(record))).receipt?.resolution).toMatchObject({
        kind: "observed",
        via: "job-status",
      });
      yield* runJobCommand(["job", "cancel", record.jobId]);
      // A terminated job exits 3; exit 2 is the wave return (pr-event-awareness D31).
      const pipe55 = yield* runJobCommand(["job", "wait", record.jobId, "--json"]).pipe(Effect.flip);
      expect(pipe55).toMatchObject({
        exitCode: 3,
      });
      const row = (yield* inbox(root))[0];
      if (row === undefined) {
        return yield* Effect.die("Expected finalization inbox row");
      }
      const yeetInboxExpectedRowId56 = yield* Job.yeetInboxExpectedRowId(row);
      expect(yeetInboxExpectedRowId56).toBe(yeetProofJobRowId(record));
      expect(Job.describeYeetInboxRow(row)).toContain(record.jobId);
      yield* runJobCommand(["inbox", "ack", row.id, "--observed"]);
      expect(Job.renderYeetAckResolution(Job.YeetAckObservedResolution.make({ via: "inbox-ack" }))).toBe(
        "observed via inbox-ack"
      );
    })
  );
  it.effect(
    "refuses an observed acknowledgement for a gate failure",
    Effect.fnUntraced(function* () {
      const { root } = yield* CommandCheckout;
      const capsule = Job.YeetFailureCapsule.make({
        bucket: "fail",
        headSha: "abc123",
        lane: "coverage",
        link: null,
        observedAt: stamp,
        prNumber: 1143,
        state: "FAILURE",
        workflow: "Check",
      });
      const row = Job.YeetCheckFailedRow.make({
        capsule,
        checkout: root,
        id: yield* Job.yeetInboxRowId(capsule),
        severity: "P0",
        ts: stamp,
      });
      yield* Job.appendYeetInboxRow(root, row);
      const pipe57 = yield* runJobCommand(["inbox", "ack", row.id, "--observed"]).pipe(Effect.flip);
      expect(pipe57).toMatchObject({
        message: "--observed applies only to proof-job-finished and pr-merge-ready rows.",
      });
    })
  );
  for (const verdictOutcome of ["success", "failure"] as const) {
    it.effect(
      `wait renders a ${verdictOutcome} verdict with the correct exit`,
      Effect.fnUntraced(function* () {
        const { root, launcher } = yield* CommandCheckout;
        const record = yield* launcher.submit(submission(root));
        yield* launcher.markFinished(record.jobId, Job.ProofJobOutcome.make({ verdictOutcome, endedAt: stamp }));
        yield* runJobCommand(["job", "finalize", record.jobId]).pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            jobEnvironment(root, record, { SERVICE_RESULT: "success", EXIT_CODE: "exited", EXIT_STATUS: "0" })
          )
        );
        const wait = runJobCommand(["job", "wait", record.jobId, "--timeout", "30s", "--json"]);
        if (verdictOutcome === "success") {
          yield* wait;
        } else {
          const pipe20 = yield* wait.pipe(Effect.flip);
          expect(pipe20).toMatchObject({ exitCode: 1 });
        }
        for (const duration of ["0s", "bad"]) {
          expect(
            (yield* runJobCommand(["job", "wait", record.jobId, "--timeout", duration]).pipe(Effect.flip))._tag
          ).toBe("YeetCommandError");
        }
      })
    );
  }
  for (const [ending, command, exitCode] of [
    ["a clean loop exit", Effect.void, 0],
    ["a red loop exit", Effect.fail("required-red"), 1],
    ["a stopped loop", Effect.interrupt, 3],
  ] as const) {
    it.effect(
      `records ${ending} from a porcelain command inside the job so wait exits ${exitCode}`,
      Effect.fnUntraced(function* () {
        const { root, launcher } = yield* CommandCheckout;
        const record = yield* launcher.submit(submission(root));
        const environment = jobEnvironment(root, record);
        yield* Job.reportProofJobCommand(root, command).pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, environment),
          Effect.exit
        );
        const read58 = yield* launcher.read(record.jobId);
        const reported = O.getOrThrow(read58);
        assertSome(
          O.map(reported.runner, (runner) => runner.pid),
          process.pid
        );
        yield* runJobCommand(["job", "finalize", record.jobId]).pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            jobEnvironment(root, record, { SERVICE_RESULT: "success", EXIT_CODE: "exited", EXIT_STATUS: "0" })
          )
        );
        const wait = runJobCommand(["job", "wait", record.jobId, "--timeout", "30s"]);
        if (exitCode === 0) {
          yield* wait;
        } else {
          const pipe21 = yield* wait.pipe(Effect.flip);
          expect(pipe21).toMatchObject({ exitCode });
        }
      })
    );
  }
  for (const route of ["--until-ready", "--until-merged", "--watch"]) {
    it.effect(
      `records the outcome of a detached monitor ${route} route`,
      Effect.fnUntraced(function* () {
        const { root, launcher } = yield* CommandCheckout;
        const record = yield* launcher.submit(submission(root));
        // The checkout is not a git repository, so the route fails while hydrating, before any
        // GitHub read; the job must still record that end instead of reading as terminated.
        yield* runJobCommand(["monitor", route]).pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, jobEnvironment(root, record)),
          Effect.exit
        );
        const read59 = yield* launcher.read(record.jobId);
        const reported = O.getOrThrow(read59);
        expect(reported.phase).toBe("finished");
        assertSome(
          O.map(reported.outcome, (outcome) => outcome.verdictOutcome),
          "failure"
        );
      })
    );
  }
  it.effect(
    "preserves monitor failures without changing a job record when no job identity is configured",
    Effect.fnUntraced(function* () {
      const { root, launcher } = yield* CommandCheckout;
      const record = yield* launcher.submit(submission(root));
      for (const route of ["--until-ready", "--until-merged", "--watch"]) {
        // This fixture has no repository or GitHub access. Attached monitor routes must
        // propagate their hydration failure without finalizing an unrelated detached job.
        const failure = yield* runJobCommand(["monitor", route]).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "YeetCommandError" });
        const read60 = yield* launcher.read(record.jobId);
        const untouched = O.getOrThrow(read60);
        expect(untouched).toStrictEqual(record);
      }
    })
  );
  it.effect(
    "leaves the job record untouched outside a job",
    Effect.fnUntraced(function* () {
      const { root, launcher } = yield* CommandCheckout;
      const record = yield* launcher.submit(submission(root));
      yield* Job.reportProofJobCommand(root, Effect.void);
      const read61 = yield* launcher.read(record.jobId);
      const untouched = O.getOrThrow(read61);
      expect(untouched.phase).toBe(record.phase);
      assertNone(untouched.outcome);
    })
  );
  it.effect(
    "binds finalization to job, unit, and any recorded invocation",
    Effect.fnUntraced(function* () {
      const { root, launcher } = yield* CommandCheckout;
      const record = yield* launcher.submit(submission(root));
      const command = runJobCommand(["job", "finalize", record.jobId]);
      const pipe62 = yield* command.pipe(Effect.flip);
      expect(pipe62).toMatchObject({
        message: "BEEP_YEET_JOB_ID does not match the proof job.",
      });
      for (const [name, value] of [
        ["BEEP_YEET_JOB_ID", "wrong"],
        ["BEEP_YEET_JOB_UNIT", "wrong"],
      ] as const) {
        const pipe63 = yield* command.pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, jobEnvironment(root, record, { [name]: value })),
          Effect.flip
        );
        expect(pipe63).toMatchObject({ message: `${name} does not match the proof job.` });
      }
      const noUnit = ConfigProvider.fromUnknown({ BEEP_YEET_JOB_ID: record.jobId });
      const pipe64 = yield* command.pipe(Effect.provideService(ConfigProvider.ConfigProvider, noUnit), Effect.flip);
      expect(pipe64).toMatchObject({
        message: "BEEP_YEET_JOB_UNIT does not match the proof job.",
      });
      yield* launcher
        .markRunning(record.jobId, Job.ProofJobRunner.make({ pid: process.pid, startedAt: stamp }))
        .pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, jobEnvironment(root, record, { INVOCATION_ID: "same" }))
        );
      const pipe65 = yield* command.pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          jobEnvironment(root, record, { INVOCATION_ID: "different" })
        ),
        Effect.flip
      );
      expect(pipe65).toMatchObject({ message: "INVOCATION_ID does not match the proof job." });
      yield* command.pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          jobEnvironment(root, record, { INVOCATION_ID: "same", SERVICE_RESULT: "invalid", EXIT_CODE: "invalid" })
        )
      );
      const read66 = yield* launcher.read(record.jobId);
      expect(O.getOrThrow(O.getOrThrow(read66).systemd).serviceResult).toBe("unknown");
      yield* command.pipe(Effect.provideService(ConfigProvider.ConfigProvider, jobEnvironment(root, record)));
      const unstamped = yield* launcher.submit(submission(root));
      yield* runJobCommand(["job", "finalize", unstamped.jobId]).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, jobEnvironment(root, unstamped, { INVOCATION_ID: "new" }))
      );
    })
  );
  for (const stopResult of ["loaded", "not-found", "success"]) {
    it.effect(
      `cancel handles ${stopResult}`,
      Effect.fnUntraced(function* () {
        const { root, launcher } = yield* CommandCheckout;
        const record = yield* launcher.submit(submission(root));
        yield* writeExecutable(
          `${root}/systemctl`,
          `#!/bin/sh\nprintf '${stopResult}\\n'\nexit ${stopResult === "success" ? 0 : 1}\n`
        );
        const cancel = runJobCommand(["job", "cancel", record.jobId]);
        if (stopResult === "loaded") {
          const pipe22 = yield* cancel.pipe(Effect.flip);
          expect(pipe22).toMatchObject({ message: "systemctl could not stop the job." });
        } else {
          yield* cancel;
        }
      })
    );
  }
  it.effect(
    "submits detached commands and rejects invalid git coordinates and argv",
    Effect.fnUntraced(function* () {
      const { root } = yield* CommandCheckout;
      yield* writeExecutable(`${root}/git`, "#!/bin/sh\nprintf 'feature/job\\n'\n");
      process.argv = [process.execPath, "/repo/cli.ts", "--", "yeet", "verify", "--detach"];
      yield* runJobCommand(["verify", "--detach"]);
      yield* runJobCommand(["verify", "--detach", "--json", "--job-max-runtime", "1h"]);
      process.argv = [process.execPath, "/repo/cli.ts", "wrong"];
      const pipe67 = yield* runJobCommand(["verify", "--detach"]).pipe(Effect.flip);
      expect(pipe67).toMatchObject({
        message: "Cannot detach: original argv must begin with yeet.",
      });
      process.argv = [process.execPath, "/repo/cli.ts"];
      expect((yield* runJobCommand(["verify", "--detach"]).pipe(Effect.flip))._tag).toBe("YeetCommandError");
      process.argv = [];
      expect((yield* runJobCommand(["verify", "--detach"]).pipe(Effect.flip))._tag).toBe("YeetCommandError");
      yield* writeExecutable(`${root}/git`, "#!/bin/sh\nprintf 'bad git coordinates\\n'\nexit 1\n");
      const pipe68 = yield* runJobCommand(["verify", "--detach"]).pipe(Effect.flip);
      expect(pipe68).toMatchObject({
        message: "bad git coordinates",
      });
    })
  );
  it.effect(
    "retains the monitor polling interval in the durable request and launched command",
    Effect.fnUntraced(function* () {
      const { root, launcher } = yield* CommandCheckout;
      const fs = yield* FileSystem.FileSystem;
      yield* writeExecutable(`${root}/git`, "#!/bin/sh\nprintf 'feature/job\\n'\n");
      yield* writeExecutable(`${root}/systemd-run`, `#!/bin/sh\nprintf '%s\\n' "$@" > '${root}/launch.argv'\n`);
      const argv = ["monitor", "--until-ready", "--poll-interval", "60s", "--detach"];
      process.argv = [process.execPath, "/repo/cli.ts", "--", "yeet", ...argv];
      yield* runJobCommand(argv);
      const list69 = yield* launcher.list;
      const record = O.getOrThrow(A.findFirst(list69, (record) => A.contains(record.request.argv, "--poll-interval")));
      expect(record.request.argv).toEqual(["monitor", "--until-ready", "--poll-interval", "60s"]);
      const readFileString70 = yield* fs.readFileString(`${root}/launch.argv`);
      expect(readFileString70).toContain("monitor\n--until-ready\n--poll-interval\n60s");
    })
  );
  it.effect(
    "wait exits 2 on a wave, names its rows and the re-run command, and keeps JSON mode's stdout the record",
    Effect.fnUntraced(function* () {
      const { root, launcher } = yield* CommandCheckout;
      const record = yield* launcher.submit(submission(root));
      yield* launcher.bindPullRequest(record.jobId, 7);
      const first = yield* waveRow(root, 7, "Check");
      const pipe71 = yield* runJobCommand(["job", "wait", record.jobId]).pipe(Effect.flip);
      expect(pipe71).toMatchObject({ exitCode: 2 });
      const logLines72 = yield* TestConsole.logLines;
      const printed = A.join(A.filter(logLines72, P.isString), "\n");
      expect(printed).toContain("[yeet] wave on PR #7: 1 new P0/P1 inbox row(s): P0 Check (pr #7 @ abc123)");
      expect(printed).toContain(`[${first.id}]`);
      expect(printed).toContain(`re-run: bun run beep yeet job wait ${record.jobId}`);
      expect((yield* readYeetAckState(root, first.id)).acked).toBe(false);
      // The re-run returns only the row that landed after the first return.
      const second = yield* waveRow(root, 7, "Lint");
      const pipe73 = yield* runJobCommand(["job", "wait", record.jobId, "--json"]).pipe(Effect.flip);
      expect(pipe73).toMatchObject({
        exitCode: 2,
      });
      const errorLines74 = yield* TestConsole.errorLines;
      const errors = A.join(A.filter(errorLines74, P.isString), "\n");
      expect(errors).toContain(`[${second.id}]`);
      expect(errors).not.toContain(`[${first.id}]`);
    })
  );
  // The in-memory PR session registry keeps the monitor off the live registry.
  it.layer(Job.layerPrSessionRegistryMemory, { timeout: "30 seconds" })((it) => {
    it.effect(
      "a detached monitor binds the pull request it follows to its job record and windows comments at its submit",
      Effect.fnUntraced(function* () {
        const { root, launcher } = yield* CommandCheckout;
        const record = yield* launcher.submit(submission(root));
        const windows = yield* Ref.make<ReadonlyArray<string | undefined>>(A.empty());
        const route = Effect.gen(function* () {
          const registry = yield* Job.PrSessionRegistry;
          yield* Job.runYeetMergeLoop(
            { base: "origin/main", head: "HEAD", packetDir: ".beep/yeet" },
            {
              capture: () => Effect.succeed({ exitCode: 1, output: "", truncated: false }),
              hydrate: () =>
                Effect.succeed(
                  Job.RepoRunContext.make({
                    base: "origin/main",
                    branch: "feat/job",
                    cwd: root,
                    head: "HEAD",
                    originalArgv: [],
                    packetDir: ".beep/yeet",
                    repoRoot: root,
                    turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
                  })
                ),
              mergeLoop: (_context, options) =>
                Ref.update(windows, A.append(options.commentsSince)).pipe(
                  Effect.as(Job.YeetMonitorTerminalState.Enum.ready)
                ),
              registry,
              view: () => Effect.succeed(Job.GhPrView.make({ headRefName: "feat/job", number: 42, state: "OPEN" })),
            }
          );
        });
        yield* route.pipe(Effect.provideService(ConfigProvider.ConfigProvider, jobEnvironment(root, record)));
        const read75 = yield* launcher.read(record.jobId);
        assertSome(O.getOrThrow(read75).prNumber, 42);
        // An attached run has no job: its loop starts the window itself.
        yield* route.pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ PATH: root }))
        );
        const got76 = yield* Ref.get(windows);
        expect(got76).toStrictEqual([record.submittedAt, undefined]);
      })
    );
    it.effect(
      "an until-ready monitor binds its pull request after the loop's first pin and runs detached only inside a job",
      Effect.fnUntraced(function* () {
        const { root, launcher } = yield* CommandCheckout;
        const record = yield* launcher.submit(submission(root));
        const attachments = yield* Ref.make(A.empty<string | undefined>());
        const route = Effect.gen(function* () {
          const registry = yield* Job.PrSessionRegistry;
          yield* Job.runYeetMergeLoop(
            { base: "origin/main", head: "HEAD", packetDir: ".beep/yeet" },
            {
              capture: () => Effect.succeed({ exitCode: 1, output: "", truncated: false }),
              hydrate: () =>
                Effect.succeed(
                  Job.RepoRunContext.make({
                    base: "origin/main",
                    branch: "feat/job",
                    cwd: root,
                    head: "HEAD",
                    originalArgv: [],
                    packetDir: ".beep/yeet",
                    repoRoot: root,
                    turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
                  })
                ),
              // The loop seam never pins, so a bind can only have come from hydration.
              mergeLoop: (_context, options) =>
                Ref.update(attachments, A.append(options.attachment)).pipe(
                  Effect.as(Job.YeetMonitorTerminalState.Enum.ready)
                ),
              policy: Job.YeetUntilReadyPolicy.make({}),
              registry,
              view: () => Effect.succeed(Job.GhPrView.make({ headRefName: "feat/job", number: 42, state: "OPEN" })),
            }
          );
        });
        yield* route.pipe(Effect.provideService(ConfigProvider.ConfigProvider, jobEnvironment(root, record)));
        const read77 = yield* launcher.read(record.jobId);
        assertNone(O.getOrThrow(read77).prNumber);
        yield* route.pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ PATH: root }))
        );
        const got78 = yield* Ref.get(attachments);
        expect(got78).toStrictEqual(["detached", "attached"]);
      })
    );
  });
});

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, gitLayer), {
  timeout: "30 seconds",
  excludeTestServices: true,
})("proof job journal boundaries", (it) => {
  it.effect("does not invent an attempt when the journal or start row is missing", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const fs = yield* FileSystem.FileSystem;
        const journal = `${root}/attempts.ndjson`;
        const appendProofJobAttemptTerminated79 = yield* Job.appendProofJobAttemptTerminated(
          journal,
          attemptId,
          "signal"
        );
        expect(appendProofJobAttemptTerminated79).toBe(false);
        yield* fs.writeFileString(journal, "");
        const appendProofJobAttemptTerminated80 = yield* Job.appendProofJobAttemptTerminated(
          journal,
          attemptId,
          "signal"
        );
        expect(appendProofJobAttemptTerminated80).toBe(false);
        const exists81 = yield* fs.exists(`${journal}.lock`);
        expect(exists81).toBe(false);
      })
    )
  );
  it.effect("reports a busy attempt journal without publishing a false finalization", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const fs = yield* FileSystem.FileSystem;
        const journal = `${root}/attempts.ndjson`;
        yield* fs.writeFileString(journal, "");
        yield* fs.writeFileString(`${journal}.lock`, `${process.pid}:live-holder`);
        const pipe82 = yield* Job.appendProofJobAttemptTerminated(journal, attemptId, "signal").pipe(Effect.flip);
        expect(pipe82).toMatchObject({ message: "Attempt journal stayed busy during proof-job finalization." });
        const readFileString83 = yield* fs.readFileString(journal);
        expect(readFileString83).toBe("");
      })
    )
  );
});

type BookkeepingCase = {
  readonly identity: string;
  readonly outcome: "success" | "failure";
  readonly jobId: (recordJobId: UUID) => string;
  readonly recorded: boolean;
};
const bookkeepingCases: ReadonlyArray<BookkeepingCase> = [
  { identity: "valid", outcome: "success", jobId: (recordJobId) => recordJobId, recorded: true },
  { identity: "failed", outcome: "failure", jobId: (recordJobId) => recordJobId, recorded: true },
  { identity: "invalid", outcome: "success", jobId: () => "bad-id", recorded: false },
  { identity: "missing-record", outcome: "success", jobId: () => attemptId, recorded: false },
];
const expectBookkeeping = Effect.fnUntraced(function* (
  launcher: Job.ProofJobLauncherShape,
  jobId: UUID,
  testCase: BookkeepingCase
) {
  if (!testCase.recorded) {
    const errorLines84 = yield* TestConsole.errorLines;
    expect(A.join(A.filter(errorLines84, P.isString), "\n")).toContain("job bookkeeping failed");
    return;
  }
  const read85 = yield* launcher.read(jobId);
  const finished = O.getOrThrow(read85);
  expect(finished.phase).toBe("finished");
  expect(O.getOrThrow(finished.outcome).verdictOutcome).toBe(testCase.outcome);
});

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, gitLayer), { timeout: "30 seconds" })(
  "proof verdict bookkeeping",
  (it) => {
    for (const testCase of bookkeepingCases) {
      it.effect(`records the verdict despite ${testCase.identity} job bookkeeping`, () =>
        fixture(
          Effect.fnUntraced(function* (root) {
            const launcher = yield* ProofJobLauncher.make(root);
            const record = yield* launcher.submit(submission(root));
            const context = Job.RepoRunContext.make({
              repoRoot: root,
              cwd: root,
              base: "main",
              head: "HEAD",
              branch: "feat/job",
              packetDir: ".beep/yeet",
              originalArgv: [],
              turbo: Job.TurboPlanSnapshot.make({ graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }),
            });
            const plan = Job.RepoRunPlan.make({
              context,
              steps: [
                Job.RepoPlanStep.make({
                  id: "full:pending",
                  label: "Pending proof",
                  phase: "full",
                  command: "proof-test",
                  args: [],
                  cwd: root,
                  scope: "repo",
                  mutability: "readonly",
                  resume: "never",
                }),
              ],
            });
            const started = Job.YeetAttemptStarted.make({
              _tag: "attempt-started",
              schemaVersion: "yeet-attempt-journal/v1",
              attemptId,
              runId: "feat_job",
              branch: "feat/job",
              base: "main",
              head: "abc123",
              mode: "verify",
              startedAt: stamp,
            });
            const recorder = yield* Ref.make<ReadonlyArray<Job.YeetExecutedStep>>([]);
            const extras = yield* Ref.make<Job.YeetVerdictExtrasForTesting>({
              baseFreshness: O.none(),
              mergeReady: O.none(),
              stash: O.none(),
              publishedHeadSha: O.none(),
              committedHeadSha: O.none(),
            });
            yield* Job.writeRunVerdictForTesting(
              plan,
              Job.defaultYeetRunOptions({ mode: "verify" }),
              started,
              0,
              recorder,
              extras,
              testCase.outcome,
              "verified",
              O.none()
            ).pipe(
              Effect.provideService(
                ConfigProvider.ConfigProvider,
                ConfigProvider.fromUnknown({ PATH: root, BEEP_YEET_JOB_ID: testCase.jobId(record.jobId) })
              )
            );
            const fs = yield* FileSystem.FileSystem;
            const resultArtifactPathForContext = yield* Job.runArtifactPathForContext(context, "verdict.json");
            const exists86 = yield* fs.exists(resultArtifactPathForContext);
            expect(exists86).toBe(true);
            yield* expectBookkeeping(launcher, record.jobId, testCase);
          })
        )
      );
    }
  }
);

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, gitLayer), { timeout: "30 seconds" })(
  "proof phase record integration",
  (it) => {
    for (const measurement of ["valid", "invalid", "absent"]) {
      it.effect(`records proof outcomes with ${measurement} RSS telemetry`, () =>
        fixture(
          Effect.fnUntraced(function* (root) {
            const fs = yield* FileSystem.FileSystem;
            const context = Job.RepoRunContext.make({
              repoRoot: root,
              cwd: root,
              base: "main",
              head: "HEAD",
              branch: "feat/job",
              packetDir: ".beep/yeet",
              originalArgv: [],
              turbo: Job.TurboPlanSnapshot.make({ graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }),
            });
            // Own double: the /usr/bin/time spawn writes the RSS file on disk; ScriptedSpawner scripts are synchronous.
            const spawner = ChildProcessSpawner.make(
              Effect.fnUntraced(function* (command) {
                if (!ChildProcess.isStandardCommand(command)) {
                  return yield* Effect.die("Expected a standard proof command");
                }
                if (command.command === "/usr/bin/time") {
                  const rssPath = command.pipe(commandArgs, A.get(3), O.getOrThrow);
                  yield* fs.writeFileString(rssPath, measurement === "valid" ? "42\n" : "unknown\n");
                }
                const exitCode = A.contains(commandArgs(command), "fail") ? 23 : 0;
                const output = command.command === "git" ? "abc123\n" : "proof output\n";
                return ChildProcessSpawner.makeHandle({
                  all: Stream.make(new TextEncoder().encode(output)),
                  exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
                  getInputFd: () => Sink.drain,
                  getOutputFd: () => Stream.empty,
                  isRunning: Effect.succeed(false),
                  kill: () => Effect.void,
                  pid: ChildProcessSpawner.ProcessId(1),
                  stderr: Stream.empty,
                  stdin: Sink.drain,
                  stdout: Stream.make(new TextEncoder().encode(output)),
                  unref: Effect.succeed(Effect.void),
                });
              })
            );
            const filesystem = FileSystem.FileSystem.of({
              ...fs,
              exists: Effect.fn("FileSystem.FileSystem.exists")((path) =>
                path === "/usr/bin/time" ? Effect.succeed(measurement !== "absent") : fs.exists(path)
              ),
            });
            const step = (id: string, result: string) =>
              Job.RepoPlanStep.make({
                id,
                label: id,
                phase: "full",
                command: "proof-test",
                args: [result],
                cwd: root,
                scope: "repo",
                mutability: "readonly",
                resume: "never",
              });
            const recorder = yield* Ref.make<ReadonlyArray<Job.YeetExecutedStep>>([]);
            const execute = (steps: ReadonlyArray<Job.RepoPlanStep>) =>
              Job.runProofPhaseForTesting(context, steps, recorder).pipe(
                Effect.provideServiceEffect(Git, Git.make),
                Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
                Effect.provideService(FileSystem.FileSystem, filesystem)
              );
            const failed = yield* execute([step("full:first", "fail"), step("full:second", "pass")]);
            expect(A.map(failed, (result) => result.exitCode)).toEqual([23]);
            const passed = yield* execute([step("full:first", "pass"), step("full:second", "pass")]);
            expect(A.map(passed, (result) => result.exitCode)).toEqual([0, 0]);
            const got87 = yield* Ref.get(recorder);
            expect(got87).toHaveLength(3);
            expect(passed[0]?.peakRssKb).toBe(measurement === "valid" ? 42 : undefined);
            const rows = yield* Job.loadYeetInboxView(root);
            expect(rows.entries).toHaveLength(1);
            expect(rows.entries[0]?.ack.acked).toBe(true);
          })
        )
      );
    }
  }
);

const reasonTable: ReadonlyArray<readonly [Job.ProofJobServiceResult, Job.ProofJobTerminationReason]> = [
  ["success", "unrecorded-failure"],
  ["exit-code", "unrecorded-failure"],
  ["unknown", "unrecorded-failure"],
  ["signal", "signal"],
  ["core-dump", "signal"],
  ["oom-kill", "oom-killed"],
  ["timeout", "timeout"],
  ["watchdog", "timeout"],
  ["protocol", "job-start-failed"],
  ["exec-condition", "job-start-failed"],
  ["start-limit-hit", "job-start-failed"],
  ["resources", "job-start-failed"],
];

describe("proof job termination reasons", () => {
  it("maps every systemd result in both call forms and yields to a cancel request", () => {
    for (const [result, reason] of reasonTable) {
      expect(Job.terminationReasonForServiceResult(result, false)).toBe(reason);
      expect(Job.terminationReasonForServiceResult(false)(result)).toBe(reason);
      expect(Job.terminationReasonForServiceResult(true)(result)).toBe("cancelled");
    }
  });
});

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, gitLayer), { timeout: "30 seconds" })(
  "proof job record guards",
  (it) => {
    it.effect("refuses a record path that is not a regular file", () =>
      fixture(
        Effect.fnUntraced(function* (root) {
          const fs = yield* FileSystem.FileSystem;
          const launcher = yield* ProofJobLauncher.make(root);
          yield* fs.makeDirectory(`${root}/.beep/yeet/jobs/${attemptId}.json`, { recursive: true });
          const pipe88 = yield* launcher.read(attemptId).pipe(Effect.flip);
          expect(pipe88).toMatchObject({ _tag: "YeetCommandError" });
        })
      )
    );
    it.effect("refuses a record whose identity does not match its file", () =>
      fixture(
        Effect.fnUntraced(function* (root) {
          const fs = yield* FileSystem.FileSystem;
          const launcher = yield* ProofJobLauncher.make(root);
          const record = yield* launcher.submit(submission(root));
          const text = yield* fs.readFileString(`${root}/.beep/yeet/jobs/${record.jobId}.json`);
          yield* fs.writeFileString(`${root}/.beep/yeet/jobs/${attemptId}.json`, text);
          const pipe89 = yield* launcher.read(attemptId).pipe(Effect.flip);
          expect(pipe89).toMatchObject({ _tag: "YeetCommandError" });
        })
      )
    );
    it.effect("refuses a submission for another checkout", () =>
      fixture(
        Effect.fnUntraced(function* (root) {
          const launcher = yield* ProofJobLauncher.make(root);
          const own = submission(root);
          const elsewhere = Job.ProofJobSubmission.make({
            ...own,
            request: Job.ProofJobRequest.make({ ...own.request, checkout: `${root}-elsewhere` }),
          });
          const pipe90 = yield* launcher.submit(elsewhere).pipe(Effect.flip);
          expect(pipe90).toMatchObject({
            message: "Submission checkout does not match launcher root.",
          });
        })
      )
    );
    it.effect("records a launch whose systemd-run could not be spawned", () =>
      fixture(
        Effect.fnUntraced(function* (root) {
          const fs = yield* FileSystem.FileSystem;
          const launcher = yield* ProofJobLauncher.make(root);
          yield* fs.remove(`${root}/systemd-run`);
          expect((yield* launcher.submit(submission(root)).pipe(Effect.flip))._tag).toBe("YeetCommandError");
          const records = yield* launcher.list;
          expect(A.map(records, (record) => record.phase)).toEqual(["terminated"]);
          expect(A.map(records, (record) => O.getOrNull(record.terminationReason))).toEqual(["job-start-failed"]);
        })
      )
    );
    it.effect("forwards nested environment records that carry no value of their own", () =>
      fixture(
        Effect.fnUntraced(function* (root) {
          const fs = yield* FileSystem.FileSystem;
          const launcher = yield* ProofJobLauncher.make(root);
          yield* launcher
            .submit(submission(root))
            .pipe(
              Effect.provideService(
                ConfigProvider.ConfigProvider,
                ConfigProvider.fromUnknown({ PATH: root, BEEP: { NESTED: "x" } })
              )
            );
          const readFileString91 = yield* fs.readFileString(`${root}/launch.argv`);
          expect(readFileString91).toContain("--setenv=BEEP_NESTED=x");
        })
      )
    );
  }
);

// The contender pauses 25 ms between file-lock attempts. A delegating Clock counts those pauses
// and returns at once, so the test needs neither live time nor a TestClock adjustment that real
// filesystem IO between attempts would outrun. The count proves the busy verdict comes only
// after the whole bounded backoff (200 attempts, 199 pauses), and the record proves the refused
// cancel changed nothing.
it.effect("reports a record lock held by a live process as busy", () =>
  fixture(
    Effect.fnUntraced(function* (root) {
      const fs = yield* FileSystem.FileSystem;
      const retryPauses = yield* Ref.make(0);
      const clock = yield* Clock.Clock;
      const pauseCountingClock: Clock.Clock = {
        ...clock,
        sleep: (duration) =>
          Duration.toMillis(duration) === 25 ? Ref.update(retryPauses, (n) => n + 1) : clock.sleep(duration),
      };
      // The launcher captures its context, Clock included, when it is made.
      const launcher = yield* ProofJobLauncher.make(root).pipe(Effect.provideService(Clock.Clock, pauseCountingClock));
      const record = yield* launcher.submit(submission(root));
      const lockPath = `${root}/.beep/yeet/jobs/${record.jobId}.lock`;
      const holder = `${process.pid}:test-holder`;
      const acquireJournalFileLock92 = yield* acquireJournalFileLock(lockPath, holder, 1);
      expect(acquireJournalFileLock92).toBe(true);
      const pausesBeforeCancel = yield* Ref.get(retryPauses);
      const busy = yield* launcher.cancel(record.jobId).pipe(Effect.flip);
      yield* releaseJournalFileLock(lockPath, holder);
      expect(busy).toMatchObject({ message: `Proof job ${record.jobId} stayed busy.` });
      expect((yield* Ref.get(retryPauses)) - pausesBeforeCancel).toBe(199);
      const read93 = yield* launcher.read(record.jobId);
      assertNone(O.getOrThrow(read93).cancelRequestedAt);
      const exists94 = yield* fs.exists(lockPath);
      expect(exists94).toBe(false);
    })
  )
);
