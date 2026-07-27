# Spike 1 immutable-mode compatibility matrix

| Writer surface | Result | Evidence | Log | Operationally essential? |
| --- | --- | --- | --- | --- |
| Login/bootstrap | declarative render | env-token bootstrap plus Telegram probe; configWrites:false rendered | `a5-login-bootstrap.log` | yes |
| Pairing / first-owner persistence | BLOCKED | operator DM absent; no new pairing request in the 300s window | `a5-pairing-first-owner.log` | yes |
| `defaultTo` declared | HARNESS-ERROR | declared send unexpectedly entered target writeback | `a5-defaultTo-declared.log` | yes |
| `defaultTo` undeclared | HARNESS-ERROR | undeclared defaultTo produced an unknown writeback outcome | `a5-defaultTo-undeclared.log` | yes |
| Reconnect | declarative render | channels.stop/start RPC reconnect completed; status returned connected/running with restartPending false | `a5-reconnect.log` | yes |
| Token swap | declarative render | invalid token handler fired; token remains external in the unit-private credential | `a5-token-swap.log` | yes |
| Group to supergroup migration | NOT-TRIGGERABLE | disposable chat is already a supergroup; its one-time basic-group migration cannot recur | `a5-group-supergroup-migration.log` | only when triggerable |
