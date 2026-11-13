import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { GitHubClient } from "@beep/github/GitHubClient";
import { Repo, RepoRef } from "@beep/github/Repo";
import {
  ciShardOverflowPreflightCommand,
  decideShardOverflowPreflight,
  readShardOverflowPreflightFacts,
  SHARD_OVERFLOW_RUNNER_LABEL,
  ShardOverflowPreflightFacts,
  ShardOverflowPreflightProblem,
  ShardOverflowRepositoryHook,
  ShardOverflowRunnerGroup,
  shardOverflowAllowedWorkflow,
} from "@beep/repo-cli/commands/Ci";
import { GithubTransportFetch } from "@beep/repo-cli/test/SharedInternals";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { githubFetch, reply } from "./support/GithubFetch.ts";
import { provideSpawner } from "./support/ScriptedProcess.ts";
import type { GithubFetchCall } from "./support/GithubFetch.ts";

const REPOSITORY = "beep-effect/beep-effect";
const ENDPOINT = "https://overflow.execute-api.us-east-1.amazonaws.com/webhook";
const HEAVY_ENDPOINT = "https://heavy.execute-api.us-east-1.amazonaws.com/webhook";
const ALLOWED = shardOverflowAllowedWorkflow(REPOSITORY);
// A webhook secret as GitHub would redact it, plus a fixture value no output may echo.
const HOOK_SECRET = "fixture-hook-secret-never-printed";

const group = (values: Partial<ShardOverflowRunnerGroup> = {}) =>
  ShardOverflowRunnerGroup.make({
    id: 7,
    name: SHARD_OVERFLOW_RUNNER_LABEL,
    visibility: "selected",
    allows_public_repositories: true,
    restricted_to_workflows: true,
    selected_workflows: [ALLOWED],
    ...values,
  });
const hook = (values: Partial<ShardOverflowRepositoryHook> = {}) =>
  ShardOverflowRepositoryHook.make({ active: true, events: ["workflow_job"], url: ENDPOINT, ...values });
const facts = (values: Partial<ShardOverflowPreflightFacts> = {}) =>
  ShardOverflowPreflightFacts.make({
    repository: REPOSITORY,
    group: O.some(group()),
    repositories: [REPOSITORY],
    hooks: [hook({ url: HEAVY_ENDPOINT }), hook()],
    webhookUrl: ENDPOINT,
    ...values,
  });
const withGroup = (values: Partial<ShardOverflowRunnerGroup>) => facts({ group: O.some(group(values)) });

describe("decideShardOverflowPreflight", () => {
  it("passes a group restricted to exactly shard-overflow.yml on main, for this repository only", () => {
    expect(decideShardOverflowPreflight(facts())).toStrictEqual([]);
  });

  it("refuses a missing group", () => {
    expect(decideShardOverflowPreflight(facts({ group: O.none(), repositories: [] }))).toStrictEqual(["missing-group"]);
  });

  it("refuses an unrestricted group, which a fork's own workflow could reach", () => {
    expect(
      decideShardOverflowPreflight(withGroup({ restricted_to_workflows: false, selected_workflows: [] }))
    ).toStrictEqual(["workflows-unrestricted"]);
    // GitHub keeps the old list when the restriction is switched off; the list proves nothing then.
    expect(decideShardOverflowPreflight(withGroup({ restricted_to_workflows: false }))).toStrictEqual([
      "workflows-unrestricted",
    ]);
  });

  it("refuses the wrong workflow, the wrong ref, a short ref and any extra entry", () => {
    for (const selected of [
      [`${REPOSITORY}/.github/workflows/heavy.yml@refs/heads/main`],
      [`${REPOSITORY}/.github/workflows/check.yml@refs/heads/main`],
      [`${REPOSITORY}/.github/workflows/shard-overflow.yml@refs/heads/feat/ci-shard-overflow-routing`],
      [`${REPOSITORY}/.github/workflows/shard-overflow.yml@refs/pull/3256/merge`],
      [`${REPOSITORY}/.github/workflows/shard-overflow.yml@main`],
      [`someone/beep-effect/.github/workflows/shard-overflow.yml@refs/heads/main`],
      [ALLOWED, `${REPOSITORY}/.github/workflows/check.yml@refs/heads/main`],
      [ALLOWED, ALLOWED],
      [],
    ]) {
      expect(decideShardOverflowPreflight(withGroup({ selected_workflows: selected }))).toStrictEqual([
        "wrong-workflows",
      ]);
    }
  });

  it("refuses a group open to other repositories or closed to public ones", () => {
    expect(decideShardOverflowPreflight(withGroup({ visibility: "all" }))).toStrictEqual(["visibility-not-selected"]);
    expect(decideShardOverflowPreflight(withGroup({ visibility: "private" }))).toStrictEqual([
      "visibility-not-selected",
    ]);
    expect(decideShardOverflowPreflight(facts({ repositories: [REPOSITORY, "beep-effect/other"] }))).toStrictEqual([
      "wrong-repositories",
    ]);
    expect(decideShardOverflowPreflight(facts({ repositories: [] }))).toStrictEqual(["wrong-repositories"]);
    expect(decideShardOverflowPreflight(withGroup({ allows_public_repositories: false }))).toStrictEqual([
      "public-repositories-refused",
    ]);
  });

  it("refuses when no active workflow_job webhook delivers to the overflow endpoint", () => {
    // The heavy pool's webhook already delivers workflow_job to its own controller.
    for (const hooks of [
      [],
      [hook({ url: HEAVY_ENDPOINT })],
      [hook({ active: false })],
      [hook({ events: ["push", "pull_request"] })],
    ]) {
      expect(decideShardOverflowPreflight(facts({ hooks }))).toStrictEqual(["missing-webhook"]);
    }
  });

  it("reports every problem of a group created with GitHub's defaults", () => {
    expect(
      decideShardOverflowPreflight(
        facts({
          group: O.some(
            group({
              visibility: "all",
              allows_public_repositories: false,
              restricted_to_workflows: false,
              selected_workflows: [],
            })
          ),
          repositories: [],
          hooks: [],
        })
      )
    ).toStrictEqual([
      "workflows-unrestricted",
      "visibility-not-selected",
      "public-repositories-refused",
      "missing-webhook",
    ]);
  });

  it("names exactly shard-overflow.yml at refs/heads/main", () => {
    expect(ALLOWED).toBe("beep-effect/beep-effect/.github/workflows/shard-overflow.yml@refs/heads/main");
  });
});

// The REST shapes as GitHub returns them, extra fields included.
const groupRest = (values: Record<string, unknown> = {}) => ({
  id: 7,
  name: SHARD_OVERFLOW_RUNNER_LABEL,
  visibility: "selected",
  default: false,
  inherited: false,
  allows_public_repositories: true,
  restricted_to_workflows: true,
  selected_workflows: [ALLOWED],
  workflow_restrictions_read_only: false,
  runners_url: "https://api.github.com/orgs/beep-effect/actions/runner-groups/7/runners",
  ...values,
});
const defaultGroupRest = {
  id: 1,
  name: "Default",
  visibility: "all",
  default: true,
  allows_public_repositories: false,
  restricted_to_workflows: false,
  selected_workflows: [],
};
const groupsRest = (groups: ReadonlyArray<unknown>) => ({ total_count: A.length(groups), runner_groups: groups });
const repositoriesRest = (names: ReadonlyArray<string>) => ({
  total_count: A.length(names),
  repositories: A.map(names, (full_name) => ({ id: 1, full_name, private: false })),
});
const hookRest = (url: string, events: ReadonlyArray<string> = ["workflow_job"]) => ({
  id: 1,
  type: "Repository",
  name: "web",
  active: true,
  events,
  config: { content_type: "json", insecure_ssl: "0", secret: HOOK_SECRET, url },
});

const GROUPS_PATH = "/orgs/beep-effect/actions/runner-groups";
const REPOSITORIES_PATH = "/orgs/beep-effect/actions/runner-groups/7/repositories";
const HOOKS_PATH = "/repos/beep-effect/beep-effect/hooks";
type Routes = Readonly<Record<string, unknown>>;
const respond = (routes: Routes) => (call: GithubFetchCall) =>
  call.url.pathname in routes ? routes[call.url.pathname] : reply(404)({ message: `unscripted ${call.url.pathname}` });
const correctRoutes: Routes = {
  [GROUPS_PATH]: groupsRest([defaultGroupRest, groupRest()]),
  [REPOSITORIES_PATH]: repositoriesRest([REPOSITORY]),
  [HOOKS_PATH]: [hookRest(HEAVY_ENDPOINT), hookRest(ENDPOINT)],
};

const withApi =
  (routes: Routes, seen: Array<string>) =>
  <A, E, R>(program: Effect.Effect<A, E, R>) =>
    Effect.gen(function* () {
      const api = githubFetch(respond(routes));
      const github = yield* Layer.build(
        Layer.mergeAll(
          GitHubClient.layerFromToken({ token: Redacted.make("ghs_fixture"), retry: "off", fetch: api.fetch }),
          Repo.layer(RepoRef.make({ owner: "beep-effect", repo: "beep-effect" }))
        )
      );
      return yield* program.pipe(
        Effect.provideContext(github),
        Effect.provideService(GithubTransportFetch, O.some(api.fetch)),
        provideSpawner(
          ScriptedSpawner.make((command, args) =>
            A.join([command, ...args], " ") === "gh auth token"
              ? { stdout: "ghs_fixture\n" }
              : { exit: 1, stderr: "the preflight spawns only gh auth token" }
          )
        ),
        Effect.ensuring(
          Effect.sync(() => seen.push(...A.map(api.calls, (call) => `${call.method} ${call.url.pathname}`)))
        )
      );
    }).pipe(Effect.scoped);
const withEnv = Effect.provideService(
  ConfigProvider.ConfigProvider,
  ConfigProvider.fromUnknown({ GH_REPO: REPOSITORY })
);
const runCommand = Command.runWith(ciShardOverflowPreflightCommand, { version: "0.0.0" });
const printed = Effect.gen(function* () {
  const logs = yield* TestConsole.logLines;
  const errors = yield* TestConsole.errorLines;
  return A.join(A.map([...logs, ...errors], String), "\n");
});

it.layer(Layer.mergeAll(NodeServices.layer, TestConsole.layer), { timeout: "30 seconds" })(
  "ci shard-overflow-preflight",
  (it) => {
    it.effect("reads the group, its repositories and the webhooks without decoding a secret", () =>
      Effect.gen(function* () {
        const seen: Array<string> = [];
        const read = yield* readShardOverflowPreflightFacts(ENDPOINT).pipe(withApi(correctRoutes, seen));
        expect(seen).toStrictEqual([`GET ${GROUPS_PATH}`, `GET ${REPOSITORIES_PATH}`, `GET ${HOOKS_PATH}`]);
        expect(read.repository).toBe(REPOSITORY);
        assertSome(
          O.map(read.group, (found) => found.selected_workflows),
          [ALLOWED]
        );
        expect(read.repositories).toStrictEqual([REPOSITORY]);
        // Only the active flag, events and payload URL survive the decode; the secret never does.
        expect(read.hooks).toStrictEqual([hook({ url: HEAVY_ENDPOINT }), hook()]);
        expect(decideShardOverflowPreflight(read)).toStrictEqual([]);
      })
    );

    it.effect("skips the repository read when the group is open to every repository", () =>
      Effect.gen(function* () {
        const seen: Array<string> = [];
        const read = yield* readShardOverflowPreflightFacts(ENDPOINT).pipe(
          withApi({ ...correctRoutes, [GROUPS_PATH]: groupsRest([groupRest({ visibility: "all" })]) }, seen)
        );
        expect(seen).toStrictEqual([`GET ${GROUPS_PATH}`, `GET ${HOOKS_PATH}`]);
        expect(decideShardOverflowPreflight(read)).toStrictEqual(["visibility-not-selected"]);
      })
    );

    it.effect("passes through the command and says what it checked", () =>
      Effect.gen(function* () {
        const seen: Array<string> = [];
        yield* runCommand(["--webhook-url", ENDPOINT]).pipe(withApi(correctRoutes, seen), withEnv);
        const output = yield* printed;
        expect(output).toContain(`shard-overflow-preflight: ok; ${SHARD_OVERFLOW_RUNNER_LABEL} admits only ${ALLOWED}`);
        expect(output).not.toContain(HOOK_SECRET);
      })
    );

    it.effect("fails the command on an unrestricted group and names every problem", () =>
      Effect.gen(function* () {
        const seen: Array<string> = [];
        const exit = yield* runCommand(["--webhook-url", ENDPOINT]).pipe(
          withApi(
            {
              ...correctRoutes,
              [GROUPS_PATH]: groupsRest([groupRest({ restricted_to_workflows: false, selected_workflows: [] })]),
              [HOOKS_PATH]: [hookRest(HEAVY_ENDPOINT)],
            },
            seen
          ),
          withEnv,
          Effect.exit
        );
        expect(exit._tag).toBe("Failure");
        const output = yield* printed;
        expect(output).toContain("shard-overflow-preflight: workflows-unrestricted:");
        expect(output).toContain("shard-overflow-preflight: missing-webhook:");
        expect(output).toContain("2 problem(s); do not switch BEEP_SHARD_OVERFLOW on");
        expect(output).not.toContain(HOOK_SECRET);
      })
    );

    it.effect("fails closed when the group is missing or a listing cannot be read", () =>
      Effect.gen(function* () {
        const seen: Array<string> = [];
        const missing = yield* runCommand(["--webhook-url", ENDPOINT]).pipe(
          withApi({ ...correctRoutes, [GROUPS_PATH]: groupsRest([defaultGroupRest]) }, seen),
          withEnv,
          Effect.exit
        );
        expect(missing._tag).toBe("Failure");
        const forbidden = yield* runCommand(["--webhook-url", ENDPOINT]).pipe(
          withApi({ ...correctRoutes, [GROUPS_PATH]: reply(403)({ message: "Must have admin rights" }) }, seen),
          withEnv,
          Effect.exit
        );
        expect(forbidden._tag).toBe("Failure");
        const malformed = yield* runCommand(["--webhook-url", ENDPOINT]).pipe(
          withApi(
            { ...correctRoutes, [GROUPS_PATH]: { runner_groups: [{ name: SHARD_OVERFLOW_RUNNER_LABEL }] } },
            seen
          ),
          withEnv,
          Effect.exit
        );
        expect(malformed._tag).toBe("Failure");
        const output = yield* printed;
        expect(output).toContain(`missing-group: no organization runner group is named ${SHARD_OVERFLOW_RUNNER_LABEL}`);
        expect(output).toContain("the runner group listing did not decode");
      })
    );

    it.effect("names every problem it finds, one line each", () =>
      Effect.gen(function* () {
        const seen: Array<string> = [];
        // A group with GitHub's defaults, and a webhook whose payload URL GitHub did not return.
        const defaults = yield* runCommand(["--webhook-url", ENDPOINT]).pipe(
          withApi(
            {
              ...correctRoutes,
              [GROUPS_PATH]: groupsRest([
                groupRest({
                  visibility: "all",
                  allows_public_repositories: false,
                  restricted_to_workflows: false,
                  selected_workflows: [],
                }),
              ]),
              [HOOKS_PATH]: [{ ...hookRest(ENDPOINT), config: { content_type: "json" } }],
            },
            seen
          ),
          withEnv,
          Effect.exit
        );
        expect(defaults._tag).toBe("Failure");
        // A restricted group that admits another workflow, open to a second repository.
        const widened = yield* runCommand(["--webhook-url", ENDPOINT]).pipe(
          withApi(
            {
              ...correctRoutes,
              [GROUPS_PATH]: groupsRest([
                groupRest({
                  selected_workflows: [ALLOWED, `${REPOSITORY}/.github/workflows/check.yml@refs/heads/main`],
                }),
              ]),
              [REPOSITORIES_PATH]: repositoriesRest([REPOSITORY, "beep-effect/other"]),
            },
            seen
          ),
          withEnv,
          Effect.exit
        );
        expect(widened._tag).toBe("Failure");
        const output = yield* printed;
        for (const problem of ShardOverflowPreflightProblem.literals) {
          expect(
            problem === "missing-group" || Str.includes(`shard-overflow-preflight: ${problem}: `)(output),
            problem
          ).toBe(true);
        }
        expect(output).toContain("4 problem(s)");
        expect(output).toContain("2 problem(s)");
      })
    );
  }
);
