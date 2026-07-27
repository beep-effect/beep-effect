/**
 * Tests for the Plugin manifest schema — verifies that `PluginManifest`
 * accepts all documented shapes (string vs array vs inline object for
 * component paths, nested `author`, `userConfig`, `channels`) and
 * rejects malformed input.
 *
 * @since 0.1.0
 */
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

import { AuthorInfo, ChannelSpec, PluginManifest, UserConfigEntry } from "../../../claudecode/Plugin/Manifest.ts";

const decodeManifest = S.decodeUnknownEffect(PluginManifest);
const encodeManifest = S.encodeEffect(PluginManifest);

// ---------------------------------------------------------------------------
// Minimal / metadata
// ---------------------------------------------------------------------------

describe("PluginManifest — metadata", () => {
  it.effect("decodes a minimal manifest with only a name", () =>
    Effect.gen(function* () {
      const manifest = yield* decodeManifest({ name: "my-plugin" });
      expect(manifest).toBeInstanceOf(PluginManifest);
      expect(manifest.name).toBe("my-plugin");
      expect(manifest.version).toEqual(O.none());
      expect(yield* encodeManifest(manifest)).toEqual({ name: "my-plugin" });
    })
  );

  it.effect("decodes the full metadata block", () =>
    Effect.gen(function* () {
      const manifest = yield* decodeManifest({
        name: "deploy-tools",
        version: "1.2.0",
        description: "Deployment automation tools",
        author: {
          name: "Dev Team",
          email: "dev@example.com",
          url: "https://example.com",
        },
        homepage: "https://docs.example.com",
        repository: "https://github.com/user/plugin",
        license: "MIT",
        keywords: ["deploy", "ci"],
      });
      expect(manifest.version).toEqual(O.some("1.2.0"));
      expect(O.isSome(manifest.author)).toBe(true);
      expect(yield* encodeManifest(manifest)).toMatchObject({
        name: "deploy-tools",
        version: "1.2.0",
        description: "Deployment automation tools",
        author: {
          name: "Dev Team",
          email: "dev@example.com",
          url: "https://example.com",
        },
        homepage: "https://docs.example.com",
        repository: "https://github.com/user/plugin",
        license: "MIT",
        keywords: ["deploy", "ci"],
      });
      expect(O.getOrThrow(manifest.author)).toBeInstanceOf(AuthorInfo);
    })
  );

  it.effect("rejects a manifest missing the required name field", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(decodeManifest({ version: "1.0.0" }));
      expect(error).toBeInstanceOf(S.SchemaError);
    })
  );

  it.effect("rejects a non-string name", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(decodeManifest({ name: 123 }));
      expect(error).toBeInstanceOf(S.SchemaError);
    })
  );
});

// ---------------------------------------------------------------------------
// Component paths — accept string OR array of strings
// ---------------------------------------------------------------------------

describe("PluginManifest — component paths", () => {
  it.effect("accepts `commands` as a single string", () =>
    Effect.gen(function* () {
      const manifest = yield* decodeManifest({
        name: "p",
        commands: "./custom/commands/",
      });
      expect(manifest.commands).toEqual(O.some("./custom/commands/"));
      expect(yield* encodeManifest(manifest)).toMatchObject({ commands: "./custom/commands/" });
    })
  );

  it.effect("accepts `commands` as an array of strings", () =>
    Effect.gen(function* () {
      const manifest = yield* decodeManifest({
        name: "p",
        commands: ["./commands/", "./extras/deploy.md"],
      });
      expect(manifest.commands).toEqual(O.some(["./commands/", "./extras/deploy.md"]));
    })
  );

  it.effect("accepts `agents`, `skills`, `outputStyles` in string form", () =>
    Effect.gen(function* () {
      const manifest = yield* decodeManifest({
        name: "p",
        agents: "./custom/agents/",
        skills: "./custom/skills/",
        outputStyles: "./styles/",
      });
      expect(manifest).toMatchObject({
        agents: O.some("./custom/agents/"),
        skills: O.some("./custom/skills/"),
        outputStyles: O.some("./styles/"),
      });
    })
  );
});

// ---------------------------------------------------------------------------
// Hooks / MCP / LSP — accept string, array, OR inline object
// ---------------------------------------------------------------------------

describe("PluginManifest — hooks / mcpServers / lspServers", () => {
  it.effect("accepts `hooks` as a path string", () =>
    Effect.gen(function* () {
      const manifest = yield* decodeManifest({
        name: "p",
        hooks: "./config/hooks.json",
      });
      expect(manifest.hooks).toEqual(O.some("./config/hooks.json"));
    })
  );

  it.effect("accepts `hooks` as an inline HooksSection object", () =>
    Effect.gen(function* () {
      const manifest = yield* decodeManifest({
        name: "p",
        hooks: {
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [{ type: "command", command: "bun hook.ts" }],
            },
          ],
        },
      });
      expect(O.getOrThrow(manifest.hooks)).toMatchObject({
        PreToolUse: [
          {
            matcher: O.some("Bash"),
            hooks: [{ type: "command", command: "bun hook.ts" }],
          },
        ],
      });
      expect(yield* encodeManifest(manifest)).toMatchObject({
        hooks: {
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [{ type: "command", command: "bun hook.ts" }],
            },
          ],
        },
      });
    })
  );

  it.effect("accepts `mcpServers` as an inline record", () =>
    Effect.gen(function* () {
      const manifest = yield* decodeManifest({
        name: "p",
        mcpServers: {
          filesystem: {
            command: "mcp-fs",
            args: ["--config", "./config.json"],
          },
        },
      });
      expect(O.getOrThrow(manifest.mcpServers)).toMatchObject({
        filesystem: {
          command: "mcp-fs",
          args: ["--config", "./config.json"],
        },
      });
    })
  );

  it.effect("accepts `lspServers` as a path string", () =>
    Effect.gen(function* () {
      const manifest = yield* decodeManifest({
        name: "p",
        lspServers: "./.lsp.json",
      });
      expect(manifest.lspServers).toEqual(O.some("./.lsp.json"));
    })
  );
});

// ---------------------------------------------------------------------------
// userConfig + channels
// ---------------------------------------------------------------------------

describe("PluginManifest — userConfig and channels", () => {
  it.effect("decodes a userConfig record", () =>
    Effect.gen(function* () {
      const manifest = yield* decodeManifest({
        name: "p",
        userConfig: {
          api_endpoint: {
            type: "string",
            title: "API endpoint",
            description: "API endpoint URL",
          },
          api_token: {
            type: "string",
            title: "API token",
            description: "Auth token",
            sensitive: true,
          },
        },
      });
      const userConfig = O.getOrThrow(manifest.userConfig);
      expect(userConfig).toMatchObject({
        api_endpoint: {
          type: "string",
          title: "API endpoint",
          description: "API endpoint URL",
        },
        api_token: {
          type: "string",
          title: "API token",
          description: "Auth token",
          sensitive: O.some(true),
        },
      });
      const token = userConfig.api_token;
      expect(token).toBeInstanceOf(UserConfigEntry);
      expect(yield* encodeManifest(manifest)).toMatchObject({
        userConfig: {
          api_token: {
            sensitive: true,
          },
        },
      });
    })
  );

  it.effect("decodes a channels array bound to MCP servers", () =>
    Effect.gen(function* () {
      const manifest = yield* decodeManifest({
        name: "p",
        channels: [
          {
            server: "telegram",
            userConfig: {
              bot_token: {
                type: "string",
                title: "Telegram bot token",
                description: "Telegram bot token",
                sensitive: true,
              },
            },
          },
        ],
      });
      const channels = O.getOrThrow(manifest.channels);
      expect(channels).toHaveLength(1);
      const first = channels[0];
      expect(first).toBeInstanceOf(ChannelSpec);
      expect(first?.server).toBe("telegram");
    })
  );
});
