// Port of Node v26.10.0 lib/internal/tty.js getColorDepth (MIT). Differences: the win32 branch reads OS=Windows_NT
// rather than process.platform and the OS release, no warning side effect, TTY gate applied here.
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import type { ColorLevel } from "../ColorLevel.ts";
import type { Env } from "./types.ts";

// Some entries were taken from `dircolors`. The corresponding terminals might
// support more than 16 colours, but this was not tested for.
const TERM_ENVS = HashMap.fromIterable<string, ColorLevel>([
	["eterm", "basic"],
	["cons25", "basic"],
	["console", "basic"],
	["cygwin", "basic"],
	["dtterm", "basic"],
	["gnome", "basic"],
	["hurd", "basic"],
	["jfbterm", "basic"],
	["konsole", "basic"],
	["kterm", "basic"],
	["mlterm", "basic"],
	["mosh", "truecolor"],
	["putty", "basic"],
	["st", "basic"],
	["rxvt-unicode-24bit", "truecolor"],
	["terminator", "truecolor"],
	["xterm-kitty", "truecolor"],
]);

// Iteration order is the precedence order, as in Node.
const CI_ENVS: ReadonlyArray<readonly [string, ColorLevel]> = [
	["APPVEYOR", "256"],
	["BUILDKITE", "256"],
	["CIRCLECI", "truecolor"],
	["DRONE", "256"],
	["GITEA_ACTIONS", "truecolor"],
	["GITHUB_ACTIONS", "truecolor"],
	["GITLAB_CI", "256"],
	["TRAVIS", "256"],
];

const TERM_ENVS_REG_EXP: ReadonlyArray<RegExp> = [
	/ansi/,
	/color/,
	/linux/,
	/direct/,
	/^con[0-9]*x[0-9]/,
	/^rxvt/,
	/^screen/,
	/^xterm/,
	/^vt100/,
	/^vt220/,
];

const isSet = (value: string | undefined): boolean => value !== undefined && value !== "";

/**
 * The table: Node's getColorDepth with the FORCE_COLOR branch and warning removed, and its win32 branch keyed on
 * `OS=Windows_NT`.
 *
 * **Details**
 *
 * Node's win32 branch reads `process.platform` and the OS release: truecolor from Windows 10 build 14931, 256 colours
 * from build 10586, 16 before. Here the environment is read only through `Config`, so `OS=Windows_NT`, which Windows
 * sets system-wide and Git Bash keeps, stands in for the platform, and the branch gives truecolor. That approximates
 * Node on Windows 10 build 14931 and later; an older build gets more colour than Node would give it.
 */
const fromTable = (env: Env): ColorLevel => {
	if (isSet(env.NODE_DISABLE_COLORS) || isSet(env.NO_COLOR) || env.TERM === "dumb") return "none";

	// Where Node's win32 branch sits: after the disable checks, before every TMUX, CI and TERM row.
	if (env.OS === "Windows_NT") return "truecolor";

	if ((env.TMUX ?? "") !== "") return "truecolor";

	// Azure DevOps
	if (env.TF_BUILD !== undefined && env.AGENT_NAME !== undefined) return "basic";

	if (env.CI !== undefined) {
		for (const [name, level] of CI_ENVS) {
			if (env[name] !== undefined) return level;
		}
		if (env.CI_NAME === "codeship") return "256";
		return "none";
	}

	if (env.TEAMCITY_VERSION !== undefined) {
		return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? "basic" : "none";
	}

	const programLevel = Match.value(env.TERM_PROGRAM).pipe(
		Match.when("iTerm.app", (): ColorLevel => {
			if ((env.TERM_PROGRAM_VERSION === undefined || env.TERM_PROGRAM_VERSION === "") || /^[0-2]\./.test(env.TERM_PROGRAM_VERSION)) return "256";
			return "truecolor";
		}),
		Match.whenOr("HyperTerm", "MacTerm", (): ColorLevel => "truecolor"),
		Match.when("Apple_Terminal", (): ColorLevel => "256"),
		Match.orElse(() => undefined),
	);
	if (programLevel !== undefined) return programLevel;

	if (env.COLORTERM === "truecolor" || env.COLORTERM === "24bit") return "truecolor";

	if (env.TERM !== undefined && env.TERM !== "") {
		if (/truecolor/.test(env.TERM)) return "truecolor";
		if (/^xterm-256/.test(env.TERM)) return "256";

		const term = env.TERM.toLowerCase();
		// A HashMap lookup, so a TERM such as "constructor" cannot reach Object.prototype.
		const known = HashMap.get(TERM_ENVS, term);
		if (O.isSome(known)) return known.value;
		if (TERM_ENVS_REG_EXP.some((re) => re.test(term))) return "basic";
	}
	// Move 16 colour COLORTERM below 16m and 256
	if ((env.COLORTERM ?? "") !== "") return "basic";
	return "none";
};

/**
 * The colour level of one stream. `FORCE_COLOR`, when present, decides alone (it beats `NO_COLOR`, as in
 * Node); otherwise a stream that is not a TTY has none; otherwise the terminal table decides, which gives a Windows
 * terminal (`OS=Windows_NT`) truecolor unless colour is disabled.
 *
 * **Example** (Force truecolor on a non-TTY stream)
 *
 * ```ts
 * import { colorDepth } from "@beep/scratchpad/effected/env/internal/colorDepth";
 *
 * console.log(colorDepth({ FORCE_COLOR: "3", NO_COLOR: "1" }, false)) // truecolor
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const colorDepth: {
	(isTTY: boolean): (env: Env) => ColorLevel;
	(env: Env, isTTY: boolean): ColorLevel;
} = dual(2, (env: Env, isTTY: boolean): ColorLevel => {
	if (env.FORCE_COLOR !== undefined) {
		return Match.value(env.FORCE_COLOR).pipe(
			Match.whenOr("", "1", "true", (): ColorLevel => "basic"),
			Match.when("2", (): ColorLevel => "256"),
			Match.when("3", (): ColorLevel => "truecolor"),
			Match.orElse((): ColorLevel => "none"),
		);
	}
	if (!isTTY) return "none";
	return fromTable(env);
});

/**
 * Every environment variable name {@link colorDepth} reads, including the CI provider table.
 *
 * **Example** (Include the Windows platform signal)
 *
 * ```ts
 * import { colorKeys } from "@beep/scratchpad/effected/env/internal/colorDepth";
 * import * as A from "effect/Array";
 *
 * console.log(A.contains(colorKeys, "OS")) // true
 * ```
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const colorKeys: ReadonlyArray<string> = [
	"FORCE_COLOR",
	"NO_COLOR",
	"NODE_DISABLE_COLORS",
	"OS",
	"TERM",
	"TMUX",
	"TF_BUILD",
	"AGENT_NAME",
	"CI",
	"CI_NAME",
	"TEAMCITY_VERSION",
	"TERM_PROGRAM",
	"TERM_PROGRAM_VERSION",
	"COLORTERM",
	...CI_ENVS.map(([name]) => name),
];
