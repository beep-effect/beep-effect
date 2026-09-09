# Health Ratchet Clean Runs

## Full local verification — 2026-09-09 UTC

`bun run beep yeet verify` exited 0 after the approved mitigation and root
dependency declaration. The run began at 2026-09-08T23:24:00Z and ended at
2026-09-09T00:21:12Z. Its full-tier verdict records 31 passed lanes, three
reused lanes, and zero failures on HEAD `29f1284b43` plus the reviewed changes.

- All 15 initial gates passed, including Knip and the three blocking Fallow lanes.
- Security, secrets, SAST, Nix, build, IPC, and documentation checks passed.
- Full docgen, lint, policy, compiler checks, and unit/integration tests passed.
- The CLI unit suite passed 163 files and 3,159 tests.
- Coverage compared 134 packages successfully with epsilon 0.001.
- The final blocking health check exited 0 with no baseline regressions.

The source and staged index stayed unchanged during the run; a documentation
receipt recorded the discovered SAST scope limitation. That lane selects the
committed Git range and therefore omits a newly staged file. A focused replay
of its exact configurations on all four staged JS/TS files ran 128 rules with
zero findings. Normal Yeet publication must still prove the committed changes
before push. Hosted readiness and final packet closeout remain open.

## 2026-09-08 security mitigation candidate

After the approved ONNX installer mitigation, frozen installation and the
local security gate passed. Three additional Fallow 3.23.0 baseline checks
passed with the same baseline bytes:

| Run | UTC timestamp | Exit | Baseline SHA-256 |
| ---: | --- | ---: | --- |
| 1 | 2026-09-08T23:04:40Z | 0 | `fc6c8bbe0e2b0217c8bdcb418b2b1986bf0e5a1aedae8ea8e34f8dca8ab60ba6` |
| 2 | 2026-09-08T23:04:43Z | 0 | `fc6c8bbe0e2b0217c8bdcb418b2b1986bf0e5a1aedae8ea8e34f8dca8ab60ba6` |
| 3 | 2026-09-08T23:04:46Z | 0 | `fc6c8bbe0e2b0217c8bdcb418b2b1986bf0e5a1aedae8ea8e34f8dca8ab60ba6` |

The scan now covers 4,441 files and 68,533 functions. All 189 baseline entries
match with zero stale entries, moved entries, or regressions. A separate
unbaselined scan still finds zero unwaived functions above cognitive 15.
Suppression totals remain 207 across 114 files, with zero missing reasons or
stale suppressions. No health rebaseline was needed.

The full verification immediately before this mitigation completed all 15
cheap gates, build, docgen, lint, policy, compiler checks, unit and integration
tests, and coverage. Only the inherited security advisory failed. The focused
security gate now passes, but a full run including the mitigation and hosted
PR proof remain required.

## 2026-09-08 Fallow 3.23.0 revalidation

Candidate `29f1284b43` includes `origin/main` at `9b7553f618`, including its
Fallow 3.23.0 dependency update. After `bun install --frozen-lockfile`, three
consecutive `bun run fallow:health:baseline:check` runs passed without rewriting
the baseline:

| Run | UTC timestamp | Exit | Baseline SHA-256 |
| ---: | --- | ---: | --- |
| 1 | 2026-09-08T21:37:24Z | 0 | `fc6c8bbe0e2b0217c8bdcb418b2b1986bf0e5a1aedae8ea8e34f8dca8ab60ba6` |
| 2 | 2026-09-08T21:37:26Z | 0 | `fc6c8bbe0e2b0217c8bdcb418b2b1986bf0e5a1aedae8ea8e34f8dca8ab60ba6` |
| 3 | 2026-09-08T21:37:29Z | 0 | `fc6c8bbe0e2b0217c8bdcb418b2b1986bf0e5a1aedae8ea8e34f8dca8ab60ba6` |

Each run analyzed 4,440 files and 68,513 functions, matched all 189 baseline
entries, and reported zero stale entries, moved entries, or regressions. The
separate unbaselined scan found zero unwaived functions above cognitive 15.
The suppression inventory remains 207 across 114 files, with zero missing
reasons and zero stale suppressions. The three critical estimated-CRAP findings
below the cognitive ceiling remain, as described in the earlier scan below.
Full Yeet and hosted PR proof remain outstanding.

## 2026-09-08 Fallow 3.22.0 revalidation

Candidate `79efbe8e02` includes `origin/main` at `be8995e66a`. Three new
consecutive `bun run fallow:health:baseline:check` runs passed without
rewriting the baseline:

| Run | UTC timestamp | Exit | Baseline SHA-256 |
| ---: | --- | ---: | --- |
| 1 | 2026-09-08T20:05:56Z | 0 | `fc6c8bbe0e2b0217c8bdcb418b2b1986bf0e5a1aedae8ea8e34f8dca8ab60ba6` |
| 2 | 2026-09-08T20:06:00Z | 0 | `fc6c8bbe0e2b0217c8bdcb418b2b1986bf0e5a1aedae8ea8e34f8dca8ab60ba6` |
| 3 | 2026-09-08T20:06:02Z | 0 | `fc6c8bbe0e2b0217c8bdcb418b2b1986bf0e5a1aedae8ea8e34f8dca8ab60ba6` |

Each run analyzed 4,440 files and 68,497 functions, matched all 189 baseline
entries, and reported zero stale entries, moved entries, or regressions. A
separate unbaselined complexity-breakdown scan found zero unwaived functions
above cognitive 15. The suppression inventory remains 207 across 114 files,
with zero missing reasons and zero stale suppressions.

The unbaselined report still contains three critical CRAP findings at
cognitive scores 7, 8, and 12. One chart row is stored as
`complexity_critical` because Fallow combines cognitive and CRAP severity.
These are not functions above cognitive 15; the empty baseline regression
array must not be described as an empty underlying health inventory.
The user confirmed on 2026-09-08 that completion stays scoped to the unwaived
cognitive-over-15 tail; the SPEC and launcher now express that distinction.

Before this base synchronization, all 15 cheap-gate lanes passed, including
test typechecking of 1,020 files across 139 packages, Fallow audit, dead-code,
and blocking health. Current-candidate full Yeet and hosted PR proof remain
outstanding.

## Initial promotion evidence

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
