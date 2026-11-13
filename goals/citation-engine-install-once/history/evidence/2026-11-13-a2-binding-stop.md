# A2 stopped: invocation binding reaches the isolated worker

The implementation trial is uncommitted on `feat/citation-invocation-binding`.
No PR was published. The explicit implementation stop rule was applied before
changing worker behavior or introducing a compatibility bypass.

## Finding

The design section 3.1 budget table names `RegexInput.ts`, but does not separate
its parent-side source accounting from its worker-local source validation.

- `RegexWorkerEvaluation.ts:49` installs `makeCitationRegexInput(limits)` inside
  the isolated v2 worker. Its `evaluate` calls `sourceInput.prepareUnicode` at
  line 64. `RegexAlphabet.ts` also uses the source preparer in that process.
- Before A2, those installers find no optional parent budget. Their composed
  reservation is intentionally a no-op while their local policy checks remain.
- The trial replaces that capture with a call-time `CitationInvocation` read.
  That hard requirement reaches `citationRegexWorkerProgram` and both worker
  entrypoints. The Bun and Node roots supply crypto and stdio, not an invocation.
- The source check reports TS377004, missing `CitationInvocation`, at
  `RegexWorker.entry.ts:16` and `RegexWorker.node.entry.ts:16`.

A parent invocation is a process-local Context service containing a live budget
and Scope; the v2 child cannot read it. Installing a new invocation in the child
would introduce a different budget/admission/lifetime. Keeping an optional
lookup would violate A2. A behavior-preserving split between parent-accounted
preparation and worker-local validation needs to be stated in the design before
continuing. No worker entrypoint, protocol, process, lease or limit was changed
in this trial.

This is a source/typecheck finding, not an observed post-change runtime replay.
The current trial has additional ordinary type errors from incomplete service
propagation and callbacks restricted to `R = never`; those are not independent
stop-rule evidence and are not claimed fixed.

## Checks

- `bunx --bun vitest run test/CitationCanonicalFullSpan.test.ts`, from the
  server package, before the binding trial and with the inherited diagnostic
  probes: **11 passed**, 188.89 seconds. The 5-minute host load was below 128.
- `bunx turbo run build --filter="@beep/law-practice-server^..."`: **passed**,
  57 tasks successful, 56 cached.
- `bun run beep:check`, from the server package: **failed** in source checking.
  The test typecheck was not reached. The failure is introduced by the partial
  trial, including the isolated-worker requirement described above.
- Post-change canonical replay and package verification: **not run**, because
  the stop rule was reached with the source check failing.
- `citationCanonicalFullSpanWork` and its fixture file remain unchanged.

## Counts

The only successful replay in this session was the pre-binding baseline. An
identical post-A2 result is **not established**.

| Count, ten Bun calls | Before binding | After binding |
| --- | --- | --- |
| Metadata-operation installs | 140 | not measured |
| Configuration detaches | 80 | not measured |
| Tokenizer builds | 10 | not measured |
| Regex worker constructions | 56 | not measured |
| Regex evaluations | 291 | not measured |
| Child processes | 291 | not measured |

## Design-table coverage in the partial trial

All eleven budget sites were edited, but have not passed typechecking:
`RegexInput`, `TokenContext`, `ExtractionSelection`, `DiffWorker`, `XmlWorker`,
`MetadataComposition`, `Rendering`, `PythonRepr`, `ResourceCorrection`,
`NativeRendering`, `CourtLookup`. The additional optional capture in
`CleanerPipeline` was also edited.

The fourteen admission table entries were edited: both entries represented by
`Tokenizer` installation/run, `ExtractionLoop`, `ExtractionSelection`,
`ReferenceTokenExtraction`, `PreCaseMetadata`, `PostCaseMetadata`,
`PinExtraction`, `CaseMetadata`, both `LawMetadata` run sites, `JournalMetadata`,
and the `AnnotationEntry` child capture. Shared nested admission wrappers in
`MetadataComposition` were removed. `captureCitationOperationChildren` and
`captureCitationTextReservation` were removed. These are partial source changes,
not accepted or verified implementations.

`Invocation.ts` now contains the initial policy schema, service and constructor.
Worker-v3 lane/session/receipt fields are omitted by the accompanying decision.

Not completed: public boundary wiring, complete callback requirement propagation,
removal of every nested deadline, direct-stage fixture helper, guard/refusal test
updates, GritQL rule, package verification, post-change count proof, policy
fingerprint verification, staging, commit and draft publication.

The inherited 13-file diagnostic diff is retained in `.a2-inherited.patch` as a
local recovery artifact. Diagnostic logs are local scratch artifacts and must
not be staged. The implementation trial remains dirty for the owning session.
