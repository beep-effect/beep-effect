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

The hosted required Docgen check later failed on the same category. Because
that check gates this PR regardless of attribution, the review-fix slice
changes the inherited category to the registered `atoms` category and includes
the downstream workspace in the release metadata.

## 2026-08-27: P2 verification and publication recovery

### The full-proof coordinator needs a fair wait mode

- **What happened:** repeated `bun run beep yeet verify` attempts lost the
  coordinator race to sibling checkouts even though each retry began as soon as
  the previous owner exited. Eight sibling proof owners ran before this
  checkout acquired the lock.
- **Evidence:** every rejected attempt reported `Another Yeet full proof for
  this repository is active`; live PID and child-process checks confirmed that
  each recorded owner was still running. The first acquired proof then reached
  the branch gates and found the stale goals index.
- **Prevention:** add a FIFO wait option to Yeet so a checkout can register once
  and acquire the next available proof slot without polling or racing sibling
  processes.

### Publication intent must remain explicit across an interrupted session

- **What happened:** after a session interruption, the feature branch had
  advanced to a pushed commit that combined the initiative with local
  `.codex/**` tooling. No pull request existed. Recovering a clean PR required a
  new branch from `origin/main` and a staged replay of only the 13 initiative
  files.
- **Evidence:** `git diff origin/main...HEAD -- .codex` listed 12 unrelated
  paths on the pushed branch, while `bun run beep yeet status --remote`
  reported no pull request. The recovered branch has no `.codex` path in its
  staged diff.
- **Prevention:** persist a reviewed publish-intent path list before commit and
  reject any resumed commit or push whose path set exceeds that list.

### Base-policy changes can invalidate an already-proven feature diff

- **What happened:** after merging the newly landed Yeet scheduler commits from
  `origin/main`, the cheap gate rejected the otherwise unchanged feature diff
  because the current changeset policy classified `@beep/langextract` and
  `@beep/provenance` as versioned product workspaces.
- **Evidence:** `bun run beep yeet verify --tier cheap-gates` passed 11 of 12
  collected gates and failed only `quality:changeset-status`, naming those two
  workspaces as missing an in-range changeset.
- **Prevention:** after any required base catch-up, rerun cheap gates before
  entering the heavyweight admission queue and add release metadata while the
  implementation context is still current.

## 2026-08-28: Review-fix proof

### Concurrent filtered coverage lanes can erase Vitest temporary receipts

- **What happened:** a two-package filtered coverage command completed all 21
  provenance tests at 100% and all 81 langextract tests, then the langextract
  reporter failed because its temporary V8 receipt disappeared before report
  assembly.
- **Evidence:** `bun run coverage -- --filter=@beep/langextract
  --filter=@beep/provenance` reported `ENOENT .../langextract/coverage/.tmp/
  coverage-1.json` after the tests passed.
- **Prevention:** give each coverage lane an isolated temporary report path, or
  serialize filtered package coverage when another reviewer may be collecting
  the same package simultaneously.
