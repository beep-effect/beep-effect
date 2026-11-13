/**
 * Session presence: each session's message routes, captured from its own
 * environment and kept as JSON Lines beside the session ledger.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { dual, flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { makeJsonLinesStore, makeMemoryJsonLinesStore, newestPerKey } from "../../internal/state/JsonLinesStore.ts";
import { resolveWorkstationStateDir } from "../../internal/state/WorkstationState.ts";
import { PrProvenanceEntrypoint, PrRepository } from "../Yeet/internal/Provenance.ts";
import {
  ClaudePeerRoute,
  SessionPresence,
  SessionPresenceJson,
  T3ThreadRoute,
  UnroutableRoute,
} from "./Route.schemas.ts";
import { localT3EnvironmentId } from "./RouteProbe.service.ts";
import { SessionLedgerError, sessionStatePlatformError } from "./Session.errors.ts";
import { sessionHarness } from "./SessionLedger.service.ts";
import type { PrProvenanceHarness } from "../Yeet/internal/Provenance.ts";
import type { SessionRoute } from "./Route.schemas.ts";
import type { SessionCheckoutFacts } from "./SessionLedger.service.ts";

const $I = $RepoCliId.create("commands/Session/Presence.service");
const equivalentRepository = S.toEquivalence(PrRepository);
const decodeEntrypoint = S.decodeUnknownOption(PrProvenanceEntrypoint);

/**
 * Service contract: append a presence row, or list every row of one repository.
 *
 * **Example** (Describe a list)
 *
 * ```ts
 * import { PrRepository } from "@beep/repo-cli/test/Session"
 * import type { SessionPresenceStoreShape } from "@beep/repo-cli/test/Session"
 *
 * const repository = PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" })
 * const listAll = (store: SessionPresenceStoreShape) => store.list(repository)
 * console.log(listAll.length) // 1
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface SessionPresenceStoreShape {
  readonly append: (row: SessionPresence) => Effect.Effect<void, SessionLedgerError>;
  readonly list: (repository: PrRepository) => Effect.Effect<ReadonlyArray<SessionPresence>, SessionLedgerError>;
}

/**
 * Context tag for the session presence store.
 *
 * **Example** (Request the store)
 *
 * ```ts
 * import { SessionPresenceStore } from "@beep/repo-cli/test/Session"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(Effect.gen(function* () { return yield* SessionPresenceStore }))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class SessionPresenceStore extends Context.Service<SessionPresenceStore, SessionPresenceStoreShape>()(
  $I`SessionPresenceStore`
) {}

/**
 * The presence file name for a repository, beside its ledger file.
 *
 * **Example** (Name the file)
 *
 * ```ts
 * import { PrRepository, sessionPresenceFileName } from "@beep/repo-cli/test/Session"
 *
 * console.log(sessionPresenceFileName(PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" })))
 * // "github.com__beep-effect__beep-effect.presence.jsonl"
 * ```
 *
 * @param repository - The GitHub repository the presence rows belong to.
 * @returns A JSON Lines file name with no local data in it.
 * @category formatting
 * @since 0.0.0
 */
export const sessionPresenceFileName = (repository: PrRepository): string =>
  `${repository.host}__${repository.owner}__${repository.name}.presence.jsonl`;

/**
 * Build the filesystem-backed presence store in the session state directory.
 *
 * **Example** (Build the live store effect)
 *
 * ```ts
 * import { makeSessionPresenceStoreLive } from "@beep/repo-cli/test/Session"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeSessionPresenceStoreLive())) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeSessionPresenceStoreLive = Effect.fn("SessionPresenceStore.makeLive")(function* () {
  const store = yield* makeJsonLinesStore({
    directory: yield* resolveWorkstationStateDir({ override: "BEEP_SESSION_STATE_ROOT", store: "sessions" }),
    fileName: sessionPresenceFileName,
    partitionOf: (row: SessionPresence) => row.repository,
    encode: flow(
      SessionPresenceJson.encode,
      Effect.mapError((cause) =>
        SessionLedgerError.make({ reason: "decode", message: "Failed to encode the session presence row.", cause })
      )
    ),
    decodeOption: SessionPresenceJson.decodeOption,
    onPlatformError: sessionStatePlatformError,
    label: { scope: "session", noun: "presence" },
  });
  return SessionPresenceStore.of(store);
});

/**
 * Live filesystem presence layer.
 *
 * **Example** (Provide the live store)
 *
 * ```ts
 * import { layerSessionPresenceStoreLive, SessionPresenceStore } from "@beep/repo-cli/test/Session"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () { return yield* SessionPresenceStore }).pipe(Effect.provide(layerSessionPresenceStoreLive))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerSessionPresenceStoreLive = Layer.effect(SessionPresenceStore, makeSessionPresenceStoreLive());

/**
 * In-memory presence layer for tests.
 *
 * **Example** (Provide the memory layer)
 *
 * ```ts
 * import { layerSessionPresenceStoreMemory, SessionPresenceStore } from "@beep/repo-cli/test/Session"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () { return yield* SessionPresenceStore }).pipe(Effect.provide(layerSessionPresenceStoreMemory))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const layerSessionPresenceStoreMemory = Layer.effect(
  SessionPresenceStore,
  makeMemoryJsonLinesStore({
    partitionOf: (row: SessionPresence) => row.repository,
    samePartition: equivalentRepository,
  }).pipe(Effect.map(SessionPresenceStore.of))
);

/**
 * The newest presence row for a session id.
 *
 * **Example** (No presence recorded)
 *
 * ```ts
 * import { latestPresence } from "@beep/repo-cli/test/Session"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(latestPresence([], "5f0c2b8e"))) // true
 * ```
 *
 * @param rows - Presence rows as read from the store.
 * @param sessionId - The session to look up.
 * @returns The newest row for that session, if any.
 * @category utilities
 * @since 0.0.0
 */
export const latestPresence: {
  (sessionId: string): (rows: ReadonlyArray<SessionPresence>) => O.Option<SessionPresence>;
  (rows: ReadonlyArray<SessionPresence>, sessionId: string): O.Option<SessionPresence>;
} = dual(
  2,
  (rows: ReadonlyArray<SessionPresence>, sessionId: string): O.Option<SessionPresence> =>
    A.findFirst(
      newestPerKey<SessionPresence>({ key: (row) => row.sessionId, at: (row) => row.recordedAt })(rows),
      (row) => row.sessionId === sessionId
    )
);

const optionalConfig = (name: string): Effect.Effect<O.Option<string>> =>
  Config.option(Config.String(name)).pipe(
    Effect.map(O.filter((value) => Str.isNonEmpty(Str.trim(value)))),
    Effect.orElseSucceed(O.none<string>)
  );

const UNROUTABLE_REASON: Record<PrProvenanceHarness, string> = {
  "claude-code": "Claude Code session without a recorded route",
  codex: "Codex outside T3 accepts no inbound message",
  cursor: "Cursor agent sessions accept no inbound message",
  grok: "Grok CLI sessions accept no inbound message",
  junie: "Junie CLI sessions accept no inbound message",
  unknown: "harness unknown; no inbound route",
};

/**
 * The routes a session can be reached by, preferred first: its T3 thread when
 * it runs in one, then its Claude peer address, else an `unroutable` route
 * that keeps the native id.
 *
 * **Example** (A Codex session outside T3)
 *
 * ```ts
 * import { routesFor } from "@beep/repo-cli/test/Session"
 * import * as O from "effect/Option"
 *
 * const routes = routesFor({ harness: "codex", sessionId: "019a", t3: O.none() })
 * console.log(routes[0]?._tag) // "unroutable"
 * ```
 *
 * @param input - The harness, its session id, and the T3 address from the environment.
 * @returns The routes, preferred first.
 * @category utilities
 * @since 0.0.0
 */
export const routesFor = (input: {
  readonly harness: PrProvenanceHarness;
  readonly sessionId: string;
  readonly t3: O.Option<{ readonly environmentId: string; readonly threadId: string }>;
}): ReadonlyArray<SessionRoute> => {
  const routes: ReadonlyArray<SessionRoute> = [
    ...O.match(input.t3, {
      onNone: A.empty<SessionRoute>,
      onSome: (t3) => [T3ThreadRoute.make({ ...t3, provider: input.harness })],
    }),
    ...(input.harness === "claude-code"
      ? [ClaudePeerRoute.make({ sessionId: input.sessionId, nameHint: O.none() })]
      : A.empty<SessionRoute>()),
  ];
  return A.isReadonlyArrayNonEmpty(routes)
    ? routes
    : [
        UnroutableRoute.make({
          harness: input.harness,
          nativeId: O.some(input.sessionId),
          reason: UNROUTABLE_REASON[input.harness],
        }),
      ];
};

/**
 * Build this process's presence row from its environment: the harness
 * identity the ledger uses, `CLAUDE_CODE_ENTRYPOINT`, and the T3 address
 * (`T3CODE_THREAD_ID` plus the local environment id). None when the process
 * has no session id.
 *
 * **Details**
 *
 * A CLI worker launched from a Claude shell inherits that session's id and T3
 * thread, so it records the same routes as its launcher and keeps resolving to
 * it.
 *
 * **Example** (Build the capture effect)
 *
 * ```ts
 * import { capturePresence, PrRepository } from "@beep/repo-cli/test/Session"
 * import * as Effect from "effect/Effect"
 *
 * const facts = {
 *   repository: PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" }),
 *   clone: "/work/beep-effect",
 *   checkout: "/work/beep-effect",
 *   lane: "beep-effect",
 *   branch: "main",
 * }
 * console.log(Effect.isEffect(capturePresence(facts))) // true
 * ```
 *
 * @param facts - The checkout the session is working in.
 * @returns The presence row, or none outside a harness session.
 * @category constructors
 * @since 0.0.0
 */
export const capturePresence = Effect.fn("SessionPresence.capture")(function* (facts: SessionCheckoutFacts) {
  const identity = yield* sessionHarness;
  if (O.isNone(identity.sessionId)) return O.none<SessionPresence>();
  const threadId = yield* optionalConfig("T3CODE_THREAD_ID");
  const environmentId = O.isSome(threadId) ? yield* localT3EnvironmentId : O.none<string>();
  const t3 = O.zipWith(environmentId, threadId, (env, thread) => ({ environmentId: env, threadId: thread }));
  const rawEntrypoint = yield* optionalConfig("CLAUDE_CODE_ENTRYPOINT");
  const claudeEntrypoint = O.flatMap(rawEntrypoint, decodeEntrypoint);
  const recordedAt = yield* DateTime.now;
  const entrypoint: PrProvenanceEntrypoint =
    identity.harness === "claude-code"
      ? O.getOrElse(claudeEntrypoint, () => "unknown" as const)
      : O.isSome(t3)
        ? "t3-code"
        : "unknown";
  return O.some(
    SessionPresence.make({
      schemaVersion: "session-presence/v1",
      repository: facts.repository,
      harness: identity.harness,
      entrypoint,
      sessionId: identity.sessionId.value,
      routes: routesFor({ harness: identity.harness, sessionId: identity.sessionId.value, t3 }),
      checkout: facts.checkout,
      branch: facts.branch,
      recordedAt,
    })
  );
});

/**
 * Capture this process's presence and append it, best effort: a process with
 * no session id or an unwritable state directory writes nothing and never
 * fails the caller.
 *
 * **Example** (Build the record effect)
 *
 * ```ts
 * import { PrRepository, recordPresence } from "@beep/repo-cli/test/Session"
 * import * as Effect from "effect/Effect"
 *
 * const facts = {
 *   repository: PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" }),
 *   clone: "/work/beep-effect",
 *   checkout: "/work/beep-effect",
 *   lane: "beep-effect",
 *   branch: "main",
 * }
 * console.log(Effect.isEffect(recordPresence(facts))) // true
 * ```
 *
 * @param facts - The checkout the session is working in.
 * @returns The row written, if any.
 * @category commands
 * @since 0.0.0
 */
export const recordPresence = Effect.fn("SessionPresence.record")(function* (facts: SessionCheckoutFacts) {
  const presence = yield* capturePresence(facts);
  if (O.isNone(presence)) return presence;
  const store = yield* SessionPresenceStore;
  return yield* store.append(presence.value).pipe(Effect.as(presence), Effect.orElseSucceed(O.none<SessionPresence>));
});
