/**
 * Deterministic query-text normalization helpers.
 *
 * @since 0.0.0
 * @packageDocumentation
 */
import { A, Str } from "@beep/utils";
import { flow, pipe } from "effect";
import * as O from "effect/Option";

const firstCapture = (pattern: RegExp, input: string): O.Option<string> =>
  pipe(pattern.exec(input), O.fromNullishOr, O.flatMap(A.get(1)), O.map(normalizePhrase));

/**
 * Canonicalize a free-form user question for deterministic matching.
 *
 * **Details**
 *
 * The helper trims only boundary whitespace and collapses internal whitespace.
 * It intentionally preserves punctuation, casing, and path-like separators so
 * downstream extractors can still distinguish prose from literal references.
 *
 * **Example** (Collapse question whitespace)
 *
 * ```typescript
 * import * as QueryText from "@beep/nlp/QueryText"
 *
 * const normalized = QueryText.normalizeQuestion("  hello   world  ")
 * console.log(normalized) // "hello world"
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const normalizeQuestion: (input: string) => string = flow(Str.trim, Str.replace(/\s+/g, " "));

/**
 * Normalize a short extracted phrase after it has been pulled from prose.
 *
 * **Details**
 *
 * Boundary quotes, brackets, and trailing sentence punctuation are discarded,
 * while whitespace around `/`, `.`, `_`, and `-` is collapsed. This keeps
 * package names, file paths, and symbol-ish phrases stable across user wording.
 *
 * **Example** (Strip phrase quotes and spaces)
 *
 * ```typescript
 * import * as QueryText from "@beep/nlp/QueryText"
 *
 * const normalized = QueryText.normalizePhrase('"hello / world"')
 * console.log(normalized) // "hello/world"
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const normalizePhrase: (input: string) => string = flow(
  normalizeQuestion,
  Str.replace(/^[`"'([{]+/g, ""),
  Str.replace(/[!?.,;:'"`)\]}]+$/g, ""),
  Str.replace(/\s*([/._-])\s*/g, "$1"),
  normalizeQuestion
);

/**
 * Extract the first value enclosed in backticks from a user question.
 *
 * **Example** (Extract first backtick value)
 *
 * ```typescript
 * import * as O from "effect/Option"
 * import * as QueryText from "@beep/nlp/QueryText"
 *
 * const result = QueryText.extractBacktickValue("What is `Effect.gen`?")
 * console.log(O.getOrElse(result, () => "none")) // "Effect.gen"
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const extractBacktickValue = (input: string): O.Option<string> =>
  pipe(firstCapture(/`([^`]+)`/, input), O.filter(Str.isNonEmpty));
