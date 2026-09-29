---
"@beep/repo-cli": minor
---

`beep quality check-census` now gates single-checker instantiations against the committed
`standards/check-census.regression-baseline.jsonc` (`check-census-baseline/v1`). An instantiation
increase, a compiler change, or a selection with no baseline row (a mistyped `--filter`, named in
the failure) fails the run; check time beyond a 5% band is advisory; a decrease
prints a tighten hint. New flags: `--baseline`, `--write-baseline` (re-measure every row, refusing
programs with type errors) and `--gate-only` (skip the overlay census). The overlay census also
records default-mode instantiations, types and check time.
