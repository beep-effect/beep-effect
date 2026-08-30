/**
 * Tests for `Plugin.define` and `Plugin.write` — verifies the builder
 * normalizes config, and the writer materializes the canonical
 * directory layout via an in-memory `FileSystem.layerNoop` capture
 * harness.
 *
 * Because `writeFileString` and `makeDirectory` in the mock close
 * over Effect mutable hash collections, tests can assert on
 * the recorded writes without threading a Ref through the layer.
 *
 * @since 0.1.0
 */
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";

import { PluginWriteError } from "../../../claudecode/Errors.ts";
import { McpJsonFile } from "../../../claudecode/Mcp/JsonFile.ts";
import * as Define from "../../../claudecode/Plugin/Define.ts";
import * as Load from "../../../claudecode/Plugin/Load.ts";
import { PluginManifest } from "../../../claudecode/Plugin/Manifest.ts";
import * as Testing from "../../../claudecode/Testing.ts";

const snapshotFile = (snapshot: Testing.MockFileSystemSnapshot, path: string): string | undefined =>
  O.getOrUndefined(HashMap.get(snapshot.files, path));

const snapshotHasFile = (snapshot: Testing.MockFileSystemSnapshot, path: string): boolean =>
  HashMap.has(snapshot.files, path);

// ---------------------------------------------------------------------------
// Plugin.define — synchronous builder
// ---------------------------------------------------------------------------

describe("Plugin.define", () => {
  it("accepts a plain manifest object and validates it", () => {
    const def = Define.define({
      manifest: { name: "my-plugin", version: "0.1.0" },
    });
    expect(def.manifest).toBeInstanceOf(PluginManifest);
    expect(def.manifest.name).toBe("my-plugin");
    expect(def.manifest.version).toEqual(O.some("0.1.0"));
  });

  it("passes through an existing PluginManifest instance unchanged", () => {
    const manifest = PluginManifest.make({ name: "pre-built" });
    const def = Define.define({ manifest });
    expect(def.manifest).toBe(manifest);
  });

  it("defaults all component arrays to empty", () => {
    const def = Define.define({ manifest: { name: "p" } });
    expect(def.commands).toEqual([]);
    expect(def.agents).toEqual([]);
    expect(def.skills).toEqual([]);
    expect(def.outputStyles).toEqual([]);
    expect(O.isNone(def.hooksConfig)).toBe(true);
    expect(O.isNone(def.mcpConfig)).toBe(true);
  });

  it("wraps hooksConfig and mcpConfig as O.some when provided", () => {
    const def = Define.define({
      manifest: { name: "p" },
      hooksConfig: { PostToolUse: [] },
      mcpConfig: {
        mcpServers: {
          fs: { type: "stdio", command: "mcp-fs" },
        },
      },
    });
    expect(O.isSome(def.hooksConfig)).toBe(true);
    expect(O.isSome(def.mcpConfig)).toBe(true);
    if (O.isSome(def.mcpConfig)) {
      expect(def.mcpConfig.value).toBeInstanceOf(McpJsonFile);
    }
  });

  it("builds typed component entries with helper constructors", () => {
    const review = Define.command({
      name: "review",
      description: "Review staged changes",
      body: "# Review\n",
    });
    const reviewer = Define.agent({
      name: "reviewer",
      description: "Review code",
      body: "# Reviewer\n",
    });
    const greet = Define.skill({
      name: "greet",
      description: "Say hello",
      body: "# Greet\n",
    });
    const terse = Define.outputStyle({
      name: "terse",
      description: "Keep responses compact",
      body: "# Terse\n",
    });

    expect(review.frontmatter.description).toEqual(O.some("Review staged changes"));
    expect(reviewer.frontmatter.name).toBe("reviewer");
    expect(greet.frontmatter.name).toEqual(O.some("greet"));
    expect(terse.frontmatter.name).toEqual(O.some("terse"));
  });
});

// ---------------------------------------------------------------------------
// Plugin.write — filesystem materialization
// ---------------------------------------------------------------------------

describe("Plugin.write — directory layout", () => {
  it.effect("writes .claude-plugin/plugin.json as pretty JSON", () =>
    Effect.gen(function* () {
      const def = Define.define({
        manifest: {
          name: "my-plugin",
          version: "0.1.0",
          description: "A test plugin",
        },
      });
      const fileSystem = yield* Testing.writePluginToMemory(def, "/dest");
      const snapshot = fileSystem.snapshot();

      expect(snapshot.directories).toContain("/dest/.claude-plugin");
      const manifestContent = snapshotFile(snapshot, "/dest/.claude-plugin/plugin.json");
      expect(manifestContent).toBeDefined();
      expect(manifestContent).toContain('"name": "my-plugin"');
      expect(manifestContent).toContain('"version": "0.1.0"');
      expect(manifestContent?.endsWith("\n")).toBe(true);
    })
  );

  it.effect("writes commands/<name>.md entries under the commands dir", () =>
    Effect.gen(function* () {
      const def = Define.define({
        manifest: { name: "p" },
        commands: [
          Define.command({
            name: "greet",
            description: "Say hi",
            body: "# /greet\n\nSay hi.\n",
          }),
          Define.command({
            name: "ship",
            description: "Ship it",
            body: "# /ship\n\nShip it.\n",
          }),
        ],
      });
      const fileSystem = yield* Testing.writePluginToMemory(def, "/dest");
      const snapshot = fileSystem.snapshot();

      expect(snapshot.directories).toContain("/dest/commands");
      expect(snapshotFile(snapshot, "/dest/commands/greet.md")).toContain("description: Say hi");
      expect(snapshotFile(snapshot, "/dest/commands/greet.md")).toContain("# /greet");
      expect(snapshotFile(snapshot, "/dest/commands/ship.md")).toContain("description: Ship it");
    })
  );

  it.effect("respects explicit non-canonical component paths", () =>
    Effect.gen(function* () {
      const def = Define.define({
        manifest: {
          name: "p",
          commands: "custom/commands",
          skills: "knowledge",
        },
        commands: [
          Define.command({
            name: "review",
            description: "Review",
            body: "# Review\n",
          }),
        ],
        skills: [
          Define.skill({
            name: "greet",
            description: "Say hi",
            body: "# Greet\n",
          }),
        ],
      });

      const fileSystem = yield* Testing.writePluginToMemory(def, "/dest");
      const snapshot = fileSystem.snapshot();

      expect(snapshotFile(snapshot, "/dest/custom/commands/review.md")).toContain("# Review");
      expect(snapshotFile(snapshot, "/dest/knowledge/greet/SKILL.md")).toContain("name: greet");
    })
  );

  it.effect("writes agents/<name>.md entries under the agents dir", () =>
    Effect.gen(function* () {
      const def = Define.define({
        manifest: { name: "p" },
        agents: [
          Define.agent({
            name: "reviewer",
            description: "Review code",
            body: "# reviewer\n",
          }),
        ],
      });
      const fileSystem = yield* Testing.writePluginToMemory(def, "/dest");
      const snapshot = fileSystem.snapshot();

      expect(snapshot.directories).toContain("/dest/agents");
      expect(snapshotFile(snapshot, "/dest/agents/reviewer.md")).toContain("name: reviewer");
      expect(snapshotFile(snapshot, "/dest/agents/reviewer.md")).toContain("# reviewer");
    })
  );

  it.effect("writes skills as skills/<name>/SKILL.md with nested dirs", () =>
    Effect.gen(function* () {
      const def = Define.define({
        manifest: { name: "p" },
        skills: [
          Define.skill({
            name: "pdf-processor",
            description: "Process PDFs",
            body: "# pdf-processor\n",
          }),
          Define.skill({
            name: "code-reviewer",
            description: "Review code",
            body: "# code-reviewer\n",
          }),
        ],
      });
      const fileSystem = yield* Testing.writePluginToMemory(def, "/dest");
      const snapshot = fileSystem.snapshot();

      expect(snapshot.directories).toContain("/dest/skills");
      expect(snapshot.directories).toContain("/dest/skills/pdf-processor");
      expect(snapshot.directories).toContain("/dest/skills/code-reviewer");
      expect(snapshotFile(snapshot, "/dest/skills/pdf-processor/SKILL.md")).toContain("name: pdf-processor");
      expect(snapshotFile(snapshot, "/dest/skills/code-reviewer/SKILL.md")).toContain("name: code-reviewer");
    })
  );

  it.effect("writes output-styles/<name>.md entries", () =>
    Effect.gen(function* () {
      const def = Define.define({
        manifest: { name: "p" },
        outputStyles: [
          Define.outputStyle({
            name: "terse",
            description: "Keep it brief",
            body: "# terse\n",
          }),
        ],
      });
      const fileSystem = yield* Testing.writePluginToMemory(def, "/dest");
      const snapshot = fileSystem.snapshot();

      expect(snapshot.directories).toContain("/dest/output-styles");
      expect(snapshotFile(snapshot, "/dest/output-styles/terse.md")).toContain("name: terse");
    })
  );

  it.effect("writes hooks/hooks.json only when hooksConfig is provided", () =>
    Effect.gen(function* () {
      const def = Define.define({
        manifest: { name: "p" },
        hooksConfig: {
          PostToolUse: [
            {
              matcher: "Write",
              hooks: [{ type: "command", command: "./fmt.sh" }],
            },
          ],
        },
      });
      const fileSystem = yield* Testing.writePluginToMemory(def, "/dest");
      const snapshot = fileSystem.snapshot();

      expect(snapshot.directories).toContain("/dest/hooks");
      const hooksContent = snapshotFile(snapshot, "/dest/hooks/hooks.json");
      expect(hooksContent).toBeDefined();
      expect(hooksContent).toContain('"PostToolUse"');
      expect(hooksContent).toContain('"command": "./fmt.sh"');
    })
  );

  it.effect("writes .mcp.json only when mcpConfig is provided", () =>
    Effect.gen(function* () {
      const def = Define.define({
        manifest: { name: "p" },
        mcpConfig: {
          mcpServers: {
            filesystem: { type: "stdio", command: "mcp-fs" },
          },
        },
      });
      const fileSystem = yield* Testing.writePluginToMemory(def, "/dest");
      const snapshot = fileSystem.snapshot();

      const mcpContent = snapshotFile(snapshot, "/dest/.mcp.json");
      expect(mcpContent).toBeDefined();
      expect(mcpContent).toContain('"mcpServers"');
      expect(mcpContent).toContain('"mcp-fs"');
    })
  );

  it.effect("emits OAuth config and omits the reserved workspace server", () =>
    Effect.gen(function* () {
      const def = Define.define({
        manifest: { name: "p" },
        mcpConfig: {
          mcpServers: {
            api: {
              type: "http",
              url: "https://api.example.com/mcp",
              oauth: { scopes: "read write" },
            },
            workspace: { command: "reserved" },
          },
        },
      });
      const fileSystem = yield* Testing.writePluginToMemory(def, "/dest");
      const snapshot = fileSystem.snapshot();
      const mcpContent = snapshotFile(snapshot, "/dest/.mcp.json");

      expect(mcpContent).toBeDefined();
      expect(mcpContent).toContain('"oauth"');
      expect(mcpContent).not.toContain('"workspace"');
    })
  );

  it.effect("skips empty component directories entirely", () =>
    Effect.gen(function* () {
      const def = Define.define({ manifest: { name: "p" } });
      const fileSystem = yield* Testing.writePluginToMemory(def, "/dest");
      const snapshot = fileSystem.snapshot();

      // Only the manifest dir is created; no commands/agents/skills/etc.
      expect(snapshot.directories).not.toContain("/dest/commands");
      expect(snapshot.directories).not.toContain("/dest/agents");
      expect(snapshot.directories).not.toContain("/dest/skills");
      expect(snapshot.directories).not.toContain("/dest/output-styles");
      expect(snapshot.directories).not.toContain("/dest/hooks");
      expect(snapshotHasFile(snapshot, "/dest/.mcp.json")).toBe(false);
    })
  );

  it.effect("preserves loaded static layout files when writing elsewhere", () =>
    Effect.gen(function* () {
      const fileSystem = Testing.makeMockFileSystem({
        "/src/.claude-plugin/plugin.json": '{"name":"static-plugin"}',
        "/src/.lsp.json": '{"go":{"command":"gopls","extensionToLanguage":{".go":"go"}}}',
        "/src/themes/dark.json": '{"name":"dark"}',
        "/src/monitors/monitors.json": '{"monitors":[]}',
        "/src/bin/helper": "#!/usr/bin/env bash\n",
        "/src/settings.json": "{}",
      });
      const loaded = yield* Load.load("/src").pipe(Effect.provide(fileSystem.layer));

      yield* Define.write(loaded, "/dest").pipe(Effect.provide(fileSystem.layer));

      const snapshot = fileSystem.snapshot();
      expect(snapshotFile(snapshot, "/dest/.lsp.json")).toBe(
        '{"go":{"command":"gopls","extensionToLanguage":{".go":"go"}}}'
      );
      expect(snapshotFile(snapshot, "/dest/themes/dark.json")).toBe('{"name":"dark"}');
      expect(snapshotFile(snapshot, "/dest/monitors/monitors.json")).toBe('{"monitors":[]}');
      expect(snapshotFile(snapshot, "/dest/bin/helper")).toBe("#!/usr/bin/env bash\n");
      expect(snapshotFile(snapshot, "/dest/settings.json")).toBe("{}");
    })
  );
});

// ---------------------------------------------------------------------------
// Plugin.write — error path
// ---------------------------------------------------------------------------

describe("Plugin.write — errors", () => {
  it.effect("rejects explicit entry paths that escape the plugin root", () =>
    Effect.gen(function* () {
      const fileSystem = Testing.makeMockFileSystem();
      const def = Define.define({
        manifest: { name: "p" },
        commands: [
          Define.command({
            name: "escape",
            path: "../outside.md",
            body: "must stay contained\n",
          }),
        ],
      });

      const raised = yield* Effect.flip(Define.write(def, "/dest").pipe(Effect.provide(fileSystem.layer)));

      expect(raised).toBeInstanceOf(PluginWriteError);
      expect(snapshotHasFile(fileSystem.snapshot(), "/outside.md")).toBe(false);
    })
  );

  it.effect("wraps FileSystem errors in PluginWriteError", () =>
    Effect.gen(function* () {
      const fileSystem = Testing.makeMockFileSystem(
        {},
        {
          failOn: (operation, path) => operation === "writeFileString" && path === "/dest/.claude-plugin/plugin.json",
        }
      );
      const def = Define.define({ manifest: { name: "p" } });

      const raised = yield* Effect.flip(Define.write(def, "/dest").pipe(Effect.provide(fileSystem.layer)));
      expect(raised).toBeInstanceOf(PluginWriteError);
      expect(raised).toMatchObject({
        _tag: "PluginWriteError",
        path: "/dest/.claude-plugin/plugin.json",
      });
    })
  );

  it.effect("reports the first failing path when an entry write fails", () =>
    Effect.gen(function* () {
      const fileSystem = Testing.makeMockFileSystem(
        {},
        {
          failOn: (operation, path) => operation === "writeFileString" && path === "/dest/commands/broken.md",
        }
      );
      const def = Define.define({
        manifest: { name: "p" },
        commands: [
          Define.command({
            name: "broken",
            description: "Broken command",
            body: "body\n",
          }),
        ],
      });

      const raised = yield* Effect.flip(Define.write(def, "/dest").pipe(Effect.provide(fileSystem.layer)));
      expect(raised).toMatchObject({
        _tag: "PluginWriteError",
        path: "/dest/commands/broken.md",
      });
    })
  );
});
/** @effect-diagnostics strictEffectProvide:skip-file -- Vitest cases are application entry points; each provided Layer is composed immediately before the terminal Effect runner. */
