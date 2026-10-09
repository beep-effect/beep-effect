// Ported from cmark-gfm@0.29.0.gfm.13 (https://github.com/github/cmark-gfm)
// Source: test/pathological_tests.py
// Copyright: John MacFarlane
// License: BSD-2-Clause (https://github.com/github/cmark-gfm/blob/master/COPYING)
// Port notes: every case in upstream's `pathological` dict is carried over
// AS DATA except the already-disabled "many references" entry (commented out
// upstream itself, never active). The "tables" case — upstream's one
// GFM-extension case — joined in P2 and runs under the `gfm` dialect. Construction (repeat counts,
// nesting shapes) and expected-output regexes are preserved faithfully,
// translated from Python `re` syntax to JS `RegExp` syntax 1:1 — no pattern
// was loosened or tightened. "reference collisions" replicates upstream's
// `hash_collisions()` helper exactly: a bad hash function operating over
// BigInt with Python's infinite-precision two's-complement masking semantics
// (verified against a live `python3` run of the same algorithm — identical
// bad_key and document for COUNT=50000, REFMAP_SIZE=16). Upstream's 5-second
// per-case TIMEOUT is widened to the house-standard 8000ms per case (see the
// plan's Task 2 step 2).

/**
 * A single pathological/adversarial-input case: an input string engineered to
 * expose quadratic or worse behavior in a naive parser, paired with a regex
 * the correctly-linear output must match within `timeoutMs`.
 */
export interface PathologicalCase {
	readonly name: string;
	readonly input: string;
	readonly expectedPattern: RegExp;
	readonly timeoutMs: number;
	/**
	 * The dialect the case parses under. Absent means the commonmark
	 * substrate; upstream's GFM-extension cases carry `"gfm"`.
	 */
	readonly dialect?: "gfm";
}

const TIMEOUT_MS = 8000;

// Mirrors cmark-gfm's `hash_collisions()`: finds the first 50000 keys "x<i>"
// whose weak hash collides into refmap bucket 0 (of 16), then builds a
// reference-definition document engineered to degrade an O(1)-amortized
// refmap lookup into O(n) per lookup if the implementation under test uses
// the same weak hash. Uses BigInt so the 32-bit masking arithmetic matches
// Python's arbitrary-precision `& 0xFFFFFFFF` exactly, including on
// intermediate negative values (Python's `&` on a negative int treats it as
// infinite-precision two's complement; JS BigInt `&` does the same).
const hashCollisions = (): { readonly document: string; readonly badKey: string } => {
	const REFMAP_SIZE = 16n;
	const MASK32 = 0xffffffffn;
	const COUNT = 50000;

	const badHash = (ref: string): boolean => {
		let h = 0n;
		for (const c of ref) {
			const code = BigInt(c.codePointAt(0) ?? 0);
			const a = (h << 6n) & MASK32;
			const b = (h << 16n) & MASK32;
			h = code + a + b - h;
			h = h & MASK32;
		}
		return h % REFMAP_SIZE === 0n;
	};

	const collisions: Array<string> = [];
	let i = 0;
	while (collisions.length < COUNT) {
		const key = `x${i}`;
		if (badHash(key)) {
			collisions.push(key);
		}
		i++;
	}

	const [badKey, ...rest] = collisions;
	if (badKey === undefined) {
		throw new Error("hashCollisions: no collisions found (unreachable for COUNT=50000)");
	}

	const document = rest.map((key) => `[${key}]: /url\n\n[${badKey}]\n\n`).join("");
	return { document, badKey };
};

const { document: hashCollisionsDocument, badKey: hashCollisionsBadKey } = hashCollisions();

/**
 * The cmark-gfm pathological-input suite, carried over as data (CommonMark
 * cases only — GFM-extension-dependent cases join in P2). Every case is a
 * linear-time guarantee: a correct implementation produces output matching
 * `expectedPattern` well within `timeoutMs`; a quadratic-or-worse
 * implementation times out or produces mismatched output.
 */
export const PATHOLOGICAL_CASES: ReadonlyArray<PathologicalCase> = [
	{
		name: "nested strong emph",
		input: `${"*a **a ".repeat(65000)}b${" a** a*".repeat(65000)}`,
		expectedPattern: /(<em>a <strong>a ){65000}b( a<\/strong> a<\/em>){65000}/,
		timeoutMs: TIMEOUT_MS,
	},
	{
		name: "many emph closers with no openers",
		input: "a_ ".repeat(65000),
		expectedPattern: /(a[_] ){64999}a_/,
		timeoutMs: TIMEOUT_MS,
	},
	{
		name: "many emph openers with no closers",
		input: "_a ".repeat(65000),
		expectedPattern: /(_a ){64999}_a/,
		timeoutMs: TIMEOUT_MS,
	},
	{
		name: "many link closers with no openers",
		input: "a]".repeat(65000),
		expectedPattern: /(a\]){65000}/,
		timeoutMs: TIMEOUT_MS,
	},
	{
		name: "many link openers with no closers",
		input: "[a".repeat(65000),
		expectedPattern: /(\[a){65000}/,
		timeoutMs: TIMEOUT_MS,
	},
	{
		name: "mismatched openers and closers",
		input: "*a_ ".repeat(50000),
		expectedPattern: /([*]a[_] ){49999}[*]a_/,
		timeoutMs: TIMEOUT_MS,
	},
	{
		name: "openers and closers multiple of 3",
		input: `a**b${"c* ".repeat(50000)}`,
		expectedPattern: /a[*][*]b(c[*] ){49999}c[*]/,
		timeoutMs: TIMEOUT_MS,
	},
	{
		name: "link openers and emph closers",
		input: "[ a_".repeat(50000),
		expectedPattern: /(\[ a_){50000}/,
		timeoutMs: TIMEOUT_MS,
	},
	{
		name: "pattern [ (]( repeated",
		input: "[ (](".repeat(80000),
		expectedPattern: /(\[ \(\]\(){80000}/,
		timeoutMs: TIMEOUT_MS,
	},
	{
		name: "pattern ![[]() repeated",
		input: "![[]()".repeat(160000),
		expectedPattern: /(!\[<a href=""><\/a>){160000}/,
		timeoutMs: TIMEOUT_MS,
	},
	{
		name: "hard link/emph case",
		input: "**x [a*b**c*](d)",
		expectedPattern: /\*\*x <a href="d">a<em>b\*\*c<\/em><\/a>/,
		timeoutMs: TIMEOUT_MS,
	},
	{
		name: "nested brackets",
		input: `${"[".repeat(50000)}a${"]".repeat(50000)}`,
		expectedPattern: /\[{50000}a\]{50000}/,
		timeoutMs: TIMEOUT_MS,
	},
	{
		name: "nested block quotes",
		input: `${"> ".repeat(50000)}a`,
		expectedPattern: /(<blockquote>\n){50000}/,
		timeoutMs: TIMEOUT_MS,
	},
	{
		name: "deeply nested lists",
		input: Array.from({ length: 1000 }, (_, x) => `${"  ".repeat(x)}* a\n`).join(""),
		expectedPattern: /<ul>\n(<li>a\n<ul>\n){999}<li>a<\/li>\n<\/ul>\n(<\/li>\n<\/ul>\n){999}/,
		timeoutMs: TIMEOUT_MS,
	},
	{
		name: "U+0000 in input",
		input: "abc\u0000de\u0000",
		expectedPattern: /abc\uFFFD?de\uFFFD?/,
		timeoutMs: TIMEOUT_MS,
	},
	{
		name: "backticks",
		input: Array.from({ length: 4999 }, (_, x) => `e${"`".repeat(x + 1)}`).join(""),
		expectedPattern: /^<p>[e`]*<\/p>\n$/,
		timeoutMs: TIMEOUT_MS,
	},
	{
		name: "unclosed links A",
		input: "[a](<b".repeat(30000),
		expectedPattern: /(\[a\]\(&lt;b){30000}/,
		timeoutMs: TIMEOUT_MS,
	},
	{
		name: "unclosed links B",
		input: "[a](b".repeat(30000),
		expectedPattern: /(\[a\]\(b){30000}/,
		timeoutMs: TIMEOUT_MS,
	},
	{
		name: "unclosed <!--",
		input: `</${"<!--".repeat(300000)}`,
		expectedPattern: /&lt;\/(&lt;!--){300000}/,
		timeoutMs: TIMEOUT_MS,
	},
	{
		name: "reference collisions",
		input: hashCollisionsDocument,
		expectedPattern: new RegExp(`(<p>\\[${hashCollisionsBadKey}\\]<\\/p>\\n){49999}`),
		timeoutMs: TIMEOUT_MS,
	},
	{
		// Upstream's one GFM case: 30k CR-separated candidate header rows, each
		// followed by a one-dash delimiter line ending in a vertical tab. A
		// naive table scanner re-walks the accumulated paragraph on every line.
		name: "tables",
		input: "aaa\rbbb\n-\u000b\n".repeat(30000),
		expectedPattern: new RegExp(
			"^<p>aaa</p>\\n<table>\\n<thead>\\n<tr>\\n<th>bbb</th>\\n</tr>\\n</thead>\\n<tbody>\\n" +
				"(<tr>\\n<td>aaa</td>\\n</tr>\\n<tr>\\n<td>bbb</td>\\n</tr>\\n<tr>\\n<td>-\\u000b</td>\\n</tr>\\n){29999}" +
				"</tbody>\\n</table>\\n$",
		),
		timeoutMs: TIMEOUT_MS,
		dialect: "gfm",
	},
];
