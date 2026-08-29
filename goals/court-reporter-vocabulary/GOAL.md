# GOAL: deliver the court and reporter vocabulary substrate

Repo root is the current `beep-effect` checkout. Use repo-relative paths.

Outcome: pinned courts-db and reporters-db sources deterministically generate
package-private artifacts while law-practice exposes stable court/reporter IDs,
canonical vocabulary/lookups, lifecycle-safe drift, and one machine-readable
artifact compatibility contract for downstream consumers.

Read first:

- `goals/court-reporter-vocabulary/README.md`
- `goals/court-reporter-vocabulary/SPEC.md`
- `goals/court-reporter-vocabulary/PLAN.md`
- `goals/court-reporter-vocabulary/ops/manifest.json`
- `AGENTS.md`, `CLAUDE.md`, and standards named by the spec

Scope:

- In: two public `SyncDataToTs` targets; package-private generated artifacts and
  provenance/version sidecars; stable law-practice IDs, source-faithful court
  and reporter vocabulary, lookups, lifecycle and compatibility schemas;
  reviewable drift reports; root BSD-2 notice; fixtures/tests/evidence.
- Out: court-string resolution, fuzzy ranking, SKOS, hosted CourtListener,
  citation extraction, KG nodes, sync-engine redesign, public raw files,
  runtime refresh, unrelated packages, and `goals/INDEX.md`.

Current delivery boundary (2026-07-25): implement and verify the pinned
ingestion substrate only. The artifacts live under
`packages/law-practice/domain/src/internal/generated/`; public stable IDs,
lookups, lifecycle/compatibility schemas, and parser integration remain later
phases of this active goal. Do not import eyecite-js or eyecite-ts overlays.

Workflow:

1. Inspect the exploration, live sync target family, domain values, and worktree.
2. Execute P0 before freezing schemas: pin full upstream commits, identify
   templated inputs versus releases, render deterministically, prove counts, and
   test every ratified stable-ID/compatibility transition.
3. Verify the scaffolded commit pins in `THIRD_PARTY_NOTICES.md`; record any
   ratified change before derived material lands.
4. Implement the smallest schema-first/Effect-first increment satisfying the
   active phase; keep raw artifacts private and do not pull later public domain
   work into the ingestion increment.
5. Prove a second identical generation has no diff and every upstream change is
   reported, never silently applied.
6. Prove the citation engine can use version/stable IDs without raw imports.
7. Preserve unrelated changes; update evidence/status only from proof.
8. At P3, write a reflection and run reflection lint.

Acceptance:

- [ ] Every `SPEC.md` criterion passes.
- [ ] Exact pins/checksums/counts and no-diff regeneration are archived.
- [ ] Lifecycle and compatibility fixtures cover every ratified change class.
- [ ] Required package/repo/Yeet proof passes.
- [ ] No unrelated churn.

Verification:

```sh
test "$(wc -m < goals/court-reporter-vocabulary/GOAL.md)" -le 4000
jq . goals/court-reporter-vocabulary/ops/manifest.json
git diff --check -- goals/court-reporter-vocabulary THIRD_PARTY_NOTICES.md
```

Stop before weakening stable identity, provenance, deterministic generation, or
raw-file privacy. Done only when the PR is mergeable through Yeet or a blocker
is reported with file/command evidence.
