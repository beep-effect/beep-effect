# adapter-journal golden fixture

This fixture is relocatable and mirrors all three run-2 corpus layouts.
`expected-metadata.yaml` supplies a fixed synthetic 40-hex commit because
self-check mode has no run manifest. `input/` contains the source projections,
and `expected/` contains one byte-exact `so-*.yaml.expected` document per
emitted SourceObservation — the suffix keeps the auditor's scanner, which
reads every `so-*.yaml` under the ontology root as live evidence, away from
fixture bytes.

The fixture locks these behaviors:

- kind-local key tracking: the same structural keys are observed separately
  for admission, attempt, and verdict projections;
- lexicographic file order: each kind's `a` input precedes its `b` input;
- first-occurrence selection: the second `nonce` assignment is ignored;
- bounded emission: `admission/b` has no new key and emits no record;
- properties comment rules: the line-start `!` line is ignored while the
  inline `!` in `inlineMarker=alpha!beta` remains payload;
- validator closure: whitespace-bearing `message` values are not shortened
  into `config_key_value` facts; and
- canonical sorting: the attempt-b excerpt comes from `inlineMarker`, the
  first emitted fact after sorting, even though `outcome` occurs earlier.

Run the trusted adapter copy with `--self-check <golden-dir>`. The self-check
re-derives the records in memory and compares filenames and bytes with
`expected/`; it does not write generated output into the fixture.
