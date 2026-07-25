# External corpus library — inventory

The normalized corpus behind this packet lives OUTSIDE the repo (public repo
⇒ no copyrighted PDFs or full extracted texts committed):

`~/YeeBois/research/academia-2026-07/`

Precedent: `explorations/graph-3d-navigation` (gitignored seed corpus +
committed inventory).

## Layout

| Path | Contents |
|------|----------|
| `bin/` | idempotent bun pipeline scripts (s0-inventory, s1-extract, s2-overlap, t1-render, t1-run, s3-catalog, s4-shortlist, t2-run, t3-render, t3-run) |
| `prompts/templates/` | T1 triage, T2 deep-read, T3 cluster + master prompt headers |
| `prompts/rendered/` | per-job rendered prompts (regenerable) |
| `ops/schemas/` | JSON schemas enforcing T1/T2 codex output |
| `ops/jobs.jsonl` | append-only job event ledger (start/done/fail/quota-pause per codex job) |
| `ops/status.json` | atomic live snapshot of the running tier |
| `ops/PAUSED` | quota sentinel — present ⇒ fan-out halted awaiting human resume |
| `text/` | full extracted text, one `<id>.txt` per canonical paper |
| `firstpages/` | first-2-page excerpts (T1 input) |
| `meta/` | per-paper JSON: file + pdfinfo metadata, extraction status, disposition |
| `triage/` | T1 batch outputs (`t1-batch-NNN.json`) |
| `notes/` | T2 per-paper deep-read notes (`<id>.json`) |
| `synthesis/` | T3 cluster reports + master synthesis (working copies; committed versions live here in `research/`) |
| `state/` | canonical-set.tsv, hash-manifest.tsv, overlap.tsv, paper-catalog.jsonl, t2-shortlist.tsv, prior-deep-read-titles.tsv, per-stage reports |

## Corpus facts (S0–S2, 2026-07-25)

- Source: `~/Downloads/research-7-24-26` — 524 files scanned (519 PDFs + 4
  doc/docx + 1 pre-extracted article markdown; the prior synthesis markdown
  excluded as a non-paper).
- 447 unique by SHA-256 (77 exact-duplicate files collapsed), 443 canonical
  papers after title-dupe collapse (4).
- Waves: 343 papers dated 2026-06-29, 100 dated 2026-07-25.
- Extraction: 443/443 clean (`pdftotext`; libreoffice for doc/docx). No OCR
  or firecrawl fallback was needed.
- Overlap vs `~/YeeBois/research` (1,696 hashed files): 57 exact sha256
  matches → `known-library`; 0 `prior-deep-read` title matches (conservative
  strong-match rule; library hash match covers true file overlap).
- Paper id = `sha256(file)[0:12]` — stable across reruns, join key for every
  state file and note.

## Resume semantics

Every stage script is idempotent (valid existing outputs are skipped), so
resume after any interruption = rerun the same script. Quota exhaustion
writes `ops/PAUSED`; humans decide resumption (`rm ops/PAUSED`, rerun) —
the pipeline never falls through to a metered API key.
