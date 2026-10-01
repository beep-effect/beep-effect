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
  the two baseline scores (0.5431, 0.5015) as scorer-variance evidence for
  rerun analysis: an evaluation-environment noise floor that a candidate's
  gain must clear before it reads as signal. The pair is not an input to the
  ledger's `isStale` (fingerprint mismatch only) or to any shipped acceptance
  predicate; noise-band calibration stays out of shipped gates per SPEC.

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

## Concurrent review ownership interrupted the repair pass (2026-09-25)

- **Work:** resolving PR #1253 review findings and its main merge conflict.
- **Evidence:** the inventory changed from an unresolved merge to staged content
  while another live session ran `beep lint effect-vitest --write`; that session
  then stopped with `hit your monthly spend limit` after editing the hook guard.
- **Prevention:** record a single active PR repair owner and handoff path before
  starting parallel all-PR sweeps. The second session preserved the existing edit
  and resumed only after confirming the first had stopped.

## Real-clock 60 ms timeout in an inherited property test flaked the lane (2026-09-25)

- **Work:** babysitting PR #1253 on head 4a1ef64428.
- **Friction:** `Property Laws` went red on
  `test/proof-job.test.ts > job wait wave return > returns a wave for a new
  comment row on its own pull request, whatever head the wave record holds`
  with `YeetCommandError: Timed out waiting for proof job`. The case waits on
  a real-clock `timeoutMs: 60` with a 1 ms poll; the hosted property lane took
  364 s on that run, so wall-clock jitter alone exceeds the budget. The test
  landed with #1270 (`cafc1f8eb9`), main was green on it, and this PR touches
  no Yeet source, so the failure is environment-only and cannot be repaired
  from this lane. A job rerun is refused while the workflow run is still
  queued behind the heavy cap, so the only lever was a fresh push.
- **Evidence:** job `108288561181` in run `36201265662`; `Tests 1 failed |
  2069 passed`.
- **Proposal:** drive that case with `TestClock` (or a timeout in the seconds
  range with the poll interval as the only fast knob) so the property lane
  cannot fail on scheduler jitter; land it on main independently of #1253.

## Rollout agents wrote outside their scratch workspace (2026-09-29)

- **Work:** reading the finished P4 rerun (`history/p4-rerun/`).
- **Friction:** four corpus fixture directories under
  `goals/skillopt-training-pilot/corpus/fixtures/` gained a
  `node_modules/.tmp/tsconfig.tsbuildinfo` stamped inside rollout windows
  (05:54 to 06:02 local), and one rollout's final message reports a temp
  directory `corpus/fixtures/.tc-tmp-n003/` that it "didn't create". The scratch
  copy keeps the fixture's relative `extends`, which dangles there, so rollout
  agents type-check by going to a directory at the right depth: the corpus
  itself. The rollout workspace sits inside the repo and the target has Bash, so
  nothing stops it. The task manifests with their completion patterns sit two
  directories away from where the agents were working. No tracked file
  changed (`git status` clean), and no rollout trace names `corpus/tasks`, but
  the channel exists.
- **Evidence:** `find goals/skillopt-training-pilot/corpus -name node_modules`
  before cleanup; `claude_raw.txt` of baseline-noise run 2, item
  `sfv4-fn-schema-003`; one of 38 rollout workspaces also edited its own
  `tsconfig.json`, which the scorer now ignores.
- **Proposal:** run rollouts in a workspace outside the repo tree with a
  self-contained tsconfig, and mount the corpus read-only or keep task manifests
  out of reach of the target. Until then a selection score is an upper bound.

## The loop gate accepted a tie made by rounding (2026-09-29)

- **Work:** same run, step 2.
- **Friction:** the gate is strict-greater on the mean of per-item scores that
  the scorer rounds to six decimals. The baseline mean was 0.9166665 and the
  candidate mean 0.91666675, so the candidate was accepted as a "new best" on a
  gap of 0.00000025 while three baseline passes on identical inputs spread over
  0.0833. The skill grew by 668 characters on that accept.
- **Evidence:** `history/p4-rerun/steps.jsonl` step 2;
  `history/p4-rerun/baseline-noise.json`; run log line
  `ACCEPT (new best) soft=0.9167 > prev best 0.9167`.
- **Proposal:** a gate margin at least as wide as the measured baseline spread.
  The packet keeps noise-band gating out of shipped code, so this stays a
  recommendation for the next loop design.

## The Agent tool rejects the model id the repo law requires (2026-09-29)

- **Work:** delegating the three implementation slices on Opus 5.5.
- **Friction:** `AGENTS.md` Volume pools requires
  `model: "claude-opus-5-5"` on native subagents, and the Agent tool's `model`
  field is an enum of aliases that rejects the full id
  (`InputValidationError ... "values": ["sonnet","opus","haiku","fable"]`).
  Three launches failed before the work moved to a Workflow, whose `agent()`
  accepts the id.
- **Evidence:** the three rejected tool calls in this session; the workflow
  transcripts record `claude-opus-5-5` on every child.
- **Proposal:** the law and the runbook should name the Workflow route as the
  only one that can pin the id, or the alias should be pinned in settings.

## The session could not wire its own SessionStart hook (2026-09-29)

- **Work:** adding hook-pulse to the `SessionStart` hooks in
  `.claude/settings.json` so sessions carry the harness hash stamp.
- **Friction:** the permission classifier denied the edit as self-modification.
  The stamp code, the conformance test, and the regime filter ship, but no live
  session is stamped until a human adds the entry. This matches D2 (a human
  admits harness edits), so the wiring is filed as a `proposed` ledger row and
  the exact entry is in the packet README.
- **Evidence:** the denied tool call; `jq '.hooks.SessionStart'` lists
  packet-projections, yeet-inbox, and graft hooks only.
- **Proposal:** none needed; the boundary held. Packets that change hook
  wiring should plan the human step from the start.

## An inventory refresh rewrote 107,241 lines for 38 rows (2026-09-29)

- **Work:** recording effect-vitest findings for five touched test files.
- **Friction:** `bun run beep lint effect-vitest --write` on a branch cut from
  current `main` rewrote the whole inventory (48,144 insertions, 59,097
  deletions) because it reorders rows and drops 529 rows `main` has resolved
  but not removed. The reviewable change was 38 rows.
- **Evidence:** `git diff --stat standards/effect-vitest.inventory.jsonc` after
  `--write`; check mode on the spliced file printed `introduced=0 resolved=529`.
- **Proposal:** a `--write --only <file...>` mode that touches only the rows of
  the named files, and a scheduled job that lands the resolved-row cleanup on
  `main` by itself.
