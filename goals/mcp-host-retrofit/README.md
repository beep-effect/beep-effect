# MCP Host Retrofit

## Status

Lifecycle: `completed-retained`

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

P4 Close complete. Both hosts shipped: `bun run beep yeet repair` and
`bun run beep yeet verify` were green locally, then the user merged the
shared-branch changes directly into `origin/main` — a deliberate user
decision, not the standard `/yeet publish --pr` path (no PR was opened for
this packet). See `PLAN.md`'s P3/P4 rows for the actual outcome.

## Latest Evidence

P0-P2 (2026-07-01): see `PLAN.md` phase table. Added `@beep/mcp-kit`'s new
`sanitizedToolkit` export (empirically-verified fix for the
`Toolkit.ts:263-265` span leak); `nlp-mcp`/`m365-mcp` `Server.ts` now use it;
17 `StreamingToolkit` tools and 11 `M365Tools` tools carry
`annotateFourHints`; tier-gate recorded not-applicable (see `PLAN.md` P0
finding). New proof tests green in `mcp-kit`, `nlp-mcp`, `m365-mcp`; existing
suites unchanged. `@beep/mcp-kit/README.md` consumer table updated to
**Landed** for both hosts.

P3-P4 (2026-07-02): merged directly into `origin/main` (tip `9f0e410d8d`) by
the user after local verification, no PR. Two pre-existing-on-main red
categories were observed around this shipping window and are recorded as
environment context, not goal debt: (1) a repo-wide `@beep/schema`
JSON-Schema `$ref`/decode-error identifier-rendering regression spanning
multiple packages (`@beep/repo-utils`, `@beep/schema`, `@beep/agents-domain`,
and a fourth affected package observed during this slice's verify runs — see
[`goals/mcp-kit/history/2026-07-01-unrelated-failures.md`](../mcp-kit/history/2026-07-01-unrelated-failures.md)
for the traced repro, pre-dating this slice via commit `cabf5df4a7`); (2)
pre-existing `cspell` findings in the ontology package, unrelated to this
packet's target surfaces. Closeout reflection:
[`history/reflections/2026-07-02-codex.md`](./history/reflections/2026-07-02-codex.md).

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
