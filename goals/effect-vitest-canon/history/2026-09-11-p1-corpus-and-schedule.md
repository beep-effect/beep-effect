# P1 starting corpus and dependency schedule — 2026-09-11

The accepted starting main is `662823dd960367046ba7d73dd8fd25d15782865a`.
The refreshed census contains 1,122 files across 139 owners: 1,012 tests and
110 support modules. Twelve cache-qualification tests were added since the
foundation census; no former census file was removed. The emitted detector
inventory contains 8,228 open candidates. Ninety additions are inherited on
main, and the normal ratchet check exits one. Its baseline remains unchanged.

`ops/inventory/package-schedule.json` is the accepted P1 audit order. The live
manifest graph has 142 workspaces, including three intermediaries with no
census files. It contains 687 runtime and 133 development dependency edges.
Both the all-dependency and production-only graphs have no cycles at this
snapshot. SCC and independent dependency-first checks retain a way to represent
future cycles without inventing an order inside one. Root verified all 166
planning inputs, 12 output hashes, true owner roots, complete census membership
and dependency ordering. Every file appears in exactly one of 159 batches,
each containing at most 20 files. Source-level dynamic edges are outside this
manifest graph.

The initial eligible owners are fc-runs, types and todox. Identity follows in
wave one; repo-cli follows its prerequisites in wave ten. Multiple chunks of
one package retain a single writer. P1 batches are audit units, not P2 migration
or package-proof boundaries. The topo-sort command's bucket-level graph defect
is attributed in research/OPPORTUNITIES.md; no source repair is included here.

Four-lens coverage, package timings and hosted failure attribution are still
in progress. Empty result sets are not assumed to mean no findings. The final
P1 summary and 40-file Grok review must finish before Benjamin acknowledges
the inventory and P2 begins.
