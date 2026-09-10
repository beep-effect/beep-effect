# P0e detector alias integration lane

## Status

Implementation complete and ready for orchestrator handoff. No ownership
extension is required.

## Scope

- Add module and binding recognition for the public instrumented `@beep/test-utils/Vitest` `it` facade.
- Add paired provenance, public-form, shadowing, and regression coverage.
- Preserve the existing syntax-only detector algorithms, rule predicates, finding identities, and D9 scope.

## Work log

- Created this report before implementation.
- Read the repository agent instructions, Effect-first and schema-first skills,
  the P0c/P0d verification receipts and lane reports, the live syntax helper and
  package barrels, the public facade export contract, and the supplied private
  probe receipt/script before editing detector recognition.
- Reused the existing syntax-only import provenance, lexical-shadowing, harness
  member normalization, callback registration and layer-callback propagation.
- Restricted the new module recognition to named/renamed `it` and namespace
  `.it`. Existing `@effect/vitest` and `vitest` tester recognition is unchanged.
- Added paired original/instrumented finding comparisons plus public-form,
  nested-layer, shadowing, unrelated-subpath and non-tester-export regressions.
- Ran only the authorized focused tests and static checks. No package verify,
  broad audit/build/check/coverage, scanner writer, artifact regeneration, git,
  dependency, configuration or publication command was run.

## Changed paths

- `packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestSyntax.ts`
- `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts`
- `goals/effect-vitest-canon/history/lanes/p0e-detector-alias.md`

The checkout-level P0 gate injected during the lane required a narrow expiring
acknowledgement at `.beep/inbox/acks/local-shard-3b0365d20c9b`. It is a waiver
for `package:@beep/repo-cli:audit` by `codex-p0e-detector-alias`, expiring
2026-09-09T23:59:59-05:00, because the orchestrator owns the aggregate package
audit and final fix-SHA acknowledgement after concurrent writers hand back.
No other inbox action was taken.

## Evidence

### Recognition and paired probes

- `@beep/test-utils/Vitest` recognizes only direct/renamed `it` and namespace
  `.it` as imported harness roots.
- The existing member and callback logic recognizes plain calls plus
  `effect`, `live`, `each`, `prop`, `layer`, and nested layer callback testers.
- Lexical shadowing remains binding for renamed and namespace imports.
- Negative coverage rejects `@beep/test-utils/Schema`, named `TestHang`,
  namespace `.TestHang`, and hypothetical `test`/`expect` exports from the new
  subpath. There is no blanket module-symbol classification.
- Paired tests compare the complete original/instrumented finding arrays and
  preserve ID, lens, rule, class, evidence, replacement, severity, confidence
  and mechanization. The only paired source change is the import module.
- The unchanged supplied script
  `~/.cache/beep/effect-vitest-canon/p0e-wrapper-detector-probes.mjs` exited 0.
  Both `@effect/vitest` and `@beep/test-utils/Vitest` produced exactly EV001 for
  the runtime probe, EV004 for the scope probe, and EV008 for the TestClock
  probe. The refreshed private JSON receipt records all six expected results.

### Focused suites

Command-scoped Bun directory for every command:
`~/.local/share/mise/installs/bun/1.4.1/bin`.

Final complete focused command:

```bash
bunx --bun vitest run \
  packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts \
  packages/tooling/tool/cli/test/effect-vitest-contract.test.ts \
  packages/tooling/tool/cli/test/effect-vitest-primitives.test.ts \
  packages/tooling/tool/cli/test/effect-vitest-store.test.ts \
  packages/tooling/tool/cli/test/lint-subcommand-allowlist.test.ts \
  --pool=threads --maxWorkers=1
```

Result: exit 0; 5 files passed; 67 tests passed; Vitest duration 10.71s.
The final detector-only refresh also exited 0 with 1 file and 44 tests passed.
No old expectation was weakened or removed.

### Compiler and lint

- Changed-file Biome on the syntax helper and detector test: exit 0; 2 files
  checked; no fixes applied.
- Direct package command `bun run --cwd packages/tooling/tool/cli check`:
  exit 1 before TypeScript compilation because the managed sandbox denied the
  Node launcher with `spawnSync ~/.nvm/versions/node/v24.20.0/bin/node EPERM`.
  This is recorded as a launcher/environment limitation, not as green proof.
- Existing Bun-routed Effect compiler shim:
  `bun tools/tsgo-shim/tsgo.js -p packages/tooling/tool/cli/tsconfig.check.json`:
  exit 0 with no diagnostics. It was rerun after the final test changes and
  remained green.

## Open concerns

- No detector concern or ownership extension remains. The public facade was
  inspected read-only and this lane does not depend on its unfinished private
  implementation details.
- The orchestrator still owns final artifact regeneration, the aggregate
  `@beep/repo-cli` package verification, replacement of the expiring inbox
  waiver with the eventual fix SHA, packet/status work and publication.
