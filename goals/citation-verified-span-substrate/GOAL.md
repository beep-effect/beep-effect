# GOAL: deliver the citation verified-span substrate

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist.

Outcome: direct `GroundedExtraction[]` candidates can become matter-scoped
verified `TextAnchor` values only through explicit half-open UTF-16 conversion,
deterministic locator-to-raw mapping, and exact raw-source equality, including
cross-chunk/page straddle and source-drift re-anchor proof.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/citation-verified-span-substrate/README.md`
- `goals/citation-verified-span-substrate/SPEC.md`
- `goals/citation-verified-span-substrate/PLAN.md`
- `goals/citation-verified-span-substrate/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and the governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: schema-first verified-anchor/source-version modeling in
  `foundation/modeling/provenance`; normalization-to-source mapping, explicit
  offset adapters, and straddle over `GroundedExtraction[]` in
  `foundation/capability/langextract`; hostile-text fixtures, focused tests,
  persistence proof, and packet evidence.
- Out: fuzzy/case-fold matching, normalized quote emission, off-box privileged
  text, `eyecite-js`, legal citation/court vocabulary, extraction engine,
  epistemic lifecycle changes, matter-wall enforcement, rich-text annotation,
  MPEP patterns, hosted enrichment, unrelated packages, and `goals/INDEX.md`.

Workflow:

1. Inspect the exploration, live source, and current worktree.
2. Execute P0 first. Lock the conversion and failure contract with fixtures for
   surrogate pairs, combining marks, ligatures, curly quotes, collapsed
   whitespace, duplicates, page boundaries, and source drift.
3. Implement the smallest Effect-first/schema-first substrate satisfying
   `SPEC.md`; consume `GroundedExtraction[]` directly.
4. Locate with bounded normalization, recover canonical raw offsets, emit the
   raw slice, and require `source.slice(start, end) === quote`.
5. Prove typed closed failures, matter scope, digest/version retention,
   straddle, persistence, and non-destructive re-anchor history.
6. Preserve unrelated changes and update packet evidence/status as readiness
   changes.
7. At P3 Close, write `history/reflections/<YYYY-MM-DD>-<agent>.md` via
   `/reflect`; `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] Every `SPEC.md` acceptance criterion is satisfied.
- [ ] The hostile-text fixture contract is locked before P1.
- [ ] Every successful anchor and re-anchor satisfies raw-slice equality.
- [ ] Required verification passes, or unrelated failures are reproduced and
      recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/citation-verified-span-substrate/GOAL.md)" -le 4000
jq . goals/citation-verified-span-substrate/ops/manifest.json
git diff --check -- goals/citation-verified-span-substrate
```

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, generated files, or
destructive state unless `SPEC.md` explicitly requires it.

Done only when the full acceptance matrix is green and the work ships as a PR
driven to mergeable through Yeet; otherwise report blockers with file/command
evidence.
