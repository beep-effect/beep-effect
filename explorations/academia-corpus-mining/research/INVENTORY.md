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

- Source (acquisition, transient — no longer on disk):
  `~/Downloads/research-7-24-26` — 524 files scanned (519 PDFs + 4
  doc/docx + 1 pre-extracted article markdown; the prior synthesis markdown
  excluded as a non-paper).
- 447 unique by SHA-256 (77 exact-duplicate files collapsed), 443 canonical
  papers after title-dupe collapse (4).
- Waves: 343 papers dated 2026-06-29, 100 dated 2026-07-25.
- **Current location (verified 2026-08-17):**
  `~/YeeBois/research/academia-2026-07` — `text/`, `meta/`, `firstpages/` all
  hold 443 files; 443/443 `extractStatus: "ok"`. Source PDFs were not
  retained and no DOI/URL was recorded, so re-acquisition would be
  title-search based. See README "Corpus location".
- Extraction: 443/443 clean (`pdftotext`; libreoffice for doc/docx). No OCR
  or firecrawl fallback was needed.
- Overlap vs `~/YeeBois/research` (1,696 hashed files): 57 exact sha256
  matches → `known-library`; 0 `prior-deep-read` title matches (conservative
  strong-match rule; library hash match covers true file overlap).
- Paper id = `sha256(file)[0:12]` — stable across reruns, join key for every
  state file and note.

## Pipeline outcomes (T1–T3, 2026-07-25)

- **T1 triage** (codex `gpt-5.6-luna` medium, 37 batches, schema-validated):
  443/443 papers — 185 deep-read / 93 maybe / 165 catalog-only; 79
  off-topic by lens.
- **T2 deep-reads** (codex `gpt-5.6-sol` **max**, 185 jobs, all first- or
  second-attempt clean, zero quota pauses): 185/185 structured notes; tiers
  42 gold / 125 silver / 15 bronze / 3 dross; zero quotes over 25 words.
- **T3 syntheses** (codex `gpt-5.6-sol` **max**, repo cwd read-only, 8 jobs,
  all attempt 1): 7 cluster reports (25/39/24/10/39/23/25 papers) + master
  synthesis with a 36-route consolidated routing table and 13 align-stage
  questions. Committed copies: packet `research/t3-*.md`.

## Resume semantics

Every stage script is idempotent (valid existing outputs are skipped), so
resume after any interruption = rerun the same script. Quota exhaustion
writes `ops/PAUSED`; humans decide resumption (`rm ops/PAUSED`, rerun) —
the pipeline never falls through to a metered API key.
