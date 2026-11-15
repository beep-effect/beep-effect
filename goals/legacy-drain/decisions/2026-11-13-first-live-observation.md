---
title: "drainable class built; first live observation started 221 grace windows"
date: 2026-11-13
kind: checkpoint
lane: "goals/legacy-drain"
reversal: "Clear drainingSince/drainingHead in registry.json rows, or revert the drainable class PR"
---

P0 to P2 done in lane goals/legacy-drain. The `drainable` class lives in `ResidueReapDrain*.ts` with the live probe in `ResidueReapDrainLive.ts`; `residue-reap-drain.test.ts` proves the predicate against real git fixtures (grace window, opt-in, bundle-before-remove with an unwritable bundle refused, unknown liveness refused, registered worktree refused, borrowed object store refused, HEAD movement restarting grace).

First live dry run, 2026-11-13T22:06Z, `residue-reap --fleet --classes drainable`, 56 s: 352 fleet checkouts, 9 registered legacy clones holding 166,242,401,382 bytes. 221 lanes met the predicate and started their grace windows (registry `draining`). 129 were refused: session-ledger 78, clean-tree 42, liveness 18, open-pr 11, proof-unit 9, owned-worktrees 9 (every legacy clone), timer-host 3 (`beep-effect`, `beep-effect0`, one `beep-effect11` lane), object-borrowers 1 (`beep-effect0` borrows from `beep-effect`), plus 1 unreadable layout. Liveness was confirmed dormant for 332 checkouts, against 0 under the mirror's own rule.

The first apply wave is time-gated: the earliest grace expiry is 2026-11-20T22:06Z, and only after the merged code runs at least one more observation at unchanged HEADs.

Fix found by the live run: a dangling unit symlink in `~/.config/systemd/user` failed the timer-host probe for every checkout; dangling unit links are now skipped, since systemd cannot load them either.
