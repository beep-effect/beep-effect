// TomlDocument: the lossless document class. The headline contract is the
// byte-exact round-trip — stringify() reconstructs the source by
// concatenating expression spans in order, proven byte-for-byte across every
// valid corpus fixture (CRLF files included). Semantic violations surface as
// diagnostics data on a successful parse; only lex/parse errors fail typed.

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { assert, describe, it } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { Toml, TomlParseError } from "../../effected/toml/Toml.ts";
import { TomlDocument } from "../../effected/toml/TomlDocument.ts";
import { TomlInteger, TomlKey, TomlKeyValue } from "../../effected/toml/TomlNode.ts";

const CORPUS_VALID = resolve(import.meta.dirname, "fixtures/toml-test/valid");

// Count recorded in the fixture README — guards against a silently-empty walk.
const README_VALID_COUNT = 214;

/** All `.toml` files under `root`, as sorted paths relative to `root`. */
function walkTomlFiles(root: string): ReadonlyArray<string> {
	return readdirSync(root, { recursive: true, encoding: "utf8" })
		.filter((entry) => entry.endsWith(".toml"))
		.map((entry) => entry.replaceAll("\\", "/"))
		.sort();
}

const validCases = walkTomlFiles(CORPUS_VALID);

const MIXED = [
	"# top-level comment",
	"",
	'title = "example"',
	"[owner]",
	'name = "Tom"   # trailing comment',
	"dob = 1979-05-27T07:32:00-08:00",
	"",
	"[servers.alpha]",
	'ip = "10.0.0.1"',
	"ports = [ 8000, 8001,",
	"          8002 ]",
	"",
	"[[products]]",
	'name = "Hammer"',
	"point = { x = 1, y = 2 }",
	"",
].join("\n");

describe("TomlDocument", () => {
	describe("parse", () => {
		it.effect("a mixed document round-trips byte-exact with empty diagnostics", () =>
			Effect.gen(function* () {
				const doc = yield* TomlDocument.parse(MIXED);
				assert.strictEqual(doc.stringify(), MIXED);
				assert.strictEqual(doc.source, MIXED);
				assert.deepStrictEqual(doc.diagnostics, []);
				const value = yield* doc.toValue();
				const expected = yield* Toml.parse(MIXED);
				assert.deepStrictEqual(value, expected);
			}),
		);

		it.effect("a semantically invalid document parses with the violation as data", () =>
			Effect.gen(function* () {
				const doc = yield* TomlDocument.parse("a=1\na=2\n");
				assert.strictEqual(doc.diagnostics.length, 1);
				assert.strictEqual(doc.diagnostics[0]?.code, "DuplicateKey");
				// The document is still lossless and editable.
				assert.strictEqual(doc.stringify(), "a=1\na=2\n");
				// toValue refuses: it fails with the stored diagnostics.
				const error = yield* Effect.flip(doc.toValue());
				assert.instanceOf(error, TomlParseError);
				assert.deepStrictEqual(error.diagnostics, doc.diagnostics);
			}),
		);

		it.effect("a syntactically invalid document fails typed", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(TomlDocument.parse("a = [1\n"));
				assert.instanceOf(error, TomlParseError);
			}),
		);

		it.effect("a nesting-depth bomb fails typed, not as data or a defect", () =>
			Effect.gen(function* () {
				const bomb = `a = ${"[".repeat(300)}${"]".repeat(300)}\n`;
				const error = yield* Effect.flip(TomlDocument.parse(bomb));
				assert.instanceOf(error, TomlParseError);
				assert.strictEqual(error.diagnostics[0]?.code, "NestingDepthExceeded");
			}),
		);
	});

	describe("stringify", () => {
		it("concatenates expression spans rather than echoing the source", () => {
			// A synthetic document whose single expression span deliberately does
			// NOT tile the whole source: only span concatenation can produce
			// "a=1\n" — a `return this.source` cheat would leak the GARBAGE tail.
			const doc = TomlDocument.make({
				source: "a=1\nGARBAGE",
				expressions: [
					TomlKeyValue.make({
						keyPath: [TomlKey.make({ value: "a", kind: "bare", offset: 0, length: 1 })],
						value: TomlInteger.make({ value: 1, offset: 2, length: 1 }),
						offset: 0,
						length: 4,
					}),
				],
				diagnostics: [],
			});
			assert.strictEqual(doc.stringify(), "a=1\n");
			assert.notStrictEqual(doc.stringify(), doc.source);
		});
	});

	describe("schema", () => {
		const codec = TomlDocument.schema();

		it.effect("decodes TOML text into a TomlDocument", () =>
			Effect.gen(function* () {
				const doc = yield* Schema.decodeUnknownEffect(codec)('a = "b"\n');
				assert.instanceOf(doc, TomlDocument);
				assert.strictEqual(doc.source, 'a = "b"\n');
				const value = yield* doc.toValue();
				assert.deepStrictEqual(value, { a: "b" });
			}),
		);

		it.effect("encodes a TomlDocument back to the same text", () =>
			Effect.gen(function* () {
				const doc = yield* TomlDocument.parse(MIXED);
				const encoded = yield* Schema.encodeUnknownEffect(codec)(doc);
				assert.strictEqual(encoded, MIXED);
			}),
		);

		it.effect("a failing decode surfaces a SchemaError carrying the parse message", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(Schema.decodeUnknownEffect(codec)("a = [1\n"));
				assert.include(String(error), "TOML parse failed");
			}),
		);
	});

	describe("corpus round-trip", () => {
		it("discovers the full valid corpus", () => {
			assert.isAtLeast(validCases.length, README_VALID_COUNT, "valid corpus walk came up short");
		});

		for (const relPath of validCases) {
			it.effect(relPath, () =>
				Effect.gen(function* () {
					const source = readFileSync(join(CORPUS_VALID, relPath), "utf8");
					const doc = yield* TomlDocument.parse(source);
					assert.strictEqual(doc.stringify(), source, "span concatenation must reproduce the source byte-for-byte");
					assert.deepStrictEqual(doc.diagnostics, []);
				}),
			);
		}
	});
});
