# MCP Host Retrofit

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Retrofit `packages/drivers/nlp-mcp` and `packages/drivers/m365-mcp` onto
`@beep/mcp-kit`'s sanitized-span wrapper and four-hint annotation helper
(plus the tier-gate dispatch wrapper where applicable), fixing a live
`12-observability.md` §3 span-leak violation and a tool-hint asymmetry, and
updating the kit's README consumer list to name both hosts as real
importers.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/mcp-host-retrofit/GOAL.md
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

P0 Research — not started. Confirm `@beep/mcp-kit`'s shipped
`SanitizedSpan`/`ToolAnnotations`/`TierGate` surface and audit both hosts'
tool surfaces before retrofitting.

## Latest Evidence

Not started.

## Notes

- Graduated 2026-07-01 from
  [`explorations/mcp-auth-gated-registration`](../../explorations/mcp-auth-gated-registration/README.md);
  design rationale lives in its
  [`DECISIONS.md`](../../explorations/mcp-auth-gated-registration/DECISIONS.md)
  (Q4b, Q7) — back-links, not copies.
- Sibling goal: [`uspto-mcp`](../uspto-mcp/README.md) — this goal and that
  one jointly discharge `@beep/mcp-kit`'s `foundation/capability`
  `≥2-consumer` gate (Q4b); the kit README's consumer list is only honest
  once both land. Both share the `feat/mcp-kit-proving-slice` branch.
- Depends on [`goals/mcp-kit`](../mcp-kit/README.md) (`complete`, PR #288)
  shipping its exported `SanitizedSpan`/`ToolAnnotations`/`TierGate` surface
  unchanged.
- `mcp-write-wall` (a real write-capable tier-gate proof) is explicitly
  deferred — this goal only applies the tier-gate wrapper if P0 finds a
  genuine write/gateable tool in either host; otherwise it records
  not-applicable rather than inventing one.
