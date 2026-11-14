/**
 * Session routes: how a message reaches the session that owns a PR, branch,
 * lane or checkout, how alive each route is right now, and the resolution
 * `session resolve` prints.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { JsonStringCodec } from "@beep/repo-cli-kit/schema/JsonCodec";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { PrNumber, PrProvenanceEntrypoint, PrProvenanceHarness, PrRepository } from "../Yeet/internal/Provenance.ts";
import { SessionLedgerState } from "./Session.schemas.ts";

const $I = $RepoCliId.create("commands/Session/Route.schemas");

/**
 * What kind of child reaches the world through its parent's route.
 *
 * **Example** (Narrow a child kind)
 *
 * ```ts
 * import { SessionChildKind } from "@beep/repo-cli/test/Session"
 *
 * console.log(SessionChildKind.is["t3-child"]("t3-child")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SessionChildKind = LiteralKit(["agent-tool", "workflow", "t3-child", "codex-subagent", "cli-worker"]).pipe(
  $I.annoteSchema("SessionChildKind", { description: "A child session kind whose messages go through its parent." })
);

/**
 * A child session kind whose messages go through its parent.
 *
 * @category models
 * @since 0.0.0
 */
export type SessionChildKind = typeof SessionChildKind.Type;

/**
 * How reachable a route is at the moment it is read. Never stored.
 *
 * **Details**
 *
 * `live` takes a message now; `dormant` is a T3 thread that a send wakes;
 * `unreachable` is an environment that does not answer; `dead` is a session
 * that no longer exists; `unknown` means the evidence could not be read and is
 * never treated as `dead`.
 *
 * **Example** (Narrow a liveness)
 *
 * ```ts
 * import { RouteLiveness } from "@beep/repo-cli/test/Session"
 *
 * console.log(RouteLiveness.is.unknown("unknown")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RouteLiveness = LiteralKit(["live", "dormant", "unreachable", "dead", "unknown"]).pipe(
  $I.annoteSchema("RouteLiveness", { description: "How reachable a session route is when it is read." })
);

/**
 * How reachable a session route is when it is read.
 *
 * @category models
 * @since 0.0.0
 */
export type RouteLiveness = typeof RouteLiveness.Type;

/**
 * A T3 thread on one environment: durable, and the only route that crosses
 * hosts. A send to an idle thread starts it.
 *
 * **Gotchas**
 *
 * Thread ids are opaque and can exceed 300 characters. Store and print them
 * verbatim; never parse or shorten them.
 *
 * **Example** (Make a thread route)
 *
 * ```ts
 * import { T3ThreadRoute } from "@beep/repo-cli/test/Session"
 *
 * const route = T3ThreadRoute.make({ environmentId: "env-1", threadId: "mcp:launch:abc", provider: "claude-code" })
 * console.log(route._tag) // "t3-thread"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class T3ThreadRoute extends S.Opaque<T3ThreadRoute, { readonly brand: unique symbol }>()(
  S.TaggedStruct("t3-thread", {
    environmentId: S.NonEmptyString,
    threadId: S.NonEmptyString,
    provider: PrProvenanceHarness,
  }).pipe($I.annoteSchema("T3ThreadRoute", { description: "A T3 thread address: environment id plus thread id." }))
) {}

/**
 * A Claude Code session on the same host, addressed by its session id. The
 * display name `SendMessage` needs is looked up when the call is printed.
 *
 * **Example** (Make a peer route)
 *
 * ```ts
 * import { ClaudePeerRoute } from "@beep/repo-cli/test/Session"
 * import * as O from "effect/Option"
 *
 * const route = ClaudePeerRoute.make({ sessionId: "5f0c2b8e-0000-4000-8000-000000000000", nameHint: O.none() })
 * console.log(route._tag) // "claude-peer"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaudePeerRoute extends S.Opaque<ClaudePeerRoute, { readonly brand: unique symbol }>()(
  S.TaggedStruct("claude-peer", {
    sessionId: S.NonEmptyString,
    nameHint: S.OptionFromNullOr(S.String),
  }).pipe($I.annoteSchema("ClaudePeerRoute", { description: "A same-host Claude Code session addressed by id." }))
) {}

/**
 * A session no message can reach. It keeps the harness's native id so a
 * takeover can read the session's history.
 *
 * **Example** (Make an unroutable route)
 *
 * ```ts
 * import { UnroutableRoute } from "@beep/repo-cli/test/Session"
 * import * as O from "effect/Option"
 *
 * const route = UnroutableRoute.make({ harness: "codex", nativeId: O.some("019a"), reason: "Codex outside T3 takes no inbound message" })
 * console.log(route._tag) // "unroutable"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UnroutableRoute extends S.Opaque<UnroutableRoute, { readonly brand: unique symbol }>()(
  S.TaggedStruct("unroutable", {
    harness: PrProvenanceHarness,
    nativeId: S.OptionFromNullOr(S.String),
    reason: S.String,
  }).pipe($I.annoteSchema("UnroutableRoute", { description: "A session with no inbound message route." }))
) {}

const SessionRouteRef = S.suspend((): S.Codec<SessionRoute.Type, SessionRoute.Encoded> => SessionRoute);

/**
 * A child that is reached through its parent: an Agent-tool or Workflow child,
 * a T3 child thread, or a CLI worker launched by a session.
 *
 * **Example** (Route a T3 child through its parent)
 *
 * ```ts
 * import { T3ThreadRoute, ViaParentRoute } from "@beep/repo-cli/test/Session"
 *
 * const parent = T3ThreadRoute.make({ environmentId: "env-1", threadId: "parent", provider: "codex" })
 * const route = ViaParentRoute.make({ parent, childKind: "t3-child" })
 * console.log(route.parent._tag) // "t3-thread"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ViaParentRoute extends S.Opaque<ViaParentRoute, { readonly brand: unique symbol }>()(
  S.TaggedStruct("via-parent", {
    parent: SessionRouteRef,
    childKind: SessionChildKind,
  }).pipe($I.annoteSchema("ViaParentRoute", { description: "A child session reached through its parent's route." }))
) {}

type SessionRouteShape = T3ThreadRoute | ClaudePeerRoute | ViaParentRoute | UnroutableRoute;

interface ViaParentRouteEncoded {
  readonly _tag: "via-parent";
  readonly childKind: SessionChildKind;
  readonly parent: SessionRouteEncoded;
}

type SessionRouteEncoded =
  | typeof T3ThreadRoute.Encoded
  | typeof ClaudePeerRoute.Encoded
  | typeof UnroutableRoute.Encoded
  | ViaParentRouteEncoded;

/**
 * Every way a message can reach a session, tagged by route kind.
 *
 * **Example** (Decode a recursive route)
 *
 * ```ts
 * import { SessionRoute } from "@beep/repo-cli/test/Session"
 * import * as S from "effect/Schema"
 *
 * const route = S.decodeUnknownSync(SessionRoute)({
 *   _tag: "via-parent",
 *   childKind: "cli-worker",
 *   parent: { _tag: "claude-peer", sessionId: "5f0c2b8e", nameHint: null },
 * })
 * console.log(route._tag) // "via-parent"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SessionRoute = S.Union([T3ThreadRoute, ClaudePeerRoute, ViaParentRoute, UnroutableRoute]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("SessionRoute", { description: "A message route to a session, tagged by route kind." })
) satisfies S.Codec<SessionRouteShape, SessionRouteEncoded>;

/**
 * Decoded and encoded sides of {@link SessionRoute}.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace SessionRoute {
  /**
   * A decoded session route.
   *
   * **Example** (Annotate a route)
   *
   * ```ts
   * import { ClaudePeerRoute } from "@beep/repo-cli/test/Session"
   * import type { SessionRoute } from "@beep/repo-cli/test/Session"
   * import * as O from "effect/Option"
   *
   * const route: SessionRoute.Type = ClaudePeerRoute.make({ sessionId: "5f0c2b8e", nameHint: O.none() })
   * console.log(route._tag) // "claude-peer"
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Type = SessionRouteShape;
  /**
   * The JSON shape of a session route.
   *
   * **Example** (Write an encoded route)
   *
   * ```ts
   * import type { SessionRoute } from "@beep/repo-cli/test/Session"
   *
   * const encoded: SessionRoute.Encoded = { _tag: "claude-peer", sessionId: "5f0c2b8e", nameHint: null }
   * console.log(encoded._tag) // "claude-peer"
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = SessionRouteEncoded;
}

/**
 * A decoded session route.
 *
 * @category models
 * @since 0.0.0
 */
export type SessionRoute = SessionRouteShape;

/**
 * One session's routes, recorded from its own environment at start.
 *
 * **Details**
 *
 * Rows are JSON Lines in workstation state beside the session ledger; the
 * newest row per `sessionId` wins. Presence is never a claim on a checkout:
 * `checkout` and `branch` say where the session started, and ownership stays
 * with the ledger.
 *
 * **Example** (Make a presence row)
 *
 * ```ts
 * import { ClaudePeerRoute, PrRepository, SessionPresence } from "@beep/repo-cli/test/Session"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const presence = SessionPresence.make({
 *   schemaVersion: "session-presence/v1",
 *   repository: PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" }),
 *   harness: "claude-code",
 *   entrypoint: "claude-desktop",
 *   sessionId: "5f0c2b8e",
 *   routes: [ClaudePeerRoute.make({ sessionId: "5f0c2b8e", nameHint: O.none() })],
 *   checkout: "/work/beep-effect",
 *   branch: "main",
 *   recordedAt: DateTime.makeUnsafe(0),
 * })
 * console.log(presence.routes.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SessionPresence extends S.Opaque<SessionPresence, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("session-presence/v1"),
    repository: PrRepository,
    harness: PrProvenanceHarness,
    entrypoint: PrProvenanceEntrypoint,
    sessionId: S.NonEmptyString,
    routes: S.Array(SessionRoute),
    checkout: S.String,
    branch: S.String,
    recordedAt: S.DateTimeUtcFromString,
  }).pipe(
    $I.annoteSchema("SessionPresence", {
      description: "A session's message routes, preferred first, recorded from its own environment.",
    })
  )
) {}

/**
 * JSON-string codec for one presence row (one JSON Lines entry).
 *
 * **Example** (Reject a torn line)
 *
 * ```ts
 * import { SessionPresenceJson } from "@beep/repo-cli/test/Session"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(SessionPresenceJson.decodeOption("{"))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const SessionPresenceJson = JsonStringCodec(SessionPresence);

/**
 * Which field of a ledger row a resolve key matched.
 *
 * **Example** (Narrow a key kind)
 *
 * ```ts
 * import { ResolveKeyKind } from "@beep/repo-cli/test/Session"
 *
 * console.log(ResolveKeyKind.is.pr("pr")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ResolveKeyKind = LiteralKit(["pr", "branch", "lane", "checkout"]).pipe(
  $I.annoteSchema("ResolveKeyKind", { description: "The ledger field a resolve key matched." })
);

/**
 * The ledger field a resolve key matched.
 *
 * @category models
 * @since 0.0.0
 */
export type ResolveKeyKind = typeof ResolveKeyKind.Type;

/**
 * One checkout's claim on a key: its newest ledger row, and when it last named
 * the key.
 *
 * **Example** (Make a claim)
 *
 * ```ts
 * import { SessionClaim } from "@beep/repo-cli/test/Session"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const claim = SessionClaim.make({
 *   checkout: "/work/lane",
 *   lane: "lane",
 *   branch: "feat/lane",
 *   pr: O.none(),
 *   harness: "codex",
 *   sessionId: O.none(),
 *   state: "open",
 *   next: "publish",
 *   matchedBy: ["lane"],
 *   claimedAt: DateTime.makeUnsafe(0),
 * })
 * console.log(claim.lane) // "lane"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SessionClaim extends S.Opaque<SessionClaim, { readonly brand: unique symbol }>()(
  S.Struct({
    checkout: S.String,
    lane: S.String,
    branch: S.String,
    pr: S.OptionFromNullOr(PrNumber),
    harness: PrProvenanceHarness,
    sessionId: S.OptionFromNullOr(S.String),
    state: SessionLedgerState,
    next: S.String,
    matchedBy: S.Array(ResolveKeyKind),
    claimedAt: S.DateTimeUtcFromString,
  }).pipe(
    $I.annoteSchema("SessionClaim", {
      description: "A checkout's newest ledger row for a key and when it last named that key.",
    })
  )
) {}

/**
 * What a probe read about one route, before the send call is rendered.
 *
 * **Example** (Make an unknown reading)
 *
 * ```ts
 * import { RouteProbeReading } from "@beep/repo-cli/test/Session"
 * import * as O from "effect/Option"
 *
 * const reading = RouteProbeReading.make({ liveness: "unknown", detail: "index unreadable", currentName: O.none(), parentThreadId: O.none() })
 * console.log(reading.liveness) // "unknown"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RouteProbeReading extends S.Opaque<RouteProbeReading, { readonly brand: unique symbol }>()(
  S.Struct({
    liveness: RouteLiveness,
    detail: S.String,
    currentName: S.OptionFromNullOr(S.String),
    parentThreadId: S.OptionFromNullOr(S.String),
  }).pipe(
    $I.annoteSchema("RouteProbeReading", {
      description: "A route's computed liveness, the evidence for it, and the names it found.",
    })
  )
) {}

/**
 * One route of the owner, its liveness at read time, and the literal call that
 * reaches it.
 *
 * **Example** (Make a reading)
 *
 * ```ts
 * import { ClaudePeerRoute, RouteReading } from "@beep/repo-cli/test/Session"
 * import * as O from "effect/Option"
 *
 * const reading = RouteReading.make({
 *   route: ClaudePeerRoute.make({ sessionId: "5f0c2b8e", nameHint: O.none() }),
 *   liveness: "dead",
 *   detail: "no live index entry",
 *   currentName: O.none(),
 *   send: O.none(),
 * })
 * console.log(reading.liveness) // "dead"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RouteReading extends S.Opaque<RouteReading, { readonly brand: unique symbol }>()(
  S.Struct({
    route: SessionRoute,
    liveness: RouteLiveness,
    detail: S.String,
    currentName: S.OptionFromNullOr(S.String),
    send: S.OptionFromNullOr(S.String),
  }).pipe($I.annoteSchema("RouteReading", { description: "A route with its computed liveness and its send call." }))
) {}

/**
 * The rungs of the fallback ladder, first to last.
 *
 * **Example** (Narrow a rung)
 *
 * ```ts
 * import { FallbackRung } from "@beep/repo-cli/test/Session"
 *
 * console.log(FallbackRung.is.takeover("takeover")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FallbackRung = LiteralKit(["send", "wake", "retry", "search-environments", "pr-comment", "takeover"]).pipe(
  $I.annoteSchema("FallbackRung", { description: "One rung of the route fallback ladder." })
);

/**
 * One rung of the route fallback ladder.
 *
 * @category models
 * @since 0.0.0
 */
export type FallbackRung = typeof FallbackRung.Type;

/**
 * One step the caller takes, in order.
 *
 * **Example** (Make a step)
 *
 * ```ts
 * import { FallbackStep } from "@beep/repo-cli/test/Session"
 *
 * console.log(FallbackStep.make({ rung: "pr-comment", instruction: "comment on the PR" }).rung) // "pr-comment"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FallbackStep extends S.Opaque<FallbackStep, { readonly brand: unique symbol }>()(
  S.Struct({ rung: FallbackRung, instruction: S.String }).pipe(
    $I.annoteSchema("FallbackStep", { description: "One step toward the owner, as a literal instruction." })
  )
) {}

/**
 * The `session resolve` answer: owner, superseded claims, every route with its
 * liveness and send call, and the steps to take.
 *
 * **Example** (Make an empty resolution)
 *
 * ```ts
 * import { PrRepository, SessionResolution } from "@beep/repo-cli/test/Session"
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
 * console.log(O.isNone(resolution.owner)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SessionResolution extends S.Opaque<SessionResolution, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("session-resolution/v1"),
    query: S.String,
    repository: PrRepository,
    owner: S.OptionFromNullOr(SessionClaim),
    superseded: S.Array(SessionClaim),
    routes: S.Array(RouteReading),
    steps: S.Array(FallbackStep),
  }).pipe(
    $I.annoteSchema("SessionResolution", {
      description: "The owning session of a key, its routes with liveness, and the steps to reach it.",
    })
  )
) {}

/**
 * JSON-string codec for {@link SessionResolution}, the `--json` document.
 *
 * **Example** (Reject an empty object)
 *
 * ```ts
 * import { SessionResolutionJson } from "@beep/repo-cli/test/Session"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(SessionResolutionJson.decodeOption("{}"))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const SessionResolutionJson = JsonStringCodec(SessionResolution);
