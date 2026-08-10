---
"@beep/test-utils": patch
---

Replace the unbounded `Schedule.max([spaced, recurs])` retry idiom with a genuinely bounded
`Schedule.recurs(n).pipe(Schedule.addDelay(...))`: `Schedule.max` continues while any
sub-schedule continues, so an infinite `spaced` leg kept `recurs` from ever terminating the
policy. `PgConnectRetryPolicy` now stops after its 20 attempts instead of relying on an outer
timeout to end an infinite loop. The same hardening lands at the two repo-cli sites (OTLP capture
polling in tests, the Runpod Ollama readiness retry), and eslint now ignores session-local
`.claude/worktrees/**` so other checkouts' files cannot fail this clone's docs lint.
