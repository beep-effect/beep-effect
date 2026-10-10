# Initial storage policy and reversal

This is initial schema version 1, not a migration of an existing production mailbox. A store records one metadata version and refuses unknown future versions before changing message/grant/enrollment rows. Development proof databases created while the schema was being authored must be retained as private historical proof, and the next proof uses a fresh private state directory. Do not silently retrofit a proof database with a guessed ALTER TABLE.

Reversal disables the owned dispatcher/MCP registrations and closes their scoped provider/SQLite clients. Retain the original private database and sidecars: delivery receipts, grant budget and ambiguity holds must survive reversal. Do not drop message rows, reset launch budgets, or clear ambiguous claims to recover service availability. A compatible reader can inspect retained state; an older writer must reject an unknown version.

For a backup, stop all writers belonging to this owned router first, confirm its scope is disposed, then retain the database together with any WAL/SHM sidecars in a separate private directory. An online backup must instead use SQLite's supported consistent backup/export boundary; copying only the main database while a WAL writer is active is insufficient. Restrict backup directory/files to owner-only access. A real stopped-writer fixture closed its scoped SQLite writer before copying the main database and any existing WAL/SHM sidecars into private backup and restore directories. The reopened restore preserved pending inbox, accepted receipt, duplicate-free retry and exhausted persisted grant budget. This qualifies that fixture procedure; it does not claim a production mailbox reversal or online-copy safety.

Enrollment replacement is a deliberate reconciliation boundary. A higher direct-endpoint generation fails unsent accepted messages addressed to the old generation in the same transaction, preserving a diagnostic receipt and allowing newly accepted messages to the new generation. It does not redirect old mail automatically. Replacement is refused while a dispatch or ambiguous outcome is unresolved, including an acknowledged message whose provider call is still active. Reply acceptance retains the original conversation and both direct endpoint generations. This first slice offers no orchestration-role takeover or manual ambiguity-clear command.

The file-backed [process fixtures](../../../packages/tooling/tool/cli/test/agent-message-store.test.ts) cover SIGKILL after acceptance/claim and independent-process dispatch exclusion; their latest passing receipt is recorded by the storage owner. They do not prove power-loss durability or qualify every filesystem. WAL/FULL is configured and read back; native provider execution remains outside SQLite transactions.

## Source and scope review

Replacement also refuses delivered messages awaiting acknowledgment, including
after the native turn has ended. Their expiry records an owned ambiguity instead
of silently releasing them. If acknowledgment precedes an uncertain completion,
history retains that acknowledgment and appends an ambiguity diagnostic. Only a
confirmed result for the same active attempt reconciles its hold; an old completed
attempt cannot reopen a settled dispatch. The final 23-test store suite includes
regressions for these three independently reproduced cases and passes alongside
18 boundary tests. Independent store and boundary reviews report zero remaining
actionable findings; package and hosted proof remain separate.

Promoted from the storage owner's initial-policy/reversal handoff on 2026-10-09.
Reviewed against [store initialization and transactions](../../../packages/tooling/tool/cli/src/commands/AgentMessage/AgentMessage.store.ts)
and the file-backed process/schema-version fixture suite. The version fence runs
before message, grant and enrollment table initialization; WAL/FULL configuration
precedes that fence. The storage owner reported 35 combined passing tests including that real stopped-writer
backup/restore fixture; a subsequent scope-audit combined rerun passed 36 tests.
No power-loss or deployed-state downgrade experiment was performed by this review. Prototype databases from earlier in this implementation are
historical fixtures, not deployed mailbox migrations.
