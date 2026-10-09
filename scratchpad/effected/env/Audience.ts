import { $ScratchpadId } from "@beep/identity/packages";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import type { RuntimeEnv } from "./RuntimeEnv.ts";
import { CurrentRuntimeEnv } from "./RuntimeEnv.ts";

const $I = $ScratchpadId.create("effected/env/Audience");

/**
 * Who the output is for: a person at a terminal, an AI agent, or a CI job.
 *
 * @public
 */
export type AudienceKind = "human" | "agent" | "ci";

/**
 * The shape of the {@link Audience} service: one immutable value.
 *
 * @public
 */
export interface AudienceShape {
	/** Who the output is for. */
	readonly kind: AudienceKind;
	/**
	 * What decided the kind: the override environment variable, detection, or a flag. `Audience.layer` produces
	 * `override` or `detected`; `flag` is for a layer stacked on top (a CLI's `--audience` flag re-provides
	 * `Audience`), which lets its own consumers tell what spoke last.
	 */
	readonly source: "override" | "detected" | "flag";
}

/**
 * The options {@link Audience.layer} takes.
 *
 * @public
 */
export interface AudienceOptions {
	/** The environment variable that overrides detection; without it the audience is always detected. */
	readonly envVar?: string;
}

const KINDS: ReadonlyArray<AudienceKind> = ["human", "agent", "ci"];

/**
 * Who the output is for, decided once.
 *
 * @remarks
 * Precedence: a valid override environment variable, then an agent, then CI, then a human, so an agent inside a
 * CI job gets agent output. A human typing a command inside an agent-detected shell is still detected as an
 * agent, never refused: the override variable flips it back. The shape is one immutable value, so the service is
 * provided with `Layer.succeed` and there is no `Layer.mock` to reach for.
 *
 * @example
 * ```ts
 * import { Audience, CurrentRuntimeEnv } from "./index.ts"
 * import { Effect, Layer } from "effect"
 *
 * const AudienceLive = Audience.layer({ envVar: "MYTOOL_AUDIENCE" }).pipe(Layer.provide(CurrentRuntimeEnv.layer))
 *
 * const program = Effect.gen(function* () {
 * 	const { kind, source } = yield* Audience
 * 	return `${kind} (${source})`
 * }).pipe(Effect.provide(AudienceLive))
 * ```
 *
 * @public
 */
export class Audience extends Context.Service<Audience, AudienceShape>()($I`Audience`) {
	/**
	 * Decide the audience from `CurrentRuntimeEnv`, and from the override variable named by `options.envVar`.
	 *
	 * @remarks
	 * The variable is read through `Config`, lower-cased and matched against `human`, `agent` and `ci`. An empty
	 * or absent variable is unset. An invalid value logs one warning through `Effect.logWarning` and falls back to
	 * detection; it never fails the run. That warning is once per layer build, so building the layer a second time
	 * warns again. The warning goes through `Effect.logWarning`, and Effect's default logger writes to stdout unless
	 * `References.LogToStderr` is set: an MCP server or any stdio-sensitive host must route logs to stderr (the `cli`
	 * package's `CliLogger` does). Without `options.envVar` the audience is always detected. A layer-returning function
	 * mints a fresh layer per call: call it once and bind the result to a constant.
	 *
	 * @param options - `envVar` names the override variable
	 */
	static layer(options?: AudienceOptions): Layer.Layer<Audience, never, CurrentRuntimeEnv> {
		return Layer.effect(
			Audience,
			Effect.gen(function* () {
				const runtimeEnv = yield* CurrentRuntimeEnv;
				const detected: AudienceShape = { kind: Audience.detect(runtimeEnv), source: "detected" };
				const envVar = options?.envVar;
				if (envVar === undefined) return detected;

				const raw = yield* Config.option(Config.String(envVar)).pipe(Effect.orElseSucceed(() => O.none<string>()));
				if (O.isNone(raw) || raw.value === "") return detected;

				const value = raw.value.toLowerCase();
				const kind = KINDS.find((candidate) => candidate === value);
				if (kind !== undefined) return { kind, source: "override" } satisfies AudienceShape;

				yield* Effect.logWarning(`${envVar}=${raw.value} is not one of ${KINDS.join("|")}; ignoring it`);
				return detected;
			}),
		);
	}

	/**
	 * A fixed audience that touches neither `CurrentRuntimeEnv` nor `Config`.
	 *
	 * @remarks
	 * `source` defaults to `override`, since a test that fixes the kind has decided it. Pass `detected` to test a
	 * layer stacked on top, such as a CLI flag that only applies when the environment variable did not decide, or
	 * `flag` to test a consumer of that layer's result.
	 *
	 * @param kind - the audience to fix
	 * @param source - what decided it: `override` (the default), `detected`, or `flag`
	 */
	static readonly layerTest = (
		kind: AudienceKind,
		source: AudienceShape["source"] = "override",
	): Layer.Layer<Audience> => Layer.succeed(Audience, { kind, source });

	/**
	 * The audience a {@link RuntimeEnv} implies, ignoring any override: an agent, else CI, else a human.
	 *
	 * @param env - the runtime snapshot to decide from
	 */
	static readonly detect = (env: RuntimeEnv): AudienceKind =>
		O.isSome(env.agent) ? "agent" : O.isSome(env.ci) ? "ci" : "human";
}
