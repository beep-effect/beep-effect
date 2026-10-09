import { assert, describe, it } from "@effect/vitest";
import * as O from "effect/Option";
import type { CompilerOptions } from "../../effected/tsconfig-json/CompilerOptions.ts";
import { TsEnumCodec } from "../../effected/tsconfig-json/TsEnumCodec.ts";

// Exact R1.6 table rows, transcribed verbatim. `canonical: false` marks a
// forward-only alias: encode must still resolve it, but decode of its value
// must resolve to the row marked `canonical: true` sharing that value, per
// R1.6's "aliases normalize on decode" rule.
interface Row {
	readonly name: string;
	readonly value: number;
	readonly canonical: boolean;
}

const row = (name: string, value: number, canonical = true): Row => ({ name, value, canonical });

const TARGET_ROWS: ReadonlyArray<Row> = [
	row("es5", 1),
	row("es6", 2, false),
	row("es2015", 2),
	row("es2016", 3),
	row("es2017", 4),
	row("es2018", 5),
	row("es2019", 6),
	row("es2020", 7),
	row("es2021", 8),
	row("es2022", 9),
	row("es2023", 10),
	row("es2024", 11),
	row("es2025", 12),
	row("esnext", 99),
];

const MODULE_ROWS: ReadonlyArray<Row> = [
	row("none", 0),
	row("commonjs", 1),
	row("amd", 2),
	row("umd", 3),
	row("system", 4),
	row("es6", 5, false),
	row("es2015", 5),
	row("es2020", 6),
	row("es2022", 7),
	row("esnext", 99),
	row("node16", 100),
	row("node18", 101),
	row("node20", 102),
	row("nodenext", 199),
	row("preserve", 200),
];

const MODULE_RESOLUTION_ROWS: ReadonlyArray<Row> = [
	row("classic", 1),
	row("node", 2, false),
	row("node10", 2),
	row("node16", 3),
	row("nodenext", 99),
	row("bundler", 100),
];

const JSX_ROWS: ReadonlyArray<Row> = [
	row("preserve", 1),
	row("react", 2),
	row("react-native", 3),
	row("react-jsx", 4),
	row("react-jsxdev", 5),
];

const NEW_LINE_ROWS: ReadonlyArray<Row> = [row("crlf", 0), row("lf", 1)];

const MODULE_DETECTION_ROWS: ReadonlyArray<Row> = [row("legacy", 1), row("auto", 2), row("force", 3)];

const WATCH_FILE_ROWS: ReadonlyArray<Row> = [
	row("fixedpollinginterval", 0),
	row("prioritypollinginterval", 1),
	row("dynamicprioritypolling", 2),
	row("fixedchunksizepolling", 3),
	row("usefsevents", 4),
	row("usefseventsonparentdirectory", 5),
];

const WATCH_DIRECTORY_ROWS: ReadonlyArray<Row> = [
	row("usefsevents", 0),
	row("fixedpollinginterval", 1),
	row("dynamicprioritypolling", 2),
	row("fixedchunksizepolling", 3),
];

const FALLBACK_POLLING_ROWS: ReadonlyArray<Row> = [
	row("fixedinterval", 0),
	row("priorityinterval", 1),
	row("dynamicpriority", 2),
	row("fixedchunksize", 3),
];

const FAMILIES = [
	["target", TARGET_ROWS],
	["module", MODULE_ROWS],
	["moduleResolution", MODULE_RESOLUTION_ROWS],
	["jsx", JSX_ROWS],
	["newLine", NEW_LINE_ROWS],
	["moduleDetection", MODULE_DETECTION_ROWS],
	["watchFile", WATCH_FILE_ROWS],
	["watchDirectory", WATCH_DIRECTORY_ROWS],
	["fallbackPolling", FALLBACK_POLLING_ROWS],
] as const;

describe("TsEnumCodec", () => {
	describe("R1.6 tables — every row, both directions", () => {
		for (const [family, rows] of FAMILIES) {
			it(`${family}`, () => {
				for (const { name, value, canonical } of rows) {
					assert.deepStrictEqual(
						TsEnumCodec.encode(family, name),
						O.some(value),
						`encode(${family}, ${name}) should be Option.some(${value})`,
					);
					if (canonical) {
						assert.deepStrictEqual(
							TsEnumCodec.decode(family, value),
							O.some(name),
							`decode(${family}, ${value}) should be Option.some(${name})`,
						);
					}
				}
			});
		}
	});

	describe("aliases", () => {
		it("collapse on encode and canonicalize on decode", () => {
			assert.deepStrictEqual(TsEnumCodec.encode("target", "es6"), O.some(2));
			assert.deepStrictEqual(TsEnumCodec.decode("target", 2), O.some("es2015"));
			assert.deepStrictEqual(TsEnumCodec.decode("moduleResolution", 2), O.some("node10"));
		});
	});

	describe("unknown values", () => {
		it("encode of an unknown string returns Option.none()", () => {
			assert.isTrue(O.isNone(TsEnumCodec.encode("target", "es9999")));
			assert.isTrue(O.isNone(TsEnumCodec.encode("jsx", "none")));
		});

		it("decode of an unknown/future numeric member returns Option.none()", () => {
			assert.isTrue(O.isNone(TsEnumCodec.decode("target", 0))); // es3 — decode-only, no table entry
			assert.isTrue(O.isNone(TsEnumCodec.decode("target", 100))); // JSON — decode-only, no table entry
			assert.isTrue(O.isNone(TsEnumCodec.decode("jsx", 0))); // JsxEmit.None — no tsconfig string
			assert.isTrue(O.isNone(TsEnumCodec.decode("target", 12345)));
		});
	});

	describe("normalizeLibReference", () => {
		it("strips the lib. prefix and .d.ts suffix", () => {
			assert.strictEqual(TsEnumCodec.normalizeLibReference("lib.esnext.d.ts"), "esnext");
		});

		it("strips a leading directory path", () => {
			assert.strictEqual(TsEnumCodec.normalizeLibReference("/x/typescript/lib/lib.dom.iterable.d.ts"), "dom.iterable");
		});

		it("is idempotent on an already-short name", () => {
			assert.strictEqual(TsEnumCodec.normalizeLibReference("esnext"), "esnext");
		});

		it("lowercases a mixed-case short name — tsc lowercases enum values before lookup", () => {
			assert.strictEqual(TsEnumCodec.normalizeLibReference("ESNext"), "esnext");
		});

		it("lowercases before stripping the lib./.d.ts wrapper, regardless of the wrapper's own case", () => {
			assert.strictEqual(TsEnumCodec.normalizeLibReference("LIB.DOM.Iterable.D.TS"), "dom.iterable");
		});
	});

	describe("encodeCompilerOptions", () => {
		it("encodes enum fields to their numeric form and lib to file-name form", () => {
			const encoded = TsEnumCodec.encodeCompilerOptions({ target: "es2023", strict: true, lib: ["esnext"] });
			assert.deepStrictEqual(encoded, { target: 10, strict: true, lib: ["lib.esnext.d.ts"] });
		});

		it("passes boolean/string/array options through untouched", () => {
			const encoded = TsEnumCodec.encodeCompilerOptions({
				strict: true,
				outDir: "./dist",
				types: ["node"],
			});
			assert.deepStrictEqual(encoded, { strict: true, outDir: "./dist", types: ["node"] });
		});

		it("normalizes a mixed-case lib entry before re-encoding to file-name form", () => {
			// `lib`'s decoded type is the canonical-lowercase literal union, so a
			// mixed-case entry can only reach this function by bypassing the
			// schema decode (e.g. hand-assembled options) — exactly the input
			// `normalizeLibReference` must tolerate. Cast past the narrower type
			// to construct that input directly.
			const encoded = TsEnumCodec.encodeCompilerOptions({ lib: ["ESNext"] } as unknown as CompilerOptions.Type);
			assert.deepStrictEqual(encoded, { lib: ["lib.esnext.d.ts"] });
		});

		it("encodes every enum family present in compilerOptions", () => {
			const encoded = TsEnumCodec.encodeCompilerOptions({
				target: "es2015",
				module: "nodenext",
				moduleResolution: "bundler",
				jsx: "react-jsx",
				newLine: "lf",
				moduleDetection: "force",
			});
			assert.deepStrictEqual(encoded, {
				target: 2,
				module: 199,
				moduleResolution: 100,
				jsx: 4,
				newLine: 1,
				moduleDetection: 3,
			});
		});
	});

	describe("decodeCompilerOptions", () => {
		it("inverts encodeCompilerOptions", () => {
			const decoded = TsEnumCodec.decodeCompilerOptions({ target: 10, strict: true, lib: ["lib.esnext.d.ts"] });
			assert.deepStrictEqual(decoded, { target: "es2023", strict: true, lib: ["esnext"] });
		});

		it("drops unmappable numeric values to passthrough rather than erroring", () => {
			const decoded = TsEnumCodec.decodeCompilerOptions({ target: 12345, strict: true });
			assert.deepStrictEqual(decoded, { target: 12345, strict: true });
		});

		it("passes unknown keys through untouched", () => {
			const decoded = TsEnumCodec.decodeCompilerOptions({ futureOption: 42 });
			assert.deepStrictEqual(decoded, { futureOption: 42 });
		});
	});
});
