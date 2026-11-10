# Phase 2 audit brief (shared by every seat)

Repo: ~/YeeBois/projects/beep-effect, branch main, clean. Do not create worktrees. Do not edit
tracked files. Do not run git write commands, installs, yeet proofs, coverage, docgen, or any whole-repo lint/test/check.

Read first: ../phase1/SURFACE-INVENTORY.md (the phase 1 surface inventory; your area's section plus
sections 1, 3, 4, 4b, K and L), then your area's rows in ../phase1/components-compact.md,
levers-compact.md and rejected-questions-gaps.md, and the matching component rows in
../phase1/astra-surface-map.md. Then widen from the repo itself. Prefer code and receipts over prose.

Operator rulings, 2026-11-09 (binding for this audit):
1. Target: on pull-request runs, p95 time from push to every REQUIRED context green under 10 minutes, reported
   beside total runner-minutes per run (latency and compute are separate objectives; never trade one silently
   for the other); every main commit gets a hosted verdict; local `yeet verify` and `yeet publish` under 10 minutes.
2. Scheduler: extend the existing QualityScheduler (admission unit = lane or package, weights from measured
   peaks, currently unadmitted work admitted in small units). No second admission authority, no "checker agent".
3. In flight and out of scope (assume merged): #3005 hosted integration partitions, #3007 Test Unit repack,
   #3014 lint Turbo inputs. Do not re-propose their content; you may depend on it.
4. Respect the 120 rejections in rejected-questions-gaps.md and the constraints in inventory section K. If you
   want to reopen one, name the NEW evidence that would reopen it.
5. Trust is not negotiable: no proof depth reduction disguised as efficiency (property run floors, coverage
   floors, canonical test census, required contexts always present as skip-satisfied).

Allowed commands: file reads, ripgrep, `bun run beep <cmd> --help`, `bun run beep quality scheduler status`,
`bun run beep yeet economics [--fleet]`, `bun run beep ci lane-timings ...` (read-only gh), read-only `gh` API,
`bunx turbo run <task> --dry-run=json [--filter=...]`, reading `.turbo/runs/*.json`, `.beep/yeet/**` receipts,
`~/.beep/runtime/beep-admit-uid-1000/` journals. Bounded measurement is allowed when a lever's estimate needs
it: at most two single-package Turbo task runs (`bunx turbo run lint|check|test --filter=@beep/<small pkg>`),
each under two minutes, never law-practice-server or repo-cli, never coverage. Replace absolute home paths with
`~` in output. Never print secrets. Budget about 45 minutes; write partial results rather than nothing.

Deliverable per lever (be concrete; cite files and numbers with sources):
- id, title, area; mechanism: what changes and where (files/commands); grain the check would run at
  (file | package | affected-set | repo) and why that grain is sound;
- savings estimate: hosted runner-minutes per PR run, critical-path minutes per PR run, local wall minutes per
  publish and per verify, CPU-seconds where relevant; basis = measured | derived | guess, with sources;
- trust risk: level, the failure mode (what stale-green or missed red it could cause), mitigation;
- admission gate: how the change is proven before it lands (route replay + mutation fixture | cache
  qualification | parity ledger | A/B measurement with controls | none, pure waste removal);
- prior art: what already shipped, what was rejected or parked and where; dependencies on in-flight PRs or
  other levers; PR slices (title, files, size S/M/L); confidence; open questions.
Rank your levers by (minutes saved per week across hosted PR runs and local attempts) / trust risk. Use real
volumes: count PR runs per day with `gh run list --workflow check.yml --event pull_request --limit 100`, and
local attempt counts from `yeet economics` (publish 188, verify 157 in ~3 months in one checkout; fleet 2,596).
Also report: measurements you ran (command, result), contradictions with the inventory, operator-only questions.
