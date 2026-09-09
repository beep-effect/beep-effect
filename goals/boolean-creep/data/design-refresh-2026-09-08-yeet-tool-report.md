# Yeet and tool-report design refresh — 2026-09-08

Source reviewed: packet HEAD `7440cb8c4302ce64b87860069a464bafbf65f576`; the inspected four source graphs are unchanged from the initial audit and match `origin/main` at `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`.

## Owned designs

- `designs/r2-tooling-sweep-plan-operator-handoff.md` — traced all writers in `Sweep.ts:296-418`, execution at `:1231-1251`, persisted nesting in `Sweep.schemas.ts`, the porcelain reader at `Porcelain.ts:98-100`, test writers/readers, and the test barrel. The design now uses an option literal behind the exact v1 boolean codec, restricts handoff to a precondition-safe remote-delete step, preserves exact output text, and classifies the contradictory local-delete test fixture as an invalid boundary case.
- `designs/yeet-status-remote-check-phase.md` — traced the three writer families at `Status.ts:858-998`, persisted snapshot nesting, every phase-reconstructing reader at `:1111-1358`, public export, and all fixtures. The design preserves required `available`/`checked`, every optional payload/default, diagnostic text and order, while exposing only the three-state phase after decode.
- `designs/yeet-merge-ready-verdict.md` — corrected the earlier first-false model. `Verdict.ts:319-359` and `:443-447` require the stored named criterion to be false but do not require it to be the earliest false; `MonitorLoop.ts:958-962` treats that stored name as operator guidance. `Status.ts:1051-1058` is only a first-false producer. The reviewed persisted domain therefore has 1,025 coherent states, and the tagged target preserves any coherent named false blocker and every later observation. The design also preserves complete contradiction rejection, conservative incomplete-legacy normalization, legacy spellings, broad watch observations, and the exact old encoded projection.

## Final verdict consistency pass

- The ready case structurally fixes all eight criteria to true. Each of the eight blocked cases structurally fixes its named criterion to false while retaining all other observations as booleans; together they represent all 1,025 coherent persisted tuples, including later-false blocker selections.
- The compatibility rules now distinguish complete records from incomplete legacy records exactly as `Verdict.ts:384-427` does: seven optional current criteria default false; `threadsResolved` stays required; incomplete records are forced blocked and recomputed; complete `failing:"checks-green"` migrates to `required-checks-green`; legacy `criteria.checksGreen` remains accepted but does not supply the missing current criterion.
- Exhaustive tests must enumerate 256 truth tables and every false named-blocker choice, assert 1,025 cases, and round-trip each name and observation. Schema arbitrary generation is supplementary and cannot be replaced with the 256 first-false tuples produced by Status.
- `designs/tool-name-collision-row-truncated-digest.md` — traced declaration, projection, duplicate rewriting, report schema, renderer, generator, package export, and deterministic/collision tests. The design retains the old boolean/null row codec around a decoded name-form union and now explicitly schema-encodes the report before canonical rendering; direct rendering of decoded union values would otherwise change JSON keys and bytes.

## Inventory findings for the owner

- `yeet-merge-ready-verdict` legal cardinality is 1,025 rather than 256. The 256 count described the current Status producer’s first-false choice, while the accepted persisted contract permits any named false criterion. The owner reconciled the inventory during this refresh.
- `tool-name-collision-row-truncated-digest` has its symbol declaration at `ToolNames.ts:144`; the inventory line 153 points to the `digest` member.

## Verification

- Targeted `rg` and numbered source reads covered every declaration, writer, reader, compatibility codec, persisted nesting, renderer, test fixture, and barrel named above.
- `bun goals/boolean-creep/ops/validate-designs.ts` passed with `design coverage OK: 105 qualified ids` after these edits. After the source merge, a repeat was temporarily blocked by the concurrently owned missing `designs/shacl-validation-result-flags.md`; none of these four designs was reported missing.
- `git diff --check` passes for all four owned designs.

No product source, test, inventory status, dependency, generated file, or Git reference was changed. No design blocker remains.
