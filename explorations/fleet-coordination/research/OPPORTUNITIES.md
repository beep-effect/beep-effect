# Friction Ledger

Receipts recorded at the moment friction happened, per the repo's friction-first-class law.

## 2026-08-10 — flake-quarantine arbitrates per-package, but the flake is per-lane-execution

> **Corrected 2026-08-10, same day, after PR #635 review.** This receipt was first filed as
> *"flake-quarantine reruns a flaky lane at the concurrency that induced the flake"*, recommending
> a serial rerun. That was **wrong, and asserted without reading the implementation** — a
> `chatgpt-codex-connector` review thread caught it. `attemptFlakeQuarantine` already reruns each
> detected package standalone (deliberately keeping `TURBO_FORCE` so the compiler actually runs
> rather than replaying cache), then reruns the lane with `TURBO_FORCE` removed, and quarantines
> only when both come back green. The recommended fix was already shipped. The corrected finding
> below is narrower, load-bearing, and supported by the log rather than by inference. Kept in place
> per this packet's refuted-claims convention; the misattribution is itself the third receipt.

- **Doing:** proving the T6 docs branch through `bun run beep yeet verify` before publishing.
- **Evidence:** verify failed with one lane red — `quality:build` — and the log records the exact
  arbitration sequence:

  | Log line | Event |
  | ---: | --- |
  | 450 | `no-location TS2589 flake signature detected for @beep/ui#build; rerunning standalone once` |
  | 451–502 | standalone rerun of `@beep/ui` → **8/8 successful, green** |
  | 503 | `quality:build:flake-lane-rerun: bun run build` |
  | 626 | `@beep/box:build: error TS2589` — **a different package** |
  | 716 | `lane rerun failed with exit 2; keeping failure hard` |

  The isolation step worked: `@beep/ui` cleared standalone. The lane rerun then re-exposed all
  ~130 packages to the same environment condition, and the flake landed on `@beep/box` instead.
  `quality:check` ran the identical dance for `@beep/xai` (lines 2523–3059), its lane rerun
  happened to come back clean, and it quarantined successfully — same mechanism, opposite outcome,
  which is the non-determinism itself.
  Serial reproduction on the identical tree cleared everything: after removing the warm
  `node_modules/.tmp/tsconfig.tsbuildinfo` for both packages (a cold compile — regenerated at
  2.27 MB), `turbo build --filter=@beep/ui --filter=@beep/box --force` passed, and a full
  `bun run build` passed **131/131 in 24s** with zero TS2589. A later verify on a *larger* tree
  passed **21/21**. The branch diff is markdown only (`explorations/**`, `.changeset/*.md`).
- **Cost:** one full verify cycle burned, plus a manual attribution pass (locate the error class,
  find the tsbuildinfo under `node_modules/.tmp/` rather than the package root, force a cold
  rebuild, run the whole build lane) before any publish decision was safe.
- **Prevention:** the arbitration is **per-package**, but the flake is **per-lane-execution**.
  Quarantining the detected package and rerunning the whole lane hands the same environment
  condition a fresh roll across every other package. With per-package flake probability `p` over
  `N` packages, one lane rerun re-exposes all `N`, so the arbitration converges only when `p·N ≪ 1`
  — and it demonstrably is not: two consecutive hits on different packages inside one verify, plus
  a third in another lane that happened to clear.
  The fix is therefore **not** a serial rerun (already implemented, and it worked). It is that the
  lane rerun must be flake-aware for the **class**, not only for the originally-detected package:
  a lane rerun that fails with a *new* no-location TS2589 in a *different* package is another
  instance of the same environment-only class, and should re-enter bounded arbitration rather than
  hard-fail. The no-location signature is already trusted for detection (line 450) — it is simply
  not applied to the lane rerun's own failure. Bound it (say, two re-entries, distinct packages
  each time) so a genuinely broken build still fails.
  Candidate home: the flake-quarantine policy in
  `packages/tooling/tool/cli/src/commands/Quality/internal/FlakeQuarantine.ts`, alongside the
  existing timeout flake class. This receipt is routed to
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

## 2026-08-10 — I filed a misattribution receipt by misattributing, from log output alone

- **Doing:** writing the first receipt on this page, hours before PR #635 review caught it.
- **Evidence:** the original text claimed flake-quarantine "reruns a flaky lane at the concurrency
  that induced the flake" and recommended a serial rerun. Both the claim and the recommendation
  were already false: `FlakeQuarantine.ts` reruns each detected package standalone first, and
  deliberately keeps `TURBO_FORCE` on that rerun so the compiler actually executes instead of
  replaying a cached green. The log even shows the standalone rerun passing 8/8 before the lane
  rerun failed. I read `[flake-quarantine] … lane rerun failed with exit 2; keeping failure hard`
  and inferred the mechanism from that one line instead of opening the 445-line module that
  implements it. A reviewer bot read the module.
- **Cost:** a wrong receipt committed to a public branch, recommending a change that was already
  shipped — which, had it been actioned, would have been churn against working code. Caught only
  because the PR draws two independent reviewers.
- **Prevention:** the repo already has the law — *"attribute verification failures before
  repairing — introduced / inherited / unrelated / environment-only."* I applied it rigorously to
  the **failure** (cold rebuild, full build, 131/131) and not at all to the **gate**. Attribution
  discipline has to cover the mechanism you are indicting, not just the artifact that failed. The
  operational rule: a receipt that names a component's behavior must cite that component's source,
  not its log line. Note the shape — the first receipt on this page is about a gate reaching a
  confident wrong conclusion from insufficient evidence, and it reached a confident wrong
  conclusion from insufficient evidence.
