# /goal: Box Typecheck Cost

Repo: `/home/elpresidank/YeeBois/projects/beep-effect3`.

Mission: bring `@beep/box` (`packages/drivers/box`) under an explicit type
instantiation budget by scoping its generated SDK surface to declared demand.

`src/_generated/Box.models.gen.ts` costs ~4.8M instantiations; the package costs
~7.3M and periodically exposes the TS2589 native-compiler flake. The generator
wraps 85 managers / 333 methods; repo demand is 9 managers.

This is a compact `/goal` launcher. The contract lives in the packet:

- `goals/box-typecheck-cost/SPEC.md` — the decision document (authoritative)
- `goals/box-typecheck-cost/PLAN.md` — phased path with gates
- `goals/box-typecheck-cost/README.md` — status and decisions at a glance
- `goals/box-typecheck-cost/ops/manifest.json` — machine-readable state

Read those first, then `CLAUDE.md`, `standards/ARCHITECTURE.md`,
`standards/architecture/03-driver-boundaries.md`, and `goals/box-driver/` for
the completed driver's 10 locked decisions (all of which still bind).

Load/use: `$effect-first-development`, `$schema-first-development`,
`$jsdoc-annotation-specialist`, `$yeet`.

## Locked decisions (see `ops/manifest.json keyDecisions`)

1. **D1** Coverage is demand-scoped. Allowlist: `avatars`, `chunkedUploads`,
   `downloads`, `events`, `files`, `folders`, `uploads`, `users`,
   `zipDownloads`. Strictly demand-only — nothing speculative.
2. **D2** Manifest lives at `packages/drivers/box/scripts/box.surface.ts`. Model
   roots come from scanning the driver's own `src/` for `M.*` refs plus the
   transitive closure. **Never scan product code** — that would make the driver
   product-aware.
3. **D3** A missing manager is a compile error. No catch-all surface.
4. **D4** Budget: ≤750K *marginal* instantiations per generated file (total
   minus the ~1.65M schema-import floor), ≤3M absolute package-wide. Levers
   staged — prune, then annotations, then split. Fire the next only on a budget
   miss. *(Amended during P2: the original "≤1.5M absolute" per-file threshold
   sat below the import floor and was unachievable by construction. See
   `SPEC.md` §D4.)*
5. **D5** Budget is a documented ritual triggered by manifest edits, not CI.
6. **D6** `@beep/ui` is out of scope.

## Critical constraints

- **Splitting the file does not reduce total instantiations** — it redistributes
  them. Do not lead with a split. See SPEC §4.
- **Do not remove `withCodecStatics` or `$I.annoteSchema`.** Both measured as
  dead ends (≤2.4%), and removing statics *increases* instantiations 41% because
  the explicit wrapper return type caps inference.
- **Measurement gotcha**: `files` does not clear an inherited `include`. Use
  `"include": []` or the measurement silently covers the whole package.
- Do not hand-write models or operations — `generate-from-sdk-types` binds.
- Do not change generated schema fidelity — `pragmatic-generated-fidelity` binds.

## Stop conditions

- Stop and report if the post-prune measurement is over budget — P3 is a
  conditional phase requiring a design pass on `S.Class` annotation extraction,
  not an automatic continuation.
- Stop if pruning breaks `packages/documents/server` or
  `apps/professional-desktop` typechecks in a way that needs edits **outside**
  the driver. That means the demand analysis was wrong; re-derive it.
