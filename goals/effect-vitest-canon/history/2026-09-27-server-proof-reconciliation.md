# Server and architecture proof reconciliation

The Agents Server and architecture proof app saved inventories are complete.
Seven test files retain all 29 Node/Bun cases, codec domains and original oracle
strength. Scope, assertion, property, flake and runner commits are separate and
reviewable within consolidated PR #1307. Production scanner bytes are unchanged.

Proof: both final package audits and docgen pass. Native properties pass at
400 runs with seed 20260708; three inverted-oracle controls fail with replay
information. Kernel overlap instrumentation passes all six serial cases and
fails five when concurrency alone is restored. Controls restore source bytes.
The architecture operation-plan regression passes all 17 cases against the
updated accepted proof app. Real PGlite provider CRUD/tenant/concurrent-ID tests
execute under Node and Bun, with original five-minute deadlines preserved.

Four current detector exceptions remain: native vi import required by the
installed hoist transform, the non-service module function/execution-plan mock,
and two hermetic public-layer hook budgets. The prior package ledger lacked
seven current root assertion rows and one updated property row; these are
incorporated with fix commits. All 13,342 ledger rows and 6,928 root findings
pass strict schemas and unique-ID validation. Owned row bounds pass. The 678
unrelated ledger hashes and unrelated root/census objects are preserved.
Detector ratchet reports 1,209 files, zero introduced and zero resolved after
reconciliation. No fresh global census is claimed.

Runner adoption adds two development dependencies, four generated TS references,
four generated Fallow allowances and 18 reviewed cache dependency edges only.
Four Node timing summaries and four context receipts include source hashes,
runtime versions, load/pressure and separate Bun results. Failed hoist timing
is excluded; these observations do not establish a causal speedup.

Hosted integration failure at aa7c7a1447 was reproduced and repaired separately
in commit 61f89b16d4. Both external Drizzle tests pass Node/Bun and its complete
package audit/docgen passes. Hosted confirmation on the next head remains open.
Vercel statuses explicitly reported rate limiting and were acknowledged under
the repository's existing exception. No review comments were present at the
last check. The remaining saved inventory has 62 packages and 3,132 open
findings; the consolidated goal and full-head proof remain in progress.
