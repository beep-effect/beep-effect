# Box Typecheck Cost — Plan

Phases are gated: P2's measurement decides whether P3/P4 are ever built.
`SPEC.md` is the authoritative contract; this file is the execution path.

> **Outcome (2026-08-01).** P1, P2, and P5 are complete. **P2 met budget, so P3
> and P4 were never built** and are retained as designed-but-unbuilt. Package
> instantiations fell 7,472,755 → 2,503,112 (−66.5%). The per-file budget was
> amended mid-flight after measuring the import floor — see `SPEC.md` §D4.

## P0 — Packet Bootstrap (complete)

Decision document authored from a `/grill-with-docs` session. All design
branches closed.

## P1 — Baseline Measurement

Record the pre-change numbers so the reduction is provable, not asserted.

1. Measure `Box.models.gen.ts` in isolation via the `SPEC.md` §1 method.
2. Measure the whole package the same way (`"include": ["src"]`, no `files`).
3. Write both to `research/measurements.md` with TS version, tsgo version, and
   the exact tsconfig used.

Exit: baseline numbers committed. Expected ~4.8M file / ~7.3M package.

## P2 — Prune (lever 1)

The only lever committed up front.

1. Add `packages/drivers/box/scripts/box.surface.ts` exporting the manager
   allowlist (9 managers, `SPEC.md` §D1). Keep it a plain sorted literal list
   with a comment naming each manager's demand source.
2. In `scripts/generate.ts`:
   - Filter `collectManagerProperties` output by the allowlist.
   - Scan the driver's own hand-written `src/**/*.ts` (excluding `_generated/`)
     for `M.<Identifier>` references to collect extra model roots.
   - Compute the transitive model closure from kept payload/success schema
     expressions plus those extra roots, following `S.suspend(() => X)`
     references and `.extend` base names. Emit only declarations in the closure.
   - Log dropped managers and dropped model counts — no silent caps, matching
     the existing `exclude-deprecated` logging discipline.
3. `bun run generate`.
4. Typecheck `@beep/box`, `@beep/documents-server`, and
   `apps/professional-desktop` with no source edits outside the driver.
5. Re-measure via P1's method; append to `research/measurements.md`.

Exit gate:

- Under budget → **skip to P5**. P3 and P4 stay designed-but-unbuilt.
  (The file half of this gate was originally "≤1.5M absolute" and was amended
  during P2 to "≤750K marginal" once the import floor was measured — see
  `SPEC.md` §D4. The package half, ≤3M absolute, was unchanged.)
- Over budget → proceed to P3.

## P3 — Explicit Type Annotations (lever 2) — NOT BUILT

P2 met budget, so this lever was never fired. Retained as the pre-agreed next
step if a future manifest addition pushes marginal cost past 750K.

Extend the return-type-caps-inference mechanism already proven by
`withCodecStatics` from const wrappers to `S.Class` declarations: have the
generator emit explicit type annotations for schema exports
(interface-extraction pattern), so the checker stops inferring struct field
types it can be told.

Design risk to resolve first: `S.Class` schemas are opaque and double as their
decoded-side type, so the extracted interface must not break
`typeof X.Type`, `X.extend<X>()` chains, or the `declare namespace X { Encoded }`
convention. Prototype on one manager before generating all of them.

Re-measure after. Exit gate identical to P2's.

## P4 — Per-Manager Split (lever 3) — NOT BUILT

Never reached. If it is ever revisited, the premise below must be validated
first: a split redistributes mass rather than reducing it.

1. **Validation first**: mechanically half-split the generated file (throwaway,
   not committed) and re-measure. If total instantiations do not move, the split
   is a wall-clock lever only — record that and decide whether wall-clock alone
   justifies it.
2. If proceeding: emit one file per manager plus a shared models file for the
   closure. The 2,957 `S.suspend` cross-references are already lazy and
   split-safe; the 27 `.extend` chains constrain ordering — base classes must
   precede subclasses or live in the shared file.
3. Keep `src/Box.models.ts` re-exporting the same public surface so
   `@beep/box` consumers see no change.

## P5 — Documentation & Closeout

1. `packages/drivers/box/README.md`: document the manifest, the regrow
   procedure (edit manifest → `bun run generate` → re-measure), and the
   re-measurement obligation on manifest edits.
2. Add the supersede note to `goals/box-driver/README.md` and its
   `ops/manifest.json` so its "full-surface" mission does not read as current.
3. Flip this packet's lifecycle and land the closeout reflection **in the same
   PR** as the final work, per repo law.
4. Ship via `bun run beep yeet` (repair → verify → publish → monitor).
