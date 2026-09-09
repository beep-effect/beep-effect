# Round 24 reconciliation

Source: `05405bf322da0ca7eb88b8bb402145081e8fded6`.
The packages/apps corpus matches main
`be8995e66aeefedf0dabf131deaeaaf25c8e6fc8`.

This round is superseded and incomplete. It admitted a qualified record, so
it cannot count as a dry round. Twelve primary lanes completed; three were
interrupted by Desktop continuation and ten had not started. After main
advanced, the full round 25 census began on the newly merged source. The preceding inventory is retained at
`history/inventory/2026-09-08-pre-r24.jsonl`.

## Decisions recorded so far

- Removed `legacy-url-policy-relative-flags` from the live inventory.
  `Md.escape.ts:92-98` now declares an empty `CompatibilityUrlPolicy`;
  `LegacyUrlPolicy` no longer exists. The separate allow-list policy retains
  its three independent options and remains in the census.
- Admitted `html-img-sizes-disposition` from the single correction report
  `r24-modeling-img-correction1.jsonl`. The original modeling report's
  `r24-foundation-modeling-rest-img-sizes-issue-flags` D1 decision is
  superseded: concatenating issue arrays does not prove their booleans can
  both hold. `Html.conformance.ts:990` makes missing sizes require absence;
  analysis presence at `:334-347` and the attribute guard at
  `Html.conformance-contracts.ts:235-245` make incompatible sizes require
  presence. The three booleans therefore have four legal combinations out
  of eight. The corrected scanner exited zero with an `end_turn` event.
- Admitted four D1 census records: the independent link image/icon checks,
  recovery-budget predicates, gate-summary agreement checks, and ambiguous
  WebM/Matroska detection evidence. Their source decisions were read against
  the named source before admission.
- Corrected inspector cardinality to 29 projected tuples and replaced stale
  inference, DMS, Vault, and worktree evidence citations. These changes do
  not advance existing record statuses or supply independent P3 review.

- Reclassified `pretext-detect-engine-family` to D1 after the public-export
  reproduction in `data/design-refresh-2026-09-08-pretext-audit.md` proved
  Safari and Chromium facts can hold together. All four combinations are
  accepted; the superseded design is retained under `history/designs/`.
- Completed the HTML sizes design and advanced only that new record to
  `designed`. This is a design completion, not independent P3 review.
- Corrected DMS coarse cardinality to 4/2: every disconnected internal probe
  supplies a known reason. Vault retains 4/3 because old null or missing reasons
  remain legitimate and must re-encode to the old canonical null.
- Admitted ten further D1/D2 census records from the completed Firecrawl,
  graph renderer, parser options, and UI reports. Their source declarations
  and relevant guards were checked; inline SDK option bags use object-literal
  census metadata. The Mermaid validators aggregate separate root and element
  checks rather than storing a correlated phase.

- Admitted five further D1/D2 records from the OpenClaw, Wink, and SHACL
  driver reports after checking their independent projections in source.

- Retained the Variant guard toolkit as a D1 census suspect: the source
  already uses one explicit literal domain and exposes independent callable
  guards; it does not flatten a variant into stored sibling bits.
- Corrected the Yeet verdict legal cardinality from 256 production-canonical
  tuples to all 1025 coherent persisted tuples. The existing contract allows
  any false criterion as the named blocker, and the monitor displays it;
  a decoder must not replace that meaningful choice with first-false.
- Relabeled the browser color-stack and DuckDB transaction evidence as E4
  implications rather than E1 exclusive writes; their existing qualification
  and target designs remain supported.

- Reclassified the shared SHACL result to D1 after a public-service
  reproduction proved all four pairs. The full engine accepts a custom
  severity whose nonempty results still conform, so maxResults zero produces
  combined true. The narrower bounded producer cannot impose a global
  invariant. The withdrawn design is archived; its audit remains in
  `data/design-refresh-2026-09-08-nlp-shacl.md`.

The post-reconciliation inventory is 784 records: 104 qualified and 680
disqualified (D1 544, D2 136). The qualified set is 94 Tier 1 and 10 Tier 2,
with 44 historical `reviewed` statuses and 60 `designed` statuses. No source
implementation or replacement P3 review has occurred.
