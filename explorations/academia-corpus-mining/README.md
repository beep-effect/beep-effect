# Academia Corpus Mining

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `align`
Status: `parked`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

519 research PDFs landed in the machine-local `research-7-24-26` download
pile (**no longer present — see Corpus location below**) from Academia.edu
interest recommendations — two waves (June 29: LLM agents, memory,
metacognition, neuro-symbolic, document understanding; July 24–25: legal
ontologies, AI-and-law). With five non-PDF papers that is 524 files,
normalized to **443 canonical papers** (the early "444 unique titles" figure
was the preliminary filename estimate). Mine them against the repo's live
work streams and land the intelligence here for later goal graduation.

## Corpus location (verified 2026-08-17)

The source PDFs were **not retained**. The machine-local `research-7-24-26`
download pile was a transient acquisition site and no longer exists. Nothing is lost that this
packet depends on: the durable artifact is the normalized library, and every
paper's extracted text survived.

**Durable library:** the machine-local `academia-2026-07` research corpus
(out-of-repo, under the operator's research root)

| Directory | Files | What it holds |
| --- | ---: | --- |
| `text/` | **443** | Full extracted text, one per canonical paper |
| `meta/` | **443** | Per-paper metadata (sha256, pages, size, pdfTitle, extractStatus) |
| `firstpages/` | **443** | First-page extracts used for triage |
| `notes/` | 231 | Deep-read notes |
| `synthesis/` | 10 | Tier-3 syntheses |
| `state/` | 24 | Pipeline state and dispatch records |

Verified counts, not claimed ones: **443/443 records report
`extractStatus: "ok"`** — zero failures and zero sub-1k-char extractions. Text
volume is 330 papers at 20k–100k chars, 49 above 100k, 64 at 1k–20k. The
citable content of all 443 papers is intact.

**Two real gaps, both non-blocking:**

1. **No PDFs.** Figures, tables, and page layout are unrecoverable from the
   text extracts. This only matters for a paper whose figures carry the
   argument.
2. **No DOIs or URLs were recorded** in any of the 443 meta records
   (`srcPath` points at the dead download-pile path). Re-acquisition would be
   title-based search per paper, not a link fetch.

### Identifier backfill (2026-08-17)

The original meta records carried no DOI or URL. A resolver pass over the 443
first-page extracts recovered identifiers where the source PDFs had them
embedded — ResearchGate and arXiv headers usually do; Academia.edu-native
uploads usually do not.

| Outcome | Papers |
| --- | ---: |
| DOI verified via OpenAlex (title, year, OA link) | 100 |
| arXiv ID verified via OpenAlex | 50 |
| Matched by title search (>= 0.72 similarity) | 30 |
| Identifier extracted offline, unverified | 6 |
| **No identifier anywhere on the first page** | **257** |
| **Total carrying a DOI or arXiv id** | **186 / 443 (42%)** |

Index: `resolved-index.jsonl` at the corpus root, one record
per paper keyed by the same 12-char `id` used across `text/`, `meta/`, and
`firstpages/`.

**Open-access PDFs recovered:** 42 and counting, into
the corpus's `pdf/<id>.pdf`, fetched from the
`best_oa_location` OpenAlex reports. 101 papers had an OA PDF URL.

**Why 257 resolve to nothing, honestly:** they are Academia.edu-native
uploads, book chapters, and non-indexed preprints with no DOI printed on the
page and no usable PDF metadata (only 6 of 443 records had a non-empty
`pdfTitle`). Title-search against a truncated Academia filename is not
reliable enough to assert a match, so those are left unresolved rather than
guessed. Their extracted text is unaffected and remains complete.

**Reproduce:** `resolve-identifiers.py` and `fetch-oa-pdfs.py` are stored in
the library. Both are resumable and safe to re-run; OpenAlex throttles at
roughly 10 req/s, so the resolver backs off on 429.

## Next Open Question

Parked revival trigger: a new paper corpus wave lands in the machine-local
academia-2026-07 research corpus (or a successor library). The wave-2 routing
triage completed 2026-08-17 — all 14 proposals dispatched.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - method, per-cluster findings map, capability inventory, high-priority routes.
4. [`research/t3-master-synthesis.md`](./research/t3-master-synthesis.md) - repo-grounded master synthesis: ten findings, 36-route table, 13 align questions. Cluster detail in `research/t3-*.md`.
5. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
6. [`research/prior-synthesis-legal-ontologies.md`](./research/prior-synthesis-legal-ontologies.md) - June-29 prior synthesis (72 papers deep-read), adopted as prior-art anchor. **ERRATA WARNING (2026-07-25):** its code snippets are NOT safe to copy — 36 of 56 TypeScript fences carry verified defects (removed Effect-v4 APIs, invented `@beep/*` symbols, a falsely-claimed publication gate). Read [`reviews/2026-07-25-codex-prior-synthesis-snippet-audit.md`](./reviews/2026-07-25-codex-prior-synthesis-snippet-audit.md) first; the file itself stays byte-identical because the audit and the prior-72 reconstruction cite its exact line numbers.
7. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
8. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-08-17: wave-2 routing TRIAGED (operator). All ten attach-to/extend
  proposals routed as dated notes (completed-retained targets receive
  re-entry notes; `identity-iri-fold` retargeted to `identity-iri-fibered`);
  all four proposed explorations spawned parked-at-capture
  (`legal-inference-policy`, `ontology-curation-governance`,
  `evidence-source-policy-calibration`, `ontology-lifecycle-qa`). Same day:
  identifier backfill recovered 186/443 DOIs/arXiv ids and OA PDFs into the
  library (`resolved-index.jsonl`). Packet re-parked; new trigger = a new
  corpus wave lands.

- 2026-08-13: wave 2 EXECUTED. The approved “97 legal-NLP/extraction papers”
  count was aggregate-only and largely consumed by July wave-1 deep reads
  (including the 144 June-29 papers already noted), so the operator ratified
  re-triage by definition. Five first-page-grounded batches classified the
  199-paper no-note backlog as core 2 / extended 44 / excluded 153; all 46
  core+extended papers were deep-read (46/46 notes, zero failures). External
  synthesis: `synthesis/wave2-synthesis.md` in the machine-local academia-2026-07 research corpus.
  It found zero contradictions of the master ten findings and produced 14
  routing proposals, including `legal-inference-policy`,
  `ontology-curation-governance`, `evidence-source-policy-calibration`, and
  `ontology-lifecycle-qa`. Packet stays parked; proposals require operator
  triage and never auto-enter the packet tree.

- 2026-07-25 (park): binding-doc PR landed the typed-verdict replacement
  (`docs/product/prose-to-proof.md`, the approval policy) and the
  memory-layer-taxonomy episodic/projection split — the last dispatched
  route. Status → `parked`; revival trigger: the approved wave-2 backlog
  run (97 legal-NLP papers first).
- 2026-07-25 (align): interview closed nine decisions (see DECISIONS.md
  align entries) — dispatch all 15 high-priority routes as bounded notes +
  2 new capture packets (`agent-execution-sandbox`,
  `model-artifact-admission`); replace prose-to-proof fact language
  (separate PR); belief views first over the bitemporal core;
  argumentation first after M1; one metacognition protocol; wave 2 (97
  legal-NLP papers) approved-deferred; packet parks after dispatch.
  Stage → `align`; 11 dispatch notes landed in target packets.
- 2026-07-25 (close): S8 QA gate passed — adversarial codex review
  ([`reviews/2026-07-25-codex-research-qa.md`](./reviews/2026-07-25-codex-research-qa.md))
  verdict FIX-THEN-SHIP: zero Effect-v4/`@beep/*` defects, zero copyright or
  provenance violations, all counts verified exact; 3 documentation-contract
  findings (corpus-count provenance, catalog header contract, path-count
  off-by-one) fixed same session.
- 2026-07-25 (evening): T2 + T3 complete → stage `research`. 185 Sol-max
  deep-reads (42 gold / 125 silver / 15 bronze / 3 dross, zero quote
  violations); 7 cluster reports + repo-grounded master synthesis landed in
  `research/`; RESEARCH.md finished (per-cluster map, 36-route table — 15
  high-priority); manifest openQuestions rewritten from the master's 13
  align questions.
- 2026-07-25 (later): snippet audit landed — 36/56 fences defective, 13
  findings (7 foundational); errata banners added at entry points, synthesis
  kept byte-identical (see DECISIONS.md). T2 deep-reads running (185 papers,
  Sol max).
- 2026-07-25: packet opened; grilling closed 7 decisions (see DECISIONS.md);
  prior June-29 synthesis adopted into `research/`; S0–S2 + T1 triage
  complete (443 papers: 185 deep-read / 93 maybe / 165 catalog-only);
  external normalized corpus library established at
  the machine-local `academia-2026-07` corpus home (public repo — no copyrighted
  PDFs/full texts committed here).
