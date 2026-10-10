import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { RuntimeEnv } from "./RuntimeEnv.ts";
import { CurrentRuntimeEnv } from "./RuntimeEnv.ts";

const $I = $ScratchpadId.create("effected/env/Audience");

/**
 * Who the output is for: a person at a terminal, an AI agent, or a CI job.
 *
 * **Example** (Validate an audience literal)
 *
 * ```ts
 * import { AudienceKind } from "@beep/scratchpad/effected/env/Audience";
 * import * as S from "effect/Schema";
 * console.log(S.is(AudienceKind)("agent")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const AudienceKind = LiteralKit(["human", "agent", "ci"]).annotate(
	$I.annote("AudienceKind", { description: "Who the output is for: a person at a terminal, an AI agent, or a CI job." }),
);

/**
 * Identifies whether output is intended for a human, an AI agent, or CI.
 *
 * @category type-level
 * @since 0.0.0
 */
export type AudienceKind = typeof AudienceKind.Type;

/**
 * What decided the audience: an environment override, detection, or a flag.
 *
 * **Example** (Validate a flag source)
 *
 * ```ts
 * import { AudienceSource } from "@beep/scratchpad/effected/env/Audience";
 * import * as S from "effect/Schema";
 * console.log(S.is(AudienceSource)("flag")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AudienceSource = LiteralKit(["override", "detected", "flag"]).annotate(
	$I.annote("AudienceSource", { description: "What decided the audience: an environment override, detection, or a flag." }),
);

/**
 * Identifies whether an override, detection, or a flag selected the audience.
 *
 * @category type-level
 * @since 0.0.0
 */
export type AudienceSource = typeof AudienceSource.Type;

const isAudienceKind = S.is(AudienceKind);

/**
 * The shape of the {@link Audience} service: one immutable value.
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export interface AudienceShape {
	/** Who the output is for. */
	readonly kind: AudienceKind;
	/**
	 * What decided the kind: the override environment variable, detection, or a flag. `Audience.layer` produces
	 * `override` or `detected`; `flag` is for a layer stacked on top (a CLI's `--audience` flag re-provides
	 * `Audience`), which lets its own consumers tell what spoke last.
	 */
	readonly source: AudienceSource;
}

/**
 * The options {@link Audience.layer} takes.
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export interface AudienceOptions {
	/** The environment variable that overrides detection; without it the audience is always detected. */
	readonly envVar?: string;
}

/**
 * Who the output is for, decided once.
 *
 * **Details**
 *
 * Precedence: a valid override environment variable, then an agent, then CI, then a human, so an agent inside a
 * CI job gets agent output. A human typing a command inside an agent-detected shell is still detected as an
 * agent, never refused: the override variable flips it back. The shape is one immutable value, so the service is
 * provided with `Layer.succeed` and there is no `Layer.mock` to reach for.
 *
 * **Example** (Read the audience kind and detection source)
 *
 * ```ts
 * import { Audience } from "@beep/scratchpad/effected/env/Audience";
 * import * as Effect from "effect/Effect";
 * const program = Effect.map(Audience, (value) => `${value.kind} (${value.source})`).pipe(
 *   Effect.provide(Audience.layerTest("agent", "detected")),
 * );
 * console.log(Effect.runSync(program)) // agent (detected)
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class Audience extends Context.Service<Audience, AudienceShape>()($I`Audience`) {
	/**
	 * Decide the audience from `CurrentRuntimeEnv`, and from the override variable named by `options.envVar`.
	 *
	 * **Details**
	 *
	 * The variable is read through `Config`, lower-cased and matched against `human`, `agent` and `ci`. An empty
	 * or absent variable is unset. An invalid value logs one warning through `Effect.logWarning` and falls back to
	 * detection; it never fails the run. That warning is once per layer build, so building the layer a second time
	 * warns again. The warning goes through `Effect.logWarning`, and Effect's default logger writes to stdout unless
	 * `References.LogToStderr` is set: an MCP server or any stdio-sensitive host must route logs to stderr (the `cli`
	 * package's `CliLogger` does). Without `options.envVar` the audience is always detected. A layer-returning function
	 * mints a fresh layer per call: call it once and bind the result to a constant.
	 *
	 * **Example** (Detect an agent through a runtime layer)
	 *
	 * ```ts
	 * import { Audience } from "@beep/scratchpad/effected/env/Audience";
	 * import { CurrentRuntimeEnv } from "@beep/scratchpad/effected/env/RuntimeEnv";
	 * import * as Effect from "effect/Effect";
	 * import * as Layer from "effect/Layer";
	 * import * as O from "effect/Option";
	 * const AudienceLive = Audience.layer().pipe(
	 *   Layer.provide(CurrentRuntimeEnv.layerTest({ agent: O.some("claude") })),
	 * );
	 * const program = Effect.map(Audience, (value) => value.kind).pipe(Effect.provide(AudienceLive));
	 * console.log(Effect.runSync(program)) // agent
	 * ```
	 *
	 * @param options - `envVar` names the override variable
	 * @category layers
	 * @since 0.0.0
	 */
	static layer(options?: AudienceOptions): Layer.Layer<Audience, never, CurrentRuntimeEnv> {
		return Layer.effect(
			Audience,
			Effect.gen(function* () {
				const runtimeEnv = yield* CurrentRuntimeEnv;
				const detected: AudienceShape = { kind: Audience.detect(runtimeEnv), source: "detected" };
				const envVar = options?.envVar;
				if (envVar === undefined) return detected;

				const raw = yield* Config.option(Config.String(envVar)).pipe(Effect.orElseSucceed(O.none<string>));
				if (O.isNone(raw) || raw.value === "") return detected;

				const value = Str.toLowerCase(raw.value);
				if (isAudienceKind(value)) return { kind: value, source: "override" } satisfies AudienceShape;

				yield* Effect.logWarning(`${envVar}=${raw.value} is not one of ${A.join(AudienceKind.literals, "|")}; ignoring it`);
				return detected;
			}),
		);
	}

	/**
	 * A fixed audience that touches neither `CurrentRuntimeEnv` nor `Config`.
	 *
	 * **Details**
	 *
	 * `source` defaults to `override`, since a test that fixes the kind has decided it. Pass `detected` to test a
	 * layer stacked on top, such as a CLI flag that only applies when the environment variable did not decide, or
	 * `flag` to test a consumer of that layer's result.
	 *
	 * **Example** (Fix a flag-selected audience)
	 *
	 * ```ts
	 * import { Audience } from "@beep/scratchpad/effected/env/Audience";
	 * import * as Effect from "effect/Effect";
	 * const program = Effect.map(Audience, (value) => value.source).pipe(
	 *   Effect.provide(Audience.layerTest("ci", "flag")),
	 * );
	 * console.log(Effect.runSync(program)) // flag
	 * ```
	 *
	 * @param kind - the audience to fix
	 * @param source - what decided it: `override` (the default), `detected`, or `flag`
	 * @category layers
	 * @since 0.0.0
	 */
	static readonly layerTest = (
		kind: AudienceKind,
		source: AudienceShape["source"] = "override",
	): Layer.Layer<Audience> => Layer.succeed(Audience, { kind, source });

	/**
	 * The audience a {@link RuntimeEnv} implies, ignoring any override: an agent, else CI, else a human.
	 *
	 * **Example** (Prefer an agent over CI)
	 *
	 * ```ts
	 * import { Audience } from "@beep/scratchpad/effected/env/Audience";
	 * import { RuntimeEnv } from "@beep/scratchpad/effected/env/RuntimeEnv";
	 * const env = RuntimeEnv.fromRecord({ AI_AGENT: "claude", CI: "1" });
	 * console.log(Audience.detect(env)) // agent
	 * ```
	 *
	 * @param env - the runtime snapshot to decide from
	 * @category utilities
	 * @since 0.0.0
	 */
	static readonly detect = (env: RuntimeEnv): AudienceKind =>
		O.isSome(env.agent) ? "agent" : O.isSome(env.ci) ? "ci" : "human";
}
