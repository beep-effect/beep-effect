# Source resolution inside verified extraction ownership

The private `makeCitationSourceExtraction` constructor composes the existing
single-source request adapter and verified extraction through
`makeCitationMetadataStage`. The existing outer operation admits before resolver
work. Existing child Context installation reuses that permit; no second queue,
worker abstraction, source resolver or verifier is introduced. The same enclosing
extract deadline and cumulative text budget cover preparation and all nested
cleaning, native extraction, semantic projection and occurrence verification.
SourceTextResolver is captured at installation; returned extract has R=never.

The private result remains CitationVerifiedExtractionResult, retaining genuine
source/occurrence capabilities and original semantic/model state. A named result
annotation prevents declaration inference from exposing prerequisite private
capability symbols. Deployment binding and final public service remain required.

## Verification

Initial connected Bun/Node replay passes both tests in 83.57 seconds. Package
lint/type checks and declaration build pass. Blocking laws, scoped codec lint
and Markdown lint pass. Final replay including the refusal control
passes both tests in 118.31 seconds. Scoped Fallow and exact-head hosted
confirmation remain pending at publication.

Connected regression compares the composed raw-source route to the existing
verified route for plain, Unicode and HTML cases on both Bun and Node. The
resolver checks active=1 and queued=0; complete original models, source lineage,
semantic citations, primary/full-span evidence and cumulative reservations must
match. Source-text refusal must launch no additional native children and leave
active=0 and queued=0. All launched workers retain independent retirement checks.

The first regression run exposed a missing test CurrentTimeZone provider; the
fixture now supplies the same explicit UTC zone as its existing verified route.
Production installation still requires/captures the configured zone rather than
inventing a default. No thresholds or baselines change.

```sh
bun run beep quality package-verify @beep/law-practice-server --quick
bun run beep lint laws --package packages/law-practice/server
cd packages/law-practice/server
bun run beep:build
bunx --bun vitest run test/CitationVerifiedExtraction.test.ts
```

This increment does not finish dual-source/retained-Document dispatch, public
ports/report/service/Layer, remaining failure translation, transforms, exhaustive
canonical/donor accounting or whole-engine safety/scaling. All eleven
representation laws, four fidelity questions and fifteen unfinished proof rows
remain open without a semantic waiver.
