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
 * @example
 * ```ts
 * import { pos } from "@beep/nlp/Core/PatternBuilders"
 * import { isPOSElement } from "@beep/nlp/Core/PatternOperations"
 *
 * console.log(isPOSElement(pos("NOUN"))) // true
 * ```
 *
 * @since 0.0.0
 * @category predicates
 */
export const isPOSElement: (element: PatternElement) => element is POSPatternElement = Pattern.POS.is;

/**
 * Check whether an element is an entity element.
 *
 * @example
 * ```ts
 * import { entity } from "@beep/nlp/Core/PatternBuilders"
 * import { isEntityElement } from "@beep/nlp/Core/PatternOperations"
 *
 * console.log(isEntityElement(entity("EMAIL"))) // true
 * ```
 *
 * @since 0.0.0
 * @category predicates
 */
export const isEntityElement: (element: PatternElement) => element is EntityPatternElement = Pattern.Entity.is;

/**
 * Check whether an element is a literal element.
 *
 * @example
 * ```ts
 * import { literal } from "@beep/nlp/Core/PatternBuilders"
 * import { isLiteralElement } from "@beep/nlp/Core/PatternOperations"
 *
 * console.log(isLiteralElement(literal("Effect"))) // true
 * ```
 *
 * @since 0.0.0
 * @category predicates
 */
export const isLiteralElement: (element: PatternElement) => element is LiteralPatternElement = Pattern.Literal.is;

/**
 * Extract element values as a readonly array.
 *
 * @example
 * ```ts
 * import { optionalLiteral } from "@beep/nlp/Core/PatternBuilders"
 * import { extractElementValues } from "@beep/nlp/Core/PatternOperations"
 *
 * console.log(extractElementValues(optionalLiteral("Inc."))) // ["", "Inc."]
 * ```
 *
 * @since 0.0.0
 * @category getters
 */
export const extractElementValues = (element: PatternElement): ReadonlyArray<string> => element.value;

/**
 * Create a bracket-string content slice if the input is bracketed.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { extractBracketContent } from "@beep/nlp/Core/PatternOperations"
 *
 * console.log(O.getOrThrow(extractBracketContent("[ADJ|NOUN]"))) // "ADJ|NOUN"
 * ```
 *
 * @since 0.0.0
 * @category getters
 */
export const extractBracketContent = (value: string): O.Option<string> =>
  Str.startsWith("[")(value) && Str.endsWith("]")(value) ? O.some(Str.slice(1, -1)(value)) : O.none();

/**
 * Split bracket content into trimmed segments.
 *
 * @example
 * ```ts
 * import { splitBracketValues } from "@beep/nlp/Core/PatternOperations"
 *
 * console.log(splitBracketValues("ADJ | NOUN")) // ["ADJ", "NOUN"]
 * ```
 *
 * @since 0.0.0
 * @category getters
 */
export const splitBracketValues = (content: string): ReadonlyArray<string> => A.map(Str.split(content, "|"), Str.trim);

/**
 * Join values into bracket-string form.
 *
 * @example
 * ```ts
 * import { joinBracketValues } from "@beep/nlp/Core/PatternOperations"
 *
 * console.log(joinBracketValues(["ADJ", "NOUN"])) // "[ADJ|NOUN]"
 * ```
 *
 * @since 0.0.0
 * @category getters
 */
export const joinBracketValues = (values: ReadonlyArray<string>): string => `[${A.join(values, "|")}]`;
