import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import type { GitConfigParseError } from "../../effected/git/GitConfig.ts";
import { GitConfig, GitConfigEditError } from "../../effected/git/GitConfig.ts";

/** Unwraps a successful Result or fails the test with the failure's message. */
const ok = <A, E>(result: Result.Result<A, E>): A => {
	if (Result.isFailure(result)) {
		assert.fail(`expected success, got failure: ${String(result.failure)}`);
	}
	assert.isTrue(Result.isSuccess(result));
	return result.success;
};

const parse = (text: string): GitConfig => ok(GitConfig.parseResult(text));

const failure = (text: string): GitConfigParseError => {
	const result = GitConfig.parseResult(text);
	assertTrue(Result.isFailure(result), "expected a parse failure");
	return result.failure;
};

/**
 * The conformance corpus: git-config edge cases (quoting, case, comments,
 * continuation, dotted headers) that must parse, answer the recorded
 * lookups, and round-trip BYTE-FOR-BYTE through stringify.
 */
interface CorpusCase {
	readonly name: string;
	readonly text: string;
	/** [section, subsection, key, expected values in order] */
	readonly lookups: ReadonlyArray<readonly [string, string | undefined, string, ReadonlyArray<string>]>;
}

const corpus: ReadonlyArray<CorpusCase> = [
	{
		name: "plain section and entry",
		text: "[core]\n\tbare = false\n",
		lookups: [["core", undefined, "bare", ["false"]]],
	},
	{
		name: "section and key names are case-insensitive",
		text: "[CoRe]\n\tBARE = false\n",
		lookups: [
			["core", undefined, "bare", ["false"]],
			["CORE", undefined, "Bare", ["false"]],
		],
	},
	{
		name: "quoted subsection names are case-sensitive",
		text: '[submodule "Alpha"]\n\tpath = a\n',
		lookups: [
			["submodule", "Alpha", "path", ["a"]],
			["submodule", "alpha", "path", []],
		],
	},
	{
		name: "deprecated dotted subsection compares case-insensitively",
		text: "[branch.Master]\n\tremote = origin\n",
		lookups: [
			["branch", "master", "remote", ["origin"]],
			["Branch", "MASTER", "remote", ["origin"]],
		],
	},
	{
		name: "dotted form splits at the FIRST dot",
		text: "[a.b.c]\n\tkey = v\n",
		lookups: [["a", "b.c", "key", ["v"]]],
	},
	{
		name: "bare key is boolean-true shorthand",
		text: "[feature]\n\tenabled\n",
		lookups: [["feature", undefined, "enabled", ["true"]]],
	},
	{
		name: "multi-valued key keeps every value in order",
		text: '[remote "origin"]\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n\tfetch = +refs/tags/*:refs/tags/*\n',
		lookups: [["remote", "origin", "fetch", ["+refs/heads/*:refs/remotes/origin/*", "+refs/tags/*:refs/tags/*"]]],
	},
	{
		name: "duplicate sections merge for lookup, last wins for get",
		text: "[core]\n\tval = one\n[other]\n\tx = y\n[core]\n\tval = two\n",
		lookups: [["core", undefined, "val", ["one", "two"]]],
	},
	{
		name: "trailing comment after a value is not part of it",
		text: "[core]\n\teditor = vim # the one true editor\n",
		lookups: [["core", undefined, "editor", ["vim"]]],
	},
	{
		name: "semicolon comments too",
		text: "[core]\n\teditor = vim ; also this\n",
		lookups: [["core", undefined, "editor", ["vim"]]],
	},
	{
		name: "comment characters inside quotes are literal",
		text: '[alias]\n\tgraph = "log --oneline # not a comment"\n',
		lookups: [["alias", undefined, "graph", ["log --oneline # not a comment"]]],
	},
	{
		name: "unquoted internal whitespace is kept verbatim, trailing discarded",
		text: "[user]\n\tname = Ada   Lovelace   \n",
		lookups: [["user", undefined, "name", ["Ada   Lovelace"]]],
	},
	{
		name: "quoted trailing whitespace survives",
		text: '[user]\n\tname = "Ada "\n',
		lookups: [["user", undefined, "name", ["Ada "]]],
	},
	{
		name: "escape sequences decode",
		text: '[test]\n\tvalue = "a\\"b\\\\c\\td\\ne"\n',
		lookups: [["test", undefined, "value", ['a"b\\c\td\ne']]],
	},
	{
		name: "quote concatenation mixes quoted and unquoted runs",
		text: '[test]\n\tvalue = one" two "three\n',
		lookups: [["test", undefined, "value", ["one two three"]]],
	},
	{
		name: "backslash-newline continues a value",
		text: "[test]\n\tvalue = first\\\nsecond\n",
		lookups: [["test", undefined, "value", ["firstsecond"]]],
	},
	{
		name: "empty explicit value",
		text: "[test]\n\tvalue =\n",
		lookups: [["test", undefined, "value", [""]]],
	},
	{
		name: "empty quoted value",
		text: '[test]\n\tvalue = ""\n',
		lookups: [["test", undefined, "value", [""]]],
	},
	{
		name: "subsection with escaped quote and backslash",
		text: '[submodule "a\\"b\\\\c"]\n\tpath = p\n',
		lookups: [["submodule", 'a"b\\c', "path", ["p"]]],
	},
	{
		name: "blank lines and full-line comments everywhere",
		text: "# leading comment\n\n[core]\n\n\t; interior comment\n\tbare = false\n\n# trailing comment\n",
		lookups: [["core", undefined, "bare", ["false"]]],
	},
	{
		name: "header with trailing comment",
		text: "[core] # about this section\n\tbare = false\n",
		lookups: [["core", undefined, "bare", ["false"]]],
	},
	{
		name: "CRLF line endings",
		text: "[core]\r\n\tbare = false\r\n",
		lookups: [["core", undefined, "bare", ["false"]]],
	},
	{
		name: "no trailing newline at EOF",
		text: "[core]\n\tbare = false",
		lookups: [["core", undefined, "bare", ["false"]]],
	},
	{
		name: "key with digits and dashes after the first letter",
		text: "[test]\n\tkey-2-name = v\n",
		lookups: [["test", undefined, "key-2-name", ["v"]]],
	},
	{
		name: "a real .gitmodules shape",
		text: '[submodule ".repos/effect"]\n\tpath = .repos/effect\n\turl = https://github.com/Effect-TS/effect.git\n\tshallow = true\n',
		lookups: [
			["submodule", ".repos/effect", "path", [".repos/effect"]],
			["submodule", ".repos/effect", "url", ["https://github.com/Effect-TS/effect.git"]],
			["submodule", ".repos/effect", "shallow", ["true"]],
		],
	},
	{
		name: "spaces (not tabs) as entry indentation",
		text: "[core]\n    bare = false\n",
		lookups: [["core", undefined, "bare", ["false"]]],
	},
	{
		name: "value with equals signs",
		text: "[test]\n\tcmd = a=b=c\n",
		lookups: [["test", undefined, "cmd", ["a=b=c"]]],
	},
];

describe("GitConfig", () => {
	describe("conformance corpus", () => {
		it("the corpus walk found the expected number of cases", () => {
			// A silently-empty (or silently-shrunk) corpus would green every loop
			// below. The exact count is the guard: adding a case updates it here
			// AND in CLAUDE.md's test inventory.
			assert.strictEqual(corpus.length, 27);
		});

		for (const c of corpus) {
			it(`parses and answers lookups: ${c.name}`, () => {
				const doc = parse(c.text);
				for (const [section, subsection, key, expected] of c.lookups) {
					assert.deepStrictEqual(
						doc.getAll(section, subsection, key),
						expected,
						`getAll(${section}, ${String(subsection)}, ${key})`,
					);
				}
			});

			it(`round-trips byte-for-byte: ${c.name}`, () => {
				assert.strictEqual(parse(c.text).stringify(), c.text);
			});
		}
	});

	describe("parse", () => {
		it.effect("the Effect form derives from parseResult behind its span", () =>
			Effect.gen(function* () {
				const doc = yield* GitConfig.parse("[core]\n\tbare = false\n");
				assert.deepStrictEqual(doc.get("core", undefined, "bare"), O.some("false"));
				const error = yield* Effect.flip(GitConfig.parse("[unclosed\n"));
				assert.strictEqual(error._tag, "GitConfigParseError");
			}),
		);

		it("get is last-wins, getAll is in order", () => {
			const doc = parse("[a]\n\tk = one\n[a]\n\tk = two\n");
			assert.deepStrictEqual(doc.get("a", undefined, "k"), O.some("two"));
			assert.deepStrictEqual(doc.getAll("a", undefined, "k"), ["one", "two"]);
		});

		it("a missing key answers Option.none", () => {
			const doc = parse("[a]\n\tk = v\n");
			assert.deepStrictEqual(doc.get("a", undefined, "other"), O.none());
			assert.deepStrictEqual(doc.get("b", undefined, "k"), O.none());
		});

		it("the entry model preserves the bare-key / explicit-value distinction", () => {
			const doc = parse("[f]\n\ton\n\toff = false\n");
			const section = doc.sections[0];
			assert.isDefined(section);
			assert.strictEqual(section?.entries[0]?.key, "on");
			assert.isFalse(Object.hasOwn(section?.entries[0] ?? {}, "value"));
			assert.strictEqual(section?.entries[1]?.value, "false");
		});
	});

	describe("malformed input fails typed, never a defect", () => {
		it("unterminated quoted value", () => {
			const error = failure('[a]\n\tk = "unclosed\n');
			assert.strictEqual(error.diagnostics[0]?.code, "unterminatedQuote");
			assert.strictEqual(error.diagnostics[0]?.line, 1);
		});

		it("unterminated subsection name", () => {
			const error = failure('[submodule "unclosed]\n');
			assert.strictEqual(error.diagnostics[0]?.code, "unterminatedQuote");
		});

		it("unclosed section header", () => {
			const error = failure("[core\n\tbare = false\n");
			assert.strictEqual(error.diagnostics[0]?.code, "invalidSectionHeader");
		});

		it("header with illegal name characters", () => {
			const error = failure("[co re]\n");
			assert.strictEqual(error.diagnostics[0]?.code, "invalidSectionHeader");
		});

		it("variable before any section header", () => {
			const error = failure("bare = false\n[core]\n");
			assert.strictEqual(error.diagnostics[0]?.code, "invalidLine");
		});

		it("variable name starting with a digit", () => {
			const error = failure("[a]\n\t1key = v\n");
			assert.strictEqual(error.diagnostics[0]?.code, "invalidKey");
		});

		it("invalid escape sequence", () => {
			const error = failure("[a]\n\tk = a\\qb\n");
			assert.strictEqual(error.diagnostics[0]?.code, "invalidEscape");
		});

		it("NUL byte", () => {
			const error = failure("[a]\n\tk = v\0\n");
			assert.strictEqual(error.diagnostics[0]?.code, "unexpectedCharacter");
		});

		it("collects multiple diagnostics in one pass", () => {
			const error = failure("[bad\n[worse\n");
			assert.strictEqual(error.diagnostics.length, 2);
			assert.include(error.message, "and 1 more");
		});

		it("parseResult never throws on hostile input", () => {
			const hostile = ['"'.repeat(10_000), "[".repeat(10_000), `[a]\n${"\tk = v\\\n".repeat(5_000)}x\n`];
			for (const text of hostile) {
				// Must return a Result (either way), not throw.
				const result = GitConfig.parseResult(text);
				assert.isTrue(Result.isSuccess(result) || Result.isFailure(result));
			}
		});
	});

	describe("includes are recognized but not resolved", () => {
		it("surfaces include and includeIf directives", () => {
			const doc = parse('[include]\n\tpath = ~/.gitconfig.local\n[includeIf "gitdir:~/work/"]\n\tpath = work.inc\n');
			const includes = doc.includes();
			assert.strictEqual(includes.length, 2);
			assert.strictEqual(includes[0]?.path, "~/.gitconfig.local");
			assert.isFalse(Object.hasOwn(includes[0] ?? {}, "condition"));
			assert.strictEqual(includes[1]?.path, "work.inc");
			assert.strictEqual(includes[1]?.condition, "gitdir:~/work/");
		});
	});

	describe("surgical edits", () => {
		it("set replaces the value in place, preserving comments and formatting", () => {
			const doc = parse("# top\n[core]\n\teditor = vim # keep me\n\tbare = false\n");
			const edited = ok(doc.set("core", undefined, "editor", "emacs"));
			assert.strictEqual(edited.stringify(), "# top\n[core]\n\teditor = emacs # keep me\n\tbare = false\n");
		});

		it("set matches the key case-insensitively and preserves the raw spelling", () => {
			const doc = parse("[core]\n\tEditor = vim\n");
			const edited = ok(doc.set("CORE", undefined, "editor", "emacs"));
			assert.strictEqual(edited.stringify(), "[core]\n\tEditor = emacs\n");
		});

		it("set on a bare boolean-true key inserts an explicit value", () => {
			const doc = parse("[feature]\n\tenabled\n");
			const edited = ok(doc.set("feature", undefined, "enabled", "false"));
			assert.strictEqual(edited.stringify(), "[feature]\n\tenabled = false\n");
		});

		it("set replaces the LAST occurrence of a multi-valued key", () => {
			const doc = parse("[a]\n\tk = one\n\tk = two\n");
			const edited = ok(doc.set("a", undefined, "k", "three"));
			assert.strictEqual(edited.stringify(), "[a]\n\tk = one\n\tk = three\n");
		});

		it("set appends to the section when the key is absent, matching its indentation", () => {
			const doc = parse("[core]\n    bare = false\n");
			const edited = ok(doc.set("core", undefined, "editor", "vim"));
			assert.strictEqual(edited.stringify(), "[core]\n    bare = false\n    editor = vim\n");
		});

		it("set creates the section at EOF when none matches", () => {
			const doc = parse("[core]\n\tbare = false\n");
			const edited = ok(doc.set("submodule", "lib", "path", "lib"));
			assert.strictEqual(edited.stringify(), '[core]\n\tbare = false\n[submodule "lib"]\n\tpath = lib\n');
		});

		it("set quotes values that need quoting", () => {
			const doc = parse("[a]\n\tk = v\n");
			assert.strictEqual(ok(doc.set("a", undefined, "k", "has # hash")).stringify(), '[a]\n\tk = "has # hash"\n');
			assert.strictEqual(ok(doc.set("a", undefined, "k", " padded ")).stringify(), '[a]\n\tk = " padded "\n');
			assert.strictEqual(ok(doc.set("a", undefined, "k", "")).stringify(), '[a]\n\tk = ""\n');
			assert.strictEqual(ok(doc.set("a", undefined, "k", "tab\there")).stringify(), '[a]\n\tk = "tab\\there"\n');
		});

		it("a written value round-trips through parse", () => {
			const hostile = ' spaced "quoted" \\slashed\ttabbed\nnewlined ';
			const doc = ok(parse("").set("test", undefined, "value", hostile));
			assert.deepStrictEqual(parse(doc.stringify()).get("test", undefined, "value"), O.some(hostile));
		});

		it("append adds a second value after the last occurrence", () => {
			const doc = parse('[remote "origin"]\n\tfetch = one\n\turl = u\n');
			const edited = ok(doc.append("remote", "origin", "fetch", "two"));
			assert.strictEqual(edited.stringify(), '[remote "origin"]\n\tfetch = one\n\tfetch = two\n\turl = u\n');
		});

		it("unset removes only the last occurrence", () => {
			const doc = parse("[a]\n\tk = one\n\tk = two\n\tother = x\n");
			const edited = ok(doc.unset("a", undefined, "k"));
			assert.strictEqual(edited.stringify(), "[a]\n\tk = one\n\tother = x\n");
		});

		it("unsetAll removes every occurrence across duplicate sections", () => {
			const doc = parse("[a]\n\tk = one\n[a]\n\tk = two\n\tother = x\n");
			const edited = ok(doc.unsetAll("a", undefined, "k"));
			assert.strictEqual(edited.stringify(), "[a]\n[a]\n\tother = x\n");
		});

		it("unset on a missing key or section fails typed", () => {
			const doc = parse("[a]\n\tk = v\n");
			const missingKey = doc.unset("a", undefined, "nope");
			assert.isTrue(Result.isFailure(missingKey));
			if (Result.isFailure(missingKey)) {
				assert.strictEqual(missingKey.failure.reason, "missingKey");
			}
			const missingSection = doc.unset("b", undefined, "k");
			assert.isTrue(Result.isFailure(missingSection));
			if (Result.isFailure(missingSection)) {
				assert.strictEqual(missingSection.failure.reason, "missingSection");
			}
		});

		it("addSection appends an empty section, quoting the subsection", () => {
			const doc = parse("[core]\n\tbare = false\n");
			const edited = ok(doc.addSection("submodule", 'we"ird\\name'));
			assert.strictEqual(edited.stringify(), '[core]\n\tbare = false\n[submodule "we\\"ird\\\\name"]\n');
			assert.deepStrictEqual(parse(edited.stringify()).sections[1]?.subsection, 'we"ird\\name');
		});

		it("removeSection removes every matching section span, comments included", () => {
			const doc = parse("[a]\n\tk = 1\n[b]\n\t# doomed\n\tx = y\n[a]\n\tk = 2\n[b]\n\tz = w\n");
			const edited = ok(doc.removeSection("b", undefined));
			assert.strictEqual(edited.stringify(), "[a]\n\tk = 1\n[a]\n\tk = 2\n");
		});

		it("renameSection rewrites only the headers, bodies untouched", () => {
			const doc = parse('[submodule "old"]\n\tpath = p # keep\n[other]\n\tx = y\n[submodule "old"]\n\turl = u\n');
			const edited = ok(doc.renameSection("submodule", "old", "submodule", "new"));
			assert.strictEqual(
				edited.stringify(),
				'[submodule "new"]\n\tpath = p # keep\n[other]\n\tx = y\n[submodule "new"]\n\turl = u\n',
			);
		});

		it("renaming a deprecated dotted section normalizes to the quoted form", () => {
			const doc = parse("[branch.master]\n\tremote = origin\n");
			const edited = ok(doc.renameSection("branch", "master", "branch", "main"));
			assert.strictEqual(edited.stringify(), '[branch "main"]\n\tremote = origin\n');
		});

		it("a dotted section NAME is refused on every write — it could never round-trip", () => {
			// The scanner splits any unquoted dot in a header at the first dot
			// (the deprecated [section.subsection] form), so `addSection("a.b")`
			// would serialize `[a.b]` and re-parse as section "a" subsection "b" —
			// an address the caller could never match again (and a repeated
			// `set("x.y", ...)` would append duplicate sections forever). Address
			// the dotted form as (name, subsection) instead.
			const doc = parse("");
			for (const attempt of [
				doc.addSection("a.b", undefined),
				doc.set("x.y", undefined, "k", "v"),
				doc.append("x.y", undefined, "k", "v"),
				parse("[a]\n").renameSection("a", undefined, "a.b", undefined),
			]) {
				assert.isTrue(Result.isFailure(attempt));
				if (Result.isFailure(attempt)) {
					assert.strictEqual(attempt.failure.reason, "invalidSectionName");
				}
			}
			// The same address expressed as (name, subsection) works and round-trips.
			const edited = ok(doc.addSection("a", "b"));
			assert.strictEqual(edited.stringify(), '[a "b"]\n');
			assert.deepStrictEqual(ok(edited.set("a", "b", "k", "v")).get("a", "b", "k"), O.some("v"));
		});

		it("invalid names and values are refused typed", () => {
			const doc = parse("[a]\n\tk = v\n");
			const badSection = doc.set("no spaces", undefined, "k", "v");
			assert.isTrue(Result.isFailure(badSection));
			if (Result.isFailure(badSection)) assert.strictEqual(badSection.failure.reason, "invalidSectionName");
			const badKey = doc.set("a", undefined, "1bad", "v");
			assert.isTrue(Result.isFailure(badKey));
			if (Result.isFailure(badKey)) assert.strictEqual(badKey.failure.reason, "invalidKey");
			const badSub = doc.set("a", "line\nbreak", "k", "v");
			assert.isTrue(Result.isFailure(badSub));
			if (Result.isFailure(badSub)) assert.strictEqual(badSub.failure.reason, "invalidSubsection");
			const badValue = doc.set("a", undefined, "k", "nul\0byte");
			const isFailure = Result.isFailure(badValue);
			assertTrue(isFailure);
			if (Result.isFailure(badValue)) assert.strictEqual(badValue.failure.reason, "invalidValue");
			assert.instanceOf(badValue.failure, GitConfigEditError);
		});

		it("a hand-built GitConfig over unparseable text dies as a defect, not a typed error", () => {
			const bogus = GitConfig.make({ text: "[unclosed\n", sections: [] });
			assert.throws(() => bogus.get("a", undefined, "k"), /invariant/);
		});
	});
});
