# Brief

<!-- Stage 3. Shape Up pitch at fat-marker fidelity. -->

## Problem

Agents working this repo are effective but expensive and slow to land work.
Two compounding causes:

1. **Agent-config friction**: Claude and Codex see different rule sets (11
   rules Claude-only, 18 Codex-only), 533KB of skills with three
   context-heavy monoliths, no permission allowlist (every session
   re-negotiates the same prompts), and 142KB of nested instruction files of
   unaudited freshness.
2. **Pipeline latency**: yeet runs turbo at concurrency 3 on a 32-core box;
   PR CI lanes rebuild cold-cache on 2–4 vCPU runners; local proof and hosted
   CI verifiably diverge (green local ≠ green hosted); three review bots
   triple closeout churn; six duplicate clones tax every sync. Result:
   sometimes 8+ hours to a merged branch — which trained the operator into
   speed-over-hygiene habits (red main, "saving" mega-commits) that
   REPO_RATING.md scored 3–4/10.

## Appetite

One goal packet, one PR, executed in a single working day (<8h active).
Claude leads and verifies; Codex grinds mechanical lanes; Phase-D
optimization design is Fable-direct (user mandate).

## Solution Sketch

Five phases, sequenced but internally parallelizable:

- **A. Packet ceremony** (this packet → `goals/agent-pipeline-velocity`, ledger surgery superseding 4 overlapping goals).
- **B. Quick strikes**: greptile-only review lineup (Chrome deactivation early); read-only PR turbo cache (CSF-001 amendment); main green (verify/fill-gaps after PR #291 merges).
- **C. Agent effectiveness**: single-source generator for CLAUDE.md+AGENTS.md with drift check; nested-instruction audit; progressive disclosure for the 3 heavyweight skills; `.claude/settings.json` allowlist; bounded context-tooling verdict (headroom et al.).
- **D. Pipeline rqt-011+** (Fable-direct): instrument phase wall-times → baseline; benchmark yeet concurrency 3→8/16/24; local/hosted parity lanes in verify; attack rqt leftovers in measured-win order; crispen-scoped refactors only where they unblock.
- **E. Worktrees + closeout**: `beep worktree new/remove/doctor`; incremental clone retirement; reflection + rating delta.

## Rabbit Holes

- **Unbounded crispen**: 8.3k-LOC Yeet internals invite a full rewrite. Gate: refactor only what an identified optimization needs; ledger the rest.
- **Full jsdoc backlog** (2,003 missing @example): only the ~306 CI-blocking warnings are in scope.
- **External tooling churn**: rqt-010 waiver stands — no oxlint/rolldown/etc. swaps without isolated proof; headroom-class adoption only with measured benefit.
- **Worktree flag-day**: migration is incremental, per-merge; never force-move in-flight clones.
- **Concurrency benchmarking**: memory pressure at high turbo concurrency (tsgo/vitest per-package) — measure, don't assume 32 cores ⇒ 32 tasks.

## No-Gos

- Branch protection on main (deferred past this goal).
- Multiple PRs / stacked PRs.
- Weakening any quality gate to gain speed (parity work must strengthen, not dilute).
- Codex/lower-tier models doing Phase-D analysis or redesign.
- New always-loaded context (CLAUDE.md/AGENTS.md must not grow net; cache-prefix discipline holds).
