/**
 * W4 differential: the Yeet review-thread reads, resolutions and REST calls on `@beep/github` against the
 * `gh`-CLI bodies they replace.
 *
 * W4 of `goals/repo-cli-gh-git-consolidation` moves the review-thread reads of `Status`, `WatchMode`, `MergeGate`,
 * `Reply`, `closeout/GhCollect` and `GhOps` onto the kit's `ReviewThread` (`list` / `listByNodeId` / `reply` /
 * `resolve`, `outstanding`), and the merge gate's and squash reader's REST calls onto `GithubRest`,
 * `GitHubRepository` and `GitHubClient` (SPEC D-13). The pre-W4 bodies are frozen under `ops/frozen-w4/`, copied
 * from main 930758e06b with only import paths and the identity namespace changed.
 *
 * Both sides read ONE fixture world per scenario. The frozen bodies spawn a fake `gh` (and a fake `bunx` for the
 * squash commitlint run) placed first on `PATH`; the shipped bodies run the real `@beep/github` client over a
 * `fetch` that answers from the same world, handed to the gh-login surfaces through `YeetGithubLayer` (or provided
 * directly to a read that requires the services). Thread pages are generated once per world in a superset selection
 * every old query and the kit's query decode, so a difference is never a fixture artefact. Each outcome is projected
 * onto what the caller reads (counts, states, ids, messages); a difference is classified (an intended shift named in
 * D-13, with this scenario as its witness) or unclassified. The gate is zero unclassified.
 *
 * Usage (from the repo root):
 *
 *   bun goals/repo-cli-gh-git-consolidation/ops/review-thread-differential-w4.ts [--out <report.json>]
 *
 * Exit code 1 when any gate fails.
 */
import * as NodeFs from "node:fs";
import * as NodeOs from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { Git } from "@beep/git/Git";
import { GitHubClient } from "@beep/github/GitHubClient";
import { GitHubRepository } from "@beep/github/GitHubRepository";
import { PullRequest } from "@beep/github/PullRequest";
import { Repo, RepoRef } from "@beep/github/Repo";
import { RetryPolicy } from "@beep/github/Resilience";
import { outstanding, ReviewThread } from "@beep/github/ReviewThread";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as TestConsole from "effect/testing/TestConsole";
import {
  collectPrCloseoutPayload,
  performCloseoutWriteActions,
} from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/closeout/GhCollect.ts";
import { closeoutWritePlan } from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/closeout/WritePlan.ts";
import { YeetGithubLayer } from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/GhOps.ts";
import {
  executeMergeGate,
  MergeGateMerge,
  readMergeGate,
} from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/MergeGate.ts";
import {
  ReplyDraft,
  ReplyDrafts,
  ReplyDraftsJson,
} from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/Reply.schemas.ts";
import {
  replyDraftsPathForContext,
  runYeetReply,
} from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/Reply.ts";
import { readSquashCommitlintForPullRequest } from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/SquashCommitlint.ts";
import { collectYeetStatus } from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts";
import { collectYeetWatchSnapshot } from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/WatchMode.ts";
import { layerGithubRest, layerGraphqlBudget } from "../../../packages/tooling/tool/cli/src/internal/github/index.ts";
import { RepoRunContext } from "../../../packages/tooling/tool/cli/src/internal/repo-run/RepoRun.models.ts";
import {
  collectPrCloseoutPayload as oldCollectPrCloseoutPayload,
  performCloseoutWriteActions as oldPerformCloseoutWriteActions,
} from "./frozen-w4/GhCollect.old.ts";
import { countOutstandingThreads as oldCountOutstandingThreads } from "./frozen-w4/GhOps.old.ts";
import { readGithubReviewThreads as oldReadGithubReviewThreads } from "./frozen-w4/GithubGraphql.old.ts";
import {
  MergeGateMerge as OldMergeGateMerge,
  executeMergeGate as oldExecuteMergeGate,
  readMergeGate as oldReadMergeGate,
} from "./frozen-w4/MergeGate.old.ts";
import { runYeetReply as oldRunYeetReply } from "./frozen-w4/Reply.old.ts";
import { readSquashCommitlintForPullRequest as oldReadSquashCommitlintForPullRequest } from "./frozen-w4/SquashCommitlint.old.ts";
import { collectYeetStatus as oldCollectYeetStatus } from "./frozen-w4/Status.old.ts";
import { collectYeetWatchSnapshot as oldCollectYeetWatchSnapshot } from "./frozen-w4/WatchMode.old.ts";
import type { YeetGithubServices } from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/GhOps.ts";

const repoRoot = NodeURL.fileURLToPath(new URL("../../..", import.meta.url));
const argv = process.argv.slice(2);
const outIndex = argv.indexOf("--out");
const PR = 7;
const HEAD = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const MERGE_BASE = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const AUTHOR = "kriegcloud";

// --- the fixture world ------------------------------------------------------------------------------------------

interface Comment {
  readonly author: { readonly login: string; readonly bot?: boolean } | null;
  readonly body?: string;
  readonly databaseId?: number | null;
}
interface Thread {
  readonly comments: ReadonlyArray<Comment>;
  readonly id: string;
  readonly isOutdated?: boolean;
  readonly isResolved: boolean;
  readonly line?: number | null;
  readonly resolvedBy?: string | null;
}
interface ThreadPage {
  readonly endCursor: string | null;
  readonly hasNextPage: boolean;
  readonly threads: ReadonlyArray<Thread>;
}
interface World {
  /** Review comments the REST `pulls/{n}/comments` page reports. */
  readonly commentCount?: number;
  readonly commentsStatus?: number;
  readonly commits?: ReadonlyArray<string>;
  readonly compareStatus?: number;
  readonly merge?: { readonly status?: number; readonly body: unknown };
  readonly mutationStatus?: number;
  readonly nodeMissing?: boolean;
  readonly pages: ReadonlyArray<ThreadPage>;
  readonly pull?: Record<string, unknown>;
  readonly pullStatus?: number;
  readonly threadsStatus?: number;
}

const wireComment = (comment: Comment, index: number, threadId: string) => ({
  id: `PRRC_${threadId}_${index}`,
  databaseId: comment.databaseId === undefined ? 1000 + index : comment.databaseId,
  author:
    comment.author === null
      ? null
      : { __typename: comment.author.bot === true ? "Bot" : "User", login: comment.author.login },
  body: comment.body ?? "a review comment",
  path: "src/a.ts",
  line: null,
  originalLine: null,
  createdAt: `2026-11-02T00:00:${String(index).padStart(2, "0")}Z`,
  url: `https://github.com/beep-effect/beep-effect/pull/${PR}#discussion_r${1000 + index}`,
});

// The superset selection: every field any frozen query or the kit's query decodes.
const wireThread = (thread: Thread) => {
  const comments = thread.comments.map((comment, index) => wireComment(comment, index, thread.id));
  return {
    id: thread.id,
    isResolved: thread.isResolved,
    isOutdated: thread.isOutdated ?? false,
    isCollapsed: false,
    path: "src/a.ts",
    line: thread.line === undefined ? 3 : thread.line,
    startLine: null,
    diffSide: "RIGHT",
    resolvedBy: thread.resolvedBy === undefined || thread.resolvedBy === null ? null : { login: thread.resolvedBy },
    comments: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: comments },
    latest: { nodes: comments.slice(-1) },
  };
};

const totalThreads = (world: World): number => world.pages.reduce((sum, page) => sum + page.threads.length, 0);

const wireConnection = (world: World, page: ThreadPage) => ({
  totalCount: totalThreads(world),
  pageInfo: { hasNextPage: page.hasNextPage, endCursor: page.endCursor },
  nodes: page.threads.map(wireThread),
});

/** The page a cursor names: the first page without one, else the page after the one that ended at it. */
const pageAt = (world: World, cursor: string | undefined): ThreadPage | undefined => {
  if (cursor === undefined || cursor === "") return world.pages[0];
  const index = world.pages.findIndex((page) => page.endCursor === cursor);
  return index === -1 ? undefined : (world.pages[index + 1] ?? world.pages[index]);
};

/** A thread page under the root its query selects. */
const threadDocument = (world: World, query: string, cursor: string | undefined): unknown => {
  const page = pageAt(world, cursor) ?? { threads: [], hasNextPage: false, endCursor: null };
  const pullRequest = { author: { login: AUTHOR }, reviewThreads: wireConnection(world, page) };
  return query.includes("node(id")
    ? { data: { node: world.nodeMissing === true ? null : { __typename: "PullRequest", ...pullRequest } } }
    : { data: { repository: { pullRequest } } };
};

const restPull = (world: World) => ({
  number: PR,
  node_id: "PR_kwDOAbC1",
  title: "feat(yeet): move the thread reads onto the kit",
  body: null,
  state: "open",
  draft: false,
  merged: false,
  merged_at: null,
  mergeable_state: "clean",
  head: { ref: "feat/w4", sha: HEAD },
  base: { ref: "main" },
  html_url: `https://github.com/beep-effect/beep-effect/pull/${PR}`,
  user: { login: AUTHOR },
  labels: [{ name: "ready-for-heavy" }],
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
  ...world.pull,
});

const checkRuns = (sha: string) => ({
  total_count: 2,
  check_runs: [
    { id: 11, name: "Lint", status: "completed", conclusion: sha === HEAD ? "success" : "failure" },
    { id: 12, name: "Check", status: "completed", conclusion: "success" },
  ],
});

const prView = {
  id: "PR_kwDOAbC1",
  number: PR,
  url: `https://github.com/beep-effect/beep-effect/pull/${PR}`,
  state: "OPEN",
  isDraft: false,
  isCrossRepository: false,
  mergeable: "MERGEABLE",
  mergeStateStatus: "CLEAN",
  reviewDecision: null,
  headRefOid: HEAD,
  headRefName: "feat/w4",
  labels: [],
  author: { login: AUTHOR },
};

interface Answer {
  readonly body: unknown;
  readonly status: number;
}
const ok = (body: unknown): Answer => ({ status: 200, body });

/** GitHub's answer to one REST route of the world (`path` relative to the repository). */
const restAnswer = (world: World, method: string, path: string): Answer => {
  if (path === `pulls/${PR}`)
    return world.pullStatus === undefined
      ? ok(restPull(world))
      : { status: world.pullStatus, body: { message: "Not Found" } };
  if (path === `pulls/${PR}/comments`)
    return {
      status: world.commentsStatus ?? 200,
      body: Array.from({ length: world.commentCount ?? 0 }, () => ({ id: 1 })),
    };
  if (path === `pulls/${PR}/commits`)
    return ok((world.commits ?? ["feat(yeet): one commit"]).map((message) => ({ commit: { message } })));
  if (path === `pulls/${PR}/merge` && method === "PUT")
    return {
      status: world.merge?.status ?? 200,
      body: world.merge?.body ?? { merged: true, sha: "feedface", message: "merged" },
    };
  if (path.startsWith("compare/"))
    return {
      status: world.compareStatus ?? 200,
      body: { merge_base_commit: { sha: MERGE_BASE }, base_commit: { sha: MERGE_BASE } },
    };
  const runs = /^commits\/([0-9a-f]+)\/check-runs$/u.exec(path);
  if (runs !== null) return ok(checkRuns(runs[1] ?? ""));
  if (path === "" || path === "/")
    return ok({ squash_merge_commit_title: "PR_TITLE", squash_merge_commit_message: "COMMIT_MESSAGES" });
  if (path.startsWith("rules/branches/")) return ok([]);
  return { status: 404, body: { message: "Not Found" } };
};

/** GitHub's answer to one GraphQL document of the world. */
const graphqlAnswer = (world: World, query: string, variables: Record<string, unknown>): Answer => {
  if (query.includes("addPullRequestReviewThreadReply"))
    return world.mutationStatus === undefined
      ? ok({
          data: {
            addPullRequestReviewThreadReply: {
              comment: wireComment({ author: { login: AUTHOR } }, 99, String(variables.threadId)),
            },
          },
        })
      : { status: world.mutationStatus, body: { message: "Resource not accessible by integration" } };
  if (query.includes("resolveReviewThread"))
    return world.mutationStatus === undefined
      ? ok({
          data: {
            result: { thread: { id: variables.threadId, isResolved: true } },
            resolveReviewThread: { thread: { id: variables.threadId, isResolved: true } },
          },
        })
      : { status: world.mutationStatus, body: { message: "Resource not accessible by integration" } };
  if (query.includes("reviewThreads")) {
    if (world.threadsStatus !== undefined) return { status: world.threadsStatus, body: { message: "Bad Gateway" } };
    const cursor = variables.after ?? variables.cursor;
    return ok(threadDocument(world, query, typeof cursor === "string" ? cursor : undefined));
  }
  // The closeout's comment and review pages: empty connections.
  const empty = { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] };
  return ok({ data: { repository: { pullRequest: { comments: empty, reviews: empty } } } });
};

// --- the fake gh and bunx the frozen bodies spawn ------------------------------------------------------------

const FAKE_GH = String.raw`#!/usr/bin/env bun
import { appendFileSync, readFileSync } from "node:fs";
const world = JSON.parse(readFileSync(process.env.W4_WORLD, "utf8"));
const args = process.argv.slice(2);
appendFileSync(process.env.W4_LOG, JSON.stringify(args) + "\n");
const print = (status, body) => {
  if (status >= 400) { process.stderr.write("gh: " + (body?.message ?? "error") + " (HTTP " + status + ")\n"); process.exit(1); }
  process.stdout.write(typeof body === "string" ? body : JSON.stringify(body));
  process.exit(0);
};
if (args[0] === "auth" && args[1] === "token") print(200, "gho_operator");
if (args[0] === "pr" && args[1] === "view") print(200, world.prView);
if (args[0] === "pr" && args[1] === "checks") print(200, "[]");
if (args[0] === "run" && args[1] === "list") print(200, "[]");
if (args[0] === "repo" && args[1] === "view") print(200, { owner: { login: "beep-effect" }, name: "beep-effect" });
if (args[0] !== "api") { process.stderr.write("unscripted gh " + args.join(" ") + "\n"); process.exit(1); }
let method = "GET", endpoint, query, jq, slurp = false;
const vars = {};
for (let i = 1; i < args.length; i++) {
  const a = args[i];
  if (a === "-X" || a === "--method") method = args[++i];
  else if (a === "--jq") jq = args[++i];
  else if (a === "--slurp") slurp = true;
  else if (a === "-f" || a === "-F") {
    const [name, ...rest] = args[++i].split("=");
    const value = rest.join("=");
    if (name === "query") query = value; else vars[name] = value;
  } else if (a === "--paginate" || a === "--silent" || a === "--allow-escape-sequences") {}
  else endpoint = a;
}
const q = query ?? "";
const threadKey = (q.includes("node(id") ? "node" : "repository") + "|" + (vars.cursor ?? "");
const found =
  endpoint !== "graphql" ? world.rest[(method + " " + (endpoint ?? "")).replace(/\?.*$/u, "")]
  : q.includes("addPullRequestReviewThreadReply") ? world.graphql.reply
  : q.includes("resolveReviewThread") ? world.graphql.resolve
  : q.includes("reviewThreads") ? world.graphql.threads[threadKey]
  : world.graphql.other;
if (found === undefined) print(404, { message: "Not Found" });
const status = found.status, body = found.body;
if (status >= 400) print(status, body);
const text = JSON.stringify(slurp ? [body] : body);
if (jq === undefined) print(200, text);
const projected = Bun.spawnSync(["jq", "-rc", jq], { stdin: new TextEncoder().encode(text) });
process.stdout.write(projected.stdout);
process.exit(projected.exitCode);
`;
const FAKE_BUNX = "#!/bin/sh\necho '✔   found 0 problems, 0 warnings'\nexit 0\n";

const work = NodeFs.mkdtempSync(NodePath.join(NodeOs.tmpdir(), "w4-differential-"));
const bin = NodePath.join(work, "bin");
NodeFs.mkdirSync(bin);
NodeFs.writeFileSync(NodePath.join(bin, "gh"), FAKE_GH, { mode: 0o755 });
NodeFs.writeFileSync(NodePath.join(bin, "bunx"), FAKE_BUNX, { mode: 0o755 });
process.env.PATH = `${bin}:${process.env.PATH ?? ""}`;
const worldPath = NodePath.join(work, "world.json");
const logPath = NodePath.join(work, "gh.ndjson");
process.env.W4_WORLD = worldPath;
process.env.W4_LOG = logPath;
process.env.GH_REPO = "beep-effect/beep-effect";
for (const name of [
  "BEEP_GH_TOKEN_REF",
  "BEEP_GH_APP_ID",
  "BEEP_GH_APP_INSTALLATION_ID",
  "BEEP_GH_APP_KEY_REF",
  "GH_TOKEN",
  "GITHUB_TOKEN",
]) {
  delete process.env[name];
}

// A scratch checkout: the status reader inspects its local git state, the closeout and reply writers its packet dir.
const checkout = NodePath.join(work, "checkout");
NodeFs.mkdirSync(checkout);
Bun.spawnSync(["git", "init", "-q", "-b", "feat/w4", checkout]);
Bun.spawnSync([
  "git",
  "-C",
  checkout,
  "-c",
  "user.email=w4@example.test",
  "-c",
  "user.name=w4",
  "commit",
  "-q",
  "--allow-empty",
  "-m",
  "base",
]);

const context = RepoRunContext.make({
  base: "origin/main",
  branch: "feat/w4",
  cwd: checkout,
  head: "HEAD",
  originalArgv: [],
  packetDir: NodePath.join(checkout, ".beep/yeet"),
  repoRoot: checkout,
  turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
});

/** Every GitHub answer of a world, pre-rendered for the fake gh. */
const ghTable = (world: World) => {
  const threads: Record<string, Answer> = {};
  const cursors = ["", ...world.pages.flatMap((page) => (page.endCursor === null ? [] : [page.endCursor]))];
  for (const root of ["node", "repository"] as const) {
    for (const cursor of cursors) {
      threads[`${root}|${cursor}`] = graphqlAnswer(
        world,
        `${root === "node" ? "node(id" : "repository("} reviewThreads`,
        cursor === "" ? {} : { cursor }
      );
    }
  }
  const graphql = {
    reply: graphqlAnswer(world, "addPullRequestReviewThreadReply", { threadId: "PRRT_open" }),
    resolve: graphqlAnswer(world, "resolveReviewThread", { threadId: "PRRT_open" }),
    threads,
    other: graphqlAnswer(world, "comments", {}),
  };
  const rest: Record<string, Answer> = {};
  const routes: ReadonlyArray<readonly [string, string]> = [
    ["GET", `pulls/${PR}`],
    ["GET", `pulls/${PR}/comments`],
    ["GET", `pulls/${PR}/commits`],
    ["PUT", `pulls/${PR}/merge`],
    ["GET", `compare/main...${HEAD}`],
    ["GET", `commits/${HEAD}/check-runs`],
    ["GET", `commits/${MERGE_BASE}/check-runs`],
    ["GET", ""],
    ["GET", "rules/branches/main"],
  ];
  for (const [method, path] of routes) {
    rest[`${method} repos/{owner}/{repo}${path === "" ? "" : `/${path}`}`] = restAnswer(world, method, path);
  }
  rest[`GET repos/{owner}/{repo}/issues/${PR}/timeline`] = ok([]);
  rest[`GET repos/{owner}/{repo}/commits/${HEAD}/check-suites`] = ok({ check_suites: [] });
  rest[`GET repos/beep-effect/beep-effect/commits/${HEAD}/check-runs`] = ok({ total_count: 0, check_runs: [] });
  rest[`GET repos/beep-effect/beep-effect/rules/branches/main`] = ok([]);
  return { prView, graphql, rest };
};

// --- the transport the shipped bodies read through ---------------------------------------------------------------

const fetchCalls: Array<string> = [];
let currentWorld: World = { pages: [] };
const tableFetch = Object.assign(
  (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = init?.method ?? "GET";
    const text = typeof init?.body === "string" ? init.body : "";
    const body = text === "" ? {} : (JSON.parse(text) as { query?: string; variables?: Record<string, unknown> });
    const path = decodeURIComponent(url.pathname);
    const answer =
      path === "/graphql"
        ? graphqlAnswer(currentWorld, body.query ?? "", body.variables ?? {})
        : restAnswer(currentWorld, method, path.replace(/^\/repos\/beep-effect\/beep-effect\/?/u, ""));
    fetchCalls.push(
      path === "/graphql"
        ? `graphql ${(body.query ?? "").includes("node(id") ? "node" : "repository"}`
        : `${method} ${path}`
    );
    const response =
      answer.status === 204
        ? new Response(null, { status: 204 })
        : new Response(JSON.stringify(answer.body), {
            status: answer.status,
            headers: { "content-type": "application/json" },
          });
    Object.defineProperty(response, "url", { value: url.href });
    return Promise.resolve(response);
  },
  { preconnect: () => undefined }
);

// W6 (SPEC D-15) added the kit's `PullRequest` to the Yeet GitHub services.
const githubLayer: Layer.Layer<YeetGithubServices> = Layer.mergeAll(
  layerGithubRest,
  layerGraphqlBudget,
  ReviewThread.layer,
  GitHubRepository.layer,
  PullRequest.layer
).pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      GitHubClient.layerFromToken({ token: Redacted.make("gho_operator"), fetch: tableFetch, retry: RetryPolicy.none }),
      Repo.layer(RepoRef.make({ owner: "beep-effect", repo: "beep-effect" }))
    )
  )
);

const platform = Layer.mergeAll(
  Git.layer.pipe(Layer.provideMerge(NodeServices.layer)),
  NodeCrypto.layer,
  TestConsole.layer
);

// --- outcomes -----------------------------------------------------------------------------------------------------

const failureText = (cause: Cause.Cause<unknown>): string => {
  const error = Cause.squash(cause);
  return error instanceof Error ? error.message : Cause.pretty(cause);
};

interface Row {
  readonly classification?: string;
  readonly new: unknown;
  readonly old: unknown;
  readonly scenario: string;
  readonly site: string;
  readonly verdict: "same" | "classified" | "unclassified";
}
const rows: Array<Row> = [];

const install = (world: World) => {
  currentWorld = world;
  NodeFs.writeFileSync(worldPath, JSON.stringify(ghTable(world)));
  NodeFs.rmSync(logPath, { force: true });
  NodeFs.rmSync(context.packetDir, { recursive: true, force: true });
  fetchCalls.length = 0;
};

/** Run one side against `world`: its projected value or failure message. */
const side = <A, E, R extends Layer.Success<typeof platform> | YeetGithubServices>(
  world: World,
  program: Effect.Effect<A, E, R>,
  project: (value: A) => unknown,
  prepare: Effect.Effect<void, unknown, Layer.Success<typeof platform>> = Effect.void
) =>
  Effect.sync(() => install(world)).pipe(
    Effect.andThen(prepare),
    Effect.andThen(
      Effect.exit(
        program.pipe(
          Effect.provide(githubLayer),
          Effect.provideService(YeetGithubLayer, O.some(githubLayer))
        ) as Effect.Effect<A, E, Layer.Success<typeof platform>>
      )
    ),
    Effect.map((exit) =>
      Exit.match(exit, {
        onSuccess: (value) => ({ ok: project(value) }),
        onFailure: (cause) => ({ fail: failureText(cause) }),
      })
    ),
    Effect.orElseSucceed(() => ({ fail: "prepare failed" }))
  );

const compare = Effect.fnUntraced(function* <A, B, E1, E2, R1, R2>(scenario: {
  readonly site: string;
  readonly name: string;
  readonly world: World;
  readonly old: Effect.Effect<A, E1, R1>;
  readonly new: Effect.Effect<B, E2, R2>;
  readonly projectOld: (value: A) => unknown;
  readonly projectNew: (value: B) => unknown;
  readonly prepare?: Effect.Effect<void, unknown, Layer.Success<typeof platform>>;
  /** The D-13 shift this scenario witnesses when the two sides differ. */
  readonly classified?: string;
}) {
  const oldOutcome = yield* side(scenario.world, scenario.old as never, scenario.projectOld as never, scenario.prepare);
  const newOutcome = yield* side(scenario.world, scenario.new as never, scenario.projectNew as never, scenario.prepare);
  const same = JSON.stringify(oldOutcome) === JSON.stringify(newOutcome);
  rows.push({
    site: scenario.site,
    scenario: scenario.name,
    old: oldOutcome,
    new: newOutcome,
    verdict: same ? "same" : scenario.classified === undefined ? "unclassified" : "classified",
    ...(same || scenario.classified === undefined ? {} : { classification: scenario.classified }),
  });
});

// --- worlds -------------------------------------------------------------------------------------------------------

const human = (login: string): Comment => ({ author: { login } });
const bot = (login: string): Comment => ({ author: { login, bot: true } });
const onePage = (threads: ReadonlyArray<Thread>): ReadonlyArray<ThreadPage> => [
  { threads, hasNextPage: false, endCursor: null },
];

const mixed: ReadonlyArray<Thread> = [
  { id: "PRRT_open", isResolved: false, comments: [human("reviewer")] },
  { id: "PRRT_answered", isResolved: true, resolvedBy: AUTHOR, comments: [human("reviewer"), human(AUTHOR)] },
  { id: "PRRT_followup", isResolved: true, resolvedBy: AUTHOR, comments: [human(AUTHOR), human("reviewer")] },
  { id: "PRRT_ack", isResolved: true, resolvedBy: AUTHOR, comments: [human(AUTHOR), bot("coderabbitai")] },
  { id: "PRRT_reviewer", isResolved: true, resolvedBy: "reviewer", comments: [human(AUTHOR), human("reviewer")] },
  { id: "PRRT_ghost", isResolved: true, resolvedBy: AUTHOR, comments: [human(AUTHOR), { author: null }] },
  { id: "PRRT_outdated", isResolved: false, isOutdated: true, line: null, comments: [bot("greptile-apps")] },
];
const manyThreads = (prefix: string, count: number): ReadonlyArray<Thread> =>
  Array.from({ length: count }, (_, index) => ({
    id: `PRRT_${prefix}${index}`,
    isResolved: false,
    comments: [human("reviewer")],
  }));

const worlds: Record<string, World> = {
  empty: { pages: onePage([]) },
  mixed: { pages: onePage(mixed) },
  twoPages: {
    pages: [
      { threads: manyThreads("a", 100), hasNextPage: true, endCursor: "c1" },
      { threads: mixed, hasNextPage: false, endCursor: "c2" },
    ],
  },
  missingCursor: { pages: [{ threads: mixed, hasNextPage: true, endCursor: null }] },
  emptyCursor: { pages: [{ threads: mixed, hasNextPage: true, endCursor: "" }] },
  repeatedCursor: { pages: [{ threads: mixed, hasNextPage: true, endCursor: "loop" }] },
  threadsDown: { pages: onePage(mixed), threadsStatus: 502 },
  threadsDownWithComments: { pages: onePage(mixed), threadsStatus: 502, commentCount: 1 },
  threadsAndRestDown: { pages: onePage(mixed), threadsStatus: 502, commentsStatus: 502 },
  nodeMissing: { pages: onePage(mixed), nodeMissing: true },
};

// --- the projections ------------------------------------------------------------------------------------------------

const statusProjection = (snapshot: { readonly remote: unknown }) => {
  const remote = snapshot.remote as Record<string, unknown>;
  return {
    available: remote.available,
    unresolved: remote.unresolvedReviewThreadCount,
    unresolvedThreads: remote.unresolvedReviewThreads,
    followUp: remote.followUpThreadCount,
    acknowledged: remote.acknowledgedThreadCount,
    detail: remote.available === true ? undefined : remote.detail,
  };
};
const watchProjection = (snapshot: {
  readonly threads: ReadonlyArray<{ readonly id: string; readonly state: string }>;
  readonly criteria: { readonly threadsResolved: boolean };
}) => ({
  threads: snapshot.threads.map((thread) => `${thread.id}:${thread.state}`),
  threadsResolved: snapshot.criteria.threadsResolved,
});
const gateProjection = (read: {
  readonly headSha: string;
  readonly draft: boolean;
  readonly mergeableState: string;
  readonly labels: ReadonlyArray<string>;
  readonly attributedChecks: ReadonlyArray<string>;
  readonly checkRuns: ReadonlyArray<unknown>;
  readonly unresolvedThreads: O.Option<number>;
  readonly baseRuns: O.Option<{
    readonly mergeBase: { readonly sha: string; readonly checkRuns: ReadonlyArray<unknown> };
  }>;
  readonly squashCommitlint: { readonly message: { readonly header: string; readonly body: string } };
}) => ({
  headSha: read.headSha,
  draft: read.draft,
  mergeableState: read.mergeableState,
  labels: read.labels,
  attributedChecks: read.attributedChecks,
  checkRuns: read.checkRuns.length,
  unresolvedThreads: O.getOrNull(read.unresolvedThreads),
  mergeBase: O.getOrNull(O.map(read.baseRuns, (base) => `${base.mergeBase.sha}:${base.mergeBase.checkRuns.length}`)),
  squash: read.squashCommitlint.message,
});

const drafts = (threadIds: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const json = yield* ReplyDraftsJson.encode(
      ReplyDrafts.make({
        schemaVersion: "yeet-reply-drafts/v1",
        prNumber: PR,
        drafts: threadIds.map((threadId) => ReplyDraft.make({ threadId: O.some(threadId), body: "Fixed in 0123456." })),
      })
    );
    const path = yield* replyDraftsPathForContext(context);
    NodeFs.mkdirSync(NodePath.dirname(path), { recursive: true });
    NodeFs.writeFileSync(path, json);
  });
const replyProjection = (report: {
  readonly outcomes: ReadonlyArray<{ readonly status: string; readonly threadId: O.Option<string> }>;
}) => report.outcomes.map((outcome) => `${O.getOrElse(outcome.threadId, () => "-")}:${outcome.status}`);

const closeoutProjection = (payload: {
  readonly pullRequest: {
    readonly reviewThreads: {
      readonly nodes: ReadonlyArray<{
        readonly id: string;
        readonly isResolved: boolean;
        readonly comments: {
          readonly nodes: ReadonlyArray<{ readonly id: string; readonly author: { readonly login: string } | null }>;
        };
        readonly latest?: {
          readonly nodes: ReadonlyArray<{
            readonly author?: { readonly login: string; readonly __typename?: string } | null | undefined;
          }>;
        };
      }>;
    };
  };
}) =>
  payload.pullRequest.reviewThreads.nodes.map((thread) => ({
    id: thread.id,
    isResolved: thread.isResolved,
    comments: thread.comments.nodes.map((comment) => `${comment.id}:${comment.author?.login ?? "-"}`),
    latest: (thread.latest?.nodes ?? []).map(
      (comment) => `${comment.author?.login ?? "-"}:${comment.author?.__typename === "Bot" ? "bot" : "user"}`
    ),
  }));

const decision = {
  prNumber: PR,
  headSha: HEAD,
  commitTitle: `feat(yeet): move the thread reads onto the kit (#${PR})`,
  windowAgeSeconds: 1260,
  tolerated: [],
  relaxed: false,
  atMerge: [],
};

// --- the scenarios --------------------------------------------------------------------------------------------------

const D13 = {
  pagingDecode:
    "D-13 (a): a malformed thread page (no cursor, an empty cursor, a repeated cursor) is the kit's typed decode failure; the message names the kit's reason after the site's own decode prefix",
  watchNullNode: "D-13 (b): the watch reads a node that is not a pull request as no threads, as before; no shift",
  gateAllPages:
    "D-13 (c): the merge gate walks every thread page, so more than 100 threads is a real count where the single first:100 read was unknown",
  gateThreadsFail: "D-13 (c): a failed thread read is still an unknown count",
  failureWording:
    "D-13 (d): a GitHub failure names the kit's operation, HTTP status and reason after the call's label, where the capture named gh's exit and stderr",
  statusRestFallback:
    "D-13 (e): the status REST fallback reads hasReviewComments through the kit; a transport failure keeps its label and the fallback wording",
  replyReport: "D-13 (d): a refused reply mutation keeps its failed outcome; only the detail wording follows the kit",
} as const;

const program = Effect.gen(function* () {
  // GhOps (`yeet gh merge-gate`): the outstanding count over the same pages.
  for (const name of ["empty", "mixed", "twoPages", "missingCursor", "repeatedCursor"] as const) {
    yield* compare({
      site: "GhOps.readOutstandingThreads",
      name,
      world: worlds[name] as World,
      old: oldReadGithubReviewThreads(PR).pipe(Effect.map(oldCountOutstandingThreads)),
      new: ReviewThread.use((threads) => threads.list(PR)).pipe(Effect.map(outstanding)),
      projectOld: (count: number) => count,
      projectNew: (count: number) => count,
      ...(name === "missingCursor" || name === "repeatedCursor" ? { classified: D13.pagingDecode } : {}),
    });
  }
  // Status (#78): the remote thread gate, end to end.
  for (const name of [
    "empty",
    "mixed",
    "twoPages",
    "missingCursor",
    "emptyCursor",
    "repeatedCursor",
    "threadsDown",
    "threadsDownWithComments",
    "threadsAndRestDown",
  ] as const) {
    yield* compare({
      site: "Status.collectRemoteReviewThreads",
      name,
      world: worlds[name] as World,
      old: oldCollectYeetStatus(context, true),
      new: collectYeetStatus(context, true),
      projectOld: statusProjection,
      projectNew: statusProjection,
      ...(name === "missingCursor" || name === "emptyCursor" || name === "repeatedCursor"
        ? { classified: D13.pagingDecode }
        : name === "threadsDownWithComments" || name === "threadsAndRestDown"
          ? { classified: D13.statusRestFallback }
          : {}),
    });
  }
  // WatchMode (#79): the thread states one poll reads.
  for (const name of [
    "empty",
    "mixed",
    "twoPages",
    "missingCursor",
    "emptyCursor",
    "threadsDown",
    "nodeMissing",
  ] as const) {
    yield* compare({
      site: "WatchMode.reviewThreadsRead",
      name,
      world: worlds[name] as World,
      old: oldCollectYeetWatchSnapshot(context),
      new: collectYeetWatchSnapshot(context),
      projectOld: watchProjection,
      projectNew: watchProjection,
      ...(name === "missingCursor" || name === "emptyCursor"
        ? { classified: D13.pagingDecode }
        : name === "threadsDown"
          ? { classified: D13.failureWording }
          : {}),
    });
  }
  // MergeGate (#80): the one read the gate decides on, and the merge PUT.
  for (const [name, world, classified] of [
    ["empty", worlds.empty, undefined],
    ["mixed", worlds.mixed, undefined],
    ["more than 100 threads", worlds.twoPages, D13.gateAllPages],
    ["thread read fails", worlds.threadsDown, undefined],
    ["compare fails", { ...worlds.mixed, compareStatus: 500 }, undefined],
    ["pull request missing", { ...worlds.mixed, pullStatus: 404 }, D13.failureWording],
    [
      "a body with an inherited-reds record",
      {
        ...worlds.mixed,
        pull: {
          body: `<!-- yeet-inherited-reds:start -->\n## Inherited reds (S11) at ${HEAD.slice(0, 10)}\n\n- \`Lint\`: red on main\n<!-- yeet-inherited-reds:end -->\n`,
        },
      },
      undefined,
    ],
  ] as const) {
    yield* compare({
      site: "MergeGate.readMergeGate",
      name,
      world: world as World,
      old: oldReadMergeGate(context, PR),
      new: readMergeGate(context, PR),
      projectOld: gateProjection,
      projectNew: gateProjection,
      ...(classified === undefined ? {} : { classified }),
    });
  }
  for (const [name, world, classified] of [
    ["merged", worlds.empty, undefined],
    [
      "declined",
      { ...worlds.empty, merge: { body: { merged: false, sha: "", message: "Head branch was modified" } } },
      undefined,
    ],
    [
      "refused with 409",
      { ...worlds.empty, merge: { status: 409, body: { message: "Head branch was modified" } } },
      D13.failureWording,
    ],
  ] as const) {
    yield* compare({
      site: "MergeGate.executeMergeGate",
      name,
      world: world as World,
      old: oldExecuteMergeGate(context, OldMergeGateMerge.make(decision)),
      new: executeMergeGate(MergeGateMerge.make(decision)),
      projectOld: (merged: { readonly mergeSha: string }) => merged.mergeSha,
      projectNew: (merged: { readonly mergeSha: string }) => merged.mergeSha,
      ...(classified === undefined ? {} : { classified }),
    });
  }
  // SquashCommitlint (#250): the predicted squash message for a pull request known by number.
  for (const [name, world] of [
    ["one commit", worlds.empty],
    ["two commits", { ...worlds.empty, commits: ["feat(a): one", "fix(b): two\n\nBody."] }],
  ] as const) {
    yield* compare({
      site: "SquashCommitlint.readSquashCommitlintForPullRequest",
      name,
      world: world as World,
      old: oldReadSquashCommitlintForPullRequest(context, PR),
      new: readSquashCommitlintForPullRequest(context, PR),
      projectOld: (report: { readonly message: unknown }) => report.message,
      projectNew: (report: { readonly message: unknown }) => report.message,
    });
  }
  // Reply (#82): one reply pass, its outcomes.
  for (const [name, world, ids, classified] of [
    ["open and answered threads", worlds.mixed, ["PRRT_open", "PRRT_answered", "PRRT_followup"], undefined],
    ["a refused reply", { ...worlds.mixed, mutationStatus: 403 }, ["PRRT_open"], undefined],
    ["thread page down", worlds.threadsDown, ["PRRT_open"], D13.failureWording],
  ] as const) {
    yield* compare({
      site: "Reply.runYeetReply",
      name,
      world: world as World,
      prepare: drafts(ids),
      old: oldRunYeetReply(context),
      new: runYeetReply(context),
      projectOld: replyProjection,
      projectNew: replyProjection,
      ...(classified === undefined ? {} : { classified }),
    });
  }
  // closeout/GhCollect (#81): the review threads the closeout triage reads, and its writes.
  for (const [name, world] of [
    ["mixed", worlds.mixed],
    ["two pages", worlds.twoPages],
  ] as const) {
    yield* compare({
      site: "GhCollect.collectPrCloseoutPayload",
      name,
      world: world as World,
      old: oldCollectPrCloseoutPayload(context),
      new: collectPrCloseoutPayload(context),
      projectOld: closeoutProjection,
      projectNew: closeoutProjection,
    });
  }
  const intents = closeoutWritePlan({
    knownThreadIds: ["PRRT_open"],
    replyBody: "Fixed in 0123456.",
    replyThread: "PRRT_open",
    resolveThreads: "PRRT_open",
  }).intents;
  for (const [name, world, classified] of [
    ["reply and resolve", worlds.mixed, undefined],
    ["refused", { ...worlds.mixed, mutationStatus: 403 }, D13.failureWording],
  ] as const) {
    yield* compare({
      site: "GhCollect.performCloseoutWriteActions",
      name,
      world: world as World,
      old: oldPerformCloseoutWriteActions(context, intents),
      new: performCloseoutWriteActions(intents),
      projectOld: (actions: ReadonlyArray<{ readonly kind: string; readonly ok: boolean }>) =>
        actions.map((action) => `${action.kind}:${action.ok}`),
      projectNew: (actions: ReadonlyArray<{ readonly kind: string; readonly ok: boolean }>) =>
        actions.map((action) => `${action.kind}:${action.ok}`),
      ...(classified === undefined ? {} : { classified }),
    });
  }
});

await Effect.runPromise(program.pipe(Effect.provide(platform)) as Effect.Effect<void>);

const counts = {
  scenarios: rows.length,
  same: rows.filter((row) => row.verdict === "same").length,
  classified: rows.filter((row) => row.verdict === "classified").length,
  unclassified: rows.filter((row) => row.verdict === "unclassified").length,
};
const report = {
  schemaVersion: "repo-cli-gh-git-consolidation/review-thread-differential-w4/v1",
  base: "930758e06b",
  frozen: "ops/frozen-w4/",
  counts,
  rows,
};
const outPath = outIndex === -1 ? undefined : argv[outIndex + 1];
if (outPath !== undefined) {
  // The scratch root is a per-run temporary path; the report names it by role so the file is stable and portable.
  NodeFs.writeFileSync(
    NodePath.resolve(repoRoot, outPath),
    `${JSON.stringify(report, null, 2).split(work).join("<scratch>")}\n`
  );
}
process.stdout.write(`${JSON.stringify(counts)}\n`);
for (const row of rows.filter((entry) => entry.verdict !== "same")) {
  process.stdout.write(
    `${row.verdict} ${row.site} :: ${row.scenario}\n  old ${JSON.stringify(row.old)}\n  new ${JSON.stringify(row.new)}\n`
  );
}
NodeFs.rmSync(work, { recursive: true, force: true });
process.exit(counts.unclassified === 0 ? 0 : 1);
