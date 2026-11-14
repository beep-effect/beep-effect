/**
 * `session resolve`: join the ledger, the presence rows and the harness
 * indexes to find the session that owns a PR, branch, lane or checkout, every
 * route it exposes, each route's liveness now, and the call that reaches it.
 * Nothing here sends.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { newestPerKey } from "../../internal/state/JsonLinesStore.ts";
import { PrRepository } from "../Yeet/internal/Provenance.ts";
import { latestPresence, routesFor, SessionPresenceStore } from "./Presence.service.ts";
import {
  FallbackStep,
  ResolveKeyKind,
  RouteReading,
  SessionClaim,
  SessionResolution,
  SessionRoute,
  T3ThreadRoute,
  ViaParentRoute,
} from "./Route.schemas.ts";
import { SessionRouteProbe } from "./RouteProbe.service.ts";
import { SessionLedger } from "./SessionLedger.service.ts";
import type { PrNumber } from "../Yeet/internal/Provenance.ts";
import type { SessionPresence } from "./Route.schemas.ts";
import type { LinkedT3Environment, SessionRouteProbeShape } from "./RouteProbe.service.ts";
import type { SessionLedgerError } from "./Session.errors.ts";
import type { SessionLedgerRow } from "./Session.schemas.ts";

const $I = $RepoCliId.create("commands/Session/Resolve.service");

/**
 * What to resolve: the repository, the key as typed, and the directory a
 * relative checkout path is read against.
 *
 * **Example** (Describe a query)
 *
 * ```ts
 * import { PrRepository, SessionResolveInput } from "@beep/repo-cli/test/Session"
 *
 * const input = SessionResolveInput.make({
 *   repository: PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" }),
 *   query: "#3172",
 *   cwd: "/work/beep-effect",
 * })
 * console.log(input.query) // "#3172"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SessionResolveInput extends S.Opaque<SessionResolveInput, { readonly brand: unique symbol }>()(
  S.Struct({ repository: PrRepository, query: S.String, cwd: S.String }).pipe(
    $I.annoteSchema("SessionResolveInput", {
      description: "A resolve key, its repository and the directory it is read in.",
    })
  )
) {}

/**
 * Service contract: resolve one key to its owner and routes.
 *
 * **Example** (Describe a resolve)
 *
 * ```ts
 * import type { SessionResolverShape } from "@beep/repo-cli/test/Session"
 *
 * const resolveOne = (resolver: SessionResolverShape) => resolver.resolve
 * console.log(resolveOne.length) // 1
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface SessionResolverShape {
  readonly resolve: (input: SessionResolveInput) => Effect.Effect<SessionResolution, SessionLedgerError>;
}

/**
 * Context tag for the session resolver.
 *
 * **Example** (Request the resolver)
 *
 * ```ts
 * import { SessionResolver } from "@beep/repo-cli/test/Session"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(Effect.gen(function* () { return yield* SessionResolver }))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class SessionResolver extends Context.Service<SessionResolver, SessionResolverShape>()($I`SessionResolver`) {}

const PR_QUERY = /^#?([1-9][0-9]*)$/u;
const MESSAGE = "<message>";
const claimOrder = Order.mapInput(Order.Number, (claim: SessionClaim) => -DateTime.toEpochMillis(claim.claimedAt));
const quote = (value: string): string => `"${Str.replaceAll('"', '\\"')(value)}"`;

type ClaimKey = { readonly query: string; readonly pr: O.Option<number>; readonly checkout: string };

const parsePr = (query: string): O.Option<number> =>
  O.map(Str.match(PR_QUERY)(Str.trim(query)), (match) => Number(match[1]));

/**
 * Collapse the ledger into the checkouts that claim a key, newest claim first.
 *
 * **Details**
 *
 * A checkout claims the key when its newest row names it: the same branch,
 * lane or checkout path, or the PR number (also when the newest row omits the
 * PR but an earlier row on the same branch carried it). A checkout whose
 * newest row is `done` claims nothing. The claim's time is the newest row that
 * names the key, so a takeover's first row outranks the previous owner.
 *
 * **Example** (No rows, no claims)
 *
 * ```ts
 * import { claimsFor } from "@beep/repo-cli/test/Session"
 * import * as O from "effect/Option"
 *
 * console.log(claimsFor([], { query: "3172", pr: O.some(3172), checkout: "/work/3172" }).length) // 0
 * ```
 *
 * @param rows - Every ledger row of the repository.
 * @param key - The query, its PR number if it is one, and the absolute path it would name.
 * @returns Claims ordered newest first.
 * @category utilities
 * @since 0.0.0
 */
export const claimsFor: {
  (key: ClaimKey): (rows: ReadonlyArray<SessionLedgerRow>) => ReadonlyArray<SessionClaim>;
  (rows: ReadonlyArray<SessionLedgerRow>, key: ClaimKey): ReadonlyArray<SessionClaim>;
} = dual(2, (rows: ReadonlyArray<SessionLedgerRow>, key: ClaimKey): ReadonlyArray<SessionClaim> => {
  const query = Str.trim(key.query);
  const newest = newestPerKey<SessionLedgerRow>({ key: (row) => row.checkout, at: (row) => row.recordedAt })(rows);
  const claimOf = (latest: SessionLedgerRow): O.Option<SessionClaim> => {
    if (latest.state === "done") return O.none();
    const history = A.filter(rows, (row) => row.checkout === latest.checkout);
    const prRows = O.match(key.pr, {
      onNone: A.empty<SessionLedgerRow>,
      onSome: (pr) =>
        A.filter(
          history,
          (row) =>
            O.exists(row.pr, (value) => value === pr) &&
            (O.isSome(latest.pr) ? O.exists(latest.pr, (value) => value === pr) : row.branch === latest.branch)
        ),
    });
    const matchedBy = A.filter(ResolveKeyKind.literals, (kind) =>
      ResolveKeyKind.match(kind, {
        pr: () => A.isReadonlyArrayNonEmpty(prRows),
        branch: () => latest.branch === query,
        lane: () => latest.lane === query,
        checkout: () => latest.checkout === key.checkout,
      })
    );
    if (!A.isReadonlyArrayNonEmpty(matchedBy)) return O.none();
    // Matched by PR alone: the claim dates from the newest row that named the PR.
    const claimedAt = A.match(A.length(matchedBy) === 1 ? prRows : A.empty<SessionLedgerRow>(), {
      onEmpty: () => latest.recordedAt,
      onNonEmpty: (named) =>
        A.reduce(A.tailNonEmpty(named), A.headNonEmpty(named).recordedAt, (at, row) =>
          DateTime.max(at, row.recordedAt)
        ),
    });
    return O.some(
      SessionClaim.make({
        checkout: latest.checkout,
        lane: latest.lane,
        branch: latest.branch,
        pr: O.isSome(latest.pr) ? latest.pr : O.flatMap(A.last(prRows), (row) => row.pr),
        harness: latest.harness,
        sessionId: latest.sessionId,
        state: latest.state,
        next: latest.next,
        matchedBy,
        claimedAt,
      })
    );
  };
  return A.sort(A.getSomes(A.map(newest, claimOf)), claimOrder);
});

/**
 * The literal `t3_thread_send` call for a thread route, carrying both ids.
 *
 * **Example** (Render a thread send)
 *
 * ```ts
 * import { renderT3Send, T3ThreadRoute } from "@beep/repo-cli/test/Session"
 *
 * const route = T3ThreadRoute.make({ environmentId: "env-1", threadId: "thread-1", provider: "codex" })
 * console.log(renderT3Send(route))
 * // t3_thread_send({ threadId: "thread-1", environmentId: "env-1", message: "<message>" })
 * ```
 *
 * @param route - The thread to reach.
 * @returns The MCP call to make.
 * @category formatting
 * @since 0.0.0
 */
export const renderT3Send = (route: T3ThreadRoute): string =>
  `t3_thread_send({ threadId: ${quote(route.threadId)}, environmentId: ${quote(route.environmentId)}, message: "${MESSAGE}" })`;

/**
 * The literal `SendMessage` call for a same-host Claude session, by its
 * current display name.
 *
 * **Example** (Render a peer send)
 *
 * ```ts
 * import { renderPeerSend } from "@beep/repo-cli/test/Session"
 *
 * console.log(renderPeerSend("outbox draft basis"))
 * // SendMessage({ to: "outbox draft basis", message: "<message>" })
 * ```
 *
 * @param name - The session's display name read from the live index now.
 * @returns The tool call to make.
 * @category formatting
 * @since 0.0.0
 */
export const renderPeerSend = (name: string): string => `SendMessage({ to: ${quote(name)}, message: "${MESSAGE}" })`;

const readRoute = (probe: SessionRouteProbeShape, route: SessionRoute): Effect.Effect<ReadonlyArray<RouteReading>> =>
  SessionRoute.match(route, {
    "t3-thread": Effect.fnUntraced(function* (route) {
      const probed = yield* probe.t3Thread(route);
      const own = RouteReading.make({
        route,
        liveness: probed.liveness,
        detail: probed.detail,
        currentName: probed.currentName,
        // A child keeps its own send only while it runs; a finished child would
        // start a fresh task, so its parent's route below carries the send.
        send:
          probed.liveness === "dead" || (O.isSome(probed.parentThreadId) && probed.liveness !== "live")
            ? O.none()
            : O.some(renderT3Send(route)),
      });
      // A T3 child thread's working route is its parent: a send to a
      // finished child starts a fresh task instead of reaching the work, so
      // the parent's reading comes first and wins a tie on liveness.
      const parent = yield* O.match(probed.parentThreadId, {
        onNone: () => Effect.succeed(A.empty<RouteReading>()),
        onSome: (threadId) =>
          readRoute(
            probe,
            ViaParentRoute.make({
              parent: T3ThreadRoute.make({ environmentId: route.environmentId, threadId, provider: route.provider }),
              childKind: "t3-child",
            })
          ),
      });
      return A.append(parent, own);
    }),
    "claude-peer": (route) =>
      probe.claudePeer(route.sessionId).pipe(
        Effect.map((probed) => [
          RouteReading.make({
            route,
            liveness: probed.liveness,
            detail:
              probed.liveness === "live" && O.isNone(probed.currentName)
                ? `${probed.detail}; the session has no display name yet`
                : probed.detail,
            currentName: probed.currentName,
            send: probed.liveness === "live" ? O.map(probed.currentName, renderPeerSend) : O.none(),
          }),
        ])
      ),
    "via-parent": (route) =>
      readRoute(probe, route.parent).pipe(
        Effect.map((parents) =>
          O.match(A.head(parents), {
            onNone: A.empty<RouteReading>,
            onSome: (parent) => [
              RouteReading.make({
                route,
                liveness: parent.liveness,
                detail: `${route.childKind} child; reached through its parent: ${parent.detail}`,
                currentName: parent.currentName,
                send: parent.send,
              }),
            ],
          })
        )
      ),
    unroutable: (route) =>
      Effect.succeed([
        RouteReading.make({
          route,
          liveness: "unknown",
          detail: route.reason,
          currentName: O.none(),
          send: O.none(),
        }),
      ]),
  });

const localSearchStep = (query: string, local: O.Option<string>): ReadonlyArray<FallbackStep> =>
  O.match(local, {
    onNone: A.empty<FallbackStep>,
    onSome: (id) => [
      FallbackStep.make({
        rung: "search-environments",
        instruction: `this host: t3_thread_search({ query: ${quote(query)}, environmentId: ${quote(id)} })`,
      }),
    ],
  });

const searchSteps = (
  query: string,
  local: O.Option<string>,
  linked: O.Option<ReadonlyArray<LinkedT3Environment>>
): ReadonlyArray<FallbackStep> =>
  O.match(linked, {
    onNone: () => [
      FallbackStep.make({
        rung: "search-environments",
        instruction: `No local owner. List the linked environments with t3_environment_links, then run t3_thread_search({ query: ${quote(query)}, environmentId: "<each id>" }) on each.`,
      }),
    ],
    onSome: (environments) => [
      ...localSearchStep(query, local),
      ...A.map(environments, (environment) =>
        FallbackStep.make({
          rung: "search-environments",
          instruction: `${environment.label} (${environment.status}): t3_thread_search({ query: ${quote(query)}, environmentId: ${quote(environment.environmentId)} })`,
        })
      ),
    ],
  });

const prCommentStep = (pr: O.Option<number>): ReadonlyArray<FallbackStep> =>
  O.match(pr, {
    onNone: () => [
      FallbackStep.make({
        rung: "pr-comment",
        instruction:
          "No PR is recorded for this key; once it has one, comment there (it reaches an owner that runs a monitor).",
      }),
    ],
    onSome: (number) => [
      FallbackStep.make({
        rung: "pr-comment",
        instruction: `bun run beep yeet gh pr comment ${number} --body "${MESSAGE}"`,
      }),
    ],
  });

const takeoverStep = (pr: O.Option<number>, branch: O.Option<string>): FallbackStep => {
  const label = O.match(pr, { onNone: () => "lane", onSome: (number) => `${number}` });
  const target = O.getOrElse(branch, () => "<pr branch>");
  return FallbackStep.make({
    rung: "takeover",
    instruction: `If the owner is dead and work is owed: confirm the lane is not live, then bun run beep worktree new takeover-${label} --branch takeover/${label} --base origin/${target}; first act there: bun run beep session note${O.match(pr, { onNone: () => "", onSome: (number) => ` --pr ${number}` })} --next "took over ${target}"; push with git push origin HEAD:${target} after asserting the remote head.`,
  });
};

// Presence routes when the session recorded them; otherwise what its harness
// alone allows (a Claude peer by id, or unroutable).
const ownerRoutes = (
  presenceRows: ReadonlyArray<SessionPresence>,
  owner: SessionClaim,
  sessionId: string
): ReadonlyArray<SessionRoute> =>
  O.match(latestPresence(presenceRows, sessionId), {
    onNone: () => routesFor({ harness: owner.harness, sessionId, t3: O.none() }),
    onSome: (row) => row.routes,
  });

const ownerSteps = (readings: ReadonlyArray<RouteReading>, owner: SessionClaim): ReadonlyArray<FallbackStep> => {
  // The send call of the first route at a liveness, in route order.
  const first = (liveness: RouteReading["liveness"]): O.Option<string> =>
    A.findFirst(readings, (reading) => (reading.liveness === liveness ? reading.send : O.none()));
  const live = first("live");
  if (O.isSome(live)) return [FallbackStep.make({ rung: "send", instruction: live.value })];
  const dormant = first("dormant");
  if (O.isSome(dormant)) {
    return [FallbackStep.make({ rung: "wake", instruction: `${dormant.value}  # wakes the idle thread` })];
  }
  const leading = A.flatten([
    O.match(first("unknown"), {
      onNone: A.empty<FallbackStep>,
      onSome: (send) => [
        FallbackStep.make({
          rung: "send",
          instruction: `${send}  # liveness unknown: send, then confirm with t3_thread_read`,
        }),
      ],
    }),
    O.match(first("unreachable"), {
      onNone: A.empty<FallbackStep>,
      onSome: (send) => [
        FallbackStep.make({
          rung: "retry",
          instruction: `${send}  # environment did not answer: retry, then fall back to the PR comment`,
        }),
      ],
    }),
  ]);
  return [...leading, ...prCommentStep(owner.pr), takeoverStep(owner.pr, O.some(owner.branch))];
};

/**
 * Build the resolver over the ledger, the presence store and the route probe.
 *
 * **Example** (Build the resolver effect)
 *
 * ```ts
 * import { makeSessionResolver } from "@beep/repo-cli/test/Session"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeSessionResolver())) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeSessionResolver = Effect.fn("SessionResolver.make")(function* () {
  const ledger = yield* SessionLedger;
  const presence = yield* SessionPresenceStore;
  const probe = yield* SessionRouteProbe;
  const path = yield* Path.Path;

  const resolve = Effect.fn("SessionResolver.resolve")(function* (input: SessionResolveInput) {
    const query = Str.trim(input.query);
    const pr = parsePr(query);
    const rows = yield* ledger.list(input.repository);
    const claims = claimsFor(rows, { query, pr, checkout: path.resolve(input.cwd, query) });
    const owner = A.head(claims);
    if (O.isNone(owner)) {
      const local = yield* probe.localEnvironmentId;
      const linked = yield* probe.environments;
      return SessionResolution.make({
        schemaVersion: "session-resolution/v1",
        query,
        repository: input.repository,
        owner: O.none(),
        superseded: [],
        routes: [],
        steps: [...searchSteps(query, local, linked), ...prCommentStep(pr), takeoverStep(pr, O.none())],
      });
    }
    const presenceRows = yield* presence.list(input.repository);
    const routes = O.match(owner.value.sessionId, {
      onNone: A.empty<SessionRoute>,
      onSome: (sessionId) => ownerRoutes(presenceRows, owner.value, sessionId),
    });
    const perRoute = yield* Effect.forEach(routes, (route) => readRoute(probe, route));
    const readings = A.flatten(perRoute);
    return SessionResolution.make({
      schemaVersion: "session-resolution/v1",
      query,
      repository: input.repository,
      owner,
      superseded: A.drop(claims, 1),
      routes: readings,
      steps: ownerSteps(readings, owner.value),
    });
  });

  return SessionResolver.of({ resolve });
});

/**
 * Resolver layer; provide the ledger, the presence store and a route probe.
 *
 * **Example** (Read the layer)
 *
 * ```ts
 * import { layerSessionResolver } from "@beep/repo-cli/test/Session"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(layerSessionResolver)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerSessionResolver = Layer.effect(SessionResolver, makeSessionResolver());

/**
 * Render a resolution as the operator reads it: owner, superseded claims,
 * each route with its liveness and send call, then the steps.
 *
 * **Example** (Render a key with no owner)
 *
 * ```ts
 * import { PrRepository, renderSessionResolution, SessionResolution } from "@beep/repo-cli/test/Session"
 * import * as O from "effect/Option"
 *
 * const resolution = SessionResolution.make({
 *   schemaVersion: "session-resolution/v1",
 *   query: "3172",
 *   repository: PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" }),
 *   owner: O.none(),
 *   superseded: [],
 *   routes: [],
 *   steps: [],
 * })
 * console.log(renderSessionResolution(resolution).split("\n")[0])
 * // [session:resolve] 3172: no owner on this host
 * ```
 *
 * @param resolution - The resolution to render.
 * @returns Report lines joined by newlines.
 * @category formatting
 * @since 0.0.0
 */
export const renderSessionResolution = (resolution: SessionResolution): string => {
  const claimLine = (claim: SessionClaim): string =>
    `${claim.lane} (${claim.branch}${O.match(claim.pr, { onNone: () => "", onSome: (pr: PrNumber) => `, PR #${pr}` })}) ${claim.state} by ${claim.harness} session ${O.getOrElse(claim.sessionId, () => "unknown")}, claimed ${DateTime.formatIso(claim.claimedAt)} (matched ${A.join(claim.matchedBy, ", ")})`;
  const routeLines = (reading: RouteReading): ReadonlyArray<string> => [
    `  route ${reading.route._tag}${O.match(reading.currentName, { onNone: () => "", onSome: (name) => ` "${name}"` })}: ${reading.liveness} (${reading.detail})`,
    ...O.match(reading.send, { onNone: A.empty<string>, onSome: (send) => [`    send: ${send}`] }),
  ];
  return A.join(
    [
      ...O.match(resolution.owner, {
        onNone: () => [`[session:resolve] ${resolution.query}: no owner on this host`],
        onSome: (owner) => [
          `[session:resolve] ${resolution.query}: owner ${claimLine(owner)}`,
          `  checkout: ${owner.checkout}`,
          `  next: ${owner.next}`,
        ],
      }),
      ...A.map(resolution.superseded, (claim) => `  superseded: ${claimLine(claim)}`),
      ...A.flatMap(resolution.routes, routeLines),
      ...(O.isSome(resolution.owner) && !A.isReadonlyArrayNonEmpty(resolution.routes)
        ? ["  routes: none recorded (the claim has no session id)"]
        : A.empty<string>()),
      ...A.map(resolution.steps, (step, index) => `  ${index + 1}. ${step.rung}: ${step.instruction}`),
    ],
    "\n"
  );
};
