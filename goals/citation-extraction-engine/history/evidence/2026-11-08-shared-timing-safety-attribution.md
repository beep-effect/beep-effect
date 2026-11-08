# Attribute nested safety failures at the captured timing boundary

The previous court correction exposed the same contract issue in the native repr
and dump helpers: their timing adapter captured the installed operation, but shared
text-budget refusals arrived with the budget primitive's extraction label. Two
new regressions fail before the correction: a generic timing-boundary control and
an actual repr/dump allocation control. This is a target safety-contract defect,
not a new source-parity exception.

The existing makeCitationRegexTiming adapter now normalizes only schema-recognized
CitationSafetyLimitExceeded errors to its captured operation while retaining the
actual limit. Both timed and operationTimed compose the same existing Effect
mapError, timeoutOrElse and captured Clock provision. Their durations and limit
selection are unchanged. The existing failSafety method reuses the same mapping.
Court lookup no longer needs its duplicate local catchTag remapping. No new timer,
clock, capacity, admission or worker framework is introduced.

All twenty focused tests pass: generic timing/deadline coverage, the new actual
rendering operation control, all four repr tests, all three dump tests, all eight
court lookup tests and both original complete debug-workflow replays on Bun/Node.
The corpora retain 3,113 independent native repr cases, 803 complete dump cases and
17,156 exact/prefix/native court normalization observations. Generic controls cover
all four installed operations through both timing methods, preserve the original
limit and success result, and retain an unrelated Error object's exact identity.
Actual repr/dump controls force shared allocation refusal after each installation
while a later caller selects extraction. The controlled budget permits individual
Unicode fragments so the check reaches the intended shared allocation boundary.
Court's four-stage Clock replacement and actual deadline controls remain passing.

Command from packages/law-practice/server:
bunx --bun vitest run test/CitationRenderingOperation.test.ts test/CitationRegexPolicyCoverage.test.ts test/CitationPythonRepr.test.ts test/CitationDump.test.ts test/CitationCourtLookup.test.ts test/CitationCanonicalDump.test.ts --reporter=json --outputFile=../../../.beep/timing-operation-results.json.

Server lint/types and repository-wide lint:oxlint pass. Fallow new-only and portable
accounting/audit checks are recorded with publication. The original complete debug
assertion is freshly replayed; the earlier full 29-example court workflow remains
historical proof, with its unchanged successful lookup dependency requalified by
the complete independent court corpus. The shared timing change only affects typed
safety attribution and removes duplicated composition; arbitrary failures and
success algorithms remain unchanged. No source capability, canonical event,
representation law or fidelity question is promoted.

Totals remain 182 complete canonical events, zero nonterminal bindings and 15,316
rows without completion proof. Exact-head hosted acceptance, remaining original
workflows and backend protocols, retained host/model/token/callback behavior,
exhaustive source/donor reconciliation, native identity/deployment attestation,
whole-engine safety/scaling and lifecycle acceptance remain open.
