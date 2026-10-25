# Schema.org generated script review after Effect 4.0.6 integration

Reviewed 2026-10-24 for PR #2178.

The current cache audit reports nine blocking tuples for `@beep/schema-org`:
eight configuration-drift findings and the added `doctest` task. The branch
already carries the package-scripts generator output: `doctest` delegates to
`beep:doctest`, which runs `BEEP_VITEST_DOCTEST=1 bunx vitest run`.
The remaining scripts retain their commands; their keys are reordered.
The dependency sections are unchanged from main. The root Turbo task already
exists. No new cache qualification or task dependency is authorized here.

Record only this subject against the current baseline, preserving all other
subject reviews. Reversal: revert this review and its baseline update; the
cache audit will report the same nine findings again.
