## Stage A

Implemented Stage A only. Acceptance is **not complete**: the requested full-file 100% coverage
floor remains unmet in four files; canonical package/type-check commands hit the sandbox shim
failure. No worktree git/index writes or graft commands. Branch: `ttc/b7-until-ready`.

- Merge loop caches ruleset results, including `None`, once per head; reads the commit date once
  per head; stamps and persists first-observed/settled/closeout/ready timeline observations.
- Status retains classified checks and required flags using its existing two check reads.
  The scripted collector test asserts exactly two check spawns. Legacy snapshots decode with `checks: []`.
- Each poll renders the settle detail; reason changes produce one transition line. Missing/pending
  names remain in the last timeout gate line. Poll sleeps are capped by the remaining settle budget.
- Watch caches rulesets per head, derives settle verdicts before diffing, emits `settle-changed`,
  and ends with failing `settle-timeout`. A visible terminal board cannot hide missing expected
  contexts. A settled required census does not time out while optional checks remain pending.
- `--settle-timeout` accepts positive finite durations (`30m`, `1h`, `90s`, spelled-out units),
  defaults to 30 minutes, and rejects plain monitor. `--until-ready` wiring remains Stage B.
- Tests cover generated schema round-trips, a 17-context rules payload with unrelated/duplicate
  rules, matrix-parent matching, outside required rows, fallback census, every settle reason,
  scripted ruleset failure/truncation, exact TestClock timeout, head reset, persisted timeline,
  one-rerun preservation, watch transitions, duration parsing, and route legality.

Decisions / rejected alternatives:

- Reused the binding settle evaluator; no third checks process, fixed census count, fuzzy context
  matching, automatic closeout, ready terminal, inbox publication, or Stage C exit-code changes.
- Used `S.suspend` for the watch snapshot's settle schema: `Settle.ts` already imports the watch
  outcome/reason domains. This defers the schema edge without moving the binding domains.
- Used `Arbitrary.schema` / `Arbitrary.sampleEffect`: neither the specified Effect v4 reference
  nor installed `effect/Schema` exports the brief's `S.toArbitrary`. Same generated round-trip proof.
- Clock tests use `it.layer` / `it.effect`, explicit clock reset, in-memory snapshot writes, and
  `TestClock.adjust`; this removes asynchronous filesystem scheduling from the boundary proof.
- Kept generated effect-vitest inventory output. It also refreshes stale entries outside B7;
  `--write` succeeded but does not mean all existing inventory findings are resolved.

Contract extensions / corrections:

- `YeetMonitorUntilMergedOptions`: `collectStatus`, `rulesetRead`, `closeout`, `policy`, `now`,
  and `capture`. `closeout` is forwarded but intentionally unused in Stage A. `capture` reuses
  the route's existing seam for deterministic commit-date reads without live gh calls.
- `YeetMonitorRouteDependencies.settleTimeoutMs` carries the parsed flag to both loops.
- `YeetStatusRemote.checks` defaults empty; `YeetWatchSnapshot.settle` defaults `None`;
  watch config gains `rulesetRead`, `settleTimeoutMs`, and `now`; end reasons gain `settle-timeout`.
- `yeetMonitorPolicyTerminals(until-merged)` now includes `settle-timeout`: the existing table
  omitted the terminal Stage A / ruling 45 explicitly requires for that policy.
- Exported `yeetMonitorDurationMillis` through the test kit for parsing-table proof.

Orchestrator fixes after the lane (2026-09-16, before the Stage A commit): the `Settle.ts` →
`WatchStream.ts` import cycle the lane closed with `S.suspend` is broken by moving
`YeetCheckOutcome` and `YeetSettleReason` into the leaf `CheckOutcome.ts`; the two inline object
contracts the schema-first lint flagged are replaced by `YeetRulesetRulesPayload` and by deleting
`yeetSettleCheckFrom` (callers use `YeetSettleCheck.make`); three inline `S.decodeEffect` compiles
are hoisted to module scope (oxlint `no-inline-schema-compile`); the settle test gains an
`it.prop` schema-derived property over `YeetSettleInput` (schema-first `SFV4-arbitrary-tests`).
The Bun default-pool run that stalled in the sandbox passed in the orchestrator environment
(10 suites, 248 tests).

### Stage A — files

- `packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorPolicy.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Porcelain.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/WatchMode.ts`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/WatchStream.ts`
- `packages/tooling/tool/cli/src/test/Yeet.test-kit.ts`
- `packages/tooling/tool/cli/test/yeet-settle.test.ts` (new)
- `packages/tooling/tool/cli/test/yeet-watch-mode.test.ts`
- `packages/tooling/tool/cli/test/yeet-watch-stream.test.ts`
- `packages/tooling/tool/cli/test/yeet-command-wiring.test.ts`
- `standards/effect-vitest.inventory.jsonc` (generated)
- `goals/time-to-certainty/research/OPPORTUNITIES.md`
- `goals/time-to-certainty/research/b7-implementation.md`

### Verification

Vitest cwd: `packages/tooling/tool/cli`. `SUITES` means these seven explicit arguments:
`test/yeet-settle.test.ts test/yeet-watch-mode.test.ts test/yeet-watch-stream.test.ts
test/yeet-command-wiring.test.ts test/yeet-monitor-loop.test.ts test/yeet-status-triage.test.ts
test/yeet-provenance-footer.test.ts`.

`COMPILER` below is the root-relative installed artifact
`node_modules/@effect/tsgo-linux-x64/artifacts/typescript/7.0.2/tsc`.
Other commands run from the worktree root. Logs are local scratch evidence, not staged files.

| Command | Runtime | Exit | Coverage / result |
| --- | --- | ---: | --- |
| `bunx vitest run $SUITES` | Node | 0 | 7 suites / 221 tests; `/tmp/b7-node-final.log` |
| `bunx --bun vitest run $SUITES` | Bun default pool | 130 | Startup banner only; interrupted; no passing evidence |
| `timeout 120s bunx --bun vitest run $SUITES --pool=threads` | Bun threads | 0 | 7 suites / 221 tests; `/tmp/b7-bun-final3.log` |
| Scoped lcov command below | Node / V8 | 1 | All 221 tests pass; 100% per-file coverage gate fails; 90.31% aggregate lines |
| `$COMPILER -p packages/tooling/tool/cli/tsconfig.check.json` | Effect native compiler | 0 | Source check; `/tmp/b7-source-final.log` |
| `$COMPILER -p packages/tooling/tool/cli/test/tsconfig.json --rootDir .` | Effect native compiler | 0 | Test-source check; `/tmp/b7-test-typecheck-final.log` |
| `bunx turbo run check --filter=@beep/repo-cli` | Bun / Node shim | 1 | `spawnSync node EPERM`; no source-check verdict |
| `bun run beep quality package-verify @beep/repo-cli` | Bun / Node shim | 1 | Build passed; audit stopped at same shim failure before subsequent proof |
| `bun run beep lint effect-vitest --write` | Bun | 0 | Generated inventory; 8,395 findings remain repository-wide |
| `bunx biome check` over the 12 listed TS source/test paths | Bun launcher | 0 | No fixes required; `/tmp/b7-biome-final.log` |
| `git diff --check` | Git read-only | 0 | No whitespace errors |
| Broad `bunx vitest run test/yeet*.test.ts --coverage …` | Node / V8 | 130 | Interrupted before completion; no full-sweep proof |

Exact scoped coverage command:

```sh
bunx vitest run $SUITES --coverage \
  --coverage.include='src/commands/Yeet/internal/{Settle,MonitorPolicy,MonitorLoop,WatchMode,WatchStream,Status,Porcelain}.ts' \
  --coverage.include='src/commands/Yeet/Yeet.command.ts' \
  --coverage.reporter=lcov --coverage.reporter=text \
  --coverage.reportsDirectory=/tmp/b7-stage-a-final-coverage \
  --coverage.thresholds.lines=100 --coverage.thresholds.branches=100 \
  --coverage.thresholds.functions=100 --coverage.thresholds.statements=100 \
  --coverage.thresholds.perFile
```

Lcov: `/tmp/b7-stage-a-final-coverage/lcov.info`; log: `/tmp/b7-final-coverage3.log`.

| Source | Lines % | Branches % | Functions % | Statements % |
| --- | ---: | ---: | ---: | ---: |
| `Settle.ts` (binding module, unchanged) | 100 | 100 | 100 | 100 |
| `MonitorPolicy.ts` | 100 | 100 | 100 | 100 |
| `WatchStream.ts` | 100 | 100 | 100 | 100 |
| `WatchMode.ts` | 100 | 100 | 100 | 100 |
| `MonitorLoop.ts` | 96.55 | 93.02 | 95.08 | 96.89 |
| `Status.ts` | 85.49 | 67 | 75.23 | 83.94 |
| `Porcelain.ts` | 44.15 | 23.25 | 15 | 43.58 |
| `Yeet.command.ts` | 94.16 | 100 | 58.82 | 90.34 |
| `Yeet.test-kit.ts` | N/A | N/A | N/A | N/A — re-export only; lcov has zero executable lines |

### Blockers

1. Required full-file 100% coverage is **not met** in the four rows above. Includes existing
   command/remote/error paths and uncovered live-default seams; no waiver or completion claim.
2. Canonical Turbo check and package-verify require an orchestrator rerun because of the shim
   `EPERM`. Direct compiler passes are supporting proof, not a canonical-gate pass. The audit
   P0 was acknowledged once as environment-only through `yeet inbox ack` with this evidence.
3. Unmodified Bun launcher did not finish; the passing thread-pool run is explicitly supplemental.
4. Full repo lint, canonical test-tsgo, docgen, Fallow, and live PR smoke were not completed here.
   No push-to-ready measurement. No Stage B/C work, commit, publication, or merge-readiness claim.
