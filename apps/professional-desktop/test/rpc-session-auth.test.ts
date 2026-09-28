import { ContradictionCandidatePage, ListContradictionCandidatesRpc } from "@beep/epistemic-use-cases/public";
import { NonNegativeInt } from "@beep/schema/Number";
import { it } from "@beep/test-runner";
import { NodeHttpServer } from "@effect/platform-node";
import * as Effect from "effect/Effect";
import { Headers, HttpClient, HttpClientRequest, HttpRouter } from "effect/http";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { RpcGroup, RpcSerialization, RpcServer } from "effect/rpc";
import * as S from "effect/Schema";
import { describe, expect, vi } from "vitest";
import {
  isAuthorizedRpcSessionHeaders,
  isAuthorizedRpcSessionRequest,
  RpcSessionAuthLayer,
  rpcSessionAuthorizationHeader,
} from "../server/RpcSessionAuth";

describe("desktop sidecar RPC session auth", () => {
  it("accepts only the active bearer token", () => {
    const token = Redacted.make("test-session-token");
    const authorizedHeaders = Headers.fromInput({
      Authorization: rpcSessionAuthorizationHeader(token),
    });

    expect(isAuthorizedRpcSessionHeaders(authorizedHeaders, token)).toBe(true);
    expect(isAuthorizedRpcSessionHeaders(token)(authorizedHeaders)).toBe(true);
    expect(isAuthorizedRpcSessionHeaders(Headers.fromInput({ Authorization: "Bearer wrong" }), token)).toBe(false);
    expect(isAuthorizedRpcSessionHeaders(Headers.empty, token)).toBe(false);
  });

  it("accepts the exact header the desktop HTTP protocol sends", () => {
    // makeDesktopHttpProtocolLive attaches the token with
    // HttpClientRequest.bearerToken; the sidecar middleware must accept that
    // wire format verbatim, or an authenticated session silently degrades to
    // 401s that render as generic "unavailable" states (QA closeout P1).
    const token = "test-session-token";
    const request = HttpClientRequest.bearerToken(HttpClientRequest.post("http://127.0.0.1:3939/rpc"), token);

    expect(isAuthorizedRpcSessionRequest(request.method, request.headers, Redacted.make(token))).toBe(true);
    expect(isAuthorizedRpcSessionRequest(request.method, request.headers, Redacted.make("other-token"))).toBe(false);
  });

  it("allows unauthenticated CORS preflight while guarding POST", () => {
    const token = Redacted.make("test-session-token");

    expect(isAuthorizedRpcSessionRequest("OPTIONS", Headers.empty, token)).toBe(true);
    expect(isAuthorizedRpcSessionRequest("POST", Headers.empty, token)).toBe(false);
    expect(isAuthorizedRpcSessionRequest(Headers.empty, token)("POST")).toBe(false);
    expect(
      isAuthorizedRpcSessionRequest(
        "POST",
        Headers.fromInput({ Authorization: rpcSessionAuthorizationHeader(token) }),
        token
      )
    ).toBe(true);
  });
});

// Exercise the real middleware and RPC wire boundary on an ephemeral socket.
// The list handler is a deterministic observation point, not a database proof.
const AuthProbeRpcs = RpcGroup.make(ListContradictionCandidatesRpc);
const listCandidates = vi.fn(() =>
  Effect.succeed(ContradictionCandidatePage.make({ items: [], total: NonNegativeInt.make(0) }))
);
const AuthProbeHandlers = AuthProbeRpcs.toLayer({ ListContradictionCandidates: listCandidates });
const authProbeToken = Redacted.make("boundary-test-session-token");
const AuthProbeProtocol = Layer.mergeAll(
  RpcServer.layerProtocolHttp({ path: "/rpc" }),
  RpcSessionAuthLayer(authProbeToken)
);
const AuthProbeServer = HttpRouter.serve(
  RpcServer.layer(AuthProbeRpcs).pipe(Layer.provide(AuthProbeHandlers), Layer.provideMerge(AuthProbeProtocol)),
  { disableListenLog: true, disableLogger: true }
).pipe(Layer.provideMerge(NodeHttpServer.layerTest), Layer.provide(RpcSerialization.layerNdjson));

it.layer(AuthProbeServer, { timeout: "10 seconds" })("desktop RPC HTTP authentication boundary", (it) => {
  it.effect("rejects missing and wrong bearer tokens before accepting the active token", () =>
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const encoded = yield* S.encodeEffect(S.fromJsonString(S.Unknown))({
        _tag: "Request",
        id: "1",
        tag: "ListContradictionCandidates",
        payload: { disposition: "all", knownAt: 0, limit: 1, offset: 0, validAt: 0 },
        headers: [],
      });
      const request = HttpClientRequest.post("/rpc").pipe(
        HttpClientRequest.bodyText(`${encoded}\n`, "application/ndjson")
      );
      const missing = yield* client.execute(request);
      expect(missing.status).toBe(401);
      expect(yield* missing.text).toBe("Unauthorized desktop RPC session.");
      expect(listCandidates).not.toHaveBeenCalled();

      const wrong = yield* client.execute(HttpClientRequest.bearerToken(request, "wrong-boundary-token"));
      expect(wrong.status).toBe(401);
      expect(yield* wrong.text).toBe("Unauthorized desktop RPC session.");
      expect(listCandidates).not.toHaveBeenCalled();

      const accepted = yield* client.execute(HttpClientRequest.bearerToken(request, Redacted.value(authProbeToken)));
      expect(accepted.status).toBe(200);
      const response = yield* accepted.text.pipe(Effect.flatMap(S.decodeUnknownEffect(S.fromJsonString(S.Unknown))));
      expect(response).toEqual({
        _tag: "Exit",
        requestId: "1",
        exit: { _tag: "Success", value: { items: [], total: 0 } },
      });
      expect(listCandidates).toHaveBeenCalledTimes(1);
    })
  );
});
