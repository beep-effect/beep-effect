# Census before gate-run-history

Dated 2026-11-20. The acceptance row "census rows for log digs per run and turns per verdict are
cited before and after" needs a figure from before any history code runs.

```sh
bun run beep ai-metrics census --until 2026-11-20T05:50:03Z --json
```

Window: 2026-11-13T05:50:03Z to 2026-11-20T05:50:03Z, rule version `census-rules/2026-11-18`.

| Row | Value |
| --- | ---: |
| Verification runs (Claude turn pass) | 11,832 |
| Log digs per verification run | 0.133 |
| Turns per verdict | 1.211 |
| Verification runs filtered | 91.5% |

The same rows on the first baseline run (window ending 2026-11-18) were 0.148, 1.239 and 92.3%.
The "after" run uses a seven-day window that starts once history is on `main`.
