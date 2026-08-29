/**
 * Public effect-ontology APIs for utils/text.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { dual2 } from "./Dual.ts";

/**
 * Text Processing Utilities
 *
 * Pure text transformation functions for search enhancement.
 * These are domain-agnostic string operations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

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
 * splitCamelCase("birthPlace")     // => "birth Place"
 * splitCamelCase("FirstName")       // => "First Name"
 * splitCamelCase("XMLHttpRequest") // => "XML Http Request"
 * splitCamelCase("already spaced") // => "already spaced"
 * ```
 *
 * @param text - Text possibly containing camelCase
 * @returns Space-separated words
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
 * generateNGrams(["birth", "place", "location"], 2)
 * // => ["birth place", "place location"]
 *
 * generateNGrams(["person", "name"], 3)
 * // => ["person name"] (only one trigram possible)
 * ```
 *
 * @param tokens - Array of tokens
 * @param n - N-gram size (default: 2 for bigrams)
 * @returns Array of n-gram strings
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
 * enhanceTextForSearch("birthPlace location", 2)
 * // => "birthPlace location birth place location birth place place location"
 * ```
 *
 * @param text - Input text
 * @param ngramSize - Size of n-grams to generate (default: 2)
 * @returns Enhanced text with camelCase split and n-grams
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
