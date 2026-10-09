/**
 * Hosted CI settings and workflow policy checks.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import { Argument, Command, Flag } from "effect/cli";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { runRepoCommandCapture } from "../../internal/repo-run/index.ts";
import { decodeYamlTextWith } from "../../internal/schema/TextCodec.ts";
import { CiCommandError } from "./Ci.errors.ts";
import { CI_LANE_DESCRIPTORS } from "./CiLane.ts";
import type * as Crypto from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/process";

const $I = $RepoCliId.create("commands/Ci/CiGovernance");
const emptyRecord: Readonly<Record<string, unknown>> = {};
const SizeLabel = LiteralKit(["size/S", "size/M", "size/L", "size/XL"]).pipe(
  $I.annoteSchema("SizeLabel", { description: "The mutually exclusive pull request size labels." })
);
class PrSizeLabelDiff extends S.Class<PrSizeLabelDiff>($I`PrSizeLabelDiff`)(
  { label: SizeLabel, remove: S.Array(S.String), add: S.Boolean },
  $I.annote("PrSizeLabelDiff", { description: "The size label to keep and contradictory labels to remove." })
) {}
const textRecord = S.Record(S.String, S.Unknown);
class WorkflowStep extends S.Class<WorkflowStep>($I`WorkflowStep`)(
  { uses: S.optionalKey(S.String), with: S.optionalKey(textRecord), env: S.optionalKey(textRecord) },
  $I.annote("WorkflowStep", { description: "Workflow step fields inspected by credential and artifact policy." })
) {}
class WorkflowJob extends S.Class<WorkflowJob>($I`WorkflowJob`)(
  {
    name: S.optionalKey(S.String),
    environment: S.optionalKey(S.Union([S.String, S.Struct({ name: S.String })])),
    env: S.optionalKey(textRecord),
    steps: WorkflowStep.pipe(S.Array, S.optionalKey),
    strategy: S.optionalKey(S.Struct({ matrix: S.Record(S.String, S.Unknown) })),
  },
  $I.annote("WorkflowJob", { description: "Projected YAML job for workflow policy and producing-context checks." })
) {}
class WorkflowDocument extends S.Class<WorkflowDocument>($I`WorkflowDocument`)(
  { on: S.Unknown, concurrency: S.optionalKey(textRecord), jobs: S.Record(S.String, WorkflowJob) },
  $I.annote("WorkflowDocument", { description: "GitHub workflow document with job projections." })
) {}
class RequiredContext extends S.Class<RequiredContext>($I`RequiredContext`)(
  { context: S.String, integration_id: S.Finite.pipe(S.NullOr, S.optionalKey) },
  $I.annote("RequiredContext", { description: "A required status context and its producing integration." })
) {}
class RulesetRule extends S.Class<RulesetRule>($I`RulesetRule`)(
  {
    type: S.String,
    parameters: S.optionalKey(
      S.Struct({
        strict_required_status_checks_policy: S.optionalKey(S.Boolean),
        required_status_checks: RequiredContext.pipe(S.Array, S.optionalKey),
      })
    ),
  },
  $I.annote("RulesetRule", { description: "Required status checks projected from a GitHub ruleset." })
) {}
class Ruleset extends S.Class<Ruleset>($I`Ruleset`)(
  { id: S.Finite, name: S.String, enforcement: S.String, rules: S.Array(RulesetRule) },
  $I.annote("Ruleset", { description: "Live ruleset state used for capture and drift checking." })
) {}
class SettingsEnvironment extends S.Class<SettingsEnvironment>($I`SettingsEnvironment`)(
  { protection_rules: S.Array(S.Struct({ type: S.String, reviewers: S.Unknown.pipe(S.Array, S.optionalKey) })) },
  $I.annote("SettingsEnvironment", { description: "Desktop environment reviewer rules without secret values." })
) {}
class HeldRun extends S.Class<HeldRun>($I`HeldRun`)(
  { id: S.Finite, status: S.String, created_at: S.String, head_branch: S.String },
  $I.annote("HeldRun", { description: "Main Check run fields required to detect a held concurrency group." })
) {}
class HeldRunList extends S.Class<HeldRunList>($I`HeldRunList`)(
  { workflow_runs: S.Array(HeldRun) },
  $I.annote("HeldRunList", { description: "Main-push Check runs returned by the GitHub API." })
) {}

const stringListOption = S.Array(S.String).pipe(S.decodeUnknownOption);
const textRecordsOption = S.Array(textRecord).pipe(S.decodeUnknownOption);
const SetupAction = S.Struct({ inputs: S.Record(S.String, S.Struct({ default: S.optionalKey(S.Unknown) })) });
const decodeSetupAction = SetupAction.pipe(S.decodeUnknownEffect);
const decodeWorkflowDocument = WorkflowDocument.pipe(S.decodeUnknownEffect);
const PrFileCount = S.Struct({ changed_files: S.Int });
const PrLabels = S.Array(S.Struct({ name: S.String }));
const PendingDeployments = S.Array(S.Unknown);
const decodeRulesetJson = Ruleset.pipe(S.fromJsonString, S.decodeUnknownEffect);
const decodeEnvironmentJson = SettingsEnvironment.pipe(S.fromJsonString, S.decodeUnknownEffect);
const decodeHeldRunsJson = HeldRunList.pipe(S.fromJsonString, S.decodeUnknownEffect);
const decodePendingDeploymentsJson = PendingDeployments.pipe(S.fromJsonString, S.decodeUnknownEffect);
const decodePrFileCountJson = PrFileCount.pipe(S.fromJsonString, S.decodeUnknownEffect);
const decodePrLabelsJson = PrLabels.pipe(S.fromJsonString, S.decodeUnknownEffect);
const snapshotJson = S.fromJsonString(S.Unknown, { space: 2 });
const encodeSnapshotJson = snapshotJson.pipe(S.encodeUnknownEffect);

interface GithubPolicyClientShape {
  readonly read: (endpoint: string, projection?: string) => Effect.Effect<string, CiCommandError>;
  readonly write: (args: ReadonlyArray<string>) => Effect.Effect<void, CiCommandError>;
}
class GithubPolicyClient extends Context.Service<GithubPolicyClient, GithubPolicyClientShape>()(
  $I`GithubPolicyClient`
) {}
const makeClient = Effect.fn("CiGovernance.makeClient")(function* (root: string) {
  // Capture the platform dependencies once; commands provide this implementation.
  const capture = yield* Effect.context<Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner>();
  const execute = Effect.fn("CiGovernance.execute")(function* (args: ReadonlyArray<string>) {
    const result = yield* runRepoCommandCapture("gh", ["api", ...args], root).pipe(
      Effect.provide(capture),
      CiCommandError.mapError("GitHub policy request failed; state is unknown.")
    );
    if (result.exitCode !== 0 || result.truncated)
      return yield* CiCommandError.make({
        message: `GitHub policy request failed (exit ${result.exitCode}, truncated=${result.truncated}); state is unknown.`,
      });
    return result.output;
  });
  return GithubPolicyClient.of({
    read: Effect.fn("GithubPolicyClient.read")((endpoint: string, projection?: string) =>
      execute([endpoint, ...A.flatMap(O.toArray(O.fromUndefinedOr(projection)), (jq) => ["--jq", jq])])
    ),
    write: Effect.fn("GithubPolicyClient.write")((args: ReadonlyArray<string>) => execute(args).pipe(Effect.asVoid)),
  });
});
const strings = S.decodeUnknownOption(S.String);
const stringAt = (record: Readonly<Record<string, unknown>>, key: string): string =>
  pipe(
    O.fromUndefinedOr(record[key]),
    O.flatMap(strings),
    O.getOrElse(() => "")
  );
const recordOption = S.decodeUnknownOption(textRecord);
const hasWriteToken = (record: Readonly<Record<string, unknown>>): boolean =>
  A.some(R.values(record), (value) => O.exists(strings(value), Str.includes("secrets.TURBO_TOKEN")));
const jobsFor = (workflow: WorkflowDocument) => R.toEntries(workflow.jobs);
const environmentName = (job: WorkflowJob): string =>
  S.is(S.String)(job.environment) ? job.environment : (job.environment?.name ?? "");
const isMatrixWriter = (job: WorkflowJob, file: string, id: string): boolean =>
  job.strategy === undefined ||
  Str.includes("matrix.uses_turbo == 'true'")(environmentName(job)) ||
  (file === "check.yml" && A.contains(["lint-shard", "test-unit-shard"], id));

const writerEnvironmentAllowed = (job: WorkflowJob): boolean => {
  const env = environmentName(job);
  return (
    env === "turbo-cache-write" ||
    (Str.includes("github.event_name == 'push'")(env) && Str.includes("turbo-cache-write")(env))
  );
};
const jobCredentialRecords = (job: WorkflowJob) => [
  job.env ?? emptyRecord,
  ...A.flatMap(job.steps ?? [], (step) => [step.with ?? emptyRecord, step.env ?? emptyRecord]),
];
const callerGuardDiagnostics = (id: string, step: WorkflowStep) =>
  A.flatMap([...R.values(step.with ?? emptyRecord), ...R.values(step.env ?? emptyRecord)], (value) =>
    O.exists(
      strings(value),
      (text) => Str.includes("secrets.TURBO_TOKEN")(text) && !Str.includes("github.event_name == 'push'")(text)
    )
      ? [`${id}: writer input must stay guarded in the caller workflow`]
      : []
  );
const artifactRetentionDiagnostics = (id: string, step: WorkflowStep) =>
  Str.startsWith("actions/upload-artifact@")(step.uses ?? "") && step.with?.["retention-days"] === undefined
    ? [`${id}: artifact retention-days missing`]
    : [];
const jobWorkflowDiagnostics = (file: string, id: string, job: WorkflowJob) => [
  ...(A.some(jobCredentialRecords(job), hasWriteToken) &&
  (!writerEnvironmentAllowed(job) || !isMatrixWriter(job, file, id))
    ? [`${id}: write token requires the trusted Turbo writer environment`]
    : []),
  ...(file !== "cache-warm.yml" && hasWriteToken(job.env ?? emptyRecord)
    ? [`${id}: job-level writer credential bypasses setup policy`]
    : []),
  ...A.flatMap(job.steps ?? [], (step) => [
    ...callerGuardDiagnostics(id, step),
    ...artifactRetentionDiagnostics(id, step),
  ]),
];

/**
 * Check parsed workflow policy, including cache writer isolation and artifact lifetime.
 *
 * **Example** (Reject a write token without an environment)
 *
 * ```ts
 * import { workflowPolicyDiagnostics } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 * const check = workflowPolicyDiagnostics("fixture.yml", "on: push\njobs:\n  bad:\n    env:\n      TURBO_TOKEN: '${{ secrets.TURBO_TOKEN }}'\n")
 * Effect.isEffect(check) // => true
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const workflowPolicyDiagnostics = Effect.fn("CiGovernance.workflowPolicyDiagnostics")(function* (
  file: string,
  text: string
) {
  const workflow = yield* decodeYamlTextWith(decodeWorkflowDocument)(text).pipe(
    CiCommandError.mapError(`Cannot parse ${file}.`)
  );
  const diagnostics = A.flatMap(jobsFor(workflow), ([id, job]) => jobWorkflowDiagnostics(file, id, job));
  const triggers = O.getOrElse(recordOption(workflow.on), () => emptyRecord);
  const push = O.flatMap(O.fromUndefinedOr(triggers.push), recordOption);
  const branches = O.flatMap(push, (value) => stringListOption(value.branches));
  if (
    O.exists(branches, A.contains("main")) &&
    workflow.concurrency !== undefined &&
    workflow.concurrency["cancel-in-progress"] !== false &&
    stringAt(workflow.concurrency, "cancel-in-progress") !== "${{ github.event_name == 'pull_request' }}"
  )
    return [...diagnostics, "main pushes must not be cancelled by workflow concurrency"];
  return diagnostics;
});

/**
 * Check that setup's cache-write input defaults to the fail-closed value.
 *
 * **Example** (Missing default)
 *
 * ```ts
 * import { setupCacheWriteDisabled } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 * Effect.isEffect(setupCacheWriteDisabled("inputs: {}")) // => true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const setupCacheWriteDisabled = Effect.fn("CiGovernance.setupCacheWriteDisabled")(function* (text: string) {
  const action = yield* decodeYamlTextWith(decodeSetupAction)(text).pipe(
    CiCommandError.mapError("Cannot parse setup action.")
  );
  return action.inputs["cache-write"]?.default === "false";
});

/**
 * Expand YAML job names into their hosted check contexts.
 *
 * **Example** (A static job name)
 *
 * ```ts
 * import { workflowJobContexts } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 * Effect.isEffect(workflowJobContexts("check.yml", "on: push\njobs:\n  lint:\n    name: Lint\n")) // => true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const workflowJobContexts = Effect.fn("CiGovernance.workflowJobContexts")(function* (
  file: string,
  text: string
) {
  const workflow = yield* decodeYamlTextWith(decodeWorkflowDocument)(text).pipe(
    CiCommandError.mapError(`Cannot parse ${file}.`)
  );
  return A.flatMap(jobsFor(workflow), ([id, job]) => {
    const name = job.name ?? id;
    const include = pipe(
      O.fromUndefinedOr(job.strategy?.matrix.include),
      O.flatMap(textRecordsOption),
      O.getOrElse(A.empty)
    );
    const names = name === "${{ matrix.name }}" ? A.map(include, (row) => stringAt(row, "name")) : [name];
    return A.map(names, (context) => (file === "heavy.yml" ? `Heavy / ${context}` : context));
  });
});

/**
 * Compute one size label and the contradictory labels to remove.
 *
 * **Example** (Retain the matching label)
 *
 * ```ts
 * import { prSizeLabelDiff } from "@beep/repo-cli/commands/Ci"
 * prSizeLabelDiff(25, ["size/S", "size/L", "bug"]).remove // => ["size/S"]
 * ```
 *
 * @param count - Number of changed files in the pull request.
 * @param labels - Current label names, including unrelated labels to retain.
 * @returns The target size label and the add/remove operations required to reconcile it.
 * @category utilities
 * @since 0.0.0
 */
export const prSizeLabelDiff: {
  (labels: ReadonlyArray<string>): (count: number) => PrSizeLabelDiff;
  (count: number, labels: ReadonlyArray<string>): PrSizeLabelDiff;
} = dual(2, (count: number, labels: ReadonlyArray<string>): PrSizeLabelDiff => {
  const label = count > 50 ? "size/XL" : count > 20 ? "size/L" : count > 10 ? "size/M" : "size/S";
  return PrSizeLabelDiff.make({
    label,
    remove: A.filter(labels, (current) => Str.startsWith("size/")(current) && current !== label),
    add: !A.contains(labels, label),
  });
});

/**
 * Identify a waiting main Check run older than an hour with a pending successor.
 *
 * **Example** (A healthy run list)
 *
 * ```ts
 * import { heldGroupRunIds } from "@beep/repo-cli/commands/Ci"
 * heldGroupRunIds([], 0) // => []
 * ```
 *
 * @param runs - Main Check runs ordered by their GitHub creation timestamps.
 * @param nowMillis - Current Unix epoch time in milliseconds.
 * @returns Waiting run identifiers whose pending successors indicate a held concurrency group.
 * @category diagnostics
 * @since 0.0.0
 */
export const heldGroupRunIds: {
  (nowMillis: number): (runs: ReadonlyArray<HeldRun>) => ReadonlyArray<number>;
  (runs: ReadonlyArray<HeldRun>, nowMillis: number): ReadonlyArray<number>;
} = dual(
  2,
  (runs: ReadonlyArray<HeldRun>, nowMillis: number): ReadonlyArray<number> =>
    pipe(
      runs,
      A.filter((run) => {
        const created = DateTime.make(run.created_at);
        return (
          run.head_branch === "main" &&
          run.status === "waiting" &&
          O.exists(created, (at) => nowMillis - DateTime.toEpochMillis(at) > Duration.toMillis(Duration.hours(1))) &&
          A.some(
            runs,
            (next) =>
              next.id !== run.id &&
              next.head_branch === "main" &&
              next.status === "pending" &&
              next.created_at >= run.created_at
          )
        );
      }),
      A.map((run) => run.id)
    )
);

/**
 * Require a configured desktop reviewer rather than GitHub's implicit empty environment.
 *
 * **Example** (Missing approval)
 *
 * ```ts
 * import { desktopEnvironmentApproved } from "@beep/repo-cli/commands/Ci"
 * desktopEnvironmentApproved({ protection_rules: [] }) // => false
 * ```
 *
 * @param environment - The decoded protection rules returned by GitHub.
 * @returns Whether at least one required-reviewer rule contains a reviewer.
 * @category predicates
 * @since 0.0.0
 */
export const desktopEnvironmentApproved = (environment: SettingsEnvironment): boolean =>
  A.some(
    environment.protection_rules,
    (rule) => rule.type === "required_reviewers" && A.isReadonlyArrayNonEmpty(rule.reviewers ?? [])
  );
const requiredContexts = (ruleset: Ruleset): ReadonlyArray<string> =>
  pipe(
    ruleset.rules,
    A.flatMap((rule) =>
      rule.type === "required_status_checks" ? (rule.parameters?.required_status_checks ?? []) : []
    ),
    A.map((rule) => rule.context),
    A.dedupe,
    A.sort(Order.String)
  );
const expectedContexts = () =>
  pipe(
    CI_LANE_DESCRIPTORS,
    A.filter((lane) => lane.required),
    A.map((lane) => lane.contextName),
    A.dedupe,
    A.sort(Order.String)
  );
const checkEqual = Effect.fn("CiGovernance.checkEqual")(function* (
  actual: ReadonlyArray<string>,
  expected: ReadonlyArray<string>
) {
  if (A.join(actual, "\n") !== A.join(expected, "\n"))
    return yield* CiCommandError.make({
      message: `Ruleset drift: live=[${A.join(actual, ", ")}], declared=[${A.join(expected, ", ")}].`,
    });
});
const withClient = Effect.fn("CiGovernance.withClient")(function* <V, E, R>(
  effect: Effect.Effect<V, E, R | GithubPolicyClient>
) {
  const root = yield* findRepoRoot();
  const client = yield* makeClient(root);
  return yield* effect.pipe(Effect.provideService(GithubPolicyClient, client));
});
const snapshotPath = "goals/ship-velocity/research/branch-protection-contexts.json";
const ciRulesetCommand = Command.make(
  "ruleset",
  {
    capture: Flag.Boolean("capture").pipe(Flag.withDefault(false)),
    check: Flag.Boolean("check").pipe(Flag.withDefault(false)),
  },
  ({ capture, check }) =>
    withClient(
      Effect.gen(function* () {
        if (!capture && !check) return yield* CiCommandError.make({ message: "Use --capture or --check." });
        const client = yield* GithubPolicyClient;
        const ruleset = yield* client
          .read("repos/{owner}/{repo}/rulesets/10240248")
          .pipe(Effect.flatMap(decodeRulesetJson));
        yield* checkEqual(requiredContexts(ruleset), expectedContexts());
        if (capture) {
          const now = yield* DateTime.now;
          const text = yield* encodeSnapshotJson({
            schemaVersion: "branch-protection-contexts/v1",
            capturedAt: DateTime.formatIso(now),
            repository: "beep-effect/beep-effect",
            branch: "main",
            rulesetId: ruleset.id,
            rulesetName: ruleset.name,
            enforcement: ruleset.enforcement,
            strictRequiredStatusChecksPolicy: A.some(
              ruleset.rules,
              (rule) => rule.parameters?.strict_required_status_checks_policy === true
            ),
            requiredStatusChecks: requiredContexts(ruleset),
          });
          const fs = yield* FileSystem.FileSystem;
          const root = yield* findRepoRoot();
          yield* fs.writeFileString(`${root}/${snapshotPath}`, `${text}\n`);
        }
        yield* Console.log("ruleset: declared contexts match live GitHub settings");
      })
    )
).pipe(Command.withDescription("Read-only ruleset drift check; --capture updates the local snapshot"));
const ciSettingsCommand = Command.make("settings", { check: Flag.Boolean("check").pipe(Flag.withDefault(false)) }, () =>
  withClient(
    Effect.gen(function* () {
      const client = yield* GithubPolicyClient;
      const env = yield* client
        .read("repos/{owner}/{repo}/environments/professional-desktop-release")
        .pipe(Effect.flatMap(decodeEnvironmentJson));
      if (!desktopEnvironmentApproved(env))
        return yield* CiCommandError.make({
          message: "Desktop release environment requires a non-empty required_reviewers rule.",
        });
      yield* Console.log("settings: desktop release reviewer protection present");
    })
  )
).pipe(Command.withDescription("Read-only desktop release environment check"));
const ciHeldGroupCommand = Command.make("held-group", {}, () =>
  withClient(
    Effect.gen(function* () {
      const client = yield* GithubPolicyClient;
      const runs = yield* client
        .read(
          "repos/{owner}/{repo}/actions/workflows/check.yml/runs?branch=main&event=push&per_page=100",
          "{workflow_runs:[.workflow_runs[]|{id,status,created_at,head_branch}]}"
        )
        .pipe(Effect.flatMap(decodeHeldRunsJson));
      const now = yield* DateTime.now;
      const held = heldGroupRunIds(runs.workflow_runs, DateTime.toEpochMillis(now));
      yield* Effect.forEach(
        held,
        (id) =>
          client.read(`repos/{owner}/{repo}/actions/runs/${id}/pending_deployments`).pipe(
            Effect.flatMap(decodePendingDeploymentsJson),
            Effect.flatMap((deployments) =>
              Console.log(`held-group: run=${id}; pending deployments=${A.length(deployments)}`)
            )
          ),
        { concurrency: 4 }
      );
      if (A.isReadonlyArrayNonEmpty(held))
        return yield* CiCommandError.make({
          message: `held-group: ${A.join(
            A.map(held, (id) => `${id}`),
            ", "
          )}`,
        });
      yield* Console.log("held-group: clean");
    })
  )
).pipe(Command.withDescription("Detect a stalled main Check concurrency group without cancelling runs"));
const ciPrSizeCommand = Command.make("pr-size", { number: Argument.Int("number") }, ({ number }) =>
  withClient(
    Effect.gen(function* () {
      const client = yield* GithubPolicyClient;
      const pull = yield* client
        .read(`repos/{owner}/{repo}/pulls/${number}`)
        .pipe(Effect.flatMap(decodePrFileCountJson));
      const labels = yield* client
        .read(`repos/{owner}/{repo}/issues/${number}/labels?per_page=100`)
        .pipe(Effect.flatMap(decodePrLabelsJson));
      const diff = prSizeLabelDiff(
        pull.changed_files,
        A.map(labels, (label) => label.name)
      );
      yield* Effect.forEach(
        diff.remove,
        (label) =>
          client.write(["-X", "DELETE", `repos/{owner}/{repo}/issues/${number}/labels/${encodeURIComponent(label)}`]),
        { concurrency: 1 }
      );
      if (diff.add)
        yield* client.write([
          "-X",
          "POST",
          `repos/{owner}/{repo}/issues/${number}/labels`,
          "-f",
          `labels[]=${diff.label}`,
        ]);
      yield* Console.log(`Changed files: ${pull.changed_files}; label: ${diff.label}`);
    })
  )
).pipe(Command.withDescription("Replace contradictory size labels on a same-repository PR"));
const ciWorkflowPolicyCommand = Command.make(
  "workflow-lint",
  {},
  Effect.fn("CiGovernance.workflowLint")(function* () {
    const root = yield* findRepoRoot();
    const fs = yield* FileSystem.FileSystem;
    const files = yield* fs.readDirectory(`${root}/.github/workflows`);
    const diagnostics = yield* Effect.forEach(
      A.filter(files, Str.endsWith(".yml")),
      Effect.fnUntraced(function* (file) {
        const text = yield* fs.readFileString(`${root}/.github/workflows/${file}`);
        return yield* workflowPolicyDiagnostics(file, text).pipe(Effect.map(A.map((message) => `${file}: ${message}`)));
      }),
      { concurrency: 4 }
    ).pipe(Effect.map(A.flatten));
    const actionText = yield* fs.readFileString(`${root}/.github/actions/setup-monorepo-ci/action.yml`);
    if (!(yield* setupCacheWriteDisabled(actionText)))
      return yield* CiCommandError.make({ message: "setup action cache-write must default to false" });
    if (A.isReadonlyArrayNonEmpty(diagnostics))
      return yield* CiCommandError.make({ message: A.join(diagnostics, "\n") });
    yield* Console.log("workflow-lint: clean");
  })
).pipe(Command.withDescription("Lint trusted cache writers, push concurrency and artifact retention"));

/**
 * Register the hosted-settings, held-group, size-label and workflow-policy commands.
 *
 * **Example** (List the governance command count)
 *
 * ```ts
 * import { ciGovernanceCommands } from "@beep/repo-cli/commands/Ci"
 * ciGovernanceCommands.length // => 5
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const ciGovernanceCommands = [
  ciRulesetCommand,
  ciSettingsCommand,
  ciHeldGroupCommand,
  ciPrSizeCommand,
  ciWorkflowPolicyCommand,
];
