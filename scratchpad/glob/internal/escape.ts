// Ported from minimatch@10.2.5 (https://github.com/isaacs/minimatch)
// Copyright: Isaac Z. Schlueter and Contributors
// License: BlueOak-1.0.0 (https://blueoakcouncil.org/license/1.0.0)
// Port notes: verbatim except the options type now comes from the extracted
// types leaf.

import type { EngineOptions } from "./types.ts";

/**
 * Escape all magic characters in a glob pattern.
 *
 * If the `windowsPathsNoEscape` option is used, then characters are escaped
 * by wrapping in `[]`, because a magic character wrapped in a character class
 * can only be satisfied by that exact character. In this mode, `\` is _not_
 * escaped, because it is not interpreted as a magic character, but instead as
 * a path separator.
 *
 * If the `magicalBraces` option is used, then braces (`{` and `}`) will be
 * escaped.
 */
const escapePattern = (
	s: string,
	{
		windowsPathsNoEscape = false,
		magicalBraces = false,
	}: Pick<EngineOptions, "windowsPathsNoEscape" | "magicalBraces"> = {},
): string => {
	// don't need to escape +@! because we escape the parens
	// that make those magic, and escaping ! as [!] isn't valid,
	// because [!]] is a valid glob class meaning not ']'.
	if (magicalBraces) {
		return windowsPathsNoEscape ? s.replace(/[?*()[\]{}]/g, "[$&]") : s.replace(/[?*()[\]\\{}]/g, "\\$&");
	}
	return windowsPathsNoEscape ? s.replace(/[?*()[\]]/g, "[$&]") : s.replace(/[?*()[\]\\]/g, "\\$&");
};

// Exported under the upstream name; the internal binding avoids shadowing the
// deprecated global escape().
export { escapePattern as escape };
