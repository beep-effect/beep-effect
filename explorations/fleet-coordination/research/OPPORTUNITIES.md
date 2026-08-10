# Friction Ledger

Receipts recorded at the moment friction happened, per the repo's friction-first-class law.

## 2026-08-10 — flake-quarantine reruns a flaky lane at the concurrency that induced the flake

- **Doing:** proving the T6 docs branch through `bun run beep yeet verify` before publishing.
- **Evidence:** verify failed with one lane red — `quality:build`. The failure was
  `error TS2589: Type instantiation is excessively deep and possibly infinite.` in `@beep/ui`
  and `@beep/box`, with `@beep/xai` hitting the same error in `check`. All three are
  **location-less**: no `file.ts(line,col)` prefix, which is the known native-compiler flake
  signature. The quarantine then reran the lane and recorded
  `[flake-quarantine] quality:build: lane rerun failed with exit 2; keeping failure hard`,
  escalating a known-flaky class into a hard verify failure.
  Serial reproduction on the identical tree cleared it completely: after removing the warm
  `node_modules/.tmp/tsconfig.tsbuildinfo` for both packages (a cold compile — the file was
  regenerated at 2.27 MB), `turbo build --filter=@beep/ui --filter=@beep/box --force` passed,
  and a full `bun run build` passed **131/131 in 24s** with zero TS2589. The branch diff is
  markdown only (`explorations/**`, `.changeset/*.md`), so there is no mechanism by which it
  changes instantiation depth in `@beep/ui`.
- **Cost:** one full verify cycle burned, plus a manual attribution pass (locate the error class,
  find the tsbuildinfo under `node_modules/.tmp/` rather than the package root, force a cold
  rebuild, run the whole build lane) before any publish decision was safe.
- **Prevention:** two independent fixes, either of which would have avoided the false red.
  1. **Change the condition on retry.** The quarantine rerun reproduced the failure because it
     re-ran under the same parallel lane load that produced it. A quarantine retry that does not
     vary the suspected cause is not a quarantine — it doubles the cost and then fails anyway.
     Rerun the quarantined lane serially, or at reduced concurrency, before `keeping failure hard`.
  2. **Treat location-less TS2589 as its own signal class.** A TS2589 with no file position cannot
     be the compiler pointing at user code; it is the compiler reporting its own limit. That is
     mechanically distinguishable from a real TS2589 and should not be scored the same way.
  Candidate home: the flake-quarantine policy in the yeet lane runner, alongside the existing
  timeout flake class. This receipt is routed to
  [`goals/ci-fleet-endgame`](../../../goals/ci-fleet-endgame/README.md) rather than filed there —
  that packet's ledger is contested across three live checkouts (`closeout`, `endgame`,
  `beep-effect9`), which is exactly the collision this exploration exists to avoid.

## 2026-08-10 — one checkout with a huge uncommitted tree swamps the Mode A contested index

- **Doing:** dogfooding `beep worktree fleet` (rung 1, shipped in #621) to decide whether writing
  the receipt above into `goals/ci-fleet-endgame/research/OPPORTUNITIES.md` would collide with the
  sessions actively working that packet. It answered correctly and immediately — three checkouts
  contend there — so the tool did its job.
- **Evidence:** the same snapshot reports **1185 contested paths** across 23 clones / 87 checkouts,
  and the distribution is pathological rather than informative:

  | Checkout | Contested rows | Dirty files |
  | --- | ---: | ---: |
  | `beep-effect9` | 895 (75.5%) | 5133 |
  | `beep-effect7` | 470 | 260 |
  | `p1-property-lane` | 225 | — |

  `beep-effect9` alone appears in three of every four contested rows because it carries 5133
  uncommitted files. The contested index is an unweighted union of dirty paths, so a single
  checkout in a dirty state drowns every genuine two-agent collision in the same list.
- **Prevention:** the signal that matters is *a path two agents are both actively changing*, not
  *a path that appears in more than one working tree*. Options, cheapest first: rank contested
  rows by how many **live** checkouts touch them (rung 1 already measures liveness, and the
  renderer already truncates at 20 — it is truncating the wrong end); exclude or flag checkouts
  whose dirty count exceeds a threshold, reporting the exclusion rather than silently dropping it,
  per the measured-or-`unknown` law; or weight by recency of modification. Note this is a
  **presentation** defect, not a correctness one — every contested row is a true measurement, and
  no field is falsely `clean`. Candidate home: rung 1.5 alongside the registry liveness probe in
  [`T6`](./T6-cross-session-messaging.md) §4.
