# GOAL: Research library ontology core

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Make the research library ontology-first: named S.Class models with PROV-O/CiTO/FaBiO/SKOS/DCAT annotations, a Context.Service topology, generated Turtle T-Box and SHACL shapes through the @beep/ontology fold, SHACL-validated catalog, SPARQL-backed views.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/research-library-ontology-core/README.md`
- `goals/research-library-ontology-core/SPEC.md`
- `goals/research-library-ontology-core/PLAN.md`
- `goals/research-library-ontology-core/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/tooling/tool/cli/src/commands/Research/Library/*`, its tests, a `Dcat` vocabulary module in `@beep/rdf` beside its `Vocab` siblings, `docs/runbooks/research-library.md`; generated `ontology/` files in the out-of-repo library root.
- Out: acquisition routes, hop-2 acquisition, new intakes, `packages/epistemic`, retained originals and receipts; no hand-authored Turtle/LinkML.

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
test "$(wc -m < goals/research-library-ontology-core/GOAL.md)" -le 4000
jq . goals/research-library-ontology-core/ops/manifest.json
git diff --check -- goals/research-library-ontology-core
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

Ship proposedCloseout and the reflection in the final PR (status stays active or
paused). After that merge, verify with `bun run beep goals completion refresh --slug research-library-ontology-core`,
then adopt with `bun run beep goals set-status research-library-ontology-core <status>` in a
packet-state PR. Done only once it merges and this passes, or an operator
blocker is reported with evidence:
`git show origin/main:goals/research-library-ontology-core/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
