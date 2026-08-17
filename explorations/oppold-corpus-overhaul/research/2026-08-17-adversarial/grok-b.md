I'll read the overhaul packet, the predecessor spec, and the cited driver surfaces so the review can attack claims against live code rather than the vision's own wording.Next I’ll check the cited drivers and predecessor packets against the “bricks already live” table so overstated composition claims can be pinned to actual exports.The packet’s brick table is next to the actual package surfaces — I’ll read those exports and the predecessor pipeline so I can separate a live driver from a missing orchestration layer.The monorepo index should have the driver services; I’ll pull those plus the predecessor pipeline and semantic-foundation so composition claims can be checked against what actually ships.Driver surfaces already contradict the brick table on `.doc` conversion and PST-only export. I’m checking Tika’s live extract path, attachment repair, and the predecessor pipeline next.Composition targets and the predecessor pipeline are the next check — I’ll read those packets and the attachment/format edges the vision treats as already solved.The predecessor already shipped recycle-bin pairing and a full extract run — I’m checking whether the new salvage’s directory `$R`s, attachment suffixes, and T-Box targets actually fit those existing contracts.The composition table is the first place this fails: several listed bricks extract or classify, and none of them restore names, repair attachments, or convert Word.

## 1. Nine capture bullets — unbounded / underspecified

**BLOCKING — Bullets 2, 7, 8, 9 have no stop condition.**
`CAPTURE.md:19–21`, `:40–45`.

| # | Text | Why it cannot close |
| --- | --- | --- |
| 2 | “Pipeline re-evaluation from scratch — make sure everything is exhaustively covered.” | “Everything” + “exhaustively” is an open-ended audit, not a deliverable. No format census, no out-of-scope list, no acceptance bar. |
| 7 | “Full capability incorporation — langextract, nlp, file-processing, metadata/exif provenance **and more**.” | “And more” is a blank check. The named packages are four different runtime shapes (LLM capability, MCP server, file engines, image-tag driver), not a pipeline stage. |
| 8 | “Pipeline self-improvement — evaluate improvements … at every step.” | No metric, no eval set, no “good enough” bar. A process that never exits. |
| 9 | “Enrichment — evaluate **every avenue**.” | USPTO is one avenue and already ran (99 IDs). “Every” includes PACER, Box, web, LLMs, CAD, … with no budget. |

The only open question in `ops/manifest.json:8–10` is salvage restoration. Eight of nine bullets have no align question. The census in `research/2026-08-17-restoration-census.md` already answered that one question (counts, orphan `$R`, 53 PSTs / 112.1 GB, 564 `.doc`). Capture is still pretending the inventory is the blocker.

**BLOCKING — Bullet 5 (“dedupe and prune”) has no relevance predicate and fights bullet 4.**
`CAPTURE.md:31–32` vs `:27–30`. “Prune non-relevant” with no definition of relevant. Recycle-bin content is *user-deleted*. Under any naive relevance rule it is the first thing pruned, which voids “restoration with no data loss.” June organize already left **3,055 / 7,330** artifacts in `_unsorted` (`goals/oppold-corpus-pipeline/history/outputs/2026-06-11-p3-organize-report.md:21`). “Prune” on that residue is a deletion policy the vision refuses to name.

**MAJOR — Bullet 3 (“ideal T-Box for ingestion”) names the wrong objects.**
Ratified: do not re-found; compose with M1 / patent-document-schema / FOLIO. That decision stands. What the vision then claims is still false: none of those three is an ingestion T-Box that improves A-Box quality.

- `goals/semantic-foundation/SPEC.md:99` — M1 is a SKOS seed + six document classes (`draft` / `redline` / `filed` / `received` / `privileged` / `extracted-child`) + filing-path projection. M2–M4 (IPC/CPC, docketing/party roles, ClaimGate SHACL) are **gated**.
- `goals/patent-document-schema` is **P0 research**, first slice is one Markdown patent application (`SPEC.md:54–57`). Most of this corpus is `.pst` / `.doc` / `.pdf`, not Md.
- `goals/folio-lynx-taxonomy-browse` is **P0**, blocked on Lynx license (`README.md:22–23`).

Composing with those packets does not produce a T-Box you can point at 112 GB of mail. It produces a filing vocabulary, an unfinished patent-section schema, and an unlicensed taxonomy browse tool.

**MAJOR — Bullet 4 “no data loss” is undefined.**
No bar for: 1 orphan `$R` (census line 11), unmatched `$I`, corrupt `$I`, passworded/damaged PSTs, bit-rot on the T7, or the 285 June extract failures (`2026-06-11-p2-extraction-report.md:54–59`). “No loss” with an orphan already in the inventory is a slogan.

**MAJOR — Bullet 6 “all `.pst` files and descendant extensions.”**
“Descendant extensions” is not a type. `FileFormatFamily` is `pst` only — no `ost` / `msg` / `eml` (`packages/foundation/capability/file-processing/src/Strategy/Strategy.schema.ts:104–118`, `fromExtension` at `:132`). June’s own scan searched `.ost`/`.msg`/`.eml` (`goals/oppold-corpus-pipeline/research/corpus-scan-inventory.md:6–7`). The brick cannot see them.

**MAJOR — Bullet 1 does not specify the salvage *operation*.**
The T7 is removable (`README.md:21–26`, `DECISIONS.md:8–9`). Data-loss proof is copy-off-drive + digest verify, not `$I`/`$R` pairing. The packet conflates “restoration inventory” with “the drive can walk away.” Census already shows mail (112.1 GB) is the bulk, not recycle (6.4 + 48 + 11 GB). The first action is a byte copy. The first question is not.

**MINOR — Bullet 6 “converted/restored to `.docx`.”**
Honesty bar is ratified (`DECISIONS.md:16–19`). Still unspecified: converter (no LibreOffice/soffice driver exists in `packages/`), fidelity metric, who reviews 564 diffs, whether originals stay forever (they must, or “prune” deletes the provenance).

---

## 2. Composition claim — bricks overstated

The table at `CAPTURE.md:47–61` is labeled “already live.” Net-new is listed as restore/repair/convert + T-Box wiring + self-eval + enrichment survey. That understates the gaps and overstates the drivers.

### `packages/drivers/libpff` — PST export, not “proper mail handling”

**BLOCKING**

- Descriptor `supportedFormats: ["pst"]` only (`Libpff.service.ts:49–54`).
- Corpus extract constructs `PffexportEngineConfig` with `exportRoot` only (`ServicePrograms.ts:1063–1067`). Defaults: `exportMode: "items"`, `existingExportPolicy: "fail"` (`Libpff.pffexport.ts:215–224`). Recovered/deleted items (`-m all` / `.orphans` / `.recovered`) are **not** run. June already recorded this deferral (`2026-06-11-p2-extraction-report.md:74–76`). A “no-loss” overhaul that restores recycle-bin files and skips recovered mail inside 53 PSTs is incoherent.
- Attachments are walked and re-emitted. Filename = `posixBasename` (`Libpff.pffexport.ts:703–706`). EML `Content-Type` is hard-coded `application/octet-stream` (`Libpff.eml.ts:456–461`). **No type repair, no MIME sniff, no `.p`/`.d` → real type.** The driver *produces* the residue the vision then calls a net-new repair problem. Census: only 10 bare `.p`/`.d` on disk now; “most residue appears only after libpff extraction” (`2026-08-17-restoration-census.md:26`). Re-running the “live brick” *creates* the estate.
- Re-run of the same PST fails by default (`existingExportPolicy: "fail"`). No incremental/resume story.

### `packages/drivers/doc-text` — not “doc/docx text”

**BLOCKING**

README: unpdf + mammoth; **PDF text-layer and DOCX only**; no `.doc` (`README.md:5–12`). Descriptor `supportedFormats: ["pdf-text-layer", "docx"]` (`DocText.service.ts:65–70`). The table’s first cell is false for `.doc`. This package also does not convert.

### `packages/drivers/tika` — extract text, refuse conversion, refuse several June-success formats

**BLOCKING**

- Tika extracts text/metadata. It does not emit `.docx`. File-processing V1 lists **“bidirectional document conversion” out of scope** (`goals/file-processing-capability/README.md:155–162`). There is no LibreOffice driver in `packages/`.
- Tika Server V1 **refuses** `docm` / `xls` / `xlsx` (`Tika.server.ts:46–47`, `:260–266`; `README.md:38–39`). June’s extract reported those as successes via tika-app (`2026-06-11-p2-extraction-report.md:36–42`, `:77`). “Reuse the brick” is a silent regression on spreadsheets unless the vision pins tika-app and keeps the June exception.
- Scaffold still **defers** `doc`/`docx`/`rtf`/`pdf-text-layer` (`Tika.service.ts:61`). Citing `@beep/tika` without naming Server vs App vs scaffold is how you get a pass-through engine in a 112 GB run.

### `packages/drivers/exiftool` — image XMP, not corpus provenance

**MAJOR**

README: “image metadata and XMP provenance” (`README.md:1–3`). Writable extensions: `png|jpg|jpeg|gif|webp` only (`Exiftool.models.ts:263`). June already wrote Tika metadata JSON per artifact. This is not a provenance substrate for `.pst` / `.doc` / mail children.

### `packages/foundation/capability/langextract` — not a corpus stage

**MAJOR**

Consumes an injected `LanguageModel` (`README.md:13–16`). Remote send is gated by `BEEP_LANGEXTRACT_ALLOW_REMOTE`, default **false** (`Service.policy.ts:76–79`). Current proof is office-action extraction in `@beep/law-practice-use-cases`. No batch over 6k texts + ~10⁶ mail bodies, no privilege filter, no cost cap. “Incorporate” = either a no-op (policy default) or an unbounded hosted-LLM bill over privileged mail.

### `packages/drivers/nlp-mcp` + `wink` — agent tools, not pipeline

**MAJOR**

`nlp-mcp` is a stdio MCP server (~42 tools); handlers record counts/path lengths, “never raw file content” (`README.md:5–14`). `wink` is tokenize / BM25 / similarity. Neither is a `beep corpus` stage. Wiring them “into the pipeline” is an unwritten orchestrator.

### Recycle-bin pairing is **not** net-new — and still misses this salvage

**BLOCKING**

`CAPTURE.md:59–61` lists recycle-bin re-pairing as net-new. The brick already exists: `Corpus.recyclebin.ts` + `buildRestorationRecords` in `ServicePrograms.ts:480–550`. June applied **242** restored names (`2026-06-11-p3-organize-report.md:23–24`).

What is actually new: **directory `$R`s**. Census: 55 `$R` = 35 files + **20 directories**, 1 orphan (`2026-08-17-restoration-census.md:11–18`). Existing classifier is filename-only (`classifyRecycleBinName` on basename, `Corpus.recyclebin.ts:137–171`). Salvage walk is **files only** (`ServicePrograms.ts:1431–1433`). A `$R` directory never becomes a catalog row; its inner files already have names; the folder `$I` becomes unmatched metadata. The census’s restore plan is not what the live brick does.

### Predecessor pipeline is mis-cited

**MAJOR**

Table cites `oppold-corpus-refresh` as “prior salvage/dedupe.” Refresh **explicitly stopped** before extract/organize/enrich (`goals/oppold-corpus-refresh/SPEC.md:11–13`). The June packet `oppold-corpus-pipeline` already claimed **complete** salvage + catalog + extract (663,272 PST children) + organize + USPTO enrich (`README.md:39–46`). The overhaul writes as if extraction/organization/enrichment were never built. That hides known debt: end-of-run manifests, `-m items` only, 3,055 unsorted, 285 failures.

### “File classification = completed file-processing-capability”

**MAJOR**

That packet is detection/extract/export IR. V1 out of scope: conversion, OCR, KG extraction, legal entity resolution, production storage (`README.md:155–162`). It is not a relevance classifier and not a T-Box.

---

## 3. Ordering hazards

**BLOCKING — Copy-off-T7 vs everything else.**
If any of bullets 2–9 run before a verified copy of the removable drive, a kicked cable loses the source. Restoration pairing is not the urgent bar; `sha256` copy is. The packet’s first question gets this backwards (`README.md:20–26`).

**BLOCKING — Hash-dedupe before restoration vs after.**
Refresh policy: digest already in catalog → provenance-only, no second copy (`goals/oppold-corpus-refresh/SPEC.md:86–88`). This salvage contains (a) live `$RECYCLE.BIN` (6.4 GB, mostly unnamed `$R`) and (b) pre-extracted `f-recyclebin-C` / `f-recyclebin-E` (59 GB, **already name-recovered**) (`census.md:11–13`). Dedupe-first collapses `$R` bytes onto the named copy and never copies the `$R`. Restoration then has nothing to rename, or it “restores” a provenance-only pointer. Restore-first, then digest-union. The vision lists both operations and does not order them.

**BLOCKING — Dedupe/prune vs `.doc` → `.docx`.**
Conversion changes bytes → new digest. Dedupe-after-convert will treat original and conversion as unrelated unless a conversion-provenance edge is mandatory (honesty bar says retain original + record loss; it does not say “do this *before* prune”). Prune-before-convert can delete the only `.doc` you were going to convert. Convert-before-dedupe doubles 564 files and then invites prune to drop one side.

**MAJOR — T-Box before vs after extract.**
“T-Box used **during** ingestion so A-Box quality is best” (`CAPTURE.md:22–25`). Before extract you have paths, extensions, maybe Exif — M1 document-class is a guess. After extract it is a classifier, not an ingestion T-Box. Mail bodies do not exist until pffexport. CAD/unknown formats never get text (no OCR, no DWG brick). If you wait for folio-lynx + patent-document-schema (both P0), the T7 sits. If you don’t wait, the “ideal T-Box” claim is false on the run date.

**MAJOR — Extract children, then repair types, then extract again.**
`.p`/`.d` appear **after** libpff (`census.md:26`). Tika `fromExtension` maps unknown suffixes to `"unknown"` (`Strategy.schema.ts:139`). First extract: attachments skipped. Repair: rename. Second extract: now they’re `.doc`/`.pdf`. No second pass is specified. A single `beep corpus extract` (`ServicePrograms.ts:1034+`) will not see repaired types.

**MAJOR — Prune before T-Box / extract.**
Without extract+classify, “non-relevant” is a human guess over 112 GB of mail and user-deleted recycle trees. Prune-first is irreversible under the refresh archive-move precedent (refresh *moved* origins after salvage).

**MAJOR — `existingExportPolicy: "fail"` + no incremental extract.**
`sources.jsonl` / `failures.jsonl` / `run.json` are written **after** the entire `Effect.forEach` (`ServicePrograms.ts:1278–1328`). June already filed this as crash-loses-the-run (`history/reflections/2026-06-11-claude.md:16–19`). Still unfixed. 53 PSTs / 112.1 GB vs June’s 27 PSTs / ~26 GB + 75-minute run. A mid-PST crash leaves children on disk and no manifest. Re-run hits `fail` on existing `.export` trees.

**MINOR — `exportMode: "items"` then a later `-m all` pass.**
Second pass needs a different `exportRoot` or `replace`. Not specified. Deleted mail remains invisible to “no-loss.”

---

## 4. Missing entirely

**BLOCKING — Privilege / PII / secret scrub before hosted models.**
Quality-first / cloud-permitted is ratified; this is not a re-litigation. What is missing is the *gate*.

- M1 already has a `privileged` class (`semantic-foundation/SPEC.md:99`). Mail + recycle + attorney work product is the default contents of this drive.
- `legal-document-intake` D10 already split the problem: cloud LLM allowed, **bulk privileged text must not transit an embedding vendor** (`SPEC.md` D10). This packet does not even *list* intake as a composition target (`CAPTURE.md:22–25`, `README.md:42–44`).
- `goals/ingestion-secret-scrub/SPEC.md:21–23`: **“PII or OOXML expansion; both require their policy gates”** — out of scope for that packet, still P0. There is no PII packet this overhaul waits on.
- LangExtract default-deny remote (`Service.policy.ts:76–79`) is an env flag, not a privilege classifier.

“Fully incorporate langextract” without a privilege/PII/secret gate is how client mail hits a hosted model. Doctrine allows the cloud. It does not allow skipping the filter.

**BLOCKING — Incremental re-run / failure recovery.**
No checkpoint, no per-source JSONL append, no PST-level resume, no `existingExportPolicy: replace` decision, no disk-budget preflight. Known since 2026-06-11. Refresh also recorded a JSONL writer that exited 0 after corrupting record 1 (`goals/oppold-corpus-refresh/history/reflections/2026-07-03-claude.md:13–16`). The overhaul proposes a *larger* run on the same writers.

**BLOCKING — Cost / scale / disk model.**
Census numbers are in the packet and unused:

| Surface | Size / count | Implication the vision ignores |
| --- | --- | --- |
| PSTs | 53 / **112.1 GB** | June: 27 unique, ~26 GB, 663,272 children, 28 GB staging. Linear size ratio ≈ 4.3× → on the order of **2–3M children**, hundreds of GB staging. |
| Recycle (named + live) | 65+ GB | Plus overlap with live `$RECYCLE.BIN`. |
| `.doc` conversions | 564 | Original + converted + diffs. |
| LangExtract over mail | unbounded | No token/cost cap, no sample strategy. |
| pffexport timeout | optional / unset (`Libpff.pffexport.ts:231–236`) | A wedged multi-GB PST can run until the machine dies. |
| Tika | 120 s/file default (`Tika.tikaapp.ts:52–54`) | Fine for 7k files; not a plan for attachment-expanded millions. |

“Next expensive pipeline run” has no budget, no wall-clock, no disk floor, no “abort if staging > N.”

**MAJOR — CAD / non-V1 formats.**
Census itself cites 837 `.dwg`, 201 STEP, 175 `.ai`, 54 SolidWorks, 30 Rhino (`census.md:38–39`). `FileFormatFamily` has none of these → `unknown`. June already failed 285 unknowns. `goals/agentic-cad-patent-tooling` is a separate active packet; this vision does not compose with it and still claims exhaustive coverage. Either CAD is in (then the brick table is missing a whole family) or CAD is out (then bullet 2 is a lie).

**MAJOR — Union with the existing governed corpus.**
June + July already live under `<CORPUS_ROOT>`: 7,342 distinct digests after refresh, `organized/`, USPTO anchors, practice-kg v1 bundle. The overhaul never says: new `raw/<run>/` vs rewrite; whether v2 rebuilds the graph from a union catalog; what happens to 3,055 `_unsorted` and 242 restored names already applied. Refresh copied **12** new artifacts and provenance-only’d the rest. This salvage will collide hard with those digests.

**MAJOR — v2 acceptance bar.**
Ratified: this gates practice-kg **bundle v2**, not the live v1 front. v1 already failed **AC-2 (graph nodes carry no provenance)** and had family contamination (`goals/practice-kg-mcp/README.md:53–58`). The overhaul does not say v2 must fix AC-2, must not reintroduce cartesian joins, or what “best-quality KG” means in numbers. A bigger dirty graph still gates v2.

**MAJOR — Passworded / damaged / encrypted PSTs, OCR, scanned PDFs.**
doc-text: scanned PDFs without a text layer are out of scope (`README.md:6–7`). File-processing: OCR is a skip flag (`p5-implementation-notes.md:71–72`). libpff: no encrypted-PST path. “No data loss” + “exhaustive” with these silent skips is false.

**MINOR — “Reusable for other solo-practice attorneys.”**
`CAPTURE.md:9–11`. June organize used a **practice-local** `client-map.json` and docket-token heuristics (`2026-06-11-p3-organize-report.md:27–33`). No anonymization, no config-vs-code split, no second-practice fixture. A slogan, not a productization requirement.

**MINOR — “Self-improvement at every step” with no eval corpus.**
No gold set, no regression on the 242 restored names / 99 USPTO IDs / 105 docket families already produced. You cannot improve a pipeline you cannot score.

---

## 5. Internal contradictions (not ratified)

- **Restore deleted files (4) and prune non-relevant (5)** — recycle *is* user-deleted.
- **Re-evaluate from scratch (2) and “bricks already live” (table)** — you cannot do both without an explicit keep/replace list. The June pipeline already did extract/organize/enrich; this packet pretends only refresh exists.
- **Fidelity-verified conversion keeps originals (annotation on 6) and dedupe/prune (5)** — keeping both copies is the opposite of prune unless conversion pairs are a protected class. Unstated.
- **Ideal T-Box now (3) and compose with P0/gated packets** — the T-Box is not available on the run you are gating v2 on.
- **“Mail is the bulk” (census line 28) and first question = recycle inventory** — the packet’s own research contradicts its align queue.

---

## RATIFIED-CONFLICT

No fatal contradiction with the listed ratified decisions (v2-not-v1 gate; quality-first/cloud-permitted; compose-don’t-re-found; one packet; fidelity-verified conversion).

The composition decision is intact and still **overstates the callees**. Cloud-permitted is intact and still **missing the privilege gate that intake D10 already named**. Those are implementation holes, not a reason to reopen the decisions.

---

## What would have to be true before this is a plan

1. Ordered phases with stop conditions: **verified copy off T7** → directory-aware `$I`/`$R` restore → digest-union with existing catalog → extract (`-m all`, resume, incremental JSONL) → attachment type-repair → *second* extract → conversion with retained originals → T-Box classify (only what M1 actually is, until siblings ship) → enrich with a named list → prune last against a keep-set.
2. Brick table rewritten to what the exports do: PST `items` export; PDF/DOCX text; Tika text (not convert); image XMP; recycle **file** pairing; no `.doc` convert; no `.p`/`.d` repair; no OST/MSG; no CAD.
3. Privilege/PII/secret policy before any `LanguageModel` sees mail.
4. Disk/time/cost ceilings derived from 112.1 GB / 53 PSTs / 564 `.doc`.
5. v2 quality bar that at least closes practice-kg AC-2.
6. Explicit CAD in or out via `agentic-cad-patent-tooling`.
7. Kill or bound bullets 2, 7, 8, 9. “Exhaustive / every avenue / and more / at every step” cannot graduate.
