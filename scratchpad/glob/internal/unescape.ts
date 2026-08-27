/**
 * Undo glob magic escaping produced by the matching escape helper.
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
 *
 * **Gotchas**
 *
 * Default `magicalBraces` is true here and false on the matching escape.
 * Unescaping engine-escaped braces with public defaults strips brace escapes
 * that `escape` did not add unless both calls share one options bag.
 *
 * **Example** (Round-trip a star and a brace)
 *
 * ```ts
 * import { escape } from "../../glob/internal/escape.ts"
 * import { unescape } from "../../glob/internal/unescape.ts"
 *
 * console.log(unescape(escape("foo*.ts"))) // "foo*.ts"
 * const windows = { windowsPathsNoEscape: true }
 * console.log(unescape(escape("foo*.ts", windows), windows)) // "foo*.ts"
 * const braces = { magicalBraces: true }
 * console.log(unescape(escape("foo{bar}", braces), braces)) // "foo{bar}"
 * ```
 *
 * @internal
 * @category decoding
 * @since 0.0.0
 */
export const unescape: {
	(): (s: string) => string;
	(s: string): string;
	(options: Pick<EngineOptions, "windowsPathsNoEscape" | "magicalBraces">): (s: string) => string;
	(s: string, options: Pick<EngineOptions, "windowsPathsNoEscape" | "magicalBraces">): string;
} = dual((args) => P.isString(args[0]), unescapePattern);
