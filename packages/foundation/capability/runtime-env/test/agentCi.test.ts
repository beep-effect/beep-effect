import { agentCiKeys, detectAgent, detectCi } from "@beep/runtime-env/internal/agentCi";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import { identity } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { envReadsOf, sourceOf } from "./support/sources.ts";

const UnknownJson = S.fromJsonString(S.Unknown);

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
    it(`${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(env), identity)} → ${name}`, () =>
      assert.deepStrictEqual(detectAgent(env), O.some(name)));
  }
  it("AI_AGENT wins and is lower-cased", () =>
    assert.deepStrictEqual(detectAgent({ AI_AGENT: "Aider", CLAUDECODE: "1" }), O.some("aider")));
  it("AI_AGENT copilot aliases collapse to copilot", () => {
    assert.deepStrictEqual(detectAgent({ AI_AGENT: "github_copilot_vscode_agent" }), O.some("copilot"));
    assert.deepStrictEqual(detectAgent({ AI_AGENT: "github_copilot_cloud_agent" }), O.some("copilot"));
  });
  // AI_AGENT carries a family plus extras (Claude Code sets claude-code_2-1-285_agent): detectAgent reports the family.
  it("AI_AGENT is normalized to its family name", () => {
    const family = (value: string) => detectAgent({ AI_AGENT: value });
    assert.deepStrictEqual(family("claude-code_2-1-285_agent"), O.some("claude"));
    assert.deepStrictEqual(family("codex_cli_1"), O.some("codex"));
    assert.deepStrictEqual(family("gemini-cli"), O.some("gemini"));
    assert.deepStrictEqual(family("Claude"), O.some("claude"));
    assert.deepStrictEqual(family("kiro-ide"), O.some("kiro"));
    assert.deepStrictEqual(family("github_copilot_vscode_agent"), O.some("copilot"));
  });
  it("an unknown AI_AGENT stays raw, and a family name must be followed by - or _ to count as a prefix", () => {
    assert.deepStrictEqual(detectAgent({ AI_AGENT: "aider" }), O.some("aider"));
    assert.deepStrictEqual(detectAgent({ AI_AGENT: "Claudette" }), O.some("claudette"));
    assert.deepStrictEqual(detectAgent({ AI_AGENT: "pilot" }), O.some("pilot"));
  });
  it("nothing set → none", () => assert.deepStrictEqual(detectAgent({}), O.none()));
  it("kiro (TERM_PROGRAM, TTY-gated in std-env) is not detected: env has no TTY here — documented", () =>
    assert.deepStrictEqual(detectAgent({ TERM_PROGRAM: "kiro" }), O.none()));
  // Added beyond the brief: declared order decides between two matching rows, and the regex rules do not over-match.
  it("the first declared row wins when several match", () =>
    assert.deepStrictEqual(detectAgent({ CURSOR_AGENT: "1", CLAUDECODE: "1" }), O.some("claude")));
  it("pi and devin rules need their pattern, not just a set variable", () => {
    assert.deepStrictEqual(detectAgent({ PATH: "/usr/bin" }), O.none());
    assert.deepStrictEqual(detectAgent({ EDITOR: "vim" }), O.none());
  });
});

describe("detectCi", () => {
  const ci = (env: Record<string, string>) => detectCi(env);
  it("GITHUB_ACTIONS=true → github-actions, even when CI=false", () => {
    assert.deepStrictEqual(ci({ GITHUB_ACTIONS: "true" }), O.some("github-actions"));
    assert.deepStrictEqual(ci({ GITHUB_ACTIONS: "true", CI: "false" }), O.some("github-actions"));
  });
  for (const v of ["true", "1", "yes", "anything"]) {
    it(`CI=${v} → generic`, () => assert.deepStrictEqual(ci({ CI: v }), O.some("generic")));
    it(`CONTINUOUS_INTEGRATION=${v} → generic`, () =>
      assert.deepStrictEqual(ci({ CONTINUOUS_INTEGRATION: v }), O.some("generic")));
  }
  for (const v of ["false", "0", "FALSE"]) {
    it(`CI=${v} → none`, () => assert.deepStrictEqual(ci({ CI: v }), O.none()));
  }
  it("GITHUB_ACTIONS=false is not github-actions", () =>
    assert.deepStrictEqual(ci({ GITHUB_ACTIONS: "false" }), O.none()));
  it("nothing set → none", () => assert.deepStrictEqual(ci({}), O.none()));
  // Added by the hardening round: "" is falsy, as in detectAgent and std-env, for every CI variable.
  it("an empty GITHUB_ACTIONS, CI or CONTINUOUS_INTEGRATION is none", () => {
    assert.deepStrictEqual(ci({ GITHUB_ACTIONS: "" }), O.none());
    assert.deepStrictEqual(ci({ CI: "" }), O.none());
    assert.deepStrictEqual(ci({ CONTINUOUS_INTEGRATION: "" }), O.none());
    assert.deepStrictEqual(ci({ GITHUB_ACTIONS: "", CI: "", CONTINUOUS_INTEGRATION: "" }), O.none());
  });
  // Review round 2: the falsy set is Config.Boolean's (effect Schema.FalseLiterals), read case-insensitively,
  // so no spelling the retired repo-cli predicates read as not-CI turns into CI.
  const FALSY = ["false", "no", "off", "0", "n"] as const;
  const MIXED_CASE = ["NO", "No", "OFF", "Off", "N", "False", "fAlSe"] as const;
  for (const v of [...FALSY, ...MIXED_CASE]) {
    it(`CI=${v} → none`, () => assert.deepStrictEqual(ci({ CI: v }), O.none()));
    it(`CONTINUOUS_INTEGRATION=${v} → none`, () => assert.deepStrictEqual(ci({ CONTINUOUS_INTEGRATION: v }), O.none()));
    it(`GITHUB_ACTIONS=${v} → none`, () => assert.deepStrictEqual(ci({ GITHUB_ACTIONS: v }), O.none()));
  }
  it("a falsy GITHUB_ACTIONS falls through to a truthy CI", () =>
    assert.deepStrictEqual(ci({ GITHUB_ACTIONS: "off", CI: "true" }), O.some("generic")));
  // Config.Boolean rejects a value outside its literals; detectCi cannot fail, so an unknown value is a set
  // variable and counts as CI, as in std-env. Whitespace is not trimmed (Config.Boolean does not trim either),
  // so a padded falsy spelling is an unknown value.
  for (const v of ["banana", "nope", " no", "no ", "falsey"]) {
    it(`unknown CI=${Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(v), identity)} → generic`, () =>
      assert.deepStrictEqual(ci({ CI: v }), O.some("generic")));
  }
});

// Added beyond the brief: the key list and the detector cannot drift.
describe("agentCiKeys", () => {
  const direct = new Set(envReadsOf(sourceOf("internal/agentCi.ts")));
  const fixtureKeys = A.flatMap(AGENTS, ([, env]) => R.keys(env));

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
