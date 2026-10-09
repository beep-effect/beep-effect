import type { AudienceKind } from "../../env/index.ts";
import { CurrentRuntimeEnv } from "../../env/index.ts";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";

/**
 * Whether the environment says the program runs under GitHub Actions, whose runner reads workflow commands out of
 * the log.
 *
 * **Details**
 *
 * `CurrentRuntimeEnv` is read if the environment has it and is not required: without it, the answer is no.
 *
 * @internal
 */
export const underGithubActions: Effect.Effect<boolean> = Effect.gen(function* () {
	const runtime = yield* Effect.serviceOption(CurrentRuntimeEnv);
	return O.contains(
		O.flatMap(runtime, (env) => env.ci),
		"github-actions",
	);
});

/**
 * The renderer an audience gets when nothing says otherwise: a person is painted, a machine reads plain text.
 *
 * **Details**
 *
 * A CI gets GitHub's log format only where `CurrentRuntimeEnv` says it is GitHub Actions; that service is read if the
 * environment has it and is not required. Shared by `Doc.print` and the failure report.
 *
 * @internal
 */
export const autoFormat = Effect.fn("autoFormat")(function* (
	audience: AudienceKind,
): Effect.fn.Return<"plain" | "ansi" | "githubLog"> {
	if (audience === "human") return "ansi";
	if (audience === "agent") return "plain";
	return (yield* underGithubActions) ? "githubLog" : "plain";
});
