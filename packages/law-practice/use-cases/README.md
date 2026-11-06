# @beep/law-practice-use-cases

Application-tier service-port contracts for the law-practice slice: the
`IrToLaw` port (which maps the generic `@beep/nlp` Handoff IR into law-practice
domain entities) and the `OfficeActionReview` loop orchestrator port (which
ingests an office action's source text and returns an epistemic
`ClaimProjectionView`).

- `@beep/law-practice-use-cases/server` — the server-only service-port contracts
  (`IrToLaw`, `OfficeActionReview`).

This tier owns CONTRACTS ONLY: typed `Context.Service` ports with no
implementation bodies and no live Layers. Live Layers that resolve the
ingestion (`@beep/file-processing` + `@beep/langextract`), the `IrToLaw`
mapping, and the epistemic `ClaimGate` / `ClaimLifecycle` (plus the pure
`projectClaims` fold) live in `@beep/law-practice-server`, never here.

This is the slice's documented cross-slice bounded exception: importing
`@beep/epistemic-*` is sanctioned at the use-cases tier per the spike SPEC
Exception Ledger and `DECISIONS.md`. The law-practice DOMAIN tier stays clean —
no epistemic dependency there.

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
