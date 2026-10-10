// @effect-diagnostics nodeBuiltinImport:skip-file
import { readFileSync } from "node:fs";
import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure, assertExitSuccess, assertFailure } from "@effect/vitest/utils";
import * as P from "effect/Predicate";
import * as Effect from "effect/Effect";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import {
	Yaml,
	YamlDocument,
	YamlFormat,
	YamlMap,
	YamlParseError,
	YamlParseOptions,
	YamlScalar,
	YamlStringifyError,
	YamlStringifyOptions,
} from "../../effected/yaml/index.ts";
import { deliberatelyInvalid } from "./deliberatelyInvalid.ts";

const JsonString = S.fromJsonString(S.String);

describe("Yaml", () => {
	describe("parse", () => {
		it.effect("parses mappings, sequences and scalars", () =>
			Effect.gen(function* () {
				const value = yield* Yaml.parse("name: Alice\nage: 30\ntags:\n  - a\n  - b");
				assert.deepStrictEqual(value, { name: "Alice", age: 30, tags: ["a", "b"] });
			}),
		);

		it.effect("resolves anchors and aliases to the most recent definition", () =>
			Effect.gen(function* () {
				const value = yield* Yaml.parse("base: &x 1\nref: *x");
				assert.deepStrictEqual(value, { base: 1, ref: 1 });
			}),
		);

		it.effect("returns null for empty input", () =>
			Effect.gen(function* () {
				assert.isNull(yield* Yaml.parse(""));
			}),
		);

		it.effect("fails with an aggregate YamlParseError carrying positioned diagnostics", () =>
			Effect.gen(function* () {
				const error = yield* Effect.matchEffect(Yaml.parse("a: *missing"), { onFailure: Effect.succeed, onSuccess: Effect.die });
				assert.instanceOf(error, YamlParseError);
				assert.strictEqual(error._tag, "YamlParseError");
				assert.isAbove(error.diagnostics.length, 0);
				assert.strictEqual(error.input, "a: *missing");
				const d = error.diagnostics[0];
				assert.ok(d !== undefined);
				assert.strictEqual(d.code, "UndefinedAlias");
				assert.strictEqual(d.line, 0);
				assert.isAtLeast(d.character, 0);
				assert.include(error.message, "UndefinedAlias");
			}),
		);

		it.effect("renders the message position 1-based while the diagnostic fields stay 0-based", () =>
			Effect.gen(function* () {
				const e = yield* Effect.matchEffect(Yaml.parse("a: *missing"), { onFailure: Effect.succeed, onSuccess: Effect.die });
				const d = e.diagnostics[0];
				assert.ok(d !== undefined);
				assert.strictEqual(d.code, "UndefinedAlias");
				assert.strictEqual(d.line, 0);
				assert.strictEqual(d.character, 3);
				assert.include(e.message, "UndefinedAlias at 1:4");
				assert.notInclude(e.message, "at 0:3");
				const dup = yield* Effect.matchEffect(Yaml.parse("a: 1\na: 2"), { onFailure: Effect.succeed, onSuccess: Effect.die });
				const duplicate = dup.diagnostics[0];
				assert.ok(duplicate !== undefined);
				assert.strictEqual(duplicate.code, "DuplicateKey");
				assert.strictEqual(duplicate.line, 1);
				assert.strictEqual(duplicate.character, 0);
				assert.include(dup.message, "DuplicateKey at 2:1");
			}),
		);

		it.effect("promotes duplicate keys to failure under the default uniqueKeys", () =>
			Effect.gen(function* () {
				const error = yield* Effect.matchEffect(Yaml.parse("a: 1\na: 2"), { onFailure: Effect.succeed, onSuccess: Effect.die });
				assert.isTrue(error.diagnostics.some((d) => d.code === "DuplicateKey"));
				const value = yield* Yaml.parse("a: 1\na: 2", { uniqueKeys: false });
				assert.deepStrictEqual(value, { a: 2 });
			}),
		);

		describe("explicit keys with compact collection values (regression)", () => {
			// YAML 1.2 §8.2.2: l-block-map-explicit-value is `:` s-l+block-indented,
			// and s-l+block-indented admits ns-l-compact-mapping — so a compact
			// mapping starting on the `:` line IS the value. pnpm 11 writes lockfile
			// snapshot keys longer than 1024 chars in exactly this form.
			it.effect("parses a compact mapping starting on the ':' line", () =>
				Effect.gen(function* () {
					const value = yield* Yaml.parse("? k1\n: dependencies:\n    x: 1\n");
					assert.deepStrictEqual(value, { k1: { dependencies: { x: 1 } } });
				}),
			);

			it.effect("parses two explicit entries with compact-mapping values", () =>
				Effect.gen(function* () {
					const value = yield* Yaml.parse("? k1\n: dependencies:\n    x: 1\n? k2\n: dependencies:\n    y: 2\n");
					assert.deepStrictEqual(value, {
						k1: { dependencies: { x: 1 } },
						k2: { dependencies: { y: 2 } },
					});
				}),
			);

			it.effect("parses two explicit entries with single-pair compact-mapping values", () =>
				Effect.gen(function* () {
					const value = yield* Yaml.parse("? k1\n: x: 1\n? k2\n: y: 2\n");
					assert.deepStrictEqual(value, { k1: { x: 1 }, k2: { y: 2 } });
				}),
			);

			it.effect("parses two explicit entries whose mapping values start on the next line", () =>
				Effect.gen(function* () {
					const value = yield* Yaml.parse("? k1\n:\n  dependencies:\n    x: 1\n? k2\n:\n  dependencies:\n    y: 2\n");
					assert.deepStrictEqual(value, {
						k1: { dependencies: { x: 1 } },
						k2: { dependencies: { y: 2 } },
					});
				}),
			);

			it.effect("still parses a compact sequence starting on the ':' line", () =>
				Effect.gen(function* () {
					const value = yield* Yaml.parse("? k1\n: - a\n  - b\n");
					assert.deepStrictEqual(value, { k1: ["a", "b"] });
				}),
			);

			it.effect("still parses explicit keys with scalar values", () =>
				Effect.gen(function* () {
					const value = yield* Yaml.parse("? alpha\n: 1\n? beta\n: 2\n");
					assert.deepStrictEqual(value, { alpha: 1, beta: 2 });
				}),
			);

			it.effect("parses a pnpm-lockfile-shaped snapshots section with >1024-char explicit keys", () =>
				Effect.gen(function* () {
					// pnpm emits `? 'key'` / `  : dependencies:` once the key exceeds
					// the 1024-char implicit-key limit; the whole entry is indented
					// inside the `snapshots:` mapping.
					const k1 = `pkg-a@1.0.0(${"a".repeat(1100)})`;
					const k2 = `pkg-b@2.0.0(${"b".repeat(1100)})`;
					const text = [
						"snapshots:",
						`  ? '${k1}'`,
						"  : dependencies:",
						"      dep-one: 1.2.3",
						"      dep-two: 4.5.6",
						`  ? '${k2}'`,
						"  : dependencies:",
						"      dep-three: 7.8.9",
						"",
					].join("\n");
					const value = yield* Yaml.parse(text);
					assert.deepStrictEqual(value, {
						snapshots: {
							[k1]: { dependencies: { "dep-one": "1.2.3", "dep-two": "4.5.6" } },
							[k2]: { dependencies: { "dep-three": "7.8.9" } },
						},
					});
				}),
			);
		});

		describe("duplicate-key identity distinguishes YAML node type, not just JS value", () => {
			// Keys are the same mapping key only when they are the same YAML node —
			// same type and value. An !!int and an !!float that resolve to equal JS
			// numbers are distinct keys; different presentations of the same !!int
			// are the same key.
			const rejects = [
				["equal integers written differently", "{1: a, 0x1: b}"], // both !!int 1
				["equal integers, decimal vs octal", "{8: a, 0o10: b}"], // both !!int 8
				["the same float twice", "{1.5: a, 1.5: b}"],
				["the same string twice", "{k: a, k: b}"],
				["string vs quoted string", '{k: a, "k": b}'],
			] as const;
			for (const [label, doc] of rejects) {
				it.effect(`rejects ${label}`, () =>
					Effect.gen(function* () {
						const error = yield* Effect.matchEffect(Yaml.parse(doc), { onFailure: Effect.succeed, onSuccess: Effect.die });
						assert.isTrue(
							error.diagnostics.some((d) => d.code === "DuplicateKey"),
							doc,
						);
					}),
				);
			}

			// These resolve to distinct YAML nodes, so the parse must NOT reject
			// them as duplicate keys — even where the lossy JS object then collapses
			// them onto one property (int vs float, int vs string).
			const accepts = [
				["int vs float, unit value", "{1: a, 1.0: b}"],
				["int vs float via exponent", "{1000: a, 1e3: b}"],
				["int vs string of the same digits", '{1: a, "1": b}'],
				["float vs a different float", "{1.5: a, 2.5: b}"],
			] as const;
			for (const [label, doc] of accepts) {
				it.effect(`accepts ${label}`, () =>
					Effect.gen(function* () {
						const result = yield* Yaml.parse(doc).pipe(Effect.asVoid, Effect.exit);
						assertExitSuccess(result, undefined);
					}),
				);
			}

			it.effect("an int and a float key with equal JS value are not a duplicate", () =>
				Effect.gen(function* () {
					const value = (yield* Yaml.parse("{1: int, 1.0: float}"));
					assert.ok(P.isObject(value));
					// The lossy JS object collapses both onto the "1" property (last
					// wins), but the parse itself must not have rejected the document.
					assert.strictEqual(value["1"], "float");
				}),
			);
		});

		it.effect("rejects trailing top-level content after the document value", () =>
			Effect.gen(function* () {
				const error = yield* Effect.matchEffect(Yaml.parse("a: 1\nb"), { onFailure: Effect.succeed, onSuccess: Effect.die });
				assert.isTrue(error.diagnostics.some((d) => d.code === "UnexpectedToken"));
			}),
		);

		it.effect("enforces the maxAliasCount DoS guard", () =>
			Effect.gen(function* () {
				const text = `x: &a 1\n${Array.from({ length: 5 }, (_, i) => `k${i}: *a`).join("\n")}`;
				const error = yield* Effect.matchEffect(Yaml.parse(text, { maxAliasCount: 3 }), { onFailure: Effect.succeed, onSuccess: Effect.die });
				assert.isTrue(error.diagnostics.some((d) => d.code === "AliasCountExceeded"));
			}),
		);
	});

	describe("leading byte-order mark (#694)", () => {
		it.effect("a BOM does not shift the first line's indentation — every node survives", () =>
			Effect.gen(function* () {
				assert.deepStrictEqual(yield* Yaml.parse("\uFEFFa: 'x'\nb: 1\n"), { a: "x", b: 1 });
				assert.deepStrictEqual(yield* Yaml.parse("\uFEFF- 1\n- 2\n"), [1, 2]);
				assert.deepStrictEqual(yield* Yaml.parse("\uFEFFa: 1\n"), { a: 1 });
			}),
		);

		it.effect("a comment directly after the BOM is a line-start comment, not trailing content", () =>
			Effect.gen(function* () {
				assert.deepStrictEqual(yield* Yaml.parse("\uFEFF# c\na: 'x'\n"), { a: "x" });
			}),
		);

		it.effect("node offsets stay indices into the original text, BOM included", () =>
			Effect.gen(function* () {
				const text = "\uFEFFa: 'x'\nb: 1\n";
				const doc = yield* YamlDocument.parse(text);
				const map = doc.contents;
				assert.instanceOf(map, YamlMap);
				assert.ok(S.is(YamlMap)(map));
				const first = map.items[0]?.value;
				assert.instanceOf(first, YamlScalar);
				assert.ok(S.is(YamlScalar)(first));
				const scalar = first;
				assert.strictEqual(text.slice(scalar.offset, scalar.offset + scalar.length), "'x'");
			}),
		);

		it.effect("a root mapping's terminal own-line comment survives behind a BOM", () =>
			Effect.gen(function* () {
				// The composer's column helpers count the BOM too; with it counted
				// the root mapping reads as nested and its tail comment escapes to
				// document scope, where it is dropped.
				const doc = yield* YamlDocument.parse("\uFEFFa: 1\nb: 2\n# tail\n");
				assert.strictEqual(doc.comment, " tail");
				assert.strictEqual(yield* doc.stringify(), "a: 1\nb: 2\n# tail\n");
			}),
		);
	});

	describe("parseAll", () => {
		it.effect("parses a multi-document stream in order", () =>
			Effect.gen(function* () {
				const values = yield* Yaml.parseAll("name: first\n---\nname: second\n---\nname: third");
				assert.deepStrictEqual(values, [{ name: "first" }, { name: "second" }, { name: "third" }]);
			}),
		);

		it.effect("fails when any document carries a fatal diagnostic", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(Yaml.parseAll("ok: 1\n---\nbad: *missing"));
				assert.isTrue(error.diagnostics.some((d) => d.code === "UndefinedAlias"));
			}),
		);
	});

	describe("parseAllResult (synchronous Result twin of parseAll)", () => {
		it("succeeds with every document's value, in order", () => {
			const result = Yaml.parseAllResult("name: first\n---\nname: second\n---\nname: third\n");
			if (!Result.isSuccess(result)) {
				assert.fail("parseAllResult must succeed on a valid multi-document stream");
			}
			assert.deepStrictEqual(result.success, [{ name: "first" }, { name: "second" }, { name: "third" }]);
		});

		it("fails typed when the SECOND document carries a fatal diagnostic (whole-stream validity)", () => {
			let result: Result.Result<ReadonlyArray<unknown>, YamlParseError> = Result.succeed([]);
			assert.doesNotThrow(() => {
				result = Yaml.parseAllResult("a: 1\n---\nb: *missing\n");
			});
			assertFailure(result, result.pipe(Result.flip, Result.getOrThrow));
			if (!Result.isFailure(result)) return;
			assert.instanceOf(result.failure, YamlParseError);
			assert.isTrue(result.failure.diagnostics.some((d) => d.code === "UndefinedAlias"));
		});

		it("an empty stream succeeds with one empty document, matching parse('')", () => {
			// The engine composes "" as a single empty document (reference-`yaml`
			// parity, and the same reading Yaml.parse gives: "" → null), so the
			// stream form is [null] — success, never a failure.
			const result = Yaml.parseAllResult("");
			if (!Result.isSuccess(result)) {
				assert.fail("parseAllResult must succeed on an empty stream");
			}
			assert.deepStrictEqual(result.success, [null]);
		});

		it("a single document yields a one-element array matching parseResult", () => {
			const text = "name: Alice\nage: 30\n";
			const all = Yaml.parseAllResult(text);
			const one = Yaml.parseResult(text);
			if (!Result.isSuccess(all) || !Result.isSuccess(one)) {
				assert.fail("both parse paths must succeed on a valid single document");
			}
			assert.deepStrictEqual(all.success, [one.success]);
		});

		it.effect("cannot diverge from parseAll — same values, same failure", () =>
			Effect.gen(function* () {
				const valid = "a: &x 1\nb: *x\n---\nc: 2\n";
				const syncResult = Yaml.parseAllResult(valid);
				if (!Result.isSuccess(syncResult)) {
					assert.fail("parseAllResult must succeed on valid input");
				}
				assert.deepStrictEqual(syncResult.success, yield* Yaml.parseAll(valid));

				const invalid = "a: 1\n---\nb: *missing\n";
				const error = yield* Effect.flip(Yaml.parseAll(invalid));
				const sync = Yaml.parseAllResult(invalid);
				if (!Result.isFailure(sync)) {
					assert.fail("parseAllResult must fail when any document is fatal");
				}
				assert.deepStrictEqual(
					sync.failure.diagnostics.map((d) => d.code),
					error.diagnostics.map((d) => d.code),
				);
			}),
		);

		it("anchors are document-scoped — an alias cannot reach a previous document's anchor", () => {
			const result = Yaml.parseAllResult("a: &shared 1\n---\nb: *shared\n");
			assertFailure(result, result.pipe(Result.flip, Result.getOrThrow));
			if (!Result.isFailure(result)) return;
			assert.isTrue(result.failure.diagnostics.some((d) => d.code === "UndefinedAlias"));
		});

		it("an anchor on a complex mapping key resolves identically to parseResult (incremental registration)", () => {
			// A pre-built anchor map would resolve `*x` to `["k"]` even though
			// extraction never re-registers non-scalar mapping keys; parseResult's
			// incremental registration yields null. The two paths must agree.
			const text = "{ &x [k]: *x }";
			const all = Yaml.parseAllResult(text);
			const one = Yaml.parseResult(text);
			if (!Result.isSuccess(all) || !Result.isSuccess(one)) {
				assert.fail("both parse paths must succeed on a complex-key anchor");
			}
			assert.deepStrictEqual(all.success, [one.success]);
		});

		it("fails on the fatal stream errors the format path refuses — one predicate, one contract", () => {
			// The stream-error filter is isFatalCode, the SAME predicate
			// YamlFormat's refusal uses: parseAllResult can never succeed on
			// input the formatter refuses as stream-fatal.
			const misplaced = "a: 1\n%YAML 1.2\n---\nb: 2\n";
			const result = Yaml.parseAllResult(misplaced);
			assertFailure(result, result.pipe(Result.flip, Result.getOrThrow));
			if (!Result.isFailure(result)) return;
			assert.isTrue(result.failure.diagnostics.some((d) => d.code === "InvalidDirective"));
			assert.deepStrictEqual(YamlFormat.format(misplaced), []);
		});
	});

	describe("stringify", () => {
		it.effect("round-trips plain values", () =>
			Effect.gen(function* () {
				const value = { name: "Alice", nested: { list: [1, 2, true, null] } };
				const text = yield* Yaml.stringify(value);
				assert.deepStrictEqual(yield* Yaml.parse(text), value);
			}),
		);

		it.effect("fails on circular references with structured diagnostics, never a reason string", () =>
			Effect.gen(function* () {
				const value: Record<string, unknown> = {};
				value.self = value;
				const error = yield* Effect.flip(Yaml.stringify(value));
				assert.instanceOf(error, YamlStringifyError);
				assert.strictEqual(error._tag, "YamlStringifyError");
				assert.strictEqual(error.diagnostics[0]?.code, "CircularReference");
				assert.notProperty(error, "reason");
				assert.strictEqual(error.value, value);
			}),
		);

		it.effect("a deeply nested acyclic value fails typed, never a stack-overflow defect", () =>
			Effect.gen(function* () {
				// The value-stringifier trio is mutually recursive with no natural
				// bound; a 50 000-deep acyclic array would overflow the stack as a
				// RangeError defect. The depth cap must surface it on the typed channel.
				let value: unknown = 1;
				for (let i = 0; i < 50000; i++) value = [value];

				const result = yield* Effect.exit(Yaml.stringify(value));
				assertExitFailure(result, result.pipe(Exit.getCause, O.getOrThrow));
				const error = result.cause.pipe(Cause.findError, Result.getOrThrow);
				assert.instanceOf(error, YamlStringifyError);
				assert.strictEqual(error.diagnostics[0]?.code, "NestingDepthExceeded");
			}),
		);

		describe("explicit-key spill past the 1024-char implicit-key limit (#323)", () => {
			// YAML 1.2 §8.1.3: the `:` of an implicit block-mapping key must sit at
			// most 1024 characters after the key's start. A RENDERED key longer than
			// 1024 must spill to explicit-key form (`? key` / `: value`) or strict
			// parsers reject the output. The expected bytes are oracle-authored
			// fixtures (yaml@2.9.0, generated once — see fixtures/explicit-key/
			// ORACLE.md); the reference package is not a dependency of this run.
			const k1 = `pkg-a@1.0.0(${"a".repeat(1100)})`;
			const k2 = `pkg-b@2.0.0(${"b".repeat(1100)})`;
			const fixture = (name: string): string =>
				readFileSync(new URL(`./fixtures/explicit-key/${name}.yaml`, import.meta.url), "utf8");

			// Emit-side twins of PR #322's parse-side compact-value regression
			// cases: every compact form the parser learned to read is a form the
			// emitter is pinned against.
			const cases: ReadonlyArray<[name: string, value: unknown]> = [
				["scalar-value", { [k1]: "value-one" }],
				["null-value", { [k1]: null }],
				["seq-value", { [k1]: ["first", "second"] }],
				["map-value", { [k1]: { dependencies: { "dep-one": "1.2.3", "dep-two": "4.5.6" } } }],
				["single-pair-map-value", { [k1]: { x: 1 } }],
				["two-entries", { [k1]: { x: 1 }, [k2]: { y: 2 } }],
				[
					"pnpm-snapshots",
					{
						snapshots: {
							[k1]: { dependencies: { "dep-one": "1.2.3", "dep-two": "4.5.6" } },
							[k2]: { dependencies: { "dep-three": "7.8.9" } },
						},
					},
				],
				["boundary-1024-implicit", { ["k".repeat(1024)]: 1 }],
				["boundary-1025-explicit", { ["k".repeat(1025)]: 1 }],
			];

			for (const [name, value] of cases) {
				it.effect(`emits the oracle shape and roundtrips: ${name}`, () =>
					Effect.gen(function* () {
						const text = yield* Yaml.stringify(value);
						assert.strictEqual(text, fixture(name));
						// The spilled output must parse back through OUR parser to the
						// same value (PR #322 taught the parser these compact forms).
						assert.deepStrictEqual(yield* Yaml.parse(text), value);
					}),
				);
			}

			it.effect("the threshold applies to the RENDERED key, not the source scalar", () =>
				Effect.gen(function* () {
					// A leading space forces single-quoting under the default
					// quoteStyle, so a 1023-char source key renders as 1025 chars
					// (`'` + 1023 + `'`) and must spill…
					const quoted1025 = ` ${"a".repeat(1022)}`;
					const spilled = yield* Yaml.stringify({ [quoted1025]: 1 });
					assert.isTrue(spilled.startsWith("? '"), "1025-char rendered key must spill");
					assert.deepStrictEqual(yield* Yaml.parse(spilled), { [quoted1025]: 1 });
					// …while a 1022-char source key renders as exactly 1024 chars and
					// stays implicit.
					const quoted1024 = ` ${"a".repeat(1021)}`;
					const implicit = yield* Yaml.stringify({ [quoted1024]: 1 });
					assert.isFalse(implicit.startsWith("? "), "1024-char rendered key stays implicit");
					assert.deepStrictEqual(yield* Yaml.parse(implicit), { [quoted1024]: 1 });
				}),
			);

			it.effect("flow context never spills — only block mappings have implicit-key limits", () =>
				Effect.gen(function* () {
					const long = "f".repeat(1100);
					const text = yield* Yaml.stringify({ [long]: 1 }, { defaultCollectionStyle: "flow" });
					assert.notInclude(text, "? ");
					assert.isTrue(text.startsWith("{"));
					assert.deepStrictEqual(yield* Yaml.parse(text), { [long]: 1 });
				}),
			);

			it.effect("compact continuation alignment is structural — indent: 4 must still roundtrip", () =>
				Effect.gen(function* () {
					// Compact continuation lines align with the first item after
					// `? `/`: `, which always sits two columns in — padding them with
					// ctx.indent instead silently re-nests the value on reparse once
					// indent !== 2. (Deliberate divergence from yaml@2.9.0, whose
					// indent-4 compact output fails its own strict reparse.)
					const seqVal = { [k1]: ["first", "second"] };
					const seqText = yield* Yaml.stringify(seqVal, { indent: 4 });
					assert.include(seqText, ": - first\n  - second");
					assert.deepStrictEqual(yield* Yaml.parse(seqText), seqVal);

					// Flat two-pair map: sibling pairs must align at column 2.
					const mapVal = { [k1]: { "dep-one": "1.2.3", "dep-two": "4.5.6" } };
					const mapText = yield* Yaml.stringify(mapVal, { indent: 4 });
					assert.include(mapText, ": dep-one: 1.2.3\n  dep-two: 4.5.6");
					assert.deepStrictEqual(yield* Yaml.parse(mapText), mapVal);

					// Nested map: children indent relative to the compact column.
					const nestedVal = { [k1]: { dependencies: { x: 1 } } };
					const nestedText = yield* Yaml.stringify(nestedVal, { indent: 4 });
					assert.include(nestedText, ": dependencies:\n      x: 1");
					assert.deepStrictEqual(yield* Yaml.parse(nestedText), nestedVal);
				}),
			);

			it.effect("a long-key entry with a compact sequence value still roundtrips (#322 twin)", () =>
				Effect.gen(function* () {
					// The compact-sequence explicit-value branch is deliberately
					// untouched by `indentSequences`; the spill routes into it.
					const value = { [k1]: ["a", "b"] };
					const spilledDefault = yield* Yaml.stringify(value);
					const spilledIndented = yield* Yaml.stringify(value, { indentSequences: true });
					assert.strictEqual(spilledDefault, spilledIndented);
					assert.deepStrictEqual(yield* Yaml.parse(spilledDefault), value);
				}),
			);
		});

		describe("indentSequences", () => {
			// The `indentSequences: true` expected strings are byte-for-byte the
			// `yaml` npm package's (2.9.0) default (`indentSeq: true`) output for
			// the same values; the kit default (false) preserves the legacy
			// unindented form (byte-compatible with yaml-effect 0.7).
			const indented = YamlStringifyOptions.make({ indentSequences: true });

			it.effect("default leaves a block sequence under a mapping key unindented", () =>
				Effect.gen(function* () {
					assert.strictEqual(yield* Yaml.stringify({ key: ["a", "b"] }), "key:\n- a\n- b\n");
				}),
			);

			it.effect("true indents a block sequence under a mapping key one level", () =>
				Effect.gen(function* () {
					assert.strictEqual(yield* Yaml.stringify({ key: ["a", "b"] }, indented), "key:\n  - a\n  - b\n");
				}),
			);

			it.effect("nested sequence-of-maps renders exactly in both modes", () =>
				Effect.gen(function* () {
					const value = { items: [{ name: "a", value: 1 }, { name: "b" }] };
					assert.strictEqual(
						yield* Yaml.stringify(value, indented),
						"items:\n  - name: a\n    value: 1\n  - name: b\n",
					);
					assert.strictEqual(yield* Yaml.stringify(value), "items:\n- name: a\n  value: 1\n- name: b\n");
				}),
			);

			it.effect("a top-level sequence stays at column zero in both modes", () =>
				Effect.gen(function* () {
					const value = ["a", "b", { k: 1 }];
					const expected = "- a\n- b\n- k: 1\n";
					assert.strictEqual(yield* Yaml.stringify(value), expected);
					assert.strictEqual(yield* Yaml.stringify(value, indented), expected);
				}),
			);

			it.effect("deeper nesting indents each sequence relative to its key", () =>
				Effect.gen(function* () {
					const value = { a: { b: ["x", { c: ["y"] }] } };
					assert.strictEqual(yield* Yaml.stringify(value, indented), "a:\n  b:\n    - x\n    - c:\n        - y\n");
					assert.strictEqual(yield* Yaml.stringify(value), "a:\n  b:\n  - x\n  - c:\n    - y\n");
				}),
			);

			it.effect("sequence-of-sequences under a key keeps compact nested dashes", () =>
				Effect.gen(function* () {
					const value = { k: [["a", "b"], ["c"]] };
					assert.strictEqual(yield* Yaml.stringify(value, indented), "k:\n  - - a\n    - b\n  - - c\n");
				}),
			);

			it.effect("a map with a sequence value inside a sequence item indents relative to the key", () =>
				Effect.gen(function* () {
					const value = [{ key: ["a"] }];
					assert.strictEqual(yield* Yaml.stringify(value, indented), "- key:\n    - a\n");
					assert.strictEqual(yield* Yaml.stringify(value), "- key:\n  - a\n");
				}),
			);
		});

		describe("quoteStyle", () => {
			// The `quoteStyle: "double"` expected strings match the `yaml` npm
			// package's `singleQuote: false` output for the same values; the kit
			// default ("single") preserves the released byte-compatible form.
			const double = YamlStringifyOptions.make({ quoteStyle: "double" });

			it.effect("default falls back to single quotes for a scalar requiring quoting", () =>
				Effect.gen(function* () {
					assert.strictEqual(yield* Yaml.stringify({ version: "*" }), "version: '*'\n");
				}),
			);

			it.effect('"double" falls back to double quotes for a scalar requiring quoting', () =>
				Effect.gen(function* () {
					assert.strictEqual(yield* Yaml.stringify({ version: "*" }, double), 'version: "*"\n');
				}),
			);

			it.effect("a scalar that needs no quoting stays plain under either setting", () =>
				Effect.gen(function* () {
					const value = { name: "alice", count: 3, flag: true };
					const expected = "name: alice\ncount: 3\nflag: true\n";
					assert.strictEqual(yield* Yaml.stringify(value), expected);
					assert.strictEqual(yield* Yaml.stringify(value, double), expected);
				}),
			);

			it.effect("mapping keys requiring quoting honor the option", () =>
				Effect.gen(function* () {
					// The pnpm-workspace.yaml shape from the reported regression: the
					// keys are the scalars that require quoting, not the values.
					const value = {
						allowBuilds: { "@parcel/watcher": true },
						allowedDeprecatedVersions: { "@types/acorn": "*" },
					};
					assert.strictEqual(
						yield* Yaml.stringify(value),
						"allowBuilds:\n  '@parcel/watcher': true\nallowedDeprecatedVersions:\n  '@types/acorn': '*'\n",
					);
					assert.strictEqual(
						yield* Yaml.stringify(value, double),
						'allowBuilds:\n  "@parcel/watcher": true\nallowedDeprecatedVersions:\n  "@types/acorn": "*"\n',
					);
				}),
			);

			it.effect("flow-mapping keys honor the option too", () =>
				Effect.gen(function* () {
					const value = { "@types/acorn": "*" };
					const flow = { defaultCollectionStyle: "flow" as const };
					assert.strictEqual(yield* Yaml.stringify(value, flow), "{'@types/acorn': '*'}\n");
					assert.strictEqual(
						yield* Yaml.stringify(value, { ...flow, quoteStyle: "double" }),
						'{"@types/acorn": "*"}\n',
					);
				}),
			);

			it.effect('an explicit defaultScalarStyle of "single-quoted" still wins', () =>
				Effect.gen(function* () {
					assert.strictEqual(
						yield* Yaml.stringify({ name: "alice" }, { defaultScalarStyle: "single-quoted", quoteStyle: "double" }),
						"name: 'alice'\n",
					);
				}),
			);

			it.effect("a value needing YAML escapes stays double-quoted and round-trips", () =>
				Effect.gen(function* () {
					// Tabs and control characters cannot be expressed in single-quoted
					// YAML, so both settings must emit double-quoted output here.
					const value = { quoted: 'say "hi" now: ok', tabbed: "a\tb: c" };
					const emitted = yield* Yaml.stringify(value, double);
					assert.strictEqual(emitted, 'quoted: "say \\"hi\\" now: ok"\ntabbed: "a\\tb: c"\n');
					assert.deepStrictEqual(yield* Yaml.parse(emitted), value);
				}),
			);

			it.effect("a multi-line value still routes to a block scalar under either setting", () =>
				Effect.gen(function* () {
					const value = { text: "line one\nline two" };
					const expected = "text: |-\n  line one\n  line two\n";
					assert.strictEqual(yield* Yaml.stringify(value), expected);
					assert.strictEqual(yield* Yaml.stringify(value, double), expected);
				}),
			);

			it.effect("round-trips the quoted forms back to the same value", () =>
				Effect.gen(function* () {
					const value = { "@types/acorn": "*", "a: b": " lead", numeric: "123" };
					assert.deepStrictEqual(yield* Yaml.parse(yield* Yaml.stringify(value, double)), value);
					assert.deepStrictEqual(yield* Yaml.parse(yield* Yaml.stringify(value)), value);
				}),
			);

			it.effect("applies on the node path — YamlDocument#stringify honors the option (regression)", () =>
				Effect.gen(function* () {
					// The document adapter dropped `quoteStyle` before forwarding
					// options to the engine, so the node path always fell back to
					// single quotes. `quoteCompat` is only the trigger that forces a
					// parsed-plain scalar through the quoting fallback.
					const doc = yield* YamlDocument.parse("date: 2024-01-15\n");
					assert.strictEqual(
						yield* doc.stringify({ quoteCompat: "yaml-1.1", quoteStyle: "double" }),
						'date: "2024-01-15"\n',
					);
				}),
			);

			it("validates the field and reads back off the options class", () => {
				const options = YamlStringifyOptions.make({ quoteStyle: "double", sortKeys: true });
				assert.strictEqual(options.quoteStyle, "double");
				assert.throws(() => YamlStringifyOptions.make({ quoteStyle: deliberatelyInvalid<"single">("backtick") }));
			});
		});

		describe('quoteCompat: "yaml-1.1"', () => {
			// Expected strings derive from the YAML 1.1 implicit-resolver
			// patterns (yaml.org/type: bool, int, float, timestamp): every value
			// in `coercible` resolves to a non-string under a YAML 1.1 parser
			// (js-yaml, PyYAML, libyaml) and must therefore be quoted; every
			// value in `stillPlain` is a string in BOTH editions and must stay
			// plain — the clean-output half of the contract.
			const compat = YamlStringifyOptions.make({ quoteCompat: "yaml-1.1" });

			// One discriminating control per rule family rides along: a value
			// wrong in exactly one way (case, digit count, range) that the 1.1
			// resolver rejects, proving the predicate matches the rule and not a
			// looser superset.
			const coercible: ReadonlyArray<readonly [family: string, value: string]> = [
				["bool y", "y"],
				["bool Y", "Y"],
				["bool n", "n"],
				["bool yes", "yes"],
				["bool Yes", "Yes"],
				["bool YES", "YES"],
				["bool no", "no"],
				["bool No", "No"],
				["bool NO", "NO"],
				["bool on", "on"],
				["bool On", "On"],
				["bool ON", "ON"],
				["bool off", "off"],
				["bool Off", "Off"],
				["bool OFF", "OFF"],
				["timestamp date-only", "2024-01-15"],
				// The 1.1 spec's date-only (ymd) branch is strictly two-digit, but
				// the reference `yaml` package's 1.1 schema resolves the one-digit
				// spelling to a date too — the union policy quotes it.
				["timestamp date-only 1-digit month", "2024-1-15"],
				["timestamp ISO 8601", "2001-12-15T02:59:43.1Z"],
				["timestamp lowercase t with offset", "2001-12-14t21:59:43.10-05:00"],
				["timestamp space-separated", "2001-12-14 21:59:43.10 -5"],
				["int sexagesimal", "3:25"],
				["int sexagesimal multi-part", "190:20:30"],
				["int sexagesimal negative", "-1:30"],
				["float sexagesimal", "190:20:30.15"],
				["int underscored", "1_000"],
				["int underscored signed", "+1_000"],
				// Not an octal (contains 9) and not a spec decimal (leading zero),
				// but the reference `yaml` package's 1.1 schema resolves it to the
				// int 9 — the union policy quotes it.
				["int leading-zero underscored", "0_9"],
				["float underscored", "12_345.678_9"],
				["float underscored short", "1_0.5"],
				["float dotless exponent", "1e3"],
				["int binary", "0b1010_0111"],
				["int legacy octal underscored", "07_5"],
				["int hex underscored", "0x_FF"],
			];

			const stillPlain: ReadonlyArray<readonly [family: string, value: string]> = [
				["mixed-case non-bool", "yES"],
				["bool-prefixed word", "nope"],
				["bool-prefixed word", "onwards"],
				["bool-prefixed word", "offside"],
				["date-only with 3-digit day", "2024-01-155"],
				["date with trailing text", "2024-01-15x"],
				["2-digit year", "24-01-15"],
				["sexagesimal with out-of-range minute", "1:60"],
				["colon pair with non-digits", "1:xx"],
				["leading underscore", "_1000"],
				["dotted version string", "v1.2.3"],
				["ordinary word", "hello"],
			];

			it.effect("quotes every 1.1-coercible plain scalar (single quotes by default)", () =>
				Effect.gen(function* () {
					for (const [family, value] of coercible) {
						assert.strictEqual(yield* Yaml.stringify({ k: value }, compat), `k: '${value}'\n`, `${family}: ${value}`);
					}
				}),
			);

			it.effect("leaves strings no 1.1 parser coerces plain — the clean-output half", () =>
				Effect.gen(function* () {
					for (const [family, value] of stillPlain) {
						assert.strictEqual(yield* Yaml.stringify({ k: value }, compat), `k: ${value}\n`, `${family}: ${value}`);
					}
				}),
			);

			it.effect("is strictly additive over the 1.2 rules — their output is unchanged", () =>
				Effect.gen(function* () {
					// Every value here is already quoted (or escaped) by the 1.2 Core
					// Schema gate; the compat mode must not move a byte of it.
					const value = { a: "true", b: "null", c: "0x1F", d: "123", e: "1.5", f: "", g: "*star" };
					assert.strictEqual(yield* Yaml.stringify(value), yield* Yaml.stringify(value, compat));
				}),
			);

			it.effect("default (option absent) output is byte-identical to the released form", () =>
				Effect.gen(function* () {
					assert.strictEqual(yield* Yaml.stringify({ yes: "2024-01-15" }), "yes: 2024-01-15\n");
				}),
			);

			it.effect("composes with quoteStyle — the quote character stays its decision", () =>
				Effect.gen(function* () {
					assert.strictEqual(
						yield* Yaml.stringify({ d: "2024-01-15" }, { quoteCompat: "yaml-1.1", quoteStyle: "double" }),
						'd: "2024-01-15"\n',
					);
				}),
			);

			it.effect("quotes 1.1-coercible mapping keys in block and flow styles", () =>
				Effect.gen(function* () {
					const value = { yes: 1, "1:30": "x" };
					assert.strictEqual(yield* Yaml.stringify(value, compat), "'yes': 1\n'1:30': x\n");
					assert.strictEqual(
						yield* Yaml.stringify(value, { defaultCollectionStyle: "flow", quoteCompat: "yaml-1.1" }),
						"{'yes': 1, '1:30': x}\n",
					);
				}),
			);

			it.effect("actual booleans and numbers stay unquoted — only strings are at stake", () =>
				Effect.gen(function* () {
					assert.strictEqual(yield* Yaml.stringify({ a: true, b: 90, c: 1.5 }, compat), "a: true\nb: 90\nc: 1.5\n");
				}),
			);

			it.effect("round-trips through the package's own parser unchanged", () =>
				Effect.gen(function* () {
					const value = Object.fromEntries(coercible.map(([, v], i) => [`k${i}`, v]));
					assert.deepStrictEqual(yield* Yaml.parse(yield* Yaml.stringify(value, compat)), value);
				}),
			);

			it.effect("applies on the node path — YamlDocument#stringify quotes the 1.1 delta", () =>
				Effect.gen(function* () {
					const doc = yield* YamlDocument.parse("date: 2024-01-15\nname: alice\n");
					assert.strictEqual(yield* doc.stringify(compat), "date: '2024-01-15'\nname: alice\n");
				}),
			);

			it.effect("a tagged scalar is exempt, exactly like the 1.2 type-conflict check", () =>
				Effect.gen(function* () {
					const doc = yield* YamlDocument.parse("date: !!str 2024-01-15\n");
					assert.strictEqual(yield* doc.stringify(compat), "date: !!str 2024-01-15\n");
				}),
			);

			it("applies on the format path — YamlFormattingOptions derives the field", () => {
				assert.strictEqual(
					YamlFormat.formatToString("date: 2024-01-15\n", undefined, { quoteCompat: "yaml-1.1" }),
					"date: '2024-01-15'\n",
				);
			});

			it("validates the field and reads back off the options class", () => {
				const options = YamlStringifyOptions.make({ quoteCompat: "yaml-1.1" });
				assert.strictEqual(options.quoteCompat, "yaml-1.1");
				assert.throws(() => YamlStringifyOptions.make({ quoteCompat: deliberatelyInvalid<"yaml-1.1">("yaml-9.9") }));
			});
		});

		describe("control characters force quoting (regression)", () => {
			// Released 0.4.0 emitted CR and interior-tab scalars as PLAIN text
			// because `requiresQuoting`'s control-char loop used `isControlChar`
			// alone, which excludes TAB (0x09) and CR 0x0D. The CR case was
			// silent data corruption: `has\rcarriage` round-tripped back as
			// `has carriage`. Each case asserts BOTH that the scalar is quoted
			// and that it survives a parse round-trip unchanged.
			const cases: ReadonlyArray<readonly [label: string, value: string]> = [
				["carriage return", "has\rcarriage"],
				["interior tab", "has\ttab"],
				["leading tab", "\tleading"],
				["trailing tab", "trailing\t"],
				["NUL", "has\0nul"],
				["bell", "has\u0007bell"],
				["escape", "has\u001bescape"],
			];

			for (const [label, value] of cases) {
				it.effect(`quotes and round-trips a scalar containing a ${label}`, () =>
					Effect.gen(function* () {
						const text = yield* Yaml.stringify({ key: value });
						const scalar = text.slice("key: ".length).trimEnd();
						assert.ok(
							scalar.startsWith('"') || scalar.startsWith("'"),
							`expected a quoted scalar for ${label}, got plain: ${(yield* S.encodeEffect(JsonString)(scalar))}`,
						);
						assert.deepStrictEqual(yield* Yaml.parse(text), { key: value });
					}),
				);
			}

			it.effect("a multi-line value containing a tab still uses a block scalar", () =>
				Effect.gen(function* () {
					// Guards the fix's scope: TAB is quoted only on the single-line
					// plain path. Block scalars can carry tabs and must keep doing so.
					const value = { key: "line one\n\tindented line\n" };
					const text = yield* Yaml.stringify(value);
					assert.ok(text.includes("|"), `expected a block scalar, got: ${(yield* S.encodeEffect(JsonString)(text))}`);
					assert.deepStrictEqual(yield* Yaml.parse(text), value);
				}),
			);
		});

		describe("flow-context plain safety (#695)", () => {
			it.effect("a scalar carrying a flow indicator is quoted inside a flow sequence", () =>
				Effect.gen(function* () {
					const flow = YamlStringifyOptions.make({ defaultCollectionStyle: "flow" });
					assert.strictEqual(yield* Yaml.stringify({ a: ["p, q", "y"] }, flow), "{a: ['p, q', y]}\n");
					assert.strictEqual(yield* Yaml.stringify({ a: ["p}", "y"] }, flow), "{a: ['p}', y]}\n");
					assert.strictEqual(yield* Yaml.stringify({ a: ["x[0]"] }, flow), "{a: ['x[0]']}\n");
				}),
			);

			it.effect("a flow mapping key or value carrying a flow indicator is quoted", () =>
				Effect.gen(function* () {
					const flow = YamlStringifyOptions.make({ defaultCollectionStyle: "flow" });
					assert.strictEqual(yield* Yaml.stringify({ "k,1": "p,q" }, flow), "{'k,1': 'p,q'}\n");
				}),
			);

			it.effect("the same scalars stay plain in block context", () =>
				Effect.gen(function* () {
					assert.strictEqual(yield* Yaml.stringify({ a: ["p, q", "x[0]"] }), "a:\n- p, q\n- x[0]\n");
				}),
			);

			it.effect("every flow rendering round-trips to the caller's value", () =>
				Effect.gen(function* () {
					const flow = YamlStringifyOptions.make({ defaultCollectionStyle: "flow" });
					const value = { a: ["p, q", "p}", "[x", "{y", "k]"], "b,c": { "d}": "e{" } };
					const text = yield* Yaml.stringify(value, flow);
					assert.deepStrictEqual(yield* Yaml.parse(text), value);
				}),
			);
		});

		describe("lineWidth folding", () => {
			const long = "the quick brown fox jumps over the lazy dog and keeps running far away into the sunset";

			it.effect("a positive lineWidth folds a long plain scalar transparently (round-trips)", () =>
				Effect.gen(function* () {
					const value = { text: long };
					const wrapped = yield* Yaml.stringify(value, { lineWidth: 30 });
					const lines = wrapped.trimEnd().split("\n");
					// Folding fired: the scalar spans several physical lines.
					assert.isAbove(lines.length, 1);
					// Each line stays near the target column (folding is approximate but
					// bounded — never wildly over the requested width).
					for (const line of lines) assert.isAtMost(line.length, 40);
					// A fold is a semantically transparent break: it re-parses identically.
					assert.deepStrictEqual(yield* Yaml.parse(wrapped), value);
				}),
			);

			it.effect("folds double-quoted and block-folded scalars, round-tripping each", () =>
				Effect.gen(function* () {
					const value = { text: long };
					for (const defaultScalarStyle of ["double-quoted", "block-folded"] as const) {
						const wrapped = yield* Yaml.stringify(value, { lineWidth: 30, defaultScalarStyle });
						assert.isAbove(wrapped.trimEnd().split("\n").length, 1);
						assert.deepStrictEqual(yield* Yaml.parse(wrapped), value);
					}
				}),
			);

			it.effect("folds a scalar in a sequence item and at the document root", () =>
				Effect.gen(function* () {
					const seq = yield* Yaml.stringify([long], { lineWidth: 30 });
					assert.isAbove(seq.trimEnd().split("\n").length, 1);
					assert.deepStrictEqual(yield* Yaml.parse(seq), [long]);

					const root = yield* Yaml.stringify(long, { lineWidth: 30 });
					assert.isAbove(root.trimEnd().split("\n").length, 1);
					assert.strictEqual(yield* Yaml.parse(root), long);
				}),
			);

			it.effect("never folds block-literal content (literal blocks preserve bytes)", () =>
				Effect.gen(function* () {
					// A multi-line string renders as a block literal (`|`); its long first
					// line must survive uncut so the literal round-trips byte-for-byte.
					const value = { text: `${long}\nsecond line` };
					const out = yield* Yaml.stringify(value, { lineWidth: 20 });
					assert.isTrue(out.split("\n").some((l) => l.length > 40));
					assert.deepStrictEqual(yield* Yaml.parse(out), value);
				}),
			);

			it.effect("lineWidth 0, negative and absent all produce byte-identical no-wrap output", () =>
				Effect.gen(function* () {
					const value = { text: long };
					const absent = yield* Yaml.stringify(value);
					const zero = yield* Yaml.stringify(value, { lineWidth: 0 });
					const negative = yield* Yaml.stringify(value, { lineWidth: -10 });
					assert.strictEqual(zero, absent);
					assert.strictEqual(negative, absent);
					// No-wrap keeps the long scalar on a single physical line.
					assert.strictEqual(absent, `text: ${long}\n`);
				}),
			);

			it.effect("mutation guard: folding actually fires (wrapped differs from no-wrap)", () =>
				Effect.gen(function* () {
					// Pins that the fold is not a no-op: were foldRenderedScalar inert,
					// wrapped and unwrapped would be equal and this test would fail.
					const value = { text: long };
					const wrapped = yield* Yaml.stringify(value, { lineWidth: 30 });
					const unwrapped = yield* Yaml.stringify(value, { lineWidth: 0 });
					assert.notStrictEqual(wrapped, unwrapped);
					assert.isAbove(wrapped.split("\n").length, unwrapped.split("\n").length);
				}),
			);
		});
	});

	describe("parseResult / stringifyResult (synchronous Result escape hatch)", () => {
		it.effect("parseResult succeeds and matches Yaml.parse on valid input", () =>
			Effect.gen(function* () {
				const text = "name: Alice\nage: 30\ntags:\n  - a\n  - b";
				const result = Yaml.parseResult(text);
				if (!Result.isSuccess(result)) {
					assert.fail("parseResult must succeed on valid input");
				}
				assert.deepStrictEqual(result.success, yield* Yaml.parse(text));
			}),
		);

		it("parseResult returns a Failure with a typed YamlParseError on malformed input, never a throw", () => {
			let result: Result.Result<unknown, YamlParseError> = Result.succeed(undefined);
			assert.doesNotThrow(() => {
				result = Yaml.parseResult("a: *missing");
			});
			assertFailure(result, result.pipe(Result.flip, Result.getOrThrow));
			if (!Result.isFailure(result)) return;
			assert.instanceOf(result.failure, YamlParseError);
			assert.isTrue(result.failure.diagnostics.some((d) => d.code === "UndefinedAlias"));
		});

		it.effect("stringifyResult succeeds and matches Yaml.stringify on valid input", () =>
			Effect.gen(function* () {
				const value = { name: "Alice", nested: { list: [1, 2, true, null] } };
				const result = Yaml.stringifyResult(value);
				if (!Result.isSuccess(result)) {
					assert.fail("stringifyResult must succeed on valid input");
				}
				assert.strictEqual(result.success, yield* Yaml.stringify(value));
			}),
		);

		it("stringifyResult returns a Failure with CircularReference on a cycle, never a throw", () => {
			const value: Record<string, unknown> = {};
			value.self = value;
			let result: Result.Result<string, YamlStringifyError> = Result.succeed("");
			assert.doesNotThrow(() => {
				result = Yaml.stringifyResult(value);
			});
			assertFailure(result, result.pipe(Result.flip, Result.getOrThrow));
			if (!Result.isFailure(result)) return;
			assert.instanceOf(result.failure, YamlStringifyError);
			assert.strictEqual(result.failure.diagnostics[0]?.code, "CircularReference");
		});

		it("stringifyResult surfaces a deep-nesting overflow as a typed Failure, never a stack overflow", () => {
			let value: unknown = 1;
			for (let i = 0; i < 50000; i++) value = [value];
			let result: Result.Result<string, YamlStringifyError> = Result.succeed("");
			assert.doesNotThrow(() => {
				result = Yaml.stringifyResult(value);
			});
			assertFailure(result, result.pipe(Result.flip, Result.getOrThrow));
			if (!Result.isFailure(result)) return;
			assert.strictEqual(result.failure.diagnostics[0]?.code, "NestingDepthExceeded");
		});

		it("parseResult surfaces an alias 'billion laughs' bomb as a typed Failure, never OOM", () => {
			const width = 10;
			const depth = 8;
			const lines: string[] = [`a1: &a1 [${Array.from({ length: width }, () => "x").join(", ")}]`];
			for (let i = 2; i <= depth; i++) {
				lines.push(`a${i}: &a${i} [${Array.from({ length: width }, () => `*a${i - 1}`).join(", ")}]`);
			}
			lines.push(`top: *a${depth}`);
			let result: Result.Result<unknown, YamlParseError> = Result.succeed(undefined);
			assert.doesNotThrow(() => {
				result = Yaml.parseResult(lines.join("\n"));
			});
			assertFailure(result, result.pipe(Result.flip, Result.getOrThrow));
			if (!Result.isFailure(result)) return;
			assert.isTrue(result.failure.diagnostics.some((d) => d.code === "AliasCountExceeded"));
		});
	});

	describe("options classes", () => {
		it("constructs validated instances via .make (kit convention, never new)", () => {
			const parse = YamlParseOptions.make({ maxAliasCount: 50 });
			assert.instanceOf(parse, YamlParseOptions);
			assert.strictEqual(parse.maxAliasCount, 50);
			const stringify = YamlStringifyOptions.make({ indentSequences: true, sortKeys: true });
			assert.instanceOf(stringify, YamlStringifyOptions);
			assert.strictEqual(stringify.indentSequences, true);
		});

		it(".make validates its input", () => {
			assert.throws(() => YamlStringifyOptions.make({ indent: deliberatelyInvalid<number>("four") }));
			assert.throws(() => YamlParseOptions.make({ strict: deliberatelyInvalid<boolean>(1) }));
		});
	});

	describe("stripComments", () => {
		it("removes comment characters while keeping line breaks", () => {
			assert.strictEqual(Yaml.stripComments("a: 1 # trailing\nb: 2"), "a: 1 \nb: 2");
		});

		it("preserves offsets when a replacement character is given", () => {
			const input = "a: 1 # comment\nb: 2";
			const stripped = Yaml.stripComments(input, " ");
			assert.strictEqual(stripped.length, input.length);
			assert.strictEqual(stripped.indexOf("b: 2"), input.indexOf("b: 2"));
		});

		it("treats # inside quoted scalars as content", () => {
			assert.strictEqual(Yaml.stripComments('a: "x # y"'), 'a: "x # y"');
			assert.strictEqual(Yaml.stripComments("a: 'x # y'"), "a: 'x # y'");
		});

		it("only starts comments after whitespace or line start", () => {
			assert.strictEqual(Yaml.stripComments("a: x#y"), "a: x#y");
		});
	});

	describe("equals / equalsValue", () => {
		it("is key-order independent for mappings", () => {
			assert.isTrue(Yaml.equals("a: 1\nb: 2", "b: 2\na: 1"));
		});

		it("is order-sensitive for sequences", () => {
			assert.isFalse(Yaml.equals("- 1\n- 2", "- 2\n- 1"));
		});

		it("ignores comments and formatting", () => {
			assert.isTrue(Yaml.equals("a: 1 # note", "a:   1"));
		});

		it("treats NaN as equal to NaN", () => {
			assert.isTrue(Yaml.equals("a: .nan", "a: .NaN"));
		});

		it("malformed input is never equal to anything — including itself", () => {
			assert.isFalse(Yaml.equals("a: *missing", "a: *missing"));
			assert.isFalse(Yaml.equalsValue("a: *missing", { a: null }));
		});

		it("duplicate keys make input malformed for equality purposes", () => {
			assert.isFalse(Yaml.equals("a: 1\na: 2", "a: 2"));
		});

		it("compares a document against a JavaScript value", () => {
			assert.isTrue(Yaml.equalsValue("items:\n  - one\n  - two", { items: ["one", "two"] }));
			assert.isFalse(Yaml.equalsValue("items: []", { items: ["one"] }));
		});
	});

	describe("hostile input", () => {
		it.effect("__proto__ becomes an own data property, never a prototype mutation", () =>
			Effect.gen(function* () {
				const value = (yield* Yaml.parse('"__proto__":\n  polluted: true'));
				assert.ok(P.isObject(value));
				assert.strictEqual(Object.getPrototypeOf(value), Object.prototype);
				assert.isTrue(Object.hasOwn(value, "__proto__"));
				assert.isFalse("polluted" in {});
			}),
		);

		it.effect("rejects unescaped C0 control characters in scalars", () =>
			Effect.gen(function* () {
				const plain = yield* Effect.matchEffect(Yaml.parse(`a: x${String.fromCharCode(7)}y`), { onFailure: Effect.succeed, onSuccess: Effect.die });
				assert.isTrue(plain.diagnostics.some((d) => d.code === "UnexpectedCharacter"));
				const quoted = yield* Effect.matchEffect(Yaml.parse(`a: "x${String.fromCharCode(7)}y"`), { onFailure: Effect.succeed, onSuccess: Effect.die });
				assert.isTrue(quoted.diagnostics.some((d) => d.code === "UnexpectedCharacter"));
			}),
		);

		it.effect("escaped control characters in double-quoted scalars stay valid", () =>
			Effect.gen(function* () {
				const value = yield* Yaml.parse('a: "x\\ay"');
				assert.deepStrictEqual(value, { a: `x${String.fromCharCode(7)}y` });
			}),
		);

		it.effect("a \\U escape above U+10FFFF fails with a typed error, never a defect", () =>
			Effect.gen(function* () {
				// The largest valid Unicode code point is U+10FFFF; \U00110000 is one
				// past it. It must surface as a YamlParseError, not a RangeError defect
				// from String.fromCodePoint escaping the typed error channel.
				const error = yield* Effect.matchEffect(Yaml.parse('"\\U00110000"'), { onFailure: Effect.succeed, onSuccess: Effect.die });
				assert.strictEqual(error._tag, "YamlParseError");
				const valid = yield* Yaml.parse('"\\U0001F600"');
				assert.strictEqual(valid, "😀");
			}),
		);

		it.effect("deeply nested flow collections fail with NestingDepthExceeded, not a stack overflow", () =>
			Effect.gen(function* () {
				const n = 5000;
				const error = yield* Effect.matchEffect(Yaml.parse(`${"[".repeat(n)}1${"]".repeat(n)}`), { onFailure: Effect.succeed, onSuccess: Effect.die });
				assert.isTrue(error.diagnostics.some((d) => d.code === "NestingDepthExceeded"));
			}),
		);

		it.effect("deeply nested block mappings fail with NestingDepthExceeded, not a stack overflow", () =>
			Effect.gen(function* () {
				let text = "";
				for (let i = 0; i < 4000; i++) text += `${" ".repeat(i)}k:\n`;
				const error = yield* Effect.matchEffect(Yaml.parse(text), { onFailure: Effect.succeed, onSuccess: Effect.die });
				assert.isTrue(error.diagnostics.some((d) => d.code === "NestingDepthExceeded"));
			}),
		);

		it.effect("an alias-expansion 'billion laughs' bomb under the token budget fails typed, not OOM", () =>
			Effect.gen(function* () {
				// A chain of anchored flow sequences, each referencing the previous
				// ten times: a1=[x×10], a2=[*a1×10], … a8=[*a7×10], top: *a8.
				// Only 71 alias TOKENS (7×10 + 1) — under the default maxAliasCount of
				// 100 — but *a8 expands to ~10^8 materialized nodes. The composer's
				// per-token guard cannot catch it; the value-extraction budget must.
				const width = 10;
				const depth = 8;
				const lines: string[] = [`a1: &a1 [${Array.from({ length: width }, () => "x").join(", ")}]`];
				for (let i = 2; i <= depth; i++) {
					lines.push(`a${i}: &a${i} [${Array.from({ length: width }, () => `*a${i - 1}`).join(", ")}]`);
				}
				lines.push(`top: *a${depth}`);
				const bomb = lines.join("\n");

				const result = yield* Effect.exit(Yaml.parse(bomb));
				assertExitFailure(result, result.pipe(Exit.getCause, O.getOrThrow));
				const error = result.cause.pipe(Cause.findError, Result.getOrThrow);
				assert.instanceOf(error, YamlParseError);
				assert.isTrue(error.diagnostics.some((d) => d.code === "AliasCountExceeded"));
			}),
		);

		it.effect("a benign document with many small distinct aliases still parses (budget does not false-positive)", () =>
			Effect.gen(function* () {
				// 90 distinct anchors, each a small scalar, each referenced once — well
				// under any expansion bound. Proves the budget counts real expanded
				// output, not raw alias tokens, so legitimate alias-heavy documents pass.
				const anchors = Array.from({ length: 90 }, (_, i) => `a${i}: &n${i} ${i}`);
				const refs = Array.from({ length: 90 }, (_, i) => `r${i}: *n${i}`);
				const doc = [...anchors, ...refs].join("\n");

				const result = yield* Effect.exit(Yaml.parse(doc));
				assertExitSuccess(result, result.pipe(Exit.getSuccess, O.getOrThrow));
				const value = result.value;
				assert.ok(P.isObject(value));
				assert.strictEqual(value.r0, 0);
				assert.strictEqual(value.r89, 89);
			}),
		);
	});

	describe("schema pipeline", () => {
		const Config = S.Struct({ host: S.String, port: S.Finite });

		it.effect("YamlFromString decodes YAML to unknown", () =>
			Effect.gen(function* () {
				const value = yield* S.decodeEffect(Yaml.YamlFromString)("host: localhost\nport: 3000");
				assert.deepStrictEqual(value, { host: "localhost", port: 3000 });
			}),
		);

		it.effect("schema(Target) decodes YAML straight into a domain value", () =>
			Effect.gen(function* () {
				const ConfigFromYaml = Yaml.schema(Config);
				const config = yield* S.decodeEffect(ConfigFromYaml)("host: localhost\nport: 3000");
				assert.deepStrictEqual(config, { host: "localhost", port: 3000 });
			}),
		);

		it.effect("encodes a value back to YAML text", () =>
			Effect.gen(function* () {
				const encoded = yield* S.encodeUnknownEffect(Yaml.YamlFromString)({ a: 1 });
				assert.strictEqual(encoded, "a: 1\n");
			}),
		);

		it.effect("allFromString decodes and encodes multi-document streams", () =>
			Effect.gen(function* () {
				const codec = Yaml.allFromString();
				const values = yield* S.decodeEffect(codec)("a: 1\n---\nb: 2");
				assert.deepStrictEqual(values, [{ a: 1 }, { b: 2 }]);
				const encoded = yield* S.encodeUnknownEffect(codec)([{ a: 1 }, { b: 2 }]);
				assert.strictEqual(encoded, "a: 1\n---\nb: 2\n");
				const roundTripped = yield* S.decodeEffect(codec)(encoded);
				assert.deepStrictEqual(roundTripped, [{ a: 1 }, { b: 2 }]);
			}),
		);

		it.effect("boundary: Yaml.parse yields YamlParseError, never SchemaError", () =>
			Effect.gen(function* () {
				const error = yield* Effect.matchEffect(Yaml.parse("a: *missing"), { onFailure: Effect.succeed, onSuccess: Effect.die });
				assert.strictEqual(error._tag, "YamlParseError");
			}),
		);

		it.effect("schema decode surfaces a SchemaError carrying the aggregate parse message", () =>
			Effect.gen(function* () {
				const error = yield* Effect.matchEffect(S.decodeEffect(Yaml.YamlFromString)("a: *missing"), { onFailure: Effect.succeed, onSuccess: Effect.die });
				assert.strictEqual(error._tag, "SchemaError");
				assert.include(String(error), "YAML parse failed");
			}),
		);
	});

	describe("bind", () => {
		const Config = S.Struct({ host: S.String, port: S.Finite });
		const config = Yaml.bind(Config);

		it.effect("decode parses YAML straight into a validated domain value", () =>
			Effect.gen(function* () {
				const value = yield* config.decode("host: localhost\nport: 3000");
				assert.deepStrictEqual(value, { host: "localhost", port: 3000 });
			}),
		);

		it.effect("decode surfaces a SchemaError carrying the aggregate parse message on malformed text", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(config.decode("host: *missing"));
				assert.strictEqual(error._tag, "SchemaError");
				assert.include(String(error), "YAML parse failed");
			}),
		);

		it.effect("decode surfaces a SchemaError from the target schema, distinct from a parse failure", () =>
			Effect.gen(function* () {
				const error = yield* Effect.flip(config.decode("host: localhost\nport: not-a-number"));
				assert.strictEqual(error._tag, "SchemaError");
				assert.notInclude(String(error), "YAML parse failed");
			}),
		);

		it.effect("encode writes YAML text that decode round-trips", () =>
			Effect.gen(function* () {
				const text = yield* config.encode({ host: "localhost", port: 3000 });
				assert.strictEqual(text, "host: localhost\nport: 3000\n");
				const value = yield* config.decode(text);
				assert.deepStrictEqual(value, { host: "localhost", port: 3000 });
			}),
		);

		it.effect("schema is the Yaml.schema composition, usable with generic Schema machinery", () =>
			Effect.gen(function* () {
				const value = yield* S.decodeEffect(config.schema)("host: localhost\nport: 3000");
				assert.deepStrictEqual(value, { host: "localhost", port: 3000 });
			}),
		);
	});

	describe("stringify ∘ parse roundtrip (property)", () => {
		// `-0` is a valid `Int` the native generator does emit, and neither JSON nor
		// YAML can carry it (`JSON.stringify(-0) === "0"`), so the round-trip domain
		// excludes it explicitly rather than letting `deepStrictEqual` fail on +0/-0.
		const Sample = S.Struct({
			name: S.String,
			count: S.Int.check(S.makeFilter((n) => !Object.is(n, -0))),
			enabled: S.Boolean,
			tags: S.Array(S.String),
		});

		it.effect.prop("parse recovers what stringify produced", [Sample], ([value]) =>
			Effect.gen(function* () {
				const text = yield* Yaml.stringify(value);
				const parsed = yield* Yaml.parse(text);
				assert.deepStrictEqual(parsed, value);
			}),
		);
	});
});
