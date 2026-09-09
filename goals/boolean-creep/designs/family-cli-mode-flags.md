# Family design — CLI mode flags

## 2026-09-03 drift refresh

Rechecked the historical family records against current `main`. The seven live
records still have their original mode guards/chains, and the shared
`RunMode.ts` target remains reusable. Withdrawn parameter-only records and
retired source shapes are no longer family consumers. Post-design changes in
Docgen, Runners tests, and Skills shifted line anchors or added orthogonal
behavior. The live mode taxonomies remain unchanged. Current anchors for the
affected sections are:

- Docgen local: options at `Local.ts:141-150`, implication guard and output
  selection at `Local.ts:1364-1380`, CLI adapter at
  `Docgen.command.ts:531-541`, direct test fixture at `docgen.test.ts:1068`.
- Skills: existing literal at `Skills.command.ts:41`, resolver at lines
  879-893, application options at lines 908-912, CLI adapter at lines 988-990.
- Explore Atlas: flags at `Explore/Atlas.ts:739-746`, conflict and
  write/check/print dispatch at lines 766-795. It reuses the same
  `PrintWriteCheckMode` as Goals and Fallow.

These anchors supersede older line numbers in the affected subsections. The
family design still preserves CLI spellings at the parser boundary and
collapses them once before application code. No implementation is authorized
until GATE 2 passes.

## Shared family design

The seven live records are internal command-adapter shapes. The public CLI spellings remain stable: callers may continue to use `--plan`, `--check`, `--write`, `--dry-run`, `--json`, `--all`, and `--changed-files` exactly as today. Boolean values may exist only as the immediate output of Effect's CLI parser. Each command adapter must collapse them once into a schema-owned literal before calling application code; no application options type may carry sibling mode booleans.

The live shared implementation is
`packages/tooling/tool/cli/src/internal/cli/RunMode.ts:26-203`.
`resolveRunMode` already supports both data-first and data-last invocation via
`dual(2, ...)`; preserve both forms exactly. Generalize that same export only
as far as the command families require. Do not replace it with a data-first
function plus alias: that would silently remove the shipped curried form.
`resolveBakeMode` is a never-shipped public export with no repository consumer
outside its owning command/tests; remove that export in the atomic Runners
migration rather than creating a deprecation alias. The family extension is:

```ts
import { $RepoCliId } from "@beep/identity/packages"
import { LiteralKit } from "@beep/schema"
import { A, O, P, pipe } from "@beep/utils"
import { Effect } from "effect"
import { dual } from "effect/Function"

const $I = $RepoCliId.create("internal/cli/RunMode")

const RunModeKit = LiteralKit(["check", "write", "dry-run"])
const WriteCheckRunModeKit = LiteralKit(RunModeKit.pickOptions(["check", "write"]))
const PrintWriteCheckModeKit = LiteralKit(["print", "write", "check"])

export const WriteCheckRunMode = WriteCheckRunModeKit.pipe(
  $I.annoteSchema("WriteCheckRunMode", {
    description: "Generated-file execution mode that either verifies or writes the projection.",
  })
)
export type WriteCheckRunMode = typeof WriteCheckRunMode.Type
export const WriteCheckRunModeIs = WriteCheckRunModeKit.is

export const PrintWriteCheckMode = PrintWriteCheckModeKit.pipe(
  $I.annoteSchema("PrintWriteCheckMode", {
    description: "Command mode that prints, writes, or verifies a generated projection.",
  })
)
export type PrintWriteCheckMode = typeof PrintWriteCheckMode.Type
export const PrintWriteCheckModeMatch = PrintWriteCheckModeKit.$match

export const resolveRunMode: {
  <Mode>(candidates: ReadonlyArray<readonly [enabled: boolean, mode: Mode]>, fallback: Mode): Mode
  <Mode>(fallback: Mode): (candidates: ReadonlyArray<readonly [enabled: boolean, mode: Mode]>) => Mode
} = dual(
  2,
  <Mode>(candidates: ReadonlyArray<readonly [enabled: boolean, mode: Mode]>, fallback: Mode): Mode =>
    pipe(
      candidates,
      A.map(([enabled, mode]) => pipe(enabled, O.liftPredicate(P.isTruthy), O.as(mode))),
      O.firstSomeOf,
      O.getOrElse(() => fallback)
    )
)

export const resolveExclusiveRunModeFromFlags = <Mode, E, R>(
  first: readonly [enabled: boolean, mode: Mode],
  second: readonly [enabled: boolean, mode: Mode],
  fallback: Mode,
  onConflict: Effect.Effect<never, E, R>
): Effect.Effect<Mode, E, R> =>
  runModeFlagsConflict(first[0], second[0])
    ? onConflict
    : Effect.succeed(resolveRunMode([first, second], fallback))
```

`runModeFlagsConflict` remains the single compatibility-boundary check for two
legacy boolean switches. The new honest literal type deletes each command's
duplicate coherence guard; the shared adapter check is not domain state and
must not escape the CLI layer. `resolveRunMode` remains precedence-based for
`tsconfig-sync`, whose current behavior deliberately accepts combined flags
and selects `check`, then `dry-run`, then `sync`.

Effect v4 validation: the required `.repos/effect` checkout is present and was
checked at `packages/effect/src/unstable/cli/Flag.ts:156-182,1001-1020` and
`Param.ts:545-579`. `Flag.choice(name, options)` parses one valued flag directly
to a literal, while `Flag.orElse` composes alternative parsers rather than
collapsing two independently accepted legacy boolean spellings. Replacing the
existing spellings with `--mode <literal>` would be a breaking CLI change and
is not part of this campaign.

Landing order: extend `RunMode.ts` and `cli-kits.test.ts` in the same batch,
proving both invocation forms, then migrate command adapters atomically. Remove
the `resolveBakeMode` barrel export and its public-export test imports in that
same batch; keep the command-specific conflict error at the Runners adapter
before constructing its literal mode.

## Per-instance review surfaces

The shared design is consumed by seven exact one-per-inventory review files:

- [runners-bake-cli-mode](./runners-bake-cli-mode.md)
- [docgen-local-json-requires-plan](./docgen-local-json-requires-plan.md)
- [tsconfig-sync-mode-flags](./tsconfig-sync-mode-flags.md)
- [fallow-boundaries-mode](./fallow-boundaries-mode.md)
- [sync-data-to-ts-run-mode](./sync-data-to-ts-run-mode.md)
- [explore-atlas-mode](./explore-atlas-mode.md)
