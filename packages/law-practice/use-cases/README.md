# @beep/law-practice-use-cases

Application-tier service-port contracts for the law-practice slice: the
`IrToLaw` port (which maps the verified `@beep/annotation` extraction document and
its per-candidate readings into law-practice domain entities) and the
`OfficeActionReview` loop, which runs Extract, MapToLaw and ProposeClaim as
attributed operations, proposes the distinction claim in its capture scope
behind the matter wall and returns an `OfficeActionReviewResult`: the law
entities, the proposed record, its office-action assessments and the activity
log.

- `@beep/law-practice-use-cases/ClaimStore` — the `LawClaimProposals` and
  `LawClaimAdmissions` store ports, partitioned by capture scope.
- `@beep/law-practice-use-cases/LawAdmission` — attorney admission: `open`
  records the binding, `admit` checks the office-action gate and then the
  epistemics admission. `AttorneyAttestation` verifies the token; no host
  admits in P6.
- `@beep/law-practice-use-cases/MatterWall` — `LawPrincipal`,
  `MatterAuthority` and the access answers every walled path asks for.
- `@beep/law-practice-use-cases/ProvenanceTraversal` — the
  `ProvenanceTraversal` port behind `claim_provenance`: a claim's traversable
  activity records, captures and admissions, or `Missing` for an absent or
  denied claim.

Live Layers that resolve the ingestion (`@beep/file-processing` +
`@beep/langextract`), the `IrToLaw` mapping, the claim store and the matter
authority live in `@beep/law-practice-server`. `extractCandidate` keeps the
candidate and evidence rows the Practice KG claims batch stores, so this tier
still depends on `@beep/epistemic-domain`; the law-practice DOMAIN tier has no
epistemic slice dependency.

Citation policy, operation names and the closed `CitationEngineFailure` union
export only from `/server`. Its five error families are `CitationInputError`,
`CitationPrerequisiteError`, `CitationSafetyLimitExceeded`,
`CitationAnnotationError` and `CitationOperationUnsupported`. Raw text, private
causes and caller-controlled mode labels are excluded from these failure
payloads. Unknown/ambiguous/unresolved citation meanings remain domain data.
These contracts do not publish a live `CitationEngine` service yet. Root and
`/public` do not re-export them.

Single-source `CitationEngineSourceInput` and named
`CitationEngineExtractionOptions` components also export only from `/server`.
Builtin cleaner names, container kinds and source roles have one schema owner
there, reused by private server implementation. Decoding source data grants no
verified-source capability. The private adapter uses the existing canonical
`SourceTextResolver` and provenance verifier. `CitationEngineSourcePairInput`
adds independently identified plain/markup slots, retaining empty supplied
identities. Private single/pair extraction shares admission, timing and cumulative
budgets. Retained-Document dispatch and the complete service remain unfinished.

`CitationCleaner` is the captured server execution port. Its owned-value,
lazy-cursor and reservation contracts have one owner here; issuance and native
execution remain server implementations. Decoding handle data grants no runtime
ownership. Declared cleaner-port failures remain distinct from the five engine
boundary failures and require engine translation.

`CitationTokenizer` captures the existing native token-plan profile with closed
execution methods. Its token seeds, assembly results and failure contract have
one owner on `/server`. `CitationPythonUnicodeStorage` preserves explicit native
code-point storage; `CitationTextBudget` captures per-operation allocation
authority. The server constructs the default tokenizer within its current Scope
and budget and consumes this port directly. These contracts grant no verified
source authority. General mutable/custom-tokenizer protocols remain unfinished.

`CitationEngineReport` and `CitationExtractionMeasurements` describe completed
operations separately from semantic citations. Counts, captured policy and engine
identity compare deterministically; measured work duration does not. Reports have
no source-text or citation payload fields. Failure/interruption reporting and the
complete engine service remain integration work.

Citation oracle corpus,
accounting, divergence and benchmark schemas export only from `/test`;
production code must not import that subpath. These test schemas are evidence
contracts and do not provide a live citation engine or imply parity.
