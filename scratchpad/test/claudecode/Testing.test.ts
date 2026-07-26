/** @effect-diagnostics strictEffectProvide:skip-file */
/**
 * Tests for the Testing module helpers — fixtures, assertion
 * helpers, and `makeMockFileSystem`.
 *
 * Fixtures are validated by decoding each one's JSON output
 * against the corresponding event `Input` schema. Assertion
 * helpers are validated by feeding them the exact outputs
 * produced by each event's decision constructor. The mock
 * filesystem is validated by reading a few files and asserting
 * both the happy and not-found paths.
 *
 * @since 0.1.0
 */
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Events from "../../claudecode/Hook/Events/index.ts";
import * as Hook from "../../claudecode/Hook.ts";
import * as Plugin from "../../claudecode/Plugin.ts";
import * as Testing from "../../claudecode/Testing.ts";

// ---------------------------------------------------------------------------
// fixtures — decode each fixture against its event schema
// ---------------------------------------------------------------------------

describe("Testing.fixtures", () => {
  it.effect("PreToolUse fixture decodes against the schema", () =>
    Effect.gen(function* () {
      const json = Testing.fixtures.PreToolUse({
        tool_name: "Bash",
        tool_input: { command: "ls" },
      });
      const input = yield* S.decodeUnknownEffect(S.fromJsonString(Events.PreToolUse.Input))(json);
      expect(input).toMatchObject({
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "ls" },
      });
    })
  );

  it.effect("UserPromptSubmit fixture decodes with prompt override", () =>
    Effect.gen(function* () {
      const json = Testing.fixtures.UserPromptSubmit({
        prompt: "Hello, Claude",
      });
      const input = yield* S.decodeUnknownEffect(S.fromJsonString(Events.UserPromptSubmit.Input))(json);
      expect(input.prompt).toBe("Hello, Claude");
    })
  );

  it.effect("SessionStart fixture accepts `source` override", () =>
    Effect.gen(function* () {
      const json = Testing.fixtures.SessionStart({
        source: "resume",
        model: "claude-opus-4-6",
      });
      const input = yield* S.decodeUnknownEffect(S.fromJsonString(Events.SessionStart.Input))(json);
      expect(input).toMatchObject({
        source: "resume",
        model: O.some("claude-opus-4-6"),
      });
    })
  );

  it.effect("envelope fields are filled in with defaults", () =>
    Effect.gen(function* () {
      const json = Testing.fixtures.CwdChanged();
      const input = yield* S.decodeUnknownEffect(S.fromJsonString(Events.CwdChanged.Input))(json);
      expect(input).toMatchObject({
        session_id: "test-session",
        transcript_path: "/tmp/transcript.jsonl",
        cwd: "/tmp/workspace",
        hook_event_name: "CwdChanged",
      });
    })
  );

  it.effect("overrides replace the per-event defaults", () =>
    Effect.gen(function* () {
      const json = Testing.fixtures.FileChanged({
        file_path: "/other/path.ts",
        event: "unlink",
      });
      const input = yield* S.decodeUnknownEffect(S.fromJsonString(Events.FileChanged.Input))(json);
      expect(input).toMatchObject({
        file_path: "/other/path.ts",
        event: "unlink",
      });
    })
  );

  it("every event has a corresponding fixture entry", () => {
    const expectedKeys = A.sort(
      [
        "PreToolUse",
        "PostToolUse",
        "UserPromptSubmit",
        "Notification",
        "Stop",
        "SubagentStop",
        "SessionStart",
        "Setup",
        "SessionEnd",
        "PreCompact",
        "PostCompact",
        "PermissionRequest",
        "PermissionDenied",
        "PostToolUseFailure",
        "InstructionsLoaded",
        "StopFailure",
        "CwdChanged",
        "FileChanged",
        "ConfigChange",
        "SubagentStart",
        "TaskCreated",
        "TaskCompleted",
        "TeammateIdle",
        "WorktreeCreate",
        "WorktreeRemove",
        "Elicitation",
        "ElicitationResult",
        "UserPromptExpansion",
        "PostToolBatch",
        "MessageDisplay",
      ],
      Order.String
    );
    const actualKeys = A.sort(Object.keys(Testing.fixtures), Order.String);
    expect(actualKeys).toEqual(expectedKeys);
    const allFunctions = Object.values(Testing.fixtures).every((value) => typeof value === "function");
    expect(allFunctions).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Decision assertion helpers — feed them the outputs from decision
// constructors so we're testing round-trip compatibility.
// ---------------------------------------------------------------------------

describe("Testing.expect*Decision", () => {
  it("expectAllowDecision matches PreToolUse.allow output", () => {
    Testing.expectAllowDecision(Hook.PreToolUse.allow());
    Testing.expectAllowDecision(Hook.PreToolUse.allow("because reasons"), "because reasons");
  });

  it("expectDenyDecision matches PreToolUse.deny output", () => {
    Testing.expectDenyDecision(Hook.PreToolUse.deny("destructive"), "destructive");
  });

  it("expectAskDecision matches PreToolUse.ask output", () => {
    Testing.expectAskDecision(Hook.PreToolUse.ask("needs review"), "needs review");
  });

  it("expectBlockDecision matches UserPromptSubmit.block output", () => {
    Testing.expectBlockDecision(Hook.UserPromptSubmit.block("off-topic"), "off-topic");
  });

  it("expectBlockDecision also matches PostToolUse.block output", () => {
    Testing.expectBlockDecision(Hook.PostToolUse.block("tool output invalid"), "tool output invalid");
  });

  it("expectAddContext matches UserPromptSubmit.addContext output", () => {
    Testing.expectAddContext(Hook.UserPromptSubmit.addContext("extra context"), "extra context");
  });

  it("expectAddContext without a context arg only checks presence", () => {
    Testing.expectAddContext(Hook.PostToolUse.addContext("any value"));
  });
});

// ---------------------------------------------------------------------------
// makeMockFileSystem
// ---------------------------------------------------------------------------

describe("Testing.makeMockFileSystem", () => {
  it.effect("reads known files, lists directories, and records writes", () => {
    const fileSystem = Testing.makeMockFileSystem({
      "/repo/a.txt": "A",
      "/repo/nested/b.txt": "B",
    });

    return Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;

      const existingContent = yield* fs.readFileString("/repo/a.txt");
      expect(existingContent).toBe("A");

      const existsA = yield* fs.exists("/repo/a.txt");
      expect(existsA).toBe(true);
      expect(fileSystem.exists("/repo/nested")).toBe(true);

      const entries = yield* fs.readDirectory("/repo");
      expect(entries).toEqual(["a.txt", "nested"]);

      yield* fs.makeDirectory("/repo/generated", { recursive: true });
      yield* fs.writeFileString("/repo/generated/out.txt", "OUT");
      expect(fileSystem.readFile("/repo/generated/out.txt")).toBe("OUT");

      const existsMissing = yield* fs.exists("/missing.txt");
      expect(existsMissing).toBe(false);

      // Reading a missing file surfaces a typed PlatformError
      const exit = yield* Effect.exit(fs.readFileString("/missing.txt"));
      expect(exit._tag).toBe("Failure");
    }).pipe(Effect.provide(fileSystem.layer));
  });

  it.effect("accepts a ReadonlyMap as well as a plain record", () => {
    const fileSystem = Testing.makeMockFileSystem(new Map([["/x", "X"]]));

    return Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const content = yield* fs.readFileString("/x");
      expect(content).toBe("X");
    }).pipe(Effect.provide(fileSystem.layer));
  });

  it.effect("supports targeted failure injection", () => {
    const fileSystem = Testing.makeMockFileSystem(
      {},
      {
        failOn: (operation, path) => operation === "writeFileString" && path === "/dest/out.txt",
      }
    );

    return Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.makeDirectory("/dest", { recursive: true });
      const exit = yield* Effect.exit(fs.writeFileString("/dest/out.txt", "OUT"));
      expect(exit._tag).toBe("Failure");
    }).pipe(Effect.provide(fileSystem.layer));
  });
});

describe("Testing plugin helpers", () => {
  it.effect("writePluginToMemory materializes a complete plugin tree", () =>
    Effect.gen(function* () {
      const plugin = Plugin.define({
        manifest: { name: "guardrails", version: "0.1.0" },
        commands: [
          Plugin.command({
            name: "review",
            description: "Review staged changes",
            body: "# Review\n",
          }),
        ],
        skills: [
          Plugin.skill({
            name: "greet",
            description: "Say hi",
            body: "# Greet\n",
          }),
        ],
        hooksConfig: {
          PostToolUse: [],
        },
      });

      const fileSystem = yield* Testing.writePluginToMemory(plugin, "/plugin");

      Testing.expectPluginTree(fileSystem, {
        "/plugin/.claude-plugin/plugin.json": /"name": "guardrails"/,
        "/plugin/commands/review.md": /description: Review staged changes/,
        "/plugin/skills/greet/SKILL.md": /name: greet/,
        "/plugin/hooks/hooks.json": /"PostToolUse"/,
      });
    })
  );

  it.effect("roundTripPlugin writes and reloads the plugin from memory", () =>
    Effect.gen(function* () {
      const plugin = Plugin.define({
        manifest: { name: "guardrails" },
        outputStyles: [
          Plugin.outputStyle({
            name: "terse",
            description: "Keep responses brief",
            body: "# Terse\n",
          }),
        ],
      });

      const result = yield* Testing.roundTripPlugin(plugin, "/plugin");

      expect(result.loaded.manifest.name).toBe("guardrails");
      expect(result.loaded.outputStyles).toHaveLength(1);
      expect(result.loaded.outputStyles[0]).toMatchObject({
        name: "terse",
      });
      expect(result.fileSystem.readFile("/plugin/output-styles/terse.md")).toContain("name: terse");
    })
  );
});

// ---------------------------------------------------------------------------
// Round-trip — feed a fixture through runHookWithMockStdin
// ---------------------------------------------------------------------------

describe("Testing.fixtures + runHookWithMockStdin integration", () => {
  it.effect("a fixture wired through runHookWithMockStdin produces the expected decision", () =>
    Effect.gen(function* () {
      const hook = Hook.PreToolUse.define({
        handler: (input) =>
          Effect.succeed(input.tool_name === "Bash" ? Hook.PreToolUse.deny("no bash") : Hook.PreToolUse.allow()),
      });

      const result = yield* Testing.runHookWithMockStdin(
        hook,
        Testing.fixtures.PreToolUse({
          tool_name: "Bash",
          tool_input: { command: "rm -rf /" },
        })
      );

      expect(result.exitCode).toBe(0);
      Testing.expectDenyDecision(result.output, "no bash");
    })
  );
});
