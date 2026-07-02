# P2 Compile Blast-Radius Measurement

Date: 2026-07-02. Method: `tsc -p tsconfig.json --extendedDiagnostics` on
`@beep/identity` (tsbuildinfo cleared) and wall-clock `tsc -b --force` on the
direct dependent `@beep/schema`, at HEAD (P1a+P1b, `811733b62c`) vs baseline
(`647093884d`, pre-P1a) via in-place package checkout.

| Metric | Baseline | HEAD | Delta |
| --- | --- | --- | --- |
| identity Types | 15,713 | 16,670 | +6.1% |
| identity Instantiations | 83,327 | 88,162 | +5.8% |
| identity Check time | 0.25s | 0.26s | +0.01s |
| identity Total time | 0.92s | 0.97s | +0.05s |
| schema `tsc -b --force` wall-clock | 6.41s | 6.57s | +0.16s (~2.5%, noise range) |

## Verdict

The `Curie<V>`/`Predicate<V>`/`Expand` literal machinery and the
binding-threaded composer generics cost ~6% additional instantiations inside
`@beep/identity` itself and effectively nothing downstream today (dependents
do not yet reference `.iri`/`.curie`; template-literal types instantiate at
use sites, so future cost accrues incrementally where the feature is used).
No module-boundary split required. SPEC acceptance item satisfied without a
waiver.
