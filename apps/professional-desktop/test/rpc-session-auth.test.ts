import { Redacted } from "effect";
import { Headers } from "effect/unstable/http";
import { describe, expect, it } from "vitest";
import {
  isAuthorizedRpcSessionHeaders,
  isAuthorizedRpcSessionRequest,
  rpcSessionAuthorizationHeader,
} from "../server/RpcSessionAuth";

describe("desktop sidecar RPC session auth", () => {
  it("accepts only the active bearer token", () => {
    const token = Redacted.make("test-session-token");

    expect(
      isAuthorizedRpcSessionHeaders(Headers.fromInput({ Authorization: rpcSessionAuthorizationHeader(token) }), token)
    ).toBe(true);
    expect(isAuthorizedRpcSessionHeaders(Headers.fromInput({ Authorization: "Bearer wrong" }), token)).toBe(false);
    expect(isAuthorizedRpcSessionHeaders(Headers.empty, token)).toBe(false);
  });

  it("allows unauthenticated CORS preflight while guarding POST", () => {
    const token = Redacted.make("test-session-token");

    expect(isAuthorizedRpcSessionRequest("OPTIONS", Headers.empty, token)).toBe(true);
    expect(isAuthorizedRpcSessionRequest("POST", Headers.empty, token)).toBe(false);
    expect(
      isAuthorizedRpcSessionRequest(
        "POST",
        Headers.fromInput({ Authorization: rpcSessionAuthorizationHeader(token) }),
        token
      )
    ).toBe(true);
  });
});
