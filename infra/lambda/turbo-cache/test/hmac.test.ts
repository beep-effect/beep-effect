import { describe, expect, test } from "bun:test";
import { createAuthorizerHandler } from "../src/authorizer.ts";
import { constantTimeEqual } from "../src/hmac.ts";
import { createWriterHandler } from "../src/writer.ts";
import { READ_TOKEN, requestEvent, WRITE_TOKEN, WRITER_SECRET } from "./helpers.ts";

describe("constant-time comparison", () => {
  test("handles equal and different-length inputs", () => {
    expect(constantTimeEqual("same", "same")).toBe(true);
    expect(constantTimeEqual("short", "a much longer value")).toBe(false);
  });
});

describe("authorizer and writer HMAC", () => {
  test("verifies the same request and rejects mutations of every signed field", async () => {
    const authorizer = createAuthorizerHandler({
      loadSecrets: async () => ({
        readOnlyToken: READ_TOKEN,
        trustedWriteToken: WRITE_TOKEN,
        writerSharedSecret: WRITER_SECRET,
      }),
    });
    const writeEvent = requestEvent("PUT", "/v8/artifacts/abc123", WRITE_TOKEN);
    const authorization = await authorizer(writeEvent);
    const signature = authorization.context.writerSignature;
    expect(signature).toBeString();

    let delegateCalls = 0;
    const writer = createWriterHandler({
      delegate: async () => {
        delegateCalls += 1;
        return { statusCode: 200 };
      },
      loadSecret: async () => WRITER_SECRET,
    });
    const signed = requestEvent("PUT", "/v8/artifacts/abc123", undefined, signature);
    expect(await writer(signed)).toEqual({ statusCode: 200 });

    const mutations = [
      { ...signed, rawPath: "/v8/artifacts/changed" },
      {
        ...signed,
        requestContext: { ...signed.requestContext, requestId: "changed-request-id" },
      },
      {
        ...signed,
        requestContext: {
          ...signed.requestContext,
          http: { method: "POST" },
        },
      },
    ];
    for (const mutation of mutations) {
      expect(await writer(mutation)).toHaveProperty("statusCode", 403);
    }
    expect(delegateCalls).toBe(1);
  });
});
