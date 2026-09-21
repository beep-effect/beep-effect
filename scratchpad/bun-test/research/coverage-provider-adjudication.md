# Coverage provider adjudication

Recorded 2026-09-15 from the completed `coverage-contract-*-09` artifacts.
This supersedes the earlier suggestion that successful Bun-hosted V8 report
generation might qualify that provider. The runtime inventory remains a dated
inventory of launch commands, not coverage accuracy approval.

## Controlled result

All four fixture runs exited zero. Their reports include the exercised
`Branches.ts` and unimported `Untouched.ts`. Inspecting the saved
`coverage-final.json` files gives:

| Counter | Node/V8 | Bun/V8 | Node/Istanbul | Bun/Istanbul |
| --- | ---: | ---: | ---: | ---: |
| Never-taken break, statement 10 | 0 | 3 | 0 | 0 |
| Guard branch 1 | `[0, 3]` | `[3, 0]` | `[0, 3]` | `[0, 3]` |
| Nullish branch 2 | `[1, 0]` | `[1, 1]` | `[1, 0]` | `[1, 0]` |
| Untouched statement counters | `[0, 0]` | `[0, 0]` | `[0, 0]` | `[0, 0]` |
| Untouched function counter | 0 | 0 | 0 | 0 |

Node/Istanbul and Bun/Istanbul have exactly equal `s`, `b`, `f`,
`statementMap`, `branchMap`, and `fnMap` objects for both files. Node/V8 has
the same counters and statement maps, but its branch/function map objects
are not byte-identical to Istanbul's. Do not describe all three report
representations as identical.

This establishes a false-positive coverage result in the tested Bun/V8
combination. It does not yet isolate whether the error originates in Bun's
inspector range generation or Vitest's processing of those ranges. Raw profiler
JSON plus exact transformed JavaScript would locate that boundary. The false
positive itself is sufficient to reject this provider combination for the
repository coverage gate.

## Mechanism and support boundary

Installed `@vitest/coverage-v8/dist/index.js:7–35` connects
`node:inspector/promises`, requests detailed precise coverage, and takes its
function ranges. `dist/provider.js:130–146,222–269` remaps those ranges through
installed `ast-v8-to-istanbul@1.0.5`, using source maps and wrapper offsets.
A successful inspector response does not prove faithful zero-hit subranges.

Vitest's official guide requires a V8 runtime for this provider and explicitly
excludes Bun. It describes Istanbul's counters as source instrumentation that
works across JavaScript runtimes. [Vitest coverage providers](https://vitest.dev/guide/coverage)

Installed `@vitest/coverage-istanbul/dist/provider.js:3591–3627` instruments
transformed source; its `dist/index.js:4–29` collects and resets counters in
the worker's global coverage store. This path avoids inspector range inference.

## Decision and remaining proof

Retain Node/V8 as the reference. Bun-hosted Vitest/Istanbul is the candidate
supported by this fixture; Bun-hosted Vitest/V8 is rejected. The historical
zero-coverage observation for Bun/Istanbul is not reproduced by this fixture,
but no universal resolution is inferred from that fact.

The fixture does not establish full-package equivalence, threshold rejection,
repository baseline compatibility, emitted source-map correctness for every
transform, or performance/memory compliance. Preserve the existing baseline
and all source/branch guarantees while qualifying those properties. Never
lower baselines or drop defensive branches to accommodate inflated reports.

Canonical coverage uses a different worker shape from the initial four-worker
pilot. `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:164–181`
defines ten weighted shards, two Vitest workers for repo-cli and one for other
packages, with aggregate cap eleven. `coverageVitestTopologyArgs` at 802–807
adds `--fileParallelism=true` and the selected worker cap. Repeat package
performance evidence under that topology before projecting hosted results.

## Evidence

The ignored artifact root is `.beep/bun-test-pilot/`. Each of
`coverage-contract-node-v8-09`, `coverage-contract-bun-v8-09`,
`coverage-contract-node-istanbul-09`, and `coverage-contract-bun-istanbul-09`
has its request, receipt, log, and coverage directory. Tables above were read
from those saved artifacts; this adjudication did not execute tests or modify
provider/source code. Later full-schema results must be recorded separately.
