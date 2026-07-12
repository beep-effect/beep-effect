# Findings ledger — master inventory

Every reviewer finding across all rounds. Status: `open` → `confirmed` →
`fixed` | `waived` (→ `ledgers/waivers.md`) | `rejected` (not reproducible /
no evidence) | `backlog` (→ `ledgers/backlog.md`).

Severity: P0 crash/data-loss · P1 broken feature · P2 degraded UX ·
P3 polish. Gate is on unwaived status, not severity.

| id | round | lane | severity | surface | summary | evidence | location | status | fix |
|---|---|---|---|---|---|---|---|---|---|
| F-000-01 | 0 | smoke | P1 | Vault sync | Real Box sync always shows "disconnected" with valid credentials: Box SDK materializes absent response fields as present-but-undefined keys (`nextMarker: undefined` on final marker-paginated page); exact-optional generated schemas reject the decode, `resolveMirrorRootId` fails, probe reports connected:false. Broke ALL final-page listings driver-wide. | Tempo trace 68a452caf08711b411eeaf2461bc9e6e; standalone driver probe repro | `packages/drivers/box/src/internal/Box.runtime.ts` (decodeWith) | fixed | pruneUndefined normalization before response decoding + regression scope: driver tests green |
| F-000-02 | 0 | smoke | P3 | Box driver DX | `BoxError` stringifies schema decode failures to literal `"SchemaError"` (cause Option<string>), discarding the issue tree — diagnosing F-000-01 required a standalone repro instead of reading the error/log/trace. | box-probe output: `cause: Some("SchemaError")`, empty exception.message in trace | `packages/drivers/box/src/Box.errors.ts` (causeLabelFromInput) | open | — |
| F-000-03 | 0 | smoke | P2 | Chat sidebar | Thread list dates render "Dec 31" for threads created today (2026-07-11) — looks like an epoch/default-date formatting bug. | screenshot 01-app-loaded.png (both threads "Dec 31") | `apps/professional-desktop/src/chat/ui/Sidebar.tsx` (date rendering) — verify | open | — |
