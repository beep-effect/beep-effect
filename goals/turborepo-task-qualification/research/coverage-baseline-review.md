# Review the initial per-file cache coverage floors

The full integrated Yeet run on `1e811e84a2` passed every lane except the
coverage ratchet. All tests passed, including 3,493 CLI tests in 185 files and
the new complete synthetic/pilot orchestration tests. The package aggregate
now exceeds every retained percentage floor:

| Metric | Retained floor | Measured |
| --- | ---: | ---: |
| Lines | 81.84 | 82.07 |
| Statements | 81.59 | 81.82 |
| Branches | 72.09 | 72.73 |
| Functions | 76.26 | 76.64 |

The remaining ratchet witnesses are new paths without a prior file identity.
The comparator deliberately reports those gaps even when package totals improve.
No existing file produced a regression witness. Sixteen newly measured paths
need identities: fourteen cache files from this branch and two fully covered
lint helpers inherited from main. Eight cache files have uncovered units.

Accept measured initial per-file floors for this paused, draft implementation
snapshot through the canonical package-scoped writer. Retain every other
package row, the repository minimum, exemptions and named follow-up policy.
Review the generated delta for existing-file changes before committing it.
This update does not establish cache qualification or enable live reuse.

The new orchestration tests cover complete synthetic and pilot execution through
controlled process boundaries, invalid observations, dependency invalidation,
negative controls and schema-generated binary-pin rejection. Synthetic coverage
is 98.36% lines and 99.33% branches; pilot coverage is 89.95% lines and 84% branches.
The entrypoint interpreter and pilot capture module have full measured coverage.

Remaining test debt is explicit: census (30.76% lines), qualification service
(45.81%), dependency capture (53.19%), fingerprinting (66.03%) and linker failure
paths (80.39%) need more in-process path coverage. The lower percentages are
accepted as initial measurements, not claimed as complete validation. Preserve
the existing CLI follow-up debt and prioritize those paths when the campaign
resumes. Both pilot computations remain cache-disabled and the qualification
ledger remains unchanged.

The machine-readable coverage baseline delta records the exact generated update.

The scoped writer reproduced the full-run percentages exactly and succeeded.
Its diff changes only the `@beep/repo-cli` package row. All other package rows,
repository policy and document-level provenance remain byte-for-byte equivalent
as parsed values. All four package percentage floors increase. The writer adds
16 file identities and updates 33 existing file measurements without removing
an identity. None of the existing rows violates the ratchet comparator: where
percentages decrease, uncovered counts are unchanged; where uncovered counts
increase, measured percentages increase. The delta explicitly lists all 26 such
metric changes, including inherited main measurements, for review.
