import { CiLocalStepPlan } from "@beep/repo-cli/commands/Ci";
import { formatCommandLine } from "@beep/repo-cli/test/Process";
import {
  githubCheckChangesetStatusLane,
  githubCheckPrePushLanes,
  LaneProofRefusal,
  QualityTaskLaneRun,
  QualityTaskLaneRunReport,
  renderLaneProofRefusal,
} from "@beep/repo-cli/test/Quality";
import { runRepoCommandCapture } from "@beep/repo-cli/test/RepoRun";
import {
  buildYeetRunPlanForTesting,
  CI_PARITY_POSTURE_ENV,
  ciParityLaneCandidates,
  collectHeadInstallInputs,
  collectProofEnvironment,
  decideParityLaneReuse,
  executeStepWithArtifacts,
  FinalCheckPlannedStep,
  FinalCheckSkip,
  HEAD_INSTALL_RECEIPT_TTL,
  HeadInstallInputs,
  HeadInstallReceipt,
  headInstallReceiptRefusals,
  loadHeadInstallReceipt,
  ParityLaneCandidate,
  ParityLaneDecision,
  ProofEnvironment,
  ProvenLane,
  proofEnvironmentDifferences,
  proofEnvironmentPosture,
  provenLanesForAttempt,
  RepoRunContext,
  recordHeadInstallReceipt,
  renderParityLaneDecision,
  reuseVerifiedHeadInstallForTesting,
  runFinalCheckGatesForTesting,
  runFinalCheckStep,
  writeVerifiedState,
} from "@beep/repo-cli/test/Yeet";
import { QualityTaskStep } from "@beep/repo-cli-kit/process/index";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Ref from "effect/Ref";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { NodeCommandTestLayer } from "./support/CommandTest.ts";
import type { YeetExecutedStep } from "@beep/repo-cli/test/Yeet";

const GIT_ENV = { GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" };
const GIT_IDENTITY = [
  "-c",
  "user.name=Tier Dedupe",
  "-c",
  "user.email=tier@example.invalid",
  "-c",
  "commit.gpgsign=false",
];

// A checkout with `.beep/` ignored, one commit, and `origin/main` at that commit.
const fixture = Effect.fn("TierDedupeTest.fixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-tier-dedupe-" });
  const git = Effect.fn("TierDedupeTest.git")(function* (...args: ReadonlyArray<string>) {
    const result = yield* runRepoCommandCapture("git", [...GIT_IDENTITY, ...args], root, GIT_ENV);
    expect(result.exitCode).toBe(0);
    return Str.trim(result.output);
  });
  const commit = Effect.fn("TierDedupeTest.commit")(function* (file: string, content: string) {
    yield* fs.makeDirectory(path.dirname(path.join(root, file)), { recursive: true });
    yield* fs.writeFileString(path.join(root, file), content);
    yield* git("add", "--all");
    yield* git("commit", "--quiet", "--no-verify", "-m", file);
    return yield* git("rev-parse", "HEAD");
  });
  yield* git("init", "--quiet", "--template=", "--initial-branch=feature", ".");
  yield* fs.writeFileString(path.join(root, ".gitignore"), "/.beep/\n");
  yield* commit("package.json", '{ "name": "fixture" }\n');
  const base = yield* commit("bun.lock", "lock-v1\n");
  yield* git("update-ref", "refs/remotes/origin/main", base);
  const context = RepoRunContext.make({
    base: "origin/main",
    baseSha: base,
    branch: "feature",
    cwd: root,
    head: "HEAD",
    originalArgv: [],
    packetDir: ".beep/yeet",
    repoRoot: root,
    turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
  });
  return { root, base, context, git, commit };
});

const logged = Effect.map(TestConsole.logLines, (lines) => A.join(A.filter(lines, Str.isString), "\n"));

const emptyRecorder = Ref.make<ReadonlyArray<YeetExecutedStep>>(A.empty());

const withTestConsole = Effect.provideServiceEffect(Console.Console, TestConsole.make);

const inputs = (overrides: Partial<Parameters<typeof HeadInstallInputs.make>[0]> = {}) =>
  HeadInstallInputs.make({
    commitSha: Str.repeat(40)("c"),
    treeSha: Str.repeat(40)("t"),
    lockfileDigest: Str.repeat(40)("l"),
    manifestsDigest: Str.repeat(64)("m"),
    bunVersion: "1.4.4",
    platform: "linux",
    architecture: "x64",
    ...overrides,
  });

const receiptAt = (installed: DateTime.Utc, receiptInputs: HeadInstallInputs) =>
  HeadInstallReceipt.make({
    schemaVersion: "head-install-receipt/v1",
    inputs: receiptInputs,
    installedAt: DateTime.formatIso(installed),
    expiresAt: DateTime.formatIso(DateTime.addDuration(installed, HEAD_INSTALL_RECEIPT_TTL)),
  });

describe("lane-proof reuse across tiers (M11)", () => {
  it("renders every differing identity component of a refused proof", () => {
    expect(
      renderLaneProofRefusal(
        LaneProofRefusal.make({
          laneId: "fallow:health",
          reasons: ["base-moved", "environment-changed"],
          priorBaseSha: Str.repeat(40)("a"),
          currentBaseSha: Str.repeat(40)("b"),
        })
      )
    ).toBe("[lane-proof] not reusing fallow:health: base moved (aaaaaaaaaaaa -> bbbbbbbbbbbb), environment changed");
  });

  it("plans the pinned base SHA into every proof step, and leaves any other base a ref", () => {
    const proofBases = (base: string) =>
      A.getSomes(
        A.map(
          buildYeetRunPlanForTesting({
            context: RepoRunContext.make({
              base,
              baseSha: Str.repeat(40)("f"),
              branch: "feature",
              cwd: "/repo",
              head: "HEAD",
              originalArgv: [],
              packetDir: ".beep/yeet",
              repoRoot: "/repo",
              turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
            }),
            message: O.none(),
            mode: "verify",
            tier: "full",
          }).steps,
          (step) => O.fromUndefinedOr(step.env?.BEEP_YEET_PROOF_BASE)
        )
      );
    expect(proofBases("origin/main")).toEqual([Str.repeat(40)("f"), Str.repeat(40)("f")]);
    expect(proofBases("origin/release")).toEqual(["origin/release", "origin/release"]);
  });
});

describe("same-attempt CI parity reuse (M12)", () => {
  it("keeps only presence for the credentials the parity posture blanks", () => {
    const posture = proofEnvironmentPosture({ CI: "true", AUTH_SECRET: "s3cr3t", TURBO_CACHE: undefined });
    expect(posture.CI).toBe("true");
    expect(posture.AUTH_SECRET).toBe("set");
    expect(posture.DATABASE_URL).toBe("unset");
    expect(posture.TURBO_CACHE).toBe("unset");
  });

  it("names every differing environment component and renders each decision kind", () => {
    const environment = (overrides: Partial<Parameters<typeof ProofEnvironment.make>[0]> = {}) =>
      ProofEnvironment.make({
        stepId: "full:01-pre-push",
        platform: "linux",
        architecture: "x64",
        bunVersion: "1.4.4",
        nodeVersion: "v24.22.1",
        treeSha: Str.repeat(40)("t"),
        baseSha: Str.repeat(40)("b"),
        posture: proofEnvironmentPosture({}),
        digest: "d",
        ...overrides,
      });
    expect(
      proofEnvironmentDifferences(
        environment(),
        environment({ baseSha: Str.repeat(40)("c"), bunVersion: "1.4.5", architecture: "arm64" })
      )
    ).toEqual(["base", "toolchain", "host"]);
    const decision = (overrides: Partial<Parameters<typeof ParityLaneDecision.make>[0]>) =>
      ParityLaneDecision.make({
        laneId: "lint",
        commandDigest: Str.repeat(64)("c"),
        environmentDigest: Str.repeat(64)("e"),
        reuse: false,
        differences: [],
        ...overrides,
      });
    assertSome(
      renderParityLaneDecision(decision({ reuse: true })),
      `[yeet] ci-parity: reusing lint, proven by ? in this attempt (command ${Str.repeat(12)("c")}, environment ${Str.repeat(12)("e")})`
    );
    assertSome(
      renderParityLaneDecision(decision({ reason: "environment-changed", differences: ["CI"] })),
      `[yeet] ci-parity: not reusing lint: environment differs from ? (CI; command ${Str.repeat(12)("c")}, environment ${Str.repeat(12)("e")})`
    );
    assertNone(renderParityLaneDecision(decision({ reason: "no-proven-twin" })));
  });

  it("plans parity lanes with the same command line as their pre-push twins", () => {
    const candidates = ciParityLaneCandidates(
      "/repo",
      CiLocalStepPlan.make({ affected: true, base: "origin/main", onMainBranch: false })
    );
    const prePush = githubCheckPrePushLanes("/repo", [githubCheckChangesetStatusLane("/repo")]);
    const coverage = A.findFirst(candidates, (candidate) => candidate.laneId === "coverage");
    const twin = A.findFirst(prePush, (entry) => entry.id === "quality:coverage");
    assertSome(
      O.map(coverage, (candidate) => candidate.commandText),
      O.getOrElse(
        O.map(twin, (entry) => formatCommandLine(entry.step.command, entry.step.args)),
        () => "missing pre-push twin"
      )
    );
  });

  it.layer(NodeCommandTestLayer, { timeout: "60 seconds" })("over a real checkout", (it) => {
    it.effect("reuses a parity lane proven under the same command and environment", () =>
      Effect.gen(function* () {
        const { root, base } = yield* fixture();
        const posture = { ...Bun.env, ...CI_PARITY_POSTURE_ENV };
        const proven = yield* collectProofEnvironment("full:01-pre-push", root, posture, base);
        const parity = yield* collectProofEnvironment("full:02-ci-parity", root, posture, base);
        expect(parity.digest).toBe(proven.digest);
        const commandText = "bun run beep ci lane coverage --affected --base origin/main --summarize";
        const [decision] = yield* decideParityLaneReuse(
          [ParityLaneCandidate.make({ laneId: "coverage", commandText })],
          [ProvenLane.make({ laneId: "quality:coverage", commandText, environment: proven })],
          parity
        );
        expect(decision?.reuse).toBe(true);
        expect(decision?.provenBy).toBe("quality:coverage");
        expect(O.getOrElse(O.flatMap(O.fromUndefinedOr(decision), renderParityLaneDecision), () => "")).toContain(
          "[yeet] ci-parity: reusing coverage, proven by quality:coverage in this attempt"
        );
      })
    );

    it.effect("refuses a twin proven under the local posture and names the differing variables", () =>
      Effect.gen(function* () {
        const { root, base } = yield* fixture();
        const local = { ...Bun.env, CI: undefined, GITHUB_ACTIONS: undefined };
        const proven = yield* collectProofEnvironment("full:01-pre-push", root, local, base);
        const parity = yield* collectProofEnvironment(
          "full:02-ci-parity",
          root,
          { ...Bun.env, ...CI_PARITY_POSTURE_ENV },
          base
        );
        const commandText = "bun run beep ci lane lint --affected --base origin/main --summarize";
        const [twin, lonely] = yield* decideParityLaneReuse(
          [
            ParityLaneCandidate.make({ laneId: "lint", commandText }),
            ParityLaneCandidate.make({ laneId: "nix", commandText: "bun run beep ci lane nix" }),
          ],
          [ProvenLane.make({ laneId: "quality:lint", commandText, environment: proven })],
          parity
        );
        expect(twin?.reuse).toBe(false);
        expect(twin?.reason).toBe("environment-changed");
        expect(twin?.differences).toContain("CI");
        expect(twin?.differences).toContain("GITHUB_ACTIONS");
        expect(twin?.commandDigest).not.toBe("");
        expect(lonely?.reason).toBe("no-proven-twin");
        assertNone(O.flatMap(O.fromUndefinedOr(lonely), renderParityLaneDecision));
      })
    );

    it.effect("refuses a twin proven on another tree", () =>
      Effect.gen(function* () {
        const { root, base, commit } = yield* fixture();
        const posture = { ...Bun.env, ...CI_PARITY_POSTURE_ENV };
        const proven = yield* collectProofEnvironment("full:01-pre-push", root, posture, base);
        yield* commit("src/new.ts", "export {}\n");
        const parity = yield* collectProofEnvironment("full:02-ci-parity", root, posture, base);
        const commandText = "bun run beep ci lane check --affected --base origin/main --summarize";
        const [decision] = yield* decideParityLaneReuse(
          [ParityLaneCandidate.make({ laneId: "check", commandText })],
          [ProvenLane.make({ laneId: "quality:check", commandText, environment: proven })],
          parity
        );
        expect(decision?.reuse).toBe(false);
        expect(decision?.differences).toEqual(["tree"]);
      })
    );

    it.effect("counts only passed lanes of steps whose environment was recorded", () =>
      Effect.gen(function* () {
        const { root, base } = yield* fixture();
        const environment = yield* collectProofEnvironment("full:01-pre-push", root, Bun.env, base);
        const run = (id: string, status: "passed" | "failed") =>
          QualityTaskLaneRun.make({ id, label: id, status, inputDigest: O.none(), commandText: O.some(`run ${id}`) });
        const proven = provenLanesForAttempt(
          [
            QualityTaskLaneRunReport.make({
              schemaVersion: "quality-task-lane-run/v1",
              parentLaneId: O.some("full:01-pre-push"),
              lanes: [run("quality:lint", "passed"), run("quality:check", "failed")],
            }),
            QualityTaskLaneRunReport.make({
              schemaVersion: "quality-task-lane-run/v1",
              parentLaneId: O.some("full:unrecorded"),
              lanes: [run("quality:build", "passed")],
            }),
          ],
          [environment]
        );
        expect(A.map(proven, (entry) => entry.laneId)).toEqual(["quality:lint"]);
      })
    );
  });
});

describe("clean-HEAD install receipt reuse (A4)", () => {
  const now = DateTime.makeUnsafe("2026-11-02T12:00:00.000Z");

  it("reuses an unexpired receipt for unchanged inputs", () => {
    expect(headInstallReceiptRefusals(O.some(receiptAt(now, inputs())), inputs(), now)).toEqual([]);
  });

  it("refuses a missing, expired, or changed receipt with every reason", () => {
    expect(headInstallReceiptRefusals(O.none(), inputs(), now)).toEqual(["no-receipt"]);
    const later = DateTime.addDuration(now, Duration.sum(HEAD_INSTALL_RECEIPT_TTL, Duration.seconds(1)));
    expect(headInstallReceiptRefusals(O.some(receiptAt(now, inputs())), inputs(), later)).toEqual(["expired"]);
    const unreadable = HeadInstallReceipt.make({ ...receiptAt(now, inputs()), expiresAt: "not a date" });
    expect(headInstallReceiptRefusals(O.some(unreadable), inputs(), now)).toEqual(["expired"]);
    const changed = inputs({
      commitSha: Str.repeat(40)("d"),
      treeSha: Str.repeat(40)("u"),
      lockfileDigest: Str.repeat(40)("k"),
      manifestsDigest: Str.repeat(64)("n"),
      bunVersion: "1.4.5",
      platform: "darwin",
    });
    expect(headInstallReceiptRefusals(O.some(receiptAt(now, inputs())), changed, now)).toEqual([
      "commit-changed",
      "tree-changed",
      "lockfile-changed",
      "manifests-changed",
      "bun-changed",
      "host-changed",
    ]);
  });

  it.layer(NodeCommandTestLayer, { timeout: "60 seconds" })("over a real checkout", (it) => {
    it.effect("digests the lockfile and manifests but not other files", () =>
      Effect.gen(function* () {
        const { root, commit } = yield* fixture();
        const head = yield* commit("README.md", "# one\n");
        const first = yield* collectHeadInstallInputs(root, head);
        expect(first.lockfileDigest).toHaveLength(40);
        const commit1 = yield* commit("README.md", "# two\n");
        const readme = yield* collectHeadInstallInputs(root, commit1);
        expect(readme.manifestsDigest).toBe(first.manifestsDigest);
        expect(readme.lockfileDigest).toBe(first.lockfileDigest);
        const commit2 = yield* commit("packages/a/package.json", "{}\n");
        const manifest = yield* collectHeadInstallInputs(root, commit2);
        expect(manifest.manifestsDigest).not.toBe(first.manifestsDigest);
        const commit3 = yield* commit("bun.lock", "lock-v2\n");
        const lockfile = yield* collectHeadInstallInputs(root, commit3);
        expect(lockfile.lockfileDigest).not.toBe(first.lockfileDigest);
      })
    );

    it.effect("attaches the run's receipt to the verified state and skips the preflight", () =>
      Effect.gen(function* () {
        const { context, git } = yield* fixture();
        const head = yield* git("rev-parse", "HEAD");
        yield* recordHeadInstallReceipt(context, head);
        yield* writeVerifiedState(context, "full", []);
        const recorder = yield* emptyRecorder;
        const preflight = buildYeetRunPlanForTesting({
          context,
          message: O.none(),
          mode: "verify",
          tier: "full",
        }).steps;
        const steps = A.filter(preflight, (step) => step.id === "publish:00-head-install-preflight");
        const reuseVerifiedHeadInstallForTesting4 = yield* reuseVerifiedHeadInstallForTesting(context, recorder, steps);
        expect(reuseVerifiedHeadInstallForTesting4).toBe(true);
        const got = yield* Ref.get(recorder);
        expect(A.map(got, (entry) => entry.status)).toEqual(["skipped"]);
        const logged5 = yield* logged;
        expect(logged5).toContain("[yeet] skipped clean-HEAD install preflight: install receipt from");
      }).pipe(withTestConsole)
    );

    it.effect("runs the preflight when the verified state carries no receipt for this commit", () =>
      Effect.gen(function* () {
        const { context, git, commit } = yield* fixture();
        const git6 = yield* git("rev-parse", "HEAD");
        yield* recordHeadInstallReceipt(context, git6);
        const next = yield* commit("README.md", "# moved\n");
        const loadedHeadInstallReceipt = yield* loadHeadInstallReceipt(context, next);
        assertNone(loadedHeadInstallReceipt);
        yield* writeVerifiedState(context, "full", []);
        const recorder = yield* emptyRecorder;
        const reuseVerifiedHeadInstallForTesting7 = yield* reuseVerifiedHeadInstallForTesting(context, recorder, []);
        expect(reuseVerifiedHeadInstallForTesting7).toBe(false);
        const got8 = yield* Ref.get(recorder);
        expect(got8).toEqual([]);
        const logged9 = yield* logged;
        expect(logged9).toContain(
          "[yeet] running clean-HEAD install preflight: install receipt not reused (no receipt)"
        );
      }).pipe(withTestConsole)
    );

    it.effect("records a receipt after a clean install and clears it after a failed one", () =>
      Effect.gen(function* () {
        const { context, git, commit } = yield* fixture();
        const preflight = A.filter(
          buildYeetRunPlanForTesting({ context, message: O.none(), mode: "verify", tier: "full" }).steps,
          (step) => step.id === "publish:00-head-install-preflight"
        );
        // The dependency-free fixture installs without a lockfile.
        yield* git("rm", "--quiet", "bun.lock");
        yield* git("commit", "--quiet", "--no-verify", "-m", "drop lockfile");
        const installed = yield* git("rev-parse", "HEAD");
        const clean = yield* Effect.forEach(preflight, (step) => executeStepWithArtifacts(context, step));
        expect(A.map(clean, (result) => result.exitCode)).toEqual([0]);
        const loadedHeadInstallReceipt10 = yield* loadHeadInstallReceipt(context, installed);
        assertSome(
          O.map(loadedHeadInstallReceipt10, (receipt) => receipt.inputs.lockfileDigest),
          "absent"
        );
        const repeated = yield* Effect.forEach(preflight, (step) => executeStepWithArtifacts(context, step));
        expect(
          A.every(
            repeated,
            (result) =>
              result.exitCode === 0 && O.exists(O.fromUndefinedOr(result.output), Str.includes("reused clean install"))
          )
        ).toBe(true);
        const retained = yield* loadHeadInstallReceipt(context, installed);
        expect(retained).toEqual(loadedHeadInstallReceipt10);
        // An unparseable lockfile fails the frozen install and drops the receipt.
        const broken = yield* commit("bun.lock", "not a lockfile\n");
        const failed = yield* Effect.forEach(preflight, (step) => executeStepWithArtifacts(context, step));
        expect(A.map(failed, (result) => result.exitCode === 0)).toEqual([false]);
        const loadedHeadInstallReceipt11 = yield* loadHeadInstallReceipt(context, broken);
        assertNone(loadedHeadInstallReceipt11);
        const loadedHeadInstallReceipt12 = yield* loadHeadInstallReceipt(context, installed);
        assertNone(loadedHeadInstallReceipt12);
      }).pipe(withTestConsole)
    );
  });
});

// Count real virtual-tree subprocesses while forwarding every command to the platform.
const withVirtualTreeCount = Effect.fn("TierDedupeTest.withVirtualTreeCount")(function* <A, E, R>(
  program: Effect.Effect<A, E, R>
) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const count = yield* Ref.make(0);
  const observed = ChildProcessSpawner.make(
    Effect.fnUntraced(function* (command) {
      if (command._tag === "StandardCommand" && command.command === "git" && A.contains(command.args, "write-tree")) {
        yield* Ref.update(count, (value) => value + 1);
      }
      return yield* spawner.spawn(command);
    })
  );
  const result = yield* program.pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, observed));
  return { result, hashes: yield* Ref.get(count) };
});

const finalCheckCommand = (
  root: string,
  gate: FinalCheckPlannedStep["gate"],
  label: string,
  script = "mkdir -p .beep; printf x >> .beep/executions"
) =>
  FinalCheckPlannedStep.make({
    gate,
    hostedContext: label,
    step: QualityTaskStep.make({ label: `final-check:${label}`, command: "sh", args: ["-c", script], cwd: root }),
  });

describe("resumable final-check steps", () => {
  it.layer(NodeCommandTestLayer, { timeout: "60 seconds" })("over a real checkout", (it) => {
    it.effect("shares each refreshed boundary and reuses command-free steps without rehashing", () =>
      Effect.gen(function* () {
        const { root, base } = yield* fixture();
        const planned = [
          finalCheckCommand(root, "lint-policy", "first"),
          finalCheckCommand(root, "check", "second"),
          finalCheckCommand(root, "docgen", "third"),
        ];
        const run = { repoRoot: root, mergeBase: base, planned, skips: [], resume: false };
        const fresh = yield* withVirtualTreeCount(
          runFinalCheckGatesForTesting(run, ["lint-policy", "check", "docgen"], false)
        );
        expect(fresh.hashes).toBe(4); // One initial hash plus one fence per executed command; previously six.
        expect(A.map(fresh.result.steps, (step) => step.status)).toEqual(["passed", "passed", "passed"]);
        const resumed = yield* withVirtualTreeCount(
          runFinalCheckGatesForTesting(
            { ...run, resume: true, skips: [FinalCheckSkip.make({ gate: "repo-sanity", reason: "controlled skip" })] },
            ["lint-policy", "repo-sanity", "check", "docgen"],
            false
          )
        );
        expect(resumed.hashes).toBe(1); // Reused steps and the recorded skip execute no command.
        expect(A.map(resumed.result.steps, (step) => step.status)).toEqual(["passed", "skipped", "passed", "passed"]);
        assertTrue(
          A.every(
            A.filter(resumed.result.steps, (step) => step.status === "passed"),
            (step) => O.isSome(O.fromUndefinedOr(step.reason))
          )
        );
        const fs = yield* FileSystem.FileSystem;
        const executions = yield* fs.readFileString(`${root}/.beep/executions`);
        expect(executions).toBe("xxx");
      })
    );

    it.effect("refreshes after live gates and refuses to record a command that moved its input", () =>
      Effect.gen(function* () {
        const { root, base } = yield* fixture();
        const fs = yield* FileSystem.FileSystem;
        const last = finalCheckCommand(root, "docgen", "last");
        yield* runFinalCheckStep(last, false);
        const moving = finalCheckCommand(root, "check", "moving", "printf changed > package.json");
        const run = {
          repoRoot: root,
          mergeBase: base,
          planned: [
            finalCheckCommand(root, "lint-policy", "first"),
            moving,
            finalCheckCommand(root, "repo-sanity", "live", "printf live >> package.json"),
            last,
          ],
          skips: [],
          resume: true,
        };
        const checked = yield* withVirtualTreeCount(
          runFinalCheckGatesForTesting(run, ["lint-policy", "check", "repo-sanity", "docgen"], false)
        );
        expect(checked.hashes).toBe(5); // Three reusable commands in two runs; previously six hashes.
        expect(A.map(checked.result.steps, (step) => step.reason)).toEqual([
          undefined,
          undefined,
          undefined,
          undefined,
        ]);
        const executions = yield* fs.readFileString(`${root}/.beep/executions`);
        expect(executions).toBe("xxx");
        // Restoring the command's original bytes must not find a proof for its mutating run.
        yield* fs.writeFileString(`${root}/package.json`, '{ "name": "fixture" }\n');
        const retried = yield* runFinalCheckStep(moving, true);
        expect(retried.reason).toBeUndefined();
      })
    );

    it.effect("discards failed-command boundaries and preserves fail-fast ordering", () =>
      Effect.gen(function* () {
        const { root, base } = yield* fixture();
        const fs = yield* FileSystem.FileSystem;
        const last = finalCheckCommand(root, "docgen", "after-failure");
        yield* runFinalCheckStep(last, false);
        const failed = finalCheckCommand(root, "check", "failure", "printf changed > package.json; exit 1");
        const run = { repoRoot: root, mergeBase: base, planned: [failed, last], skips: [], resume: true };
        const checked = yield* withVirtualTreeCount(runFinalCheckGatesForTesting(run, ["check", "docgen"], false));
        expect(checked.hashes).toBe(3); // Initial failure snapshot, then a new start and fence for docgen.
        expect(A.map(checked.result.steps, (step) => step.status)).toEqual(["failed", "passed"]);
        expect(checked.result.steps[1]?.reason).toBeUndefined();
        const executions = yield* fs.readFileString(`${root}/.beep/executions`);
        expect(executions).toBe("xx");
        const stopped = yield* withVirtualTreeCount(runFinalCheckGatesForTesting(run, ["check", "docgen"], true));
        expect(stopped.hashes).toBe(1);
        expect(A.map(stopped.result.steps, (step) => step.status)).toEqual(["failed"]);
      })
    );

    it.effect("saves a completed step before the full receipt and invalidates changed inputs", () =>
      Effect.gen(function* () {
        const { root, commit, git } = yield* fixture();
        const fs = yield* FileSystem.FileSystem;
        const step = FinalCheckPlannedStep.make({
          gate: "check",
          hostedContext: "Heavy / Check",
          step: QualityTaskStep.make({
            label: "final-check:check",
            command: "sh",
            args: ["-c", "mkdir -p .beep; printf x >> .beep/executions"],
            cwd: root,
            env: { PROOF_TEST: "one" },
          }),
        });
        const first = yield* runFinalCheckStep(step, false);
        expect(first.status).toBe("passed");
        const resumed = yield* runFinalCheckStep(step, true);
        expect(resumed.reason).toContain("reused completed step");
        const observation1 = yield* fs.readFileString(`${root}/.beep/executions`);
        expect(observation1).toBe("x");
        const observation2 = yield* fs.exists(`${root}/.beep/yeet/final-check`);
        expect(observation2).toBe(false);
        // A failed later gate does not erase the earlier success or create a success of its own.
        const failing = FinalCheckPlannedStep.make({
          ...step,
          step: QualityTaskStep.make({ ...step.step, label: "final-check:failing", args: ["-c", "exit 1"] }),
        });
        const observation3 = yield* runFinalCheckStep(failing, true);
        expect(observation3.status).toBe("failed");
        const observation4 = yield* runFinalCheckStep(failing, true);
        expect(observation4.status).toBe("failed");
        const observation5 = yield* runFinalCheckStep(step, true);
        expect(observation5.reason).toContain("reused completed step");
        const changedEnvironment = FinalCheckPlannedStep.make({
          ...step,
          step: QualityTaskStep.make({ ...step.step, env: { PROOF_TEST: "two" } }),
        });
        const observation6 = yield* runFinalCheckStep(changedEnvironment, true);
        expect(observation6.reason).toBeUndefined();
        yield* fs.writeFileString(`${root}/untracked.txt`, "changed input");
        const observation7 = yield* runFinalCheckStep(changedEnvironment, true);
        expect(observation7.reason).toBeUndefined();
        const next = yield* commit("README.md", "# changed head\n");
        const observation8 = yield* runFinalCheckStep(changedEnvironment, true);
        expect(observation8.reason).toBeUndefined();
        yield* git("update-ref", "refs/remotes/origin/main", next);
        const observation9 = yield* runFinalCheckStep(changedEnvironment, true);
        expect(observation9.reason).toBeUndefined();
        const observation10 = yield* fs.readFileString(`${root}/.beep/executions`);
        expect(observation10).toBe("xxxxx");
      })
    );

    it.effect("always executes live sanity checks and allows an explicit fresh replay", () =>
      Effect.gen(function* () {
        const { root } = yield* fixture();
        const fs = yield* FileSystem.FileSystem;
        const step = FinalCheckPlannedStep.make({
          gate: "repo-sanity",
          hostedContext: "Repo Sanity",
          step: QualityTaskStep.make({
            label: "final-check:repo-sanity",
            command: "sh",
            args: ["-c", "mkdir -p .beep; printf x >> .beep/executions"],
            cwd: root,
          }),
        });
        yield* runFinalCheckStep(step, true);
        yield* runFinalCheckStep(step, true);
        const checked = FinalCheckPlannedStep.make({ ...step, gate: "check" });
        yield* runFinalCheckStep(checked, false);
        yield* runFinalCheckStep(checked, false);
        const observation11 = yield* fs.readFileString(`${root}/.beep/executions`);
        expect(observation11).toBe("xxxx");
      })
    );
  });
});
