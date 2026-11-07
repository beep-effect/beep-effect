# Coverage comparison discovery, 2026-11-06

The coverage comparator independently discovers both expected test files and configured
coverage sources. Its source verification processed packages sequentially. This change
allows two packages to validate concurrently and records timings for test inventory,
artifact verification, and baseline comparison. Each package retains its own coverage
map, source checks, runtime process, and sealed artifact validation.

## Evidence and attribution

The successful full-scope main run [42220674884](https://github.com/beep-effect/beep-effect/actions/runs/42220674884),
job 127921370035, compared 190 packages. The job took 443 seconds, including 23 seconds
for installation and 383 seconds in `Compare coverage evidence`. The affected PR #2758
run [42217364751](https://github.com/beep-effect/beep-effect/actions/runs/42217364751),
job 127896243380, spent 22 seconds comparing one CLI package and 77 seconds overall.
These step timings do not distinguish test-file discovery from source verification.

A local full-scope probe at base commit `6a00ca54f8` reached the expected missing-artifact
failure in 69.45 seconds. Repeating it with phase instrumentation measured 67.08 seconds
in independent test-file discovery, covering 190 packages and 192 invocations. The
missing input directory intentionally prevented artifact verification. This establishes
the test-inventory cost locally; it does not apportion the hosted 383-second step.

A separate bounded probe called the production `discoverCoverageArtifactSources` helper
for 12 real workspace packages. All four passes returned the same per-package source
counts: `13,16,31,5,6,23,7,3,3,2,3,56`.

| Pass | Sequential | Two concurrent packages | Reduction |
| --- | ---: | ---: | ---: |
| 1 | 9.55 s | 4.93 s | 48.3% |
| 2 | 7.34 s | 3.58 s | 51.3% |

The probe ran with Bun 1.4.4 and Node 24.22.1. Hosted comparison pins Node 22.23.4.
The measurement covers config/provider source discovery, rather than complete artifact
loading, source hashing, merging, or the baseline comparison. Other workstation jobs
were active. Hosted phase timings remain the acceptance evidence for end-to-end gains.
A one-package affected comparison does not benefit from package concurrency; its
invocation checks remain sequential.

The first probe accidentally supplied Bun's compatibility `process.versions.node`
value instead of the child Node runtime version. Production discovery rejected that
mismatch. The corrected probe used the child runtime's actual version; production
runtime checks were unchanged.

## First full hosted attempt

PR #2772's [Check run 42237340716](https://github.com/beep-effect/beep-effect/actions/runs/42237340716)
correctly widened to full scope because both changed implementation files are global
coverage inputs. [Comparison job 127966899337](https://github.com/beep-effect/beep-effect/actions/runs/42237340716/job/127966899337)
reported these separate phases:

| Phase | Time | Scope |
| --- | ---: | --- |
| Independent expected test inventory | 142.07 s | 190 packages, 192 invocations |
| Independent sealed artifact verification | 165.32 s | 190 packages |
| Compare coverage evidence step | 314 s | Full scope; subsequent ratchet failed |
| Whole comparison job | 360 s | Includes checkout, install, and artifact transfer |

Artifact verification completed successfully. The subsequent ratchet refused inherited
OwnerCheckpoint split files from #2747 because their new file identities had uncovered
units. The consolidated [repair #2776](https://github.com/beep-effect/beep-effect/pull/2776)
landed as `496a4a5b5d74ede757ad58d50afe733226fb59fd`, covering the observed refusal and
recovery paths without changing floors or adding baseline exceptions. Its strict Node
22.23.4/V8 proof covered all five modules completely; its hosted CLI ratchet passed.

The earlier 383-second successful comparison and this 314-second failed comparison
have different ratchet outcomes and source snapshots. They do not establish an accepted
end-to-end speedup. A successful full-scope repeat after the inherited repair is required;
the phase logs make its costs attributable without guessing how much was discovery.

## Decision and preserved gates

Use bounded package concurrency before introducing another CI artifact protocol.
The existing collector already isolates mutable coverage maps and source records within
each package callback, and Effect preserves result ordering. Per-package invocation and
slice processing remains sequential. The test-file census retains its existing two
package bound. The comparator still installs dependencies and performs fresh independent
Vitest/provider discovery on the checked-out source.

No workflow wiring, expected inventory artifact, cross-head cache, producer inventory
trust, or coverage threshold change is needed. Existing run/head/base/scope identities,
partial-rerun selection, latest Labs execution authentication, report/runtime digests,
source hashes, configured source census, V8 zero witnesses, and missing evidence failures
remain authoritative. Docs-only admission behavior is unchanged. Reversal is restoring
the collector's package concurrency to one; timing logs can remain for attribution.

## Local receipts

Receipts and the bounded probe are under the lane-local ignored
`.beep/efficiency-wave2/` directory:

- `full-discovery-baseline.log` and `full-discovery-timed.log`
- `source-discovery-probe.ts` and `source-discovery-baseline.log`
- `dependency-build.log`, `focused-tests.log`, `package-check.log`
- `hosted-comparison.log` and `hosted-unit-a.log` for the first full hosted attempt
- `package-verify.log`, `package-verify-quick-final.log`, `docgen.log`, and `workflow-lint.log`

The three focused coverage suites passed all 214 tests, including configured discovery,
runtime/provider validation, stale identity, missing evidence, partial reruns, and source
changes. The owning package check passed after the fresh worktree built its dependency
declarations. `docgen:local` passed, including 3,614 CLI examples; workflow lint was clean.
Quick package verification also passed lint and check after fixing the initial Biome
formatting failure. Full package verification passed its audit in 168.0 seconds and
docgen in 42.2 seconds. The successful rerun cleared the initial audit and lint inbox
rows. Hosted validation is owned by the coordinating session.
