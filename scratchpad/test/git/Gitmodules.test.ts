import { assert, describe, it } from "@effect/vitest";
import { Effect, Result, Schema } from "effect";
import { GitConfig } from "../../effected/git/GitConfig.ts";
import type { GitmodulesDecodeError, GitmodulesParseError } from "../../effected/git/Gitmodules.ts";
import { Gitmodules, GitmodulesEntry } from "../../effected/git/Gitmodules.ts";

/** Unwraps a successful Result or fails the test with the failure's message. */
const ok = <A, E>(result: Result.Result<A, E>): A => {
	if (Result.isFailure(result)) {
		assert.fail(`expected success, got failure: ${String(result.failure)}`);
	}
	assert.isTrue(Result.isSuccess(result));
	return (result as Result.Success<A, E>).success;
};

const decodeFailure = (text: string): GitmodulesParseError => {
	const result = Gitmodules.parseResult(text);
	assert.isTrue(Result.isFailure(result), "expected a decode failure");
	return (result as Result.Failure<Gitmodules, GitmodulesParseError>).failure;
};

const REAL_WORLD = `# vendored reference repos
[submodule ".repos/effect"]
	path = .repos/effect
	url = https://github.com/Effect-TS/effect.git
	shallow = true
	branch = main
[submodule "docs"]
	path = vendor/docs
	url = ../docs.git
	update = none
	ignore = dirty
	fetchRecurseSubmodules = on-demand
`;

describe("Gitmodules", () => {
	describe("decode", () => {
		it("decodes a real-world document into typed entries, in order", () => {
			const modules = ok(Gitmodules.parseResult(REAL_WORLD));
			assert.strictEqual(modules.entries.length, 2);
			assert.deepStrictEqual(
				modules.entries[0],
				GitmodulesEntry.make({
					name: ".repos/effect",
					path: ".repos/effect",
					url: "https://github.com/Effect-TS/effect.git",
					shallow: true,
					branch: "main",
				}),
			);
			assert.deepStrictEqual(
				modules.entries[1],
				GitmodulesEntry.make({
					name: "docs",
					path: "vendor/docs",
					url: "../docs.git",
					update: "none",
					ignore: "dirty",
					fetchRecurseSubmodules: "on-demand",
				}),
			);
		});

		it("absent optional fields are ABSENT keys, not undefined values", () => {
			const modules = ok(Gitmodules.parseResult('[submodule "a"]\n\tpath = a\n\turl = u\n'));
			const entry = modules.entries[0];
			assert.isDefined(entry);
			assert.isFalse(Object.hasOwn(entry ?? {}, "branch"));
			assert.isFalse(Object.hasOwn(entry ?? {}, "shallow"));
		});

		it("git's boolean vocabulary decodes for shallow, including the bare shorthand", () => {
			const cases: ReadonlyArray<readonly [string, boolean]> = [
				["shallow = true", true],
				["shallow = YES", true],
				["shallow = on", true],
				["shallow = 1", true],
				["shallow", true],
				["shallow = false", false],
				["shallow = no", false],
				["shallow = off", false],
				["shallow = 0", false],
				["shallow =", false],
			];
			for (const [line, expected] of cases) {
				const modules = ok(Gitmodules.parseResult(`[submodule "a"]\n\tpath = a\n\turl = u\n\t${line}\n`));
				assert.strictEqual(modules.entries[0]?.shallow, expected, line);
			}
		});

		it("fetchRecurseSubmodules decodes booleans and on-demand", () => {
			const text = (value: string): string =>
				`[submodule "a"]\n\tpath = a\n\turl = u\n\tfetchRecurseSubmodules = ${value}\n`;
			assert.strictEqual(ok(Gitmodules.parseResult(text("true"))).entries[0]?.fetchRecurseSubmodules, true);
			assert.strictEqual(ok(Gitmodules.parseResult(text("on-demand"))).entries[0]?.fetchRecurseSubmodules, "on-demand");
			assert.strictEqual(ok(Gitmodules.parseResult(text("false"))).entries[0]?.fetchRecurseSubmodules, false);
		});

		it("duplicate sections for one name merge with last-wins", () => {
			const modules = ok(
				Gitmodules.parseResult('[submodule "a"]\n\tpath = first\n\turl = u\n[submodule "a"]\n\tpath = second\n'),
			);
			assert.strictEqual(modules.entries.length, 1);
			assert.strictEqual(modules.entries[0]?.path, "second");
		});

		it("submodule names are case-sensitive — Alpha and alpha are distinct", () => {
			const modules = ok(
				Gitmodules.parseResult(
					'[submodule "Alpha"]\n\tpath = a\n\turl = u\n[submodule "alpha"]\n\tpath = b\n\turl = v\n',
				),
			);
			assert.strictEqual(modules.entries.length, 2);
		});

		it("a section without a subsection is not a submodule entry", () => {
			const modules = ok(Gitmodules.parseResult("[submodule]\n\tpath = a\n"));
			assert.strictEqual(modules.entries.length, 0);
		});

		it("missing path and missing url fail typed, naming the entry", () => {
			const noPath = decodeFailure('[submodule "a"]\n\turl = u\n');
			assert.strictEqual(noPath._tag, "GitmodulesDecodeError");
			assert.strictEqual((noPath as GitmodulesDecodeError).reason, "missingPath");
			assert.strictEqual((noPath as GitmodulesDecodeError).name, "a");
			const noUrl = decodeFailure('[submodule "a"]\n\tpath = p\n');
			assert.strictEqual((noUrl as GitmodulesDecodeError).reason, "missingUrl");
		});

		it("an undecodable ignore or shallow value fails typed with the offending value", () => {
			const badIgnore = decodeFailure('[submodule "a"]\n\tpath = p\n\turl = u\n\tignore = bogus\n');
			assert.strictEqual((badIgnore as GitmodulesDecodeError).reason, "invalidValue");
			assert.strictEqual((badIgnore as GitmodulesDecodeError).field, "ignore");
			assert.strictEqual((badIgnore as GitmodulesDecodeError).value, "bogus");
			const badShallow = decodeFailure('[submodule "a"]\n\tpath = p\n\turl = u\n\tshallow = maybe\n');
			assert.strictEqual((badShallow as GitmodulesDecodeError).reason, "invalidValue");
		});

		it("malformed git-config text surfaces the underlying parse error", () => {
			const error = decodeFailure('[submodule "unclosed\n');
			assert.strictEqual(error._tag, "GitConfigParseError");
		});

		it.effect("the Effect form derives from parseResult behind its span", () =>
			Effect.gen(function* () {
				const modules = yield* Gitmodules.parse(REAL_WORLD);
				assert.strictEqual(modules.entries.length, 2);
				const error = yield* Effect.flip(Gitmodules.parse('[submodule "a"]\n\turl = u\n'));
				assert.strictEqual(error._tag, "GitmodulesDecodeError");
			}),
		);
	});

	describe("FromString codec", () => {
		it.effect("decodes text and re-encodes the canonical document", () =>
			Effect.gen(function* () {
				const modules = yield* Schema.decodeEffect(Gitmodules.FromString)(REAL_WORLD);
				assert.strictEqual(modules.entries.length, 2);
				const encoded = yield* Schema.encodeUnknownEffect(Gitmodules.FromString)(modules);
				// Canonical rendering, then a decode of it, must agree with the original decode.
				const again = yield* Schema.decodeEffect(Gitmodules.FromString)(encoded);
				assert.deepStrictEqual(again, modules);
			}),
		);

		it.effect("a malformed document fails schema decode", () =>
			Effect.gen(function* () {
				const exit = yield* Effect.result(Schema.decodeEffect(Gitmodules.FromString)('[submodule "a"]\n'));
				assert.isTrue(Result.isFailure(exit));
			}),
		);
	});

	describe("stringify", () => {
		it("renders the canonical document with quoting where needed", () => {
			const modules = Gitmodules.make({
				entries: [
					GitmodulesEntry.make({
						name: "with space",
						path: "a path",
						branch: "release # 1",
						url: "https://example.com/r.git",
						shallow: false,
					}),
				],
			});
			// Internal whitespace needs no quoting in git-config; a comment
			// character does.
			assert.strictEqual(
				modules.stringify(),
				'[submodule "with space"]\n\tpath = a path\n\turl = https://example.com/r.git\n\tbranch = "release # 1"\n\tshallow = false\n',
			);
		});

		it("renders nothing for zero entries", () => {
			assert.strictEqual(Gitmodules.make({ entries: [] }).stringify(), "");
		});

		it("a hand-built entry name with a newline is refused at construction — render cannot emit a broken document", () => {
			// serializeHeader escapes only `"` and `\` (git's subsection grammar
			// has no newline escape), so a name containing a line break would
			// serialize across lines and not re-decode to the same entries. The
			// constructor refuses it, matching GitConfig.addSection's [\n\r\0]
			// subsection refusal. v4 constructors validate, so this throws.
			for (const name of ['"]\nurl = evil\n[x "', "cr\rbad", "nul\0bad"]) {
				assert.throws(() => GitmodulesEntry.make({ name, path: "p", url: "u" }));
			}
		});
	});

	describe("entry-level mutations compile to surgical GitConfig edits", () => {
		const doc = ok(GitConfig.parseResult(REAL_WORLD));

		it("setUrl rewrites only the url value — comments and formatting survive", () => {
			const edited = ok(Gitmodules.setUrl(doc, ".repos/effect", "https://github.com/effect-ts/effect.git"));
			assert.strictEqual(
				edited.stringify(),
				REAL_WORLD.replace("https://github.com/Effect-TS/effect.git", "https://github.com/effect-ts/effect.git"),
			);
			// The leading comment is untouched — the edit was surgical.
			assert.isTrue(edited.stringify().startsWith("# vendored reference repos\n"));
		});

		it("setBranch sets, and unsets when omitted", () => {
			const set = ok(Gitmodules.setBranch(doc, "docs", "v2"));
			assert.include(set.stringify(), "\tbranch = v2\n");
			const unset = ok(Gitmodules.setBranch(set, "docs"));
			assert.notInclude(unset.stringify(), "branch = v2");
		});

		it("setShallow writes booleans as git spells them", () => {
			const edited = ok(Gitmodules.setShallow(doc, "docs", true));
			assert.include(edited.stringify(), "\tshallow = true\n");
		});

		it("setPath rewrites the path in place", () => {
			const edited = ok(Gitmodules.setPath(doc, "docs", "vendor/docs2"));
			assert.include(edited.stringify(), "\tpath = vendor/docs2\n");
			assert.notInclude(edited.stringify(), "\tpath = vendor/docs\n\turl");
		});

		it("add appends a canonical section and the document re-decodes with the new entry", () => {
			const entry = GitmodulesEntry.make({
				name: "new",
				path: "vendor/new",
				url: "https://example.com/new.git",
				shallow: true,
				fetchRecurseSubmodules: "on-demand",
			});
			const edited = ok(Gitmodules.add(doc, entry));
			const decoded = ok(Gitmodules.fromConfigResult(edited));
			assert.strictEqual(decoded.entries.length, 3);
			assert.deepStrictEqual(decoded.entries[2], entry);
			// The pre-existing text is untouched.
			assert.isTrue(edited.stringify().startsWith(REAL_WORLD));
		});

		it("remove deletes the named section only", () => {
			const edited = ok(Gitmodules.remove(doc, "docs"));
			const decoded = ok(Gitmodules.fromConfigResult(edited));
			assert.strictEqual(decoded.entries.length, 1);
			assert.strictEqual(decoded.entries[0]?.name, ".repos/effect");
		});

		it("remove of an unknown name fails typed", () => {
			const missing = Gitmodules.remove(doc, "nope");
			assert.isTrue(Result.isFailure(missing));
			if (Result.isFailure(missing)) {
				assert.strictEqual(missing.failure.reason, "missingSection");
			}
		});

		it("rename rewrites the header and leaves the body bytes alone", () => {
			const edited = ok(Gitmodules.rename(doc, "docs", "documentation"));
			assert.include(edited.stringify(), '[submodule "documentation"]\n\tpath = vendor/docs\n');
			const decoded = ok(Gitmodules.fromConfigResult(edited));
			assert.strictEqual(decoded.entries[1]?.name, "documentation");
			assert.strictEqual(decoded.entries[1]?.path, "vendor/docs");
		});
	});

	describe("JSON Schema export", () => {
		it("GitmodulesEntry exports its name pattern", () => {
			const document = Schema.toJsonSchemaDocument(GitmodulesEntry);
			assert.nestedPropertyVal(
				document,
				"definitions.GitmodulesEntryEncoded.properties.name.pattern",
				String.raw`^[^\n\r\0]*$`,
			);
		});
	});
});
