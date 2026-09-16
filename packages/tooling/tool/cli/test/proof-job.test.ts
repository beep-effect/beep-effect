import { $RepoCliId } from "@beep/identity/packages";
import { yeetCommand } from "@beep/repo-cli/commands/Yeet";
import { MemoryStats } from "@beep/repo-cli/test/RepoRun";
import * as Job from "@beep/repo-cli/test/Yeet";
import {
  attemptJournalPathForCheckout,
  ProofJobLauncher,
  readYeetAckState,
  YeetInboxRowJson,
  yeetProofJobRowId,
} from "@beep/repo-cli/test/Yeet";
import { UUID } from "@beep/schema/String";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { ConfigProvider, Context, Deferred, Effect, FileSystem, Layer, Path, Ref, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { Arbitrary } from "effect/unstable/arbitrary";
import { Command } from "effect/unstable/cli";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

const $I = $RepoCliId.create("test/proof-job.test");
const stamp = "2026-09-15T00:00:00.000Z";
const encodeJsonLine = S.encodeEffect(S.fromJsonString(S.Unknown));
const encodeRecordJson = S.encodeEffect(S.fromJsonString(Job.ProofJobRecord));
const decodeServiceResult = S.decodeUnknownEffect(Job.ProofJobServiceResult);
const attemptId = Effect.runSync(S.decodeEffect(UUID)("0f5c9a3e-6d3b-4c1e-9a8f-2b7d1c4e5a60"));
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
const writeExecutable = Effect.fnUntraced(function* (path: string, text: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(path, text);
  yield* fs.chmod(path, 0o755);
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
) => Effect.scoped(runFixture(use, exitCode)).pipe(provideScopedLayer(NodeServices.layer));
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

describe("proof job schemas", () => {
  it.effect.prop(
    "round trips ProofJobPhase",
    [Arbitrary.schema(Job.ProofJobPhase)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobPhase);
      const json = yield* S.encodeEffect(codec)(value);
      expect(S.toEquivalence(Job.ProofJobPhase)(yield* S.decodeEffect(codec)(json), value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobServiceResult",
    [Arbitrary.schema(Job.ProofJobServiceResult)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobServiceResult);
      const json = yield* S.encodeEffect(codec)(value);
      expect(S.toEquivalence(Job.ProofJobServiceResult)(yield* S.decodeEffect(codec)(json), value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobExitCode",
    [Arbitrary.schema(Job.ProofJobExitCode)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobExitCode);
      const json = yield* S.encodeEffect(codec)(value);
      expect(S.toEquivalence(Job.ProofJobExitCode)(yield* S.decodeEffect(codec)(json), value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobTerminationReason",
    [Arbitrary.schema(Job.ProofJobTerminationReason)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobTerminationReason);
      const json = yield* S.encodeEffect(codec)(value);
      expect(S.toEquivalence(Job.ProofJobTerminationReason)(yield* S.decodeEffect(codec)(json), value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobRowSeverity",
    [Arbitrary.schema(Job.ProofJobRowSeverity)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobRowSeverity);
      const json = yield* S.encodeEffect(codec)(value);
      expect(S.toEquivalence(Job.ProofJobRowSeverity)(yield* S.decodeEffect(codec)(json), value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobObservedVia",
    [Arbitrary.schema(Job.ProofJobObservedVia)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobObservedVia);
      const json = yield* S.encodeEffect(codec)(value);
      expect(S.toEquivalence(Job.ProofJobObservedVia)(yield* S.decodeEffect(codec)(json), value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobCancelOutcome",
    [Arbitrary.schema(Job.ProofJobCancelOutcome)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobCancelOutcome);
      const json = yield* S.encodeEffect(codec)(value);
      expect(S.toEquivalence(Job.ProofJobCancelOutcome)(yield* S.decodeEffect(codec)(json), value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobRequest",
    [Arbitrary.schema(Job.ProofJobRequest)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobRequest);
      const json = yield* S.encodeEffect(codec)(value);
      expect(S.toEquivalence(Job.ProofJobRequest)(yield* S.decodeEffect(codec)(json), value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobSubmitter",
    [Arbitrary.schema(Job.ProofJobSubmitter)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobSubmitter);
      const json = yield* S.encodeEffect(codec)(value);
      expect(S.toEquivalence(Job.ProofJobSubmitter)(yield* S.decodeEffect(codec)(json), value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobUnit",
    [Arbitrary.schema(Job.ProofJobUnit)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobUnit);
      const json = yield* S.encodeEffect(codec)(value);
      expect(S.toEquivalence(Job.ProofJobUnit)(yield* S.decodeEffect(codec)(json), value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobRunner",
    [Arbitrary.schema(Job.ProofJobRunner)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobRunner);
      const json = yield* S.encodeEffect(codec)(value);
      expect(S.toEquivalence(Job.ProofJobRunner)(yield* S.decodeEffect(codec)(json), value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobOutcome",
    [Arbitrary.schema(Job.ProofJobOutcome)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobOutcome);
      const json = yield* S.encodeEffect(codec)(value);
      expect(S.toEquivalence(Job.ProofJobOutcome)(yield* S.decodeEffect(codec)(json), value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobSystemdResult",
    [Arbitrary.schema(Job.ProofJobSystemdResult)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobSystemdResult);
      const json = yield* S.encodeEffect(codec)(value);
      expect(S.toEquivalence(Job.ProofJobSystemdResult)(yield* S.decodeEffect(codec)(json), value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobRecord",
    [Arbitrary.schema(Job.ProofJobRecord)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobRecord);
      const json = yield* S.encodeEffect(codec)(value);
      expect(S.toEquivalence(Job.ProofJobRecord)(yield* S.decodeEffect(codec)(json), value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips YeetProofJobCapsule",
    [Arbitrary.schema(Job.YeetProofJobCapsule)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.YeetProofJobCapsule);
      const json = yield* S.encodeEffect(codec)(value);
      expect(S.toEquivalence(Job.YeetProofJobCapsule)(yield* S.decodeEffect(codec)(json), value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobSubmission",
    [Arbitrary.schema(Job.ProofJobSubmission)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobSubmission);
      const json = yield* S.encodeEffect(codec)(value);
      expect(S.toEquivalence(Job.ProofJobSubmission)(yield* S.decodeEffect(codec)(json), value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobWaitOptions",
    [Arbitrary.schema(Job.ProofJobWaitOptions)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobWaitOptions);
      const json = yield* S.encodeEffect(codec)(value);
      expect(S.toEquivalence(Job.ProofJobWaitOptions)(yield* S.decodeEffect(codec)(json), value)).toBe(true);
    }),
    { arbitrary: { runs: 20, seed: 5 } }
  );
  it.effect.prop(
    "round trips ProofJobFinalization",
    [Arbitrary.schema(Job.ProofJobFinalization)],
    Effect.fnUntraced(function* ([value]) {
      const codec = S.fromJsonString(Job.ProofJobFinalization);
      const json = yield* S.encodeEffect(codec)(value);
      expect(S.toEquivalence(Job.ProofJobFinalization)(yield* S.decodeEffect(codec)(json), value)).toBe(true);
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
  });
});

describe("proof job launcher", () => {
  it.effect("submits a durable record and exact service arguments without secret values", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const fs = yield* FileSystem.FileSystem;
        const launcher = yield* ProofJobLauncher.make(root);
        const record = yield* launcher.submit(submission(root));
        expect(record.phase).toBe("submitted");
        const args = yield* fs.readFileString(`${root}/launch.argv`);
        for (const text of [
          "--collect",
          "--service-type=exec",
          "--expand-environment=no",
          "--slice=agent-runs.slice",
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
        expect(yield* fs.readFileString(`${root}/.beep/yeet/jobs/${record.jobId}.json`)).not.toContain("private");
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
        expect(yield* fs.exists(`${root}/.beep/yeet/jobs`)).toBe(false);
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
          expect(A.length(Str.split(yield* fs.readFileString(journal), '"attempt-terminated"'))).toBe(2);
          const rows = yield* inbox(root);
          expect(rows).toHaveLength(1);
          expect(rows[0]?.severity).toBe("P1");
        })
      )
    );
  }
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
        expect((yield* launcher.wait(record.jobId, Job.ProofJobWaitOptions.make({ pollIntervalMs: 1 }))).phase).toBe(
          "finished"
        );
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
        expect(yield* launcher.cancel(record.jobId)).toBe("stop-requested");
        expect(yield* fs.readFileString(`${root}/systemctl.argv`)).toContain(`--user\nstop\n${record.unit.unitName}`);
        const result = yield* launcher.finalize(
          record.jobId,
          Job.ProofJobSystemdResult.make({ serviceResult: "signal", finalizedAt: stamp })
        );
        expect(O.getOrNull(result.record.terminationReason)).toBe("cancelled");
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
  // it.live: wait polls the record with real sleeps against a shimmed systemctl; under the
  // TestClock the poll loop would never advance to its timeout.
  it.live("times out while a unit remains active", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const launcher = yield* ProofJobLauncher.make(root);
        const record = yield* launcher.submit(submission(root));
        const error = yield* launcher
          .wait(record.jobId, Job.ProofJobWaitOptions.make({ timeoutMs: O.some(15), pollIntervalMs: 1 }))
          .pipe(Effect.flip);
        expect(error.message).toContain("Timed out");
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
        expect(yield* fs.readFileString(journal)).not.toContain('"attempt-terminated"');
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
        expect(O.getOrThrow(yield* launcher.read(record.jobId)).phase).toBe("running");
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
          const finished = O.getOrThrow(yield* launcher.read(record.jobId));
          yield* fs.writeFileString(
            `${root}/.beep/yeet/jobs/${record.jobId}.json`,
            yield* encodeRecordJson(Job.ProofJobRecord.make({ ...finished, submittedAt }))
          );
        }
        expect(A.map(yield* launcher.list, (record) => record.jobId)).toContain(active.jobId);
        expect(yield* launcher.prune(1)).toEqual([first.jobId]);
        expect(yield* fs.exists(first.unit.logPath)).toBe(false);
        expect(yield* fs.exists(second.unit.logPath)).toBe(true);
        const retained = yield* launcher.read(active.jobId);
        retained.pipe(O.isSome, assertTrue);
      })
    )
  );
  // it.live: the finalizer lands between real poll ticks; the TestClock would freeze the
  // polling loop before the stamp appears.
  it.live("wait observes a finalizer that completes after polling begins", () =>
    fixture(
      Effect.fnUntraced(function* (root) {
        const launcher = yield* ProofJobLauncher.make(root);
        const record = yield* launcher.submit(submission(root));
        yield* launcher
          .finalize(record.jobId, Job.ProofJobSystemdResult.make({ serviceResult: "timeout", finalizedAt: stamp }))
          .pipe(Effect.delay("10 millis"), Effect.forkChild);
        const done = yield* launcher.wait(
          record.jobId,
          Job.ProofJobWaitOptions.make({ timeoutMs: O.some(2000), pollIntervalMs: 1 })
        );
        expect(done.phase).toBe("terminated");
      })
    )
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

it.layer(NodeServices.layer, { timeout: "30 seconds", excludeTestServices: true })(
  "review round 1 transitions",
  (it) => {
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
                  if (to === `${root}/.beep/yeet/jobs/${record.jobId}.lock` && (yield* fs.exists(to)))
                    yield* Deferred.succeed(releaseSave, undefined);
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
              const final = O.getOrThrow(yield* original.read(record.jobId));
              expect(final.phase).toBe("terminated");
              expect(O.getOrThrow(final.systemd).serviceResult).toBe("signal");
              expect(O.getOrThrow(final.terminationReason)).toBe(cancelFirst ? "cancelled" : "signal");
              expect(yield* fs.exists(`${root}/.beep/yeet/jobs/${record.jobId}.lock`)).toBe(false);
              expect(yield* launcher.cancel(record.jobId)).toBe("already-terminal");
              expect(
                yield* launcher.markFinished(
                  record.jobId,
                  Job.ProofJobOutcome.make({ verdictOutcome: "success", endedAt: stamp })
                )
              ).toEqual(final);
              expect(
                yield* launcher.markRunning(
                  record.jobId,
                  Job.ProofJobRunner.make({ pid: process.pid, startedAt: stamp })
                )
              ).toEqual(final);
              expect(yield* inbox(root)).toHaveLength(1);
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
          expect(yield* fs.exists(lock)).toBe(false);
          yield* launcher.cancel(record.jobId);
          expect(yield* fs.exists(lock)).toBe(false);
          yield* launcher.markFinished(
            record.jobId,
            Job.ProofJobOutcome.make({ verdictOutcome: "success", endedAt: stamp })
          );
          expect(yield* fs.exists(lock)).toBe(false);
          yield* launcher.finalize(
            record.jobId,
            Job.ProofJobSystemdResult.make({ serviceResult: "success", finalizedAt: stamp })
          );
          expect(yield* fs.exists(lock)).toBe(false);
          yield* launcher.read(record.jobId);
          expect(yield* fs.exists(lock)).toBe(false);
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
            const reconciled = O.getOrThrow(yield* launcher.read(record.jobId));
            expect(reconciled.phase).toBe("finished");
            expect(O.getOrThrow(reconciled.systemd).serviceResult).toBe("unknown");
            expect(yield* launcher.wait(record.jobId, Job.ProofJobWaitOptions.make({}))).toEqual(reconciled);
            const rows = yield* inbox(root);
            expect(rows).toHaveLength(1);
            expect(rows[0]?.severity).toBe(verdictOutcome === "success" ? "P2" : "P1");
            expect((yield* readYeetAckState(root, yeetProofJobRowId(record))).receipt?.resolution).toMatchObject({
              kind: "observed",
              via: "job-wait",
            });
            expect(yield* fs.exists(`${root}/.beep/yeet/jobs/${record.jobId}.lock`)).toBe(false);
          })
        )
      );
    }
  }
);

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
      NodeServices.layer,
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
      expect(A.join(A.filter(yield* TestConsole.logLines, P.isString), "\n")).toContain("unit not loaded");
      for (const content of ["first\nsecond\n", "last", ""]) {
        yield* fs.writeFileString(record.unit.logPath, content);
        yield* runJobCommand(["job", "logs", record.jobId, "--tail", "1"]);
      }
      yield* fs.remove(record.unit.logPath);
      yield* runJobCommand(["job", "logs", record.jobId]);
      expect(yield* runJobCommand(["job", "logs", record.jobId, "--tail=-1"]).pipe(Effect.flip)).toMatchObject({
        message: "--tail must be nonnegative.",
      });
      expect(yield* runJobCommand(["job", "status", attemptId]).pipe(Effect.flip)).toMatchObject({
        message: `Unknown proof job ${attemptId}.`,
      });
      expect(yield* runJobCommand(["job", "wait", attemptId]).pipe(Effect.flip)).toMatchObject({
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
      expect(yield* runJobCommand(["job", "wait", record.jobId, "--json"]).pipe(Effect.flip)).toMatchObject({
        exitCode: 2,
      });
      const row = (yield* inbox(root))[0];
      if (row === undefined) return yield* Effect.die("Expected finalization inbox row");
      expect(Job.yeetInboxExpectedRowId(row)).toBe(yeetProofJobRowId(record));
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
        id: Job.yeetInboxRowId(capsule),
        severity: "P0",
        ts: stamp,
      });
      yield* Job.appendYeetInboxRow(root, row);
      expect(yield* runJobCommand(["inbox", "ack", row.id, "--observed"]).pipe(Effect.flip)).toMatchObject({
        message: "--observed applies only to proof-job-finished rows.",
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
        if (verdictOutcome === "success") yield* wait;
        else expect(yield* wait.pipe(Effect.flip)).toMatchObject({ exitCode: 1 });
        for (const duration of ["0s", "bad"])
          expect(
            (yield* runJobCommand(["job", "wait", record.jobId, "--timeout", duration]).pipe(Effect.flip))._tag
          ).toBe("YeetCommandError");
      })
    );
  }
  it.effect(
    "binds finalization to job, unit, and any recorded invocation",
    Effect.fnUntraced(function* () {
      const { root, launcher } = yield* CommandCheckout;
      const record = yield* launcher.submit(submission(root));
      const command = runJobCommand(["job", "finalize", record.jobId]);
      expect(yield* command.pipe(Effect.flip)).toMatchObject({
        message: "BEEP_YEET_JOB_ID does not match the proof job.",
      });
      for (const [name, value] of [
        ["BEEP_YEET_JOB_ID", "wrong"],
        ["BEEP_YEET_JOB_UNIT", "wrong"],
      ]) {
        expect(
          yield* command.pipe(
            Effect.provideService(ConfigProvider.ConfigProvider, jobEnvironment(root, record, { [name]: value })),
            Effect.flip
          )
        ).toMatchObject({ message: `${name} does not match the proof job.` });
      }
      const noUnit = ConfigProvider.fromUnknown({ BEEP_YEET_JOB_ID: record.jobId });
      expect(
        yield* command.pipe(Effect.provideService(ConfigProvider.ConfigProvider, noUnit), Effect.flip)
      ).toMatchObject({
        message: "BEEP_YEET_JOB_UNIT does not match the proof job.",
      });
      yield* launcher
        .markRunning(record.jobId, Job.ProofJobRunner.make({ pid: process.pid, startedAt: stamp }))
        .pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, jobEnvironment(root, record, { INVOCATION_ID: "same" }))
        );
      expect(
        yield* command.pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            jobEnvironment(root, record, { INVOCATION_ID: "different" })
          ),
          Effect.flip
        )
      ).toMatchObject({ message: "INVOCATION_ID does not match the proof job." });
      yield* command.pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          jobEnvironment(root, record, { INVOCATION_ID: "same", SERVICE_RESULT: "invalid", EXIT_CODE: "invalid" })
        )
      );
      expect(O.getOrThrow(O.getOrThrow(yield* launcher.read(record.jobId)).systemd).serviceResult).toBe("unknown");
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
        if (stopResult === "loaded")
          expect(yield* cancel.pipe(Effect.flip)).toMatchObject({ message: "systemctl could not stop the job." });
        else yield* cancel;
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
      expect(yield* runJobCommand(["verify", "--detach"]).pipe(Effect.flip)).toMatchObject({
        message: "Cannot detach: original argv must begin with yeet.",
      });
      process.argv = [process.execPath, "/repo/cli.ts"];
      expect((yield* runJobCommand(["verify", "--detach"]).pipe(Effect.flip))._tag).toBe("YeetCommandError");
      process.argv = [];
      expect((yield* runJobCommand(["verify", "--detach"]).pipe(Effect.flip))._tag).toBe("YeetCommandError");
      yield* writeExecutable(`${root}/git`, "#!/bin/sh\nprintf 'bad git coordinates\\n'\nexit 1\n");
      expect(yield* runJobCommand(["verify", "--detach"]).pipe(Effect.flip)).toMatchObject({
        message: "bad git coordinates",
      });
    })
  );
});

it.layer(NodeServices.layer, { timeout: "30 seconds", excludeTestServices: true })(
  "proof job journal boundaries",
  (it) => {
    it.effect("does not invent an attempt when the journal or start row is missing", () =>
      fixture(
        Effect.fnUntraced(function* (root) {
          const fs = yield* FileSystem.FileSystem;
          const journal = `${root}/attempts.ndjson`;
          expect(yield* Job.appendProofJobAttemptTerminated(journal, attemptId, "signal")).toBe(false);
          yield* fs.writeFileString(journal, "");
          expect(yield* Job.appendProofJobAttemptTerminated(journal, attemptId, "signal")).toBe(false);
          expect(yield* fs.exists(`${journal}.lock`)).toBe(false);
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
          expect(
            yield* Job.appendProofJobAttemptTerminated(journal, attemptId, "signal").pipe(Effect.flip)
          ).toMatchObject({ message: "Attempt journal stayed busy during proof-job finalization." });
          expect(yield* fs.readFileString(journal)).toBe("");
        })
      )
    );
  }
);

it.layer(NodeServices.layer, { timeout: "30 seconds" })("proof verdict bookkeeping", (it) => {
  for (const identity of ["valid", "failed", "invalid", "missing-record"]) {
    it.effect(`records the verdict despite ${identity} job bookkeeping`, () =>
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
          });
          yield* Job.writeRunVerdictForTesting(
            plan,
            Job.defaultYeetRunOptions({ mode: "verify" }),
            started,
            0,
            recorder,
            extras,
            identity === "failed" ? "failure" : "success",
            "verified",
            O.none()
          ).pipe(
            Effect.provideService(
              ConfigProvider.ConfigProvider,
              ConfigProvider.fromUnknown({
                PATH: root,
                BEEP_YEET_JOB_ID:
                  identity === "valid" || identity === "failed"
                    ? record.jobId
                    : identity === "invalid"
                      ? "bad-id"
                      : attemptId,
              })
            )
          );
          const fs = yield* FileSystem.FileSystem;
          expect(yield* fs.exists(yield* Job.runArtifactPathForContext(context, "verdict.json"))).toBe(true);
          if (identity === "valid" || identity === "failed") {
            const finished = O.getOrThrow(yield* launcher.read(record.jobId));
            expect(finished.phase).toBe("finished");
            expect(O.getOrThrow(finished.outcome).verdictOutcome).toBe(identity === "failed" ? "failure" : "success");
          } else
            expect(A.join(A.filter(yield* TestConsole.errorLines, P.isString), "\n")).toContain(
              "job bookkeeping failed"
            );
        })
      )
    );
  }
});

it.layer(NodeServices.layer, { timeout: "30 seconds" })("proof phase record integration", (it) => {
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
          const spawner = ChildProcessSpawner.make(
            Effect.fnUntraced(function* (command) {
              if (!ChildProcess.isStandardCommand(command))
                return yield* Effect.die("Expected a standard proof command");
              if (command.command === "/usr/bin/time") {
                const rssPath = O.getOrThrow(A.get(command.args, 3));
                yield* fs.writeFileString(rssPath, measurement === "valid" ? "42\n" : "unknown\n");
              }
              const exitCode = A.contains(command.args, "fail") ? 23 : 0;
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
              Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
              Effect.provideService(FileSystem.FileSystem, filesystem)
            );
          const failed = yield* execute([step("full:first", "fail"), step("full:second", "pass")]);
          expect(A.map(failed, (result) => result.exitCode)).toEqual([23]);
          const passed = yield* execute([step("full:first", "pass"), step("full:second", "pass")]);
          expect(A.map(passed, (result) => result.exitCode)).toEqual([0, 0]);
          expect(yield* Ref.get(recorder)).toHaveLength(3);
          expect(passed[0]?.peakRssKb).toBe(measurement === "valid" ? 42 : undefined);
          const rows = yield* Job.loadYeetInboxView(root);
          expect(rows.entries).toHaveLength(1);
          expect(rows.entries[0]?.ack.acked).toBe(true);
        })
      )
    );
  }
});
