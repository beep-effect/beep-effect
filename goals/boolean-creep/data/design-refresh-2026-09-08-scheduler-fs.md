# Scheduler and filesystem design refresh — 2026-09-08

## Source baseline

- Exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- Corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- Correction input:
  `goals/boolean-creep/data/sweeps/refresh-2026-09-08-r25-main-9b7553/r25-cli-internal-root.jsonl`

## Designs written

- `goals/boolean-creep/designs/contained-file-read-outcome.md`
  - Confirmed three writer outcomes at `FsGuards.ts:700-713`: missing,
    existing without readable text, and existing with text.
  - Mapped every reader: Ack intentionally treats an unreadable existing
    receipt as acked with null content, while ProofLedger raises its existing
    exact unreadable-file error. The design preserves both behaviors and the
    no-follow/symlink typed-error path.
  - Kept the exported test-kit schema name and specified the three old legal
    `{ exists, contents }` encoded projections at the codec boundary.
- `goals/boolean-creep/designs/scheduler-admission-attempt-origin.md`
  - Confirmed origin-busy, rejected overshoot, and admitted payload outcomes at
    `QualityScheduler.ts:1585-1608`.
  - Specified one private generic tagged union owner with an opaque in-process
    `OriginLease` payload. The design preserves release-on-stage-error,
    explicit overshoot release, and ownership handoff to later finalizers.
- `goals/boolean-creep/designs/scheduler-promotion-tick-origin.md`
  - Reuses the admission outcome owner rather than defining a second union.
  - Keeps `PromotionTickInfo` independent and preserves the clock-before-scan
    snapshot, legacy same-origin detection, promotion journal transition and
    error release, masked promotion, restored sleep, refreshed wait clock,
    first progress publication, and sticky blocked-origin timestamp semantics
    at `QualityScheduler.ts:1737-1845`.
- `goals/boolean-creep/designs/tmpfs-dangling-stub-disposition.md`
  - Confirmed wrong-shape, wrong-contents, and exact outcomes at
    `TmpfsReap.ts:373-397`.
  - Preserved lazy content inspection, one-entry/non-symlink/regular-file/4096
    byte checks, exact skip-reason priority, initial and immediate pre-removal
    rediscovery, the independent second exact-content check, guarded
    non-recursive removal, and raced-content warnings.
  - Kept this local disposition separate from
    `r2-tooling-tmpfs-reap-classified-reaped.md`.

## Reuse and topology

Targeted searches covered live package source and the test barrels. Existing
`LiteralKit`, `S.toTaggedUnion`, and declared opaque-schema patterns are
available; no generic helper abstraction or public schema-role file is needed.
The scheduler union remains private in `QualityScheduler.ts`; the contained
read keeps its existing `@beep/repo-cli/test/Cli` exposure; the tmpfs literal
remains private in `TmpfsReap.ts`.

## Verification

- `bun goals/boolean-creep/ops/validate-designs.ts` was run after writing the
  four designs. It reached the global coverage check and reported one unrelated
  missing concurrent design: `designs/composer-shell-edit-content.md`.
- Scoped inspection confirmed only the four assigned design files and this
  handoff were created by this lane. No product source, tests, inventory,
  status, dependency, generated file, or git reference was changed.

## Remaining blocker

Global design validation cannot pass until the separately owned
`composer-shell-edit-content` design exists. The four designs in this handoff
have no known source-evidence blocker; formal P3 review remains parent-owned.
