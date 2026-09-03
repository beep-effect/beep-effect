/**
 * The \@beep/schema/ParserOptions parser options configuration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity";
import { Effect, Match, Number as Num, pipe, RegExp as Regex, Result } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { BuffEncoding } from "../BufferEncoding.ts";
import { NonNegativeInt } from "../Int.ts";
import { Defect } from "../Opaque.ts";
import { RegExpFromStr } from "../RegExp.ts";
import * as SchemaUtils from "../SchemaUtils/index.ts";
import { HeaderArray, HeaderTransformFunction } from "./ParserOptions.types.ts";
import type * as AST from "effect/SchemaAST";

const $I = $SchemaId.create("ParserOptions");

const parserOptionsParseOptions = {
  exact: true as const,
  onExcessProperty: "error" as const,
};

const SingleCharacterText = S.String.check(
  S.isLengthBetween(1, 1, {
    description: "A string that must contain exactly one character.",
    message: "delimiter option must be one character long",
  })
).pipe(
  $I.annoteSchema("SingleCharacterText", {
    description: "A string that must contain exactly one character.",
  })
);

const decodeRegExpResult = S.decodeResult(RegExpFromStr);
/**
 * A parser header configuration input.
 *
 * **Example** (Decode header value input)
 *
 * ```ts
 * import { HeaderValueInput } from "@beep/schema/ParserOptions"
 * import * as S from "effect/Schema"
 *
 * const headers = S.decodeUnknownSync(HeaderValueInput)(true)
 * console.log(headers)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const HeaderValueInput = S.Union([S.Boolean, HeaderArray, HeaderTransformFunction]).pipe(
  $I.annoteSchema("HeaderValueInput", {
    description: "A parser header configuration input.",
  })
);

/**
 * {@inheritDoc HeaderValueInput}
 * @category configuration
 * @since 0.0.0
 */
export type HeaderValueInput = typeof HeaderValueInput.Type;

/**
 * A parser options configuration error.
 *
 * **Example** (Create parser options error)
 *
 * ```ts
 * import { Error as ParserOptionsError } from "@beep/schema/ParserOptions"
 * import * as O from "effect/Option"
 *
 * const error = ParserOptionsError.make({ cause: O.none(), message: "Invalid delimiter" })
 * console.log(error.message)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export class ParserOptionsError extends S.TaggedError<ParserOptionsError>($I.make("ParserOptionsError"))(
  "ParserOptionsError",
  {
    cause: S.OptionFromOptionalKey(Defect({ includeStack: true })).pipe(SchemaUtils.withNoneDefault),
    message: S.String,
  },
  $I.annoteError<ParserOptionsError>("ParserOptionsError", {
    description: "Raised when CSV parser options cannot be decoded or normalized.",
  })
) {}

const toParserOptionsError = (fallbackMessage: string, cause?: unknown): ParserOptionsError =>
  ParserOptionsError.make({
    cause: P.isError(cause) ? O.some(cause) : O.none(),
    message: Match.value(cause).pipe(
      Match.when(P.isError, (error) => error.message),
      Match.when(P.isUndefined, () => fallbackMessage),
      Match.orElse((value) => String(value))
    ),
  });

const buildNextTokenRegExp = (escapedDelimiter: string): globalThis.RegExp =>
  pipe(
    decodeRegExpResult(`([^\\s]|\\r\\n|\\n|\\r|${escapedDelimiter})`),
    Result.getOrThrowWith((cause) =>
      toParserOptionsError("Failed to build parser next-token regular expression.", cause)
    )
  );

/**
 * Schema-backed CSV parser options.
 *
 * **Details**
 *
 * Derived runtime fields from the original implementation such as
 * `escapedDelimiter`, `escapeChar`, `supportsComments`, `limitRows`, and
 * `NEXT_TOKEN_REGEXP` are exposed as getters so the schema stays focused on the
 * true input/configuration surface.
 *
 * **Example** (Create parser options)
 *
 * ```ts
 * import { ParserOptions } from "@beep/schema/ParserOptions"
 *
 * const options = ParserOptions.new({ delimiter: ";" })
 * console.log(options.escapedDelimiter)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class ParserOptions extends S.Class<ParserOptions>($I`ParserOptions`)(
  {
    objectMode: SchemaUtils.BoolKeyDefaultTrue,
    delimiter: SingleCharacterText.pipe(SchemaUtils.withKeyDefaults(",")),
    ignoreEmpty: SchemaUtils.BoolKeyDefaultFalse,
    quote: S.OptionFromNullOr(S.String).pipe(
      S.withConstructorDefault(Effect.succeedSome('"')),
      S.withDecodingDefaultKey(Effect.succeed('"'))
    ),
    escape: S.OptionFromNullOr(S.String).pipe(
      SchemaUtils.withNoneDefault,
      S.withDecodingDefaultKey(Effect.succeed(null))
    ),
    comment: S.OptionFromNullOr(S.String).pipe(
      SchemaUtils.withNoneDefault,
      S.withDecodingDefaultKey(Effect.succeed(null))
    ),
    ltrim: SchemaUtils.BoolKeyDefaultFalse,
    rtrim: SchemaUtils.BoolKeyDefaultFalse,
    trim: SchemaUtils.BoolKeyDefaultFalse,
    headers: S.OptionFromNullOr(HeaderValueInput).pipe(
      SchemaUtils.withNoneDefault,
      S.withDecodingDefaultKey(Effect.succeed(null))
    ),
    renameHeaders: SchemaUtils.BoolKeyDefaultFalse,
    strictColumnHandling: SchemaUtils.BoolKeyDefaultFalse,
    discardUnmappedColumns: SchemaUtils.BoolKeyDefaultFalse,
    carriageReturn: S.String.pipe(SchemaUtils.withKeyDefaults("\r")),
    encoding: BuffEncoding.pipe(SchemaUtils.withKeyDefaults(BuffEncoding.Enum.utf8)),
    maxRows: NonNegativeInt.pipe(SchemaUtils.withKeyDefaults(NonNegativeInt.make(0))),
    skipLines: NonNegativeInt.pipe(SchemaUtils.withKeyDefaults(NonNegativeInt.make(0))),
    skipRows: NonNegativeInt.pipe(SchemaUtils.withKeyDefaults(NonNegativeInt.make(0))),
  },
  $I.annote("ParserOptions", {
    description: "Schema-backed CSV parser options.",
    parseOptions: parserOptionsParseOptions,
  })
) {
  /**
   * Decode raw parser option input into a normalized {@link ParserOptions}
   * instance.
   */
  static readonly new = (input?: ParserOptionsArgs): ParserOptions =>
    pipe(
      ParserOptions.decodeUnknownResult(input ?? {}, parserOptionsParseOptions),
      Result.getOrThrowWith((cause) => toParserOptionsError("Failed to decode parser options.", cause))
    );

  static readonly decodeUnknownResult: {
    (input: unknown, options?: AST.ParseOptions): Result.Result<ParserOptions, S.SchemaError>;
    (options?: AST.ParseOptions): (input: unknown) => Result.Result<ParserOptions, S.SchemaError>;
  } = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownResult(ParserOptions));

  get escapedDelimiter(): string {
    return Regex.escape(this.delimiter);
  }

  get escapeChar(): O.Option<string> {
    return O.orElse(() => this.quote)(this.escape);
  }

  get supportsComments(): boolean {
    return O.isSome(this.comment);
  }

  get limitRows(): boolean {
    return Num.isGreaterThan(0)(this.maxRows);
  }

  get NEXT_TOKEN_REGEXP(): globalThis.RegExp {
    return buildNextTokenRegExp(this.escapedDelimiter);
  }
}

/**
 * Encoded/raw constructor input for {@link ParserOptions}.
 *
 * **Example** (Satisfy parser options args)
 *
 * ```ts
 * import type { ParserOptionsArgs } from "@beep/schema/ParserOptions"
 *
 * const options = { delimiter: ";" } satisfies ParserOptionsArgs
 * console.log(options.delimiter)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export type ParserOptionsArgs = typeof ParserOptions.Encoded;

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { ParserOptions as Schema, ParserOptionsError as Error };
