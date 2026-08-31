# Selective Schema Codec Statics Plan

## Status

Status: `implementation-authorized`

The `/grilling` frontier is empty and the operator confirmed shared
understanding on 2026-08-30.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Align and census | completed | Publish the ratified design and typechecker-backed migration inventory. | `DECISIONS.md` is ratified, manifest frontier is empty, alignment is confirmed, and the reviewed census is reproducible. |
| P1 Implement selective APIs | completed | Implement the keyed static registry and the approved `S.Class` utility form. | Runtime, type, collision, and construction-timing tests pass. |
| P2 Migrate and delete | completed | Replace every broad helper use with the minimal selected set and remove all old variants. | Second census finds zero live definitions, exports, examples, or consumers. |
| P3 Ratchet and verify | completed | Fix touched and known inline compilers, enforce shrinking no-growth baselines, and run package/repo proof. | Required checks are green or unrelated failures are attributed; a fresh successor census is recorded. |
| P4 Yeet: PR to mergeable | in progress | Publish through Yeet and close checks and review threads. | `bun run beep yeet monitor` reports `merge-ready: yes`. |
| P5 Close | pending | Write the reflection and flip packet lifecycle in the same PR. | Packet evidence and statuses are current; reflection validates. |

## P0 — Alignment and Census

1. Keep D0-D19 immutable except through dated amendments.
2. Inventory definitions, exports, call sites, attached-property reads,
   re-exports, class schemas, JSON-transformed schemas, generator sources, and
   lint violations.
3. Produce a reviewed typechecker-backed mapping and disposable codemod.
4. Record a shrinking per-family legacy and inline-warning baseline.

## P1 — Selective APIs

1. Define one typed key registry whose factories preserve native Effect
   signatures.
2. Factor a shared property installer while keeping public `withStatics`
   behavior compatible.
3. Implement strict owned `withCodecStatics(keys)` without constructing
   unselected helpers.
4. Implement `classStatics(this, keys)` as an exact frozen nested bag.
5. Add runtime and dtslint coverage for exact selection, generic types,
   collisions, duplicates, property descriptors, construction timing, and
   `S.Class` / `S.TaggedClass` binding.
6. Document parse-option and JSON-construction-option ownership.

## P2 — Migration and Deletion

1. Update generators to default to no statics and consult reviewed per-schema
   override maps before regenerating outputs.
2. Migrate internal schemas with property-use evidence.
3. Audit exported schemas at their whole-repository consumer surface before
   reducing attached keys.
4. Replace all broad helpers with explicit minimal tuples.
5. Delete the bare behavior and all Sync, Promise, Effect, Exit, Option, and
   Result bundle variants, exports, fixtures, and examples.
6. Rerun the census and record zero-state evidence.

## P3 — Ratchet and Verification

1. Fix `beep(no-inline-schema-compile)` findings in touched code and the known
   `ProvRdf.ts` call site.
2. Enforce shrinking legacy and no-warning-growth baselines for each family.
3. Run focused schema tests and `@beep/schema` package verification.
4. Run docgen and canonical repository verification.
5. Attribute every failure before deciding whether it belongs to this goal.
6. Record a fresh closing inline-warning census and require a successor goal
   for full cleanup and hard-error promotion.

## Closeout Checklist

1. Drive the implementation PR to `merge-ready: yes` through Yeet.
2. Write a closeout reflection via `/reflect` to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`.
3. Run `bun run beep lint reflection-artifacts`.
4. Update README evidence, plan statuses, and manifest lifecycle in the same PR.

## Packet Verification Commands

```sh
test "$(wc -m < goals/schema-utils-selective-codec-statics/GOAL.md)" -le 4000
jq . goals/schema-utils-selective-codec-statics/ops/manifest.json
rg -n "schema-utils-selective-codec-statics|GOAL.md|agentLaunchers|packetAnchorDocument" goals/schema-utils-selective-codec-statics
git diff --check -- goals/schema-utils-selective-codec-statics
bun run beep goals doctor
bun run beep goals index --write
bun run beep goals index --check
```
