# AI metrics notification shard ordering

The saved sequence-break proposal identified an ordering assumption in the test
reader: filesystem enumeration order was used as chronological shard order.
The reader now sorts its ISO UTC date filenames before reading them. It still
preserves every file's row order and blank-line handling.

One deterministic native-filesystem witness writes two consecutive UTC shards,
provides reverse directory enumeration through the existing FileSystem seam,
and expects the earlier shard first with both shards' deliberately unsorted
line sequences intact. Removing the filename sort fails the ordering oracle.
Sorting the flattened rows also fails it. Both controls were restored. A
read-only AST audit confirms that all prior source is preserved except the
filename sort and the added test.

Full package verification passes audit (13.7 s) and docgen (4.7 s); root Oxlint
passes. No timeout, retry or flaky-test wrapper was added. This is a reproduced
ordering boundary, not a claim about the cause of a historical flaky run.
Observability, runner integration and final package reconciliation remain.
