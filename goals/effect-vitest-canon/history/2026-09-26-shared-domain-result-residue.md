# Shared-domain Result assertion residue

Final detector reconciliation found seven exact Result.succeed expectations in
SchemaParity that the earlier Boolean/Option assertion pass missed. Converted
them to assertSuccess with the original independently supplied literal values:
team, member, active, System, Policy, candidate and deny. Inputs and the adjacent
member guards are unchanged. This is a late assertion-phase correction, not a
new property or runner behavior change. The unused Result import is removed.

Package audit and docgen pass after the correction. Final timings and detector
reconciliation follow this commit rather than claiming the earlier runner
receipt proves the corrected source. Preserve both historical ledger identities
and current root identities during reconciliation; upstream runtime-boundary
removals belong to PR #1200 rather than this wave.
