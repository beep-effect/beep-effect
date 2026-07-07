# A3 Boundary Doctrine-Pinning Lane Summary

Date: 2026-07-06

Worktree: `/home/elpresidank/YeeBois/projects/beep-effect-worktrees/gate-a3-boundaries`

## Scope and preflight

- Preflight ran in the requested worktree: `pwd && test -w .`
- Result: writable worktree confirmed.
- No commits, stashes, branch operations, GitHub API calls, or pushes were performed.

## What changed

- `standards/fallow.boundaries.provenance.schema.json`
  - Added `sourceClass: "doctrine-pinned"`.
  - Added `enforcementScope: "layer-legality"`.
  - Relaxed provenance constraints that still assumed every rule was a manifest-derived `package.json` row.

- `goals/fallow-quality-enforcement/ops/validate-packet.ts`
  - Mirrored the new `doctrine-pinned` and `layer-legality` enum values.
  - Allowed empty `catalogRefs` now that the retired repo-export catalog is not required.
  - Adjusted boundary provenance semantic checks so generated config rows are compared against manifest-derived provenance rows, while doctrine-pinned role rules remain independent.
  - Added semantic validation that doctrine-pinned rows use `layer-legality`, reference architecture doctrine, and remain promotion eligible.

- `goals/fallow-quality-enforcement/research/feature-matrix.schema.json`
  - Mirrored the new boundary provenance enum values.

- `standards/fallow.boundaries.provenance.jsonc`
  - Reconciled manifest-derived provenance to the current 98 generated boundary rules.
  - Added 3 doctrine-pinned rules:
    - `doctrine:domain-deny-drivers-tables-server`
    - `doctrine:tables-deny-server`
    - `doctrine:ui-deny-server`
  - Final counts: 98 manifest-derived rows, 3 doctrine-pinned rows, 101 total rows.

- `packages/tooling/tool/cli/src/commands/Fallow/Fallow.command.ts`
  - Added role classification for workspace packages: `domain`, `drivers`, `tables`, `server`, `ui`, and `other`.
  - Added doctrine deny rules at role level:
    - domain cannot depend on drivers, tables, or server
    - tables cannot depend on server
    - ui cannot depend on server
  - Updated generated allowlists so manifest-derived edges are filtered through the doctrine rules.
  - Added an independent `boundaries --check` doctrine pass:
    - checks declared package dependency edges for doctrine violations
    - runs Fallow's boundary analyzer and filters source import violations to doctrine-pinned layer-legality edges
    - fails with explicit rule IDs instead of silently allowlisting illegal edges

- `packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts`
  - Removed the prepare step `prepare:03-boundaries` / `prepare:fallow:boundaries` that ran `fallow:boundaries:write`.
  - Kept verify behavior intact.

- `packages/tooling/tool/cli/test/yeet.test.ts`
  - Removed assertions expecting `prepare:fallow:boundaries` in Yeet prepare plans.

## Doctrine exceptions

No dated doctrine exceptions were encoded.

Reason: the clean current graph has no doctrine-pinned violations after the implementation:

```text
$ bun run fallow:boundaries:check
$ bun run beep fallow boundaries --check
$ bun run packages/tooling/tool/cli/src/bin.ts -- fallow boundaries --check
fallow boundaries: /home/elpresidank/YeeBois/projects/beep-effect-worktrees/gate-a3-boundaries/standards/fallow.boundaries.generated.jsonc is up to date.
fallow boundaries: doctrine-pinned layer-legality checks passed.
```

## Regeneration safety proof

Commands run:

```text
cp standards/fallow.boundaries.provenance.jsonc /tmp/a3-boundaries-provenance.before.jsonc
cp standards/fallow.boundaries.generated.jsonc /tmp/a3-boundaries-generated.before.jsonc
bun run fallow:boundaries:write
diff -u /tmp/a3-boundaries-provenance.before.jsonc standards/fallow.boundaries.provenance.jsonc
diff -u /tmp/a3-boundaries-generated.before.jsonc standards/fallow.boundaries.generated.jsonc
rg -n '"ruleId": "doctrine:domain-deny-drivers-tables-server"|"ruleId": "doctrine:tables-deny-server"|"ruleId": "doctrine:ui-deny-server"|"sourceClass": "doctrine-pinned"|"enforcementScope": "layer-legality"' standards/fallow.boundaries.provenance.jsonc
```

Writer output:

```text
$ bun run beep fallow boundaries --write
$ bun run packages/tooling/tool/cli/src/bin.ts -- fallow boundaries --write
fallow boundaries: wrote /home/elpresidank/YeeBois/projects/beep-effect-worktrees/gate-a3-boundaries/standards/fallow.boundaries.generated.jsonc.
```

Round-trip diff result:

```text
diff -u /tmp/a3-boundaries-provenance.before.jsonc standards/fallow.boundaries.provenance.jsonc
# no output, exit 0

diff -u /tmp/a3-boundaries-generated.before.jsonc standards/fallow.boundaries.generated.jsonc
# no output, exit 0
```

Doctrine rows after writer:

```text
1381:      "ruleId": "doctrine:domain-deny-drivers-tables-server",
1383:      "sourceClass": "doctrine-pinned",
1391:      "enforcementScope": "layer-legality"
1394:      "ruleId": "doctrine:tables-deny-server",
1396:      "sourceClass": "doctrine-pinned",
1404:      "enforcementScope": "layer-legality"
1407:      "ruleId": "doctrine:ui-deny-server",
1409:      "sourceClass": "doctrine-pinned",
1417:      "enforcementScope": "layer-legality"
```

Conclusion: `fallow:boundaries:write` rewrites only the generated boundary config and does not drop or mutate doctrine-pinned provenance rules.

## Two-way doctrine proof

Synthetic change introduced temporarily:

```ts
import "@beep/drizzle";
```

Temporary location:

```text
packages/architecture-lab/domain/src/index.ts
```

### Illegal dependency fails

Command:

```text
bun run fallow:boundaries:check
```

Output:

```text
$ bun run beep fallow boundaries --check
$ bun run packages/tooling/tool/cli/src/bin.ts -- fallow boundaries --check
fallow boundaries: /home/elpresidank/YeeBois/projects/beep-effect-worktrees/gate-a3-boundaries/standards/fallow.boundaries.generated.jsonc is up to date.
fallow boundaries: doctrine-pinned layer-legality violations found.
Source import violations:
- doctrine:domain-deny-drivers-tables-server: packages/architecture-lab/domain/src/index.ts:9:0 imports packages/drivers/drizzle/src/index.ts (@beep/architecture-lab-domain/domain -> @beep/drizzle/drivers)
error: script "beep" exited with code 1
error: script "fallow:boundaries:check" exited with code 1
```

### Reverted dependency passes

The synthetic import was removed with a patch. The domain file has no final diff.

Command:

```text
bun run fallow:boundaries:check
```

Output:

```text
$ bun run beep fallow boundaries --check
$ bun run packages/tooling/tool/cli/src/bin.ts -- fallow boundaries --check
fallow boundaries: /home/elpresidank/YeeBois/projects/beep-effect-worktrees/gate-a3-boundaries/standards/fallow.boundaries.generated.jsonc is up to date.
fallow boundaries: doctrine-pinned layer-legality checks passed.
```

## Verification status

### Passed

```text
bun -e 'import Ajv from "ajv"; import { parse } from "jsonc-parser"; import { readFileSync } from "node:fs"; const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false }); const schema = JSON.parse(readFileSync("standards/fallow.boundaries.provenance.schema.json", "utf8")); const data = parse(readFileSync("standards/fallow.boundaries.provenance.jsonc", "utf8")); const ok = ajv.validate(schema, data); if (!ok) { console.error(JSON.stringify(ajv.errors, null, 2)); process.exit(1); } console.log("standards/fallow.boundaries.provenance.jsonc validates against standards/fallow.boundaries.provenance.schema.json");'
standards/fallow.boundaries.provenance.jsonc validates against standards/fallow.boundaries.provenance.schema.json
```

```text
bun run fallow:boundaries:check
$ bun run beep fallow boundaries --check
$ bun run packages/tooling/tool/cli/src/bin.ts -- fallow boundaries --check
fallow boundaries: /home/elpresidank/YeeBois/projects/beep-effect-worktrees/gate-a3-boundaries/standards/fallow.boundaries.generated.jsonc is up to date.
fallow boundaries: doctrine-pinned layer-legality checks passed.
```

```text
bun run --filter=@beep/repo-cli check
@beep/repo-cli check: $ tsgo -b tsconfig.json
@beep/repo-cli check: Exited with code 0
```

```text
bun run --filter=@beep/repo-cli lint
@beep/repo-cli lint: $ biome check .
@beep/repo-cli lint: Checked 212 files in 1029ms. No fixes applied.
@beep/repo-cli lint: Exited with code 0
```

```text
git diff --check -- standards/fallow.boundaries.provenance.jsonc standards/fallow.boundaries.provenance.schema.json goals/fallow-quality-enforcement/ops/validate-packet.ts goals/fallow-quality-enforcement/research/feature-matrix.schema.json packages/tooling/tool/cli/src/commands/Fallow/Fallow.command.ts packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts packages/tooling/tool/cli/test/yeet.test.ts
# no output, exit 0
```

### Blocked or failed

Required command:

```text
bunx --bun vitest run packages/tooling/tool/cli/test/yeet.test.ts
```

Result: failed before importing tests because Vitest could not start a Bun worker. This happened twice with the exact required command.

Output from the final exact attempt:

```text
 RUN  v4.1.9 /home/elpresidank/YeeBois/projects/beep-effect-worktrees/gate-a3-boundaries

⎯⎯⎯⎯⎯⎯ Unhandled Errors ⎯⎯⎯⎯⎯⎯

Vitest caught 1 unhandled error during the test run.
This might cause false positive tests. Resolve unhandled errors to make sure your tests are not affected.

⎯⎯⎯⎯⎯⎯ Unhandled Error ⎯⎯⎯⎯⎯⎯⎯
Error: [vitest-pool]: Failed to start forks worker for test files /home/elpresidank/YeeBois/projects/beep-effect-worktrees/gate-a3-boundaries/packages/tooling/tool/cli/test/yeet.test.ts.
 ❯ node_modules/vitest/dist/chunks/cli-api.24X8XwN1.js:3465:97

Caused by: Error: [vitest-pool-runner]: Timeout waiting for worker to respond
 ❯ node_modules/vitest/dist/chunks/cli-api.24X8XwN1.js:3041:61

 Test Files  no tests
      Tests  no tests
     Errors  1 error
   Start at  04:18:48
   Duration  60.02s (transform 0ms, setup 0ms, import 0ms, tests 0ms, environment 0ms)
```

Additional diagnostics:

```text
bunx --bun vitest run packages/tooling/tool/cli/test/yeet.test.ts --pool=threads
Error: [vitest-pool]: Failed to start threads worker ...
Caused by: TypeError: null is not an object (evaluating 'this._thread.stdout.pipe')
```

```text
bunx --bun vitest run packages/tooling/tool/cli/test/yeet.test.ts --pool=vmForks
Error: [vitest-pool]: Failed to start vmForks worker ...
Caused by: Error: [vitest-pool-runner]: Timeout waiting for worker to respond
```

```text
npx vitest run packages/tooling/tool/cli/test/yeet.test.ts
Test Files  1 failed (1)
Tests  5 failed | 68 passed (73)
TypeError: Bun.spawnSync is not a function
```

Interpretation: the exact required Yeet test command is blocked by the local Bun/Vitest worker startup path before the test file imports. A Node-backed fallback can import the file, but that fallback is invalid for this suite because the tests intentionally call `Bun.spawnSync`.

Full packet validator note:

```text
bun goals/fallow-quality-enforcement/ops/validate-packet.ts
fallow-quality-enforcement packet failed:
- feature matrix report ref CI mode must match feature matrix for research/audit.md: expected advisory-artifact, got blocking-check
- fqe-005: CI contract command must match advisory-artifact feature rows: bun run beep quality fallow ci-contract-check .github/workflows/check.yml --expect-lanes audit,health,boundaries,flags,security,fix-preview --expect-blocking-lanes dead-code --expect-out-dir .beep/fallow --require-upload --if-no-files-found error --advisory
```

The boundary provenance portions of the packet validator were reconciled; the remaining full-packet failures are pre-existing audit CI-mode assertions outside this A3 boundary lane.
