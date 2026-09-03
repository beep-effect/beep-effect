/**
 * High-level CSV codec options for text decode/encode flows.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity";
import { Effect } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { NonNegativeInt } from "../Int.ts";
import * as SchemaUtils from "../SchemaUtils/index.ts";
import type * as AST from "effect/SchemaAST";

const $I = $SchemaId.create("CsvCodecOptions");

const csvCodecOptionsParseOptions = {
  exact: true as const,
  onExcessProperty: "error" as const,
};

const SingleCharacterText = S.String.check(
  S.isLengthBetween(1, 1, {
    description: "A string that must contain exactly one character.",
    message: "CSV option values must be one character long",
  })
).pipe(
  $I.annoteSchema("SingleCharacterText", {
    description: "A string that must contain exactly one character.",
  })
);

/**
 * Schema-backed CSV text codec options.
 *
 * **Example** (Decode codec options)
 *
 * ```ts
 * import { CsvCodecOptions } from "@beep/schema/CsvCodecOptions"
 * import * as S from "effect/Schema"
 *
 * const options = S.decodeUnknownSync(CsvCodecOptions)({ delimiter: ";" })
 * console.log(options.delimiter)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class CsvCodecOptions extends S.Class<CsvCodecOptions>($I`CsvCodecOptions`)(
  {
    delimiter: SingleCharacterText.pipe(SchemaUtils.withKeyDefaults(",")),
    ignoreEmpty: SchemaUtils.BoolKeyDefaultFalse,
    quote: S.OptionFromNullOr(SingleCharacterText).pipe(
      S.withConstructorDefault(Effect.succeedSome('"')),
      S.withDecodingDefaultKey(Effect.succeed('"'))
    ),
    escape: S.OptionFromNullOr(SingleCharacterText).pipe(
      SchemaUtils.withNoneDefault,
      S.withDecodingDefaultKey(Effect.succeed(null))
    ),
    comment: S.OptionFromNullOr(SingleCharacterText).pipe(
      SchemaUtils.withNoneDefault,
      S.withDecodingDefaultKey(Effect.succeed(null))
    ),
    ltrim: SchemaUtils.BoolKeyDefaultFalse,
    rtrim: SchemaUtils.BoolKeyDefaultFalse,
    trim: SchemaUtils.BoolKeyDefaultFalse,
    strictColumnHandling: SchemaUtils.BoolKeyDefaultFalse,
    maxRows: NonNegativeInt.pipe(SchemaUtils.withKeyDefaults(NonNegativeInt.make(0))),
    skipLines: NonNegativeInt.pipe(SchemaUtils.withKeyDefaults(NonNegativeInt.make(0))),
    skipRows: NonNegativeInt.pipe(SchemaUtils.withKeyDefaults(NonNegativeInt.make(0))),
  },
  $I.annote("CsvCodecOptions", {
    description: "Schema-backed CSV text codec options.",
    parseOptions: csvCodecOptionsParseOptions,
  })
) {
  static readonly decodeEffect: {
    (input: unknown, options?: AST.ParseOptions): Effect.Effect<CsvCodecOptions, S.SchemaError>;
    (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<CsvCodecOptions, S.SchemaError>;
  } = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(CsvCodecOptions));

  get escapeChar(): O.Option<string> {
    return O.orElse(() => this.quote)(this.escape);
  }
}

/**
 * Encoded/raw constructor input for {@link CsvCodecOptions}.
 *
 * **Example** (Satisfy options args)
 *
 * ```ts
 * import type { CsvCodecOptionsArgs } from "@beep/schema/CsvCodecOptions"
 *
 * const options = { delimiter: ";" } satisfies CsvCodecOptionsArgs
 * console.log(options.delimiter)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export type CsvCodecOptionsArgs = typeof CsvCodecOptions.Encoded;

/**
 * Parse options used when normalizing raw CSV codec option input.
 *
 * **Example** (Inspect parse options)
 *
 * ```ts
 * import { CsvCodecOptionsParseOptions } from "@beep/schema/CsvCodecOptions"
 *
 * console.log(CsvCodecOptionsParseOptions.exact)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const CsvCodecOptionsParseOptions = csvCodecOptionsParseOptions;

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { CsvCodecOptions as Schema, CsvCodecOptionsParseOptions as ParseOptions };
