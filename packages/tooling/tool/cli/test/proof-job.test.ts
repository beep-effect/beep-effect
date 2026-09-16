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
import { ConfigProvider, Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Arbitrary } from "effect/unstable/arbitrary";

const stamp = "2026-09-15T00:00:00.000Z";
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
  const start = yield* S.encodeEffect(S.fromJsonString(S.Unknown))({
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
          const serviceResult = yield* S.decodeUnknownEffect(Job.ProofJobServiceResult)(result);
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
        const terminal = yield* S.encodeEffect(S.fromJsonString(S.Unknown))({
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
            yield* S.encodeEffect(S.fromJsonString(Job.ProofJobRecord))(
              Job.ProofJobRecord.make({ ...finished, submittedAt })
            )
          );
        }
        expect(A.map(yield* launcher.list, (record) => record.jobId)).toContain(active.jobId);
        expect(yield* launcher.prune(1)).toEqual([first.jobId]);
        expect(yield* fs.exists(first.unit.logPath)).toBe(false);
        expect(yield* fs.exists(second.unit.logPath)).toBe(true);
        assertTrue(O.isSome(yield* launcher.read(active.jobId)));
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
