# Python removed from this packet (2026-11-13)

The `python-free-repo` goal bans tracked Python
([SPEC](../../../goals/python-free-repo/SPEC.md)). Nothing in a workflow, hook,
package script, skill, systemd unit or `opsScripts` entry still runs the
10 file(s) below, so they were deleted rather than ported. Their outputs and
the conclusions drawn from them stay in this packet, in the files listed under
"Recorded in".

Recover any script with
`git show 05ed8bc6b6cc50f2a284ed02caaab16f216bb9c3:<path>`. A resumed packet that needs to run one again
ports it to TypeScript first; tracked Python is no longer admitted.

| Deleted file | Recorded in (non-Python files that name it) |
| --- | --- |
| `research/census-components.py` | none |
| `research/diagnose-structures.py` | `goals/claim-check-performance/research/implementation-accepted-main-metadata-001.json`, `goals/claim-check-performance/research/implementation-accepted-main-metadata-002.json`, `goals/claim-check-performance/research/implementation-accepted-main-metadata-003.json` (+16 more) |
| `research/evaluate-gates.py` | `goals/claim-check-performance/history/2026-11-05-nominal-runtime-replay.md`, `goals/claim-check-performance/history/2026-11-05-policy-work-measurement.md`, `goals/claim-check-performance/history/2026-11-05-predicate-frames-measurement.md` (+28 more) |
| `research/freeze-runtime-closure.py` | `goals/claim-check-performance/decisions/2026-11-09-sealed-archives-keep-recorded-home-paths.md`, `goals/claim-check-performance/history/2026-11-05-nominal-runtime-replay.md`, `goals/claim-check-performance/history/2026-11-05-policy-work-measurement.md` (+19 more) |
| `research/test_census_components.py` | none |
| `research/test_evaluation_coverage.py` | `goals/claim-check-performance/research/implementation-accepted-main-metadata-001.json`, `goals/claim-check-performance/research/implementation-accepted-main-metadata-002.json`, `goals/claim-check-performance/research/implementation-accepted-main-metadata-003.json` (+18 more) |
| `research/test_preservation.py` | `goals/claim-check-performance/research/implementation-accepted-main-metadata-001.json`, `goals/claim-check-performance/research/implementation-accepted-main-metadata-002.json`, `goals/claim-check-performance/research/implementation-accepted-main-metadata-003.json` (+18 more) |
| `research/test_usefulness.py` | none |
| `research/usefulness.py` | `goals/claim-check-performance/research/implementation-accepted-main-metadata-001.json`, `goals/claim-check-performance/research/implementation-accepted-main-metadata-002.json`, `goals/claim-check-performance/research/implementation-accepted-main-metadata-003.json` (+24 more) |
| `research/verify-preservation.py` | `goals/claim-check-performance/history/2026-11-05-nominal-runtime-replay.md`, `goals/claim-check-performance/history/2026-11-05-policy-work-measurement.md`, `goals/claim-check-performance/history/2026-11-05-predicate-frames-measurement.md` (+23 more) |
