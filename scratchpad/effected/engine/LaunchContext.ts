/**
 * The process-derived facts a front end resolves once, passed in as values.
 *
 * @remarks
 * Nothing here reads `process`: `argv`, `env` and `cwd` come from the front
 * end's own `main.ts`. That keeps the resolution rule shared and testable
 * while the process read stays at the one place allowed to make it.
 *
 * @public
 */
export interface ProjectDirInput {
	/**
	 * Positional candidates, checked in order. Pass positional arguments only —
	 * the parsed positionals of your command, never raw `process.argv.slice(2)`:
	 * every non-empty value counts as a candidate, so a `--flag` would become the
	 * project directory.
	 */
	readonly argv?: ReadonlyArray<string> | undefined;
	/** The environment, usually `process.env`. */
	readonly env: Readonly<Record<string, string | undefined>>;
	/** Env keys to try in order, for example `["OKFIT_PROJECT_DIR", "CLAUDE_PROJECT_DIR"]`. */
	readonly keys: ReadonlyArray<string>;
	/** The fallback, usually `process.cwd()`. */
	readonly cwd: string;
}

/**
 * Resolves where a tool launched by an agent host should treat as its project.
 *
 * @example
 * ```ts
 * import { LaunchContext } from "./index.ts"
 *
 * const dir = LaunchContext.projectDir({
 * 	argv: [],
 * 	env: { CLAUDE_PROJECT_DIR: "/work/app" },
 * 	keys: ["MYTOOL_PROJECT_DIR", "CLAUDE_PROJECT_DIR"],
 * 	cwd: "/home/me",
 * })
 * // => "/work/app"
 * ```
 *
 * @public
 */
export class LaunchContext {
	private constructor() {}

	/**
	 * Whether a value still carries a literal `${VAR}` placeholder.
	 *
	 * @remarks
	 * An agent host can pass `${CLAUDE_PROJECT_DIR}` through unsubstituted in
	 * some launch paths; a path containing a placeholder is never what was meant.
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
