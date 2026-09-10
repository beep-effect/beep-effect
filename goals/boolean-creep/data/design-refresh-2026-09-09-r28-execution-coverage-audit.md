# R28 execution and coverage provenance audit

Native P2 audit at 2026-09-09T06:42:34.452544+00:00. Frozen HEAD `93217d998f851e2e93d9864e2b5315552eaa58a7`; origin/main `d1b4d769fbaffddd55717f3b1ba461897dd545c5`. This document audits the 27 PRIMARY reports and eleven terminal corrections named below. It is not a round verdict, canonical reconciliation, source rescan, independent P3 approval or dry-round credit. The parent extended this bounded snapshot to the terminal A-C, R-Z and Yeet corrections; later parent integrations remain outside this execution audit.

## Execution result and evidence strength

All 38 selected attempts have exit0, one transcript end event with stopReason=end_turn, no receipt or transcript error events, parseable reports and recorded packet-validation exit0. Counts match actual report bytes. All 38 transcript hashes, frozen runner/template hashes, seed hashes, and recorded correction input hashes verify. Native structural/status/duplicate checks pass for each report; no package validator or product command was rerun.

The 27 primary reports contain 62 rows:21 qualified proposals and 41 D, with nine valid empty reports. Eleven corrections contain 64 rows:22 qualified proposals and 42 D. Across them are126 raw rows and 87 distinct IDs; repeats across reports are expected correction history, not new admissions. These numbers are not a current inventory count, a new-Q count or a dryness decision. Recorded start/finish intervals reach a maximum overlap of four within this selected set.

All 27 primary rendered prompts reproduce byte-for-byte from the frozen template, runner substitutions, exact assigned roots, immutable seed filter and controller extra text. Ten correction prompts also reproduce literally. The UI correction has one verified Bash substitution defect, documented below. All eleven corrections retain the same conversation as their primary, checked using private transcript end metadata without publishing identifiers.

## Frozen map and effective authored coverage

The original lane map has 3,061 unique included paths and 67 excluded paths, disjoint. Exact-file-or-directory-prefix matching assigns each included path to exactly one of 27 lanes. The separate generated correction removes 20 paths in the original order, yielding 3,041 effective paths and 87 effective exclusions. All per-lane original/effective counts and both path hashes reproduce; original map and reports are unchanged.

- Frozen map SHA-256: `19b29ac1e1acbf4138645330dd8a82a8ee9407bd3dd410136a22efef8eccb22d`.
- Original ordered paths SHA-256: `718ae95a8091705c0e610cd824f5e9da8e8dbb34573b744d5c4bf30a09d9e3a1`.
- Generated correction SHA-256: `203f15c95554aea6dd33b24bfd95f910b6155f3732e94c5f9076a4583c1e9798`.
- Effective ordered paths SHA-256: `23669a67580577eb8183a6a301c5e4b4187b8048d39606f391ebe53e822db887`.
- Prior generated-source audit SHA-256: `0436fa5dd8e29468315264871a81fd78213ae9b9db8e54b20cffa9d2667e6def`.

Path hashes use UTF-8 paths joined by LF with a final LF. Source contents were not rescanned. The earlier generated-scope audit supplies its exact-source content digest 43c275e8c29e52380e182bb15b13edada0a2204dd040456fc8de6d4bc6680054 and source/main equality proof; this audit verifies that receipt’s bytes and checks live ref identities only. A file count, terminal event or graft tally does not independently demonstrate exhaustive semantic discovery.

| Primary owner | Roots | Original→effective files | Seed rows | Raw Q/D | Exact footer coverage assertion | Coverage basis / limitation |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| `r28-foundation-primitive` | 2 | 34→30 | 0 | 0/0 | Both assigned roots were covered (packages/foundation/primitive/data/src, packages/foundation/primitive/types/src). No seeds in this lane, so no seed drift. No unresolved source question: authored source has no co-carried boolean member cluster (generated surfaces excluded; lone mime lookup latch and callable predicates are out of net). | Both primitive roots explicitly covered. Generated exclusions reduce34 to30; the empty report is valid and seed-free. |
| `r28-foundation-capability` | 9 | 163→163 | 21 | 1/0 | Every assigned root was covered (api-transport, chalk, colors, file-processing, langextract, mcp-kit, nlp-processing, observability, semantic-web). | All nine roots named. TierGate correction and callable withdrawal are semantic owner findings; no file-coverage exception asserted. |
| `r28-foundation-modeling-rest` | 11 | 181→177 | 44 | 2/1 | Confirmed: 2. Disqualified: 1. Validator: inventory OK (3 records). Every assigned root was covered. | Every root claimed;20-path scope receipt removes four here. Bind177 effective files and modeling correction; its generated Html.meta raw Q does not count as an in-scope finding. |
| `r28-foundation-schema-a-m` | 87 | 186→186 | 14 | 0/0 | goals/boolean-creep/data/sweeps/refresh-2026-09-09-r28-main-d1b4d7/r28-foundation-schema-a-m.jsonl — confirmed 0, disqualified 0. Covered all 87 assigned roots (186 files). Seeds intact at current lines/members; D1/D2/designed classifications still match writers, readers, and constructors. No seed drift, no unresolved source question. Validator: inventory OK: 0 records. | All87 assigned roots and186 files explicitly claimed. No additional schema coverage is credited to the broad modeling correction. |
| `r28-foundation-schema-n-z` | 52 | 82→82 | 8 | 0/0 | Every assigned N–Z root was covered. No new eligible clusters. Unchanged seeds left unrecorded: ParserOptions CSV toggles (D1), supportsComments/limitRows (D1), Xml makeXmlParser (D2), the three enumerable/writable/configurable descriptor bags (D1), Semver leftNumeric/rightNumeric (D1). | Every N-Z root explicitly claimed. Eight seed clusters match the rendered seed count; callable withdrawal is separately named. |
| `r28-foundation-ui` | 5 | 218→218 | 69 | 0/3 | Coverage: all five assigned roots scanned (brand, dock, dock-react, editor, ui). Generated brand/src/Brand.assets.ts excluded. | Primary excludes authored Brand.assets despite all-five-roots claim. Bind UI correction for that file and218 effective paths; preserve its prompt-rendering exception. |
| `r28-drivers-a-f` | 16 | 97→97 | 28 | 0/4 | Every assigned root was covered (packages/drivers/acp/src through packages/drivers/freshbooks/src). All scoped seeds still exist on the claimed owners with the same members and classifications; no seed correction or withdrawal. No unresolved source question. | Every one of16 roots claimed. Four emitted D rows do not imply every existing seed was independently accepted by this audit. |
| `r28-drivers-g-m` | 7 | 68→68 | 11 | 1/0 | Every assigned root was covered (gov-legal-mcp, authored govinfo only, graph-3d, hubspot, libpff, m365, m365-mcp). _generated excluded. | All seven roots named, authored-only govinfo/_generated exclusion consistent with map. Collision/callable semantics remain separate. |
| `r28-drivers-n-r` | 15 | 88→88 | 52 | 0/0 | goals/boolean-creep/data/sweeps/refresh-2026-09-09-r28-main-d1b4d7/r28-drivers-n-r.jsonl   Confirmed: 0. Disqualified: 0.   Every assigned root was covered (n3, nlp-mcp, obs, onepassword-cli, openai, openai-compat, openclaw, oxigraph, pacer, pglite, phoenix, postgres, pretext, rdf-canonize, runpod authored src; _generated excluded). No new or changed eligible clusters; unchanged qualified/D1/D2 seeds were not re-recorded. Validator: inventory OK: 0 records. | All15 roots named with generated surfaces excluded. Empty report retains explicit seed drift/withdrawals in its footer. |
| `r28-drivers-s-z` | 9 | 59→59 | 16 | 0/0 | Every assigned root was covered (sanity, shacl, tailscale, tika, uspto, uspto-mcp, venice-ai, wink, xai). | All nine roots named. Empty output still has callable-withdrawal assertions; no missing/new-ID inference is made. |
| `r28-architecture-ecosystem-internal` | 9 | 115→115 | 17 | 0/0 | Every assigned root was covered (architecture-lab client/config/domain/server/tables/ui/use-cases, effect-drizzle, _internal/db-admin). No new eligible clusters; no seed line/member drift on surviving owners. | All nine roots named, including seven architecture-lab slices. Footers distinguish survivors and callable withdrawals. |
| `r28-agents-workspace` | 9 | 144→144 | 12 | 0/0 | All 9 assigned roots were covered (144 authored source files). The 12 seed owners still exist at the claimed lines with the same members; current writers, readers, and constructor contracts still support the live classifications, so they were not re-emitted. No seed drift and no unresolved source question. | All nine roots and144 files explicitly claimed;12 seeds matches input. Blanket unchanged classification is limited by later native agent/app owner audit. |
| `r28-epistemic-ontology` | 13 | 217→217 | 43 | 1/0 | Every assigned root was covered (epistemic and ontology client/config/domain/server/tables/ui/use-cases src, excluding tests and generated surfaces). | All assigned domain roots claimed. Correction binds217 files and full declared command domain; it is a bounded seed correction, not a second sweep. |
| `r28-shared-documents` | 7 | 216→216 | 21 | 0/1 | Coverage: every assigned root was scanned (packages/shared/{domain,tables,use-cases}/src, packages/documents/{domain,server,tables,use-cases}/src; 216 in-scope files). Explicit S.Boolean / BoolKey / : boolean hits, inferred locals, schema structs, type literals, object-literal option bags, and leftover optionals on seeded owners were inspected. | Seven roots and216 files explicitly claimed. Raw D row and later native metadata/eligibility audit do not alter execution coverage. |
| `r28-law-practice-domain` | 1 | 225→214 | 25 | 0/0 | Every assigned root under packages/law-practice/domain/src was covered (tests, _generated, and internal/generated excluded). No new eligible ≥2-boolean carriers. Schema-struct seeds still exist at the same owners/members/lines; D1 and designed classifications still match current writers, readers, and constructors. | Domain root explicitly covered with internal/generated excluded. Separate scope receipt reconciles225 original to214 effective files. |
| `r28-law-practice-runtime` | 3 | 91→91 | 8 | 0/0 | Assigned roots covered: packages/law-practice/server/src, packages/law-practice/tables/src, packages/law-practice/use-cases/src. | All three roots named. Callable/non-Boolean disposition precision belongs to the existing law/shared audit. |
| `r28-apps` | 6 | 116→115 | 82 | 3/3 | Every assigned root was covered (architecture-lab-proof, oip-web, practice-kg-mcp, professional-desktop src + src-tauri, todox). No new non-seed clusters. | All six roots named including desktop Rust. Effective count115; apps correction explicitly says it is not a new sweep of those115. |
| `r28-tooling-library-observability` | 3 | 52→52 | 49 | 3/3 | Every assigned root was covered (ai-metrics/src, ai-sync/src, qa-capture/src). | All three roots named. Observability correction explicitly keeps docgen outside its scope; do not assign it the separate13 docgen files. |
| `r28-tooling-library-support` | 4 | 84→84 | 23 | 0/3 | Coverage: all four assigned roots scanned (codegen-kit/src, repo-utils/src, fc-runs/src, test-utils/src). | All four roots named. Full field/SDK/callable adjudication remains in the finalized support-policy audit; no extra correction is inferred. |
| `r28-tooling-policy` | 2 | 38→38 | 23 | 0/2 | Covered both assigned roots (packages/tooling/policy-pack/lint-rules/src, packages/tooling/policy-pack/repo-configs/src); generated snapshot excluded. Every listed seed declaration still exists. | Both roots named; existing generated snapshot exclusion agrees with map. reactCompiler/full-field semantics remain separate. |
| `r28-tool-docgen` | 1 | 13→13 | 14 | 0/2 | Coverage: every assigned root under packages/tooling/tool/docgen/src was inspected (13 files, including internal/JsonFile.ts and markdown-toc.d.ts). | All13 files explicitly claimed, naming internal/JsonFile and markdown-toc.d.ts. Footer Option/descriptor claims require existing native observability-docgen and command-data audits; observability correction does not cover this owner. |
| `r28-cli-internal-root` | 4 | 78→78 | 25 | 1/4 | Covered every assigned root: bin-main.ts, bin.ts, index.ts, and packages/tooling/tool/cli/src/internal (78 files). Unchanged eligible seeds were not re-recorded. | All four exact roots named. Internal correction repeats original scope and excludes A-C/D-K from its coverage. |
| `r28-cli-commands-a-c` | 9 | 149→149 | 59 | 0/6 | Every assigned root was covered (AIMetrics, AgentEffectiveness, Architecture, Cache, Ci, Codegen, Codex, Corpus, CreatePackage). | All nine roots named. Primary and bounded A-C correction are terminal; the correction preserves A-C scope and excludes Docgen/internal-root/D-K. |
| `r28-cli-commands-d-k` | 9 | 112→112 | 93 | 2/0 | goals/boolean-creep/data/sweeps/refresh-2026-09-09-r28-main-d1b4d7/r28-cli-commands-d-k.jsonl — confirmed 2, disqualified 0. Covered DeletePackage, Docgen, Docs, Explore, Fallow, Files, Goals, Image, and Knowledge. | All nine roots named. Correction explicitly rereads Docgen/Goals only and does not recensus remaining roots; their coverage stays with this primary. |
| `r28-cli-commands-l-q` | 6 | 87→87 | 78 | 4/4 | Coverage: all six assigned roots were inspected (Labs, Laws, Lint, Purge, Qa, Quality). Labs and Purge have no eligible two-or-more Boolean carriers (single json/lock flags; LabsListRow is Option payloads). | All six roots named. Bounded correction retains coverage but its no-unresolved claim is limited by the finalized native L-Q audit; no second correction/P3 credit. |
| `r28-cli-commands-r-z` | 9 | 89→89 | 51 | 2/5 | Every assigned root was covered (Research, Root.ts, Runners, Skills, SyncDataToTs, TopoSort, TsconfigSync, VersionSync, Worktree). | All nine roots named, including Root.ts. Primary and its bounded correction are terminal; the correction remains allocated only to this original owner. |
| `r28-cli-yeet` | 1 | 59→59 | 35 | 1/0 | Confirmed **1**, disqualified **0**. Validator: inventory OK: 1 records. Every assigned root under packages/tooling/tool/cli/src/commands/Yeet was covered. | Entire Yeet root explicitly claimed. Primary and its bounded correction are terminal; the correction remains allocated only to this original owner. |

Every quoted assertion above comes from the exact hashed completionSummary. The companion preserves each full footer, its extraction hash, actual roots/counts via the map, input/report hashes, and per-report row hashes. The statements about unchanged seeds are not treated as canonical adjudication.

## Eleven terminal corrections and their actual coverage allocation

| Correction | Corrects primary | Raw Q/D | Effective paths matched by scope argument | Corrected owner files | Scope/coverage limit |
| --- | --- | ---: | ---: | ---: | --- |
| `r28-apps-contract-correction1` | `r28-apps` | 1/3 | 115 | 115 | Explicitly bounded correction, not a new residue sweep of115. |
| `r28-ui-contract-correction1` | `r28-foundation-ui` | 5/0 | 218 | 218 | Repairs Brand.assets exclusion and binds218; input rendering exception remains. |
| `r28-modeling-contract-correction1` | `r28-foundation-modeling-rest` | 1/6 | 445 | 177 | Broad launch scope matches445, but footer explicitly covers177 modeling-rest and says schema A-M/N-Z not swept. Do not double-count268. |
| `r28-epistemic-contract-correction1` | `r28-epistemic-ontology` | 1/0 | 217 | 217 | Binds217 and declared command domain; bounded seed correction. |
| `r28-cli-l-q-contract-correction1` | `r28-cli-commands-l-q` | 2/4 | 87 | 87 | Bounded correction; all six roots remain primary coverage. Native semantic exceptions remain. |
| `r28-observability-contract-correction1` | `r28-tooling-library-observability` | 1/3 | 52 | 52 | Three roots only; footer explicitly excludes the distinct docgen lane. |
| `r28-cli-internal-contract-correction1` | `r28-cli-internal-root` | 1/6 | 78 | 78 | Original internal-root scope only; explicitly no A-C or D-K scan. |
| `r28-cli-d-k-contract-correction1` | `r28-cli-commands-d-k` | 2/2 | 112 | 112 | Docgen/Goals reread only; other assigned roots explicitly not recensed. |

| `r28-cli-a-c-contract-correction1` | `r28-cli-commands-a-c` | 2/5 | 149 | 149 | Assigned A-C roots only; footer explicitly excludes Docgen CLI/internal-root/D-K. |
| `r28-cli-r-z-contract-correction1` | `r28-cli-commands-r-z` | 4/6 | 89 | 89 | Original nine R-Z roots remain covered; Yeet explicitly out of scope. |
| `r28-cli-yeet-contract-correction1` | `r28-cli-yeet` | 2/7 | 59 | 59 | Original Yeet root remains covered; R-Z explicitly outside this correction. |

No correction replaces a failed primary: all 27 primaries terminated successfully. The UI correction is additionally required to repair one explicit authored-file exclusion. Preserve both primary and correction receipts. The eleven launch JSON hashes recorded as specSha256 verify against the private per-correction JSON files; that field is not a hash of goals/boolean-creep/SPEC.md. Controller code establishes this field meaning.

## Concrete input-rendering exception

The UI correction’s intended instruction contains:

```text
items.length===1 && indicator!==dot
```

Its actual rendered prompt contains:

```text
items.length===1 {{LANE_EXTRA}}{{LANE_EXTRA}} indicator!==dot
```

This is the only literal reconstruction difference across 38 prompts. The frozen Bash runner’s line 55 replacement expands each unescaped ampersand to the matched template token. Frozen extra-prompt SHA-256 `2780f137470f531e634ff03f4a723f8d6758ec15ea441cc6e7c58e393d24ec33` matches its launch JSON. Intended reconstructed whole-prompt SHA-256 is `28818b1948395114ceec50933e356a54e5f4ad594a368dc9702a5dbc0475348a`; actual rendered-prompt SHA-256 is `1dca2e8d9a3e6da91a8edd09d0aa2a14a4f856e28fb06ed54685c1cfdb408858`. The actual bytes equal the intended bytes with precisely the single displayed replacement. Two residual LANE_EXTRA tokens remain.

Keep this defect visible rather than reporting all 38 prompts as literal reproductions. The UI report/transcript still explicitly inspect source, repair Brand.assets coverage and report the 6/5 relation. This execution audit neither retracts that source evidence nor grants it fresh independent acceptance. Parent may repair future runner substitution separately; do not mutate the frozen runner, prompt, receipt or report, and do not infer another UI correction authorization. The rendering defect is the concrete friction receipt for this bounded task.

## Coverage contradictions and unresolved evidence boundaries

- **UI file coverage, repaired:** the primary simultaneously claims all five roots and excludes authored Brand.assets.ts. The generated correction removes zero UI files; the terminal UI correction explicitly includes the file and all 218. Primary-only coverage is therefore insufficient for that one file.
- **Generated output row:** html-element-meta-void-rawtext in the primary modeling report points to Html.meta.ts, one of 20 effective exclusions. It is the only raw row among the 126 selected rows outside the effective file set; every other row is assigned to its expected primary lane. Preserve the raw report and use the scope/modeling correction; execution success does not admit a generated owner.
- **Correction scope is not new corpus coverage:** modeling’s broader launch prefix matches268 additional schema files that its footer explicitly did not sweep. D-K corrects Docgen/Goals only. Observability excludes docgen. Their primary coverage remains separately bound.
- **Footer semantic overclaims:** existing immutable native audits qualify claims that every seed survives or no question remains. Agent/app audits identify cross-owner/required-array mistakes; observability/docgen and command-data audits correct initial eligibility and real option-object owners; support/policy corrects full fields; finalized L-Q audit corrects coverage companions, raw requests and resolved lanes. Reuse those audits and parent decisions. This task does not rescan or repeat their semantic work.
- **Primary receipt closure:** primary receipts do not record reportSha256, renderedPromptSha256, laneMapSha256 or originMainSha individually. This audit binds their current report/prompt/receipt hashes; the common map and aggregate bind source/main, and eleven correction receipts bind their primaries’ hashes. Do not misdescribe a new native checksum capture as an original receipt field.
- **Campaign document closure:** correction specSha256 means launch JSON. It must not be used as evidence of the campaign SPEC.md version read during a run. The common current campaign document/validator hashes are included separately as audit-time references; frozen template/extra-prompt hashes are the reproducible instruction evidence.
- **Attestation strength:** all 27 primary footers assert root coverage, including nine empty reports. Receipts do not contain a per-file traversal attestation. This audit verifies assignments, inputs, outputs and footer provenance; it does not independently repeat source coverage or guarantee absence of missed carriers.
- **Extended terminal set:** A-C, R-Z and Yeet corrections are now included by parent instruction, bringing the correction count to 11. All three pass execution/hash checks and literal prompt reproduction; their footers keep A-C, R-Z and Yeet scope separate. The new A-C TemplateContext qualification and other semantic changes remain parent-adjudicated report findings, not execution-derived admission or dryness. No current-canonical or round verdict follows.

## Exact report, receipt and transcript hashes

| Lane | Report SHA-256 | Execution receipt SHA-256 | Transcript SHA-256 |
| --- | --- | --- | --- |
| `r28-foundation-primitive` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `9d67d653d92849c8614f37070d8f0b2f0d2bed23bc5c59b11048a310ecb46832` | `4df82e36a286ca577a4837b116e481e5b22a87a1e1fd06e41837e9632b1b98ef` |
| `r28-foundation-capability` | `32742e1152c0b1899397a7533a4b9047dfcadd02da74333a9586cc8b52f4a70c` | `9babc5b23a914478acac971628f882108762e695e5ed0a06c0e6f1acff150856` | `ced3108aedbd5b8061f0448f682b3244d980b0c4652648e89ad0a08402903f18` |
| `r28-foundation-modeling-rest` | `98b2a82e619dab4e7394d05c071897210f483181f872a0d841a14738d48a8a67` | `fe312cf371e346083bc435386aeb6663a7a0a43fee6eb4bee9acd1310808d195` | `a09c84d7fde47a37420fb9478275dd3ceb3aef795b09834497a5b623f0d9060f` |
| `r28-foundation-schema-a-m` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `a0da85eb4aaf111d912426ed9f4a20db25f643f0efd50b3714228c388675c58a` | `3e662a391eafa8fe283e594ee0e641a23a746f94ce37c4b91612b06b4ecef38d` |
| `r28-foundation-schema-n-z` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `41e1e2ed30c79473182604b9ac59a60ce79dcb524efee0d8363e60d40a850b67` | `e782484a82180271fc39e1c1ea62ab1799ee86740b3bf1ce6e5912ff888a2cf0` |
| `r28-foundation-ui` | `54ba907f6d5a725bb744b1bd5434fcbbb0eda56bf4779e7ebd86fec9936437a6` | `3a8404825fe725a151d6c59b13baa45542f4bed4f1a6040d1296b39b87244b92` | `4ce9e355ac3efa76eb557a90795c9d91c68a0a019358b39dc288c360c8a60e09` |
| `r28-drivers-a-f` | `b55b567a86fdd66949f4b34efc63dd7ca5e7e222027a536d94e49831a4e429d0` | `905f1ec73bdde7bfa7632780bf2c408499a187d8fbe4023f952deb45e3eb985c` | `c172b6ae0203037ceed43004714947324cd551dff4c5edcd44002df7da07c441` |
| `r28-drivers-g-m` | `d77e246cf0ac0e9061476f9c3c7bfecdc75ece81abfcb80f127e65d91afd9dc8` | `7c72f05fb20b2a517c614d496928fe7765f9b71198968f5c1365716139aa785b` | `6c4f8a4e272bf968dafd2b763ce42dac8c762e939eb31bee1cbd563b589a7362` |
| `r28-drivers-n-r` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `793f25a753a1a7bde14819d19693d00517d30de7eb02412ba88722fc4d28363d` | `e3455a89990c98cb7de930dbec9df4bda42513256bb2db470d30e55882b80e37` |
| `r28-drivers-s-z` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `a38a93747173910e1dd5a416b5b3a616df1cc26c0d0c29192eb46cb0c32ca9e8` | `efe933d92889ac2c3eb79560b5beaf07b9efb1ab4ecbe75523771fbbd39a984e` |
| `r28-architecture-ecosystem-internal` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `9b2a296ba9e136341290402b8f3b0fb0548e359e8e868ed33da775e34fb4cf8b` | `0a1a874af29ed58234e863cd2545c2734d3c5dc1e002a5e55827178b691b19f8` |
| `r28-agents-workspace` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `f710bdb125956608aa12bed18692e8e0703d7ce0ffde1345d5890dc7c6205887` | `ead65e6f0b04a2875cf000c370ac0d38577e35f7eb47f2a6aa555bba22738087` |
| `r28-epistemic-ontology` | `26e59dc806c61db3dc2a67c45a21d6637b55950740cd4e6657c1c2ee005c50bd` | `a2dbf027a8742673ecf5655ab44a3aba051baeacdee57c9ab092e83c601e0798` | `0011437b1c501bfee406a03eba9d5111b58c5bbbb7f81adce1b7f9cf9d7b7ff2` |
| `r28-shared-documents` | `7d5496868c9a031ce6ce9114f3c95b45d817745ade80de59f96db72c0a4a85ea` | `a57f2a055b92ac23f8c6bc65474ac0ae5dba22dce5f3725857dcffd54bddc11e` | `be33e3a43dc2debdefbb1afeaed105dd5210047846d380d4e4382dedf1671486` |
| `r28-law-practice-domain` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `8649e416db47f8a91af3c8b56e93f93cb9a573fa0d96d765cb79d51994911395` | `0a0c5ab3ab1dedd9cb65dc9d8f4a0f10dc417c08394aa38f7e4233edbe4f9859` |
| `r28-law-practice-runtime` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `14147a3e1aa6bfe85fb2f6295ea89dfcd122303be5d509c21d221c45a7f2230c` | `4102d5c7611be0e0fa14705796be0748dc37d2850c9d8fd3cf4b06693b53f482` |
| `r28-apps` | `23b5d54a3e1967e50750233c93b2dbe689f346fd9e86b8e04ad5826d1933ea65` | `b0bddcdff8bfd3b37ced0086ef25cd3e785cab505c135e1d0ff4c95145e6c5c3` | `4f28bed1adb15da18d0fbc650f9dc8d524b46772689842d8385b30645ed74590` |
| `r28-tooling-library-observability` | `56a904f211a8799ada54c1177e4180ea9474cb98ce4eb7700c187b98077523d8` | `a271ed1d2cf21f2025b9cc7964181647d3eb84645429d20ce12e711fe80e8407` | `da4fd7a1b32f09c35dd9b127a236c99be16d0faf1c3c0e082dc81b18bd819b08` |
| `r28-tooling-library-support` | `cd22df7ebb847355acff3683eb662847af8434ec3e951ffe18fbb304e6aa1ae2` | `639d72c3d3dd61faa30ad4a6758cc0833272381106432be3aa2b77fb99ea3d0f` | `77ed26dbf6d0ab38883f8996a2dd3f7f265332499d5161c21adcc43b404dbe82` |
| `r28-tooling-policy` | `824177055c2f72686dd741c91b6397f15da355d57a7229fca064af44fdddf02b` | `c30e618d5469efaabd6150a49dc974810a3d4f1a12395b016fcd18e38bbe84d3` | `cd376bdf9d74054d4d2b936e8677cfaaa7927407d73abcc595eafa337c8b6b40` |
| `r28-tool-docgen` | `6ba7a0889f4f94258456e1cb479354944059e059e9ca3748b9f0976863fd10c0` | `b1cbf4683026dfdf145ca08f7e13b0ee3f295136fee78b68fc30e2f59637a9e6` | `56f90776822fc1ebd40954e2ea2c37049e8eef4301c87f41e26cbbac7366cc7a` |
| `r28-cli-internal-root` | `bb9d1551a55192a9b37b2450162f3ca2eee034fe699c4d0e14f8bdde39216d2d` | `be0656ae0c76c3ee5c8b997d8649dc3eb5bc5b307a99fa2f1122fcdebba2f2f7` | `41522a8cc045517043c4fd9f389638a00403ad896e6ae17dda725d05e5bf8c1b` |
| `r28-cli-commands-a-c` | `1118219531731d81e1a9b80eba2ac6127f8533c7d408a65055bc677e709a9d29` | `973b8c3829ce195c887ab74077006aac031f7d821928b74cc0cce7f5950f4478` | `957777bd479e5f9eb74f904e168e382a1a998282a5376fb37773c3cd08ec1d10` |
| `r28-cli-commands-d-k` | `3e8edc87cef930f11c29785fe44200082a007e33345f5953ec018fc326a9f25b` | `d0550eae61100e590cf4eeedbeaedf10d0387d4b707156bf68c0dde9228bc58b` | `f5c132f781d4478a116ae157529fb247a8a1d21b4dc71e5312d4879e06df6393` |
| `r28-cli-commands-l-q` | `eee2e7505d8a7b93367f5b3cab7b17b1c7d6c76528f58cd195b976c0803e09ca` | `dc55edf2b5d106de1a0afa304181f810112fa2ff4249b9b457672133827907a7` | `009d1653cac7eb128f43cc8ececb24cf8ce3e48f229ed8e24266adb26a682f6a` |
| `r28-cli-commands-r-z` | `9a6ca534827ebda17956c957d0ceed659096a25a7e98c1a90d720b149ecb3734` | `f725da468aa66841190ae5e58fb89ae6fdb2ccdbd824089afd2b63c49c1ea5c2` | `8e0c2b0652a62a55d9f671a0cde5943951d135906b16cb2836917f1316b90471` |
| `r28-cli-yeet` | `84f7feaee4d8b0128e211d6f2fe604851fe2175160c6f39c3668d431d375c03f` | `4cdc69035941d6f268ac0363be760863c0ca73124c4881a85cb2f2374b44d891` | `6766e7d9bb0d4d7b35f4d771f894058ba893dbca164197aaec06c688a44546d6` |
| `r28-apps-contract-correction1` | `8de6717c752e0f154686ddaa85d0c3beea7e0f6b02e4a5011b0ebe11392d6efe` | `4e5d041a6139e26cefae10e10969db8334d0f062bdcd1162ce3ded616f845ac8` | `3284fae864739732aa12c7616174d1dfa77c7db0549bd045a5dfbc903615535d` |
| `r28-ui-contract-correction1` | `d4e906fd1353012718ace9dcf0704878344a51ec195b131afe5944048ff75fbc` | `b81a7dfaefdaa4a5b9ca4ae7cc7ab13ab1e095002853c4bcc439cc5862d930e7` | `ccdd16ae3a8f2f848f86d3f7cd876606acca8210a03a99e8bd378bf7ec88e1c2` |
| `r28-modeling-contract-correction1` | `25af4fb0caa38a0dfe7901f729d59f9e61f6a835365b2fe09132c6d5beafe009` | `d767a58fdd6f50b9722a17bd7c96644da4028d1f73dbb11fa80e46fd884f933f` | `05e3a6f3cdc7fe7d9234dcfb5227978921f28c44060099980181c179afe286a6` |
| `r28-epistemic-contract-correction1` | `ec7c7a929d29f2c42a45a60aad76ee5c8ecdef6a42cfaa3b7c302ebe28347081` | `baf4f96f392a4ef078c8f8b59669e4fba0a3a49e133c7414bb6a204fe67fb590` | `ed0d70b48579fb6f95f5428084c8c6155c6724add0337dd9bb3be9af78897f0b` |
| `r28-cli-l-q-contract-correction1` | `e12effcf3bd5f13f56e07f97c38ebafc78d5e2f03c8efaa226606646e2b324c1` | `b18e8cb149afb4cedee0fb42aaa87262aab2c36158fbdf065afba9da73e83b62` | `ecaac76a01f28f1c4d29929df1790894cfe25f8eb17220fd20a03aca6a868c2d` |
| `r28-observability-contract-correction1` | `522aad7489b929d65246a33f28b03948f1873c2e6c62b36a066d160ffcb81e68` | `e1545e19dd02db1e07852c99c4073ce69922463751a1c6dde7dfe4b886365dfb` | `62cf053b22b30ed2947fe2dd9949f582dd3e140d3acc82693d7c4d60ac2a22cd` |
| `r28-cli-internal-contract-correction1` | `b20deb9984bd19e9b424c40e3b052d9ef46c74cf314b33fefdd5bfcffa7db75d` | `da96d560e91a02e3cbfc135b5dd6ef81f8ecbe505a17804db709c1d5401fd6ed` | `15d466bd09bf541e16975b26c5bfed326879ea4b787f45499a1b2f4d04bdacac` |
| `r28-cli-d-k-contract-correction1` | `bdbb5b928c157cd9a83986fe798021432c2fb086c0d3265288bf235fc04e2230` | `76f665d69fe1cb2d652f7e4826dc303cc7b3cab43269115ee75505bd4761c70f` | `ff1758fa728fd64bcff66184cc2a6263a0d7cc265209ac5207c26e66ed4b7300` |
| `r28-cli-a-c-contract-correction1` | `dd64cdeaf0309615a9b9fe9669b8f567a10bc98e50b0720b144b89b0f52b2329` | `f66bdb0878d3bf0f94662b5dd052c714979ea242ca78fd4b49717afd74f13eff` | `e20b4feda71c6a3ec59092e1ca2e1b5ac8cc64d1147fff39007d39e13f42ce00` |
| `r28-cli-r-z-contract-correction1` | `10e2767b09fee9273f32f729a615a54abb2de33d0a131221a5e4b9651a90b27f` | `1b9bb5cc32d2fe9f8e289c525036ebba943ce55aa81c8d0c3a46a956c9dbc516` | `b09bb37aedac12e65350f620c9288f2daf73ee5fed2c9ef0483faf2da097e661` |
| `r28-cli-yeet-contract-correction1` | `43b26365d1b31b4be152df07fa24a5eacd7d8faddeb8ad19d21baee27a173cd7` | `9c72b575dcd551e9a8efeba5887ef976648f75bd78341c6c947cddc123679ac1` | `34ea1a4ea0a927cd82b85f2022e059ee8bbacedfa98a251645df11d51510908f` |

## Input and prior-format receipts

R27 reconciliation/round-verdict/raw-validation formats were read for the separation of primary execution, effective coverage receipts, semantic reconciliation and independent-review credit. Their historical final decisions are not copied into R28. This audit intentionally creates no round-verdict.json, post-round inventory snapshot or canonical reconciliation.

| Input / reference path | SHA-256 |
| --- | --- |
| `goals/boolean-creep/data/sweeps/refresh-2026-09-09-r28-main-d1b4d7/lane-map.json` | `19b29ac1e1acbf4138645330dd8a82a8ee9407bd3dd410136a22efef8eccb22d` |
| `goals/boolean-creep/data/sweeps/refresh-2026-09-09-r28-main-d1b4d7/source-sha.txt` | `7e81249dedde6937f52b9b7796e233dff48319eb82e96e7249e5ec35b12be808` |
| `goals/boolean-creep/data/sweeps/refresh-2026-09-09-r28-main-d1b4d7/execution-summary.json` | `9d3444d32c41d0474211f41ea81918a4c9d666aa21f3581e1681fb6bd08e6f99` |
| `goals/boolean-creep/data/r28-generated-scope-correction.json` | `203f15c95554aea6dd33b24bfd95f910b6155f3732e94c5f9076a4583c1e9798` |
| `goals/boolean-creep/data/design-refresh-2026-09-09-r28-generated-scope.md` | `0436fa5dd8e29468315264871a81fd78213ae9b9db8e54b20cffa9d2667e6def` |
| `goals/boolean-creep/data/r28-generated-scope-integration.json` | `df52b1c9d2f641b3383e3b3a76f1c579e939aec42e6ec8244844f6929f7b6ac4` |
| `goals/boolean-creep/SPEC.md` | `495eb18327549f55c5b0f3ac329d4f1b71ddfea302318ff5ae1754250daefaeb` |
| `goals/boolean-creep/DECISIONS.md` | `422a5c29c50fe757ab5d1c58e23e560c73f41588adc01fc7b0ef36a38b0d9690` |
| `goals/boolean-creep/ops/validate-inventory.ts` | `f1a02edfa18248538c5afda3f83ed2738cc74130df46292abd3c83dc232aa32e` |
| `~/.cache/beep/boolean-creep/durable-sweep-v4.py` | `974dbb4582f7da28083d3eeab91a1d201c9c142e197fe891c5baaf87b87de942` |
| `~/.cache/beep/boolean-creep/refresh-2026-09-09-r28-main-d1b4d7.seed.jsonl` | `bf82e9656a66c738c413567734ae05bfad31e79c4cb7ab3c086307dd28185f24` |
| `~/.cache/beep/boolean-creep/census-runs/refresh-2026-09-09-r28-main-d1b4d7/sweep-lane.md` | `6f54a113c39ea40a0254725aebf460ffcbb707792aa3e8b60aafb7f7a443dc5b` |
| `~/.cache/beep/boolean-creep/census-runs/refresh-2026-09-09-r28-main-d1b4d7/run-sweep-lane.sh` | `0f3070ded9e9f0a1a905d7e6d43bf3d8631d85c657afa47d87312bc5349106bc` |
| `~/.cache/beep/boolean-creep/run-r28-correction.py` | `d8ba538fa2e0aed3b69b4913f3f3c31a32cf17622382655abd135a6acaba5c82` |
| `~/.cache/beep/boolean-creep/run-r28-correction-v2.py` | `18cd60e89364e37f91971075ab4bcbc87832804e3bddff71c2a2220b37788aee` |
| `goals/boolean-creep/data/sweeps/refresh-2026-09-09-r27-main-663904/reconciliation.md` | `8c8de28fdb920b93b961b7a659e771d92270600b3fe72660c0d0c6d2710b1e39` |
| `goals/boolean-creep/data/sweeps/refresh-2026-09-09-r27-main-663904/round-verdict.json` | `25c55ce145359f562b9ac09857d149c2a48923d679f982794d585f4d1a7ea919` |
| `goals/boolean-creep/data/sweeps/refresh-2026-09-09-r27-main-663904/raw-report-validation.json` | `e032214228bee1e0f86c7a97287bd609bb5713bb66809795615ca70ce9b4bfe4` |
| `goals/boolean-creep/data/sweeps/refresh-2026-09-09-r27-main-663904/execution-summary.json` | `7e95d62e4f551cf85db14c5af8a941a8f47f1fa7358a7564d8c62fc2fa516a29` |

The machine-readable companion additionally records all 38 rendered-prompt hashes, templates/runners, all eleven launch-spec/controller hashes, every verified input-audit hash, exact footer text and hashes, and all 126 raw row hashes. Private paths use~/ and contain no session/request/machine identifiers. It does not copy the seed or current canonical inventory.

## Validation and bounded handoff

Companion: `data/design-refresh-2026-09-09-r28-execution-coverage-audit.json`, SHA-256 `b6b79bca83c2896492bf4eeb1b46769c3d03001feef00c6ecfc4f5b9b27ff42e`. Its source pins, selected 27+11 membership,126-row/87-ID arithmetic, per-lane scope counts, all report/receipt/transcript/input checks and exact UI exception are checked. Previous finalized L-Q audit and three addenda retain their four accepted hashes. No source/tests/current designs/canonical inventory/archives/statuses/controllers/services or refs were changed. No Grok or product/package command ran; no independent P3 or dry credit is supplied.

The only writes are this new Markdown audit and its data-only JSON companion. Parent owns any subsequent integration, future runner repair, any later corrections and eventual round-level judgment.

