/**
 * Parse Markdown text straight into an `Md.Document`.
 *
 * **Details**
 *
 * `parseResult` runs the `@beep/markdown` parser with frontmatter capture on
 * and folds the result through `Md.syntax.fromMarkdownDocument`.
 * `parseSafeResult` then narrows the document to a `SafeDocument`. Each has an
 * `Effect` twin. The synchronous `Result` forms are primary because the known
 * callers are synchronous string builders.
 *
 * There is no `Context.Service` here. Parsing is a pure, total, synchronous
 * function of the text and options-as-data: there is no environment, no
 * resource, no IO and no alternative implementation to swap in tests. A
 * service would put a requirement on every caller and remove the `Result`
 * path. A slice that wants configured ingest can wrap `parseSafe` in its own
 * service.
 *
 * @since 0.0.0
 */

import { $MdId } from "@beep/identity/packages";
import { MarkdownDialect } from "@beep/markdown/Markdown";
import { MarkdownDiagnostic } from "@beep/markdown/MarkdownDiagnostic";
import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import {
  fromMarkdownDocument,
  MdFrontmatterError,
  MdSyntaxOptionFields,
  MdUnsafeDocumentError,
  refineSafe,
} from "./Md.syntax.ts";
import type { SafeDocument } from "./Md.safe.ts";
import type { MdFromSyntax } from "./Md.syntax.ts";

const $I = $MdId.create("Md.parse");

/**
 * The parser rejected the text: a fatal `@beep/markdown` diagnostic, currently
 * only a nesting-depth guard.
 *
 * **Example** (Read a parse error)
 *
 * ```ts
 * import { MarkdownDiagnostic } from "@beep/markdown/MarkdownDiagnostic"
 * import { MdParseError } from "@beep/md/Md.parse"
 *
 * const error = MdParseError.make({
 *   diagnostic: MarkdownDiagnostic.make({
 *     code: "NestingDepthExceeded",
 *     message: "too deep",
 *     line: 0,
 *     character: 0,
 *     offset: 0,
 *     length: 1,
 *   }),
 * })
 * console.log(error._tag) // "MdParseError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MdParseError extends S.TaggedError<MdParseError, { readonly brand: unique symbol }>($I`MdParseError`)(
  "MdParseError",
  {
    diagnostic: MarkdownDiagnostic,
  },
  $I.annoteError<MdParseError>("MdParseError", {
    description: "Markdown text the syntax parser rejected with a fatal diagnostic.",
  })
) {}

/**
 * Options for {@link parseResult}: every bridge option of
 * `MdSyntaxOptions` plus the Markdown `dialect` (`"gfm"` by default).
 *
 * **Example** (Resolve parse defaults)
 *
 * ```ts
 * import { MdParseOptions } from "@beep/md/Md.parse"
 *
 * const options = MdParseOptions.make({ dialect: "commonmark" })
 * console.log(options.dialect, options.html) // "commonmark" "escapeAsText"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class MdParseOptions extends S.Opaque<MdParseOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    ...MdSyntaxOptionFields,
    dialect: MarkdownDialect.pipe(
      S.withConstructorDefault(Effect.succeed(MarkdownDialect.Enum.gfm)),
      $I.annoteKey("MdParseOptions.dialect", { description: "Markdown grammar to parse with; gfm by default." }),
      S.withDecodingDefaultTypeKey(Effect.succeed(MarkdownDialect.Enum.gfm))
    ),
  }).pipe(
    $I.annoteSchema("MdParseOptions", {
      description: "Markdown dialect plus the syntax-bridge policies for parsing text into an Md document.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MdParseOptions {
  /**
   * The plain options object the parse functions accept; every key is
   * optional.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof MdParseOptions.Encoded;
}

/**
 * Every way {@link parseResult} can fail.
 *
 * **Example** (Check a parse failure)
 *
 * ```ts
 * import { MdParseFailure } from "@beep/md/Md.parse"
 * import { MdFrontmatterError } from "@beep/md/Md.syntax"
 * import { Position } from "@beep/markdown/MarkdownNode"
 * import * as S from "effect/Schema"
 *
 * const error = MdFrontmatterError.make({ format: "yaml", reason: "invalid", position: Position.synthetic, cause: null })
 * console.log(S.is(MdParseFailure)(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const MdParseFailure = S.Union([MdParseError, MdFrontmatterError]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("MdParseFailure", { description: "Why Markdown text could not become an Md document." })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type MdParseFailure = typeof MdParseFailure.Type;

/**
 * Every way {@link parseSafeResult} can fail.
 *
 * **Example** (Check a safe-parse failure)
 *
 * ```ts
 * import { MdParseSafeFailure } from "@beep/md/Md.parse"
 * import { MdUnsafeDocumentError } from "@beep/md/Md.syntax"
 * import { RawNodeSafetyViolation } from "@beep/md/Md.safe"
 * import * as S from "effect/Schema"
 *
 * const error = MdUnsafeDocumentError.make({
 *   violations: [RawNodeSafetyViolation.make({ path: [], nodeTag: "rawHtml" })],
 *   located: [],
 * })
 * console.log(S.is(MdParseSafeFailure)(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const MdParseSafeFailure = S.Union([MdParseError, MdFrontmatterError, MdUnsafeDocumentError]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("MdParseSafeFailure", {
    description: "Why Markdown text could not become a safe Md document.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type MdParseSafeFailure = typeof MdParseSafeFailure.Type;

const isText = (args: IArguments): boolean => P.isString(args[0]);

const parseResultImpl = (
  text: string,
  options?: MdParseOptions.Encoded
): Result.Result<MdFromSyntax, MdParseFailure> => {
  const resolved = MdParseOptions.make(options ?? {});
  return pipe(
    MarkdownDocument.parseResult(text, { dialect: resolved.dialect, frontmatter: true }),
    Result.mapError((error): MdParseFailure => MdParseError.make({ diagnostic: error.diagnostic })),
    Result.flatMap((document) => fromMarkdownDocument(document, resolved))
  );
};

/**
 * Parse Markdown text into an `Md.Document` with its losses and source map.
 *
 * **Details**
 *
 * Frontmatter capture is always on, so a leading `---` block is frontmatter
 * and never a thematic break plus a setext heading; the `frontmatter` option
 * decides whether it is decoded or dropped.
 *
 * **Example** (Parse text)
 *
 * ```ts
 * import { parseResult } from "@beep/md/Md.parse"
 * import * as Result from "effect/Result"
 *
 * const bridged = Result.getOrThrow(parseResult("---\ntitle: Notes\n---\n# Notes"))
 * console.log(bridged.document.children[0]?._tag) // "heading"
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseResult: {
  (options?: MdParseOptions.Encoded): (text: string) => Result.Result<MdFromSyntax, MdParseFailure>;
  (text: string, options?: MdParseOptions.Encoded): Result.Result<MdFromSyntax, MdParseFailure>;
} = dual(isText, parseResultImpl);

/**
 * The `Effect` twin of {@link parseResult}.
 *
 * **Example** (Parse in an Effect)
 *
 * ```ts
 * import { parse } from "@beep/md/Md.parse"
 * import * as Effect from "effect/Effect"
 *
 * const bridged = Effect.runSync(parse("Hello"))
 * console.log(bridged.losses.length) // 0
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parse: {
  (options?: MdParseOptions.Encoded): (text: string) => Effect.Effect<MdFromSyntax, MdParseFailure>;
  (text: string, options?: MdParseOptions.Encoded): Effect.Effect<MdFromSyntax, MdParseFailure>;
} = dual(
  isText,
  Effect.fn("Md.parse")((text: string, options?: MdParseOptions.Encoded) =>
    Effect.fromResult(parseResultImpl(text, options))
  )
);

const parseSafeResultImpl = (
  text: string,
  options?: MdParseOptions.Encoded
): Result.Result<SafeDocument, MdParseSafeFailure> =>
  Result.flatMap(
    parseResultImpl(text, options),
    (bridged): Result.Result<SafeDocument, MdParseSafeFailure> => refineSafe(bridged)
  );

/**
 * Parse Markdown text into a `SafeDocument`, failing with the located safety
 * violations when the bridged document is not safe.
 *
 * **Example** (Reject raw HTML)
 *
 * ```ts
 * import { parseSafeResult } from "@beep/md/Md.parse"
 * import * as Result from "effect/Result"
 *
 * console.log(Result.isSuccess(parseSafeResult("<b>x</b>"))) // true
 * console.log(Result.isFailure(parseSafeResult("<b>x</b>", { html: "rawHtml" }))) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseSafeResult: {
  (options?: MdParseOptions.Encoded): (text: string) => Result.Result<SafeDocument, MdParseSafeFailure>;
  (text: string, options?: MdParseOptions.Encoded): Result.Result<SafeDocument, MdParseSafeFailure>;
} = dual(isText, parseSafeResultImpl);

/**
 * The `Effect` twin of {@link parseSafeResult}.
 *
 * **Example** (Safe-parse in an Effect)
 *
 * ```ts
 * import { parseSafe } from "@beep/md/Md.parse"
 * import * as Effect from "effect/Effect"
 *
 * const document = Effect.runSync(parseSafe("Hello"))
 * console.log(document.children.length) // 1
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseSafe: {
  (options?: MdParseOptions.Encoded): (text: string) => Effect.Effect<SafeDocument, MdParseSafeFailure>;
  (text: string, options?: MdParseOptions.Encoded): Effect.Effect<SafeDocument, MdParseSafeFailure>;
} = dual(
  isText,
  Effect.fn("Md.parseSafe")((text: string, options?: MdParseOptions.Encoded) =>
    Effect.fromResult(parseSafeResultImpl(text, options))
  )
);
