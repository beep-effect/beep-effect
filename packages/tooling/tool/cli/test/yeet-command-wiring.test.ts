import { YeetCommandError, yeetCommand, yeetMonitorCommandRoute } from "@beep/repo-cli/commands/Yeet";
import { CommandJsonOutput, printCommandJson } from "@beep/repo-cli/test/Cli";
import { MemoryStats, RepoPlanStep, RepoRunPlan } from "@beep/repo-cli/test/RepoRun";
import {
  buildYeetRunPlanWithMode,
  defaultYeetRunOptions,
  findLiveReadyMonitorJob,
  finishPublishWithPullRequestForTesting,
  isLiveReadyMonitorJob,
  MONITOR_READY_SUBMIT_STEP_ID,
  PR_HEAVY_ADMISSION_LABEL_STEP_ID,
  ProofJobRecord,
  ProofJobRequest,
  ProofJobSubmitter,
  ProofJobUnit,
  RepoRunContext,
  runPushFirstPublishPhasesForTesting,
  TurboPlanSnapshot,
  YeetEnsuredPullRequest,
  YeetRunPlanModeOptions,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { Cause, ConfigProvider, Effect, FileSystem, Layer, Path, pipe, Ref } from "effect";
import * as A from "effect/Array";
import { Command } from "effect/cli";
import * as O from "effect/Option";
import { ChildProcessSpawner } from "effect/process";
import * as S from "effect/Schema";
import type { YeetExecutedStep, YeetVerdictExtrasForTesting } from "@beep/repo-cli/test/Yeet";

const runYeetCommand = Command.runWith(yeetCommand, { version: "0.0.0" });

const commandTestLayer = Layer.mergeAll(
  NodeServices.layer,
  Layer.succeed(MemoryStats, MemoryStats.of({ availableGib: Effect.succeed(50), totalGib: Effect.succeed(128) }))
);

/**
 * Every subcommand name registered under `beep yeet`, flattened across the
 * subcommand groups the CLI builder produces.
 */
const subcommandNames: ReadonlyArray<string> = A.flatMap(yeetCommand.subcommands, (group) =>
  A.map(group.commands, (command) => command.name)
);

const findSubcommand = (name: string) =>
  A.findFirst(
    A.flatMap(yeetCommand.subcommands, (group) => group.commands),
    (command) => command.name === name
  );

describe("yeet merge-loop command wiring", () => {
  it.layer(commandTestLayer, { timeout: "30 seconds" })("foreground monitor", (it) => {
    it.effect(
      "reports a command error for foreground monitoring outside a repository",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const originalCwd = process.cwd();
        const root = yield* fs.makeTempDirectoryScoped();
        yield* Effect.addFinalizer(() => Effect.sync(() => process.chdir(originalCwd)));
        yield* Effect.sync(() => process.chdir(root));
        yield* runYeetCommand(["monitor", "--until-ready"]).pipe(
          Effect.result,
          Effect.tap((result) =>
            Effect.sync(() => {
              expect(result._tag).toBe("Failure");
              if (result._tag === "Failure") expect(result.failure).toMatchObject({ _tag: "YeetCommandError" });
            })
          ),
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({}))
        );
      })
    );
  });
  it.effect("dispatches the top-level publish and repair planners", () =>
    Effect.forEach(
      [
        ["--plan"],
        ["--plan", "--state-root", "/tmp/yeet-command-wiring-state"],
        ["monitor", "--plan", "--state-root", "/tmp/yeet-command-wiring-state"],
        ["repair", "--plan"],
        ["pre-push-hook", "--plan"],
      ],
      // Hosted runners check out a detached HEAD, where publish/monitor refuse with a
      // PR-branch-only guard after dispatch; this test proves dispatch, not the guard.
      //
      // Known residual: how far past the guard each route runs still depends on
      // the checkout, so a workstation feature branch executes more of
      // `Handler`/`Planner` here than a detached hosted HEAD does. The rows that
      // difference can mint are the #1068 class. The publish plan — the one row
      // it actually minted — is pinned deterministically by the
      // "yeet publish plan wiring" block below; closing the rest needs a temp
      // repository on a fixed branch plus a Turbo snapshot seam for
      // `hydrateYeetRunContext`, which is its own change.
      (args) => runYeetCommand(args).pipe(Effect.catchTag("YeetCommandError", () => Effect.void)),
      { discard: true }
    ).pipe(provideScopedLayer(commandTestLayer))
  );

  it.each(["sweep", "merge", "reply"])("registers the %s subcommand", (name) => {
    expect(subcommandNames).toContain(name);
  });

  it.each(["sweep", "merge", "reply"])("describes the %s subcommand in help output", (name) => {
    const command = findSubcommand(name);
    expect(command._tag).toBe("Some");
    expect(command._tag === "Some" ? command.value.description : undefined).toEqual(expect.any(String));
  });

  it("keeps the pre-existing subcommands registered", () => {
    expect(subcommandNames).toEqual(
      expect.arrayContaining(["verify", "repair", "publish", "monitor", "closeout", "status", "resume"])
    );
  });
});

describe("yeet publish plan wiring", () => {
  // Dispatching `yeet --plan` against the live checkout only reaches the publish
  // planner when the checkout happens to sit on a feature branch: on `main` and
  // on the detached HEAD hosted runners check out, the PR-branch-only guard
  // refuses first. That made one plan step executable locally and unreachable
  // hosted, and the row minted from the local measurement turned `main` red.
  // Planning from a fixed context reaches it on every checkout.
  const planContext = RepoRunContext.make({
    base: "origin/main",
    branch: "feat/yeet-command-wiring",
    cwd: "/repo",
    head: "HEAD",
    originalArgv: [],
    packetDir: ".beep/yeet",
    repoRoot: "/repo",
    turbo: TurboPlanSnapshot.make({ graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }),
  });
  const publishPlanArgs = (options: { readonly amend: boolean; readonly noEdit: boolean }): ReadonlyArray<string> =>
    pipe(
      buildYeetRunPlanWithMode(
        planContext,
        O.none(),
        YeetRunPlanModeOptions.make({
          amend: options.amend,
          mode: "publish",
          monitor: false,
          noEdit: options.noEdit,
          pushOnly: false,
          tier: "full",
        })
      ).steps,
      A.findFirst((step) => step.id === "commit:01-git-commit"),
      O.map((step) => step.args),
      O.getOrElse(() => A.empty<string>())
    );

  it("plans the commit step with the required-message placeholder", () => {
    expect(publishPlanArgs({ amend: false, noEdit: false })).toEqual([
      "commit",
      "-m",
      "<required-conventional-commit-message>",
    ]);
  });

  it("plans the amended commit step with the same placeholder", () => {
    expect(publishPlanArgs({ amend: true, noEdit: false })).toEqual([
      "commit",
      "--amend",
      "-m",
      "<required-conventional-commit-message>",
    ]);
    expect(publishPlanArgs({ amend: true, noEdit: true })).toEqual(["commit", "--amend", "--no-edit"]);
  });
});

describe("yeet push-first publish plan wiring", () => {
  const planContext = RepoRunContext.make({
    base: "origin/main",
    branch: "feat/yeet-command-wiring",
    cwd: "/repo",
    head: "HEAD",
    originalArgv: [],
    packetDir: ".beep/yeet",
    repoRoot: "/repo",
    turbo: TurboPlanSnapshot.make({ graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }),
  });
  // The plan reads two ambient overrides; pin them so the fixture compares the
  // planner, not the shell it ran in.
  const withPlanEnv = <Out>(use: () => Out): Out => {
    const names = ["BEEP_YEET_LANE_PROOF_MODE", "BEEP_YEET_PUSH_REFSPEC"] as const;
    const previous = A.map(names, (name) => [name, Bun.env[name]] as const);
    for (const name of names) delete Bun.env[name];
    try {
      return use();
    } finally {
      for (const [name, value] of previous) {
        if (value === undefined) delete Bun.env[name];
        else Bun.env[name] = value;
      }
    }
  };
  const publishPlan = (options: {
    readonly mode?: "publish" | "verify";
    readonly monitor?: boolean;
    readonly pr: boolean;
    readonly proveFirst?: boolean;
    readonly pushOnly?: boolean;
  }) =>
    withPlanEnv(() =>
      buildYeetRunPlanWithMode(
        planContext,
        O.some("feat(repo-cli): example"),
        YeetRunPlanModeOptions.make({
          amend: false,
          mode: options.mode ?? "publish",
          monitor: options.monitor ?? false,
          noEdit: false,
          pr: options.pr,
          proveFirst: options.proveFirst ?? false,
          pushOnly: options.pushOnly ?? false,
          tier: "full",
        })
      )
    );
  const stepIds = (plan: RepoRunPlan): ReadonlyArray<string> => A.map(plan.steps, (step) => step.id);
  const withoutWaves = (plan: RepoRunPlan): RepoRunPlan =>
    RepoRunPlan.make({
      context: plan.context,
      steps: A.map(plan.steps, ({ waves: _waves, ...step }) => RepoPlanStep.make(step)),
    });
  const printedPlan = Effect.fn("printedPlan")(function* (plan: RepoRunPlan) {
    const chunks: Array<string> = [];
    yield* printCommandJson(plan).pipe(
      Effect.provideService(CommandJsonOutput, (text) => Effect.sync(() => void chunks.push(text)))
    );
    return A.join(chunks, "");
  });
  const decodeFixture = S.decodeUnknownEffect(S.fromJsonString(S.Record(S.String, S.String)));
  const decodePlan = S.decodeUnknownEffect(S.fromJsonString(RepoRunPlan));

  it("plans the default publish as cheap-gates, preflight, push, draft PR, label, stamp, detached monitor", () => {
    expect(stepIds(publishPlan({ pr: true }))).toEqual([
      "advisory:01-fallow-feedback",
      "commit:01-git-commit",
      "full:00-cheap-gates",
      "publish:00-head-install-preflight",
      "publish:01-git-push",
      "publish:02-pr-create",
      PR_HEAVY_ADMISSION_LABEL_STEP_ID,
      "publish:03-pr-provenance-stamp",
      MONITOR_READY_SUBMIT_STEP_ID,
    ]);
    // No full proof, no CI parity, no admission-bearing step on the default path.
    expect(stepIds(publishPlan({ pr: true }))).not.toContain("full:01-pre-push");
    expect(stepIds(publishPlan({ pr: true }))).not.toContain("full:02-ci-parity");
  });

  it("plans --no-pr as a bare push with no pull request or monitor steps", () => {
    expect(stepIds(publishPlan({ pr: false }))).toEqual([
      "advisory:01-fallow-feedback",
      "commit:01-git-commit",
      "full:00-cheap-gates",
      "publish:00-head-install-preflight",
      "publish:01-git-push",
    ]);
  });

  it("replaces the detached submit with the attached watch under --monitor", () => {
    const ids = stepIds(publishPlan({ monitor: true, pr: true }));
    expect(ids).not.toContain(MONITOR_READY_SUBMIT_STEP_ID);
    expect(A.takeRight(ids, 2)).toEqual(["monitor:01-pr-context", "monitor:02-pr-checks-watch"]);
  });

  it.effect("reproduces the pre-push-first plan byte-for-byte under --prove-first", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fixturePath = yield* path.fromFileUrl(
        new URL("./fixtures/yeet-publish-plan/prove-first-plans.json", import.meta.url)
      );
      const fixtures = yield* decodeFixture(yield* fs.readFileString(fixturePath));
      const verifyPlan = publishPlan({ mode: "verify", pr: false });
      // Only the PR-less plan is byte-identical: with a pull request every
      // publish path now shares the draft-label-monitor tail (D4, D7).
      for (const [name, options] of [["no-pr", { pr: false }]] as const) {
        const expected = yield* decodePlan(fixtures[name]);
        const actual = publishPlan({ ...options, proveFirst: true });
        // Byte equality of the `--plan --json` render. The fixture was captured
        // from the pre-change default; lane waves are compared against the
        // current verify plan instead, so a lane added to the catalog later
        // moves both and does not stale this fixture.
        expect(yield* printedPlan(withoutWaves(actual))).toBe(yield* printedPlan(withoutWaves(expected)));
        for (const step of A.filter(actual.steps, (candidate) => candidate.waves !== undefined)) {
          const twin = A.findFirst(verifyPlan.steps, (candidate) => candidate.id === step.id);
          assertSome(
            O.map(twin, (candidate) => candidate.waves),
            step.waves
          );
        }
      }
    }).pipe(provideScopedLayer(commandTestLayer))
  );

  it("gives --prove-first and --push-only the same draft, label, stamp, and detached monitor tail", () => {
    const tail = [
      "publish:02-pr-create",
      PR_HEAVY_ADMISSION_LABEL_STEP_ID,
      "publish:03-pr-provenance-stamp",
      MONITOR_READY_SUBMIT_STEP_ID,
    ];
    expect(A.takeRight(stepIds(publishPlan({ pr: true, proveFirst: true })), 4)).toEqual(tail);
    expect(A.takeRight(stepIds(publishPlan({ pr: true, pushOnly: true })), 4)).toEqual(tail);
    const proveFirst = publishPlan({ pr: true, proveFirst: true });
    assertSome(
      O.map(
        A.findFirst(proveFirst.steps, (step) => step.id === "publish:02-pr-create"),
        (step) => A.contains(step.args, "--draft")
      ),
      true
    );
    expect(stepIds(proveFirst)).toContain("full:01-pre-push");
  });

  it.effect("parses --no-pr and --prove-first, and rejects the removed --fast and --start-pr-early", () =>
    Effect.gen(function* () {
      // `--detach --plan` is refused by the handler after parsing, so reaching
      // that refusal proves the flags before it parsed.
      for (const flag of ["--no-pr", "--prove-first"]) {
        expect(yield* runYeetCommand(["publish", flag, "--detach", "--plan"]).pipe(Effect.flip)).toMatchObject({
          _tag: "YeetCommandError",
          message: "--detach cannot be combined with --plan.",
        });
      }
      for (const flag of ["--fast", "--start-pr-early"]) {
        const error = yield* runYeetCommand(["publish", flag, "--detach", "--plan"]).pipe(Effect.flip);
        expect(error._tag).not.toBe("YeetCommandError");
      }
    }).pipe(provideScopedLayer(commandTestLayer))
  );

  it("registers the ready subcommand", () => {
    expect(subcommandNames).toContain("ready");
    assertTrue(O.exists(findSubcommand("ready"), (command) => typeof command.description === "string"));
  });
});

it.layer(commandTestLayer, { timeout: "30 seconds" })("push-first publish gate", (it) => {
  it.effect(
    "stops on a cheap-gates red before the preflight, the push, or any pull request step",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-push-first-" });
      const context = RepoRunContext.make({
        base: "origin/main",
        branch: "feat/push-first",
        cwd: root,
        head: "HEAD",
        originalArgv: [],
        packetDir: ".beep/yeet",
        repoRoot: root,
        turbo: TurboPlanSnapshot.make({ graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }),
      });
      const step = (id: string, phase: RepoPlanStep["phase"], source: string) =>
        RepoPlanStep.make({
          id,
          label: id,
          phase,
          command: "bun",
          args: ["--eval", source],
          cwd: root,
          scope: "repo",
          mutability: "readonly",
          resume: "never",
        });
      const gate = step("full:00-cheap-gates", "full", 'console.log("knip: 1 unused export"); process.exitCode = 23');
      const push = step("publish:01-git-push", "publish", 'console.log("must not push")');
      const create = step("publish:02-pr-create", "publish", 'console.log("must not open a PR")');
      const submit = step(MONITOR_READY_SUBMIT_STEP_ID, "monitor", 'console.log("must not submit")');
      const plan = RepoRunPlan.make({ context, steps: [gate, push, create, submit] });
      const recorder = yield* Ref.make<ReadonlyArray<YeetExecutedStep>>([]);
      const extras = yield* Ref.make<YeetVerdictExtrasForTesting>({
        baseFreshness: O.none(),
        mergeReady: O.none(),
        stash: O.none(),
      });

      const error = yield* runPushFirstPublishPhasesForTesting(
        plan,
        defaultYeetRunOptions({ message: "feat(repo-cli): push first", pr: true }),
        [gate],
        [push, create],
        [submit],
        recorder,
        extras,
        false
      ).pipe(Effect.flip);

      expect(error.message).toContain("cheap-gates failed");
      expect(error.message).toContain("nothing was pushed");
      expect(A.map(yield* Ref.get(recorder), (entry) => entry.step.id)).toEqual(["full:00-cheap-gates"]);
    }, provideScopedLayer(commandTestLayer))
  );
});

describe("yeet monitor command routing", () => {
  it.each([
    [true, true, true, false, "classic"],
    [false, true, false, false, "invalid-until-event"],
    [false, true, true, true, "invalid-until-event"],
    [false, false, true, false, "merge-loop"],
    [false, true, false, true, "watch"],
    [false, false, false, false, "classic"],
  ] as const)(
    "routes plan=%s untilEvent=%s untilMerged=%s watch=%s to %s",
    (plan, untilEvent, untilMerged, watch, route) => {
      expect(yeetMonitorCommandRoute({ plan, untilEvent, untilMerged, watch })).toBe(route);
    }
  );

  it.effect("rejects --until-event before hydrating a monitor when --watch is absent", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(runYeetCommand(["monitor", "--until-event"]));

      expect(exit._tag).toBe("Failure");
      expect(String(exit)).toContain("requires --watch");
    }).pipe(provideScopedLayer(commandTestLayer))
  );
});

describe("yeet inbox command wiring", () => {
  it("registers the inbox subcommand with its list, ack, and append children", () => {
    expect(subcommandNames).toContain("inbox");

    const inbox = findSubcommand("inbox");
    expect(inbox._tag).toBe("Some");
    const children =
      inbox._tag === "Some"
        ? A.flatMap(inbox.value.subcommands, (group) => A.map(group.commands, (command) => command.name))
        : [];
    expect(children).toEqual(expect.arrayContaining(["list", "ack", "append"]));
  });
});

describe("settle-timeout route legality", () => {
  it.each([
    { watch: false, untilMerged: false, expected: "invalid-settle-timeout" },
    { watch: true, untilMerged: false, expected: "watch" },
    { watch: false, untilMerged: true, expected: "merge-loop" },
  ])("routes $expected", ({ watch, untilMerged, expected }) => {
    expect(yeetMonitorCommandRoute({ plan: false, untilEvent: false, settleTimeout: "30m", watch, untilMerged })).toBe(
      expected
    );
  });
  it.effect("rejects a timeout on plain monitor before hydration", () =>
    Effect.gen(function* () {
      const result = yield* Effect.result(runYeetCommand(["monitor", "--settle-timeout", "30m"]));
      expect(result._tag).toBe("Failure");
      if (result._tag === "Failure")
        expect(String(result.failure)).toContain("requires --until-merged, --until-ready, or --watch");
    }).pipe(provideScopedLayer(commandTestLayer))
  );
});

describe("until-ready route legality", () => {
  it.each([
    { untilMerged: false, untilEvent: false, watch: false, expected: "ready-loop" },
    { untilMerged: true, untilEvent: false, watch: false, expected: "invalid-until-ready" },
    { untilMerged: false, untilEvent: true, watch: false, expected: "invalid-until-ready" },
    { untilMerged: false, untilEvent: false, watch: true, expected: "invalid-until-ready" },
  ])("routes $expected", ({ expected, ...flags }) => {
    expect(yeetMonitorCommandRoute({ ...flags, untilReady: true, plan: false, settleTimeout: "30m" })).toBe(expected);
  });
  it.effect("rejects --until-ready --watch before hydration", () =>
    Effect.gen(function* () {
      const result = yield* Effect.result(runYeetCommand(["monitor", "--until-ready", "--watch"]));
      expect(result).toMatchObject({ _tag: "Failure", failure: { _tag: "CliReportedExit", exitCode: 1 } });
    }).pipe(provideScopedLayer(commandTestLayer))
  );
});

it.layer(commandTestLayer, { timeout: "30 seconds" })("detached proof job command wiring", (it) => {
  it.effect(
    "rejects a runtime ceiling without detachment and malformed resume coordinates",
    Effect.fnUntraced(function* () {
      expect(yield* runYeetCommand(["verify", "--job-max-runtime", "30 seconds"]).pipe(Effect.flip)).toMatchObject({
        message: "--job-max-runtime requires --detach.",
      });
      expect((yield* runYeetCommand(["resume", "invalid"]).pipe(Effect.flip))._tag).toBe("YeetCommandError");
    })
  );
  it("registers the complete job group and hides its finalizer", () => {
    const job = O.getOrThrow(findSubcommand("job"));
    const children = A.flatMap(job.subcommands, (group) => group.commands);
    expect(A.map(children, (command) => command.name)).toEqual([
      "list",
      "status",
      "wait",
      "logs",
      "cancel",
      "finalize",
    ]);
    expect(O.getOrThrow(A.findFirst(children, (command) => command.name === "finalize")).unlisted).toBe(true);
  });
  for (const name of ["verify", "publish", "closeout", "monitor", "repair"]) {
    it.effect(`registers --detach on ${name} and rejects --plan before planning`, () =>
      runYeetCommand([name, "--detach", "--plan"]).pipe(
        Effect.flip,
        Effect.tap((error) =>
          Effect.sync(() =>
            expect(error).toMatchObject({
              _tag: "YeetCommandError",
              message: "--detach cannot be combined with --plan.",
            })
          )
        )
      )
    );
  }
  it.effect("reaches the detached submit for --until-ready before any route legality", () =>
    runYeetCommand(["monitor", "--until-ready", "--detach", "--plan"]).pipe(
      Effect.flip,
      Effect.tap((error) =>
        Effect.sync(() =>
          expect(error).toMatchObject({ _tag: "YeetCommandError", message: "--detach cannot be combined with --plan." })
        )
      )
    )
  );
  for (const name of ["status", "pre-push-hook"]) {
    it.effect(`does not accept --detach on ${name}`, () =>
      runYeetCommand([name, "--detach"]).pipe(
        Effect.flip,
        Effect.tap((error) => Effect.sync(() => expect(error._tag).not.toBe("YeetCommandError")))
      )
    );
  }
  it.layer(ConfigProvider.layer(ConfigProvider.fromUnknown({ BEEP_YEET_JOB_ID: "parent" })), {
    timeout: "30 seconds",
  })("inside a job", (it) => {
    it.effect("rejects recursive detachment before reading git", () =>
      runYeetCommand(["verify", "--detach"]).pipe(
        Effect.flip,
        Effect.tap((error) =>
          Effect.sync(() => expect(error).toMatchObject({ message: "Cannot recursively --detach inside a proof job." }))
        )
      )
    );
  });
});

it.layer(commandTestLayer, { timeout: "30 seconds" })("attached monitor environment", (it) => {
  it.effect("dispatches an attached monitor without inheriting the parent proof job identity", () =>
    Effect.gen(function* () {
      const exit = yield* runYeetCommand(["monitor", "--until-ready"]).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({})),
        Effect.provideService(
          ChildProcessSpawner.ChildProcessSpawner,
          ChildProcessSpawner.make(() => Effect.die("fixture-git-boundary"))
        ),
        Effect.exit
      );
      expect(exit._tag).toBe("Failure");
      if (exit._tag === "Failure") expect(Cause.pretty(exit.cause)).toContain("fixture-git-boundary");
    })
  );
});

it.layer(commandTestLayer, { timeout: "30 seconds" })("publish readiness-monitor reuse", (it) => {
  const monitorRequest = (branch: string) =>
    ProofJobRequest.make({
      mode: "monitor",
      argv: ["monitor", "--until-ready", "--json"],
      checkout: "/repo",
      branch,
      base: "origin/main",
      head: "0123456789abcdef0123456789abcdef01234567",
      forwardedEnvNames: [],
    });
  const jobRecord = (
    jobId: string,
    phase: ProofJobRecord["phase"],
    request: ProofJobRequest,
    prNumber: O.Option<number>,
    submittedAt: string
  ) =>
    ProofJobRecord.make({
      jobId,
      phase,
      submittedAt,
      request,
      submitter: ProofJobSubmitter.make({ pid: 4242, procStart: O.none(), cwd: "/repo", harness: O.none() }),
      unit: ProofJobUnit.make({
        unitName: `beep-proof-${jobId}.service`,
        slice: "agent-runs.slice",
        description: "beep-yeet-job",
        logPath: `/repo/.beep/yeet/jobs/${jobId}.log`,
        execStart: ["/opt/bun"],
        execStopPost: ["/opt/bun"],
        maxRuntimeSeconds: O.none(),
        invocationId: O.none(),
      }),
      runner: O.none(),
      outcome: O.none(),
      systemd: O.none(),
      terminationReason: O.none(),
      cancelRequestedAt: O.none(),
      prNumber,
    });
  const RUNNING_ID = "cc5d6bd3-1111-4aaa-8bbb-000000000001";
  const SUBMITTED_ID = "f8bdb3ac-2222-4aaa-8bbb-000000000002";
  const running = jobRecord(
    RUNNING_ID,
    "running",
    monitorRequest("feat/push-first"),
    O.some(1427),
    "2026-10-05T10:00:00.000Z"
  );
  const unboundSubmitted = jobRecord(
    SUBMITTED_ID,
    "submitted",
    monitorRequest("feat/push-first"),
    O.none(),
    "2026-10-05T11:00:00.000Z"
  );
  const finished = jobRecord(
    "aaaaaaaa-3333-4aaa-8bbb-000000000003",
    "finished",
    monitorRequest("feat/push-first"),
    O.some(1427),
    "2026-10-05T12:00:00.000Z"
  );
  const otherPr = jobRecord(
    "bbbbbbbb-4444-4aaa-8bbb-000000000004",
    "running",
    monitorRequest("feat/other"),
    O.some(99),
    "2026-10-05T13:00:00.000Z"
  );
  const verifyJob = ProofJobRecord.make({
    ...jobRecord(
      "cccccccc-5555-4aaa-8bbb-000000000005",
      "running",
      monitorRequest("feat/push-first"),
      O.none(),
      "2026-10-05T14:00:00.000Z"
    ),
    request: ProofJobRequest.make({ ...monitorRequest("feat/push-first"), mode: "verify", argv: ["verify"] }),
  });
  const target = { branch: "feat/push-first", prNumber: 1427 };

  it("selects only a live --until-ready monitor on this pull request or branch", () => {
    expect(isLiveReadyMonitorJob(running, target)).toBe(true);
    expect(isLiveReadyMonitorJob(unboundSubmitted, target)).toBe(true);
    expect(isLiveReadyMonitorJob(finished, target)).toBe(false);
    expect(isLiveReadyMonitorJob(otherPr, target)).toBe(false);
    expect(isLiveReadyMonitorJob(verifyJob, target)).toBe(false);
    expect(isLiveReadyMonitorJob(ProofJobRecord.make({ ...running, phase: "terminated" }), target)).toBe(false);
    expect(isLiveReadyMonitorJob(ProofJobRecord.make({ ...unboundSubmitted, prNumber: O.some(99) }), target)).toBe(
      false
    );
    // Newest first, as the registry lists them: the most recent live monitor wins.
    assertSome(
      O.map(findLiveReadyMonitorJob([verifyJob, otherPr, finished, unboundSubmitted, running], target), (r) => r.jobId),
      unboundSubmitted.jobId
    );
    assertNone(findLiveReadyMonitorJob([verifyJob, otherPr, finished], target));
  });

  const tailFixture = Effect.fnUntraced(function* (root: string, submitSource: string) {
    const context = RepoRunContext.make({
      base: "origin/main",
      branch: "feat/push-first",
      cwd: root,
      head: "HEAD",
      originalArgv: [],
      packetDir: ".beep/yeet",
      repoRoot: root,
      turbo: TurboPlanSnapshot.make({ graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }),
    });
    const submit = RepoPlanStep.make({
      id: MONITOR_READY_SUBMIT_STEP_ID,
      label: MONITOR_READY_SUBMIT_STEP_ID,
      phase: "monitor",
      command: "bun",
      args: ["--eval", submitSource],
      cwd: root,
      scope: "repo",
      mutability: "readonly",
      resume: "never",
    });
    const plan = RepoRunPlan.make({ context, steps: [submit] });
    const recorder = yield* Ref.make<ReadonlyArray<YeetExecutedStep>>([]);
    const extras = yield* Ref.make<YeetVerdictExtrasForTesting>({
      baseFreshness: O.none(),
      mergeReady: O.none(),
      stash: O.none(),
    });
    const ensurePullRequest = () =>
      Effect.succeed(
        YeetEnsuredPullRequest.make({ number: 1427, url: O.some("https://github.com/o/r/pull/1427"), created: false })
      );
    return { plan, submit, recorder, extras, ensurePullRequest };
  });

  it.effect(
    "reuses the running monitor for the pull request instead of submitting a second job",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-monitor-reuse-" });
      const marker = `${root}/submitted.txt`;
      const fixture = yield* tailFixture(root, `require("node:fs").writeFileSync(${JSON.stringify(marker)}, "x")`);
      const listed = yield* Ref.make(0);
      const result = yield* finishPublishWithPullRequestForTesting(
        fixture.plan,
        defaultYeetRunOptions({ message: "fix(repo-cli): second push", pr: true }),
        [fixture.submit],
        fixture.recorder,
        fixture.extras,
        false,
        {
          ensurePullRequest: fixture.ensurePullRequest,
          listJobs: () => Ref.update(listed, (n) => n + 1).pipe(Effect.as([finished, running])),
        }
      );
      expect(result.pushed).toBe(true);
      expect(yield* Ref.get(listed)).toBe(1);
      expect(yield* fs.exists(marker)).toBe(false);
      const entries = yield* Ref.get(fixture.recorder);
      expect(A.map(entries, (entry) => [entry.step.id, entry.status])).toEqual([
        [MONITOR_READY_SUBMIT_STEP_ID, "skipped"],
      ]);
      expect(A.map(entries, (entry) => entry.result.output)).toEqual([
        `skipped: readiness monitor job ${RUNNING_ID} is already running for this pull request`,
      ]);
    })
  );

  it.effect(
    "submits a new monitor when the registry has no live monitor for the pull request",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-monitor-submit-" });
      // The child's JSON record line, as `monitor --until-ready --detach --json` prints it.
      const line = JSON.stringify({
        schemaVersion: "yeet-proof-job/v1",
        jobId: SUBMITTED_ID,
        phase: "submitted",
        submittedAt: "2026-10-05T11:00:00.000Z",
        request: {
          mode: "monitor",
          argv: ["monitor", "--until-ready", "--json"],
          checkout: "/repo",
          branch: "feat/push-first",
          base: "origin/main",
          head: "0123456789abcdef0123456789abcdef01234567",
          forwardedEnvNames: [],
        },
        submitter: { pid: 4242, cwd: "/repo" },
        unit: {
          unitName: `beep-proof-${SUBMITTED_ID}.service`,
          slice: "agent-runs.slice",
          description: "beep-yeet-job",
          logPath: `/repo/.beep/yeet/jobs/${SUBMITTED_ID}.log`,
          execStart: ["/opt/bun"],
          execStopPost: ["/opt/bun"],
        },
        returnedWaveRowIds: [],
      });
      const fixture = yield* tailFixture(root, `console.log(${JSON.stringify(line)})`);
      const result = yield* finishPublishWithPullRequestForTesting(
        fixture.plan,
        defaultYeetRunOptions({ message: "fix(repo-cli): first push", pr: true }),
        [fixture.submit],
        fixture.recorder,
        fixture.extras,
        false,
        { ensurePullRequest: fixture.ensurePullRequest, listJobs: () => Effect.succeed([finished, otherPr]) }
      );
      expect(result.pushed).toBe(true);
      const entries = yield* Ref.get(fixture.recorder);
      expect(A.map(entries, (entry) => entry.step.id)).toEqual([MONITOR_READY_SUBMIT_STEP_ID]);
      expect(A.map(entries, (entry) => entry.result.exitCode)).toEqual([0]);
      expect(A.map(entries, (entry) => entry.status)).not.toContain("skipped");
    })
  );

  it.effect(
    "falls back to submitting when the registry cannot be read",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-monitor-fallback-" });
      const fixture = yield* tailFixture(root, 'console.log("no record line")');
      const result = yield* finishPublishWithPullRequestForTesting(
        fixture.plan,
        defaultYeetRunOptions({ message: "fix(repo-cli): registry down", pr: true }),
        [fixture.submit],
        fixture.recorder,
        fixture.extras,
        false,
        {
          ensurePullRequest: fixture.ensurePullRequest,
          listJobs: () => YeetCommandError.make({ message: "jobs dir unreadable" }),
        }
      );
      expect(result.pushed).toBe(true);
      expect(A.map(yield* Ref.get(fixture.recorder), (entry) => entry.step.id)).toEqual([MONITOR_READY_SUBMIT_STEP_ID]);
    })
  );
});
