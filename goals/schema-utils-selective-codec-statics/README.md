# Selective Schema Codec Statics

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Replace broad `SchemaUtils` codec-static bundles with safe, selected, hoisted
statics and migrate all existing usages to the minimal required set.

## Current State

The selective API and repository migration are locally complete. P0-P3 are
closed with reproducible inventories and attributed verification evidence; the
packet is now in P4 for Yeet publication and hosted closeout.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/schema-utils-selective-codec-statics/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

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

Publish the reviewed implementation through Yeet, resolve every hosted review
thread, and monitor until `merge-ready: yes`.

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
- Repository test-tsgo has no migration-owned diagnostics; its only remaining
  failure is the attributed vendored `@pulumi/gharunners` module-format issue.
- The mandatory `inline-schema-compile-hard-error` successor packet was
  materialized from the repository bootstrap plan.
