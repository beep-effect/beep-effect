# Design citation refresh for main `52fcc8d`

## Scope and source

This handoff refreshes the already-qualified designs assigned by
`design-refresh-2026-09-09-main-52fcc8d-impact.md` against exact checkout
`3330f9881a50c96d3f2ec0fcad76f0f7a09027e4` and corpus source
`52fcc8d1353db9481ef9edb6cc9619500f95568d`.

The review used the live merged source, immutable old/new Git objects, complete
design reads, targeted caller searches, and direct inspection of every
merge-impact seam. It did not change target behavior, source, tests, canonical
inventory, status, dependencies, generated files, or Git state.

The following withdrawn or separately audited designs were excluded and were
not recreated or edited:

- `r3-tooling-quality-repo-wide-step-gates`
- `r3-tooling-architecture-export-subpath-kind`
- `r3-tooling-docgen-quality-companion-kinds`
- `r3-tooling-schema-first-tagged-error-factory-kind`
- `r3-tooling-codegen-source-test-filename`
- `r3-tooling-coverage-scope-input-kind`
- `r3-tooling-quality-root-audit-head-kind`
- `r3-tooling-docgen-local-full-reason-input-kind`
- `r3-tooling-inline-schema-compile-arg-kind`
- `r3-tooling-manual-runtime-receiver-kind`
- `runners-bake-freshness`

## Refreshed designs

All 36 owned designs now identify the exact merged checkout and corpus source:

- `drivers-migration-journal-shape-row`
- `create-package-template-type-flags`
- `create-package-template-app-kind-flags`
- `venice-sse-done-payload`
- `corpus-legacy-word-terminal`
- `goals-repair-fork-mode`
- `goals-migrate-conventions-mode`
- `html-select-child-grammar`
- `html-dl-child-grammar`
- `html-img-sizes-disposition`
- `html-link-imagesizes-disposition`
- `scheduler-promotion-tick-origin`
- `scheduler-admission-attempt-origin`
- `scheduler-protocol-eviction-mode`
- `coverage-baseline-write-mode`
- `yeet-prepared-publish-commit`
- `citation-blank-page`
- `corpus-pst-terminal`
- `ci-lane-timings-render-mode`
- `goals-packet-snapshot-presence`
- `worktree-idle-reading`
- `worktree-pr-classification`
- `worktree-reap-candidate-retirement`
- `receipt-fallback-draft-occupancy`
- `jsdoc-fence-state`
- `r26-apps-sidecar-ipc-ready-latch`
- `r26-cli-commands-l-q-allowlist-check-ok`
- `r26-cli-commands-l-q-osv-ignore-expiry`
- `r26-cli-commands-d-k-docgen-quality-command-scope`
- `docgen-proof-manifest-verification-reason`
- `docgen-worker-packet-review`
- `package-inventory-docgen-coverage`
- `r26-cli-commands-d-k-goals-index-command-mode`
- `goals-packet-migration-kind`
- `r2-tooling-packet-transition-stream-trace`
- `codex-findings-packet-commit-kind`

## Concrete citation corrections

The changed-source citations were moved to the live declaration, writer,
consumer, and test lines. Material corrections include:

- Postgres migration-journal owner `348 -> 349`, SQL/decoder reads at
  `452-468`, and the ordered result handling at `473-476`.
- CreatePackage `TemplateContext` owner `728 -> 732`, required fields at
  `736-753`, sole constructor at `1477-1502`, render handoff at `1507-1511`,
  and scaffold tests at current `700`, `763`, `842`, and `942` anchors.
- Venice event owner `648 -> 649`, parser writer at `1894-1907`, and terminal
  write at `1900`; the language-model adapter and Venice fixtures were also
  rechecked and remain on their cited lines.
- Restoration-transformations shifts of six lines across PST and legacy Word,
  including PST owner `1362 -> 1368`, legacy owner `3277 -> 3283`, all named
  and anonymous returns, mail/loop consumers, and every listed coverage fixture
  shift of two lines.
- Goals migration-command shifts of two lines: repair owner `103 -> 105`,
  migrate owner `617 -> 619`, command carriers at `126-139` and `640-666`,
  exact-one resolver `54-61`, and apply/report ranges through `608`.
- HTML conformance owner and consumer shifts: select `1912 -> 1916`,
  description list `1787 -> 1791`, image flags/issues `987-1021`, and link
  flags/issues `1033-1060`. The corresponding HTML coverage/hardening tests now
  cite their current lines.
- Scheduler protocol owner `3407 -> 3411` and conflict/dispatch `3421-3432`.
  Promotion retains its unchanged owner and writer, while the new exported
  testing seam at `QualityScheduler.ts:1806-1821` moves the wait loop to
  `1823-1862`; the decisive admitted read is now line `1851`. All scheduler
  test ranges after the insertion were advanced by 44 lines.
- Coverage owner `251 -> 252`, validation `654-668`, downstream planning and
  execution ranges through `2953`, and the four grouped quality-test ranges at
  `2910-2967`, `3849-3917`, `4470-4554`, and `4947-5081`.
- Yeet prepared commit owner `757 -> 760`, producer/reader ranges, and current
  test ranges `3650-3680` and `4124-4229`.
- Citation test construction moved from `571-580,650-674` to
  `626-635,705-729`; all related LawPractice migration fixtures were moved to
  `472-592,594-703,705-730,738-741`.
- Goals packet snapshot writer is now `Adopt.ts:173-174`; its downstream plan
  consumers are `221-241,296-342,426-442`, and tests are
  `184-260,322-395,577`.
- Worktree Reap shifts of two lines were applied to idle, PR classification,
  and retirement writer/reader ranges, including current `532-584` cleanup
  handling.
- Receipt draft occupancy is now declared/read at `Chat.atoms.ts:1019-1033`,
  selected at `1031-1033`, and restored at `1048-1050`.
- Docgen CLI test anchors were refreshed, including changed-files coverage at
  `2955-3012`, packet-limit coverage at `3714-3764`, and proof-manifest JSON at
  `3930-3957`.

## Semantic verification

No target behavior or cardinality changed in this refresh. The compiler-hoist
range moves decoders/guards without changing the supported states, defaults,
error precedence, encoded shape, or operation ordering described by the owned
designs.

Two delta-specific checks received more than a header replacement:

1. `scheduler-promotion-tick-origin` now explicitly preserves the inserted
   `noteAdmissionWaitForTesting` export at lines `1806-1821` and cites the
   shifted wait loop. The seam does not add a `PromotionTick` writer or state.
2. `jsdoc-fence-state` retains the owner at lines `41-54` and all three live
   readers. The hoisted `isJSDocSectionName` guard is now at line `300`, with
   the section parser at `420-447`; it does not read or extend the fence tuple.
   The design records that downstream parser range so future implementation
   does not confuse the one-line hoist with a fence-state change.

The defining sources for sidecar IPC, allowlist checking, OSV ignore expiry,
Docgen worker/coverage/proof state, Goals index/migration state, packet trace,
and Codex findings were source-identical at their owner seams. Their complete
caller graphs and any citations in changed wrapper/test files were rechecked.
Stale prose directing a future refresh to `52fcc8d` was replaced with the
completed verification fact.

## Upstream qualification

A later fetched main advanced beyond the assigned corpus, but that later delta
contains no owned source file from this refresh. This handoff deliberately
records the exact assigned, merged source above; the parent integration lane
owns the subsequent no-impact source acknowledgment.

## Validation

- `mise exec bun@1.4.2 -- bun goals/boolean-creep/ops/validate-designs.ts`:
  `design coverage OK: 162 qualified ids`.
- Scoped `git diff --check` over the 36 designs and this handoff: clean.
- Scoped SHA audit: all 36 designs contain exact checkout `3330f9881a` and
  corpus `52fcc8d135`, with no prior `05405bf`, `7440cb8c`, `be8995e6`, or
  `9b7553f6` source marker remaining.
