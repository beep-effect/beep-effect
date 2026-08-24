# Tracker-mining review

## Verdict

**RATIFY-WITH-EDITS**

The tracker census, inventory totals, most item summaries, and the two gate-signal arguments are supported by the raw dump. All 188 distinct issue or PR numbers written explicitly in the synthesis exist. Their kinds and local snapshot states match the synthesis, with the qualifications below.

The synthesis needs edits before MAP consumes its dedupe conclusions. It missed the most relevant Ontology Hub registry issue, #518, and understated PR #658, which added `docs/changelog.md` to `docs.json`. It also turns #1075's multi-model gateway into an unsupported hidden-model-swap claim, attributes the exact 12-versus-17 MCP count to records that do not establish both numbers, and uses the range #682-#704 as if every PR in it were a guide-onboarding PR even though #684 is a deployment-template PR.

Local PR state was reconstructed from `prs-merged.json` versus `prs-open.json` because those raw PR objects do not contain a `state` field. Issue state and state reason came directly from the issue objects. Body and comment text were included in the evidence search.

The requested live spot-check was attempted for 15 items: issues #228, #300, #448, #518, #994, #1020, #1083, and #1134; PRs #658, #757, #838, #970, #1090, #1124, and #1173. Every `gh issue view` or `gh pr view` call failed at the transport boundary with `error connecting to api.github.com`. No live result is claimed. The verdict therefore rests on the 2026-08-24 raw snapshot.

## Citation check

The table covers every explicit number in the synthesis. Grouped rows contain citations supporting the same claim family. `partial` means the raw item supports the narrower fact stated in the note, but not the broader inference.

| # | claim | supported yes/no/partial | note |
| --- | --- | --- | --- |
| #124, #149, #168, #186, #208 | Docling parsing; silent extractor failure; schema-verified structured output; sequential extraction; dropped relationships | yes | All are closed/completed issues. Titles and bodies support the summaries. |
| #228, #231, #240, #246 | Empty evals module and HermiT/Pellet wishlist; correctness-versus-speed split; sqlite-vec request; claim-level provenance | yes | All are closed/completed issues. #228 requests HermiT/Pellet validation but does not report simulation as a defect, which the synthesis correctly distinguishes. |
| #245 | FAQ/docs were previously overhauled without fixing the cited two-version contradiction | yes | Closed/completed docs issue. It names FAQ consistency and navigation generally, not the exact version pair. It is a nearest miss, not a duplicate. |
| #300, #318, #322, #354, #368, #398 | Reopened RETE stubs; SHACL from OWL; CONSTRUCT rules; failed `founded_by` inference; recursive Datalog demand; deterministic temporal reasoning | yes | #300 is open/reopened; the others are closed/completed. Bodies support the claims. |
| #400, #401 | Temporal signals and temporal provenance are lost | yes | Closed/completed issues. #401 specifically says RDF export drops `valid_from` and `valid_until`. |
| #414, #433, #446, #447, #448, #478 | Semantic-effectiveness benchmark gap; silent FAISS drop; OWL/RDF term failures | yes | Closed/completed issues. Bodies support the stated failure modes. |
| #517, #519 | Ontology Hub and editor are nearby Explorer work, but not the three exact registry fixes | yes | Closed/completed issues. The deduction is incomplete because it omits #518; see corrections. |
| #541, #549 | Packaged MCP absence after pipx; storage/backup uncertainty | yes | Closed/completed issues. #549 is also the upper boundary cited for the first issue band. |
| #570, #571, #575 | Benchmark epic, first pillar, and shared runner/dataset infrastructure moved out of tree | yes | Closed/completed issues. The written range #571-#575 also covers #572, #573, and #574; all three exist, are closed/completed benchmark pillars, and support the range summary. |
| #578, #581, #584, #588, #589, #607, #616, #638, #642, #646, #648 | CLI surface, extraction API drift, UI cache restore, benchmark work/removal, README/docs work, and Explorer bundle work | yes | All are merged PRs. The bodies and file lists support the synthesis's narrower uses. |
| #658 | Changelog page and documentation navigation | partial | Merged PR. It did not merely create a page: its body and file list say it added the Changelog tab to `docs/docs.json`. That makes it prior art for the changelog-navigation part of draft issue 3. |
| #676, #682, #687, #700, #701, #704 | Guide-onboarding campaign | yes | All are merged PRs and their titles/bodies support the guide claims. The broader #682-#704 range is inaccurate because #684 is not a guide PR; see corrections. |
| #683 | Pipeline guide advertises `set_parallelism()` and excessive-parallelism guidance | partial | Merged PR. It supports the advertised API claim, not the separate runtime diagnosis that the engine executes sequentially. The synthesis later acknowledges this limitation. |
| #705, #726, #733, #738, #739, #740, #741, #743, #748, #749, #751, #752, #755, #757 | Ingest expansion, sqlite-vec, reasoning/explanation repairs, provenance defects, dual storage, migration docs, and RDF term hazards | yes | All are merged PRs except #733, which is a closed/completed issue. Bodies/comments support the attached claims. |
| #765, #766, #771, #774, #783, #787 | Reopened editable memory request; README drift; not-planned Explorer auth; SKOS cycles; success-shaped provenance failure; Explorer HTTP status repair | yes | Kinds and states match exactly. |
| #802, #805, #808, #809, #812, #814, #815, #816, #819, #820, #823, #825, #827 | Provenance persistence/audit campaign, Explorer SPARQL and docs, Anzo, atomicity, SKOS rejection, tombstones, and hash-chain work | yes | #825 is a closed/completed issue; the rest are merged PRs. #827 explicitly names invalidation tombstones, hash chaining, typed agents/activities, and the version-versus-derivation split. |
| #831 | Cookbook evidence for the ontology facade | partial | Open PR. It documents one stub `OntologyValidator`; it does not establish the synthesis's count of fourteen bare-pass facade methods. The synthesis correctly labels the exact count as packet-only. |
| #835, #837, #838, #841, #847, #853, #854 | Vector metadata/backend abstraction repairs and embedded Oxigraph details | yes | Merged PRs. #838 supports memory/path, named graphs, four SPARQL forms, and datatype/language preservation. #853 supports `{id, score, metadata, vector}` with missing vector as `None`. |
| #858, #862, #864, #870, #885, #888, #899, #904 | Broken provenance pipeline wrapper; chunker test gap/coverage; MCP version drift; stale vector scores; storage matrix | yes | #858, #864, and #888 are closed/completed issues; the rest are merged PRs. #899's file list lacks `docs.json`, supporting the storage-page navigation omission. |
| #870, #1134 | Packaged/root MCP split | partial | #870 proves two supported code surfaces both carried stale version text. #1134 proves 17 tools on root `mcp/` and persistence defects on both surfaces. Neither cited record establishes the packaged count of 12. |
| #905, #906, #910, #911, #918, #928, #941, #946, #955, #957 | SSRF/query hardening; v0.6.5 release; extraction defaults; vacuous tests; ContextGraph retraction/purge | yes | Kinds and states match. #918 also says it changed the FAQ's latest-version answer to v0.6.5. |
| #967, #968, #970, #988 | MCP persistence cousin; LangChain/CrewAI integration; ignored Oxigraph path | yes | All are open PRs. #967 and #970 support the stated persistence failures. |
| #994, #998, #1005, #1006, #1014, #1019, #1020, #1021, #1026, #1027, #1029, #1031 | Embedding fallback, spaCy load, recursion, doctor lie, parser/backend gaps, empty scanned PDF, exact merge, erasure, and vector-id collision | yes | Kinds and states match. Bodies/comments support the failure descriptions. |
| #1033, #1034, #1042, #1068, #1074 | System-level explainability docs, spaCy caching, mutable defaults, and cache alias poisoning | yes | #1033/#1034/#1042 are merged; #1068/#1074 are open. |
| #1075 | A gateway can silently swap the underlying model under one provider identity | no | Open PR. It adds a named OrcaRouter provider whose caller explicitly selects `provider/model`. It supports a need to record model identity, but contains no evidence of a hidden retry or model swap. |
| #1077, #1082, #1083, #1084, #1086, #1087 | RETE implementation; hash-namespace SHACL miss; SPARQL stub/refusal; alias preservation | yes | Kinds and states match. #1083 reports empty bindings; merged #1087 changes that to `NotImplementedError`. |
| #1090, #1091, #1092, #1095, #1096 | Live eval runner/objectives and rule-driven actions with provenance | yes | #1090/#1092/#1096 are open PRs; #1091/#1095 are open issues. Bodies support the gate-signal claims. |
| #1098, #1099, #1101, #1104, #1109 | Unescaped Turtle, invalid IRIs, unstable hash IDs, vacuous SHACL targets, and declared vocabulary | yes | Issue/PR kinds and states match. #1109 explicitly says the vocabulary contains fourteen terms. |
| #1115, #1116, #1120, #1122, #1123, #1124, #1125, #1127, #1129 | Alias repairs and RDF/OWL/SHACL/custom-method correctness campaign | yes | Kinds and states match. Bodies/comments support each attached defect or repair. |
| #1130, #1133, #1136, #1137, #1139 | Unfalsifiable SHACL docs, unwired evals, Neo4j edge loss, cross-type merge, empty vector save | yes | Kinds and states match. |
| #1143, #1145, #1147, #1148, #1149 | Constant stability metric, named-graph loss, wall-clock identity, Turtle escaping, and cross-type merge repair | yes | #1147 is a closed/completed issue; the rest are merged or open PRs as implied. |
| #1150, #1151, #1155, #1156, #1157, #1158 | Duplicate SHACL docs, broken MCP export, LangChain navigation, named-graph ingest, and Explorer/MCP format split | yes | All are open PRs. #1155 changes `docs.json` only for its LangChain page, as stated. |
| #1165, #1166, #1173, #1174, #1176, #1181, #1182, #1186, #1189, #1192 | Metadata preservation, independent RDF rejection, Neo4j edge repair, dead code, content IDs, SHACL docs/API, RDF4J repository fix | yes | Kinds and states match. #1182 is merged, while its duplicate doc PRs #1150/#1158 remain open. |
| #1191 | RDF4J ignored its `repository_id` constructor argument | yes | Closed/completed issue. It also supplies the upper issue boundary used in the census; merged #1192 is the matching repair. |
| #1207, #1208, #1212, #1213 | Structured conflict-value crash/repair, integration SSRF, and dropped generation kwargs | yes | #1207 is an open issue; #1208/#1213 are open PRs; #1212 is merged. Bodies support the claims. |
| #447, #755, #911, #1099, #1109, #1120, #1122, #1125, #1148, #1166, #1098 | The plain-string-to-RDF hazard examples | yes | Each body or comment supplies the corresponding invalid IRI, literal, datatype, or independent-parser evidence. |
| #815, #820, #970, #1006, #1020, #1021, #1082, #1084, #1104, #1124, #1127, #1129, #1139 | The success-shaped-failure examples | yes | The records describe success receipts, empty results, fallback, or `conforms: True` after the underlying operation failed or matched nothing. |
| #743, #783, #816, #825, #957, #1027 | The append-only/history hazard examples | yes | Bodies support overwrite, hard-delete, partial-write, or cross-store-erasure hazards. |
| #1029, #1101, #1136, #1147, #1173, #1181 | The unstable-identity examples | yes | Bodies support ID reuse, process hash, application/internal-ID mismatch, wall-clock IDs, and the corresponding repairs. |
| #400, #1020, #1074 | Span or qualifier loss examples | yes | The records support temporal loss, empty parsed text, and mutation of cached `start_char`. |
| #700, #701, #1137, #1149, #1207, #1208 | Winner-style merge and structured-conflict examples | yes | #700/#701 document winner-persisting APIs; the other records reproduce or repair cross-type and unhashable-value failures. |
| #433, #835, #841, #885 | Vector/metadata loss examples | yes | Raw bodies/comments support these examples. The adjacent #1075 model-swap wording is not supported, as noted above. |
| #246, #401, #741, #1165 | Provenance/lineage preservation examples | yes | The records support source/page/quote demand, temporal export loss, missed `derived_from`, and serializer metadata loss. |
| #1145 | `@id` beside `@graph` converts the payload into a named graph and loses 19 of 21 statements in a plain parse | yes | Merged PR body and comments support the exact example. |

No explicit citation number is missing from the raw dump. The citation problems are inference and attribution errors, not fabricated tracker IDs.

## Wrong or unsupported rows

### Dedupe table omitted #518

The first, second, and third Explorer drafts all concern the Ontology Registry, but the synthesis's nearest-match discussion skips closed issue #518, `[FEATURE] Registry, Loader, Entity Search, and SKOS Vocabulary Manager`.

Correction: cite #518 for all three drafts. It specifies a registry with URI and source URL, registry actions including remove, and `DELETE /api/ontology/{ontology_uri:path}` to remove an ontology from the active session graph. It does not report the exact implementation defects around implicit graph-backed entries, restart persistence, or empty-string keys, so it changes the first draft from `NOT-FOUND` to `PARTIAL`, remains a broader partial for persistence, and is only a nearest miss for source-URL fallback keying.

### Draft issue 3 understates #658

The synthesis says no lane found a `docs.json` omission issue and recommends posting the three-page issue as-is. Its own cited PR #658 says it created `docs/changelog.md`, added a Changelog tab to `docs/docs.json`, and expected the tab to appear in Mintlify navigation.

Correction: classify the combined draft as `PARTIAL`, not simply unreported. Rewrite it as two never-wired pages plus a changelog-navigation regression. Cite #658 as prior implementation for the changelog route, #899/#888 for `storage-backends.md`, and #751/#827 for the migration page.

### #1075 does not prove a hidden model swap

The port-hazard row says a gateway swaps the underlying model under one provider name and cites #1075. That PR adds OrcaRouter as a named provider and requires the caller to choose a model ID such as `openai/gpt-4o`. Its body contains no hidden retry, fallback, or model substitution.

Correction: say that a multi-model gateway makes `ModelIdentity` important. Do not claim #1075 demonstrates an undeclared swap.

### The 12-versus-17 MCP count is not established by the cited records

#1134 establishes 17 tools in root `mcp/` and comments establish that persistence is also broken in packaged `semantica-mcp`. #870 establishes that both code surfaces had stale version reporting. Neither establishes that the packaged surface has 12 tools. An uncited issue, #568, says the CLI manages an MCP server with 12 tools, but it does not by itself prove the packaged-versus-root comparison at the synthesis snapshot.

Correction: either add direct source-derived evidence outside the tracker and label it as such, or reduce the tracker claim to "two MCP surfaces with documented behavioral drift." Do not attribute the exact 12-versus-17 split to #870/#1134.

### #682-#704 is not a clean guide range

The synthesis says onboarding guides landed "as a set (#676, then #682-#704)." All numbers in that range exist and are merged, but #684 is `Add Knowledge Explorer deployment templates`, not a guide-onboarding PR. The remaining #682-#704 records are guide PRs.

Correction: use `#682-#683 and #685-#704`, or say "the #682-#704 run, except deployment PR #684."

### #683 is advertising evidence, not runtime evidence

#683 documents `set_parallelism()` and an excessive-parallelism pitfall. It does not state that the engine is internally sequential.

Correction: retain it only as evidence that Semantica advertises parallel execution. Keep the sequential-engine diagnosis sourced to the packet's code reading, as the later synthesis text already does.

### #831 supports one stub, not fourteen methods

#831 documents a stub `OntologyValidator`. It does not count fourteen bare-pass methods.

Correction: retain `PARTIAL` and state that the count and location come from the packet's source audit, not the tracker.

## Dedupe re-check

The searches covered title, body, and comments for `registry`, `persist`, `IRI`, `DELETE`, `session save`, the FAQ version terms, eval API class names, and the three docs/navigation subjects.

| draft | independent verdict | matching or near-matching tracker items | note |
| --- | --- | --- | --- |
| Explorer DELETE removes implicit graph-backed registry entries | **PARTIAL** | #518, with broader context in #517/#519/#520; implementation neighbors #787/#823; generic graph retraction #955/#957 | #518 already specifies registry removal and `DELETE /api/ontology/{ontology_uri:path}`. No record describes the exact bug where implicit graph-backed entries survive or leave nodes/edges behind. Post as an implementation-gap bug tied to #518, not as an entirely unreported removal concept. |
| Persist ontology registry and session graph across restarts | **PARTIAL** | #376, #518, #852, #967, #1134; non-duplicates #584/#802 | #376 requests graph checkpoint persistence, #518 defines the registry, #852 implements ContextGraph Markdown save/load, and #967/#1134 expose MCP persistence failures. No hit names `SEMANTICA_REGISTRY_PATH`, `POST /api/session/save`, or the Explorer registry sidecar. The exact patch remains distinct. |
| Key registry entries by source URL when no IRI is declared | **NOT-FOUND** | nearest #518, #1109, #1123 | #518 requires URI and source-URL fields and URL import, but says nothing about missing-IRI fallback keys or empty-string overwrites. #1109/#1123 concern RDF IRI minting, not Explorer registry identity. Post as-is, while cross-linking #518 for registry context. |
| FAQ lists v0.6.6 and v0.5.0 as latest | **NOT-FOUND** | #245, #646, #648, #808, #918, #1033 | #918 previously updated the FAQ's latest-version answer to v0.6.5; the others touch FAQ layout or unrelated content. None reports the current same-page v0.6.6/v0.5.0 contradiction. Treat it as a regression after #918. |
| Modules page shows runnable evals API while `semantica.evals` is a placeholder | **PARTIAL** | #228, #1090; broader eval work #570-#575, #607, #1091/#1092, #1133 | #228 reports the placeholder and #1090 replaces it with a different runner/registry API. No record names the four stale documented classes or the two-page contradiction. Commenting on #1090 is a defensible dedupe route while it remains open. |
| Three docs pages absent from `docs.json` navigation | **PARTIAL** | #658, #888/#899, #751/#827, #1155 | #658 is exact prior work for adding `docs/changelog.md` to navigation. #899 adds only the storage page; #751/#827 edit the migration page; neither set includes `docs.json`. #1155 shows the normal one-page nav change. Edit the draft before posting: call changelog a regression and keep storage/migration as never-wired pages. |

The inventory's zero `dedupes-our-draft` rows is not independent proof of novelty. The separate search found #518 and the stronger meaning of #658, neither of which the lane verdicts handled correctly.

## Coverage check

`explorations/semantica-lab/research/tracker/inventory.jsonl` has **725 rows and 725 unique numbers**. Every row has `number`, `kind`, `state`, `family`, and `disposition`. Titles, kinds, and reconstructed states match the 725 unique raw records.

The reported totals reproduce exactly:

- 330 issues and 395 PRs.
- 282 `CLOSED/COMPLETED` issues, one `CLOSED/NOT_PLANNED` issue, 47 open issues, 328 merged PRs, and 67 open PRs.
- 274 `map-evidence`, 88 `port-hazard`, 30 `gate-signal`, 14 `corroborates-finding`, and 319 `ignore`.
- The family-by-disposition matrix and the 88-row hazard breakdown both sum exactly as printed.
- Zero duplicate inventory numbers, zero missing required fields, and zero `dedupes-our-draft` dispositions.

No lane is entirely `ignore`. Ignore counts by lane are 64/141, 46/142, 115/158, 28/54, 34/116, 13/47, and 19/67. No family is entirely `ignore`, but two are almost so: `explorer-ui` is 80/81 ignore and `infra-deps` is 103/104 ignore. Their sole exceptions are #1157 and #1035 respectively. #1157 fits either `explorer-ui` or `mcp-integrations`; #1035 is a core configuration bug and is an arguable `other` rather than `infra-deps`. These are soft taxonomy anomalies, not count failures.

The inventory has a `lane` field, not a `shard` field. That does not affect the totals, but consumers should group by `lane`.

## Three things the synthesis missed

1. **#1211: category-filtered decisions are unreachable even before restart.** The open issue reproduces `record_decision(category=...)` followed immediately by `query_decisions(category=...) -> []`. `find_nodes()` returns category under `metadata`, while the MCP filter reads a top-level key. This is a separate same-process decision-query failure from #1134 persistence and #1140 similarity.

2. **#1140: decision embeddings are never populated, and similarity dies after reload.** The open issue reports `AgentContext.find_precedents()` always returning `[]`, `reasoning_embedding` and `node2vec_embedding` remaining `None`, and `ContextGraph.find_similar_decisions()` returning results only before a save/load round trip. This is material to decision intelligence and replay identity, but the synthesis does not cite it.

3. **#1159: policy evaluation errors are collapsed into a false compliance verdict.** The open issue shows `PolicyEngine.check_compliance()` swallowing internal exceptions and returning `False`, making "evaluation failed" indistinguishable from "evaluated and non-compliant." This is a high-value typed-error and audit-integrity hazard absent from the port-hazard summary.
