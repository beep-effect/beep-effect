/**
 * A recorded GitHub transport for the Yeet suites: the real `@beep/github`
 * client (route interpolation, pagination, error classification, GraphQL
 * decoding) over a `fetch` that answers from a test's own route function and
 * records every call it served. Suites hand the resulting services to the
 * gh-login surfaces through `YeetGithubLayer`, or provide them directly to a
 * read that already requires them.
 */

import { Run } from "@beep/commands/Run";
import { GitHubClient } from "@beep/github/GitHubClient";
import { GitHubRepository } from "@beep/github/GitHubRepository";
import { PullRequest } from "@beep/github/PullRequest";
import { Repo, RepoRef } from "@beep/github/Repo";
import { RetryPolicy } from "@beep/github/Resilience";
import { ReviewThread } from "@beep/github/ReviewThread";
import { layerGithubRest, layerGraphqlBudget } from "@beep/repo-cli/test/SharedInternals";
import { runRepoCommandCapture, YeetGithubLayer } from "@beep/repo-cli/test/Yeet";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { YeetGithubServices } from "@beep/repo-cli/test/Yeet";
import type * as Context from "effect/Context";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

const UnknownJson = S.fromJsonString(S.Unknown);

/** The repository every Yeet suite's GitHub calls act on. */
const YEET_GITHUB_REPO = RepoRef.make({ owner: "beep-effect", repo: "beep-effect" });

/** One request the transport served. */
export interface GithubCall {
  /** The JSON body, or `undefined` for a body-less request. */
  readonly body: unknown;
  /** The GraphQL document text, when this is a GraphQL call. */
  readonly graphql: O.Option<string>;
  readonly method: string;
  /** The path with the repository prefix replaced by `{repo}`, percent-decoded. */
  readonly path: string;
  readonly query: URLSearchParams;
}

/**
 * What a route answers: an HTTP status (200 by default) and a JSON body, or a
 * request that never reached GitHub (`unreachable`, the network error's text).
 */
export interface GithubAnswer {
  readonly body?: unknown;
  readonly status?: number;
  readonly unreachable?: string;
}

/** Answers one call, now or later, or `undefined` for a 404. */
export type GithubRoutes = (call: GithubCall) => GithubAnswer | undefined | Promise<GithubAnswer | undefined>;

const repoPrefix = `/repos/${YEET_GITHUB_REPO.owner}/${YEET_GITHUB_REPO.repo}`;

const bodyOf = (text: string): unknown =>
  Str.isEmpty(text) ? undefined : Result.getOrThrowWith(S.decodeResult(UnknownJson)(text), identity);

const graphqlOf = (path: string, body: unknown): O.Option<string> =>
  path === "/graphql" && P.isObject(body) && P.hasProperty(body, "query") && P.isString(body.query)
    ? O.some(body.query)
    : O.none();

const respond = (url: string, answer: GithubAnswer): Response => {
  const status = answer.status ?? 200;
  const response =
    status === 204
      ? new Response(null, { status })
      : new Response(Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(answer.body ?? null), identity), {
          status,
          headers: { "content-type": "application/json" },
        });
  // octokit reads `response.url` back on paginated reads; a hand-built Response has none.
  Object.defineProperty(response, "url", { value: url });
  return response;
};

const githubFetch = (routes: GithubRoutes, calls: Array<GithubCall>): typeof globalThis.fetch =>
  Object.assign(
    (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const request = new Request(input instanceof URL ? input.href : input, init);
      const url = new URL(request.url);
      const path = Str.replace(repoPrefix, "{repo}")(decodeURIComponent(url.pathname));
      return request.text().then((text) => {
        const body = bodyOf(text);
        const call: GithubCall = {
          body,
          graphql: graphqlOf(path, body),
          method: request.method,
          path,
          query: url.searchParams,
        };
        calls.push(call);
        return Promise.resolve(routes(call)).then((routed) => {
          const answer = routed ?? { status: 404, body: { message: "Not Found" } };
          return answer.unreachable === undefined
            ? respond(request.url, answer)
            : Promise.reject(new TypeError(answer.unreachable));
        });
      });
    },
    { preconnect: () => undefined }
  );

/** A recorded GitHub: the calls it served, its services, and the seam that hands them to a Yeet surface. */
export interface RecordedGithub {
  /** Every call served so far, in order. */
  readonly calls: ReadonlyArray<GithubCall>;
  /** Every `YeetGithubServices` member over the recorded transport, retries off. */
  readonly layer: Layer.Layer<YeetGithubServices>;
  /**
   * Provide these services to `effect` and hand them to any gh-login Yeet
   * surface inside it, in place of the operator's login.
   */
  readonly provide: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, Exclude<R, YeetGithubServices>>;
}

/**
 * The real `@beep/github` client over a `fetch` that answers from `routes`.
 */
export const recordedGithub = (routes: GithubRoutes): RecordedGithub => {
  const calls: Array<GithubCall> = [];
  // Fresh: a recorded GitHub provided inside another must not reuse that one's
  // memoized services (`Layer.build` forks the surrounding memo map).
  const layer = Layer.mergeAll(
    layerGithubRest,
    layerGraphqlBudget,
    ReviewThread.layer,
    GitHubRepository.layer,
    PullRequest.layer
  ).pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        GitHubClient.layerFromToken({
          token: Redacted.make("gho_test"),
          fetch: githubFetch(routes, calls),
          retry: RetryPolicy.none,
        }),
        Repo.layer(YEET_GITHUB_REPO)
      )
    ),
    Layer.fresh
  );
  return {
    calls,
    layer,
    provide: (effect) =>
      layer.pipe(
        Layer.build,
        Effect.flatMap((context) =>
          Effect.provideContext(Effect.provideService(effect, YeetGithubLayer, O.some(layer)), context)
        ),
        Effect.scoped
      ),
  };
};

/** Whether a call is the GraphQL document containing `fragment`. */
export const isGraphql =
  (fragment: string) =>
  (call: GithubCall): boolean =>
    O.exists(call.graphql, Str.includes(fragment));

/** `METHOD path` for a call, the form suites assert the served calls in. */
export const githubCallLine = (call: GithubCall): string =>
  O.match(call.graphql, {
    onNone: () => `${call.method} ${call.path}`,
    onSome: (document) =>
      `graphql ${O.getOrElse(
        A.findFirst(
          [
            "addPullRequestReviewThreadReply",
            "unresolveReviewThread",
            "resolveReviewThread",
            "node(id",
            "reviewThreads",
            "rateLimit",
          ],
          (name) => Str.includes(name)(document)
        ),
        () => "query"
      )}`,
  });

// --- The gh-backed transport ---------------------------------------------------
//
// Suites written against a scripted `gh` binary keep their scripts: each call
// the kit makes is rendered as the `gh` argv it replaced, run through the
// suite's own (scripted) spawner, and the printed answer is returned as
// GitHub's, with recorded thread pages lifted into the kit's selection.

const fieldText = (value: unknown): string =>
  P.isString(value) ? value : Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(value), identity);

const graphqlVariables = (call: GithubCall): Readonly<Record<string, unknown>> =>
  P.isObject(call.body) && P.hasProperty(call.body, "variables") && P.isObject(call.body.variables)
    ? (call.body.variables as Readonly<Record<string, unknown>>)
    : {};

/**
 * The `gh` argv a kit call replaced: `api graphql -f query=<document> -F <variable>=<value>...`
 * (with `after` as gh's `cursor`), or `api [-X <method>] repos/{owner}/{repo}/<path>[?query] <field>=<value>...`.
 */
export const legacyGhArgs = (call: GithubCall): ReadonlyArray<string> =>
  O.match(call.graphql, {
    onSome: (document) => [
      "api",
      "graphql",
      "-f",
      `query=${document}`,
      ...A.flatMap(R.toEntries(graphqlVariables(call)), ([name, value]) => [
        "-F",
        `${name === "after" ? "cursor" : name}=${fieldText(value)}`,
      ]),
    ],
    onNone: () => {
      const query = call.query.toString();
      return [
        "api",
        ...(call.method === "GET" ? [] : ["-X", call.method]),
        `${Str.replace("{repo}", "repos/{owner}/{repo}")(call.path)}${Str.isEmpty(query) ? "" : `?${query}`}`,
        ...(P.isObject(call.body)
          ? A.map(
              R.toEntries(call.body as Readonly<Record<string, unknown>>),
              ([name, value]) => `${name}=${fieldText(value)}`
            )
          : []),
      ];
    },
  });

// One page holding every item of `pages`, with the `total_count` octokit's
// paginator reads to find the item list.
const pageOf = (key: string, pages: ReadonlyArray<object>) => {
  const items = A.flatMap(pages, (page) => (page as Readonly<Record<string, ReadonlyArray<unknown>>>)[key] ?? []);
  return { total_count: A.length(items), [key]: items };
};

const PAGED_KEYS = ["check_runs", "workflow_runs", "jobs"] as const;

/** A `gh --paginate --slurp` page list folded back into the one page GitHub sends. */
const foldSlurpedPages = (value: unknown): unknown => {
  if (!A.isArray(value) || !A.isReadonlyArrayNonEmpty(value)) return value;
  if (A.every(value, A.isArray)) return A.flatten(value as ReadonlyArray<ReadonlyArray<unknown>>);
  const first = value[0];
  return O.getOrElse(
    O.map(
      A.findFirst(PAGED_KEYS, (key) => P.isObject(first) && P.hasProperty(first, key)),
      (key) => pageOf(key, value as ReadonlyArray<object>)
    ),
    () => value
  );
};

const kitComment =
  (path: unknown) =>
  (comment: unknown, index: number): unknown => ({
    id: `PRRC_${index}`,
    databaseId: null,
    author: null,
    body: "",
    path: P.isString(path) ? path : "",
    line: null,
    originalLine: null,
    createdAt: "2026-01-01T00:00:00Z",
    url: "https://github.com/beep-effect/beep-effect/pull/1",
    ...(comment as object),
  });

const connectionNodes = (connection: unknown): ReadonlyArray<unknown> =>
  P.isObject(connection) && P.hasProperty(connection, "nodes") && A.isArray(connection.nodes) ? connection.nodes : [];

const closedPage = { hasNextPage: false, endCursor: null };

const kitThread = (thread: unknown): unknown => {
  const fields = thread as Readonly<Record<string, unknown>>;
  const comment = kitComment(fields.path);
  const comments = A.map(connectionNodes(fields.comments), comment);
  const latest = P.hasProperty(fields, "latest") ? A.map(connectionNodes(fields.latest), comment) : [];
  const commentsPage =
    P.isObject(fields.comments) && P.hasProperty(fields.comments, "pageInfo") ? fields.comments.pageInfo : closedPage;
  return {
    isOutdated: false,
    isCollapsed: false,
    line: null,
    startLine: null,
    diffSide: "RIGHT",
    resolvedBy: null,
    ...fields,
    // GitHub always names the file; a recording that selected no path reads as the empty one.
    path: P.isString(fields.path) ? fields.path : "",
    comments: { pageInfo: { ...closedPage, ...(commentsPage as object) }, nodes: comments },
    latest: { nodes: A.takeRight(latest, 1) },
  };
};

const kitConnection = (connection: unknown): unknown => ({
  pageInfo: {
    ...closedPage,
    ...((P.isObject(connection) && P.hasProperty(connection, "pageInfo") ? connection.pageInfo : {}) as object),
  },
  nodes: A.map(connectionNodes(connection), kitThread),
});

const kitPullRequest = (pullRequest: unknown, typename: boolean): unknown =>
  P.isObject(pullRequest)
    ? {
        ...(typename ? { __typename: "PullRequest" } : {}),
        author: null,
        ...pullRequest,
        reviewThreads: kitConnection(P.hasProperty(pullRequest, "reviewThreads") ? pullRequest.reviewThreads : {}),
      }
    : pullRequest;

/**
 * A recorded `gh api graphql` thread page (`data.node` or
 * `data.repository.pullRequest`) in the selection the kit's `ReviewThread`
 * decodes; fields the recording never selected take GitHub's empty values.
 */
const kitThreadsFromLegacy = (payload: unknown): unknown => {
  const data = P.isObject(payload) && P.hasProperty(payload, "data") ? payload.data : undefined;
  if (!P.isObject(data)) return payload;
  if (P.hasProperty(data, "node")) return { data: { node: kitPullRequest(data.node, true) } };
  if (
    P.hasProperty(data, "repository") &&
    P.isObject(data.repository) &&
    P.hasProperty(data.repository, "pullRequest")
  ) {
    return { data: { repository: { pullRequest: kitPullRequest(data.repository.pullRequest, false) } } };
  }
  return payload;
};

const parseJson = O.liftThrowable((text: string): unknown =>
  Result.getOrThrowWith(S.decodeResult(UnknownJson)(text), identity)
);

/** What a recorded `gh` call printed, as GitHub's own answer. */
export const legacyGhAnswer = ({
  call,
  exitCode,
  output,
}: {
  readonly call: GithubCall;
  readonly exitCode: number;
  readonly output: string;
}): GithubAnswer => {
  if (exitCode !== 0) return { status: 500, body: { message: output } };
  if (Str.isEmpty(Str.trim(output))) return { body: {} };
  // Text that is not JSON reaches the client as a JSON string, which no schema accepts.
  const body = O.getOrElse(parseJson(output), () => output);
  return { body: O.isSome(call.graphql) ? kitThreadsFromLegacy(body) : foldSlurpedPages(body) };
};

// A job log routinely runs past the repo-run capture bound, and its reader
// bounds it itself, so the scripted `gh` answers it whole and raw.
const isJobLogRead = (call: GithubCall): boolean => /^\{repo\}\/actions\/jobs\/\d+\/logs$/u.test(call.path);

// What the scripted `gh` printed for a call, or `None` when it could not be started.
const legacyGhOutput = (
  call: GithubCall
): Effect.Effect<O.Option<GhCapture>, never, ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom> =>
  isJobLogRead(call)
    ? Run.collect(ChildProcess.make("gh", legacyGhArgs(call)), { maxOutputBytes: 64 * 1024 * 1024 }).pipe(
        Effect.map((result) => ({ exitCode: result.exitCode, output: `${result.stdout}${result.stderr}` })),
        Effect.option
      )
    : runRepoCommandCapture("gh", legacyGhArgs(call), ".").pipe(Effect.option);

const legacyGhReply = (call: GithubCall) =>
  legacyGhOutput(call).pipe(
    Effect.map(
      O.match({
        onNone: (): GithubAnswer => ({ unreachable: "gh could not be started" }),
        onSome: (result) => legacyGhAnswer({ call, exitCode: result.exitCode, output: result.output }),
      })
    )
  );

// A client whose calls the ambient (scripted) spawner answers as the `gh`
// calls they replaced.
const legacyGhRecorded = Effect.map(
  Effect.context<ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom>(),
  (context) => recordedGithub((call) => Effect.runPromise(legacyGhReply(call).pipe(Effect.provideContext(context))))
);

/**
 * Hand every gh-login Yeet surface a client whose calls the suite's scripted
 * spawner answers as the `gh` calls they replaced.
 */
export const legacyGhGithubLayer = Layer.effect(
  YeetGithubLayer,
  Effect.map(legacyGhRecorded, (recorded) => O.some(recorded.layer))
);

/**
 * {@link legacyGhGithubLayer} plus the services themselves, for a suite whose
 * reads require them directly.
 */
export const legacyGhLayer: Layer.Layer<
  YeetGithubServices,
  never,
  ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom
> = Layer.unwrap(
  Effect.map(legacyGhRecorded, (recorded) =>
    Layer.merge(recorded.layer, Layer.succeed(YeetGithubLayer, O.some(recorded.layer)))
  )
);

/**
 * {@link legacyGhGithubLayer} for one effect, which also receives the services
 * directly (for a read that requires them): the spawner and `SecureRandom`
 * come from the effect's surroundings.
 */
export const provideLegacyGh = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<
  A,
  E,
  Exclude<R, YeetGithubServices> | ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom
> => Effect.flatMap(legacyGhRecorded, (recorded) => recorded.provide(effect));

/**
 * A REST `pulls/{n}` payload in the shape `GithubRest` and the kit's
 * `PullRequest` decode, with GitHub's values for every field a suite does not
 * name.
 */
export const restPullRequest = (overrides: Readonly<Record<string, unknown>> = {}): Record<string, unknown> => ({
  number: 7,
  node_id: "PR_kw7",
  title: "feat: a change",
  body: "",
  state: "open",
  draft: false,
  merged: false,
  merged_at: null,
  mergeable_state: "clean",
  head: { ref: "feat/a-change", sha: "abc1234def" },
  base: { ref: "main", sha: "base000000" },
  html_url: "https://github.com/beep-effect/beep-effect/pull/7",
  user: { login: "kriegcloud" },
  labels: [],
  created_at: "2026-10-06T10:00:00Z",
  updated_at: "2026-10-06T10:00:00Z",
  ...overrides,
});

/** What a `runRepoCommandCapture`-shaped fake printed for one `gh` call. */
export interface GhCapture {
  readonly exitCode: number;
  readonly output: string;
}

/** A `runRepoCommandCapture`-shaped fake: the argv in, what `gh` printed out. */
export type GhCaptureFake = (command: string, args: ReadonlyArray<string>, cwd: string) => Effect.Effect<GhCapture>;

/**
 * A recorded GitHub whose calls a `runRepoCommandCapture`-shaped fake answers
 * as the `gh` argv they replaced (`legacyGhArgs`), its output read back as
 * GitHub's answer (`legacyGhAnswer`).
 */
export const captureGithub = (capture: GhCaptureFake): RecordedGithub =>
  recordedGithub((call) =>
    Effect.runPromise(
      capture("gh", legacyGhArgs(call), ".").pipe(
        Effect.map((result) => legacyGhAnswer({ call, exitCode: result.exitCode, output: result.output }))
      )
    )
  );

// --- The monitor loop's former `capture` seam ----------------------------------
//
// Before W6 the merge loop read the head commit's committer date and the acting
// login through an injected `capture`; every other `gh` call went to the
// spawner. A suite keeps its fake: those two reads reach it as the argv they
// had (with their `--jq`), and its printed answer is lifted into GitHub's JSON;
// every other kit call reaches the suite's scripted spawner as `legacyGhArgs`.

const monitorSeamArgs = (call: GithubCall): O.Option<ReadonlyArray<string>> => {
  if (call.method !== "GET") return O.none();
  if (call.path === "/user") return O.some(["api", "user", "--jq", ".login"]);
  return O.map(Str.match(/^\{repo\}\/commits\/([^/]+)$/u)(call.path), (match) => [
    "api",
    `repos/{owner}/{repo}/commits/${match[1] ?? ""}`,
    "--jq",
    ".commit.committer.date",
  ]);
};

const monitorSeamAnswer = (call: GithubCall, result: GhCapture): GithubAnswer => {
  if (result.exitCode !== 0) return { status: 500, body: { message: result.output } };
  const printed = Str.trim(result.output);
  return call.path === "/user" ? { body: { login: printed } } : { body: { commit: { committer: { date: printed } } } };
};

const monitorGithub = (
  capture: GhCaptureFake,
  context: Context.Context<ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom>
): RecordedGithub =>
  recordedGithub((call) =>
    Effect.runPromise(
      O.match(monitorSeamArgs(call), {
        onSome: (args) => capture("gh", args, ".").pipe(Effect.map((result) => monitorSeamAnswer(call, result))),
        onNone: () => legacyGhReply(call).pipe(Effect.provideContext(context)),
      })
    )
  );

const monitorGithubLayerOf = (capture: GhCaptureFake) =>
  Effect.map(Effect.context<ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom>(), (context) =>
    O.some(monitorGithub(capture, context).layer)
  );

/**
 * Hand the merge loop's gh login a client whose head-commit and acting-login
 * reads `capture` answers, and whose other calls the scripted spawner answers.
 */
export const monitorGithubLayer = (capture: GhCaptureFake) =>
  Layer.effect(YeetGithubLayer, monitorGithubLayerOf(capture));

/** {@link monitorGithubLayer} for one effect. */
export const provideMonitorGh =
  (capture: GhCaptureFake) =>
  <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ): Effect.Effect<A, E, R | ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom> =>
    Effect.provideServiceEffect(effect, YeetGithubLayer, monitorGithubLayerOf(capture));

/**
 * Hand every gh-login Yeet surface a GitHub that answers every call 404, for a
 * suite whose seams keep GitHub out of the path but whose surface still builds
 * the gh login.
 */
export const offlineGithubLayer = Layer.succeed(YeetGithubLayer, O.some(recordedGithub(() => undefined).layer));
