---
title: "Drainable class: report every fleet run, apply only on explicit --classes drainable"
date: 2026-11-13
lane: "goals/legacy-drain"
reversal: "Remove drainable from ResidueReapClass and the drain fields from FleetRegistryRow; registry rows decode without them"
---

Evidence (2026-11-13 census): 354 fleet checkouts, 9 legacy clones, 345 linked worktrees; 330 read `unknown` liveness and none `dormant`, because 995 of 1,459 pids have unreadable cwds (954 root-owned), so the mirror's process scan never completes. Every legacy clone still has registered worktrees, carries 100 to 800 local-only commits, and `beep-effect0` borrows objects from `beep-effect` through `objects/info/alternates`.

Calls:

1. `drainable` is assessed in every `residue-reap --fleet` run (dry-run by default) but removes only when `--classes drainable` names it. `beep-residue-reap.timer` runs `--apply --fleet` with default classes; it accrues grace observations but never drains.
2. Confirmed not-live reuses `classifyFleetLiveness` with the reaper's documented cwd-probe policy (unreadable pids dropped, invoker ancestry excluded) plus transcript and tree mtime readings. Any `unknown` or failed probe blocks.
3. Checks per checkout: seat role (`legacy`/`adopted` only), retention exemption, invoking checkout, timer host, active `beep-proof-*` unit, open PR on the checked-out branch, open session-ledger row, liveness, owned worktrees (clones), object borrowers (clones lending objects through alternates), local-only work, clean tree, grace window.
4. Grace window: 7 days by default (`--drain-grace-days`), counted from the first observation at an unchanged HEAD. It lives in the registry row (`drainingSince`, `drainingHead`, `drainStatus: draining`), and a failing observation resets it.
5. Local-only work is bundled to `~/.local/state/beep/fleet/<repo-key>/drain-bundles/` and verified (`git bundle verify` plus every local-only ref listed in the bundle) before removal. Every apply-mode removal or refusal is appended to `drain-journal.jsonl` beside the registry.
6. Waves report `du` totals across registered legacy clones before and after, measured only when `drainable` is named explicitly.
