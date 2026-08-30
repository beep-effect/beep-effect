# Selective Schema Codec Statics Plan

## Status

Status: `alignment-in-progress`

No implementation is authorized until the `/grilling` frontier is empty and
the operator confirms shared understanding.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Align and census | in progress | Finish the design tree and publish a source-backed migration inventory. | `DECISIONS.md` is ratified, manifest frontier is empty, operator confirms alignment, and census is reproducible. |
| P1 Implement selective APIs | pending | Implement the keyed static registry and the approved `S.Class` utility form. | Runtime, type, collision, and construction-timing tests pass. |
| P2 Migrate and delete | pending | Replace every broad helper use with the minimal selected set and remove all old variants. | Second census finds zero live definitions, exports, examples, or consumers. |
| P3 Ratchet and verify | pending | Hoist remaining inline compilers, promote the lint rule to error, and run package/repo proof. | Required checks are green or unrelated failures are attributed. |
| P4 Yeet: PR to mergeable | pending | Publish through Yeet and close checks and review threads. | `bun run beep yeet monitor` reports `merge-ready: yes`. |
| P5 Close | pending | Write the reflection and flip packet lifecycle in the same PR. | Packet evidence and statuses are current; reflection validates. |

## P0 — Alignment and Census

1. Record already-settled operator constraints in `DECISIONS.md`.
2. Ask the whole currently unblocked design frontier, up to three questions per
   round, with recommended answers.
3. After every round, append Question / Answer / Rationale / Rejected entries
   and replace manifest `openQuestions` with the next frontier.
4. Inventory definitions, exports, call sites, attached-property reads,
   re-exports, class schemas, JSON-transformed schemas, generator sources, and
   lint violations.
5. When the frontier is empty, summarize the complete contract and obtain an
   explicit shared-understanding confirmation.

## P1 — Selective APIs

1. Define one typed key registry whose factories preserve native Effect
   signatures.
2. Implement `withCodecStatics(keys)` without constructing unselected helpers.
3. Implement only the approved safe class utility form.
4. Add runtime and dtslint coverage for exact selection, generic types,
   collisions, duplicates, property descriptors, construction timing, and
   class binding.
5. Document parse-option and JSON-construction-option ownership.

## P2 — Migration and Deletion

1. Update generators before generated source.
2. Migrate internal schemas with property-use evidence.
3. Audit exported schemas at their whole-repository consumer surface before
   reducing attached keys.
4. Replace all broad helpers with explicit minimal tuples.
5. Delete the bare behavior and all Sync, Promise, Effect, Exit, Option, and
   Result bundle variants, exports, fixtures, and examples.
6. Rerun the census and record zero-state evidence.

## P3 — Ratchet and Verification

1. Fix remaining `beep(no-inline-schema-compile)` findings, including the known
   `ProvRdf.ts` call site.
2. Promote the rule from warning to error.
3. Run focused schema tests and `@beep/schema` package verification.
4. Run docgen and canonical repository verification.
5. Attribute every failure before deciding whether it belongs to this goal.

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

