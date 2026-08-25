/**
 * Shared source-path classification for the runtime documentation test lane.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Str } from "@beep/utils";

/**
 * Determines whether a repo-relative path can contain runnable JSDoc fences.
 *
 * **Example** (Classify Doctest source paths)
 *
 * ```ts
 * import { isDoctestSourcePath } from "@beep/repo-cli/test/Docgen"
 *
 * console.log(isDoctestSourcePath("packages/example/src/index.ts")) // true
 * console.log(isDoctestSourcePath("packages/example/src/index.d.ts")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isDoctestSourcePath = (file: string): boolean =>
  Str.endsWith(".ts")(file) &&
  !Str.endsWith(".d.ts")(file) &&
  (Str.startsWith("packages/")(file) || Str.startsWith("apps/")(file)) &&
  Str.includes("/src/")(file) &&
  !Str.includes("/test/fixtures/")(file) &&
  !Str.includes("/node_modules/")(file) &&
  !Str.includes("/.context/")(file);
