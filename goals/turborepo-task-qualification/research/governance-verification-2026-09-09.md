# Governance increment verification, 2026-09-09

Scope: the first reviewed baseline, persisted writer and local/Yeet Quality
audit on the uncommitted task-qualification feature branch. This is progress
evidence, not a final pilot or hosted qualification.

| Check | Observed result |
| --- | --- |
| Repo-configs package-verify | Pass: audit 8.9s, docgen 4.7s after the governance/client-pin changes. |
| Repo-cli package-verify | Pass: audit 359.5s, docgen 19.6s. |
| Policy regressions | 19 tests pass, including configuration/global/dependency/script drift and exact client namespaces. |
| Operational writer regressions | Six tests pass, including schema-derived ledger round-trip coverage. The final package audit also passes the added missing-ledger check. |
| Census and Quality plan regressions | 191 tests pass across the two files; deliberate fixture compiler-error text is test data, not a live build failure. |
| CLI source and package-test typechecks | Pass before the final full package audit. |
| `beep quality cache-policy` / `beep cache audit --json` | Pass: zero findings, 928 unassessed cached computations. |
| Schema-first inventory | Pass with zero missing/stale entries or advisories. |
| Goals doctor / exploration check | Pass: zero blocking/fleet findings; four inherited nonfatal goal advisories. |

The initial baseline write exposed an introduced mutex-release bug after the
atomic baseline had been written. The implementation now releases only its
acquired directory mutex with directory removal semantics. The known empty
mutex from that failed first attempt was inspected and removed; no foreign
lock was stolen. The initial empty ledger was established during this draft
bootstrap; subsequent missing-ledger reads and replacement attempts fail closed.
The friction receipt and arbitrary-generation repair are recorded immediately
in [OPPORTUNITIES.md](./OPPORTUNITIES.md).

The baseline is about 1.28 MB of reviewed effective configuration. It contains
no raw task logs or cache archives. Command groups are about 94 KB. Raw census
and package verification logs remain under ignored `.beep/` with a seven-day
local retention target. Regenerate stale diagnostic captures before experiments.

P0/P1 are unfinished. Hosted repository-sanity wiring, durable superseded
state history, full live pin binding, original-byte/outcome receipt verification
and all real local/shadow/signed-replay experiments remain outstanding.
