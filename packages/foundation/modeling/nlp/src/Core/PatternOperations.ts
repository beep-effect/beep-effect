/**
 * Pattern inspection utilities.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { A, Str } from "@beep/utils";
import * as O from "effect/Option";
import { Pattern } from "./Pattern.ts";
import type { EntityPatternElement, LiteralPatternElement, PatternElement, POSPatternElement } from "./Pattern.ts";

/**
 * Check whether an element is a POS element.
 *
 * **Example** (True for POS element)
 *
 * ```ts import.meta.vitest name="True for POS element"
 * import { pos } from "@beep/nlp/Core/PatternBuilders"
 * import { isPOSElement } from "@beep/nlp/Core/PatternOperations"
 *
 * isPOSElement(pos("NOUN")) // => true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isPOSElement: (element: PatternElement) => element is POSPatternElement = Pattern.POS.is;

/**
 * Check whether an element is an entity element.
 *
 * **Example** (True for entity element)
 *
 * ```ts import.meta.vitest name="True for entity element"
 * import { entity } from "@beep/nlp/Core/PatternBuilders"
 * import { isEntityElement } from "@beep/nlp/Core/PatternOperations"
 *
 * isEntityElement(entity("EMAIL")) // => true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isEntityElement: (element: PatternElement) => element is EntityPatternElement = Pattern.Entity.is;

/**
 * Check whether an element is a literal element.
 *
 * **Example** (True for literal element)
 *
 * ```ts import.meta.vitest name="True for literal element"
 * import { literal } from "@beep/nlp/Core/PatternBuilders"
 * import { isLiteralElement } from "@beep/nlp/Core/PatternOperations"
 *
 * isLiteralElement(literal("Effect")) // => true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isLiteralElement: (element: PatternElement) => element is LiteralPatternElement = Pattern.Literal.is;

/**
 * Extract element values as a readonly array.
 *
 * **Example** (Optional literal value array)
 *
 * ```ts import.meta.vitest name="Optional literal value array"
 * import { optionalLiteral } from "@beep/nlp/Core/PatternBuilders"
 * import { extractElementValues } from "@beep/nlp/Core/PatternOperations"
 *
 * extractElementValues(optionalLiteral("Inc.")) // => ["", "Inc."]
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const extractElementValues = (element: PatternElement): ReadonlyArray<string> => element.value;

/**
 * Create a bracket-string content slice if the input is bracketed.
 *
 * **Example** (Slice bracketed string content)
 *
 * ```ts import.meta.vitest name="Slice bracketed string content"
 * import * as O from "effect/Option"
 * import { extractBracketContent } from "@beep/nlp/Core/PatternOperations"
 *
 * O.getOrThrow(extractBracketContent("[ADJ|NOUN]")) // => "ADJ|NOUN"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const extractBracketContent = (value: string): O.Option<string> =>
  Str.startsWith("[")(value) && Str.endsWith("]")(value) ? O.some(Str.slice(1, -1)(value)) : O.none();

/**
 * Split bracket content into trimmed segments.
 *
 * **Example** (Split trimmed bracket segments)
 *
 * ```ts import.meta.vitest name="Split trimmed bracket segments"
 * import { splitBracketValues } from "@beep/nlp/Core/PatternOperations"
 *
 * splitBracketValues("ADJ | NOUN") // => ["ADJ", "NOUN"]
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const splitBracketValues = (content: string): ReadonlyArray<string> => A.map(Str.split(content, "|"), Str.trim);

/**
 * Join values into bracket-string form.
 *
 * **Example** (Join values as brackets)
 *
 * ```ts import.meta.vitest name="Join values as brackets"
 * import { joinBracketValues } from "@beep/nlp/Core/PatternOperations"
 *
 * joinBracketValues(["ADJ", "NOUN"]) // => "[ADJ|NOUN]"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const joinBracketValues = (values: ReadonlyArray<string>): string => `[${A.join(values, "|")}]`;
