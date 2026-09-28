# Dock React assertion and minimum-size proof

The four test files now obtain Vitest utilities through `@effect/vitest`.
Three compound maximization predicates use `assertTrue` without dropping the
populated-workspace guard or Option predicate. Two drag-absence assertions use
`assertNone` with the original atom operand. AST conservation preserves all
112 original top-level assertions; no expected payload or Cause was invented.
The assertion-phase full package audit (8.2 s) and docgen (3.1 s) pass.

The saved minimum-size finding correctly identifies a missing shrink witness,
but its 32 px description follows a stale test title. Current production source
sets FLOATING_MIN_WIDTH to 240 and FLOATING_MIN_HEIGHT to 160. The test title
now names that actual contract. The original resize from 240x160 to 280x200
and its exact anchored-box assertion remain. A second gesture requests 20x16
through the same public adapter handle, awaits graph completion, and asserts
an exact 240x160 anchored box at the original position.

Temporarily removing only the production width clamp fails the new shrink
assertion; the old enlargement-only test passes. Independently removing only
the height clamp has the same outcome. All test and production control edits
were restored. No production behavior or minimum was changed. Full package
verification passes audit (8.2 s) and docgen (3.2 s).

These are configured jsdom adapter tests with synthetic pointer events; they
are not native browser pointer-capture or visual proof. Runner integration,
final timings and inventory reconciliation remain before package closeout.
