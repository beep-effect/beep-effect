# Spike 1 immutable-mode compatibility matrix (union of evidence runs)

Assembled from three archived assertion-5 runs on 2026-07-25/26; no single
run contains all seven rows because the pairing and defaultTo rows were
re-run under repaired harness classifiers (defect ledger in NOTES.md §A5).
Per-row provenance cites the archived run directory.

| Writer surface | Result | Evidence run | Log |
| --- | --- | --- | --- |
| Login/bootstrap | declarative render | [`run-full-writer/`](./run-full-writer/) (2026-07-25) | `a5-login-bootstrap.log` |
| Pairing / first-owner persistence | graceful skip — sender approved and persisted in pairing store; owner-config write refused cleanly by the NIX_MODE app guard with no config mutation | [`run-final-pairing/`](./run-final-pairing/) (2026-07-26) | `a5-pairing-first-owner.log` |
| `defaultTo` declared | declarative render — delivered; per-send writeback guard skipped cleanly with no config mutation | [`run-defaultTo/`](./run-defaultTo/) (2026-07-26) | `a5-defaultTo-declared.log` |
| `defaultTo` undeclared | graceful skip — send delivered; exact operator.admin guard skipped writeback cleanly | [`run-defaultTo/`](./run-defaultTo/) (2026-07-26) | `a5-defaultTo-undeclared.log` |
| Reconnect | declarative render | [`run-full-writer/`](./run-full-writer/) (2026-07-25) | `a5-reconnect.log` |
| Token swap | declarative render | [`run-full-writer/`](./run-full-writer/) (2026-07-25) | `a5-token-swap.log` |
| Group → supergroup migration | NOT-TRIGGERABLE — disposable chat is already a supergroup; its one-time basic-group migration cannot recur | [`run-full-writer/`](./run-full-writer/) (2026-07-25) | `a5-group-supergroup-migration.log` |

No essential row is INCOMPATIBLE; assertion 6 is satisfied and the
*v1 DM channel is Telegram* decision stands.
