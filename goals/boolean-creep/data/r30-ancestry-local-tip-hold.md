# R30 ancestry/local-tip hold

Private native P2 verification by gpt-6-astra/xhigh. No inventory row, P2
implementation design, D1 classification or P3 approval is proposed.

The raw row `r30-cli-yeet-sweep-merged-local-tip` repeats the known source
finding in `goals/boolean-creep/data/r29-sweep-ancestry-non-admission.md`.
Sweep.ts and yeet-sweep-plan.test.ts are byte-identical at current HEAD
`e7b1e907726421c7d2a2e1cdd140280df47f2353`, current pinned main
`bed30c6adf3beed7de8538209fbdc84d26a3b8ce` and R29's immutable main
`3657f8f97f7135c53c3c0b9fa99aa19093c3e5ee`. The binding files record exact
SHA-256 and Git blob comparisons. There is no new source/fixture evidence
that changes the prior disposition.

All source/test citations below are relative to packages/tooling/tool/cli/.

## Net and finite projection

The owner is the real `SweepGitState` class at
`src/commands/Yeet/internal/Sweep.ts:177-200`. It has seven Boolean members,
including the selected branchMergedIntoBase at :185, plus the selected
localTip Option of NonEmptyString at :191 with None constructor default.
The scope passes the Boolean net. This is not the separate single-Boolean
owner exclusion and not a fabricated predicate on a required string.

| Ancestry flag | Local tip | Existing evidence |
| --- | --- | --- |
| false | None | Explicit missing-branch constructor test:151-155. |
| false | Some(tip) | Documented constructors Sweep.ts:154-170 and :457-473; base fixture test:46-69; drift fixtures :133-137,165,665. |
| true | Some(tip) | Explicit ancestor fixture test:115-121 retains default Some(mergedTip). |
| true | None | The observer excludes it at Sweep.ts:753; no separate whole-class exclusion or supported witness for this tuple was found. |

The observer image is four representable versus three produced combinations.
The class-wide legal cardinality remains unestablished. Neither the lack of a
fixture for the fourth tuple nor generic .make/Partial acceptance settles it.

## Complete writer, reader and refresh accounting

- The actual class at :177-200 allows independently constructed facts, with
  the deletion-precondition falsification seam expressly documented at
  :124-127. Both direct documentation constructors at :154-170 and :457-473
  omit mainTip while retaining localTip; they do not require an atomic world
  snapshot or erase constructor omission defaults.
- The one real observer constructs the complete class at :742-771.
  observeSha at :590-596 maps a failed/nonzero or empty result to None.
  It samples mainTip at :723, localTip at :724, remoteTip at :725, then runs
  ancestry at :726-731, lockfile at :732-738 and PR observation at :739.
  `ancestry.exitCode === 0 && O.isSome(localTip)` at :753 masks later ancestry
  success when the earlier local SHA was unobserved. These distinct reads
  can change or fail independently over time; no atomic snapshot is promised.
- `deleteLocalBranchPlanStep` at :319-347 always includes the independent
  local-existence precondition. The ancestry flag selects the -d branch
  (:326-334) or -D branch with exact-head comparison (:336-344). A hypothetical
  true/None input would render blocked -d, but that safe rendering alone does
  not establish a legitimate diagnostic-input contract. The branch split is
  explicitly documented at :437-443.
- `revalidateLocalDeletion` at :891-910 unconditionally observes the fresh local
  ref, compares actual Options using tipsMatch(:293-294), and preserves exact
  reason text. It never reads ancestry. Two Nones are not equality proof.
  The direct revalidation fixture test:663-672 retains a Some tip and checks
  both drift and unchanged cases. It supplies no fourth-tuple contract.
- `performSweepStep` at :1211-1219 performs that fresh-tip guard before issuing
  the -d/-D action selected from the original ancestry flag. The observe/build/
  execute routes at :798-803,:1312-1335 pass the captured state through; no
  refresh rewrites the stored pair. Later main/lockfile refresh observations
  at :1057-1101 are separate and do not repair or establish this implication.
- Graft plus a targeted source/test search found the sole observer, the two
  documentation constructors, test:46-67's base/Partial constructor, all local
  tip overrides and reader sites above. The module remains reachable via the
  wildcard test route at src/test/Yeet.test-kit.ts:67, package.json:65-68.
  No alternate class producer or actual decoder contract closes the question.

The complete current fixture set respects the observer implication, but its
constructor seam deliberately supports partial facts. Unlike the accepted
worktree reliability/address record, there is no exported contract explicitly
forbidding an ancestry fact without captured local SHA. The R29 hold already
explained this distinction; R30's single-writer citation does not replace it.

## Guard and migration disposition

Delete no guard and migrate no field for this held candidate. Preserve the
required ancestry Boolean, full Option payload and None default, :753 guard,
independent existence check, all -d/-D preconditions and output, unconditional
fresh revalidation, exact ancestry exit-code test and existing command order.
Do not strengthen ancestry with a new truncation test, couple it to PR state,
or normalize true/None. Do not add a fake D1 census row claiming all four
combinations are legitimate. The accepted status and worktree-address designs
remain distinct and retain their current scope.

Parent should reject the raw row's confirmation claim while retaining this
source-cited non-admission. Evidence needed to change that disposition is an
actual class/helper contract deciding whether ancestry without the captured
local SHA is invalid or a supported blocked planning observation. This task
has no authorization to invent that contract, narrow it through implementation,
or author a fixture merely to manufacture a qualification or D1 witness.
