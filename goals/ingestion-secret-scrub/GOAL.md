# GOAL: deliver the pre-LLM secret scrub

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist.

Outcome: authorized extracted text crosses one narrow `@beep/file-processing`
transform and emerges as sanitized text plus category/count metadata,
`safeForPrompt`, retention-bounded non-secret audit evidence, and honest
coverage/residue status, with no raw matched secret surviving any durable or
observable boundary.

This is a compact `/goal` launcher. Treat these files as the detailed contract:

- `goals/ingestion-secret-scrub/README.md`
- `goals/ingestion-secret-scrub/SPEC.md`
- `goals/ingestion-secret-scrub/PLAN.md`
- `goals/ingestion-secret-scrub/ops/manifest.json`
- `goals/ingestion-secret-scrub/research/SOURCES.md`

Read them first, then `AGENTS.md`, `CLAUDE.md`, and governing standards named
by `SPEC.md`. Higher-priority repo standards outrank packet prose.

Scope:

- In: credential/private-tag detection; consolidation and versioning of the
  `AiMetricsRedactionResult` and observability redaction precedents into one
  canonical pattern bank; schema-first scrub result/proof; coverage/residue
  status; fixture and focused tests; one real prompt-boundary gate.
- Out: injection findings; PII/OOXML expansion; sanitizer; guarded fetch;
  secret resolver; credential vault; package source unrelated to this slice;
  `goals/INDEX.md`.

Workflow:

1. Inspect the exploration, live banks, prompt boundary, and current worktree.
2. Complete P0 before implementation: audit both banks, deduplicate rules,
   define bank ownership/versioning, and build hits, near-misses, placeholders,
   coverage-gap, and residue fixtures containing only synthetic secrets.
3. Implement the smallest Effect-first/schema-first file-processing transform
   satisfying `SPEC.md`.
4. Never place a raw match in `TextAnchor.quote`, evidence, errors, logs,
   telemetry, snapshots, or persisted fixtures. Use masks, keyed digests,
   categories, counts, and non-secret location/coverage metadata only.
5. Fail closed: unresolved matches, unknown coverage, or secret-shaped residue
   make `safeForPrompt` false and block the prompt leg while preserving safe
   diagnostics.
6. Demonstrate the gate at one real prompt boundary and prove retention clocks.
7. Preserve unrelated changes and update packet evidence/status as readiness
   changes.
8. At P3 Close, write `history/reflections/<YYYY-MM-DD>-<agent>.md` via
   `/reflect`; reflection lint must pass.

Acceptance:

- [ ] Every `SPEC.md` acceptance criterion is satisfied.
- [ ] P0 establishes one versioned canonical bank and the full fixture corpus.
- [ ] No raw secret survives into any persisted artifact or log.
- [ ] A real prompt leg accepts only `safeForPrompt: true` output.
- [ ] Required verification passes or unrelated failures are recorded.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/ingestion-secret-scrub/GOAL.md)" -le 4000
jq . goals/ingestion-secret-scrub/ops/manifest.json
git diff --check -- goals/ingestion-secret-scrub
```

Stop before widening categories, adding dependencies, changing unrelated
public APIs/security policy, or weakening no-raw-match/fail-closed behavior.

Done only when the acceptance matrix is green and the work ships as a PR driven
to mergeable through Yeet; otherwise report blockers with file/command evidence.
