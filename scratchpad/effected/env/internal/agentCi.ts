// Agent and CI detection from a pure env record. The agent table is transcribed, in order, from std-env 4.3.0
// (dist/index.mjs); CI detection is deliberately narrower than std-env's provider table.
import { Option } from "effect";
import type { Env } from "./types.ts";

type AgentRule =
	| readonly [name: string, keys: ReadonlyArray<string>]
	| readonly [name: string, test: (env: Env) => boolean];

const matches = (value: string | undefined, pattern: RegExp): boolean => !!value && pattern.test(value);

// std-env's order decides between two matching rows. `pi` and `devin` match a pattern on a variable every
// shell sets, so they test the value rather than its presence.
//
// `kiro` (TERM_PROGRAM=kiro) is omitted: std-env gates it on a non-TTY stdout, and this detector is Config-only
// and never touches a stream.
const AGENT_RULES: ReadonlyArray<AgentRule> = [
	["claude", ["CLAUDECODE", "CLAUDE_CODE"]],
	["replit", ["REPL_ID"]],
	["gemini", ["GEMINI_CLI"]],
	["codex", ["CODEX_SANDBOX", "CODEX_THREAD_ID"]],
	["opencode", ["OPENCODE"]],
	["pi", (env) => matches(env.PATH, /\.pi[\\/]agent/)],
	["auggie", ["AUGMENT_AGENT"]],
	["goose", ["GOOSE_PROVIDER"]],
	["junie", ["JUNIE_DATA", "JUNIE_SHIM_PATH"]],
	["copilot", ["COPILOT_AGENT", "COPILOT_CLI"]],
	["devin", (env) => matches(env.EDITOR, /devin/)],
	["cursor", ["CURSOR_AGENT"]],
];

// The family names a free-form AI_AGENT value is folded into: every table row, plus `kiro`, which the table
// omits (see above) but which an agent can still announce through AI_AGENT.
const AGENT_FAMILIES: ReadonlyArray<string> = [...AGENT_RULES.map(([name]) => name), "kiro"];

/** The family a lower-cased `AI_AGENT` value belongs to: equal to it, or starting with it then `-` or `_`. */
const familyOf = (value: string): string =>
	AGENT_FAMILIES.find(
		(family) => value === family || value.startsWith(`${family}-`) || value.startsWith(`${family}_`),
	) ?? value;

/**
 * The name of the AI agent running this process, if any, as its family: `claude`, not the
 * `claude-code_2-1-285_agent` Claude Code puts in `AI_AGENT`.
 *
 * @remarks
 * `AI_AGENT` wins over every table row. It is lower-cased, the two `github_copilot_*` names collapse to
 * `copilot`, and a value that is a known family or starts with one followed by `-` or `_` becomes that family.
 * Any other value is returned as it was lower-cased.
 *
 * @internal
 */
export const detectAgent = (env: Env): Option.Option<string> => {
	if (env.AI_AGENT) {
		const name = env.AI_AGENT.toLowerCase();
		return Option.some(
			name === "github_copilot_vscode_agent" || name === "github_copilot_cloud_agent" ? "copilot" : familyOf(name),
		);
	}
	for (const [name, rule] of AGENT_RULES) {
		if (typeof rule === "function" ? rule(env) : rule.some((key) => !!env[key])) return Option.some(name);
	}
	return Option.none();
};

// "" is falsy, as in detectAgent and std-env: an empty variable is an unset one.
const isFalsy = (value: string | undefined): boolean =>
	value === undefined || value === "" || value.toLowerCase() === "false" || value === "0";

/**
 * The CI this process runs in: `github-actions` when `GITHUB_ACTIONS` is truthy (even under `CI=false`, since the
 * provider signal is explicit), else `generic` when `CI` or `CONTINUOUS_INTEGRATION` is truthy.
 *
 * @internal
 */
export const detectCi = (env: Env): Option.Option<"github-actions" | "generic"> => {
	if (!isFalsy(env.GITHUB_ACTIONS)) return Option.some("github-actions");
	if (!isFalsy(env.CI) || !isFalsy(env.CONTINUOUS_INTEGRATION)) return Option.some("generic");
	return Option.none();
};

/**
 * Every environment variable name the detectors read.
 *
 * @internal
 */
export const agentCiKeys: ReadonlyArray<string> = [
	"AI_AGENT",
	...AGENT_RULES.flatMap(([, rule]) => (typeof rule === "function" ? [] : rule)),
	"PATH",
	"EDITOR",
	"GITHUB_ACTIONS",
	"CI",
	"CONTINUOUS_INTEGRATION",
];
