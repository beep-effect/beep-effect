# GOAL: salvage and pipeline the Oppold IP corpus

Repo: this `beep-effect` checkout (`kriegcloud/beep-effect`).

Outcome: the scattered Oppold IP practice corpus is salvaged into an
immutable `raw/` tier in the out-of-repo Oppold corpus home (machine-local), then
cataloged, deduplicated, name-restored, extracted, organized, and
USPTO-enriched, with DuckDB catalog + `@beep/file-processing` manifests as
the consumable surface.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/oppold-corpus-pipeline/README.md`
- `goals/oppold-corpus-pipeline/SPEC.md`
- `goals/oppold-corpus-pipeline/PLAN.md`
- `goals/oppold-corpus-pipeline/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and the standards named by
`SPEC.md`. Higher-priority repo standards outrank packet prose when they
conflict.

Scope:

- In: the out-of-repo Oppold corpus home (data tiers, machine-local, outside the
  repo); `packages/drivers/libpff` and `packages/drivers/tika` hardening;
  new `packages/drivers/uspto`; `beep corpus` command family in
  `packages/tooling/tool/cli`; this packet's evidence files.
- Out: epistemic ingestion (runtime packet), KG/ontology schema (ip-law-kg
  packet), Box/cloud sync, any LLM processing of corpus content, deleting or
  modifying original source files, committing corpus data or PII to the repo.

Workflow:

1. Execute phases in `PLAN.md` order: P0 salvage (USB first, SHA-256
   verified, provenance manifest) → P1 catalog + exact dedupe + `$I`/`$R`
   name restoration → P2 extraction (libpff pffexport engine, real Tika) →
   P3 organization taxonomy → P4 USPTO enrichment → P5 close.
2. Make the smallest changes that satisfy `SPEC.md`; reuse
   `@beep/file-processing` contracts and the Files command pattern.
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, manifests, or command output;
   archive run reports under `history/outputs/`.
5. Update packet status/evidence as phases complete.
6. At P5 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/oppold-corpus-pipeline/GOAL.md)" -le 4000
jq . goals/oppold-corpus-pipeline/ops/manifest.json
git diff --check -- goals/oppold-corpus-pipeline
bun run beep lint reflection-artifacts
```

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, generated files, or
destructive state unless `SPEC.md` explicitly requires it. Stop immediately
on USB read errors or salvage hash mismatches.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
