# @beep/law-practice-server

Server tier for the law-practice slice: the live `Layer` surface that wires the
slice's use-case ports to real implementations.

- `@beep/law-practice-server/layer` — `LawPracticeServerLive`, composing the
  `IrToLaw` mapping, provider-neutral `@beep/langextract` extraction, and the
  `OfficeActionReview` loop over the epistemic server (`ClaimGate` +
  `ClaimTransition`, themselves over the bounded SHACL engine).

- `@beep/law-practice-server/DocketIntake` — live adapters of the docket intake
  pipeline: `makeDocketGraphLayer` (mailbox and calendar over the app-only
  `@beep/m365` lane), `makeDocketAgentsLayer` (paralegal and secretary over a
  `LanguageModel`), `makeDocketFileStoreLayer` (state file and digest archive)
  and `DocketMatterLookupUnavailableLive` (stands in until the practice
  knowledge-graph lookup is wired). The adapters add no date logic; the
  `@beep/docket-intake` app composes them.

`LawPracticeServerLive` requires the host application to provide a
`LanguageModel.LanguageModel` layer for `@beep/langextract`; model selection and
credentials stay at the application merge boundary.

The review loop depends on the epistemic admission services, so this tier
provides `EpistemicServerLive` at the merge boundary. The cross-slice
`@beep/epistemic-*` dependency is the slice's documented bounded exception (per
the spike SPEC Exception Ledger + `DECISIONS.md`); the law-practice DOMAIN tier
stays clean.

Claims-batch persistence temporarily imports `@beep/epistemic-tables` to write
the bundle PGlite substrate; revisit when intake P4-proper lands `ClaimGate`
persistence.

The review loop now invokes the provider-neutral LangExtract service; tests keep
deterministic fake model output. Entity id/audit fields still come from a spike
shim rather than a real id generator / `Clock` / request context.
