# Explicit-key spill fixtures (#323)

Expected `Yaml.stringify` output for block-mapping keys whose **rendered**
form exceeds the YAML 1.2 implicit-key limit of 1024 characters — such keys
must spill to explicit-key form (`? key` / `: value`) or strict parsers
reject the output.

Authored **once** against the reference `yaml` npm package as a strict
oracle; only these generated files are committed. The reference package is
NOT a dependency of the test run — the committed bytes are the contract.

- Oracle: `yaml@2.9.0` (`YAML.stringify` defaults, indent 2)
- Generated: 2026-08-12, in a scratch directory outside the repo
- Every fixture re-parsed under the oracle's strict parser and
  value-roundtripped before being written

Cases (keys are `pkg-a@1.0.0(` + `a`×1100 + `)` and the `b` twin, or
`k`×1024/1025 for the boundary pair — reconstructed identically in
`__test__/Yaml.test.ts`):

- `scalar-value.yaml` — long key, scalar value on the `:` line
- `null-value.yaml` — long key, `: null`
- `seq-value.yaml` — long key, compact block sequence on the `:` line
- `map-value.yaml` — long key, compact block mapping on the `:` line
- `single-pair-map-value.yaml` — long key, single-pair compact mapping
- `two-entries.yaml` — two long-key entries in one mapping
- `pnpm-snapshots.yaml` — the pnpm 11 lockfile `snapshots:` shape (the
  real-world input class; parse side fixed in PR #322)
- `boundary-1024-implicit.yaml` — rendered length exactly 1024 stays
  implicit (the oracle's threshold is `> 1024`, not `>= 1024`)
- `boundary-1025-explicit.yaml` — rendered length 1025 spills

## Deliberate divergence from the oracle

Compact continuation lines (the lines after `: first-item` / `? first-line`)
are padded with a **structural two columns** — the width of the `?` or `:`
indicator plus its following space — never the configured `indent`. `yaml@2.9.0` pads them with the
configured indent instead, and at `indent ≠ 2` its own strict parser
misreads the sequence output (items merge into one scalar) or rejects the
mapping output outright. The house fidelity contract (our emit must reparse
to the same value) wins over bug-for-bug oracle agreement; at the default
`indent: 2` the two spellings are byte-identical, which is why these
fixtures (generated at default options) still pin our output exactly.

To regenerate: install `yaml@2.9.0` in a scratch directory, stringify the
values above with default options, assert strict re-parse + roundtrip, and
overwrite these files. Update the oracle version and date here.
