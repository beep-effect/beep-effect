import { describe, expect, test } from "bun:test";
import { signRequest } from "../src/hmac.ts";
import { createWriterHandler } from "../src/writer.ts";
import { requestEvent, WRITER_SECRET } from "./helpers.ts";

describe("writer wrapper", () => {
  test("returns 403 without invoking the shim when the signature is missing", async () => {
    let delegateCalls = 0;
    const writer = createWriterHandler({
      delegate: async () => {
        delegateCalls += 1;
      },
      loadSecret: async () => WRITER_SECRET,
    });

    expect(await writer(requestEvent("PUT", "/v8/artifacts/abc123"))).toEqual({
      statusCode: 403,
      headers: { "content-type": "application/json" },
      body: '{"error":"forbidden"}',
    });
    expect(delegateCalls).toBe(0);
  });

  test("delegates the untouched event when the signature is valid", async () => {
    const unsigned = requestEvent("PUT", "/v8/artifacts/abc123");
    const signature = signRequest(WRITER_SECRET, {
      method: unsigned.requestContext.http.method,
      rawPath: unsigned.rawPath,
      requestId: unsigned.requestContext.requestId,
    });
    const event = requestEvent("PUT", "/v8/artifacts/abc123", undefined, signature);
    let delegatedEvent: unknown;
    const writer = createWriterHandler({
      delegate: async (received) => {
        delegatedEvent = received;
        return { statusCode: 201 };
      },
      loadSecret: async () => WRITER_SECRET,
    });

    expect(await writer(event)).toEqual({ statusCode: 201 });
    expect(delegatedEvent).toBe(event);
  });

  test("fails closed without invoking the shim when secret resolution errors", async () => {
    let delegateCalls = 0;
    const event = requestEvent("PUT", "/v8/artifacts/abc123", undefined, "not-valid");
    const writer = createWriterHandler({
      delegate: async () => {
        delegateCalls += 1;
      },
      loadSecret: async () => {
        throw new Error("simulated SSM failure");
      },
    });

    expect(await writer(event)).toHaveProperty("statusCode", 403);
    expect(delegateCalls).toBe(0);
  });
});
