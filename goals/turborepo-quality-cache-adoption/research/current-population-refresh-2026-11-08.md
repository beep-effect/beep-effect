# Complete accepted-source population refresh

This is a source and metadata census of accepted revision
`10fe469ae2106a502ef1f74b2dfdac5844444b67`, not execution or qualification.
The [current projection](current-population.json) preserves the complete
[script-only inventory](nested-entrypoint-inventory-2026-11-08.json).

| Population | Count |
| --- | ---: |
| Workspaces, including the root | 200 |
| Root scripts | 117 |
| Configured graph nodes | 4,668 |
| Configured executable computations | 2,512 |
| Graph-only nodes | 2,156 |
| Declared executable script entrypoints | 4,368 |
| Additional script-only entrypoints | 1,856 |
| Complete native query catalogue nodes | 6,524 |
| Script-only entries with a literal configured caller | 1,352 |
| Script-only entries without that simple caller form | 504 |

All 484 census source hashes were checked against both accepted Git blobs and
the working files. Both committed client pins (stable 2.11.10 and canary
2.11.11-canary.1) independently returned equal catalogues. Every non-null
command matches its manifest script, and every configured graph node agrees
with the catalogue. The two queries verified all source hashes and native
binary digests before and after capture. No repository task body executed.
This is not a fresh upstream registry/tag lookup.

The fixed native metadata query selected only package name, task full name
and command, retaining the twelve-second/one-MiB stdout/64-KiB stderr bounds
per client and thirty-second aggregate bound. Raw captures and the collector
remain private; the linked JSON retains their byte counts and digests.

A configured caller edge means only that its complete command is literally
`bun run <script>` in the same workspace. It does not establish execution,
semantic equivalence, safe reuse or deduplication. Dynamic and composite
callers still require review. Neither configured cache flags nor catalogue
presence grant qualification.

## Preserve prior decisions and complete scope

The [previous reviewed population](prior-reviewed-population-2026-11-08.json)
is retained byte-identically, with its prior history chain intact. The chain
contains 205 historical reviewed computation identities; 203 still occur in
the new configured executable set. The initial refresh leaves all 2,512 rows
pending source/profile revalidation, with no disposition inferred from history.
The five retained qualification-ledger exclusion records apply only to their
original tuples.

The subsequent [current fixer review](current-mutating-fixer-review-2026-11-08.json)
reads the current manifests and effective configurations again. It gives
whole-command keep-fresh dispositions to 196 configured `lint:fix` wrappers
and separately identifies their 196 script-only `beep:lint:fix` implementations.
All explicitly invoke `biome check` with `--write`; all configured cache flags
are already false and output archives empty. The nonwriting `lint` counterparts
exist but remain unqualified. The Storybook command's Git-root path discovery
does not make its requested source mutation reusable.

This leaves 2,316 configured computations and 1,660 script-only entrypoints
without current final dispositions. The two populations are names in different
inventory projections, not disjoint counts of semantic computations or actual
executions. The linked native catalogue's pending-state statement describes
the capture before this separate source review; it is not a qualification
grant or an automatic carry-forward of historical decisions.

The old refresh writer silently omitted the linked script-only supplement.
The replacement requires a current supplement when one already exists and
independently recomputes its complete row identities, literal command hashes,
caller edges and counts from the census before changing either output or
archive. A real invocation without the required supplement refused before
writing; the corrected invocation produced the full projection. These were
metadata operations, not local quality suites. The unpublished graph-only
intermediate was retained privately rather than promoted or discarded.

Remaining work includes the remaining current semantic reviews, dynamic/non-Turbo
execution reconciliation, feature decisions, tuple qualification, adoption,
value measurement, representative observation and rollback proof. Both goals
remain active and all whole-goal acceptance criteria remain unproven.

Reversal restores the preceding population projection and its linked report
through a normal PR, preserving this archive and every historical receipt.
No runtime configuration, credential, cache policy or qualification-ledger
state changed.
