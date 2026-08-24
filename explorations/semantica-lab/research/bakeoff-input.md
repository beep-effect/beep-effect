# Input stack bake-off

*Candidate screen (B1): this file is slate + probe order, not a family verdict. Current law: `../DECISIONS.md` "Current law" table. The canary is C0-C2 (G1), not the winner line below.*

**Status:** criteria-scored research pass, 2026-08-24. The current W1 directory has 76 PDFs, not the contracted 443, and this packet has no F1 malformed fixtures or `gold/v1` G-structure labels [P2, M3]. Task-quality ranges therefore describe capability potential, not measured G-structure accuracy. `UNKNOWN` is intentional evidence, not a neutral score.

## Gate table

`PASS*` means the stated adapter restriction is part of the pass. A candidate with `FAIL` is parked. Candidates with only `UNKNOWN` remain provisional until the named workload probe closes the evidence gap [P1].

| Candidate | G1 envelope | G2 license | G3 sustainable | G4 typed degradation | G5 budgets | G6 hostile input | G7 deterministic | G8 semantic floor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `@beep/file-processing` | PASS: Bun-sidecar TS [L1] | PASS: MIT [L10] | PASS: repo-vendorable [L1] | PASS: typed per-source status/errors [L1] | UNKNOWN: no W1 run [M3] | UNKNOWN: source size is modeled; an enforced input cap was not found [L1] | PASS: SHA-256 artifact/operation ids and pinned text identity [L1,L2] | PASS*, ingest only: absolute UTF-16 pages; `ExtractionResult` itself has no spans [L1,L2] |
| `@beep/md` | PASS: Bun-sidecar model [L3] | PASS: MIT [L10] | PASS: repo-vendorable [L3] | PASS: no parser or fallback exists [L3] | UNKNOWN: no input-stage runtime to measure [L3] | PASS: model has no input I/O [L3] | PASS: pure schema/render model [L3] | FAIL: explicitly not a parser; AST nodes have no source positions [L3] |
| `@beep/html` | PASS: Bun-sidecar model [L4] | PASS: MIT [L10] | PASS: generated, repo-vendorable model [L4] | PASS: validation reports issues rather than repairing [L4] | UNKNOWN: no input-stage runtime to measure [L4] | PASS: model has no parser I/O; safe output is deny-by-default [L4] | PASS: pinned generated model [L4] | FAIL: explicitly requires an external parser; document nodes have no source positions [L4] |
| `@beep/tika` | PASS*: bundled `tika-app` JVM subprocess; bare `localhost:9998` is outside the envelope [L6,P1] | UNKNOWN: wrapper is MIT; exact JAR/JRE distribution matrix is unchosen [L10] | UNKNOWN: JAR, JRE, hashes, and update plan are unpinned [L6] | PASS: transport, status, decode, timeout, and budget failures are typed [L6] | UNKNOWN: no bundled-JVM W1 footprint/RSS run [M3] | FAIL: app lane buffers all stdout; server lane is unbounded when no cap is configured [L6] | UNKNOWN: app result omits engine version; bundle is unpinned [L6] | FAIL: extracted text is trimmed and returned without a span map [L1,L6] |
| `@beep/pandoc-ast` | PASS: Bun-sidecar model [L5] | PASS: MIT [L10] | PASS: repo-vendorable [L5] | PASS: strict failures or lossless raw wire with issues [L5] | UNKNOWN: no Pandoc process driver exists [L5] | UNKNOWN: outer JSON/input bound is not supplied [L5] | PASS: pure, pinned Pandoc JSON model [L5] | FAIL: reports JSON pointers, not source-text positions; it does not parse files [L5] |
| `@beep/nlp` | PASS: Bun-sidecar model [L7] | PASS: Apache-2.0 [L10] | PASS: repo-vendorable [L7] | PASS: pure schemas cannot fabricate backend output [L7] | UNKNOWN: no W1 split run [M3] | UNKNOWN: caller text cap is not part of the model [L7] | PASS: pure source-aligned value model [L7] | PASS: half-open source spans and provenance-bearing chunks [L7] |
| `@beep/nlp-processing` | PASS: Bun-sidecar service [L8] | PASS: Apache-2.0; Wink driver MIT [L10] | PASS: repo-vendorable [L8] | PASS: tagged `TokenizationError` [L8] | UNKNOWN: focused test passed, but W1 RSS/time is unmeasured [M2,M3] | UNKNOWN: no service-level input ceiling [L8] | PASS*: caller must provide a content-addressed id; Wink's omitted-id path uses wall time [L8] | PASS*: use `Tokenization`, which returns offset-bearing models; generic `NLPBackend` returns strings and loses offsets [L8] |
| `@beep/langextract` | PASS: Bun-sidecar service [L9] | PASS: Apache-2.0 [L10] | PASS: repo-vendorable with hostile-text tests [L9] | PASS: unmatched/ambiguous states are explicit [L9] | UNKNOWN: 24-test focused run passed; W1 remains unmeasured [M2,M3] | PASS: bounded hostile normalization cases are tested [L9] | PASS: deterministic exact/normalized mapping [L9] | PASS: normalized locator code units map back to exact raw UTF-16 ranges [L9] |
| PDF.js | PASS: in-process JS [P4,W1] | PASS: Apache-2.0 [P4] | PASS: buildable source and maintained API [P4,W1] | PASS*: set `stopAtErrors: true` and type recovery/warnings [W1] | UNKNOWN: package is absent; no W1 measurement [M3] | UNKNOWN: wrapper must accept local `data` only, cap bytes/images, and disable fetch inputs [W1] | UNKNOWN: pin/replay proof not run [M3] | PASS*: span the named extracted-text canonicalization and record whitespace replacement as lossy [W1,P3] |
| MuPDF-class CLI | PASS: bundle-and-spawn `mutool` [W5] | PASS*: AGPL subprocess only; ship license and exact Corresponding Source/build offer, or buy a commercial license; no linked WASM/JS [W6,P1] | PASS: tagged downloads plus commercial plan [W6] | UNKNOWN: exit/warning-to-tag adapter is not built [W5] | UNKNOWN: `mutool` is absent; no footprint/RSS run [M3] | UNKNOWN: sandbox, byte/output caps, and timeout are not built [M3] | UNKNOWN: binary pin/replay proof not run [M3] | PASS*: structured JSON text/geometry can map to a named canonical stream; fidelity is unmeasured [W5,P3] |
| Docling sidecar | PASS: bundle-and-spawn Python process [W8] | PASS*: MIT code; pin the separately licensed CDLA/Apache model repository [P4,W9] | PASS: current CLI/slim packaging is buildable [W8] | UNKNOWN: partial/failure result mapping was not source-audited | FAIL: standard lane is estimated at 2.8 GB, above the 250 MB dependency ceiling [W8,P2] | UNKNOWN: local-stream-only wrapper and resource supervisor are not built | UNKNOWN: exact model revisions and repeat proof are absent [W9] | PASS: document items carry page, bounding box, and character span [W7] |
| unified/remark/rehype | PASS: Bun probe for Remark; Rehype is ESM/Node [M1,W3] | PASS: MIT [P4,W2,W3] | PASS: locked current Remark/Unified versions and maintained Node line [M1,W2] | PASS*: enable Rehype parse diagnostics and type recovered/generated nodes [W3] | UNKNOWN: Remark probe passed; Rehype and W1 are unmeasured [M1,M3] | UNKNOWN: local parser has no network I/O, but the outer input cap is not built [W2,W3] | PASS: lockfile-pinned pure parse [M1] | PASS: unist uses half-open UTF-16 offsets and withholds positions from generated nodes [W4] |

The Tika bundled-JVM option is envelope-valid only when the application owns the JRE/JAR lifecycle and subprocess. It does not rescue the current candidate: `TikaAppEngine` collects unbounded stdout, `TikaContentText` trims, and the shared extraction result has no span field [L1,L6].

## Scores

Only candidates without a failed gate are scored. Totals are ranges out of 100. They are not a cross-format league table: PDF parsers compete on PDF; Unified competes on HTML and Markdown; Beep bricks compete at their actual stage [P1].

| Candidate / role | Task quality /40 | Operational fit /25 | Integration + migration /20 | Sustainability /15 | Total /100 |
| --- | --- | --- | --- | --- | --- |
| `@beep/file-processing`, ingest | 20-25: all three media can receive content ids/text identity, but parser spans and G-structure are UNKNOWN [L1,L2,M3] | 20-24: in-process with no new runtime; W1 RSS/time UNKNOWN [L1,M3] | 18-20: existing Effect schemas/errors; add `SourceDocument` adapter and enforced cap [L1,P3] | 10-13: owned/tested source; release/bus-factor evidence UNKNOWN [L10] | 68-82 |
| `@beep/nlp`, split IR | 20-27: source-aligned token/chunk schema covers canonical text; split engine and G/F1 accuracy UNKNOWN [L7,M3] | 21-24: schema-only incremental cost; W1 UNKNOWN [L7,M3] | 18-20: near-direct match to shared spans/provenance [L7,P3] | 10-13: owned source/tests; independent maintenance evidence UNKNOWN [L10] | 69-84 |
| `@beep/nlp-processing` + Wink, split | 25-33: 2/2 offset-tokenization tests pass; generic backend loses offsets and G/F1 accuracy is UNKNOWN [L8,M2,M3] | 19-23: focused run 2.25 s; local Wink dependencies total about 5.6 MiB; W1 RSS UNKNOWN [M2,M3] | 17-19: typed Effect service; restrict adapter to `Tokenization` and supply stable ids [L8] | 10-13: owned source/tests; external Wink issue response UNKNOWN [L10] | 71-88 |
| `@beep/langextract`, normalize/map | 24-33: 24/24 hostile span tests pass; it maps locator normalization, not a whole-document canonicalizer; G/F1 UNKNOWN [L9,M2,M3] | 19-23: focused run 3.00 s; W1 RSS/time UNKNOWN [M2,M3] | 17-19: existing Effect spans/errors; needs a general monotone source-map service [L9,P3] | 11-13: substantial adversarial tests; independent release evidence UNKNOWN [L9,L10] | 71-88 |
| PDF.js, PDF parse | 22-34: text items, geometry, optional tag tree, and explicit whitespace loss; G-structure/text accuracy UNKNOWN [W1,M3] | 14-21: in-process worker path, but package bytes/cold/RSS/W1 are UNKNOWN [W1,M3] | 11-16: new Effect adapter plus canonical-text/span-map builder [W1,P3] | 12-15: official maintained source/API; issue latency/bus factor UNKNOWN [P4,W1] | 59-86 |
| MuPDF CLI, PDF parse runner-up | 23-34: structured text JSON potential; section accuracy and span fidelity are UNKNOWN [W5,M3] | 10-18: subprocess and binary footprint are UNKNOWN [M3] | 7-12: new supervisor, JSON adapter, distribution payload, and span builder [W5,W6] | 12-15: tagged releases and paid route; support latency UNKNOWN [W6] | 52-79 |
| unified/remark/rehype, MD + HTML parse | 30-38: two formats, native positions, CommonMark, configurable malformed-HTML diagnostics; PDF and G/F1 accuracy absent [W2,W3,W4,M3] | 21-24: Remark probe 0.06 s/33,284 KiB; measured local core packages about 1.5 MiB; Rehype/W1 UNKNOWN [M1,M3] | 13-17: new Effect boundary and unist-to-shared adapter; keep unist positions instead of projecting early to Beep ASTs [L3,L4,W4] | 13-15: current typed ecosystem and maintained Node compatibility; issue response UNKNOWN [W2,W3] | 77-94 |

## Verdict (historical screen; superseded by B1)

**STACK verdict (A3): per-stage `already-have` and `pick-one` decisions, not a family `bundle`.** A9 reserves the family-level `bundle` label for storage [P5].

| Format | Ingest | Parse | Normalize | Split |
| --- | --- | --- | --- | --- |
| Born-digital academic PDF | `@beep/file-processing` content identity | **PDF.js provisional winner**; MuPDF CLI runner-up | Build named canonical text from page items; emit a lossy whitespace event and raw-to-canonical map | Page/block boundaries first, then `Tokenization`/Wink sentence spans |
| HTML | `@beep/file-processing` content identity | **Unified + Rehype** with verbose positions and parse diagnostics | Identity by default; retain HAST positions; tag generated/repaired nodes as lossy | DOM/heading blocks first, then `Tokenization`/Wink |
| Markdown | `@beep/file-processing` content identity | **Unified + Remark** with mdast positions | Identity by default; retain mdast positions | heading/list/code blocks first, then `Tokenization`/Wink |
| Malformed specimens | Reject over-cap or undecodable bytes with typed error | Parser recovery must emit warnings; fatal policy is format-specific | Every repair maps spans or emits a typed lossy segment | Never emit a chunk outside a verified canonical span |

| Stage decision | Verdict | Runner-up / constraint |
| --- | --- | --- |
| Ingest | **pick-one/adapt:** map `@beep/file-processing` to `SourceDocument`; enforce byte ceiling before parse | No eligible alternative adds value at this stage |
| Parse, HTML + Markdown | **pick-one:** Unified with Rehype/Remark | No eligible runner-up: `@beep/html` and `@beep/md` are destination models, not positioned parsers |
| Parse, PDF | **pick-one, provisional:** PDF.js | MuPDF CLI; carry both into the same G-structure, malformed, RSS, cold-start probe |
| Normalize | **pick-one/adapt:** reuse `@beep/langextract`'s raw-offset mapping kernel behind a new general source-map service | Identity-only mapping in `@beep/nlp` cannot represent arbitrary normalization |
| Split | **already-have:** `@beep/nlp-processing` `Tokenization` + Wink, producing `@beep/nlp` spans | Never route through generic `NLPBackend.sentencize/tokenize`, which returns strings |

Explicit gaps: no current brick represents a complete monotone raw-to-canonical map; PDF section-tree accuracy is unmeasured; Rehype is not installed; F1 and G-structure are absent [M3]. Keep unist positions alongside any `@beep/md`/`@beep/html` projection until those models gain position sidecars or fields [L3,L4,W4].

**Sensitivity:** ingest, HTML/Markdown parse, normalize-kernel, and split choices survive ±5-point bucket-weight shifts because their alternatives either fail G8 or do not implement the stage. The PDF winner does **not** survive: PDF.js and MuPDF ranges overlap, and extra task-quality weight can flip the order. Rubric §2 therefore makes PDF.js/MuPDF a tie pending one shared first-25/G-structure plus malformed-resource probe [P1]. Docling cannot enter that tie while G5 fails.

## Park list

- `@beep/md`: park as an input parser; retain as a post-parse Markdown model/render target. It has no parser or source positions [L3].
- `@beep/html`: park as an input parser; retain as a conformance/safe-output target. It requires an external parser and has no source positions [L4].
- `@beep/tika`: park until output is bounded in both lanes and every normalization/extraction emits a span map; bundling a JVM alone fixes only G1 [L6].
- `@beep/pandoc-ast`: park for this input scope; retain for Pandoc JSON interoperability. JSON pointers do not satisfy source-span law [L5,P3].
- Docling: park the standard local sidecar on G5. Re-entry requires a pinned slim closure below 250 MB, pinned model licenses/hashes, and the same G-structure/resource probe [W8,W9,P2].

## Parked-SOTA appendix

Informal PDF comparison keeps the quality envelope visible; Docling is not eligible for the verdict.

| PDF candidate | Task /40 | Ops /25 | Integration /20 | Sustainability /15 | Total | State |
| --- | --- | --- | --- | --- | --- | --- |
| PDF.js | 22-34 [W1,M3] | 14-21 [M3] | 11-16 [P3,W1] | 12-15 [P4,W1] | 59-86 | Provisional envelope winner |
| Docling standard | 31-39: rich hierarchy plus page/bbox/charspan; G accuracy UNKNOWN [W7,M3] | 2-8: estimated 2.8 GB standard install [W8] | 6-11: Python supervisor/model mapping unbuilt [W7,W8] | 12-15: current MIT project; issue response UNKNOWN [P4,W8] | 51-73 | Parked, G5 fail |

Docling may beat PDF.js on untagged academic-PDF structure. That hypothesis remains honest but unproven. Its current model repository is 358 MB and permissively tagged, while the standard local runtime is estimated at 2.8 GB [W8,W9]. A remote-model lane would also fail the local/offline envelope [P1,P2].

## Sources appendix

### Packet law

- **[P1]** `criteria-rubric.md:20-68,95-104,132-140`, gates, weights, input sheet, sensitivity, deliverable process.
- **[P2]** `workload-contract.md:6-16,19-29,31-63`, corpus, gold, targets, budgets, offline loop.
- **[P3]** `shared-schema.md:3-16,29-32,42-50`, source identity, canonical spans, provenance, semantic floor.
- **[P4]** `docs-url-census.md:47-53`, fetch-verified Docling, Unified/Remark, and PDF.js docs/repos/licenses. Census-sourced claims cite this file, not an unopened census URL.
- **[P5]** `../DECISIONS.md:47-65,142-169`, quality over incumbency, envelope, A3 stack, A7-A9.

### Live local source

- **[L1]** `packages/foundation/capability/file-processing/src/Artifact/Artifact.schema.ts:63-190,282-333`; `SourceText/SourceText.schema.ts:119-170,223-247`; `Extraction/Extraction.schema.ts:16-24,115-122,168-183`.
- **[L2]** `packages/foundation/modeling/provenance/src/SourceTextIdentity.ts:59-86,88-150`.
- **[L3]** `packages/foundation/modeling/md/README.md:23-38`; `src/Md.model.ts:374-384,1525-1539,2946-2959`.
- **[L4]** `packages/foundation/modeling/html/README.md:3-10,112-131,168-175`; `src/Html.model.ts:188-224`.
- **[L5]** `packages/foundation/modeling/pandoc-ast/README.md:3-27,49-57,109-119`; `src/Pandoc.report.ts:127-168`.
- **[L6]** `packages/drivers/tika/src/Tika.config.ts:101-120,170-212`; `Tika.server.ts:45-110,182-245`; `Tika.tikaapp.ts:44-68,89-164,178-205`; `Tika.response.ts:27-47,142-159`.
- **[L7]** `packages/foundation/modeling/nlp/src/Core/Token.ts:97-175,177-243`; `Core/Document.ts:174-212,241-271`; `Handoff/Contract.ts:213-262,298-362`.
- **[L8]** `packages/foundation/capability/nlp-processing/src/Core/Tokenization.ts:17-67`; `Backend/NLPBackend.ts:335-355`; `packages/drivers/wink/src/WinkTokenization.service.ts:145-190,193-280,300-351`.
- **[L9]** `packages/foundation/capability/langextract/src/VerifiedSpan/VerifiedSpan.model.ts:115-224`; `VerifiedSpan/VerifiedSpan.behavior.ts:45-105`; `test/VerifiedSpanSpike.test.ts:27-180,210-335`.
- **[L10]** Candidate `package.json:1-5` manifests for file-processing, md, html, tika, pandoc-ast, nlp, nlp-processing, langextract, and wink.

### Local measurements

- **[M1]** 2026-08-24 Bun probe, `unified@11.0.5` + `remark-parse@11.0.0`: Unicode-valid and malformed samples both emitted bounded UTF-16 positions; cold process 0.06 s, peak RSS 33,284 KiB. Measured installed core directories total about 1.5 MiB; `rehype-parse` is absent.
- **[M2]** Focused Vitest with `--pool=threads --maxWorkers=1`: LangExtract hostile-span 24/24 in 3.00 s; Wink tokenization 2/2 in 2.25 s. Local Wink directories total about 5.6 MiB.
- **[M3]** 2026-08-24 inventory: W1 path contains 76 PDFs; no packet F1/gold files; PDF.js, `mutool`, Docling, Tika JAR, and Rehype are absent. No candidate received a W1/G-structure score.

### Opened web sources

- **[W1]** [PDF.js current API source](https://mozilla.github.io/pdf.js/api/draft/api.js.html), local-data input, recovery switch, image cap, normalized whitespace, text items, and optional structure tree.
- **[W2]** [Remark Parse README](https://github.com/remarkjs/remark/blob/main/packages/remark-parse/readme.md), CommonMark parser, ESM/Node compatibility, types.
- **[W3]** [Rehype Parse package](https://github.com/rehypejs/rehype/tree/main/packages/rehype-parse), positioned HTML parse, configurable parse diagnostics, generated document elements, MIT.
- **[W4]** [unist specification](https://github.com/syntax-tree/unist), half-open UTF-16 offsets and positionless generated nodes.
- **[W5]** [MuPDF `mutool draw` 1.27](https://mupdf.readthedocs.io/en/1.27.0/tools/mutool-draw.html), PDF input and structured text JSON/XML output.
- **[W6]** [MuPDF releases and licensing](https://mupdf.com/releases), AGPL distribution and commercial-license route.
- **[W7]** [Docling document reference](https://docling-project.github.io/docling/reference/docling_document/), `ProvenanceItem` page, bounding box, and character span.
- **[W8]** [Docling Slim plan and size matrix](https://github.com/docling-project/docling/blob/main/.plans/active/docling-slim.md), estimated 200 MB parser, 2.5 GB local models, 2.8 GB standard install; corroborated by the opened [Docling Slim README](https://github.com/docling-project/docling/blob/main/packages/docling-slim/README.md).
- **[W9]** [Docling model repository](https://huggingface.co/docling-project/docling-models/tree/main), 358 MB and CDLA-Permissive-2.0/Apache-2.0 tags.
