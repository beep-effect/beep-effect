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

Verification and heavy jobs use literal check names with singleton matrices
and shared YAML step anchors. Literal names allow job-level skips to retain
the required contexts without allocating placeholder runners. The required
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
regressions execute the real workflow shell for successful, failed, cancelled,
and missing classification and shard outcomes.

A small PR workflow exercises a local reusable workflow with literal names,
singleton matrices, and anchored steps. Its active and skipped checks have
unique names, so they cannot satisfy production required contexts. Hosted
acceptance must confirm the exact skipped check name and absence of runner
allocation.

The implementation PR uses the trusted production reusable workflow from
`main`; it cannot prove its own edited `heavy.yml` through that reference.
After merging, a genuine documentation-only acceptance PR must confirm the
production check names, successful aggregate results, skipped runner allocation,
and Yeet merge-gate behavior. After-change job counts and timings remain
unmeasured until that acceptance run completes.
