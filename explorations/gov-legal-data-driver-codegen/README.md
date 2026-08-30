# Gov/Legal Data Drivers + OpenAPI Codegen

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Four gov/legal driver packages (`@beep/courtlistener|ecfr|dol|federal-register`)
are bare `VERSION='0.0.0'` skeletons and `@beep/govinfo` is schema-only — yet a
single OpenAPI→(Effect SDK + MCP server) codegen pass plus a shared
auth/retry/cache client layer could light all five up at once. The itch: build
that codegen pipeline and the per-source auth matrix on beep's
Effect/effect-Schema/HttpApi stack rather than vendoring Orval/axios/Zod.

## Next Open Question

No exploration question. The substrate is complete; driver breadth continues
in [`goals/gov-legal-data-driver-delivery`](../../goals/gov-legal-data-driver-delivery/README.md),
paused until a product feature pulls a named driver. The ≥2-driver gate is
cleared by `@beep/govinfo` plus `@beep/ecfr`, so the collision-contract sibling
is scaffolded at [`goals/gov-legal-mcp`](../../goals/gov-legal-mcp/README.md).

**Trail (2026-08-13):** `@beep/courtlistener`, `@beep/dol`, and
`@beep/federal-register` were deleted as empty scaffolds. Recreate from
[`goals/honest-repo-signal/research/FOLLOW-UPS.md`](../../goals/honest-repo-signal/research/FOLLOW-UPS.md)
when delivery resumes. `@beep/ecfr` is the remaining VERSION-only skeleton.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Sources & provenance

[`research/SOURCES.md`](./research/SOURCES.md) — the provenance ledger joining
every mined gold nugget (19) to its upstream repo + `file:line`, the upstream
license + port discipline, the external research cited on disk, and the
`@beep/*` capabilities this packet composes.

## Trail

- 2026-07-14: sibling closure completed. P0/P1/P3 substrate and promotion are
  complete; P2 is superseded into the paused delivery packet; `gov-legal-mcp`
  graduated on the proven GovInfo + eCFR driver pair; exploration flipped to
  `graduated` with no remaining exploration question.
- 2026-06-29: graduated into goals/gov-legal-data-driver-codegen.
- 2026-06-29: research-complete — RESEARCH.md synthesized, codex gate-1 folded, DECISIONS pre-drafted.
- 2026-06-29: packet opened from gold-intake cluster 'Gov/legal data drivers + OpenAPI codegen' (19 nuggets).
