import { assert, describe, it } from "@effect/vitest";
import { YamlParseError } from "../../effected/yaml/index.ts";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import { ConfigCodecError } from "../../effected/config-file/ConfigCodec.ts";
import { YamlCodec } from "../../effected/config-file/YamlCodec.ts";

describe("YamlCodec", () => {
	it.effect("parses a YAML document", () =>
		Effect.gen(function* () {
			const parsed = yield* YamlCodec.parse("port: 8080\nhost: localhost\n");
			assert.deepStrictEqual(parsed, { port: 8080, host: "localhost" });
		}),
	);

	it.effect("wraps a yaml parse failure as ConfigCodecError with the cause preserved structurally", () =>
		Effect.gen(function* () {
			const error = yield* YamlCodec.parse("port: [unclosed").pipe(Effect.asVoid, Effect.flip);
			assert.instanceOf(error, ConfigCodecError);
			assert.strictEqual(error.codec, "yaml");
			assert.strictEqual(error.operation, "parse");
			assert.isDefined(error.cause);
			assert.notStrictEqual(typeof error.cause, "string");
			// The underlying YamlParseError survives structurally, not as prose.
			assert.instanceOf(error.cause, YamlParseError);
		}),
	);

	it.effect("round-trips through stringify", () =>
		Effect.gen(function* () {
			const text = yield* YamlCodec.stringify({ port: 8080 });
			const parsed = yield* YamlCodec.parse(text);
			assert.deepStrictEqual(parsed, { port: 8080 });
		}),
	);

	it.effect("never dies on hostile deeply-nested input — trips the composer's nesting-depth cap", () =>
		Effect.gen(function* () {
			// The composer caps collection-nesting depth at 256
			// (packages/yaml/src/internal/composer/state.ts MAX_NESTING_DEPTH).
			// 1000 levels of flow-sequence nesting comfortably exceeds that cap
			// while remaining syntactically valid YAML, so this exercises the
			// depth guard rather than a plain syntax error.
			const depth = 1000;
			const hostile = `${"[".repeat(depth)}1${"]".repeat(depth)}`;
			const exit = yield* Effect.exit(YamlCodec.parse(hostile));
			assert.isTrue(Exit.isFailure(exit));
			if (Exit.isFailure(exit)) {
				const cause = Exit.getCause(exit);
				assert.isTrue(O.isSome(cause));
				if (O.isSome(cause)) {
					assert.isTrue(Cause.hasFails(cause.value));
					assert.isFalse(Cause.hasDies(cause.value));
				}
			}
			// Confirm this trips the depth guard specifically, not some unrelated
			// syntax failure.
			const error = yield* YamlCodec.parse(hostile).pipe(Effect.asVoid, Effect.flip);
			assert.instanceOf(error.cause, YamlParseError);
			const cause = error.cause as YamlParseError;
			assert.isTrue(cause.diagnostics.some((d) => d.code === "NestingDepthExceeded"));
		}),
	);

	it.effect("an alias bomb fails as a typed ConfigCodecError, never a defect — trips the alias-expansion budget", () =>
		Effect.gen(function* () {
			// Six tiers of ten aliases each. The composer's raw alias-token count
			// (packages/yaml/src/internal/composer/anchors.ts) stays at 60 — well
			// under the default maxAliasCount of 100 — so this does not trip that
			// guard. Instead, resolving the aliases multiplies the materialized
			// node count roughly tenfold per tier (~10^6 nodes for the final
			// "bomb" key alone), which blows past the alias-expansion budget of
			// (maxAliasCount + 1) * 10_000 = 1_010_000 output nodes
			// (packages/yaml/src/YamlNode.ts, ALIAS_EXPANSION_FACTOR) — the
			// "billion laughs" guard — before any heap exhaustion occurs.
			const tiers = [
				"a0: &a0 [x, x]",
				"a1: &a1 [*a0,*a0,*a0,*a0,*a0,*a0,*a0,*a0,*a0,*a0]",
				"a2: &a2 [*a1,*a1,*a1,*a1,*a1,*a1,*a1,*a1,*a1,*a1]",
				"a3: &a3 [*a2,*a2,*a2,*a2,*a2,*a2,*a2,*a2,*a2,*a2]",
				"a4: &a4 [*a3,*a3,*a3,*a3,*a3,*a3,*a3,*a3,*a3,*a3]",
				"a5: &a5 [*a4,*a4,*a4,*a4,*a4,*a4,*a4,*a4,*a4,*a4]",
				"bomb: [*a5,*a5,*a5,*a5,*a5,*a5,*a5,*a5,*a5,*a5]",
			];
			const bomb = tiers.join("\n");
			const exit = yield* Effect.exit(YamlCodec.parse(bomb));
			assert.isTrue(Exit.isFailure(exit));
			if (Exit.isFailure(exit)) {
				const cause = Exit.getCause(exit);
				assert.isTrue(O.isSome(cause));
				if (O.isSome(cause)) {
					// A defect here would mean the guard threw instead of failing typed.
					assert.isTrue(Cause.hasFails(cause.value));
					assert.isFalse(Cause.hasDies(cause.value));
				}
			}
			const error = yield* YamlCodec.parse(bomb).pipe(Effect.asVoid, Effect.flip);
			assert.instanceOf(error, ConfigCodecError);
			assert.strictEqual(error.codec, "yaml");
			// Both the composer's raw alias-token guard and the value-extraction
			// alias-expansion budget report the same "AliasCountExceeded" code, so
			// disambiguate on the message: the expansion-budget guard's message
			// reads "expansion exceeded budget", the raw-token guard's reads
			// "count exceeded maximum". This confirms the expansion budget fired,
			// not the (here, unreachable at 60 raw alias tokens) raw-count guard.
			assert.instanceOf(error.cause, YamlParseError);
			const cause = error.cause as YamlParseError;
			assert.isTrue(cause.diagnostics.some((d) => d.code === "AliasCountExceeded"));
			assert.isTrue(cause.diagnostics.some((d) => d.message.includes("expansion exceeded budget")));
		}),
	);
});
