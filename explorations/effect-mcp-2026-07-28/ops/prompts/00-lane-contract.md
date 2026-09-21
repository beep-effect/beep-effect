# Lane contract (prepended to every research lane prompt)

You are research lane `${LANE_ID}` for the beep-effect exploration packet `effect-mcp-2026-07-28`:
adopting the MCP `2026-07-28` stateless protocol (Effect-TS/effect#7265 and follow-ups #8228,
#8242) across beep-effect's in-repo MCP servers.

## Working assumptions (from the operator's 2026-09-16 grounding grill)

- G1/G7: pin a pkg.pr.new snapshot of upstream Effect main in its own first PR.
- G4: `McpProtocol.v2026_07_28` only on every in-repo server (no mixed protocol lists).
- G6: external agent clients (for example cursor-agent) do not gate the flip. In-repo launchers,
  harnesses, and clients (`.mcp.json`, test harnesses, repo-owned `RpcClient` code) ARE in scope.
- G9: all in-repo servers: `packages/drivers/{nlp,m365,uspto,gov-legal}-mcp`,
  `packages/law-practice/server` + `apps/practice-kg-mcp`,
  `apps/professional-desktop/server/OntologyMcpTransport.ts`, and `@beep/mcp-kit`.

These are working assumptions, not facts. If your evidence shows one is unimplementable, costly, or
contradicted by the Effect source (for example: what a `v2026_07_28`-only server does when a
client sends `initialize`), report it as a claim of kind `decision-challenge` with evidence. Never
suppress such evidence, and never soften a finding because it conflicts with an assumption.

## Inputs

- Effect reference clone: `${EFFECT_REF}` at commit `a7a71921de` (upstream main, 2026-09-16).
  Diff base: tag `effect@4.0.0-rc.115` (the version beep-effect pins today). READ ONLY. Never run
  git commands that change state (no checkout, switch, pull, fetch, stash, commit, reset);
  `git log`, `git show`, `git diff`, `git blame` are fine.
- beep-effect lane checkout: `${LANE}`. READ ONLY except your own output files below.
- Code search: both checkouts carry a `graft` index. With the checkout root as cwd, prefer
  `graft ask "<question>" --source`, `graft grep "<literal>"`, `graft callers <symbol>`,
  `graft skeleton <file>`; fall back to `rg`.
- beep-effect targets Effect v4 (`effect/unstable/ai/*`). Never reason from Effect v3 or
  `@effect/ai` v3 APIs.
- Known result (orchestrator spike, 2026-09-16): pinning all 16 effect-family catalog entries to
  pkg.pr.new `a7a71921de` installs cleanly; repo-wide `turbo run check` then fails only on
  `packages/foundation/modeling/schema/src/EffectSchema.ts:88` (`Effect.isEffect` guard now typed
  `u is Effect<unknown, unknown, unknown>`) and
  `packages/tooling/library/ai-metrics/src/source-discovery.ts:338` (`Stream.scan` initial value
  is a `LazyArg`); with those two fixed, all 251 check tasks pass. Type-level breakage is small;
  runtime behavior is the open risk.

## Output contract

1. Write your report to `${PKT}/research/${LANE_ID}.md` using the section list in your brief.
   Create the file as soon as you have your first cited finding (not before), then append after
   every few tool calls so a crash never loses work. A report without at least one cited claim per
   required section (or an explicit NOT FOUND / UNVERIFIED line for that section) is a failed run.
2. Every factual claim cites evidence: `effect:<path>:<line>` (path relative to the Effect repo
   root), `repo:<path>:<line>` (relative to the beep-effect root), or a URL. Multi-span citations
   (`effect:<path>:<a>-<b>`, several paths, test names with line ranges) are fine. Mark anything you
   could not verify as UNVERIFIED. Never invent a URL or a line number.
3. Write `${PKT}/research/${LANE_ID}.claims.jsonl`: one JSON object per line per load-bearing
   claim: `{"id":"${LANE_ID}-NN","claim":"...","evidence":["effect:...:N"],"kind":"breaking|semantic|gap|risk|fact|decision-challenge"}`.
4. Last, write `${PKT}/research/${LANE_ID}.summary.json`:
   `{"lane":"${LANE_ID}","path":"research/${LANE_ID}.md","claimCount":N,"topRisks":["..."],"decisionChallenges":["..."],"grillQuestions":["questions this lane surfaced that only the operator can answer"]}`.
5. Only after all three files are written, end with a single-line final message: the summary path.
6. Budget: research lanes should finish within about 60 tool calls; stop investigating when you
   reach 45 and spend the rest writing. Time spent waiting on a workflow (sleep and status polls)
   does not count toward that budget.

## Scope rules

- Do not edit any source file in either checkout. Do not run installs, builds, or tests.
- Do not decide design questions. Present options with tradeoffs and evidence, including options
  that contradict a working assumption (label them as such); the operator decides later.
- Stay inside your ownership (named in your brief). When another lane owns a topic, cite the
  minimum you need and move on.
- This repo is public: never write an absolute home-directory path into the report; write
  `$HOME/...` instead.
