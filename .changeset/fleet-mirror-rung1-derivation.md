---
{}
---

No release: land fleet-mirror rung 1 — `beep worktree fleet`, a read-only derived
view of every checkout sharing this repository's origin.

The scan derives, per checkout: branch/head/dirty facts, three-state liveness
(`live | dormant | unknown` — measured or unknown, never inferred), `git merge-tree`
conflict prediction against a ground-truth epoch target materialized once per epoch
into a dedicated scanner object database, and movement of the measured policy
surface (surface E from `goals/fleet-mirror/research/p0-policy-surface-measurement.md`)
between each checkout's merge base and the target. Signal 3 is the only Mode B
detector: that collision produces no textual conflict, so the other signals are
structurally blind to it.

The scan writes nothing into any checkout; its only write surface is the scanner
object database under the user cache directory. All scanner git plumbing reads
sibling clones' objects through `GIT_ALTERNATE_OBJECT_DIRECTORIES`, so `merge-tree`
result objects land in the scanner, never in a checkout's shared ODB. The snapshot
reports its own scan coverage so a partial scan is legible as partial.

Schema home: the porcelain row/parser and the fleet schema family move to a leaf
`Worktree.schemas.ts` (Goals-family pattern) so the fleet service and subcommand can
depend on them without an import cycle; `worktree doctor` behavior and its row
schema are unchanged, and the package barrel keeps every existing export.
