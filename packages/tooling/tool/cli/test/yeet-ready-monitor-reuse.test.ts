import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { YeetCommandError } from "@beep/repo-cli/commands/Yeet";
import {
  findLiveMonitorForReadyForTesting,
  isReadyMonitorRequest,
  isReusableReadyMonitorJob,
  MONITOR_READY_SUBMIT_ARGV,
  ProofJobRecord,
  ProofJobRequest,
  ProofJobRunner,
  ProofJobRuntimeCapRequest,
  ProofJobSubmission,
  ProofJobSubmitter,
  ProofJobUnit,
  pickLiveReadyMonitor,
  proofJobRuntimeCapSeconds,
  ReadyMonitorRequest,
  RepoRunContext,
  readyMonitorArgvKey,
  readyMonitorRunnerStatus,
  stripProofJobSubmitFlags,
  submitProofJobReusingReadyMonitor,
  TurboPlanSnapshot,
  yeetJobRuntimeCap,
} from "@beep/repo-cli/test/Yeet";
import { describe, it } from "@effect/vitest";
import { assertFalse, assertInclude, assertNone, assertSome, assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as TestConsole from "effect/testing/TestConsole";
import type { ProofJobLauncherShape, ReadyMonitorRunnerProbe } from "@beep/repo-cli/test/Yeet";

// PERIL-02 (goals/local-proof-under-ten): one live readiness monitor per pull
// request and readiness argv. Every registry, submit and runner probe here is
// a fake; nothing reads systemd or another process.

const HEAD = "0123456789abcdef0123456789abcdef01234567";
const BRANCH = "feat/reuse";
const LIVE_ID = "cc5d6bd3-1111-4aaa-8bbb-000000000001";
const OLDER_ID = "dd5d6bd3-2222-4aaa-8bbb-000000000002";
const FIRST_SUBMIT_ID = "ee5d6bd3-3333-4aaa-8bbb-000000000003";
const SUBMIT_IDS = [FIRST_SUBMIT_ID, "ff5d6bd3-4444-4aaa-8bbb-000000000004"];
const CLI_ARGV = ["monitor", "--until-ready", "--detach"];
const STRICTER_ARGV = ["monitor", "--until-ready", "--settle-timeout", "2h", "--detach"];
const HOUR = 3600;
const ANY_CAP = ProofJobRuntimeCapRequest.cases.unspecified.make({});
const NO_CAP = ProofJobRuntimeCapRequest.cases.uncapped.make({});
const capOf = (seconds: number) => ProofJobRuntimeCapRequest.cases.capped.make({ seconds });

const jobRequest = (argv: ReadonlyArray<string>, branch = BRANCH, mode: ProofJobRequest["mode"] = "monitor") =>
  ProofJobRequest.make({
    mode,
    argv,
    checkout: "/repo",
    branch,
    base: "origin/main",
    head: HEAD,
    forwardedEnvNames: [],
  });

const jobRecord = (
  jobId: string,
  request: ProofJobRequest,
  fields: Partial<Pick<ProofJobRecord, "phase" | "prNumber" | "runner" | "cancelRequestedAt">> = {},
  maxRuntimeSeconds: O.Option<number> = O.none()
) =>
  ProofJobRecord.make({
    jobId,
    phase: "running",
    submittedAt: "2026-11-14T10:00:00.000Z",
    request,
    submitter: ProofJobSubmitter.make({ pid: 4242, cwd: "/repo" }),
    unit: ProofJobUnit.make({
      unitName: `beep-proof-${jobId}.service`,
      slice: "agent-runs.slice",
      description: "beep-yeet-job",
      logPath: `/repo/.beep/yeet/jobs/${jobId}.log`,
      execStart: ["/opt/bun"],
      execStopPost: ["/opt/bun"],
      maxRuntimeSeconds,
    }),
    ...fields,
  });

const runner = (pid: number) => O.some(ProofJobRunner.make({ pid, startedAt: "2026-11-14T10:00:01.000Z" }));

const submission = (
  argv: ReadonlyArray<string>,
  mode: ProofJobRequest["mode"] = "monitor",
  maxRuntimeSeconds: O.Option<number> = O.none()
) =>
  ProofJobSubmission.make({
    request: jobRequest(argv, BRANCH, mode),
    submitter: ProofJobSubmitter.make({ pid: 5151, cwd: "/repo" }),
    execPath: "/opt/bun",
    entrypoint: "/repo/bin.ts",
    maxRuntimeSeconds,
  });

// A registry the fake submit appends to, newest first, as `launcher.list` returns it.
const fakeLauncher = Effect.fnUntraced(function* (initial: ReadonlyArray<ProofJobRecord>) {
  const registry = yield* Ref.make(initial);
  const submitted = yield* Ref.make<ReadonlyArray<ProofJobSubmission>>([]);
  const listed = yield* Ref.make(0);
  const launcher: Pick<ProofJobLauncherShape, "list" | "submit"> = {
    list: Ref.update(listed, (count) => count + 1).pipe(Effect.andThen(Ref.get(registry))),
    submit: Effect.fnUntraced(function* (next: ProofJobSubmission) {
      const earlier = yield* Ref.get(submitted);
      const record = jobRecord(
        O.getOrElse(A.get(SUBMIT_IDS, A.length(earlier)), () => FIRST_SUBMIT_ID),
        jobRequest(stripProofJobSubmitFlags(next.request.argv), next.request.branch, next.request.mode),
        { phase: "submitted" },
        next.maxRuntimeSeconds
      );
      yield* Ref.update(submitted, A.append(next));
      yield* Ref.update(registry, A.prepend(record));
      return record;
    }),
  };
  return { launcher, submitted, listed };
});

const probe =
  (status: "alive" | "dead" | "unknown", probed?: Ref.Ref<ReadonlyArray<string>>): ReadyMonitorRunnerProbe =>
  (record) =>
    (probed === undefined ? Effect.void : Ref.update(probed, A.append(record.jobId))).pipe(Effect.as(status));

const errorText = TestConsole.errorLines.pipe(Effect.map((lines) => A.join(A.map(lines, String), "\n")));

const context = RepoRunContext.make({
  base: "origin/main",
  branch: BRANCH,
  cwd: "/repo",
  head: "HEAD",
  originalArgv: [],
  packetDir: ".beep/yeet",
  repoRoot: "/repo",
  turbo: TurboPlanSnapshot.make({ graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }),
});

// The ready gate's registry lookup is typed against the live launcher's
// services; the injected listing never touches them.
const reuseTestLayer = Layer.mergeAll(
  MemoryFileSystem.layer,
  Path.layer,
  SecureRandom.layerWebCrypto,
  Digest.layerWebCrypto,
  ScriptedSpawner.make(() => ({ exit: 1 })).layer
);

describe("readiness monitor argv key", () => {
  it("keys flags with their values regardless of order, spelling, presentation or cadence", () => {
    const expected = ["--settle-timeout 20m", "--until-ready", "monitor"];
    deepStrictEqual(
      readyMonitorArgvKey(["monitor", "--until-ready", "--settle-timeout=20m", "--detach", "--json"]),
      expected
    );
    deepStrictEqual(
      readyMonitorArgvKey([
        "monitor",
        "--poll-interval",
        "30s",
        "--settle-timeout",
        "20m",
        "--summary",
        "--until-ready",
        "--job-max-runtime=1h",
      ]),
      expected
    );
  });

  it("keeps a different value and an unknown requirement flag in the key", () => {
    const base = readyMonitorArgvKey(CLI_ARGV);
    deepStrictEqual(base, ["--until-ready", "monitor"]);
    assertFalse(A.contains(readyMonitorArgvKey(STRICTER_ARGV), "--until-ready monitor"));
    deepStrictEqual(readyMonitorArgvKey(STRICTER_ARGV), ["--settle-timeout 2h", "--until-ready", "monitor"]);
    deepStrictEqual(readyMonitorArgvKey([...CLI_ARGV, "--require-greptile-score", "5/5"]), [
      "--require-greptile-score 5/5",
      "--until-ready",
      "monitor",
    ]);
  });

  it("recognizes only an until-ready monitor request", () => {
    assertTrue(isReadyMonitorRequest(jobRequest(CLI_ARGV)));
    assertFalse(isReadyMonitorRequest(jobRequest(["monitor", "--until-merged"])));
    assertFalse(isReadyMonitorRequest(jobRequest(["verify", "--until-ready"], BRANCH, "verify")));
  });
});

describe("reusable readiness monitor", () => {
  const live = jobRecord(LIVE_ID, jobRequest(["monitor", "--until-ready", "--json"]), { prNumber: O.some(1427) });
  const cli = ReadyMonitorRequest.make({ branch: BRANCH, argv: CLI_ARGV });

  it("reuses a polling job on the same branch with the same readiness argv", () => {
    assertTrue(isReusableReadyMonitorJob(live, cli));
    assertTrue(isReusableReadyMonitorJob(jobRecord(LIVE_ID, jobRequest(CLI_ARGV), { phase: "submitted" }), cli));
  });

  it("never lets a looser job satisfy a stricter request, or the reverse", () => {
    assertFalse(isReusableReadyMonitorJob(live, ReadyMonitorRequest.make({ branch: BRANCH, argv: STRICTER_ARGV })));
    const stricterJob = jobRecord(OLDER_ID, jobRequest(stripProofJobSubmitFlags(STRICTER_ARGV)));
    assertFalse(isReusableReadyMonitorJob(stricterJob, cli));
  });

  it("matches the pull request number when both sides know one, else the branch", () => {
    const publish = (prNumber: number, branch = BRANCH) =>
      ReadyMonitorRequest.make({ branch, prNumber: O.some(prNumber), argv: MONITOR_READY_SUBMIT_ARGV });
    assertTrue(isReusableReadyMonitorJob(live, publish(1427)));
    assertTrue(isReusableReadyMonitorJob(live, publish(1427, "renamed/branch")));
    assertFalse(isReusableReadyMonitorJob(live, publish(99)));
    assertFalse(isReusableReadyMonitorJob(live, ReadyMonitorRequest.make({ branch: "feat/other", argv: CLI_ARGV })));
    const unbound = jobRecord(OLDER_ID, jobRequest(CLI_ARGV), { phase: "submitted" });
    assertTrue(isReusableReadyMonitorJob(unbound, publish(1427)));
    assertFalse(isReusableReadyMonitorJob(unbound, publish(1427, "feat/other")));
  });

  it("refuses a job that stopped polling or is not a readiness monitor", () => {
    const stopped = A.map(
      [
        jobRecord(LIVE_ID, live.request, { phase: "finished" }),
        jobRecord(LIVE_ID, live.request, { phase: "terminated" }),
        jobRecord(LIVE_ID, live.request, { cancelRequestedAt: O.some("2026-11-14T10:05:00.000Z") }),
        jobRecord(LIVE_ID, jobRequest(["verify"], BRANCH, "verify")),
        jobRecord(LIVE_ID, jobRequest(["monitor", "--until-merged"])),
      ],
      isReusableReadyMonitorJob(cli)
    );
    deepStrictEqual(stopped, [false, false, false, false, false]);
  });
});

describe("readiness monitor runtime cap", () => {
  // `--job-max-runtime` is a launch flag: it never enters the argv key, so a
  // request that names one keys like one that does not.
  const asking = (runtimeCap: ProofJobRuntimeCapRequest) =>
    ReadyMonitorRequest.make({ branch: BRANCH, argv: [...CLI_ARGV, "--job-max-runtime", "6h"], runtimeCap });
  const hourCapped = jobRecord(LIVE_ID, jobRequest(CLI_ARGV), {}, O.some(HOUR));
  const uncapped = jobRecord(OLDER_ID, jobRequest(CLI_ARGV));

  it("reuses a capped job for an equal, shorter or unspecified cap", () => {
    deepStrictEqual(
      A.map([capOf(HOUR), capOf(HOUR / 2), ANY_CAP], (cap) => isReusableReadyMonitorJob(hourCapped, asking(cap))),
      [true, true, true]
    );
  });

  it("does not reuse a capped job for a longer cap or an explicit none", () => {
    deepStrictEqual(
      A.map([capOf(6 * HOUR), NO_CAP], (cap) => isReusableReadyMonitorJob(hourCapped, asking(cap))),
      [false, false]
    );
  });

  it("reuses a job without a cap for any request", () => {
    deepStrictEqual(
      A.map([capOf(6 * HOUR), NO_CAP, ANY_CAP], (cap) => isReusableReadyMonitorJob(uncapped, asking(cap))),
      [true, true, true]
    );
  });

  it("gives a new job a RuntimeMaxSec only for a capped request", () => {
    assertSome(proofJobRuntimeCapSeconds(capOf(HOUR)), HOUR);
    assertNone(proofJobRuntimeCapSeconds(ANY_CAP));
    assertNone(proofJobRuntimeCapSeconds(NO_CAP));
  });
});

it.layer(reuseTestLayer, { timeout: "30 seconds" })("--job-max-runtime", (it) => {
  it.effect(
    "reads nothing, none and a duration as the three runtime cap requests",
    Effect.fnUntraced(function* () {
      const caps = yield* Effect.forEach(["", "none", "90m", "1h"], yeetJobRuntimeCap);
      deepStrictEqual(caps, [ANY_CAP, NO_CAP, capOf(5400), capOf(HOUR)]);
      const refused = yield* Effect.flip(yeetJobRuntimeCap("soon"));
      deepStrictEqual(refused.message, "Expected a duration such as '30 seconds'.");
    })
  );
});

it.layer(reuseTestLayer, { timeout: "30 seconds" })("monitor --until-ready --detach reuse", (it) => {
  it.effect(
    "two submissions with the same pull request and argv yield one job",
    Effect.fnUntraced(function* () {
      const fake = yield* fakeLauncher([]);
      const first = yield* submitProofJobReusingReadyMonitor(fake.launcher, submission(CLI_ARGV), ANY_CAP);
      // The live probe: the first job has no runner yet, so its unit is still starting.
      const second = yield* submitProofJobReusingReadyMonitor(fake.launcher, submission(CLI_ARGV), ANY_CAP);
      deepStrictEqual([first.jobId, second.jobId], [FIRST_SUBMIT_ID, FIRST_SUBMIT_ID]);
      const submitted = yield* Ref.get(fake.submitted);
      deepStrictEqual(A.length(submitted), 1);
      const errors = yield* errorText;
      assertInclude(
        errors,
        `readiness monitor job ${FIRST_SUBMIT_ID} is already submitted for ${BRANCH} with the same readiness flags and no runtime cap; not re-submitted`
      );
    })
  );

  it.effect(
    "hands a publish-submitted monitor back to a later --detach without --json",
    Effect.fnUntraced(function* () {
      const fromPublish = jobRecord(LIVE_ID, jobRequest(["monitor", "--until-ready", "--json"]), {
        prNumber: O.some(1427),
        runner: runner(31337),
      });
      const fake = yield* fakeLauncher([fromPublish]);
      const probed = yield* Ref.make<ReadonlyArray<string>>([]);
      const record = yield* submitProofJobReusingReadyMonitor(
        fake.launcher,
        submission(CLI_ARGV),
        ANY_CAP,
        probe("alive", probed)
      );
      const submitted = yield* Ref.get(fake.submitted);
      const probedIds = yield* Ref.get(probed);
      deepStrictEqual([record.jobId, A.length(submitted)], [LIVE_ID, 0]);
      deepStrictEqual(probedIds, [LIVE_ID]);
    })
  );

  it.effect(
    "submits a new job when the request is stricter than the live monitor",
    Effect.fnUntraced(function* () {
      const fake = yield* fakeLauncher([jobRecord(LIVE_ID, jobRequest(["monitor", "--until-ready"]))]);
      const record = yield* submitProofJobReusingReadyMonitor(
        fake.launcher,
        submission(STRICTER_ARGV),
        ANY_CAP,
        probe("alive")
      );
      const submitted = yield* Ref.get(fake.submitted);
      deepStrictEqual(record.jobId, FIRST_SUBMIT_ID);
      deepStrictEqual(
        A.map(submitted, (next) => next.request.argv),
        [STRICTER_ARGV]
      );
    })
  );

  it.effect(
    "never reuses a monitor whose runner is dead",
    Effect.fnUntraced(function* () {
      const fake = yield* fakeLauncher([jobRecord(LIVE_ID, jobRequest(CLI_ARGV), { runner: runner(31337) })]);
      const record = yield* submitProofJobReusingReadyMonitor(
        fake.launcher,
        submission(CLI_ARGV),
        ANY_CAP,
        probe("dead")
      );
      const submitted = yield* Ref.get(fake.submitted);
      const errors = yield* errorText;
      deepStrictEqual([record.jobId, A.length(submitted)], [FIRST_SUBMIT_ID, 1]);
      assertInclude(
        errors,
        `readiness monitor job ${LIVE_ID} is recorded running but its runner process is gone; not reusing it`
      );
    })
  );

  it.effect(
    "submits when the job registry cannot be read",
    Effect.fnUntraced(function* () {
      const fake = yield* fakeLauncher([]);
      const launcher = { ...fake.launcher, list: YeetCommandError.make({ message: "jobs dir unreadable" }) };
      const record = yield* submitProofJobReusingReadyMonitor(launcher, submission(CLI_ARGV), ANY_CAP, probe("alive"));
      const errors = yield* errorText;
      deepStrictEqual(record.jobId, FIRST_SUBMIT_ID);
      assertInclude(errors, "could not read the job registry; submitting a new monitor: jobs dir unreadable");
    })
  );

  it.effect(
    "submits any other detached job without reading the registry",
    Effect.fnUntraced(function* () {
      const fake = yield* fakeLauncher([jobRecord(LIVE_ID, jobRequest(CLI_ARGV))]);
      yield* submitProofJobReusingReadyMonitor(fake.launcher, submission(["verify", "--detach"], "verify"), ANY_CAP);
      yield* submitProofJobReusingReadyMonitor(
        fake.launcher,
        submission(["monitor", "--until-merged", "--detach"]),
        ANY_CAP
      );
      const listed = yield* Ref.get(fake.listed);
      const submitted = yield* Ref.get(fake.submitted);
      deepStrictEqual([listed, A.length(submitted)], [0, 2]);
    })
  );

  it.effect(
    "hands back a capped monitor for a shorter cap and names its cap",
    Effect.fnUntraced(function* () {
      const fake = yield* fakeLauncher([jobRecord(LIVE_ID, jobRequest(CLI_ARGV), {}, O.some(HOUR))]);
      const record = yield* submitProofJobReusingReadyMonitor(
        fake.launcher,
        submission([...CLI_ARGV, "--job-max-runtime", "30m"], "monitor", O.some(HOUR / 2)),
        capOf(HOUR / 2),
        probe("alive")
      );
      const submitted = yield* Ref.get(fake.submitted);
      const errors = yield* errorText;
      deepStrictEqual([record.jobId, A.length(submitted)], [LIVE_ID, 0]);
      assertInclude(
        errors,
        `readiness monitor job ${LIVE_ID} is already running for ${BRANCH} with the same readiness flags and a runtime cap of 1h; not re-submitted`
      );
    })
  );

  it.effect(
    "submits a new monitor for a longer cap, and again for an explicit none",
    Effect.fnUntraced(function* () {
      const fake = yield* fakeLauncher([jobRecord(LIVE_ID, jobRequest(CLI_ARGV), {}, O.some(HOUR))]);
      const longer = yield* submitProofJobReusingReadyMonitor(
        fake.launcher,
        submission([...CLI_ARGV, "--job-max-runtime", "6h"], "monitor", O.some(6 * HOUR)),
        capOf(6 * HOUR),
        probe("alive")
      );
      // The six-hour job just submitted is capped too, so `none` reuses neither.
      const none = yield* submitProofJobReusingReadyMonitor(
        fake.launcher,
        submission([...CLI_ARGV, "--job-max-runtime", "none"]),
        NO_CAP,
        probe("alive")
      );
      const submitted = yield* Ref.get(fake.submitted);
      deepStrictEqual([longer.jobId, none.jobId], SUBMIT_IDS);
      deepStrictEqual(
        A.map(submitted, (next) => O.getOrNull(next.maxRuntimeSeconds)),
        [6 * HOUR, null]
      );
    })
  );

  it.effect(
    "skips a dead newer monitor and keeps the newest live one",
    Effect.fnUntraced(function* () {
      const records = [
        jobRecord(LIVE_ID, jobRequest(CLI_ARGV), { runner: runner(31337) }),
        jobRecord(OLDER_ID, jobRequest(CLI_ARGV), { runner: runner(31338) }),
      ];
      const status: ReadyMonitorRunnerProbe = (record) => Effect.succeed(record.jobId === LIVE_ID ? "dead" : "unknown");
      const picked = yield* pickLiveReadyMonitor(records, () => true, status);
      assertSome(
        O.map(picked, (record) => record.jobId),
        OLDER_ID
      );
      const unmatched = yield* pickLiveReadyMonitor(records, () => false, status);
      assertNone(unmatched);
    })
  );

  it.effect(
    "reads a runner-less job and a live runner as alive",
    Effect.fnUntraced(function* () {
      // Signal 0 to this test's own pid: the one runner that is alive on every host.
      const statuses = yield* Effect.forEach(
        [
          jobRecord(LIVE_ID, jobRequest(CLI_ARGV)),
          jobRecord(LIVE_ID, jobRequest(CLI_ARGV), { runner: runner(process.pid) }),
        ],
        readyMonitorRunnerStatus
      );
      deepStrictEqual(statuses, ["alive", "alive"]);
    })
  );
});

it.layer(reuseTestLayer, { timeout: "30 seconds" })("yeet ready monitor hint", (it) => {
  const bound = jobRecord(LIVE_ID, jobRequest(["monitor", "--until-ready", "--json"]), {
    prNumber: O.some(1427),
    runner: runner(31337),
  });

  // The defect at the old ReadyGate.ts:565: the hint named a job whose runner was gone.
  it.effect(
    "does not name a monitor whose runner is dead as the watcher",
    Effect.fnUntraced(function* () {
      const watching = yield* findLiveMonitorForReadyForTesting(
        context,
        1427,
        () => Effect.succeed([bound]),
        probe("dead")
      );
      const errors = yield* errorText;
      assertNone(watching);
      assertInclude(errors, `readiness monitor job ${LIVE_ID} is recorded running but its runner process is gone`);
    })
  );

  it.effect(
    "names a live monitor and loses only the hint on a registry failure",
    Effect.fnUntraced(function* () {
      const alive = yield* findLiveMonitorForReadyForTesting(
        context,
        1427,
        () => Effect.succeed([bound]),
        probe("alive")
      );
      assertSome(
        O.map(alive, (record) => record.jobId),
        LIVE_ID
      );
      // The live probe reads a runner-less submitted job as alive.
      const unbound = jobRecord(OLDER_ID, jobRequest(CLI_ARGV), { phase: "submitted" });
      const starting = yield* findLiveMonitorForReadyForTesting(context, 1427, () => Effect.succeed([unbound]));
      assertSome(
        O.map(starting, (record) => record.jobId),
        OLDER_ID
      );
      const failed = yield* findLiveMonitorForReadyForTesting(context, 1427, () =>
        YeetCommandError.make({ message: "jobs dir unreadable" })
      );
      assertNone(failed);
      // The default listing reads this checkout's empty in-memory registry.
      const unlisted = yield* findLiveMonitorForReadyForTesting(context, 1427);
      assertNone(unlisted);
    })
  );
});
