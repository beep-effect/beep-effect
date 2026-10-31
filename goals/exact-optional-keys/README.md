# Exact optional schema keys

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Migrate S.optional, S.withDecodingDefault and S.OptionFromOptional fields to their exact *Key siblings with a tested codemod, and guard it with an EF-40 GritQL law

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/exact-optional-keys/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - supporting research, if present.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P3: implementation PRs #2145 and #2316 are merged. PR #2316 has 15 green
required checks at its accepted head and zero outstanding review threads. The
readiness monitor stopped before recording a positive local verdict, so a final
documentation closeout PR #2326 must retain that verdict before merging. Lifecycle stays active.

## Latest Evidence

- Detection reconciliation: [`research/detection-reconciliation-2026-10-28.jsonc`](./research/detection-reconciliation-2026-10-28.jsonc).
- Package verification: [`research/package-verification-2026-10-28.md`](./research/package-verification-2026-10-28.md).
- Completion audit: [`research/completion-audit-2026-10-28.md`](./research/completion-audit-2026-10-28.md).
- Closeout reflection: [`history/reflections/2026-10-28-codex.md`](./history/reflections/2026-10-28-codex.md).
- Grounding: [`research/optional-vs-optional-key.md`](./research/optional-vs-optional-key.md).
- Exceptions: [`research/classification-ledger.md`](./research/classification-ledger.md).
- Exhaustiveness and CI proof: [`research/verification.md`](./research/verification.md).
- Friction: [`research/OPPORTUNITIES.md`](./research/OPPORTUNITIES.md).
- Reflection: [`history/reflections/2026-10-23-claude.md`](./history/reflections/2026-10-23-claude.md).

## Notes

Re-run `bun run beep lint schema-parity-codemod --rule exact-optional-keys --path packages --path apps --path scratchpad --path infra --write` after every base merge; live lanes keep adding `S.optional`.
