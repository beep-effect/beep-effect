/**
 * Deterministic path and module-specifier normalization helpers.
 *
 * @since 0.0.0
 * @packageDocumentation
 */
import { A, Str } from "@beep/utils";
import { flow } from "effect";
import * as QueryText from "./QueryText.ts";
import * as VariantText from "./VariantText.ts";

const stripLeadingDotSlash: (input: string) => string = Str.replace(/^\.\/+/, Str.empty);
const stripTypeScriptExtension = Str.replace(/\.[cm]?tsx?$/i, Str.empty);
const basename = Str.replace(/^.*\//, Str.empty);

const pathFragmentVariants = (input: string): ReadonlyArray<string> => {
  const normalized = normalizePathPhrase(input);
  const withoutDotSlash = stripLeadingDotSlash(normalized);
  const withoutExtension = stripTypeScriptExtension(withoutDotSlash);
  const base = basename(withoutDotSlash);
  const basenameWithoutExtension = stripTypeScriptExtension(base);

  return VariantText.orderedDedupe(
    A.make(normalized, withoutDotSlash, withoutExtension, base, basenameWithoutExtension)
  );
};

/**
 * Canonicalize a path-like phrase for file and module lookup.
 *
 * **Details**
 *
 * Backslashes are normalized to forward slashes and repeated separators are
 * collapsed after query-phrase cleanup. The result is suitable for matching
 * user prose against both filesystem paths and package module specifiers.
 *
 * **Example** (Normalize backslash path phrase)
 *
 * ```typescript
 * import * as PathText from "@beep/nlp/PathText"
 *
 * const normalized = PathText.normalizePathPhrase("src\\\\utils\\\\index.ts")
 * console.log(normalized) // "src/utils/index.ts"
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const normalizePathPhrase = flow(QueryText.normalizePhrase, Str.replace(/\\+/g, "/"), Str.replace(/\/+/g, "/"));

/**
 * Check whether normalized text is shaped like a single path or module token.
 *
 * **Details**
 *
 * The predicate accepts scoped package names, dots, slashes, underscores, and
 * dashes, but rejects whitespace. It is a lightweight classifier for query
 * routing, not a filesystem existence check.
 *
 * **Example** (Classify path-like tokens)
 *
 * ```typescript
 * import * as PathText from "@beep/nlp/PathText"
 *
 * console.log(PathText.isPathLike("src/index.ts")) // true
 * console.log(PathText.isPathLike("@beep/utils")) // true
 * console.log(PathText.isPathLike("hello world")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isPathLike = (input: string): boolean => /^[A-Za-z0-9_./@-]+$/.test(normalizePathPhrase(input));

/**
 * Generate source-file lookup variants from a path fragment.
 *
 * **Details**
 *
 * Variants include the normalized path, leading `./` removal, TypeScript
 * extension removal, basename, and basename without extension, preserving order
 * and removing duplicates.
 *
 * **Example** (Generate file path variants)
 *
 * ```typescript
 * import * as PathText from "@beep/nlp/PathText"
 *
 * const variants = PathText.filePathVariants("./src/utils/index.ts")
 * console.log(variants.includes("src/utils/index")) // true
 * console.log(variants.includes("index")) // true
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const filePathVariants = pathFragmentVariants;

/**
 * Generate import-specifier lookup variants from a module fragment.
 *
 * **Details**
 *
 * This shares the same normalization as file paths because package subpaths and
 * local source paths are both queried from user text in the repository graph.
 *
 * **Example** (Generate module specifier variants)
 *
 * ```typescript
 * import * as PathText from "@beep/nlp/PathText"
 *
 * const variants = PathText.moduleSpecifierVariants("@beep/utils/Str.ts")
 * console.log(variants.includes("@beep/utils/Str")) // true
 * console.log(variants.includes("Str")) // true
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const moduleSpecifierVariants = pathFragmentVariants;
