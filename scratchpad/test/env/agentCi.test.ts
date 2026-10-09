// @effect-diagnostics nodeBuiltinImport:skip-file
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assert, describe, it } from "@effect/vitest";
import { Option } from "effect";
import { agentCiKeys, detectAgent, detectCi } from "../../effected/env/internal/agentCi.ts";

// std-env 4.3.0 agent table (dist/index.mjs), in its declared order. AI_AGENT wins over all.
const AGENTS: ReadonlyArray<readonly [string, Record<string, string>]> = [
	["claude", { CLAUDECODE: "1" }],
	["claude", { CLAUDE_CODE: "1" }],
	["replit", { REPL_ID: "x" }],
	["gemini", { GEMINI_CLI: "1" }],
	["codex", { CODEX_SANDBOX: "seatbelt" }],
	["codex", { CODEX_THREAD_ID: "t" }],
	["opencode", { OPENCODE: "1" }],
	["pi", { PATH: "/usr/bin:/home/u/.pi/agent/bin" }],
	["auggie", { AUGMENT_AGENT: "1" }],
	["goose", { GOOSE_PROVIDER: "x" }],
	["junie", { JUNIE_DATA: "x" }],
	["junie", { JUNIE_SHIM_PATH: "x" }],
	["copilot", { COPILOT_AGENT: "1" }],
	["copilot", { COPILOT_CLI: "1" }],
	["devin", { EDITOR: "devin --wait" }],
	["cursor", { CURSOR_AGENT: "1" }],
];

describe("detectAgent", () => {
	for (const [name, env] of AGENTS) {
		it(`${JSON.stringify(env)} → ${name}`, () => assert.deepStrictEqual(detectAgent(env), Option.some(name)));
	}
	it("AI_AGENT wins and is lower-cased", () =>
		assert.deepStrictEqual(detectAgent({ AI_AGENT: "Aider", CLAUDECODE: "1" }), Option.some("aider")));
	it("AI_AGENT copilot aliases collapse to copilot", () => {
		assert.deepStrictEqual(detectAgent({ AI_AGENT: "github_copilot_vscode_agent" }), Option.some("copilot"));
		assert.deepStrictEqual(detectAgent({ AI_AGENT: "github_copilot_cloud_agent" }), Option.some("copilot"));
	});
	// AI_AGENT carries a family plus extras (Claude Code sets claude-code_2-1-285_agent): detectAgent reports the family.
	it("AI_AGENT is normalized to its family name", () => {
		const family = (value: string) => detectAgent({ AI_AGENT: value });
		assert.deepStrictEqual(family("claude-code_2-1-285_agent"), Option.some("claude"));
		assert.deepStrictEqual(family("codex_cli_1"), Option.some("codex"));
		assert.deepStrictEqual(family("gemini-cli"), Option.some("gemini"));
		assert.deepStrictEqual(family("Claude"), Option.some("claude"));
		assert.deepStrictEqual(family("kiro-ide"), Option.some("kiro"));
		assert.deepStrictEqual(family("github_copilot_vscode_agent"), Option.some("copilot"));
	});
	it("an unknown AI_AGENT stays raw, and a family name must be followed by - or _ to count as a prefix", () => {
		assert.deepStrictEqual(detectAgent({ AI_AGENT: "aider" }), Option.some("aider"));
		assert.deepStrictEqual(detectAgent({ AI_AGENT: "Claudette" }), Option.some("claudette"));
		assert.deepStrictEqual(detectAgent({ AI_AGENT: "pilot" }), Option.some("pilot"));
	});
	it("nothing set → none", () => assert.deepStrictEqual(detectAgent({}), Option.none()));
	it("kiro (TERM_PROGRAM, TTY-gated in std-env) is not detected: env has no TTY here — documented", () =>
		assert.deepStrictEqual(detectAgent({ TERM_PROGRAM: "kiro" }), Option.none()));
	// Added beyond the brief: declared order decides between two matching rows, and the regex rules do not over-match.
	it("the first declared row wins when several match", () =>
		assert.deepStrictEqual(detectAgent({ CURSOR_AGENT: "1", CLAUDECODE: "1" }), Option.some("claude")));
	it("pi and devin rules need their pattern, not just a set variable", () => {
		assert.deepStrictEqual(detectAgent({ PATH: "/usr/bin" }), Option.none());
		assert.deepStrictEqual(detectAgent({ EDITOR: "vim" }), Option.none());
	});
});

describe("detectCi", () => {
	const ci = (env: Record<string, string>) => detectCi(env);
	it("GITHUB_ACTIONS=true → github-actions, even when CI=false", () => {
		assert.deepStrictEqual(ci({ GITHUB_ACTIONS: "true" }), Option.some("github-actions"));
		assert.deepStrictEqual(ci({ GITHUB_ACTIONS: "true", CI: "false" }), Option.some("github-actions"));
	});
	for (const v of ["true", "1", "yes", "anything"]) {
		it(`CI=${v} → generic`, () => assert.deepStrictEqual(ci({ CI: v }), Option.some("generic")));
		it(`CONTINUOUS_INTEGRATION=${v} → generic`, () =>
			assert.deepStrictEqual(ci({ CONTINUOUS_INTEGRATION: v }), Option.some("generic")));
	}
	for (const v of ["false", "0", "FALSE"]) {
		it(`CI=${v} → none`, () => assert.deepStrictEqual(ci({ CI: v }), Option.none()));
	}
	it("GITHUB_ACTIONS=false is not github-actions", () =>
		assert.deepStrictEqual(ci({ GITHUB_ACTIONS: "false" }), Option.none()));
	it("nothing set → none", () => assert.deepStrictEqual(ci({}), Option.none()));
	// Added by the hardening round: "" is falsy, as in detectAgent and std-env, for every CI variable.
	it("an empty GITHUB_ACTIONS, CI or CONTINUOUS_INTEGRATION is none", () => {
		assert.deepStrictEqual(ci({ GITHUB_ACTIONS: "" }), Option.none());
		assert.deepStrictEqual(ci({ CI: "" }), Option.none());
		assert.deepStrictEqual(ci({ CONTINUOUS_INTEGRATION: "" }), Option.none());
		assert.deepStrictEqual(ci({ GITHUB_ACTIONS: "", CI: "", CONTINUOUS_INTEGRATION: "" }), Option.none());
	});
});

// Added beyond the brief: the key list and the detector cannot drift.
describe("agentCiKeys", () => {
	const dir = fileURLToPath(new URL("../../effected/env/internal/", import.meta.url));
	const source = readFileSync(`${dir}agentCi.ts`, "utf8");
	const direct = new Set(
		[...source.matchAll(/(?<![\w./])env(?:\.([A-Z][A-Za-z_]+)|\[\s*"([A-Za-z_]+)"\s*\])/g)].flatMap((m) => {
			const key = m[1] ?? m[2];
			return key === undefined ? [] : [key];
		}),
	);
	const fixtureKeys = AGENTS.flatMap(([, env]) => Object.keys(env));

	it("covers every direct env.X read in the source (regex control: it finds reads)", () => {
		assert.isAbove(direct.size, 3);
		for (const key of direct) assert.include(agentCiKeys, key, `agentCiKeys is missing ${key}`);
	});
	it("covers every key in the std-env fixture table", () => {
		for (const key of fixtureKeys) assert.include(agentCiKeys, key, `agentCiKeys is missing ${key}`);
	});
	it("lists nothing the detectors do not read (no typo can hide in the list)", () => {
		const known = new Set([...direct, ...fixtureKeys]);
		for (const key of agentCiKeys) assert.isTrue(known.has(key), `agentCiKeys has an unread key ${key}`);
	});
});
