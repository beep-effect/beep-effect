# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-07-25 — corpus scope

**Question:** Normalize only the new download, or fold in the standing
`~/YeeBois/research` library (1,161 PDFs) and reprocess everything?

**Answer:** New download only; **mark** overlap against the standing library
and the prior synthesis's 72 deep-read papers (hash + normalized-title match);
do not reprocess the old library.

**Rationale:** The old library was already partially mined (June-29 synthesis
triaged 449 of its candidates); reprocessing burns deep-read budget on known
material. Overlap marking preserves the delta framing — this run's value is
what's *new* relative to prior coverage.

## 2026-07-25 — corpus home

**Question:** Where do normalized texts and metadata live — inside the repo or
outside?

**Answer:** Externally at `~/YeeBois/research/academia-2026-07/`. The packet
commits only derived intelligence: paper catalog (inventory), cluster
syntheses, SOURCES.md ledger, routing table.

**Rationale:** The repo is public; copyrighted PDFs and full extracted texts
must never be committed. Follows the `graph-3d-navigation` precedent
(gitignored seed corpus + committed SEED-INVENTORY).

## 2026-07-25 — depth tiers

**Question:** Uniform processing depth for all 444 titles, or tiered?

**Answer:** Tiered. T1 cheap triage of ALL (codex `gpt-5.6-luna`, batched);
T2 deep-reads of a relevance shortlist (~100–180) with `gpt-5.6-sol`;
T3 cluster syntheses (~7–10) + one repo-grounded master synthesis at sol/max.
Papers already deep-read in the June-29 synthesis are excluded from T2.

**Rationale:** ~40% of the corpus is predictably off-topic or shallow-value;
uniform deep reading would multiply cost for no insight. Triage-then-shortlist
concentrates Sol max-reasoning spend where the catalog says it pays.

## 2026-07-25 — mining lenses

**Question:** Which repo work streams do papers get mined against?

**Answer:** All four, equally weighted: (1) memory/bitemporal/No-Escape
doctrine corroboration; (2) legal ontology & semantic foundation;
(3) retrieval/citation grounding/doc structure; (4) agent architecture —
metacognition/neuro-symbolic/security. Off-topic papers → catalogued-only.

**Rationale:** The two download waves map cleanly onto these four streams, and
all four have active goal packets that can absorb findings. Narrowing to fewer
lenses would orphan roughly half the corpus.

## 2026-07-25 — packet shape

**Question:** One packet or several (per-lens)?

**Answer:** One packet — `explorations/academia-corpus-mining` — scaffolded
from `_template`, ending at stage `research` with align-stage questions queued
in the manifest. Cross-packet findings land in a routing table
(attach/extend/new-exploration suggestions, gold-intake style) — recorded, not
executed.

**Rationale:** The corpus is one provenance unit; splitting by lens would
scatter the catalog and duplicate the sources ledger. The routing table is the
mechanism for distributing findings without fragmenting provenance
(precedent: `_gold-intake` routing.json).

## 2026-07-25 — prior synthesis adoption

**Question:** What happens to `Legal_Ontologies_for_beep-effect.md` (the
June-29 prior synthesis, never moved into the repo)?

**Answer:** Commit it into this packet as
`research/prior-synthesis-legal-ontologies.md`, registered in SOURCES.md as
the prior-art anchor.

**Rationale:** It is the single largest piece of prior art for this run (72
papers deep-read, ~240-paper backlog pointer) and its own footer asked to be
moved into the repo. Untracked, it is invisible to future sessions; adopted,
it defines the delta this run must beat.

## 2026-07-25 — aux tooling

**Question:** Role of firecrawl and grok (claudeg) in the pipeline?

**Answer:** firecrawl-parse only as extraction fallback (rare — 40/40 sample
PDFs extracted cleanly with `pdftotext`); `firecrawl research` only for
canonical-metadata enrichment of the T2 shortlist. No grok/claudeg.

**Rationale:** The corpus has text layers, so local extraction is nearly free;
firecrawl credits (3,532 left) are reserved for the few failures and for
DOI/venue enrichment where it adds provenance value. No live-web/X research
component exists in this run, so the grok lane spends quota for nothing.

## 2026-07-25 — T2 checkpoint: shortlist size + effort

**Question:** T1 triage produced 185 deep-read verdicts (lens-balanced
shortlist assembled at the 180 cap, trimming 5 legal-ontology papers at
relevance 68–76). Run how many, at what reasoning effort?

**Answer:** All 185 (cap lifted), `gpt-5.6-sol` at **max** reasoning per
paper. T3 syntheses stay at Sol max as planned.

**Rationale:** User-approved at the S4 checkpoint. The 5 trimmed papers were
high-relevance casualties of an arbitrary cap; the quota-pause/resume
machinery (`ops/PAUSED` sentinel, idempotent rerun) makes the larger run safe
across quota windows. Max effort honors the original "Sol on Max level
reasoning" intent; the xhigh-for-throughput alternative was offered and
declined.

## 2026-07-25 — prior-synthesis snippet audit (mid-run addition)

**Question:** User noticed foundational issues in code snippets inside the
adopted prior synthesis (and suspects other documents). How to handle?

**Answer:** Independent adversarial review job launched immediately: codex
`gpt-5.6-sol` (xhigh), repo cwd read-only, output committed as
`reviews/2026-07-25-codex-prior-synthesis-snippet-audit.md`. Verifies every
code snippet against Effect v4 as vendored + real `@beep/*` symbols, with
file:line proof per finding; recommends errata annotations (the synthesis is
a historical artifact — history is not rewritten). The same Effect-v4/beep-API
verification lens is folded into the S8 QA gate for all new pipeline outputs.
