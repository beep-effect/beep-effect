# Runtime key entrypoint seams

This is source reconnaissance for the next implementation step. It does not
establish an enforced ordinary invocation boundary or permit live reuse.

The pilot now calculates a toolchain digest after verifying the installed
tree, substitutes the requested native Turbo pin, places the value after
scenario environment overrides, and checks its native metadata. Ordinary
invocations do not yet perform that operation.

## Existing ownership

- `CacheQualificationService` owns the live fingerprint and policy audit.
  `SPEC.md` assigns transition validation and experiment execution to Cache;
  Quality remains an audit consumer.
- `Quality/Tasks.ts` constructs Turbo arguments in `turboRunArgs` and spawns
  steps in `runStep`. `runStep` resolves the existing secret-session wrapper,
  calculates `turboEnvOverrides`, then spreads `resolved.env` afterward.
- `Ci/CiLane.ts` has its own `directTurboArgs`, normal step execution and
  several native dry-selection probes. These are distinct execution sites;
  checking one Quality spawn is insufficient coverage.
- `internal/cli/TurboCache.ts` is a pure cache-posture decision module. Its
  credential-reference classification and local/remote flags are separate
  from computation runtime identity.
- `Quality.command.ts` exposes `quality cache-policy` through the existing
  Cache facade. Running this audit in a separate process does not populate
  the parent Turbo environment.

## Requirements for the next change

1. Keep runtime identity and verification owned by Cache. Use existing
   fingerprint, installed-tree and schema operations. Review architecture
   before adding a shared execution role or introducing an import edge.
2. Calculate the value from the actual execution root, installed bytes and
   selected native client. A supplied environment digest is an assertion,
   not verification, and must not override the observed value.
3. Bind native task metadata to the value and fail closed for an eligible
   computation whose declaration, value, client or verified inputs disagree.
   Preserve the separate deliberate-removal controls.
4. Cover direct CLI, CI, Quality, nested Yeet, secret-wrapped and dry-selection
   entrypoints without changing hosted proof ownership or remote credentials.
   Source planner parity alone is insufficient runtime evidence.
5. Preserve legacy unassessed behavior and pilot exclusions. Qualification
   promotion remains gated on signed sibling evidence and complete pilot
   semantics; adding a variable to `turbo.json` cannot satisfy those gates.

The current source-bound entrypoint request retains the inspected files and
their hashes. The current pilot and installed-tree experiments establish a
local repair direction; they do not answer these ordinary-entrypoint tests.
