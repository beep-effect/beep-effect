# branchMergedIntoBase / localTip: not admitted on current class-wide evidence

Source: HEAD `1c07c15495aaa42f521b887b01e943e68804606c`; identical Sweep
bytes at immutable main `3657f8f97f7135c53c3c0b9fa99aa19093c3e5ee`.
This is a bounded native P2 disposition, not D1, a new canonical row, or P3.

## Actual owner and finite projection

SweepGitState at `packages/tooling/tool/cli/src/commands/Yeet/internal/Sweep.ts:177-200`
contains actual `branchMergedIntoBase: S.Boolean` (:185) and
`localTip: S.NonEmptyString.pipe(S.OptionFromOptionalKey,
SchemaUtils.withNoneDefault)` (:191). The complete Boolean/presence product
for this pair is four, with unbounded payload values retained. The full owner
passes the initial Boolean net; scope eligibility is not the issue.

The one production observer has a three-state image for this pair:

| branchMergedIntoBase | localTip | Actual evidence |
| --- | --- | --- |
| false | None | Observer guard :753; explicit missing-tip fixture test:151-155. |
| false | Some(tip) | Default squash-merge fixture test:46-69; moved tip :133-137. |
| true | Some(tip) | Ancestor fixture test:115-121; observer :753. |
| true | None | Suppressed by observer :753; no explicit supported fixture found, but no separate class-wide exclusion contract established. |

The source equation `ancestry.exitCode === 0 && O.isSome(localTip)` at :753
is real, and the consumer is not callable-only or a virtual required-string
predicate. It is nevertheless insufficient by itself to restrict every
legitimate constructed input accepted by the exported data/planner seam.

## Why the broader qualification is not justified

1. `observeSha` at :590-596 maps both failed/unreadable reads and empty output
   to None. None is not solely proof that a local branch never existed.
2. The local-tip read at :724 and the ancestry command at :726-731 happen at
   different times. A branch/ref may appear or become readable between them.
   The observer deliberately masks a later successful ancestry result when
   the earlier SHA is absent. That proves a conservative observer construction
   rule; it does not prove that independent partial facts at the public seam
   could never report an ancestry observation without the earlier SHA.
3. The class documentation at :124-127 explicitly makes state construction
   the way to falsify deletion preconditions. The planner's :435-443 contract
   preserves distinct -d and -D safety branches; unlike the unreliable
   worktree-address contract, it does not explicitly say a true ancestry flag
   with unobserved localTip is outside the public helper's input contract.
4. `deleteLocalBranchPlanStep` at :319-347 always checks local existence
   before selecting -d versus -D. Therefore the true/None combination renders
   a blocked -d plan rather than bypassing local-existence safety. This fact
   describes current behavior, not proof that the combination is legitimate.
   Conversely, the observer never producing it is not sufficient proof that
   rendering that diagnostic input is unsupported.
5. `revalidateLocalDeletion` at :885-910 reads the observed Option itself and
   performs a fresh probe. It does not inspect ancestry, and None/None does
   not count as a match. Its documented partial observation boundary must not
   be narrowed on the assumption that all helper inputs are observer outputs.

All existing concrete fixtures respect the implication. The successful
ancestor test retains Some(default tip); the explicit missing-tip test retains
false(default ancestry). The Partial override helper at test:66-67 can express
other tuples, but generic type/schema permissiveness is not a legal-input
witness. No fabricated fixture was added to convert uncertainty into D1.

## Exact disposition and parent action

Do not add a qualified row or implementation design for this pair from this
evidence. Do not label it D1 or claim all four tuples are supported. Record it
as a non-admitted source finding: observer image 4/3 established, class-wide
legal cardinality not established. Leave the Boolean, Option, None default,
producer guard, plan branching, revalidation and exact current diagnostic
outputs unchanged. This is no withdrawal of the separate accepted
worktreeDirty/statusProbeUnreliable qualification.

The missing evidence is a class/helper contract deciding whether ancestry
without a captured local SHA is an invalid observation or a supported blocked
planning request. A future owner-specific contract/fixture review could settle
that boundary; it must not manufacture an extra bit from a payload or require
an atomic Git snapshot that the current observer does not take. No new user
decision or model lane is requested by this handoff.

The ancestry Boolean also chooses -d/-D at :1216, after the current fresh-tip
guard. If a future union is justified, preserve full tip strings, sequential
probe timing, ancestry's exact exitCode-only test (do not newly gate it on
truncation), distinct shared/ancestry/identity precondition arrays, unconditional
fresh revalidation probe and all encoded plan/report diagnostics. Those design
requirements do not themselves establish present qualification.
