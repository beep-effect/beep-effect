# Canonical Effect Vitest tests

## Status

Lifecycle: `active`. P0a through P0.5 are complete. P0f adversarial review is incomplete.
Benjamin resumed PR #1067 closeout on 2026-09-09. Continue from
history/2026-09-09-pr1067-resume.md; merge and later-phase gates remain.
The machine-readable state is in [ops/manifest.json](./ops/manifest.json).

## Mission

Bring every in-scope test to canonical Effect Vitest rc.113 idioms, prove resource
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

## Latest evidence

The proposal contains all 15 detector rules, the 100-entry rc113 API graph, four
lens charters and the instrumented runner. Main through 8cb18e6, including #1060
and #1082, is merged locally at 3630388. The remote checkpoint remains b86269212e;
its Greptile 5/5 and closed threads do not prove the unpublished repairs.

The adopted inventory contains 7,775 open candidates across 1,000 tests and 110
support modules. Complete reconciliation preserves the census, all 29 generated
declarations and every finding disposition, with no unexplained loss or exception
transfer. The canonical writer and all three normal lint commands pass; timings
are 9.943s, 9.503s and 9.588s with complete resource context retained. Earlier
failed cohorts remain historical evidence.

The repaired runner passes all 52 registrations on Node 22, Node 24 and Bun plus
normal scoped Node 22 coverage. The detector passes 207 focused cases and final
repo-cli audit/docgen in 423.690 seconds. Round one and round two are closed;
round three is the remaining adversarial review. Final CLI coverage, full
aggregate proof and exact-head hosted/review closure remain. The publishing commit
must include the repo-configs changeset. Continue from the September 10 integration
record; these local proofs do not yet make the remote PR merge-ready.

[PR #1047](https://github.com/beep-effect/beep-effect/pull/1047) promoted the
conformant MemoryFileSystem and was merged by Benjamin on 2026-09-09 after all
18 required checks passed, Greptile reached 5/5, and every review thread closed.
See PLAN.md and the dated receipts in history for current proof and limits.
P0g plan ratification and merge are required before P1; Benjamin must acknowledge
the full inventory before P2 begins.
