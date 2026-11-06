# Hosted case-flag findings and repairs

PR #2713 Check run 42138197659, Fallow Advisory Envelopes job 127631603309,
reports a real code finding rather than an invalid envelope. The envelope
validation step succeeds. Raw artifact 13467610125 identifies RegexProgram's
groupHeader at cognitive 11 / cyclomatic 10, exceeding the existing threshold.
The health check and audit both fail on this function. The raw audit also
identifies the duplicated replay loop in boundary and case-flag fixture owners.

Downloaded artifact ZIP SHA-256:
10d1fe329dd460c804c5cb12b9a956563fb412d5b40fb675d435194de738d867.
Hosted job: https://github.com/beep-effect/beep-effect/actions/runs/42138197659/job/127631603309

The parser now separates scoped case-header parsing, Python named/verbose-header
parsing and the small header dispatcher, preserving the original state changes.
The existing shared regex fixture owner now replays both engines and validates
expected admissions/refusals for both families; duplicated loops are removed.
No policy threshold, suppression, baseline or checker behavior is changed.

The reviewer independently reports that repository formatting compacted the
case-flag JSON arrays after the source capture, leaving a stale raw-output seal
in the test loader and evidence table. Both now authenticate the committed
formatted corpus hash 9c2a3e666734e79836701f6a8488446b90336ff2debf9cd405e1e2d7cd899d93.
The source producer and observed values are unchanged. Hash-seed repeatability
refers to raw producer output before repository formatting. This correction
preserves byte authentication instead of disabling or weakening it.

Scoped lint/type and Oxlint checks pass. Sixteen tests across case flags,
boundaries and regex programs pass after the repairs, replaying the original
source grammar/profile/capture observations through both runtimes.
Hosted Fallow confirmation on the repaired head remains pending; local focused
execution is not a hosted-policy verdict. Vercel's separate rate-limit failures
do not provide a code diagnostic and are not treated as passing checks.
