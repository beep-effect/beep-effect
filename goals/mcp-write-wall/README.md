# MCP Write Wall

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Wire `@beep/mcp-kit`'s `TierGate` primitive (shipped 2026-07-01, currently
unwired) into `packages/drivers/nlp-mcp` — the first real write-capable MCP
host — proving the fail-closed candidate→approved wall end-to-end against
`NlpToolkit`'s four stateful tools, with fixture tests for both the approved
and refused dispatch paths.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/mcp-write-wall/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P0 Research pending. Not started.

## Latest Evidence

Not started.

## Notes

- Graduated 2026-07-02 from
  [`explorations/mcp-auth-gated-registration`](../../explorations/mcp-auth-gated-registration/README.md);
  named as the `mcp-write-wall` follow-on in its
  [`MAP.md`](../../explorations/mcp-auth-gated-registration/MAP.md); design
  rationale for the wall's shape lives in its
  [`DECISIONS.md`](../../explorations/mcp-auth-gated-registration/DECISIONS.md)
  Q7 — back-links, not copies.
- Sibling goals: [`mcp-kit`](../mcp-kit/README.md) (`complete`, PR #288),
  [`uspto-mcp`](../uspto-mcp/README.md) (`completed-retained`, merged
  2026-07-02, read-only host), [`mcp-host-retrofit`](../mcp-host-retrofit/README.md)
  (`completed-retained`, merged 2026-07-02 — its P0 found `NlpToolkit`'s four
  stateful tools gate-relevant but correctly left them untouched, out of that
  goal's Target Surfaces). This goal is the first to exercise `TierGate`
  against a genuinely write-capable host.
- Depends on `@beep/mcp-kit`'s exported `TierGate`/`SanitizedSpan`/
  `ToolAnnotations` surface shipping unchanged.
- **Audit sink for this proving slice is log-only** (a sanitized
  `TierGateAuditRecord` written to a log/span, not persisted). Q7's original
  design intent — auditing into the `UsageRecord.metadata` jsonb column — is
  explicitly deferred: `packages/drivers/nlp-mcp` has zero dependency on
  `@beep/epistemic-domain` or `@beep/epistemic-use-cases` today (confirmed via
  `package.json` and a repo grep), so wiring real persistence here would pull
  an unrelated dependency edge into a driver package that doesn't have one.
  See `SPEC.md`'s Exception Ledger.
- `TierGate.isDestructive` (`TierGate.ts:301-302`) defaults **any**
  unannotated tool to destructive (fail-closed) — this goal must annotate
  `NlpToolkit`'s full tool surface, not only the four stateful tools, or
  wiring the gate would refuse every read tool too. See `SPEC.md` Deliverable
  #1.
