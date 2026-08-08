# Mine: C&H as a graded testbed for beep's knowledge-engine bet

**Date:** 2026-08-08
**Agent:** mine-benchmark-integration (Opus 5)
**Inputs read:** all five map reports in this directory; `CAPTURE.md`; `DECISIONS.md`;
`assets/x-post-itsjuliopereyra-2085772997944803682.md`.
**Verification:** in-repo capability claims below were checked against live source in
`/home/elpresidank/YeeBois/projects/beep-effect13` (paths are repo-relative). harvey-labs
citations are relative to `~/YeeBois/research/harvey-labs`. Numbers marked *(computed here)*
were derived by this agent from the 250 `task.json` files; nothing under
`tasks/firm-knowledge/dms/` was opened.

---

## 0. Recommendation, at the top

**Run the amortized-index experiment on their harness, unmodified, using the `docs_dir`
seam — and use it as the acceptance gauntlet that `goals/practice-kg-mcp` P5 is currently
stuck on.**

Three facts make this the right call rather than a research indulgence:

1. **The grading surface is matter-level, not document-level.** *(computed here)* 2,638 of
   3,098 criteria (85.1%) cite a matter id; only 295 (9.5%) cite a filename; **200 of 250
   tasks contain zero filename-citing criteria at all**, carrying 2,466 of the 3,098
   criteria. A correct per-matter structural summary — which `map-corpus.md` §7.2 estimates
   at ~200 tokens and shows is largely recoverable from *folder topology alone* — targets
   85% of the grading surface without opening a document at query time. 266 matters × ~200
   tokens ≈ **53k tokens: the entire firm's structural model fits in one context window.**
2. **beep already owns the build lane and the query lane** — `bun run beep corpus
   catalog|extract|organize|enrich` (`packages/tooling/tool/cli/src/commands/Corpus/Corpus.command.ts:325-334`)
   plus `PracticeKgProjections` → PGlite spine + DuckDB BM25 catalog
   (`packages/law-practice/server/src/PracticeKg.projections.ts:570`,
   `PracticeKg.fts.ts:142-170`) plus a budgeted read-only MCP surface
   (`packages/law-practice/use-cases/src/PracticeKg.tools.ts:185-197`). C&H's
   client → matter → document spine is the same shape as PracticeKg's
   client → docket_family → document spine. This is a re-parameterization, not a rewrite.
3. **`goals/practice-kg-mcp` P5 is blocked on acceptance evidence that cannot be shared.**
   Its current gauntlet is five hand-graded questions against Tom's confidential corpus
   (`goals/practice-kg-mcp/PLAN.md`, P5 row; `AC-2 not met`). C&H is MIT-licensed, public,
   and comes with 3,098 rubric criteria and published frontier baselines. It converts a
   one-shot unshareable judgement call into a repeatable, CI-able, publishable number.

The single most important design decision: **no harness patch is required.** `run.py:56-63`
resolves `docs_dir` to *any* path relative to the task dir, and `sandbox.py:365-367` mounts
that path read-only at `/workspace/documents`. Point a derived task set at a directory that
holds `dms/` **and** `index/` as siblings and the amortized-index condition exists with zero
Python changes (see §3.1). `map-harness.md` §10 concluded a patch was needed; the `docs_dir`
seam is cheaper and upstream-neutral.

---

## 1. Constraints the design must respect

Inherited from the map reports, restated as hard design inputs:

| Constraint | Source | Consequence for us |
|---|---|---|
| `--network=none`, `--cap-drop=ALL`, 6 closed tools, no MCP | `sandbox/sandbox.py:343-351`; `harness/tools.py:1-24` | **A beep MCP server cannot be called from inside a comparable run.** The index must be *files the stock image can read*. |
| Stock image ships python 3.12 + pandas/openpyxl/pdfplumber/markitdown, node, jq, ripgrep, pandoc, libreoffice — **no duckdb, no postgres/PGlite, no sqlite3 CLI** | `sandbox/Dockerfile` (read in full) | Index query path must be python-stdlib `sqlite3` or plain text/JSONL. DuckDB and PGlite bundles are **not** loadable inside a stock-image run. |
| `glob` caps at 100 and `grep` at 250 results, **silently** | `harness/tools.py:576`, `:629` (via `map-harness.md` §3) | Any enumeration the agent does through their tools is unreliable by construction. Our index must let the agent enumerate *without* those tools. |
| `grep` is near-blind: raw `read_text()` over OOXML zips | `harness/tools.py:613`; `map-pipeline-docs.md` D10 | The keyword channel is dead. Pre-extracted text is the whole game. |
| Per-run workspace is fresh; documents mounted `ro`; container destroyed | `harness/run.py:283-284`; `sandbox.py:366` | Amortization must live *outside* the run — either in `docs_dir` or in the image. |
| `docs_dir` accepts any relative path, resolved and mounted | `harness/run.py:56-63`; `sandbox.py:366` | **The seam.** See §3.1. |
| `--sandbox-image` is a first-class CLI flag | `harness/run.py:239` | A derived image is possible but changes the baseline; use only for Track C. |
| `Sandbox(network=…, extra_env=…)` are constructor params not exposed on the CLI | `sandbox/sandbox.py:149,153` | A ~3-line patch enables a networked/MCP variant. Non-comparable to published baselines; Track C only. |
| All-pass scoring; 3,098 criteria; expected all-pass at p=0.5 is 10.19/250 | `evaluation/scoring.py:383-386`; `map-task-census.md` §2 | Headline movement requires per-criterion reliability, not cleverness. See §5. |
| Every firm-knowledge criterion is judged against the **entire** agent output (0/250 declare `deliverables`) | `evaluation/scoring.py:322-340`; `map-evaluation.md` §5.3 | Judge cost scales with (criteria × output size). Keep agent output terse. See §4. |
| Filenames are 100% clean lowercase-kebab — a channel no real DMS has | `map-corpus.md` §5.2 | A filename-ablated control run is **mandatory** for an honest claim. See §5.2. |

---

## 2. In-repo capability inventory (verified)

Checked with `ls`/`rg` against live source. "Reuse" = exists and applies as-is;
"Extend" = exists, needs a bounded change; "NET-NEW" = does not exist.

### 2.1 Reuse — exists and directly applicable

| Capability | Where | Why it matters here |
|---|---|---|
| Corpus ingestion CLI: `catalog`, `extract`, `organize`, `enrich`, `salvage`, `archive-move` | `packages/tooling/tool/cli/src/commands/Corpus/Corpus.command.ts:142-334` | The offline build lane already exists as an operator command with `--concurrency`, `--tika-jar`, `--max-files`. |
| Real Tika extraction via child process | `packages/drivers/tika/src/Tika.tikaapp.ts` (spawns `java -jar` through `effect/unstable/process`) | Parses the OOXML the harness `grep` cannot see. |
| JS-native docx/pdf extraction (mammoth + unpdf) | `packages/drivers/doc-text/src/DocText.service.ts:60-63` (`supportedFormats: ["pdf-text-layer","docx"]`) | A JVM-free fallback for the 8,055 `.docx`. |
| KG projection + bundle build from a corpus root | `packages/law-practice/server/src/PracticeKg.projections.ts:570` (`buildPracticeKgBundleImpl`), `:697` (`PracticeKgProjections` service) | The "build the representation once" lane, already written. |
| DuckDB catalog + **hand-rolled BM25 in plain SQL** (`fts_docstats` / `fts_postings` / `fts_terms` / `fts_bm25` view) | `packages/law-practice/server/src/PracticeKg.fts.ts:142-170` | No FTS extension, no native module — **the same SQL ports to stock-image `sqlite3` verbatim.** This is the single most load-bearing reuse in the plan. |
| `document_text` carries a `truncated BOOLEAN` column | `PracticeKg.fts.ts:80-87` | Truncation honesty already modelled at the storage layer. |
| Budgeted columnar tool result carrying `{ total, truncated, tier }` | `packages/law-practice/use-cases/src/PracticeKg.tools.ts:185-197` (`PracticeKgToolResult`), `packages/foundation/capability/mcp-kit/src/FieldTier.ts:441` (`ColumnarEnvelope`) | `map-harness.md` ranked "enumeration tools must never truncate silently" as LAB's #1 lesson. **beep already models it.** (Caveat: `goals/practice-kg-mcp` P7 item B-6 lists "disclosure-budget truncation signaling" as pending hardening — the field exists, the end-to-end behaviour is not yet proven.) |
| Path-escape guard as a typed Effect module | `packages/foundation/capability/file-processing/src/PathSafety/index.ts:57` (`PathSafetyViolationReason` LiteralKit), `:106` (`PathSafetyError`), `:248` (`isPathWithinRoot`), `:353` (`resolvePathWithinRoot`) | `map-harness.md` §9.3 asked us to port `_is_under` as a typed service. It is already here. |
| File-processing coverage manifest | `packages/foundation/capability/file-processing/src/Extraction/index.ts:972` (`FileProcessingCoverageSummary` with `byFormat`/`succeeded`/`skipped`/`failed`), `:1025` (`ProcessRunManifest`) | The build-side analogue of LAB's `doc_coverage`. |
| Span-grounded extraction with verified offsets | `packages/foundation/capability/langextract/src/VerifiedSpan/index.ts:146,204,571,717`; `packages/foundation/capability/file-processing/src/SourceText/index.ts:213,335,374` | Every index row can carry a char-span back to source text — the provenance LAB's rubric asks for and its `sources` field never delivered. |
| Epistemic claim/evidence/bitemporal substrate | `packages/epistemic/domain/src/entities/{CandidateClaim,Evidence,EdgeVersion}`; `packages/epistemic/use-cases/src/{ClaimGate,ClaimLifecycle,ClaimProjection}`; goals `epistemic-bitemporal-edge-core`, `epistemic-claim-lifecycle-gate` both `completed-retained` | Derived facts ("this matter settled") enter as *claims with evidence*, not as untyped index rows. |
| `LanguageModel` (effect/unstable/ai) already wired in-repo | `packages/agents/server/src/AssistantTurn/AnthropicTurnKernel.ts`; `packages/drivers/{xai,venice-ai}/src/*LanguageModel*`; `packages/foundation/capability/langextract/src/Service/index.ts` | An Effect-native judge is a composition, not new plumbing. |
| QA judge lane with **mandatory** evidence and anti-fabrication cross-check | `packages/tooling/tool/cli/src/commands/Qa/Inventory.schemas.ts:314-320` (`QaFinding.evidence: S.NonEmptyArray(...)`, "a finding without evidence is not a finding"), `:435` (`QaInventory`), `commands/Qa/JudgeCheck.ts:42,167,258` (`EvidenceCrossCheck`, `crossCheckEvidence`, `crossCheckAgainstRound`) | **beep is ahead of LAB here.** LAB's `sources` field is vestigial and read by nothing (`map-evaluation.md` §12.7); beep already refuses evidence-free findings and cross-checks cited artefacts against the round. |
| `beep qa judge-lint / judge-check / judge-ingest / judge-pack` | `packages/tooling/tool/cli/src/commands/Qa/` | The operator shape an eval harness would extend. |

### 2.2 Extend — exists, bounded change needed

| Gap | Evidence | Size |
|---|---|---|
| **`FileFormatFamily` has no `pptx` and no `.eml`** — `fromExtension` maps both to `"unknown"` | `packages/foundation/capability/file-processing/src/Strategy/index.ts:99-133` | 660 of 9,288 C&H files (7.1%: 615 `.eml` + 45 `.pptx`) fall outside the typed pipeline. Tika parses both natively; this is a LiteralKit + dispatch extension, not new extraction code. |
| In-process `@beep/tika` scaffold marks `xlsx`/`xls` **out of scope** and `docx`/`pdf` **deferred** | `packages/drivers/tika/src/Tika.service.ts:59-61,119,142-143` | The tika-app child-process engine is the real path; the in-process engine is a scaffold. Route selection must be explicit for a 573-file `.xlsx` population. |
| PracticeKg spine is patent-shaped (`docket`, `docket_family`, `application_number`, `patent_number`, `enrichment`) | `packages/law-practice/server/src/PracticeKg.fts.ts:59-119`; `PracticeKg.queries.ts:21-120` | C&H needs `matter` where PracticeKg has `docket_family`, plus `practice_area` and `matter_status`. Same arity, different literals. |
| `hybrid-retrieval-fusion-core` (weighted RRF over semantic/lexical/literal/graph) is **not started** | `goals/hybrid-retrieval-fusion-core/ops/manifest.json` (`statusNote`: "P0 must audit live symbols…"), README "Latest Evidence: Not started." | The BM25 channel exists; fusion does not. Do **not** plan the first C&H run around it. |
| Bundle is PGlite + DuckDB — neither loadable in the LAB stock image | `apps/practice-kg-mcp/README.md`; `sandbox/Dockerfile` | Needs a **SQLite emit target** for the in-sandbox artefact. The BM25 SQL is extension-free, so this is a dialect port, not a redesign. |
| QA judge runs by shelling `codex-companion.mjs` | `packages/tooling/tool/cli/src/commands/Qa/JudgePack.ts:79,935` | An in-Effect `LanguageModel` judge service is the roll-our-own step, on top of existing driver layers. |

### 2.3 NET-NEW

- **`MatterSummary` / `CorpusDigest` schema** — the amortized intermediate model itself. Nothing
  in the repo models "what does this corpus contain, in ~200 tokens per unit".
- **`beep eval`** — no eval/rubric/all-pass command exists
  (`packages/tooling/tool/cli/src/commands/` has no `Eval`). Rubric schema, criterion-scoped
  judge fan-out, all-pass + `p^n` reporting are all new.
- **LAB adapter** — task-set derivation, run driving, score ingestion.
- **`cognee` / `basic-memory` / `knowledge-vault` are NOT in-repo code.** `rg -l -i cognee`
  returns only `goals/**`, `explorations/**` and `standards/memory-architecture/**` — i.e.
  docs and packets. basic-memory and codegraph are external MCP servers used by agents
  (`CLAUDE.md` §Agent Memory), not beep runtime capability. Any opportunity written as
  "point cognee at C&H" is an integration project, not a composition of in-repo bricks.

---

## 3. Design at fat-marker fidelity

### 3.1 Adapter surface — three tracks, ranked by comparability

**Track A — `docs_dir` sibling seam (zero harness patch). Do this one.**

```
tasks/firm-knowledge-beep/                 # derived, not committed to harvey-labs
  env/
    dms/        <- `cp -al ../../firm-knowledge/dms .`  (hardlink tree; instant, ~0 extra bytes)
    index/      <- our amortized artefacts (see §3.2)
  tasks/001..250/task.json                 # copies with docs_dir rewritten "../../dms" -> "../../env"
```

`run.py:56-63` resolves `docs_dir` and `sandbox.py:366` mounts it `ro` at
`/workspace/documents`. The agent now sees `documents/dms/matters/...` **and**
`documents/index/...`. Rubrics stay physically outside the mount (they live under
`tasks/`, a sibling of `env/`), so the `system_prompt.md:16-18` "do not read task.json"
lock is preserved — verify this explicitly before the first run, because a mount that
accidentally includes `tasks/` invalidates every number.

Baseline condition = same derived task set with `env/index/` absent. Both conditions
therefore share the `documents/dms/...` path prefix change, so the only variable is the
index. **Do not compare against Harvey's published numbers directly**; re-run the baseline
locally under the same path shape.

**Track B — fourth mount / `--cache-dir` (~5-line patch to `sandbox.py:365-367` + `run.py`).**
Cleaner to upstream, and the honest way to express "amortized cache" as a first-class
harness concept. Worth a PR to harvey-labs after Track A produces a number. Also the only
way to run a *writable* amortization (agent updates its own index across tasks).

**Track C — networked/MCP variant.** `Sandbox(network=…, extra_env=…)` already exist as
constructor params (`sandbox/sandbox.py:149,153`); exposing them is ~3 lines. This lets the
agent call the live `apps/practice-kg-mcp` stdio/HTTP surface. **Not comparable to any
baseline** — it swaps the tool universe, not just the corpus. Run it last, as a product
demo, not as evidence.

### 3.2 What representation we actually build

Design order is schema → service → impl. Three layers, each independently useful and each
answering a different slice of the 250 tasks:

**Layer 1 — `CorpusDigest` (structural, no LLM, ~53k tokens total).**
Derived from folder topology + filenames + extracted-text headers. Per matter:

```
MatterSummary = {
  matterId:      MatterId          // branded `<client>-<seq>`
  clientId, clientName
  practiceArea:  ReadonlyArray<PracticeArea>      // LiteralKit; multi-valued
  lifecycle:     MatterLifecycle    // LiteralKit: intake-only | in-progress | closed | withdrawn | dismissed | settled
  bands:         HashSet<DocumentBand>            // intake | substance | correspondence | outcome
  folderLabels:  ReadonlyArray<FolderLabel>       // branded: rejects "/" (see map-corpus §6 path-injection)
  docTypeHistogram: HashMap<DocumentType, NonNegativeInt>
  fileCount, docxCount, xlsxCount, pptxCount, emlCount
  redlineFiles:  ReadonlyArray<DocumentRef>       // files carrying real w:ins/w:del
  dateRange:     Option<InstantRange>
  keyDocuments:  ReadonlyArray<DocumentRef>       // engagement letter, closing memo, settlement agreement…
  provenance:    ProvenanceRef                    // build run + digest, per epistemic doctrine
}
```

Why this is the high-leverage layer: `map-corpus.md` §2.2 proves structural features are
**topological** — "IPO withdrawn" is a `Withdrawal/` folder; "still open" is an *absent*
outcome band; "reached claim construction" is a `Claim Construction/` folder. And
*(computed here)* 200 of 250 tasks never cite a filename. Layer 1 alone plausibly addresses
the existence-check, portfolio-hygiene, client-relationship, count and superlative shapes.

Emit as: `index/firm-digest.md` (one file, whole corpus, agent reads it in one `read`) +
`index/matters/<id>.md` (266 files) + `index/digest.jsonl` (jq-able).

**Layer 2 — `DocumentIndex` + BM25 over extracted text (SQLite).**
`beep corpus extract` → per-document canonical text with UTF-16 offsets
(`SourceText/index.ts:213,335`), then the `fts_docstats`/`fts_postings`/`fts_terms`/`fts_bm25`
schema from `PracticeKg.fts.ts:142-170` emitted to **SQLite instead of DuckDB**. That SQL uses
no extension and no window functions beyond plain aggregates, so it runs on the stdlib
`sqlite3` module in `python:3.12-slim`. Ship as `index/corpus.sqlite` plus a 30-line
`index/query.py` the agent can `bash python3 index/query.py search "escrow" --limit 50`.
Every result row carries `{ total, truncated }` — the anti-silent-truncation law
(`PracticeKgToolResult`, `mcp-kit/FieldTier.ts:441`) applied to the artefact the agent reads.

**Layer 3 — `MatterFeature` claims (LLM-derived, span-grounded, optional for run 1).**
The value-level pins C&H grades on ("10% escrow", "12-month non-compete", "$4.2M budget")
live in prose and spreadsheet cells (`map-corpus.md` §4). Extract with `@beep/langextract`
→ `VerifiedSpan` → `CandidateClaim` + `Evidence` through `ClaimGate`
(`packages/epistemic/use-cases/src/ClaimGate`). Emit as `index/features.jsonl` with
`{ matterId, featureType, value, sourceDocument, span }`. **Defer to run 2** — Layer 1+2
should be measured alone first, or the result is unattributable.

### 3.3 Query-time agent

Track A's query-time agent is *their* agent (Opus/GPT via their adapters) — we change only
what it can read. That is the point: it isolates "does an amortized representation help"
from "is beep's agent good". A beep-native agent is Track C.

The one prompt-side lever available without patching: `docs_dir` content is the agent's
world, so `index/README.md` at the mount root is read by any agent that runs `ls` first.
Write it as a SKILL.md-shaped manual per `map-harness.md` §6: triggers **and** anti-triggers,
a goal→command quick-reference table, named failure modes, and an explicit
"you have not enumerated until `truncated=false`" gate.

### 3.4 Scoring

Run 1 uses **their** evaluator (`python -m evaluation.run_eval`) — the DECISIONS entry
allows their harness "as a bootstrap/baseline harness while ours does not exist yet", and
using ours for run 1 would make the number unfalsifiable. Ours (Opportunity 3) grades run 2
in parallel and its agreement rate with theirs is itself the validation evidence.

---

## 4. Cost model

Order-of-magnitude, marked where derived vs assumed.

**One-time build (amortized):**

| Item | Estimate | Basis |
|---|---|---|
| Text extraction, 9,288 files / 515 MB | minutes–hours wall clock; **$0 API** | `beep corpus extract --concurrency N`; tika-app JVM spawn dominates. **UNVERIFIED** — no measured throughput for this corpus. |
| Layer 1 structural digest | **$0 API**, seconds | Pure topology + filename derivation. |
| Layer 2 BM25 index | **$0 API**, minutes | Plain SQL aggregation. |
| Layer 3 feature claims (deferred) | ~100M input tokens for a full-corpus LLM pass | Corpus is ~100M tokens (announcement). At $C per 1M input, one-time cost ≈ **$100·C**. Amortized over 250 tasks: **$0.40·C per task.** Chunk selection can cut the input by an order of magnitude if only substance-band documents are passed. |

**Per-evaluation-sweep (recurring, and the real budget risk):**

- 3,098 criteria = **3,098 judge calls per full sweep**, one per criterion
  (`evaluation/scoring.py:342-381`).
- **Every** firm-knowledge criterion carries the agent's *entire* output, because 0/250
  tasks declare `deliverables` (`map-evaluation.md` §5.3). If agent output averages 3k
  tokens, that is ~9.3M judge input tokens per sweep; task 188 alone sends the full output
  122 times. **Mitigation that costs nothing: instruct the agent to keep its answer terse.**
  Output size is a multiplier on 3,098.
- Agent side: baselines take 5+ min/task (announcement). 250 tasks × 2 conditions
  (index / no-index) × 2 runs = 1,000 agent runs. `utils/sweep.py --parallel 8` ≈ 16 CPU /
  16 GB (`map-harness.md` §10).
- Hidden cost: `get_metrics()` walks the 9,288-file corpus and writes a ~9,000-entry
  `documents_skipped_list` into **every** `metrics.json` (`harness/tools.py:646-668`;
  `map-pipeline-docs.md` D11). 1,000 runs ≈ 9M path strings on disk. Budget the disk, or
  patch it.

**Cheapest credible first experiment:** Layer 1 only, one condition pair, on a
**stratified 40-task subsample** (all 5 conflicts tasks, all 11 existence checks, all 12
distribution tasks, the 5 trend tasks, and a random 7 from enumeration) — ~500 criteria
instead of 3,098, ~85% cost reduction, and it still covers the shapes where the thesis
predicts movement. Do that before committing to a full sweep.

---

## 5. What winning proves — and how we'd know we were fooling ourselves

### 5.1 The claim under test

> An amortized, schema-first structural model of a persistent corpus, built once offline,
> converts an enumeration/stopping failure into a lookup — measurably, on someone else's
> rubric, against published frontier baselines.

That is precisely the announcement's stated open problem ("agents do not build an effective
intermediate model of what the corpus contains"), and precisely the bet behind
`goals/practice-kg-mcp`, `goals/hybrid-retrieval-fusion-core`, and the epistemic stack.
Winning is external, third-party validation of the repo's central architectural thesis —
the kind of evidence no amount of in-repo green can produce.

### 5.2 Falsification design (non-negotiable)

1. **Filename-ablation control** (`map-corpus.md` §7.1). 100% of C&H filenames are clean
   semantic lowercase-kebab — a channel no production DMS has. Run a third condition with
   basenames hashed (extension preserved). If our gain evaporates under ablation, we built a
   filename grep, not a corpus model. **This is the cheapest high-value experiment in the
   packet and it is a gate, not an extra.**
2. **Shape-stratified prediction, registered before the run.** The thesis predicts gains
   concentrated in enumeration (105 tasks), count (23), distribution (12), trend (5),
   existence (11) and conflicts (5) — and **near-zero** gain on superlative (43) and
   single-document (4) shapes. *(computed here)* the superlative shape contributes 4.62 of
   the 10.19 expected all-pass tasks at p=0.5, so a leaderboard number can move entirely on
   the easy tail. If the gain is concentrated in superlatives, we proved nothing.
3. **Report both metrics with the arithmetic.** *(computed here)* all-pass expectation is
   10.19/250 at p=0.5, 57.1 at p=0.8, 105.5 at p=0.9, 152.6 at p=0.95, 200.2 at p=0.98. A
   criterion-pass improvement from 0.50 → 0.80 is a 5.6× all-pass improvement; quoting only
   one of the two is the category error `map-task-census.md` §2 names.
4. **Doc-coverage delta as the mechanism check.** LAB already records
   `documents_read_list` / `documents_skipped_list` (`harness/tools.py:646-668`). The thesis
   predicts our condition reads **fewer** documents and scores **higher**. If we score higher
   by reading more, we bought the gain with tokens, not with a representation.
5. **Zero-result tasks as the over-eagerness canary.** Tasks 013, 221, 236, 061 have "no"
   as the correct answer and contain engineered near-misses (`map-task-census.md` §7.6). An
   index that surfaces plausible candidates could *degrade* these. Track them separately.

### 5.3 What losing teaches

A negative result is still worth the spend: it would say the bottleneck is judge-visible
answer construction, not corpus modelling — which redirects `hybrid-retrieval-fusion-core`
and the whole retrieval strand before more is invested in it. Design the run so a null
result is publishable inside the packet.

---

## 6. Ranked opportunities

### O1 — C&H as the public acceptance gauntlet for the knowledge bundle *(rank 1)*

**What:** Derive `tasks/firm-knowledge-beep` (Track A), build Layers 1+2 with the existing
corpus pipeline, run the 40-task stratified pair, score with their evaluator, publish the
delta with the ablation control.

**Composes:** `bun run beep corpus catalog|extract|organize`
(`commands/Corpus/Corpus.command.ts:142-334`) · `Tika.tikaapp.ts` child-process extraction ·
`PracticeKg.fts.ts:142-170` BM25 SQL (retargeted to SQLite) ·
`FileProcessingCoverageSummary` (`file-processing/src/Extraction/index.ts:972`) ·
`PathSafety` (`file-processing/src/PathSafety/index.ts:353`).

**NET-NEW:** `MatterSummary`/`CorpusDigest` schemas; SQLite emit target; the derived task-set
generator; `index/README.md` agent manual.

**Why rank 1:** it is the only opportunity that produces an *external* number, and it
unblocks `goals/practice-kg-mcp` P5, whose current acceptance evidence is five hand-graded
questions on a corpus that can never be shared or regression-tested
(`goals/practice-kg-mcp/PLAN.md`, P5 row). It also directly discharges the standing-test-asset
decision (`DECISIONS.md`, 2026-08-08).

**Evidence gate:** all-pass and criterion-pass for three conditions (no-index / index /
index+ablation), doc-coverage delta, per-shape breakdown, wall-clock per task.

---

### O2 — `MatterSummary` as the repo's first amortized-representation schema *(rank 2)*

**What:** Land `MatterSummary` / `CorpusDigest` / `DocumentBand` / `MatterLifecycle` /
`FolderLabel` as `@beep/*` schemas with derived guards, plus a projection service that
builds them from a corpus root and invalidates per matter.

**Composes:** `LiteralKit` + `S.Class` + `$I` identity composers (repo law) ·
`packages/epistemic/domain/src/values/EvidenceSpan` and `Evidence` for provenance ·
`PracticeKgProjections` (`PracticeKg.projections.ts:697`) as the projection-service precedent ·
`identity` IRIs as node ids (`goals/practice-kg-mcp` D-9).

**NET-NEW:** the schemas themselves and the topology→lifecycle derivation.

**Why rank 2:** this is the durable asset. O1 is an experiment; O2 is the thing the
experiment tests, and it outlives C&H — it is what a beep DMS/knowledge product actually
ships. The `FolderLabel` branded type that rejects `/` is a direct fix for the
path-injection artefact `map-corpus.md` §6 found in C&H's own renderer, which is the kind of
detail that proves the schema is doing work.

**Watch:** do not model this as generic "graph nodes". The C&H evidence says lifecycle is
encoded by folder *presence and absence* — `Option`/`HashSet` of bands, with absence
meaningful. 63 of 266 matters have no outcome band, and that absence *is* the answer to
"which matters are still open" (`map-corpus.md` §2.1).

---

### O3 — `beep eval`: an Effect-native rubric/judge harness *(rank 3)*

**What:** The roll-our-own eval framework the DECISIONS log already committed to. Schema
first:

```
JudgeVerdict  = LiteralKit("pass","fail")
Criterion     = { id, title, matchCriteria,
                  evidence: NonEmptyArray<EvidenceRef>,          // REQUIRED, unlike LAB
                  acceptableEitherWay: HashSet<Id>,              // schema field, not judge prose
                  role: CriterionRole }                          // LiteralKit incl. "precision"
Rubric        = { title, instructions, criteria: NonEmptyArray<Criterion> }
RubricResult  = { allPass, nCriteria, nPassed, expectedAllPass, criteriaResults }
```

Judge as a `Context.Service` over `LanguageModel`, criterion fan-out as a bounded
`Effect.forEach({ concurrency })`, JSON salvage as a `S.Codec` decode with a fallback branch
rather than a try/except ladder.

**Composes:** `QaInventory`/`QaFinding` mandatory-evidence discipline
(`commands/Qa/Inventory.schemas.ts:314-320,435`) · `EvidenceCrossCheck` / `crossCheckEvidence`
anti-fabrication (`commands/Qa/JudgeCheck.ts:42,167`) · `beep qa judge-lint` as the
rubric-as-source-under-test precedent · existing `LanguageModel` driver layers ·
`beep lint` for the rubric integrity gate.

**NET-NEW:** rubric schema, criterion-scoped judge service, all-pass + `p^n` reporting,
`beep eval` command group, the LAB rubric importer (3,098 criteria as the first fixture).

**Fix on the way in** (from `map-evaluation.md` §13.3): evidence scoping **required** by
schema; one dual-judge reconciliation rule used in both aggregate and render; one provider
table shared by run-routing and judge-routing; additive metric versioning.

**Where beep is already ahead:** mandatory evidence and cross-check. **Where LAB is ahead:**
one isolated call per criterion, all-pass + diagnostic split, the `precision` criterion role,
the `ACCEPTABLE EITHER WAY` neutral band, and rubric-corpus CI. Import those four.

**Watch:** `map-task-census.md` §9 flags that `ACCEPTABLE EITHER WAY` is honoured only by the
judge model reading prose — the judge prompt has no special handling. Modelling it as a schema
field and enforcing it in the scorer is a genuine improvement on the source, not a port.

---

### O4 — Ingest-fidelity hardening with C&H defects as regression fixtures *(rank 4)*

**What:** (a) Extend `FileFormatFamily` with `pptx` and `eml` and route them through
tika-app — currently 660 of 9,288 C&H files (7.1%) map to `"unknown"`
(`file-processing/src/Strategy/index.ts:99-133`). (b) Adopt the specific C&H defect files as
committed fixtures for `@beep/file-processing`: leaked `<!-- indent:2 -->` directives (6.4%
of sampled docx), unexpanded `TOC \o "1-2" \h \z \u` field text (34.5% of sampled docx),
empty `.eml` `Date:`/`Subject:` headers, double-escaped entities in `sharedStrings.xml`, the
phantom `FTC/` single-child directory (`map-corpus.md` §5.2, §6). (c) Prove tracked-changes
survival: 169 C&H files carry real `w:ins`/`w:del`, and a flatten-to-text ingest loses the
negotiation history entirely.

**Composes:** `@beep/file-processing` (`completed-retained`) · `@beep/pandoc-ast`
(`packages/foundation/modeling/pandoc-ast`, `completed-retained`) · `Tika.tikaapp.ts` ·
`DocText.service.ts`.

**Why it matters beyond C&H:** these are the exact edge cases a real DMS connector must
survive, and they are MIT-licensed and public — we can commit them as fixtures, which we can
never do with Tom's corpus. The redline case is directly load-bearing for patent
prosecution: **claim amendments are redlines.**

**UNVERIFIED:** whether `@beep/pandoc-ast` currently preserves tracked changes. `rg` for
`w:ins|track|redline` across `pandoc-ast` and `lexical` returned nothing; needs a direct read
of `Pandoc.model.ts` before this is scoped.

---

### O5 — Prove the enumeration-honesty law empirically *(rank 5)*

**What:** A controlled run isolating the truncation variable. `map-harness.md` §3 shows
LAB's `glob` (cap 100) and `grep` (cap 250) truncate **silently**, and argues part of the
"regress to 0% all-pass" finding is a harness artefact rather than a model failure. beep
already models the fix (`PracticeKgToolResult { total, truncated }`). Ship the index's query
tool in two variants — honest (`{shown, total, truncated}`) and silent — and measure the
all-pass delta on enumeration tasks with the corpus and agent held constant.

**Composes:** `PracticeKgToolResult` (`PracticeKg.tools.ts:185-197`) · `ColumnarEnvelope` +
`FieldTier` budgets (`mcp-kit/src/FieldTier.ts:441`) · `document_text.truncated`
(`PracticeKg.fts.ts:80-87`).

**Why rank 5 and not higher:** it is a narrower result than O1–O3, but it is *cheap* (it
rides on O1's infrastructure, adding one condition), it is publishable on its own, and it
closes `goals/practice-kg-mcp` P7 item B-6 ("disclosure-budget truncation signaling") with
measured evidence instead of a code review. It also gives the repo a defensible law:
"bounded listings return `{shown, total, truncated}` as data" stops being taste and starts
being a number.

---

**Deliberately not ranked here:** the spec→feature→render *generator* for confidentiality-safe
OIP eval corpora (`map-corpus.md` §7.4, `map-pipeline-docs.md` §1.4). It is high strategic
value for Tom's practice, but it is a generation lens rather than a benchmark-integration
lens, and it is already well covered by the corpus-anatomy report. It should graduate as its
own packet, cross-linked to O3 (a generator without an eval harness produces unfalsifiable
corpora).

---

## 7. Traps

1. **Mounting the rubrics.** The `docs_dir` seam is powerful and one directory level of
   carelessness exposes all 250 `task.json` inside `/workspace/documents`. Assert the mount
   contents in the task-set generator; make it a test.
2. **Comparing to Harvey's published baselines.** Their numbers were possibly produced with an
   internal harness (`map-pipeline-docs.md` §7, UNVERIFIED) and `results/` is gitignored, so
   no artefacts ship. Always re-run our own baseline arm.
3. **Believing `metrics.json`'s `finished_cleanly`.** It is always `true` — a dict-spread
   clobber (`harness/run.py:365-377` + `harness/tools.py:667`, `map-harness.md` Defect 1).
   Filter truncated runs on the console output or patch it, or the sample silently includes
   context-overflowed runs.
4. **Stateful adapters.** OpenAI and Google adapters ignore the loop's `messages` and hold
   their own state (`map-harness.md` §7), so there is no deterministic replay for two of six
   providers. Pick Anthropic or Fireworks/Baseten for anything requiring replay.
5. **Rubric/corpus desync.** `map-pipeline-docs.md` §7 flags that firm-knowledge shipped with
   no cross-reference test and three prior commits fixed exactly that bug class for other
   task sets; `map-corpus.md` §4 found one likely instance (task 092 C-003 requires "executed
   versions" of a document that exists only as spreadsheet rows). Before trusting a per-task
   failure, check the 397 cited filenames resolve. Our index makes this a one-query check —
   which is itself a small contribution worth upstreaming.
6. **Scope creep into `hybrid-retrieval-fusion-core`.** That packet is not started. Run 1
   must not depend on RRF fusion, vector projection, or a local encoder. BM25 + structure only.
7. **Confidentiality.** C&H is synthetic and MIT — it is safe for cloud LLMs. The OIP corpus
   is not, and the two must never share a build root, a bundle, or an index directory. Keep
   the C&H work entirely under `~/YeeBois/research/` and the repo's `scratchpad/`.

---

## 8. UNVERIFIED

- **Extraction throughput** for 9,288 files / 515 MB through `beep corpus extract` — no
  measurement exists on this machine for this corpus. All wall-clock estimates in §4 are
  assumptions.
- **SQLite FTS5 availability** in `python:3.12-slim`. The plan deliberately does not depend on
  it (the BM25 SQL at `PracticeKg.fts.ts:142-170` uses plain aggregate tables), but the
  fallback path has not been exercised.
- **Whether `@beep/pandoc-ast` preserves tracked changes.** No `w:ins`/`track`/`redline`
  token found by `rg` in the package; not read line by line.
- **Whether `PracticeKgToolResult.truncated` is honestly set end-to-end.** The field exists in
  the schema; `goals/practice-kg-mcp` P7 B-6 lists truncation signaling as pending hardening.
  Behaviour not exercised by this agent.
- **`FileProcessingCoverageSummary` byFormat coverage over C&H's format mix** — inferred from
  the `FileFormatFamily` LiteralKit, not run.
- **Judge cost estimate** in §4 assumes ~3k-token agent outputs. No LAB run was executed
  (no podman invocation, no API keys), so every runtime figure here is read from source.
- **Whether Harvey's baselines used this public harness** (`map-pipeline-docs.md` §7).
- Everything in §1 attributed to a map report is inherited, not re-verified, except the
  five items this agent re-read directly: `harness/run.py:50-66,239`,
  `sandbox/sandbox.py:149,153,342-370`, `sandbox/Dockerfile` (full), and the corpus size
  (`du -sh tasks/firm-knowledge/dms` → 515M).
