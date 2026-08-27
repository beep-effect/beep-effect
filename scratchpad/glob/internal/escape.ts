/**
 * Escape glob magic characters so a literal string matches only itself.
 *
 * **Details**
 *
 * Ported from minimatch@10.2.5. Copyright Isaac Z. Schlueter and Contributors.
 * License: BlueOak-1.0.0. Verbatim except the options type now comes from the
 * extracted types leaf.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import type { EngineOptions } from "./types.ts";

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
 * **Gotchas**
 *
 * Default `magicalBraces` is false here and true on the matching unescape.
 * Pass the same options bag both ways or `{` / `}` will not round-trip.
 * Slashes (and backslashes in `windowsPathsNoEscape` mode) are never escaped.
 *
 * **Example** (Escape stars in both separator modes)
 *
 * ```ts
 * import { escape } from "../../glob/internal/escape.ts"
 *
 * console.log(escape("foo*.ts")) // "foo\\*.ts"
 * console.log(escape("foo*.ts", { windowsPathsNoEscape: true })) // "foo[*].ts"
 * console.log(escape("foo{bar}").includes("{")) // true
 * console.log(escape("foo{bar}", { magicalBraces: true }).includes("{")) // false
 * ```
 *
 * @internal
 * @category encoding
 * @since 0.0.0
 */
export const escape: {
	(): (s: string) => string;
	(s: string): string;
	(options: Pick<EngineOptions, "windowsPathsNoEscape" | "magicalBraces">): (s: string) => string;
	(s: string, options: Pick<EngineOptions, "windowsPathsNoEscape" | "magicalBraces">): string;
} = dual((args) => P.isString(args[0]), escapePattern);
