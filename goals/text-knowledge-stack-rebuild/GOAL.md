# GOAL: Rebuild the text-knowledge stack as eight lawful layers

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: the foundation text-knowledge stack (identity, text anchoring,
annotation, taxonomy, claims, operations, RDF interchange, agent surface) is
eight layers in a dependency DAG joined by lawful codecs: occurrence-first
anchors, content/attribution split, typed signals with no algebra, scoped
admission with a grounding witness, term IRIs decoupled from code paths, every
law-catalogue row a property test, folds decided by a facet census.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/text-knowledge-stack-rebuild/README.md`
- `goals/text-knowledge-stack-rebuild/SPEC.md`
- `goals/text-knowledge-stack-rebuild/PLAN.md`
- `goals/text-knowledge-stack-rebuild/ops/manifest.json`
- `goals/text-knowledge-stack-rebuild/research/2026-11-08-rebuild-report.md`

Read those first, then `AGENTS.md`, `CLAUDE.md` and the standards `SPEC.md`
names. Higher-priority repo standards outrank packet prose when they conflict.

Scope:

- In: the surfaces listed in `SPEC.md` "Target Surfaces": the six
  `foundation/modeling` text-knowledge packages and the AST packages' source
  maps, the langextract handoff, the semantica projection, the law-practice
  office-action, docket and citation surfaces, the test-runner's pinned IRIs,
  `standards/architecture/`, the vision document, `nlp/THEORY.md`.
- Out: the 2026-10-21 ruling, `ClaimLifecycle` in `shared/domain`, the verdict
  law; legal semantics in foundation; any rename or fold before the P7 census;
  local-only architecture language; corpus or client material.

Workflow:

1. P0 first: `/grill-with-docs` over `SPEC.md` "Open Questions"; one decision
   file each (`bun run beep goals decisions add text-knowledge-stack-rebuild ...`).
2. Follow `PLAN.md` phase order: L0, L1, L2, L4, L3+L6, L5+L7, census.
3. Schema first, then `Context.Service` contract, then implementation; validate
   every Effect API against `.repos/effect`.
4. Each law-catalogue row becomes a property test named after it, or a
   recorded deletion with its reason.
5. Persisted encodings stay byte-stable; new preimages carry new version tags.
6. One PR or stack per phase through `bun run beep yeet`; at most three open.
   `bun run beep quality package-verify <pkg>` before every handoff.
7. At P9, write the closeout reflection via `/reflect`;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/text-knowledge-stack-rebuild/GOAL.md)" -le 4000
jq . goals/text-knowledge-stack-rebuild/ops/manifest.json
git diff --check -- goals/text-knowledge-stack-rebuild
bun run beep goals doctor
```

Decide public API, schema, migration, dependency and generated-file changes
yourself when the goal needs them: record each as a decision file with its
reason and reversal, then continue. Ship a breaking wire change with a major
changeset and old-wire codecs. Escalate only what AGENTS.md "Autonomy" lists.

Ship proposedCloseout and the reflection in the final PR (status stays active
or paused). After that merge, verify with
`bun run beep goals completion refresh --slug text-knowledge-stack-rebuild`,
then adopt with `bun run beep goals set-status text-knowledge-stack-rebuild <status>`
in a packet-state PR. Done only once it merges and this passes:
`git show origin/main:goals/text-knowledge-stack-rebuild/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
