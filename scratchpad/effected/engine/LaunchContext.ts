import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/engine/LaunchContext");

/**
 * The process-derived facts a front end resolves once, passed in as values.
 *
 * **Details**
 *
 * Nothing here reads `process`: `argv`, `env` and `cwd` come from the front
 * end's own `main.ts`. That keeps the resolution rule shared and testable
 * while the process read stays at the one place allowed to make it.
 *
 * **Example** (Validate process-derived inputs)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ProjectDirInput } from "@beep/scratchpad/effected/engine/LaunchContext"
 *
 * console.log(S.is(ProjectDirInput)({ env: {}, keys: [], cwd: "/work/app" })) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ProjectDirInput = S.Struct({
	argv: S.Array(S.String).pipe(S.optional).annotateKey({
		description:
			"Positional candidates, checked in order. Pass positional arguments only — the parsed positionals of your command, never raw process.argv.slice(2): every non-empty value counts as a candidate, so a --flag would become the project directory.",
	}),
	env: S.Record(S.String, S.UndefinedOr(S.String)).annotateKey({ description: "The environment, usually process.env." }),
	keys: S.Array(S.String).annotateKey({
		description: 'Env keys to try in order, for example ["OKFIT_PROJECT_DIR", "CLAUDE_PROJECT_DIR"].',
	}),
	cwd: S.String.annotateKey({ description: "The fallback, usually process.cwd()." }),
}).pipe(
	$I.annoteSchema("ProjectDirInput", {
		description: "The process-derived facts a front end resolves once, passed in as values.",
	}),
);

/**
 * Readonly process-derived inputs accepted by {@link LaunchContext.projectDir}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ProjectDirInput = typeof ProjectDirInput.Type;

/**
 * Resolves where a tool launched by an agent host should treat as its project.
 *
 * **Example** (Resolve the project directory from the host environment)
 *
 * ```ts
 * import { LaunchContext } from "@beep/scratchpad/effected/engine/LaunchContext"
 *
 * const dir = LaunchContext.projectDir({
 * 	argv: [],
 * 	env: { CLAUDE_PROJECT_DIR: "/work/app" },
 * 	keys: ["MYTOOL_PROJECT_DIR", "CLAUDE_PROJECT_DIR"],
 * 	cwd: "/home/me",
 * })
 * console.log(dir) // /work/app
 * ```
 *
 * @public
 * @category utilities
 * @since 0.0.0
 */
export class LaunchContext {
	private constructor() {}

	/**
	 * Whether a value still carries a literal `${VAR}` placeholder.
	 *
	 * **Gotchas**
	 *
	 * An agent host can pass `${CLAUDE_PROJECT_DIR}` through unsubstituted in
	 * some launch paths; a path containing a placeholder is never what was meant.
	 *
	 * **Example** (Recognize an unresolved host placeholder)
	 *
	 * ```ts
	 * import { LaunchContext } from "@beep/scratchpad/effected/engine/LaunchContext"
	 *
	 * console.log(LaunchContext.isUnsubstituted("${CLAUDE_PROJECT_DIR}/src")) // true
	 * console.log(LaunchContext.isUnsubstituted("/work/app")) // false
	 * ```
	 *
	 * @since 0.0.0
	 */
	static readonly isUnsubstituted = (value: string): boolean => {
		// A `${` with any `}` after it. The first `${` has the most text after it,
		// so it alone decides; two scans keep this linear, where the equivalent
		// unanchored regex rescans from every `${` and goes quadratic.
		const open = value.indexOf("${");
		return open !== -1 && value.indexOf("}", open + 2) !== -1;
	};

	/**
	 * The first usable argv value, then the first usable env value in `keys`
	 * order, then `cwd`. A value is usable when it is non-empty after trimming
	 * and carries no placeholder — `??` would return an empty string or a literal
	 * `${VAR}`, neither of which names a directory.
	 *
	 * **Example** (Prefer usable positionals over environment and cwd)
	 *
	 * ```ts
	 * import { LaunchContext } from "@beep/scratchpad/effected/engine/LaunchContext"
	 *
	 * console.log(LaunchContext.projectDir({
	 *   argv: ["${PROJECT_DIR}", " /work/cli "],
	 *   env: { PROJECT_DIR: "/work/env" },
	 *   keys: ["PROJECT_DIR"],
	 *   cwd: "/work/fallback",
	 * })) // /work/cli
	 * ```
	 *
	 * @since 0.0.0
	 */
	static readonly projectDir = (input: ProjectDirInput): string => {
		const usable = (value: string | undefined): string | undefined => {
			if (value === undefined) return undefined;
			const trimmed = value.trim();
			return trimmed === "" || LaunchContext.isUnsubstituted(trimmed) ? undefined : trimmed;
		};
		for (const value of input.argv ?? []) {
			const found = usable(value);
			if (found !== undefined) return found;
		}
		for (const key of input.keys) {
			const found = usable(input.env[key]);
			if (found !== undefined) return found;
		}
		return input.cwd;
	};
}
