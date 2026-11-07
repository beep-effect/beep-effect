# Measured extraction reports separate from citation meaning

The server use-case subpath now owns CitationEngineReport and
CitationExtractionMeasurements. Root/client surfaces remain empty. These are
completed-operation diagnostics, not source evidence, semantic citation fields
or a complete public engine service. Refusal/interruption reporting and other
operation measurements remain required integration work.

Reports bind the pinned oracle and captured engine artifact, include the actual
captured limits, and separate Effect Duration work timing from deterministic
counts/policy. The measured interval covers source preparation and extraction;
it excludes admission waiting and outer-owner teardown. No queue/total-latency
claim is made. Source text, matched text, quotes, locators and source identities
are absent from the report shape.

## Authoritative measurements

The existing builtin tokenizer now returns patternsChecked equal to the number
of selected extractor occurrences actually executed. Every occurrence goes
through the existing worker loop; failures publish no successful tokenizer result.
The fixture asserts that count against the independently pinned source selected
list. This is tokenizer work, not an invented count for all helper regexes.

Single and paired raw-source extraction use Effect.timed inside their existing
captured operation. The report projects actual tokenizer counts and returned
semantic/verified/unverified/component/warning lengths, and the final enclosing
text-budget snapshot. The original shortcut records tokenizer=null rather than
zero executed patterns. Native and semantic results remain intact; reporting adds
no worker, admission owner, resolver, timer implementation or event framework.

Schema checks enforce operation/measurement correspondence, finite nonnegative
duration, absolute and captured count ceilings, and verified+unverified occurrence
accounting. Named independent checks replace a single compound predicate after a
scoped estimated-coverage complexity finding. No rule, suppression or baseline is
changed. Reports are data, not proof that all whole-engine safety acceptance has
been qualified.

## Verification

Twelve server tests across four files pass in 68.86 seconds, covering the
controlled/default tokenizer, verified raw-source reports and paired extraction
on Bun and Node. Tokenizer pattern counts match original selected rows. Connected
reports match engine identity, exact cumulative reservations and output counts;
encoded reports exclude raw input and sourceText fields.

A dedicated captured-Clock test delays the actual canonical resolver by seven
milliseconds and checks report workDuration=7ms through the original shortcut.
It checks one unverified semantic result, no tokenizer measurements and zero
spawned/confirmed workers. Final dedicated replay passes in 9.18 seconds.

Two use-case contract tests pass, including JSON round-trip with fractional
Duration, skipped versus executed-zero tokenizer, impossible operation/count/
policy/timing rejection and root/client isolation. Both packages' lint/type
checks and server declarations pass. Actual package docgen typechecks all 571
examples. Blocking laws and scoped codec lint pass. Scoped report health has no
findings after check separation; exact-head hosted confirmation remains pending.

```sh
bun run beep quality package-verify @beep/law-practice-server --quick
bun run beep quality package-verify @beep/law-practice-use-cases --quick
bun run beep lint laws --package packages/law-practice/server
bun run beep lint laws --package packages/law-practice/use-cases
cd packages/law-practice/server
bun run beep:build
bunx --bun vitest run test/CitationExtractionReport.test.ts \
  test/CitationVerifiedExtraction.test.ts test/CitationPairedSource.test.ts \
  test/CitationTokenizer.test.ts
cd ../use-cases
bunx --bun vitest run test/CitationEngineReport.test.ts
bun run beep:docgen
```

Hosted Fallow, Secret Scanning and JSDoc Ratchet pass on preceding head 39186b0105
(Check run 42281310759). This does not prove the new report head. Public cleaner/
tokenizer ports and complete request/service/Layer, failure reporting/translators,
mutable/custom-tokenizer Document behavior, transforms, final document integration,
exhaustive canonical/donor accounting and whole-engine safety/scaling remain open.
All eleven representation laws, four fidelity questions and fifteen unfinished
proof rows stay open without a semantic waiver.
