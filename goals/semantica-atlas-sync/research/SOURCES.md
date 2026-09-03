# Semantica Atlas Sync: Sources and Provenance

- **Source exploration:**
  [`explorations/semantica-lab`](../../../explorations/semantica-lab/README.md)
- **Primary ledger:**
  [`explorations/semantica-lab/research/SOURCES.md`](../../../explorations/semantica-lab/research/SOURCES.md)
  — this file is the goal-side mirror; when the two disagree, the exploration
  ledger wins and this copy is corrected.
- **Decision authority:**
  [`explorations/semantica-lab/DECISIONS.md`](../../../explorations/semantica-lab/DECISIONS.md)
  (Current law table: Atlas writes, Atlas backlog, Verdict map; 2026-09-03
  ratification grill R3.a–R3.g).
- **Design source:**
  [`MAP.md` §A](../../../explorations/semantica-lab/MAP.md#a-semantica-atlas-sync--split-d5-into-a-verdict-lane-and-a-facts-lane)
  v1.1; adversarial review
  [`reviews/2026-09-03-sol-reentry-review.md`](../../../explorations/semantica-lab/research/reviews/2026-09-03-sol-reentry-review.md).
- **Carry-forward date:** 2026-09-03

The tables below reproduce the rows of the exploration's corpus this lane
composes. Notion page identifiers are withheld; find the atlas via Notion
search in the private Todox workspace.

## 1. Mined source corpus

The D5 extraction pipeline mined the semantica repository at symbol
granularity into a schema-validated JSONL IR (6,105 records, 354 files,
SHA-256-stamped; stats in
[`ir-extraction-report.md`](../../../explorations/semantica-lab/research/ir-extraction-report.md)).
The extractor (`extract.py`, `ir-schema.json`, README) was committed in #790
at `fd560ca8e5` and deleted by #882; it survives in git history and feeds only
the gated facts lane (P2). The verdict lane (P1) reads no IR.

## 2. Upstream repositories and licenses

| Repo | License | Port discipline | What this lane takes |
| --- | --- | --- | --- |
| `semantica-agi/semantica` (out-of-repo workstation clone, `danklocal` branch at `add1c006`, version 0.6.6) | MIT (Hawksight AI, verified in its `LICENSE`) | reference for the facts lane's pinned checkout | the O3 version trigger (0.6.7+) is measured against this clone and the upstream tracker |

## 3. External research sources

- Semantica docs https://docs.getsemantica.ai/ (glossary
  https://docs.getsemantica.ai/glossary/) — the vocabulary the atlas rows
  name.
- Notion atlas page: `@beep/semantica` in the private Todox workspace
  (identifier withheld; find it via Notion search).
- Atlas forensics and upgrade reports:
  [`grounding-notion-semantica.md`](../../../explorations/semantica-lab/research/grounding-notion-semantica.md),
  [`atlas-upgrade-report.md`](../../../explorations/semantica-lab/research/atlas-upgrade-report.md)
  (the 2026-08-24 read-back of thirteen D10 auto-parks),
  [`atlas-upgrade-report-2.md`](../../../explorations/semantica-lab/research/atlas-upgrade-report-2.md),
  [`atlas-upgrade-report-3.md`](../../../explorations/semantica-lab/research/atlas-upgrade-report-3.md).
- Park lists: the `## Park list` sections of
  `bakeoff-{storage,embeddings,input,extraction,reasoning}.md` under the
  exploration's `research/`.

## 4. In-repo capability references

| Brick | Path | Mark |
| --- | --- | --- |
| Sync method | `goals/semantica-canary/history/p5-atlas-sync.md` (proposal → inventory → canary write → apply → read-back) | reuse verbatim |
| Verdict domain | D3 column values; `@beep/schema` `LiteralKit` | NET-NEW `atlas-verdicts/v1` schema + `verdicts.json` |
| Tracked evidence data in a packet | `explorations/semantica-lab/research/tracker/inventory.jsonl` (725 rows) | precedent; redaction law applies |
| Notion read/write | the operating session's Notion connection (Claude Notion plugin); Codex Notion MCP after re-login (`codex mcp login notion`; writes need `--approve-for-me`) | not live-verified on 2026-09-03; one-catalog read first |
| Script home | `apps/labs/semantica/scripts/` beside `generate-f1-*.ts` and `generate-g-entailment.ts` | NET-NEW small render/diff script; no reusable export |
| IR extractor (facts lane) | git history `fd560ca8e5:scratchpad/semantica-ir/{extract.py,ir-schema.json,README.md}` | recovered only when P2 fires; home decided then |
| Family verdicts | `explorations/semantica-lab/DECISIONS.md` Current law rows Input, Extraction, Storage, Embeddings, Reasoning (dated 2026-08-30/31) | the evidence positive rows cite, with their sheet sections |

**How these inform implementation:** the method and the evidence exist; the
NET-NEW surface is one schema, one data file and one script. The atlas is
rendered from the file, never edited first.

## 5. Cross-links and provenance

- Goal ↔ exploration: this packet is `links.goals[]` in
  [`explorations/semantica-lab/ops/manifest.json`](../../../explorations/semantica-lab/ops/manifest.json);
  `provenance.exploration` in [`ops/manifest.json`](../ops/manifest.json).
- Siblings: [`goals/semantica-canary`](../../semantica-canary/README.md)
  (P5 wrote the six parks and declined the four positive rows);
  [`goals/semantica-storage-inversion`](../../semantica-storage-inversion/README.md)
  and [`goals/semantica-reasoning-spike`](../../semantica-reasoning-spike/README.md)
  (their verdicts feed later rows through the same file).
- Decision log: [`SPEC.md` §Decision Log](../SPEC.md#decision-log).
