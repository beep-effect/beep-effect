# Selective Schema Codec Statics

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Replace broad `SchemaUtils` codec-static bundles with safe, selected, hoisted
statics and migrate all existing usages to the minimal required set.

## Current State

Closed on 2026-10-05. The selective API and repository migration shipped as
PR #927 (merged 2026-08-31). PR #1371 (`goals/effect-schema-parity` P5,
merged 2026-10-01) later retired `withCodecStatics`, `classStatics`, and every
codec facade attached through `withStatics` in favour of free `effect/Schema`
functions guarded by the `SFV4-codec-static` schema-first rule. Nothing from
this packet remains live to maintain; it is retained as design and migration
evidence.

## Launch

This packet is closed and not execution-capable. `GOAL.md` is kept as the
historical launcher; `SPEC.md` remains the record of the contract PR #927
satisfied.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`DECISIONS.md`](./DECISIONS.md) - `/grilling` answers, rationale, and
   rejected options.
4. [`PLAN.md`](./PLAN.md) - active execution plan.
5. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing and
   lifecycle state.
6. [`research/SOURCES.md`](./research/SOURCES.md) - source and evidence ledger.
7. [`research/OPPORTUNITIES.md`](./research/OPPORTUNITIES.md) - friction
   receipts captured during the goal.
8. [`history/`](./history/) - verification and closeout evidence.

## Next Action

None. Successor work lives in `goals/inline-schema-compile-hard-error`
(closed 2026-09-09) and `goals/effect-schema-parity` (closed 2026-10-01).

## Latest Evidence

- The repository goal bootstrap planner accepted this slug, title, mission,
  and date with no conflicts on 2026-08-30.
- The initial design review is preserved in
  `scratchpad/schema-utils-codec-statics-design.md` and distilled into
  `SPEC.md`.
- The opening AST inventory recorded 726 attachments, including 291 generated
  declarations; the closing inventory records 213 explicit non-empty
  selections, zero unresolved owners, and zero risky pre-augmented sources.
- Decisions D0-D19 are locked and the manifest decision frontier is empty.
- The closing census records zero broad-helper matches, zero JSON-suffixed
  statics, no touched inline-compiler findings, and a 2,931-finding successor
  baseline, down four from opening.
- Focused selective-static tests pass 8/8; full `@beep/schema` and `@beep/rdf`
  package verification pass, as do the quick lanes for every other touched
  package.
- Repository test-tsgo passes after the canonical
  `bun run infra:prepare-gha-runners` preparation step generated the Pulumi
  package's expected `bin` boundary; Yeet's frozen exact-head install reproduced
  that preparation successfully.
- The mandatory `inline-schema-compile-hard-error` successor packet was
  materialized from the repository bootstrap plan and closed on 2026-09-09.
- PR #927 merged on 2026-08-31 at `27318473461e` with both review threads
  resolved and required hosted checks green.
- PR #1371 (merged 2026-10-01) retired the selective registry: 390 attaching
  steps in 170 files were removed and 858 reads moved to free `effect/Schema`
  functions; the `SFV4-codec-static` rule holds the occurrence count at zero.
- Closeout evidence: `history/2026-10-05-closeout.md`; reflection:
  `history/reflections/2026-10-05-claude.md`.
