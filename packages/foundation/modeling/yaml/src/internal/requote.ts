// decision: shared-requote-modes

import { $YamlId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ScalarStyle } from "../YamlNode.ts";
import { renderDoubleQuoted, renderSingleQuoted } from "./stringifier.ts";

const $I = $YamlId.create("internal/requote");

/**
 * The structural slice of a scalar node the re-quoting decision reads —
 * satisfied by a public `YamlScalar` without this module depending on the
 * class itself.
 *
 * **Example** (Describe a source scalar span)
 *
 * ```ts
 * import { RequoteScalarInput } from "@beep/yaml/internal/requote"
 * const scalar = RequoteScalarInput.make({ value: "hello", style: "plain", offset: 0, length: 5 })
 * console.log(scalar.length) // 5
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RequoteScalarInput extends S.Opaque<RequoteScalarInput, { readonly brand: unique symbol }>()(
  S.Struct({
    value: S.Unknown.pipe(
      $I.annoteKey("RequoteScalarInput.value", { description: "Parsed scalar value considered for quote conversion." })
    ),
    style: ScalarStyle.pipe(
      $I.annoteKey("RequoteScalarInput.style", { description: "Presentation style of the source scalar." })
    ),
    tag: S.optionalKey(S.String).pipe(
      $I.annoteKey("RequoteScalarInput.tag", { description: "Optional tag preventing quote conversion when present." })
    ),
    anchor: S.optionalKey(S.String).pipe(
      $I.annoteKey("RequoteScalarInput.anchor", {
        description: "Optional anchor preventing quote conversion when present.",
      })
    ),
    offset: S.Finite.pipe(
      $I.annoteKey("RequoteScalarInput.offset", { description: "Start of the raw scalar span in UTF-16 code units." })
    ),
    length: S.Finite.pipe(
      $I.annoteKey("RequoteScalarInput.length", { description: "Length of the raw scalar span in UTF-16 code units." })
    ),
  }).pipe(
    $I.annoteSchema("RequoteScalarInput", {
      description: "Structural scalar payload accepted without per-call decoding by quote conversion.",
    })
  )
) {}

/**
 * Selects the safety policy for changing a scalar's quote style.
 *
 * **Details**
 *
 * See the decision `shared-requote-modes`: `"conservative"` = lint-fix semantics, `"escaping"` = format-path semantics.
 *
 * **Example** (Choose value-based quote escaping)
 *
 * ```ts
 * import type { RequoteMode } from "@beep/yaml/internal/requote"
 * const mode: RequoteMode = "escaping"
 * console.log(mode) // escaping
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RequoteMode = LiteralKit(["conservative", "escaping"]).pipe(
  $I.annoteSchema("RequoteMode", {
    description: "Safety policies for byte-preserving or value-preserving quote conversion.",
  })
);

/**
 * The quote-conversion policy inferred from its literal vocabulary.
 *
 * @category type-level
 * @since 0.0.0
 */
export type RequoteMode = typeof RequoteMode.Type;

function isSingleQuotable(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    if (c0DelOrC1ThatSingleQuotedStyleCannotSpell.test(Str.slice(i, i + 1)(value))) return false;
  }
  return true;
}

const c0DelOrC1ThatSingleQuotedStyleCannotSpell = /[\x00-\x1f\x7f-\x9f]/;

/**
 * The replacement raw text that re-quotes `scalar` with `quote`, or
 * `None` when no value-preserving replacement exists under `mode`
 * (skipping is always correct; corrupting never is).
 *
 * **Example** (Convert a single-quoted scalar)
 *
 * ```ts
 * import { requoteScalarText } from "@beep/yaml/internal/requote"
 * import * as O from "effect/Option"
 * import { RequoteScalarInput } from "@beep/yaml/internal/requote"
 *
 * const scalar = RequoteScalarInput.make({ value: "hello", style: "single-quoted", offset: 0, length: 7 })
 * console.log(O.getOrUndefined(requoteScalarText("'hello'", scalar, '"', "escaping"))) // "hello"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export function requoteScalarText(
  text: string,
  ...[scalar, quote, mode]: [
    scalar: S.Struct.Type<typeof RequoteScalarInput.fields>,
    quote: '\"' | "'",
    mode: RequoteMode,
  ]
): O.Option<string> {
  if (!isRequoteCandidate(scalar)) return O.none();
  const raw = Str.slice(scalar.offset, scalar.offset + scalar.length)(text);
  const foldsOnLfOrBareCrBreak = Str.includes("\n")(raw) || Str.includes("\r")(raw);
  if (foldsOnLfOrBareCrBreak) return O.none();
  return mode === "conservative"
    ? requoteConservative(raw, scalar.style, scalar.value, quote)
    : requoteEscaping(scalar.style, scalar.value, quote);
}

type RequoteCandidate = S.Struct.Type<typeof RequoteScalarInput.fields> & { readonly value: string };

const isRequoteCandidate = (scalar: S.Struct.Type<typeof RequoteScalarInput.fields>): scalar is RequoteCandidate =>
  scalar.tag === undefined && scalar.anchor === undefined && P.isString(scalar.value);

function requoteConservative(raw: string, style: ScalarStyle, value: string, quote: '"' | "'"): O.Option<string> {
  const inner = style === "plain" ? raw : Str.slice(1, -1)(raw);
  const rawInnerIsTheValueWithoutTargetQuote = inner === value && !Str.includes(quote)(inner);
  if (!rawInnerIsTheValueWithoutTargetQuote) return O.none();
  if (quote === '"' && Str.includes("\\")(inner)) return O.none();
  return O.some(`${quote}${inner}${quote}`);
}

function requoteEscaping(style: ScalarStyle, value: string, quote: '"' | "'"): O.Option<string> {
  if (quote === '"') {
    return style === "single-quoted" ? O.some(renderDoubleQuoted(value)) : O.none();
  }
  return style === "double-quoted" && isSingleQuotable(value) ? O.some(renderSingleQuoted(value)) : O.none();
}
