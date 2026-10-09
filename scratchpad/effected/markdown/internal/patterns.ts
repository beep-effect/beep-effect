// Anchored and forward matching without slicing the subject.
//
// Upstream matches with `re.exec(this.subject.slice(this.pos))`. That is
// correct and, on a 12 MB pathological input, quadratic on its own: every
// attempt materializes the remainder of the subject before the regex engine
// looks at a single character. Sticky and global clones with `lastIndex` do
// the same matching against the original string and copy nothing.
//
// The clones are cached against the source pattern, so each pattern is
// compiled once for the life of the process.
//
// Leaf module: imports nothing.

const stickyCache = new WeakMap<RegExp, RegExp>();
const globalCache = new WeakMap<RegExp, RegExp>();

const clone = (pattern: RegExp, flag: "y" | "g", dropCaret: boolean): RegExp => {
	// A leading `^` and the `y` flag say the same thing, but together they say
	// "start of the SUBJECT", which is not what an anchored match at a cursor
	// means. The caret goes; stickiness carries the anchoring.
	const source = dropCaret && pattern.source.startsWith("^") ? pattern.source.slice(1) : pattern.source;
	return new RegExp(source, `${pattern.flags.replace(/[gy]/g, "")}${flag}`);
};

/** The sticky twin of `pattern`, anchored at `lastIndex`. */
export const stickyOf = (pattern: RegExp): RegExp => {
	const cached = stickyCache.get(pattern);
	if (cached !== undefined) {
		return cached;
	}
	const made = clone(pattern, "y", true);
	stickyCache.set(pattern, made);
	return made;
};

/** The global twin of `pattern`, searching forward from `lastIndex`. */
export const globalOf = (pattern: RegExp): RegExp => {
	const cached = globalCache.get(pattern);
	if (cached !== undefined) {
		return cached;
	}
	const made = clone(pattern, "g", false);
	globalCache.set(pattern, made);
	return made;
};
