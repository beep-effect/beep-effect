/**
 * Tests for the per-file-type frontmatter schemas.
 *
 * Each test decodes a representative YAML fixture (as a plain JS
 * object) through the target schema and asserts the result's
 * shape. Kebab-case keys (`allowed-tools`, `disable-model-invocation`)
 * are preserved verbatim.
 *
 * @since 0.1.0
 */
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

import { CommandFrontmatter } from "../../../claudecode/Frontmatter/Command.ts";
import { OutputStyleFrontmatter } from "../../../claudecode/Frontmatter/OutputStyle.ts";
import { SkillFrontmatter } from "../../../claudecode/Frontmatter/Skill.ts";
import { SubagentFrontmatter } from "../../../claudecode/Frontmatter/Subagent.ts";

const decodeSkill = S.decodeUnknownEffect(SkillFrontmatter);
const decodeSubagent = S.decodeUnknownEffect(SubagentFrontmatter);
const decodeCommand = S.decodeUnknownEffect(CommandFrontmatter);
const decodeOutputStyle = S.decodeUnknownEffect(OutputStyleFrontmatter);
const encodeSkill = S.encodeEffect(SkillFrontmatter);
const encodeSubagent = S.encodeEffect(SubagentFrontmatter);
const encodeCommand = S.encodeEffect(CommandFrontmatter);
const encodeOutputStyle = S.encodeEffect(OutputStyleFrontmatter);

// ---------------------------------------------------------------------------
// SkillFrontmatter
// ---------------------------------------------------------------------------

describe("SkillFrontmatter", () => {
  it.effect("decodes a minimal skill with only name + description", () =>
    Effect.gen(function* () {
      const skill = yield* decodeSkill({
        name: "greet",
        description: "Say hello to the user",
      });
      expect(skill).toMatchObject({
        name: O.some("greet"),
        description: O.some("Say hello to the user"),
      });
      expect(yield* encodeSkill(skill)).toEqual({
        name: "greet",
        description: "Say hello to the user",
      });
    })
  );

  it.effect("decodes kebab-case keys as-is", () =>
    Effect.gen(function* () {
      const skill = yield* decodeSkill({
        name: "tools-check",
        description: "Verify tool access",
        "disable-model-invocation": true,
        "user-invocable": false,
        "allowed-tools": ["Read", "Write"],
        "argument-hint": "<file>",
      });
      expect(skill).toMatchObject({
        "disable-model-invocation": O.some(true),
        "user-invocable": O.some(false),
        "allowed-tools": O.some(["Read", "Write"]),
        "argument-hint": O.some("<file>"),
      });
    })
  );

  it.effect("accepts `allowed-tools` as a comma-separated string", () =>
    Effect.gen(function* () {
      const skill = yield* decodeSkill({
        name: "s",
        description: "d",
        "allowed-tools": "Read, Write, Edit",
      });
      expect(skill["allowed-tools"]).toEqual(O.some("Read, Write, Edit"));
    })
  );

  it.effect("decodes effort and shell enums", () =>
    Effect.gen(function* () {
      const skill = yield* decodeSkill({
        name: "s",
        description: "d",
        effort: "xhigh",
        shell: "bash",
      });
      expect(skill.effort).toEqual(O.some("xhigh"));
      expect(skill.shell).toEqual(O.some("bash"));
    })
  );

  it.effect("decodes current invocation and metadata fields", () =>
    Effect.gen(function* () {
      const skill = yield* decodeSkill({
        name: "effect-helper",
        description: "Help with Effect code",
        when_to_use: "Use for Effect v4 APIs",
        arguments: ["file", "topic"],
        paths: "src/**, test/**",
        "disallowed-tools": "WebFetch, WebSearch",
        license: "MIT",
        metadata: { owner: "platform" },
        compatibility: "Claude Code",
      });
      expect(skill).toMatchObject({
        when_to_use: O.some("Use for Effect v4 APIs"),
        arguments: O.some(["file", "topic"]),
        paths: O.some("src/**, test/**"),
        "disallowed-tools": O.some("WebFetch, WebSearch"),
        license: O.some("MIT"),
        metadata: O.some({ owner: "platform" }),
        compatibility: O.some("Claude Code"),
      });
    })
  );

  it.effect("rejects an invalid effort value", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        decodeSkill({
          name: "s",
          description: "d",
          effort: "ludicrous",
        })
      );
      expect(error).toBeInstanceOf(S.SchemaError);
    })
  );

  it.effect("decodes a skill without description", () =>
    Effect.gen(function* () {
      const skill = yield* decodeSkill({ name: "s" });
      expect(skill.name).toEqual(O.some("s"));
      expect(skill.description).toEqual(O.none());
      const encoded = yield* encodeSkill(skill);
      expect(encoded).toEqual({ name: "s" });
      expect(encoded).not.toHaveProperty("description");
    })
  );
});

// ---------------------------------------------------------------------------
// SubagentFrontmatter
// ---------------------------------------------------------------------------

describe("SubagentFrontmatter", () => {
  it.effect("decodes a plugin-shipped subagent (no hooks/permissions)", () =>
    Effect.gen(function* () {
      const agent = yield* decodeSubagent({
        name: "reviewer",
        description: "Reviews code",
        model: "sonnet",
        effort: "medium",
        maxTurns: 20,
        disallowedTools: "Write, Edit",
        isolation: "worktree",
      });
      expect(agent).toMatchObject({
        name: "reviewer",
        model: O.some("sonnet"),
        effort: O.some("medium"),
        maxTurns: O.some(20),
        disallowedTools: O.some("Write, Edit"),
        isolation: O.some("worktree"),
      });
      expect(yield* encodeSubagent(agent)).toEqual({
        name: "reviewer",
        description: "Reviews code",
        model: "sonnet",
        effort: "medium",
        maxTurns: 20,
        disallowedTools: "Write, Edit",
        isolation: "worktree",
      });
    })
  );

  it.effect("decodes a user subagent with permission mode + hooks", () =>
    Effect.gen(function* () {
      const agent = yield* decodeSubagent({
        name: "watcher",
        description: "Watches files",
        permissionMode: "acceptEdits",
        hooks: {
          PostToolUse: [
            {
              matcher: "Write",
              hooks: [{ type: "command", command: "./log.sh" }],
            },
          ],
        },
      });
      expect(agent.permissionMode).toEqual(O.some("acceptEdits"));
      expect(O.getOrThrow(agent.hooks)).toMatchObject({
        PostToolUse: [{ matcher: O.some("Write") }],
      });
      expect(yield* encodeSubagent(agent)).toMatchObject({
        permissionMode: "acceptEdits",
      });
    })
  );

  it.effect("decodes current subagent fields", () =>
    Effect.gen(function* () {
      const agent = yield* decodeSubagent({
        name: "researcher",
        description: "Researches a topic",
        effort: "xhigh",
        color: "cyan",
        initialPrompt: "Start by reading the README.",
        memory: "project",
        mcpServers: ["filesystem", { browser: { type: "http", url: "https://mcp.example.com" } }],
      });
      expect(agent).toMatchObject({
        effort: O.some("xhigh"),
        color: O.some("cyan"),
        initialPrompt: O.some("Start by reading the README."),
        memory: O.some("project"),
        mcpServers: O.some(["filesystem", { browser: { type: "http", url: "https://mcp.example.com" } }]),
      });
    })
  );

  it.effect("rejects a subagent missing the required name field", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(decodeSubagent({ description: "d" }));
      expect(error).toBeInstanceOf(S.SchemaError);
    })
  );
});

// ---------------------------------------------------------------------------
// CommandFrontmatter
// ---------------------------------------------------------------------------

describe("CommandFrontmatter", () => {
  it.effect("decodes an empty command frontmatter", () =>
    Effect.gen(function* () {
      const cmd = yield* decodeCommand({});
      expect(cmd.description).toEqual(O.none());
      expect(cmd["allowed-tools"]).toEqual(O.none());
      expect(yield* encodeCommand(cmd)).toEqual({});
    })
  );

  it.effect("decodes a full command frontmatter with skill-style fields", () =>
    Effect.gen(function* () {
      const cmd = yield* decodeCommand({
        name: "commit",
        description: "Commit staged changes",
        when_to_use: "Use for git commits",
        arguments: "message scope",
        "argument-hint": "<message>",
        "allowed-tools": ["Bash"],
        "disallowed-tools": "WebFetch",
        "disable-model-invocation": false,
        "user-invocable": true,
        context: "fork",
        agent: "reviewer",
        effort: "xhigh",
        paths: ["src/**"],
        shell: "bash",
        model: "haiku",
        hooks: {
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [{ type: "mcp_tool", server: "policy", tool: "check" }],
            },
          ],
        },
      });
      expect(cmd).toMatchObject({
        name: O.some("commit"),
        description: O.some("Commit staged changes"),
        when_to_use: O.some("Use for git commits"),
        arguments: O.some("message scope"),
        "argument-hint": O.some("<message>"),
        "allowed-tools": O.some(["Bash"]),
        "disallowed-tools": O.some("WebFetch"),
        "disable-model-invocation": O.some(false),
        "user-invocable": O.some(true),
        context: O.some("fork"),
        agent: O.some("reviewer"),
        effort: O.some("xhigh"),
        paths: O.some(["src/**"]),
        shell: O.some("bash"),
        model: O.some("haiku"),
      });
    })
  );
});

// ---------------------------------------------------------------------------
// OutputStyleFrontmatter
// ---------------------------------------------------------------------------

describe("OutputStyleFrontmatter", () => {
  it.effect("decodes the minimal name-only form", () =>
    Effect.gen(function* () {
      const style = yield* decodeOutputStyle({ name: "terse" });
      expect(style.name).toEqual(O.some("terse"));
      expect(style.description).toEqual(O.none());
      expect(yield* encodeOutputStyle(style)).toEqual({ name: "terse" });
    })
  );

  it.effect("decodes name + description", () =>
    Effect.gen(function* () {
      const style = yield* decodeOutputStyle({
        name: "verbose",
        description: "Long-form explanatory prose",
      });
      expect(style).toMatchObject({
        name: O.some("verbose"),
        description: O.some("Long-form explanatory prose"),
      });
    })
  );

  it.effect("decodes an empty style frontmatter", () =>
    Effect.gen(function* () {
      const style = yield* decodeOutputStyle({});
      expect(style.name).toEqual(O.none());
      expect(style.description).toEqual(O.none());
      expect(yield* encodeOutputStyle(style)).toEqual({});
    })
  );

  it.effect("decodes plugin-only output style flags", () =>
    Effect.gen(function* () {
      const style = yield* decodeOutputStyle({
        name: "coding-style",
        "keep-coding-instructions": true,
        "force-for-plugin": true,
      });
      expect(style).toMatchObject({
        name: O.some("coding-style"),
        "keep-coding-instructions": O.some(true),
        "force-for-plugin": O.some(true),
      });
    })
  );
});
