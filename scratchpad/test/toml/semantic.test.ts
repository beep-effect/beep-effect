import { assert, describe, it } from "@effect/vitest";
import * as Equal from "effect/Equal";
import type { TomlSemanticErrorCodeRaw } from "../../effected/toml/internal/diagnostics.ts";
import { isRawTomlError } from "../../effected/toml/internal/diagnostics.ts";
import { parseExpressions } from "../../effected/toml/internal/parser.ts";
import { analyze, buildValue } from "../../effected/toml/internal/semantic.ts";
import { TomlLocalDate } from "../../effected/toml/TomlDateTime.ts";
import type { TomlArrayTableHeader, TomlKeyValue, TomlTableHeader } from "../../effected/toml/TomlNode.ts";

/** Parse and analyze, expecting success. */
function analyzeSrc(src: string): void {
	analyze(parseExpressions(src));
}

/** Parse and build the plain value, expecting success. */
function build(src: string): unknown {
	return buildValue(parseExpressions(src));
}

/** Assert analysis throws a RawTomlError with `code` (and `offset`, when given). */
function assertSemanticError(src: string, code: TomlSemanticErrorCodeRaw, offset?: number): void {
	try {
		analyze(parseExpressions(src));
	} catch (error) {
		if (!isRawTomlError(error)) {
			throw error;
		}
		assert.strictEqual(error.diagnostic.code, code);
		if (offset !== undefined) {
			assert.strictEqual(error.diagnostic.offset, offset);
		}
		return;
	}
	assert.fail(`expected RawTomlError with code ${code}, but nothing was thrown`);
}

describe("semantic", () => {
	describe("duplicate keys", () => {
		it("rejects a plain duplicate key", () => {
			assertSemanticError("a=1\na=2", "DuplicateKey", 4);
		});
		it("rejects a quoted respelling of the same key", () => {
			assertSemanticError('a=1\n"a"=2', "DuplicateKey", 4);
		});
		it("rejects a duplicate key inside a table section", () => {
			assertSemanticError("[t]\nx=1\nx=2", "DuplicateKey");
		});
		it("rejects assigning over a dotted-created table", () => {
			// corpus: invalid/table/append-with-dotted-keys-05
			assertSemanticError("a.b.c=1\na.b=2", "DuplicateKey");
		});
		it("rejects overwriting a dotted-created table with an inline table", () => {
			// corpus: invalid/inline-table/overwrite-01
			assertSemanticError("a.b=0\na={}", "DuplicateKey");
		});
		it("rejects assigning over an array-of-tables name from its parent section", () => {
			// corpus: invalid/table/overwrite-array-in-parent
			assertSemanticError("[[p.arr]]\n[p]\narr=2", "DuplicateKey");
		});
		it("allows the same key name in different tables", () => {
			assert.deepStrictEqual(build("a=1\n[t]\na=2"), { a: 1, t: { a: 2 } });
		});
	});

	describe("table redefinition", () => {
		it("allows defining a super-table after its sub-table", () => {
			assert.deepStrictEqual(build("[a.b]\n[a]"), { a: { b: {} } });
		});
		it("rejects defining the same table twice", () => {
			assertSemanticError("[a]\n[a]", "TableRedefined", 5);
		});
		it("rejects a table header over an existing value", () => {
			assertSemanticError("a=1\n[a]", "TableRedefined");
		});
		it("rejects promoting the implicit super-table twice", () => {
			// corpus: invalid/table/super-twice
			assertSemanticError("[a.b]\n[a]\n[a]", "TableRedefined");
		});
		it("rejects reopening an explicitly defined sub-table", () => {
			assertSemanticError("[a.b]\n[a]\n[a.b]", "TableRedefined");
		});
		it("rejects a header over a key defined in the parent table", () => {
			// corpus: invalid/table/redefine-01
			assertSemanticError("[a]\nb=1\n[a.b]", "TableRedefined");
		});
		it("rejects header navigation through a value", () => {
			assertSemanticError("a=1\n[a.b]", "TableRedefined");
		});
		it("allows a sibling sub-table after the super-table is promoted", () => {
			assert.deepStrictEqual(build("[a.b]\n[a]\n[a.c]"), { a: { b: {}, c: {} } });
		});
	});

	describe("dotted keys vs headers", () => {
		it("allows same-section dotted reuse", () => {
			assert.deepStrictEqual(build("[a]\nb.c=1\nb.d=2"), { a: { b: { c: 1, d: 2 } } });
		});
		it("rejects a header landing on a dotted-created table", () => {
			// corpus: invalid/table/redefine-02
			assertSemanticError("[a]\nb.c=1\n[a.b]", "TableRedefined");
		});
		it("rejects a header landing on a dotted-created value", () => {
			// corpus: invalid/table/redefine-03 (final segment is the dotted-created t3)
			assertSemanticError("[t1]\nt2.t3.v=0\n[t1.t2.t3]", "TableRedefined");
		});
		it("allows a header to define a new sub-table inside a dotted-created table", () => {
			// corpus: valid/spec-1.0.0/table-9 — G8 deviation: header navigation
			// PASSES THROUGH table-dotted intermediates; only landing the final
			// segment on an existing table-dotted is an error.
			assert.deepStrictEqual(build('[fruit]\napple.color="red"\n[fruit.apple.texture]\nsmooth=true'), {
				fruit: { apple: { color: "red", texture: { smooth: true } } },
			});
		});
		it("allows an array-table header inside a dotted-created table", () => {
			// corpus: valid/table/array-within-dotted
			assert.deepStrictEqual(build('[fruit]\napple.color="red"\n[[fruit.apple.seeds]]\nsize=2'), {
				fruit: { apple: { color: "red", seeds: [{ size: 2 }] } },
			});
		});
		it("rejects dotted extension of a header-implicit table", () => {
			// corpus: invalid/table/append-with-dotted-keys-01 (shape)
			assertSemanticError("[a.b.c]\n[a]\nb.d=1", "DottedKeyConflict");
		});
		it("rejects dotted extension of an explicitly defined table", () => {
			// corpus: invalid/inline-table/overwrite-09 (shape)
			assertSemanticError("[a.b]\nx.y=1\n[a]\nb.z=1", "DottedKeyConflict");
		});
		it("rejects dotted keys through a value", () => {
			assertSemanticError("a.b=1\na.b.c=2", "DottedKeyConflict");
		});
		it("rejects dotted keys extending a plain value", () => {
			assertSemanticError("a=1\na.b=2", "DottedKeyConflict");
		});
	});

	describe("arrays of tables", () => {
		it("appends one element per [[t]] header", () => {
			assert.deepStrictEqual(build("[[t]]\nx=1\n[[t]]\nx=2"), { t: [{ x: 1 }, { x: 2 }] });
		});
		it("defines sub-tables on the last element", () => {
			assert.deepStrictEqual(build("[[t]]\n[t.sub]\nx=1"), { t: [{ sub: { x: 1 } }] });
		});
		it("keeps earlier-element sub-tables when a new element is appended", () => {
			assert.deepStrictEqual(build("[[a]]\n[a.b]\n[[a]]"), { a: [{ b: {} }, {}] });
		});
		it("allows promoting the implicit parent of an array table", () => {
			// corpus: valid/table/array-implicit-and-explicit-after
			assert.deepStrictEqual(build("[[a.b]]\nx=1\n[a]\ny=2"), { a: { b: [{ x: 1 }], y: 2 } });
		});
		it("scopes dotted keys to each array element", () => {
			// corpus: valid/key/dotted-04
			assert.deepStrictEqual(build("[[arr]]\na.b.c=1\na.b.d=2\n[[arr]]\na.b.c=3"), {
				arr: [{ a: { b: { c: 1, d: 2 } } }, { a: { b: { c: 3 } } }],
			});
		});
		it("rejects [[t]] over an explicit table", () => {
			assertSemanticError("[t]\n[[t]]", "ArrayOfTablesConflict");
		});
		it("rejects [[t]] over a static array", () => {
			// corpus: invalid/array/tables-01
			assertSemanticError("t=[1]\n[[t]]", "ArrayOfTablesConflict");
		});
		it("rejects [t] over an array of tables", () => {
			assertSemanticError("[[t]]\n[t]", "TableRedefined");
		});
		it("rejects reopening an array-of-tables name as a plain table", () => {
			// corpus: invalid/array/tables-02
			assertSemanticError("[[f]]\n[[f.v]]\n[f.v]", "TableRedefined");
		});
		it("rejects dotted keys through an array-of-tables name", () => {
			// corpus: invalid/table/append-with-dotted-keys-03
			assertSemanticError("[[a.b]]\n[a]\nb.y=2", "DottedKeyConflict");
		});
		it("rejects a dotted key landing on an array-of-tables name", () => {
			// corpus: invalid/array/extend-defined-aot
			assertSemanticError("[[tab.arr]]\n[tab]\narr.val1=1", "DottedKeyConflict");
		});
		it("rejects header navigation into a static array", () => {
			// corpus: invalid/array/extending-table
			assertSemanticError("a=[{b=1}]\n[a.c]", "ArrayOfTablesConflict");
		});
	});

	describe("inline tables", () => {
		it("accepts dotted keys scoped to one inline table", () => {
			// corpus: valid/inline-table/key-dotted-02 (shape)
			assert.deepStrictEqual(build("t={a.b.c=1, a.b.d=2}"), { t: { a: { b: { c: 1, d: 2 } } } });
		});
		it("accepts repeated inline-table shapes across array elements", () => {
			// corpus: valid/inline-table/key-dotted-05
			assert.deepStrictEqual(build("arr=[{a.b=1}, {a.b=2}]"), { arr: [{ a: { b: 1 } }, { a: { b: 2 } }] });
		});
		it("rejects extending an inline table with a header", () => {
			assertSemanticError("a={b=1}\n[a.c]", "InlineTableExtended");
		});
		it("rejects extending an inline table with a dotted key", () => {
			assertSemanticError("a={b=1}\na.c=2", "InlineTableExtended", 8);
		});
		it("rejects a header reopening a sub-key of an inline table", () => {
			// corpus: invalid/inline-table/overwrite-02
			assertSemanticError("a={}\n[a.b]", "InlineTableExtended");
		});
		it("rejects redefining an inline table name with a header", () => {
			assertSemanticError("a={}\n[a]", "TableRedefined");
		});
		it("rejects [[...]] through an inline table", () => {
			// corpus: invalid/inline-table/overwrite-04
			assertSemanticError("i={n={}}\n[[i.n]]", "InlineTableExtended");
		});
		it("rejects duplicate keys inside an inline table", () => {
			// corpus: invalid/inline-table/duplicate-key-01
			assertSemanticError("a={b=1, b=2}", "DuplicateKey");
		});
		it("rejects dotted duplicates inside an inline table", () => {
			// corpus: invalid/inline-table/duplicate-key-02
			assertSemanticError("t={a.dupe=1, a.dupe=2}", "DuplicateKey");
		});
		it("rejects overwriting a dotted-created inline sub-table", () => {
			// corpus: invalid/inline-table/overwrite-10
			assertSemanticError("a={b.a=1, b=2}", "DuplicateKey");
		});
		it("rejects extending a closed nested inline table", () => {
			// corpus: invalid/inline-table/duplicate-key-03 / overwrite-08
			assertSemanticError('t={f={a.c="red"}, f.a.t=1}', "InlineTableExtended");
		});
		it("rejects dotted keys through an inline value", () => {
			// corpus: invalid/inline-table/duplicate-key-04
			assertSemanticError('t={a.b=1, a.b.c="x"}', "DottedKeyConflict");
		});
		it("rejects dotted extension of an inline scalar entry", () => {
			// corpus: invalid/table/append-with-dotted-keys-07
			assertSemanticError('a={k1=1, k1.name="joe"}', "DottedKeyConflict");
		});
		it("validates inline tables nested inside arrays", () => {
			assertSemanticError("arr=[{b=1, b=2}]", "DuplicateKey");
		});
		it("validates inline tables nested inside nested arrays", () => {
			assertSemanticError("arr=[[{b=1, b=2}]]", "DuplicateKey");
		});
	});

	describe("buildValue", () => {
		it("returns an empty object for an empty document", () => {
			assert.deepStrictEqual(build(""), {});
		});
		it("materializes a mixed document into plain values", () => {
			const src = [
				'title = "TOML Example"',
				"[owner]",
				'name = "Tom"',
				"dob = 1979-05-27",
				"big = 9223372036854775807",
				"ratio = 0.5",
				"active = true",
				'tags = ["a", "b", 3]',
				"point = { x = 1, y = 2 }",
				"[[products]]",
				"sku = 1",
				"[[products]]",
				"sku = 2",
				'color.name = "red"',
			].join("\n");
			const expected = {
				title: "TOML Example",
				owner: {
					name: "Tom",
					dob: TomlLocalDate.make({ year: 1979, month: 5, day: 27 }),
					big: 9223372036854775807n,
					ratio: 0.5,
					active: true,
					tags: ["a", "b", 3],
					point: { x: 1, y: 2 },
				},
				products: [{ sku: 1 }, { sku: 2, color: { name: "red" } }],
			};
			const actual = build(src) as typeof expected;
			assert.deepStrictEqual(actual, expected);
			assert.isTrue(Equal.equals(actual.owner.dob, TomlLocalDate.make({ year: 1979, month: 5, day: 27 })));
			assert.strictEqual(typeof actual.owner.big, "bigint");
			assert.strictEqual(typeof actual.owner.ratio, "number");
		});
		it("materializes the special float spellings", () => {
			const value = build("a = inf\nb = -inf\nc = nan") as { a: number; b: number; c: number };
			assert.strictEqual(value.a, Number.POSITIVE_INFINITY);
			assert.strictEqual(value.b, Number.NEGATIVE_INFINITY);
			assert.isTrue(Number.isNaN(value.c));
		});
	});

	describe("proto safety", () => {
		it('sets "__proto__" as an own data property, never the prototype', () => {
			const value = build('"__proto__" = 1') as Record<string, unknown>;
			assert.isTrue(Object.hasOwn(value, "__proto__"));
			assert.strictEqual(Object.getOwnPropertyDescriptor(value, "__proto__")?.value, 1);
			assert.strictEqual(Object.getPrototypeOf(value), Object.prototype);
		});
		it('navigates dotted "__proto__" segments without polluting Object.prototype', () => {
			const value = build('"__proto__".x = 1\n"__proto__".y = 2') as Record<string, unknown>;
			assert.isTrue(Object.hasOwn(value, "__proto__"));
			assert.deepStrictEqual(Object.getOwnPropertyDescriptor(value, "__proto__")?.value, { x: 1, y: 2 });
			assert.strictEqual(Object.getPrototypeOf(value), Object.prototype);
			const probe = {} as Record<string, unknown>;
			assert.isUndefined(probe.x);
			assert.isUndefined(probe.y);
		});
		it('sets "__proto__" inside inline tables as an own data property', () => {
			const value = build('t = { "__proto__" = 1 }') as { t: Record<string, unknown> };
			assert.isTrue(Object.hasOwn(value.t, "__proto__"));
			assert.strictEqual(Object.getOwnPropertyDescriptor(value.t, "__proto__")?.value, 1);
			assert.strictEqual(Object.getPrototypeOf(value.t), Object.prototype);
		});
	});

	describe("visitor", () => {
		it("fires callbacks in document order with full paths", () => {
			const events: Array<{
				readonly type: string;
				readonly path: ReadonlyArray<string>;
				readonly index?: number;
			}> = [];
			analyze(parseExpressions("[a]\nx=1\n[[b]]\ny=2\n[[b]]\nc.d=3"), {
				onTableStart: (path, _header) => {
					events.push({ type: "table", path });
				},
				onArrayTableStart: (path, index, _header) => {
					events.push({ type: "arrayTable", path, index });
				},
				onKeyValue: (path, _expr) => {
					events.push({ type: "keyValue", path });
				},
			});
			assert.deepStrictEqual(events, [
				{ type: "table", path: [] },
				{ type: "table", path: ["a"] },
				{ type: "keyValue", path: ["a", "x"] },
				{ type: "arrayTable", path: ["b"], index: 0 },
				{ type: "keyValue", path: ["b", "y"] },
				{ type: "arrayTable", path: ["b"], index: 1 },
				{ type: "keyValue", path: ["b", "c", "d"] },
			]);
		});
		it("passes the header and key-value nodes to the callbacks", () => {
			const headers: Array<TomlTableHeader | undefined> = [];
			const arrayHeaders: Array<TomlArrayTableHeader> = [];
			const keyValues: Array<TomlKeyValue> = [];
			analyze(parseExpressions("[a]\nx=1\n[[b]]"), {
				onTableStart: (_path, header) => {
					headers.push(header);
				},
				onArrayTableStart: (_path, _index, header) => {
					arrayHeaders.push(header);
				},
				onKeyValue: (_path, expr) => {
					keyValues.push(expr);
				},
			});
			assert.strictEqual(headers.length, 2);
			assert.isUndefined(headers[0]);
			assert.strictEqual(headers[1]?._tag, "TomlTableHeader");
			assert.strictEqual(arrayHeaders[0]?._tag, "TomlArrayTableHeader");
			assert.strictEqual(keyValues[0]?._tag, "TomlKeyValue");
			assert.strictEqual(keyValues[0]?.keyPath[0]?.value, "x");
		});
		it("stops before the violating expression", () => {
			const seen: Array<ReadonlyArray<string>> = [];
			assert.throws(() => {
				analyze(parseExpressions("x=1\nx=2"), {
					onKeyValue: (path, _expr) => {
						seen.push(path);
					},
				});
			});
			assert.deepStrictEqual(seen, [["x"]]);
		});
		it("validates silently without a visitor", () => {
			assert.isUndefined(analyzeSrc("[a]\nb.c=1"));
		});
	});

	describe("iterative navigation", () => {
		it("handles a 5000-segment dotted header without overflowing", () => {
			const header = `[${Array.from({ length: 5000 }, () => "a").join(".")}]`;
			assert.isUndefined(analyzeSrc(header));
		});
		it("builds a 5000-segment dotted key without overflowing", () => {
			const src = `${Array.from({ length: 5000 }, () => "a").join(".")} = 1`;
			let cursor = build(src) as Record<string, unknown>;
			for (let i = 0; i < 4999; i++) {
				cursor = cursor.a as Record<string, unknown>;
			}
			assert.strictEqual(cursor.a, 1);
		});
	});
});
