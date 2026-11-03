/**
 * Raw ACP generation-1 peer shared by the managed Grok and Cursor fixtures.
 *
 * `@beep/acp`'s agent serves only ACP v2, while the real Grok and Cursor CLIs still answer v1.
 * These fixtures therefore speak v1 directly over the JSON-RPC transport: every inbound request
 * reaches `onExtRequest` (no typed RPC methods are registered) and is answered with JSON encoded
 * through the generated `SchemaV1` schemas, so the client takes its generation-1 path end to end.
 *
 * The peer writes the params of every inbound request to `received-<method>.json` in its HOME
 * (`/` becomes `-`; the latest request of a method wins), so tests can assert the exact handshake
 * wire. Handshake routes decode their params through the generated v1 request schemas.
 */
import { AcpRequestError } from "@beep/acp/errors";
import * as Protocol from "@beep/acp/protocol";
import * as SchemaV1 from "@beep/acp/schema-v1";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Config from "effect/Config";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Stdio from "effect/Stdio";
import * as Str from "effect/String";
import { fixtureStallAt } from "./session-options.ts";
import type * as AcpErrors from "@beep/acp/errors";

/** Answers one inbound v1 request with its JSON result. */
export type ManagedV1Route = (params: unknown) => Effect.Effect<unknown, AcpErrors.AcpError>;

/** Capabilities handed to a fixture while it builds its routes. */
export interface ManagedV1Peer {
  /** Parks forever after recording `stall-reached` when `--beep-fixture-stall-at=<operation>` names it. */
  readonly checkpoint: (operation: string) => Effect.Effect<void>;
  /** Sends a v1 `session/request_permission` request and decodes the client's answer. */
  readonly requestPermission: (
    request: SchemaV1.RequestPermissionRequest
  ) => Effect.Effect<SchemaV1.RequestPermissionResponse, AcpErrors.AcpError>;
  /** Sends a v1 `session/update` carrying an `agent_message_chunk` text block. */
  readonly sendText: (sessionId: string, text: string) => Effect.Effect<void, AcpErrors.AcpError>;
}

/** Encodes a v1 result through its generated schema; a fixture bug is a defect. */
export const replyV1 =
  <A, I>(schema: S.Codec<A, I>) =>
  (value: A): Effect.Effect<I> =>
    S.encodeEffect(schema)(value).pipe(Effect.orDie);

/** Decodes the params of an inbound v1 request; a malformed payload is answered with -32602. */
export const decodeV1 =
  <A, I>(schema: S.Codec<A, I>) =>
  (params: unknown): Effect.Effect<A, AcpErrors.AcpError> =>
    S.decodeUnknownEffect(schema)(params).pipe(
      Effect.mapError(() => AcpRequestError.invalidParams("Malformed v1 request payload."))
    );

const encodePermissionRequest = replyV1(SchemaV1.RequestPermissionRequest);
const decodePermissionResponse = decodeV1(SchemaV1.RequestPermissionResponse);
const encodeSessionNotification = replyV1(SchemaV1.SessionNotification);
const decodeInitializeRequest = decodeV1(SchemaV1.InitializeRequest);
const encodeReceivedParams = replyV1(S.fromJsonString(S.Unknown));

/**
 * Answers `initialize` only for a pure generation-1 request: `protocolVersion: 1` and neither of the
 * generation-2 negotiation fields `info` and `capabilities`. Anything else is answered with -32602,
 * so a managed path that stops pinning generation 1 fails to open instead of passing on a v1 reply.
 */
export const initializeV1 =
  (peer: ManagedV1Peer): ManagedV1Route =>
  (params) =>
    peer.checkpoint("initialize").pipe(
      Effect.andThen(decodeInitializeRequest(params)),
      Effect.filterOrFail(
        (request) =>
          request.protocolVersion === 1 && !P.hasProperty(params, "info") && !P.hasProperty(params, "capabilities"),
        () => AcpRequestError.invalidParams("Expected a pure ACP v1 initialize request.")
      ),
      Effect.andThen(replyV1(SchemaV1.InitializeResponse)({ protocolVersion: 1, agentCapabilities: {} }))
    );

/**
 * Serves a raw v1 peer on this process's stdio until the parent closes it.
 *
 * Inbound requests run on their own fibers (the protocol forks extension requests), so a route
 * may await `requestPermission` while the reader keeps delivering the client's response.
 */
export const runManagedV1Peer = (
  makeRoutes: (peer: ManagedV1Peer) => Effect.Effect<HashMap.HashMap<string, ManagedV1Route>>
) => {
  const main = Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const home = yield* Config.String("HOME");
    const ready = yield* Deferred.make<Protocol.AcpPatchedProtocol>();
    const transport = Deferred.await(ready);
    const checkpoint = (operation: string) =>
      operation === fixtureStallAt
        ? fs
            .writeFileString(path.join(home, "stall-reached"), operation)
            .pipe(Effect.andThen(Effect.never), Effect.orDie)
        : Effect.void;
    const requestPermission = Effect.fn("ManagedV1Peer.requestPermission")(function* (
      request: SchemaV1.RequestPermissionRequest
    ) {
      const protocol = yield* transport;
      const payload = yield* encodePermissionRequest(request);
      const request1 = yield* protocol.request("session/request_permission", payload);
      return yield* decodePermissionResponse(request1);
    });
    const sendText = Effect.fn("ManagedV1Peer.sendText")(function* (sessionId: string, text: string) {
      const protocol = yield* transport;
      const payload = yield* encodeSessionNotification({
        sessionId,
        update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text } },
      });
      yield* protocol.notify("session/update", payload);
    });
    const recordParams = (method: string, params: unknown) =>
      encodeReceivedParams(params).pipe(
        Effect.flatMap((text) =>
          fs
            .makeDirectory(home, { recursive: true })
            .pipe(
              Effect.andThen(
                fs.writeFileString(path.join(home, `received-${Str.replaceAll("/", "-")(method)}.json`), text)
              )
            )
        ),
        Effect.orDie
      );
    const routes = yield* makeRoutes({ checkpoint, requestPermission, sendText });
    const protocol = yield* Protocol.makeAcpPatchedProtocol({
      stdio: yield* Stdio.Stdio,
      serverRequestMethods: HashSet.empty(),
      onExtRequest: (method, params) =>
        O.match(HashMap.get(routes, method), {
          onNone: () => Effect.fail(AcpRequestError.methodNotFound(method)),
          onSome: (route) => recordParams(method, params).pipe(Effect.andThen(route(params))),
        }),
    });
    yield* Deferred.succeed(ready, protocol);
    return yield* Effect.never;
  });
  NodeServices.layer.pipe(
    Layer.build,
    Effect.flatMap((context) => main.pipe(Effect.provide(context))),
    Effect.scoped,
    NodeRuntime.runMain
  );
};
