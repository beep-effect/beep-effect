/**
 * Public effect-ontology APIs for utils/text.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { HashSet } from "effect";
import * as A from "effect/Array";
import * as Str from "effect/String";
import { dual2 } from "./Dual.ts";

const BlockingTokenStopWords = HashSet.make(
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "as",
  "is",
  "was",
  "are",
  "were",
  "been",
  "be",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "shall",
  "can",
  "this",
  "that",
  "these",
  "those",
  "i",
  "you",
  "he",
  "she",
  "it",
  "we",
  "they",
  "inc",
  "corp",
  "llc",
  "ltd",
  "co",
  "company"
);

/**
 * Tokenize an entity mention for blocking-index lookup.
 *
 * **Example** (Build blocking tokens)
 *
 * ```ts
 * import { tokenizeMentionForBlocking } from "@effect-ontology/Utils/Text"
 *
 * console.log(tokenizeMentionForBlocking("The Acme Research Group"))
 * // ["acme", "research", "group"]
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const tokenizeMentionForBlocking = (mention: string): Array<string> =>
  A.filter(
    Str.split(/[\s\-_.,;:!?'"()[\]{}]+/)(Str.toLowerCase(mention)),
    (token) => Str.length(token) > 2 && !HashSet.has(BlockingTokenStopWords, token)
  );

// =============================================================================
// CamelCase Splitting
// =============================================================================

/**
 * Split camelCase text into space-separated words
 *
 * **Details**
 *
 * Handles standard camelCase, PascalCase, and consecutive capitals (acronyms).
 * Useful for improving search by making camelCase identifiers searchable.
 *
 * **Example** (Use splitCamelCase)
 *
 * ```ts
 * import { splitCamelCase } from "@effect-ontology/Utils/Text"
 *
 * console.log(splitCamelCase("birthPlace")) // "birth Place"
 * console.log(splitCamelCase("XMLHttpRequest")) // "XML Http Request"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const splitCamelCase = (text: string): string =>
  text
    .replace(/([a-z])([A-Z])/g, "$1 $2") // Insert space before capital letters
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2") // Handle consecutive capitals
    .trim();

// =============================================================================
// N-Gram Generation
// =============================================================================

/**
 * Generate n-grams from text
 *
 * **Details**
 *
 * Creates sliding window n-grams from tokenized text for improved search matching.
 * Useful for matching multi-word phrases and improving recall.
 *
 * **Example** (Use generateNGrams)
 *
 * ```ts
 * import { generateNGrams } from "@effect-ontology/Utils/Text"
 *
 * console.log(generateNGrams(["birth", "place", "location"], 2))
 * // ["birth place", "place location"]
 * console.log(generateNGrams(["person", "name"], 3))
 * // []
 * ```
 *
 * @param n - Window size; must be supplied (no default).
 * @category utilities
 * @since 0.0.0
 */
export const generateNGrams = dual2((tokens: ReadonlyArray<string>, n: number): ReadonlyArray<string> => {
  if (tokens.length < n) {
    return [];
  }

  const ngrams: Array<string> = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.push(tokens.slice(i, i + n).join(" "));
  }
  return ngrams;
});

// =============================================================================
// Search Enhancement
// =============================================================================

/**
 * Enhance text for search by splitting camelCase and adding n-grams
 *
 * **Details**
 *
 * Takes a text string, splits camelCase words, tokenizes, and generates n-grams.
 * This creates a richer representation for BM25 indexing.
 *
 * **Example** (Use enhanceTextForSearch)
 *
 * ```ts
 * import { enhanceTextForSearch } from "@effect-ontology/Utils/Text"
 *
 * console.log(enhanceTextForSearch("birthPlace location", 2))
 * // "birthPlace location birth Place location birth place place location"
 * ```
 *
 * @param ngramSize - Window size passed to {@link generateNGrams}; must be supplied.
 * @see {@link generateNGrams} for the n-gram constructor this calls.
 * @see {@link splitCamelCase} for the camelCase split applied before tokenization.
 * @category utilities
 * @since 0.0.0
 */
export const enhanceTextForSearch = dual2((text: string, ngramSize: number): string => {
  // Split camelCase in the original text
  const camelCaseSplit = splitCamelCase(text);

  // Tokenize (split on whitespace and normalize)
  const tokens = camelCaseSplit
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  // Generate n-grams
  const ngrams = generateNGrams(tokens, ngramSize);

  // Combine original text, camelCase split, and n-grams
  const parts: Array<string> = [text, camelCaseSplit];
  if (ngrams.length > 0) {
    for (const ngram of ngrams) {
      parts.push(ngram);
    }
  }

  return parts.join(" ");
});
