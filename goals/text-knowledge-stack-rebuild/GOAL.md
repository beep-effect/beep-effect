# GOAL: Rebuild the text-knowledge stack as eight lawful layers

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: the foundation text-knowledge stack (identity, text anchoring,
annotation, taxonomy, claims, operations, RDF interchange, agent surface) is
eight lawful layers in a dependency DAG: one occurrence identity, one
annotation model with content and attribution apart, typed signals with no
algebra, scoped admission, declared term IRIs, every law row a named test,
legacy carriers deleted, `@beep/text` and `@beep/annotation` in place,
`@beep/nlp` retired.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/text-knowledge-stack-rebuild/{README,SPEC,PLAN}.md`
- `goals/text-knowledge-stack-rebuild/ops/manifest.json`
- `goals/text-knowledge-stack-rebuild/research/law-test-plan.md`

Read those first, then `AGENTS.md`, `CLAUDE.md` and the standards `SPEC.md`
names; repo standards outrank packet prose. Decide API, schema, migration and
dependency changes yourself, each as a decision file with reason and reversal.

Scope:

- In: the surfaces in `SPEC.md` "Target Surfaces": the `foundation/modeling`
  text-knowledge packages (`provenance` becomes `text`, `annotation` is
  created, `nlp` is retired), `@beep/nlp-processing`, the langextract handoff,
  the semantica projection, the law-practice office-action, docket and
  citation surfaces, the test-runner's pinned IRIs, `standards/architecture/`.
- Out: the 2026-10-21 ruling, `ClaimLifecycle` in `shared/domain`, the verdict
  law; legal semantics in foundation; compatibility shims; local-only
  architecture language; corpus or client material.

Workflow:

1. P0 first: `/grill-with-docs` over `SPEC.md` "Resolved Questions and P0
   Design Items"; confirm or reverse each by decision file.
2. Follow `PLAN.md` phase order: L0, L1, L2, L4, L3+L6, L5+L7, cut-over.
3. Schema first, then `Context.Service` contract, then implementation; validate
   every Effect API against `.repos/effect`.
4. Each catalogue row is a test titled with its ledger id, or a `deleted` row
   with its reason, in `research/law-test-plan.md`.
5. Breaking changes are accepted: re-mint changed preimages by migration in the
   same PR, delete legacy carriers, ship majors; never add a shim.
6. New packages only via `bun run beep create-package` after the routing
   decision; retirements per chapter 11 with consumers migrated in the same PR
   and a row in `research/consumer-census.md`.
7. One PR or stack per phase through `bun run beep yeet` (`final-check` before
   `ready`); at most three open; `quality package-verify <pkg>` before every
   handoff; the office-action standing list (SPEC Verification Matrix) stays
   green from P3 on, starting with the flow test P3 creates.
8. In the final PR (P8), write the closeout reflection via `/reflect`;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Verification passes, or unrelated failures are recorded.
- [ ] No unrelated refactors or formatting churn.

Verification (packet-health subset; completion is `SPEC.md` Verification Matrix):

```sh
test "$(wc -m < goals/text-knowledge-stack-rebuild/GOAL.md)" -le 4000
jq . goals/text-knowledge-stack-rebuild/ops/manifest.json
git diff --check -- goals/text-knowledge-stack-rebuild
bun run beep goals doctor
```

The final PR carries the reflection and writes `closeout` naming itself. Done
only when this passes and `goals completion refresh --slug text-knowledge-stack-rebuild` prints
verified, when this passes under an operator ruling in `decisions/`, or when an
operator blocker is reported with evidence:
`git show origin/main:goals/text-knowledge-stack-rebuild/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
