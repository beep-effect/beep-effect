# Opportunities and friction ledger

Receipts recorded during execution, per the repository friction-capture law.

## 2026-08-27: P1 implementation

### Large checked class schemas need an explicit declaration pattern

- **What happened:** adding the durable attempt record as an inferred checked
  `S.Class` passed `tsgo` but failed `tsc` declaration emit with `TS7056`. The
  compiler could not serialize the inferred type. Splitting the fields into an
  explicit `S.Struct` field map and assigning the class base an explicit
  `S.Class<Self, S.Struct<Fields>, {}>` type fixed the build without weakening
  the checks.
- **Evidence:** `bun run beep:build` in `@beep/langextract` failed at
  `VerifiedSpanAttemptRecordStruct`, then passed after the explicit field-map
  change. The repository had one usable precedent in `IrToLaw.ports.ts`, but
  the schema-first skill did not name this declaration-emit failure mode.
- **Prevention:** add a checked-class example to the schema-first skill that
  shows the explicit field-map and class-base pattern for public schemas large
  enough to trigger `TS7056`.

### Scoped docgen can fail on unchanged downstream metadata

- **What happened:** `bun run docgen:local` selected `@beep/langextract` and
  `@beep/provenance`, expanded through downstream packages, and failed on the
  unchanged `dispatchTurnWithConfirm` export in `professional-desktop` because
  `@category actions` is not registered. Direct package docgen then passed for
  both changed packages, with 21 provenance examples and 83 langextract
  examples.
- **Evidence:** the scoped run reported `Composer.atoms.ts:206
  dispatchTurnWithConfirm invalid category`; `git diff --exit-code origin/main
  -- apps/professional-desktop/src/chat/ui/Composer.atoms.ts` passed, and the
  same category is present on `origin/main`.
- **Prevention:** when a downstream docgen failure is byte-identical to the
  merge base, report it as inherited and continue checking changed packages.
  The final full proof should still decide whether the branch may publish.
