# Friction ledger — oppold-corpus-salvage-restoration

Receipts recorded at the moment friction occurred, per the repo friction law.

## 2026-08-27 — `--start-pr-early` cannot push early under sibling proof contention

**What we were doing.** Publishing the P0 preservation branch with
`bun run beep yeet publish --start-pr-early --monitor --pr` while three
sibling checkouts ran full proofs back to back (patent-document-schema,
court-reporter-vocabulary, openai-driver lanes of the corpus campaign).

**Evidence.** Three consecutive publish attempts exited 1 before pushing with
`Another Yeet full proof for this repository is active.` — no remote branch
and no PR existed after each attempt, while the log had already printed
`start-pr-early: pushing before local proof`. Source: in the publish
handler's start-pr-early branch, one `runWithFullProofCoordinator(...)`
scope wraps the clean-HEAD install preflight, the early push, PR creation,
and the full proof together, and the lock acquisition fails closed instead
of queueing. The early push therefore inherits full-proof serialization,
defeating the flag's stated purpose (overlap hosted CI with the local
proof). Only the install preflight and the proof touch the Bun-cache/Turbo
resources the coordinator protects; the push and PR creation do not.

**What would have prevented it.** Coordinate the install preflight and the
full proof as separate lock acquisitions, with the early push and PR
creation between them (outside any hold). Contention pain then shrinks to
the preflight's install window, and the PR + hosted checks start even while
a sibling proof runs. Until then the workaround is camp-and-fire: poll the
lock path and invoke publish the instant it clears, retrying on lost races
because the coordinator has no queue.
