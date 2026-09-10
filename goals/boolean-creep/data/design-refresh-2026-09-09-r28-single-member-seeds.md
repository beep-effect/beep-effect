# R28 single-member seed owner adjudication

Frozen source HEAD: `93217d998f851e2e93d9864e2b5315552eaa58a7`.
Corpus reference: `origin/main` at `d1b4d769fbaffddd55717f3b1ba461897dd545c5`.

This native P2 audit examines the eleven current records whose `members` list has fewer than two entries. It does not treat list length as eligibility proof. The complete declared owners, inherited fields, constructor contracts, and consumers produce **three definite D1 member repairs, two conditional Boolean-plus-literal D1 repairs, one conditional real 10/5 correlated owner, and five out-of-net withdrawals**. No canonical row or status is changed. No independent correction, census, or P3 result is claimed or dispatched.

Inventory snapshot: `goals/boolean-creep/data/inventory.jsonl`, 829 records, SHA-256 `4f1db0cacb616281fe14ed3fc15ee00c097673109596182189df58e1dbc3b4ea`. All eleven audited rows are disqualified D1 in those bytes. The parent is integrating unrelated records concurrently; use stable IDs rather than snapshot row numbers.

## Rule and action boundary

`SPEC.md:33–40` starts the net with at least two Boolean members, including sibling Boolean state, and excludes function flag parameters. `DECISIONS.md:105–128` supplies E1–E4 and D1/D2; actual Option and finite literal alternatives must be retained when adjudicating a real correlated owner. A required number/string/array cannot become a fictitious Boolean predicate. Nested fields from a required child object cannot be silently moved into a parent carrier.

A lone Boolean does not become a qualified pair merely because the owner also contains ordinary required payloads or unrelated optional inputs. Conversely, a declared `Option<boolean>` is an actual three-valued Boolean member, and a real finite discriminator must be examined rather than discarded. The three inherited-Boolean repairs are directly within the two-Boolean owner rule. The graph, locator-space and SPARQL-profile records explicitly require the current minimal Boolean-plus-literal eligibility adjudication: this audit supplies exact conditional records, not a blanket admission or withdrawal of those three cases.

D2 is reserved for external SDK/API/DB mirrors. An app-owned RPC request or a domain model described as ported from eyecite is not automatically an external driver mirror. No D2 reclassification is proposed.

| Stable ID | Complete candidate members | Native disposition |
| --- | --- | --- |
| `named-graph-partition-excluded` | `excludedFromReasoning: boolean`, `partition: GraphPartition` (five literals) | Hold for bounded independent eligibility confirmation; actual derived relation is 10/5. Do not retain the current single-member D1 explanation as adequate. |
| `neutral-citation-unpublished` | `unpublished: boolean`, inherited `inFootnote: Option<boolean>` | Retain D1, repair members and owner anchor; all six semantic constructor cases are independent. |
| `statute-citation-has-et-seq` | `hasEtSeq: boolean`, inherited `inFootnote: Option<boolean>` | Retain D1, repair members and owner anchor; all six cases. |
| `regulation-citation-has-et-seq` | `hasEtSeq: boolean`, inherited `inFootnote: Option<boolean>` | Retain D1, repair members and owner anchor; all six cases. |
| `durable-locator-options-full-span` | `fullSpan: boolean`, `space: original | clean` | Conditional minimal Boolean-plus-literal D1 repair; full product 4/4. No qualification gap. |
| `table-block-header-row` | Only `headerRow?: boolean`; fixed tag and required rows do not add a member | Withdraw/archive out of net. |
| `evidence-source-panel-loading` | Only `loading?: boolean | undefined` on actual `EvidenceSourcePanelProps` | Withdraw/archive out of net; preserve complete required page/highlight props. |
| `vault-sync-status-input-force-probe` | Only `forceProbe: boolean`; required workspace identity | Withdraw/archive out of net. |
| `get-vault-sync-status-payload-force-probe` | Only `forceProbe: boolean`; inherited required workspace identity | Withdraw/archive out of net. |
| `ontology-sparql-query-request-include-inferred` | `includeInferred: boolean`, `profile: select | construct` | Conditional minimal Boolean-plus-literal D1 repair; full product 4/4. No qualification gap. |
| `validate-ontology-request-include-inferred` | Only `includeInferred: boolean`; two unrelated Option inputs and required path | Withdraw/archive out of net; do not import a different call's inference result into this owner. |

## NamedGraphPartition: actual finite relation, conditional 10/5 proposal

`packages/ontology/domain/src/aggregates/Session/Session.model.ts:244–254` declares exactly four fields: `partition: GraphPartition`, `graph: NamedNode`, `dataset: Dataset`, and `excludedFromReasoning: S.Boolean`. `GraphPartition` is the actual `LiteralKit([asserted, ontologies, inferred, shapes, provenance])` at `Session.values.ts:75–79`, not an invented two-state partition predicate. Required `graph` and `dataset` stay full payloads; graph-IRI equality, dataset emptiness and quad count are not additional axes.

The single production helper `makeNamedGraphPartition` at `Session.model.ts:1008–1014` constructs graph IRI, complete dataset and exclusion from the same partition. The exclusion function at `Session.values.ts:140–147` has the complete mapping below. `deriveNamedGraphs` at `Session.model.ts:1040–1049` calls the helper once for every member, so the complete five-state relation is reached, including empty datasets. The public constructor example at `:231–236` is consistent; generic schema ability to manufacture a contradictory Boolean is not evidence of a legitimate alternative.

| partition | excludedFromReasoning |
| --- | --- |
| asserted | false |
| ontologies | false |
| inferred | true |
| shapes | true |
| provenance | true |

This is 5×2 representable versus 5 legal; the current note that “the enum is the state variable” actually identifies the redundancy. The native evidence class is E4 as a finite state implication/derivation. It is not E3 presence duplication: the discriminator is required. The callable `isExcludedFromReasoning` is a producer/helper, not itself a record member.

The test `packages/ontology/domain/test/Session.test.ts:151–165` creates a session, derives five named graphs, and checks every exclusion mapping. It does not directly assert all five output Booleans, but the production `.make` argument at `Session.model.ts:1013` closes that mapping proof. This audit does not execute the test.

All known current named-owner uses were searched after Graft: the helper/constructor examples, public `deriveNamedGraphs`, and that test are the only literal-name occurrences. `aggregates/Session/index.ts:14` exports the schema/derivation, `src/index.ts:45,52` exposes the aggregate and direct exports, and package `package.json:35–40` publishes the Session facade. No current RPC/persistence encoding of `NamedGraphPartition` or production consumer of its Boolean was found. That limits the native exposure recommendation to derived/internal with a real exported decoded TypeScript surface, not a claim of no exports.

If independently admitted, preserve the stable ID and reuse `GraphPartition` rather than inventing a new five-name vocabulary. A later design must decide the minimal removal/derivation of the redundant field, preserve the full graph/dataset payloads, review existing exported schema/derivation consumers, and count removal of this output field/producer assignment honestly. Zero downstream Boolean readers means there is no downstream guard wall to claim. No design is authored by this audit.

## Three citation owners: inherited Option<boolean> was omitted

All three models spread the actual `CitationBase.fields`: `NeutralCitation.model.ts:58`, `StatuteCitation.model.ts:57`, and `RegulationCitation.model.ts:54`, under `packages/law-practice/domain/src/values/<Concept>/`. That base has `inFootnote: S.Boolean.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault)` at `CitationBase/CitationBase.model.ts:132–137`. Its full domain is `None`, `Some(false)`, `Some(true)`, denoting absent footnote detection, detected body text, and detected footnote. Missing encoded keys become `None`; a supplied false remains `Some(false)`.

The inherited owner is not merely its marker field. Complete base fields at `CitationBase.model.ts:61–145` are required `text`, `span`, `confidence`, `matchedText`, `processTimeMs`, `patternsChecked`; default-empty `warnings`; and Option `id`, `signal`, `stringCitationGroupId`, `stringCitationIndex`, `stringCitationGroupSize`, `stringCitationGroup`, `inFootnote`, `footnoteNumber`. Full payloads and nested values remain; none is collapsed into a new bit. `footnoteNumber` is a separate optional locator, not renamed to presence of the Boolean. The existing `citation-base-in-footnote` row belongs to the shared base pair and is not duplicated or changed here.

- **NeutralCitation**, `NeutralCitation.model.ts:56–126`: fixed `type=neutral`; required nonnegative `year` and `documentNumber` string; default-false `unpublished`; Option string `court`, `database`, `caseName`; Option nonnegative `pincite`; Option `PinciteInfo`, `StructuredDate`, and `NeutralComponentSpan`. The marker records an Illinois -U suffix already stripped from documentNumber (`:82–85`). `court`/`database` have their own source descriptions, but neither presence duplicates unpublished: the explicit true constructor at `test/LawPracticeDomain.test.ts:644–649` omits both. Preserve both complete Options; this audit does not reclassify that independent locator relation.
- **StatuteCitation**, `StatuteCitation.model.ts:55–169`: fixed `type=statute`; default-false `hasEtSeq`; Option nonnegative `title`, `year`, `recompiledYear`; Option string `code`, `section`, `chapter`, `subsection`, `jurisdiction`, `pincite`, `publisher`, `editionLabel`; Option `{ start: string, end: string }` section/subsection ranges; Option `StatuteComponentSpan`. The et-seq marker at `:124–128` does not require or erase any locator. The true constructor at `test/LawPracticeDomain.test.ts:650–653` leaves those optional locators absent.
- **RegulationCitation**, `RegulationCitation.model.ts:52–163`: the same complete optional locator domains and range/span payloads, fixed `type=regulation`, and default-false `hasEtSeq` at `:119–123`. The true constructor at `test/LawPracticeDomain.test.ts:654–657` likewise leaves optional locators absent.

For each marker, the complete legal product is:

| Marker | inFootnote | Contract interpretation |
| --- | --- | --- |
| false | None | Marker absent; no footnote detection result supplied. |
| true | None | Marker present; no footnote detection result supplied. |
| false | Some(false) | Marker absent in detected body text. |
| true | Some(false) | Marker present in detected body text. |
| false | Some(true) | Marker absent in detected footnote text. |
| true | Some(true) | Marker present in detected footnote text. |

D1 here is based on the **explicit composition of two independently described detection contracts**, not just an unguarded schema accepting arbitrary malformed values: the shared base documents footnote detection independently of subtype, each subtype deliberately spreads it unchanged, and each subtype's marker describes different matched-text syntax. A citation with or without -U/et-seq can occur in body or footnote text; leaving detection unperformed does not change its syntax marker. No constructor, subtype check, or reader couples these observations. Graft's complete law-practice matches show schemas and constructor tests, not an implemented per-type extractor assigning a restricted combination; do not invent an upstream extractor contract or claim this is an external SDK boundary.

Proof limits are explicit: `test/LawPracticeDomain.test.ts:486–492,513–515,644–657,690–692` supplies actual default/false and true subtype constructors, with inherited inFootnote omitted. These establish the two None cases and absence of a marker-to-locator requirement. The other four are supported by the inherited constructor contract and independent field meanings, **not four additional executed fixtures**. No six-case test run is claimed. The proposed notes retain that distinction for independent review; if a future real producer narrows this domain, re-adjudicate it rather than silently treating None as false now.

## DurableLocatorOptions: preserve the real space alternatives

`packages/law-practice/domain/src/values/DurableLocatorOptions/DurableLocatorOptions.model.ts:16` declares `DurableLocatorSpace = LiteralKit([original, clean])`. The shared fields at `:18–31` are default-false Boolean `fullSpan` and nonnegative `contextLength`, default 32. The actual owner at `:60–85` builds two schema arms, both explicitly spreading those same fields, and converts them to a tagged union on `space`. The encoded default is `original`, not clean (`:38–39,64–68`).

The candidate minimal pair is `[fullSpan, space]`, with all four legal tuples: `(false, original)`, `(true, original)`, `(false, clean)`, `(true, clean)`. The arm construction itself explicitly preserves the identical span option in each coordinate space; no predicate couples them. The documented span rule is “use fullSpan when present, else core span” (`:19–23`), regardless of coordinate space. This object has no citation/span payload: the payload being selected belongs to the locator consumer's separate input. Do not invent a co-carried `fullSpan` presence field or an axis from numeric context length.

`test/LawPracticeDomain.test.ts:502,524,563,587–590` proves original/false/32 defaults; `:675–702` constructs clean/true/64. These are two actual fixtures, not four executed cases. The independent cross-combinations are deliberately supported by the identical field contracts in both explicit union arms. There is no current implemented `toDurableLocator`/`toDurableLocators` consumer in the bounded law-practice source search; their names occur in the option documentation. Do not infer hidden runtime restrictions from those names.

Conditional on minimal Boolean-plus-literal census eligibility, retain D1 with `[fullSpan, space]` and anchor the actual union at line 60. This is 4/4, not a new qualified union proposal; the space union already exists. If that eligibility rule excludes independent single-Boolean/literal pairs, withdraw the census row instead, preserving source behavior. No part of this audit chooses a new locator model.

## TableBlock and EvidenceSourcePanel: required payloads are not extra members

**TableBlock.** `packages/agents/domain/src/values/AssistantContent/AssistantContent.model.ts:520–533` has fixed `type=table`, optional Boolean `headerRow`, and required `rows: RectangularTableRows`. Its complete scalar domain is omitted/false/true; it is not two sibling flags. `RectangularTableRows` at `:459–485` enforces at least one row, nonzero cell width and rectangularity for every header setting. Row existence is therefore not a second absent/present member; nested text-style Booleans belong to their own inline owners. `AssistantContent.behavior.ts:114–121` preserves the complete rows and projects `headerRow === true` to Markdown; server `AnthropicTurnCodec.ts:108–117` validates row shape independently of that flag. Existing `AgentsDomain.test.ts:237,320,339,355` and `AnthropicTurnCodec.test.ts:42` cover table data/validation; no new presence invariant is inferred. Withdraw the single-member census row, preserving optional-key encoding and renderer behavior.

**EvidenceSourcePanel.** The actual named owner is `EvidenceSourcePanelProps` at `packages/epistemic/ui/src/ContradictionTriage/EvidenceSourcePanel.tsx:35–40`, not the component function recorded as the symbol. It has required `highlight: EvidenceSourceHighlight`, required `page: EvidenceSourcePage[page]`, callback `onPageChange`, and only `loading?: boolean | undefined`. The destructure defaults loading false at `:70–75`.

The child payloads are not Options: `packages/epistemic/use-cases/src/ContradictionTriage/ContradictionTriage.rpc.ts:276–291` gives the highlight's required source and offsets, and `:343–358` gives required `page: SourceTextPage`. Page navigation Booleans live inside that different child schema. The parent does not co-declare them as loading siblings. In `ContradictionTriageView.tsx:1068–1086`, the panel is mounted only in the AsyncResult success branch with a complete page; waiting is passed independently as loading. `EvidenceSourcePanel.tsx:113,125,137–140` combines loading with child navigation facts and marks the retained page busy; loading is not a page-presence flag. The test `test/EvidenceSourcePanel.test.tsx:28–51` supplies required page/highlight while omitting loading. Withdraw the out-of-net row; record the correct props anchor here without fabricating a replacement census owner or flattening nested fields.

## Vault status requests: one Boolean each, including the inherited RPC owner

`packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts:230–244` declares only `forceProbe: BoolKeyDefaultFalse` and required branded `WorkspaceIdentity.WorkspaceId`. `Sync.rpc.ts:116–127` extends `VaultSyncWorkspacePayload`; the base at `:41–50` contains only the same required workspace identity. The RPC subclass adds only forceProbe. Missing encoded keys and omitted constructor flags default false; explicit true requests remain supported (`Sync.rpc.ts:93–98`). No scalar-ID equality/zero test invents another member.

Actual producers and consumers preserve the independent request contract: `packages/documents/use-cases/test/Sync.test.ts:226–232` covers default service/RPC requests, omitted-key decoding and explicit true; `apps/professional-desktop/src/sync/Sync.atoms.ts:266` constructs the retry payload with true; `VaultSyncOrchestrator.ts:85–89` passes both fields into the service request. `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1513–1548` uses workspaceId for reads and forceProbe only to choose refreshed versus cached availability. The `connected` result written at `:1554` belongs to `VaultSyncStatus`, not either input; the existing `vault-sync-status-connected` qualification remains separate. Withdraw both single-member rows. Their app-owned wire status does not make them D2 external mirrors.

## Ontology tool requests: profile pair versus unrelated optional inputs

`packages/ontology/use-cases/src/tools/OntologyToolkit.ts:28–29` defines both `sessionHandle` and `baseIri` as `Option<NonEmptyString>`, encoded as optional keys and defaulting None. Those full Options are retained in both requests; a nonempty string Some is not collapsed into a synthetic required-string equality bit.

**OntologySparqlQueryRequest**, `:430–443`, has required path, the two Options, real `profile: select | construct`, required nonempty query, and default-false includeInferred. The candidate minimal pair `[includeInferred, profile]` has all four legitimate choices: false/select, true/select, false/construct, true/construct, with a query matching its selected profile and a supported ontology. `OntologyToolService.ts:494–508` opens the ontology, chooses inference from includeInferred without consulting profile, and independently forwards profile and query to `RunOntologySparqlInput`. No consumer requires one profile for inferred data. The domain runner at `Session.sparql.ts:162–180,526–537` likewise chooses the dataset from includeInferred/inference independently of query profile.

The actual tool tests at `packages/ontology/server/test/OntologyTools.test.ts:101–105,226–230,264–268` exercise select with the false default. They do not execute all four combinations. The full 4/4 recommendation comes from the actual service construction/independent reader behavior and complete accepted profile domain, not a claim of additional test coverage. Conditional on minimal Boolean-plus-literal eligibility, retain D1 with the corrected pair and class anchor line 430; otherwise record a scope withdrawal after that rule is resolved. Do not qualify a profile/inference state machine.

**ValidateOntologyRequest**, `OntologyToolkit.ts:512–523`, has path, baseIri Option, sessionHandle Option and the sole default-false includeInferred Boolean. `OntologyToolService.ts:106–129` opens a file using path/baseIri without coupling them to inference; it does not read sessionHandle. `:522–527` passes the Boolean to `validateSession`, which at `:280–291` constructs a separate `RunOntologyValidationInput` with inference Some/None. The required session in that other request and its optional inference do not become fields of ValidateOntologyRequest. `OntologyTools.test.ts:107,326` constructs validation requests with omitted includeInferred. No E3 duplication of baseIri or sessionHandle is present; do not widen the record to unrelated Options merely to manufacture a pair. Withdraw the single-member seed.

The separate existing `run-ontology-sparql-input-inferred` D1 pair is preserved: this tool path constructs inference Some iff true, but the broader runtime owner also has the workbench cached-inference producer. This audit neither narrows that owner nor duplicates its existing record under the tool request. The validation helper's anonymous Boolean parameter is not a substitute owner.

## Exact proposed records and parent actions

The next block contains **five replacement D1 rows**. The first three are inherited-Boolean repairs; the last two are conditional on the pending minimal Boolean-plus-literal net ruling. They are proposals in this audit, not inventory writes or independent verdicts. The D1 notes explicitly distinguish complete supported contracts from existing executed fixtures.

```jsonl
{"schemaVersion": "boolean-creep-inventory/v1", "id": "neutral-citation-unpublished", "file": "packages/law-practice/domain/src/values/NeutralCitation/NeutralCitation.model.ts", "line": 56, "symbol": "NeutralCitation", "kind": "schema-struct", "members": ["unpublished", "inFootnote"], "status": "disqualified", "disqualifier": {"class": "D1", "note": "Full owner spreads CitationBase.fields, including inFootnote: Option<boolean> with None, Some(false), Some(true), at CitationBase.model.ts:132-137. The -U marker is a separate default-false parse fact; footnote detection is independent. All six marker/detection tuples are legitimate constructor-contract combinations. Default and explicit-true NeutralCitation constructors are exercised at LawPracticeDomain.test.ts:486-490,644-649; these fixtures leave inFootnote None and do not constitute six executed tests. Required documentNumber and other optional locators are preserved, not promoted to Boolean axes."}}
{"schemaVersion": "boolean-creep-inventory/v1", "id": "statute-citation-has-et-seq", "file": "packages/law-practice/domain/src/values/StatuteCitation/StatuteCitation.model.ts", "line": 55, "symbol": "StatuteCitation", "kind": "schema-struct", "members": ["hasEtSeq", "inFootnote"], "status": "disqualified", "disqualifier": {"class": "D1", "note": "Full owner spreads CitationBase.fields, including inFootnote: Option<boolean> (None/Some(false)/Some(true)); hasEtSeq is the independent default-false trailing-text marker. All six marker/detection combinations are legitimate under these explicitly composed field contracts. Existing constructors prove false/default and true with optional locators absent (LawPracticeDomain.test.ts:491,650-653); they do not execute the full six-case matrix. Preserve every Option payload, including None versus Some(false), and do not infer footnote number or locator presence from hasEtSeq."}}
{"schemaVersion": "boolean-creep-inventory/v1", "id": "regulation-citation-has-et-seq", "file": "packages/law-practice/domain/src/values/RegulationCitation/RegulationCitation.model.ts", "line": 52, "symbol": "RegulationCitation", "kind": "schema-struct", "members": ["hasEtSeq", "inFootnote"], "status": "disqualified", "disqualifier": {"class": "D1", "note": "Full owner spreads CitationBase.fields, including the three-valued Option<boolean> inFootnote. The default-false et-seq marker is independent of whether footnote detection was disabled, detected body text, or detected a footnote. All six combinations are legitimate constructor-contract cases; current direct tests at LawPracticeDomain.test.ts:492,654-657 cover default/true marker values with inherited inFootnote omitted. Preserve all locator Options and do not conflate None with Some(false)."}}
{"schemaVersion": "boolean-creep-inventory/v1", "id": "durable-locator-options-full-span", "file": "packages/law-practice/domain/src/values/DurableLocatorOptions/DurableLocatorOptions.model.ts", "line": 60, "symbol": "DurableLocatorOptions", "kind": "schema-struct", "members": ["fullSpan", "space"], "status": "disqualified", "disqualifier": {"class": "D1", "note": "Conditional minimal Boolean-plus-literal census owner: fullSpan is default-false Boolean; space is the real original|clean LiteralKit discriminator. Both explicitly constructed tagged-union arms spread the same fullSpan field (DurableLocatorOptions.model.ts:60-81), so all four combinations are legitimate independent options. Defaults are original/false/contextLength 32, and the clean/true override is an explicit constructor fixture at LawPracticeDomain.test.ts:675-702. contextLength is a required nonnegative numeric payload, not a zero/nonzero axis; no domain operation or consumer couples span extent to coordinate space."}}
{"schemaVersion": "boolean-creep-inventory/v1", "id": "ontology-sparql-query-request-include-inferred", "file": "packages/ontology/use-cases/src/tools/OntologyToolkit.ts", "line": 430, "symbol": "OntologySparqlQueryRequest", "kind": "schema-struct", "members": ["includeInferred", "profile"], "status": "disqualified", "disqualifier": {"class": "D1", "note": "Conditional minimal Boolean-plus-literal census owner: includeInferred defaults false and profile is the real select|construct domain. OntologyToolService.ts:494-508 independently derives optional inference from the Boolean and passes through profile/query; neither profile is gated by inference inclusion. All four combinations are legitimate with a query matching its requested profile and a supported ontology. Existing OntologyTools.test.ts:101-105 exercises select/default-false, not all four cases. Preserve full baseIri/sessionHandle Options and query/path payloads; the derived inference Option belongs to RunOntologySparqlInput, not this request."}}
```

The following is the **conditional qualified replacement proposal** for the surviving NamedGraphPartition stable ID. `status: confirmed` describes the proposed row shape after parent/independent admission, not current campaign state. Current inventory remains D1 until that adjudication. Route this case with the planned epistemic/ontology owner correction, not a separate census or an extra correction call.

```jsonl
{"schemaVersion": "boolean-creep-inventory/v1", "id": "named-graph-partition-excluded", "file": "packages/ontology/domain/src/aggregates/Session/Session.model.ts", "line": 244, "symbol": "NamedGraphPartition", "kind": "schema-struct", "members": ["excludedFromReasoning", "partition"], "status": "confirmed", "evidence": [{"class": "E4", "cite": {"file": "packages/ontology/domain/src/aggregates/Session/Session.model.ts", "line": 1013}, "note": "The actual NamedGraphPartition carries required GraphPartition and Boolean excludedFromReasoning. makeNamedGraphPartition derives the Boolean from that same partition; Session.values.ts:140-147 maps asserted/ontologies to false and inferred/shapes/provenance to true. deriveNamedGraphs at Session.model.ts:1040-1049 constructs all five cases. This is the finite literal/Boolean relation, not a predicate function as a member or an invented required-payload equality bit."}], "cardinality": {"representable": 10, "legal": 5}, "storage": "derived", "exposure": "internal", "targetShape": "literalkit", "tier": 1, "notes": "Native unadmitted proposal only, conditional on the bounded independent eligibility adjudication. Retain stable id and reuse existing GraphPartition; no new phase vocabulary. All complete graph NamedNode and dataset Dataset payloads remain. The public decoded schema/deriveNamedGraphs exports and test consumer require review; no serialized NamedGraphPartition consumer was found. Frozen source 93217d998f851e2e93d9864e2b5315552eaa58a7; origin/main d1b4d769fbaffddd55717f3b1ba461897dd545c5."}
```

The unconditional out-of-net action set is:

```json
{
  "action": "archive-and-withdraw-out-of-net",
  "sourceSha": "93217d998f851e2e93d9864e2b5315552eaa58a7",
  "originMainSha": "d1b4d769fbaffddd55717f3b1ba461897dd545c5",
  "ids": [
    "table-block-header-row",
    "evidence-source-panel-loading",
    "vault-sync-status-input-force-probe",
    "get-vault-sync-status-payload-force-probe",
    "validate-ontology-request-include-inferred"
  ]
}
```

Parent should preserve old row bytes in its integration receipt/archive, replace the three inherited-Boolean records, and withdraw the five proven single-member owners. Hold the three finite-literal cases for the pending rule/owner adjudication; their concrete conditional rows above allow that correction to settle source eligibility and cardinality together. Do not admit NamedGraphPartition and also retain its old single-member D1 record. No design, source migration, or implementation is requested by this audit.

## Frozen-source receipts and validation

The following current source files were read for the eleven owners and their inherited/finite domains. Each SHA-256 was calculated from current bytes and each file was compared with `git show HEAD:<path>`; all match the frozen source.

| Source file | SHA-256 |
| --- | --- |
| `packages/agents/domain/src/values/AssistantContent/AssistantContent.model.ts` | `2cce3dc0e2f31c3a5cdb91f2ec84573998c29b855dff67320a571b36bd81d1bc` |
| `packages/documents/use-cases/src/aggregates/Sync/Sync.rpc.ts` | `2ece68d2bc8c820f80e9efa2daa22866111f86e218c1b807a5151d14f89e3522` |
| `packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts` | `6bd7223acd3c8b572b92cba3a7878a4e595dc96dda24e2ebe588fb09d09eaf68` |
| `packages/epistemic/ui/src/ContradictionTriage/EvidenceSourcePanel.tsx` | `78de8a376b64d29e2486cb7171438d732aa6d6283750852c4fa89dccaef92da7` |
| `packages/law-practice/domain/src/values/CitationBase/CitationBase.model.ts` | `3b9077514cae683d5df5c6e60b6ca6f5fd3c89913750141e58a40126c333a175` |
| `packages/law-practice/domain/src/values/DurableLocatorOptions/DurableLocatorOptions.model.ts` | `471c88fed03dbf00843a8e14d49b1c655934ebe8d092a5dd8b1d17998e3799b4` |
| `packages/law-practice/domain/src/values/NeutralCitation/NeutralCitation.model.ts` | `29c6697e12ff006ce9752adfae2fef4516a84d9bbb1f7398e9b73deaae09b83b` |
| `packages/law-practice/domain/src/values/RegulationCitation/RegulationCitation.model.ts` | `3a69f24e698c37b1ffff429998460a1d22360b87191ae020102e46852668f301` |
| `packages/law-practice/domain/src/values/StatuteCitation/StatuteCitation.model.ts` | `8a6409f7854eff8f41768db41e8d35bf6c88e8187fc701b99a754f010e5ba329` |
| `packages/ontology/domain/src/aggregates/Session/Session.model.ts` | `15e0fc7daadb1e71e19fd5270052f5d1c68f5a51f26f94c8cf16ef24599e4d6f` |
| `packages/ontology/domain/src/aggregates/Session/Session.values.ts` | `a07850e3b6fc349dc042babd451826278618c3cb7a0e56bc6d575d82ca79f31b` |
| `packages/ontology/use-cases/src/tools/OntologyToolService.ts` | `ca02cbcd92c282dcacc87ac9be723c24ef0a1ac28c51c27e3b6c88405a47f738` |
| `packages/ontology/use-cases/src/tools/OntologyToolkit.ts` | `26cda0f44c16150e954939655f45b27b25a69ac1bf9633bf4e1b3f486769fc57` |

Validation is documentation-only: the eleven IDs each have one disposition, proposed record IDs/member sets are unique, qualified 10/5 has a real cardinality gap and exact evidence anchor, every proposed file/line exists, JSON/JSONL blocks parse, Markdown fences are balanced, and trailing whitespace is absent. The pinned HEAD and origin/main were checked again; `git diff --name-only HEAD -- packages apps` is empty. No package commands or product tests were run; source constructor/fixture evidence is inspected, not newly executed proof.

Only this new audit is written. Canonical inventory, designs, source/tests, previous audits, frozen census reports, archives, dependencies, services, lifecycle statuses, Git index and refs remain untouched by this subtask. The parent may concurrently change its own packet files; this audit claims no global packet freeze beyond the named source pins. No Grok call or independent P3 claim was made.
