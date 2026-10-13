import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { RunOptions, RunResult, Sandbox } from "../../effected/cli/CliTest.ts";

const runs = { arbitrary: fcRuns(100) };

it.effect.prop("Sandbox round-trips plain subprocess environments", [Arbitrary.schema(Sandbox)], ([value]) =>
	Effect.gen(function* () {
		const encoded = yield* S.encodeEffect(Sandbox)(value);
		const decoded = yield* S.decodeEffect(Sandbox)(encoded);
		assert.deepStrictEqual(decoded, value);
		assert.deepStrictEqual(yield* S.encodeEffect(Sandbox)(decoded), encoded);
	}), runs);

it.effect.prop("RunOptions round-trips and preserves optional-key presence", [Arbitrary.schema(RunOptions)], ([value]) =>
	Effect.gen(function* () {
		const encoded = yield* S.encodeEffect(RunOptions)(value);
		const decoded = yield* S.decodeEffect(RunOptions)(encoded);
		assert.deepStrictEqual(decoded, value);
		assert.deepStrictEqual(yield* S.encodeEffect(RunOptions)(decoded), encoded);
		for (const key of ["cwd", "env", "stdin"]) {
			assert.strictEqual(P.hasProperty(decoded, key), P.hasProperty(value, key));
		}
	}), runs);

it.effect.prop("RunResult round-trips non-zero exits and captured streams", [Arbitrary.schema(RunResult)], ([value]) =>
	Effect.gen(function* () {
		const encoded = yield* S.encodeEffect(RunResult)(value);
		const decoded = yield* S.decodeEffect(RunResult)(encoded);
		assert.deepStrictEqual(decoded, value);
		assert.deepStrictEqual(yield* S.encodeEffect(RunResult)(decoded), encoded);
	}), runs);

it.effect("RunOptions retains absent, undefined and empty overrides as distinct plain objects", () =>
	Effect.gen(function* () {
		const required = { sandbox: { root: "/tmp/cli", home: "/tmp/cli/home", env: {} }, execPath: "/usr/bin/node" };
		for (const value of [required, { ...required, cwd: undefined, env: undefined, stdin: undefined }, { ...required, cwd: "", env: {}, stdin: "" }]) {
			const encoded = yield* S.encodeEffect(RunOptions)(value);
			assert.deepStrictEqual(yield* S.decodeEffect(RunOptions)(encoded), value);
		}
	}));
