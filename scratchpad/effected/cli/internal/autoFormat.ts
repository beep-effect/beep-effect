import type { AudienceKind } from "../../env/index.ts";
import { CurrentRuntimeEnv } from "../../env/index.ts";
import { Effect, Option } from "effect";

/**
 * Whether the environment says the program runs under GitHub Actions, whose runner reads workflow commands out of
 * the log.
 *
 * @remarks
 * `CurrentRuntimeEnv` is read if the environment has it and is not required: without it, the answer is no.
 *
 * @internal
 */
export const underGithubActions: Effect.Effect<boolean> = Effect.gen(function* () {
	const runtime = yield* Effect.serviceOption(CurrentRuntimeEnv);
	return Option.contains(
		Option.flatMap(runtime, (env) => env.ci),
		"github-actions",
	);
});

/**
 * The renderer an audience gets when nothing says otherwise: a person is painted, a machine reads plain text.
 *
 * @remarks
 * A CI gets GitHub's log format only where `CurrentRuntimeEnv` says it is GitHub Actions; that service is read if the
 * environment has it and is not required. Shared by `Doc.print` and the failure report.
 *
 * @internal
 */
export const autoFormat = (audience: AudienceKind): Effect.Effect<"plain" | "ansi" | "githubLog"> =>
	Effect.gen(function* () {
		if (audience === "human") return "ansi";
		if (audience === "agent") return "plain";
		return (yield* underGithubActions) ? "githubLog" : "plain";
	});
