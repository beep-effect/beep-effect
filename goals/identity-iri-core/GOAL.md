# GOAL: Rewrite @beep/identity as a literal-preserving IRI/CURIE composer

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: `@beep/identity` binds `{ authority, prefix, vocab }` at the root,
every composer derives exact-literal `.iri`/`.curie` from its path, borrowed
RDF vocab is a baked-in CURIE literal type, CURIE expand/contract + PN_LOCAL
codecs ship in-package — with the existing public surface shape-stable and
zero call-site changes repo-wide.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/identity-iri-core/README.md`
- `goals/identity-iri-core/SPEC.md`
- `goals/identity-iri-core/PLAN.md`
- `goals/identity-iri-core/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and the design authority:
`explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md`
(D1–D9) + `explorations/identity-as-iri/DECISIONS.md`. Port donors (proven,
27/27): `scratchpad/identity/{Vocab,Curie,PnLocal,Composer}.ts`.

Scope:

- In: `packages/foundation/modeling/identity` (src + test); vocab-drift test
  may import `@beep/rdf` Vocab constants (tests only).
- Out: the fold/projections (`identity-iri-fold`), Fibered/registry/SHACL
  (`identity-iri-fibered`), `SemanticSchemaMetadata` changes, any call-site
  edits outside the package, new runtime dependencies.

Workflow:

1. BLOCKING INPUT: confirm authority host with elpresidank
   (`https://ns.beep.sh/` is a placeholder).
2. Build the shape-stable harness FIRST from
   `explorations/identity-as-iri/research/11-audit-identity-coupling.md`
   (pin named imports, `make()` compat, create-package codegen output).
3. Port the prototype modules with house JSDoc (`@example`, lowercase
   `@category`, `@since 0.0.0`) and Effect v4 idioms (`effect/Schema` as `S`).
4. Type-level literal tests; registry-wide codec round-trips; interning
   immutable under `rebase`; `annote*` records gain `iri`/`curie` (owned
   channel only).
5. Measure compile blast radius before/after (record in `history/`);
   module-boundary the vocab machinery if hot.
6. Preserve unrelated user/worktree changes.
7. At P3 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures (see SPEC
      Exception Ledger: inherited main-red lanes) are reproduced and recorded
      separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/identity-iri-core/GOAL.md)" -le 4000
jq . goals/identity-iri-core/ops/manifest.json
git diff --check -- goals/identity-iri-core
bunx turbo run test --filter @beep/identity
```

Stop and report before changing public API shape, dependencies, lockfiles,
generated files, or destructive state unless `SPEC.md` explicitly requires it.
Stop if the authority host is unconfirmed at merge time.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
