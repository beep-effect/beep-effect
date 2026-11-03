/**
 * W6 differential: the Yeet `gh` sites W4 deferred, on `@beep/github`, against the `gh`-CLI bodies they replace.
 *
 * W6 of `goals/repo-cli-gh-git-consolidation` moves the pull request lookup, default branch, create, title and label
 * calls of `PullRequest`, the body reads and write of `ProvenanceFooter`, the review window reads of `ReviewWindow`,
 * the job list, job log fallback, rerun and committer-date reads of `MonitorLoop`, and the acting-login and comment
 * reads of `MonitorComments` onto `GithubRest`, `GitHubRepository`, the kit's `PullRequest` and `GitHubClient`
 * (SPEC D-15). The pre-W6 bodies are frozen under `ops/frozen-w6/`, copied from the lane base 641180ade6 with only
 * import paths and the identity namespace changed (the `MonitorLoop` copy holds only its `gh` bodies).
 *
 * Both sides read ONE fixture world per scenario: a REST route table plus the few `gh` CLI answers that have no REST
 * twin (`gh pr create`, `gh pr edit`, `gh pr view`, `gh run view --log-failed`). The frozen bodies run over a
 * scripted spawner that renders each `gh api` call against the world, applying the call's own `--jq` filter (a
 * TypeScript transcription of each filter the frozen bodies pass, listed in `jqFilters`); the shipped bodies run the
 * real `@beep/github` client over a `fetch` that answers the same routes, paginated by `per_page` with `Link`
 * headers as GitHub does. `git` answers are scripted identically for both. Each outcome is projected onto what the
 * caller reads; a difference is classified (an intended shift named in D-15, with this scenario as its witness) or
 * unclassified. The gate is zero unclassified.
 *
 * Usage (from the repo root):
 *
 *   bun goals/repo-cli-gh-git-consolidation/ops/yeet-gh-seams-differential-w6.ts [--out <report.json>]
 *
 * Exit code 1 when any gate fails.
 */
import * as NodeFs from "node:fs";
import * as NodeOs from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { Git } from "@beep/git/Git";
import { GitHubClient } from "@beep/github/GitHubClient";
import { GitHubRepository } from "@beep/github/GitHubRepository";
import { PullRequest } from "@beep/github/PullRequest";
import { Repo, RepoRef } from "@beep/github/Repo";
import { RetryPolicy } from "@beep/github/Resilience";
import { ReviewThread } from "@beep/github/ReviewThread";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as TestConsole from "effect/testing/TestConsole";
import { YeetGithubLayer } from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/GhOps.ts";
import { mergeYeetPullRequestAtHead } from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/Merge.ts";
import {
  collectNewYeetMonitorComments,
  openYeetMonitorCommentStream,
  readYeetMonitorActingLogin,
} from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorComments.ts";
import {
  applyYeetMonitorJobDecision,
  collectYeetMonitorFailedJobs,
  emptyYeetMonitorRerunBudget,
  planYeetMonitorReruns,
  readYeetMonitorPushedAt,
  YeetMonitorFailedJob,
} from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts";
import { ensureProvenanceFooter } from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/ProvenanceFooter.ts";
import {
  layerPrSessionRegistryMemory,
  PrSessionRegistry,
} from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/PrSessionRegistry.ts";
import {
  applyHeavyAdmissionLabel,
  ensurePullRequest,
  findOpenPullRequestViaRest,
  YeetEnsuredPullRequest,
} from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/PullRequest.ts";
import {
  readYeetReviewWindow,
  renderYeetReviewWindow,
} from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/ReviewWindow.ts";
import {
  GhPrView,
  layerGithubRest,
  layerGraphqlBudget,
} from "../../../packages/tooling/tool/cli/src/internal/github/index.ts";
import { runRepoCommandCapture } from "../../../packages/tooling/tool/cli/src/internal/repo-run/index.ts";
import {
  RepoPlanStep,
  RepoRunContext,
} from "../../../packages/tooling/tool/cli/src/internal/repo-run/RepoRun.models.ts";
import { makeRecord, repository } from "../../../packages/tooling/tool/cli/test/yeet-pr-fixtures.ts";
import { mergeAtHead as oldMergeAtHead } from "./frozen-w6/Merge.old.ts";
import {
  collectNewYeetMonitorComments as oldCollectNewYeetMonitorComments,
  openYeetMonitorCommentStream as oldOpenYeetMonitorCommentStream,
  readYeetMonitorActingLogin as oldReadYeetMonitorActingLogin,
} from "./frozen-w6/MonitorComments.old.ts";
import {
  applyYeetMonitorJobDecision as oldApplyYeetMonitorJobDecision,
  collectYeetMonitorFailedJobs as oldCollectYeetMonitorFailedJobs,
  readPushedAt as oldReadPushedAt,
} from "./frozen-w6/MonitorLoop.old.ts";
import { ensureProvenanceFooter as oldEnsureProvenanceFooter } from "./frozen-w6/ProvenanceFooter.old.ts";
import {
  YeetEnsuredPullRequest as OldYeetEnsuredPullRequest,
  applyHeavyAdmissionLabel as oldApplyHeavyAdmissionLabel,
  ensurePullRequest as oldEnsurePullRequest,
  findOpenPullRequestViaRest as oldFindOpenPullRequestViaRest,
} from "./frozen-w6/PullRequest.old.ts";
import {
  readYeetReviewWindow as oldReadYeetReviewWindow,
  renderYeetReviewWindow as oldRenderYeetReviewWindow,
} from "./frozen-w6/ReviewWindow.old.ts";
import type { YeetGithubServices } from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/GhOps.ts";
import type { YeetExecutedStep } from "../../../packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts";

const repoRoot = NodeURL.fileURLToPath(new URL("../../..", import.meta.url));
const argv = process.argv.slice(2);
const outIndex = argv.indexOf("--out");
const PR = 7;
const BRANCH = "feat/w6";
const HEAD = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const PR_URL = `https://github.com/beep-effect/beep-effect/pull/${PR}`;

// --- the fixture world ------------------------------------------------------------------------------------------

interface RestAnswer {
  readonly body: unknown;
  readonly status: number;
}
interface World {
  /** The GraphQL body-edit history answer. */
  readonly bodyEdits?: RestAnswer;
  /** `gh pr create` and `gh pr edit` spend GraphQL; when true, both refuse with gh's rate-limit wording. */
  readonly graphqlRateLimited?: boolean;
  /** `gh run view --job <id> --log-failed`. */
  readonly logFailed?: { readonly exit: number; readonly output: string };
  /** `git remote get-url --push origin`. */
  readonly origin?: string;
  /** `gh pr view` (the current-branch read). */
  readonly prView?: { readonly exit: number; readonly output: string };
  /** Successive answers to `GET pulls/{n}` (the last repeats), for a merge GitHub confirms late. */
  readonly pullReads?: ReadonlyArray<RestAnswer>;
  /** `METHOD path` (path relative to the repository, no query) to the REST answer; absent routes are 404. */
  readonly rest: Readonly<Record<string, RestAnswer>>;
}

const ok = (body: unknown): RestAnswer => ({ status: 200, body });
const status = (code: number, message: string): RestAnswer => ({ status: code, body: { message } });

const restPull = (overrides: Readonly<Record<string, unknown>> = {}): Record<string, unknown> => ({
  number: PR,
  node_id: "PR_kw7",
  title: "feat(w6): ship",
  body: "Summary",
  state: "open",
  draft: false,
  merged: false,
  merged_at: null,
  mergeable_state: "clean",
  head: { ref: BRANCH, sha: HEAD },
  base: { ref: "main", sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
  html_url: PR_URL,
  user: { login: "kriegcloud" },
  labels: [],
  created_at: "2026-11-02T09:00:00Z",
  updated_at: "2026-11-02T09:00:00Z",
  ...overrides,
});

// --- the frozen bodies' `gh`: `--jq` filters transcribed, one per filter the frozen bodies pass -------------------

type JsonValue = unknown;
const field = (value: JsonValue, key: string): JsonValue =>
  typeof value === "object" && value !== null ? (value as Record<string, JsonValue>)[key] : undefined;
const list = (value: JsonValue): ReadonlyArray<JsonValue> => (Array.isArray(value) ? value : []);
const text = (value: JsonValue): string =>
  value === null || value === undefined ? "null" : typeof value === "string" ? value : JSON.stringify(value);
const upper = (value: JsonValue): string => (typeof value === "string" ? value.toUpperCase() : text(value));

const jqFilters: Record<string, (value: JsonValue) => string> = {
  "map({number, headRefName: .head.ref, state: (.state | ascii_upcase), url: .html_url, headRefOid: .head.sha, isDraft: .draft, title})":
    (value) =>
      JSON.stringify(
        list(value).map((pull) => ({
          number: field(pull, "number"),
          headRefName: field(field(pull, "head"), "ref"),
          state: upper(field(pull, "state")),
          url: field(pull, "html_url"),
          headRefOid: field(field(pull, "head"), "sha"),
          isDraft: field(pull, "draft"),
          title: field(pull, "title"),
        }))
      ),
  ".default_branch": (value) => text(field(value, "default_branch")),
  ".html_url": (value) => text(field(value, "html_url")),
  ".title": (value) => text(field(value, "title")),
  'map(.name) | join(",")': (value) =>
    list(value)
      .map((label) => text(field(label, "name")))
      .join(","),
  "{body, updatedAt: .updated_at}": (value) =>
    JSON.stringify({ body: field(value, "body") ?? null, updatedAt: field(value, "updated_at") }),
  "{body}": (value) => JSON.stringify({ body: field(value, "body") ?? null }),
  '.[] | select(.event == "ready_for_review" or .event == "head_ref_force_pushed") | [.event, .created_at] | @tsv': (
    value
  ) =>
    list(value)
      .filter(
        (event) => field(event, "event") === "ready_for_review" || field(event, "event") === "head_ref_force_pushed"
      )
      .map((event) => `${text(field(event, "event"))}\t${text(field(event, "created_at"))}`)
      .join("\n"),
  ".check_suites[].created_at": (value) =>
    list(field(value, "check_suites"))
      .map((suite) => text(field(suite, "created_at")))
      .join("\n"),
  ".created_at": (value) => text(field(value, "created_at")),
  ".commit.committer.date": (value) => text(field(field(field(value, "commit"), "committer"), "date")),
  ".login": (value) => text(field(value, "login")),
};

interface GhReply {
  readonly exit: number;
  readonly stdout: string;
}

// The pull request a scenario's create opened (GitHub lists it from then on), and
// the body a scenario's PATCH wrote (GitHub serves it from then on).
let createdPull: O.Option<unknown> = O.none();
let writtenBody: O.Option<string> = O.none();
let pullReadCount = 0;

/** The REST answer for `METHOD path?query` in `world` (the query never selects the answer). */
const restFor = (
  world: World,
  method: string,
  pathWithQuery: string,
  body: O.Option<string> = O.none()
): RestAnswer => {
  const path = pathWithQuery.split("?")[0] ?? "";
  if (method === "GET" && path === "pulls" && O.isSome(createdPull)) return ok([createdPull.value]);
  if (method === "GET" && /^pulls\/\d+$/u.test(path) && world.pullReads !== undefined && world.pullReads.length > 0) {
    const read = world.pullReads[Math.min(pullReadCount, world.pullReads.length - 1)] ?? status(404, "Not Found");
    pullReadCount = pullReadCount + 1;
    return read;
  }
  const answer = world.rest[`${method} ${path}`] ?? status(404, "Not Found");
  if (method === "POST" && path === "pulls" && answer.status < 400) createdPull = O.some(answer.body);
  if (method === "PATCH" && answer.status < 400 && O.isSome(body)) writtenBody = body;
  if (method === "GET" && /^pulls\/\d+$/u.test(path) && answer.status < 400 && O.isSome(writtenBody)) {
    return ok({ ...(answer.body as object), body: writtenBody.value });
  }
  return answer;
};

// The body a frozen PATCH sent: `-F body=@<file>` reads the file, as gh does.
const ghBodyField = (args: ReadonlyArray<string>): O.Option<string> => {
  const arg = args.find((value) => value.startsWith("body=@"));
  return arg === undefined ? O.none() : O.some(NodeFs.readFileSync(arg.slice("body=@".length), "utf8"));
};

/** The first `per_page` items (gh without `--paginate` reads one page). */
const firstPage = (body: JsonValue, perPage: number): JsonValue =>
  Array.isArray(body) ? body.slice(0, perPage) : body;

const ghApi = (world: World, args: ReadonlyArray<string>): GhReply => {
  const rest = args.slice(1);
  const method = rest[0] === "-X" || rest[0] === "--method" ? (rest[1] ?? "GET") : "GET";
  const afterMethod = rest[0] === "-X" || rest[0] === "--method" ? rest.slice(2) : rest;
  const jqIndex = afterMethod.indexOf("--jq");
  const jq = jqIndex === -1 ? undefined : afterMethod[jqIndex + 1];
  const paginate = afterMethod.includes("--paginate");
  const endpoint = afterMethod.find((arg) => arg === "graphql" || arg.startsWith("repos/") || arg === "user") ?? "";
  if (endpoint === "graphql") {
    const answer = world.bodyEdits ?? status(404, "Not Found");
    return answer.status === 200
      ? { exit: 0, stdout: JSON.stringify(answer.body) }
      : { exit: 1, stdout: `gh: ${text(field(answer.body, "message"))} (HTTP ${answer.status})` };
  }
  const path = endpoint === "user" ? "/user" : endpoint.replace(/^repos\/\{owner\}\/\{repo\}\/?/u, "");
  const query = path.split("?")[1] ?? "";
  const perPage = Number(new URLSearchParams(query).get("per_page") ?? "30");
  const answer = restFor(world, method, path, ghBodyField(afterMethod));
  if (answer.status >= 400) {
    return { exit: 1, stdout: `gh: ${text(field(answer.body, "message"))} (HTTP ${answer.status})` };
  }
  // A job log is served as the raw text it is.
  if (typeof answer.body === "string") return { exit: 0, stdout: answer.body };
  const body = paginate ? answer.body : firstPage(answer.body, perPage);
  const slurped = afterMethod.includes("--slurp") ? [body] : body;
  return {
    exit: 0,
    stdout: jq === undefined ? JSON.stringify(slurped) : (jqFilters[jq] ?? (() => `unscripted jq ${jq}`))(body),
  };
};

const ghReply = (world: World, args: ReadonlyArray<string>): GhReply => {
  const [verb, sub] = args;
  if (verb === "api") return ghApi(world, args);
  if (verb === "pr" && sub === "merge") {
    const answer = restFor(world, "PUT", `pulls/${args[2]}/merge`);
    return answer.status >= 400
      ? { exit: 1, stdout: `gh: ${text(field(answer.body, "message"))} (HTTP ${answer.status})` }
      : { exit: 0, stdout: "" };
  }
  if (verb === "pr" && sub === "view" && /^\d+$/u.test(args[2] ?? "")) {
    const answer = restFor(world, "GET", `pulls/${args[2]}`);
    return answer.status >= 400
      ? { exit: 1, stdout: `gh: ${text(field(answer.body, "message"))} (HTTP ${answer.status})` }
      : {
          exit: 0,
          stdout: JSON.stringify({
            number: field(answer.body, "number"),
            headRefName: field(field(answer.body, "head"), "ref"),
            state: field(answer.body, "merged") === true ? "MERGED" : upper(field(answer.body, "state")),
            headRefOid: field(field(answer.body, "head"), "sha"),
          }),
        };
  }
  if (verb === "pr" && sub === "view")
    return world.prView === undefined
      ? { exit: 1, stdout: "no pull requests found" }
      : { exit: world.prView.exit, stdout: world.prView.output };
  if (verb === "pr" && (sub === "create" || sub === "edit")) {
    if (world.graphqlRateLimited === true) return { exit: 1, stdout: "GraphQL: API rate limit exceeded" };
    const answer = sub === "create" ? restFor(world, "POST", "pulls") : restFor(world, "PATCH", `pulls/${PR}`);
    return answer.status >= 400
      ? { exit: 1, stdout: `gh: ${text(field(answer.body, "message"))} (HTTP ${answer.status})` }
      : { exit: 0, stdout: sub === "create" ? `${text(field(answer.body, "html_url"))}\n` : "" };
  }
  if (verb === "run" && args.includes("--log-failed")) {
    return world.logFailed === undefined
      ? { exit: 1, stdout: "run 7 is still in progress" }
      : { exit: world.logFailed.exit, stdout: world.logFailed.output };
  }
  if (verb === "run" && sub === "view") {
    const answer = restFor(world, "GET", `actions/runs/${args[2]}/jobs`);
    return answer.status >= 400
      ? { exit: 1, stdout: `gh: ${text(field(answer.body, "message"))}` }
      : {
          exit: 0,
          stdout: JSON.stringify({
            jobs: list(field(answer.body, "jobs")).map((job) => ({
              databaseId: field(job, "id"),
              name: field(job, "name"),
              status: field(job, "status"),
              conclusion: field(job, "conclusion"),
              steps: list(field(job, "steps")).map((step) => ({
                name: field(step, "name"),
                conclusion: field(step, "conclusion"),
              })),
            })),
          }),
        };
  }
  if (verb === "run" && sub === "rerun") {
    const answer = restFor(world, "POST", `actions/jobs/${args[3]}/rerun`);
    return answer.status >= 400 ? { exit: 1, stdout: "gh: rerun refused" } : { exit: 0, stdout: "" };
  }
  if (verb === "run" && sub === "list") {
    return {
      exit: 0,
      stdout: JSON.stringify([{ databaseId: 7, headSha: HEAD, status: "in_progress", conclusion: null, name: "CI" }]),
    };
  }
  return { exit: 1, stdout: `unscripted gh ${args.join(" ")}` };
};

// `git`, scripted identically for both sides.
const gitReply = (world: World, args: ReadonlyArray<string>): GhReply => {
  const line = args.join(" ");
  if (line.includes("remote get-url --push origin")) {
    return world.origin === undefined ? { exit: 2, stdout: "" } : { exit: 0, stdout: `${world.origin}\n` };
  }
  if (line.includes("merge-base")) return { exit: 0, stdout: "cccccccccccccccccccccccccccccccccccccccc\n" };
  if (line.includes("log --no-merges")) return { exit: 0, stdout: "feat(w6): ship\n" };
  if (line.includes("log --reverse")) return { exit: 0, stdout: "## feat(w6): ship\n\nbody\n" };
  if (line.includes("diff --name-only")) return { exit: 0, stdout: "packages/a/src/index.ts\0" };
  if (line.includes("config --get")) return { exit: 1, stdout: "" };
  return { exit: 0, stdout: "" };
};

const spawnerFor = (world: World) =>
  ScriptedSpawner.make((command, args) => {
    const reply =
      command === "gh" ? ghReply(world, args) : command === "git" ? gitReply(world, args) : { exit: 0, stdout: "" };
    return { stdout: reply.stdout, exit: reply.exit };
  });

// --- the shipped bodies' transport: the same routes over `fetch`, paginated as GitHub does ------------------------

const fetchCalls: Array<string> = [];
let currentWorld: World = { rest: {} };

const tableFetch = Object.assign(
  (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const request = new Request(input instanceof URL ? input.href : input, init);
    const url = new URL(request.url);
    const method = request.method;
    const path = decodeURIComponent(url.pathname);
    return request.text().then((sent) => {
      fetchCalls.push(`${method} ${path}`);
      let answer: RestAnswer;
      if (path === "/graphql") {
        answer = currentWorld.bodyEdits === undefined ? status(404, "Not Found") : currentWorld.bodyEdits;
        // GitHub answers GraphQL inside `data`; the world records the whole document.
      } else {
        const relative = path === "/user" ? "/user" : path.replace(/^\/repos\/beep-effect\/beep-effect\/?/u, "");
        const parsed = sent === "" ? undefined : (JSON.parse(sent) as { readonly body?: unknown });
        answer = restFor(
          currentWorld,
          method,
          relative,
          typeof parsed?.body === "string" ? O.some(parsed.body) : O.none()
        );
      }
      const headers = new Headers({ "content-type": "application/json" });
      let payload = answer.body;
      if (answer.status < 400 && Array.isArray(answer.body) && path !== "/graphql") {
        const perPage = Number(url.searchParams.get("per_page") ?? "30");
        const page = Number(url.searchParams.get("page") ?? "1");
        payload = answer.body.slice((page - 1) * perPage, page * perPage);
        if (page * perPage < answer.body.length) {
          const next = new URL(url.href);
          next.searchParams.set("page", `${page + 1}`);
          headers.set("link", `<${next.href}>; rel="next"`);
        }
      }
      const response =
        answer.status === 204
          ? new Response(null, { status: 204 })
          : new Response(
              typeof payload === "string" && answer.status < 400 && path.endsWith("/logs")
                ? payload
                : JSON.stringify(payload),
              {
                status: answer.status,
                headers:
                  path.endsWith("/logs") && answer.status < 400
                    ? new Headers({ "content-type": "text/plain" })
                    : headers,
              }
            );
      Object.defineProperty(response, "url", { value: url.href });
      return response;
    });
  },
  { preconnect: () => undefined }
);

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
  ),
  Layer.fresh
);

// --- the scratch checkout ------------------------------------------------------------------------------------------

const work = NodeFs.mkdtempSync(NodePath.join(NodeOs.tmpdir(), "w6-yeet-gh-"));
const checkout = NodePath.join(work, "checkout");
NodeFs.mkdirSync(checkout, { recursive: true });
const context = RepoRunContext.make({
  base: "origin/main",
  branch: BRANCH,
  cwd: checkout,
  head: "HEAD",
  originalArgv: [],
  packetDir: NodePath.join(checkout, ".beep/yeet"),
  repoRoot: checkout,
  turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
});

const platform = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, TestConsole.layer);

// --- outcomes ------------------------------------------------------------------------------------------------------

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
  createdPull = O.none();
  writtenBody = O.none();
  pullReadCount = 0;
  fetchCalls.length = 0;
  NodeFs.rmSync(context.packetDir, { recursive: true, force: true });
};

/** Run one side against `world`: its projected value or failure message. */
const side = <A, E, R>(world: World, program: Effect.Effect<A, E, R>, project: (value: A) => unknown) =>
  Effect.sync(() => install(world)).pipe(
    Effect.andThen(
      Effect.exit(
        program.pipe(
          Effect.provide(githubLayer),
          Effect.provideService(YeetGithubLayer, O.some(githubLayer)),
          Effect.provideServiceEffect(Git, Git.make),
          Effect.provide(spawnerFor(world).layer),
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromUnknown({ HOME: work, PWD: checkout })
          )
        ) as Effect.Effect<A, E, Layer.Success<typeof platform>>
      )
    ),
    Effect.map((exit) =>
      Exit.match(exit, {
        onSuccess: (value) => ({ ok: project(value) }),
        onFailure: (cause) => ({ fail: failureText(cause) }),
      })
    )
  );

const compare = Effect.fnUntraced(function* <A, B, E1, E2, R1, R2>(scenario: {
  readonly site: string;
  readonly name: string;
  readonly world: World;
  readonly old: Effect.Effect<A, E1, R1>;
  readonly new: Effect.Effect<B, E2, R2>;
  readonly projectOld: (value: A) => unknown;
  readonly projectNew: (value: B) => unknown;
  /** The D-15 shift this scenario witnesses when the two sides differ. */
  readonly classified?: string;
}) {
  const oldOutcome = yield* side(scenario.world, scenario.old, scenario.projectOld);
  const newOutcome = yield* side(scenario.world, scenario.new, scenario.projectNew);
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

// The D-15 classifications, each witnessed by the scenarios that name it.
const D15 = {
  failureWording:
    "D-15 (b): a GitHub failure keeps the call's label and names the kit's operation, HTTP status and reason where the capture named gh's exit code and output; the exit code is 1.",
  restCreate:
    "D-15 (a): the create is the kit's REST `PullRequest.create` on the one path; the GraphQL `gh pr create` and its rate-limit fallback retire, so the lane records the REST command and the console says `through REST`.",
  allPages:
    "D-15 (c): the kit walks every page where the single `per_page=100` read saw only the first, so a match past the first hundred is found.",
} as const;

// --- worlds --------------------------------------------------------------------------------------------------------

const origin = "git@github.com:beep-effect/beep-effect.git";
const lookupRoute = (pulls: ReadonlyArray<unknown>): Record<string, RestAnswer> => ({ "GET pulls": ok(pulls) });
const createWorld = (overrides: Partial<World> = {}): World => ({
  origin,
  rest: {
    "GET ": ok({ default_branch: "main" }),
    "POST pulls": ok(restPull()),
    "GET pulls": ok([restPull()]),
  },
  ...overrides,
});

const projectView = (
  view: O.Option<{
    readonly number: number;
    readonly url?: string | undefined;
    readonly state: string;
    readonly headRefOid?: string | undefined;
    readonly isDraft?: boolean | undefined;
    readonly title?: string | undefined;
  }>
) =>
  O.match(view, {
    onNone: () => "none",
    onSome: (pull) => ({
      number: pull.number,
      url: pull.url,
      state: pull.state,
      headRefOid: pull.headRefOid,
      isDraft: pull.isDraft,
      title: pull.title,
    }),
  });

const step = (id: string, args: ReadonlyArray<string>) =>
  RepoPlanStep.make({
    args,
    command: "gh",
    cwd: ".",
    id,
    label: id,
    mutability: "write",
    phase: "publish",
    resume: "never",
    scope: "repo",
  });
const createStep = step("publish:02-pr-create", ["pr", "create"]);
const draftStep = step("publish:02-pr-create", ["pr", "create", "--draft"]);
const labelStep = step("publish:pr-ready-for-heavy-label", ["pr", "edit"]);

// The ensured pull request and the lanes the recorder kept, which is what the publish verdict reads.
const ensureWith = <
  Ensured extends { readonly number: number; readonly url: O.Option<string>; readonly created: boolean },
  E,
  R,
>(
  run: (recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>) => Effect.Effect<Ensured, E, R>
) =>
  Effect.gen(function* () {
    const recorder = yield* Ref.make<ReadonlyArray<YeetExecutedStep>>([]);
    const pullRequest = yield* run(recorder);
    const lanes = (yield* Ref.get(recorder)).map((entry) => [
      entry.result.commandText,
      entry.result.exitCode,
      entry.result.output,
    ]);
    return { number: pullRequest.number, url: O.getOrNull(pullRequest.url), created: pullRequest.created, lanes };
  });
const labelWith = <E, R>(run: (recorder: Ref.Ref<ReadonlyArray<YeetExecutedStep>>) => Effect.Effect<void, E, R>) =>
  Effect.gen(function* () {
    const recorder = yield* Ref.make<ReadonlyArray<YeetExecutedStep>>([]);
    yield* run(recorder);
    return (yield* Ref.get(recorder)).map((entry) => [entry.status, entry.result.exitCode, entry.result.output]);
  });

const identity = <A>(value: A): A => value;
const created = YeetEnsuredPullRequest.make({ number: PR, created: true });
const oldCreated = OldYeetEnsuredPullRequest.make({ number: PR, created: true });
const noDiff = { changedPaths: () => Effect.succeed(["packages/a/src/index.ts"]) };

// Provenance: one registry row for the pull request; the body GitHub holds before the stamp.
const provenanceWorld = (body: string, extra: Partial<World> = {}): World => ({
  origin,
  rest: {
    [`GET pulls/${PR}`]: ok(restPull({ number: 42, body, updated_at: "2026-11-02T09:00:00Z" })),
    [`PATCH pulls/${PR}`]: ok(restPull({ number: 42 })),
    "GET pulls/42": ok(restPull({ number: 42, body, updated_at: "2026-11-02T09:00:00Z" })),
    "PATCH pulls/42": ok(restPull({ number: 42 })),
  },
  bodyEdits: ok({ data: { repository: { pullRequest: { userContentEdits: { nodes: [] } } } } }),
  ...extra,
});
const withRegistry = <A, E, R>(use: (registry: PrSessionRegistry["Service"]) => Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const registry = yield* PrSessionRegistry;
    yield* registry.append(makeRecord());
    return yield* use(registry);
  }).pipe(Effect.provide(layerPrSessionRegistryMemory));
const stampProjection = (outcome: { readonly status: string }) => outcome.status;

// Review window worlds.
const windowWorld = (
  timeline: ReadonlyArray<unknown> | RestAnswer,
  suites: ReadonlyArray<string> | RestAnswer,
  createdAt = "2026-11-02T08:00:00Z"
): World => ({
  rest: {
    [`GET issues/${PR}/timeline`]: Array.isArray(timeline) ? ok(timeline) : (timeline as RestAnswer),
    [`GET commits/${HEAD}/check-suites`]: Array.isArray(suites)
      ? ok({ total_count: suites.length, check_suites: suites.map((created_at) => ({ created_at })) })
      : (suites as RestAnswer),
    [`GET pulls/${PR}`]: ok(restPull({ created_at: createdAt })),
  },
});
const ready = (at: string) => ({ event: "ready_for_review", created_at: at });
const forced = (at: string) => ({ event: "head_ref_force_pushed", created_at: at });
// Far past any window, so only a read that resolves its instants can call it elapsed.
const windowEnv = Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({}));

// Monitor job worlds: one in-progress run 7 whose job 991 is red.
const jobsWorld = (
  extra: Partial<World> = {},
  logs: RestAnswer = ok(
    "2026-11-02T00:00:00.1Z ##[group]Run bun test\n2026-11-02T00:00:01.1Z Test timed out in 5000ms\n2026-11-02T00:00:02.1Z ##[error]Process completed with exit code 1."
  )
): World => ({
  rest: {
    "GET actions/runs/7/jobs": ok({
      total_count: 1,
      jobs: [
        {
          id: 991,
          name: "Test Unit",
          status: "completed",
          conclusion: "failure",
          steps: [
            { name: "Set up job", status: "completed", conclusion: "success", number: 1 },
            { name: "Run bun test", status: "completed", conclusion: "failure", number: 2 },
          ],
        },
      ],
    }),
    "GET actions/jobs/991/logs": logs,
    "POST actions/jobs/991/rerun": ok({}),
    [`GET commits/${HEAD}`]: ok({ commit: { committer: { date: "2026-11-02T08:30:00Z" } } }),
    "GET /user": ok({ login: "kriegcloud" }),
  },
  ...extra,
});
const failedJobsProjection = (jobs: ReadonlyArray<YeetMonitorFailedJob>) =>
  jobs.map((job) => [job.databaseId, job.name, O.getOrNull(job.flakeClass), job.logPending, job.runCompleted]);
const rerunDecision = () =>
  planYeetMonitorReruns(emptyYeetMonitorRerunBudget, HEAD, [
    YeetMonitorFailedJob.make({
      databaseId: 991,
      name: "Test Unit",
      flakeClass: O.some("ci-timeout"),
      runCompleted: true,
    }),
  ]).decisions[0]!;
const consoleLines = TestConsole.logLines.pipe(Effect.map((lines) => lines.map(String)));

// Comment worlds: one comment per collection, after the watermark.
const issueComment = (id: number, at: string) => ({
  id,
  body: "Please rebase.",
  created_at: at,
  html_url: `${PR_URL}#issuecomment-${id}`,
  user: { login: "reviewer" },
});
const commentWorld = (issues: ReadonlyArray<unknown>, extra: Readonly<Record<string, RestAnswer>> = {}): World => ({
  rest: {
    [`GET issues/${PR}/comments`]: ok(issues),
    [`GET pulls/${PR}/comments`]: ok([
      {
        id: 11,
        body: "Nit.",
        created_at: "2099-01-01T10:00:00Z",
        html_url: `${PR_URL}#discussion_r11`,
        line: 3,
        original_line: 3,
        path: "src/a.ts",
        user: { login: "reviewer" },
      },
    ]),
    [`GET pulls/${PR}/reviews`]: ok([
      {
        id: 12,
        body: "Looks good.",
        state: "COMMENTED",
        submitted_at: "2099-01-01T10:01:00Z",
        html_url: `${PR_URL}#pullrequestreview-12`,
        commit_id: HEAD,
        user: { login: "reviewer" },
      },
    ]),
    ...extra,
  },
});
const collectWith = <E, R>(
  open: Effect.Effect<Ref.Ref<unknown>, never, R>,
  collect: (
    watermark: Ref.Ref<unknown>
  ) => Effect.Effect<ReadonlyArray<{ readonly id: number; readonly _tag: string }>, E, R>
) => Effect.flatMap(open, collect);

// --- scenarios -----------------------------------------------------------------------------------------------------

const program = Effect.gen(function* () {
  // PullRequest.findOpenPullRequestViaRest: the pushed branch's open pull request.
  for (const [name, world, classified] of [
    ["one open match", { origin, rest: lookupRoute([restPull()]) }, undefined],
    ["no pull request", { origin, rest: lookupRoute([]) }, undefined],
    [
      "closed, foreign head and open match",
      {
        origin,
        rest: lookupRoute([
          restPull({ state: "closed" }),
          restPull({ head: { ref: "feat/other", sha: HEAD } }),
          restPull(),
        ]),
      },
      undefined,
    ],
    ["draft match", { origin, rest: lookupRoute([restPull({ draft: true })]) }, undefined],
    ["lookup refused", { origin, rest: { "GET pulls": status(502, "Bad Gateway") } }, D15.failureWording],
    [
      "match past the first hundred",
      {
        origin,
        rest: lookupRoute([
          ...Array.from({ length: 100 }, (_, index) =>
            restPull({ number: 1000 + index, head: { ref: `feat/other-${index}`, sha: HEAD } })
          ),
          restPull(),
        ]),
      },
      D15.allPages,
    ],
    ["no pushed origin", { rest: lookupRoute([restPull()]) }, undefined],
  ] as const) {
    yield* compare({
      site: "PullRequest.findOpenPullRequestViaRest",
      name,
      world: world as World,
      old: oldFindOpenPullRequestViaRest(context),
      new: findOpenPullRequestViaRest(context),
      projectOld: projectView,
      projectNew: projectView,
      ...(classified === undefined ? {} : { classified }),
    });
  }

  // PullRequest.ensurePullRequest: the create path (default branch, create, the created number and URL, its lane).
  for (const [name, world, prStep, classified] of [
    ["ready create", createWorld(), createStep, D15.restCreate],
    [
      "draft create while GraphQL is rate limited",
      createWorld({
        graphqlRateLimited: true,
        rest: {
          "GET ": ok({ default_branch: "main" }),
          "POST pulls": ok(restPull({ draft: true })),
          "GET pulls": ok([]),
        },
      }),
      draftStep,
      undefined,
    ],
    [
      "default branch names no branch",
      createWorld({ rest: { "GET ": ok({ default_branch: "" }) } }),
      createStep,
      undefined,
    ],
    [
      "default branch read refused",
      createWorld({ rest: { "GET ": status(502, "Bad Gateway") } }),
      createStep,
      D15.failureWording,
    ],
    [
      "create refused",
      createWorld({
        rest: { "GET ": ok({ default_branch: "main" }), "POST pulls": status(422, "A pull request already exists") },
      }),
      createStep,
      D15.failureWording,
    ],
  ] as const) {
    yield* compare({
      site: "PullRequest.ensurePullRequest (create)",
      name,
      world,
      old: ensureWith((recorder) =>
        oldEnsurePullRequest(context, recorder, O.some(prStep), O.none(), { findOpen: () => Effect.succeedNone })
      ),
      new: ensureWith((recorder) =>
        ensurePullRequest(context, recorder, O.some(prStep), O.none(), { findOpen: () => Effect.succeedNone })
      ),
      projectOld: identity,
      projectNew: identity,
      ...(classified === undefined ? {} : { classified }),
    });
  }

  // PullRequest.ensurePullRequest: an existing pull request whose title is a merge-commit subject is renamed.
  const mergeTitle = `Merge remote-tracking branch 'origin/main' into ${BRANCH}`;
  const existing = GhPrView.make({ number: PR, headRefName: BRANCH, state: "OPEN", url: PR_URL, title: mergeTitle });
  for (const [name, world, classified] of [
    ["rename", { origin, rest: { [`PATCH pulls/${PR}`]: ok(restPull()) } }, undefined],
    [
      "rename while GraphQL is rate limited",
      { origin, graphqlRateLimited: true, rest: { [`PATCH pulls/${PR}`]: ok(restPull()) } },
      undefined,
    ],
    [
      "rename refused",
      { origin, rest: { [`PATCH pulls/${PR}`]: status(403, "Resource not accessible") } },
      D15.failureWording,
    ],
  ] as const) {
    yield* compare({
      site: "PullRequest.ensurePullRequest (title)",
      name,
      world: world as World,
      old: ensureWith((recorder) =>
        oldEnsurePullRequest(
          context,
          recorder,
          O.some(createStep),
          O.none(),
          { findOpen: () => Effect.succeedSome(existing) },
          O.some("fix(w6): renamed")
        )
      ),
      new: ensureWith((recorder) =>
        ensurePullRequest(
          context,
          recorder,
          O.some(createStep),
          O.none(),
          { findOpen: () => Effect.succeedSome(existing) },
          O.some("fix(w6): renamed")
        )
      ),
      projectOld: identity,
      projectNew: identity,
      ...(classified === undefined ? {} : { classified }),
    });
  }

  // PullRequest.applyHeavyAdmissionLabel.
  for (const [name, world, classified] of [
    [
      "labelled",
      { rest: { [`POST issues/${PR}/labels`]: ok([{ name: "ready-for-heavy" }, { name: "size/M" }]) } },
      undefined,
    ],
    ["label refused", { rest: { [`POST issues/${PR}/labels`]: status(404, "Label not found") } }, D15.failureWording],
  ] as const) {
    yield* compare({
      site: "PullRequest.applyHeavyAdmissionLabel",
      name,
      world: world as World,
      old: labelWith((recorder) =>
        oldApplyHeavyAdmissionLabel(context, recorder, O.some(labelStep), oldCreated, noDiff)
      ),
      new: labelWith((recorder) => applyHeavyAdmissionLabel(context, recorder, O.some(labelStep), created, noDiff)),
      projectOld: identity,
      projectNew: identity,
      ...(classified === undefined ? {} : { classified }),
    });
  }

  // ProvenanceFooter.ensureProvenanceFooter: the stamp's status (the warnings carry each side's own failure text).
  for (const [name, world] of [
    ["footer missing, written once", provenanceWorld("Summary")],
    ["body read refused", provenanceWorld("Summary", { rest: { "GET pulls/42": status(502, "Bad Gateway") } })],
    ["edit history refused", provenanceWorld("Summary", { bodyEdits: status(502, "Bad Gateway") })],
    [
      "write refused",
      provenanceWorld("Summary", {
        rest: {
          "GET pulls/42": ok(restPull({ number: 42, body: "Summary" })),
          "PATCH pulls/42": status(403, "Resource not accessible"),
        },
      }),
    ],
  ] as const) {
    yield* compare({
      site: "ProvenanceFooter.ensureProvenanceFooter",
      name,
      world,
      old: withRegistry((registry) => oldEnsureProvenanceFooter(context, repository, 42, undefined, registry)),
      new: withRegistry((registry) => ensureProvenanceFooter(context, repository, 42, registry)),
      projectOld: stampProjection,
      projectNew: stampProjection,
    });
  }

  // ReviewWindow.readYeetReviewWindow: the rendered window line.
  const target = { prNumber: PR, headSha: HEAD };
  for (const [name, world, classified] of [
    ["elapsed after the flip", windowWorld([ready("2026-11-02T08:00:00Z")], ["2026-11-02T07:50:00Z"]), undefined],
    [
      "a force-push after the flip",
      windowWorld([ready("2026-11-02T08:00:00Z"), forced("2026-11-02T08:30:00Z")], ["2026-11-02T08:10:00Z"]),
      undefined,
    ],
    ["opened ready", windowWorld([], ["2026-11-02T08:10:00Z"], "2026-11-02T08:05:00Z"), undefined],
    [
      "other timeline events",
      windowWorld(
        [{ event: "labeled", created_at: "2026-11-02T09:00:00Z" }, ready("2026-11-02T08:00:00Z")],
        ["2026-11-02T07:50:00Z"]
      ),
      undefined,
    ],
    ["timeline refused", windowWorld(status(502, "Bad Gateway"), ["2026-11-02T07:50:00Z"]), undefined],
    ["check suites refused", windowWorld([ready("2026-11-02T08:00:00Z")], status(502, "Bad Gateway")), undefined],
    ["no check suite yet", windowWorld([ready("2026-11-02T08:00:00Z")], []), undefined],
    // Both sides fail closed: an event the window counts from without an instant voids the read.
    ["a ready instant that does not parse", windowWorld([ready("not-a-date")], ["2026-11-02T07:50:00Z"]), undefined],
    [
      "a force-push instant that does not parse",
      windowWorld([ready("2026-11-02T08:00:00Z"), forced("not-a-date")], ["2026-11-02T07:50:00Z"]),
      undefined,
    ],
  ] as const) {
    yield* compare({
      site: "ReviewWindow.readYeetReviewWindow",
      name,
      world: world as World,
      old: oldReadYeetReviewWindow(context, target).pipe(Effect.map(oldRenderYeetReviewWindow), windowEnv),
      new: readYeetReviewWindow(target).pipe(Effect.map(renderYeetReviewWindow), windowEnv),
      projectOld: (line: string) => line.replace(/\d+ min left/u, "<n> min left"),
      projectNew: (line: string) => line.replace(/\d+ min left/u, "<n> min left"),
      ...(classified === undefined ? {} : { classified }),
    });
  }

  // Merge: the squash merge pinned to the viewed head and its bounded `MERGED` confirmation.
  const mergedPull = ok(restPull({ state: "closed", merged: true, merged_at: "2026-11-02T10:00:00Z" }));
  const openPull = ok(restPull());
  const mergeAccepted = ok({ merged: true, sha: "dddddddddddddddddddddddddddddddddddddddd", message: "merged" });
  const noWait = { pollAttempts: 1, pollInterval: 0 };
  const mergeRoute = (answer: RestAnswer) => ({ [`PUT pulls/${PR}/merge`]: answer });
  for (const [name, world, classified] of [
    ["merged on the first read", { rest: mergeRoute(mergeAccepted), pullReads: [mergedPull] }, undefined],
    ["merged on the second read", { rest: mergeRoute(mergeAccepted), pullReads: [openPull, mergedPull] }, undefined],
    ["never confirmed", { rest: mergeRoute(mergeAccepted), pullReads: [openPull] }, undefined],
    [
      "head moved",
      { rest: mergeRoute(status(409, "Head branch was modified")), pullReads: [openPull] },
      D15.failureWording,
    ],
    [
      "not mergeable",
      { rest: mergeRoute(status(405, "Pull Request is not mergeable")), pullReads: [openPull] },
      D15.failureWording,
    ],
    [
      "confirmation read refused",
      { rest: mergeRoute(mergeAccepted), pullReads: [status(502, "Bad Gateway")] },
      D15.failureWording,
    ],
  ] as const) {
    yield* compare({
      site: "Merge.mergeYeetPullRequestAtHead",
      name,
      world: world as World,
      old: oldMergeAtHead(context, { number: PR }, { value: HEAD }, noWait),
      new: mergeYeetPullRequestAtHead(PR, HEAD, noWait),
      projectOld: (view: { readonly number: number; readonly state: string }) => [view.number, view.state],
      projectNew: (view: { readonly number: number; readonly state: string }) => [view.number, view.state],
      ...(classified === undefined ? {} : { classified }),
    });
  }

  // MonitorLoop.collectYeetMonitorFailedJobs: the red jobs of the head and how each classifies.
  for (const [name, world] of [
    ["in-progress run, endpoint log classifies", jobsWorld()],
    ["in-progress run, endpoint log refused", jobsWorld({}, status(404, "Not Found"))],
    ["primary log answers", jobsWorld({ logFailed: { exit: 0, output: "Run bun test\tAssertion failed" } })],
    [
      "job list refused",
      { ...jobsWorld(), rest: { ...jobsWorld().rest, "GET actions/runs/7/jobs": status(502, "Bad Gateway") } },
    ],
  ] as const) {
    yield* compare({
      site: "MonitorLoop.collectYeetMonitorFailedJobs",
      name,
      world: world as World,
      old: oldCollectYeetMonitorFailedJobs(context, HEAD),
      new: collectYeetMonitorFailedJobs(context, HEAD),
      projectOld: failedJobsProjection,
      projectNew: failedJobsProjection,
    });
  }

  // MonitorLoop.applyYeetMonitorJobDecision: the rerun and what the operator is told.
  for (const [name, world] of [
    ["rerun accepted", jobsWorld()],
    [
      "rerun refused",
      { ...jobsWorld(), rest: { ...jobsWorld().rest, "POST actions/jobs/991/rerun": status(403, "Forbidden") } },
    ],
  ] as const) {
    yield* compare({
      site: "MonitorLoop.applyYeetMonitorJobDecision",
      name,
      world: world as World,
      old: oldApplyYeetMonitorJobDecision(context, rerunDecision()).pipe(
        Effect.andThen(consoleLines),
        Effect.provide(Layer.fresh(TestConsole.layer))
      ),
      new: applyYeetMonitorJobDecision(rerunDecision()).pipe(
        Effect.andThen(consoleLines),
        Effect.provide(Layer.fresh(TestConsole.layer))
      ),
      projectOld: identity,
      projectNew: identity,
    });
  }

  // MonitorLoop head commit date and MonitorComments acting login.
  for (const [name, world] of [
    ["committer date", jobsWorld()],
    ["commit read refused", { rest: { [`GET commits/${HEAD}`]: status(502, "Bad Gateway") } }],
    [
      "committer date not an instant",
      { rest: { [`GET commits/${HEAD}`]: ok({ commit: { committer: { date: "soon" } } }) } },
    ],
  ] as const) {
    yield* compare({
      site: "MonitorLoop.readPushedAt",
      name,
      world: world as World,
      old: oldReadPushedAt(context, HEAD, runRepoCommandCapture),
      new: readYeetMonitorPushedAt(HEAD),
      projectOld: O.getOrNull,
      projectNew: O.getOrNull,
    });
  }
  for (const [name, world] of [
    ["login", jobsWorld()],
    ["user read refused", { rest: { "GET /user": status(401, "Bad credentials") } }],
    ["a login with whitespace", { rest: { "GET /user": ok({ login: "two words" }) } }],
  ] as const) {
    yield* compare({
      site: "MonitorComments.readYeetMonitorActingLogin",
      name,
      world: world as World,
      old: oldReadYeetMonitorActingLogin(context),
      new: readYeetMonitorActingLogin,
      projectOld: O.getOrNull,
      projectNew: O.getOrNull,
    });
  }

  // MonitorComments.collectNewYeetMonitorComments: the rows past the watermark, in order.
  for (const [name, world, classified] of [
    ["one comment per collection", commentWorld([issueComment(10, "2099-01-01T10:02:00Z")]), undefined],
    [
      "more than one page of issue comments",
      commentWorld(
        Array.from({ length: 105 }, (_, index) =>
          issueComment(
            100 + index,
            `2099-01-01T${String(11 + Math.floor(index / 60)).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}:00Z`
          )
        )
      ),
      undefined,
    ],
    [
      "issue comments refused",
      commentWorld([], { [`GET issues/${PR}/comments`]: status(502, "Bad Gateway") }),
      D15.failureWording,
    ],
  ] as const) {
    yield* compare({
      site: "MonitorComments.collectNewYeetMonitorComments",
      name,
      world: world as World,
      old: collectWith(oldOpenYeetMonitorCommentStream(context, PR) as never, (watermark) =>
        oldCollectNewYeetMonitorComments(context, PR, watermark as never)
      ),
      new: collectWith(openYeetMonitorCommentStream(context, PR) as never, (watermark) =>
        collectNewYeetMonitorComments(context, PR, watermark as never)
      ),
      projectOld: (comments: ReadonlyArray<{ readonly id: number; readonly _tag: string }>) =>
        comments.map((comment) => `${comment._tag}:${comment.id}`),
      projectNew: (comments: ReadonlyArray<{ readonly id: number; readonly _tag: string }>) =>
        comments.map((comment) => `${comment._tag}:${comment.id}`),
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
  schemaVersion: "repo-cli-gh-git-consolidation/yeet-gh-seams-differential-w6/v1",
  base: "641180ade6",
  frozen: "ops/frozen-w6/",
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
NodeFs.rmSync(work, { recursive: true, force: true });
process.stdout.write(`${JSON.stringify(counts)}\n`);
for (const row of rows.filter((entry) => entry.verdict !== "same")) {
  process.stdout.write(
    `${row.verdict} ${row.site} :: ${row.scenario}\n  old ${JSON.stringify(row.old)}\n  new ${JSON.stringify(row.new)}\n`
  );
}
if (counts.unclassified > 0) process.exitCode = 1;
