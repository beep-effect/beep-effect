// Ported from minimatch@10.2.5 (https://github.com/isaacs/minimatch)
// Copyright: Isaac Z. Schlueter and Contributors
// License: BlueOak-1.0.0 (https://blueoakcouncil.org/license/1.0.0)
// Port notes: verbatim except the options type now comes from the extracted
// types leaf.

import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import type { EngineOptions } from "./types.ts";

/**
 * Un-escape a string that has been escaped with `escape`.
 *
 * **Details**
 *
 * If the `windowsPathsNoEscape` option is used, then square-bracket escapes
 * are removed, but not backslash escapes. For example, it will turn the
 * string `'[*]'` into `*`, but it will not turn `'\\*'` into `'*'`, because
 * `\` is a path separator in `windowsPathsNoEscape` mode.
 *
 * When `windowsPathsNoEscape` is not set, then both square-bracket escapes
 * and backslash escapes are removed.
 *
 * **Gotchas**
 *
 * Slashes (and backslashes in `windowsPathsNoEscape` mode) cannot be escaped
 * or unescaped.
 *
 * When `magicalBraces` is not set, escapes of braces (`{` and `}`) will not
 * be unescaped.
 * Here, disabling `magicalBraces` means passing `false`; omitting the option
 * uses its default of `true`.
 *
 * **Example** (Remove bracket and backslash escapes)
 *
 * ```ts
 * import { unescape } from "@beep/glob/internal/unescape"
 *
 * console.log(unescape("[*]")) // *
 * console.log(unescape("\\*")) // *
 * console.log(unescape({ magicalBraces: false })("[{]")) // [{]
 * ```
 *
 * **Example** (Preserve Windows path separators)
 *
 * ```ts
 * import { unescape } from "@beep/glob/internal/unescape"
 *
 * console.log(unescape("[*]", { windowsPathsNoEscape: true })) // *
 * console.log(unescape("\\*", { windowsPathsNoEscape: true })) // \*
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
const unescapeWithoutShadowingGlobalUnescape: {
  (options?: Pick<EngineOptions, "windowsPathsNoEscape" | "magicalBraces">): (s: string) => string;
  (s: string, options?: Pick<EngineOptions, "windowsPathsNoEscape" | "magicalBraces">): string;
} = dual(
  (args) => P.isString(args[0]),
  (
    s: string,
    {
      windowsPathsNoEscape = false,
      magicalBraces = true,
    }: Pick<EngineOptions, "windowsPathsNoEscape" | "magicalBraces"> = {}
  ): string => {
    if (magicalBraces) {
      return windowsPathsNoEscape
        ? Str.replace(/\[([^/\\])]/g, "$1")(s)
        : Str.replace(/\\([^/])/g, "$1")(Str.replace(/((?!\\).|^)\[([^/\\])]/g, "$1$2")(s));
    }
    return windowsPathsNoEscape
      ? Str.replace(/\[([^/\\{}])]/g, "$1")(s)
      : Str.replace(/\\([^/{}])/g, "$1")(Str.replace(/((?!\\).|^)\[([^/\\{}])]/g, "$1$2")(s));
  }
);

export { unescapeWithoutShadowingGlobalUnescape as unescape };
