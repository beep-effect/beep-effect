// @effect-diagnostics strictEffectProvide:skip-file processEnv:skip-file
import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Context, Effect, Layer, Option, Schema } from "effect";
import { CurrentRuntimeEnv, RuntimeEnv } from "../../effected/env/RuntimeEnv.ts";

const withEnv = (env: Record<string, string>) =>
	Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env));

describe("RuntimeEnv", () => {
	it.effect("layer reads agent, CI and terminal through Config", () =>
		Effect.gen(function* () {
			const env = yield* CurrentRuntimeEnv;
			assert.deepStrictEqual(env.agent, Option.some("claude"));
			assert.deepStrictEqual(env.ci, Option.some("github-actions"));
			// The name comes from the ported std-osc8 table, where iTerm's entry is named "iTerm.app".
			const terminal = Option.getOrThrow(env.terminal);
			assert.strictEqual(terminal.name, "iTerm.app");
			assert.deepStrictEqual(terminal.version, Option.some("3.5.0"));
		}).pipe(
			Effect.provide(CurrentRuntimeEnv.layer),
			withEnv({ CLAUDECODE: "1", GITHUB_ACTIONS: "true", TERM_PROGRAM: "iTerm.app", TERM_PROGRAM_VERSION: "3.5.0" }),
		),
	);

	it.effect("empty environment → all none", () =>
		Effect.gen(function* () {
			const env = yield* CurrentRuntimeEnv;
			assert.isTrue(Option.isNone(env.agent) && Option.isNone(env.ci) && Option.isNone(env.terminal));
		}).pipe(Effect.provide(CurrentRuntimeEnv.layer), withEnv({})),
	);

	it.effect("a terminal identified without a version has a None version", () =>
		Effect.gen(function* () {
			const env = yield* CurrentRuntimeEnv;
			assert.deepStrictEqual(env.terminal, Option.some({ name: "kitty", version: Option.none() }));
		}).pipe(Effect.provide(CurrentRuntimeEnv.layer), withEnv({ TERM: "xterm-kitty" })),
	);

	it.effect("layerTest overrides without touching Config", () =>
		Effect.gen(function* () {
			const env = yield* CurrentRuntimeEnv;
			assert.deepStrictEqual(env.agent, Option.some("codex"));
			assert.deepStrictEqual(env.ci, Option.none());
			assert.deepStrictEqual(env.terminal, Option.none());
		}).pipe(Effect.provide(CurrentRuntimeEnv.layerTest({ agent: Option.some("codex") })), withEnv({ CI: "true" })),
	);

	it.effect("a ConfigProvider whose reads fail yields an all-none snapshot", () =>
		Effect.gen(function* () {
			const env = yield* CurrentRuntimeEnv;
			assert.deepStrictEqual(env.agent, Option.none());
			assert.deepStrictEqual(env.ci, Option.none());
			assert.deepStrictEqual(env.terminal, Option.none());
		}).pipe(
			Effect.provide(CurrentRuntimeEnv.layer),
			Effect.provideService(
				ConfigProvider.ConfigProvider,
				ConfigProvider.make(() => Effect.fail(new ConfigProvider.SourceError({ message: "boom" }))),
			),
		),
	);

	it("round-trips through JSON text (persistable snapshot)", () => {
		const codec = Schema.fromJsonString(RuntimeEnv);
		const value = RuntimeEnv.make({
			agent: Option.some("claude"),
			ci: Option.none(),
			terminal: Option.some({ name: "iTerm.app", version: Option.some("3.5.0") }),
		});
		const json = Schema.encodeSync(codec)(value);
		assert.strictEqual(json, '{"agent":"claude","ci":null,"terminal":{"name":"iTerm.app","version":"3.5.0"}}');
		assert.deepStrictEqual(Schema.decodeSync(codec)(json), value);
	});

	// The frozen 0.1.0 wire form, exactly as that version's encoder emits it. A snapshot persisted then must keep
	// decoding: fields added later have to decode when absent. This literal is the oracle; never regenerate it.
	const FROZEN_0_1_0 = '{"agent":"claude","ci":null,"terminal":{"name":"iTerm.app","version":"3.5.0"}}';

	it("decodes the frozen 0.1.0 wire literal", () => {
		const decoded = Schema.decodeSync(Schema.fromJsonString(RuntimeEnv))(FROZEN_0_1_0);
		assert.deepStrictEqual(decoded.agent, Option.some("claude"));
		assert.deepStrictEqual(decoded.ci, Option.none());
		assert.deepStrictEqual(decoded.terminal, Option.some({ name: "iTerm.app", version: Option.some("3.5.0") }));
		assert.strictEqual(Schema.encodeSync(Schema.fromJsonString(RuntimeEnv))(decoded), FROZEN_0_1_0);
	});

	// A second frozen 0.1.0 literal, with a CI named: `ci` was a plain string then, and `github-actions` is one of the
	// two values 0.1.0 ever wrote. Like the first, never regenerate it.
	const FROZEN_0_1_0_CI = '{"agent":"codex","ci":"github-actions","terminal":null}';

	it("decodes the frozen 0.1.0 wire literal that names a CI, and encodes it back identically", () => {
		const decoded = Schema.decodeSync(Schema.fromJsonString(RuntimeEnv))(FROZEN_0_1_0_CI);
		assert.deepStrictEqual(decoded.agent, Option.some("codex"));
		assert.deepStrictEqual(decoded.ci, Option.some("github-actions"));
		assert.deepStrictEqual(decoded.terminal, Option.none());
		assert.strictEqual(Schema.encodeSync(Schema.fromJsonString(RuntimeEnv))(decoded), FROZEN_0_1_0_CI);
	});

	it("every field decodes when its key is absent, so an older or sparser snapshot keeps decoding", () => {
		const codec = Schema.fromJsonString(RuntimeEnv);
		const empty = Schema.decodeSync(codec)("{}");
		assert.deepStrictEqual([empty.agent, empty.ci, empty.terminal], [Option.none(), Option.none(), Option.none()]);
		const partial = Schema.decodeSync(codec)('{"agent":"claude"}');
		assert.deepStrictEqual(partial.agent, Option.some("claude"));
		assert.deepStrictEqual(partial.ci, Option.none());
		assert.deepStrictEqual(partial.terminal, Option.none());
		const noVersion = Schema.decodeSync(codec)('{"terminal":{"name":"kitty"}}');
		assert.deepStrictEqual(noVersion.terminal, Option.some({ name: "kitty", version: Option.none() }));
	});

	it("ci is the literal union github-actions | generic: both decode and encode, and anything else is rejected", () => {
		const codec = Schema.fromJsonString(RuntimeEnv);
		for (const ci of ["github-actions", "generic"] as const) {
			const decoded = Schema.decodeSync(codec)(`{"agent":null,"ci":"${ci}","terminal":null}`);
			assert.deepStrictEqual(decoded.ci, Option.some(ci));
			assert.strictEqual(Schema.encodeSync(codec)(decoded), `{"agent":null,"ci":"${ci}","terminal":null}`);
		}
		for (const bad of ["jenkins", "", "GITHUB-ACTIONS", "true"]) {
			assert.throws(
				() => Schema.decodeSync(codec)(`{"agent":null,"ci":"${bad}","terminal":null}`),
				Error,
				"github-actions",
				bad,
			);
		}
	});

	it("consumers match ci exhaustively: the compiler knows both names", () => {
		const describeCi = (ci: RuntimeEnv["ci"]): string =>
			Option.match(ci, {
				onNone: () => "none",
				onSome: (name) => {
					switch (name) {
						case "github-actions":
							return "gha";
						case "generic":
							return "ci";
						default: {
							// Reached only if the type grew a name this switch does not handle: `name` would not be `never`.
							const unreachable: never = name;
							return unreachable;
						}
					}
				},
			});
		assert.strictEqual(describeCi(Option.some("github-actions")), "gha");
		assert.strictEqual(describeCi(Option.some("generic")), "ci");
		assert.strictEqual(describeCi(Option.none()), "none");
		const unknown = () =>
			// @ts-expect-error a CI that is not one of the two names is not a RuntimeEnv
			RuntimeEnv.make({ agent: Option.none(), ci: Option.some("jenkins"), terminal: Option.none() });
		assert.throws(unknown);
	});

	it("round-trips the all-none snapshot", () => {
		const codec = Schema.fromJsonString(RuntimeEnv);
		const value = RuntimeEnv.make({ agent: Option.none(), ci: Option.none(), terminal: Option.none() });
		assert.strictEqual(Schema.encodeSync(codec)(value), '{"agent":null,"ci":null,"terminal":null}');
		assert.deepStrictEqual(Schema.decodeSync(codec)('{"agent":null,"ci":null,"terminal":null}'), value);
	});
});

const RECORDS: ReadonlyArray<Record<string, string>> = [
	{},
	{ CLAUDECODE: "1" },
	{ AI_AGENT: "claude-code_2-1-285_agent" },
	{ AI_AGENT: "mystery-agent" },
	{ GITHUB_ACTIONS: "true" },
	{ CI: "true" },
	{ CONTINUOUS_INTEGRATION: "1", TERM_PROGRAM: "iTerm.app", TERM_PROGRAM_VERSION: "3.5.0" },
	{ TERM: "xterm-kitty" },
	{ CLAUDECODE: "1", GITHUB_ACTIONS: "true", TERM_PROGRAM: "vscode", TERM_PROGRAM_VERSION: "1.99.0" },
	{ AI_AGENT: "", CI: "", CLAUDECODE: "", GITHUB_ACTIONS: "" },
	// An empty variable is unset for the terminal too: no version, and no program name to identify.
	{ TERM_PROGRAM: "iTerm.app", TERM_PROGRAM_VERSION: "" },
	{ TERM_PROGRAM: "", TERM: "xterm-kitty" },
];

describe("RuntimeEnv.fromRecord", () => {
	for (const record of RECORDS) {
		it.effect(`equals what the layer reads from the same record: ${JSON.stringify(record)}`, () =>
			Effect.gen(function* () {
				const viaLayer = yield* CurrentRuntimeEnv;
				assert.deepStrictEqual(RuntimeEnv.fromRecord(record), viaLayer);
			}).pipe(Effect.provide(CurrentRuntimeEnv.layer), withEnv(record)),
		);
	}

	it("an empty string and an undefined value both read as unset", () => {
		const unset = RuntimeEnv.fromRecord({});
		assert.deepStrictEqual(RuntimeEnv.fromRecord({ AI_AGENT: "", CI: "", GITHUB_ACTIONS: "", CLAUDECODE: "" }), unset);
		assert.deepStrictEqual(RuntimeEnv.fromRecord({ AI_AGENT: undefined, CI: undefined, CLAUDECODE: undefined }), unset);
		// Control: a non-empty value is not unset.
		assert.notDeepEqual(RuntimeEnv.fromRecord({ CLAUDECODE: "1" }), unset);
	});

	it("never reads the process environment", () => {
		const before = process.env.CLAUDECODE;
		process.env.CLAUDECODE = "1";
		try {
			assert.deepStrictEqual(RuntimeEnv.fromRecord({}), RuntimeEnv.fromRecord({}));
			assert.isTrue(Option.isNone(RuntimeEnv.fromRecord({}).agent));
		} finally {
			if (before === undefined) delete process.env.CLAUDECODE;
			else process.env.CLAUDECODE = before;
		}
	});
});

describe("CurrentRuntimeEnv.layerFrom", () => {
	class First extends Context.Service<First, Option.Option<string>>()("@beep/scratchpad/test/env/RuntimeEnv.test/First") {}
	class Second extends Context.Service<Second, Option.Option<string>>()("@beep/scratchpad/test/env/RuntimeEnv.test/Second") {}
	const envOf = Effect.gen(function* () {
		return yield* CurrentRuntimeEnv;
	});
	const agentOf = Effect.map(envOf, (env) => env.agent);

	it.effect("a record source is read without the ambient provider", () =>
		Effect.gen(function* () {
			assert.deepStrictEqual((yield* CurrentRuntimeEnv).agent, Option.none());
		}).pipe(Effect.provide(CurrentRuntimeEnv.layerFrom({})), withEnv({ CLAUDECODE: "1" })),
	);

	it.effect("a ConfigProvider source is read instead of the ambient one", () =>
		Effect.gen(function* () {
			assert.deepStrictEqual((yield* CurrentRuntimeEnv).agent, Option.some("claude"));
		}).pipe(Effect.provide(CurrentRuntimeEnv.layerFrom(ConfigProvider.fromUnknown({ CLAUDECODE: "1" }))), withEnv({})),
	);

	it.effect("a record source agrees with fromRecord", () =>
		Effect.gen(function* () {
			for (const record of RECORDS) {
				const viaLayer = yield* envOf.pipe(Effect.provide(CurrentRuntimeEnv.layerFrom(record)));
				assert.deepStrictEqual(viaLayer, RuntimeEnv.fromRecord(record));
			}
		}),
	);

	it.effect("two calls with different records in ONE graph see different values", () =>
		Effect.gen(function* () {
			const graph = Layer.mergeAll(
				Layer.effect(First, agentOf).pipe(Layer.provide(CurrentRuntimeEnv.layerFrom({ CLAUDECODE: "1" }))),
				Layer.effect(Second, agentOf).pipe(Layer.provide(CurrentRuntimeEnv.layerFrom({ AI_AGENT: "codex" }))),
			);
			const context = yield* Layer.build(graph);
			assert.deepStrictEqual(Context.get(context, First), Option.some("claude"));
			assert.deepStrictEqual(Context.get(context, Second), Option.some("codex"));
		}).pipe(Effect.scoped),
	);

	it.effect("control: CurrentRuntimeEnv.layer is ONE shared snapshot, so the second provider is never read", () =>
		Effect.gen(function* () {
			const graph = Layer.mergeAll(
				Layer.effect(First, agentOf).pipe(
					Layer.provide(CurrentRuntimeEnv.layer),
					Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ CLAUDECODE: "1" }))),
				),
				Layer.effect(Second, agentOf).pipe(
					Layer.provide(CurrentRuntimeEnv.layer),
					Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ AI_AGENT: "codex" }))),
				),
			);
			const context = yield* Layer.build(graph);
			assert.deepStrictEqual(Context.get(context, First), Context.get(context, Second));
		}).pipe(Effect.scoped),
	);

	it.effect("the same layerFrom value used twice in one graph is read twice: each use sees the provider as it is", () =>
		Effect.gen(function* () {
			let reads = 0;
			const counting = ConfigProvider.make((path) => {
				reads += 1;
				return ConfigProvider.fromUnknown({ CLAUDECODE: "1" }).load(path);
			});
			const shared = CurrentRuntimeEnv.layerFrom(counting);
			const graph = Layer.mergeAll(
				Layer.effect(First, agentOf).pipe(Layer.provide(shared)),
				Layer.effect(Second, agentOf).pipe(Layer.provide(shared)),
			);
			yield* Layer.build(graph);
			const perBuild = reads / 2;
			assert.isAbove(perBuild, 0);
			assert.strictEqual(Number.isInteger(perBuild), true);
			// A single build reads each key once; two uses read it twice as often.
			let single = 0;
			const once = ConfigProvider.make((path) => {
				single += 1;
				return ConfigProvider.fromUnknown({ CLAUDECODE: "1" }).load(path);
			});
			yield* Layer.build(Layer.effect(First, agentOf).pipe(Layer.provide(CurrentRuntimeEnv.layerFrom(once))));
			assert.strictEqual(reads, single * 2);
		}).pipe(Effect.scoped),
	);
});
