# Opportunities

## The scorer sandbox, not the skill, sets the P2 baseline

- **Work:** Launching the P2 SkillOpt rerun (2026-09-25, Claude Code `opus`
  rollout target after the Codex pool hit its usage limit) and reading the
  baseline and step-1 verdict.
- **Friction:** The baseline soft score (0.5015; an earlier attempt on the same
  items scored 0.5431) is dominated by scorer-environment failures in the copied
  fixtures, not by what the rollout agent wrote. Every baseline item's scorer
  output carries missing-lib and missing-types errors (`TS2591`, `TS2503`,
  `TS2304`, `TS2550`), two items also fail on a tsconfig `extends` that does
  not resolve in the copied location (`TS5083`), and Biome reports
  `No files were processed` for the same two. Step 1 was then accepted at
  0.9583 because the candidate skill teaches the agent to make the fixture
  tsconfig self-contained and to add a fixture-local Biome config: the loop
  learned to repair the scoring sandbox within one round. This is the
  evaluation-environment fitting that RRSI's leakage critic (D8 lineage,
  mechanism D in `research/2026-09-25-rrsi-deep-research/concepts.md`) rejects
  before scoring. No lift claim is valid until the sandbox is fixed, and P5's
  0.4714 Codex baseline very likely sat on the same floor.
- **Evidence:** `history/p2-rerun/out/selection_eval_baseline/predictions/*/scorer.json`
  and `results.jsonl` (soft 0.338 to 0.583, hard 0.0 on all four items);
  `history/p2-rerun/out/skills/skill_v0001.md` versus `skill_v0000.md`
  (added guidance: "make the fixture tsconfig self-contained", "Add a minimal
  fixture-local Biome config"); run log line
  `[6/6 EVALUATE] ACCEPT (new best) soft=0.9583 > prev best 0.5015`.
- **Update (step 2, same run):** step 2 accepted at 1.0000 with an edit that quotes a corpus
  task's phrasing into the skill; the run was stopped there because the strict-greater gate
  cannot accept anything on a saturated set. Skill size grew 6,233 -> 9,070 chars in two
  edits. Full reading in `history/p2-rerun/FINDINGS.md`.
- **Proposal:** (1) Make the scorer's fixture copy self-contained by
  construction: carry the tsconfig base it extends, the lib set Effect's `.d.ts`
  needs (`Disposable`/`AsyncDisposable`), node types, and a fixture-local Biome
  config, so the three law lanes measure the agent's edit and nothing else.
  (2) Add the paper's pre-evaluation screen to the loop: reject a candidate
  whose diff mentions the scorer, its checks, or the fixture layout. (3) Record
  the two baseline scores (0.5431, 0.5015) as the first empirical noise band
  for the ledger's stale/acceptance predicates.

## Three launch gotchas cost an hour before the first rollout ran

- **Work:** Launching the same rerun from the runbook.
- **Friction:** `codex_exec_reasoning_effort: none` is rejected by
  `gpt-6-astra`; at `medium` all four baseline items timed out at 600 s; the
  lane's two unacknowledged yeet inbox P0 rows were injected into every Codex
  rollout by the SessionStart hook and the write-blocking hook failed the run;
  a relaunch reused the cached `out/selection_eval_baseline` failure instead
  of re-executing; and Claude Code 2.1.282 prints `--output-format json` as one
  JSON array line, which skillopt 0.2.0's line parser turns into
  `'list' object has no attribute 'get'` on every optimizer call.
- **Evidence:** `history/p2-rerun/run.log` across attempts on 2026-09-25;
  commits 6924b31c4d, 8513381f3e, 4f26b5409d, ca90ef2c52 on
  `feat/harness-evidence-ledger`.
- **Proposal:** The runbook now records each of these; a preflight command
  that checks the target backend's auth and quota, acknowledges or refuses on
  open inbox rows, and clears a stale `out/` would have prevented all of them.
