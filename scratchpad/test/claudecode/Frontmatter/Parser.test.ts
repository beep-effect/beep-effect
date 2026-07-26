/** @effect-diagnostics strictEffectProvide:skip-file */
/**
 * Tests for `Frontmatter.parse` and `Frontmatter.parseFile`.
 *
 * The parser tests use inline source strings with a sentinel path;
 * the file-reader tests use an in-memory `FileSystem.layerNoop`
 * keyed on absolute paths.
 *
 * @since 0.1.0
 */
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import type * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";

import { FrontmatterDecodeError, FrontmatterParseError, FrontmatterReadError } from "../../../claudecode/Errors.ts";
import * as Command from "../../../claudecode/Frontmatter/Command.ts";
import * as OutputStyle from "../../../claudecode/Frontmatter/OutputStyle.ts";
import * as Parser from "../../../claudecode/Frontmatter/Parser.ts";
import * as Render from "../../../claudecode/Frontmatter/Render.ts";
import * as Skill from "../../../claudecode/Frontmatter/Skill.ts";
import * as Subagent from "../../../claudecode/Frontmatter/Subagent.ts";

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
    readFileString: (path: string) => {
      const content = files.get(path);
      return content === undefined ? Effect.fail(notFoundError(path)) : Effect.succeed(content);
    },
  });

// ---------------------------------------------------------------------------
// parse — string input
// ---------------------------------------------------------------------------

describe("Frontmatter.parse", () => {
  it.effect("splits a typical skill markdown into frontmatter and body", () =>
    Effect.gen(function* () {
      const source = [
        "---",
        "name: greet",
        "description: Say hello",
        "---",
        "",
        "# Greet",
        "",
        "Say hello to the user.",
        "",
      ].join("\n");

      const result = yield* Parser.parse(source, "<inline>");
      expect(result.frontmatter).toEqual({
        name: "greet",
        description: "Say hello",
      });
      expect(result.body).toBe("\n# Greet\n\nSay hello to the user.\n");
    })
  );

  it.effect("decodes scalars, booleans, arrays, and nested objects", () =>
    Effect.gen(function* () {
      const source = [
        "---",
        "name: complex",
        "user-invocable: true",
        "effort: high",
        "maxTurns: 20",
        "allowed-tools:",
        "  - Read",
        "  - Write",
        "hooks:",
        "  PreToolUse:",
        "    - matcher: Bash",
        "      hooks:",
        "        - type: command",
        "          command: check.sh",
        "---",
        "",
        "body",
      ].join("\n");

      const result = yield* Parser.parse(source, "<inline>");
      expect(result.frontmatter).toMatchObject({
        name: "complex",
        "user-invocable": true,
        effort: "high",
        maxTurns: 20,
        "allowed-tools": ["Read", "Write"],
        hooks: {
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [{ type: "command", command: "check.sh" }],
            },
          ],
        },
      });
    })
  );

  it.effect("returns frontmatter: undefined when no delimiters are present", () =>
    Effect.gen(function* () {
      const source = "# Just a heading\n\nNo frontmatter here.\n";
      const result = yield* Parser.parse(source, "<inline>");
      expect(result.frontmatter).toBeUndefined();
      expect(result.body).toBe(source);
    })
  );

  it.effect("returns frontmatter: undefined when the closing `---` is missing", () =>
    Effect.gen(function* () {
      const source = "---\nname: broken\n\nnever closed";
      const result = yield* Parser.parse(source, "<inline>");
      expect(result.frontmatter).toBeUndefined();
      expect(result.body).toBe(source);
    })
  );

  it.effect("raises FrontmatterParseError on malformed YAML", () =>
    Effect.gen(function* () {
      const source = "---\nname: [unclosed\n---\nbody\n";
      const raised = yield* Effect.flip(Parser.parse(source, "/file.md"));
      expect(raised).toBeInstanceOf(FrontmatterParseError);
      expect(raised).toMatchObject({
        _tag: "FrontmatterParseError",
        path: "/file.md",
      });
    })
  );

  it.effect("handles an empty frontmatter block", () =>
    Effect.gen(function* () {
      const source = "---\n---\nbody\n";
      const result = yield* Parser.parse(source, "<inline>");
      // YAML parses an empty document as null
      expect(result.frontmatter).toBeNull();
      expect(result.body).toBe("body\n");
    })
  );
});

// ---------------------------------------------------------------------------
// parseFile — filesystem input
// ---------------------------------------------------------------------------

describe("Frontmatter.parseFile", () => {
  it.effect("reads a file from the FileSystem service and parses it", () =>
    Effect.gen(function* () {
      const path = "/skills/my-skill/SKILL.md";
      const result = yield* Parser.parseFile(path);
      expect(result.frontmatter).toEqual({
        name: "my-skill",
        description: "Does useful work",
      });
      expect(result.body.trim()).toBe("Hello from the body.");
    }).pipe(
      Effect.provide(
        makeFileSystemLayer(
          new Map([
            [
              "/skills/my-skill/SKILL.md",
              "---\nname: my-skill\ndescription: Does useful work\n---\n\nHello from the body.\n",
            ],
          ])
        )
      )
    )
  );

  it.effect("surfaces I/O failures as FrontmatterReadError", () =>
    Effect.gen(function* () {
      const raised = yield* Effect.flip(Parser.parseFile("/missing.md"));
      expect(raised).toBeInstanceOf(FrontmatterReadError);
      expect(raised).toMatchObject({
        _tag: "FrontmatterReadError",
        path: "/missing.md",
      });
    }).pipe(Effect.provide(makeFileSystemLayer(new Map())))
  );

  it.effect("surfaces YAML failures as FrontmatterParseError with the file path", () =>
    Effect.gen(function* () {
      const raised = yield* Effect.flip(Parser.parseFile("/broken.md"));
      expect(raised).toBeInstanceOf(FrontmatterParseError);
      expect(raised).toMatchObject({
        _tag: "FrontmatterParseError",
        path: "/broken.md",
      });
    }).pipe(Effect.provide(makeFileSystemLayer(new Map([["/broken.md", "---\nname: [bad\n---\nbody\n"]]))))
  );
});

// ---------------------------------------------------------------------------
// typed parse*File helpers
// ---------------------------------------------------------------------------

describe("Frontmatter.parse*File", () => {
  it.effect("parseSkillFile decodes the skill frontmatter schema", () =>
    Effect.gen(function* () {
      const result = yield* Parser.parseSkillFile("/skills/greet/SKILL.md");
      expect(result.frontmatter).toBeInstanceOf(Skill.SkillFrontmatter);
      expect(result.frontmatter).toMatchObject({
        name: O.some("greet"),
        description: O.some("Say hello"),
      });
      expect(result.body.trim()).toBe("# Greet");
    }).pipe(
      Effect.provide(
        makeFileSystemLayer(
          new Map([["/skills/greet/SKILL.md", "---\nname: greet\ndescription: Say hello\n---\n\n# Greet\n"]])
        )
      )
    )
  );

  it.effect("parseCommandFile decodes the command frontmatter schema", () =>
    Effect.gen(function* () {
      const result = yield* Parser.parseCommandFile("/commands/review.md");
      expect(result.frontmatter).toBeInstanceOf(Command.CommandFrontmatter);
      expect(result.frontmatter).toMatchObject({
        description: O.some("Review staged diffs"),
        model: O.some("claude-sonnet-4-6"),
      });
    }).pipe(
      Effect.provide(
        makeFileSystemLayer(
          new Map([
            [
              "/commands/review.md",
              "---\ndescription: Review staged diffs\nmodel: claude-sonnet-4-6\n---\n\n# /review\n",
            ],
          ])
        )
      )
    )
  );

  it.effect("parseSubagentFile decodes the subagent frontmatter schema", () =>
    Effect.gen(function* () {
      const result = yield* Parser.parseSubagentFile("/agents/reviewer.md");
      expect(result.frontmatter).toBeInstanceOf(Subagent.SubagentFrontmatter);
      expect(result.frontmatter).toMatchObject({
        name: "reviewer",
        description: "Review code changes",
      });
    }).pipe(
      Effect.provide(
        makeFileSystemLayer(
          new Map([
            [
              "/agents/reviewer.md",
              "---\nname: reviewer\ndescription: Review code changes\nmodel: claude-opus-4-6\n---\n\n# Reviewer\n",
            ],
          ])
        )
      )
    )
  );

  it.effect("parseOutputStyleFile decodes the output-style frontmatter schema", () =>
    Effect.gen(function* () {
      const result = yield* Parser.parseOutputStyleFile("/output-styles/terse.md");
      expect(result.frontmatter).toBeInstanceOf(OutputStyle.OutputStyleFrontmatter);
      expect(result.frontmatter).toMatchObject({
        name: O.some("terse"),
        description: O.some("Keep responses compact"),
      });
    }).pipe(
      Effect.provide(
        makeFileSystemLayer(
          new Map([
            ["/output-styles/terse.md", "---\nname: terse\ndescription: Keep responses compact\n---\n\n# Terse\n"],
          ])
        )
      )
    )
  );

  it.effect("typed helpers surface schema mismatch as FrontmatterDecodeError", () =>
    Effect.gen(function* () {
      const raised = yield* Effect.flip(Parser.parseSkillFile("/skills/bad/SKILL.md"));
      expect(raised).toBeInstanceOf(FrontmatterDecodeError);
      expect(raised).toMatchObject({
        _tag: "FrontmatterDecodeError",
        path: "/skills/bad/SKILL.md",
      });
    }).pipe(
      Effect.provide(
        makeFileSystemLayer(
          new Map([
            ["/skills/bad/SKILL.md", "---\nname: bad\ndescription: Bad effort\neffort: ludicrous\n---\n\n# Broken\n"],
          ])
        )
      )
    )
  );
});

// ---------------------------------------------------------------------------
// render — typed authoring helpers
// ---------------------------------------------------------------------------

describe("Frontmatter.render*", () => {
  it.effect("renders typed skill frontmatter and markdown body", () =>
    Effect.gen(function* () {
      const markdown = yield* Render.renderSkill(
        {
          name: "greet",
          description: "Say hello",
          "allowed-tools": ["Read"],
        },
        "# Greet\n\nSay hello.\n"
      );

      expect(markdown).toContain("---\n");
      expect(markdown).toContain("name: greet");
      expect(markdown).toContain("description: Say hello");
      expect(markdown).toContain("# Greet");
    })
  );

  it.effect("omits frontmatter delimiters when the command frontmatter is empty", () =>
    Effect.gen(function* () {
      const markdown = yield* Render.renderCommand({}, "# /review\n");
      expect(markdown).toBe("# /review\n");
    })
  );
});
