# Synthetic evidence scanner review

The first staged publication scan rejected 4,635 `generic-api-key` findings.
Every finding was independently mapped to a complete member of the frozen set
of 104 synthetic edge `logicalKey` identities: 103 fixture matches, 2,266
superseded-output matches, and 2,266 final-output matches. No finding was an
unknown value or another detector. Production data and credentials were absent.

Prerequisite delivery: [PR #2354](https://github.com/beep-effect/beep-effect/pull/2354).
Merge and hosted verification remain pending at this record.

The separately reviewed prerequisite configuration uses one rule-specific
allowlist, `condition = AND`, `regexTarget = match`, 104 exact complete field/value
expressions, and three exact artifact paths. Nested paths and other fields are
excluded. The final configuration SHA-256 is
`c83b8b44f622fbe40388d150958d7215e74479dd3b1da8aa9becc17d78469430`.

Eight controls passed against that config: reviewed value suppression, unknown
value detection, credential-field detection, preservation of a different secret
on the same line (identity checked), unlisted-file detection, nested-path
detection, altered-value suffix detection, and altered-field prefix detection.
A separate synthetic GitHub token triggered `github-pat` both before and after,
even under the exact allowed fixture path.

A disposable synthetic Git repository containing all four retained JSON input
and result files was scanned in Git-history mode with the proposed configuration:
zero findings, exit 0. This matches the mode used by hosted publication scanning.
The actual staged baseline independently confirmed all 4,635 complete matches.

Directory mode produced six truncated digest findings at scanner chunk boundaries
in the large single-line outputs. Each was mapped to a full reviewed identity,
but no exception for a truncated value is shipped: the actual publication modes
produce complete matches and do not need the broader configuration. This is not
a claim that every possible scanner mode is clean.

The independent reviewer accepted the final exception scope and attribution.
Hosted checks, review window and merge of the prerequisite remain delivery gates.
The configuration is not calibration acceptance, approval, or production activation.
