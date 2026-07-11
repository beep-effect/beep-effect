# MCP Kit

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Ship `@beep/mcp-kit` (`packages/foundation/capability/mcp-kit`): the reusable
MCP host-construction kit — credential-keyed toolkit composition
(`gate: none|soft|hard`), structured `api_key_required` envelope, tier-gate
dispatch wrapper (fail-closed, refusal-as-value), progressive field-tier
projection, and span/annotation hygiene helpers — built natively on
`effect/unstable/ai` and proven by fixture tests.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/mcp-kit/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance + license
   discipline (load-bearing for ports).
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

Closed (2026-07-01). [PR #288](https://github.com/beep-effect/beep-effect/pull/288)
open and `MERGEABLE`; merge is the operator's call (three hosted reds are
inherited from main's chronic-red baseline, documented in `PLAN.md` P3).

## Latest Evidence

- P3/P4 (2026-07-01): PR #288 mergeable; six bot-review findings fixed
  (15/15 tests); closeout reflection
  [`history/reflections/2026-07-01-claude.md`](./history/reflections/2026-07-01-claude.md)
  lints clean.

- P0 (2026-07-01):
  [`history/2026-07-01-p0-verification.md`](./history/2026-07-01-p0-verification.md)
  — all six pinned `effect/unstable/ai` internals confirmed against resolved
  `effect@4.0.0-beta.92` (no decision-invalidating drift), plus the
  `create-package` wiring checklist.
- P1 (2026-07-01): `packages/foundation/capability/mcp-kit` built — seven
  SPEC deliverables, curated barrel, consumer-plan README, 12 fixture/proof
  tests green through the real `McpServer.toolkit`/`callTool` pipeline.
- P2 (2026-07-01): `bun run beep yeet verify` green on all lanes except
  `changeset-status` (red only while the changeset is uncommitted; passes
  post-commit) and a pre-existing `@beep/schema` identifier-rendering test
  regression, attributed unrelated and recorded in
  [`history/2026-07-01-unrelated-failures.md`](./history/2026-07-01-unrelated-failures.md).

## Notes

- Graduated 2026-07-01 from
  [`explorations/mcp-auth-gated-registration`](../../explorations/mcp-auth-gated-registration/README.md);
  design rationale lives in its
  [`DECISIONS.md`](../../explorations/mcp-auth-gated-registration/DECISIONS.md)
  (Q1–Q7 + Q4b) — back-links, not copies.
- Sibling candidate goals named by the exploration
  [`MAP.md`](../../explorations/mcp-auth-gated-registration/MAP.md):
  `uspto-mcp` (proving host), `mcp-host-retrofit` (nlp/m365 hygiene adoption —
  together they discharge the `foundation/capability` ≥2-consumer gate), and
  `mcp-write-wall` (follow-on).
- The kit has no live driver dependencies; consumers provide their own driver
  layers. Foundation purity per `07-non-slice-families.md`.
