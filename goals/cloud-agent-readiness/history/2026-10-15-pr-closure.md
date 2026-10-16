# Readiness PR closure follow-up

Date: 2026-10-15 (America/Chicago). Branch: `feat/linux-agent-readiness`.
PR: [#1750](https://github.com/beep-effect/beep-effect/pull/1750).

## Current-main integration

Adopted canonical main `44dbfa70ff` through a merge, preserving published
history. Resolved the managed-agent test's layer ordering using main's ordering.
Regenerated the observability catalog and its standard table through
`beep observability catalog --write`, rather than selecting stale generated
counts from either side. Frozen installation upgraded the local Effect runtime
to 4.0.4; pre-install test failures involving `randomUUIDv4` do not qualify the
installed source.

The old published head `aca20e45c2` had three failed heavy checks. Its drawing
JSON-policy violations and inline-schema compilation findings were inherited
from main; main's #1792 and #1798 repairs are now integrated. Coverage findings
were in BoxContentMigration and Tika, outside this readiness change. Fresh hosted
checks must determine their current status; no coverage floor is lowered and
old hosted results are not carried forward as new-head proof.

## Review fixes

- A missing cheap-gate concurrency setting still selects four jobs. Explicit
  values 1–4 select their requested width. Any present invalid value, including
  an empty string, warns on stderr and selects one job. The fresh environment
  provider preserves empty strings so the safe fallback cannot become four
  through generic config normalization. Pre-push remains serial.
- `ops/agent-runs-worker.slice` explicitly states its installation destination:
  `~/.config/systemd/user/agent-runs.slice`. Copy it under that unit name,
  reload the user manager, and verify that detached proofs use the installed
  slice. MemoryHigh, MemoryMax, swap, CPU and task limits are unchanged.

Tests exercise absent, all four valid, and malformed values (including `01`,
`serial` and an empty value), warning behavior and the independent serial
pre-push tier. The slice change is documentation only.

## Local validation

After the final source change, the focused five-file Vitest run passed all
393 tests (quality tasks, managed-agent runtime, CI governance, CI lane and
schema-first parity). `beep quality test-tsgo` exited zero while checking
373 test files. Biome reported no findings on the two edited TypeScript files,
and the regenerated observability catalog passed its independent check.
Expected TS2589 fixture output in quality-task tests is not a failing build.
These checks precede the normal publication gates and do not replace hosted CI.

## Worker preservation

Fresh canonical YubiKey SSH confirmed beep-worker at `aca20e45c2` with the same
seven tracked overlays plus untracked `.grok/config.toml`. A private verified
backup was written before synchronization:
`~/.cache/beep/readiness/pr1750/worker-before-20261015-closure/` on the worker.
The archive was reopened and all eight payload hashes checked. The worker's
separate main checkout remained at `b43a4098bbdc345f897c87f84f58953cb7fd4825`.

Publication, synchronization and hosted checks are separate verification steps.
No merge is authorized by this follow-up; other fleet hosts and remaining
provider/authentication gaps retain their existing qualification boundaries.

## Subsequent base movement and inherited holds

The first wave published and synchronized `0f5bf3d896024a691abe16cd3d68a258f6a173f8`.
All 17 publication gates and both frozen installs passed; all eight worker
post-install overlay hashes matched. The independent re-review returned 5/5,
verified both P2 fixes and reported no new findings. Both threads were answered
and resolved. All 16 required hosted checks passed on that source head.

While optional checks were running, main landed #1810 as `ce5780ed67` and
introduced another generated-table conflict. The local branch adopted that
canonical diagnostics-lane/compiler change, regenerated the table, and refreshed
its frozen install to @effect/tsgo 0.53.0. A fresh five-file run after installation
passed 394 tests. This integration is held locally pending canonical main repairs;
it is not qualified by the previous head's hosted successes.

The previous head's Heavy Lint Policy job 116265896324 failed with inherited
rule-parity, inline-schema and oxlint findings. Main repair #1819 owns that red;
#1818 owns the separate coverage remeasurement episode. Both were open at this
observation. Do not duplicate their changes or lower floors in this readiness
lane. Adopt the landed canonical repairs, rerun normal publication without
waivers, then synchronize the worker again while preserving its eight overlays.
The worker and PR remain at the published 0f5bf3d896 head until that next wave.

## Canonical repairs landed

The follow-up verified #1819 merged as `f4fa9e090c97dbedde4e058f3347e303a6058ac9`
and #1818 merged as `c7850780b8fc625aaca53ed3ed4582a7e07aad7a`.
The readiness branch integrates that main tip without duplicating the owners'
repairs. The coverage baseline changes are main-owned; this readiness delta adds
no coverage waiver or baseline edit. Main also replaces monolithic catalogs with
per-package shards. Generated observability conflicts are resolved by starting
with canonical main outputs and rerunning `beep observability catalog --write`.

After frozen installation, the focused five-file suite passes 394 tests on the
integrated source. Publication and hosted qualification still bind to the next
committed head, not the earlier 5/5 reviewed head. A new verified eight-file
worker backup was made at
`~/.cache/beep/readiness/pr1750/worker-before-landed-repairs/`; its previous
source is `0f5bf3d896024a691abe16cd3d68a258f6a173f8`. Separate worker main remains
`b43a4098bbdc345f897c87f84f58953cb7fd4825`. These observations precede the next
publication and worker synchronization; neither is claimed complete here.

The sharded schema catalog separately passed `beep lint schema-catalog`
(7,980 entries in 141 shards); no schema-catalog rewrite was needed for the
readiness delta. The integrated main merge was committed as `1818e6389508`.
The prior unpublished `7576533cae` merge remains in its ancestry.
