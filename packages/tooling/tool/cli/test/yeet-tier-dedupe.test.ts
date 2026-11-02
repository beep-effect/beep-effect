import { CiLocalStepPlan } from "@beep/repo-cli/commands/Ci";
import { ensureOriginMainForTesting } from "@beep/repo-cli/commands/Quality/Quality.command";
import { collectGithubCheckLaneWavesForTesting } from "@beep/repo-cli/commands/Quality/Tasks";
import { formatCommandLine } from "@beep/repo-cli/test/Process";
import {
  GithubCheckLaneSpec,
  GithubCheckLaneWaveSpec,
  githubCheckChangesetStatusLane,
  githubCheckPrePushLanes,
  LaneProofRefusal,
  pinnedLaneProofBaseSha,
  QualityTaskLaneRun,
  QualityTaskLaneRunReport,
  QualityTaskStep,
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
  HEAD_INSTALL_RECEIPT_TTL,
  HeadInstallInputs,
  HeadInstallReceipt,
  headInstallReceiptRefusals,
  loadHeadInstallReceipt,
  ParityLaneCandidate,
  ProvenLane,
  proofEnvironmentPosture,
  provenLanesForAttempt,
  RepoRunContext,
  recordHeadInstallReceipt,
  renderParityLaneDecision,
  reuseVerifiedHeadInstallForTesting,
  writeVerifiedState,
} from "@beep/repo-cli/test/Yeet";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
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

const withEnv = <Out, E, R>(
  values: Readonly<Record<string, string | undefined>>,
  use: Effect.Effect<Out, E, R>
): Effect.Effect<Out, E, R> =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const previous = A.map(Object.keys(values), (name) => [name, Bun.env[name]] as const);
      for (const [name, value] of Object.entries(values)) {
        if (value === undefined) delete Bun.env[name];
        else Bun.env[name] = value;
      }
      return previous;
    }),
    () => use,
    (previous) =>
      Effect.sync(() => {
        for (const [name, value] of previous) {
          if (value === undefined) delete Bun.env[name];
          else Bun.env[name] = value;
        }
      })
  );

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

const lane = (repoRoot: string, id: string, source: string) =>
  GithubCheckLaneSpec.make({
    id,
    tier: "pre-push",
    stage: "repo-quality",
    wave: "preflight",
    blockedBy: [],
    step: QualityTaskStep.make({ label: id, command: "bash", args: ["-c", source], cwd: repoRoot }),
  });

const battery = (repoRoot: string, tier: string) =>
  withEnv(
    { BEEP_YEET_INNER_LANE_PARENT_ID: `full:${tier}`, BEEP_YEET_LANE_PROOF_MODE: "active" },
    collectGithubCheckLaneWavesForTesting(
      tier,
      [
        GithubCheckLaneWaveSpec.make({
          wave: "preflight",
          lanes: [lane(repoRoot, "fallow:health", "mkdir -p .beep && echo run >> .beep/health-runs.txt")],
        }),
      ],
      "fail-fast"
    )
  );

const statuses = (run: { readonly report: { readonly lanes: ReadonlyArray<{ readonly status: string }> } }) =>
  A.map(run.report.lanes, (entry) => entry.status);

const logged = Effect.map(TestConsole.logLines, (lines) => A.join(A.filter(lines, Str.isString), "\n"));

const emptyRecorder = Ref.make(A.empty<YeetExecutedStep>());

const withTestConsole = Effect.provideServiceEffect(Console.Console, TestConsole.make);

const inputs = (overrides: Partial<Parameters<typeof HeadInstallInputs.make>[0]> = {}) =>
  HeadInstallInputs.make({
    commitSha: "c".repeat(40),
    treeSha: "t".repeat(40),
    lockfileDigest: "l".repeat(40),
    manifestsDigest: "m".repeat(64),
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
  it.effect("pins nothing for a ref and reads a full SHA as the pinned base", () =>
    Effect.gen(function* () {
      const pinned = (value: string) => withEnv({ BEEP_YEET_PROOF_BASE: value }, Effect.sync(pinnedLaneProofBaseSha));
      assertSome(yield* pinned("a".repeat(40)), "a".repeat(40));
      assertNone(yield* pinned("origin/main"));
    })
  );

  it("renders every differing identity component of a refused proof", () => {
    expect(
      renderLaneProofRefusal(
        LaneProofRefusal.make({
          laneId: "fallow:health",
          reasons: ["base-moved", "environment-changed"],
          priorBaseSha: "a".repeat(40),
          currentBaseSha: "b".repeat(40),
        })
      )
    ).toBe("[lane-proof] not reusing fallow:health: base moved (aaaaaaaaaaaa -> bbbbbbbbbbbb), environment changed");
  });

  it("plans the pinned base SHA into every proof step", () => {
    const context = RepoRunContext.make({
      base: "origin/main",
      baseSha: "f".repeat(40),
      branch: "feature",
      cwd: "/repo",
      head: "HEAD",
      originalArgv: [],
      packetDir: ".beep/yeet",
      repoRoot: "/repo",
      turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
    });
    const plan = buildYeetRunPlanForTesting({ context, message: O.none(), mode: "verify", tier: "full" });
    const proofBases = A.getSomes(A.map(plan.steps, (step) => O.fromUndefinedOr(step.env?.BEEP_YEET_PROOF_BASE)));
    expect(proofBases).toEqual(["f".repeat(40), "f".repeat(40)]);
  });

  it.layer(NodeCommandTestLayer, { timeout: "60 seconds" })("over a real checkout", (it) => {
    it.effect("reuses the cheap-gates proof in the pre-push tier despite the per-tier parent id", () =>
      Effect.gen(function* () {
        const { root, base } = yield* fixture();
        const run = (tier: string) => withEnv({ BEEP_YEET_PROOF_BASE: base }, battery(root, tier));
        expect(statuses(yield* run("cheap-gates"))).toEqual(["passed"]);
        expect(statuses(yield* run("pre-push"))).toEqual(["reused"]);
        expect(yield* logged).toContain("[lane-proof] reusing exact lane proof: fallow:health");
      }).pipe(withTestConsole)
    );

    it.effect("refuses, and says why, when the environment changed", () =>
      Effect.gen(function* () {
        const { root, base } = yield* fixture();
        const run = (marker: string) =>
          withEnv({ BEEP_YEET_PROOF_BASE: base, TIER_DEDUPE_MARKER: marker }, battery(root, "pre-push"));
        expect(statuses(yield* run("one"))).toEqual(["passed"]);
        expect(statuses(yield* run("two"))).toEqual(["passed"]);
        expect(yield* logged).toContain("[lane-proof] not reusing fallow:health: environment changed");
      }).pipe(withTestConsole)
    );

    it.effect("refuses a proof recorded against another pinned base", () =>
      Effect.gen(function* () {
        const { root, base, git } = yield* fixture();
        expect(statuses(yield* withEnv({ BEEP_YEET_PROOF_BASE: base }, battery(root, "cheap-gates")))).toEqual([
          "passed",
        ]);
        // Move origin/main to a sibling commit without touching HEAD.
        const tree = yield* git("rev-parse", "HEAD^{tree}");
        const moved = yield* git("commit-tree", tree, "-p", base, "-m", "moved base");
        yield* git("update-ref", "refs/remotes/origin/main", moved);
        expect(statuses(yield* withEnv({ BEEP_YEET_PROOF_BASE: moved }, battery(root, "pre-push")))).toEqual([
          "passed",
        ]);
        expect(yield* logged).toContain(
          `[lane-proof] not reusing fallow:health: base moved (${Str.takeLeft(12)(base)} -> ${Str.takeLeft(12)(moved)})`
        );
      }).pipe(withTestConsole)
    );

    it.effect("disables reuse when origin/main moved away from the run's pinned base", () =>
      Effect.gen(function* () {
        const { root, base, git } = yield* fixture();
        const tree = yield* git("rev-parse", "HEAD^{tree}");
        const moved = yield* git("commit-tree", tree, "-p", base, "-m", "moved base");
        yield* git("update-ref", "refs/remotes/origin/main", moved);
        expect(statuses(yield* withEnv({ BEEP_YEET_PROOF_BASE: base }, battery(root, "pre-push")))).toEqual(["passed"]);
        expect(yield* logged).toContain(
          `[lane-proof] reuse disabled: origin/main moved from the run's pinned base ${Str.takeLeft(12)(base)} to ${Str.takeLeft(12)(moved)}`
        );
      }).pipe(withTestConsole)
    );

    it.effect("skips the origin/main refetch while the parent run's pin still matches", () =>
      Effect.gen(function* () {
        const { root, base } = yield* fixture();
        // No `origin` remote exists, so a fetch would fail the battery.
        yield* withEnv({ BEEP_YEET_PROOF_BASE: base }, ensureOriginMainForTesting(root));
        expect(yield* logged).toContain(`[github-checks] origin/main pinned at ${Str.takeLeft(12)(base)}`);
      }).pipe(withTestConsole)
    );

    it.effect("refetches when the pin no longer matches origin/main", () =>
      Effect.gen(function* () {
        const { root } = yield* fixture();
        const failed = yield* withEnv({ BEEP_YEET_PROOF_BASE: "0".repeat(40) }, ensureOriginMainForTesting(root)).pipe(
          Effect.flip
        );
        expect(failed.message).not.toBe("");
        expect(yield* logged).toContain("not the parent run's pinned base 000000000000; refreshing");
      }).pipe(withTestConsole)
    );
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
    const changed = inputs({
      commitSha: "d".repeat(40),
      treeSha: "u".repeat(40),
      lockfileDigest: "k".repeat(40),
      manifestsDigest: "n".repeat(64),
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
        const readme = yield* collectHeadInstallInputs(root, yield* commit("README.md", "# two\n"));
        expect(readme.manifestsDigest).toBe(first.manifestsDigest);
        expect(readme.lockfileDigest).toBe(first.lockfileDigest);
        const manifest = yield* collectHeadInstallInputs(root, yield* commit("packages/a/package.json", "{}\n"));
        expect(manifest.manifestsDigest).not.toBe(first.manifestsDigest);
        const lockfile = yield* collectHeadInstallInputs(root, yield* commit("bun.lock", "lock-v2\n"));
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
        expect(yield* reuseVerifiedHeadInstallForTesting(context, recorder, steps)).toBe(true);
        expect(A.map(yield* Ref.get(recorder), (entry) => entry.status)).toEqual(["skipped"]);
        expect(yield* logged).toContain("[yeet] skipped clean-HEAD install preflight: install receipt from");
      }).pipe(withTestConsole)
    );

    it.effect("runs the preflight when the verified state carries no receipt for this commit", () =>
      Effect.gen(function* () {
        const { context, git, commit } = yield* fixture();
        yield* recordHeadInstallReceipt(context, yield* git("rev-parse", "HEAD"));
        const next = yield* commit("README.md", "# moved\n");
        assertNone(yield* loadHeadInstallReceipt(context, next));
        yield* writeVerifiedState(context, "full", []);
        const recorder = yield* emptyRecorder;
        expect(yield* reuseVerifiedHeadInstallForTesting(context, recorder, [])).toBe(false);
        expect(yield* Ref.get(recorder)).toEqual([]);
        expect(yield* logged).toContain(
          "[yeet] running clean-HEAD install preflight: install receipt not reused (no receipt)"
        );
      }).pipe(withTestConsole)
    );
  });
});
