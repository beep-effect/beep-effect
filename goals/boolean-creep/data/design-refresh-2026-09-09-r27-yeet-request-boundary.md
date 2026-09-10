# R27 Yeet request-boundary adjudication

Source pin: `8f266b878445ca8a7f751f9248da428a4dde39a1`.
Corpus main pin: `663904610cce2a38c06b0619a8c414646b69361c`.
This is a bounded native source audit of `yeet-run-options-flags` and
`yeet-command-shared-options`. It changes no canonical inventory, design,
status, source, test, dependency, service or git state. It is not independent
P3 review and does not reopen the completed Grok correction lane.

Inputs are SPEC/DECISIONS, the
[`CLI seed-drift audit`](./design-refresh-2026-09-09-r27-cli-seed-drift.md), and
the completed independent
[`CLI/Yeet correction execution receipt`](./sweeps/refresh-2026-09-09-r27-main-663904/r27-cli-yeet-contract-correction1.execution.json).
That correction deliberately emitted no row for these two unresolved owners.
Its six withdrawals, other corrected rows, and the existing
`yeet-monitor-command-route` D1 ruling are outside this audit's mutation scope.

## Bounded conclusion

**Retain both named owners as D1 request/configuration carriers, replacing
their broad notes.** Their fields record operator requests before operation
legality is assessed. The contract deliberately accepts conflicting selections
far enough to return a named `YeetCommandError` explaining the rejected
request. This conclusion is about the request contract, not a claim that
every combination is a successful or permitted repository operation.

The earlier note that invokes pure-planner precedence is insufficient for
`YeetRunOptions`: runtime validation does reject combinations that the separate
pure planner can calculate. The earlier SharedOptions note, “independently
combinable operator switches,” also needs that request-level qualification.
The new evidence below resolves the owner-purpose question; it does not
disprove any of the seed-drift audit's successful-operation constraint tables.

This is an inference from the explicit descriptions, actual CLI construction,
typed result contract, diagnostic fixtures, and bounded downstream reads.
Neither constructor permissiveness alone nor an arbitrary count of guards
is used as qualification or disqualification evidence.

## Actual owners and input construction

All source paths in this section are relative to
`packages/tooling/tool/cli/src/commands/Yeet/` unless another root is named.
Paths beginning `test/` or `src/test/` are relative to the CLI package root.

| Owner | Source-defined purpose | Construction and consumer |
| --- | --- | --- |
| `YeetRunOptions`, `Yeet.schemas.ts:376` | The description at `:330` and annotation at `:411` both say “Runtime options accepted by the yeet handler.” | `Yeet.command.ts:505`–`:539` constructs it from parsed/shared selections; `internal/Handler.ts:1958` receives it before operation guards. |
| `SharedOptions`, `Yeet.command.ts:466` | Annotation at `:500`: “CLI option bag shared by Yeet commands before handler defaults are applied.” | Private class; `runYeetMode` constructs it at `:506`, then copies its selections to `YeetRunOptions`. No post-validation SharedOptions consumer was found. |

`YeetRunOptions` has eighteen actual required Boolean fields, including
`ciParity` at `Yeet.schemas.ts:382`. Its existing broad census row omits that
field. The actual list is:

```text
allowStaleBase, amend, ciParity, collectAll, fast, json, merged, monitor,
noEdit, plan, pr, pushOnly, remote, retriggerGreptile, reuseVerified,
stagedOnly, summary, startPrEarly
```

`SharedOptions` has those eighteen plus `noFailFast` at `Yeet.command.ts:479`.
Its census deliberately splits coverage: the broad row owns seventeen fields,
while `r25-cli-yeet-shared-options-ci-parity-no-fail-fast` owns `ciParity` and
`noFailFast`. Retain that 17+2 split; neither field is missing from the complete
owner census. Defaults are part of this adapter: it supplies false for
optional command switches, preserves
the raw strings and tier, and later normalizes `collectAll || noFailFast` at
`:515`. The other Boolean selections are copied without exclusive case
construction. `message` and `mode` are supplied separately to `runYeetMode`;
neither is a declared SharedOptions field.

The parser exposes mode-specific flag sets, not every switch on every
subcommand. `verifyFlags` at `Yeet.command.ts:389` includes both `ciParity`
and `merged`. `publishFlags` at `:395` includes `fast`, `monitor`, `startPrEarly`,
`amend`, `noEdit`, `pr`, `pushOnly`, `reuseVerified` and `stagedOnly`. Thus the
disputed same-mode conflicts genuinely cross this adapter: they are not only
objects constructed artificially with `.make`.

Unsupported flags on another CLI subcommand can fail at parsing before a
SharedOptions instance exists. That is a grammar boundary, not evidence that
the shared class stores one exclusive operation phase. Conversely, the public
runtime schema permits callers to submit mode/modifier requests that the CLI
grammar does not expose; the handler has explicit diagnostics for them. Do
not claim every eighteen/nineteen-bit vector has a successful CLI spelling.

Preserve all seven actual `YeetRunMode` literals (`internal/Planner.ts:84`):
repair, verify, publish, monitor, closeout, status and pre-push-hook. Preserve
the three `YeetProofTier` literals at
`packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts:137`:
full, cheap-gates and review-fix. The named request boundaries also carry
strings and numeric thresholds; their contents are not fabricated additional
Boolean or presence axes.

## Specified diagnostics are part of the request contract

`runYeet`, `internal/Handler.ts:1958`, returns
`Effect<YeetRunResult, YeetCommandError, ...>`. `Yeet.errors.ts:41` declares
that public tagged error, and `:55` maps its exit code to the runtime boundary.
`internal/Guards.ts:140`–`:287` explicitly matches invalid flag combinations
and returns that error with corrective prose. The conjunctions are handled
cases; they are not silently lost in an exclusive reader.

The following evidence distinguishes intentional validation from incidental
schema acceptance. Test files are compatibility witnesses, not census roots.

| Request | Specified result, after earlier setup/guards succeed | Evidence |
| --- | --- | --- |
| Full verify, `ciParity=false`, `merged=false` | Ordinary full verification route | Default request at `Yeet.schemas.ts:546`; verify planner at `internal/Planner.ts:744`. |
| Full verify, `ciParity=true`, `merged=false` | CI-parity verification route | `test/yeet-merged-preview.test.ts:193`–`:199` explicitly asserts guard success. |
| Full verify, `ciParity=false`, `merged=true` | Merged-preview verification route | Same test at `:183`–`:189` explicitly asserts guard success. |
| Full verify, `ciParity=true`, `merged=true` | Typed diagnostic: full tier required and cannot combine with merged | Both flags belong to `verifyFlags`; `internal/Guards.ts:183`–`:188`; test at `:203`–`:214` asserts failure. |
| Publish with fast but no monitor | Typed diagnostic requiring monitor | `internal/Guards.ts:153`–`:158`; `.claude/skills/yeet/SKILL.md:373`–`:376` explicitly documents rejection. |
| Publish with startPrEarly and monitor but no pr | Typed diagnostic requiring explicit PR consent | `internal/Guards.ts:54`; `test/yeet.test.ts:3756`–`:3768` checks “requires --pr” and “Add `--pr` and retry”; the same fixture at `:3770`–`:3781` supplies pr and succeeds. |
| Publish with noEdit but no amend | Typed diagnostic requiring amend | Both switches are actual publish flags; `internal/Guards.ts:223`–`:228`; command help at `Yeet.command.ts:198` describes no-edit as reusing the message with amend. |
| Publish with pushOnly but no reuseVerified | Typed diagnostic requiring proof reuse | Both are actual publish flags; `internal/Guards.ts:237`–`:242`; `.claude/skills/yeet/SKILL.md:473`–`:476` documents the paired recovery request. |

The remaining overlapping publish conflicts are likewise explicit inputs to
ordered request validation: startPrEarly conflicts with fast/pushOnly/
reuseVerified/amend/noEdit (`internal/Guards.ts:205`), pushOnly conflicts with
amend/noEdit/fast (`:244`) and a supplied message (`:251`), and stagedOnly
conflicts with pushOnly/reuseVerified/amend (`:272`). Mode/tier restrictions
at `:146`, `:160`, `:168`, `:176`, `:191`, `:216`, `:230`, `:258`, and `:265`
are real successful-operation restrictions. None is permission to erase the
operator's conflicting input or replace the current error with a generic
schema-construction failure.

The request contract does not promise all conflicts will always produce a
particular guard message regardless of context. `runYeet` validates explicit
start-pr consent before hydration, then hydrates repository state, checks the
publish branch, and invokes the remaining guards (`internal/Handler.ts:1965`
–`:1969`). Context failures and earlier guards can win. Several invalid flags
can coexist, with the ordered first matching diagnostic defining the result.
Preserve the order and timing, including whether remote reads occur first.

One correction to the supplied shorthand is material: despite its name and
older prose, `validateRequiredMessage` at `internal/Guards.ts:312`–`:315`
currently only normalizes the string to Option and succeeds. The actual
missing-message rejection is later in `internal/Handler.ts:731`–`:753`,
dependent on whether a publish creates/rewrites a commit. Existing-commit and
amend/no-edit paths have supported exceptions. A count of “message guards”
cannot supply a new flag/payload cardinality here.

## Downstream use does not change the original carrier's purpose

`SharedOptions` ends at its adapter. `YeetRunOptions` is reused after validation,
and some private execution helpers therefore receive requests whose conflicting
combinations have already been excluded by control flow. This is a real
internal validation assumption; it should not be hidden by calling every
downstream operation independent.

The bounded reader inventory is:

| Reader group | What it reads and what it does not establish |
| --- | --- |
| `internal/Handler.ts:287` hydration; `internal/TurboQuery.ts:239`, `:296` | Before full flag validation, read mode/base/head/plan/remote to obtain context and feedback tasks. This use cannot mean the input is already a validated operation. |
| `internal/Guards.ts:42`, `:54`, `:140`; `internal/PublishScope.ts:78` | Compute monitoring demand or produce explicit consent/combination/branch diagnostics from the request. They do not return a validated options record. |
| `internal/Handler.ts:1979` | Copies a subset into the separate `YeetRunPlanModeOptions`, adding forceTurbo. The pure planner's own supported precedence is already a distinct D1 census owner; it is not evidence that runtime request conflicts succeed. |
| `internal/Handler.ts:655`, `:658`, `:678`, `:699`, `:731`, `:762`, `:795`, `:932` | Publish proof reuse, staged/worktree checks, message checks, staging and execution use validated request selections plus current repository evidence. The same options are not rewritten into one selected phase. `runPublishMode` selects startPrEarly versus ordinary post-commit work at `:964`; conflicting requests have already taken the explicit error route. |
| `internal/PublishScope.ts:879` | allowStaleBase controls an operator override while actual freshness is a separately derived record. The requested override is not a freshness fact. |
| `internal/Handler.ts:1240`, `:1288` | Status consumes remote/json; closeout constructs its own request from review thresholds and reply/retrigger selections. These are independent concerns of the original request bag. |
| `internal/Handler.ts:1621`, `:1662`, `:1707`, `:1886` | Attempt stage/env projection, journal construction, mode execution and merged preview consume selected request fields after admission. The journal writes separate mode/tier/stage facts, not a serialized YeetRunOptions bag. |
| `internal/Handler.ts:1419` | The verdict writer receives request context and actual recorded execution/result state separately. It does not promote the entire request bag into persisted operation status. |

There is no observed writer that toggles these request fields as execution
starts, finishes or changes phase. No named refined/validated version of either
owner is constructed by these guards; the validator returns void. A future
explicit validated execution model could make the internal assumption more
precise, but that would be a separate model with its own actual carrier and
complete qualification evidence. It does not retroactively turn the input
contract into a malformed stored state.

Public exposure reinforces the distinction: `commands/Yeet/index.ts:79`
exports `YeetRunOptions`, while `SharedOptions` is private. The test kit at
`src/test/Yeet.test-kit.ts:33`–`:34` exports Guards/Handler, including deliberate
diagnostic probes; it also exports Planner at `:47`. The documented
`defaultYeetRunOptions` factory is specifically for focused tests
(`Yeet.schemas.ts:531`–`:546`) and independently applies overrides. Its
permissiveness is supporting plumbing, not the proof of D1.

## E1–E4 adjudication

| Class | Bounded finding for these two request owners |
| --- | --- |
| E1 exclusive-write | No cited exclusive state transition. The adapter copies requested flags and supplies defaults. Mode-specific parser fields/default-false fields describe input grammar, not a shared Boolean phase being updated. |
| E2 exclusive-read | The potentially conflicting tuples are handled by explicit typed diagnostics before private execution. Later branch selection does not silently discard a combined request at the whole handler boundary. The separate pure planner must be judged on its own contract. |
| E3 flag/payload | No supported field/payload duplication has been established on these owners. Required message/reply strings are not presence members; their parsed Options are separate values. Numeric thresholds retain their full values and absence/default rules. |
| E4 phase implication | fast/monitor, startPrEarly/pr/monitor, noEdit/amend and pushOnly/reuseVerified are requested action prerequisites, not observed started/finished phase facts. ciParity/merged is an explicit request conflict. The source does not describe these owners as validated exclusive operation state. |

This does not say “a typed error always makes a product D1.” For example, the
canonical persisted HookPulse owner checked in the same round promises an
event-consistent ledger row; foreign fields violate that output contract even
though decoding reports an error. Here the class descriptions, pre-validation
consumers, unconditionally forwarded selections, documented rejections and
diagnostic fixtures establish an input whose intended result includes refusal.
That owner-specific purpose is the difference.

No connected cluster on these two owners passes the cited E1–E4 gate after
accounting for its full request boundary. Therefore this audit proposes no
qualified cardinality or target union. The successful-operation 4/3 pair
projections in the prior audit remain true but are not the legal-state count
of the input carrier. A union for each overlapping pair would both duplicate
shared prerequisites and fail to model the required error inputs.

The existing monitor-route D1 remains unchanged. Its explicit
`invalid-until-event` route at `Yeet.command.ts:593`–`:600` and error test at
`test/yeet-command-wiring.test.ts:80` are consistent with this owner-specific
request reasoning; they are not a blanket exemption for all CLI data.

## Proposed exact canonical notes and metadata

These are proposals for parent integration, not edits made by this audit.
Keep both existing IDs, `kind: "schema-struct"`, and `status: "disqualified"`.
Improve their anchors to the class declarations, `376` and `466`. Add
`ciParity` to the YeetRunOptions member list, giving that row eighteen members.
For SharedOptions retain the existing seventeen-member broad row and the
existing two-member `r25-cli-yeet-shared-options-ci-parity-no-fail-fast` row.
Together they cover all nineteen declared Booleans, with no member overlap.
Do not describe the seventeen-member row as a complete field inventory.
The narrow row remains independently supported and unchanged; its note makes
a stronger successful four-pair claim only for that pair in full verify.

Duplicate-cluster accounting is explicit: expanding the broad SharedOptions
row to nineteen while keeping the narrow two would make the latter a wholly
contained redundant D1 subset. This audit does not recommend that combination.
If the parent elects broad-row consolidation instead of the retained 17+2
split, it must archive and supersede the narrow row while preserving its
precise four-pair reasoning, previous canonical record, and independent
correction receipt. The proposed notes below assume the retained split.

Proposed `yeet-run-options-flags` disqualifier:

```json
{"class":"D1","note":"Named runtime request options, not validated operation state: Yeet.schemas.ts:330/411 defines handler input; Yeet.command.ts:505-539 forwards selections including ciParity; Handler.ts:1958-1969 accepts the request and reports ordered YeetCommandError diagnostics before planning/execution. Same-mode ciParity+merged and publish modifier conflicts are intentionally diagnosed (Guards.ts:140-287; yeet-merged-preview.test.ts:203-214; yeet.test.ts:3756-3781), not silently discarded. D1 concerns independently expressible requests, including refusal outcomes, not universal successful-operation legality. Post-validation helpers reuse the request; no stored options phase or exclusive-write lifecycle was found."}
```

Proposed `yeet-command-shared-options` disqualifier:

```json
{"class":"D1","note":"Seventeen selected fields of the private parsed CLI request bag before handler defaults (Yeet.command.ts:466-503); the separate r25-cli-yeet-shared-options-ci-parity-no-fail-fast row owns the other two declared Booleans. runYeetMode at 505-539 forwards selections for named runtime diagnostics and normalizes collectAll || noFailFast at 515. Actual publish flag sets admit the disputed same-mode requests. Mode is supplied separately and subcommands expose different flags; D1 describes request selections including refusal outcomes, not universal successful-operation legality. Preserve defaults and diagnostics; no reader treats SharedOptions as validated exclusive operation state."}
```

## Limits and preservation boundary

The conclusion is a native source adjudication of the two named owners, not
an independently rerun census, P3 approval or executed behavioral proof. No
second correction was sent to Grok. The completed correction's unresolved
result stays immutable and linked; this file supplies the additional native
reasoning for the parent's decision.

Graft tracing was used before further consumer discovery. Its trace found
the adapter reference for YeetRunOptions but missed the Effect.fn-defined
`runYeet`; its scoped textual search supplied the relevant owner references.
Those graph limitations were resolved with the supplied exact source spans
and targeted reader reads, not a claim that absent graph edges prove no use.
No new whole-corpus search was used to replace the parent's existing scope.

No tests, repository operations, remote requests, message posting, services,
inventory mutations, design changes or status transitions were executed.
The table describes behavior from source and existing fixtures; it does not
claim every Boolean vector has been exercised. An unobserved consumer that
constructs one of these bags as canonical validated state would require a
fresh owner-purpose assessment. The currently inspected consumers do not
establish that contract.

Preserve request grammar, defaults, original flag values, seven modes, three
tiers, full string/numeric payloads, diagnostic classes/messages/exit codes,
guard precedence, hydration timing, pure-plan behavior, and the separate
runtime/CLI scopes. These preservation requirements are why the rejected
operation pairs cannot simply be removed from the two request schemas.
