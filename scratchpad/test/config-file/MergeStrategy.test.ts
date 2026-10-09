import { assert, describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import type { ConfigSource } from "../../effected/config-file/MergeStrategy.ts";
import { MergeStrategy } from "../../effected/config-file/MergeStrategy.ts";

const JsonValue = S.fromJsonString(S.Unknown);

const src = <A>(path: string, resolver: string, value: A): ConfigSource<A> => ({ path, resolver, value });

describe("MergeStrategy.firstMatch", () => {
	it.effect("returns the value of the first (highest-priority) source", () =>
		Effect.gen(function* () {
			const strategy = MergeStrategy.firstMatch<{ port: number }>();
			const value = yield* strategy.resolve([
				src("/a/.apprc", "walk", { port: 1 }),
				src("/etc/apprc", "system", { port: 2 }),
			]);
			assert.deepStrictEqual(value, { port: 1 });
		}),
	);
});

describe("MergeStrategy.layeredMerge", () => {
	it.effect("deep-merges with earlier sources winning on conflict", () =>
		Effect.gen(function* () {
			const strategy = MergeStrategy.layeredMerge<Record<string, unknown>>();
			const value = yield* strategy.resolve([
				src("/a", "walk", { port: 1, nested: { a: 1 } }),
				src("/etc", "system", { port: 2, host: "x", nested: { a: 9, b: 2 } }),
			]);
			assert.deepStrictEqual(value, { port: 1, host: "x", nested: { a: 1, b: 2 } });
		}),
	);

	it.effect("a single source merges to itself", () =>
		Effect.gen(function* () {
			const strategy = MergeStrategy.layeredMerge<Record<string, unknown>>();
			const value = yield* strategy.resolve([src("/a", "walk", { port: 1 })]);
			assert.deepStrictEqual(value, { port: 1 });
		}),
	);

	it.effect("preserves validated own constructor and prototype fields, including nested fields", () =>
		Effect.gen(function* () {
			const Fields = S.Struct({ constructor: S.String, prototype: S.String });
			const Document = S.Struct({ constructor: S.String, prototype: S.String, port: S.Finite, section: Fields });
			const higher = yield* S.decodeEffect(Document)({
				constructor: "higher constructor", prototype: "higher prototype", port: 3,
				section: { constructor: "higher nested constructor", prototype: "higher nested prototype" },
			});
			const lower = yield* S.decodeEffect(Document)({
				constructor: "lower constructor", prototype: "lower prototype", port: 9,
				section: { constructor: "lower nested constructor", prototype: "lower nested prototype" },
			});
			const strategy = MergeStrategy.layeredMerge<typeof Document.Type>();
			const value = yield* strategy.resolve([src("/a", "walk", higher), src("/etc", "system", lower)]);
			assert.isTrue(S.is(Document)(value));
			assert.deepStrictEqual(value, higher);
			assert.isTrue(R.has(value, "constructor"));
			assert.isTrue(R.has(value, "prototype"));
			assert.isTrue(R.has(value.section, "constructor"));
			assert.isTrue(R.has(value.section, "prototype"));
		}),
	);

	it.effect("copies lower-priority own constructor and prototype fields absent from the higher source", () =>
		Effect.gen(function* () {
			const Fields = S.Struct({ constructor: S.String, prototype: S.String });
			const Document = S.Struct({
				constructor: S.String, prototype: S.String, port: S.Finite, section: Fields,
			});
			const higher = { port: 3, section: { constructor: "higher" } };
			const lower = {
				constructor: "lower constructor", prototype: "lower prototype", port: 9, section: { prototype: "lower" },
			};
			const strategy = MergeStrategy.layeredMerge<Record<string, unknown>>();
			const value = yield* strategy.resolve([src("/a", "walk", higher), src("/etc", "system", lower)]);
			if (!S.is(Document)(value)) return assert.fail("merged fields must be schema-valid");
			assert.deepStrictEqual(value, {
				constructor: "lower constructor", prototype: "lower prototype", port: 3,
				section: { constructor: "higher", prototype: "lower" },
			});
			assert.isTrue(R.has(value, "constructor"));
			assert.isTrue(R.has(value, "prototype"));
			assert.isTrue(R.has(value.section, "constructor"));
			assert.isTrue(R.has(value.section, "prototype"));
		}),
	);

	it.effect("copies own data fields without invoking inherited getters or setters", () =>
		Effect.gen(function* () {
			class Document {
				get prototype(): string {
					return assert.fail("must not read an inherited getter");
				}
				set prototype(_value: string) {
					assert.fail("must not invoke an inherited setter");
				}
			}
			const higher = new Document();
			const lower = new Document();
			Object.defineProperty(lower, "prototype", { value: "own data", enumerable: true });
			const strategy = MergeStrategy.layeredMerge<Document>();
			const value = yield* strategy.resolve([src("/a", "walk", higher), src("/etc", "system", lower)]);
			assert.instanceOf(value, Document);
			assert.isTrue(R.has(value, "prototype"));
			assert.strictEqual(value.prototype, "own data");
		}),
	);

	it.effect("does not merge across a non-object value — higher priority wins whole", () =>
		Effect.gen(function* () {
			const strategy = MergeStrategy.layeredMerge<unknown>();
			const value = yield* strategy.resolve([src("/a", "walk", 5), src("/etc", "system", { port: 2 })]);
			assert.strictEqual(value, 5);
		}),
	);

	it.effect("does not merge arrays element-wise — higher priority replaces", () =>
		Effect.gen(function* () {
			const strategy = MergeStrategy.layeredMerge<Record<string, unknown>>();
			const value = yield* strategy.resolve([src("/a", "walk", { xs: [1] }), src("/etc", "system", { xs: [2, 3] })]);
			assert.deepStrictEqual(value, { xs: [1] });
		}),
	);

	it.effect("ignores inherited and __proto__ keys", () =>
		Effect.gen(function* () {
			const strategy = MergeStrategy.layeredMerge<Record<string, unknown>>();
			const malicious = Result.getOrThrow(S.decodeResult(JsonValue)(`{"__proto__":{"polluted":true}}`));
			if (!P.isObject(malicious)) return assert.fail("expected a JSON object");
			const value = yield* strategy.resolve([src("/a", "walk", { ok: 1 }), src("/etc", "system", malicious)]);
			// Assert on the merged value's own prototype chain, not a fresh `{}` —
			// the attack repoints the merged object's own [[Prototype]], it does
			// not touch the shared Object.prototype, so a fresh literal can never
			// observe it.
			assert.strictEqual(Object.getPrototypeOf(value), Object.prototype);
			assert.isUndefined(value.polluted);
			// Defense in depth: the shared prototype really is untouched too.
			const empty: Record<string, unknown> = {};
			assert.isUndefined(empty.polluted);
		}),
	);
});

describe("MergeStrategy.layeredMerge — value identity", () => {
	class Doc extends S.Class<Doc>("Doc")({ port: S.Finite, host: S.String }) {
		get origin(): string {
			return `http://${this.host}:${this.port}`;
		}
	}

	it.effect("preserves the document's class instance and its prototype getters", () =>
		Effect.gen(function* () {
			const strategy = MergeStrategy.layeredMerge<Doc>();
			const value = yield* strategy.resolve([
				src("/a", "walk", Doc.make({ port: 1, host: "a" })),
				src("/etc", "system", Doc.make({ port: 2, host: "b" })),
			]);
			// `load` declares Effect<A>. Returning a structurally-equal POJO would be a lie.
			assert.instanceOf(value, Doc);
			assert.strictEqual(value.origin, "http://a:1");
		}),
	);

	it.effect("a nested Date is atomic — higher priority wins it whole, never spread", () =>
		Effect.gen(function* () {
			const strategy = MergeStrategy.layeredMerge<{ at: Date }>();
			const hi = DateTime.toDateUtc(DateTime.makeUnsafe("2020-01-01T00:00:00.000Z"));
			const lo = DateTime.toDateUtc(DateTime.makeUnsafe("2021-01-01T00:00:00.000Z"));
			const value = yield* strategy.resolve([src("/a", "walk", { at: hi }), src("/etc", "system", { at: lo })]);
			assert.instanceOf(value.at, Date);
			assert.strictEqual(value.at.toISOString(), "2020-01-01T00:00:00.000Z");
		}),
	);

	it.effect("a nested class instance is atomic — higher priority wins it whole", () =>
		Effect.gen(function* () {
			class Section extends S.Class<Section>("Section")({ a: S.Finite, b: S.Finite }) {}
			const strategy = MergeStrategy.layeredMerge<{ db: Section }>();
			const value = yield* strategy.resolve([
				src("/a", "walk", { db: Section.make({ a: 1, b: 1 }) }),
				src("/etc", "system", { db: Section.make({ a: 9, b: 9 }) }),
			]);
			assert.instanceOf(value.db, Section);
			assert.deepStrictEqual({ a: value.db.a, b: value.db.b }, { a: 1, b: 1 });
		}),
	);

	it.effect("a nested Map is atomic", () =>
		Effect.gen(function* () {
			const strategy = MergeStrategy.layeredMerge<{ m: Map<string, number> }>();
			const value = yield* strategy.resolve([
				src("/a", "walk", { m: new Map([["k", 1]]) }),
				src("/etc", "system", { m: new Map([["k", 2]]) }),
			]);
			assert.instanceOf(value.m, Map);
			assert.strictEqual(value.m.get("k"), 1);
		}),
	);
});

describe("MergeStrategy.layeredMerge — prototype pollution via the higher-priority source", () => {
	it.effect("a hostile __proto__ on the HIGHER-priority document cannot reassign the result's prototype", () =>
		Effect.gen(function* () {
			const strategy = MergeStrategy.layeredMerge<Record<string, unknown>>();
			// `deepMerge(higher, merged)` passes the highest-priority document as `target`.
			const hostile = Result.getOrThrow(S.decodeResult(JsonValue)(`{"ok":1,"__proto__":{"polluted":true}}`));
			if (!P.isObject(hostile)) return assert.fail("expected a JSON object");
			const value = yield* strategy.resolve([src("/a", "walk", hostile), src("/etc", "system", { other: 2 })]);

			const proto: unknown = Object.getPrototypeOf(value);
			assert.strictEqual(proto, Object.prototype, "the result's prototype must not be attacker-controlled");
			assert.isUndefined(value.polluted);
			const empty: Record<string, unknown> = {};
			assert.isUndefined(empty.polluted);
		}),
	);

	it.effect("a hostile __proto__ nested under a key absent from the target stays inert", () =>
		Effect.gen(function* () {
			const strategy = MergeStrategy.layeredMerge<Record<string, unknown>>();
			// `section` exists only on the lower-priority source, so it is copied wholesale.
			const lower = Result.getOrThrow(S.decodeResult(JsonValue)(`{"section":{"__proto__":{"polluted":true}}}`));
			if (!P.isObject(lower)) return assert.fail("expected a JSON object");
			const value = yield* strategy.resolve([src("/a", "walk", { ok: 1 }), src("/etc", "system", lower)]);

			const section = value.section;
			if (!P.isObject(section)) return assert.fail("expected a section object");
			assert.strictEqual(Object.getPrototypeOf(section), Object.prototype);
			assert.isUndefined(section.polluted);
			const empty: Record<string, unknown> = {};
			assert.isUndefined(empty.polluted);
		}),
	);
});
