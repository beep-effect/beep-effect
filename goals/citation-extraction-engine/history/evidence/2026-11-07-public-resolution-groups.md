# Public resolution groups and short-form edition capture

The public CitationEngine.resolve operation now replays all thirty committed
original default operation observations through the real production-configured
Layer. They contain ninety-four mentions across all eight canonical families
and retain both original source-site identities. Expected group memberships
come from the pinned oracle, independently of the target resolver. Source
witness text/coordinates are constructed around supplied semantic objects;
this proves resolution conditionally and does not establish extraction parity.

## Corrections exposed by the replay

The shared trusted edition selector previously considered only FullCitation.
A short case with a selected reporter edition absent from earlier full cases
therefore failed defaultSelectedEdition with identity-failed, translated to
CitationInputError. The selector now accepts the schema-derived full/short
publication subset and authenticates short case editions as case editions.
First-occurrence ordering and deduplication remain unchanged. Both extraction
and raw-source resolution consume this selector; no caller spelling is trusted.
The original id-resolution operation with a U.S. full case, F.2d short case and
Id. independently exposes this defect without changing its expected groups.

Null-page full cases exposed a separate ownership obligation. Their source
hash uses object identity. CitationEngineLive now explicitly requires the
existing CitationMissingPageIdentityFactory at installation, alongside native
admission, instead of building a nominally ready engine that later refuses
valid null-page citations because no identity provider was captured.

The shared test installer supplies fresh controlled identity integers per
operation, as the existing private resolver tests did. This is an explicit
conditional grouping test, not a production identity allocator, native address
claim or proof of exact observed hash integers. Default production identity
allocation and the associated representation/fidelity laws remain open.
No random/content-derived stand-in is installed in production.

## Validation

Fourteen public resolution/public extraction/private resolver regression tests
pass in 60.67 seconds. The immediately preceding four-operation Layer tests
also pass on both actual runtimes. Package lint/types and blocking laws pass.
Scoped Fallow passes with zero introduced findings and nine inherited clone
groups; no threshold or baseline changes. The divergence audit retains every
open obligation. The final schema guard refactor passes a fresh two-runtime public resolution
replay in 9.15 seconds. Server declarations emit successfully.

```sh
cd packages/law-practice/server
bunx --bun vitest run test/CitationEngineResolution.test.ts
cd ../../..
bun run beep quality package-verify @beep/law-practice-server --quick
bun run beep lint laws --package packages/law-practice/server
```

## Verification scope

Each public call snapshots structural receipts bound to the actual installed
engine artifact, re-verifies its canonical source/anchors, and uses captured
frozen vocabulary. Every group is compared as ordered original mention indices.
Returned source, mentions and operation/artifact report identity are checked.
Canonical source lookup observes one active operation; all admission releases.
Resolution launches no native children, and the exact zero-launch observation
is checked with the existing composition-release assertion.

The existing fixture preparer accepts an optional artifact while retaining its
previous default for private tests. Constructed witnesses do not acquire any
new extraction provenance. Complete metadata/extraction and retained-host
qualification, production identity allocation, lawful transforms, safety and
scaling, source/donor dispositions and lifecycle acceptance remain required.
All eleven representation laws, four fidelity questions and fifteen unfinished
proof rows remain open without waiver.
