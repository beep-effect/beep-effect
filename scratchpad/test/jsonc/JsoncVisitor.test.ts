import { assert, describe, it } from "@effect/vitest";
import { assertDefined } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { Jsonc, JsoncParseOptions, JsoncVisitor, JsoncVisitorEvent } from "@beep/scratchpad/effected/jsonc/index";

describe("JsoncVisitor", () => {
	describe("visit", () => {
		it.effect("emits a well-formed event sequence for an object", () =>
			Effect.gen(function* () {
				const events = yield* Stream.runCollect(JsoncVisitor.visit('{ "a": 1 }'));
				const tags = events.map((e) => e._tag);
				assert.deepStrictEqual(tags, ["ObjectBegin", "ObjectProperty", "Separator", "LiteralValue", "ObjectEnd"]);
			}),
		);

		it.effect("carries path context on literal events", () =>
			Effect.gen(function* () {
				const events = yield* Stream.runCollect(JsoncVisitor.visit('{ "a": { "b": 42 } }'));
				const literal = events.find(JsoncVisitorEvent.guards.LiteralValue);
				assert.isDefined(literal);
				assert.deepStrictEqual([...(literal?.path ?? [])], ["a", "b"]);
				assert.strictEqual(literal?.value, 42);
			}),
		);

		it.effect("filter + take enables early termination", () =>
			Effect.gen(function* () {
				const events = yield* JsoncVisitor.visit('{ "a": 1, "b": 2, "c": 3 }').pipe(
					Stream.filter(JsoncVisitorEvent.guards.LiteralValue),
					Stream.take(1),
					Stream.runCollect,
				);
				assert.strictEqual(events.length, 1);
				assertDefined(events[0]);
				assert.strictEqual(events[0].value, 1);
			}),
		);

		it.effect("surfaces malformed input as Error events in the union", () =>
			Effect.gen(function* () {
				const events = yield* Stream.runCollect(JsoncVisitor.visit("{ bad }"));
				assert.isTrue(events.some(JsoncVisitorEvent.guards.Error));
			}),
		);

		it.effect("emits Comment events by default and Error when comments are disallowed", () =>
			Effect.gen(function* () {
				const withComments = yield* Stream.runCollect(JsoncVisitor.visit('{ "a": 1 } // c'));
				assert.isTrue(withComments.some(JsoncVisitorEvent.guards.Comment));

				const disallowed = yield* Stream.runCollect(
					JsoncVisitor.visit('{ "a": 1 } // c', JsoncParseOptions.make({ disallowComments: true })),
				);
				assert.isTrue(disallowed.some((e) => JsoncVisitorEvent.guards.Error(e) && e.code === "InvalidCommentToken"));
			}),
		);
	});

	describe("event constructors", () => {
		it("build tagged, structurally-equal events", () => {
			const event = JsoncVisitorEvent.cases.Comment.make({ offset: 0, length: 3 });
			assert.strictEqual(event._tag, "Comment");
			assert.strictEqual(event.offset, 0);
		});
	});

	describe("malformed-input recovery", () => {
		it.effect("terminates with bounded events on an invalid array element", () =>
			Effect.gen(function* () {
				const events = yield* Stream.runCollect(JsoncVisitor.visit("[@]"));
				const errorTags = events.filter((e) => e._tag === "Error");
				assert.isAbove(errorTags.length, 0);
				// The stream must end — a non-consuming recovery loops forever here.
				assert.isBelow(events.length, 10);
			}),
		);

		it.effect("does not consume a container closer during recovery", () =>
			Effect.gen(function* () {
				const events = yield* Stream.runCollect(JsoncVisitor.visit('{ "a": }'));
				const tags = events.map((e) => e._tag);
				assert.include(tags, "Error");
				assert.include(tags, "ObjectEnd");
			}),
		);

		it.effect("emits EndOfFileExpected for trailing top-level tokens", () =>
			Effect.gen(function* () {
				const events = yield* Stream.runCollect(JsoncVisitor.visit("1 2"));
				const error = events.find((e) => e._tag === "Error");
				assert.isDefined(error);
				assert.strictEqual(error?._tag === "Error" ? error.code : undefined, "EndOfFileExpected");
			}),
		);

		it.effect("deeply nested input yields a NestingDepthExceeded Error event, never a stack-overflow defect", () =>
			Effect.gen(function* () {
				const deep = `${"[".repeat(20000)}1${"]".repeat(20000)}`;
				// The stream is infallible by design (errors are in-band events), so
				// it must complete — the depth guard turns the overflow into an event.
				const result = yield* JsoncVisitor.visit(deep).pipe(Stream.runCollect, Effect.result);
				assert.isTrue(result._tag === "Success");
				const events = yield* Stream.runCollect(JsoncVisitor.visit(deep));
				assert.isTrue(events.some((e) => JsoncVisitorEvent.guards.Error(e) && e.code === "NestingDepthExceeded"));
			}),
		);

		it.effect("keeps literal values stable for trailing-backslash unterminated strings", () =>
			Effect.gen(function* () {
				const withPrefix = yield* Stream.runCollect(JsoncVisitor.visit('"abc\\'));
				const withPrefixLiteral = withPrefix.find(JsoncVisitorEvent.guards.LiteralValue);
				assert.isDefined(withPrefixLiteral);
				assert.strictEqual(withPrefixLiteral?._tag === "LiteralValue" ? withPrefixLiteral.value : undefined, "abc");
				assert.isTrue(withPrefix.some((e) => JsoncVisitorEvent.guards.Error(e) && e.code === "UnexpectedEndOfString"));

				const emptyPrefix = yield* Stream.runCollect(JsoncVisitor.visit('"\\'));
				const emptyPrefixLiteral = emptyPrefix.find(JsoncVisitorEvent.guards.LiteralValue);
				assert.isDefined(emptyPrefixLiteral);
				assert.strictEqual(emptyPrefixLiteral?._tag === "LiteralValue" ? emptyPrefixLiteral.value : undefined, "");
				assert.isTrue(emptyPrefix.some((e) => JsoncVisitorEvent.guards.Error(e) && e.code === "UnexpectedEndOfString"));
			}),
		);
	});

	describe("visitCollect replacement", () => {
		it.effect("Stream.filter + runCollect covers the dropped convenience", () =>
			Effect.gen(function* () {
				const props = yield* JsoncVisitor.visit('{ "name": "x", "age": 1 }').pipe(
					Stream.filter(JsoncVisitorEvent.guards.ObjectProperty),
					Stream.map((e) => e.property),
					Stream.runCollect,
				);
				assert.deepStrictEqual([...props], ["name", "age"]);
				// Sanity: parity with a full parse.
				assert.deepStrictEqual(yield* Jsonc.parse('{ "name": "x", "age": 1 }'), { name: "x", age: 1 });
			}),
		);
	});
});
