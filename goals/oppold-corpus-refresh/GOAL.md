# GOAL: consolidate the July Oppold corpus refresh

Repo: this `beep-effect` checkout. Do not assume an absolute path. All repo
paths below are repo-relative.

Outcome: `source-a` through `source-d` are hash-first salvaged into
`<CORPUS_ROOT>/raw/2026-07-refresh/`, cataloged/deduped across all runs, and
verified originals are moved to the data-home archive named
`pre-consolidation-2026-07` with complete provenance and move manifests.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/oppold-corpus-refresh/README.md`
- `goals/oppold-corpus-refresh/SPEC.md`
- `goals/oppold-corpus-refresh/PLAN.md`
- `goals/oppold-corpus-refresh/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and the standards named by
`SPEC.md`. Higher-priority repo standards outrank packet prose when they
conflict.

Scope:

- In: `source-a` and `source-b` (new email-export directories), `source-c`
  (standalone PST), `source-d` (June-era recovery directory), the outside-repo
  source map at `<CORPUS_ROOT>/ops/refresh-source-map.json`,
  `<CORPUS_ROOT>/raw/2026-07-refresh/provenance.jsonl`, corpus catalog updates,
  a move-manifest, `beep corpus` dedupe-aware salvage + archive-move commands,
  and this packet's evidence/status files.
- Out: extraction, organization, enrichment, downstream ingestion, cloud sync,
  LLM processing of document content, modifying 2026-06 raw content, deleting
  originals, and committing corpus content, PII, concrete data-home paths,
  local usernames, or source filenames to the repo.

Workflow:

1. Load this packet and the retained `goals/oppold-corpus-pipeline` packet.
2. Use the outside-repo source map; repo files may only name `source-a` through
   `source-d`.
3. Extend `beep corpus` with dedupe-aware salvage taking a run label and an
   archive-move subcommand. Reuse existing `CorpusProvenanceRecord` shapes.
4. Salvage with run label `2026-07-refresh`: hash first; copy bytes only for a
   new digest; for already-seen digests, write provenance-only origin-to-existing
   records.
5. Write only under `<CORPUS_ROOT>/raw/2026-07-refresh/`; keep 2026-06 raw
   immutable. Union the catalog across run provenance and report distinct-digest
   before/after delta.
6. After verified salvage, move originals to `pre-consolidation-2026-07`,
   preserving relative structure. Never delete anything.
7. Agents are orchestrated by dynamic workflows, local-only. Agents may handle
   paths, hashes, counts, and names; they must never see or log document content.
8. Update evidence/status as phases complete and run Yeet gates before publish.

Acceptance:

- [ ] Provenance rows equal files walked.
- [ ] A manifest entry's copied bytes spot-check content-equal to its origin.
- [ ] Catalog distinct-digest delta is reported before/after this run.
- [ ] Move-manifest has zero uncovered files.
- [ ] `GOAL.md` is at most 4000 chars; `manifest.json` is jq-valid.
- [ ] No extraction, organization, enrichment, content, PII, or unrelated churn.

Verification:

```sh
wc -m goals/oppold-corpus-refresh/GOAL.md
jq . goals/oppold-corpus-refresh/ops/manifest.json
git diff --check -- goals/oppold-corpus-refresh
bun run beep yeet repair
bun run beep yeet verify
```

Stop on missing source map, source-read errors, digest mismatch, uncovered move,
privacy violation, scope expansion, or any destructive action not named here.
