# Documentation-only CI job admission

PR [#2932](https://github.com/beep-effect/beep-effect/pull/2932) changed three
Markdown files: a goal plan, a goal decision, and
`standards/generated-artifacts.policy.md`. Its Unit D log confirms that tests
were skipped. The remaining cost came from starting runners and setting them
up to discover that they had no work.

The baseline job census recorded 41 jobs. Ten unit shard allocations accounted
for 266 seconds of summed elapsed job time. Heavy Admission took 91 seconds,
including the dependency setup before admission. Seven heavy placeholder jobs
accounted for another 49 seconds of summed elapsed time. These are observations
from that run, not billed runner minutes or a dollar estimate. They do not
establish the duration of a future run.

## Admission changes

Check classifies the pinned PR base/head diff once using the checksum-pinned
`beep` release, before installing dependencies. Its sparse checkout contains
only the binary-fetch action and classifier pattern file. The existing
classifier retains full verification when the pinned diff is unavailable.
A failed classifier blocks the lint and unit aggregates.

Documentation-only changes skip the lint and unit matrices before runner
allocation. Their required aggregate jobs explicitly accept only successful
classification followed by skipped shards, or a non-documentation profile
followed by successful shards. Heavy Admission and the label admission path
avoid dependency installation for same-repository documentation-only changes.
Forks retain ordinary admission and require the existing explicit fork
authorization before Heavy can run. Both callers bind classification to the
PR event's base and head SHAs.

Verification and heavy jobs use literal check names, literal runner/timeouts,
job-local environment parameters, and shared YAML step anchors. They have no
matrix that could append values to an active check name. Literal names allow
job-level skips to retain the required contexts without allocating placeholder runners. The required
check names, rulesets, trusted `heavy.yml@main` reference, fork authorization,
producer isolation, security checks, SAST, and secret scanning remain in force.
Repo Sanity retains its narrower goals-only exception, so changesets and
ordinary documentation can still receive its validation.

Code PRs gain a serial classifier dependency. Sparse checkout and reusing its
outputs in downstream jobs limit that overhead; hosted measurements are needed
to quantify the latency tradeoff.

## Validation and acceptance

The exact released binary was tested in a disposable sparse Git fixture with
PR #2932's three paths and no `package.json`. Its SHA-256 was
`91f0bb418966262151d62c8f34c64b3f5982cac9f0b4a4e8d98291f932f46ff0`.
It emitted `docs_only=true`, `goals_only=false`, and
`desktop_rust_relevant=false` to stdout and `GITHUB_OUTPUT`.

Classifier regressions cover the original change, mixed source/documentation,
workflow and configuration changes, source deletion, source-to-Markdown rename,
unavailable diffs, empty diffs, and invalid classifier configuration. Aggregate
regressions execute 160 cases against the real workflow shell, including failed
and missing profiles, missing or invalid classification outputs, non-docs
changes with skipped shards, and classified documentation with skipped shards.

A small PR workflow exercises a local reusable workflow with literal names,
job-local environment parameters, and anchored steps. A second caller skips
every job to exercise the complete docs-only callee shape. These checks have
unique names, so they cannot satisfy production required contexts.
The first hosted probe caught GitHub appending matrix values to the active name while keeping the skipped name exact. That result required removing the
singleton matrices. Hosted acceptance must confirm both final active and
skipped exact names, and absence of runner allocation for the skipped job.

The implementation PR uses the trusted production reusable workflow from
`main`; it cannot prove its own edited `heavy.yml` through that reference.
After merging, a genuine documentation-only acceptance PR must confirm the
production check names, successful aggregate results, skipped runner allocation,
and Yeet merge-gate behavior. After-change job counts and timings remain
unmeasured until that acceptance run completes.

## Authoring preflight

Package `--quick` runs Biome and the compiler. It does not replace root Oxlint,
Effect Vitest, schema-first, or Fallow checks on a changed test. In this change, direct checks
caught test complexity, an unnecessary platform layer, and an inline schema
compilation before publication. Keep those checks in the authoring loop so a
small test issue does not require another full publication inventory run.

The direct commands verified here were:

```sh
bun run beep quality package-verify @beep/repo-cli --quick
bun run lint:oxlint
bun run beep lint schema-first
bun run beep lint effect-vitest
bun run beep ci workflow-lint
bun run beep quality fallow audit --base origin/main --check --out .beep/fallow/authoring.json --quiet
bunx --bun vitest run \
  packages/tooling/tool/cli/test/ci-lane.test.ts \
  packages/tooling/tool/cli/test/ci-docs-job-admission.test.ts \
  packages/tooling/tool/cli/test/ci-runner-security.test.ts \
  packages/tooling/tool/cli/test/ci-heavy-admission.test.ts \
  packages/tooling/tool/cli/test/ci-bootstrap-parity.test.ts
```

The full Effect Vitest policy check passed with zero introduced findings.
A focused detector result does not replace that ratchet check. The workflow
suite includes the existing CI lane contracts as well as the new admission
regressions; package lint and typecheck alone do not execute those contracts.
Do not update inventory baselines to clear an introduced authoring issue.

Workflow scalar metadata is checked with named schema-derived guards and test
assertions. These tests exercise workflow admission and real shell execution;
they do not introduce a domain codec requiring artificial property coverage.
