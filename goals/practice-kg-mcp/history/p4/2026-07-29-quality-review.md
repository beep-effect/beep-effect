# P4 evidence — crispen pass + quality-review loop over the packet surface

Date: 2026-07-29 · Phase: P4 Distribution (pre-handoff hardening) · Scope:
`/crispen full` refactor of the packet code surface followed by a
quality-review-fix loop (10-role read-only reviewer panel), before re-staging
the Tom handoff `.mcpb`.

## Crispen pass (baseline commit 0c516ff879)

- `PracticeKgEpistemicStatus` / `PracticeKgProvenanceKind` moved to
  `law-practice/domain` values; tool rows now carry real literal domains
  (`epistemic_status`, `kind`, `provenanceKind` were `S.String` /
  `S.NonEmptyString`), with the two synthetic bundle-status members admitted
  through a named union rather than widening the domain kits.
- Schema defaults absorbed: `maxTextBytes` (PosInt, 2 MiB key default —
  replaces a deleted runtime `<= 0` guard), `corpus_get_document` range,
  node/edge `epistemicStatus` constructor default (spine-writers-only
  invariant recorded inline), dual `resolveBundleOut` static as the single
  home of the bundle path default.
- Helper walls deleted: `nullable()`, five byte-identical record mappers →
  `toToolRecord`, imperative tier loop → `A.findFirst` fold, claims
  split-on-";" DDL → statement array, two double-scans → `A.partition`,
  structural `GraphTextSourceSpec` bypass (now exported, `$I` identifiers),
  `.mcpb` manifest via `JSON.stringify` with compile-time tool-description
  coverage.
- Freeze proofs: regression suite green with fixtures untouched; live stdio
  probe against the staged real bundle returned identical shapes, labels,
  tiers, and the email linkage note across 6 tools; `bundle_version` and
  schema versions unchanged (staged 397 MB bundle needs no rebuild).

## Reviewer panel (round 1, 10 roles, read-only)

Result: **26 findings, 0 blocking** — zero-gate passed first round.
Breakdown: 12 non-blocking, 11 notes, 3 questions; all P3-low.

Fixed same-branch (post-baseline commit):

- stale `bundleOut is the only optional key` remark; missing default-behavior
  remarks on node/edge rows (documentation-api-001/-002)
- `kg_find` LIKE pattern now routed through `likePattern` (reuse-duplication)
- raw `candidate-unreviewed` literals → `PracticeKgEpistemicStatus.Enum`
  accessors in tool-handlers (effect-law-002)
- duplicated `withConstantDefault` pipe → shared `spineEpistemicStatus`
  (reuse-duplication)
- schema-absorbed defaults pinned by test (maxTextBytes make+decode 2_097_152;
  tool-result literal-domain rejection) (testing)

Answered questions: the packet-close state flips + reflection are NOT this
PR — they land in the P5 closeout PR per plan, gated on AC-4/AC-5/AC-6
observations (quality-gate-001, evolution-deprecation-002).

## Backlog (P3-low, accepted for now)

- `--max-text-bytes 0` on the workstation build CLI dies as a PosInt brand
  defect instead of a typed CLI error (workstation-only tooling; Tom's machine
  never runs builds).
- `.mcpb` `manifestFor` uses `JSON.stringify` rather than a schema JSON codec
  (EF-3 advisory; replaced a worse hand-built template string).
- Server re-export of the moved literal kits is a transitional-compatibility
  shim with no in-repo consumers — delete after handoff freeze lifts (record
  carried to closeout).
- 2 MiB constant exists in two semantically distinct homes (build text cap vs
  read-range length); left unlinked deliberately.
