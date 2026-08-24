## Instance

- id: `r3-tooling-terse-effect-file-flags`
- file:line: `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:615`
- symbol: `runTerseEffectRules.fileFlags`
- members: `fileTouched`, `fileMutated`, `fileHasBlockingCandidate`, `fileHasRewritableCandidate`
- evidence classes:
  - E3 — `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:641`: fileHasBlockingCandidate/fileHasRewritableCandidate are written in lockstep with appending fileBlockingFindings/fileRewritableFindings — booleans that restate array presence.
  - E4 — `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:743`: Readers nest mutated then touched then blocking/rewritable; writes always set fileTouched with fileHasBlockingCandidate, rewritable only with blocking, mutated only with rewritable.

## Current shape

Live sibling state at `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:613` (line 618 is an unrelated, currently constant informational flag):

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
  A.isReadonlyArrayNonEmpty(rewritableFindings)
    ? options.write
      ? TerseEffectFilePhase.Enum.mutated
      : TerseEffectFilePhase.Enum.rewritable
    : A.isReadonlyArrayNonEmpty(blockingFindings)
      ? TerseEffectFilePhase.Enum.blocking
      : TerseEffectFilePhase.Enum.clean
```

After traversal, use `TerseEffectFilePhase.$match(filePhase, ...)` to update aggregate arrays. Both `rewritable` and `mutated` append blocking and rewritable findings; only `mutated` calls `sourceFile.organizeImports()`. `clean` performs no aggregate writes. This phase is derived from the two source arrays plus `options.write`, never stored alongside them.

## Migration inventory

- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:8` — import `LiteralKit` from `@beep/schema` alongside the existing repo imports.
- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:615` — delete all four affected sibling booleans; retain the finding arrays as the source of truth.
- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:637` — delete the mutation flag write for helper-ref replacement.
- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:640` — delete the touched/blocking/rewritable writes at lines 640–642; the array appends at lines 643–644 remain.
- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:659` — delete the mutation flag write for thunk-helper replacement.
- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:662` — delete the touched/blocking/rewritable writes at lines 662–664; retain the finding appends.
- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:677` — delete touched/blocking writes for flow candidates; retain the append at line 679.
- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:686` — delete touched/blocking writes for option-object compaction; retain the append at lines 688–691.
- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:696` — delete touched/blocking writes for nested Option matches; retain the append at lines 698–701.
- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:706` — delete touched/blocking writes for nested Boolean matches; retain the append at lines 708–711.
- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:718` — delete touched/blocking writes for conditional optional spreads; retain the append at lines 720–723.
- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:730` — delete touched/blocking writes for explicit dual overloads; retain the append at lines 732–735.
- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:739` — replace the mutation guard and nested touched/blocking/rewritable chain through line 758 with one derived `filePhase` and exhaustive `$match`.
- Export the kit/type only if the focused test uses it directly; otherwise keep both file-local because the phase is an internal aggregation detail.

The exact whole-repo search found no use of these four variables outside `runTerseEffectRules`.

## Guard-deletion accounting

- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:637`, `:640`, `:659`, `:662`, `:677`, `:686`, `:696`, `:706`, `:718`, and `:730` — delete ten clusters of manual coherence writes that mirror finding-array presence and write mode.
- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:739` — delete the standalone `fileMutated` guard.
- `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:743` — delete the nested `fileTouched -> blocking -> rewritable` implication chain through line 758; exhaustive phase matching states all four legal cases.

## Encoded-side impact

none (internal). The phase is a loop-local projection and is not added to `TerseEffectRulesSummary` or any JSON output.

## Test impact

- No test reads the four loop-local flags directly (whole-repo test search: zero hits).
- `packages/tooling/tool/cli/test/terse-effect.test.ts:73`–`:97` asserts the observable clean, blocking, and rewritable aggregate arrays and remains the behavioral proof.
- `packages/tooling/tool/cli/test/terse-effect.test.ts:149`–`:183` covers rewritable findings in check and write modes and therefore distinguishes `rewritable` from `mutated`.
- The candidate families at `packages/tooling/tool/cli/test/terse-effect.test.ts:222`, `:268`, `:294`, `:337`, `:372`, `:405`, `:451`, `:495`, and `:545` must retain their current touched/blocking results after the centralized phase fold.
- Add a small table test for `terseEffectFilePhase` only if the helper is exported for testing; otherwise assert the four phases through existing summaries to avoid widening production API.

## Risk & sequencing

The risk is aggregation drift: all eight finding families currently set blocking, while only two are rewritable. Land the array-source cleanup and exhaustive fold in one edit, checking that `blockingFiles`, `rewritableFiles`, `changedFiles`, and `touchedFiles` preserve ordering and counts. The unrelated informational arrays/constant are outside this record and must not be silently reclassified.
