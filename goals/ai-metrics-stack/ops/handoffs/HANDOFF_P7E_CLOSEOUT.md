# Handoff: ai-metrics-stack P7e closeout (2026-08-10)

Written by a Claude session ending mid-recon. Every fact below was verified live on
2026-08-10 unless marked UNVERIFIED. Goal: finish the packet's V1 critical path and land
the closeout PR.

## Where the packet stands

- `goals/ai-metrics-stack`: lifecycle `active`, 6/8 phases (P0–P5 complete, P6 + P7
  in-progress, `currentTargetPhase: P6c` in `ops/manifest.json`).
- The manifest's `nextAction` / `knownGaps` are **stale**: they describe a pinned proof
  worktree (`beep-effect-worktrees/ai-metrics-p6-proof`) with data under the main
  checkout's `.beep/ai-metrics`, and a proof window ending 2026-05-16 02:26 America/Chicago.
  None of that matches the live topology below.
- V1 completion contract (README): dankserver tailnet stack deployed, local smoke
  collection works, P6a hardening gates pass, real sources flowing, one restarted
  seven-day config-impact scorecard from live data, sanitized derived mirror confirmed on
  dankserver. P7c (provider enrichment) and P7d (dashboard/backend) stay non-blocking.
- P7e contract (`PLAN.md:220-223`): generate the final seven-day report → build a
  sanitized derived mirror from the active data root → confirmed
  `mirror sync` (`--confirm p7-derived-mirror`, rsync over SSH) to
  `dankserver:/srv/data/ai-metrics/p7-derived-mirror` → verify remote `mirror status`.

## Live topology (verified from systemd, not docs)

- Timer: `beep-ai-metrics-forwarder.timer` ACTIVE, `OnUnitInactiveSec=360m` (~4 runs/day),
  `Persistent=true`. Last run 2026-08-10 03:30 CDT: "Finished", 2min28s wall, 7.5G memory
  peak.
- Unit: `~/.config/systemd/user/beep-ai-metrics-forwarder.service`, rewritten
  **2026-08-07 01:45** (`.pre-p0` backups of the 2026-07-14 versions sit alongside).
  `EnvironmentFile=~/.config/beep/ai-metrics.env` (3 lines, 0600). Secrets are op:// refs:
  `op://TBK/ai-metrics/hash-salt`, `op://TBK/ai-metrics/raw-archive-key`.
- **Data root is XDG, outside every repo**: `/home/elpresidank/.local/state/beep/ai-metrics`
  — raw 15G, derived 5.1G (`derived/ai-metrics.duckdb`), config-snapshots 141M, reports/.
  Data spans 2026-05-06 → 2026-08-10. No checkout anywhere still holds a
  `.beep/ai-metrics` (verified by find across `~/YeeBois/projects`). The multi-checkout
  fragmentation problem is already solved; only the docs still claim otherwise.
- The unit runs `bun packages/tooling/tool/cli/src/bin.ts` with
  `WorkingDirectory=/home/elpresidank/YeeBois/projects/beep-effect`. That checkout is on
  branch `research/nightly-routine-p0-docs` at `bced3879f7` (2026-08-08), **10 commits
  behind origin/main**. So the forwarder code the timer executes is whatever that branch
  holds — decide deliberately whether to fast-forward/pin it (the
  `p7-topology-first-production-plan.md` history output may prescribe; the `.pre-p0`
  rewrite on 2026-08-07 likely came from that plan — confirm by reading it).

## Live issues found

1. **Latest run's OTLP export FAILED** while the unit exited 0 (export failure is
   non-fatal by design). `forwarder/status/latest.json`:
   `otlpExport.status="failed"`, message `"OTLP export did not complete after the
   forwarder run."`, target dankserver, ingestRunId `forwarder-1786350614909`,
   turnCount 24170. Yet `https://dankserver.tailc7c348.ts.net:8447/v1/traces` answers
   HTTP 200 in ~12ms right now — not plain unreachability. The at-least-once export
   design (PRs #578/#595/#601/#610, all merged) journals failed exports for retry.
   Diagnose: which code path emits that message (`packages/tooling/library/ai-metrics/src/otlp.ts`,
   `forwarder.ts`), where the journal/backlog lives (no file under the data root matches
   `*journal*`/`*otlp*`/`*export*` at depth 3 — it is probably tables inside
   `derived/ai-metrics.duckdb`), how big the pending backlog is, and whether the running
   checkout's code actually contains the at-least-once fix (see topology note above).
2. **Codex source saturating the per-run cap**: `candidateFileCount: 150`,
   `includedFileCount: 50`, `limitedByMaxFiles: true` at 4 runs/day. Check whether the
   backlog drains between runs or grows; raise `--max-files` in the unit if growing.
3. **No report since 2026-07-14.** `reports/` inventory (epoch-ms windows decoded):
   a cluster of May proof-era weeklies (last window 2026-05-05→05-12), one long-range
   report 2026-04-30→06-15 (`weekly-1777593600000-1781567999000`), then
   `weekly-1783410867839-1784015667839` = 2026-07-07→07-14, nothing after. Whether the
   "final credited seven-day report" for the May proof window was ever generated and
   accepted is UNVERIFIED — the proof-contract docs below define what "credited" means
   mechanically.

## Recon still to do (a stopped workflow was mid-flight on exactly these)

Read, then act:

1. `goals/ai-metrics-stack/history/outputs/p7-topology-first-production-plan.md` —
   current-truth topology, what the 2026-08-07 `.pre-p0` unit rewrite was, what P7e
   requires per this doc.
2. Proof contract: `history/outputs/p6a-closeout-proof-restart.md`,
   `p6-pre-may16-readiness-ledger.md`, `p6-seven-day-proof-and-hardening.md` — the exact
   report CLI invocation, how the seven-day window is chosen, what "credited /
   human-approved outcome label" means mechanically, and whether the May proof was
   already credited.
3. CLI surface: the `beep ai-metrics` command tree (registration under
   `packages/tooling/tool/cli/src/commands/`, library barrel
   `packages/tooling/library/ai-metrics/src/index.ts`) — report/scorecard command flags,
   `mirror build` / `mirror sync` / `mirror status` semantics.
4. OTLP journal mechanics in `otlp.ts` / `forwarder.ts` / `models.ts` (see issue 1).
5. `SPEC.md` + `ops/manifest.json` (`v1Completion`, `completionGate`) — the exact flip
   conditions, plus a full inventory of stale claims to correct in the closeout PR.

## Execution order

1. Recon reads above.
2. Diagnose + clear the OTLP export failure; verify the journal drains (next timer run or
   manual `forwarder run`); fix the running-checkout staleness if it's the cause.
3. Generate the final seven-day report from live data (per the proof-contract mechanics).
4. P7e: `mirror build` → `mirror sync --confirm p7-derived-mirror` → verify remote
   `mirror status` on dankserver.
5. Closeout PR from a feature branch (main is PR-only): correct every stale
   manifest/SPEC/PLAN/README claim (XDG data root, no proof worktree, real timer
   topology), flip P6/P7/lifecycle as far as truth allows, land the packet reflection in
   the same PR (same-PR packet-state flip law; `bun run beep goals index --write` in the
   same commit), record friction receipts in the packet ledger as they happen.
6. Ship via yeet: `bun run beep yeet verify` → `yeet publish --push-only --reuse-verified --pr`
   → `yeet monitor` → resolve every review thread via `yeet reply`. **Do NOT merge — the
   operator merges.**

## Standing constraints

- Secrets remain `op://` references; never print resolved values.
- dankserver: SSH/rsync for the mirror sync is expected and fine; anything sudo/ansible
  on dankserver is YubiKey-gated — announce before running.
- Known yeet gotchas: `--pr` titles the PR from the HEAD commit subject (fix with
  `gh pr edit` if the branch was merged forward); changeset required (no-release empty
  frontmatter is fine for docs/ops-only); flipping a goal manifest requires the goals
  index regen in the same commit.
- Timer runs every ~6h — avoid racing it while mutating the data root; `flock` in the
  unit protects the forwarder itself, but prefer running manual forwarder/report commands
  right after a timer run completes.
