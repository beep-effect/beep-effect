# Supported Bluebook schema transformations

The citation domain now declares a structured U.S. Reports case profile and two
Effect Schema transformations. `BluebookFromFullCitation` deliberately takes
`S.toType(FullCitation)`: its encoded side is exactly `FullCitation.Type`, not
the citation wire representation. Decode is partial; encode is total for the
supported structured profile. `BluebookTextFromBluebookCitation` renders on
decode and partially parses the documented text grammar on encode. Each declares
information preservation and directional totality separately.

The first profile covers named cases with the frozen U.S. Reports publication,
known Supreme Court identity, canonical positive volume/page, four-digit year
and optional numeric pin. Party delimiters and field lengths are explicit.
Unsupported citation families, publication ambiguity, enriched metadata and extra
components fail rather than being discarded. Equivalence against a reconstructed
full citation verifies the complete supported semantic value. Reconstruction
creates fresh publication, court and metadata objects on every call.

This is an initial supported profile, not completion of Bluebook capabilities,
full manual compliance, or adoption of the donor's entire formatter API. Further
forms and all source/donor dispositions remain open. No provisional generic style
registry or parallel citation wire model is introduced.

## Independent reference evidence

The maintainer probe executes the unchanged `toBluebook` source at eyecite-ts
commit `34133d03143ea65861f48a5ed0eb32c931581666`, tree
`f1243d0723cea1e53a5263ef67c9e066230729fc`. It checks source/license bytes
against that commit and records their hashes. The existing authorized donor copy
is reused without installation or dependency changes. Its MIT notice is retained
in `THIRD_PARTY_NOTICES.md`.

Three constructed formatter inputs observe ordinary, pin-inclusive and Unicode
layouts. These are conditional formatting observations, not original extracted
citations or source-span proof. The independently sealed vocabulary mapping
supplies the fixed edition, reporter, court and vocabulary identities. Production
code does not create the expected formatter output. Effect TemplateLiteralParser
owns text parsing; the domain schema supplies equivalence and arbitrary values.

The portable fixture SHA-256 is
`7f44910000ef91905c5e1acbf9bdfdba456dadf21ebc1968c363fa7a7978dd68`;
the producer SHA-256 is
`5663f951676120d87cc6baa8b8555335dbef98a0ac751e1aa20ca2c6ca0a33ea`.
The verifier supports exact source replay and seven altered evidence/producer
controls. The ordinary domain test compares all three recorded outputs and their
publication/court identity against the target schema transformations.

## Qualification boundaries

Tests cover unsupported lawful citation families, loss of metadata/components,
publication and court mismatches, ambiguous delimiters, maximum field lengths,
Unicode and absent pin, and fresh returned object identities. Two schema-derived
properties run 100 examples each for semantic reconstruction and parse/render
convergence. The compile-only fixture proves all four inline call result types
and rejects encoded citation wire as decoded input; the package test type checker
owns this fixture, rather than a separate dtslint execution claim.

All eleven representation laws, four fidelity questions and fifteen unfinished
proof rows remain open without waiver. Whole-engine safety/scaling, production
identity/default-owner assembly, general host/model/callback behavior, exhaustive
source/donor reconciliation and lifecycle acceptance remain required.

## Executed checks and hosted lint repair

The final domain run passes 21 tests across the Bluebook and canonical model
files. The two use-case input/report files pass eight tests. Six additional
server schema properties pass 100 examples each; their other thirty tests were
explicitly filtered out in that property-only run. Twenty affected clock,
shortcut, semantic and source-evidence regressions pass across six files.
All three touched packages pass focused lint and type checks. Domain declarations
and blocking laws pass. Scoped Fallow passes with zero introduced findings and
nine inherited clone groups; no Fallow baseline or threshold changes.
Exact pinned formatter replay and all seven corruption controls pass.

Published head `1b4a513a367fcb3e90fcba3117736ec3ea2b3801` fails hosted Heavy /
Lint Policy (job 128280334737). Its diagnostics identify four inline schema
compilations, two Option-struct projections, eight files lacking schema-derived
property coverage and sixteen Effect Vitest findings. The repairs hoist schema
construction, reuse the existing typed Option helper, add the properties above,
replace predicate assertions with semantic utilities and isolate adjusted test
clocks in fresh nested TestClock layers. Focused detector replay leaves exactly
two real-filesystem findings. Those receive explicit scoped reasons in the
Effect Vitest inventory: authenticated frozen assets must actually be read from
disk. The schema inventory writer removes two resolved exceptions; it admits no
new schema findings. These changes still require new-head hosted qualification.
