import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure, assertSome } from "@effect/vitest/utils";
import {
	TomlParseError,
	TomlStringifyError,
} from "../../effected/toml/index.ts";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ConfigCodecError } from "../../effected/config-file/ConfigCodec.ts";
import { TomlCodec } from "../../effected/config-file/TomlCodec.ts";

describe("TomlCodec", () => {
	it.effect("parses a TOML document", () =>
		Effect.gen(function* () {
			const parsed = yield* TomlCodec.parse(
				'port = 8080\nhost = "localhost"\n',
			);
			assert.deepStrictEqual(parsed, { port: 8080, host: "localhost" });
		}),
	);

	it.effect(
		"wraps a toml parse failure as ConfigCodecError with the cause preserved structurally",
		() =>
			Effect.gen(function* () {
				const error = yield* TomlCodec.parse("port = [unclosed").pipe(
					Effect.asVoid,
					Effect.flip,
				);
				assert.instanceOf(error, ConfigCodecError);
				assert.strictEqual(error.codec, "toml");
				assert.strictEqual(error.operation, "parse");
				assert.isDefined(error.cause);
				assert.notStrictEqual(typeof error.cause, "string");
				// The underlying TomlParseError survives structurally, not as prose.
				assert.instanceOf(error.cause, TomlParseError);
			}),
	);

	it.effect("round-trips through stringify", () =>
		Effect.gen(function* () {
			const text = yield* TomlCodec.stringify({ port: 8080 });
			const parsed = yield* TomlCodec.parse(text);
			assert.deepStrictEqual(parsed, { port: 8080 });
		}),
	);

	it.effect(
		"wraps a toml stringify failure as ConfigCodecError — TOML has no null",
		() =>
			Effect.gen(function* () {
				// The yaml adapter has no cheap stringify-failure case; this codec
				// does, because TOML cannot represent null at all. The structured
				// TomlStringifyError must survive in `cause`, never as prose.
				const error = yield* Effect.flip(TomlCodec.stringify({ port: null }));
				assert.instanceOf(error, ConfigCodecError);
				assert.strictEqual(error.codec, "toml");
				assert.strictEqual(error.operation, "stringify");
				assert.instanceOf(error.cause, TomlStringifyError);
				const cause = error.cause;
				if (!S.is(TomlStringifyError)(cause))
					return assert.fail("expected TomlStringifyError");
				assert.strictEqual(cause.diagnostic.code, "UnsupportedValue");
			}),
	);

	it.effect(
		"never dies on hostile deeply-nested input — trips the parser's nesting-depth cap",
		() =>
			Effect.gen(function* () {
				// The parser caps array/inline-table nesting depth at 256
				// (packages/toml/src/internal/limits.ts MAX_NESTING_DEPTH).
				// 1000 levels of array nesting comfortably exceeds that cap while
				// remaining syntactically valid TOML, so this exercises the depth
				// guard rather than a plain syntax error.
				const depth = 1000;
				const hostile = `bomb = ${"[".repeat(depth)}1${"]".repeat(depth)}`;
				const exit = yield* Effect.exit(TomlCodec.parse(hostile));
				const causeOption = Exit.getCause(exit);
				const failureCause = O.getOrThrow(causeOption);
				assertExitFailure(exit, failureCause);
				assertSome(causeOption, failureCause);
				// A defect here would mean the guard threw instead of failing typed.
				assert.isTrue(Cause.hasFails(failureCause));
				assert.isFalse(Cause.hasDies(failureCause));
				// Confirm this trips the depth guard specifically, not some unrelated
				// syntax failure.
				const error = yield* TomlCodec.parse(hostile).pipe(
					Effect.asVoid,
					Effect.flip,
				);
				assert.instanceOf(error.cause, TomlParseError);
				const cause = error.cause;
				if (!S.is(TomlParseError)(cause))
					return assert.fail("expected TomlParseError");
				assert.isTrue(
					cause.diagnostics.some((d) => d.code === "NestingDepthExceeded"),
				);
			}),
	);
});
