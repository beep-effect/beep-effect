# Exact optional schema keys

## Status

Lifecycle: `completed-retained`

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

Complete. Implementation PRs #2145 and #2316 merged the migration, the EF-40
law and the GritQL recall and precision repairs. Closeout PR #2326 merged as
`89a8d5a399` from head `ecfab28c05` with every required context green and a
retained `until-ready` verdict, and `bun run beep goals completion refresh
--slug exact-optional-keys` verified the `completed-retained` proposal on
2026-10-28 (`history/completion-verified-2026-11-02.md`). The committed
`closeout` record in [`ops/manifest.json`](./ops/manifest.json) now carries that
status: `goals set-status` adopted the verified proposal on 2026-11-02 (#2629).

## Latest Evidence

- Completion verified: [`history/completion-verified-2026-11-02.md`](./history/completion-verified-2026-11-02.md), the verified receipt for #2326 (hosted required checks and the exact-head Yeet verdict) and where it lives.
- Closeout-verification reflection: [`history/reflections/2026-11-02-claude.md`](./history/reflections/2026-11-02-claude.md).
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
