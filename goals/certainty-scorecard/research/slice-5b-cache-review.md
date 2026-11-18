# Cache review for the slice 5b pressure-parser import (2026-11-14)

Reviewed on branch `feat/certainty-admission-pressure-fields`, on top of `653c2cdef18`.
Reviewer: Claude Opus 5.5 (slice 5b of `goals/certainty-scorecard`, SCHE-09 slice 2).

Slice 5b stamps capacity and host pressure on admitted and released admission rows
(decision `sche-09-pressure-stamps`). Two scheduler modules now import the host-pressure
parcel's schema and parser from `@beep/palantiri`:

- `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts` reads
  `PressureStats.fields.avg10` (the 0 to 100 percent schema) from `HostPressure.models.ts`
  for the stamp's PSI fields.
- `packages/tooling/tool/cli/src/internal/repo-run/MemoryStats.service.ts` parses
  `/proc/pressure/{cpu,memory,io}` with `parsePressureFile` from `HostPressure.ts`.

The policy tools' import closure reaches both modules, so `bun run beep lint
policy-fingerprint --write` added the palantiri sources to it. On that head
`bun run beep quality cache-policy` reports one blocking finding and nothing else:

- `configuration-drift` on `//#lint:policy-fingerprint` (subject `//`).

It also reports `configuration-source-drift: turbo.json` for review, which is the same change.

## What changed

The drifted task is `//#lint:policy-fingerprint`, which runs `beep-cli lint policy-fingerprint
--check` with `cache: true` and no outputs. Its input list gains one glob,
`packages/tooling/library/palantiri/src/**`, beside the `palantiri/package.json` entry it
already had. That takes it from 276 to 277 inputs.

`@beep/repo-cli#lint:policy-fingerprint:shared` gains the matching ten files: palantiri's
`package.json`, `HostPressure.ts`, `HostPressure.models.ts`, and the parcel models those two
import (`Freshness.ts`, `Parcel.models.ts`, `ParcelEnvelope.models.ts`,
`AccountHeadroom.models.ts`, `GithubHeadroom.models.ts`, `LaneReds.models.ts`,
`SinceLastCheck.models.ts`). That takes it from 444 to 454 inputs. The audit does not report
it as drifted.

`standards/policy-tools.fingerprint.json` is resealed to match. No other line of `turbo.json`
changed, and no root `package.json` script changed.

## Why the drift is correct

The stamp's PSI fields are decoded with palantiri's percent schema, and its readings come
from palantiri's parser. A change to either changes what the scheduler's schemas and readers
accept, which is what the policy lints check, so the change must re-key the policy-lint cache.
Without the new inputs, a cache hit could replay a passing policy fingerprint over a changed
parser.

Keeping the import was weighed against moving the parser:

- **A second parser in repo-cli.** Rejected: two parsers for the same kernel format would drift
  apart.
- **A package both already depend on that the closure already reads.** palantiri's only such
  dependencies are `@beep/identity` and `@beep/schema`, and neither is a home for a kernel PSI
  file parser.
- **`@beep/repo-cli-kit`.** It is in the closure, but palantiri does not depend on it, and making
  the parcel library depend on the CLI kit would invert the tooling layers.
- **`@beep/observability`.** palantiri depends on it, but it is not in the shared closure, so
  moving the parser there would widen the closure by more files than this import does.

repo-cli already depends on `@beep/palantiri`, through its Palantiri commands, so the import
adds no package edge.

Nothing else moved. Commands, cache flags, outputs and environment keys are the ones already
reviewed, and the inputs only grow. The baseline's scope, profile and epoch are unchanged, and
no qualification or exception row is added.

## Subjects

`//`. No other subject drifted.
