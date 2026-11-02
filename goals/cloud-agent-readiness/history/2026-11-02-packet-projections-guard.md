# Packet projections dependency guard (P2) — 2026-11-02

Scope: the P2 bullet for `.claude/hooks/packet-projections.sh` only. P2 and
the packet lifecycle stay open. The other P2 items (graft hook guard,
per-host MCP scoping research) are not covered here.

## Defect

The hook ran `bun run beep goals index --write` and
`bun run beep explore atlas --write` on every SessionStart, whether or not
dependencies were installed. With `node_modules/effect` absent, both commands
fail on module resolution, so a fresh cloud VM spends SessionStart timeout on
a failure that was certain before it started. PLAN P2 asks for a skip.

Reproduced at base `cda8f0d1` (current `main`, contains #2491 and #2492) with
a temporary fixture repo as `CLAUDE_PROJECT_DIR`, and a stub `bun` first on
`PATH` that only appends its argv to a log file. No real projection, live
hook or notifier ran.

| Case (base hook) | exit | stub `bun` calls |
| --- | --- | --- |
| `node_modules/effect` absent | 0 | 2 (`goals index`, `explore atlas`) |
| absent, stub exits 1 | 0 | 2 |
| present | 0 | 2 |

## Fix

One guard after the `cd` into the repo root:
`[ -d node_modules/effect ] || exit 0`. When dependencies exist the two
commands run unchanged, still with `|| true` and output discarded.

| Case (fixed hook) | exit | stub `bun` calls |
| --- | --- | --- |
| `node_modules/effect` absent | 0 | 0 |
| present | 0 | 2 |
| present, stub exits 1 | 0 | 2 |

## Tests

New `packages/tooling/tool/cli/test/packet-projections-hook.test.ts`, which
follows `claude-hook-root.test.ts`: a scoped temp dir, `Bun.spawnSync` on the
real hook, a stub `bun`, `PATH` limited to the stub plus `/usr/bin:/bin`, and a
temp `HOME`. There are three cases:

- dependencies absent: zero `bun` calls, exit 0, empty stdout and stderr;
- dependencies present: both commands, in order, with exact argv, exit 0;
- dependencies present and the stub exits 1: both commands still run, exit 0
  (the hook stays non-blocking).

Against the base hook, the missing-dependency case fails because the log shows
both calls. The other two pass: 1 failed, 2 passed. With the fix, all 3 pass.

## Verification receipt

- `bunx --bun vitest run test/packet-projections-hook.test.ts` (in
  `packages/tooling/tool/cli`): 3 passed with the fix, and 1 failed / 2 passed
  with the base hook temporarily restored.
- ShellCheck 0.11.0 (`uvx --from shellcheck-py`, because the container has no
  system shellcheck) on the hook: no findings before or after.
- `biome check` on the new test: clean.
- `git diff --check`: clean.
- `bun run beep quality package-verify @beep/repo-cli --quick`: lint ok,
  check ok. The full package audit and docgen were not run, because the change
  is test-only and has no exported surface.

## Limits

- The guard checks only `node_modules/effect`, the marker PLAN names. A
  partial install that has `effect` but lacks other dependencies still runs
  the commands, and they fail open as before.
- No live SessionStart timing was measured. The evidence is the invocation
  count, not wall-clock savings.
