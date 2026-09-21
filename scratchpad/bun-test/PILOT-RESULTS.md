# Local Bun test pilot results

Date: 2026-09-15. Decision: **retain Vitest; refine locally before CI measurement**.

The full native schema candidate failed correctness qualification. No accepted
performance samples, statistical savings estimate, or adoption recommendation
resulted. The protocol stopped before tuning, confirmation sampling, or changing
Turbo task implementations. This does not establish that Bun cannot save money;
it establishes that this adapter is not yet a qualified replacement.

**Superseded lead:** Vitest's V8 coverage provider ran successfully on Bun
with the complete schema test population. Subsequent counter controls found false
coverage positives; this combination is rejected. See
[the provider adjudication](research/coverage-provider-adjudication.md). The
original observation below required further coverage and
memory qualification, but does not require adopting the scratch adapter.

The [coverage runtime follow-up](research/COVERAGE-RUNTIME-RESULTS.md) records
the supported Istanbul candidate and its failure at the existing per-file ratchet.

## What executed

The base revision was `d142324fe0ff4288bb57debd4381c5bec11975dc`. The experiment
used a detached sibling worktree, shared installed dependencies, and explicit
configuration/preload paths. Production schemas, package manifests, Turbo
configuration, lockfile, and workflows were not changed.

Installed versions: Bun 1.4.2, Vitest 4.1.11, Effect and `@effect/vitest`
4.0.0-rc.113, Turbo 2.10.12. Coverage reference workers used the cached Node
22.22.3 executable. Worker witnesses independently established the Node and Bun
coverage runtimes. Bun's reported Node compatibility version is not a Node
runtime measurement.

Every attempt used repository admission and a fresh trial scope. Before launching
the child, the harness enforced and read back four CPU equivalents, 16 GiB memory,
and zero swap. Four file workers, isolation, and a within-file concurrency cap of
five were requested for full-package runs. Suite option equivalence did **not**
pass qualification, so these settings do not establish equal execution semantics.

The ledger contains **48 attempts and 161.974 seconds of aggregate execution**
(2 minutes 41.974 seconds of the 60-minute budget). It includes initial failing
controls, the invalid command-order attempt, discovery, qualification, coverage,
and final adapter validation. Admission waiting, implementation, and static
checks are excluded. No receipt records an OOM event. There are no pending
attempt files or active artifact locks at closeout. All 48 recorded trial scopes
were verified inactive.

## Full-package qualification

| Workload | Vitest hosted by Bun | Native Bun with adapter |
| --- | --- | --- |
| Ordinary | 717 passed, 78 files | 716 passed, 1 failed, 78 files |
| Property, floor 400 | 536 passed, 41 files | 535 passed, 1 failed, 41 files |

Both populations used seed `20260708`. JUnit inventories contain no skipped
cases. File and full test-name multisets match after normalizing Bun's reversed
suite ancestry in its JUnit `classname` field. This proves case selection, not
equal generated property work; helper-level generated-work/replay qualification
was deferred after the correctness failure.

The native failure in both populations is
`test/TaggedError.equivalence.test.ts`: the unsupported-Float16 runtime test calls
`vi.resetModules()` before changing the global and reimporting the module.
Native Bun's `vi` does not provide that method. File isolation cannot provide
within-test module reset. No test was removed, skipped, weakened, or rewritten
to hide this failure.

An additional control proved a suite-timeout mismatch. With a 100 ms file default,
a nested live Effect sleeping 200 ms under a 1,000 ms suite timeout passes in
Vitest but is interrupted by the adapter. This matches the configuration shape
used by the schema JSONSchema suite, which specifies a 300,000 ms suite timeout.
The adapter's raw native `describe` export and explicit per-test backstop do not
preserve that contract. A passing short test cannot qualify its timeout policy.

Native parallel children also emitted `Internal error: directory mismatch` for
the explicit tsconfig override. Alias/configuration qualification remains open;
these diagnostics were retained rather than suppressed.

## Adapter repairs and remaining limits

Seven targeted controls now produce the required outcomes under the adapter:
default timeout interruption/finalization, failing completion callbacks,
continued cleanup after callback failure, synchronous-throw cleanup, one property
completion invocation, intact tuple cases, and basic unnamed-layer lifetime.
Two deliberately failing hook controls must exit nonzero with their intended
assertion failures; their teardown assertions completed without extra failures.
The inherited-suite-timeout control remains a documented failure.

The implementation now retains completion failures instead of swallowing them,
continues remaining cleanup, prevents duplicate flushing, preserves synchronous
throw cleanup, preserves tuple arguments, and coordinates an explicitly configured
default timeout with its abort timer. It also exposes Bun's native `expectTypeOf`
and `vi`, and delegates `assert.deepInclude` to installed standalone Chai for
transitive schema helpers. No Vitest runtime is used by that assertion facade.

This is still experimental. Completion callback order differs from Vitest; the
unnamed-layer repair adds an anonymous suite; native module reset and inherited
suite options remain unsupported. A future canonical package would need explicit
dependencies, a reviewed public API, and broader parity controls.

The existing adapter suite finishes with **40 passed, 5 intentional skips,
0 failures**. Focused adapter/control TypeScript checking, the repository-configured
Trial project check, and the unchanged schema test project check all pass.
`git diff --check` passes. No workspace package was edited, so package verification
was not applicable. Full repository quality gates were not run.
The focused Biome invocation processed zero files and exited 1 because repository
configuration ignores these scratchpad paths; it is not a passing lint result.
The pilot Vitest configuration files also pass focused TypeScript checking.

## Resource observations, not accepted benchmark samples

These are first full diagnostic passes. All native rows failed a required test.
No row supports a performance ratio, confidence interval, or adoption threshold.
Elapsed time includes process launch/exit within the admitted scope. Peak memory
is aggregate cgroup memory, including the harness, rather than largest-process RSS.

| Workload and runner | Exit | Elapsed seconds | CPU seconds | Peak GiB |
| --- | ---: | ---: | ---: | ---: |
| Ordinary: Vitest/Bun | 0 | 10.122 | 36.449 | 1.485 |
| Ordinary: native Bun | 1 | 5.222 | 18.126 | 1.663 |
| Property: Vitest/Bun | 0 | 7.856 | 26.951 | 1.831 |
| Property: native Bun | 1 | 6.917 | 15.929 | 1.233 |
| Coverage: Vitest/V8 on Node | 0 | 21.301 | 70.620 | 1.610 |
| Coverage: Vitest/V8 on Bun | 0 | 11.347 | 38.351 | 1.693 |
| Coverage: native Bun | 1 | 4.739 | 17.631 | 1.595 |

The native ordinary diagnostic peak exceeds its baseline. No local memory
regression gate passed. Shared-host contention and filesystem warming were not
controlled sufficiently for conclusions from these single passes.

## Bounded coverage comparison

Three Node/Vitest and three Bun/Vitest coverage passes completed with all
717 tests passing. The later passes added qualification-only worker logging;
the last also disabled console interception. Their observations are kept
separate, not pooled as repetitions of an unchanged benchmark configuration.
Coverage metrics within each runtime were identical across all three passes.

Both Vitest runtimes include exactly the same **271 source files**, with identical
denominators: 3,948 statements, 1,197 branches, 1,289 functions, and 3,779 lines.
Their covered counts differ:

| Metric | Node/V8 covered | Bun-hosted V8 provider covered |
| --- | ---: | ---: |
| Statements | 3,736 | 3,742 |
| Branches | 1,088 | 1,097 |
| Functions | 1,161 | 1,164 |
| Lines | 3,601 | 3,604 |

The differences are in `src/Yaml.ts`, `src/internal/yaml.ts`,
`src/CsvParser/CsvParser.parser.ts`, `src/Http/Http.headers.shared.ts`, and
`src/JSONSchema/JSONSchema.shared.ts`. Their cause was not established. Equal
denominators and stable results do not prove interchangeable regression gates;
runtime-specific execution and instrumentation behavior need investigation.
Do not regenerate the committed baseline merely to make the candidate pass.

Memory also needs investigation. The last witness configuration recorded
1,445,994,496 bytes on Node and 1,685,987,328 on Bun, about 16.6% higher for Bun.
This is a diagnostic observation with instrumentation, not a confirmatory
regression estimate. It prevents claiming compliance with the 10% limit.

Native coverage attempted the complete ordinary manifest and failed the same
module-reset test. Its LCOV contained 332 file records and **zero branch records**;
the Vitest reports each contain 1,197 `BRDA` entries. Its source population and
line/function accounting are not the existing all-source statement/branch
contract. Bun also documents that statement thresholds are not enforced.
[Bun coverage documentation](https://bun.com/docs/test/code-coverage)

These were direct package-runner diagnostics using the same source-resolving
configuration and existing dependency installation. No dependency builds were
executed; these are not end-to-end Turbo coverage-lane observations. Threshold
negative controls, untouched-source sentinels, and the repository ratchet were
not qualified. Native coverage substitution is therefore rejected for this pilot.

## Deferred after the stop condition

The actual Turbo runner substitution, strict-environment child witnesses,
adapter/helper/config hash-mutation controls, fresh task execution proofs,
generated property work and replay/shrinking checks, independent worker tuning,
confirmation pairs, and cost modeling did not execute. Read-only Turbo graph
findings remain in the configuration adjudication; they are not execution proof.
No hosted job or billing study ran. The requested 100% configuration assurance
was not achieved and is not claimed.

The next local work should make an explicit choice between:

1. Qualifying Bun-hosted Vitest coverage while preserving the current coverage
   guarantees and explaining the five-file differences and memory behavior.
2. Fixing inherited suite semantics and choosing an honest module-reset strategy
   for a native or hybrid candidate, then restarting qualification before timing.

A hybrid candidate must retain the module-reset workload on Vitest and charge
both runner startups to its total. It cannot compare a smaller native population
against the complete baseline. Neither route is ready for paid CI measurement.

Eventual adoption still requires an uncertainty range supporting at least 10%
lower **total CI cost per successful PR**, with at most 10% regression in CI
completion time or local peak memory and no new correctness/OOM failures.

## Evidence and reproduction

The ignored artifact root is `.beep/bun-test-pilot/` in the authoring checkout.
It retains each immutable `<id>.request.json`, `<id>.receipt.json`, and log;
JUnit inventories; separate coverage report directories; ordinary/property
manifests; and source/configuration hash manifests. No secrets or whole
environments were captured. Public results use relative paths.

Key ids are the row names reflected in `schema-ordinary-*-03/04`,
`schema-property-*-04`, `coverage-*-05`, `coverage-*-witness-06/07`,
`control-*-inherited-suite-timeout-04`, and final adapter controls ending `-07`.
`research/pilot-attempts.json` is a sanitized receipt inventory.
`inputs/witness-07/` preserves the exact worktree configuration; the previous
witness configuration is retained separately. `qualification-inputs-04.json`
predates witness logging and must not be treated as its provenance.

See [pilot/README.md](pilot/README.md) for the harness and rerun procedure,
[PILOT-PLAN.md](PILOT-PLAN.md) for the predeclared protocol, and
[configuration adjudication](research/configuration-adjudication.md) for the
independent Grok/Codex review. Scratch work and the experimental worktree remain
uncommitted; no package was promoted or workflow changed.
