# Oppold Corpus Refresh Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Source Map & Guardrails | pending | Confirm the outside-repo source map, privacy posture, and retained packet supersessions before touching data. | `source-a` through `source-d` resolve outside the repo; no concrete mapping is copied into the repo. |
| P1 Tooling | pending | Extend `beep corpus` with dedupe-aware salvage by run label and archive-move using existing provenance shapes. | CLI help documents both commands; synthetic tests cover dedupe and move-manifest behavior. |
| P2 Salvage, Catalog & Dedupe | pending | Walk the four sources, hash first, copy only new digests into the refresh raw subtree, and union catalog provenance across runs. | Provenance rows equal files walked; duplicate digests produce provenance-only records; distinct-digest delta is reported. |
| P3 Archive Move | pending | After verified salvage, move originals to `pre-consolidation-2026-07` while preserving relative structure. | Move-manifest exists with zero uncovered files; no deletion path is used. |
| P4 Verify | pending | Run packet, privacy, catalog, archive, and Yeet verification gates. | Required checks are green or blockers are documented with command/evidence references. |
| P5 Close | pending | Update packet status/evidence, publish if requested, monitor, and write the closeout reflection. | README/manifest statuses are current; reflection passes lint; PR is mergeable when publish is in scope. |

## Phase Notes

### P0 Source Map & Guardrails

- Use `<CORPUS_ROOT>/ops/refresh-source-map.json` as the only place where real
  source paths are allowed. Do not print or copy the mapping into repo files.
- Treat `source-a` and `source-b` as email-export directories, `source-c` as the
  standalone PST, and `source-d` as the June-era recovery directory.
- Re-read `goals/oppold-corpus-pipeline/SPEC.md` and this packet's
  `history/decision-log.md` before implementation. This packet's supersessions
  are intentional, not drift.

### P1 Tooling

- Add a dedupe-aware `beep corpus` salvage mode that accepts the run label
  `2026-07-refresh`.
- Reuse existing `CorpusProvenanceRecord` shapes; do not create a parallel
  manifest format.
- Add an archive-move subcommand that consumes verified provenance and emits a
  move-manifest with source label, origin reference, destination reference,
  digest, move timestamp, and coverage status.
- Tests must use synthetic fixtures only. No corpus content, PII, concrete
  data-home paths, local usernames, or source filenames may enter fixtures.

### P2 Salvage, Catalog & Dedupe

- For each walked file: hash origin, check the existing catalog and this run's
  seen-digest set, then either copy bytes once or write a provenance-only record
  pointing at the existing raw artifact.
- Write raw bytes only under `<CORPUS_ROOT>/raw/2026-07-refresh/`.
- Keep the 2026-06 raw tree immutable and untouched.
- Catalog output must include before/after distinct-digest counts and the delta
  attributable to this run.

### P3 Archive Move

- Archive movement begins only after salvage verification passes.
- Move, do not copy and do not delete, originals into `pre-consolidation-2026-07`.
- Preserve relative directory structure from each source label.
- Emit a move-manifest and fail the phase if any walked source file is not
  covered.

### P4 Verify

- Required packet checks:
  - `wc -m goals/oppold-corpus-refresh/GOAL.md` returns `<= 4000`.
  - `jq . goals/oppold-corpus-refresh/ops/manifest.json` succeeds.
  - Privacy grep over `goals/oppold-corpus-refresh/` has no matches for real
    data-home paths, local usernames, or source filenames.
- Required run checks:
  - provenance rows equal files walked.
  - spot-check copy is content-equal to origin.
  - catalog distinct-digest delta is reported.
  - move-manifest has zero uncovered files.
- Required repo gates before publish:
  - `bun run beep yeet repair`
  - `bun run beep yeet verify`

### P5 Close

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`; frontmatter must validate
   against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` latest evidence and `ops/manifest.json` phase statuses.
4. If publishing is requested, use
   `bun run beep yeet publish --message "oppold corpus refresh"` and monitor.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Archive run outputs under `history/outputs/`; corpus data itself stays outside
  the repo.
- Dynamic workflows are local-only. Agents may process paths, hashes, counts,
  and names, but must never see or log document content.
- Do not perform extraction, organization, enrichment, downstream ingestion, or
  deletion as part of this packet.

## Verification Commands

```sh
wc -m goals/oppold-corpus-refresh/GOAL.md
jq . goals/oppold-corpus-refresh/ops/manifest.json
rg -n '(/h[o]me/|~[/]|/data[-]home/|[[:alnum:]_$.-]+[.](pst|ost|msg|eml|doc|docx|pdf|rtf|html|xlsx|zip))' goals/oppold-corpus-refresh
git diff --check -- goals/oppold-corpus-refresh
bun run beep yeet repair
bun run beep yeet verify
```
