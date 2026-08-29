# Effect Child-Process Hardening — Sources and Provenance

This packet was authored directly from a repo and upstream-source audit; it has
no source exploration.

## Upstream Effect reference

Reference checkout: `.repos/effect` at commit `e5bd9e2f3fbe` (2026-07-29).
Installed `effect`, `@effect/platform-node`, and `@effect/platform-bun` versions:
`4.0.0-beta.102`.

| Source | Location | Use |
| --- | --- | --- |
| Child-process guide | `.repos/effect/ai-docs/src/60_child-process/` | Command construction, collection, streaming, pipelines, scoped execution, and platform layers |
| Command API | `.repos/effect/packages/effect/src/unstable/process/ChildProcess.ts` | Command options, stdio defaults, env/shell gotchas, pipelines, and transformations |
| Spawner API | `.repos/effect/packages/effect/src/unstable/process/ChildProcessSpawner.ts` | Service helpers, handle lifecycle, exit status, streams, kill, and custom descriptors |
| Public barrel | `.repos/effect/packages/effect/src/unstable/process/index.ts` | Export inventory |
| Node/Bun adapters | `.repos/effect/packages/platform-{node,bun}/src/*ChildProcessSpawner.ts` | Platform entrypoints |
| Shared backend | `.repos/effect/packages/platform-node-shared/src/NodeChildProcessSpawner.ts` | Actual stdio defaults, scoped finalizer, process-group kill, and forced escalation |
| Command tests | `.repos/effect/packages/effect/test/unstable/process/ChildProcess.test.ts` | Command composition and option behavior |
| Spawner tests | `.repos/effect/packages/effect/test/unstable/process/ChildProcessSpawnerTest.ts` | Concurrent draining, large output, interruption, process groups, force kill, and unref |

The Effect repository is MIT-licensed. This implementation uses the public API
and repository-local patterns; it does not vendor upstream code.

## Governing repo sources

- `AGENTS.md`
- `standards/ARCHITECTURE.md`
- `standards/architecture/03-driver-boundaries.md`
- `standards/architecture/05-layer-composition.md`
- `standards/architecture/07-non-slice-families.md`
- `standards/architecture/08-testing.md`
- `standards/architecture/09-errors-across-boundaries.md`
- `goals/repo-cli-modularization/{README,SPEC,PLAN}.md`
- `packages/tooling/tool/cli/src/internal/process/StepExec.ts`
- `packages/tooling/tool/cli/src/internal/repo-run/GitExec.ts`

## Audit

The complete pre-change consumer inventory, findings, and locked decisions are
in [`2026-07-29-inventory.md`](./2026-07-29-inventory.md).
