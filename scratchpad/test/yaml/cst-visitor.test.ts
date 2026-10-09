import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { isMap, isScalar, isSeq, parseDocument, type Node } from "yaml";
import { cstEvents } from "../../effected/yaml/internal/cst-visitor.ts";
import { YamlVisitor, YamlVisitorEvent } from "../../effected/yaml/YamlVisitor.ts";

/** Independently project the oracle AST, including omitted flow values. */
function projectOracle(node: Node | null | undefined, keys: unknown[], values: unknown[]): void {
	if (isMap(node)) {
		for (const pair of node.items) {
			keys.push(isScalar(pair.key) ? pair.key.value : null);
			if (isScalar(pair.value) && pair.value.value !== null) values.push(String(pair.value.value));
			if (isMap(pair.value) || isSeq(pair.value)) projectOracle(pair.value, keys, values);
		}
	} else if (isSeq(node)) {
		for (const item of node.items) {
			if (isMap(item) || isSeq(item)) projectOracle(item, keys, values);
		}
	}
}

const projections = [
	{ name: "compact mappings in a sequence", source: "- a: 1\n- b: 2\n", keys: ["a", "b"], values: ["1", "2"] },
	{ name: "sibling first key and nested mappings", source: "a:\n  b: 1\n  c: 2\nd: 3\n", keys: ["a", "b", "c", "d"], values: ["1", "2", "3"] },
	{ name: "omitted block value", source: "a:\nb: 2\n", keys: ["a", "b"], values: ["2"] },
	{ name: "omitted flow value", source: "{a: , b: 2}", keys: ["a", "b"], values: ["2"] },
	{ name: "consecutive omitted block values", source: "a:\nb:\nc: 3\nd:\n", keys: ["a", "b", "c", "d"], values: ["3"] },
	{ name: "consecutive omitted flow values", source: "{a: , b: , c: 3, d: }", keys: ["a", "b", "c", "d"], values: ["3"] },
	{ name: "compact mapping with omitted value", source: "- a:\n  b: 2\n", keys: ["a", "b"], values: ["2"] },
	{ name: "multiline scalar value", source: "a:\n  x\nb: 2\n", keys: ["a", "b"], values: ["x", "2"] },
	{ name: "nested mapping with omitted value", source: "a:\n  b: 1\n  c:\n  d: 2\ne: 3\n", keys: ["a", "b", "c", "d", "e"], values: ["1", "2", "3"] },
];

describe("CST key/value projections", () => {
	for (const { name, source, keys, values } of projections) {
		it.effect(name, () => Effect.gen(function* () {
			const events = [...cstEvents(source)];
			const cstKeys = events.filter((event) => event._tag === "CstKeyEvent").map((event) => event.source);
			const cstValues = events.filter((event) => event._tag === "CstValueEvent").map((event) => event.source);
			assert.deepStrictEqual(cstKeys, keys);
			assert.deepStrictEqual(cstValues, values);
			const oracle = parseDocument(source);
			assert.deepStrictEqual(oracle.errors, []);
			const oracleKeys: unknown[] = [];
			const oracleValues: unknown[] = [];
			projectOracle(oracle.contents, oracleKeys, oracleValues);
			assert.deepStrictEqual(oracleKeys, cstKeys);
			assert.deepStrictEqual(oracleValues, cstValues);
			// Compact/block projections also agree with the lab AST. The oracle
			// above covers omitted flow values independently of the composer.
			if (!source.startsWith("{")) {
				const astEvents = yield* Stream.runCollect(YamlVisitor.visit(source));
				const pairs = astEvents.filter(YamlVisitorEvent.$is("Pair"));
				assert.deepStrictEqual(pairs.map((pair) => pair.key), cstKeys);
				assert.deepStrictEqual(pairs.filter((pair) => pair.value !== null).map((pair) => String(pair.value)), cstValues);
			}
		}));
	}
});
