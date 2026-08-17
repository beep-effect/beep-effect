/**
 * String Utilities
 *
 * **Details**
 *
 * Pure utility functions for string operations:
 * - Similarity calculations (Levenshtein, Jaccard, containment)
 * - Normalization and canonicalization
 * - Token-based operations
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Str from "@beep/utils/Str";
import { HashSet } from "effect";
import * as A from "effect/Array";
import { dual, flow, pipe } from "effect/Function";

/**
 * Normalize a string for comparison
 *
 * **Details**
 *
 * Converts to lowercase, trims whitespace, and normalizes internal spacing.
 *
 * **Example** (Normalize A String)
 *
 * ```ts
 * import { normalizeString } from "@effect-ontology/Utils/String"
 *
 * normalizeString("  Hello   World  ")
 * // => "hello world"
 * ```
 *
 * @param text - Input string
 * @returns Normalized string
 * @category normalization
 * @since 0.0.0
 */
export const normalizeString = flow(Str.toLowerCase, Str.trim, Str.replace(/\s+/g, " "));

/**
 * Calculate Levenshtein edit distance between two strings
 *
 * **Details**
 *
 * Uses dynamic programming for O(mn) time and O(min(m,n)) space.
 *
 * **Example** (Levenshtein Distance between 'kitten' & 'sitting')
 *
 * ```ts
 * import { levenshteinDistance } from "@effect-ontology/Utils/String"
 *
 * levenshteinDistance("kitten", "sitting")
 * // => 3
 * ```
 *
 * @param a - First string
 * @param b - Second string
 * @returns Number of edits (insertions, deletions, substitutions)
 * @category utilities
 * @since 0.0.0
 */
export const levenshteinDistance: {
  (a: string, b: string): number;
  (b: string): (a: string) => number;
} = dual(2, (a: string, b: string): number => {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Ensure a is the shorter string for space optimization
  if (a.length > b.length) {
    [a, b] = [b, a];
  }

  // Use two rows instead of full matrix
  let prevRow: Array<number> = A.makeBy(a.length + 1, (index) => index);
  let currRow = new Array<number>(a.length + 1);

  for (let j = 1; j <= b.length; j++) {
    currRow[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[i] = Math.min(
        prevRow[i] + 1, // deletion
        currRow[i - 1] + 1, // insertion
        prevRow[i - 1] + cost // substitution
      );
    }
    [prevRow, currRow] = [currRow, prevRow];
  }

  return prevRow[a.length];
});

/**
 * Calculate normalized Levenshtein similarity (0.0 to 1.0)
 *
 * **Details**
 *
 * Returns 1.0 for identical strings, 0.0 for completely different strings.
 *
 * **Example** (Inspect levenshtein similarity)
 *
 * ```ts
 * import { levenshteinSimilarity } from "@effect-ontology/Utils/String"
 *
 * levenshteinSimilarity("hello", "hallo")
 * // => 0.8 (1 edit out of 5 chars)
 * ```
 *
 * @param a - First string
 * @param b - Second string
 * @returns Similarity score between 0.0 and 1.0
 * @category utilities
 * @since 0.0.0
 */
export const levenshteinSimilarity: {
  (a: string, b: string): number;
  (b: string): (a: string) => number;
} = dual(2, (a: string, b: string): number => {
  if (a === b) return 1.0;
  if (a.length === 0 || b.length === 0) return 0.0;

  const maxLen = Math.max(a.length, b.length);
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  return 1.0 - distance / maxLen;
});

/**
 * Check if one string contains another (case-insensitive)
 *
 * **Example** (Inspect contains ignore case)
 *
 * ```ts
 * import { containsIgnoreCase } from "@effect-ontology/Utils/String"
 *
 * containsIgnoreCase("Eberechi Eze", "Eze")
 * // => true
 * ```
 *
 * @param text - Text to search in
 * @param substring - Substring to search for
 * @returns True if text contains substring
 * @category utilities
 * @since 0.0.0
 */
export const containsIgnoreCase: {
  (text: string, substring: string): boolean;
  (substring: string): (text: string) => boolean;
} = dual(2, (text: string, substring: string): boolean =>
  pipe(text, Str.toLowerCase, Str.includes(Str.toLowerCase(substring)))
);

/**
 * Check bidirectional containment between two strings
 *
 * **Details**
 *
 * Returns true if either string contains the other.
 * Useful for matching "Eze" with "Eberechi Eze".
 *
 * **Example** (Inspect has bidirectional containment)
 *
 * ```ts
 * import { hasBidirectionalContainment } from "@effect-ontology/Utils/String"
 *
 * hasBidirectionalContainment("Eze", "Eberechi Eze")
 * // => true
 * ```
 *
 * @param a - First string
 * @param b - Second string
 * @returns True if either contains the other
 * @category predicates
 * @since 0.0.0
 */
export const hasBidirectionalContainment: {
  (a: string, b: string): boolean;
  (b: string): (a: string) => boolean;
} = dual(2, (a: string, b: string): boolean => containsIgnoreCase(a, b) || containsIgnoreCase(b, a));

/**
 * Calculate Jaccard similarity between two token sets
 *
 * **Details**
 *
 * Jaccard = |intersection| / |union|
 *
 * **Example** (Inspect jaccard similarity)
 *
 * ```ts
 * import { jaccardSimilarity } from "@effect-ontology/Utils/String"
 *
 * jaccardSimilarity(["hello", "world"], ["hello", "there"])
 * // => 0.333 (1 common out of 3 unique)
 * ```
 *
 * @param tokensA - First token set
 * @param tokensB - Second token set
 * @returns Similarity score between 0.0 and 1.0
 * @category utilities
 * @since 0.0.0
 */
export const jaccardSimilarity: {
  (tokensA: ReadonlyArray<string>, tokensB: ReadonlyArray<string>): number;
  (tokensB: ReadonlyArray<string>): (tokensA: ReadonlyArray<string>) => number;
} = dual(2, (tokensA: ReadonlyArray<string>, tokensB: ReadonlyArray<string>): number => {
  if (tokensA.length === 0 && tokensB.length === 0) return 1.0;
  if (tokensA.length === 0 || tokensB.length === 0) return 0.0;

  const setA = HashSet.fromIterable(A.map(tokensA, Str.toLowerCase));
  const setB = HashSet.fromIterable(A.map(tokensB, Str.toLowerCase));

  let intersectionSize = 0;
  for (const token of setA) {
    if (HashSet.has(setB, token)) {
      intersectionSize++;
    }
  }

  const unionSize = HashSet.size(setA) + HashSet.size(setB) - intersectionSize;
  return unionSize > 0 ? intersectionSize / unionSize : 0.0;
});

/**
 * Tokenize a string into words (simple whitespace split)
 *
 * **Details**
 *
 * Splits on whitespace and filters empty tokens.
 * For more advanced tokenization, use NlpService.
 *
 * **Example** (Inspect simple tokenize)
 *
 * ```ts
 * import { simpleTokenize } from "@effect-ontology/Utils/String"
 *
 * simpleTokenize("Hello, World!")
 * // => ["Hello,", "World!"]
 * ```
 *
 * @param text - Input text
 * @returns Array of tokens
 * @category utilities
 * @since 0.0.0
 */
export const simpleTokenize = flow(Str.split(/\s+/), A.filter(Str.isNonEmpty));

/**
 * Calculate token-based similarity using Jaccard
 *
 * **Details**
 *
 * Tokenizes both strings and computes Jaccard similarity.
 *
 * **Example** (Inspect token similarity)
 *
 * ```ts
 * import { tokenSimilarity } from "@effect-ontology/Utils/String"
 *
 * tokenSimilarity("Arsenal FC", "Arsenal Football Club")
 * // => 0.333 (1 common token out of 4 unique)
 * ```
 *
 * @param a - First string
 * @param b - Second string
 * @returns Similarity score between 0.0 and 1.0
 * @category utilities
 * @since 0.0.0
 */
export const tokenSimilarity: {
  (a: string, b: string): number;
  (b: string): (a: string) => number;
} = dual(2, (a: string, b: string): number => jaccardSimilarity(simpleTokenize(a), simpleTokenize(b)));

/**
 * Calculate combined similarity score
 *
 * **Details**
 *
 * Combines Levenshtein similarity and containment check
 * for robust entity matching.
 *
 * **Example** (Inspect combined similarity)
 *
 * ```ts
 * import { combinedSimilarity } from "@effect-ontology/Utils/String"
 *
 * combinedSimilarity("Eze", "Eberechi Eze")
 * // => 1.0 (containment match)
 *
 * combinedSimilarity("Ronaldo", "Ronald")
 * // => ~0.86 (high Levenshtein similarity)
 * ```
 *
 * @param a - First string
 * @param b - Second string
 * @returns Similarity score between 0.0 and 1.0
 * @category utilities
 * @since 0.0.0
 */
export const combinedSimilarity: {
  (a: string, b: string): number;
  (b: string): (a: string) => number;
} = dual(2, (a: string, b: string): number => {
  // Perfect match
  if (Str.toLowerCase(a) === Str.toLowerCase(b)) return 1.0;

  // Containment check (one is substring of other)
  if (hasBidirectionalContainment(a, b)) return 1.0;

  // Fall back to Levenshtein similarity
  return levenshteinSimilarity(a, b);
});

/**
 * Calculate overlap ratio between two arrays
 *
 * **Details**
 *
 * Returns the ratio of shared elements to the smaller array size.
 *
 * **Example** (Inspect overlap ratio)
 *
 * ```ts
 * import { overlapRatio } from "@effect-ontology/Utils/String"
 *
 * overlapRatio(["Player", "Person"], ["Player", "Athlete"])
 * // => 0.5 (1 shared out of min(2, 2))
 * ```
 *
 * @param arrA - First array
 * @param arrB - Second array
 * @returns Overlap ratio between 0.0 and 1.0
 * @category utilities
 * @since 0.0.0
 */
export const overlapRatio: {
  <T>(arrA: ReadonlyArray<T>, arrB: ReadonlyArray<T>): number;
  <T>(arrB: ReadonlyArray<T>): (arrA: ReadonlyArray<T>) => number;
} = dual(2, <T>(arrA: ReadonlyArray<T>, arrB: ReadonlyArray<T>): number => {
  if (A.isReadonlyArrayEmpty(arrA) || A.isReadonlyArrayEmpty(arrB)) return 0.0;

  const setB = HashSet.fromIterable(arrB);
  const intersection = A.filter(arrA, (item) => HashSet.has(setB, item));

  const smallerSize = Math.min(arrA.length, arrB.length);
  return intersection.length / smallerSize;
});
