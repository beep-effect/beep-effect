/**
 * Tests for `Plugin.scan`, `Plugin.load`, and `Plugin.sync`.
 *
 * Uses an in-memory `FileSystem.layerNoop` that derives directory listings from
 * the provided file map so plugin trees can be exercised without touching disk.
 *
 * @since 0.1.0
 */
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

import { PluginLoadError } from "../../../claudecode/Errors.ts";
import * as Plugin from "../../../claudecode/Plugin.ts";
import * as Testing from "../../../claudecode/Testing.ts";

// ---------------------------------------------------------------------------
// Test tree builder
// ---------------------------------------------------------------------------

const fsWith = (entries: ReadonlyArray<readonly [string, string]>): ReadonlyMap<string, string> => new Map(entries);

const toJsonString = UnknownFromJsonString.encodeUnknownSync;
const encodeManifest = S.encodeEffect(Plugin.PluginManifest);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Plugin.scan", () => {
  it.effect("discovers canonical component files and infers a manifest", () =>
    Effect.gen(function* () {
      const scanned = yield* Plugin.scan("/plugin");

      expect(O.isSome(scanned.sourceManifest)).toBe(true);
      expect(scanned.commandPaths).toEqual(["/plugin/commands/review.md"]);
      expect(scanned.agentPaths).toEqual(["/plugin/agents/reviewer.md"]);
      expect(scanned.skillPaths).toEqual(["/plugin/skills/greet/SKILL.md"]);
      expect(scanned.outputStylePaths).toEqual(["/plugin/output-styles/terse.md"]);
      expect(yield* encodeManifest(scanned.inferredManifest)).toMatchObject({
        name: "guardrails",
        commands: "commands",
        agents: "agents",
        skills: "skills",
        outputStyles: "output-styles",
        hooks: "hooks/hooks.json",
        mcpServers: ".mcp.json",
      });
    }).pipe(
      Effect.provide(
        Testing.makeMockFileSystem(
          fsWith([
            [
              "/plugin/.claude-plugin/plugin.json",
              JSON.stringify({
                name: "guardrails",
                description: "Guardrail hooks",
              }),
            ],
            ["/plugin/commands/review.md", "---\ndescription: Review\n---\n\n# /review\n"],
            ["/plugin/agents/reviewer.md", "---\nname: reviewer\ndescription: Review changes\n---\n\n# Reviewer\n"],
            ["/plugin/skills/greet/SKILL.md", "---\nname: greet\ndescription: Say hi\n---\n\n# Greet\n"],
            ["/plugin/output-styles/terse.md", "---\nname: terse\ndescription: Keep it compact\n---\n\n# Terse\n"],
            ["/plugin/hooks/hooks.json", JSON.stringify({ hooks: { PostToolUse: [] } })],
            [
              "/plugin/.mcp.json",
              JSON.stringify({
                mcpServers: {
                  fs: { type: "stdio", command: "mcp-fs" },
                },
              }),
            ],
          ])
        ).layer
      )
    )
  );

  it.effect("uses manifest-declared non-canonical component paths when present", () =>
    Effect.gen(function* () {
      const scanned = yield* Plugin.scan("/plugin");

      expect(scanned.commandPaths).toEqual(["/plugin/custom/commands/review.md"]);
      expect(scanned.agentPaths).toEqual(["/plugin/custom/agents/reviewer.md"]);
      expect(scanned.skillPaths).toEqual(["/plugin/knowledge/greet/SKILL.md"]);
      expect(scanned.outputStylePaths).toEqual(["/plugin/styles/terse.md"]);
      expect(scanned.hooksPaths).toEqual(["/plugin/config/hooks.json"]);
      expect(scanned.mcpPaths).toEqual(["/plugin/config/mcp.json"]);
      expect(yield* encodeManifest(scanned.inferredManifest)).toMatchObject({
        commands: "custom/commands",
        agents: "custom/agents",
        skills: "knowledge",
        outputStyles: "styles",
        hooks: "config/hooks.json",
        mcpServers: "config/mcp.json",
      });
    }).pipe(
      Effect.provide(
        Testing.makeMockFileSystem(
          fsWith([
            [
              "/plugin/.claude-plugin/plugin.json",
              JSON.stringify({
                name: "guardrails",
                commands: "custom/commands",
                agents: "custom/agents",
                skills: "knowledge",
                outputStyles: "styles",
                hooks: "config/hooks.json",
                mcpServers: "config/mcp.json",
              }),
            ],
            ["/plugin/custom/commands/review.md", "---\ndescription: Review\n---\n\n# /review\n"],
            [
              "/plugin/custom/agents/reviewer.md",
              "---\nname: reviewer\ndescription: Review changes\n---\n\n# Reviewer\n",
            ],
            ["/plugin/knowledge/greet/SKILL.md", "---\nname: greet\ndescription: Say hi\n---\n\n# Greet\n"],
            ["/plugin/styles/terse.md", "---\nname: terse\ndescription: Keep it compact\n---\n\n# Terse\n"],
            ["/plugin/config/hooks.json", JSON.stringify({ hooks: { PostToolUse: [] } })],
            [
              "/plugin/config/mcp.json",
              JSON.stringify({
                mcpServers: {
                  fs: { type: "stdio", command: "mcp-fs" },
                },
              }),
            ],
          ])
        ).layer
      )
    )
  );

  it.effect("discovers the default .lsp.json fallback", () =>
    Effect.gen(function* () {
      const scanned = yield* Plugin.scan("/plugin");

      expect(scanned.lspPaths).toEqual(["/plugin/.lsp.json"]);
      expect(yield* encodeManifest(scanned.inferredManifest)).toMatchObject({
        lspServers: ".lsp.json",
      });
    }).pipe(
      Effect.provide(
        Testing.makeMockFileSystem(
          fsWith([
            ["/plugin/.claude-plugin/plugin.json", toJsonString({ name: "lsp-plugin" })],
            [
              "/plugin/.lsp.json",
              toJsonString({
                go: {
                  command: "gopls",
                  extensionToLanguage: { ".go": "go" },
                },
              }),
            ],
          ])
        ).layer
      )
    )
  );

  it.effect("de-dupes default and declared skill paths", () =>
    Effect.gen(function* () {
      const scanned = yield* Plugin.scan("/plugin");

      expect(scanned.skillPaths).toEqual(["/plugin/skills/greet/SKILL.md"]);
    }).pipe(
      Effect.provide(
        Testing.makeMockFileSystem(
          fsWith([
            ["/plugin/.claude-plugin/plugin.json", toJsonString({ name: "skills-plugin", skills: "./skills" })],
            ["/plugin/skills/greet/SKILL.md", "---\nname: greet\ndescription: Say hi\n---\n\n# Greet\n"],
          ])
        ).layer
      )
    )
  );

  it.effect("discovers default experimental, bin, and settings files", () =>
    Effect.gen(function* () {
      const scanned = yield* Plugin.scan("/plugin");

      expect(scanned.themePaths).toEqual(["/plugin/themes/dark.json"]);
      expect(scanned.monitorPaths).toEqual(["/plugin/monitors/monitors.json"]);
      expect(scanned.binPaths).toEqual(["/plugin/bin/helper"]);
      expect(O.getOrUndefined(scanned.settingsPath)).toBe("/plugin/settings.json");
      expect(yield* encodeManifest(scanned.inferredManifest)).toMatchObject({
        experimental: {
          themes: "themes",
          monitors: "monitors/monitors.json",
        },
      });
    }).pipe(
      Effect.provide(
        Testing.makeMockFileSystem(
          fsWith([
            ["/plugin/.claude-plugin/plugin.json", toJsonString({ name: "experimental-plugin" })],
            ["/plugin/themes/dark.json", toJsonString({ name: "dark" })],
            ["/plugin/monitors/monitors.json", toJsonString({ monitors: [] })],
            ["/plugin/bin/helper", "#!/usr/bin/env bash\n"],
            ["/plugin/settings.json", toJsonString({})],
          ])
        ).layer
      )
    )
  );
});

describe("Plugin.load", () => {
  it.effect("loads a plugin tree into a typed definition", () =>
    Effect.gen(function* () {
      const loaded = yield* Plugin.load("/plugin");

      expect(loaded.manifest.name).toBe("guardrails");
      expect(loaded.commands).toHaveLength(1);
      expect(loaded.commands[0]).toMatchObject({
        name: "review",
        path: "commands/review.md",
      });
      expect(loaded.agents[0]).toMatchObject({ name: "reviewer" });
      expect(loaded.skills[0]).toMatchObject({ name: "greet" });
      expect(loaded.outputStyles[0]).toMatchObject({ name: "terse" });
      expect(O.isSome(loaded.hooksConfig)).toBe(true);
      expect(O.isSome(loaded.mcpConfig)).toBe(true);
    }).pipe(
      Effect.provide(
        Testing.makeMockFileSystem(
          fsWith([
            ["/plugin/.claude-plugin/plugin.json", JSON.stringify({ name: "guardrails" })],
            ["/plugin/commands/review.md", "---\ndescription: Review\n---\n\n# /review\n"],
            ["/plugin/agents/reviewer.md", "---\nname: reviewer\ndescription: Review changes\n---\n\n# Reviewer\n"],
            ["/plugin/skills/greet/SKILL.md", "---\nname: greet\ndescription: Say hi\n---\n\n# Greet\n"],
            ["/plugin/output-styles/terse.md", "---\nname: terse\ndescription: Keep it compact\n---\n\n# Terse\n"],
            ["/plugin/hooks/hooks.json", JSON.stringify({ hooks: { PostToolUse: [] } })],
            [
              "/plugin/.mcp.json",
              JSON.stringify({
                mcpServers: {
                  fs: { type: "stdio", command: "mcp-fs" },
                },
              }),
            ],
          ])
        ).layer
      )
    )
  );

  it.effect("rejects unwrapped hooks files", () =>
    Effect.gen(function* () {
      const raised = yield* Effect.flip(Plugin.load("/plugin"));

      expect(raised).toBeInstanceOf(PluginLoadError);
      expect(raised).toMatchObject({
        _tag: "PluginLoadError",
        path: "/plugin/hooks/hooks.json",
      });
    }).pipe(
      Effect.provide(
        Testing.makeMockFileSystem(fsWith([["/plugin/hooks/hooks.json", JSON.stringify({ PostToolUse: [] })]])).layer
      )
    )
  );

  it.effect("loads inline hooks and MCP config from the manifest", () =>
    Effect.gen(function* () {
      const loaded = yield* Plugin.load("/plugin");

      expect(O.isSome(loaded.hooksConfig)).toBe(true);
      expect(O.isSome(loaded.mcpConfig)).toBe(true);
      expect(loaded.commands[0]).toMatchObject({
        name: "review",
        path: "custom/review.md",
      });
      expect(O.getOrThrow(loaded.manifest.hooks)).toMatchObject({ PostToolUse: [] });
      if (O.isSome(loaded.mcpConfig)) {
        expect(loaded.mcpConfig.value.mcpServers).toMatchObject({
          fs: { type: O.some("stdio"), command: "mcp-fs" },
        });
      }
    }).pipe(
      Effect.provide(
        Testing.makeMockFileSystem(
          fsWith([
            [
              "/plugin/.claude-plugin/plugin.json",
              JSON.stringify({
                name: "guardrails",
                commands: "custom",
                hooks: { PostToolUse: [] },
                mcpServers: {
                  fs: { type: "stdio", command: "mcp-fs" },
                },
              }),
            ],
            ["/plugin/custom/review.md", "---\ndescription: Review\n---\n\n# /review\n"],
          ])
        ).layer
      )
    )
  );

  it.effect("ignores stray files in the fallback skills directory scan", () =>
    Effect.gen(function* () {
      const loaded = yield* Plugin.load("/plugin");

      expect(loaded.skills).toHaveLength(1);
      expect(loaded.skills[0]).toMatchObject({
        name: "greet",
        path: "skills/greet/SKILL.md",
      });
    }).pipe(
      Effect.provide(
        Testing.makeMockFileSystem(
          fsWith([
            ["/plugin/skills/greet/SKILL.md", "---\nname: greet\ndescription: Say hi\n---\n\n# Greet\n"],
            ["/plugin/skills/README.md", "# Not a skill directory\n"],
          ])
        ).layer
      )
    )
  );

  it.effect("wraps component decode failures in PluginLoadError", () =>
    Effect.gen(function* () {
      const raised = yield* Effect.flip(Plugin.load("/plugin"));
      expect(raised).toBeInstanceOf(PluginLoadError);
      expect(raised).toMatchObject({
        _tag: "PluginLoadError",
        path: "/plugin/skills/greet/SKILL.md",
      });
    }).pipe(
      Effect.provide(
        Testing.makeMockFileSystem(
          fsWith([
            [
              "/plugin/skills/greet/SKILL.md",
              "---\nname: greet\ndescription: Invalid effort\neffort: ludicrous\n---\n\n# Broken\n",
            ],
          ])
        ).layer
      )
    )
  );
});

describe("Plugin.sync", () => {
  it("preserves an explicit non-canonical layout instead of clobbering it", () => {
    const synced = Plugin.sync(
      Plugin.define({
        manifest: {
          name: "guardrails",
          description: "Guardrail hooks",
          commands: "old-commands",
          hooks: "old-hooks.json",
        },
        commands: [
          Plugin.command({
            name: "review",
            description: "Review",
            body: "# /review\n",
          }),
        ],
        skills: [
          Plugin.skill({
            name: "greet",
            description: "Say hi",
            body: "# Greet\n",
          }),
        ],
        hooksConfig: { PostToolUse: [] },
      })
    );

    expect(synced.manifest).toMatchObject({
      name: "guardrails",
      description: O.some("Guardrail hooks"),
      commands: O.some("./old-commands"),
      hooks: O.some("./old-hooks.json"),
    });
    expect(synced.manifest.skills).toEqual(O.none());
    expect(synced.manifest.agents).toEqual(O.none());
    expect(synced.manifest.outputStyles).toEqual(O.none());
  });
});
/** @effect-diagnostics strictEffectProvide:skip-file -- Vitest cases are application entry points; each provided Layer is composed immediately before the terminal Effect runner. */
