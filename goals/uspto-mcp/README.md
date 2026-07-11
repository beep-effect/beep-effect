# USPTO MCP

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

### Closeout reconciliation (2026-07-11)

The work shipped weeks ago but the packet paperwork drifted.
`packages/drivers/uspto-mcp` landed on `main` via `e9cce72e6f`
("feat(uspto-mcp): ship thin USPTO MCP proving host") as part of the
`feat/mcp-kit-proving-slice` direct merge `8dbd778313` (2026-07-01, which
pre-dates the PR-only ruleset), and the package has been built/tested/green
since 2026-07-01. P3 is marked complete as satisfied by that direct merge
rather than a PR; P4 Close is completed with this reconciliation and the
closeout reflection in `history/reflections/2026-07-11-claude.md`.

## Mission

Ship `@beep/uspto-mcp` (`packages/drivers/uspto-mcp`): a thin MCP host wiring
`@beep/uspto` through `@beep/mcp-kit`, proving the kit's credential-keyed
composition, `api_key_required` envelope, and progressive field-tier
projection against real USPTO ODP data shapes, following the `@beep/nlp-mcp`
stdio-server seam.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/uspto-mcp/GOAL.md
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

Closed. All phases complete; P3 was satisfied by the direct merge
`8dbd778313` (2026-07-01) rather than a PR (see Closeout reconciliation
above).

## Latest Evidence

P0-P2 (2026-07-01): see `PLAN.md` phase table. `packages/drivers/uspto-mcp`
built with the `uspto_search_applications`/`uspto_get_documents` toolkit,
three fixture tests green (`test/Server.test.ts`), `bunx tsgo -b`/`biome
check`/`bun run beep docgen local` clean, `TURBO_FORCE=1 bunx turbo run check
test lint --filter=@beep/uspto-mcp` green.

## Notes

- Graduated 2026-07-01 from
  [`explorations/mcp-auth-gated-registration`](../../explorations/mcp-auth-gated-registration/README.md);
  design rationale lives in its
  [`DECISIONS.md`](../../explorations/mcp-auth-gated-registration/DECISIONS.md)
  (Q2, Q5, Q6) — back-links, not copies.
- Sibling goal: [`mcp-host-retrofit`](../mcp-host-retrofit/README.md) — this
  goal and that one jointly discharge `@beep/mcp-kit`'s `foundation/capability`
  `≥2-consumer` gate (Q4b); the kit README's consumer list is only honest once
  both land. Both share the `feat/mcp-kit-proving-slice` branch.
- Depends on [`goals/mcp-kit`](../mcp-kit/README.md) (`complete`, PR #288)
  shipping its exported `SourceAuth`/`ToolkitComposition`/`ApiKeyRequired`/
  `FieldTier` surface unchanged.
- Read-only host — `@beep/uspto` has no write surface, so this goal does not
  exercise the kit's tier-gate dispatch wrapper for a real write path (that
  proof is deferred to the `mcp-write-wall` follow-on per
  [`MAP.md`](../../explorations/mcp-auth-gated-registration/MAP.md)).
