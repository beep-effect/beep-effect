# Cache baseline review: Yeet proof-tier, parity and install-preflight dedupe

Reviewed 2026-11-02 for `claude/perf-yeet-tier-dedupe-9fd6b5` (perf audit M11,
M12 and A4).

`bun run beep quality cache-policy` reported 3 blocking findings, all
introduced by this branch: configuration drift for the root subject `//` tasks
`//#lint:policy-fingerprint:goals-doctor`, `//#lint:policy-fingerprint:knowledge`
and `//#lint:policy-fingerprint:quality`, plus the matching
`configuration-source-drift` review row for `turbo.json`.

The branch adds `packages/tooling/tool/cli/src/commands/Yeet/internal/HeadInstallReceipt.ts`
(the clean-HEAD install receipt) and imports it from
`Yeet/internal/HeadInstallPreflight.ts`, which those three policy closures
already reach. `bun run beep lint policy-fingerprint --write` regenerated
`standards/policy-tools.fingerprint.json` and added this one input path:

| seal task | added inputs |
| --- | --- |
| `//#lint:policy-fingerprint:goals-doctor` | `Yeet/internal/HeadInstallReceipt.ts` |
| `//#lint:policy-fingerprint:knowledge` | `Yeet/internal/HeadInstallReceipt.ts` |
| `//#lint:policy-fingerprint:quality` | `Yeet/internal/HeadInstallReceipt.ts` |

The path is under `packages/tooling/tool/cli/src/commands/`. Commands, outputs,
cache flags and dependency edges are unchanged; the only change is the added
input path. No qualification is granted, no exception rows are added, and no
other subject changes. `standards/cache-qualification-baseline.json` equals
`origin/main` (5200ca9f35) before this request.

## Main merge (2026-11-02, origin/main 070ac7bf11)

Merging `origin/main` brought #2633 (narrowed Turbo inputs, `$TURBO_ROOT$`-anchored paths), #2627, #2630 and
#2635, each with its own stamp. `turbo.json` and the baseline were taken from `main` and the fingerprint
regenerated with `bun run beep lint policy-fingerprint --write`, which again adds only
`Yeet/internal/HeadInstallReceipt.ts` to the same three seals. The re-recorded request binds `previous`
to main's baseline bytes.
