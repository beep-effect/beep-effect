// Anchored and forward matching without slicing the subject.
//
// Upstream matches with `re.exec(this.subject.slice(this.pos))`. That is
// correct and, on a 12 MB pathological input, quadratic on its own: every
// attempt materializes the remainder of the subject before the regex engine
// looks at a single character. Sticky and global clones with `lastIndex` do
// the same matching against the original string and copy nothing.
//
// Each operation owns a fresh clone, so its mutable `lastIndex` cannot
// interfere with another operation using the same source pattern.
//
// Leaf module: imports nothing.

const clone = (pattern: RegExp, flag: "y" | "g", dropCaret: boolean): RegExp => {
	// A leading `^` and the `y` flag say the same thing, but together they say
	// "start of the SUBJECT", which is not what an anchored match at a cursor
	// means. The caret goes; stickiness carries the anchoring.
	const source = dropCaret && pattern.source.startsWith("^") ? pattern.source.slice(1) : pattern.source;
	return new RegExp(source, `${pattern.flags.replace(/[gy]/g, "")}${flag}`);
};

/**
 * The sticky twin of `pattern`, anchored at `lastIndex`.
 *
 * **Details**
 *
 * A fresh clone replaces global or sticky flags with the sticky flag and drops
 * a leading caret so anchoring applies at the cursor rather than the start of
 * the subject. Its mutable `lastIndex` is independent of the source pattern.
 *
 * **Example** (Match at a cursor after dropping the leading caret)
 *
 * ```ts
 * import { stickyOf } from "@beep/scratchpad/effected/markdown/internal/patterns"
 *
 * const pattern = stickyOf(/^word/)
 * pattern.lastIndex = 2
 * console.log(pattern.exec("a word")?.[0]) // word
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const stickyOf = (pattern: RegExp): RegExp => clone(pattern, "y", true);

/**
 * The global twin of `pattern`, searching forward from `lastIndex`.
 *
 * **Details**
 *
 * A fresh clone replaces global or sticky flags with the global flag, keeping
 * the source pattern's leading caret and other flags. Its mutable `lastIndex`
 * is independent of the source pattern.
 *
 * **Example** (Search beyond the current cursor)
 *
 * ```ts
 * import { globalOf } from "@beep/scratchpad/effected/markdown/internal/patterns"
 *
 * const pattern = globalOf(/word/)
 * pattern.lastIndex = 1
 * console.log(pattern.exec("a word")?.index) // 2
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const globalOf = (pattern: RegExp): RegExp => clone(pattern, "g", false);
