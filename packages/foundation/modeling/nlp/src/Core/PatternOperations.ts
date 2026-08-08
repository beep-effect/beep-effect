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
 * ```ts
 * import { pos } from "@beep/nlp/Core/PatternBuilders"
 * import { isPOSElement } from "@beep/nlp/Core/PatternOperations"
 *
 * console.log(isPOSElement(pos("NOUN"))) // true
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
 * ```ts
 * import { entity } from "@beep/nlp/Core/PatternBuilders"
 * import { isEntityElement } from "@beep/nlp/Core/PatternOperations"
 *
 * console.log(isEntityElement(entity("EMAIL"))) // true
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
 * ```ts
 * import { literal } from "@beep/nlp/Core/PatternBuilders"
 * import { isLiteralElement } from "@beep/nlp/Core/PatternOperations"
 *
 * console.log(isLiteralElement(literal("Effect"))) // true
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
 * ```ts
 * import { optionalLiteral } from "@beep/nlp/Core/PatternBuilders"
 * import { extractElementValues } from "@beep/nlp/Core/PatternOperations"
 *
 * console.log(extractElementValues(optionalLiteral("Inc."))) // ["", "Inc."]
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
 * ```ts
 * import * as O from "effect/Option"
 * import { extractBracketContent } from "@beep/nlp/Core/PatternOperations"
 *
 * console.log(O.getOrThrow(extractBracketContent("[ADJ|NOUN]"))) // "ADJ|NOUN"
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
 * ```ts
 * import { splitBracketValues } from "@beep/nlp/Core/PatternOperations"
 *
 * console.log(splitBracketValues("ADJ | NOUN")) // ["ADJ", "NOUN"]
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
 * ```ts
 * import { joinBracketValues } from "@beep/nlp/Core/PatternOperations"
 *
 * console.log(joinBracketValues(["ADJ", "NOUN"])) // "[ADJ|NOUN]"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const joinBracketValues = (values: ReadonlyArray<string>): string => `[${A.join(values, "|")}]`;
