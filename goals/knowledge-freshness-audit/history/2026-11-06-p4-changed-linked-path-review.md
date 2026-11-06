# P4 changed linked-path review

This increment reviews the frozen-to-current changes in the 80 linked paths
identified by the first P4 reconciliation. The reviewed source is
`1d21c0e0071acc0fa3693208b77ec9b8587b0854`; the original source remains
`e462bc12e9fdb6da2db1f7ad8bd3be791f7806b4`.

Every path has a private disposition and source hashes. The review covers the
complete revision diff and targeted surrounding context. It does not certify
complete body reads, every historical claim, runtime conformance or exhaustive
semantic coverage. Entry receipt links and repeated claims remain separate
from accepted determinations.

## Validated omissions

### P4-V002: list query did not subscribe to mutation invalidation

The atom service example invalidated the `todos` key after a successful create,
but its list query did not register that key. A mounted query could therefore
keep its cached list after the mutation committed.

An in-memory replay used the example's query and mutation declarations. The
original committed one item while the query displayed zero and ran once. With
the query registered through `todoRuntime.factory.withReactivity(["todos"])`,
the same mutation made the query run twice and display the committed item.
The runtime's own factory also preserves the shared-factory alternative shown
in the guide. No HTTP endpoint, React page or external service was exercised.

All seven TypeScript fences in the changed guide pass the existing scoped
Markdown-fence check. That check establishes types, not invalidation behavior;
the separate before/after replay is retained privately.

### P4-V003: obsolete audit resume instruction

The roadmap still placed this audit in its parked queue with a P1 activation
condition. Its freshness header makes older phase snapshots historical, so the
review does not treat the old status as a formal contradiction. The live resume
instruction nevertheless omitted the operator's activation and current P4 work.

A dated execution update replaces that parked row. It records the delivered
repairs and partial phases without reordering other packets, changing the
goal lifecycle or claiming completion. The earlier portfolio history remains.

## Qualified and preserved changes

- Earlier hook changes correct explanatory wording. They do not establish new
  privacy, timing or exit-path qualification.
- Earlier schema, JSDoc, optimistic-update and motion-evidence repairs remain
  bounded by their original proof. Static examples and RMS thresholds do not
  become universal runtime guarantees.
- The validator diff changes targeted self-test fixtures. It does not change
  production validator functions or authorize an ontology operation.
- CLI proof, compiler, cache, orchestration and fleet changes retain their
  existing owners. This review does not replace those owners' runtime proof,
  revive retired routes or take over their source.
- External theory, vendor behavior and dated measurements retain their stated
  assumptions and evidence limits. An unresolved claim is not automatically a
  false statement or permission to rewrite its source.

## Skill metadata and delivery limits

The broad skills update check failed while fetching an unrelated held import
with an upstream HTTP 504. It was not retried or reported as passing. The
changed local skill's entry was computed with the existing canonical local
hash service and lock serializer. Every other lock entry remained unchanged.
The scoped materialization check reports both installed targets current.

PM's missing original and ADHD's imported-source provenance remain separate
holds. No paid service, cloud session, remote worker or ontology workflow was
used. Full records stay private. P4 remains in progress; publication still
requires its exact-head quality, thread and review-window gates.
