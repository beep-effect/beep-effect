/**
 * W3 differential: the Reviewer and Ci GitHub access paths on `@beep/github` and `@beep/commands`, against the
 * hand-rolled bodies they replace.
 *
 * W3 of `goals/repo-cli-gh-git-consolidation` moves: the reviewer App token exchange onto `GitHubApp` (down-scoped
 * request, `assertPermissions` on the first mint, `clientLayer` with a five-minute refresh skew); the reviewer
 * publishing calls onto `GitHubClient`/`PullRequest`/`PullRequestComment`; ruleset administration and the merge gate
 * from raw `gh api` onto a `GitHubClient` built from the operator's `gh auth token`; the `gh auth token` / `op read`
 * secret reads onto `@beep/commands` `Run.text` and the origin lookup onto `Git.remoteUrl`; the Ci `gh api` reader
 * (lane timings, runner-loss rerun, governance) onto `GitHubClient.requestDecoded` with the transient decision table
 * kept, and `gh run rerun --job` onto `POST /actions/jobs/{id}/rerun`. SPEC D-12 records the switch.
 *
 * The pre-W3 bodies are frozen under `ops/frozen-w3/` (verbatim from main 12ececd3b7 except for import paths and the
 * identity namespace). Both sides answer from ONE fixture table: the old bodies spawn a fake `gh`/`op` that this
 * script writes onto `PATH` (it applies each `--jq` projection with the real `jq`, as `gh` does), the new bodies
 * reach the same table through the `@beep/github` transport's `fetch`. Every row compares the normalized outcome
 * (value or failure message) and the normalized GitHub calls; a difference is classified (named in D-12 with this
 * witness) or unclassified, and the gate is zero unclassified.
 *
 * Usage (from the repo root):
 *
 *   bun goals/repo-cli-gh-git-consolidation/ops/reviewer-ci-github-differential-w3.ts [--out <report.json>]
 *
 * Exit code 1 when any gate fails.
 */
import * as NodeFs from "node:fs";
import * as NodeOs from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { Git } from "@beep/git/Git";
import { GitHubClient } from "@beep/github/GitHubClient";
import { Repo, RepoRef } from "@beep/github/Repo";
import { ActionOutputs } from "@beep/github-actions/ActionOutputs";
import { NodeCrypto, NodeRuntime, NodeServices } from "@effect/platform-node";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";
import {
  GithubPolicyClient,
  GithubPolicyClientLive,
} from "../../../packages/tooling/tool/cli/src/commands/Ci/CiGovernance.ts";
import {
  CiRerunRunnerLossInput,
  runCiRerunRunnerLoss,
} from "../../../packages/tooling/tool/cli/src/commands/Ci/CiRerunRunnerLoss.ts";
import { CiWorkflowJobsPage, ghApiJson } from "../../../packages/tooling/tool/cli/src/commands/Ci/LaneTimings.ts";
import {
  GitHubAppAuth,
  loadReviewerCredentials,
  makeGitHubAppAuth,
} from "../../../packages/tooling/tool/cli/src/commands/Reviewer/GitHubAppAuth.ts";
import {
  ReviewerAnnotation,
  ReviewerCredentials,
  ReviewerResult,
  ReviewerReview,
} from "../../../packages/tooling/tool/cli/src/commands/Reviewer/ReviewerModels.ts";
import {
  enforceReviewerGate,
  releaseReviewerRuleset,
  reviewerCheckExternalId,
  withReviewerOperatorClient,
} from "../../../packages/tooling/tool/cli/src/commands/Reviewer/ReviewerRuleset.ts";
import { Reviewer, ReviewerLive } from "../../../packages/tooling/tool/cli/src/commands/Reviewer/ReviewerService.ts";
import {
  GithubClientRequest,
  GithubIdentity,
  layerGithubClientFor,
  layerGithubRepoFor,
} from "../../../packages/tooling/tool/cli/src/internal/github/GithubIdentity.ts";
import { makeClient as oldGovernanceClient } from "./frozen-w3/CiGovernance.old.ts";
import {
  CiRerunRunnerLossInput as OldCiRerunRunnerLossInput,
  runCiRerunRunnerLoss as oldRunCiRerunRunnerLoss,
} from "./frozen-w3/CiRerunRunnerLoss.old.ts";
import {
  GitHubAppAuth as OldGitHubAppAuth,
  loadReviewerCredentials as oldLoadReviewerCredentials,
  makeGitHubAppAuth as oldMakeGitHubAppAuth,
} from "./frozen-w3/GitHubAppAuth.old.ts";
import {
  GithubClientRequest as OldGithubClientRequest,
  GithubIdentity as OldGithubIdentity,
  layerGithubClientFor as oldLayerGithubClientFor,
  layerGithubRepoFor as oldLayerGithubRepoFor,
} from "./frozen-w3/GithubIdentity.old.ts";
import { ghApiJson as oldGhApiJson } from "./frozen-w3/LaneTimings.old.ts";
import {
  enforceReviewerGate as oldEnforceReviewerGate,
  releaseReviewerRuleset as oldReleaseReviewerRuleset,
} from "./frozen-w3/ReviewerRuleset.old.ts";
import { Reviewer as OldReviewer, ReviewerLive as OldReviewerLive } from "./frozen-w3/ReviewerService.old.ts";

const repoRoot = NodeURL.fileURLToPath(new URL("../../..", import.meta.url));
const argv = process.argv.slice(2);
const outIndex = argv.indexOf("--out");

// --- one fixture table, two transports ---------------------------------------------------------------------------

/** One recorded GitHub answer. `failTimes` failures (an HTTP status or a broken connection) precede it. */
interface Route {
  readonly body?: unknown;
  readonly failReason?: string;
  readonly failStatus?: number;
  readonly failTimes?: number;
  readonly status?: number;
}
interface Table {
  readonly op?: Record<string, string>;
  readonly routes: Record<string, Route>;
  readonly token?: { readonly exit: number; readonly stdout: string };
}

/**
 * The key both transports file a call under: `METHOD path?query`, with the repository spelled
 * `repos/{owner}/{repo}`, `per_page` and `page=1` dropped and the remaining parameters sorted, because `gh` and
 * octokit spell the same request with different pagination noise.
 */
const routeKey = (method: string, endpoint: string): string => {
  const [path = "", query = ""] = endpoint.replace(/^\//u, "").split("?");
  const params = query
    .split("&")
    .filter((pair) => pair !== "" && !pair.startsWith("per_page=") && pair !== "page=1")
    .sort();
  return `${method} ${path.replace(/^repos\/beep-effect\/beep-effect/u, "repos/{owner}/{repo}")}${params.length === 0 ? "" : `?${params.join("&")}`}`;
};

// The fake `gh` and `op` the frozen bodies spawn. Same key rules as `routeKey`; `--jq` runs through the real `jq`.
const FAKE_GH = String.raw`#!/usr/bin/env bun
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
const table = JSON.parse(readFileSync(process.env.W3_TABLE, "utf8"));
const log = (entry) => appendFileSync(process.env.W3_LOG, JSON.stringify(entry) + "\n");
const routeKey = (method, endpoint) => {
  const [path = "", query = ""] = endpoint.replace(/^\//u, "").split("?");
  const params = query.split("&").filter((p) => p !== "" && !p.startsWith("per_page=") && p !== "page=1").sort();
  return method + " " + path.replace(/^repos\/beep-effect\/beep-effect/u, "repos/{owner}/{repo}") + (params.length === 0 ? "" : "?" + params.join("&"));
};
const args = process.argv.slice(2);
if (args[0] === "auth" && args[1] === "token") {
  const token = table.token ?? { exit: 0, stdout: "gho_operator\n" };
  if (token.exit !== 0) process.exit(token.exit);
  process.stdout.write(token.stdout);
  process.exit(0);
}
let method = "GET", jq, endpoint, body, slurp = false;
const fields = [];
if (args[0] === "run" && args[1] === "rerun") {
  method = "POST";
  endpoint = "repos/{owner}/{repo}/actions/jobs/" + args[3] + "/rerun";
} else {
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a === "-X" || a === "--method") method = args[++i];
    else if (a === "--jq") jq = args[++i];
    else if (a === "--input") { i++; body = JSON.parse(readFileSync(0, "utf8")); }
    else if (a === "-f") fields.push(args[++i]);
    else if (a === "--slurp") slurp = true;
    else if (a === "--paginate" || a === "-i") {}
    else endpoint = a;
  }
  if (fields.length > 0) {
    if (method === "GET") method = "POST";
    body = {};
    for (const field of fields) {
      const [name, value] = field.split("=");
      if (name.endsWith("[]")) (body[name.slice(0, -2)] ??= []).push(value);
      else body[name] = value;
    }
  }
}
const key = routeKey(method, endpoint);
// gh authenticates every call with its own login token.
log({ key: key + " as " + (table.token?.stdout ?? "gho_operator\n").trim(), body: body ?? null });
const route = table.routes[key];
if (route === undefined) { process.stderr.write("gh: Not Found (HTTP 404)\n"); process.exit(1); }
const counter = process.env.W3_STATE + "/" + Buffer.from(key).toString("hex");
const seen = existsSync(counter) ? Number(readFileSync(counter, "utf8")) : 0;
writeFileSync(counter, String(seen + 1));
if (seen < (route.failTimes ?? 0)) {
  if (route.failStatus === undefined) process.stderr.write("error connecting to api.github.com: " + route.failReason + "\n");
  else process.stderr.write("gh: " + route.failReason + " (HTTP " + route.failStatus + ")\n");
  process.exit(1);
}
const status = route.status ?? 200;
if (status >= 400) { process.stderr.write("gh: " + (route.body?.message ?? "error") + " (HTTP " + status + ")\n"); process.exit(1); }
if (args[0] === "run") { process.stdout.write("✓ Requested rerun\n"); process.exit(0); }
const text = JSON.stringify(slurp ? [route.body ?? null] : (route.body ?? null));
if (jq === undefined) { process.stdout.write(text); process.exit(0); }
const projected = Bun.spawnSync(["jq", "-rc", jq], { stdin: new TextEncoder().encode(text) });
process.stdout.write(projected.stdout);
process.exit(projected.exitCode);
`;
const FAKE_OP = String.raw`#!/usr/bin/env bun
import { readFileSync } from "node:fs";
const table = JSON.parse(readFileSync(process.env.W3_TABLE, "utf8"));
const args = process.argv.slice(2).filter((a) => a !== "--no-newline");
const value = args[0] === "read" ? table.op?.[args[1]] : undefined;
if (value === undefined) { process.stderr.write("[ERROR] could not read secret\n"); process.exit(1); }
process.stdout.write(value);
`;

const work = NodeFs.mkdtempSync(NodePath.join(NodeOs.tmpdir(), "w3-differential-"));
const bin = NodePath.join(work, "bin");
NodeFs.mkdirSync(bin);
NodeFs.writeFileSync(NodePath.join(bin, "gh"), FAKE_GH, { mode: 0o755 });
NodeFs.writeFileSync(NodePath.join(bin, "op"), FAKE_OP, { mode: 0o755 });
NodeFs.writeFileSync(NodePath.join(bin, "op-doctor"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
process.env.PATH = `${bin}:${process.env.PATH ?? ""}`;
const tablePath = NodePath.join(work, "table.json");
const logPath = NodePath.join(work, "calls.ndjson");
const statePath = NodePath.join(work, "state");
// The fake gh and op find the table, the call log and the failure counters through these.
process.env.W3_TABLE = tablePath;
process.env.W3_LOG = logPath;
process.env.W3_STATE = statePath;
process.env.GH_REPO = "beep-effect/beep-effect";
for (const name of [
  "BEEP_GH_TOKEN_REF",
  "BEEP_GH_APP_ID",
  "BEEP_GH_APP_INSTALLATION_ID",
  "BEEP_GH_APP_KEY_REF",
  "BEEP_REVIEWER_OP_SSH",
  "BEEP_REVIEWER_APP_ID",
  "BEEP_REVIEWER_CLIENT_ID",
  "BEEP_REVIEWER_INSTALLATION_ID",
  "BEEP_REVIEWER_PRIVATE_KEY",
  "GH_TOKEN",
  "GITHUB_TOKEN",
]) {
  delete process.env[name];
}

/** Install a table for the next run and clear the call log and failure counters. */
const install = (table: Table) => {
  NodeFs.writeFileSync(tablePath, JSON.stringify(table));
  NodeFs.rmSync(logPath, { force: true });
  NodeFs.rmSync(statePath, { recursive: true, force: true });
  NodeFs.mkdirSync(statePath);
  fetchCalls.length = 0;
  fetchCounters.clear();
  currentTable = table;
};
const ghCalls = (): ReadonlyArray<string> =>
  NodeFs.existsSync(logPath)
    ? NodeFs.readFileSync(logPath, "utf8")
        .split("\n")
        .filter((line) => line !== "")
        .map((line) => {
          const entry = JSON.parse(line) as { key: string; body: unknown };
          return entry.body === null ? entry.key : `${entry.key} ${JSON.stringify(entry.body)}`;
        })
    : [];

let currentTable: Table = { routes: {} };
const fetchCalls: Array<string> = [];
const fetchCounters = new Map<string, number>();
// The new bodies' transport: the same table, the same keys, answered as GitHub would.
const tableFetch = Object.assign(
  (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = init?.method ?? "GET";
    const key = routeKey(method, `${url.pathname}${url.search}`);
    const text = typeof init?.body === "string" ? init.body : "";
    // The credential a call carried, minus its scheme (`Bearer` by hand, `token` from octokit); an app JWT is
    // fresh on every mint, so it is recorded as `<app-jwt>`.
    const credential = (new Headers(init?.headers).get("authorization") ?? "").replace(/^(Bearer|token) /iu, "");
    const shown = credential === "" ? "" : credential.split(".").length === 3 ? " as <app-jwt>" : ` as ${credential}`;
    fetchCalls.push(`${key}${shown}${text === "" ? "" : ` ${JSON.stringify(JSON.parse(text))}`}`);
    const route = currentTable.routes[key];
    const respond = (status: number, body: unknown) =>
      Promise.resolve(
        Object.defineProperty(
          status === 204
            ? new Response(null, { status })
            : new Response(JSON.stringify(body ?? null), { status, headers: { "content-type": "application/json" } }),
          "url",
          { value: url.href }
        )
      );
    if (route === undefined) return respond(404, { message: "Not Found" });
    const seen = fetchCounters.get(key) ?? 0;
    fetchCounters.set(key, seen + 1);
    if (seen < (route.failTimes ?? 0)) {
      return route.failStatus === undefined
        ? Promise.reject(new TypeError(route.failReason ?? "fetch failed"))
        : respond(route.failStatus, { message: route.failReason });
    }
    return respond(route.status ?? 200, route.body);
  },
  { preconnect: () => undefined }
);
globalThis.fetch = tableFetch;

// --- outcomes ------------------------------------------------------------------------------------------------------

const show = (value: unknown): string =>
  JSON.stringify(value, (_key, item) =>
    Redacted.isRedacted(item) ? `<redacted:${String(Redacted.value(item))}>` : item
  );
const failureText = (cause: Cause.Cause<unknown>): string =>
  Cause.squash(cause) instanceof Error ? (Cause.squash(cause) as Error).message : Cause.pretty(cause);

interface Row {
  readonly new: unknown;
  readonly old: unknown;
  readonly scenario: string;
  readonly site: string;
}
const rows: Array<Row> = [];

const servicesLayer = Layer.provideMerge(Git.layer, Layer.mergeAll(NodeServices.layer, NodeCrypto.layer));
type Services = Layer.Success<typeof servicesLayer>;

/** Run one side against `table`; the outcome is its value or failure message plus the GitHub calls it made. */
const side = <A, E>(table: Table, program: Effect.Effect<A, E, Services>, project: (value: A) => unknown) =>
  Effect.sync(() => install(table)).pipe(
    Effect.andThen(Effect.exit(program)),
    Effect.map((exit) => ({
      outcome: Exit.match(exit, {
        onSuccess: (value) => ({ ok: project(value) }),
        onFailure: (cause) => ({ fail: failureText(cause) }),
      }),
      // Both transports, as one sorted multiset: concurrent reads land in either order, and the
      // suites pin the sequences that matter (the re-read before a PUT, the recheck before completing).
      calls: [...ghCalls(), ...fetchCalls].sort(),
    }))
  );
const compare = <A1, E1, A2, E2>(
  site: string,
  scenario: string,
  table: Table,
  oldProgram: Effect.Effect<A1, E1, Services>,
  newProgram: Effect.Effect<A2, E2, Services>,
  project: (value: A1 | A2) => unknown = (value) => value
) =>
  Effect.gen(function* () {
    const old = yield* side(table, oldProgram, project);
    const fresh = yield* side(table, newProgram, project);
    rows.push({ site, scenario, old, new: fresh });
  });

// Every side runs with the platform services provided once by the runtime edge below.
const run = <A, E, R extends Services>(program: Effect.Effect<A, E, R>) => program;

// --- fixtures ------------------------------------------------------------------------------------------------------

const sha = "a".repeat(40);
const baseSha = "b".repeat(40);
const newerSha = "c".repeat(40);
const job = (id: number, conclusion: string, steps: ReadonlyArray<unknown>, runAttempt = 1) => ({
  completed_at: "2026-10-01T10:10:00Z",
  conclusion,
  created_at: "2026-10-01T10:00:00Z",
  id,
  labels: ["beep-ci-i"],
  name: `Heavy / Job ${id}`,
  run_attempt: runAttempt,
  run_id: 900,
  runner_name: `beep-ci-i-${id}`,
  started_at: "2026-10-01T10:00:30Z",
  status: "completed",
  steps,
  check_run_url: `https://api.github.com/repos/beep-effect/beep-effect/check-runs/${id}`,
  html_url: `https://github.com/beep-effect/beep-effect/actions/runs/900/job/${id}`,
});
const step = (name: string, conclusion: string | null) => ({
  name,
  conclusion,
  number: 1,
  status: "completed",
  started_at: null,
  completed_at: null,
});
const lostSteps = [step("Set up job", "success"), step("Run verification lane", null)];
const failedSteps = [step("Set up job", "success"), step("Run verification lane", "failure")];
const LOST =
  "The self-hosted runner: beep-ci-i-11 lost communication with the server. Verify the machine is running and has a healthy network connection.";
const workflowRun = (overrides: Record<string, unknown> = {}) => ({
  id: 900,
  name: "Check",
  event: "pull_request",
  status: "completed",
  conclusion: "failure",
  run_attempt: 1,
  head_sha: sha,
  head_branch: "feature/w3",
  head_repository: { owner: { login: "beep-effect" }, name: "beep-effect" },
  pull_requests: [{ number: 7, head: { sha } }],
  html_url: "https://github.com/beep-effect/beep-effect/actions/runs/900",
  ...overrides,
});
const pull = (overrides: Record<string, unknown> = {}) => ({
  number: 7,
  node_id: "PR_7",
  html_url: "https://github.com/beep-effect/beep-effect/pull/7",
  title: "W3 fixture",
  state: "open",
  draft: false,
  merged: false,
  merged_at: null,
  changed_files: 2,
  head: { ref: "feature/w3", sha, repo: { owner: { login: "beep-effect" } } },
  base: { ref: "main", sha: baseSha },
  ...overrides,
});
const rerunRoutes = (overrides: Record<string, Route> = {}): Record<string, Route> => ({
  "GET repos/{owner}/{repo}/actions/runs/900": { body: workflowRun() },
  "GET repos/{owner}/{repo}/actions/runs/900/attempts/1/jobs": {
    body: { total_count: 2, jobs: [job(11, "failure", lostSteps), job(12, "failure", failedSteps)] },
  },
  "GET repos/{owner}/{repo}/check-runs/11/annotations": {
    body: [{ message: LOST, path: ".github", annotation_level: "failure" }],
  },
  "GET repos/{owner}/{repo}/check-runs/12/annotations": { body: [{ message: "Process completed with exit code 1." }] },
  "GET repos/{owner}/{repo}/pulls/7": { body: pull() },
  "POST repos/{owner}/{repo}/actions/jobs/11/rerun": { status: 201, body: {} },
  ...overrides,
});

// --- the program -------------------------------------------------------------------------------------------------

const program = Effect.gen(function* () {
  // 1. Secret reads and origin lookup (GithubIdentity).
  const ghCli = (kind: "gh-cli" | "op-ref", tokenRef = O.none<string>()) => ({
    kind,
    tokenRef,
    appId: O.none<string>(),
    installationId: O.none<number>(),
    privateKeyRef: O.none<string>(),
  });
  const bearer = (layer: Layer.Layer<GitHubClient, unknown, Services>) =>
    GitHubClient.use((client) => client.requestDecoded("GET /user", {}, S.Struct({ login: S.String }))).pipe(
      Effect.provide(layer)
    );
  const identityTable = (token: Table["token"], op: Table["op"] = {}): Table => ({
    routes: { "GET user": { body: { login: "kriegcloud" } } },
    ...(token === undefined ? {} : { token }),
    op,
  });
  const identityRow = (scenario: string, table: Table, identity: ReturnType<typeof ghCli>) =>
    compare(
      "layerGithubClientFor",
      scenario,
      table,
      run(
        bearer(
          oldLayerGithubClientFor(
            OldGithubClientRequest.make({ identity: OldGithubIdentity.make(identity), cwd: repoRoot })
          )
        )
      ),
      run(
        bearer(
          layerGithubClientFor(GithubClientRequest.make({ identity: GithubIdentity.make(identity), cwd: repoRoot }))
        )
      )
    );
  yield* identityRow("gh auth token answers", identityTable({ exit: 0, stdout: "gho_operator\n" }), ghCli("gh-cli"));
  yield* identityRow("gh auth token exits 1", identityTable({ exit: 1, stdout: "" }), ghCli("gh-cli"));
  yield* identityRow("gh auth token prints nothing", identityTable({ exit: 0, stdout: "\n" }), ghCli("gh-cli"));
  yield* identityRow(
    "op read answers a token reference",
    identityTable(undefined, { "op://vault/item/token": "gho_from_op" }),
    ghCli("op-ref", O.some("op://vault/item/token"))
  );
  yield* identityRow(
    "op read refuses a token reference",
    identityTable(undefined, {}),
    ghCli("op-ref", O.some("op://vault/item/missing"))
  );

  const slug = (layer: Layer.Layer<Repo, unknown, Services>) =>
    Effect.map(Effect.service(Repo), (ref) => `${ref.owner}/${ref.repo}`).pipe(Effect.provide(layer));
  const scratch = NodePath.join(work, "repo");
  NodeFs.mkdirSync(scratch);
  const git = (cwd: string, args: ReadonlyArray<string>) => Bun.spawnSync(["git", "-C", cwd, ...args]);
  git(scratch, ["init", "--quiet"]);
  const plain = NodePath.join(work, "plain");
  NodeFs.mkdirSync(plain);
  // GH_REPO is read through Config, so each row provides its own environment.
  const withRepoEnv = (ghRepo: string | undefined) =>
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromUnknown(ghRepo === undefined ? {} : { GH_REPO: ghRepo })
    );
  const repoRow = (scenario: string, cwd: string, ghRepo: string | undefined) =>
    compare(
      "layerGithubRepoFor",
      scenario,
      { routes: {} },
      run(slug(oldLayerGithubRepoFor(cwd)).pipe(withRepoEnv(ghRepo))),
      run(slug(layerGithubRepoFor(cwd)).pipe(withRepoEnv(ghRepo)))
    );
  yield* repoRow("GH_REPO set", plain, "beep-effect/beep-effect");
  yield* repoRow("no origin remote", scratch, undefined);
  yield* repoRow("outside a repository", plain, undefined);
  git(scratch, ["remote", "add", "origin", "https://github.com/beep-effect/beep-effect.git"]);
  yield* repoRow("https origin", scratch, undefined);
  git(scratch, ["remote", "set-url", "origin", "git@github.com:kriegcloud/fork.git"]);
  yield* repoRow("ssh origin", scratch, undefined);

  // 2. The Ci GitHub API reader (lane timings and runner loss share it).
  const ciGithub = Layer.mergeAll(
    GitHubClient.layerFromToken({ token: Redacted.make("gho_operator"), retry: "off", fetch: tableFetch }),
    Repo.layer(RepoRef.make({ owner: "beep-effect", repo: "beep-effect" }))
  );
  const decodeJobs = S.decodeUnknownEffect(CiWorkflowJobsPage);
  const jobsEndpoint = "repos/{owner}/{repo}/actions/runs/900/jobs?filter=all&per_page=100&page=1";
  const jobsKey = "GET repos/{owner}/{repo}/actions/runs/900/jobs?filter=all";
  const LEGACY_JOBS_JQ =
    "{total_count,jobs:[.jobs[]|{completed_at,conclusion,created_at,id,labels,name,run_attempt,run_id,runner_name,started_at,status,steps}]}";
  const readerRow = (scenario: string, route: Route) =>
    compare(
      "ghApiJson",
      scenario,
      { routes: { [jobsKey]: route } },
      run(
        oldGhApiJson(repoRoot, jobsEndpoint, O.some(LEGACY_JOBS_JQ)).pipe(
          Effect.flatMap((text) => decodeJobs(JSON.parse(text)))
        )
      ),
      run(ghApiJson(jobsEndpoint).pipe(Effect.flatMap(decodeJobs), Effect.provide(ciGithub))),
      (page) => S.encodeUnknownSync(CiWorkflowJobsPage)(page)
    );
  const jobsBody = { total_count: 1, jobs: [job(11, "success", lostSteps)] };
  yield* readerRow("jobs page (jq projection vs raw payload)", { body: jobsBody });
  yield* readerRow("404", { status: 404, body: { message: "Not Found" } });
  yield* readerRow("422 carrying the rate-limit phrase", {
    status: 422,
    body: { message: "Validation Failed: secondary rate limit mentioned" },
  });
  yield* readerRow("500 GitHub answered", { status: 500, body: { message: "Internal Server Error" } });
  yield* readerRow("502 once, then the page", {
    body: jobsBody,
    failTimes: 1,
    failStatus: 502,
    failReason: "Bad Gateway",
  });
  yield* readerRow("connection reset once, then the page", {
    body: jobsBody,
    failTimes: 1,
    failReason: "read: connection reset by peer",
  });
  yield* readerRow("connection reset on every attempt", {
    body: jobsBody,
    failTimes: 9,
    failReason: "read: connection reset by peer",
  });

  // 3. Runner-loss rerun end to end (reads, decision, rerun request).
  const outputs = ActionOutputs.recording().layer;
  const rerunRow = (scenario: string, routes: Record<string, Route>, dryRun = false) =>
    compare(
      "runCiRerunRunnerLoss",
      scenario,
      { routes },
      run(
        oldRunCiRerunRunnerLoss(OldCiRerunRunnerLossInput.make({ runId: 900, dryRun, cwd: repoRoot })).pipe(
          Effect.provide(outputs),
          Effect.provide(TestConsole.layer)
        )
      ),
      run(
        runCiRerunRunnerLoss(CiRerunRunnerLossInput.make({ runId: 900, dryRun, cwd: repoRoot })).pipe(
          Effect.provide(Layer.mergeAll(outputs, ciGithub, TestConsole.layer))
        )
      ),
      (report) => report
    );
  yield* rerunRow("lost job on the current pull-request head", rerunRoutes());
  yield* rerunRow(
    "superseded pull-request head",
    rerunRoutes({
      "GET repos/{owner}/{repo}/pulls/7": {
        body: pull({ head: { ref: "feature/w3", sha: newerSha, repo: { owner: { login: "beep-effect" } } } }),
      },
    })
  );
  yield* rerunRow(
    "fork pull request found by its head label",
    rerunRoutes({
      "GET repos/{owner}/{repo}/actions/runs/900": {
        body: workflowRun({ pull_requests: [], head_repository: { owner: { login: "contributor" } } }),
      },
      "GET repos/{owner}/{repo}/pulls?head=contributor%3Afeature%2Fw3&state=open": {
        body: [pull({ head: { ref: "feature/w3", sha, repo: { owner: { login: "contributor" } } } })],
      },
    }),
    true
  );
  yield* rerunRow(
    "push run against its branch tip",
    rerunRoutes({
      "GET repos/{owner}/{repo}/actions/runs/900": {
        body: workflowRun({ event: "push", head_branch: "main", pull_requests: [] }),
      },
      "GET repos/{owner}/{repo}/git/ref/heads/main": {
        body: { ref: "refs/heads/main", object: { sha, type: "commit" } },
      },
    })
  );
  yield* rerunRow(
    "a refused rerun",
    rerunRoutes({
      "POST repos/{owner}/{repo}/actions/jobs/11/rerun": {
        status: 403,
        body: { message: "Resource not accessible by integration" },
      },
    })
  );

  // 4. Governance reads and writes.
  const rulesetBody = {
    id: 10240248,
    name: "main",
    enforcement: "active",
    rules: [
      {
        type: "required_status_checks",
        parameters: { strict_required_status_checks_policy: true, required_status_checks: [{ context: "Lint" }] },
      },
    ],
  };
  const governanceTable: Table = {
    routes: {
      "GET repos/{owner}/{repo}/rulesets/10240248": { body: rulesetBody },
      "GET repos/{owner}/{repo}/actions/workflows/check.yml/runs?branch=main&event=push": {
        body: {
          total_count: 1,
          workflow_runs: [
            { id: 5, status: "waiting", created_at: "2026-10-01T00:00:00Z", head_branch: "main", head_sha: sha },
          ],
        },
      },
      "DELETE repos/{owner}/{repo}/issues/7/labels/size%2FL": { body: [] },
      "POST repos/{owner}/{repo}/issues/7/labels": { body: [{ name: "size/S" }] },
    },
  };
  const governanceRead = (scenario: string, endpoint: string, oldProjection?: string) =>
    compare(
      "GithubPolicyClient.read",
      scenario,
      governanceTable,
      run(
        Effect.scoped(
          Effect.flatMap(oldGovernanceClient(repoRoot), (client) =>
            client.read(endpoint, oldProjection).pipe(Effect.map((text) => JSON.parse(text) as unknown))
          )
        )
      ),
      run(Effect.scoped(Effect.flatMap(newPolicyClient, (client) => client.read(endpoint)))),
      (value) => (oldProjection === undefined ? value : projectHeldRuns(value))
    );
  yield* governanceRead("ruleset 10240248", "repos/{owner}/{repo}/rulesets/10240248");
  yield* governanceRead(
    "held-group runs (jq projection vs raw payload)",
    "repos/{owner}/{repo}/actions/workflows/check.yml/runs?branch=main&event=push&per_page=100",
    "{workflow_runs:[.workflow_runs[]|{id,status,created_at,head_branch}]}"
  );
  yield* governanceRead("unknown environment", "repos/{owner}/{repo}/environments/professional-desktop-release");
  yield* compare(
    "GithubPolicyClient.write",
    "replace a size label",
    governanceTable,
    run(
      Effect.scoped(
        Effect.flatMap(oldGovernanceClient(repoRoot), (client) =>
          client
            .write(["-X", "DELETE", `repos/{owner}/{repo}/issues/7/labels/${encodeURIComponent("size/L")}`])
            .pipe(
              Effect.andThen(
                client.write(["-X", "POST", "repos/{owner}/{repo}/issues/7/labels", "-f", "labels[]=size/S"])
              )
            )
        )
      )
    ),
    run(
      Effect.scoped(
        Effect.flatMap(newPolicyClient, (client) =>
          client
            .write("DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}", {
              issue_number: 7,
              name: "size/L",
            })
            .pipe(
              Effect.andThen(
                client.write("POST /repos/{owner}/{repo}/issues/{issue_number}/labels", {
                  issue_number: 7,
                  labels: ["size/S"],
                })
              )
            )
        )
      )
    )
  );

  // 5. Reviewer ruleset administration and the merge gate (operator gh login).
  const ruleset = (withReviewer: boolean) => ({
    id: 11,
    name: "main protection",
    target: "branch",
    source_type: "Repository",
    source: "beep-effect/beep-effect",
    enforcement: "active",
    bypass_actors: [{ actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "always" }],
    conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
    rules: [
      { type: "deletion" },
      {
        type: "required_status_checks",
        parameters: {
          strict_required_status_checks_policy: false,
          required_status_checks: [
            { context: "Heavy / Check", integration_id: 15368 },
            ...(withReviewer ? [{ context: "beep-reviewer", integration_id: 42 }] : []),
          ],
        },
      },
    ],
  });
  const rulesetTable = (login: string, overrides: Record<string, Route> = {}): Table => ({
    routes: {
      "GET user": { body: { login } },
      "GET repos/{owner}/{repo}": { body: { default_branch: "main" } },
      "GET repos/{owner}/{repo}/rules/branches/main": {
        body: [
          { type: "deletion", ruleset_id: 11 },
          { type: "required_status_checks", ruleset_id: 11, parameters: {} },
        ],
      },
      "GET repos/{owner}/{repo}/rulesets?includes_parents=true": {
        body: [{ id: 11, source_type: "Repository", enforcement: "active" }],
      },
      "GET repos/{owner}/{repo}/rulesets/11": { body: ruleset(true) },
      "PUT repos/{owner}/{repo}/rulesets/11": { body: {} },
      ...overrides,
    },
  });
  const consoleLines = <A, E>(effect: Effect.Effect<A, E, Services>) =>
    Effect.gen(function* () {
      yield* effect;
      return (yield* TestConsole.logLines).map(String);
    }).pipe(Effect.provide(TestConsole.layer));
  const rulesetRow = (scenario: string, table: Table, apply: boolean) =>
    compare(
      "releaseReviewerRuleset",
      scenario,
      table,
      run(consoleLines(oldReleaseReviewerRuleset(apply, undefined))),
      run(consoleLines(releaseReviewerRuleset(apply, undefined).pipe(withReviewerOperatorClient(repoRoot))))
    );
  yield* rulesetRow("dry run prints the diff", rulesetTable("kriegcloud"), false);
  yield* rulesetRow("apply writes one lossless PUT", rulesetTable("kriegcloud"), true);
  yield* rulesetRow("another gh login is refused", rulesetTable("someone-else"), true);
  yield* rulesetRow(
    "an unreadable ruleset",
    rulesetTable("kriegcloud", {
      "GET repos/{owner}/{repo}/rulesets/11": { status: 404, body: { message: "Not Found" } },
    }),
    false
  );
  const reviewerCheck = (status: string, conclusion: string | null) => ({
    id: 2,
    name: "beep-reviewer",
    head_sha: sha,
    status,
    conclusion,
    app: { id: 42 },
    external_id: reviewerCheckExternalId(7, sha, baseSha),
  });
  const gateTable = (checks: ReadonlyArray<unknown>): Table => ({
    routes: {
      "GET repos/{owner}/{repo}/pulls/7": { body: pull() },
      "GET repos/{owner}/{repo}/rules/branches/main": {
        body: [
          {
            type: "required_status_checks",
            ruleset_id: 11,
            parameters: { required_status_checks: [{ context: "beep-reviewer", integration_id: 42 }] },
          },
        ],
      },
      [`GET repos/{owner}/{repo}/commits/${sha}/check-runs?check_name=beep-reviewer&filter=all`]: {
        body: { total_count: checks.length, check_runs: checks },
      },
    },
  });
  const gateRow = (scenario: string, table: Table) =>
    compare(
      "enforceReviewerGate",
      scenario,
      table,
      run(oldEnforceReviewerGate(7, sha)),
      run(enforceReviewerGate(7, sha).pipe(withReviewerOperatorClient(repoRoot)))
    );
  yield* gateRow("a successful current-head reviewer check", gateTable([reviewerCheck("completed", "success")]));
  yield* gateRow("no reviewer check yet", gateTable([]));

  // 6. Reviewer publishing (App installation client).
  const auth = Layer.succeed(GitHubAppAuth, GitHubAppAuth.of({ appId: 42 }));
  const oldAuth = Layer.succeed(
    OldGitHubAppAuth,
    OldGitHubAppAuth.of({ appId: 42, token: Effect.succeed(Redacted.make("ghs_installation")) })
  );
  const oldHttp = Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.promise(async () => {
        const text = request.body._tag === "Uint8Array" ? new TextDecoder().decode(request.body.body) : undefined;
        const response = await tableFetch(request.url, {
          method: request.method,
          headers: request.headers,
          ...(text === undefined ? {} : { body: text }),
        });
        return HttpClientResponse.fromWeb(request, response);
      })
    )
  );
  const newPublishing = ReviewerLive.pipe(
    Layer.provide(auth),
    Layer.provide(
      GitHubClient.layerFromToken({ token: Redacted.make("ghs_installation"), retry: "off", fetch: tableFetch })
    )
  );
  const oldPublishing = OldReviewerLive.pipe(Layer.provide(oldAuth), Layer.provide(oldHttp));
  const publishRow = <A>(
    scenario: string,
    table: Table,
    use: (reviewer: Reviewer["Service"]) => Effect.Effect<A, unknown>
  ) =>
    compare(
      "Reviewer",
      scenario,
      table,
      // The frozen side's HttpClient reaches the same `fetch` table, so both columns are fetch calls.
      OldReviewer.use(use).pipe(Effect.provide(oldPublishing)),
      Reviewer.use(use).pipe(Effect.provide(newPublishing))
    );
  const file = (filename: string) => ({
    filename,
    status: "modified",
    additions: 1,
    deletions: 0,
    changes: 1,
    sha: "f",
  });
  const publishTable = (overrides: Record<string, Route> = {}): Table => ({
    routes: {
      "GET repos/{owner}/{repo}/pulls/7": { body: pull() },
      "GET repos/{owner}/{repo}/pulls/7/files": { body: [file("docs/guide.md"), file("README.md")] },
      [`GET repos/{owner}/{repo}/commits/${sha}/pulls`]: { body: [pull()] },
      [`GET repos/{owner}/{repo}/commits/${sha}/check-runs?check_name=beep-reviewer&filter=all`]: {
        body: { total_count: 1, check_runs: [reviewerCheck("in_progress", null)] },
      },
      "POST repos/{owner}/{repo}/check-runs": { status: 201, body: { id: 44 } },
      "GET repos/{owner}/{repo}/check-runs/2": { body: reviewerCheck("in_progress", null) },
      "PATCH repos/{owner}/{repo}/check-runs/2": { body: { id: 2 } },
      "GET repos/{owner}/{repo}/issues/7/comments": {
        body: [
          {
            id: 12,
            body: "<!-- beep-reviewer:summary -->\nOld",
            html_url: "https://github.com/x",
            user: { login: "beep-reviewer[bot]", type: "Bot" },
            performed_via_github_app: { id: 42 },
          },
        ],
      },
      "PATCH repos/{owner}/{repo}/issues/comments/12": {
        body: { id: 12, body: "x", html_url: "https://github.com/x" },
      },
      "POST repos/{owner}/{repo}/issues/7/comments": {
        status: 201,
        body: { id: 13, body: "x", html_url: "https://github.com/x" },
      },
      "POST repos/{owner}/{repo}/pulls/7/reviews": { body: { id: 55 } },
      ...overrides,
    },
  });
  const annotation = ReviewerAnnotation.make({
    path: "README.md",
    start_line: 1,
    end_line: 1,
    annotation_level: "warning",
    message: "Clarify",
  });
  const result = ReviewerResult.make({
    score: 4,
    tier: "L2",
    p0: 0,
    p1: 0,
    p2: 1,
    summary: "One suggestion",
    conclusion: "auto",
    annotations: [annotation, annotation],
  });
  yield* publishRow("L0 documentation-only head", publishTable(), (reviewer) => reviewer.docsOnly(7, sha));
  yield* publishRow(
    "L0 refused when another open PR shares the head",
    publishTable({
      [`GET repos/{owner}/{repo}/commits/${sha}/pulls`]: { body: [pull(), pull({ number: 8, node_id: "PR_8" })] },
    }),
    (reviewer) => reviewer.docsOnly(7, sha)
  );
  yield* publishRow("start reuses the in-progress check", publishTable(), (reviewer) => reviewer.start(7, sha));
  yield* publishRow(
    "start creates a check",
    publishTable({
      [`GET repos/{owner}/{repo}/commits/${sha}/check-runs?check_name=beep-reviewer&filter=all`]: {
        body: { total_count: 0, check_runs: [] },
      },
    }),
    (reviewer) => reviewer.start(7, sha)
  );
  yield* publishRow("complete with annotations", publishTable(), (reviewer) => reviewer.complete(2, result));
  yield* publishRow("cancel", publishTable(), (reviewer) => reviewer.cancel(2, "superseded"));
  yield* publishRow("upsert edits the owned summary", publishTable(), (reviewer) => reviewer.upsert(7, "Summary"));
  yield* publishRow(
    "upsert creates when only a copied marker exists",
    publishTable({
      "GET repos/{owner}/{repo}/issues/7/comments": {
        body: [
          {
            id: 12,
            body: "<!-- beep-reviewer:summary -->",
            html_url: "https://github.com/x",
            user: { login: "kriegcloud", type: "User" },
            performed_via_github_app: null,
          },
        ],
      },
    }),
    (reviewer) => reviewer.upsert(7, "Summary")
  );
  yield* publishRow("COMMENT review on the current head", publishTable(), (reviewer) =>
    reviewer.review(7, sha, ReviewerReview.make({ body: "Notes", comments: [] }))
  );

  // 7. Reviewer App token exchange and credentials.
  const keyPair = yield* Effect.promise(() =>
    crypto.subtle.generateKey(
      { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
      true,
      ["sign", "verify"]
    )
  );
  const pkcs8 = new Uint8Array(yield* Effect.promise(() => crypto.subtle.exportKey("pkcs8", keyPair.privateKey)));
  const pem = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(pkcs8).toString("base64")}\n-----END PRIVATE KEY-----`; // gitleaks:allow -- format marker only; key generated in memory. nosemgrep: semgrep.beep-hardcoded-private-key
  const credentials = ReviewerCredentials.make({
    appId: 42,
    clientId: "Iv.differential",
    installationId: 77,
    privateKey: Redacted.make(pem),
  });
  const granted = { checks: "write", pull_requests: "write", issues: "write", contents: "read", metadata: "read" };
  const tokenTable = (permissions: Record<string, string>): Table => ({
    routes: {
      "POST app/installations/77/access_tokens": {
        status: 201,
        body: { token: "ghs_minted", expires_at: "2099-01-01T00:00:00Z", permissions },
      },
      "DELETE installation/token": { status: 204 },
      "GET user": { body: { login: "beep-reviewer[bot]" } },
    },
  });
  const twoReads = <E, R>(read: Effect.Effect<unknown, E, R>) => Effect.andThen(read, read);
  yield* compare(
    "makeGitHubAppAuth",
    "mint, then two requests",
    tokenTable(granted),
    OldGitHubAppAuth.use((service) => twoReads(service.token)).pipe(
      Effect.provide(oldMakeGitHubAppAuth(credentials).pipe(Layer.provide(oldHttp)))
    ),
    twoReads(GitHubClient.use((client) => client.requestDecoded("GET /user", {}, S.Unknown))).pipe(
      Effect.provide(makeGitHubAppAuth(credentials, { fetch: tableFetch, retry: "off" }))
    ),
    () => "authenticated"
  );
  yield* compare(
    "makeGitHubAppAuth",
    "GitHub grants less than the reviewer asks",
    tokenTable({ ...granted, checks: "read" }),
    OldGitHubAppAuth.use((service) => service.token).pipe(
      Effect.provide(oldMakeGitHubAppAuth(credentials).pipe(Layer.provide(oldHttp)))
    ),
    GitHubClient.use((client) => client.requestDecoded("GET /user", {}, S.Unknown)).pipe(
      Effect.provide(makeGitHubAppAuth(credentials, { fetch: tableFetch, retry: "off" }))
    ),
    () => "authenticated"
  );
  const credentialTable: Table = {
    routes: {},
    op: {
      "op://BEEP_SECRETS/beep-reviewer GitHub App/app_id": "42",
      "op://BEEP_SECRETS/beep-reviewer GitHub App/client_id": "Iv.differential",
      "op://BEEP_SECRETS/beep-reviewer GitHub App/installation_id": "77",
      "op://BEEP_SECRETS/beep-reviewer GitHub App/private_key": "PEM\n",
    },
  };
  yield* compare(
    "loadReviewerCredentials",
    "every field from op read",
    credentialTable,
    run(oldLoadReviewerCredentials),
    run(loadReviewerCredentials)
  );
  yield* compare(
    "loadReviewerCredentials",
    "op read refuses a field",
    { routes: {}, op: {} },
    run(oldLoadReviewerCredentials),
    run(loadReviewerCredentials)
  );

  // --- classification ----------------------------------------------------------------------------------------------
  const classified = rows.map((row) => {
    if (show(row.old) === show(row.new)) return { ...row, verdict: "same" };
    const known = CLASSIFIED.find(([site, scenario]) => site === row.site && scenario === row.scenario);
    return { ...row, verdict: known === undefined ? "unclassified" : known[2] };
  });
  const unclassified = classified.filter((row) => row.verdict === "unclassified");
  const gates = { unclassified: unclassified.length === 0 };
  const report = {
    tool: "goals/repo-cli-gh-git-consolidation/ops/reviewer-ci-github-differential-w3.ts",
    commit: new TextDecoder().decode(Bun.spawnSync(["git", "-C", repoRoot, "rev-parse", "HEAD"]).stdout).trim(),
    jq: new TextDecoder().decode(Bun.spawnSync(["jq", "--version"]).stdout).trim(),
    scenarios: classified.length,
    same: classified.filter((row) => row.verdict === "same").length,
    classified: classified.filter((row) => row.verdict !== "same" && row.verdict !== "unclassified").length,
    unclassified: unclassified.length,
    gates,
    rows: classified.map((row) => ({
      site: row.site,
      scenario: row.scenario,
      verdict: row.verdict,
      old: show(row.old).replaceAll(work, "<tmp>").replaceAll(repoRoot, "<repo>"),
      new: show(row.new).replaceAll(work, "<tmp>").replaceAll(repoRoot, "<repo>"),
    })),
  };
  const json = JSON.stringify(report, null, 2);
  if (outIndex >= 0 && argv[outIndex + 1] !== undefined) NodeFs.writeFileSync(argv[outIndex + 1] ?? "", `${json}\n`);
  else yield* Console.log(json);
  yield* Console.error(
    `gates: ${JSON.stringify(gates)} (${report.same} same, ${report.classified} classified, ${report.unclassified} unclassified)`
  );
  if (!gates.unclassified) process.exitCode = 1;
});

const newPolicyClient = Effect.map(Layer.build(GithubPolicyClientLive), (context) =>
  Context.get(context, GithubPolicyClient)
);
const projectHeldRuns = (value: unknown): unknown => {
  const page = value as { workflow_runs: ReadonlyArray<Record<string, unknown>> };
  return {
    workflow_runs: page.workflow_runs.map(({ id, status, created_at, head_branch }) => ({
      id,
      status,
      created_at,
      head_branch,
    })),
  };
};

/** Every difference this switch is expected to produce, with the D-12 reason. Filled from the witnessed rows. */
const STATUS_WORDING =
  "D-12 (a): a failed read names the GitHub API status and reason (`GitHub API <endpoint> failed (HTTP n): <reason>`) where the gh capture named its exit and stderr; same CiCommandError, same retry decision";
const CLASSIFIED: ReadonlyArray<readonly [site: string, scenario: string, reason: string]> = [
  ["ghApiJson", "404", STATUS_WORDING],
  ["ghApiJson", "422 carrying the rate-limit phrase", STATUS_WORDING],
  ["ghApiJson", "500 GitHub answered", STATUS_WORDING],
  [
    "ghApiJson",
    "connection reset on every attempt",
    `${STATUS_WORDING}; octokit reports a request that never reached GitHub as status 500 carrying the network error`,
  ],
  [
    "runCiRerunRunnerLoss",
    "a refused rerun",
    "D-12 (a): the refused rerun names the API status and reason (`GitHub API rerun of job <id> failed (HTTP n)`) where `gh run rerun --job` named its exit and stderr; the decision, the reads and the one POST are the same",
  ],
  [
    "GithubPolicyClient.read",
    "unknown environment",
    "D-12 (a): the governance failure names the HTTP status (`(HTTP 404)`) where the gh capture named `(exit 1, truncated=false)`; the message still ends `state is unknown.`",
  ],
  [
    "makeGitHubAppAuth",
    "mint, then two requests",
    "D-12 (b): building the layer mints a permission-check token and revokes it, then GitHubApp.clientLayer mints the client token (revoked on release); both mints send the same down-scoped body (octokit orders its keys) and every request carries the installation token",
  ],
  [
    "makeGitHubAppAuth",
    "GitHub grants less than the reviewer asks",
    "D-12 (c): a grant below the reviewer permissions fails closed through assertPermissions and the refused token is revoked; the hand-rolled exchange accepted whatever GitHub granted",
  ],
];

NodeRuntime.runMain(
  Layer.build(servicesLayer).pipe(
    Effect.flatMap((services) => program.pipe(Effect.provide(services))),
    Effect.scoped
  )
);
