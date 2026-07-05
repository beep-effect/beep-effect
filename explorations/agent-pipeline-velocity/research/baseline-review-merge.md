# Baseline: PR Review Surface & Merge Path (2026-07-05)

Explorer-agent inventory; facts only.

## Review bots

- Closeout gates (`Yeet/internal/Closeout.ts:358` `PrCloseoutGateName`): `hosted-checks | review-threads | greptile | coderabbit | chatgpt`.
- Greptile: scored gate (target 5/5, 0 issues), manual retrigger via `@greptileai review` comment, `--retrigger-greptile` flag only. CodeRabbit/ChatGPT: unresolved-thread counting only. **None is a GitHub-required check** — all gating is yeet-closeout-level with explicit flags.
- openclaw is NOT a PR reviewer (ai-metrics transcript ingestion only). No .coderabbit.yaml/.greptile config files in-repo; bots configured as GitHub Apps (vendor side).
- Closeout writes (reply/resolve threads) only with explicit per-thread flags.

## Merge path

- No branch protection, no rulesets, no auto-merge, no merge queue. Manual merge after checks green + threads resolved (yeet skill step 10).
- Last 8 merged PRs: median ≈ 40 min; mean 3.98h; **size correlates with duration** — #286 (+2/−3) 17s; #289 (+2.7k) 1.3m; #287 (+10.7k) 5.5h; #284 (+153k/−77k) 19.5h.

## Parallel checkouts vs standard

- `standards/git-worktrees.md` prescribes sibling worktrees under `beep-effect-worktrees/` with a bootstrap checklist (submodule init, bun install, restore .env/.direnv/.claude/settings.local.json/CLAUDE.local.md/.beep/.idea) and a documented migration path to retire `beep-effectN` duplicate clones. Current practice (../beep-effect2..7 full clones) is drift from this standard. No automated sync/bootstrap tooling exists in the beep CLI.

## Hardware & runners

- Workstation: Threadripper 9970X (32c/64t, 4.0→5.4GHz), 128GB DDR5-5600 ECC, PCIe5 NVMe (~14.9GB/s read). Local parallelism ceiling ≈ 32 tasks.
- Blacksmith: labels blacksmith-2vcpu-ubuntu-2404 / blacksmith-4vcpu-ubuntu-2404; no cost/concurrency config in-repo.
