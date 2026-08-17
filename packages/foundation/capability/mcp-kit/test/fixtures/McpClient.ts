/**
 * Test fixture for `McpServerClient`.
 *
 * `McpServer.McpServer.layer` is typed as providing `McpServer | McpServerClient`,
 * but it only builds `McpServer` — so any test that drives `server.callTool`
 * directly (rather than through a transport, whose middleware provides the
 * caller per request) dies with `Service not found` unless it supplies its own.
 *
 * @since 0.0.0
 */
import { Effect, Layer } from "effect";
import { McpServerClient } from "effect/unstable/ai/McpSchema";

const fixtureClientInfo = { name: "mcp-kit-test-client", version: "0.0.0" };

/**
 * Build a stub caller identity for `clientId`.
 *
 * @since 0.0.0
 */
export const makeStubMcpClient = (clientId: number) =>
  McpServerClient.of({
    clientId,
    protocolVersion: "2025-06-18",
    clientCapabilities: {},
    clientInfo: fixtureClientInfo,
    getClient: Effect.die("the fixture client is never dereferenced") as never,
    initializePayload: {
      capabilities: {},
      clientInfo: fixtureClientInfo,
      protocolVersion: "2025-06-18",
    } as never,
  });

/**
 * Layer supplying the default stub caller, for suites that only need
 * `callTool` to dispatch rather than to assert on a specific caller identity.
 *
 * @since 0.0.0
 */
export const StubMcpClientLayer = Layer.succeed(McpServerClient, makeStubMcpClient(1));
