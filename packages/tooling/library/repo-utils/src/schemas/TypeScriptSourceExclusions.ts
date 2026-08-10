/**
 * Shared TypeScript source path exclusion rules for CLI lint commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";

/**
 * Path segments excluded from TypeScript source lint traversals.
 *
 * **Details**
 *
 * Segment values include leading and trailing slashes because callers normalize
 * paths before matching. That avoids accidentally excluding names such as
 * `contest` while still matching `/test/`.
 *
 * **Example** (Apply TypeScript source exclusions)
 *
 * ```ts
 * import { TYPESCRIPT_SOURCE_EXCLUDED_SEGMENTS } from "@beep/repo-utils/schemas/TypeScriptSourceExclusions"
 * const skipsGeneratedFolders = TYPESCRIPT_SOURCE_EXCLUDED_SEGMENTS.includes("/_generated/")
 * console.log(skipsGeneratedFolders) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const TYPESCRIPT_SOURCE_EXCLUDED_SEGMENTS = [
  "/.repos/",
  "/ci-runners/sdks/",
  "/node_modules/",
  "/dist/",
  "/build/",
  "/coverage/",
  "/storybook-static/",
  "/.next/",
  "/.turbo/",
  "/docs/",
  "/_generated/",
  "/generated/",
  "/goals/",
  "/test/",
  "/tests/",
] as const;

/**
 * File suffixes excluded from TypeScript source lint traversals.
 *
 * **Example** (Apply TypeScript source exclusions)
 *
 * ```ts
 * import { TYPESCRIPT_SOURCE_EXCLUDED_SUFFIXES } from "@beep/repo-utils/schemas/TypeScriptSourceExclusions"
 * const skipsGeneratedFiles = TYPESCRIPT_SOURCE_EXCLUDED_SUFFIXES.includes(".gen.ts")
 * console.log(skipsGeneratedFiles) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const TYPESCRIPT_SOURCE_EXCLUDED_SUFFIXES = [
  ".d.ts",
  ".test.ts",
  ".test.tsx",
  ".spec.ts",
  ".spec.tsx",
  ".gen.ts",
  ".gen.tsx",
  ".stories.tsx",
] as const;

/**
 * Normalize filesystem paths to POSIX separators before string matching.
 *
 * **Example** (Apply TypeScript source exclusions)
 *
 * ```ts
 * import { toPosixPath } from "@beep/repo-utils/schemas/TypeScriptSourceExclusions"
 * const normalized = toPosixPath("packages\\schema\\src\\index.ts")
 * console.log(normalized) // "packages/schema/src/index.ts"
 * ```
 *
 * @param value - Filesystem path whose backslash separators are normalized.
 * @returns The path with every backslash separator replaced by a forward slash.
 * @category utilities
 * @since 0.0.0
 */
export const toPosixPath = (value: string): string => Str.replace(/\\/g, "/")(value);

/**
 * Check whether a TypeScript source path should be excluded from lint traversals.
 *
 * **Details**
 *
 * Matching is purely lexical after separator normalization. Pass paths that are
 * already scoped to the traversal root if symlink resolution or case folding is
 * required by the caller.
 *
 * **Example** (Apply TypeScript source exclusions)
 *
 * ```ts
 * import { isExcludedTypeScriptSourcePath } from "@beep/repo-utils/schemas/TypeScriptSourceExclusions"
 * const generated = isExcludedTypeScriptSourcePath("packages/schema/src/_generated/schema.gen.ts")
 * const source = isExcludedTypeScriptSourcePath("packages/schema/src/index.ts")
 * console.log({ generated, source }) // { generated: true, source: false }
 * ```
 *
 * @param filePath - TypeScript source path checked against the exclusion rules.
 * @returns `true` when the path matches an excluded suffix or segment, otherwise `false`.
 * @category utilities
 * @since 0.0.0
 */
export const isExcludedTypeScriptSourcePath = (filePath: string): boolean => {
  const normalized = toPosixPath(filePath);
  return (
    A.some(TYPESCRIPT_SOURCE_EXCLUDED_SUFFIXES, (suffix) => Str.endsWith(suffix)(normalized)) ||
    A.some(TYPESCRIPT_SOURCE_EXCLUDED_SEGMENTS, (segment) => Str.includes(segment)(normalized))
  );
};
