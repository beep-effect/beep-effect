# Lane A — repo composition surfaces

**Provenance:** Lane A; 2026-08-04; live-tree reads plus source-only `rg`; no
external sources. `LIVE SOURCE` means code under `packages/**/src` that the
first rung may compose now. `SPEC CONTRACT` means an in-flight
`goals/*/SPEC.md` promise that the wedge may bind to but may not implement,
adapt, or fork. That distinction is the dependency posture already locked for
this packet (`explorations/patent-citation-candor-gate/DECISIONS.md:43-60`).

## 1. Live law-practice surfaces

**Surface class: LIVE SOURCE.** Any future-facing statement in this section is
limited to identifying an existing placement or an absence; it is not a schema
or implementation proposal.

### `PatentReference`

`PatentReference` is a schema-first value object with exactly three fields:
`country: Option<OfficeCode>`, `number: Option<PatentNumber>`, and
`kindCode: Option<KindCode>`. Each encoded key is optional and defaults to
`None`; `empty()` constructs all three as absent
(`packages/law-practice/domain/src/values/PatentMetadata/PatentMetadata.model.ts:188-217`).
It therefore represents parsed patent-document components, not an occurrence:
it carries no raw input, citing application, actor, office action, submission or
observation time, discovery provenance, model/method identity, source version,
or evidence anchor (`packages/law-practice/domain/src/values/PatentMetadata/PatentMetadata.model.ts:188-215`).

Parsing is a separate pure function. The regex looks for a two-letter office
code, a number that may begin with `RE`, `PP`, `D`, or `H` and may contain
commas, and an optional letter-plus-optional-digit kind code
(`packages/law-practice/domain/src/values/PatentMetadata/PatentMetadata.model.ts:24-24`).
`parsePatentReference` uppercases and validates the office and kind code,
strips commas from and validates the number, and returns `PatentReference.empty()`
when the regex does not match; an individually invalid captured component is
decoded to `None` rather than retained raw
(`packages/law-practice/domain/src/values/PatentMetadata/PatentMetadata.model.ts:747-774`).

Two nearby identifiers do not add occurrence semantics. `PatentDocumentTriplet`
is a branded display-form identity requiring office, comma-grouped publication
number, and kind code, with publication date explicitly left to separate
metadata (`packages/law-practice/domain/src/values/PatentDocumentTriplet/PatentDocumentTriplet.model.ts:28-39`,
`packages/law-practice/domain/src/values/PatentDocumentTriplet/PatentDocumentTriplet.model.ts:58-69`).
`PatentMetadata` is broader document metadata—patent number, office, kind code,
publication/application/filing/priority dates, assignees, claim count,
inventors, IPC, and CPC—but is likewise not an occurrence record
(`packages/law-practice/domain/src/values/PatentMetadata/PatentMetadata.model.ts:239-330`).

### `PriorArtReference`

`PriorArtReference` is a persisted entity described as an examiner-cited
document introduced by an office action
(`packages/law-practice/domain/src/entities/PriorArtReference/PriorArtReference.model.ts:15-20`).
Beyond inherited base-entity fields, its exact domain fields are free-text
`documentNumber`, stable `fixtureKey`, `officeActionFixtureKey`, and free-text
`title`; each is persisted as text
(`packages/law-practice/domain/src/entities/PriorArtReference/PriorArtReference.model.ts:50-80`).
The occurrence semantics embedded today are therefore: one prior-art row is
examiner-linked to one office-action fixture, and the cited document is stored
as text. The entity does not contain a typed `PatentReference`, citation actor,
applicant/IDS occurrence, discovery provenance, source observation version, or
verification anchor (`packages/law-practice/domain/src/entities/PriorArtReference/PriorArtReference.model.ts:50-85`).

The link target is also live. `OfficeAction` carries free-text application
number plus fixture keys for the office action, matter, and examined patent
asset (`packages/law-practice/domain/src/entities/OfficeAction/OfficeAction.model.ts:50-80`).
`PatentAsset` carries only fixture key, matter fixture key, lifecycle status,
and title, so it does not itself supply a normalized citing-application
identity (`packages/law-practice/domain/src/entities/PatentAsset/PatentAsset.model.ts:48-78`).
This is the concrete reason the current examiner-only occurrence cannot stand
in for T2-F2's applicant, face-list, model, or submission claims.

### `Claim` and locator neighbors

`Claim` is a persisted whole-claim entity. Its exact fields are one-based
`claimNumber`, stable `fixtureKey`, `independent`, `patentAssetFixtureKey`, and
full claim `text`, all with explicit persisted columns
(`packages/law-practice/domain/src/entities/Claim/Claim.model.ts:52-88`). It
provides a live claim identity and claim number/text, but no paragraph, figure,
document-fragment, or reflow-surviving locator
(`packages/law-practice/domain/src/entities/Claim/Claim.model.ts:16-20`,
`packages/law-practice/domain/src/entities/Claim/Claim.model.ts:52-93`).

The law-practice domain already exports a generic `DurableLocator` for legal
citations. It records an exact quote plus optional prefix/suffix, an
original-or-clean position hint, an optional occurrence ordinal, and an
FNV-1a-derived content hash (`packages/law-practice/domain/src/values/DurableLocator/DurableLocator.model.ts:52-105`).
Its own documentation says the quote is the anchor of record and the offsets
may drift (`packages/law-practice/domain/src/values/DurableLocator/DurableLocator.model.ts:60-100`).
It is not a tagged patent claim/paragraph/figure/document identity. Likewise,
`PatentFigure` is image presentation metadata (`label`, HTTP(S) `url`, and
`alt`), not a figure locator
(`packages/law-practice/domain/src/values/PatentMetadata/PatentMetadata.model.ts:105-128`).

Targeted law-practice source search found no paragraph entity or patent-specific
fragment locator:

```text
rg -n "class (PatentFragmentLocator|Paragraph|Figure|Document)|Patent.*Locator" packages/law-practice --glob '**/src/**/*.{ts,tsx}'
```

The sole match was an unrelated private `DocumentRange` used to page text in a
practice-KG document-read tool
(`packages/law-practice/use-cases/src/PracticeKg.tools.ts:83-101`).
`PatentFragmentLocator`, a law-practice `Paragraph`, and patent-specific claim,
figure, or document locator were **NOT FOUND**. `PatentFigure` was inventoried
separately above because it is metadata rather than a locator.

### Package-family layout and live placement precedent

The top-level directory inventory returned exactly `domain`, `server`,
`tables`, and `use-cases`:

```text
find packages/law-practice -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort
```

- `@beep/law-practice-domain` owns entity/value source and exports entity
  subpaths including `Claim`, `OfficeAction`, `PatentAsset`, and
  `PriorArtReference`, plus the values surface
  (`packages/law-practice/domain/package.json:31-49`). Its entity barrel shows
  the live concept placement under `src/entities/<Concept>/`
  (`packages/law-practice/domain/src/entities/index.ts:9-65`).
- `@beep/law-practice-tables` is present, but its live entity barrel currently
  exposes only practice-KG `KgBuild`, `KgEdge`, and `KgNode` read-model tables
  (`packages/law-practice/tables/src/entities/index.ts:1-22`); its table
  collection re-exports that read-model schema
  (`packages/law-practice/tables/src/Tables.ts:1-15`).
- `@beep/law-practice-use-cases` exports server-only concept namespaces for
  `IrToLaw` and `OfficeActionReview`
  (`packages/law-practice/use-cases/src/server.ts:1-36`). Its client-safe
  `public.ts` is intentionally empty
  (`packages/law-practice/use-cases/src/public.ts:1-26`). This is the live
  precedent for a law-owned policy/service contract under
  `src/<Concept>/`, without claiming that such a candor contract exists.
- `@beep/law-practice-server` composes the live `IrToLaw` and
  `OfficeActionReview` implementations and their dependencies in `Layer.ts`
  (`packages/law-practice/server/src/Layer.ts:1-9`,
  `packages/law-practice/server/src/Layer.ts:33-47`). The exported layer
  currently provides only those two law-practice services
  (`packages/law-practice/server/src/Layer.ts:49-85`).

## 2. Live provenance/epistemic surfaces

**Surface class: LIVE SOURCE.** The in-flight verified-span SPEC is inventoried
separately in section 4; this section describes only code that exists now.

### `TextAnchor`

`TextAnchor` is deliberately domain-agnostic provenance: a half-open character
range and exact quote, with confidence and claim semantics excluded
(`packages/foundation/modeling/provenance/src/TextAnchor.ts:1-10`). Its fields
are non-negative `startChar`, non-negative `endChar`, and non-empty `quote`
(`packages/foundation/modeling/provenance/src/TextAnchor.ts:47-57`). The schema
requires a non-empty range and equality between `endChar - startChar` and the
quote's UTF-16 code-unit length
(`packages/foundation/modeling/provenance/src/TextAnchor.ts:65-90`,
`packages/foundation/modeling/provenance/src/TextAnchor.ts:122-133`).
`isUtf16Boundary` additionally rejects an offset that splits a surrogate pair,
but it needs the source text and is not itself part of bare `TextAnchor`
construction (`packages/foundation/modeling/provenance/src/TextAnchor.ts:93-120`).
Thus a bare anchor is internally width-consistent, not proof that its quote
matches any particular source manifestation.

### `VerifiedTextAnchor`

Verification consumes a `TextAnchor`, caller-authorized `expectedSource`,
actually resolved `source`, and the exact `sourceText`
(`packages/foundation/modeling/provenance/src/VerifiedTextAnchor.ts:102-131`).
The source identity includes scope and logical source refs, locator, exact
artifact and extracted-text SHA-256 digests, pinned extractor name/version, and
normalization version
(`packages/foundation/modeling/provenance/src/SourceTextIdentity.ts:85-145`).

"Verified anchor" today has a narrow runtime meaning. `verifyTextAnchor` fails
closed when scope differs, the expected and resolved identities differ, the
hash of supplied source text differs from `textDigest`, offsets are out of
bounds or split a UTF-16 surrogate pair, or the exact raw slice differs from
the quote (`packages/foundation/modeling/provenance/src/VerifiedTextAnchor.ts:294-300`,
`packages/foundation/modeling/provenance/src/VerifiedTextAnchor.ts:349-376`).
Its closed reasons are `cross-scope`, `invalid-anchor`, `quote-mismatch`, and
`stale-source` (`packages/foundation/modeling/provenance/src/VerifiedTextAnchor.ts:23-45`).

The successful `VerifiedTextAnchor` is an opaque, module-constructed runtime
proof; structural `{ anchor, source }` data cannot decode as verified
(`packages/foundation/modeling/provenance/src/VerifiedTextAnchor.ts:165-228`).
Persistence uses `TextAnchorVerificationReceipt { anchor, source }`, which is
explicitly not current runtime proof and must be re-verified against canonical
source text when current verification matters
(`packages/foundation/modeling/provenance/src/VerifiedTextAnchor.ts:133-163`).
The only provided direction is runtime proof to receipt
(`packages/foundation/modeling/provenance/src/VerifiedTextAnchor.ts:280-292`).
For candor closure, a stored receipt therefore cannot by itself establish that
an observation is current.

### `EvidenceSpan`

`EvidenceSpan` flattens the three `TextAnchor` fields and adds extraction
`confidence` in `[0, 1]`
(`packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts:1-8`,
`packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts:30-51`,
`packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts:102-114`).
Its quote is additionally bounded to 65,536 UTF-16 code units
(`packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts:72-100`).
It preserves the anchor width invariant and can compare its offsets/quote with
a `TextAnchor`, deliberately ignoring confidence
(`packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts:158-193`).
It carries no `SourceTextIdentity`, digest, verification receipt, or opaque
verification proof; those are separate provenance/verification surfaces.

## 3. Live runtime-gate surfaces

**Surface class: LIVE SOURCE.** The runtime SPEC from which these contracts were
implemented is separated in section 4.

### Candidate evidence, draft, and gate

`RuntimeEvidenceRef` is a generic artifact reference with required
`artifactId`, optional single `spanId`, and optional array `spanIds`
(`packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:190-222`).
It does not carry a `TextAnchor`, `SourceTextIdentity`, verified-anchor receipt,
or observation version.

`RuntimeCandidateDraft` has exactly `artifactId`, `body`, `draftId`,
domain-specific `draftKind`, an array of `RuntimeEvidenceRef`, `lifecycle`,
`producedByPrincipalId`, `requiresApproval`, `subject`, and recipients `to`
(`packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:428-446`).
The current lifecycle vocabulary contains only `candidate`
(`packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.values.ts:50-85`).

`RuntimeApprovalGate` has exactly `approvalGateId`, string `candidateRefs`,
`decision`, generic evidence refs, lifecycle, free-text `policyBasis`, string
`requestedActions`, and `reviewerPrincipalId`
(`packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:473-491`).
The current decision vocabulary contains only `pending`
(`packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.values.ts:124-159`).
The CAPTURE summary is accurate only across the draft/evidence/gate trio:
candidate references, policy basis, reviewer, and decision belong to the gate,
not the draft; the evidence shape itself is defined earlier at lines 209-222.

The required negative check is confirmed:

```text
rg -n -i "candor|observation.?version|PatentCitation|disposition" packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts
```

Result: **NOT FOUND**. No candor-specific or observation-version field exists in
the draft, evidence reference, gate, or neighboring contracts.

### Append-only ledger precedent

`ExecutionLedgerShape` exposes only `appendDecision`, `appendOutcome`,
`readDecisions`, `readOutcomes`, and `readUnsettledAllowed`
(`packages/epistemic/use-cases/src/ExecutionLedger/ExecutionLedger.ports.ts:61-73`).
Its contract explicitly excludes update and delete, records the governed
decision before an effect runs, records an outcome after settlement, and keeps
chain verification in the domain rather than trusting the adapter
(`packages/epistemic/use-cases/src/ExecutionLedger/ExecutionLedger.ports.ts:1-11`,
`packages/epistemic/use-cases/src/ExecutionLedger/ExecutionLedger.ports.ts:29-39`).
The service is a live `Context.Service`
(`packages/epistemic/use-cases/src/ExecutionLedger/ExecutionLedger.ports.ts:75-108`).
This is an append/read audit precedent; it is not a candor ledger and owns none
of the four net-new symbols checked in section 5.

## 4. SPEC contracts (in-flight, compose-only)

**Surface class: SPEC CONTRACT plus explicit LIVE SOURCE STATUS.** The wedge is
bound to these promises without treating an unchecked acceptance criterion or
an absent symbol as live.

### `goals/citation-extraction-engine/SPEC.md`

**SPEC CONTRACT.** `CitationMention` belongs in
`@beep/law-practice-domain/values`, not the engine/server layer
(`goals/citation-extraction-engine/SPEC.md:165-174`). Its promised occurrence
surface is: one semantic `Citation`, document-local mention ID, verified source
anchor, exact matched text, component anchors, and typed warnings
(`goals/citation-extraction-engine/SPEC.md:181-190`). `CitationMentionId` is
reproducible from the same source version, engine artifact version, verified
anchor, and semantic discriminant; it changes when any of those identity inputs
change and is not a persisted entity ID
(`goals/citation-extraction-engine/SPEC.md:196-209`). Those are the binding
pieces the candor wedge could consume: occurrence identity, semantic citation,
source version, verified anchor, exact text, component anchors, and warnings.

The exact prerequisite-derived fields, brands, imports, versions, and codecs
remain provisional until the citation engine's compatibility gate; only the
ownership/separation/no-duplicate-truth decisions are frozen
(`goals/citation-extraction-engine/SPEC.md:70-91`). The wedge must therefore bind
to the landed public contract, not predeclare an adapter or guessed field shape.

**LIVE SOURCE STATUS.** This exact search returned **NOT FOUND**:

```text
rg -n "CitationMention|CitationMentionId" packages --glob '**/src/**/*.{ts,tsx}'
```

The existing `Citation`, `FullCitation`, and `ShortFormCitation` unions are live,
but the current union members are case/docket/statute/regulation and other legal
authority forms, with no patent-reference member
(`packages/law-practice/domain/src/values/Citation/Citation.models.ts:1480-1527`,
`packages/law-practice/domain/src/values/Citation/Citation.models.ts:1628-1672`,
`packages/law-practice/domain/src/values/Citation/Citation.models.ts:1691-1714`).
They still spread donor-shaped `CitationBase`, which mixes match text, position,
confidence, timing, pattern counts, warnings, signals, and grouping
(`packages/law-practice/domain/src/values/CitationBase/CitationBase.model.ts:23-29`,
`packages/law-practice/domain/src/values/CitationBase/CitationBase.model.ts:60-149`);
the SPEC requires that occurrence and telemetry material to migrate out
(`goals/citation-extraction-engine/SPEC.md:224-239`). The goal is active in P0,
with production phases blocked by its prerequisites
(`goals/citation-extraction-engine/ops/manifest.json:12-24`,
`goals/citation-extraction-engine/ops/manifest.json:64-93`).

A patent-specific contract is also **NOT FOUND** in this SPEC. The search

```text
rg -n -i "patent reference|patent citation|MPEP" goals/citation-extraction-engine/SPEC.md
```

returned only the MPEP-pattern non-goal at
`goals/citation-extraction-engine/SPEC.md:466-475`. The required engine parity
does name eyecite “reference” citations, but it does not say those are patent
references (`goals/citation-extraction-engine/SPEC.md:93-107`). Consequently,
the current SPEC guarantees a generic `CitationMention` contract, not that a
patent-reference occurrence will be one of its semantic members. CAPTURE's
planned acceptance of `CitationMention` must remain gated on the actual landed
public contract rather than assumed now.

### `goals/citation-verified-span-substrate/SPEC.md`

**SPEC CONTRACT.** The substrate owns verified `TextAnchor` construction,
source identity/digest/version retention, and half-open conversion in
provenance, while langextract owns locator normalization, raw-offset mapping,
declared foreign-unit conversion, and cross-page/chunk straddle
(`goals/citation-verified-span-substrate/SPEC.md:42-50`). Its binding invariants
are half-open UTF-16 offsets; locator-only whitespace/typographic normalization;
raw slice equality; source identity plus digest/version retention; stale rather
than rewritten evidence; deterministic disambiguation or closed ambiguity; and
global exact offsets across reconstructed chunks/pages
(`goals/citation-verified-span-substrate/SPEC.md:61-82`). Persistence additionally
retains raw candidates, engine/normalization version, matter identity,
verification/re-anchor attempts, and closed outcomes
(`goals/citation-verified-span-substrate/SPEC.md:83-98`). These are the binding
anchor/source-version pieces for a citation event.

**LIVE SOURCE STATUS.** The core named contracts and algorithms are live:
`SourceTextIdentity` (`packages/foundation/modeling/provenance/src/SourceTextIdentity.ts:119-145`),
opaque `VerifiedTextAnchor` and receipt
(`packages/foundation/modeling/provenance/src/VerifiedTextAnchor.ts:133-228`),
`verifyTextAnchor` (`packages/foundation/modeling/provenance/src/VerifiedTextAnchor.ts:349-376`),
and the langextract `VerifiedSpan` surface for normalization, offset conversion,
reconstruction, and direct `GroundedExtraction[]` location
(`packages/foundation/capability/langextract/src/VerifiedSpan/index.ts:571-628`,
`packages/foundation/capability/langextract/src/VerifiedSpan/index.ts:656-739`).
The goal nevertheless remains active in P1: P0 and the core live proof are
green, while re-anchor history and negative-attempt persistence remain
unfinished (`goals/citation-verified-span-substrate/ops/manifest.json:12-15`,
`goals/citation-verified-span-substrate/ops/manifest.json:50-69`). Thus the
first rung may compose the live verified-anchor runtime/receipt surfaces, but it
may not claim the whole SPEC complete.

The implementation-status search was:

```text
rg -n "VerifiedTextAnchor|TextAnchorVerificationReceipt|SourceTextIdentity|verifyTextAnchor|GroundedExtraction|VerifiedSpan" packages --glob '**/src/**/*.{ts,tsx}'
```

It returned the live provenance, langextract, file-processing/workspace
resolver, epistemic consumer, and law-practice consumer locations cited above;
this contract is nonzero/partially landed, not spec-only.

### `goals/uspto-prosecution-read/SPEC.md`

**SPEC CONTRACT.** The promised observation binds normalized application
identity; optional publication/patent identifiers; numeric application status
and generated native description; ordered transaction events with event/mail
date, event code, native description, and upstream record identity; an
authoritative office-action/document code, identifier, date, and retrievable
source reference; plus source/operation class, retrieval time, freshness,
cursor/upstream identity, applicable checksums, and parser/vocabulary versions
(`goals/uspto-prosecution-read/SPEC.md:3-19`). Its four vocabularies carry source
identity, retrieval date, checksum, and refresh command; detected drift is
reported and cannot silently change decode semantics
(`goals/uspto-prosecution-read/SPEC.md:21-25`). Unknown codes and schema drift
must retain raw values and fail explicitly
(`goals/uspto-prosecution-read/SPEC.md:61-87`). Those native facts and version
identities—not legal conclusions—are the pieces the candor wedge may eventually
bind to; law-practice server is the sole legal translation boundary
(`goals/uspto-prosecution-read/SPEC.md:102-110`).

**LIVE SOURCE STATUS.** The SPEC does not name a final observation schema
symbol. This contract-term search returned **NOT FOUND**:

```text
rg -n "ProsecutionObservation|prosecution observation|eventDataBag|parserVersion|vocabularyVersion|endpoint.?drift|schema.?drift" packages/drivers/uspto packages/drivers/uspto-mcp --glob '**/src/**/*.{ts,tsx}'
```

The driver currently exposes application metadata, continuity, document list,
download, and search operations
(`packages/drivers/uspto/src/Uspto.service.ts:30-84`). Its application metadata
contains text status description and optional publication/patent identifiers
(`packages/drivers/uspto/src/Uspto.models.ts:317-355`), and its document
reference contains optional document code/description/date plus identifier and
optional download URL (`packages/drivers/uspto/src/Uspto.models.ts:387-423`).
Those are partial ingredients, not the promised provenance-bearing observation.
The live error vocabulary covers config, not-found, rate-limit, response decode,
response status, and transport, but not separate authentication,
authorization, or endpoint-drift tags
(`packages/drivers/uspto/src/Uspto.errors.ts:13-45`). The goal's manifest still
has all phases, including P0, pending
(`goals/uspto-prosecution-read/ops/manifest.json:11-18`,
`goals/uspto-prosecution-read/ops/manifest.json:55-59`). The prosecution
observation is therefore SPEC-only today.

### `goals/agentic-professional-runtime/SPEC.md`

**SPEC CONTRACT.** The runtime produces candidate claims, tasks, and a
client-facing draft, attaches evidence/provenance, and creates pending approval
gates (`goals/agentic-professional-runtime/SPEC.md:26-51`). Candidate records
assert what was proposed/evidenced/decided, not truth; human or policy
acceptance records a scoped disposition without making a proposition true
(`goals/agentic-professional-runtime/SPEC.md:52-63`). The deterministic proof's
terminal outputs include the candidate draft and one pending gate
(`goals/agentic-professional-runtime/SPEC.md:104-130`), and professional
judgment, filings, and compliance-weight records remain approval-gated
(`goals/agentic-professional-runtime/SPEC.md:218-226`). These are the binding
candidate/evidence/human-gate semantics the candor wedge composes.

**LIVE SOURCE STATUS.** This named-symbol search is nonzero:

```text
rg -n "RuntimeCandidateDraft|RuntimeApprovalGate|RuntimeEvidenceRef" packages --glob '**/src/**/*.{ts,tsx}'
```

The definitions are live at
`packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:209-222`,
`packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:428-446`,
and
`packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:473-491`,
with live fixture-service consumers
(`packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.fixture-service.ts:47-79`).
The goal manifest calls the first proof package-contract-tested and its storage
in-memory/test-only with tables deferred
(`goals/agentic-professional-runtime/ops/manifest.json:65-80`). The generic gate
is live; a candor gate and durable candor recording are not.

## 5. Net-new confirmation

**Surface class: LIVE SOURCE search only.** Each command searched only
`packages/**/src/**/*.{ts,tsx}` on 2026-08-04. Each returned exit status 1,
zero matches, and no output.

| Symbol | Exact command | Result |
| --- | --- | --- |
| `PatentCitationEvent` | `rg -n "PatentCitationEvent" packages --glob '**/src/**/*.{ts,tsx}'` | **NOT FOUND — 0** |
| `CandorDisposition` | `rg -n "CandorDisposition" packages --glob '**/src/**/*.{ts,tsx}'` | **NOT FOUND — 0** |
| `PatentFragmentLocator` | `rg -n "PatentFragmentLocator" packages --glob '**/src/**/*.{ts,tsx}'` | **NOT FOUND — 0** |
| `PatentReferenceDiscoveryEvent` | `rg -n "PatentReferenceDiscoveryEvent" packages --glob '**/src/**/*.{ts,tsx}'` | **NOT FOUND — 0** |

This reconfirms the 2026-08-01 source-only result recorded in CAPTURE
(`explorations/patent-citation-candor-gate/CAPTURE.md:82-93`) without treating
SPEC mentions or exploration prose as implementation.

## 6. Reconciliation against the three nuggets

**Surface class: LIVE SOURCE and SPEC CONTRACT are labeled in every row.** The
nuggets and their status are the packet's captured evidence, not conclusions of
this lane (`explorations/patent-citation-candor-gate/CAPTURE.md:20-39`).

| Nugget | Satisfied by LIVE SOURCE | Satisfied by SPEC CONTRACT | Remains net-new | Binding cautions by surface |
| --- | --- | --- | --- | --- |
| **T2-F2 — reify citations because actor, office-action use, submission time, and similarity method change meaning** | `PatentReference` isolates document components but has no occurrence semantics (`packages/law-practice/domain/src/values/PatentMetadata/PatentMetadata.model.ts:188-217`). `PriorArtReference` proves one currently live occurrence form—examiner citation tied to an office-action fixture—but stores the reference as text (`packages/law-practice/domain/src/entities/PriorArtReference/PriorArtReference.model.ts:15-20`, `packages/law-practice/domain/src/entities/PriorArtReference/PriorArtReference.model.ts:50-80`). | `CitationMention` promises source-version-local occurrence identity, semantic citation, verified anchor, matched/component evidence, and warnings (`goals/citation-extraction-engine/SPEC.md:181-202`), but patent membership is not guaranteed and the symbol is not live. | The reified patent citation event; separate actor, face-list/IDS presence, office-action reliance, submission time, discovery/model/method claims; reference reconciliation; and discovery-event split. All four named event/disposition/locator symbols remain absent (section 5). | The T2 caution requires those facts to stay separate (`explorations/patent-citation-candor-gate/CAPTURE.md:110-115`). In particular, do not generalize `PriorArtReference.officeActionFixtureKey` into face-list presence, applicant submission, or model relevance; and do not reuse donor-shaped `CitationBase`, which currently mixes semantic, occurrence, and telemetry fields (`packages/law-practice/domain/src/values/CitationBase/CitationBase.model.ts:60-149`). |
| **T3-F7 — structured durable locator identity deepens, not replaces, exact spans** | `Claim` supplies whole-claim identity/number/text (`packages/law-practice/domain/src/entities/Claim/Claim.model.ts:52-93`); `PatentDocumentTriplet` supplies document identity (`packages/law-practice/domain/src/values/PatentDocumentTriplet/PatentDocumentTriplet.model.ts:28-39`, `packages/law-practice/domain/src/values/PatentDocumentTriplet/PatentDocumentTriplet.model.ts:58-69`); `TextAnchor` supplies exact UTF-16 offsets/quote (`packages/foundation/modeling/provenance/src/TextAnchor.ts:47-90`); `VerifiedTextAnchor` proves them against one exact source (`packages/foundation/modeling/provenance/src/VerifiedTextAnchor.ts:349-376`). `DurableLocator` supplies quote/context/position for generic legal citations but not structured patent fragments (`packages/law-practice/domain/src/values/DurableLocator/DurableLocator.model.ts:52-105`). | The verified-span substrate freezes raw-slice equality, source version/digest, ambiguity, straddle, and stale-evidence rules (`goals/citation-verified-span-substrate/SPEC.md:61-98`). | Tagged claim/paragraph/figure/document fragment identity that survives reflow; paragraph and figure/document-fragment models; and the `PatentFragmentLocator` symbol. | A structured locator cannot replace the exact verified anchor, and an offset/quote locator cannot be relabeled as structured claim/paragraph/figure identity. The owner question remains open because provenance is domain-agnostic (`packages/foundation/modeling/provenance/src/TextAnchor.ts:1-10`) while the adjacent `Claim`, `PatentDocumentTriplet`, and `DurableLocator` language is law-owned. |
| **ADHD-1 — source-versioned event plus attorney disposition gates filing; unknown/stale stay explicit** | `SourceTextIdentity` pins artifact/text digests and extractor/normalization versions (`packages/foundation/modeling/provenance/src/SourceTextIdentity.ts:119-145`); `verifyTextAnchor` rejects stale source and quote drift (`packages/foundation/modeling/provenance/src/VerifiedTextAnchor.ts:349-376`); `RuntimeApprovalGate` can represent a generic pending reviewer gate (`packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:473-491`); `ExecutionLedger` demonstrates append/read-only governed decisions (`packages/epistemic/use-cases/src/ExecutionLedger/ExecutionLedger.ports.ts:1-11`, `packages/epistemic/use-cases/src/ExecutionLedger/ExecutionLedger.ports.ts:61-73`). | USPTO prosecution-read promises raw-preserving unknown-code failures, checksums, parser/vocabulary versions, and drift-without-mutation (`goals/uspto-prosecution-read/SPEC.md:3-25`, `goals/uspto-prosecution-read/SPEC.md:61-87`). Runtime binds professional work to pending human approval without making propositions true (`goals/agentic-professional-runtime/SPEC.md:52-63`, `goals/agentic-professional-runtime/SPEC.md:218-226`). | `PatentCitationEvent`, attorney-owned `CandorDisposition`, exact-current-observation closure policy, quarantine/reconciliation rules, a durable law-practice recording surface, and IDS mechanics. The USPTO observation itself is still spec-only. | Attorney judgment must not be computed, and missing events must not imply closure (`explorations/patent-citation-candor-gate/CAPTURE.md:110-117`). A persisted anchor receipt is not current proof (`packages/foundation/modeling/provenance/src/VerifiedTextAnchor.ts:133-163`); a generic `candidateRef` is not an observation-version identity (`packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:473-491`); duplicates, stale observations, raw unknown codes, and new discoveries must remain closure-relevant. |

## 7. Drift notes and open questions for align

**Surface class: LIVE SOURCE drift against inherited citations, followed by the
two SPEC-bound manifest questions.** No inherited path is dead, but several
ranges need qualification.

### Inherited citation verification

| CAPTURE citation | Current verification and drift |
| --- | --- |
| `PatentMetadata.model.ts:188-216` | The range still lands on the exact `PatentReference` fields and `empty()` (`packages/law-practice/domain/src/values/PatentMetadata/PatentMetadata.model.ts:188-217`). It does **not** contain parsing logic, so CAPTURE's word “parses” needs the regex and function citations at `packages/law-practice/domain/src/values/PatentMetadata/PatentMetadata.model.ts:24-24` and `packages/law-practice/domain/src/values/PatentMetadata/PatentMetadata.model.ts:747-774`. No line move; citation sufficiency drift. |
| `PriorArtReference.model.ts:50-84` | The range still lands on the intended entity fields and description; the closing brace is now/currently at line 85 (`packages/law-practice/domain/src/entities/PriorArtReference/PriorArtReference.model.ts:50-85`). No substantive drift. |
| `citation-extraction-engine/SPEC.md:169-196` | The range still lands on ownership and the conceptual `CitationMention`, but source-version reproducibility continues through line 202 (`goals/citation-extraction-engine/SPEC.md:169-202`). More importantly, `CitationMention` remains source-absent and the SPEC does not explicitly promise a patent-reference semantic member. No line move; live-status and contract-scope qualification required. |
| `citation-verified-span-substrate/SPEC.md:44-80,108-123` | Both ranges still land on the intended target/invariants and acceptance boundary (`goals/citation-verified-span-substrate/SPEC.md:42-80`, `goals/citation-verified-span-substrate/SPEC.md:105-125`). The inherited citation understates the current split: the core source surface is visibly live while the goal remains active P1 (`goals/citation-verified-span-substrate/ops/manifest.json:12-15`, `goals/citation-verified-span-substrate/ops/manifest.json:50-69`). This is a live-status qualification, not contract drift. |
| `ProfessionalRuntime.contracts.ts:428-490` | The range still contains the draft and gate field blocks (`packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:428-491`). It does not contain `RuntimeEvidenceRef`'s exact shape, which is at lines 209-222, and the named candidate refs/policy/reviewer/decision all belong to the gate. No line move; citation sufficiency qualification required. |
| `ProfessionalRuntime.contracts.ts:473-490` “no candor or observation-version field” | Confirmed by the exhaustive gate field block (`packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:473-491`) and the negative `rg` in section 3. No drift. |

### Shape contradictions and dependencies exposed by the live tree

1. CAPTURE's cluster rationale calls the reference, mention, verified anchor,
   USPTO observation, and runtime gate “existing bricks”
   (`explorations/patent-citation-candor-gate/CAPTURE.md:119-123`). In current
   source, `PatentReference`, the verified-anchor core, and the generic runtime
   gate are live; `CitationMention` and the prosecution observation are only
   binding SPEC contracts. The locked live-source-plus-SPEC posture already
   resolves this operationally (`explorations/patent-citation-candor-gate/DECISIONS.md:43-60`).
2. “Verified anchor” cannot be treated as one persistable schema value. The
   runtime proof is opaque and constructor-controlled, while its persistable
   receipt requires re-verification for current use
   (`packages/foundation/modeling/provenance/src/VerifiedTextAnchor.ts:133-228`).
   Any closure claim tied to “current” evidence must preserve that distinction.
3. `Claim` is a whole-claim entity, not the reflow-surviving structured
   `PatentFragmentLocator` described in CAPTURE
   (`packages/law-practice/domain/src/entities/Claim/Claim.model.ts:52-93`,
   `explorations/patent-citation-candor-gate/CAPTURE.md:75-80`). The nearby
   `DurableLocator` is quote/context based and does not close that gap
   (`packages/law-practice/domain/src/values/DurableLocator/DurableLocator.model.ts:52-105`).
4. The citation-engine SPEC's planned `CitationMention` is generic and its
   current semantic union has no patent-reference member
   (`goals/citation-extraction-engine/SPEC.md:181-202`,
   `packages/law-practice/domain/src/values/Citation/Citation.models.ts:1498-1527`).
   The wedge cannot fork the goal, so a patent-occurrence handoff remains gated
   on what that goal actually lands.

### The two manifest open questions, restated against this inventory

1. **`PatentFragmentLocator` home.** The exact manifest question remains:
   law-practice value object versus a provenance neighbor, with shared-kernel
   promotion considered only if the citation engine needs the contract
   (`explorations/patent-citation-candor-gate/ops/manifest.json:8-10`). Evidence
   for align: provenance owns domain-agnostic exact offsets/quote
   (`packages/foundation/modeling/provenance/src/TextAnchor.ts:1-10`), while the
   existing claim, patent-document identity, figure metadata, and generic legal
   durable locator are law-owned. `PatentFragmentLocator` itself remains **NOT
   FOUND**. This lane does not choose the owner.
2. **IDS-mechanics recording surface.** The manifest asks which 37 CFR 1.97
   timing, 1.98 content, and supplemental-IDS states an attorney disposition
   must record without computing materiality or closure
   (`explorations/patent-citation-candor-gate/ops/manifest.json:8-10`). The live
   repo has a generic pending runtime gate and an examiner-linked prior-art row,
   but neither is an IDS record
   (`packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:473-491`,
   `packages/law-practice/domain/src/entities/PriorArtReference/PriorArtReference.model.ts:50-85`).
   The search below returned **NOT FOUND**:

   ```text
   rg -n -i "information disclosure statement|supplemental ids|ids timing|37 cfr 1\.97|37 cfr 1\.98|candor|materiality" packages --glob '**/src/**/*.{ts,tsx}'
   ```

   The USPTO SPEC supplies future native observation facts, not attorney-owned
   legal/IDS mechanics (`goals/uspto-prosecution-read/SPEC.md:27-37`,
   `goals/uspto-prosecution-read/SPEC.md:78-87`). Lane B's legal frame and the
   align grill must decide the recording boundary; this lane found no live
   surface to inherit.
