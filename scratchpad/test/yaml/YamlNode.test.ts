import { assert, describe, it } from "@effect/vitest";
import * as P from "effect/Predicate";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as S from "effect/Schema";
import * as O from "effect/Option";
import * as MutableHashMap from "effect/MutableHashMap";
import { Yaml, YamlAlias, YamlMap, YamlPair, YamlScalar, YamlSeq } from "../../effected/yaml/index.ts";

const scalar = (value: unknown, offset: number, length: number) =>
	YamlScalar.make({ value, style: "plain", offset, length });

/**
 * host: localhost
 * ports:
 *   - 8080
 *   - 8443
 */
const tree = () => {
	const host = scalar("localhost", 6, 9);
	const p0 = scalar(8080, 27, 4);
	const p1 = scalar(8443, 36, 4);
	const ports = YamlSeq.make({ items: [p0, p1], style: "block", offset: 25, length: 15 });
	return YamlMap.make({
		items: [
			YamlPair.make({ key: scalar("host", 0, 4), value: host }),
			YamlPair.make({ key: scalar("ports", 16, 5), value: ports }),
		],
		style: "block",
		offset: 0,
		length: 40,
	});
};

describe("YamlNode", () => {
	describe("construction and equality", () => {
		it("constructs via make with tagged structural equality", () => {
			const a = scalar("x", 0, 1);
			const b = scalar("x", 0, 1);
			const c = scalar("y", 0, 1);
			assert.isTrue(Equal.equals(a, b));
			assert.isFalse(Equal.equals(a, c));
			assert.strictEqual(a._tag, "YamlScalar");
		});
	});

	describe("find", () => {
		it("navigates string segments through mappings and numeric segments through sequences", () => {
			const root = tree();
			const port = root.find(["ports", 1]);
			assert.isTrue(O.isSome(port));
			const foundPort = O.getOrThrow(port);
			assert.ok(S.is(YamlScalar)(foundPort));
			assert.strictEqual(foundPort.value, 8443);
		});

		it("returns none for unresolvable segments and wrong container kinds", () => {
			const root = tree();
			assert.isTrue(O.isNone(root.find(["missing"])));
			assert.isTrue(O.isNone(root.find(["host", 0])));
			assert.isTrue(O.isNone(root.find(["ports", 5])));
		});

		it("returns the node itself for the empty path", () => {
			const root = tree();
			assert.strictEqual(O.getOrThrow(root.find([])), root);
		});
	});

	describe("findAtOffset", () => {
		it("finds the deepest node covering the offset with half-open spans", () => {
			const root = tree();
			const atHost = root.findAtOffset(7);
			const host = O.getOrThrow(atHost);
			assert.ok(S.is(YamlScalar)(host));
			assert.strictEqual(host.value, "localhost");
			// End offset is exclusive: offset 40 is outside the root span [0, 40).
			assert.isTrue(O.isNone(root.findAtOffset(40)));
		});

		it("returns none outside the subtree", () => {
			assert.isTrue(O.isNone(tree().findAtOffset(99)));
		});
	});

	describe("pathOf", () => {
		it("returns the path to a descendant matched by reference identity", () => {
			const root = tree();
			const port = O.getOrThrow(root.find(["ports", 0]));
			assert.deepStrictEqual(O.getOrThrow(root.pathOf(port)), ["ports", 0]);
			assert.deepStrictEqual(O.getOrThrow(root.pathOf(root)), []);
		});

		it("returns none for nodes outside the subtree", () => {
			const stranger = scalar("stranger", 0, 8);
			assert.isTrue(O.isNone(tree().pathOf(stranger)));
		});
	});

	describe("toValue", () => {
		it("reconstructs plain values from the subtree", () => {
			assert.deepStrictEqual(tree().toValue(), { host: "localhost", ports: [8080, 8443] });
		});

		it("resolves aliases through the anchor map with incremental registration", () => {
			const anchored = YamlScalar.make({ value: 1, style: "plain", anchor: "x", offset: 6, length: 1 });
			const map = YamlMap.make({
				items: [
					YamlPair.make({ key: scalar("base", 0, 4), value: anchored }),
					YamlPair.make({ key: scalar("ref", 9, 3), value: YamlAlias.make({ name: "x", offset: 14, length: 2 }) }),
				],
				style: "block",
				offset: 0,
				length: 16,
			});
			assert.deepStrictEqual(map.toValue(MutableHashMap.empty()), { base: 1, ref: 1 });
			// Without an anchor map, aliases are unresolvable and yield null.
			assert.deepStrictEqual(map.toValue(), { base: 1, ref: null });
		});

		it("builds __proto__ keys as own data properties", () => {
			const map = YamlMap.make({
				items: [YamlPair.make({ key: scalar("__proto__", 0, 9), value: scalar("v", 11, 1) })],
				style: "block",
				offset: 0,
				length: 12,
			});
			const value = map.toValue();
			assert.ok(P.isObject(value));
			assert.strictEqual(Object.getPrototypeOf(value), Object.prototype);
			assert.isTrue(Object.hasOwn(value, "__proto__"));
		});
	});

	describe("parsed-tree integration", () => {
		it.effect("navigation methods work on engine-produced documents", () =>
			Effect.gen(function* () {
				const text = "server:\n  host: localhost\n  ports:\n    - 8080";
				const value = yield* Yaml.parse(text);
				assert.deepStrictEqual(value, { server: { host: "localhost", ports: [8080] } });
			}),
		);
	});
});
