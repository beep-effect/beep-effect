# P6 map: agent surface (L7), write tools and the matter wall

Read-only measurement at f8cbd3c9f69. No source was edited. Paths are repo-relative. Effect APIs were checked against the v4 reference checkout (`effect` 4.1.5 in both `node_modules/effect/package.json:4` and `.repos/effect/packages/effect/package.json:4`). The P0 access-path map (`research/consumer-census.md:583-619`) was measured on an earlier base. Its rows are re-measured on this head below, and where the two differ, this map is the one to trust.

## 1. What P6 must deliver for L7 and the wall

| Source | Requirement |
| --- | --- |
| `PLAN.md:30` | MCP tools from the same schemas; write tools emit `proposed` only; matter-wall authorization scoped by the P0 access-path map; `MatterWall.two-matter.test.ts` in the law-practice server tests green; the write-tools-emit-proposed test green |
| `SPEC.md:292-295` | matter walls are authorization at seven access paths (retrieval, anchor resolution, graph query, search, cache, draft assembly, provenance traversal), never graph names; identical bytes in two matters never grant cross-matter access |
| `SPEC.md:458-470` | MCP tool schemas are the Effect schemas; write tools emit `proposed` only, proven by a test in the host package named in P0; the two-matter fixture composes the real server layer, loads identical bytes into two matters, and makes one assertion per access path |
| `research/2026-11-08-rebuild-report.md:298-306` | L7 contract: same schemas, prompts rendered from annotations, write tools never mint an admission, the L3 audit and SHACL run as a lint on any term an agent proposes, the attorney-facing invariant |
| `decisions/2026-11-19-p0-routing-annotation-asset-pack-and-write-tool-host.md` | the first claim-writing tool lives in `packages/law-practice/use-cases` beside the ReviewHub and claim tools; its success schema is a proposed-only record schema exported by `@beep/epistemics`; its test lives in the law-practice use-cases tests; mcp-kit `TierGate` stays the dispatch gate, unchanged |
| `decisions/2026-11-19-p0-item11-matter-wall-test-shape.md` | one `MatterAuthority` port in the law-practice slice; each of the seven paths calls it with a caller-independent principal; the two-matter test composes `LawPracticeServerLive` widened with the Practice KG host, the citation engine layer, the notice mailbox over the fake mailbox, and the record repositories over PGlite; P6 builds provenance traversal over annotation attribution and admissions, owned by the law-practice server |
| `decisions/2026-11-23-p5-the-gufo-pilot-types-the-legal-position-relator.md`, `research/2026-11-23-p5-design.md:634` | running the gUFO audit as a lint over agent-proposed terms is P6 work |
| `research/2026-11-23-p4-design.md:162`, `SPEC.md:1968` | P4 ships `admit` with an authenticated-principal port; P6 deploys the seven-path `MatterAuthority` |
| `decisions/2026-11-19-p0-admission-actor-is-the-principal.md` | the actor of an admission, challenge or retraction is the slice-supplied principal id, not an `AgentRef` |

## 2. MCP surfaces today

Every tool in the repository is an `effect/ai/Tool` value. Twenty-nine files under `packages` and `apps` call `Tool.make(` outside tests. The table covers every host that serves text-knowledge-adjacent records: claims, claim findings, review items, provenance, NLP analysis or ontology terms. Hosts that serve only USPTO, government-legal, M365, Box or setup tools are omitted, because they expose no annotation, claim, taxonomy or operation record.

| Host (served by) | Toolkit and tools | Hints | Dispatch gate | Schemas | Writes? |
| --- | --- | --- | --- | --- | --- |
| `apps/practice-kg-mcp` via `PracticeKgToolkitLayer` (`packages/law-practice/server/src/Tools.ts:126-131`) and lazily in `apps/practice-gateway` | `PracticeKgToolkit`, 13 tools (`packages/law-practice/use-cases/src/Tools.ts:38-52`): eleven KG/corpus tools plus `claim_self_check` and `claim_inspect_input` | all `readOnly: true, destructive: false, openWorld: false` (`PracticeKg.tools.ts:1173-1178`, `ClaimSelfCheck.tools.ts:134`, `ClaimInspection.tools.ts:48`) | `SourceAuth` registration only (`gatedLayer`); no `TierGate` | mixed, see section 3 | no |
| `apps/practice-review-hub` (`src/runtime/Layer.ts:69-91`) | `ReviewHubToolkit` (`ReviewHub.tools.ts:152`): `review_open_items`, `review_record_verdict`, `review_lock_batch`, `review_record_answer` | open items read (`:17`); the other three `readOnly: false, destructive: false, idempotent: false` (`:20-25`) | none: `sanitizedToolkit` plus an HTTP bearer-token and Tailscale-login allow-list middleware (`Layer.ts:36-55`); the login never reaches a handler | domain `VerdictRow`, `AnswerRow` (`@beep/law-practice-domain`), use-case `RecordVerdictInput` (`ReviewQueue.ports.ts:106-129`) | yes, three append tools |
| `packages/drivers/nlp-mcp` (`src/Server.ts:114-115`) | `NlpToolkit`, 26 tools (`nlp-processing/src/Tools/NlpToolkit.ts:145`) plus `StreamingToolkit` (7 tools, `StreamingTools.ts:1498-1649`) | only `WordCount` is annotated (`WordCount.ts:71-73`); the other 25 NLP tools take the `effect/ai/Tool` defaults `Readonly=false`, `Destructive=true` (`.repos/effect/packages/effect/src/ai/Tool.ts:2149-2179`) | none | tool-local (`Tools/_schemas.ts`); 25 of 26 NLP tools declare `success: S.toEncoded(...)` (for example `ExtractEntities.ts:87`) | in-memory corpus state only (`CreateCorpus`, `LearnCorpus`, `DeleteCorpus`, `LearnCustomEntities`) |
| ontology MCP (`packages/ontology/server/src/tools/OntologyToolHandlers.ts`, served by `packages/ontology/config` and `apps/professional-desktop/server/OntologyMcpTransport.ts`) | `OntologyToolkit` (9 tools), split into read-only, mutation and publish toolkits (`OntologyToolkit.ts:950-1006`) | mutating tools use `destructiveWriteToolHints`, others `readOnlyToolHints` (`:761-771`) | `dispatchWithTierGate` inside each mutation handler (`OntologyToolHandlers.ts:101,157-161`) and `CurrentMcpCaller` (`:83`) | domain `ChangeOperation`, `SessionChangeDelta` (`@beep/ontology-domain/aggregates/Session`, `OntologyToolkit.ts:11`) | yes: `ontology_propose_change_batch` applies and CAS-saves the batch (`:497-534`, `:840-852`); `ontology_repair`; `ontology_export_provenance`; `ontology_publish_provenance` |

No tool reads or writes a `@beep/annotation` record, a foundation `@beep/epistemics` claim record (`ClaimRecord`, `StanceRecord`, `Admission`), a P5 concept scheme or mapping set, or an L5 `Operation`. Across the `Tool.make` files, the only text-knowledge imports are `QuoteSelector` from `@beep/text/Selector` (`ClaimSelfCheck.tools.ts:16`), `PrefixMap` from `@beep/rdf/Rdf` (`OntologyToolkit.ts:12`), and three `@beep/nlp/Core/*` schemas in NLP tools (`TverskySimilarity.ts:9`, `LearnCustomEntities.ts:9`, `CreateCorpus.ts:9`). Those three move with Core in P6 (`research/consumer-census.md:168-171`).

## 3. "Same schemas": what holds structurally and what does not

Structurally, the claim holds for every tool. `sanitizedToolkit` (`mcp-kit/src/SanitizedSpan.ts:637-640`) renders `inputSchema` and `outputSchema` from the tool's own Effect schemas through `S.toJsonSchemaDocument` (`toolJsonSchema`, `:300-312`). The handler boundary decodes and encodes with the same codecs. No tool has a hand-written JSON Schema. The L7 gap is a different question: are the tool's schemas the domain schemas of the record they expose, or tool-local copies?

| Tool | Record exposed | Domain schema used? | Evidence |
| --- | --- | --- | --- |
| `kg_candidate_claims` | candidate claim | no: tool-local `PracticeKgCandidateClaimToolRow` with `startChar`/`endChar` as `S.Natural`, `digest`/`sourceDocumentDigest` as `S.String`, and `label: S.tag("candidate — unreviewed")` instead of a `@beep/text` anchor, a `SourceTextDigest` or an epistemics `Stance` | `PracticeKg.tools.ts:697-721`; not-loaded result `epistemic_status: S.tag("candidate-unreviewed")` at `:506`, a third spelling beside domain `PracticeKgEpistemicStatus` (`domain/src/values/PracticeKgEpistemicStatus/PracticeKgEpistemicStatus.model.ts:44`) |
| `kg_provenance` | node and document provenance | partly: domain `PracticeKgProvenanceKind` widened locally with `"bundle-manifest"` (`PracticeKg.tools.ts:45`) | `:1410-1415` |
| `claim_self_check` | claim findings | yes: domain `ReviewItem.cases["claim-finding"]`, `ClaimFindingCandidate`, `QuoteSelector` | `ClaimSelfCheck.tools.ts:13,16,96-102` |
| `review_*` | verdicts and answers | yes: domain rows and use-case port inputs | `ReviewHub.tools.ts:42-128` |
| NLP tools | tokens, sentences, entities | no: tool-local `AiToken`/`AiSentence` with `start`/`end` `S.Natural` "character offset" fields (`Tools/_schemas.ts:123-132,226-230`); success published as encoded-side only | `ExtractEntities.ts:82-88` |
| `ontology_*` | ontology change operations | yes | `OntologyToolkit.ts:11,497-534` |

The offset fields are the L1 debt the census already names for `CharPosition` (`consumer-census.md:169`). The `S.toEncoded` success schemas mean a client decoding the output does not get the domain codec back.

## 4. Writes today and what "write tools emit `proposed` only" requires

### 4.1 Write tools that exist

1. `review_record_verdict`, `review_lock_batch` and `review_record_answer` append attorney judgements (`ReviewHub.tools.ts:68-128`). The input carries no actor (`RecordVerdictInput`, `ReviewQueue.ports.ts:106-129`). The hub's HTTP middleware checks a bearer token and a Tailscale login (`apps/practice-review-hub/src/runtime/Layer.ts:36-55`), but neither value reaches the handler. Any agent connected to the hub can record a `right` verdict. The pure `VerdictProjector` maps `right` to `ClaimDisposition` `active` with reason "Attorney confirmed the finding" (`VerdictProjector.service.ts:30`, `VerdictProjector.schemas.ts:33,79`). Today no production composition runs the projector (`rg VerdictProjector` outside its directory and tests finds only the barrel, `use-cases/src/server.ts:368`, and a doc reference, `ReviewQueue.ports.ts:244`). The path from an MCP write to an admission-like disposition is therefore one composition step away.
2. `ontology_propose_change_batch` is named "propose", but it applies and saves the batch to the workspace ontology file with no proposed state (`OntologyToolkit.ts:497-534`). `TierGate` gates it. No L3 gUFO audit and no SHACL lint runs on the proposed terms.
3. NLP corpus tools mutate in-process wink state only. They persist no record.

No MCP tool writes a claim or an annotation. The P0 decision makes the same statement.

### 4.2 What P4 shipped that a proposed-only write tool can use

| P4 record | Where | Fit for the write tool |
| --- | --- | --- |
| `Stance = verbatim \| proposed \| admitted` | `epistemics/src/ClaimCore.schema.ts:64-68` | the lifecycle coordinate |
| `makeClaimCore(...).StanceRecord`: writable `Verbatim` and `Proposed` cases only; "admitted is not an input case" | `ClaimCore.schema.ts:228-235` | a write tool can return `StanceRecord.cases.Proposed` |
| `makeClaimRecords(...).ProposedClaimRecord = { claim, core, stance: "proposed" }`, "without admission authority" | `ClaimCore.schema.ts:267-285` | the "proposed-only record schema" the P0 decision names |
| `makeClaimArrows(...).promote` returns `{ claim, core, stance: "proposed" }` after verifying every support occurrence against the annotation document | `ClaimCore.ts:137-243` | the checked constructor a handler would call |
| `Admission`, `HumanAdmissionToken`, `makeAdmissionArrows(...).admit` with `AdmissionPorts.authenticate(scope)` | `ClaimCore.schema.ts:215-226`, `Admission.ts:280-302,440` | must be unreachable from the tool: the success schema has no `admitted` case, and the handler's context has no `AdmissionPorts` |
| `StanceEventView` restricted to `verbatim \| proposed` | `Admission.ts:65-71` | the stance write a tool may emit |

All of these are factories over a caller-supplied claim core. `@beep/epistemics` exports no concrete schema. The law-practice slice instantiates none of them: its only `@beep/epistemics` imports are `ClaimDispositionStatus`, `ClaimGate` and `EvidencePosition.schema`. The office-action review still builds on the `@beep/epistemic-domain` `CandidateClaim` and `@beep/epistemic-use-cases` gate and transition (`OfficeActionReview.service.ts:17-39`, `OfficeActionReview.flow.test.ts:1-2`). The current instantiations are party (`party/domain/src/entities/Claim/Claim.model.ts:20,148`), the CLI `Kb` and `Holds` stores, and epistemics test support. The write tool therefore depends on the law-owned claim core that the office-action flow completion also needs (`SPEC.md:75-78,463-465`).

### 4.3 What the test must prove

The test sits in `packages/law-practice/use-cases/test` (P0 decision). It has to show five properties:

- **(a) Success schema.** It decodes only `ProposedClaimRecord` or `StanceRecord.cases.Proposed`. Check this at the schema level: an `admitted` value refuses decode. Check it as a property over the toolkit: every non-read-only tool's success schema admits no `admitted` stance.
- **(b) No admission from the handler.** The handler cannot reach `admit`. Its requirement type excludes `AdmissionPorts` and the token verifier. The test runs the handler with a valid `HumanAdmissionToken` in the input and asserts that the output stance is `proposed`.
- **(c) No silent write.** A write against unverifiable support returns `ClaimCoreInvalid` (`ClaimCore.ts:56`) and appends nothing.
- **(d) Write hints.** The tool carries `readOnly: false, destructive: false`, so `fromApprovedToolsPolicy` refuses it unless it is approved (`TierGate.ts:419-428,471`).
- **(e) Schema export.** The JSON Schema published by `sanitizedToolkit` equals the one produced from `S.toJsonSchemaDocument` of the domain schema (the "same schemas" half).

## 5. The matter wall: seven paths re-measured

Scope today is `SourceTextIdentity.scopeRef` and repository `orgId` arguments. In this table, "authority" means a check of a caller-independent principal against the requested scope. No such check exists on any path. `rg MatterAuthority|MatterWall` over `packages` and `apps` finds nothing.

| # | Path | Owning code (this head) | Authorization today | Test layer today | What the two-matter test must assert |
| --- | --- | --- | --- | --- | --- |
| 1 | Source retrieval | port `SourceTextResolver` (`file-processing/src/SourceText/SourceTextResolver.service.ts:50`); `WorkspaceSourceTextResolver.ts:152-207` maps `workspace:<id>` to a vault; law callers `server/src/internal/Citation/SourceEvidence.ts`, `SourceRequest.ts`, `use-cases/src/CandorPolicy/CandorPolicy.service.ts:136` | scope must parse as a workspace and the vault must exist; no principal; 0 `scopeRef\|orgId\|matterId\|tenant\|authoriz` matches in `SourceEvidence.ts` | stubbed `SourceTextResolver.of` (`server/test/CitationSourceEvidence.test.ts:27-38`); `LawPracticeServerLive` reaches it through `FileProcessingLayer` (`server/src/Layer.ts:92`) | a principal authorized for matter A requesting matter B's identical bytes gets a refusal value, not text |
| 2 | Anchor resolution | `text/src/VerifiedTextAnchor.ts:594` (`expectedSource.scopeRef` equals `source.scopeRef`); `server/src/internal/Citation/SourceResolution.ts`, `ResolutionInput.ts`, `OccurrenceProjection.ts` | consistency check between two caller-supplied values; 0 scope matches in `SourceResolution.ts` | direct calls with no layer (`CitationMention.test.ts`, `CitationMentionIdentity.test.ts`, `CitationDocumentPersistence.test.ts`) | an anchor minted in A does not verify in B even though the quote and digest are equal; `OccurrenceId` and `CaptureId` already hash `scopeRef` (P3 capture decision, `SPEC.md:1539`) |
| 3 | Graph query | Practice KG over DuckDB: `server/src/PracticeKg.queries.ts`, `PracticeKg.tool-handlers.ts`, `PracticeKgHost/*`; served by `apps/practice-kg-mcp` (stdio, no auth) | none (0 matches in both files); matter is data (`kg_matter_lookup`); epistemic triage filters by a host-provided `ContradictionReviewScope` (`epistemic/server/src/ContradictionTriage/ContradictionTriage.layer.ts:108-144`, provided at `apps/professional-desktop/src/runtime/Layer.ts:255-266`) | `server/test/PracticeKgHost.test.ts:26,49` (`MemoryFileSystem` + `BunPath`); not in `LawPracticeServerLive` | a `kg_find`/`kg_candidate_claims` call under principal A returns no B rows |
| 4 | Search and vectors | BM25 `server/src/PracticeKg.fts.ts`; no vector index under `packages/law-practice/**/src` | none (0 matches) | `server/test/PracticeKg.projections.test.ts` | `corpus_search_text` for a phrase present in both matters returns only A's hits; no vector assertion until an index exists (P0 decision) |
| 5 | Cache lookup | citation session caches `server/src/internal/Citation/Resolve.ts`, `SessionDocument.ts`, `RuntimeDictionary.ts`, `RuntimeSet.ts` | keyed by resource identity and content, not scope (0 matches in `Resolve.ts`, `SessionDocument.ts`) | `server/test/CitationEngineLayer.test.ts:49,235` (`citationTokenizerTestLayer` + `BunCrypto.layer`) | resolving identical text in B after A gets no A cache hit (observable as a distinct receipt scope, or a counted miss) |
| 6 | Draft assembly | `server/src/NoticeMailbox/NoticeMailbox.layer.ts:303` (`m365.createDraftMessage`), `MailTagging/MailTagging.mailbox.ts`, `DocketIntake/DocketIntake.graph.ts`, `use-cases/src/ClaimSelfCheck/ClaimSelfCheck.service.ts` | none (0 matches); the mailbox identity comes from configuration | `server/test/NoticeMailbox.test.ts:61-62` (`makeNoticeMailboxLayer` over `fakeMailbox`) | a draft for matter A cannot quote or attach B's material; the fake mailbox records zero B content |
| 7 | Provenance traversal | no law-practice service; `kg_provenance` (`PracticeKg.tools.ts:1410-1415`) reads unscoped projection columns (`PracticeKg.projections.ts`); `rdf/src/Prov.ts`, `ProvRdf.ts` have no production consumer; epistemic evidence view scoped as in row 3 | none on the law-practice side | `packages/epistemic/server/test/integration/ContradictionTriage.pglite.test.ts:123` | P6 builds the traversal over annotation `Generation` attribution and P4 admissions (P0 item 11); traversing from an A claim never reaches a B activity or capture |

Repositories with an org column: `CandorRecord.repo.ts:99-109,251` and `LegalPositionRecord.repo.ts:107-138` filter on `scope.orgId`. In both, the `orgId` arrives as a caller-supplied `CandorFilingScope` or scope argument (`CandorRecord.repo.ts:150`), so they isolate tenants by parameter, not by authority. `OfficeActionStructure.repo.ts:32,108` keys history by `scopeRef` as a partition key.

**Principal sources that exist.**

- `McpCallerIdentity` carries transport facts only: `clientId` and an optional `sessionId` (`mcp-kit/src/McpCaller.ts:44-61`). `sanitizedToolkit` provides it per request (`SanitizedSpan.ts:564`). It names no person or matter.
- `GovernedTierGate` freezes a grant set per MCP session (`execution-authority/server/src/GovernedTierGate/GovernedTierGate.gate.ts:15-30,368`).
- `ContradictionReviewScope` is a `Context.Service` that the host provides (`epistemic/use-cases/src/ContradictionTriage/ContradictionTriage.ports.ts:86`). It is the existing precedent for a host-supplied, caller-independent scope.
- P4's `AdmissionPorts.authenticate(scope)` returns `Option<actor>` (`Admission.ts:285`).

**Layer reach.** `LawPracticeServerLive` (`server/src/Layer.ts:81-94`) composes `OfficeActionReview`, `IrToLaw`, `FileProcessingLayer`, the guarded LangExtract layer and `EpistemicServerLive`. `EpistemicServerLive` (`epistemic/server/src/Layer.ts:85-95`) brings an in-memory disposition repository and the `ContradictionTriageRepositoryFixture`. The test layer at `server/test/LawPracticeServer.test.ts:100-105` adds a stub model, a config provider and `BunCrypto.layer`. As the P0 census found, the server layer reaches only rows 1 and 2 plus the office-action path. Rows 3 to 7 require the widening that the P0 decision lists.

## 6. Law-practice test layout and fixtures

- **Server tests** (`packages/law-practice/server/test`): about 470 flat files, mostly `Citation*`. Fixtures are `fixture.ts` (synthetic office action, `OFFICE_ACTION_FIXTURE`, `makeOfficeActionReviewInput`), `officeActionFixtures.ts`, `UsptoClaims.fixture.ts`, `DocketIntake.fixture.ts`, `MailTagging.adapters.fixture.ts` and `fixtures/*.json[l]` (frozen receipts, attempt logs, review items). `test/integration/` holds only citation replays, which the config caps at two workers (`server/vitest.config.ts:28-43`). PGlite tests live at the top level, behind `makePgliteIntegrationGate()` with in-process PGlite plus `btree_gist`, migrated from `packages/_internal/db-admin/drizzle` (`CandorRecord.pglite.test.ts:58-69`).
- **Shard plan:** `server/vitest.shards.json` lists every unit file with a measured duration (599 entries). `test/vitest-shards-plan.test.ts` re-derives membership, so a new `MatterWall.two-matter.test.ts` must be added to the plan.
- **Use-cases tests** (`packages/law-practice/use-cases/test`): `ReviewHub.test.ts` drives the hub through `ReviewQueueLive` and `QuestionQueueLive`, not through MCP. `OfficeActionReview.flow.test.ts` (P3) has three layers: real extraction, missing label and unaligned label (`:125-185`). Fixtures sit under `fixtures/office-action-review`. mcp-kit publishes a conformance test kit at `@beep/mcp-kit/test/Conformance` (`mcp-kit/package.json:47`, `src/test/Conformance.test-kit.ts:78-374`), which can mount a toolkit over HTTP or stdio.

## 7. Inventories and gates touched

- New `src` files (the `MatterAuthority` port, the provenance traversal, the write tool, the law claim core) need 100% coverage (repo law).
- Spans on new functions follow `Concept(.Sub)*.action`. Shards are regenerated with `bun run beep observability catalog --write` for `@beep/law-practice-use-cases` and `@beep/law-practice-server`. Span attributes carry ids and counts, never `scopeRef` text (`SPEC.md:302-308`; `scopeRef` is matter text).
- A new law-practice slice concept needs `bun run beep architecture`.
- The server shard plan (section 6) and the schema catalog rows for new schemas are regenerated, not hand-edited.

## 8. Exit criteria mapped (L7 and wall halves)

| PLAN exit | Proof | Precondition found here |
| --- | --- | --- |
| write-tools-emit-proposed test green | section 4.3 test in `law-practice/use-cases/test` | a law claim core instantiating `makeClaimCore` / `makeClaimRecords`; a principal port |
| "MCP tools from the same schemas" | property (e) plus migration of `kg_candidate_claims` (and NLP offsets) to domain schemas, or a recorded scope cut | section 3 table |
| `MatterWall.two-matter.test.ts` green | seven assertions in section 5 | `MatterAuthority` port, provenance traversal, widened layer, a principal source that is not caller input |
| observability catalog current | regenerated shards | new spans in section 7 |

## Open questions

A1. Which concrete schema is "the proposed-only record schema exported by `@beep/epistemics`"? `@beep/epistemics` exports only the factories `makeClaimRecords`/`makeClaimCore`, and law-practice instantiates neither. Does P6 add a law-owned `ClaimCore` in `@beep/law-practice-domain` (shared with the office-action flow completion), or does epistemics export a core-agnostic proposed envelope?

A2. What does the first write tool do: promote verified annotations into a `ProposedClaimRecord` (`promote`, `ClaimCore.ts:137-243`), append a `StanceRecord.Proposed` for an existing claim, or both? Where is the record persisted? No law claim log table exists.

A3. Which MCP host serves the write tool? The decision names a package (`law-practice/use-cases`), not a server. `PracticeKgToolkit` is read-only by contract ("thirteen-tool read-only practice toolkit", `Tools.ts:25`). `ReviewHubToolkit` has no `TierGate`. Is the tool added to the review hub, or to a new toolkit, and which `TierGate` policy approves it?

A4. "TierGate stays the dispatch gate" holds only where a handler calls `dispatchWithTierGate` (ontology). `sanitizedToolkit` does not gate, and the review hub's three write tools run ungated. Does P6 put the new write tool behind `TierGate` in its handler (ontology pattern) and leave the hub's tools alone, or does it gate the hub's tools too?

A5. Do the existing review-hub writes fall under "write tools emit `proposed` only"? `review_record_verdict` records an attorney `right` with no actor, and `VerdictProjector` maps that to disposition `active`. Options: (a) out of scope, because a verdict is a review-item judgement and not a claim; (b) the hub writes stay, but a verdict carries the authenticated principal and never projects to `active` without a P4 `Admission`; (c) bind the hub's Tailscale login into handler context as the principal.

A6. Is `ontology_propose_change_batch` an L7 write tool? It saves immediately. Running "the L3 audit and SHACL as a lint on any term an agent proposes" (report L7; P5 gUFO decision) needs either a proposed state for change batches or a pre-save lint inside the handler. Which one, and is it in P6 scope or deferred by a decision?

A7. What is the caller-independent principal on each path? MCP gives only `McpCallerIdentity` (transport ids), and the review hub's login stops at middleware. Is the `MatterAuthority` principal a host-provided `Context.Service` (the `ContradictionReviewScope` precedent), the P4 `AdmissionPorts.authenticate` result, or a new law-practice `Principal` value? What type does it have (`SharedIdentity.UserId`, an org/user pair)?

A8. How does a matter map onto `scopeRef`? Workspace resolution parses `workspace:<id>` (`WorkspaceSourceTextResolver.ts:51,152`), the office-action review uses a matter fixture key, and repositories use `orgId`. Does `MatterAuthority.check(principal, scope)` take `scopeRef`, a typed `MatterId`, or both, with a declared mapping?

A9. Rows 3 and 4: the Practice KG is one DuckDB bundle over the whole practice, with matter as data, served over unauthenticated stdio. Is the wall enforced by filtering rows per matter inside the queries, or by building one bundle per matter? Must `apps/practice-kg-mcp` gain a principal at all, given that a stdio host is single-user?

A10. Row 5: should citation caches add scope to their keys (a partition, which changes cache identity), or keep content keys and re-check authority at read? What observable proves "no cross-matter hit": a counted miss, or a receipt whose `scopeRef` differs?

A11. Row 6: what counts as matter material in a draft? `NoticeMailbox` drafts docket notices from configuration, and `ClaimSelfCheck` emits caller-supplied claims. Which input to draft assembly carries a scope that the authority can check?

A12. Row 7: what is the shape of the P6 provenance traversal? Does it walk annotation `Generation` attribution (activity, capture) and P4 admissions? Does it replace or wrap `kg_provenance`'s unscoped projection columns, and is it exposed as an MCP tool?

A13. Repositories (`CandorRecord`, `LegalPositionRecord`): `orgId` is caller-supplied. Does the wall test count them under one of the seven paths (draft assembly? graph query?) and require `MatterAuthority` to supply the scope, or are they out of the seven-path set?

A14. Does `kg_candidate_claims` migrate to domain schemas in P6? Candidates: a `@beep/text` anchor or receipt for `startChar`/`endChar`, `SourceTextDigest` for the digests, and `Stance`/`PracticeKgEpistemicStatus` for the two hand-spelled labels. The same question applies to NLP `AiToken`/`AiSentence` offsets and the `S.toEncoded` success schemas. Is that a P6 move with Core, or a recorded scope cut?

A15. Should the two-matter test run under the PGlite gate (`makePgliteIntegrationGate`) like the record-repository tests, given that a gated skip would leave the P6 exit "green" on a host without PGlite? Should it go in the unit shard plan or in `test/integration/`, which is reserved for citation replays at two workers?

A16. What name and location should the write-tools-emit-proposed test have? The PLAN gives no filename. Proposed: `packages/law-practice/use-cases/test/WriteTools.proposed-only.test.ts`, asserting property (a) over every non-read-only tool of every law-practice toolkit, not only the new one.
