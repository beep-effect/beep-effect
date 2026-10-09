import { assert, describe, it } from "@effect/vitest";
import { JsoncParseError } from "../../effected/jsonc/index.ts";
import { Cause, Effect, Exit, Option } from "effect";
import { ConfigCodecError } from "../../effected/config-file/ConfigCodec.ts";
import { JsoncCodec } from "../../effected/config-file/JsoncCodec.ts";

describe("JsoncCodec", () => {
	it.effect("parses JSONC with comments and trailing commas", () =>
		Effect.gen(function* () {
			const parsed = yield* JsoncCodec.parse(`{
				// the port to listen on
				"port": 8080,
			}`);
			assert.deepStrictEqual(parsed, { port: 8080 });
		}),
	);

	it.effect("wraps a jsonc parse failure as ConfigCodecError with the cause preserved structurally", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(Effect.asVoid(JsoncCodec.parse("{ not jsonc")));
			assert.instanceOf(error, ConfigCodecError);
			assert.strictEqual(error.codec, "jsonc");
			assert.strictEqual(error.operation, "parse");
			assert.isDefined(error.cause);
			assert.notStrictEqual(typeof error.cause, "string");
			// The underlying JsoncParseError survives structurally, not as prose.
			assert.instanceOf(error.cause, JsoncParseError);
		}),
	);

	it.effect("round-trips through stringify", () =>
		Effect.gen(function* () {
			const text = yield* JsoncCodec.stringify({ port: 8080 });
			const parsed = yield* JsoncCodec.parse(text);
			assert.deepStrictEqual(parsed, { port: 8080 });
		}),
	);

	it.effect("never dies on hostile deeply-nested input — fails through the typed channel", () =>
		Effect.gen(function* () {
			const depth = 5000;
			const hostile = `${"[".repeat(depth)}1${"]".repeat(depth)}`;
			const exit = yield* Effect.exit(JsoncCodec.parse(hostile));
			assert.isTrue(Exit.isFailure(exit));
			if (Exit.isFailure(exit)) {
				const cause = Exit.getCause(exit);
				assert.isTrue(Option.isSome(cause));
				if (Option.isSome(cause)) {
					assert.isTrue(Cause.hasFails(cause.value));
					assert.isFalse(Cause.hasDies(cause.value));
				}
			}
		}),
	);

	it.effect("wraps a stringify failure as ConfigCodecError with the cause preserved", () =>
		Effect.gen(function* () {
			const circular: Record<string, unknown> = {};
			circular.self = circular;
			const error = yield* Effect.flip(JsoncCodec.stringify(circular));
			assert.instanceOf(error, ConfigCodecError);
			assert.strictEqual(error.codec, "jsonc");
			assert.strictEqual(error.operation, "stringify");
			// Structural, never stringified: a string has no prototype chain to TypeError.
			assert.instanceOf(error.cause, TypeError);
		}),
	);
});
