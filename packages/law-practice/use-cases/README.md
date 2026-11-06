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

Citation oracle corpus,
accounting, divergence and benchmark schemas export only from `/test`;
production code must not import that subpath. These test schemas are evidence
contracts and do not provide a live citation engine or imply parity.
