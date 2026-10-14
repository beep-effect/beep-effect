# effect-drizzle tstyche 8 Spec

## Objective

Move @beep/effect-drizzle to exact tstyche 8.0.0-beta.0 and run its existing
assertions on `5.9.3 || 6.0.3` (hosted) and `next` (on demand) without loading the root 6.x API
for explicit targets. Next resolved to 7.1.0-dev.20261014.1 on 2026-10-14.

## Non-Goals

- Changing tsc-rs 0.6.0 gates or @effect/tsgo 0.51.1 editor/tool pins.
- Removing the root TypeScript 6 dependency for other consumers.
- Loosening assertions, unauthorized target substitutions, or lane publication.

## Source Hierarchy

User lane envelope and 2026-10-14 orchestrator ruling, then AGENTS.md and skills,
then this SPEC, PLAN, GOAL, and supporting evidence.

## Target Surfaces

- packages/ecosystem/effect-drizzle/package.json and tstyche.config.json
- Package typetests only for genuine 8.x behavior changes
- bun.lock and syncpack.config.ts Held back group
- docs/runbooks/typescript-toolchain.md tstyche row
- goals/effect-drizzle-graduation/research/OPPORTUNITIES.md historical entry
- This packet and the external orchestrator report-C.md

## Constraints

Keep the beta pin exact and explain the stable 8.0 exit criterion in syncpack.
The lane never stages, commits, pushes, runs gh or Yeet, or completes this
packet. The orchestrator owns publication and post-merge closeout. Heavy
verification uses beep-heavy. Build dependency dists before typechecking.

## Acceptance Criteria

- [x] Review upstream breaking changes and backend resolution before editing.
- [x] Pin beta, hold it, and select the authorized exact-dev / next fallback.
- [x] Run unchanged assertions on all three targets (36 tests / 234 assertions).
- [x] Resolve the historical limitation and update the runbook based on proof.
- [x] Full package-verify passes (audit 15.0s, docgen 4.0s).
- [x] Preserve unrelated work and write the lane report.

The original 7.0.2 stop was superseded by the orchestrator ruling. Exact
7.1-dev was refused; next passes. Full package verification passed.

## Verification Matrix

| Check | Evidence | Result |
| --- | --- | --- |
| Published artifact integrity | SHA-512 matches npm metadata | Pass |
| Exact beta + requested target matrix | history/target-7.0.2.log | Exit 1: unsupported 7.0.2 |
| Packet size / JSON / whitespace | Lane report | Pass |
| Exact gate-matching dev | history/type-test-exact.log | Exit 1 before assertions |
| Authorized next matrix | history/type-test-next.log | Exit 0; 3 targets / 234 assertions |
| Store listing | history/list.log | Newest stable 6.0.3; next 7.1.0-dev.20261014.1 |
| Full package-verify | history/package-verify.log | Exit 0; audit 15.0s / docgen 4.0s |

## Stop Conditions

Withdrawn: the original 7.0.2 stop was confirmed, then superseded on 2026-10-14.
Use the ruling's exact-dev, next, legacy-only preference order; record failures
and follow-ups. Never substitute tstyche 7.2.5. Missing required sources or
spend beyond existing authorization still stop this lane.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-14 | Probe the exact published beta in a disposable worktree-local extraction before dependency edits. | Research shows 7.0 is intentionally excluded; avoid leaving an unusable pin or config. | Install the same beta normally when the target contract becomes satisfiable. |
| 2026-10-14 | Use a worktree-local TSTYCHE_STORE_PATH and fetch npm metadata with curl. | Default npm cache writes fail EROFS; the lane may write only its approved paths. | Use default cache/store in a session where those paths are writable. |
| 2026-10-14 | Stop implementation; retain 7.2.2, the existing matrix, assertions, lockfile, hold and runbook. | Beta exits 1 on 7.0.2; user explicitly requires stopping rather than fallback. | Orchestrator revises the target contract, or upstream adds support, then resume. |
| 2026-10-14 | Leave the old graduation receipt unresolved and packet active; mark research blocked. | No successful TS7 assertion run exists; orchestrator owns packet completion after merge. | Add a dated resolution after the requested target actually passes. |
| 2026-10-14 | Do not run dependency builds or package-verify after the target stop. | No package implementation changed and the required compiler target is impossible. | Run dependency builds, type-tests and full package verification on the resumed implementation. |
| 2026-10-14 | Store the handoff in report-C.md; do not write the global session ledger. | User restricts work to the lane plus the specified report; global session state is outside writable roots. | Orchestrator records the session note from its authorized session. |

| 2026-10-14 | Orchestrator withdraws 7.0.2; prefer exact `5.9.3 || 6.0.3 || 7.1.0-dev.20261008.1`, then `next` if exact dev is refused, then explicit `5.9.3 || 6.0.3` if no TS7 target runs; keep beta 8.0.0-beta.0. | Beta requires the 7.1 API; tsc-rs gates pin 7.1.0-dev.20261008.1. Moving next needs a pin follow-up; legacy-only needs the exact TS7 error and open follow-up. Explicit targets use the store rather than root TypeScript 6. | Restore the previous dependency/config from the reviewed diff, or pin a listed 7.1 beta/stable after fresh assertion proof; never silently substitute tstyche 7.2.5. |
| 2026-10-14 | Pin beta and try the exact 7.1-dev matrix first; retain package's existing TypeScript devDependency for now. | Explicit store targets do not load the root API; removing unrelated consumers is outside this lane. | Revert package/config/lockfile edits; assess dependency removal separately. |
| 2026-10-14 | Use `tmp/ts7-tstyche8/store` inside the lane for TSTYCHE_STORE_PATH. | Existing tmp/ ignore makes downloaded compilers disposable without tracked ignore changes. | Remove only that cache or use a confirmed writable default store. |
| 2026-10-14 | Retry beep-heavy with standard user-bus variables. | Initial wrapper could not connect before starting the build. | Omit the exports in a harness that supplies them. |
| 2026-10-14 | Select authorized second preference `5.9.3 || 6.0.3 || next`; record moving target and exact-pin follow-up. | Exact 7.1.0-dev.20261008.1 is rejected before assertions; next resolves to 7.1.0-dev.20261014.1 in beta's manifest. | Pin an accepted exact 7.1 beta/stable after running the same assertions; if next cannot run, use the authorized legacy-only matrix and record its error. |

| 2026-10-14 | Redact home paths and trim trailing whitespace from public evidence logs; use the specified report for closeout. | Captured CLI code frames contain trailing spaces; the lane cannot write the global session ledger, and publication belongs to the orchestrator. | Keep raw logs in ignored tmp/ for comparison; orchestrator writes the global ledger from its authorized session. |
| 2026-10-14 | Hosted matrix pinned to `5.9.3 || 6.0.3`; `next` moves to an on-demand local run (`beep:type-test --target next`). Resolved version recorded: 7.1.0-dev.20261014.1 on 2026-10-14, 78/78 assertions. | Repo-orchestrator review of #1701: a floating `next` in hosted `beep:check` changes results day to day with no diff and could turn main red from an upstream dev build. | Add `next` (or an exact 7.1 version once tstyche lists one) back to `target` in tstyche.config.json. |

## Exception Ledger

No assertion waivers. The authorized next target moves independently of the
tsc-rs exact dev pin; follow-up C-1 pins a supported exact 7.1 beta/stable.

