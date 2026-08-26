/**
 * Deterministic identifier tokenization and variant helpers.
 *
 * @since 0.0.0
 * @packageDocumentation
 */
import { A, Str } from "@beep/utils";
import { flow, pipe } from "effect";
import * as O from "effect/Option";
import * as QueryText from "./QueryText.ts";
import * as VariantText from "./VariantText.ts";

const normalizeIdentifierWords = flow(
  QueryText.normalizePhrase,
  Str.replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2"),
  Str.replace(/([a-z0-9])([A-Z])/g, "$1 $2"),
  Str.replace(/[_-]+/g, " "),
  QueryText.normalizeQuestion
);

/**
 * Split a source identifier or symbol-like phrase into normalized words.
 *
 * **Details**
 *
 * Handles camelCase, PascalCase, snake_case, and kebab-case as equivalent word
 * boundaries. The returned tokens are lowercase because callers use them as the
 * canonical basis for deterministic lookup variants.
 *
 * **Example** (Tokenize camelCase identifier)
 *
 * ```ts import.meta.vitest name="Tokenize camelCase identifier"
 * import * as IdentifierText from "@beep/nlp/IdentifierText"
 *
 * const result = IdentifierText.tokens("myVariableName")
 * result // => ["my", "variable", "name"]
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const tokens = flow(normalizeIdentifierWords, Str.split(" "), A.map(Str.toLowerCase), A.filter(Str.isNonEmpty));

/**
 * Generate common source-code spellings for a symbol phrase.
 *
 * **Details**
 *
 * Variants preserve first occurrence order and cover human text, spaced words,
 * camelCase, PascalCase, snake_case, kebab-case, and compact joined text. This
 * lets query code match a user phrase against exported symbols without guessing
 * which naming convention the source used.
 *
 * **Example** (Generate user name variants)
 *
 * ```ts import.meta.vitest name="Generate user name variants"
 * import * as IdentifierText from "@beep/nlp/IdentifierText"
 *
 * const result = IdentifierText.variants("user name")
 * // Produces camelCase, PascalCase, snake_case, kebab-case, and joined variants
 * result.includes("userName") // => true
 * result.includes("UserName") // => true
 * result.includes("user_name") // => true
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const variants = (input: string): ReadonlyArray<string> => {
  const normalized = QueryText.normalizePhrase(input);
  const tokenized = tokens(input);
  const spaced = pipe(
    tokenized,
    A.match({
      onEmpty: () => normalized,
      onNonEmpty: (nonEmptyTokens) => A.join(nonEmptyTokens, " "),
    })
  );
  const joined = pipe(
    A.get(tokenized, 0),
    O.match({
      onNone: () => Str.empty,
      onSome: () => A.join(tokenized, Str.empty),
    })
  );

  return VariantText.orderedDedupe(
    A.make(
      normalized,
      spaced,
      Str.camelCase(spaced),
      Str.pascalCase(spaced),
      Str.snakeCase(spaced),
      Str.kebabCase(spaced),
      joined
    )
  );
};
