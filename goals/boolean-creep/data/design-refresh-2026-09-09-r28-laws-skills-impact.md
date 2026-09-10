# Laws and Skills eligibility after the main refresh

Source: `93217d998f851e2e93d9864e2b5315552eaa58a7`, incorporating main
`d1b4d769fbaffddd55717f3b1ba461897dd545c5`. Comparison source:
`8f266b878445ca8a7f751f9248da428a4dde39a1`. This is native source
adjudication for P2R, not replacement independent P3 review.

The post-merge validator caught a stale TerseEffect citation beyond the new
767-line file. Inspection found a removed carrier rather than a line-only
refresh. The same review exposed older eligibility errors in the strict-result
family and Skills command. Withdraw six qualified and three D1 rows; preserve
their exact prior bytes and six designs. None becomes `applied`.

## Upstream removed the TerseEffect file latches

Withdraw `r3-tooling-terse-effect-file-flags` and the companion D1
`r25-cli-commands-l-q-terse-effect-informational-severity`.

Previously the runner maintained `fileTouched`, `fileMutated`,
`fileHasBlockingCandidate`, `fileHasInformationalCandidate`, and
`fileHasRewritableCandidate`. The old-to-current diff deletes these declarations,
their coordinated assignments, and their nested readers. Current
`packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:641-668` collects
finding records and returns `{ sourceFilePath, findings }`; the runner at
lines 701-733 derives scan lists, counts, and report arrays from those records.
The new `DetectedTerseFinding` at lines 580-584 contains one Boolean
`rewritable`. Required finding arrays and counts do not manufacture another
Boolean axis. There is no surviving declaration for either recorded cluster.

The upstream implementation removed this source smell independently. It is
not evidence that this campaign applied or reviewed its old target design.

## Strict intent and strict result are different owners

Withdraw these four qualified rows:

| Inventory id | Input declaration | Output declaration | Actual projection |
| --- | --- | --- | --- |
| `r2-tooling-law-scan-strict-failure` | `Laws/internal/LawScan.ts:79-85` | `Laws/internal/LawScan.ts:152-159` | `Laws/internal/LawScan.ts:192-199` |
| `r2-tooling-no-native-runtime-strict-failure` | `Laws/NoNativeRuntime.ts:107-122` | `Laws/NoNativeRuntime.ts:192-219` | `Laws/NoNativeRuntime.ts:696-706` |
| `terse-effect-rules-strict-failure` | `Laws/TerseEffect.ts:33-52` | `Laws/TerseEffect.ts:66-110` | `Laws/TerseEffect.ts:745-765` |
| `effect-import-rules-strict-failure` | `Laws/EffectImports.ts:135-174` | `Laws/EffectImports.ts:241-272` | `Laws/EffectImports.ts:1789-1810` |

Paths in the table are relative to `packages/tooling/tool/cli/src/commands/`.
Each input owns `strictCheck`; its separately returned summary owns
`strictFailure` and omits `strictCheck`. The synthetic slash-joined inventory
symbol is not a declaration carrying both members. The implication from input
policy to output failure is real, but it is insufficient to establish an
eligible co-carried state vector. Changing one result Boolean into a richer
advisory/strict phase would add remembered input intent to these outputs rather
than remove two sibling state fields.

This withdrawal is limited to the listed pair. EffectImports has real other
members in its input and summary; those independent clusters remain available
to the full census. Its public JSON behavior is not permission to invent a
missing result-side `strictCheck`. Required diagnostic counts and arrays also
do not supply another Boolean member by zero/nonzero or empty/nonempty tests.

Withdraw the two related D1 rows as well:

- `r2-tooling-effect-fn-strict-check-failure`: `EffectFnRulesOptions` at
  `Laws/EffectFn.ts:55-70` contains only `strictCheck`; `strictFailure` belongs
  to `EffectFnRulesSummary` at lines 132-150.
- `r2-tooling-frozen-grant-set-strict-check-failure`:
  `FrozenGrantSetRulesOptions` at `Laws/FrozenGrantSet.ts:54-69` contains only
  `strictCheck`; `strictFailure` belongs to its summary at lines 130-148.

Their earlier D1 notes claimed that a qualified shared LawScan carrier owned
the coupling. That carrier does not exist, and delegating a projection does
not prove all four combinations legal within either actual declaration.
Remove the invalid census rows instead of relabeling them D1.

## Skills contains parser descriptors and function parameters

Withdraw `skills-run-mode`. Its supposed `skills mode flags` sibling-state
owner is not a declaration. `Skills.command.ts:1007-1014` constructs a command
from `Flag` descriptors, not stored Boolean values. The callback's destructured
`check` and `dryRun` are function flag parameters. The named `resolveMode`
function at lines 879-889 likewise accepts two Boolean parameters, which this
campaign explicitly excludes. The actual workflow invocation at lines
1015-1016 already passes one `mode` literal plus `skill`.

The mutually exclusive CLI diagnostic is real and remains unchanged. It does
not bring the excluded parameter refactor into this campaign. The upstream
change extracts four drift evaluators that each consume the existing mode;
none creates the recorded two-Boolean data carrier. The shared CLI design's
Skills link is removed along with the current per-instance design, with both
original files archived first.

## Evidence and validation boundary

Discovery used the current graft TerseEffect API and exhaustive strict-field
and Skills resolver searches, followed by the exact source spans above and
the old-to-current diff. Missing graph edges were not treated as absence.
The parent integration archives the original JSONL rows and design bytes,
records their hashes, and reruns the packet validators. No source, package,
runtime, output contract, or tests were changed. The next complete independent
census must still cover these files; these withdrawals do not give dry credit.
