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
 * import { isDoctestSourcePath } from "@beep/repo-utils/JSDoc/DoctestSource"
 *
 * console.log(isDoctestSourcePath("packages/example/src/index.ts")) // true
 * console.log(isDoctestSourcePath("packages/example/src/index.d.ts")) // false
 * ```
 *
 * @param file - Repo-relative POSIX path, such as `packages/<name>/src/<file>.ts`.
 * @returns `true` only for `.ts`/`.tsx` sources (not `.d.ts`) under a `packages/` or `apps/` `src/` directory, outside test fixtures, `node_modules`, and `.context`.
 * @category predicates
 * @since 0.0.0
 */
export const isDoctestSourcePath = (file: string): boolean =>
  (Str.endsWith(".ts")(file) || Str.endsWith(".tsx")(file)) &&
  !Str.endsWith(".d.ts")(file) &&
  (Str.startsWith("packages/")(file) || Str.startsWith("apps/")(file)) &&
  Str.includes("/src/")(file) &&
  !Str.includes("/test/fixtures/")(file) &&
  !Str.includes("/node_modules/")(file) &&
  !Str.includes("/.context/")(file);

/**
 * Marker used to select in-source documentation tests.
 *
 * **Details**
 *
 * Composed at runtime because Vitest's includeSource grep selects literal marker text.
 *
 * **Gotchas**
 *
 * A source that spells the marker verbatim becomes a test file.
 *
 * **Example** (Recognize the marker)
 *
 * ```ts
 * import { doctestSourceMarker } from "@beep/repo-utils/JSDoc/DoctestSource"
 *
 * console.log(doctestSourceMarker.length) // 18
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const doctestSourceMarker = "import.meta." + "vitest";

/**
 * Renders fence metadata for a named documentation example.
 *
 * **Details**
 *
 * Uses the runtime-composed marker to avoid Vitest's includeSource grep.
 *
 * **Gotchas**
 *
 * A source that spells the marker verbatim becomes a test file.
 * The caller supplies a name without double quotes.
 *
 * **Example** (Render example metadata)
 *
 * ```ts
 * import { doctestFenceInfo } from "@beep/repo-utils/JSDoc/DoctestSource"
 *
 * console.log(doctestFenceInfo("Add numbers").endsWith('name="Add numbers"')) // true
 * ```
 *
 * @param name - Example title placed in the fence's `name` attribute.
 * @returns Fence info string of the form `ts <marker> name="<name>"`.
 * @category formatting
 * @since 0.0.0
 */
export const doctestFenceInfo = (name: string): string => `ts ${doctestSourceMarker} name="${name}"`;
