import { $ScratchpadId } from "@beep/identity/packages";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Schema from "effect/Schema";
import { detectAgent, detectCi } from "./internal/agentCi.ts";
import { normalizeEnv, readEnv } from "./internal/envRecord.ts";
import { allKeys } from "./internal/keys.ts";
import { detectOsc8 } from "./internal/osc8/detect.ts";

const $I = $ScratchpadId.create("effected/env/RuntimeEnv");

const isProvider = (
	source: Readonly<Record<string, string | undefined>> | ConfigProvider.ConfigProvider,
): source is ConfigProvider.ConfigProvider => P.isFunction(source.load);

/**
 * An `Option` field that encodes `None` as `null` and decodes when its key is absent, so a persisted snapshot keeps
 * decoding after a field is added.
 */
const optionField = <S extends Schema.Constraint>(schema: S) =>
	Schema.OptionFromNullOr(schema).pipe(Schema.withDecodingDefaultTypeKey(Effect.succeedNone));

/**
 * The CI providers a {@link RuntimeEnv} names: `github-actions` when `GITHUB_ACTIONS` is set, `generic` for any other
 * CI signal (`CI`, `CONTINUOUS_INTEGRATION`).
 *
 * @public
 */
export type CiName = "github-actions" | "generic";

/**
 * A snapshot of who is running the program: the agent, the CI, and the terminal.
 *
 * @remarks
 * Each field is an `Option` in memory and `null` when absent on the wire, so the snapshot persists as plain JSON
 * through `Schema.fromJsonString(RuntimeEnv)`. Every field decodes when its key is absent, so a persisted snapshot
 * keeps decoding after a field is added. Built from `Config` only (no stream is consulted), so it is safe inside a
 * stdio MCP server.
 *
 * @public
 */
export class RuntimeEnv extends Schema.Class<RuntimeEnv>($I`RuntimeEnv`)({
	/**
	 * The AI agent running the process, as its family (`claude` for Claude Code, whatever `AI_AGENT` says it is
	 * beyond that), or `None`.
	 */
	agent: optionField(Schema.String).annotateKey({ description: "The AI agent running the process, as its family (`claude` for Claude Code, whatever `AI_AGENT` says it is beyond that), or `None`." }),
	/** The CI the process runs in: {@link CiName}, so a consumer can match it exhaustively, or `None`. */
	ci: optionField(Schema.Literals(["github-actions", "generic"])).annotateKey({ description: "The CI the process runs in: CiName, so a consumer can match it exhaustively, or `None`." }),
	/** The identified terminal program and its version when it exposes one, or `None`. */
	terminal: optionField(Schema.Struct({ name: Schema.String, version: optionField(Schema.String) })).annotateKey({ description: "The identified terminal program and its version when it exposes one, or `None`." }),
}, $I.annote("RuntimeEnv", { description: "A snapshot of who is running the program: the agent, the CI, and the terminal." })) {
	/**
	 * The snapshot of an environment record, as a pure function: no `Config`, no `process`, no service.
	 *
	 * @remarks
	 * It is what {@link CurrentRuntimeEnv.layer} computes from the variables it reads, so the two agree on the same
	 * record. An `undefined` or empty value reads as unset, under every caller. Use it where a service is in the
	 * way: a long-lived host that holds its own environment record, or a renderer with no Effect context.
	 *
	 * @param env - variable name to value
	 */
	static fromRecord(env: Readonly<Record<string, string | undefined>>): RuntimeEnv {
		const clean = normalizeEnv(env);
		return RuntimeEnv.make({
			agent: detectAgent(clean),
			ci: detectCi(clean),
			terminal: detectOsc8(clean, false, false).terminal,
		});
	}
}

/**
 * The fields {@link CurrentRuntimeEnv.layerTest} can override.
 *
 * @public
 */
export interface RuntimeEnvOverrides {
	/** Replaces the detected agent. */
	readonly agent?: O.Option<string>;
	/** Replaces the detected CI. */
	readonly ci?: O.Option<CiName>;
	/** Replaces the detected terminal. */
	readonly terminal?: O.Option<{ readonly name: string; readonly version: O.Option<string> }>;
}

/**
 * The {@link RuntimeEnv} of the running process, as a service.
 *
 * @remarks
 * The service's whole shape is one immutable value, so it is provided with `Layer.succeed` rather than mocked.
 * `layer` reads the ambient `ConfigProvider` once when it is built; `layerTest` is the only way a test changes the
 * environment.
 *
 * @example
 * ```ts
 * import { CurrentRuntimeEnv } from "./index.ts"
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 *
 * const program = Effect.gen(function* () {
 * 	const env = yield* CurrentRuntimeEnv
 * 	return O.getOrElse(env.agent, () => "no agent")
 * }).pipe(Effect.provide(CurrentRuntimeEnv.layerTest({ agent: O.some("claude") })))
 * ```
 *
 * @public
 */
export class CurrentRuntimeEnv extends Context.Service<CurrentRuntimeEnv, RuntimeEnv>()(
	$I`CurrentRuntimeEnv`,
) {
	/**
	 * Reads the environment through `Config` once, when the layer is built. Requires nothing: the provider is read
	 * from the ambient `ConfigProvider`.
	 *
	 * @remarks
	 * Two things make this a frozen read, and a long-lived host (an MCP server, a watch-mode runner) trips on both.
	 * Core's default `ConfigProvider.fromEnv()` snapshots `process.env` once per process, so a change after the
	 * first read is never seen; and this is one static layer, memoized by reference, so two consumers that provide
	 * different providers in one graph share the first snapshot. Use {@link CurrentRuntimeEnv.layerFrom}, which is
	 * a fresh layer per call and per use, or provide a fresh `ConfigProvider` for every read.
	 */
	static readonly layer: Layer.Layer<CurrentRuntimeEnv> = Layer.effect(
		this,
		Effect.map(readEnv(allKeys), (env) => RuntimeEnv.fromRecord(env)),
	);

	/**
	 * A snapshot of an explicit source: an environment record, or a `ConfigProvider` read instead of the ambient
	 * one.
	 *
	 * @remarks
	 * Each call returns a new layer, and the layer is `Layer.fresh`, so it is built again for every use rather
	 * than shared through the build's memo: two calls with different sources in one graph see different values,
	 * and a provider is read again each time the layer is used. A record is read when the layer is built, never
	 * at the call.
	 *
	 * @param source - a variable-name-to-value record, or a `ConfigProvider`
	 */
	static readonly layerFrom = (
		source: Readonly<Record<string, string | undefined>> | ConfigProvider.ConfigProvider,
	): Layer.Layer<CurrentRuntimeEnv> =>
		Layer.fresh(
			Layer.effect(
				CurrentRuntimeEnv,
				// A record's values are strings, so a function-valued `load` identifies a provider.
				isProvider(source)
					? Effect.map(
							readEnv(allKeys).pipe(
								Effect.provideService(ConfigProvider.ConfigProvider, source),
							),
							(env) => RuntimeEnv.fromRecord(env),
						)
					: Effect.sync(() => RuntimeEnv.fromRecord(source)),
			),
		);

	/**
	 * A fixed snapshot that never touches `Config`: every field is `None` unless `overrides` sets it.
	 *
	 * @param overrides - the fields to set
	 */
	static readonly layerTest = (overrides: RuntimeEnvOverrides = {}): Layer.Layer<CurrentRuntimeEnv> =>
		Layer.succeed(
			CurrentRuntimeEnv,
			RuntimeEnv.make({
				agent: overrides.agent ?? O.none(),
				ci: overrides.ci ?? O.none(),
				terminal: overrides.terminal ?? O.none(),
			}),
		);
}
