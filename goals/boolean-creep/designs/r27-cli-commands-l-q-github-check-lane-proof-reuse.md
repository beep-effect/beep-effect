# r27-cli-commands-l-q-github-check-lane-proof-reuse

Native P2 design refresh before R29, bound to merged source HEAD
`f03850b762e41217b5a0c26f26041daee490a070` / main
`4f13d83e13d61275a57004050ffc62a90d86c014`. This preserves status `designed`
and cardinality 4/3. Tier 1: ordered Tier1E tooling batches with serial shared-file edits.
Independent P3 review and implementation acceptance remain pending.

Owner `runGithubCheckWave` at `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1694`,
with members `reusable`, `activeReuse`.
Storage/exposure: derived/internal; target: literalkit.

The full public [source-impact audit](../data/pre-r29-main-4f13d8-source-impact.md),
[source bindings](../data/pre-r29-main-4f13d8-source-bindings.json), and
[row/design map](../data/pre-r29-main-4f13d8-row-design-map.json) bind this proposal.
The [exact original design](../history/designs/2026-09-09-pre-r29-main-4f13d8/r27-cli-commands-l-q-github-check-lane-proof-reuse.md) is preserved.
Keep complete decoded exports, typed request diagnostics, public constructor and
helper input domains, encoded keys/defaults/omission and full independent payloads
as specified below. Paths beginning `src/` or `test/` are relative to
`packages/tooling/tool/cli/` unless the design states otherwise.

Shortened source paths such as `Tasks.ts` and `internal/LaneProofReuse.ts`
are relative to `packages/tooling/tool/cli/src/commands/Quality/`.
Test paths remain relative to the CLI package root.

# Current shape

The private wave runner obtains an optional `LaneProofSession` at `Tasks.ts:1693`.
It derives local `reusable` through `hasReusableLaneProof` at `:1694`, then derives
`activeReuse` as `reusable && session.mode === "active"` at `:1695`. These are
actual Boolean values in one scope, not the predicate function itself or its
anonymous input parameters.

The reader logs a shadow or active hit only when reusable is true at `:1696`.
The active branch at `:1699` records the existing reused lane result and skips
execution; a shadow hit still runs the command. These two locals are neither
returned from the runner nor persisted in the proof store.

# Cardinality gap

| Reusable | Active reuse | Disposition and supported path |
| --- | --- | --- |
| false | false | Miss: no prepared session, no exact record, or a non-reusable lane |
| true | false | Shadow hit: exact proof exists, but session mode is shadow |
| true | true | Reused: exact proof exists and session mode is active |

False/true cannot be constructed by the only producer. The real evidence is
the conjunction and reader behavior, not the presence of two declarations alone.

`internal/LaneProofReuse.ts:21-24` defines the off/shadow/active policy and the
shadow/active prepared-session subset. `prepareLaneProofSession` at `:202-255`
returns None for disabled or unavailable preparation and otherwise preserves
the chosen mode. `hasReusableLaneProof` at `:279-287` checks a matching identity
and record without changing that mode. The two real hit cases are therefore
separate supported outcomes of the same prepared-session domain.

The explicit fixture at `test/quality-tasks.test.ts:1565-1593` proves all three:
the first active-mode run executes, the second reuses, and a shadow-mode run
executes despite the existing proof. Its marker file records two executions.
Changing the virtual tree then forces another execution. These are concrete
behavior witnesses, not generic schema-permissiveness arguments.

# Target schema

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

# Guard-deletion accounting

| Existing obligation | Required change |
| --- | --- |
| `Tasks.ts:1694` local reusable plus `:1695` local activeReuse | Delete both parallel aliases and replace them with one derived disposition. |
| `Tasks.ts:1695` repeated implication `reusable && active mode` | Absorb the three outcomes into the one derivation; readers no longer reconstruct that implication. |
| `Tasks.ts:1696-1698` reusable gate and activeReuse log ternary | Use an exhaustive disposition match: miss emits no hit log; shadow-hit emits the exact shadow text; reused emits the exact reusing text. |
| `Tasks.ts:1699-1711` activeReuse gate | Use the derived reused case. Preserve activeReusableIds append, QualityTaskLaneRun creation, receipt append, laneRuns append, and continue ordering. |
| `Tasks.ts:1714-1742` execution, failures and successful proof persistence | Retain the behavior; miss and shadow-hit execute the same existing path. |

The derived `reused` guard is a single-state branch, not a recreated pair of
Boolean state variables. Do not add a new `{ reusable, activeReuse }` projection
for downstream readers. No existing coherence filter or legacy normalizer is
present here; do not claim deletion of an invented one.

The early stopped-after-red branch at `Tasks.ts:1686-1690` runs before session
preparation. Keep that ordering so skipped lanes perform no proof lookup. Keep
failure-policy handling and independent stop state outside this disposition.

# Migration inventory

The additional package-script-policy merge adds two existing root lint steps
at `Tasks.ts:2548-2549`: `lint:package-scripts` runs
`["lint", "package-scripts", "--check"]`, followed by `lint:policy-fingerprint`
with `["lint", "policy-fingerprint", "--check"]`, before typos. Preserve their
labels, exact argument order, inherited cwd/environment/timeout construction,
and blocking failure behavior. They are independent quality gates, with zero
guard-deletion credit for this carrier. All downstream Tasks.ts citations have
been relocated by the two inserted lines; earlier owner/proof code is unchanged.
Keep the corresponding complete root-plan lists and argument assertions at
`test/quality-tasks.test.ts:2798-2799,2836-2847`. Existing ambient proof identity,
volatile-security policy, lane topology, report codecs and raw planner inputs
remain unchanged by this additional delta.

| Source or consumer | Scope |
| --- | --- |
| `Quality.schemas.ts` | Define and document the annotated LiteralKit domain alongside the existing GitHub lane schemas; derive its runtime type. |
| `Tasks.ts:89-112` | Import the schema through the existing Quality schema-role import. |
| `Tasks.ts:1675-1746` | Replace the local derived pair and its two readers only; preserve run/persist/error sequencing and existing return shape. |
| `Tasks.ts:1802-1865` | The sole direct caller consumes the unchanged runner result. Keep lane status mapping, stopped-wave behavior, result order, and report construction. |
| `Tasks.ts:3332` | Keep collectGithubCheckLaneWavesForTesting as the same testing facade; no signature or return-shape change. |
| `internal/LaneProofReuse.ts:202-255,279-287,294-340` | Preserve preparation fallbacks, exact match across all seven identity fields, original-versus-refreshed identity equality before persistence, store merge order and atomic JSON write. |
| `src/test/Quality.test-kit.ts:57,76` | Existing Tasks and LaneProofReuse exports remain the only required test routes; no helper alias is needed. |
| `index.ts:48` | Existing schema export remains the facade route; no additional barrel topology change is required. |
| `test/quality-tasks.test.ts:1565-1593` | Retain the concrete miss/active/shadow/invalidated sequence and add exact log/receipt assertions at the changed decision seam. |

Graft did not index the Effect.fn runner as a callable node. Its exhaustive
text index found only the definition at `Tasks.ts:1675` and call at `:1832`.
Direct source inspection confirmed that chain. The testing export's exhaustive
index points to the existing Quality task test suite; no other local consumer
of either Boolean alias exists.

`LaneProofReuse.ts` needs no model, identity, mode, persistence, or API change.
All successful proof writes remain behind the existing post-run success branch.
The merge changed `environmentProfileHash` at `LaneProofReuse.ts:124-139`:
local-env lanes or commands for which `turboEnvExtendsAmbient` is true now hash
the complete inherited environment into `inheritedEnvironmentHash`. Isolated
spawns omit that contribution. The current stable record hash still includes
platform, architecture, Bun/Node versions and explicit lane environment. Keep
this exact identity algorithm; do not restore the earlier selected-variable
allowlist or persist raw environment values. The predicate at
`src/internal/cli/EnvConfig.ts:519` is shared with actual spawn construction at
`Tasks.ts:1179,1260,2033` and must remain aligned with it.

`internal/GithubChecks.ts:493-498` adds the blocking `fallow:health` preflight
lane after audit and dead-code. Preserve its ID, stage, wave, argument order
and position. `Quality.command.ts:1034-1054` adds the ONNX mitigation command
before OSV in the volatile security lane; a failed mitigation proof stops that
lane before Docker. This outcome refactor does not change either lane body,
the non-reusable security exclusion or early-stop policy.
Keep the preparation failure fallbacks, non-reusable security lane exclusion,
head/base/tree/environment identity checks, cross-wave refresh, and persistence
error logging. These are independent proof-safety obligations.

# Encoded-side impact

None for the new disposition: it is transient local derived data. Do not emit
its literal into an external report, log protocol, or proof ledger. Preserve
`yeet-lane-proofs/v2`, stored records, JSON property names and ordering, and
`github-check-run/v1` and `quality-task-lane-run/v1` report behavior
(`Tasks.ts:1858-1875`). Full lane IDs, stage/wave/status, failure order, first
red, skipped counts, duration, input digest omission and scheduling metadata
remain as currently written. Required arrays and numeric metrics are retained
payload values and are not independent Boolean axes.

Preserve the exact hit log strings:

- `[lane-proof] shadow hit for exact lane proof: <lane-id>`
- `[lane-proof] reusing exact lane proof: <lane-id>`

Miss emits neither string. The active reuse branch still emits the existing
`status: "reused"` lane record with `inputDigest: None`; it does not execute or
persist a newly successful command. Shadow hit still executes and records its
actual outcome, including failure. Persist warnings and CLI exit behavior
remain unchanged.

# Test impact

Keep the existing real repository/marker fixture proving the three cases.
Extend its assertions to distinguish hit-log presence, active command bypass,
the unchanged reused lane record, and shadow execution. Add a shadow-hit run
whose command fails, proving that a cache hit in shadow mode cannot suppress
the real failure or manufacture a reused outcome. Reuse the existing scoped
test fixture and package aliases; do not introduce mocks that merely repeat
the disposition implementation.

Retain existing preparation-default/failure, environment-floor, cross-wave,
history-change, volatile-security, mutation-during-run, linked-worktree and
failed-command proof tests at `quality-tasks.test.ts:1598-2060`. They verify
the proof eligibility and persistence behavior that this local refactor must
preserve. Preserve the new ambient invalidation, local-env hash, and isolated-spawn
fixtures at `quality-tasks.test.ts:1690-1791`, and the additional mixed-cwd
persistence guard at `:1626`. Preserve health-lane topology fixtures at
`:856,2179-2196,2353-2390` and security mitigation ordering/failure fixtures at
`test/quality-command-dispatch.test.ts:105-140`. These fixtures are audited
consumers, not new census roots or proof that this design was executed.
No new browser QA is required for this CLI-only change.

At implementation, run the focused Quality task suite and full
`bun run beep quality package-verify @beep/repo-cli`, then canonical Yeet
repair/verify for the Tier 1E PR. This design-only work does not claim those
product tests or repository checks have run.

# Risk

Land with Tier 1E internal tooling after the replacement independent review
and ratification gate. The main risks are confusing input mode with disposition,
turning a shadow hit into an execution bypass, changing hit-log order, or
persisting a proof without a successful run. The three-state fixture and
unchanged store/report contracts provide the regression proof. Preserve the
current pure derivation and execution order; this change creates no new policy.
