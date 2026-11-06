/** GitHub half of the W7b differential; each case owns its spawner and paginating HTTP world. */

import { isDeepStrictEqual } from "node:util";
import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { GitHubClient } from "@beep/github/GitHubClient";
import { Repo } from "@beep/github/Repo";
import { RetryPolicy } from "@beep/github/Resilience";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { makeRouteGithubRunner } from "../../../packages/tooling/tool/cli/src/commands/Ci/RouteCorpus.ts";
import { goalCompletionIo } from "../../../packages/tooling/tool/cli/src/commands/Goals/CompletionEvidence.ts";
import {
  inspectClone,
  listStarredRepos,
} from "../../../packages/tooling/tool/cli/src/commands/Research/internal/RepoCards.ts";
import { GithubTransportFetch } from "../../../packages/tooling/tool/cli/src/internal/github/GithubIdentity.ts";
import { layerGithubRest } from "../../../packages/tooling/tool/cli/src/internal/github/GithubRest.ts";
import { completionFetch } from "../../../packages/tooling/tool/cli/test/support/CompletionFetch.ts";
import { provideSpawner } from "../../../packages/tooling/tool/cli/test/support/ScriptedProcess.ts";
import * as Old from "./frozen-w7b/Completion.old.ts";
import * as Evidence from "./frozen-w7b/CompletionEvidence.old.ts";
import { inspectClone as oldInspectClone, listStarredRepos as oldStars } from "./frozen-w7b/RepoCards.old.ts";
import { routeGhRunner } from "./frozen-w7b/RouteCorpus.old.ts";
import type * as Digest from "effect/crypto/Digest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { GoalCompletionIo } from "../../../packages/tooling/tool/cli/src/commands/Goals/CompletionEvidence.service.ts";

/**
 * A replay outcome and the explicit classification of any behavior change.
 * @category models
 * @since 0.0.0
 */
export interface GroupsDifferentialRow {
  readonly new: unknown;
  readonly note?: string;
  readonly old: unknown;
  readonly scenario: string;
  readonly site: string;
  readonly verdict: "same" | "classified" | "unclassified";
}

type Services = ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom | Digest.Digest;
const json = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
const parse = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));
const Message = S.Struct({ message: S.String });
const capture = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.match({
      onFailure: (error) => ({ error: S.is(Message)(error) ? error.message : "read failed" }),
      onSuccess: (value): unknown => ({ value }),
    })
  );
const row = (site: string, scenario: string, old: unknown, current: unknown, note: string): GroupsDifferentialRow =>
  isDeepStrictEqual(old, current)
    ? { site, scenario, old, new: current, verdict: "same" }
    : {
        site,
        scenario,
        old,
        new: current,
        verdict:
          scenario === "failure" || scenario === "decode" || scenario === "rate-limited" || site === "B84"
            ? "classified"
            : "unclassified",
        note,
      };
const kitFailure =
  "Typed kit refusal replaces the process exit diagnostic; caller fallback/unknown semantics remain unchanged.";
const at = "2026-11-03T00:00:00Z";
const head = "head";
const root = ".";

interface CompletionCase {
  readonly body: (page: number) => unknown;
  readonly old: Effect.Effect<unknown, unknown, Services>;
  readonly pages?: boolean;
  readonly read: (io: GoalCompletionIo["Service"]) => Effect.Effect<unknown, unknown>;
  readonly schema: S.Codec<unknown, unknown>;
  readonly site: string;
  readonly wrap?: (rows: ReadonlyArray<unknown>) => unknown;
}
const SuitePages = S.Struct({ check_suites: S.Array(S.Struct({ created_at: S.DateTimeUtcFromString })) }).pipe(S.Array);
const cases: ReadonlyArray<CompletionCase> = [
  {
    site: "B56",
    body: () => ({
      created_at: at,
      number: 7,
      merged: true,
      merged_at: at,
      merge_commit_sha: "merge",
      head: { sha: head },
      base: { ref: "main", repo: { full_name: "example/repo" } },
    }),
    schema: Old.Pull,
    old: Old.pullRequest(root, 7),
    read: (io) => io.pullRequest(root, 7),
  },
  {
    site: "B57",
    body: () => ({ sha: "merge", parents: [{ sha: head }], commit: { tree: { sha: "tree" } } }),
    schema: Old.Commit,
    old: Old.commit(root, "merge"),
    read: (io) => io.commit(root, "merge"),
  },
  {
    site: "B58",
    pages: true,
    body: (page) => ({
      id: page,
      name: "Check",
      status: "completed",
      conclusion: "success",
      head_sha: head,
      started_at: at,
      completed_at: at,
    }),
    wrap: (rows) => ({ total_count: rows.length, check_runs: rows }),
    schema: Old.CheckPages,
    old: Old.checkRuns(root, head),
    read: (io) => io.checkRuns(root, head),
  },
  {
    site: "B59",
    pages: true,
    body: (page) => (page === 1 ? { event: "ready_for_review", created_at: at } : { event: "ready_for_review" }),
    schema: Old.TimelinePages,
    old: Old.timeline(root, 7),
    read: (io) => io.timeline(root, 7),
  },
  {
    site: "B60",
    pages: true,
    body: (page) => ({ created_at: page === 1 ? at : "2026-11-02T00:00:00Z" }),
    wrap: (rows) => ({ total_count: rows.length, check_suites: rows }),
    schema: SuitePages,
    old: Old.checkSuites(root, head),
    read: (io) => io.checkSuites(root, head),
  },
  {
    site: "B61",
    pages: true,
    body: (page) => ({ version_id: page, updated_at: at }),
    schema: Evidence.RulesetHistory,
    old: Evidence.readGoalCompletionJson(
      root,
      ["api", "repos/{owner}/{repo}/rulesets/42/history?per_page=100", "--paginate", "--slurp"],
      Evidence.RulesetHistory
    ),
    read: (io) => io.rulesetHistory(root, 42),
  },
  {
    site: "B62",
    body: () => ({
      state: {
        enforcement: "active",
        target: "branch",
        conditions: { ref_name: { include: ["~ALL"], exclude: [] } },
        rules: [],
      },
    }),
    schema: Evidence.RulesetVersion,
    old: Evidence.readGoalCompletionJson(
      root,
      ["api", "repos/{owner}/{repo}/rulesets/42/history/1"],
      Evidence.RulesetVersion
    ),
    read: (io) => io.rulesetVersion(root, 42, 1),
  },
  {
    site: "B63",
    pages: true,
    body: (page) => ({ id: page, ref: "refs/heads/main", after_sha: "merge" }),
    schema: Evidence.RuleSuiteList,
    old: Evidence.readGoalCompletionJson(
      root,
      [
        "api",
        "repos/{owner}/{repo}/rulesets/rule-suites?ref=refs/heads/main&time_period=month&per_page=100",
        "--paginate",
        "--slurp",
      ],
      Evidence.RuleSuiteList
    ),
    read: (io) => io.ruleSuites(root, "refs/heads/main"),
  },
  {
    site: "B64",
    body: () => ({
      id: 7,
      ref: "refs/heads/main",
      after_sha: "merge",
      pushed_at: at,
      result: "pass",
      rule_evaluations: [],
    }),
    schema: Evidence.RuleSuite,
    old: Evidence.readGoalCompletionJson(
      root,
      ["api", "repos/{owner}/{repo}/rulesets/rule-suites/7"],
      Evidence.RuleSuite
    ),
    read: (io) => io.ruleSuite(root, 7),
  },
  {
    site: "B65",
    pages: true,
    body: (page) => ({ id: page, source_type: "Repository", created_at: at }),
    schema: Evidence.RulesetList,
    old: Evidence.readGoalCompletionJson(
      root,
      ["api", "repos/{owner}/{repo}/rulesets?per_page=100&includes_parents=true", "--paginate", "--slurp"],
      Evidence.RulesetList
    ),
    read: (io) => io.rulesets(root),
  },
];

/**
 * Replay every migrated GitHub-half site against isolated fixture worlds.
 *
 * **Example** (Count replay rows)
 * ```ts
 * import { githubDifferentialRows } from "./groups-differential-w7.github.ts"
 * import * as Effect from "effect/Effect"
 * const count = Effect.map(githubDifferentialRows, (rows) => rows.length)
 * ```
 * @category verification
 * @since 0.0.0
 */
export const githubDifferentialRows: Effect.Effect<ReadonlyArray<GroupsDifferentialRow>> = Effect.gen(function* () {
  const rows: Array<GroupsDifferentialRow> = [];
  for (const spec of cases) {
    for (const scenario of spec.pages ? ["happy", "failure", "pagination", "decode"] : ["happy", "failure", "decode"]) {
      const pages = scenario === "pagination" ? 2 : 1;
      const body = (page: number) => (scenario === "decode" ? { malformed: true } : spec.body(page));
      const pageRows = A.map(A.range(1, pages), (page) => [body(page)]);
      const oldBody = spec.pages ? A.map(pageRows, (page) => spec.wrap?.(page) ?? page) : body(1);
      const output = yield* json(oldBody);
      const oldSpawner = ScriptedSpawner.make(() =>
        scenario === "failure" ? { exit: 1, stdout: "HTTP 403: Forbidden" } : { stdout: output }
      );
      const old = yield* capture(spec.old).pipe(provideSpawner(oldSpawner));
      const transport = completionFetch((url) => {
        if (scenario === "failure") return { status: 403, body: { message: "Forbidden" } };
        const page = Number(url.searchParams.get("page") ?? "1");
        const data = [body(page)];
        return { body: spec.pages ? (spec.wrap?.(data) ?? data) : body(1), next: page < pages };
      });
      const auth = ScriptedSpawner.make((command) => ({
        stdout: command === "gh" ? "fixture-token" : "git@github.com:example/repo.git",
      }));
      const current = yield* capture(
        Effect.gen(function* () {
          const io = yield* goalCompletionIo();
          return yield* spec.read(io);
        })
      ).pipe(Effect.provideService(GithubTransportFetch, O.some(transport.fetch)), provideSpawner(auth));
      // Offset pages are an implementation detail: compare their flattened contents.
      const flattenPages = (value: unknown): unknown => {
        if (!spec.pages || !S.is(S.Struct({ value: S.Array(S.Unknown) }))(value)) return value;
        return {
          value: A.flatMap(value.value, (page) => {
            if (spec.site === "B58" && S.is(S.Struct({ check_runs: S.Array(S.Unknown) }))(page)) return page.check_runs;
            if (spec.site === "B60" && S.is(S.Struct({ check_suites: S.Array(S.Unknown) }))(page))
              return page.check_suites;
            return A.isArray(page) ? page : [page];
          }),
        };
      };
      rows.push(
        row(
          spec.site,
          scenario,
          flattenPages(old),
          flattenPages(current),
          scenario === "decode"
            ? "Decoder failures remain typed; the kit boundary replaces the JSON-text parser diagnostic."
            : kitFailure
        )
      );
    }
  }
  for (const site of ["B53", "B54", "B55"]) {
    for (const scenario of ["happy", "failure", "absent"]) {
      const text = site === "B54" ? "git@github.com:example/repo.git" : "manifest";
      const oldSpawner = ScriptedSpawner.make(() =>
        scenario === "happy" ? { stdout: text } : { exit: 1, stderr: "missing" }
      );
      const old = yield* capture(
        (site === "B53"
          ? Old.manifestAtHead(root, head, "demo")
          : site === "B54"
            ? Old.originUrl(root)
            : Old.hostedManifest(root, head, "demo")
        ).pipe(Effect.option, Effect.map(O.getOrElse(() => "absent")))
      ).pipe(provideSpawner(oldSpawner));
      const transport = completionFetch(() =>
        scenario === "happy"
          ? { body: { type: "file", encoding: "base64", content: "bWFuaWZlc3Q=" } }
          : { status: scenario === "absent" ? 404 : 403, body: { message: "missing" } }
      );
      const auth = ScriptedSpawner.make((command) =>
        command === "gh"
          ? { stdout: "fixture-token" }
          : scenario === "happy"
            ? { stdout: site === "B55" ? "git@github.com:example/repo.git" : text }
            : { exit: site === "B54" ? 2 : 128, stderr: "fatal: invalid object name 'head'." }
      );
      const current = yield* capture(
        Effect.gen(function* () {
          const io = yield* goalCompletionIo();
          return yield* (
            site === "B53"
              ? io.manifestAtHead(root, head, "goals/demo/ops/manifest.json")
              : site === "B54"
                ? io.originUrl(root)
                : io.hostedManifest(root, head, "goals/demo/ops/manifest.json")
          ).pipe(Effect.orElseSucceed(O.none<string>), Effect.map(O.getOrElse(() => "absent")));
        })
      ).pipe(Effect.provideService(GithubTransportFetch, O.some(transport.fetch)), provideSpawner(auth));
      rows.push(
        row(
          site,
          scenario,
          old,
          current,
          "Kit absence and refused reads both preserve the accepted-manifest fallback / receipt repository Option."
        )
      );
    }
  }
  for (const site of ["B9", "B10", "B11"]) {
    for (const scenario of ["happy", "failure", ...(site === "B9" ? [] : ["pagination"]), "rate-limited"]) {
      const run = {
        id: 7,
        name: "Check",
        event: "pull_request",
        status: "completed",
        conclusion: "success",
        created_at: at,
        head_branch: "feat/demo",
        head_sha: head,
        run_attempt: 1,
      };
      const ghRun = {
        databaseId: 7,
        workflowName: "Check",
        event: "pull_request",
        status: "completed",
        conclusion: "success",
        createdAt: at,
        headBranch: "feat/demo",
        headSha: head,
        attempt: 1,
      };
      const job = { name: "Check", conclusion: "success", started_at: at, completed_at: at };
      const count = scenario === "pagination" ? 2 : 1;
      const expected =
        site === "B9"
          ? { resources: { core: { reset: 123 } } }
          : site === "B10"
            ? A.replicate(ghRun, count)
            : {
                ...ghRun,
                jobs: A.replicate(
                  { name: job.name, conclusion: job.conclusion, startedAt: at, completedAt: at },
                  count
                ),
              };
      const output = yield* json(expected);
      const args =
        site === "B9"
          ? ["api", "rate_limit"]
          : site === "B10"
            ? ["run", "list", "--workflow", "Check", "--created", "2026-11-03"]
            : ["run", "view", "7"];
      const oldSpawner = ScriptedSpawner.make(() =>
        scenario === "failure" || scenario === "rate-limited"
          ? { exit: 1, stdout: scenario === "failure" ? "HTTP 403: Forbidden" : "API rate limit exceeded" }
          : { stdout: output }
      );
      const old = yield* capture(
        Effect.flatMap(routeGhRunner, (runner) => runner(args, root)).pipe(Effect.flatMap(parse))
      ).pipe(provideSpawner(oldSpawner));
      const transport = completionFetch((url) => {
        if (scenario === "failure" || scenario === "rate-limited")
          return { status: scenario === "failure" ? 403 : 429, body: { message: scenario } };
        const second = url.searchParams.get("page") === "2";
        if (Str.endsWith("/rate_limit")(url.pathname))
          return {
            body: {
              resources: {
                core: { limit: 5000, remaining: 1, reset: 123 },
                graphql: { limit: 5000, remaining: 1, reset: 123 },
              },
            },
          };
        if (Str.endsWith("/workflows")(url.pathname))
          return {
            body: {
              total_count: count,
              workflows:
                second || count === 1
                  ? [{ id: 42, name: "Check", path: ".github/workflows/check.yml" }]
                  : [{ id: 1, name: "Other", path: "other.yml" }],
            },
            next: count === 2 && !second,
          };
        if (Str.endsWith("/jobs")(url.pathname))
          return { body: { total_count: count, jobs: [job] }, next: count === 2 && !second };
        if (Str.endsWith("/runs")(url.pathname))
          return { body: { total_count: count, workflow_runs: [run] }, next: count === 2 && !second };
        return { body: run };
      });
      const current = yield* capture(
        Effect.flatMap(makeRouteGithubRunner, (runner) => runner(args, root)).pipe(Effect.flatMap(parse))
      ).pipe(
        Effect.provide(
          layerGithubRest.pipe(
            Layer.provideMerge(
              Layer.mergeAll(
                GitHubClient.layerFromToken({
                  token: Redacted.make("fixture"),
                  fetch: transport.fetch,
                  retry: RetryPolicy.none,
                }),
                Repo.layerFromSlug("example/repo")
              )
            )
          )
        )
      );
      rows.push(
        row(
          site,
          scenario,
          old,
          current,
          "REST typed refusal/rate-limit diagnostics replace gh exit text; the corpus still retries ordinary failures and handles rate limits separately."
        )
      );
    }
  }
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "w7b-repo-cards-" });
  for (const scenario of ["happy", "failure", "empty-log"]) {
    const stamp = "2026-11-03T03:00:00+03:00";
    const oldSpawner = ScriptedSpawner.make((_command, args) =>
      scenario === "failure"
        ? { exit: 1 }
        : { stdout: args[0] === "remote" ? "git@github.com:example/repo.git" : scenario === "empty-log" ? "" : stamp }
    );
    const newSpawner = ScriptedSpawner.make((_command, args) =>
      scenario === "failure"
        ? { exit: 1 }
        : {
            stdout: A.contains(args, "remote")
              ? "git@github.com:example/repo.git"
              : scenario === "empty-log"
                ? ""
                : `\0abc\0${stamp}\0${stamp}\0Ada\0ada@example.com\0subject\0`,
          }
    );
    const old = yield* oldInspectClone(directory).pipe(provideSpawner(oldSpawner));
    const current = yield* inspectClone(directory).pipe(provideSpawner(newSpawner));
    rows.push(
      row("B83", scenario, old.remoteUrl, current.remoteUrl, "Git.remoteUrl keeps unavailable remote facts absent.")
    );
    rows.push(
      row(
        "B84",
        scenario,
        old.lastCommitIso,
        current.lastCommitIso,
        "Git.log committedAt renders the same instant in UTC Z instead of the committer offset."
      )
    );
  }
  for (const scenario of ["happy", "failure", "pagination", "decode"]) {
    const count = scenario === "pagination" ? 2 : 1;
    const star = {
      full_name: "example/repo",
      html_url: "https://github.com/example/repo",
      description: null,
      language: null,
      topics: [],
    };
    const body = scenario === "decode" ? { malformed: true } : star;
    const output = yield* json(body);
    const oldSpawner = ScriptedSpawner.make(() =>
      scenario === "failure" ? { exit: 1 } : { stdout: A.join(A.replicate(output, count), "\n") }
    );
    const old = yield* capture(oldStars(directory)).pipe(provideSpawner(oldSpawner));
    const transport = completionFetch((url) =>
      scenario === "failure"
        ? { status: 403, body: { message: "Forbidden" } }
        : { body: [body], next: count === 2 && !url.searchParams.has("page") }
    );
    const current = yield* capture(listStarredRepos(directory)).pipe(
      Effect.provideService(GithubTransportFetch, O.some(transport.fetch)),
      provideSpawner(ScriptedSpawner.make(() => ({ stdout: "fixture-token" })))
    );
    rows.push(
      row(
        "B85",
        scenario,
        old,
        current,
        scenario === "decode" ? "Wire schema rejection preserves the typed ResearchCommandError boundary." : kitFailure
      )
    );
  }
  return rows;
}).pipe(Effect.scoped, Effect.provide(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)), Effect.orDie);
