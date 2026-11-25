/**
 * Well-formed non-empty text: strings with no lone UTF-16 surrogate, the
 * input RFC 8785 canonical JSON accepts.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import * as S from "effect/Schema";
import { $SchemaId } from "./internal/SchemaId.ts";

const $I = $SchemaId.create("WellFormedText");

// Each code unit is a BMP scalar or a high surrogate directly followed by a
// low surrogate. The pattern form, not a predicate, is deliberate: the derived
// arbitrary then generates well-formed text, astral characters included.
const wellFormedUtf16 = /^(?:[\u0000-퟿-￿]|[\uD800-\uDBFF][\uDC00-\uDFFF])*$/;

/**
 * Non-empty text made only of complete UTF-16 scalar sequences, so a value
 * canonicalizes and hashes without a `LoneSurrogate` refusal.
 *
 * **When to use**
 *
 * Use as the schema of free-text leaves of a record that is hashed through canonical JSON,
 * such as a model or engine pin inside a content-hash preimage.
 *
 * **Example** (Refuse a lone surrogate)
 *
 * ```ts import.meta.vitest name="Refuse a lone surrogate"
 * import * as S from "effect/Schema"
 * import { WellFormedText } from "@beep/schema/WellFormedText"
 *
 * const isWellFormedText = S.is(WellFormedText)
 *
 * isWellFormedText("café \u{1F600}") // => true
 * isWellFormedText("\uD800") // => false
 * isWellFormedText("") // => false
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const WellFormedText = S.NonEmptyString.check(
  S.isPattern(
    wellFormedUtf16,
    $I.annote("WellFormedTextPattern", {
      title: "Well-Formed Text",
      description: "Text made of complete UTF-16 scalar sequences.",
      message: "Expected text without lone UTF-16 surrogates.",
    })
  )
).pipe(
  $I.annoteSchema("WellFormedText", {
    description: "Non-empty text with no lone UTF-16 surrogate.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type WellFormedText = typeof WellFormedText.Type;
