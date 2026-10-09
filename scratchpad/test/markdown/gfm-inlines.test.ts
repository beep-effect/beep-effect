// Unit coverage for the two GFM inline constructs: strikethrough (`~`/`~~`)
// and autolink literals (`www.`, `http(s)`/`ftp`, and email/`mailto:`/`xmpp:`).
//
// Semantics authority is cmark-gfm 0.29.0.gfm.13 — `extensions/strikethrough.c`
// and `extensions/autolink.c`. The conformance corpora assert the spec
// examples; these assert the rules those examples only sample, and that the
// `commonmark` dialect never sees either construct.

import { assert, describe, it } from "@effect/vitest";
import { parseBlocks } from "../../effected/markdown/internal/blockParser.ts";
import type { PhrasingContent } from "../../effected/markdown/MarkdownNode.ts";

/** The phrasing children of a source that parses to a single leaf block. */
const inlinesOf = (source: string, dialect: "commonmark" | "gfm" = "gfm"): ReadonlyArray<PhrasingContent> => {
	const [first] = parseBlocks(source, { dialect: dialect }).root.children;
	return first?.type === "paragraph" || first?.type === "heading" ? first.children : [];
};

/**
 * A compact rendering of phrasing content, so a test reads as the shape it
 * asserts: text is quoted, containers bracket their children, and a link
 * carries its destination.
 */
const sketch = (nodes: ReadonlyArray<PhrasingContent>): string =>
	nodes
		.map((node) => {
			switch (node.type) {
				case "text":
					return JSON.stringify(node.value);
				case "inlineCode":
					return `code${JSON.stringify(node.value)}`;
				case "html":
					return `html${JSON.stringify(node.value)}`;
				case "link":
					return `link(${node.url})[${sketch(node.children)}]`;
				case "image":
					return `image(${node.url})`;
				case "delete":
					return `del[${sketch(node.children)}]`;
				case "emphasis":
					return `em[${sketch(node.children)}]`;
				case "strong":
					return `strong[${sketch(node.children)}]`;
				default:
					return node.type;
			}
		})
		.join(",");

/** The compact shape of a source's phrasing content under a dialect. */
const shape = (source: string, dialect: "commonmark" | "gfm" = "gfm"): string => sketch(inlinesOf(source, dialect));

describe("gfm strikethrough", () => {
	describe("tilde run lengths", () => {
		it("pairs a run of one", () => {
			assert.strictEqual(shape("~foo~"), 'del["foo"]');
		});

		it("pairs a run of two", () => {
			assert.strictEqual(shape("~~foo~~"), 'del["foo"]');
		});

		it("never pairs a run of three", () => {
			// cmark-gfm's `match` pushes a delimiter only for runs of one or
			// two, so a longer run has nothing to pair with. The leading word
			// keeps the line off a tilde code fence, which owns column zero.
			assert.strictEqual(shape("a ~~~foo~~~"), '"a ~~~foo~~~"');
		});

		it("never pairs a run of five", () => {
			assert.strictEqual(shape("a ~~~~~one~~~~~"), '"a ~~~~~one~~~~~"');
		});

		it("refuses a mismatched pair", () => {
			// `insert` bails when the two runs differ in length.
			assert.strictEqual(shape("~one~~"), '"~one~~"');
			assert.strictEqual(shape("~~one~"), '"~~one~"');
		});
	});

	describe("flanking", () => {
		it("declines an opener followed by whitespace", () => {
			assert.strictEqual(shape("~ foo~"), '"~ foo~"');
		});

		it("declines a closer preceded by whitespace", () => {
			assert.strictEqual(shape("~foo ~"), '"~foo ~"');
		});

		it("allows an interior tilde that flanks neither way", () => {
			assert.strictEqual(shape("~is ~ legit~"), 'del["is ~ legit"]');
		});

		it("allows intraword strikethrough", () => {
			// `~` follows `*`'s flanking rules, not `_`'s, so it may sit
			// inside a word.
			assert.strictEqual(shape("a~b~c"), '"a",del["b"],"c"');
		});
	});

	describe("nesting", () => {
		it("contains emphasis", () => {
			assert.strictEqual(shape("~~*foo*~~"), 'del[em["foo"]]');
		});

		it("nests inside emphasis", () => {
			assert.strictEqual(shape("*~~foo~~*"), 'em[del["foo"]]');
		});

		it("loses to a code span", () => {
			assert.strictEqual(shape("~~`a~~b`~~"), 'del[code"a~~b"]');
		});
	});

	it("is inert under the commonmark dialect", () => {
		assert.strictEqual(shape("~~foo~~", "commonmark"), '"~~foo~~"');
		assert.strictEqual(shape("~foo~", "commonmark"), '"~foo~"');
	});
});

describe("gfm autolink literals", () => {
	describe("www. literals", () => {
		it("links a bare www. host", () => {
			assert.strictEqual(shape("www.commonmark.org"), 'link(http://www.commonmark.org)["www.commonmark.org"]');
		});

		it("requires a dot in the domain", () => {
			// `check_domain` never examines the run's last character, so the
			// trailing dot of a bare `www.` does not count and nothing links.
			assert.strictEqual(shape("www."), '"www."');
		});

		it("accepts a single-label host once a dot has been seen", () => {
			// One dot is the whole requirement — cmark-gfm's comment says "a
			// valid domain needs to have at least a dot", and it means it.
			assert.strictEqual(shape("www.commonmark"), 'link(http://www.commonmark)["www.commonmark"]');
		});

		it("rejects an underscore in either of the last two segments", () => {
			assert.strictEqual(shape("www.xxx.yyy._zzz"), '"www.xxx.yyy._zzz"');
			assert.strictEqual(shape("www.xxx._yyy.zzz"), '"www.xxx._yyy.zzz"');
		});

		it("allows an underscore further left", () => {
			assert.strictEqual(shape("www._xxx.yyy.zzz"), 'link(http://www._xxx.yyy.zzz)["www._xxx.yyy.zzz"]');
		});

		it("allows an underscore in the path", () => {
			assert.strictEqual(shape("www.google.com/a_b"), 'link(http://www.google.com/a_b)["www.google.com/a_b"]');
		});
	});

	describe("preceding character", () => {
		it("fires at the start of a line", () => {
			assert.strictEqual(shape("www.a.com"), 'link(http://www.a.com)["www.a.com"]');
		});

		it("fires after whitespace and after * _ ~ (", () => {
			for (const before of [" ", "*", "_", "~", "("]) {
				const rendered = shape(`x${before}www.a.com`);
				assert.isTrue(rendered.includes("link(http://www.a.com)"), `expected a literal autolink after ${before}`);
			}
		});

		it("declines after any other character", () => {
			assert.strictEqual(shape("xwww.a.com"), '"xwww.a.com"');
			assert.strictEqual(shape("-www.a.com"), '"-www.a.com"');
		});
	});

	describe("trailing punctuation", () => {
		it("strips a trailing full stop", () => {
			assert.strictEqual(shape("www.a.com."), 'link(http://www.a.com)["www.a.com"],"."');
		});

		it("strips the other trailing punctuation cmark-gfm names", () => {
			for (const mark of ["?", "!", ",", ":", "*", "_", "~", "'", '"']) {
				const rendered = shape(`www.a.com${mark}`);
				assert.isTrue(rendered.startsWith('link(http://www.a.com)["www.a.com"]'), `expected ${mark} to be trimmed`);
			}
		});

		it("keeps punctuation inside the path", () => {
			assert.strictEqual(shape("www.a.com/a.b"), 'link(http://www.a.com/a.b)["www.a.com/a.b"]');
		});
	});

	describe("paren balancing", () => {
		it("keeps a balanced trailing paren group", () => {
			assert.strictEqual(shape("www.a.com/q_(bar)"), 'link(http://www.a.com/q_(bar))["www.a.com/q_(bar)"]');
		});

		it("drops an unbalanced trailing paren", () => {
			assert.strictEqual(shape("(www.a.com/q)"), '"(",link(http://www.a.com/q)["www.a.com/q"],")"');
		});

		it("drops only the excess closers", () => {
			assert.strictEqual(shape("www.a.com/q))"), 'link(http://www.a.com/q)["www.a.com/q"],"))"');
		});
	});

	describe("entity trimming", () => {
		it("trims a trailing entity reference", () => {
			assert.strictEqual(shape("www.a.com/x&hl;"), 'link(http://www.a.com/x)["www.a.com/x"],"&hl;"');
		});

		it("keeps a run that only looks like one", () => {
			assert.strictEqual(shape("www.a.com/x&hl=en"), 'link(http://www.a.com/x&hl=en)["www.a.com/x&hl=en"]');
		});
	});

	describe("scheme literals", () => {
		it("links http, https and ftp", () => {
			assert.strictEqual(shape("http://a.com"), 'link(http://a.com)["http://a.com"]');
			assert.strictEqual(shape("https://a.com"), 'link(https://a.com)["https://a.com"]');
			assert.strictEqual(shape("ftp://a.com"), 'link(ftp://a.com)["ftp://a.com"]');
		});

		it("declines a scheme cmark-gfm does not whitelist", () => {
			assert.strictEqual(shape("gopher://a.com"), '"gopher://a.com"');
		});

		it("requires a host character after the scheme", () => {
			assert.strictEqual(shape("http:// a.com"), '"http:// a.com"');
		});

		it("stops at a less-than sign", () => {
			assert.strictEqual(shape("www.a.com/he<lp"), 'link(http://www.a.com/he)["www.a.com/he"],"<lp"');
		});
	});

	describe("email literals", () => {
		it("links a bare address", () => {
			assert.strictEqual(shape("foo@bar.baz"), 'link(mailto:foo@bar.baz)["foo@bar.baz"]');
		});

		it("allows dots, dashes, underscores and pluses on the left", () => {
			assert.strictEqual(shape("a.b-c_d+e@a.b"), 'link(mailto:a.b-c_d+e@a.b)["a.b-c_d+e@a.b"]');
		});

		it("declines a plus on the right", () => {
			assert.strictEqual(shape("hello@mail+xyz.example"), '"hello@mail+xyz.example"');
		});

		it("declines a trailing dash or underscore in the domain", () => {
			assert.strictEqual(shape("a.b-c_d@a.b-"), '"a.b-c_d@a.b-"');
			assert.strictEqual(shape("a.b-c_d@a.b_"), '"a.b-c_d@a.b_"');
		});

		it("carries an explicit mailto: into the link text", () => {
			assert.strictEqual(shape("mailto:foo@bar.baz"), 'link(mailto:foo@bar.baz)["mailto:foo@bar.baz"]');
		});

		it("declines a mailto: glued to a word", () => {
			assert.strictEqual(shape("mmmmailto:foo@bar.baz"), '"mmmmailto:",link(mailto:foo@bar.baz)["foo@bar.baz"]');
		});

		it("keeps an xmpp: resource path", () => {
			assert.strictEqual(shape("xmpp:foo@bar.baz/room"), 'link(xmpp:foo@bar.baz/room)["xmpp:foo@bar.baz/room"]');
		});

		it("requires a dot in the domain", () => {
			assert.strictEqual(shape("foo@bar"), '"foo@bar"');
		});
	});

	describe("interaction with the rest of the inline pass", () => {
		it("does not fire inside a real autolink", () => {
			assert.strictEqual(shape("<http://a.com>"), 'link(http://a.com)["http://a.com"]');
		});

		it("does not fire inside a code span", () => {
			assert.strictEqual(shape("`www.a.com`"), 'code"www.a.com"');
			assert.strictEqual(shape("`foo@bar.baz`"), 'code"foo@bar.baz"');
		});

		it("does not fire inside an inline link's text", () => {
			assert.strictEqual(shape("[www.a.com](/x)"), 'link(/x)["www.a.com"]');
			assert.strictEqual(shape("[foo@bar.baz](/x)"), 'link(/x)["foo@bar.baz"]');
		});

		it("fires inside emphasis", () => {
			assert.strictEqual(shape("**and http://inlines**"), 'strong["and ",link(http://inlines)["http://inlines"]]');
		});

		it("survives a delimiter run splitting the run of text", () => {
			assert.strictEqual(shape("a.b_c@d.ef"), 'link(mailto:a.b_c@d.ef)["a.b_c@d.ef"]');
		});
	});

	it("is inert under the commonmark dialect", () => {
		assert.strictEqual(shape("www.a.com", "commonmark"), '"www.a.com"');
		assert.strictEqual(shape("http://a.com", "commonmark"), '"http://a.com"');
		assert.strictEqual(shape("foo@bar.baz", "commonmark"), '"foo@bar.baz"');
	});
});
