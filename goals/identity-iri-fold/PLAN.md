# Identity IRI Fold Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Contract and donor audit | pending | Confirm the shipped identity-core surface; inventory live FOLIO annotations, projection donors, tuple cases, and error/profile fixtures; freeze the fold/projection boundary. | Core compatibility, migration inventory, donor disposition, grammar, and blockers are recorded before public schemas freeze. |
| P1 Fold and projections | pending | Add nominal composer entrypoints, schema-validated tuple fold, assembled model/errors/profiles, and pure JSON-LD/context/Turtle/Markdown projections. | Representative owned/borrowed/inverse relations assemble deterministically and render through every required projection. |
| P2 FOLIO migration and verification | pending | Run idempotent FOLIO migrations, deprecate duplicate address fields where required, and execute focused plus repo proof. | All acceptance criteria pass; a second sweep has no diff; no stale borrowed identifiers or unrelated churn remain. |
| P3 Close | pending | Drive the PR to mergeable through Yeet, archive evidence, write the reflection, and synchronize packet lifecycle. | Hosted checks/review are green; evidence, reflection, plan, README, and manifest are current. |

## P3 Closeout Checklist

1. Write `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update README, PLAN, and manifest from evidence.
4. Confirm Yeet/GitHub mergeability and keep `identity-iri-fibered` held until
   this goal actually lands.

## Execution Notes

- P0 is a hard contract gate; do not infer donor availability from old paths.
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
