<!-- seat: grok-4.7 medium (third seat; Fable and cursor Opus quota exhausted, 2026-10-09) -->
I'll review the memfs port read-only against the pinned upstream oracle, the round-2 inventory, and the port ledger, and report only new findings.### fable-3-1
- file: scratchpad/effected/memfs/NodeSyncFileSystem.ts:178
- class: bug   severity: required
- standard: D9, D11, D15; pinned oracle `src/NodeSyncFileSystem.ts:120-122`   evidence: The oracle stat catch sets `description` to `(err as Error).message`. A thrown string has no `message`, so the description is `undefined`. A thrown non-`Error` `{ message: "busy" }` keeps `"busy"`. The lab branch uses `err instanceof Error ? err.message : String(err)`, so those same throws become `"conversion failed"` and `"[object Object]"`. D15 forbids the cast, but `P.hasProperty(err, "message") && P.isString(err.message) ? err.message : undefined` is typed and matches both oracle results. `scratchpad/test/memfs/NodeSyncFileSystem.coverage.test.ts:58-64` pins the string-throw description as `"conversion failed"`. `fail` at line 104 is a different formula (`message` when it is a string, otherwise `String(err)`), which matches the oracle `error?.message ?? String(err)` for those two throws. This is not fable-2-8: that item treated the `instanceof` spelling as style and recorded no description change.
- failure: `stat` reports a different `BadArgument` description than the pinned oracle when `fileInfo` throws a string or a non-`Error` with a string `message`. `Effect.catch` on the description diverges, and the new coverage test locks that divergence in without a section 14 cause.
- fix: Set the stat catch description to the string `message` only when the thrown value has one; otherwise `undefined`. Change the coverage assertion at `NodeSyncFileSystem.coverage.test.ts:64` to expect `undefined` for a thrown string. Leave `fail` as it is.

REQUIRED: 1
BACKLOG: 0
