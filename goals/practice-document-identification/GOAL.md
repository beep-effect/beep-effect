# GOAL: Practice Document Identification

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: a repeatable, measured way to say which client and docket a practice
document belongs to. A `DocumentIdentification` slice in `@beep/law-practice`
(schemas, service contracts, pure resolver and evaluator, adapters) and an
`apps/practice-identify` command that runs contacts, index, uspto, resolve and
evaluate over private inputs, with precision per confidence tier measured on
documents the attorney filed himself.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/practice-document-identification/README.md`
- `goals/practice-document-identification/SPEC.md`
- `goals/practice-document-identification/PLAN.md`
- `goals/practice-document-identification/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/law-practice/{use-cases,server}/src/DocumentIdentification/`;
  `apps/practice-identify/` (create with `bun run beep create-package`); this
  packet.
- Out: Box writes; client data in the repo (fixtures are synthetic); people
  OSINT; new paid endpoints; the mail-tagging and docket-intake slices.

Workflow:

1. Inspect referenced files and current repo state.
2. Make the smallest change that satisfies `SPEC.md`.
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, tests, docs, or command output.
5. Update packet evidence/status if the implementation changes readiness.
6. At the Close phase, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/practice-document-identification/GOAL.md)" -le 4000
jq . goals/practice-document-identification/ops/manifest.json
git diff --check -- goals/practice-document-identification
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each in SPEC.md's Decision Log with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

Done only when the goal reaches `completed-retained` (acceptance passes,
verification is complete, closeout and reflection landed), or when a blocker
that needs the operator is reported with file/command evidence.
