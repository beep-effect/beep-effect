# Identity IRI Fold Plan

## Status

Status: `p3-close`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Contract and donor audit | complete | Confirm the shipped identity-core surface; recover the fold prototype from commit `61160e1baf` (two-donor merge with `explorations/identity-as-iri/assets/ontology-prototype/`); inventory live FOLIO annotations with counts; audit barrel coexistence with FOLIO models and the semantic-foundation M1 taxonomy surface; freeze the tuple grammar and diagnostics ledger. | Core compatibility, migration inventory, donor disposition, grammar, coexistence, and blockers are recorded before public schemas freeze. |
| P1 Fold and projections | complete | Add additive `$I.key`/`$I.class` composer methods (identity, `ontologyTerm` channel), the schema-validated tuple fold behind `Ontology.fold` (ontology), predicate-open assembled model/errors, SKOS classification marker + integrity gate with observable warnings, and pure JSON-LD/context/Turtle/Markdown projections (Markdown ported from the assets donor). | Representative owned/borrowed/inverse relations assemble deterministically and render through every required projection; shape-stable and dtslint suites extended and green; golden, rebase, negative, and determinism fixtures pass. |
| P2 FOLIO migration and verification | complete | Run idempotent FOLIO migrations, add the `sync-data-to-ts` vocab target generating the shared-five term inventories from `CoreVocab`, deprecate duplicate address fields, and record compile-budget measurements. | All acceptance criteria pass; a second sweep has no diff; vocab `--check` gate green with curated constants byte-untouched; `tsc --extendedDiagnostics` deltas recorded; no stale borrowed identifiers or unrelated churn remain. |
| P3 Close | in-progress | Drive the PR to mergeable through Yeet, archive evidence, write the reflection, and synchronize packet lifecycle. | Hosted checks/review are green; evidence, reflection, plan, README, and manifest are current. |

## P3 Closeout Checklist

1. Write `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update README, PLAN, and manifest from evidence.
4. Confirm Yeet/GitHub mergeability and keep `identity-iri-fibered` held until
   this goal actually lands.

## Execution Notes

- P0 is a hard contract gate; do not infer donor availability from old paths.
  The fold prototype exists only at `git show 61160e1baf:scratchpad/identity/`;
  the checked-in `explorations/identity-as-iri/assets/ontology-prototype/`
  tree is the schema-first idiom
  and Markdown/SKOS donor, but its authoring/reference model stays dead.
- `@beep/ontology` repopulation is additive: FOLIO models and the
  semantic-foundation M1 taxonomy surface stay untouched (zero external
  consumers verified, but both are packet-owned).
- Keep fold, migration, and projection changes reviewable and idempotent.
- Preserve the completed identity-core surface and unrelated worktree changes.

## Verification Commands

```sh
test "$(wc -m < goals/identity-iri-fold/GOAL.md)" -le 4000
jq . goals/identity-iri-fold/ops/manifest.json
rg -n "identity-iri-fold|GOAL.md|agentLaunchers|packetAnchorDocument" goals/identity-iri-fold
git diff --check -- goals/identity-iri-fold
bun run beep yeet verify
bun run beep lint reflection-artifacts
```
