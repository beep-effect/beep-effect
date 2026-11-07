# Connected verified extraction and document resolution

A private source-document operation now resolves canonical raw source input,
extracts semantic citations and verified occurrences, obtains selected edition
spellings from the captured authenticated frozen-edition service, and executes
the existing registered default resolver. It produces the resolved document,
restoration receipt and resource bindings in the same admitted invocation.
Single-source and paired-source constructors reuse the original source adapters.

The existing metadata owner supplies one admission permit, Scope, deadline and
cumulative native text budget. Source extraction children reuse that permit.
The registered resolver, secure randomness and frozen editions are captured at
installation; returned extract has R=never. No source, mention, resource-hash,
resolver, dictionary, lifecycle or transport framework is duplicated.

The result retains all extraction semantics, unverified occurrence diagnostics
and source lineage beside the resolved document. Selected edition names remain
available for receipt restoration. Whole-operation work duration is measured
separately from semantics, and final reservation count comes from the parent.
The result does not assert anchors for source-incompatible shortcut semantics.

## Exact source observation and connected proof

The clean oracle checkout was verified at
04d82c032ad5fd0f9ab72a61c87110c46ee8f52e with no tracked/untracked changes.
A direct original get_citations/resolve_citations call for
`Foo v. Bar, 1 U.S. 1 (2000). Id. at 2.` observes FullCaseCitation and IdCitation,
spans [12,20] and [29,37], and one resource group containing two citations.
This is a focused independent observation, not exhaustive case accounting.

Three connected tests pass in 33.68 seconds:

- Bun uses independently verified plain and markup sources through the original
  Both branch. Canonical derived source lineage retains the markup parent while
  occurrence text comes from supplied plain text.
- Node uses the single verified plain source.
- Both actual runtime paths retain the original two spans, two Resolved
  decisions, one authority with both mentions and a coherent CitationDocument.
  The complete document restores exactly from its receipt, edition spellings,
  bindings, expected source and engine identity.
- Resolver work observes one active outer admission. All native children have
  independently confirmed exits; final operation/native admission is released.
- Paired-source eyecite shortcut leaves markup unread, retains all source-
  incompatible semantic results as unverified data and produces an empty
  occurrence document without native work.

An earlier single-source Bun/Node/shortcut replay passed three tests in 21.43s.
An initial assertion incorrectly read the domain resolution discriminator as
_tag; correcting it to the existing status schema preserved the expected two
Resolved decisions. Final lint/types, declaration emission and blocking laws
pass. Scoped Fallow reports zero introduced findings and nine inherited clone
groups with unchanged policy.

```sh
bun run beep quality package-verify @beep/law-practice-server --quick
bun run --cwd packages/law-practice/server beep:build
bun run beep lint laws --package packages/law-practice/server
bunx fallow audit --config .fallowrc.jsonc --format json --quiet \
  --base origin/main --gate new-only
cd packages/law-practice/server
bunx --bun vitest run test/CitationSourceDocument.test.ts
```

The public Engine contract/Layer, complete extraction/cleaning/resolution failure
boundaries, general host/model mutation and missing-page identity adapters,
whole-engine safety/scaling, builtin difflib, lawful transforms and exhaustive
source/donor reconciliation remain required. No native identity is fabricated.
All eleven representation laws, four fidelity questions and fifteen unfinished
proof rows remain open without waiver or disposition promotion. Hosted proof
of the published head remains separate from these focused local observations.
