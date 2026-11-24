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
 * Escape all magic characters in a glob pattern.
 *
 * **Details**
 *
 * If the `windowsPathsNoEscape` option is used, then characters are escaped
 * by wrapping in `[]`, because a magic character wrapped in a character class
 * can only be satisfied by that exact character. In this mode, `\` is _not_
 * escaped, because it is not interpreted as a magic character, but instead as
 * a path separator.
 *
 * If the `magicalBraces` option is used, then braces (`{` and `}`) will be
 * escaped.
 *
 * **Example** (Escape wildcard characters in both path modes)
 *
 * ```ts
 * import { escape } from "@beep/glob/internal/escape"
 *
 * console.log(escape("*.ts")) // \*.ts
 * console.log(escape("*.ts", { windowsPathsNoEscape: true })) // [*].ts
 * console.log(escape("{a,b}", { magicalBraces: true, windowsPathsNoEscape: true })) // [{]a,b[}]
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
const escapeWithoutShadowingGlobalEscape: {
  (options?: Pick<EngineOptions, "windowsPathsNoEscape" | "magicalBraces">): (s: string) => string;
  (s: string, options?: Pick<EngineOptions, "windowsPathsNoEscape" | "magicalBraces">): string;
} = dual(
  (args) => P.isString(args[0]),
  (
    s: string,
    {
      windowsPathsNoEscape = false,
      magicalBraces = false,
    }: Pick<EngineOptions, "windowsPathsNoEscape" | "magicalBraces"> = {}
  ): string => {
    if (magicalBraces) {
      return windowsPathsNoEscape ? Str.replace(/[?*()[\]{}]/g, "[$&]")(s) : Str.replace(/[?*()[\]\\{}]/g, "\\$&")(s);
    }
    return windowsPathsNoEscape ? Str.replace(/[?*()[\]]/g, "[$&]")(s) : Str.replace(/[?*()[\]\\]/g, "\\$&")(s);
  }
);

export { escapeWithoutShadowingGlobalEscape as escape };
