# Oppold Corpus Refresh Spec

## Objective

Consolidate four post-June data-home sources into the existing governed corpus
home at `<CORPUS_ROOT>` by salvaging only new bytes into
`<CORPUS_ROOT>/raw/2026-07-refresh/`, recording provenance for every walked file,
unioning the catalog across runs, and archive-moving verified originals into the
data-home archive named `pre-consolidation-2026-07`.

This packet deliberately stops at salvage, catalog, dedupe, and archive-move.
Extraction, organization, enrichment, and downstream ingestion are out of scope
and must be handled by a later packet/run.

## Supersedes

This spec deliberately supersedes two statements from
`goals/oppold-corpus-pipeline/SPEC.md`:

- The retained packet said `raw/` is immutable after salvage. For refreshes,
  `raw/` is append-only by run: 2026-06 raw content stays immutable and
  untouched, while this run writes only
  `<CORPUS_ROOT>/raw/2026-07-refresh/` plus its own `provenance.jsonl`.
- The retained packet said original sources are never modified and retirement is
  manual. For this refresh, the user explicitly chose archive-move after
  verified salvage: originals are moved, not copied and not deleted, into
  `pre-consolidation-2026-07` while preserving relative directory structure.

## Non-Goals

- Extracting text, metadata, messages, attachments, or thumbnails.
- Organizing files into client, matter, family, or topical taxonomies.
- USPTO, public-record, knowledge-graph, or epistemic enrichment.
- Downstream runtime ingestion or claims/evidence modeling.
- Cloud sync, Box upload, or external processing of corpus content.
- Sending document content to LLMs or logging document content in any agent run.
- Touching 2026-06 raw content, except read-only catalog/provenance unioning.
- Deleting any original source file.
- Committing corpus content, PII, concrete data-home paths, local usernames, or
  source filenames to the repo.

## Source Hierarchy

1. User objective and 2026-07-03 grilling-session decisions that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. `goals/oppold-corpus-pipeline/` for retained tone, manifest shape, and
   existing provenance contracts, except where this spec explicitly supersedes it.
4. `standards/ARCHITECTURE.md` and `standards/architecture/*`.
5. This `SPEC.md`.
6. `PLAN.md`.
7. `GOAL.md`.
8. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `<CORPUS_ROOT>/ops/refresh-source-map.json` outside the repo: concrete mapping
  from `source-a` through `source-d` to local data-home sources.
- `<CORPUS_ROOT>/raw/2026-07-refresh/`: the only raw subtree this run may write.
- `<CORPUS_ROOT>/raw/2026-07-refresh/provenance.jsonl`: per-file provenance for
  every walked source file, including provenance-only duplicate records.
- Existing corpus catalog under `<CORPUS_ROOT>`: union provenance across runs and
  report distinct-digest deltas.
- The data-home archive named `pre-consolidation-2026-07`: post-verification
  move destination preserving source-relative structure.
- `packages/tooling/tool/cli`: extend `beep corpus` with a dedupe-aware salvage
  subcommand that accepts a run label, and an archive-move subcommand.
- `goals/oppold-corpus-refresh/*`: packet status, evidence, and closeout notes.

## Source Labels

The four in-scope sources are:

- `source-a`: a new email-export directory.
- `source-b`: a second new email-export directory.
- `source-c`: a standalone PST file.
- `source-d`: a June-era recovery directory.

The concrete path mapping is outside the repo at
`<CORPUS_ROOT>/ops/refresh-source-map.json`. Repo files must not record the real
paths, filenames, local username, or corpus content behind these labels.

## Constraints

- Hash-first salvage: compute a content digest before copying bytes.
- Dedupe policy: if a digest is already in the catalog or was seen earlier in
  this same run, write a provenance-only record from the origin to the existing
  raw artifact; do not copy bytes a second time.
- Manifest policy: reuse existing `CorpusProvenanceRecord` shapes from the
  retained packet; do not invent a parallel provenance schema.
- Run isolation: write only to `<CORPUS_ROOT>/raw/2026-07-refresh/` for raw
  bytes and this run's `provenance.jsonl`.
- Archive policy: after verified salvage, move originals to
  `pre-consolidation-2026-07` with relative structure preserved; never delete.
- Dynamic Codex workflows may handle paths, hashes,
  counts, and names, but must never see or log document content.
- Repo quality gates use Yeet: `bun run beep yeet repair`,
  `bun run beep yeet verify`, and `bun run beep yeet publish --message "..."`.

## Acceptance Criteria

- [ ] The outside-repo source map resolves all four labels without any concrete
      mapping copied into the repo.
- [ ] The run writes raw bytes only under
      `<CORPUS_ROOT>/raw/2026-07-refresh/`.
- [ ] `provenance.jsonl` contains one row per file walked; row count equals the
      file-walk count.
- [ ] Every duplicate digest found in the existing catalog or earlier in this
      run emits a provenance-only record and no second byte copy.
- [ ] At least one manifest entry is spot-checked: the copied artifact is
      content-equal to its origin.
- [ ] The catalog unions provenance across the retained run and this refresh,
      and reports the distinct-digest before/after delta for this run.
- [ ] Archive move emits a move-manifest with zero uncovered files and preserves
      source-relative structure.
- [ ] No extraction, organization, enrichment, downstream ingestion, cloud sync,
      LLM content processing, or content logging occurs in this packet.
- [ ] `GOAL.md` is at most 4000 characters.
- [ ] `ops/manifest.json` is valid JSON.
- [ ] No corpus content, PII, concrete data-home paths, local usernames, or
      source filenames enter the repo.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `wc -m goals/oppold-corpus-refresh/GOAL.md` | Count is `<= 4000` |
| Manifest JSON | `jq . goals/oppold-corpus-refresh/ops/manifest.json` | Passes |
| Privacy scan | `rg -n '(/h[o]me/|~[/]|/data[-]home/|[[:alnum:]_$.-]+[.](pst|ost|msg|eml|doc|docx|pdf|rtf|html|xlsx|zip))' goals/oppold-corpus-refresh` | No matches |
| Scope scan | `git status --porcelain` | Only `goals/oppold-corpus-refresh/` paths changed |
| Provenance count | file-walk count vs `provenance.jsonl` row count | Equal |
| Spot-check copy | content comparison for a sampled copied manifest entry | Equal bytes |
| Dedupe delta | catalog report before/after this run | Distinct-digest delta recorded |
| Archive coverage | move-manifest coverage report | Zero uncovered files |
| Whitespace | `git diff --check -- goals/oppold-corpus-refresh` | Passes |
| Repo quality gates | `bun run beep yeet repair` then `bun run beep yeet verify` | Green before publish |

## Stop Conditions

- `<CORPUS_ROOT>/ops/refresh-source-map.json` is missing or malformed.
- Any source label resolves outside the intended local data-home boundary.
- A source read error, digest mismatch, provenance count mismatch, or uncovered
  archive-move file occurs.
- Any workflow would expose document content, PII, concrete data-home paths,
  local usernames, or source filenames in the repo.
- The implementation would expand into extraction, organization, enrichment,
  downstream ingestion, cloud sync, or deletion.
- Required tooling installation needs a decision not named here.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
