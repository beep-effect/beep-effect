import { assert, describe, it } from "@effect/vitest";
import { Cause, Effect, Exit, Option, Result, Schema } from "effect";
import { ConfigCodecError } from "../../effected/config-file/ConfigCodec.ts";
import { JsonCodec } from "../../effected/config-file/JsonCodec.ts";

const JsonValue = Schema.fromJsonString(Schema.Unknown);

describe("JsonCodec", () => {
	it.effect("parses valid JSON to an unknown value", () =>
		Effect.gen(function* () {
			const parsed = yield* JsonCodec.parse(`{"port":8080}`);
			assert.deepStrictEqual(parsed, { port: 8080 });
		}),
	);

	it.effect("stringifies a value back to JSON text", () =>
		Effect.gen(function* () {
			const text = yield* JsonCodec.stringify({ port: 8080 });
			assert.deepStrictEqual(Result.getOrThrow(Schema.decodeResult(JsonValue)(text)), { port: 8080 });
		}),
	);

	it.effect("fails with ConfigCodecError carrying a structured cause, not a string", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(Effect.asVoid(JsonCodec.parse("{ not json")));
			assert.instanceOf(error, ConfigCodecError);
			assert.strictEqual(error._tag, "ConfigCodecError");
			assert.strictEqual(error.codec, "json");
			assert.strictEqual(error.operation, "parse");
			// The underlying SyntaxError survives structurally.
			assert.instanceOf(error.cause, SyntaxError);
		}),
	);

	it.effect("fails with operation: stringify on a circular value", () =>
		Effect.gen(function* () {
			const circular: Record<string, unknown> = {};
			circular.self = circular;
			const error = yield* Effect.flip(JsonCodec.stringify(circular));
			assert.strictEqual(error.operation, "stringify");
			assert.instanceOf(error.cause, TypeError);
		}),
	);

	it.effect("never dies — malformed input fails through the typed channel", () =>
		Effect.gen(function* () {
			const exit = yield* Effect.exit(JsonCodec.parse("{ not json"));
			assert.isTrue(Exit.isFailure(exit));
			// A defect would mean the parser threw instead of failing typed: assert the
			// cause is a genuine Fail reason, not a Die reason.
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
});
