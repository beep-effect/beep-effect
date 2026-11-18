# Scaffolder design (P1 step 2)

Written 2026-11-18 by the session that ran P1 step 1. The doctrine is
`standards/ARCHITECTURE.md`, "Model-First Slice Topology" (PR #3391). This file
fixes what `bun run beep architecture` generates for a model-first context; the
implementation follows it. Decision numbers cite
`explorations/model-first-slices/DECISIONS.md`.

## What exists

`packages/tooling/tool/cli/src/commands/Architecture/` plans a seven-role slice
by retargeting accepted proof files from `packages/architecture-lab`
(`internal/AcceptedProofManifest.ts`, `internal/TemplateRetarget.ts`) and
writes package shells from inline templates (`internal/PackageShell.ts`). Plans
are decoded `CanonicalSliceOperationPlan` values
(`architecture-operation-plan/v1`) applied and checked by
`OperationPlanExecution.ts`. Tests:
`packages/tooling/tool/cli/test/architecture-operation-plan.test.ts`.

No four-package slice exists in the repo, so there is no accepted proof to
retarget. The model-first plan renders inline templates, ported from the
prototype (`scratchpad/model-first-slices/authority/*`,
`scratchpad/model-first-slices/shared/contract-kit/`), which stays a porting
source and is never imported.

## Decided

1. **Command surface.** `bun run beep architecture create context <context>
   <Module>` plans and writes a model-first context. `plan`, `apply` and `check`
   accept `--shape model-first|legacy`. As built (PR #3394), a bare `plan` is
   the legacy lab plan; `plan` resolves to model-first for `--shape model-first`
   or an explicit `--slice` and `--concept`, and `apply`/`check` take the shape
   from the plan's roles. The seven-role
   commands (`create slice`, `create package`, `add concept`, `add role`) stay
   and are labelled legacy in their help; they keep working unchanged for
   legacy slices.
2. **Roles.** `ArchitectureSliceRole` gains `contract`, `model`, `host` and
   `web`; a new `ArchitectureContextRole` LiteralKit names the four. The plan
   schema stays `architecture-operation-plan/v1`; a plan's roles say which shape
   it is.
3. **Packages.** `@beep/<context>-contract`, `-model`, `-host` under
   `packages/<context>/{contract,model,host}`, each bootstrapped through the
   same shell machinery `bun run beep create-package` uses (manifest scripts
   block, tsconfig overlays, identity registration, per-package `turbo.json`).
   Exact exports: one `exports` entry per entry point, no `./*`.
4. **`web` is not generated in this step.** Generated bindings need the
   bindings generator, which is NET-NEW in `product-slice-model-first`. A
   context gets a web package when that lands.
5. **The contract kit** (`Catalog.make`, `waitsOnProjection`) is ported into a
   new foundation package, `@beep/contract-kit` at
   `packages/foundation/modeling/contract-kit`, created with
   `bun run beep create-package`. It is product-neutral substrate over
   `@alchemy.run/domain`, which the doctrine lists apart from the shared kernel.
   It is deleted when upstream splits the Api from the model (D9).
6. **Generated files** for `create context notes Note`:

   ```txt
   packages/notes/contract/src/Note/Note.id.ts
   packages/notes/contract/src/Note/CreateNote.command.ts        command, NoteCreated event, private rejection
   packages/notes/contract/src/Note/NoteSummary.read.ts          view read contract
   packages/notes/contract/src/Notes.catalog.ts
   packages/notes/contract/src/NotesApi.contract.ts
   packages/notes/contract/test/Contract.imports.test.ts
   packages/notes/model/src/Note/Note.aggregate.ts
   packages/notes/model/src/Note/NoteSummary.view.ts
   packages/notes/model/src/Note/NoteSummary.handler.ts
   packages/notes/model/src/Notes.model.ts
   packages/notes/model/src/Notes.handlers.ts                    generated header; drift check lands in step 4
   packages/notes/model/src/Notes.ports.ts                       ports union (empty) and the purity assertion
   packages/notes/model/src/NotesApi.api.ts
   packages/notes/model/test/Notes.story.test.ts                 runs on Domain.InMemory
   packages/notes/model/test/NotesApi.parity.test.ts
   packages/notes/host/src/Adapters.ts                           Layer.empty: no ports yet
   packages/notes/host/src/Host.ts                               hosts the Model on a given platform
   ```

   The host's `<Context>.cluster.ts` and `<Context>.descriptor.ts` are not
   generated yet: the descriptor schema belongs to the kernel and the cluster
   wiring to `goals/effect-cluster-host`. The host gains them when that goal
   lands.
7. **No kernel dependency.** The generated context imports no `Invocation`,
   provenance or capability types: those arrive with `goals/authority-context`.
   The generated command carries no provenance until then.
8. **Proof.** A test generates a throwaway context and proves it: the plan has
   exactly the files above with exact exports; the generated sources
   type-check under the repo's Effect build (`tsrs`) with no diagnostics; the
   generated story test and parity test pass. The legacy plan's existing tests
   stay green unchanged.

## Gates the implementation must pass

- `bun run beep quality package-verify @beep/repo-cli` and
  `@beep/contract-kit`.
- Effect v4 only, validated against `.repos/effect`; `@alchemy.run/domain` at
  the pinned 2.0.0-beta.87 API; generated code follows the repo's code laws
  (schema-first, `LiteralKit`, `$I` identity annotations, `Effect.fn`, no
  native `Map`/`Set`, JSDoc `**Example** (Title)` sections).
