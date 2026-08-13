/**
 * Effectful parsing for Claude Code markdown files with YAML frontmatter.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { YamlTextToUnknown } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

import { FrontmatterDecodeError, FrontmatterParseError, FrontmatterReadError } from "../Errors.ts";
import { CommandFrontmatter } from "./Command.ts";
import { OutputStyleFrontmatter } from "./OutputStyle.ts";
import { SkillFrontmatter } from "./Skill.ts";
import { SubagentFrontmatter } from "./Subagent.ts";

const $I = $ScratchpadId.create("claudecode/Frontmatter/Parser");

/**
 * A markdown document split into a YAML-decoded value and its opaque body.
 *
 * The raw `frontmatter` remains `unknown` until one of the typed parse helpers
 * validates it against the corresponding Claude Code schema.
 *
 * **Example** (Split a decoded document)
 *
 * ```ts
 * import { Frontmatter } from "effect-claudecode"
 *
 * const parsed = Frontmatter.ParsedFrontmatter.make({
 *   frontmatter: { name: "review" },
 *   body: "# Review"
 * })
 * console.log(parsed.body)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ParsedFrontmatter extends S.Class<ParsedFrontmatter>($I`ParsedFrontmatter`)(
  {
    frontmatter: S.Unknown,
    body: S.String,
  },
  $I.annote("ParsedFrontmatter", {
    description: "A markdown document split into a YAML-decoded value and its opaque body.",
  })
) {}

/**
 * Companion types for {@link ParsedFrontmatter}.
 *
 * **Example** (Describe the encoded document)
 *
 * ```ts
 * import type { Frontmatter } from "effect-claudecode"
 *
 * const input = {
 *   frontmatter: { name: "review" },
 *   body: "# Review"
 * } satisfies Frontmatter.ParsedFrontmatter.Encoded
 * console.log(input.body)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ParsedFrontmatter {
  /**
   * Runtime type represented by {@link ParsedFrontmatter}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = ParsedFrontmatter;

  /**
   * JSON representation accepted by {@link ParsedFrontmatter}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ParsedFrontmatter.Encoded;
}

/**
 * Result of validating parsed frontmatter against a concrete schema.
 *
 * **Example** (Read a decoded document body)
 *
 * ```ts
 * import type { Frontmatter } from "effect-claudecode"
 *
 * const document: Frontmatter.DecodedFrontmatter<string> = {
 *   frontmatter: "review",
 *   body: "# Review"
 * }
 * console.log(document.body) // "# Review"
 * ```
 *
 * @typeParam TFrontmatter - Runtime type produced by the selected frontmatter schema.
 * @category models
 * @since 0.0.0
 */
export type DecodedFrontmatter<TFrontmatter> = {
  readonly frontmatter: TFrontmatter;
  readonly body: string;
};

type SplitFrontmatter = {
  readonly yaml: string;
  readonly body: string;
};

const closingDelimiter = /\n---(?:\r?\n|$)/;

const splitFrontmatter = (source: string): O.Option<SplitFrontmatter> => {
  if (!Str.startsWith("---")(source)) {
    return O.none();
  }

  const afterOpen = Str.slice(3)(source);
  if (Str.isNonEmpty(afterOpen) && !Str.startsWith("\n")(afterOpen) && !Str.startsWith("\r")(afterOpen)) {
    return O.none();
  }

  return Str.match(closingDelimiter)(afterOpen).pipe(
    O.map((match) => {
      const index = O.getOrElse(O.fromUndefinedOr(match.index), () => 0);
      return {
        yaml: Str.slice(0, index)(afterOpen),
        body: Str.slice(index + Str.length(match[0]))(afterOpen),
      };
    })
  );
};

const decodeYamlText = S.decodeUnknownEffect(YamlTextToUnknown);

const decodeYaml = (path: string, yaml: string): Effect.Effect<unknown, FrontmatterParseError> =>
  decodeYamlText(yaml).pipe(Effect.mapError((cause) => FrontmatterParseError.make({ path, cause })));

const decodeFrontmatter = <Schema extends S.Top>(
  path: string,
  parsed: ParsedFrontmatter,
  schema: Schema
): Effect.Effect<DecodedFrontmatter<Schema["Type"]>, FrontmatterDecodeError, Schema["DecodingServices"]> =>
  S.decodeUnknownEffect(schema)(parsed.frontmatter).pipe(
    Effect.map((frontmatter) => ({
      frontmatter,
      body: parsed.body,
    })),
    Effect.mapError((cause) => FrontmatterDecodeError.make({ path, cause }))
  );

/**
 * Parse a raw markdown string into YAML-decoded frontmatter and its body.
 *
 * Missing or malformed delimiters are treated as a body-only document.
 * Invalid YAML fails with {@link FrontmatterParseError}.
 *
 * **Example** (Parse inline frontmatter)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { Frontmatter } from "effect-claudecode"
 *
 * const program = Effect.gen(function* () {
 *   const parsed = yield* Frontmatter.parse("---\nname: review\n---\n# Review", "<inline>")
 *   console.log(parsed.body) // "# Review"
 * })
 * ```
 *
 * @effects Annotates the current span and emits debug logs; may fail with {@link FrontmatterParseError}.
 * @category parsing
 * @since 0.0.0
 */
export const parse = Effect.fn("Frontmatter.parse")(function* (
  source: string,
  path: string
): Effect.fn.Return<ParsedFrontmatter, FrontmatterParseError> {
  yield* Effect.annotateCurrentSpan("frontmatter.path", path);

  return yield* O.match(splitFrontmatter(source), {
    onNone: () =>
      Effect.logDebug("markdown file has no frontmatter").pipe(
        Effect.annotateLogs({ path }),
        Effect.as(ParsedFrontmatter.make({ frontmatter: undefined, body: source }))
      ),
    onSome: ({ yaml, body }) =>
      Effect.logDebug("parsing markdown frontmatter").pipe(
        Effect.annotateLogs({ path }),
        Effect.andThen(decodeYaml(path, yaml)),
        Effect.map((frontmatter) => ParsedFrontmatter.make({ frontmatter, body }))
      ),
  });
});

/**
 * Read a markdown file through `FileSystem` and parse its YAML frontmatter.
 *
 * **Example** (Parse frontmatter from a file)
 *
 * ```ts
 * import * as BunFileSystem from "@effect/platform-bun/BunFileSystem"
 * import { Effect } from "effect"
 * import { Frontmatter } from "effect-claudecode"
 *
 * const program = Frontmatter.parseFile("./SKILL.md").pipe(Effect.provide(BunFileSystem.layer))
 * Effect.runPromise(program).then((parsed) => console.log(parsed.body))
 * ```
 *
 * @effects Requires `FileSystem.FileSystem`, reads the requested file, and may fail with read or YAML parse errors.
 * @category parsing
 * @since 0.0.0
 */
export const parseFile = Effect.fn("Frontmatter.parseFile")(function* (
  path: string
): Effect.fn.Return<ParsedFrontmatter, FrontmatterReadError | FrontmatterParseError, FileSystem.FileSystem> {
  yield* Effect.annotateCurrentSpan("frontmatter.path", path);
  yield* Effect.logDebug("reading markdown frontmatter file").pipe(Effect.annotateLogs({ path }));

  const fs = yield* FileSystem.FileSystem;
  const source = yield* fs
    .readFileString(path)
    .pipe(Effect.mapError((cause) => FrontmatterReadError.make({ path, cause })));
  return yield* parse(source, path);
});

/**
 * Read and decode a Claude Code `SKILL.md` file.
 *
 * **Example** (Decode a skill file)
 *
 * ```ts
 * import * as BunFileSystem from "@effect/platform-bun/BunFileSystem"
 * import { Effect } from "effect"
 * import { Frontmatter } from "effect-claudecode"
 *
 * const program = Frontmatter.parseSkillFile("./SKILL.md").pipe(Effect.provide(BunFileSystem.layer))
 * Effect.runPromise(program).then(({ body }) => console.log(body))
 * ```
 *
 * @effects Requires `FileSystem.FileSystem`, reads the skill file, and may fail with read, parse, or decode errors.
 * @category decoding
 * @since 0.0.0
 */
export const parseSkillFile = Effect.fn("Frontmatter.parseSkillFile")(function* (
  path: string
): Effect.fn.Return<
  DecodedFrontmatter<SkillFrontmatter>,
  FrontmatterReadError | FrontmatterParseError | FrontmatterDecodeError,
  FileSystem.FileSystem
> {
  const parsed = yield* parseFile(path);
  return yield* decodeFrontmatter(path, parsed, SkillFrontmatter);
});

/**
 * Read and decode a legacy Claude Code slash-command markdown file.
 *
 * **Example** (Decode a command file)
 *
 * ```ts
 * import * as BunFileSystem from "@effect/platform-bun/BunFileSystem"
 * import { Effect } from "effect"
 * import { Frontmatter } from "effect-claudecode"
 *
 * const program = Frontmatter.parseCommandFile("./commands/review.md").pipe(Effect.provide(BunFileSystem.layer))
 * Effect.runPromise(program).then(({ body }) => console.log(body))
 * ```
 *
 * @effects Requires `FileSystem.FileSystem`, reads the command file, and may fail with read, parse, or decode errors.
 * @category decoding
 * @since 0.0.0
 */
export const parseCommandFile = Effect.fn("Frontmatter.parseCommandFile")(function* (
  path: string
): Effect.fn.Return<
  DecodedFrontmatter<CommandFrontmatter>,
  FrontmatterReadError | FrontmatterParseError | FrontmatterDecodeError,
  FileSystem.FileSystem
> {
  const parsed = yield* parseFile(path);
  return yield* decodeFrontmatter(path, parsed, CommandFrontmatter);
});

/**
 * Read and decode a Claude Code subagent markdown file.
 *
 * **Example** (Decode a subagent file)
 *
 * ```ts
 * import * as BunFileSystem from "@effect/platform-bun/BunFileSystem"
 * import { Effect } from "effect"
 * import { Frontmatter } from "effect-claudecode"
 *
 * const program = Frontmatter.parseSubagentFile("./agents/reviewer.md").pipe(Effect.provide(BunFileSystem.layer))
 * Effect.runPromise(program).then(({ body }) => console.log(body))
 * ```
 *
 * @effects Requires `FileSystem.FileSystem`, reads the subagent file, and may fail with read, parse, or decode errors.
 * @category decoding
 * @since 0.0.0
 */
export const parseSubagentFile = Effect.fn("Frontmatter.parseSubagentFile")(function* (
  path: string
): Effect.fn.Return<
  DecodedFrontmatter<SubagentFrontmatter>,
  FrontmatterReadError | FrontmatterParseError | FrontmatterDecodeError,
  FileSystem.FileSystem
> {
  const parsed = yield* parseFile(path);
  return yield* decodeFrontmatter(path, parsed, SubagentFrontmatter);
});

/**
 * Read and decode a Claude Code output-style markdown file.
 *
 * **Example** (Decode an output style file)
 *
 * ```ts
 * import * as BunFileSystem from "@effect/platform-bun/BunFileSystem"
 * import { Effect } from "effect"
 * import { Frontmatter } from "effect-claudecode"
 *
 * const program = Frontmatter.parseOutputStyleFile("./output-styles/terse.md").pipe(
 *   Effect.provide(BunFileSystem.layer)
 * )
 * Effect.runPromise(program).then(({ body }) => console.log(body))
 * ```
 *
 * @effects Requires `FileSystem.FileSystem`, reads the output-style file, and may fail with read, parse, or decode errors.
 * @category decoding
 * @since 0.0.0
 */
export const parseOutputStyleFile = Effect.fn("Frontmatter.parseOutputStyleFile")(function* (
  path: string
): Effect.fn.Return<
  DecodedFrontmatter<OutputStyleFrontmatter>,
  FrontmatterReadError | FrontmatterParseError | FrontmatterDecodeError,
  FileSystem.FileSystem
> {
  const parsed = yield* parseFile(path);
  return yield* decodeFrontmatter(path, parsed, OutputStyleFrontmatter);
});
