import { describe, expect, test } from "bun:test";
import { createAuthorizerHandler } from "../src/authorizer.js";
import { createAuthorizerSecretsLoader } from "../src/ssm.js";
import { READ_TOKEN, requestEvent, WRITE_TOKEN, WRITER_SECRET } from "./helpers.js";
import type { GetParametersCommandOutput } from "@aws-sdk/client-ssm";

const READ_ARN = "arn:aws:ssm:us-east-1:123456789012:parameter/cache/read";
const WRITE_ARN = "arn:aws:ssm:us-east-1:123456789012:parameter/cache/write";
const SECRET_ARN = "arn:aws:ssm:us-east-1:123456789012:parameter/cache/hmac";

// Service-faithful shape: GetParameters echoes the plain parameter path in
// `Name` even when queried by full ARN; the ARN arrives in the `ARN` field.
const output: GetParametersCommandOutput = {
  $metadata: {},
  Parameters: [
    { Name: "/cache/read", ARN: READ_ARN, Value: READ_TOKEN },
    { Name: "/cache/write", ARN: WRITE_ARN, Value: WRITE_TOKEN },
    { Name: "/cache/hmac", ARN: SECRET_ARN, Value: WRITER_SECRET },
  ],
};

const createMockedHandler = () => {
  const commands: Array<unknown> = [];
  const loadSecrets = createAuthorizerSecretsLoader(
    {
      send: async (command) => {
        commands.push(command);
        return output;
      },
    },
    {
      READ_ONLY_TOKEN_SSM_PARAMETER_ARN: READ_ARN,
      TRUSTED_WRITE_TOKEN_SSM_PARAMETER_ARN: WRITE_ARN,
      WRITER_SHARED_SECRET_SSM_PARAMETER_ARN: SECRET_ARN,
    }
  );
  return { commands, handler: createAuthorizerHandler({ loadSecrets }) };
};

const matrix = [
  ["GET", "/v8/artifacts/status", true, true],
  ["GET", "/v8/artifacts/abc123", true, true],
  ["HEAD", "/v8/artifacts/abc123", true, true],
  ["POST", "/v8/artifacts", true, true],
  ["POST", "/v8/artifacts/events", true, true],
  ["PUT", "/v8/artifacts/abc123", false, true],
  ["POST", "/v8/artifacts/clean", false, false],
  ["GET", "/v8/artifacts/clean", false, false],
  ["HEAD", "/v8/artifacts/status", false, false],
  ["PUT", "/v8/artifacts/events", false, false],
  ["DELETE", "/v8/artifacts/abc123", false, false],
] as const;

describe("token and method matrix", () => {
  for (const [method, path, readAllowed, writeAllowed] of matrix) {
    test(`${method} ${path} with the read token`, async () => {
      const { handler } = createMockedHandler();
      expect((await handler(requestEvent(method, path, READ_TOKEN))).isAuthorized).toBe(readAllowed);
    });

    test(`${method} ${path} with the trusted token`, async () => {
      const { handler } = createMockedHandler();
      expect((await handler(requestEvent(method, path, WRITE_TOKEN))).isAuthorized).toBe(writeAllowed);
    });
  }

  test("denies an unknown token", async () => {
    const { handler } = createMockedHandler();
    expect((await handler(requestEvent("GET", "/v8/artifacts/abc123", "unknown"))).isAuthorized).toBe(false);
  });

  test("denies a missing authorization header", async () => {
    const { handler } = createMockedHandler();
    expect((await handler(requestEvent("GET", "/v8/artifacts/abc123"))).isAuthorized).toBe(false);
  });

  test("accepts a raw token and resolves all secrets in one cached SSM batch", async () => {
    const { commands, handler } = createMockedHandler();
    const event = {
      ...requestEvent("GET", "/v8/artifacts/abc123", READ_TOKEN),
      headers: { authorization: READ_TOKEN },
    };
    expect((await handler(event)).isAuthorized).toBe(true);
    expect((await handler(event)).isAuthorized).toBe(true);
    expect(commands).toHaveLength(1);
    expect(commands[0]).toHaveProperty("input", {
      Names: [READ_ARN, WRITE_ARN, SECRET_ARN],
      WithDecryption: true,
    });
  });

  test("fails closed when SSM errors", async () => {
    const handler = createAuthorizerHandler({
      loadSecrets: async () => {
        throw new Error("simulated SSM failure");
      },
    });
    expect((await handler(requestEvent("GET", "/v8/artifacts/abc123", READ_TOKEN))).isAuthorized).toBe(false);
  });
});
