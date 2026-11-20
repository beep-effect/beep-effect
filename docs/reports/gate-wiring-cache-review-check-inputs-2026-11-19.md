# Cache review for the check task's producer inputs (2026-11-19)

Branch `feat/gate-report-wiring` (gate-report-core, review round 1 of its final pull request).
Reviewer: Claude Fable 5.2 (goal driver).

`bun run beep cache audit` reports 243 blocking findings, all `configuration-drift`, across 213
package subjects.

## Cause

Two deliberate changes, both from review.

1. **The `check` task's inputs.** A reviewer found that the check record's writer was not in the
   `check` hash: a change to the diagnostic parser or the record reduction would keep every hash,
   and Turbo would restore records written by the old code. The task now lists the sources that
   build the record as root inputs: the gate-run library's sources, the repo CLI's Gate command
   directory, the unbuilt-reference probe, the output bound, and the tsconfig loader with its
   extends resolver. They are listed as files, not as a package transit dependency, so an edit to
   an unrelated driver does not re-key every check. This drifts the `check` task of all 213
   packages that carry the generated gate check.
2. **Four test scripts.** Packages that chain two Vitest runs in one script mark the later run with
   `BEEP_GATE_CONTINUES=1`, so the gate record adds the runs up. The scripts digest of
   `@beep/effect-drizzle`, `@beep/law-practice-server`, `@beep/memfs` and `@beep/repo-utils`
   changes, which drifts their other tasks too.

No task output, environment entry or cache flag changes.

## Decision

Record the 213 subjects, the root subject (its task definitions changed in `turbo.json`) and
`@beep/eyecite`, whose tasks are not cached and so drift without a blocking row. No qualification is
granted.
