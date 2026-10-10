# Vendored: cmark-gfm pathological-input suite

- **Upstream:** [github/cmark-gfm](https://github.com/github/cmark-gfm)
- **Tag:** `0.29.0.gfm.13`
- **Commit:** `587a12bb54d95ac37241377e6ddc93ea0e45439b`
- **License:** BSD-2-Clause
- **Vendored via:** `.repos/cmark-gfm` (git submodule, sparse checkout of
  `test/`, `extensions/`, `src/`, `COPYING`); source file:
  `test/pathological_tests.py`

## What this is

`cases.ts` carries the `pathological` dict from upstream's
`pathological_tests.py` over **as TypeScript data**, not as executed Python —
every case's input construction (repeat counts, nesting shapes) and
expected-output regex is translated 1:1 into the package's
`PathologicalCase` shape. Upstream's per-case `TIMEOUT = 5` (seconds) is
widened to the house-standard `8000`ms per the P1 plan.

## What was excluded and why

- **`tables`** — depends on the GFM table extension. P1 is CommonMark-only;
  this case (and the rest of the GFM pathological/conformance surface) joins
  in P2 alongside the other GFM constructs.
- **`many references`** — commented out in upstream's own source (never an
  active case); not ported for the same reason upstream doesn't run it.

Every other case in upstream's dict — 20 in total, including the
`hash_collisions()`-generated `reference collisions` case — is ported.

## `reference collisions` fidelity note

Upstream generates this case's input and expected regex programmatically via
`hash_collisions()`: a deliberately weak hash function (mirroring an old
cmark refmap bucket hash) is used to find the first 50,000 keys that collide
into the same bucket (of 16), producing a link-reference-definition document
engineered to degrade a bucketed refmap into worst-case behavior.

`cases.ts` ports `badhash`'s 32-bit masking arithmetic using JS `BigInt`
specifically because Python's `&` on a negative integer treats it as
infinite-precision two's complement, and JS `BigInt`'s `&` does the same —
`Number` with `>>> 0` semantics does not. This was verified by running the
upstream Python algorithm directly (`python3 -c ...`) and diffing the
resulting `bad_key` and generated document against the TypeScript port's
output: both produced `bad_key = "x8"` and byte-identical documents for
`COUNT = 50000`, `REFMAP_SIZE = 16`.

## Attribution posture

Adapted-as-data vendoring: `cases.ts` is source code, not a copy of upstream
files, but its case definitions are a direct, faithful translation of
copyrighted upstream test data and therefore carry the BSD-2-Clause
attribution above per the house vendored-engine pattern. Test-only; never
imported from `src/`.
