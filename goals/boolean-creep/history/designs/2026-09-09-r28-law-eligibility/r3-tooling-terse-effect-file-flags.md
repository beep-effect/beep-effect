## Instance

- id: `r3-tooling-terse-effect-file-flags`
- source: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:628`
- symbol: `runTerseEffectRules.fileFlags`
- members: `fileTouched`, `fileMutated`, `fileHasBlockingCandidate`, `fileHasRewritableCandidate`
- evidence classes:
  - E3 — `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:653`: fileHasBlockingCandidate/fileHasRewritableCandidate are written in lockstep with appending fileBlockingFindings/fileRewritableFindings — booleans that restate array presence.
  - E4 — `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:752`: Readers nest mutated then touched then blocking/rewritable; writes always set fileTouched with fileHasBlockingCandidate, rewritable only with blocking, mutated only with rewritable.

## Current shape

Live sibling state at `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:626` (line 631 is an unrelated, currently constant informational flag):

```ts
for (const sourceFile of sourceFiles) {
  const sourceFilePath = toPosixPath(path.relative(process.cwd(), sourceFile.getFilePath()));
  let fileTouched = false;
  let fileMutated = false;
  let fileHasBlockingCandidate = false;
  const fileHasInformationalCandidate = false;
  let fileHasRewritableCandidate = false;
  let fileBlockingFindings = A.empty<string>();
  const fileInformationalFindings = A.empty<string>();
  let fileRewritableFindings = A.empty<string>();
```

## Cardinality gap

Four booleans represent 16 combinations. Four phases are legal: `clean` (no blocking findings), `blocking` (blocking findings only), `rewritable` (rewritable findings while not writing), and `mutated` (rewritable findings applied in write mode). `fileTouched` is equivalent to blocking-array presence; rewritable implies blocking; mutated implies rewritable.

This is stronger than a single-producer assumption: every flag write is paired
with the corresponding finding-array append, and the arrays are loop-local
and have no other mutator. The four reachable tuples are therefore proven by
the complete write graph, not inferred from one fixture.

## Target schema

Add a new `LiteralKit` import from `@beep/schema` and derive one phase after scanning each file. Do not store any replacement phase during traversal.

```ts
export const TerseEffectFilePhase = LiteralKit(["clean", "blocking", "rewritable", "mutated"]).pipe(
  $I.annoteSchema("TerseEffectFilePhase", {
    description: "Highest actionable terse-Effect phase derived for one scanned source file.",
  })
)

export type TerseEffectFilePhase = typeof TerseEffectFilePhase.Type

const terseEffectFilePhase = (
  options: TerseEffectRulesOptions,
  blockingFindings: ReadonlyArray<string>,
  rewritableFindings: ReadonlyArray<string>
): TerseEffectFilePhase =>
  Match.value({
    hasBlocking: A.isReadonlyArrayNonEmpty(blockingFindings),
    hasRewritable: A.isReadonlyArrayNonEmpty(rewritableFindings),
    write: options.write,
  }).pipe(
    Match.when({ hasRewritable: true, write: true }, () => TerseEffectFilePhase.Enum.mutated),
    Match.when({ hasRewritable: true }, () => TerseEffectFilePhase.Enum.rewritable),
    Match.when({ hasBlocking: true }, () => TerseEffectFilePhase.Enum.blocking),
    Match.orElse(() => TerseEffectFilePhase.Enum.clean)
  )
```

After traversal, use `TerseEffectFilePhase.$match(filePhase, ...)` to update aggregate arrays. Both `rewritable` and `mutated` append blocking and rewritable findings; only `mutated` calls `sourceFile.organizeImports()`. `clean` performs no aggregate writes. This phase is derived from the two source arrays plus `options.write`, never stored alongside them.

Keep the phase and helper file-local. Tests prove it through the exported
summary, so there is no reason to widen either the production or test barrel.

## Migration inventory

- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:8-11` — import
  `LiteralKit` from `@beep/schema` and add `Match` to the existing root Effect
  import for the exhaustive phase derivation.
- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:628-635` — delete all four affected sibling booleans; retain the finding arrays as the source of truth.
- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:650` — delete the mutation flag write for helper-ref replacement.
- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:653-657` — delete the touched/blocking/rewritable writes; retain the finding-array appends.
- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:672` — delete the mutation flag write for thunk-helper replacement.
- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:675-679` — delete the touched/blocking/rewritable writes; retain the finding-array appends.
- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:690-692` — delete touched/blocking writes for flow candidates; retain the append.
- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:699-704` — delete touched/blocking writes for option-object compaction; retain the finding append.
- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:709-714` — delete touched/blocking writes for nested Option matches; retain the finding append.
- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:719-724` — delete touched/blocking writes for nested Boolean matches; retain the finding append.
- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:731-736` — delete touched/blocking writes for conditional optional spreads; retain the finding append.
- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:742-748` — delete touched/blocking writes for explicit dual overloads; retain the finding append.
- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:752-769` — replace the mutation guard and nested touched/blocking/rewritable chain with one derived `filePhase` and exhaustive `$match`.
- Keep the kit, type, and helper file-local; exercise the phases through the
  existing exported summary seam.

The exact whole-repo search found no use of these four variables outside `runTerseEffectRules`.

## Guard-deletion accounting

- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:650-748` — delete ten clusters of manual coherence writes that mirror finding-array presence and write mode.
- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:752` — delete the standalone `fileMutated` guard.
- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:756-769` — delete the nested `fileTouched -> blocking -> rewritable` implication chain; exhaustive phase matching states all four legal cases.

## Encoded-side impact

none (internal). The phase is a loop-local projection and is not added to `TerseEffectRulesSummary` or any JSON output.

## Test impact

- No test reads the four loop-local flags directly (whole-repo test search: zero hits).
- `packages/tooling/tool/cli/test/terse-effect.test.ts:73`–`:97` asserts the observable clean, blocking, and rewritable aggregate arrays and remains the behavioral proof.
- `packages/tooling/tool/cli/test/terse-effect.test.ts:149`–`:183` covers rewritable findings in check and write modes and therefore distinguishes `rewritable` from `mutated`.
- The candidate families at `packages/tooling/tool/cli/test/terse-effect.test.ts:222`, `:268`, `:294`, `:337`, `:372`, `:405`, `:451`, `:495`, and `:545` must retain their current touched/blocking results after the centralized phase fold.
- Assert all four phases through existing summaries; do not export the helper
  solely for a direct table test.

## Risk & sequencing

The risk is aggregation drift: all eight finding families currently set blocking, while only two are rewritable. Land the array-source cleanup and exhaustive fold in one edit, checking that `blockingFiles`, `rewritableFiles`, `changedFiles`, and `touchedFiles` preserve ordering and counts. The unrelated informational arrays/constant are outside this record and must not be silently reclassified.
