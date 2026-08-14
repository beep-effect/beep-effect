# ship-velocity — friction & opportunity ledger

Record friction at the moment it happens (what you were doing, evidence, what would have
prevented it). Public repo: redact secrets, replace absolute home paths with `~`, drop
session/machine ids.

## 2026-08-13 — packet bootstrap

- The 9-lane fan-out's C1 archaeology lane was stopped before writing its narrative report; the
  distilled per-lane failure counts were recovered from its raw log into
  `research/c1-raw-failures.txt`. Prevention: fan-out lanes should write incremental partial
  reports, not single end-of-run files.
- `beep goals` has no scaffold/bootstrap subcommand (doctor/index/set-status only); this packet
  was hand-mirrored from ci-lane-economics. The `beep goals bootstrap` gap is already routed to
  knowledge-surface-automation Workstream E — this is a second live receipt for it.

## 2026-08-13 — this packet's own publish hit the treadmill it documents

- First `yeet publish` was refused stale-base: main advanced 3 commits during packet authoring
  and #699 touched `goals/INDEX.md` (the overlap path). Then git auto-merged INDEX plausibly but
  wrong — `beep goals index --write` post-merge corrected 2 lines the textual merge got past.
  Third receipt for the E1/E2 backlog items (publish-time regeneration + INDEX end-state); also
  a live demo of why auto-heal must regenerate, never trust textual merges of projections.
- Biome's pre-commit lane strict-parses staged `.json` research artifacts and its auto-fix
  mangled one raw model-output file; evidence files now land as fenced markdown. Prevention
  candidate: research/ artifact extensions exempt from code-parser lanes.
- Verify on this branch failed build/check with TS2307 on `@beep/shared-use-cases/PromotionGate`:
  the main merge moved `bun.lock` + subpath exports and no `bun install` followed — the known
  stale-node_modules phantom class, now with a fresh receipt. A failure capsule (A-track) should
  classify "lockfile/exports moved since last install" before blaming source.
- The same verdict's repair hint said "Inspect the OSV finding" while the OSV lane logged
  `No issues found` exit 0 — a live misattributed-composite-hint receipt (see
  `research/c7-opportunities.md` finding 3; capsule work must derive hints from the failing
  sublane, not the composite).
- Verify attempt on the third catch-up merge failed with no-location TS2589 in three unrelated
  packages (@beep/ui, @beep/box, @beep/xai) in one run — the environmental native-compiler flake
  class, live receipt for the SPEC's TS2589 class-aware arbitration item; the verdict again
  surfaced the misattributed OSV hint alongside it.
