# Source set-copy behavior for tokenizer ordering

The source tokenizer starts each selection with set(self.unfiltered_extractors).
Rebuilding that collection by repeated add is not equivalent. In pinned CPython
3.11.15, set_merge into an empty set sizes from twice the source used count,
then either preserves a same-sized table or clean-inserts cached keys/hashes in
source bucket order. This can shrink or expand the table, changing iteration
order relative to a normal incremental rebuild.

The existing RuntimeSet adapter now exposes copy alongside add/read. It reuses
Effect HashMap persistent storage and Semaphore serialization. Same-sized copies
may safely share immutable bucket cells; roots, counts, locks and work guards
are independent. Resized copies use the existing clean-insert implementation.
Stored hashes and object IDs are preserved, including source objects whose
current hash differs from their insertion hash. Copying does not invoke object
hash or equality protocols. Comparison and the enclosing work service remain
captured with R = never, including recursively copied sets. No second collection
manager is introduced.

The private source-compatibility adapter remains necessary because ordinary
Effect HashSet does not promise CPython's seeded hash-table iteration order.
Effect HashSet continues to provide ordinary membership in extractor selection.
Deletion/dummy slots, arbitrary set merge/update and reentrant comparisons are
not claimed by this add-only copy profile.

## Independent evidence

The new producer requires the exact clean eyecite pin/tree, CPython 3.11.15,
64-bit Python hashes, hash seed zero and the previously pinned setobject.c file
digest. Twenty cases span source sizes 0, 1, 4, 5, 7, 10, 18, 19, 20 and 76,
with and without changed object hashes before copying. Colliding and signed
hashes exercise clean insertion and resize boundaries. Python records original
and copied iteration, 100 later parent/child mutations with exact comparison
traces, and nested copies. Each actual source copy asserts that no object hash
or equality callback ran. Sixteen copied orders differ from incremental rebuild;
those observations prevent the simpler incorrect implementation from passing.

Target tests match every copied/nested order and all later comparison and
parent/child iteration traces. A separate work-exhaustion control confirms failed
copying leaves the source membership intact. All original eight add/growth/
changed-hash/comparison-error cases and 71 insertion events remain required.
The complete runtime-set/selector/lowercase focused run passes eleven tests.
Quick server lint/type checks, scoped Oxlint and zero-finding new-only Fallow
pass. Repeat producer output is byte-identical after formatting.

The fixture SHA-256 is
2e2a92b749916ab9dd277233fcec200402a7e629c37a5355eba8a8e1d3e69195.
The producer SHA-256 is
09eb3c284c064c047906447ed50143687aaa2d93870d7071b7e66772b7321bcb.

This supplies a required tokenizer-order primitive. Full extractor repr/hash
binding, original matched-key event order, source equality classes, token
construction/merge behavior, family/scaling proof and complete public engine
integration remain open. No full tokenizer, family or engine completion row is
advanced. Latest-head hosted proof remains required.
