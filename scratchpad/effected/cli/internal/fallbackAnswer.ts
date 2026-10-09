import * as Effect from "effect/Effect";
import { CliError, Prompt } from "effect/cli";

/**
 * The parameter a fallback stands in for, and its default when there is no one to ask: the shape of
 * `CliPromptFallbackOptions`, stated structurally so this module imports nothing from the modules that use it.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type FallbackTarget<A> = ({ readonly flag: string } | { readonly argument: string }) & {
	readonly otherwise?: A;
};

/**
 * What a fallback hands core when the run is not interactive: `otherwise`, answered, when given (`undefined` counts
 * as not given); otherwise core's own missing-parameter error, so the parse fails exactly as it would with no
 * fallback and `CliRuntime.main` exits `64`. Shared by `CliPrompt.fallback` and `CliUi.fallback`.
 *
 * **Example** (Construct a prompt from a fallback answer)
 *
 * ```ts
 * import { answerWithoutPerson } from "@beep/scratchpad/effected/cli/internal/fallbackAnswer"
 * import * as Effect from "effect/Effect"
 *
 * const prompt = Effect.runSync(answerWithoutPerson({ flag: "name", otherwise: "Ada" }))
 * console.log(Effect.isEffect(prompt)) // true
 * ```
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const answerWithoutPerson = <A>(
	target: FallbackTarget<A>,
): Effect.Effect<Prompt.Prompt<A>, CliError.MissingOption | CliError.MissingArgument> => {
	if ("otherwise" in target && target.otherwise !== undefined) return Effect.succeed(Prompt.succeed(target.otherwise));
	return Effect.fail(
		"flag" in target
			? CliError.MissingOption.make({ option: target.flag })
			: CliError.MissingArgument.make({ argument: target.argument }),
	);
};
