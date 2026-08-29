# S8 QA review — academia-corpus-mining

**FIX-THEN-SHIP.** The packet’s substantive research survived the audit: no Effect-v4 or `@beep/*` API defects, copyright violations, fabricated identifiers, broken repo paths, or unsupported sampled master findings were found. Publication should wait for two significant corpus-contract corrections and one cosmetic routing-count clarification.

## Findings

1. **[significant] Current provenance conflates preliminary and canonical corpus counts.**

   - **File:** `explorations/academia-corpus-mining/research/SOURCES.md:21-24`; `explorations/academia-corpus-mining/README.md:12`; `explorations/academia-corpus-mining/DECISIONS.md:39`
   - **Defective content:** SOURCES calls the input “a 519-file” download, while the current README and historical decision retain the preliminary “444 unique titles” count without distinguishing it from the final canonical corpus.
   - **Proof:** `research/INVENTORY.md:32-36` records 524 paper files—519 PDFs, four doc/docx, and one article markdown—then 447 unique hashes and 443 canonical papers. Catalog line 1 also declares `"papers":443`; its 443 paper records confirm that total.
   - **Minimal fix:** Describe the current corpus as “524 paper files (519 PDFs plus five non-PDF papers), normalized to 443 canonical papers.” Preserve the append-only CAPTURE and dated decision, but label 444 as the preliminary title estimate or append a final-count correction.

2. **[significant] `paper-catalog.jsonl` has an undocumented heterogeneous metadata row.**

   - **File:** `explorations/academia-corpus-mining/research/paper-catalog.jsonl:1`; `explorations/academia-corpus-mining/research/SOURCES.md:33-35`
   - **Defective content:** SOURCES describes the catalog as “one JSON line per paper,” but line 1 is a `{"kind":"catalog-meta",...}` record, followed by the paper records.
   - **Proof:** `wc -l` reports 444 lines; `jq -s` reports 1 metadata record and 443 records with an `id`. A naïve JSONL line count therefore reports 444 papers.
   - **Minimal fix:** Either move metadata to a separate file, or document the exact contract as “one metadata header plus 443 paper rows” and provide the required filter, such as `select(.kind != "catalog-meta")`.

3. **[cosmetic] The consolidated table cites 19 distinct repo paths, not 18.**

   - **File:** `explorations/academia-corpus-mining/RESEARCH.md:129-131`; table at `research/t3-master-synthesis.md:181-216`
   - **Defective content:** RESEARCH claims that all “18 distinct repo paths cited by the table” were checked.
   - **Proof:** Parsing the 36 rows yields 20 path-bearing routes and 19 distinct prefixed repo paths. The count becomes 18 only if the self-route `explorations/academia-corpus-mining` is excluded.
   - **Minimal fix:** Say “18 external target paths plus this packet itself,” or change the total to 19.

## Verified clean

- **Effect-v4 / beep-API fidelity:** Exhaustive scan found zero TypeScript/code fences in the included review universe. Installed Effect is `4.0.0-beta.101` at `node_modules/effect/package.json:4`. Direct live references resolve: `@beep/ontology` at `packages/foundation/modeling/ontology/package.json:2`, `ClaimGate` at `packages/epistemic/use-cases/src/ClaimGate/ClaimGate.ports.ts:78`, `EvidenceSpan` at `packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts:89`, and `AlignmentStatus` at `packages/foundation/capability/langextract/src/Extraction/index.ts:129`. `Ontology.create`, `S.filter`, and `S.pattern` are correctly described as absent/retired.
- **Internal consistency, apart from findings:** The 443 paper rows produce exactly 185 deep-read, 93 maybe, 165 catalog-only, and 79 off-topic. T2 tiers are exactly 42 gold, 125 silver, 15 bronze, and 3 dross. Deep-read lens split is 25 memory, 63 legal, 49 retrieval, and 48 agent; the seven clusters partition these as 25/39+24/10+39/23+25 with 185 unique IDs, no omissions or duplicates. Every report tier matches the catalog. Routing counts are 36 total, 10 attach-to / 10 extend / 16 new-exploration, and 15 high / 18 medium / 3 low. There are 13 align questions.
- **Copyright discipline:** No reviewed Markdown quotation exceeds 25 words; the longest detected quoted span is 12 words. No block quotations or full-text passages were found. All 185 external note files parse, and their validator-style whitespace count has a maximum quote length of 25 with zero over-limit quotes.
- **Provenance discipline:** No paper URL, DOI, or venue assertion occurs in the included artifacts or catalog. All 185 cited paper IDs exist in the catalog and have corresponding note files.
- **Repo-path validity:** All 35 distinct `goals/*`, `standards/*`, `docs/*`, and `explorations/*` references resolve, including the 19 routing-table paths. All 41 relative Markdown links resolve.
- **Claim-to-evidence traceability:** Master findings 1–5 were checked against their cluster reports and notes `36d82e899e75`, `5c2aeef6919d`, `39933453659f`, `10828be135bf`, and `d9e73d47d4a2`. Each supports the attributed proposition, and the master preserves the material limitations.
- **Packet shape:** Manifest schema is `exploration-manifest/v1`; manifest, README, and ATLAS agree on `active` / `research`; README has the required orientation sections and newest-first dated Trail; ATLAS accurately points to align as the next activity. `git diff --check` is clean.

## Limits

- The historical `prior-synthesis-legal-ontologies.md` was excluded as instructed.
- Claim traceability was sampled for five master findings rather than re-reading all 185 source papers.
- I inspected all committed quotation syntax and all note quote fields, but did not run full-text similarity detection against every external paper; reconstructed paraphrases cannot be ruled out mechanically.
- No live-web provenance lookup was needed because the reviewed artifacts assert no canonical paper URLs, DOIs, or venues.
