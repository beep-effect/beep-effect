import { assert, describe, it, vi } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { CurrentRuntimeEnv, RuntimeEnv } from "../../effected/env/RuntimeEnv.ts";

const runtimeEnvJson = S.fromJsonString(RuntimeEnv);

const withEnv = (env: Record<string, string>) =>
	Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env));

describe("RuntimeEnv", () => {
	it.layer(
		CurrentRuntimeEnv.layer.pipe(
			Layer.provide(
				ConfigProvider.layer(
					ConfigProvider.fromUnknown({
						CLAUDECODE: "1",
						GITHUB_ACTIONS: "true",
						TERM_PROGRAM: "iTerm.app",
						TERM_PROGRAM_VERSION: "3.5.0",
					}),
				),
			),
		),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("layer reads agent, CI and terminal through Config", () =>
			Effect.gen(function* () {
				const env = yield* CurrentRuntimeEnv;
				assertSome(env.agent, "claude");
				assertSome(env.ci, "github-actions");
				// The name comes from the ported std-osc8 table, where iTerm's entry is named "iTerm.app".
				const terminal = O.getOrThrow(env.terminal);
				assert.strictEqual(terminal.name, "iTerm.app");
				assertSome(terminal.version, "3.5.0");
			}),
		);
	});

	it.layer(CurrentRuntimeEnv.layer.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({})))), {
		timeout: "30 seconds",
	})((it) => {
		it.effect("empty environment → all none", () =>
			Effect.gen(function* () {
				const env = yield* CurrentRuntimeEnv;
				assertNone(env.agent);
				assertNone(env.ci);
				assertNone(env.terminal);
			}),
		);
	});

	it.layer(
		CurrentRuntimeEnv.layer.pipe(
			Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ TERM: "xterm-kitty" }))),
		),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("a terminal identified without a version has a None version", () =>
			Effect.gen(function* () {
				const env = yield* CurrentRuntimeEnv;
				assertSome(env.terminal, { name: "kitty", version: O.none() });
			}),
		);
	});

	it.layer(CurrentRuntimeEnv.layerTest({ agent: O.some("codex") }), { timeout: "30 seconds" })((it) => {
		it.effect("layerTest overrides without touching Config", () =>
			Effect.gen(function* () {
				const env = yield* CurrentRuntimeEnv;
				assertSome(env.agent, "codex");
				assertNone(env.ci);
				assertNone(env.terminal);
			}).pipe(withEnv({ CI: "true" })),
		);
	});

	it.layer(
		CurrentRuntimeEnv.layer.pipe(
			Layer.provide(
				ConfigProvider.layer(
					ConfigProvider.make(() => Effect.fail(new ConfigProvider.SourceError({ message: "boom" }))),
				),
			),
		),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("a ConfigProvider whose reads fail yields an all-none snapshot", () =>
			Effect.gen(function* () {
				const env = yield* CurrentRuntimeEnv;
				assertNone(env.agent);
				assertNone(env.ci);
				assertNone(env.terminal);
			}),
		);
	});

	it("round-trips through JSON text (persistable snapshot)", () => {
		const codec = S.fromJsonString(RuntimeEnv);
		const value = RuntimeEnv.make({
			agent: O.some("claude"),
			ci: O.none(),
			terminal: O.some({ name: "iTerm.app", version: O.some("3.5.0") }),
		});
		const json = Result.getOrThrow(S.encodeResult(codec)(value));
		assert.strictEqual(json, '{"agent":"claude","ci":null,"terminal":{"name":"iTerm.app","version":"3.5.0"}}');
		assert.deepStrictEqual(Result.getOrThrow(S.decodeResult(codec)(json)), value);
	});

	// The frozen 0.1.0 wire form, exactly as that version's encoder emits it. A snapshot persisted then must keep
	// decoding: fields added later have to decode when absent. This literal is the oracle; never regenerate it.
	const FROZEN_0_1_0 = '{"agent":"claude","ci":null,"terminal":{"name":"iTerm.app","version":"3.5.0"}}';

	it("decodes the frozen 0.1.0 wire literal", () => {
		const decoded = Result.getOrThrow(S.decodeResult(runtimeEnvJson)(FROZEN_0_1_0));
		assertSome(decoded.agent, "claude");
		assertNone(decoded.ci);
		assertSome(decoded.terminal, { name: "iTerm.app", version: O.some("3.5.0") });
		assert.strictEqual(Result.getOrThrow(S.encodeResult(runtimeEnvJson)(decoded)), FROZEN_0_1_0);
	});

	// A second frozen 0.1.0 literal, with a CI named: `ci` was a plain string then, and `github-actions` is one of the
	// two values 0.1.0 ever wrote. Like the first, never regenerate it.
	const FROZEN_0_1_0_CI = '{"agent":"codex","ci":"github-actions","terminal":null}';

	it("decodes the frozen 0.1.0 wire literal that names a CI, and encodes it back identically", () => {
		const decoded = Result.getOrThrow(S.decodeResult(runtimeEnvJson)(FROZEN_0_1_0_CI));
		assertSome(decoded.agent, "codex");
		assertSome(decoded.ci, "github-actions");
		assertNone(decoded.terminal);
		assert.strictEqual(Result.getOrThrow(S.encodeResult(runtimeEnvJson)(decoded)), FROZEN_0_1_0_CI);
	});

	it("every field decodes when its key is absent, so an older or sparser snapshot keeps decoding", () => {
		const codec = S.fromJsonString(RuntimeEnv);
		const empty = Result.getOrThrow(S.decodeResult(codec)("{}"));
		assertNone(empty.agent);
		assertNone(empty.ci);
		assertNone(empty.terminal);
		const partial = Result.getOrThrow(S.decodeResult(codec)('{"agent":"claude"}'));
		assertSome(partial.agent, "claude");
		assertNone(partial.ci);
		assertNone(partial.terminal);
		const noVersion = Result.getOrThrow(S.decodeResult(codec)('{"terminal":{"name":"kitty"}}'));
		assertSome(noVersion.terminal, { name: "kitty", version: O.none() });
	});

	it("ci is the literal union github-actions | generic: both decode and encode, and anything else is rejected", () => {
		const codec = S.fromJsonString(RuntimeEnv);
		for (const ci of ["github-actions", "generic"] as const) {
			const decoded = Result.getOrThrow(S.decodeResult(codec)(`{"agent":null,"ci":"${ci}","terminal":null}`));
			assertSome(decoded.ci, ci);
			assert.strictEqual(
				Result.getOrThrow(S.encodeResult(codec)(decoded)),
				`{"agent":null,"ci":"${ci}","terminal":null}`,
			);
		}
		for (const bad of ["jenkins", "", "GITHUB-ACTIONS", "true"]) {
			assert.throws(
				() => Result.getOrThrow(S.decodeResult(codec)(`{"agent":null,"ci":"${bad}","terminal":null}`)),
				Error,
				"github-actions",
				bad,
			);
		}
	});

	it("consumers match ci exhaustively: the compiler knows both names", () => {
		const describeCi = (ci: RuntimeEnv["ci"]): string =>
			O.match(ci, {
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
		assert.strictEqual(describeCi(O.some("github-actions")), "gha");
		assert.strictEqual(describeCi(O.some("generic")), "ci");
		assert.strictEqual(describeCi(O.none()), "none");
		const rejectsUnknownCi: "jenkins" extends O.Option.Value<RuntimeEnv["ci"]> ? false : true = true;
		assert.isTrue(rejectsUnknownCi);
		const unknown = () =>
			Reflect.apply(RuntimeEnv.make, RuntimeEnv, [{ agent: O.none(), ci: O.some("jenkins"), terminal: O.none() }]);
		assert.throws(unknown);
	});

	it("round-trips the all-none snapshot", () => {
		const codec = S.fromJsonString(RuntimeEnv);
		const value = RuntimeEnv.make({ agent: O.none(), ci: O.none(), terminal: O.none() });
		assert.strictEqual(Result.getOrThrow(S.encodeResult(codec)(value)), '{"agent":null,"ci":null,"terminal":null}');
		assert.deepStrictEqual(Result.getOrThrow(S.decodeResult(codec)('{"agent":null,"ci":null,"terminal":null}')), value);
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
		it.layer(CurrentRuntimeEnv.layer.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(record)))), {
			timeout: "30 seconds",
		})((it) => {
			it.effect(`equals what the layer reads from the same record: ${JSON.stringify(record)}`, () =>
				Effect.gen(function* () {
					const viaLayer = yield* CurrentRuntimeEnv;
					assert.deepStrictEqual(RuntimeEnv.fromRecord(record), viaLayer);
				}),
			);
		});
	}

	it("an empty string and an undefined value both read as unset", () => {
		const unset = RuntimeEnv.fromRecord({});
		assert.deepStrictEqual(RuntimeEnv.fromRecord({ AI_AGENT: "", CI: "", GITHUB_ACTIONS: "", CLAUDECODE: "" }), unset);
		assert.deepStrictEqual(RuntimeEnv.fromRecord({ AI_AGENT: undefined, CI: undefined, CLAUDECODE: undefined }), unset);
		// Control: a non-empty value is not unset.
		assert.notDeepEqual(RuntimeEnv.fromRecord({ CLAUDECODE: "1" }), unset);
	});

	it("never reads the process environment", () => {
		vi.stubEnv("CLAUDECODE", "1");
		try {
			assert.deepStrictEqual(RuntimeEnv.fromRecord({}), RuntimeEnv.fromRecord({}));
			assertNone(RuntimeEnv.fromRecord({}).agent);
		} finally {
			vi.unstubAllEnvs();
		}
	});
});

describe("CurrentRuntimeEnv.layerFrom", () => {
	class First extends Context.Service<First, O.Option<string>>()("@beep/scratchpad/test/env/RuntimeEnv.test/First") {}
	class Second extends Context.Service<Second, O.Option<string>>()(
		"@beep/scratchpad/test/env/RuntimeEnv.test/Second",
	) {}
	const envOf = CurrentRuntimeEnv;
	const agentOf = Effect.map(envOf, (env) => env.agent);

	it.layer(
		CurrentRuntimeEnv.layerFrom({}).pipe(
			Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ CLAUDECODE: "1" }))),
		),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("a record source is read without the ambient provider", () =>
			Effect.gen(function* () {
				assertNone((yield* CurrentRuntimeEnv).agent);
			}),
		);
	});

	it.layer(
		CurrentRuntimeEnv.layerFrom(ConfigProvider.fromUnknown({ CLAUDECODE: "1" })).pipe(
			Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({}))),
		),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("a ConfigProvider source is read instead of the ambient one", () =>
			Effect.gen(function* () {
				assertSome((yield* CurrentRuntimeEnv).agent, "claude");
			}),
		);
	});

	class Snapshots extends Context.Service<Snapshots, ReadonlyArray<RuntimeEnv>>()(
		"@beep/scratchpad/test/env/RuntimeEnv.test/Snapshots",
	) {}
	it.layer(
		Layer.effect(
			Snapshots,
			Effect.forEach(RECORDS, (record) =>
				Layer.build(CurrentRuntimeEnv.layerFrom(record)).pipe(
					Effect.map((context) => Context.get(context, CurrentRuntimeEnv)),
				),
			),
		),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("a record source agrees with fromRecord", () =>
			Effect.gen(function* () {
				const snapshots = yield* Snapshots;
				for (const [index, record] of RECORDS.entries()) {
					assert.deepStrictEqual(snapshots[index], RuntimeEnv.fromRecord(record));
				}
			}),
		);
	});
	it.effect("two calls with different records in ONE graph see different values", () =>
		Effect.gen(function* () {
			const graph = Layer.mergeAll(
				Layer.effect(First, agentOf).pipe(Layer.provide(CurrentRuntimeEnv.layerFrom({ CLAUDECODE: "1" }))),
				Layer.effect(Second, agentOf).pipe(Layer.provide(CurrentRuntimeEnv.layerFrom({ AI_AGENT: "codex" }))),
			);
			const context = yield* Layer.build(graph);
			assertSome(Context.get(context, First), "claude");
			assertSome(Context.get(context, Second), "codex");
		}),
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
		}),
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
		}),
	);
});
