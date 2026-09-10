# CLI design refresh — 2026-09-08

Source reviewed: packet HEAD `05405bf322da0ca7eb88b8bb402145081e8fded6`;
the inspected `packages/**/src` and `apps/**/src` corpus matches
`origin/main` at `be8995e66aeefedf0dabf131deaeaaf25c8e6fc8`.

## Owned designs

- `designs/create-package-template-type-flags.md` — corrected all source and
  test lines, confirmed the existing `PackageType` LiteralKit is the sole
  replacement, recorded the sole writer and zero readers, removed an
  unnecessary template-test claim, and made the paired app-kind sequencing,
  guard deletion, encoded behavior, and barrel impact explicit.
- `designs/create-package-template-app-kind-flags.md` — corrected source and
  test lines, confirmed `AppKind` and its upstream `Option` are reusable,
  distinguished the two real template readers from the four zero-reader
  projections, retained the two legitimate `appKindIs` consumers, specified
  the decoded Option plus plain Handlebars handoff, and corrected labs as
  constructor coverage rather than direct template-branch coverage.
- `designs/worktree-removal-mode.md` — corrected the request declaration from
  stale line 294 to line 304 and the E4 guard from stale line 667 to lines
  686-695. Added the `Reap.service.ts` production writer, fenced request copy,
  complete test-writer inventory, wildcard facade behavior, current receipt
  presentation API, missing-target error precedence, and the safety-critical
  fence/residue/prune/branch compare-and-swap ordering.

## Verification

- Targeted exact symbol searches covered every declaration, writer, reader,
  template, test fixture, and package facade named by the three designs.
- `git diff` against corpus source SHA
  `be8995e66aeefedf0dabf131deaeaaf25c8e6fc8` found no source/test drift in the
  inspected CreatePackage and Worktree surfaces.
- `bun goals/boolean-creep/ops/validate-designs.ts` was run after the edits.

No source, inventory status, dependency, generated file, or Git reference was
changed. No design blocker remains. The separately owned canonical inventory
was reconciled to `Worktree.schemas.ts:304` with evidence at
`Worktree.service.ts:689`.
