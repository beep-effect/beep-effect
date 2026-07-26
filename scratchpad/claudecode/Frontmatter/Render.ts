/**
 * Effectful YAML rendering for Claude Code markdown frontmatter.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { A, R, Str } from "@beep/utils";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { stringify as stringifyYaml } from "yaml";

import { CommandFrontmatter } from "./Command.ts";
import { OutputStyleFrontmatter } from "./OutputStyle.ts";
import { SkillFrontmatter } from "./Skill.ts";
import { SubagentFrontmatter } from "./Subagent.ts";

const $I = $ScratchpadId.create("claudecode/Frontmatter/Render");

const FrontmatterFields = S.Record(S.String, S.Unknown).pipe(
  $I.annoteSchema("FrontmatterFields", {
    description: "String-keyed YAML frontmatter fields ready for serialization.",
  })
);

/**
 * Runtime model for a markdown body paired with optional frontmatter fields.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { Frontmatter } from "effect-claudecode"
 *
 * const document = Frontmatter.FrontmatterDocument.make({
 *   frontmatter: O.none(),
 *   body: "# Review"
 * })
 * console.log(document.body)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FrontmatterDocument extends S.Class<FrontmatterDocument>($I`FrontmatterDocument`)(
  {
    frontmatter: S.OptionFromOptionalKey(FrontmatterFields).pipe(SchemaUtils.withNoneDefault),
    body: S.String,
  },
  $I.annote("FrontmatterDocument", {
    description: "Runtime model for a markdown body paired with optional frontmatter fields.",
  })
) {}

/**
 * Encoded input accepted by {@link render}.
 *
 * @example
 * ```ts
 * import type { Frontmatter } from "effect-claudecode"
 *
 * const document: Frontmatter.FrontmatterDocument.Encoded = {
 *   frontmatter: { name: "review" },
 *   body: "# Review"
 * }
 * console.log(document.body)
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export declare namespace FrontmatterDocument {
  /**
   * Runtime type represented by {@link FrontmatterDocument}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = FrontmatterDocument;

  /**
   * JSON representation accepted by {@link FrontmatterDocument}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof FrontmatterDocument.Encoded;
}

const compactFrontmatter = (frontmatter: Readonly<Record<string, unknown>>): Record<string, unknown> =>
  R.fromEntries(A.filter(R.toEntries(frontmatter), ([, value]) => P.isNotUndefined(value)));

const normalizeBody = (body: string): string => (Str.isEmpty(body) ? Str.empty : `\n\n${body}`);

const renderDocument = (document: FrontmatterDocument) =>
  O.match(document.frontmatter, {
    onNone: () => Effect.succeed(document.body),
    onSome: (fields) => {
      const frontmatter = compactFrontmatter(fields);
      return R.isEmptyReadonlyRecord(frontmatter)
        ? Effect.succeed(document.body)
        : Effect.try(() => `---\n${stringifyYaml(frontmatter)}---${normalizeBody(document.body)}`);
    },
  });

const decodeFrontmatterDocument = S.decodeUnknownEffect(FrontmatterDocument);
const isFrontmatterDocument = S.is(FrontmatterDocument);

const encodeFrontmatter = <Schema extends S.Top>(schema: Schema, input: Schema["Type"] | Schema["Encoded"]) => {
  const decoded = S.is(schema)(input) ? Effect.succeed(input) : S.decodeUnknownEffect(schema)(input);
  return decoded.pipe(Effect.flatMap(S.encodeEffect(schema)));
};

/**
 * Render a markdown document with optional YAML frontmatter.
 *
 * Rendering is effectful because both schema validation and YAML serialization
 * can fail. Empty or absent frontmatter produces the body unchanged.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Frontmatter } from "effect-claudecode"
 *
 * Effect.runPromise(Frontmatter.render({ frontmatter: { name: "review" }, body: "# Review" }))
 *   .then((markdown) => console.log(markdown.includes("name: review")))
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const render = Effect.fn("Frontmatter.render")((document: FrontmatterDocument | FrontmatterDocument.Encoded) =>
  (isFrontmatterDocument(document) ? Effect.succeed(document) : decodeFrontmatterDocument(document)).pipe(
    Effect.flatMap(renderDocument)
  )
);

/**
 * Render a legacy Claude Code slash-command markdown file.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Frontmatter } from "effect-claudecode"
 *
 * Effect.runPromise(Frontmatter.renderCommand({}, "# /review"))
 *   .then((markdown) => console.log(markdown)) // "# /review"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const renderCommand = Effect.fn("Frontmatter.renderCommand")(
  (frontmatter: CommandFrontmatter | CommandFrontmatter.Encoded, body: string) =>
    encodeFrontmatter(CommandFrontmatter, frontmatter).pipe(
      Effect.flatMap((encoded) => render({ frontmatter: encoded, body }))
    )
);

/**
 * Render a Claude Code `SKILL.md` file.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Frontmatter } from "effect-claudecode"
 *
 * const program = Frontmatter.renderSkill({ name: "review", "allowed-tools": ["Read"] }, "# Review")
 * Effect.runPromise(program).then((markdown) => console.log(markdown.includes("name: review")))
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const renderSkill = Effect.fn("Frontmatter.renderSkill")(
  (frontmatter: SkillFrontmatter | SkillFrontmatter.Encoded, body: string) =>
    encodeFrontmatter(SkillFrontmatter, frontmatter).pipe(
      Effect.flatMap((encoded) => render({ frontmatter: encoded, body }))
    )
);

/**
 * Render a Claude Code subagent markdown file.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Frontmatter } from "effect-claudecode"
 *
 * const program = Frontmatter.renderSubagent(
 *   { name: "reviewer", description: "Reviews changes" },
 *   "# Reviewer"
 * )
 * Effect.runPromise(program).then((markdown) => console.log(markdown.includes("name: reviewer")))
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const renderSubagent = Effect.fn("Frontmatter.renderSubagent")(
  (frontmatter: SubagentFrontmatter | SubagentFrontmatter.Encoded, body: string) =>
    encodeFrontmatter(SubagentFrontmatter, frontmatter).pipe(
      Effect.flatMap((encoded) => render({ frontmatter: encoded, body }))
    )
);

/**
 * Render a Claude Code output-style markdown file.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Frontmatter } from "effect-claudecode"
 *
 * const program = Frontmatter.renderOutputStyle({ name: "terse" }, "# Terse")
 * Effect.runPromise(program).then((markdown) => console.log(markdown.includes("name: terse")))
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const renderOutputStyle = Effect.fn("Frontmatter.renderOutputStyle")(
  (frontmatter: OutputStyleFrontmatter | OutputStyleFrontmatter.Encoded, body: string) =>
    encodeFrontmatter(OutputStyleFrontmatter, frontmatter).pipe(
      Effect.flatMap((encoded) => render({ frontmatter: encoded, body }))
    )
);
