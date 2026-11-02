// Internal option shapes consumed by the engine. The public facade owns the
// option schemas (`YamlParseOptions`, `YamlStringifyOptions`,
// `YamlFormattingOptions`); the engine takes these plain records so it never
// imports the facade. Defaults are applied where consumed (`?? default`).

import { $YamlId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import * as S from "effect/Schema";
import { CollectionStyle, QuoteCompat, QuoteStyle, ScalarStyle } from "../YamlNode.ts";

const $I = $YamlId.create("internal/options");

/** A facade options bag: every engine field optional, explicit `undefined` allowed. */
type OptionsBag<A> = { readonly [K in keyof A]?: A[K] | undefined };

/**
 * Configures parse recovery, alias limits, and duplicate-key handling in the composer.
 *
 * **Details**
 *
 * Parse options as consumed by the composer. All fields optional.
 *
 * **Example** (Set an alias limit)
 *
 * ```ts
 * import { ParseOptionsInput } from "@beep/yaml/internal/options"
 * const options = ParseOptionsInput.make({ maxAliasCount: 10 })
 * console.log(options.maxAliasCount) // 10
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ParseOptionsInput extends S.Opaque<ParseOptionsInput, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * Treat parse errors as failures rather than recovering. Default `true`.
     *
     * @since 0.0.0
     */
    strict: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("ParseOptionsInput.strict", {
        description: "Treat parse errors as failures rather than recovering. Default `true`.",
      })
    ),
    /**
     * Max alias nodes per document (DoS guard). Default `100`.
     *
     * @since 0.0.0
     */
    maxAliasCount: S.optionalKey(S.Finite).pipe(
      $I.annoteKey("ParseOptionsInput.maxAliasCount", {
        description: "Max alias nodes per document (DoS guard). Default `100`.",
      })
    ),
    /**
     * Treat duplicate mapping keys as errors. Default `true`.
     *
     * @since 0.0.0
     */
    uniqueKeys: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("ParseOptionsInput.uniqueKeys", {
        description: "Treat duplicate mapping keys as errors. Default `true`.",
      })
    ),
  }).pipe(
    $I.annoteSchema("ParseOptionsInput", {
      description: "Plain parse options consumed by the composer; absent values retain consumption-site defaults.",
    })
  )
) {
  /**
   * Project a public parse-options bag onto the engine record, keeping only
   * its defined parse fields.
   *
   * **Example** (Project facade parse options)
   *
   * ```ts
   * import { ParseOptionsInput } from "@beep/yaml/internal/options"
   *
   * const options = ParseOptionsInput.fromOptions({ maxAliasCount: 10, strict: undefined })
   * console.log(options) // { maxAliasCount: 10 }
   * ```
   *
   * @param options - Facade options; `undefined` entries are dropped.
   * @returns The validated engine parse options.
   * @category constructors
   * @since 0.0.0
   */
  static fromOptions(options?: OptionsBag<S.Struct.Type<typeof ParseOptionsInput.fields>>): ParseOptionsInput {
    return ParseOptionsInput.make(
      options === undefined
        ? {}
        : O.getSomesStruct({
            strict: O.fromUndefinedOr(options.strict),
            maxAliasCount: O.fromUndefinedOr(options.maxAliasCount),
            uniqueKeys: O.fromUndefinedOr(options.uniqueKeys),
          })
    );
  }
}

/**
 * Validates the spaces-per-level `indent` stringify option.
 *
 * **Details**
 *
 * A non-negative integer: `0` stays valid (a multiline plain scalar then falls
 * back to quotes), while negatives and fractions are rejected when options are
 * decoded instead of reaching the indentation renderer.
 *
 * **Example** (Validate an indent width)
 *
 * ```ts
 * import { IndentWidth } from "@beep/yaml/internal/options"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(IndentWidth)(4)) // true
 * console.log(S.is(IndentWidth)(-2)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const IndentWidth = S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("IndentWidth", { description: "Spaces per indentation level: a non-negative integer." })
);

/**
 * Configures scalar presentation and collection layout in the stringifier.
 *
 * **Details**
 *
 * Stringify options as consumed by the stringifier. All fields optional.
 *
 * **Example** (Configure line wrapping)
 *
 * ```ts
 * import { StringifyOptionsInput } from "@beep/yaml/internal/options"
 * const options = StringifyOptionsInput.make({ lineWidth: 80 })
 * console.log(options.lineWidth) // 80
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class StringifyOptionsInput extends S.Opaque<StringifyOptionsInput, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * Spaces per indentation level. Default `2`.
     *
     * @since 0.0.0
     */
    indent: S.optionalKey(IndentWidth).pipe(
      $I.annoteKey("StringifyOptionsInput.indent", { description: "Spaces per indentation level. Default `2`." })
    ),
    /**
     * Column at which to fold long flow and block-folded scalars. Default `0`
     * (and a value `<= 0`) means never wrap — byte-identical, no-fold output.
     * A positive value folds plain, double-quoted and block-folded (`>`)
     * scalars at approximately that column; block-literal (`|`) is never folded.
     *
     * @since 0.0.0
     */
    lineWidth: S.optionalKey(S.Finite).pipe(
      $I.annoteKey("StringifyOptionsInput.lineWidth", {
        description:
          "Column at which to fold long flow and block-folded scalars. Default `0` (and a value `<= 0`) means never wrap \u2014 byte-identical, no-fold output. A positive value folds plain, double-quoted and block-folded (`>`) scalars at approximately that column; block-literal (`|`) is never folded.",
      })
    ),
    /**
     * Scalar output style when none is requested. Default `"plain"`.
     *
     * @since 0.0.0
     */
    defaultScalarStyle: S.optionalKey(ScalarStyle).pipe(
      $I.annoteKey("StringifyOptionsInput.defaultScalarStyle", {
        description: 'Scalar output style when none is requested. Default `"plain"`.',
      })
    ),
    /**
     * Collection output style when none is requested. Default `"block"`.
     *
     * @since 0.0.0
     */
    defaultCollectionStyle: S.optionalKey(CollectionStyle).pipe(
      $I.annoteKey("StringifyOptionsInput.defaultCollectionStyle", {
        description: 'Collection output style when none is requested. Default `"block"`.',
      })
    ),
    /**
     * Sort mapping keys alphabetically. Default `false`.
     *
     * @since 0.0.0
     */
    sortKeys: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("StringifyOptionsInput.sortKeys", {
        description: "Sort mapping keys alphabetically. Default `false`.",
      })
    ),
    /**
     * Indent block sequences one level under a mapping key. Default `false`.
     *
     * @since 0.0.0
     */
    indentSequences: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("StringifyOptionsInput.indentSequences", {
        description: "Indent block sequences one level under a mapping key. Default `false`.",
      })
    ),
    /**
     * Quote style for a `plain`-styled scalar that requires quoting. Default
     * `"single"`; `"auto"` picks per value. Values needing YAML escapes still
     * render double-quoted.
     *
     * @since 0.0.0
     */
    quoteStyle: S.optionalKey(QuoteStyle).pipe(
      $I.annoteKey("StringifyOptionsInput.quoteStyle", {
        description:
          'Quote style for a `plain`-styled scalar that requires quoting. Default `"single"`; `"auto"` picks per value. Values needing YAML escapes still render double-quoted.',
      })
    ),
    /**
     * Additionally quote plain scalars a foreign resolution dialect would
     * coerce to a non-string. Default absent — no extra quoting.
     *
     * @since 0.0.0
     */
    quoteCompat: S.optionalKey(QuoteCompat).pipe(
      $I.annoteKey("StringifyOptionsInput.quoteCompat", {
        description:
          "Additionally quote plain scalars a foreign resolution dialect would coerce to a non-string. Default absent \u2014 no extra quoting.",
      })
    ),
    /**
     * End output with a trailing newline. Default `true`.
     *
     * @since 0.0.0
     */
    finalNewline: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("StringifyOptionsInput.finalNewline", {
        description: "End output with a trailing newline. Default `true`.",
      })
    ),
    /**
     * Ignore per-node styles and force the defaults. Default `false`.
     *
     * @since 0.0.0
     */
    forceDefaultStyles: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("StringifyOptionsInput.forceDefaultStyles", {
        description: "Ignore per-node styles and force the defaults. Default `false`.",
      })
    ),
    /**
     * Engine-internal, never surfaced on the public option classes: render
     * the ROOT value as if it already sat inside a flow collection, so a
     * plain scalar carrying a flow indicator (`,[]{}`) is quoted. Used by the
     * region-confined `modify` splice when the target's parent is
     * flow-styled. Default `false`.
     *
     * @since 0.0.0
     */
    inFlow: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("StringifyOptionsInput.inFlow", {
        description:
          "Engine-internal, never surfaced on the public option classes: render the ROOT value as if it already sat inside a flow collection, so a plain scalar carrying a flow indicator (`,[]{}`) is quoted. Used by the region-confined `modify` splice when the target's parent is flow-styled. Default `false`.",
      })
    ),
  }).pipe(
    $I.annoteSchema("StringifyOptionsInput", {
      description:
        "Plain stringify options consumed by the stringifier; absent values retain consumption-site defaults.",
    })
  )
) {
  /**
   * Project a public stringify- or formatting-options bag onto the engine
   * record, keeping only its defined stringify fields (never the
   * engine-internal `inFlow`).
   *
   * **Example** (Project facade stringify options)
   *
   * ```ts
   * import { StringifyOptionsInput } from "@beep/yaml/internal/options"
   *
   * const options = StringifyOptionsInput.fromOptions({ indent: 4, sortKeys: undefined })
   * console.log(options) // { indent: 4 }
   * ```
   *
   * @param options - Facade options; `undefined` entries are dropped.
   * @returns The validated engine stringify options.
   * @category constructors
   * @since 0.0.0
   */
  static fromOptions(options?: OptionsBag<S.Struct.Type<typeof StringifyOptionsInput.fields>>): StringifyOptionsInput {
    return StringifyOptionsInput.make(
      options === undefined
        ? {}
        : O.getSomesStruct({
            indent: O.fromUndefinedOr(options.indent),
            lineWidth: O.fromUndefinedOr(options.lineWidth),
            defaultScalarStyle: O.fromUndefinedOr(options.defaultScalarStyle),
            defaultCollectionStyle: O.fromUndefinedOr(options.defaultCollectionStyle),
            sortKeys: O.fromUndefinedOr(options.sortKeys),
            indentSequences: O.fromUndefinedOr(options.indentSequences),
            quoteStyle: O.fromUndefinedOr(options.quoteStyle),
            quoteCompat: O.fromUndefinedOr(options.quoteCompat),
            finalNewline: O.fromUndefinedOr(options.finalNewline),
            forceDefaultStyles: O.fromUndefinedOr(options.forceDefaultStyles),
          })
    );
  }
}
