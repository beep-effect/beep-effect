/**
 * `beep ci shard-overflow-preflight`: the gate an operator runs, and must pass, before switching shard overflow on.
 *
 * **Details**
 *
 * Fork safety for the overflow pool rests on two things: the fork guard inside
 * `shard-overflow.yml` on `main`, and the organization runner group
 * `beep-shard-overflow` admitting only that file at `refs/heads/main`. This
 * repository is public, and a fork's pull request runs its own copy of
 * `check.yml`, so the guard alone is not enough: a group that admits every
 * workflow (GitHub's default) would let a fork write
 * `runs-on: beep-shard-overflow` in its copy and reach the pool. The group is
 * configured by hand, as the heavy pool's is, because the infrastructure stack
 * holds no GitHub credential (the decision record in `goals/ci-lane-economics`
 * says why), so this check reads it back instead of trusting a checklist.
 *
 * It needs a token that can read organization runner groups and repository
 * webhooks (`admin:org` and repository admin): the operator's `gh` login,
 * never a workflow's `GITHUB_TOKEN`. It reads the runner groups, the
 * repositories the overflow group admits and the repository webhooks, prints
 * one line per problem and never a secret (a webhook's `config.secret` is not
 * decoded). {@link decideShardOverflowPreflight} judges what it read; any
 * problem fails the command.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Repo } from "@beep/github/Repo";
import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CiCommandError, reportCiCommandError } from "./Ci.errors.ts";
import { SHARD_OVERFLOW_RUNNER_LABEL } from "./CiShardOverflow.ts";
import { ghApiJson, withCiGithub } from "./LaneTimings.ts";
import type { GitHubClient } from "@beep/github/GitHubClient";

const $I = $RepoCliId.create("commands/Ci/CiShardOverflowPreflight");

/**
 * Why the overflow pool is not safe, or not ready, to switch on.
 *
 * **Details**
 *
 * - `missing-group`: no organization runner group is named `beep-shard-overflow`.
 * - `workflows-unrestricted`: the group admits every workflow, so a fork's own
 *   copy of a workflow could put a job on the pool.
 * - `wrong-workflows`: the group admits something other than exactly
 *   `shard-overflow.yml` at `refs/heads/main` (another file, another ref, or more).
 * - `visibility-not-selected`: the group is open to every repository of the
 *   organization instead of selected ones.
 * - `wrong-repositories`: the selected repositories are not exactly this one.
 * - `public-repositories-refused`: the group refuses public repositories, so a
 *   routed shard would never get a runner.
 * - `missing-webhook`: no active repository webhook delivers `workflow_job`
 *   events to the overflow controller's endpoint, so the pool never launches a VM.
 *
 * **Example** (Check a problem)
 *
 * ```ts
 * import { ShardOverflowPreflightProblem } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(ShardOverflowPreflightProblem.is["wrong-workflows"]("wrong-workflows")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ShardOverflowPreflightProblem = LiteralKit([
  "missing-group",
  "workflows-unrestricted",
  "wrong-workflows",
  "visibility-not-selected",
  "wrong-repositories",
  "public-repositories-refused",
  "missing-webhook",
]).pipe(
  $I.annoteSchema("ShardOverflowPreflightProblem", {
    description: "Why the shard overflow pool is not safe, or not ready, to switch on.",
  })
);

/**
 * Why the overflow pool is not safe, or not ready, to switch on.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ShardOverflowPreflightProblem = typeof ShardOverflowPreflightProblem.Type;

/**
 * One organization runner group, as `GET /orgs/{org}/actions/runner-groups` lists it.
 *
 * **Example** (A correctly restricted group)
 *
 * ```ts
 * import { ShardOverflowRunnerGroup } from "@beep/repo-cli/commands/Ci"
 *
 * const group = ShardOverflowRunnerGroup.make({
 *   id: 7,
 *   name: "beep-shard-overflow",
 *   visibility: "selected",
 *   allows_public_repositories: true,
 *   restricted_to_workflows: true,
 *   selected_workflows: ["beep-effect/beep-effect/.github/workflows/shard-overflow.yml@refs/heads/main"],
 * })
 * console.log(group.restricted_to_workflows) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShardOverflowRunnerGroup extends S.Opaque<ShardOverflowRunnerGroup, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.Finite,
    name: S.String,
    visibility: S.String,
    allows_public_repositories: S.Boolean,
    restricted_to_workflows: S.Boolean,
    selected_workflows: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("ShardOverflowRunnerGroup", {
      description: "An organization runner group's name, visibility and workflow restriction.",
    })
  )
) {}

/**
 * One repository webhook, reduced to what the preflight reads (never its secret).
 *
 * **Example** (An active workflow_job webhook)
 *
 * ```ts
 * import { ShardOverflowRepositoryHook } from "@beep/repo-cli/commands/Ci"
 *
 * const hook = ShardOverflowRepositoryHook.make({
 *   active: true,
 *   events: ["workflow_job"],
 *   url: "https://example.execute-api.us-east-1.amazonaws.com/webhook",
 * })
 * console.log(hook.active) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShardOverflowRepositoryHook extends S.Opaque<
  ShardOverflowRepositoryHook,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    active: S.Boolean,
    events: S.Array(S.String),
    url: S.String,
  }).pipe(
    $I.annoteSchema("ShardOverflowRepositoryHook", {
      description: "A repository webhook's active flag, events and payload URL.",
    })
  )
) {}

/**
 * What the preflight read, and the endpoint it expects the webhook to deliver to.
 *
 * **Details**
 *
 * `group` is the runner group named `beep-shard-overflow`, if any;
 * `repositories` the `owner/name` of every repository the group admits;
 * `repository` this repository; `webhookUrl` the overflow controller's endpoint
 * (the `endpoint` of the stack output `shardOverflowWebhook`). The URL is
 * required: the heavy pool's controller already has a `workflow_job` webhook on
 * this repository, so "some webhook delivers jobs" proves nothing.
 *
 * **Example** (Facts with no group)
 *
 * ```ts
 * import { ShardOverflowPreflightFacts } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const facts = ShardOverflowPreflightFacts.make({
 *   repository: "beep-effect/beep-effect",
 *   group: O.none(),
 *   repositories: [],
 *   hooks: [],
 *   webhookUrl: "https://example.execute-api.us-east-1.amazonaws.com/webhook",
 * })
 * console.log(facts.repository) // "beep-effect/beep-effect"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShardOverflowPreflightFacts extends S.Opaque<
  ShardOverflowPreflightFacts,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    repository: S.String,
    group: S.Option(ShardOverflowRunnerGroup),
    repositories: S.Array(S.String),
    hooks: S.Array(ShardOverflowRepositoryHook),
    webhookUrl: S.String,
  }).pipe(
    $I.annoteSchema("ShardOverflowPreflightFacts", {
      description: "The overflow runner group, its repositories and the repository webhooks, as read.",
    })
  )
) {}

/**
 * The only workflow the overflow runner group may admit.
 *
 * **Example** (The allowed workflow of this repository)
 *
 * ```ts
 * import { shardOverflowAllowedWorkflow } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(shardOverflowAllowedWorkflow("beep-effect/beep-effect"))
 * // beep-effect/beep-effect/.github/workflows/shard-overflow.yml@refs/heads/main
 * ```
 *
 * @param repository - This repository's `owner/name`.
 * @returns The selected-workflow entry the group must list, and nothing else.
 * @category constants
 * @since 0.0.0
 */
export const shardOverflowAllowedWorkflow = (repository: string): string =>
  `${repository}/.github/workflows/shard-overflow.yml@refs/heads/main`;

const isExactly =
  (expected: string) =>
  (entries: ReadonlyArray<string>): boolean =>
    A.length(entries) === 1 && A.contains(entries, expected);

const groupFails =
  (failing: (group: ShardOverflowRunnerGroup, facts: ShardOverflowPreflightFacts) => boolean) =>
  (facts: ShardOverflowPreflightFacts): boolean =>
    O.exists(facts.group, (group) => failing(group, facts));

const deliversJobsTo = (webhookUrl: string) => (hook: ShardOverflowRepositoryHook) =>
  hook.active && hook.url === webhookUrl && A.contains(hook.events, "workflow_job");

const preflightGates: ReadonlyArray<
  readonly [ShardOverflowPreflightProblem, (facts: ShardOverflowPreflightFacts) => boolean]
> = [
  ["missing-group", (facts) => O.isNone(facts.group)],
  ["workflows-unrestricted", groupFails((group) => !group.restricted_to_workflows)],
  [
    "wrong-workflows",
    groupFails(
      (group, facts) =>
        group.restricted_to_workflows &&
        !isExactly(shardOverflowAllowedWorkflow(facts.repository))(group.selected_workflows)
    ),
  ],
  ["visibility-not-selected", groupFails((group) => group.visibility !== "selected")],
  [
    "wrong-repositories",
    groupFails((group, facts) => group.visibility === "selected" && !isExactly(facts.repository)(facts.repositories)),
  ],
  ["public-repositories-refused", groupFails((group) => !group.allows_public_repositories)],
  ["missing-webhook", (facts) => !A.some(facts.hooks, deliversJobsTo(facts.webhookUrl))],
];

/**
 * Every reason the overflow pool may not be switched on; empty when it may.
 *
 * **Example** (A group created with GitHub's defaults)
 *
 * ```ts
 * import {
 *   decideShardOverflowPreflight,
 *   ShardOverflowPreflightFacts,
 *   ShardOverflowRunnerGroup,
 * } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const problems = decideShardOverflowPreflight(
 *   ShardOverflowPreflightFacts.make({
 *     repository: "beep-effect/beep-effect",
 *     group: O.some(
 *       ShardOverflowRunnerGroup.make({
 *         id: 7,
 *         name: "beep-shard-overflow",
 *         visibility: "all",
 *         allows_public_repositories: false,
 *         restricted_to_workflows: false,
 *         selected_workflows: [],
 *       })
 *     ),
 *     repositories: [],
 *     hooks: [],
 *     webhookUrl: "https://example.execute-api.us-east-1.amazonaws.com/webhook",
 *   })
 * )
 * console.log(problems)
 * // ["workflows-unrestricted", "visibility-not-selected", "public-repositories-refused", "missing-webhook"]
 * ```
 *
 * @param facts - What the preflight read.
 * @returns The problems, in {@link ShardOverflowPreflightProblem} order.
 * @category use-cases
 * @since 0.0.0
 */
export const decideShardOverflowPreflight = (
  facts: ShardOverflowPreflightFacts
): ReadonlyArray<ShardOverflowPreflightProblem> =>
  pipe(
    preflightGates,
    A.filter(([, fails]) => fails(facts)),
    A.map(([problem]) => problem)
  );

const RunnerGroupsPage = S.Struct({ runner_groups: S.Array(ShardOverflowRunnerGroup) });
const GroupRepositoriesPage = S.Struct({ repositories: S.Array(S.Struct({ full_name: S.String })) });
const RepositoryHooks = S.Array(
  S.Struct({ active: S.Boolean, events: S.Array(S.String), config: S.Struct({ url: S.optionalKey(S.String) }) })
);
const decodeRunnerGroupsPage = S.decodeUnknownEffect(RunnerGroupsPage);
const decodeGroupRepositoriesPage = S.decodeUnknownEffect(GroupRepositoriesPage);
const decodeRepositoryHooks = S.decodeUnknownEffect(RepositoryHooks);
const noRepositories = { repositories: [] };

const readGroupRepositories = (group: O.Option<ShardOverflowRunnerGroup>) =>
  O.match(
    O.filter(group, (found) => found.visibility === "selected"),
    {
      onNone: () => Effect.succeed<unknown>(noRepositories),
      onSome: (found) => ghApiJson(`orgs/{owner}/actions/runner-groups/${found.id}/repositories?per_page=100`),
    }
  );

/**
 * Read the runner group, its repositories and the repository webhooks through the GitHub API.
 *
 * **Details**
 *
 * Two or three reads: the organization's runner groups, the repositories of
 * the overflow group when it is limited to selected ones, and this
 * repository's webhooks. Only a webhook's active flag, events and payload URL
 * are decoded, never its secret. A listing that does not decode fails the
 * command rather than passing it.
 *
 * **Example** (Build the read)
 *
 * ```ts
 * import { readShardOverflowPreflightFacts } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(readShardOverflowPreflightFacts("https://example.invalid/webhook"))) // true
 * ```
 *
 * @param webhookUrl - The overflow controller's webhook endpoint.
 * @returns The facts the decision reads.
 * @category use-cases
 * @since 0.0.0
 */
export const readShardOverflowPreflightFacts = Effect.fn("Ci.readShardOverflowPreflightFacts")(function* (
  webhookUrl: string
): Effect.fn.Return<ShardOverflowPreflightFacts, CiCommandError, GitHubClient | Repo> {
  const ref = yield* Repo;
  const groupsJson = yield* ghApiJson("orgs/{owner}/actions/runner-groups?per_page=100");
  const groups = yield* decodeRunnerGroupsPage(groupsJson).pipe(
    CiCommandError.mapError("shard-overflow-preflight: the runner group listing did not decode")
  );
  const group = A.findFirst(groups.runner_groups, (candidate) => candidate.name === SHARD_OVERFLOW_RUNNER_LABEL);
  const repositoriesJson = yield* readGroupRepositories(group);
  const repositories = yield* decodeGroupRepositoriesPage(repositoriesJson).pipe(
    CiCommandError.mapError("shard-overflow-preflight: the runner group's repository listing did not decode")
  );
  const hooksJson = yield* ghApiJson("repos/{owner}/{repo}/hooks?per_page=100");
  const hooks = yield* decodeRepositoryHooks(hooksJson).pipe(
    CiCommandError.mapError("shard-overflow-preflight: the repository webhook listing did not decode")
  );
  return ShardOverflowPreflightFacts.make({
    repository: `${ref.owner}/${ref.repo}`,
    group,
    repositories: A.map(repositories.repositories, (entry) => entry.full_name),
    hooks: A.map(hooks, (hook) =>
      ShardOverflowRepositoryHook.make({
        active: hook.active,
        events: hook.events,
        url: O.getOrElse(O.fromUndefinedOr(hook.config.url), () => ""),
      })
    ),
    webhookUrl,
  });
});

const problemLines: { readonly [Problem in ShardOverflowPreflightProblem]: (repository: string) => string } = {
  "missing-group": () => `no organization runner group is named ${SHARD_OVERFLOW_RUNNER_LABEL}`,
  "workflows-unrestricted": (repository) =>
    `the runner group admits every workflow; restrict it to ${shardOverflowAllowedWorkflow(repository)} so a fork's own workflow cannot reach the pool`,
  "wrong-workflows": (repository) => `the runner group must admit exactly ${shardOverflowAllowedWorkflow(repository)}`,
  "visibility-not-selected": (repository) =>
    `the runner group must be limited to selected repositories (${repository})`,
  "wrong-repositories": (repository) => `the runner group must admit exactly one repository, ${repository}`,
  "public-repositories-refused": () =>
    "the runner group refuses public repositories, so routed shards would never get a runner",
  "missing-webhook": () => "no active repository webhook delivers workflow_job events to the given --webhook-url",
};

const reportProblem = (repository: string) => (problem: ShardOverflowPreflightProblem) =>
  Console.error(`shard-overflow-preflight: ${problem}: ${problemLines[problem](repository)}`);

/**
 * Read, decide and report: fails unless every check passes.
 *
 * **Example** (Build the preflight program)
 *
 * ```ts
 * import { runShardOverflowPreflight } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(runShardOverflowPreflight("https://example.invalid/webhook"))) // true
 * ```
 *
 * @param webhookUrl - The overflow controller's webhook endpoint.
 * @returns Nothing; fails with {@link CiCommandError} when any problem is found.
 * @category use-cases
 * @since 0.0.0
 */
export const runShardOverflowPreflight = Effect.fn("Ci.runShardOverflowPreflight")(function* (webhookUrl: string) {
  const facts = yield* readShardOverflowPreflightFacts(webhookUrl);
  const problems = decideShardOverflowPreflight(facts);
  yield* Effect.forEach(problems, reportProblem(facts.repository), { discard: true });
  if (A.isReadonlyArrayNonEmpty(problems)) {
    return yield* CiCommandError.make({
      message: `shard-overflow-preflight: ${A.length(problems)} problem(s); do not switch BEEP_SHARD_OVERFLOW on`,
    });
  }
  yield* Console.log(
    `shard-overflow-preflight: ok; ${SHARD_OVERFLOW_RUNNER_LABEL} admits only ${shardOverflowAllowedWorkflow(facts.repository)} for ${facts.repository}, and an active workflow_job webhook delivers to ${webhookUrl}`
  );
});

/**
 * `beep ci shard-overflow-preflight --webhook-url <url>`: fail unless the overflow pool is safe to switch on.
 *
 * **Example** (Register the command)
 *
 * ```ts
 * import { ciShardOverflowPreflightCommand } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(ciShardOverflowPreflightCommand.name) // "shard-overflow-preflight"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const ciShardOverflowPreflightCommand = Command.make(
  "shard-overflow-preflight",
  {
    webhookUrl: Flag.String("webhook-url").pipe(
      Flag.withDescription(
        "The overflow controller's webhook endpoint (the endpoint of pulumi stack output shardOverflowWebhook)"
      )
    ),
  },
  ({ webhookUrl }) =>
    findRepoRoot().pipe(
      CiCommandError.mapError("Failed to locate repository root."),
      Effect.flatMap((cwd) => runShardOverflowPreflight(webhookUrl).pipe(withCiGithub(cwd))),
      Effect.catchTag("CiCommandError", reportCiCommandError)
    )
).pipe(Command.withDescription("Check the overflow runner group and webhook before switching shard overflow on"));
