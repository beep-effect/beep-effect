# GOAL: deliver the office-action document-structure slice

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: a versioned office-action rule family recognizes exactly one paired
`FINAL | NON-FINAL` declaration and `SHORTENED STATUTORY PERIOD` block from
fixture-backed text, proves exact raw UTF-16 anchors through the shared
verified-span contract, and delivers schema-backed candidates to the patent
docketing intake seam or a typed fail-closed abstention.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/law-doc-structure-oa-slice/README.md`
- `goals/law-doc-structure-oa-slice/SPEC.md`
- `goals/law-doc-structure-oa-slice/PLAN.md`
- `goals/law-doc-structure-oa-slice/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and the governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: law-practice domain schemas and versioned OA rules, use-case ports and
  `GroundedExtraction` adapter, server/docketing composition, license-safe
  fixtures, focused tests, persistence/replay proof, and packet evidence.
- Out: citations, a new foundation package, streaming, LLM-first extraction or
  no-match escalation, untyped snapshots, court-PDF engine selection,
  additional rule families, epistemic admission changes, broad confidence
  cleanup, unrelated packages, and `goals/INDEX.md`.

Workflow:

1. Inspect the exploration, source ledger, live source, and current worktree.
2. Run P0 now: build the attorney-reviewed real-OA fixture corpus, lock
   rule-family version/migration semantics, and define labeled precision and
   abstention floors.
3. Do not begin P1 until `goals/citation-verified-span-substrate` P0/P1 proves
   the shared anchor/source-identity contract.
4. Implement the smallest Effect-first/schema-first paired rule and explicit
   `ReadonlyArray<GroundedExtraction>`-to-`DocStructureCandidate` adapter.
5. Emit both verified candidate variants or one typed abstention: `absent`,
   `ambiguous`, `unsupported`, `low-quality-source`, or `rule-not-covered`.
6. Prove `rawText.slice(startUtf16, endUtf16) === quote`, source identity,
   OCR lineage/quality gating, version replay, hostile negatives, duplicates,
   drift, and the docketing consumer seam.
7. At P3 Close, write `history/reflections/<YYYY-MM-DD>-<agent>.md` via
   `/reflect`; `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] Every `SPEC.md` acceptance criterion is satisfied.
- [ ] P0 evidence exists before P1 and the verified-span blocker is cleared.
- [ ] Required verification passes, or unrelated failures are reproduced and
      recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/law-doc-structure-oa-slice/GOAL.md)" -le 4000
jq . goals/law-doc-structure-oa-slice/ops/manifest.json
git diff --check -- goals/law-doc-structure-oa-slice
```

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, generated files, or
destructive state unless `SPEC.md` explicitly requires it.

Done only when the complete proof matrix is green and the work ships as a PR
driven to mergeable through Yeet; otherwise report blockers with evidence.
