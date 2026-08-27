// Ported from minimatch@10.2.5 (https://github.com/isaacs/minimatch)
// Copyright: Isaac Z. Schlueter and Contributors
// License: BlueOak-1.0.0 (https://blueoakcouncil.org/license/1.0.0)
// Port notes: verbatim except the options type now comes from the extracted
// types leaf.

import type { EngineOptions } from "./types.ts";

/**
 * Un-escape a string that has been escaped with `escape`.
 *
 * If the `windowsPathsNoEscape` option is used, then square-bracket escapes
 * are removed, but not backslash escapes. For example, it will turn the
 * string `'[*]'` into `*`, but it will not turn `'\\*'` into `'*'`, because
 * `\` is a path separator in `windowsPathsNoEscape` mode.
 *
 * When `windowsPathsNoEscape` is not set, then both square-bracket escapes
 * and backslash escapes are removed.
 *
 * Slashes (and backslashes in `windowsPathsNoEscape` mode) cannot be escaped
 * or unescaped.
 *
 * When `magicalBraces` is not set, escapes of braces (`{` and `}`) will not
 * be unescaped.
 */
const unescapePattern = (
	s: string,
	{
		windowsPathsNoEscape = false,
		magicalBraces = true,
	}: Pick<EngineOptions, "windowsPathsNoEscape" | "magicalBraces"> = {},
): string => {
	if (magicalBraces) {
		return windowsPathsNoEscape
			? s.replace(/\[([^\/\\])]/g, "$1")
			: s.replace(/((?!\\).|^)\[([^\/\\])]/g, "$1$2").replace(/\\([^/])/g, "$1");
	}
	return windowsPathsNoEscape
		? s.replace(/\[([^\/\\{}])]/g, "$1")
		: s.replace(/((?!\\).|^)\[([^\/\\{}])]/g, "$1$2").replace(/\\([^/{}])/g, "$1");
};

// Exported under the upstream name; the internal binding avoids shadowing the
// deprecated global unescape().
export { unescapePattern as unescape };
