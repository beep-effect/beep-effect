# tsgo 0.45 Effect idiom sweep

## Status

Lifecycle: `active`. P0 (grill and packet) complete 2026-09-12. P1
foundations PR is next. Machine-readable state:
[`ops/manifest.json`](./ops/manifest.json).

## Mission

Bump `@effect/tsgo` to 0.45.0 with every rule at error, widen the directive
gate to two declared exemptions, retire the redundant TaggedError equivalence
hook, and restore idiomatic Match combinators repo-wide.

## Launch

```text
/goal follow the instructions in goals/tsgo-045-effect-idiom-sweep/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` is normative.
`ops/prompts/00-orchestrator.md` is the full orchestration prompt.

## Read this first

1. [`DECISIONS.md`](./DECISIONS.md) — D1–D13 and the premise corrections.
2. [`SPEC.md`](./SPEC.md) — normative contract.
3. [`PLAN.md`](./PLAN.md) — phases, PR train, lane roster.
4. [`ops/prompts/`](./ops/prompts/) — orchestrator, discovery, fixer, Match,
   verifier, Cursor lane.
5. [`ops/rule-cards/`](./ops/rule-cards/) — one card per diagnostic.
6. [`ops/shards.json`](./ops/shards.json) — fixer ownership and site counts.
7. [`research/2026-09-12-grounding.md`](./research/2026-09-12-grounding.md) —
   the measured facts behind every decision.

## Current phase

P1 Foundations PR at 0.39.1 — in progress (hook deletion, inverted lint, allowlist, key parity, proof and Cursor smoke test done in the worktree; PR publication next).

## Latest evidence

2026-09-12: grill complete; worktree created; `goals doctor` clean. P1: doc-text proof 0/24,000 on rc.113 with the hook deleted (`history/2026-09-12-annote-error-proof.md`); Cursor lane smoke test green (`history/2026-09-12-cursor-smoke.md`).

## Notes

- Main is never red: remediate on 0.39.1, ratchet to 0.45.0 last (D6).
- The two directive exemptions are the complete allowlist (D1).
- Lanes never run git; the orchestrator commits.
