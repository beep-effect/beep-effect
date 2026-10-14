# Sources and provenance

- Lane envelope: explicit `@beep/repo-utils` target and orchestrator-owned delivery.
- `AGENTS.md`: Effect/schema/import laws, package verification and friction receipts.
- `standards/ARCHITECTURE.md`: tooling library role vocabulary and explicit package boundary.
- `docs/runbooks/typescript-toolchain.md` and `goals/tsc-rs-gates/SPEC.md`:
  tsc-rs 0.6.0 owns check/build; @effect/tsgo 0.51.1 owns Go tooling/editors.
- Installed `@typescript/native` 7.0.2 declarations:
  `dist/api/sync/api.d.ts`, `dist/api/options.d.ts`, `dist/api/proto.d.ts`,
  `dist/api/sync/types.d.ts`, and `dist/ast/{ast,is.generated,clone,scanner}.d.ts`.
- Installed syncChannel implementation: Node private stdio handles are required.
- Installed Effect v4 declarations: Schema constructor defaults, Context.Service,
  Layer.effect, Effect.acquireRelease/fromOption/addFinalizer and HashMap operations.
- `tools/tsgo-shim/tsgo.js`: canonical Effect compiler artifact resolution route.
- Existing TSMorph/FsUtils modules: package identity, schema annotations and service style.
- Original facet-census at the base revision: output comparison baseline; the temporary
  classic source copy was removed after execution. Detached stdout matches exactly.
- Existing scratchpad effected runner already uses Node Vitest.

The unstable APIs remain an upgrade review surface. No external quota or paid
research was used. Deleted scripts are recoverable from the branch base in git.
