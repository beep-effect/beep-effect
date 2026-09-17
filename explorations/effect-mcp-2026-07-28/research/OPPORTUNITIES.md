# Opportunities

## Headless grok `/deep-research` is interrupted when the process exits

- **Work:** Proving that this packet's web research lanes run on grok through the grok CLI's
  native `/deep-research` workflow before fanning out.
- **Friction:** `grok -p "/deep-research <query>"` returned immediately with "started in the
  background", the headless process exited, and the run's `state.json` recorded `interrupted` with
  no report. A second probe was needed to find a working shape.
- **Evidence:** 2026-09-16 probe stream held only `available_commands`, one text event, and `end`;
  the workflow state under the grok session directory read `"status":"interrupted"`. A plain
  prompt telling the agent to launch the workflow with its workflow tool and poll (`sleep`, then a
  status check) until completion produced a verified, cited report in about three minutes, and
  all six sub-agents recorded `"model_id":"grok-4.6"`.
- **Proposal:** Document the keep-alive prompt as the headless recipe for grok workflows wherever
  agents launch grok research lanes, or have the grok CLI's `-p` mode wait for runs it starts.

## Claude Code's built-in deep-research Workflow is not model-routed

- **Work:** Planning grok sub-agents for research from a direct Anthropic session.
- **Friction:** The built-in `deep-research` Workflow sets no per-agent model, so its children
  inherit the session model. Launched from an Opus or Fable session it silently spends the
  Anthropic pool instead of grok, and nothing in its progress output says which model ran.
- **Evidence:** The operator flagged uncertainty ("unsure that the /deep-research workflow is
  invoked on grok"); the Workflow tool contract states that `agent()` without `model` inherits the
  main-loop model.
- **Proposal:** Route grok research through the grok CLI's native workflows, and prove routing
  from the child session records rather than from the orchestrator's intent.

## Snapshot check reds cascade from two foundation files

- **Work:** Sizing the snapshot pin (R4 spike) by running the repo-wide `check` against
  pkg.pr.new `a7a71921de`.
- **Friction:** 124 of 251 check tasks failed, but the failure census was dominated by two
  root causes re-reported in every dependent project: `@beep/schema` `EffectSchema.ts:88`
  (`Effect.isEffect` now typed `(u: unknown) => u is Effect<unknown, unknown, unknown>`) and
  `@beep/repo-ai-metrics` `source-discovery.ts:338` (`Stream.scan` initial value is now a
  `LazyArg`). The true migration size stays hidden until those are fixed.
- **Evidence:** 252 unique error rows; 120 packages report only the `EffectSchema.ts` errors
  through project references; unmodified main passed the same command (`baseline_exit=0`).
- **Proposal:** A snapshot-sizing helper that fixes or stubs first-wave foundation errors and
  re-runs, reporting each wave separately.

## Per-claim grok verification workflow stalled at fan-out scale

- **Work:** Gate B adversarial verification of about 220 lane claims with the saved grok
  `mcp-refute` workflow (three refuter agents per claim), one workflow per lane.
- **Friction:** The workflow finished a 4-claim smoke set in about 18 minutes, but eight
  concurrent lane runs made almost no progress in over an hour: most never got past the loader
  agent, one logged "First loader failed on a transport error", and a host reboot then killed
  all of them with no verdict files written (verdicts are only written at the final tally).
- **Evidence:** eight `gate-b-*` grok sessions with 0–16 sub-agent records each and no
  `verification/*.verdicts.jsonl` beyond the smoke lane.
- **Proposal:** Batch verification per lane (one refuter process checks all of a lane's claims,
  three independent processes per lane, bounded concurrency), and write verdicts incrementally so
  a restart resumes instead of starting over.

## Semantic-delta gate reads Effect-clone paths as repo paths

- **Work:** Publishing the packet; the local `knowledge:semantic-delta` gate went red while the
  hosted Heavy / Lint Policy check on the same commit was green.
- **Friction:** Nine `broken-tracked-path` findings, all on bare upstream paths such as
  `packages/effect/MCP.md` in prompts, CAPTURE, and DECISIONS. The lane reports had already
  adopted an `effect:` prefix and were not flagged, but nothing told the packet author that a
  bare clone path counts as an introduced blocking finding, and the local and hosted verdicts
  disagreed.
- **Evidence:** publish job log lines `knowledge semantic-delta: 9 introduced blocking finding(s)`;
  PR #1169 hosted checks all green on the same commit.
- **Proposal:** Document the `effect:` / `repo:` path prefixes for cross-repo citations in the
  explorations README, and have the gate name the accepted prefixes in its finding text.
