# P1 Oracle — Schema + set-status + migrate

Date: 2026-07-11. Branch: `feat/goals-doctor`.

Oracle (from `PLAN.md`): `bun run beep goals set-status --migrate --write`
then every `goals/*/ops/manifest.json` decodes via `GoalManifest`; zero
unknown tokens; unit tests for the mapping pass.

## Actual output

Migration apply (tail):

```text
[goals:migrate] yeet-operator-clarity: README Lifecycle line active -> superseded
[goals:migrate] yeet-pr-closeout-loop: lifecycle active -> superseded
[goals:migrate] applied: 62 manifest edit(s), 5 backfill(s), 10 README edit(s), 0 parked.
```

Convergence — an immediate second dry-run plans nothing:

```text
[goals:migrate] planned (dry-run; rerun with --write to apply): 0 manifest edit(s), 0 backfill(s), 0 README edit(s), 0 parked.
```

Decode-all proof (script over `listGoalPackets` + `decodeGoalManifest`):

```text
decoded_ok=83 of 83
```

Mapping unit tests (`packages/tooling/tool/cli/test/goals-command.test.ts`):

```text
 Test Files  1 passed (1)
      Tests  14 passed (14)
```

Zero unknown tokens: the migration reported `0 parked` (an unmappable token
parks the packet with a recorded question), and all 83 manifests decode
against the closed `GoalStatus` / `GoalPhaseStatus` domains.
