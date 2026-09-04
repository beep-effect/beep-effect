# Health Ratchet Clean Runs

Promotion evidence for the Fallow 3.22.0 health baseline ratchet. Each run used
the same committed-candidate baseline bytes after fast-forwarding the feature
branch to `origin/main` at `53193e5a5e93a3231282eaead455f7d06a85ac4d` and
executed:

```sh
bun run fallow:health:baseline:check
```

| Run | UTC timestamp | Exit | Baseline SHA-256 |
| ---: | --- | ---: | --- |
| 1 | 2026-09-04T02:24:45Z | 0 | `fc6c8bbe0e2b0217c8bdcb418b2b1986bf0e5a1aedae8ea8e34f8dca8ab60ba6` |
| 2 | 2026-09-04T02:24:51Z | 0 | `fc6c8bbe0e2b0217c8bdcb418b2b1986bf0e5a1aedae8ea8e34f8dca8ab60ba6` |
| 3 | 2026-09-04T02:24:57Z | 0 | `fc6c8bbe0e2b0217c8bdcb418b2b1986bf0e5a1aedae8ea8e34f8dca8ab60ba6` |

The final run analyzed 4,411 files and 67,646 functions. Its baseline-staleness
summary reported 189 entries, all 189 matched, zero stale entries, and zero
moved entries. It emitted zero baseline regressions. The report-only complexity
breakdown reported zero unwaived findings above cognitive complexity 15; the 19
campaign override verdicts remain review-dated and observable in config.

The strict branch-local Fallow audit exited 0 with zero introduced findings and
63 inherited-adjacent findings. The independent suppression inventory reported
207 suppressions across 114 files: 120 `code-duplication`, 73 `complexity`, six
`unused-class-member`, six `unused-file`, one `unused-export`, and one
`unused-type`. All carry reasons, none are stale, and the campaign diff adds no
inline suppression marker.

## Coverage-ratchet attribution

The first full Yeet verification passed every quality lane except the coverage
ratchet. V8 denominator changes from the named helper extractions moved floors
under six owners: `@beep/face-detection`, `@beep/html`, `@beep/rdf`,
`@beep/repo-cli`, `@beep/repo-utils`, and `@beep/ui`. Exact-main controls
separated inherited movements from the campaign delta; no package test was
deleted or failed.

The first scoped write then exposed verifier-parity defects: baseline writes
used a different worker topology, skipped one repo-CLI test in report-only
mode, and did not resolve exact package filters into required shards. The
quality planner now sends baseline writes through the same weighted shard
executor as the full verifier, rejects selectors that cannot produce exact
owners, and preserves the full test inventory.

After the source-bearing fast-forward to `cde3be8f10`, the ignored Goals and
Atlas projections were regenerated and checked before the atomic six-owner
writer ran. Its merged-tree proof passed:

- `@beep/repo-cli`: 151 test files, 2,934 passed and five skipped with
  `maxWorkers=2`;
- `@beep/repo-utils`: 222 passed with `maxWorkers=1`, including Graph branch
  coverage of 88.46%;
- `@beep/face-detection`, `@beep/html`, `@beep/rdf`, and `@beep/ui`: 7, 190,
  89, and 40 tests passed with `maxWorkers=1`.

The writer merged those six measured owners into the 132-owner baseline and
retained every unrelated row from current main. The subsequent fast-forward to
`a00b102b19` changed only the per-module-imports goal packet; the ignored
projections were regenerated again. The later fast-forward to `45650b5d07`
changed only the time-to-certainty decision log. After closing two unchanged
repo-CLI per-file floor regressions with deterministic tests, the
verifier-equivalent writer passed 151 files with 2,934 tests passing and five
coverage-only skips; a direct baseline comparison found zero lowered rows for
unchanged files. The final synchronization to `53193e5a5e` incorporated the
time-to-certainty and security closeouts plus the admission-journal and Yeet
provenance work from main; the two source overlaps were reconciled with focused
planner and exclusive-publication tests before repeating the complete
current-head Yeet verification and hosted proof.

On that refreshed base, the full repo-CLI coverage shard passed 159 test files
with 3,093 tests passing and five coverage-only skips. The aggregate comparator
then exposed one unstable V8 branch mapping in the inherited admission-journal
continuation: the full-shard report showed one uncovered branch while an
isolated verifier-shaped run of all 104 scheduler tests covered both outcomes.
The continuation now uses the existing Effect conditional helper; the focused
replay remains green and removes that generator-local branch from the report.
