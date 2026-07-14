# OIP Web Proof Lane — 2026-07-14

## Scope

This evidence records the package-scoped commands named by `PLAN.md`. Commands
were run from the repository root on 2026-07-14. Durations are wall-clock values
reported by `/usr/bin/time`; pass/fail is the observed process exit status.

Browser smoke was intentionally not attempted. Desktop/mobile browser smoke
evidence follows separately from the driver, and no `output/playwright/*`
artifacts are part of this lane.

## Results

| Lane | Command | Result | Exit | Duration |
| --- | --- | --- | ---: | ---: |
| build | `bun run --cwd apps/oip-web build` | FAIL | 1 | 172.63s |
| check | `bun run --cwd apps/oip-web check` | PASS | 0 | 4.34s |
| test | `bun run --cwd apps/oip-web test` | FAIL | 1 | 60.41s |
| lint | `bun run --cwd apps/oip-web lint` | PASS | 0 | 1.85s |
| type-test | `bun run --cwd apps/oip-web type-test` | FAIL | 1 | 0.00s |

## Failure Evidence

### Build

Next/Turbopack reached `Creating an optimized production build ...`, then
failed while loading each of these sources:

- `apps/oip-web/src/components/BackToTop.tsx`
- `apps/oip-web/src/components/ContactForm.tsx`
- `apps/oip-web/src/components/HeroVideo.tsx`
- `apps/oip-web/src/runtime/OipAtomProvider.tsx`

Each failure reported the same cause:

```text
Error: Reading source code for parsing failed
An unexpected error happened while trying to read the source code to parse: creating new process

Caused by:
- binding to a port
- Operation not permitted (os error 1)
```

The command exited 1 after 172.63s. This is an environment capability blocker;
no app-code repair was attempted.

### Test

Vitest failed before executing tests because neither fork worker responded:

```text
Error: [vitest-pool]: Failed to start forks worker for test files
apps/oip-web/test/oip-web.test.tsx.
Caused by: Error: [vitest-pool-runner]: Timeout waiting for worker to respond

Error: [vitest-pool]: Failed to start forks worker for test files
apps/oip-web/test/oip-seo.test.ts.
Caused by: Error: [vitest-pool-runner]: Timeout waiting for worker to respond

Test Files  no tests
Tests       no tests
Errors      2 errors
Duration    60.01s
```

The command exited 1 after 60.41s. No app-code repair was attempted.

### Type-test

The exact command named by `PLAN.md` failed because
`apps/oip-web/package.json` does not define a `type-test` script:

```text
error: Script not found "type-test"
```

The command exited 1 immediately (reported duration 0.00s). Resolving or
reconciling that missing lane requires work outside this packet-only edit scope.

## Closure Assessment

Implementation remains complete, and the user-approved FINISH disposition rides
the `portfolio-consolidation` pull request. This proof re-run is not green, so
the packet is not ready for the `completed-retained` lifecycle flip until the
driver obtains passing build/test evidence and resolves or explicitly
reconciles the missing type-test script. Public launch remains separately
blocked by the five `EXTERNAL` review gates recorded in the packet.
