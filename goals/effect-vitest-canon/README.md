> Integration resumed, 2026-10-09: lane `rsc-v-vitest-canon` transfers the
> unpublished continuation delta after #1506 and the six-file detector WIP onto
> current main under Effect/Vitest 4.0.2. #1506 merged `c921d9e11d` as
> `705ab128c0`; local consolidation `e4c608f9c1` was never its PR head.
> P1/P2 remain active, P3 pending. Historical proof banners below describe their
> original bases. See [the reconciliation receipt](../repository-simplification-confidence/history/receipts/stage-4-vitest-reconciliation.md).

> Property-boundaries C4 qualified locally, 2026-10-06: source `5ba9351314`
> fixes fourteen historical property rows. Node/Bun retain 915 original cases
> plus four controls; typing and full package audit/docgen pass. Three wrapper
> candidates remain open; one native-import exception is added. The baseline
> remains 1,867 findings; P1/P2 active, P3 pending. See
> [the final proof and limits](research/cli-property-boundaries-proof.md).

> Property-boundaries C4 preparation, 2026-10-06: all fourteen historical human
> rows remain open. The final calendar-exact source snapshot passes 919 cases
> on Node/Bun and qualified direct typing; full package proof and parent review
> acceptance remain pending. Detector/baseline mapping is proposed, unapplied.
> See [the draft proof and its limits](research/cli-property-boundaries-proof.md).
> Lifecycle and all P1/P2/P3 gates remain unchanged.

> Native resource continuation, 2026-10-06: source `b286f35a4d` qualifies the
> remaining nine historical resource findings. Node/Bun each pass 479 cases;
> full package audit/docgen and independent review pass. The updated ledger
> retains 212 open detector and 30 actionable human rows; the live baseline
> remains 1,866 findings. This second source batch is not yet published.
> See [its proof and limits](research/cli-resource-next-proof.md).
> P1/P2 remain in progress and P3 remains pending.

> C3 property-values reconciliation, 2026-10-06: source `9d74894c…` fixes seven
> historical property rows after independent R3 closes the launcher P1 and
> final Node/Bun137-case, compiler and full package proofs pass. Six selected
> detector rows and the nonempty baseline are unchanged; lifecycle gates remain
> open. See [current bounded proof](research/cli-property-values-proof.md) and
> [exact lineage](research/cli-property-values-lineage.json). Older cohort and
> status receipts below retain their dated provenance.

> Continuation, 2026-10-06: work the existing repo-cli backlog in
> `codex/effect-vitest-canon-continuation` on the installed 4.0.1 cohort.
> PRs #1390, #1467 and #1468 are merged. P1/P2 remain in progress; P3 is pending.
> See [current provenance](history/2026-10-06-continuation-provenance.md).
> Older status and cohort sections below retain their dated evidence.

> Current-source amendment, 2026-10-01: new work uses the verified Effect /
> Effect Vitest 4.0.0 cohort, Vitest 5.0.3 and GPT-6.1-Sol medium. Older
> rc.113/version/model receipts retain their historical provenance. See
> [the cohort receipt](history/2026-10-01-current-source-cohort.md).
> D1–D14 and all remaining acceptance gates are unchanged.

# Canonical Effect Vitest tests

## Status

Lifecycle: `active`. P0a through P0g are complete. PR1067 is merged and
Benjamin ratified continuation on 2026-09-11. P1 inventory and P2 remediation
waves are both in progress. See
[the ratification receipt](history/2026-09-11-p0g-ratification-p1-start.md).
The machine-readable state is in [ops/manifest.json](./ops/manifest.json).

## Mission

Bring every in-scope test to canonical Effect Vitest 4.0.2 idioms, prove resource
and timing behavior, and enforce the result through a syntax-only lint ratchet.

## Read first

1. [GOAL.md](./GOAL.md) is the compact launcher.
2. [SPEC.md](./SPEC.md) contains the normative contract and D1-D14.
3. [PLAN.md](./PLAN.md) records phase gates and current work.
4. [DECISIONS.md](./DECISIONS.md) records decisions and dated exceptions.
5. [research/SOURCES.md](./research/SOURCES.md) records provenance.
6. [research/OPPORTUNITIES.md](./research/OPPORTUNITIES.md) records friction.

## Launch

```text
/goal follow the instructions in goals/effect-vitest-canon/GOAL.md
```

## P1 starting inventory

The refreshed census has 1,122 files across 139 owners: 1,012 tests and 110
support files. The 8,228 detector candidates include 90 inherited additions
on starting main. The baseline remains unchanged; lens coverage and timings
are being collected before the P1 acknowledgement gate.

## Foundation evidence (P0)

The proposal contains all 15 detector rules, the 100-entry rc113 API graph, four
lens charters and the instrumented runner. Main through 8cb18e6, including #1060
and #1082, is integrated. Published checkpoint b721a248a9 passed hosted unit
tests, type checks, lint policy and docgen; this follow-up closes its coverage
regressions and the remaining adversarial findings.

The adopted inventory contains 8,138 open candidates across 1,000 tests and 110
support modules. The third-round repair preserves 7,748 previous row payloads,
updates 27 outcome hints, and adds 363 reviewed scope/provider findings without
removing a row or transferring an exception. All 29 generated declarations remain.
The final ordinary commands pass in 9.563s, 9.630s and 9.926s with unchanged
source and canonical artifacts. Earlier failed timing cohorts remain recorded
in history/2026-09-10-r3-performance.md; no measurement is adjusted for load.

The runner's 52 registrations and scoped Node 22 coverage remain green on its
unchanged source. The detector and Knowledge checkpoint passes 288 focused
cases, compiler, lint, Fallow and full CLI package verification. Final scoped
Node 22 coverage passes 3,656 tests across 181 files with five existing skips;
both prior file-metric regressions are fixed without changing their floors.
All three adversarial rounds are closed, with every finding fixed and verified
in history/2026-09-10-adversarial-round-3-closure.md. See [PR #1067](https://github.com/beep-effect/beep-effect/pull/1067) for
exact-head full local, hosted and review closeout evidence. The superseded
aggregate run ended intentionally before edits and is not accepted proof.

[PR #1047](https://github.com/beep-effect/beep-effect/pull/1047) promoted the
conformant MemoryFileSystem and was merged by Benjamin on 2026-09-09 after all
18 required checks passed, Greptile reached 5/5, and every review thread closed.
See PLAN.md and the dated receipts in history for current proof and limits.
P0g ratification and merge are complete. Benjamin must acknowledge the full
P1 inventory before P2 begins.

## P1 evidence in progress

The [timing baseline index](ops/inventory/timings/baseline-index.json) records all
139 first attempts, including failures and configured runner subsets. The
[hosted-history summary](ops/inventory/hosted-history-summary.json) contains
package job links and explicit evidence gaps. Source-audit progress and the
remaining human gate are tracked in [PLAN.md](PLAN.md); neither successful timing
nor a decoded finding row completes the full P1 inventory.
