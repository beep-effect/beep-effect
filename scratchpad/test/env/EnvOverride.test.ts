import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Logger, Option } from "effect";
import { Audience } from "../../effected/env/Audience.ts";
import { EnvOverride } from "../../effected/env/EnvOverride.ts";

const withEnv = (env: Record<string, string>) =>
	Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env));

const capture = (lines: Array<string>) =>
	Logger.layer([
		Logger.make(({ message }) => {
			lines.push(Array.isArray(message) ? message.join(" ") : String(message));
		}),
	]);

// vitest-agent's console-mode literal sets, the fixture the brief names.
const accepts = {
	human: ["passthrough", "silent", "stream", "agent"],
	agent: ["passthrough", "silent", "agent"],
	ci: ["passthrough", "silent", "ci-annotations"],
} as const;

const read = (env: Record<string, string>, kind: "human" | "agent" | "ci", lines: Array<string> = []) =>
	EnvOverride.read({ envVar: "VITEST_AGENT_CONSOLE", accepts }).pipe(
		Effect.provide(Audience.layerTest(kind)),
		Effect.provide(capture(lines)),
		withEnv(env),
	);

describe("EnvOverride.read", () => {
	it.effect("a value the audience accepts is Some", () =>
		Effect.map(read({ VITEST_AGENT_CONSOLE: "stream" }, "human"), (value) =>
			assert.deepStrictEqual(value, Option.some("stream")),
		),
	);

	it.effect("a value the audience does not accept is None, with one warning naming the accepted values", () => {
		const lines: Array<string> = [];
		return Effect.map(read({ VITEST_AGENT_CONSOLE: "stream" }, "agent", lines), (value) => {
			assert.deepStrictEqual(value, Option.none());
			assert.lengthOf(lines, 1);
			assert.include(lines[0] ?? "", "VITEST_AGENT_CONSOLE=stream");
			assert.include(lines[0] ?? "", "passthrough|silent|agent");
		});
	});

	it.effect("unset is None with no warning", () => {
		const lines: Array<string> = [];
		return Effect.map(read({}, "human", lines), (value) => {
			assert.deepStrictEqual(value, Option.none());
			assert.lengthOf(lines, 0);
		});
	});

	it.effect("an empty value is None with no warning, even when the provider preserves empty strings", () => {
		const lines: Array<string> = [];
		return EnvOverride.read({ envVar: "VITEST_AGENT_CONSOLE", accepts }).pipe(
			Effect.provide(Audience.layerTest("human")),
			Effect.provide(capture(lines)),
			Effect.provideService(
				ConfigProvider.ConfigProvider,
				ConfigProvider.fromUnknown({ VITEST_AGENT_CONSOLE: "" }, { preserveEmptyStrings: true }),
			),
			Effect.tap((value) =>
				Effect.sync(() => {
					assert.deepStrictEqual(value, Option.none());
					assert.lengthOf(lines, 0);
				}),
			),
		);
	});

	it.effect("matching is case-insensitive and returns the accepted literal", () =>
		Effect.map(read({ VITEST_AGENT_CONSOLE: "CI-Annotations" }, "ci"), (value) =>
			assert.deepStrictEqual(value, Option.some("ci-annotations")),
		),
	);

	it("the result type narrows to the union of the accepted literals (type-level)", () => {
		const program = EnvOverride.read({ envVar: "X", accepts });
		type Accepted = "passthrough" | "silent" | "stream" | "agent" | "ci-annotations";
		// Assignable to exactly the five literals: a `string` result would not compile here.
		const ok: Effect.Effect<Option.Option<Accepted>, never, Audience> = program;
		// And not narrower than the union: one literal is too small.
		// @ts-expect-error the union is wider than "stream" alone
		const tooNarrow: Effect.Effect<Option.Option<"stream">, never, Audience> = program;
		assert.isDefined(ok);
		assert.isDefined(tooNarrow);
	});
});

describe("EnvOverride.readResult", () => {
	const result = (env: Record<string, string>, kind: "human" | "agent" | "ci", lines: Array<string> = []) =>
		EnvOverride.readResult({ envVar: "VITEST_AGENT_CONSOLE", accepts }).pipe(
			Effect.provide(Audience.layerTest(kind)),
			Effect.provide(capture(lines)),
			withEnv(env),
		);

	it.effect("an accepted value is accepted, with the audience, and nothing is rejected", () =>
		Effect.map(result({ VITEST_AGENT_CONSOLE: "STREAM" }, "human"), (r) => {
			assert.strictEqual(r.audience, "human");
			assert.deepStrictEqual(r.accepted, Option.some("stream" as const));
			assert.deepStrictEqual(r.rejected, Option.none());
		}),
	);

	it.effect("a rejected value carries the value as written, the audience and the literals it accepts", () =>
		Effect.map(result({ VITEST_AGENT_CONSOLE: "stream" }, "agent"), (r) => {
			assert.deepStrictEqual(r.accepted, Option.none());
			assert.deepStrictEqual(r.rejected, Option.some({ value: "stream", audience: "agent", accepts: accepts.agent }));
			assert.strictEqual(r.audience, "agent");
		}),
	);

	it.effect("unset and empty are neither accepted nor rejected", () =>
		Effect.gen(function* () {
			for (const env of [{}, { VITEST_AGENT_CONSOLE: "" }]) {
				const r = yield* result(env, "ci");
				assert.strictEqual(r.audience, "ci");
				assert.deepStrictEqual(r.accepted, Option.none());
				assert.deepStrictEqual(r.rejected, Option.none());
			}
		}),
	);

	it.effect("never logs, even for a rejected value, where read warns", () => {
		const viaResult: Array<string> = [];
		const viaRead: Array<string> = [];
		return Effect.gen(function* () {
			yield* result({ VITEST_AGENT_CONSOLE: "stream" }, "agent", viaResult);
			yield* read({ VITEST_AGENT_CONSOLE: "stream" }, "agent", viaRead);
			assert.deepStrictEqual(viaResult, []);
			assert.lengthOf(viaRead, 1);
		});
	});

	it.effect("read is the logging convenience over it: same accepted value for every audience and input", () =>
		Effect.gen(function* () {
			for (const kind of ["human", "agent", "ci"] as const) {
				for (const value of ["passthrough", "SILENT", "stream", "agent", "ci-annotations", "nope", ""]) {
					const env = value === "" ? {} : { VITEST_AGENT_CONSOLE: value };
					const r = yield* result(env, kind);
					assert.deepStrictEqual(yield* read(env, kind), r.accepted, `${kind} ${value}`);
				}
			}
		}),
	);
});

describe("EnvOverride.readResult with a source", () => {
	const readFrom = (source: Readonly<Record<string, string | undefined>> | ConfigProvider.ConfigProvider) =>
		EnvOverride.readResult({ envVar: "VITEST_AGENT_CONSOLE", accepts, source }).pipe(
			Effect.provide(Audience.layerTest("human")),
			// The ambient environment says something else: a source wins over it.
			withEnv({ VITEST_AGENT_CONSOLE: "silent" }),
		);

	it.effect("a record is read fresh on every call", () =>
		Effect.gen(function* () {
			const env: Record<string, string | undefined> = { VITEST_AGENT_CONSOLE: "stream" };
			assert.deepStrictEqual((yield* readFrom(env)).accepted, Option.some("stream"));
			env["VITEST_AGENT_CONSOLE"] = "agent";
			assert.deepStrictEqual((yield* readFrom(env)).accepted, Option.some("agent"), "the change is seen");
			env["VITEST_AGENT_CONSOLE"] = undefined;
			const unset = yield* readFrom(env);
			assert.isTrue(Option.isNone(unset.accepted) && Option.isNone(unset.rejected), "an undefined value is unset");
		}),
	);

	it.effect("a ConfigProvider is read in place of the ambient one", () =>
		Effect.gen(function* () {
			const provider = ConfigProvider.fromUnknown({ VITEST_AGENT_CONSOLE: "bogus" });
			const result = yield* readFrom(provider);
			assert.deepStrictEqual(
				Option.map(result.rejected, (rejected) => rejected.value),
				Option.some("bogus"),
			);
		}),
	);

	it.effect("control: without a source the ambient environment is read, as before", () =>
		Effect.gen(function* () {
			const result = yield* EnvOverride.readResult({ envVar: "VITEST_AGENT_CONSOLE", accepts }).pipe(
				Effect.provide(Audience.layerTest("human")),
				withEnv({ VITEST_AGENT_CONSOLE: "silent" }),
			);
			assert.deepStrictEqual(result.accepted, Option.some("silent"));
		}),
	);
});

describe("EnvOverride.readResult: testing a module-level reader (A8)", () => {
	// A host's reader, built once at module level with no `source`: each read takes the fiber's provider.
	const consoleMode = EnvOverride.readResult({ envVar: "VITEST_AGENT_CONSOLE", accepts });
	const under = (env: Record<string, string>) =>
		consoleMode.pipe(Effect.provide(Audience.layerTest("human")), withEnv(env));

	it.effect("one options object, two provided ConfigProviders: each read sees its own", () =>
		Effect.gen(function* () {
			assert.deepStrictEqual((yield* under({ VITEST_AGENT_CONSOLE: "stream" })).accepted, Option.some("stream"));
			assert.deepStrictEqual((yield* under({ VITEST_AGENT_CONSOLE: "silent" })).accepted, Option.some("silent"));
		}),
	);

	it.effect("a host that needs a fixed source builds the options inside a function that takes it", () =>
		Effect.gen(function* () {
			const consoleModeFrom = (source: Readonly<Record<string, string | undefined>>) =>
				EnvOverride.readResult({ envVar: "VITEST_AGENT_CONSOLE", accepts, source });
			const result = yield* consoleModeFrom({ VITEST_AGENT_CONSOLE: "agent" }).pipe(
				Effect.provide(Audience.layerTest("human")),
				withEnv({ VITEST_AGENT_CONSOLE: "silent" }),
			);
			assert.deepStrictEqual(result.accepted, Option.some("agent"));
		}),
	);
});
