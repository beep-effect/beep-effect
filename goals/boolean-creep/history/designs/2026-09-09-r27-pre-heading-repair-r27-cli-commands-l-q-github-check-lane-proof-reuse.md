# Instance

- id: `r27-cli-commands-l-q-github-check-lane-proof-reuse`
- exact source SHA: `8f266b878445ca8a7f751f9248da428a4dde39a1`
- corpus `origin/main`: `663904610cce2a38c06b0619a8c414646b69361c`
- file:line: `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1632`
- symbol: `runGithubCheckWave.laneProofReuse`
- members: `reusable`, `activeReuse`
- evidence: E4 at `Tasks.ts:1633`, E2 at `:1634-1649`
- cardinality: 4 representable / 3 legal
- storage/exposure: derived / internal; Tier 1
- target: LiteralKit; no payload-dependent variants

This is a current-source P2 design. Independent P3 approval and implementation
remain pending. Shortened source paths below are relative to
`packages/tooling/tool/cli/src/commands/Quality/`.

# Current shape and source proof

The private wave runner obtains an optional `LaneProofSession` at `Tasks.ts:1631`.
It derives local `reusable` through `hasReusableLaneProof` at `:1632`, then derives
`activeReuse` as `reusable && session.mode === "active"` at `:1633`. These are
actual Boolean values in one scope, not the predicate function itself or its
anonymous input parameters.

The reader logs a shadow or active hit only when reusable is true at `:1634`.
The active branch at `:1637` records the existing reused lane result and skips
execution; a shadow hit still runs the command. These two locals are neither
returned from the runner nor persisted in the proof store.

| Reusable | Active reuse | Disposition and supported path |
| --- | --- | --- |
| false | false | Miss: no prepared session, no exact record, or a non-reusable lane |
| true | false | Shadow hit: exact proof exists, but session mode is shadow |
| true | true | Reused: exact proof exists and session mode is active |

False/true cannot be constructed by the only producer. The real evidence is
the conjunction and reader behavior, not the presence of two declarations alone.

`internal/LaneProofReuse.ts:21-24` defines the off/shadow/active policy and the
shadow/active prepared-session subset. `prepareLaneProofSession` at `:209-258`
returns None for disabled or unavailable preparation and otherwise preserves
the chosen mode. `hasReusableLaneProof` at `:282-291` checks a matching identity
and record without changing that mode. The two real hit cases are therefore
separate supported outcomes of the same prepared-session domain.

The explicit fixture at `test/quality-tasks.test.ts:1546-1574` proves all three:
the first active-mode run executes, the second reuses, and a shadow-mode run
executes despite the existing proof. Its marker file records two executions.
Changing the virtual tree then forces another execution. These are concrete
behavior witnesses, not generic schema-permissiveness arguments.

# Target schema and reuse decision

Add `GithubCheckLaneProofDisposition` to the existing `Quality.schemas.ts`
schema role file, using `LiteralKit(["miss", "shadow-hit", "reused"])` with the
existing `$I` annotation convention and a same-name derived type. `Tasks.ts`
is the concrete runtime consumer. No new package, role file, service, or
persisted schema is needed. The current Quality facade already exports that
schema role at `index.ts:48`; add no separate compatibility alias or test-only
export solely for this change.

Live source search found no existing domain with these three disposition
semantics. `LaneProofMode` is an input policy: an active policy can still miss,
so it cannot replace the result. `GithubCheckLaneRunStatus` is a later execution
outcome: a shadow hit can run and fail, so it cannot stand in for the pre-run
decision. Yeet's payload-bearing `ProofReuseDecision` describes a different
ledger's hit/miss evidence; do not import or alter that protocol to model this
local observation.

Derive one disposition immediately after the existing session preparation.
Preserve the actual source Option and inspect exact proof availability once.
No session or no exact proof gives miss; an exact shadow session gives
shadow-hit; an exact active session gives reused. Use the literal kit's derived
helpers and shared thunks where appropriate. Do not retain the two Boolean
aliases, introduce a second stored state, or wrap the three payload-free cases
in new tagged object classes.

Keep `hasReusableLaneProof` as the existing predicate. Its Boolean is one
observation at the derivation boundary and is not itself a Boolean-creep carrier.
Keep the prepared session for the later successful-proof persistence path.

# Reader migration and guard-deletion accounting

| Existing obligation | Required change |
| --- | --- |
| `Tasks.ts:1632` local reusable plus `:1633` local activeReuse | Delete both parallel aliases and replace them with one derived disposition. |
| `Tasks.ts:1633` repeated implication `reusable && active mode` | Absorb the three outcomes into the one derivation; readers no longer reconstruct that implication. |
| `Tasks.ts:1634-1636` reusable gate and activeReuse log ternary | Use an exhaustive disposition match: miss emits no hit log; shadow-hit emits the exact shadow text; reused emits the exact reusing text. |
| `Tasks.ts:1637-1649` activeReuse gate | Use the derived reused case. Preserve activeReusableIds append, QualityTaskLaneRun creation, receipt append, laneRuns append, and continue ordering. |
| `Tasks.ts:1652-1680` execution, failures and successful proof persistence | Retain the behavior; miss and shadow-hit execute the same existing path. |

The derived `reused` guard is a single-state branch, not a recreated pair of
Boolean state variables. Do not add a new `{ reusable, activeReuse }` projection
for downstream readers. No existing coherence filter or legacy normalizer is
present here; do not claim deletion of an invented one.

The early stopped-after-red branch at `Tasks.ts:1624-1628` runs before session
preparation. Keep that ordering so skipped lanes perform no proof lookup. Keep
failure-policy handling and independent stop state outside this disposition.

# Full migration inventory

| Source or consumer | Scope |
| --- | --- |
| `Quality.schemas.ts` | Define and document the annotated LiteralKit domain alongside the existing GitHub lane schemas; derive its runtime type. |
| `Tasks.ts:89-112` | Import the schema through the existing Quality schema-role import. |
| `Tasks.ts:1613-1684` | Replace the local derived pair and its two readers only; preserve run/persist/error sequencing and existing return shape. |
| `Tasks.ts:1740-1803` | The sole direct caller consumes the unchanged runner result. Keep lane status mapping, stopped-wave behavior, result order, and report construction. |
| `Tasks.ts:3266` | Keep collectGithubCheckLaneWavesForTesting as the same testing facade; no signature or return-shape change. |
| `index.ts:48` | Existing schema export remains the facade route; no additional barrel topology change is required. |
| `test/quality-tasks.test.ts:1546-1574` | Retain the concrete miss/active/shadow/invalidated sequence and add exact log/receipt assertions at the changed decision seam. |

Graft did not index the Effect.fn runner as a callable node. Its exhaustive
text index found only the definition at `Tasks.ts:1613` and call at `:1770`.
Direct source inspection confirmed that chain. The testing export's exhaustive
index points to the existing Quality task test suite; no other local consumer
of either Boolean alias exists.

`LaneProofReuse.ts` needs no model, identity, mode, persistence, or API change.
All successful proof writes remain behind the existing post-run success branch.
Keep the preparation failure fallbacks, non-reusable security lane exclusion,
head/base/tree/environment identity checks, cross-wave refresh, and persistence
error logging. These are independent proof-safety obligations.

# Encoded-side impact

None for the new disposition: it is transient local derived data. Do not emit
its literal into an external report, log protocol, or proof ledger. Preserve
`yeet-lane-proofs/v2`, stored records, JSON property names and ordering, and
`github-check-run/v1` / QualityTaskLaneRun report behavior.

Preserve the exact hit log strings:

- `[lane-proof] shadow hit for exact lane proof: <lane-id>`
- `[lane-proof] reusing exact lane proof: <lane-id>`

Miss emits neither string. The active reuse branch still emits the existing
`status: "reused"` lane record with `inputDigest: None`; it does not execute or
persist a newly successful command. Shadow hit still executes and records its
actual outcome, including failure. Persist warnings and CLI exit behavior
remain unchanged.

# Test impact and validation

Keep the existing real repository/marker fixture proving the three cases.
Extend its assertions to distinguish hit-log presence, active command bypass,
the unchanged reused lane record, and shadow execution. Add a shadow-hit run
whose command fails, proving that a cache hit in shadow mode cannot suppress
the real failure or manufacture a reused outcome. Reuse the existing scoped
test fixture and package aliases; do not introduce mocks that merely repeat
the disposition implementation.

Retain existing preparation-default/failure, environment-floor, cross-wave,
history-change, volatile-security, mutation-during-run, linked-worktree and
failed-command proof tests at `quality-tasks.test.ts:1579-1933`. They verify
the proof eligibility and persistence behavior that this local refactor must
preserve. No new browser QA is required for this CLI-only change.

At implementation, run the focused Quality task suite and full
`bun run beep quality package-verify @beep/repo-cli`, then canonical Yeet
repair/verify for the Tier 1E PR. This design-only work does not claim those
product tests or repository checks have run.

# Risk and sequencing

Land with Tier 1E internal tooling after the replacement independent review
and ratification gate. The main risks are confusing input mode with disposition,
turning a shadow hit into an execution bypass, changing hit-log order, or
persisting a proof without a successful run. The three-state fixture and
unchanged store/report contracts provide the regression proof. Preserve the
current pure derivation and execution order; this change creates no new policy.
