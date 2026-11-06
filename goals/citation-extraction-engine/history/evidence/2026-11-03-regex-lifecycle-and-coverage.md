# Regex lifecycle controls and hosted coverage attribution

Extend the real-process regex supervisor controls with a fixed native-busy
fixture. It accepts the parent protocol and enters a non-yielding WASM loop only
after writing Started and an OS-visible marker. This proves native process
ownership/transport timing, not a particular regex family's scaling or actual
RegExp entry. Keep that distinction explicit.

Three controls establish that the captured regex deadline fires while the
parent remains responsive, caller interruption waits for independently observed
child exit, and delayed kill acknowledgement quarantines both total and regex
capacity. The last control rejects a replacement without spawning it, then
releases both capacities after late acknowledgement. The deadline control
provides a caller Clock whose sleep never completes; the constructor-captured
Clock still governs expiration. The shared test Clock adapter explicitly
preserves the service's prototype-backed time methods rather than spreading a
native Clock instance and accidentally dropping them.

Move the existing HTML fixture and manual Clock into the shared native-spawner
test support, preserving its messages and behavior. Seventeen HTML/regex worker
tests pass, server test compilation passes, targeted repository test-policy
scanning introduces no findings, and new-only Fallow reports zero dead-code,
complexity and duplication findings. No production safety limit changes.

The prior hosted coverage failure is
[job 125780213112](https://github.com/beep-effect/beep-effect/actions/runs/41591267727/job/125780213112)
on head dfc56bc1df. It reports 88 vanished domain paths at zero, server package
totals (functions 91.86 versus 97.79, lines 97.01 versus 99, statements 95.33
versus 98.84), one DocketIntake branch and one oracle-assertion path. These are
specific failed receipts, not a claim that all remaining coverage is inherited.

Every reported vanished domain path is absent. Seventy-four occur in the
hash-bound provisional-retirement manifest. The remaining fourteen are the
model/index pairs for CitationType, FullCitationType, ShortFormCitationType,
ParentheticalType, JournalCitation, StatuteCitation and RegulationCitation;
replacement/removal decisions are recorded in 2026-10-28-canonical-models.md
and 2026-10-28-law-schema.md. CoverageRegression.perFileDroppedMetrics
intentionally treats vanished covered paths as identity-ambiguous and emits
zero actual coverage. The schema migration and the coverage gate therefore
need an explicit compatible disposition. Do not restore obsolete contracts,
exclude production code or lower floors to manufacture a pass. Server package
coverage restoration remains work.

The small oracle assertion gap is repaired with a positive loop-iteration
identity control and duplicate rejection. A focused Istanbul run of
CitationOracleAssertions.test.ts reports eight passing tests and 100% of all
25 lines, 29 statements, 12 functions and 13 branches in
src/internal/citationOracleAssertions.ts. This is focused local evidence;
the hosted package coverage result remains authoritative for the PR gate.
