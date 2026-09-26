# GOAL: Harness Evidence Ledger

Repo root: the current `beep-effect` checkout. All paths are repo-relative.

Mission: make every harness edit a typed ledger row whose evidence expires by
config fingerprint, propose pruning for surfaces that stop earning their
place, and rerun the parked SkillOpt pilot with an annealed edit budget.
Harness = prompts + control flow + tools + skills/memory + context management
+ subagents.

RRSI (arXiv 2609.24972) is convergent prior art; our packets predate it. We
port three mechanisms (typed ledger row, fingerprint expiry, retention
pruning) and keep two repo positions: a human admits every change, and we
regularize retention, not proposal.

Source hierarchy (higher wins): `AGENTS.md` and `CLAUDE.md`; then
`goals/harness-evidence-ledger/SPEC.md` (normative, locked D1 to D14); then
`PLAN.md`, `ops/manifest.json`, `research/SOURCES.md`, and
`harness-ledger/README.md`.

Build (PLAN P1):

- `@beep/ai-metrics`: LiteralKits `ContextSurface`, `MechanismClass`,
  `LedgerDisposition`; `HarnessFingerprint` from config-snapshot hashes plus
  model id and effort; `HarnessLedgerRow`; predicates `isHarnessEdit`,
  `requiresBudget`, `isStale`, `isWarmRestart` (model id only), `editBudget`.
- CLI `bun run beep harness-ledger propose|disposition|list|prune-proposals`,
  sole writer of `harness-ledger/rows/YYYY-MM.jsonl`.
- hook-pulse: hashed `surface` on PostToolUse rows for Skill and harness-root
  reads and edits. No paths.
- Scorer: `configSnapshotId` = fingerprint id; `evaluateLaw` lanes concurrent.
- Rerun config: cosine 4 to 1, 3 epochs, 4 workers, Opus optimizer,
  `claude_code_exec`, same 8/4 split and scorer as P5.

Then P2 rerun (local, detached, overnight at most, full logs), P3 PR1 to
mergeable, P4 PR2 with results, first rows, pruning proposals, and a
reflection, P5 close.

Rules:

1. Schema first, then service contract, then implementation. Effect v4 only.
2. Rows are immutable. A disposition appends a new row that cites the prior
   `rowId`.
3. Machine proposes, human admits. Never apply a harness edit or a pruning
   proposal.
4. No paths, secrets, prompts, tool arguments, or corpus content in rows.
5. Do not reopen `goals/skillopt-training-pilot`.
6. Do not merge PRs; drive them to merge-ready with Yeet.

Verification:

```sh
test "$(wc -m < goals/harness-evidence-ledger/GOAL.md)" -le 4000
jq . goals/harness-evidence-ledger/ops/manifest.json
bun run beep lint goal-packets
bun run beep goals doctor
bun run beep lint reflection-artifacts
bun run beep quality package-verify @beep/ai-metrics
```

Stop and report when:

- a row or telemetry field would need a path, prompt, or secret;
- a change would apply a harness edit without human admission;
- the work exceeds `SPEC.md` scope or needs unnamed credentials or cost;
- the same blocker repeats after reasonable investigation.

Done when `SPEC.md` acceptance passes and both PRs are merge-ready, or a
blocker is reported with file and command evidence.
