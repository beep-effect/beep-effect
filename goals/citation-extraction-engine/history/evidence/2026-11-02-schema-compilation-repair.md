# Citation schema construction and tag idiom repair

The hosted policy failure reported 93 `beep(no-inline-schema-compile)` errors.
A fresh focused Oxlint run reproduced all 93 across 53 citation implementation
and test files. It also reported 28 existing namespace-import warnings.

The repair moves the 93 immutable inline schema expressions into 86 private
module constants, reusing identical expressions within each module. Each
constant is placed after its imported or module-level dependencies and before
its consumers. Schema expressions depending on function-local bindings or
callbacks are outside this repair. The decode/encode methods, input values,
error mappings, and underlying schema expressions retain their behavior.

The canonical tag checker separately reported 65 single-literal field repairs
and one tagged-struct repair across 19 goal/citation files. Those now use
`S.tag` and `S.TaggedStruct` respectively, retaining their encoded literals and
required decode fields. Existing corpus JSON values and oracle producers were
not changed.

Validation:

- Focused Oxlint: zero inline-schema-compilation errors; the 28 namespace-import
  warnings remain visible, without suppression or baseline changes.
- Canonical `schema-tag-idioms --check --json`: zero findings.
- Biome: all affected files passed after formatting.
- Four focused identity/callback suites: 24 tests passed in 8.64 seconds with
  one worker, following the schema hoists.
- Goal operations type check: passed after both repairs.
- All 12 portable evidence audit components passed after regenerating the
  divergence ledger. The audit explicitly reports target parity as pending.

This is policy and parser-cache integration work. It is not a full package
quality result, hosted acceptance proof, or completion claim. The target parity
verifier and the remainder of the goal continue in the same PR.
