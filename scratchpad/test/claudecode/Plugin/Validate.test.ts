/** @effect-diagnostics strictEffectProvide:skip-file */
/**
 * Tests for plugin validation, linting, and doctor diagnostics.
 *
 * @since 0.1.0
 */
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import * as Plugin from "../../../claudecode/Plugin.ts";
import * as Testing from "../../../claudecode/Testing.ts";

describe("Plugin.validate", () => {
  it.effect("accepts a coherent plugin definition", () =>
    Effect.gen(function* () {
      const plugin = Plugin.define({
        manifest: {
          name: "guardrails",
          commands: "custom/commands",
          channels: [{ server: "fs" }],
        },
        commands: [
          Plugin.command({
            name: "review",
            path: "custom/commands/review.md",
            description: "Review staged changes",
            body: "# Review\n",
          }),
        ],
        mcpConfig: {
          mcpServers: {
            fs: { type: "stdio", command: "mcp-fs" },
          },
        },
      });

      const validated = yield* Plugin.validate(plugin);
      expect(validated).toBe(plugin);
    })
  );

  it.effect("fails on duplicate names and ambiguous multi-path layouts", () =>
    Effect.gen(function* () {
      const plugin = Plugin.define({
        manifest: {
          name: "guardrails",
          commands: ["commands-a", "commands-b"],
        },
        commands: [
          Plugin.command({
            name: "review",
            description: "Review once",
            body: "# Review\n",
          }),
          Plugin.command({
            name: "review",
            description: "Review twice",
            body: "# Review again\n",
          }),
        ],
      });

      const error = yield* Effect.flip(Plugin.validate(plugin));
      expect(error).toBeInstanceOf(Plugin.PluginValidationError);
      expect(error.issues.map((item) => item.code).sort()).toEqual([
        "commands-layout-ambiguous",
        "commands-layout-ambiguous",
        "duplicate-command-name",
      ]);
    })
  );
});

describe("Plugin.lint", () => {
  it("reports warnings for multi-file hook layouts that collapse on sync", () => {
    const plugin = Plugin.define({
      manifest: {
        name: "guardrails",
        hooks: ["hooks/a.json", "hooks/b.json"],
      },
      hooksConfig: { PostToolUse: [] },
    });

    const report = Plugin.lint(plugin);
    expect(report.warnings.map((item) => item.code)).toContain("hooks-layout-collapses-on-sync");
  });
});

describe("Plugin.doctor", () => {
  it.effect("loads a plugin tree and reports cross-file issues", () =>
    Effect.gen(function* () {
      const plugin = Plugin.define({
        manifest: {
          name: "guardrails",
          channels: [{ server: "missing-server" }],
        },
        commands: [
          Plugin.command({
            name: "review",
            description: "Review staged changes",
            body: "# Review\n",
          }),
        ],
      });

      const fileSystem = yield* Testing.writePluginToMemory(plugin, "/plugin");
      const report = yield* Plugin.doctor("/plugin").pipe(Effect.provide(fileSystem.layer));

      expect(report.loaded.manifest.name).toBe("guardrails");
      expect(report.errors.map((item) => item.code)).toContain("channel-missing-server");
    })
  );
});
