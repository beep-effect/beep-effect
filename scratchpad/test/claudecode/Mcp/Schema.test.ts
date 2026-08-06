/** @effect-diagnostics strictEffectProvide:skip-file */
/**
 * Tests for the `Mcp.McpServerConfig` discriminated union and the
 * `Mcp.McpJsonFile` + `Mcp.loadJson` pair.
 *
 * Decode tests cover each current transport (`stdio`, `http`, `ws`) with
 * representative shapes. The loader is exercised against an in-memory
 * `FileSystem.layerNoop` to confirm the happy path plus I/O, parse, and
 * decode error wrapping.
 *
 * @since 0.1.0
 */
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";

import { McpConfigError } from "../../../claudecode/Errors.ts";
import {
  loadEffective,
  loadJson,
  loadManagedMcp,
  McpJsonFile,
  toClaudeCodeJson,
} from "../../../claudecode/Mcp/JsonFile.ts";
import {
  HttpMcpServer,
  McpOAuth,
  McpServerConfig,
  StdioMcpServer,
  WsMcpServer,
} from "../../../claudecode/Mcp/Schema.ts";

const decodeServer = S.decodeUnknownEffect(McpServerConfig);
const decodeHttp = S.decodeUnknownEffect(HttpMcpServer);
const decodeFile = S.decodeUnknownEffect(McpJsonFile);
const encodeServer = S.encodeEffect(McpServerConfig);
const encodeHttp = S.encodeEffect(HttpMcpServer);
const toJsonString = S.encodeUnknownSync(S.fromJsonString(S.Unknown));

// ---------------------------------------------------------------------------
// Test layer builder
// ---------------------------------------------------------------------------

const notFoundError = (path: string) =>
  PlatformError.systemError({
    _tag: "NotFound",
    module: "FileSystem",
    method: "readFileString",
    description: "No such file or directory",
    pathOrDescriptor: path,
  });

const makeFileSystemLayer = (files: ReadonlyMap<string, string>): Layer.Layer<FileSystem.FileSystem> =>
  FileSystem.layerNoop({
    exists: (path: string) => Effect.succeed(files.has(path)),
    readFileString: (path: string) => {
      const content = files.get(path);
      return content === undefined ? Effect.fail(notFoundError(path)) : Effect.succeed(content);
    },
  });

const makePlatformLayer = (files: ReadonlyMap<string, string>): Layer.Layer<FileSystem.FileSystem | Path.Path> =>
  Layer.mergeAll(makeFileSystemLayer(files), Path.layer);

// ---------------------------------------------------------------------------
// McpServerConfig — transport variants
// ---------------------------------------------------------------------------

describe("McpServerConfig — stdio", () => {
  it.effect("decodes a minimal stdio server with just command", () =>
    Effect.gen(function* () {
      const server = yield* decodeServer({
        command: "mcp-fs",
      });
      expect(server).toBeInstanceOf(StdioMcpServer);
      expect(server).toMatchObject({ command: "mcp-fs" });
      expect(server.type).toEqual(O.none());
      expect(yield* encodeServer(server)).toEqual({ command: "mcp-fs" });
    })
  );

  it.effect("decodes a full stdio server with args, env, and timeout", () =>
    Effect.gen(function* () {
      const server = yield* decodeServer({
        type: "stdio",
        command: "node",
        args: ["./server.js", "--port", "3000"],
        env: {
          NODE_ENV: "production",
          API_KEY: "secret",
        },
        timeout: 600000,
      });
      expect(server).toMatchObject({
        type: O.some("stdio"),
        command: "node",
        args: O.some(["./server.js", "--port", "3000"]),
        env: O.some({ NODE_ENV: "production", API_KEY: "secret" }),
        timeout: O.some(600000),
      });
      expect(yield* encodeServer(server)).toEqual({
        type: "stdio",
        command: "node",
        args: ["./server.js", "--port", "3000"],
        env: { NODE_ENV: "production", API_KEY: "secret" },
        timeout: 600000,
      });
    })
  );
});

describe("McpServerConfig — http", () => {
  it.effect("decodes an http server with url, headers, helper, and alwaysLoad", () =>
    Effect.gen(function* () {
      const server = yield* decodeServer({
        type: "http",
        url: "https://api.example.com/mcp",
        headers: { "X-Custom": "value" },
        headersHelper: "./headers.sh",
        alwaysLoad: true,
      });
      expect(server).toBeInstanceOf(HttpMcpServer);
      expect(server).toMatchObject({
        type: "http",
        url: "https://api.example.com/mcp",
        headers: O.some({ "X-Custom": "value" }),
        headersHelper: O.some("./headers.sh"),
        alwaysLoad: O.some(true),
      });
      expect(yield* encodeServer(server)).toEqual({
        type: "http",
        url: "https://api.example.com/mcp",
        headers: { "X-Custom": "value" },
        headersHelper: "./headers.sh",
        alwaysLoad: true,
      });
    })
  );

  it.effect("decodes streamable-http as an HTTP alias", () =>
    Effect.gen(function* () {
      const server = yield* decodeServer({
        type: "streamable-http",
        url: "https://api.example.com/mcp",
      });
      expect(server).toBeInstanceOf(HttpMcpServer);
      expect(server).toMatchObject({
        type: "streamable-http",
        url: "https://api.example.com/mcp",
      });
      expect(yield* encodeServer(server)).toEqual({
        type: "streamable-http",
        url: "https://api.example.com/mcp",
      });
    })
  );

  it.effect("decodes the current oauth object", () =>
    Effect.gen(function* () {
      const server = yield* decodeHttp({
        type: "http",
        url: "https://oauth.example.com/mcp",
        oauth: {
          clientId: "client-123",
          callbackPort: 3333,
          authServerMetadataUrl: "https://oauth.example.com/.well-known/oauth-authorization-server",
          scopes: "read write",
        },
      });
      const oauth = O.getOrThrow(server.oauth);
      expect(oauth).toBeInstanceOf(McpOAuth);
      expect(oauth).toMatchObject({
        clientId: O.some("client-123"),
        callbackPort: O.some(3333),
        scopes: O.some("read write"),
      });
      expect(yield* encodeHttp(server)).toEqual({
        type: "http",
        url: "https://oauth.example.com/mcp",
        oauth: {
          clientId: "client-123",
          callbackPort: 3333,
          authServerMetadataUrl: "https://oauth.example.com/.well-known/oauth-authorization-server",
          scopes: "read write",
        },
      });
    })
  );
});

describe("McpServerConfig — ws", () => {
  it.effect("decodes a ws server with url and headersHelper", () =>
    Effect.gen(function* () {
      const server = yield* decodeServer({
        type: "ws",
        url: "wss://events.example.com/socket",
        headersHelper: "./headers.sh",
        alwaysLoad: true,
      });
      expect(server).toBeInstanceOf(WsMcpServer);
      expect(server).toMatchObject({
        type: "ws",
        url: "wss://events.example.com/socket",
        headersHelper: O.some("./headers.sh"),
        alwaysLoad: O.some(true),
      });
      expect(yield* encodeServer(server)).toEqual({
        type: "ws",
        url: "wss://events.example.com/socket",
        headersHelper: "./headers.sh",
        alwaysLoad: true,
      });
    })
  );
});

describe("McpServerConfig — errors", () => {
  it.effect("rejects a server with an unknown transport type", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(decodeServer({ type: "websocket", url: "ws://x" }));
      expect(error).toBeInstanceOf(S.SchemaError);
    })
  );

  it.effect("rejects a stdio server missing the required command field", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(decodeServer({ type: "stdio", args: [] }));
      expect(error).toBeInstanceOf(S.SchemaError);
    })
  );
});

// ---------------------------------------------------------------------------
// McpJsonFile — top-level wrapper
// ---------------------------------------------------------------------------

describe("McpJsonFile", () => {
  it.effect("decodes a file with multiple named servers across transports", () =>
    Effect.gen(function* () {
      const file = yield* decodeFile({
        mcpServers: {
          filesystem: { command: "mcp-fs" },
          api: {
            type: "http",
            url: "https://api.example.com/mcp",
          },
          wsEvents: {
            type: "ws",
            url: "wss://events.example.com/socket",
          },
        },
      });
      expect(file).toBeInstanceOf(McpJsonFile);
      expect(Object.keys(file.mcpServers)).toEqual(["filesystem", "api", "wsEvents"]);
      expect(file.mcpServers.filesystem).toBeInstanceOf(StdioMcpServer);
      expect(file.mcpServers.api).toBeInstanceOf(HttpMcpServer);
      expect(file.mcpServers.wsEvents).toBeInstanceOf(WsMcpServer);
    })
  );

  it.effect("rejects a file missing the mcpServers field", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(decodeFile({ otherField: "unrelated" }));
      expect(error).toBeInstanceOf(S.SchemaError);
    })
  );

  it.effect("rejects a file where mcpServers is the wrong type", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(decodeFile({ mcpServers: "not an object" }));
      expect(error).toBeInstanceOf(S.SchemaError);
    })
  );
});

// ---------------------------------------------------------------------------
// loadJson — filesystem loader
// ---------------------------------------------------------------------------

describe("Mcp.loadJson", () => {
  it.effect("reads, parses, and decodes a valid .mcp.json", () =>
    Effect.gen(function* () {
      const file = yield* loadJson("/.mcp.json");
      expect(file.mcpServers.fs).toBeInstanceOf(StdioMcpServer);
      expect(file.mcpServers.fs).toMatchObject({
        type: O.some("stdio"),
        command: "mcp-fs",
      });
    }).pipe(
      Effect.provide(
        makeFileSystemLayer(
          new Map([
            [
              "/.mcp.json",
              toJsonString({
                mcpServers: {
                  fs: { type: "stdio", command: "mcp-fs" },
                },
              }),
            ],
          ])
        )
      )
    )
  );

  it.effect("skips the reserved workspace server name", () =>
    Effect.gen(function* () {
      const file = yield* loadJson("/.mcp.json");
      expect(file.mcpServers.workspace).toBeUndefined();
      expect(file.mcpServers.safe).toBeInstanceOf(StdioMcpServer);
    }).pipe(
      Effect.provide(
        makeFileSystemLayer(
          new Map([
            [
              "/.mcp.json",
              toJsonString({
                mcpServers: {
                  workspace: { command: "reserved" },
                  safe: { command: "safe-server" },
                },
              }),
            ],
          ])
        )
      )
    )
  );

  it.effect("wraps I/O failures in McpConfigError", () =>
    Effect.gen(function* () {
      const raised = yield* Effect.flip(loadJson("/missing.json"));
      expect(raised).toBeInstanceOf(McpConfigError);
      expect(raised).toMatchObject({
        _tag: "McpConfigError",
        path: "/missing.json",
      });
    }).pipe(Effect.provide(makeFileSystemLayer(new Map())))
  );

  it.effect("wraps JSON parse failures in McpConfigError", () =>
    Effect.gen(function* () {
      const raised = yield* Effect.flip(loadJson("/broken.json"));
      expect(raised).toBeInstanceOf(McpConfigError);
    }).pipe(Effect.provide(makeFileSystemLayer(new Map([["/broken.json", "not valid json"]]))))
  );

  it.effect("wraps schema decode failures in McpConfigError", () =>
    Effect.gen(function* () {
      const raised = yield* Effect.flip(loadJson("/invalid.json"));
      expect(raised).toBeInstanceOf(McpConfigError);
    }).pipe(
      Effect.provide(
        makeFileSystemLayer(
          new Map([
            [
              "/invalid.json",
              toJsonString({
                mcpServers: {
                  // Unknown transport type
                  bad: { type: "websocket", url: "ws://x" },
                },
              }),
            ],
          ])
        )
      )
    )
  );
});

// ---------------------------------------------------------------------------
// effective MCP loading
// ---------------------------------------------------------------------------

describe("Mcp.loadManagedMcp", () => {
  it.effect("discovers managed-mcp.json under a managed root", () =>
    Effect.gen(function* () {
      const managed = yield* loadManagedMcp({ managedMcpRoot: "/managed" });
      const file = yield* O.match(managed, {
        onNone: () => Effect.die("Expected managed MCP config"),
        onSome: Effect.succeed,
      });
      expect(file.mcpServers.managed).toBeInstanceOf(HttpMcpServer);
    }).pipe(
      Effect.provide(
        makePlatformLayer(
          new Map([
            [
              "/managed/managed-mcp.json",
              toJsonString({
                mcpServers: {
                  managed: {
                    type: "http",
                    url: "https://managed.example.com/mcp",
                  },
                },
              }),
            ],
          ])
        )
      )
    )
  );
});

describe("Mcp.loadEffective", () => {
  it.effect("merges plugin, user, project, and local scopes by precedence", () =>
    Effect.gen(function* () {
      const effective = yield* loadEffective("/repo", {
        claudeJsonPath: "/home/user/.claude.json",
        projectMcpPath: "/repo/.mcp.json",
        pluginMcpConfigs: [
          McpJsonFile.make({
            mcpServers: {
              pluginOnly: StdioMcpServer.make({
                command: "plugin-only",
              }),
              pluginDuplicateEndpoint: HttpMcpServer.make({
                type: "http",
                url: "https://duplicate.example.com/mcp",
              }),
            },
          }),
        ],
      });

      expect(effective.mcpServers.pluginOnly).toMatchObject({
        command: "plugin-only",
      });
      expect(effective.mcpServers.userOnly).toMatchObject({
        command: "user-only",
      });
      expect(effective.mcpServers.projectOnly).toMatchObject({
        command: "project-only",
      });
      expect(effective.mcpServers.localOnly).toMatchObject({
        url: "https://local.example.com/mcp",
      });
      expect(effective.mcpServers.shared).toMatchObject({
        command: "local-shared",
      });
      expect(effective.mcpServers.pluginDuplicateEndpoint).toBeUndefined();
      expect(effective.mcpServers.userDuplicateEndpoint).toMatchObject({
        url: "https://duplicate.example.com/mcp",
      });
    }).pipe(
      Effect.provide(
        makePlatformLayer(
          new Map([
            [
              "/home/user/.claude.json",
              toJsonString({
                mcpServers: {
                  shared: { command: "user-shared" },
                  userOnly: { command: "user-only" },
                  userDuplicateEndpoint: {
                    type: "http",
                    url: "https://duplicate.example.com/mcp",
                  },
                },
                projects: {
                  "/repo": {
                    mcpServers: {
                      shared: { command: "local-shared" },
                      localOnly: {
                        type: "http",
                        url: "https://local.example.com/mcp",
                      },
                    },
                  },
                },
              }),
            ],
            [
              "/repo/.mcp.json",
              toJsonString({
                mcpServers: {
                  shared: { command: "project-shared" },
                  projectOnly: { command: "project-only" },
                },
              }),
            ],
          ])
        )
      )
    )
  );

  it.effect("uses managed-mcp.json exclusively when present", () =>
    Effect.gen(function* () {
      const effective = yield* loadEffective("/repo", {
        claudeJsonPath: "/home/user/.claude.json",
        projectMcpPath: "/repo/.mcp.json",
        managedMcpRoot: "/managed",
        pluginMcpConfigs: [
          McpJsonFile.make({
            mcpServers: {
              plugin: StdioMcpServer.make({ command: "plugin" }),
            },
          }),
        ],
      });

      expect(effective.mcpServers.managed).toMatchObject({
        command: "managed-server",
      });
      expect(effective.mcpServers.project).toBeUndefined();
      expect(effective.mcpServers.user).toBeUndefined();
      expect(effective.mcpServers.plugin).toBeUndefined();
    }).pipe(
      Effect.provide(
        makePlatformLayer(
          new Map([
            [
              "/managed/managed-mcp.json",
              toJsonString({
                mcpServers: {
                  managed: { command: "managed-server" },
                },
              }),
            ],
            [
              "/home/user/.claude.json",
              toJsonString({
                mcpServers: { user: { command: "user-server" } },
              }),
            ],
            [
              "/repo/.mcp.json",
              toJsonString({
                mcpServers: { project: { command: "project-server" } },
              }),
            ],
          ])
        )
      )
    )
  );
});

// ---------------------------------------------------------------------------
// serialization
// ---------------------------------------------------------------------------

describe("Mcp.toClaudeCodeJson", () => {
  it.effect("emits current config and omits the reserved workspace server", () =>
    Effect.gen(function* () {
      const file = yield* decodeFile({
        mcpServers: {
          api: {
            type: "http",
            url: "https://api.example.com/mcp",
            oauth: { scopes: "read write" },
          },
          local: {
            command: "local-server",
            timeout: 600000,
          },
          workspace: { command: "reserved" },
        },
      });

      expect(toClaudeCodeJson(file)).toEqual({
        mcpServers: {
          api: {
            type: "http",
            url: "https://api.example.com/mcp",
            oauth: { scopes: "read write" },
          },
          local: {
            command: "local-server",
            timeout: 600000,
          },
        },
      });
    })
  );
});
