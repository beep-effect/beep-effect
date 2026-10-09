import * as A from "effect/Array";
import * as HashSet from "effect/HashSet";
import { sanitize } from "../Fmt.ts";

/** The URL schemes a link may have, besides a relative URL. */
const ALLOWED = HashSet.make("http", "https", "mailto", "file", "vscode", "vscode-insiders");

/**
 * Whether a link may point at this URL: its scheme is one of `http`, `https`, `mailto`, `file`, `vscode` and
 * `vscode-insiders`, or it has none (a relative URL or a fragment).
 *
 * **Details**
 *
 * The scheme is read from a normalised copy, with control characters and whitespace removed and the case folded,
 * because a browser ignores them inside a scheme (`java<tab>script:`). One list serves every renderer that writes a
 * link, so `javascript:`, `data:` and the like are refused the same way in markdown and in a terminal's OSC 8.
 *
 * @internal
 */
export const isAllowedLinkUrl = (url: string): boolean => {
	const scheme = /^([a-z][a-z0-9+.-]*):/.exec(sanitize(url).replace(/\s/g, "").toLowerCase());
	return scheme === null || HashSet.has(ALLOWED, A.getUnsafe(scheme, 1));
};
