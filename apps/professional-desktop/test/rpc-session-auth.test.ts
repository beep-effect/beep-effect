import * as Redacted from "effect/Redacted";
import { Headers, HttpClientRequest } from "effect/unstable/http";
import { describe, expect, it } from "vitest";
import {
  isAuthorizedRpcSessionHeaders,
  isAuthorizedRpcSessionRequest,
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
