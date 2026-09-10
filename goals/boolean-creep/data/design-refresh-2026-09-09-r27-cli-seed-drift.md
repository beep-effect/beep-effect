# R27 CLI seed-drift source adjudication

Source pin: `HEAD 8f266b878445ca8a7f751f9248da428a4dde39a1`.
Corpus pin: `origin/main 663904610cce2a38c06b0619a8c414646b69361c`.
The local `main` branch is not the corpus pin. Both required refs were read
without fetching or merging. This is a bounded native source adjudication,
not a replacement census, P3 review, or source implementation.

The assigned inputs are the footer claims in
`data/sweeps/refresh-2026-09-09-r27-main-663904/r27-cli-commands-l-q.execution.json:13`,
`r27-cli-yeet.execution.json:13`, and
`r27-boolean-state-other.execution.json:13`, plus the explicitly requested
old test-tsgo row. The raw candidate admissions remain the parent's work.
Graft discovery preceded targeted source reads; its lexical multi-symbol
results did not establish member ownership, so current declarations,
constructors, readers, fixtures, and exports supplied the proof below.

Applied `AGENTS.md`, the current SPEC/DECISIONS carrier and evidence rules,
and schema-first-development guidance. A callable is not a Boolean-valued
member. A required array's empty/nonempty predicate is not an optional
payload. An actual Option or optional Boolean must retain its full domain.
Named CLI carriers are eligible for adjudication; anonymous callback flag
parameters are excluded. An intentionally normalized request is supported
input; a request rejected by a typed diagnostic does not automatically become
a legitimate domain operation merely because its schema accepts the input.

## Complete disposition map

All 15 directly implicated canonical IDs are accounted for. Six need
withdrawal, five have bounded D1 metadata repairs, one qualified row survives,
one qualified row needs expansion under its existing ID, and two broad D1
bags need independent correction before their classification is reaffirmed.

| Canonical ID | Source-grounded disposition | Exact anchor / owning declaration |
| --- | --- | --- |
| `quality-tmpfs-reap-apply-json` | Retain D1; repair line and kind | `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:3526`, named Command config at 3528 |
| `r3-tooling-quality-law-path-gates` | Withdraw: two callable predicates and an invented carrier name | `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:2374`, 2378 |
| `r3-tooling-quality-tsconfig-profile-gates` | Withdraw: schema guard and callable path predicates; no `tsconfigGates` value | `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:350`, 1906, 2072; collector at 2038 |
| `laws-terse-effect-command-options` | Retain D1; line 68 → 85 | `packages/tooling/tool/cli/src/commands/Laws/Laws.command.ts:85` |
| `r26-cli-commands-l-q-allowlist-check-ok` | Withdraw qualification and archive design: required-array virtual axis | `packages/tooling/tool/cli/src/commands/Laws/AllowlistCheck.ts:146`, Boolean at 148 and required array at 149 |
| `r26-cli-commands-l-q-osv-ignore-expiry` | Retain qualified 4/3 and design; declaration anchor 27 → 20 is optional cleanup | `packages/tooling/tool/cli/src/commands/Quality/Quality.osv-ignore.ts:20`, real Option at 26 and Boolean at 27 |
| `yeet-run-options-flags` | Actual named carrier; add omitted `ciParity` only with independent re-adjudication of the broad D1 assertion | `packages/tooling/tool/cli/src/commands/Yeet/Yeet.schemas.ts:376`, `ciParity` at 382 |
| `yeet-command-shared-options` | Actual named carrier; broad D1 claim is not proved by raw request acceptance; independent correction needed | `packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts:466`, fields at 468–497 |
| `yeet-run-plan-mode-options` | Retain D1 for the pure planner; add `ciParity`, line 130 → 131 | `packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:131`, field at 138 |
| `yeet-handler-test-plan-options` | Retain D1 for the explicit pure-plan testing seam; add `ciParity`, line 1953 → 2013 | `packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:2013`, field at 2016 |
| `yeet-status-remote-check-phase` | Keep stable ID; expanded `[available, checked, isDraft]` is 12/5, requiring design repair and fresh review | `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:206`, fields at 208, 209, 213 |
| `r2-tooling-pr-closeout-retrigger-echo` | Withdraw: request/result fields belong to different classes | `packages/tooling/tool/cli/src/commands/Yeet/internal/closeout/Closeout.schemas.ts:24`, 156 |
| `r25-cli-yeet-shared-options-ci-parity-no-fail-fast` | Retain this particular D1 pair; correct OR reference 514 → 515 | `packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts:472`, 479, 515 |
| `r4-corpus-effect-imports-file-latches` | Withdraw: cited old names are gone, and the old row already crossed scopes | `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:1746` |
| `r3-tooling-test-tsgo-collect-gates` | Withdraw: two function values, not sibling Boolean values | `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:1317`, 1322 |

## Callable, synthetic, removed, and cross-owner records

`r3-tooling-quality-law-path-gates` names
`isLawSourcePath.pathFamilyGates`, which is not a declared object or state
carrier. `isLawSourcePath` is `(filePath: string) => boolean` at
`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:2374`;
`isEcosystemPolarityPath` is another such function at 2378. They are passed
as predicates to distinct `scopedRepoCliStep` calls at 2424 and 2476. The
intersection of their accepted paths does not make the function values a
Boolean pair. Archive the row; changing its line to 2374 would retain the
eligibility error.

`r3-tooling-quality-tsconfig-profile-gates` combines
`isTsconfigFileName = S.is(TsconfigFileName)` at
`packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:350`,
`isDirectEffectDrizzleTsconfig(filePath): boolean` at 1906, and
`isExcludedTsgoProfileTsconfig(file): boolean` at 2072. The actual
`collectLocalPluginProfileDiagnostics` at 2038 accepts configuration inputs
and returns `ReadonlyArray<string>` at 2043; it matches the actual
`resolution.plugin` Option at 2049. No stored Boolean triple or
`tsconfigGates` declaration exists. Neither a line repair to 1906 nor
relocation to the collector repairs this row.

`r3-tooling-test-tsgo-collect-gates` similarly invents
`collectTestTsgoFilesUnder.entryGates`. Its members are functions at
`packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:1317`
and 1322, passed to `collectFiles` at 1327. Their call results are consumed
separately for directory traversal at 1300 and file selection at 1306.
The exported test object at 1590 exposes these functions as `isTestFile`
and `isIgnoredDirectory` at 1591–1592; that object still does not contain
Boolean values. Withdraw, rather than reclassifying or renaming the row.

`r4-corpus-effect-imports-file-latches` cites `[fileTouched, renamed]`.
Neither identifier occurs in the current
`packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts`.
The actual per-file latch is `let fileAffected = false` at 1746. A nested
per-JSDoc `const affected` at 1763 is folded into it at 1767; the final
per-file reader is at 1772. These are an accumulator and its nested input,
not a reason to rename the removed two-member record. The historical D1
note already admitted that the old fields lived in different scopes.
Preserve that history and withdraw the live row.

`r2-tooling-pr-closeout-retrigger-echo` joins
`PrCloseoutOptions.retriggerGreptile: S.Boolean` at
`packages/tooling/tool/cli/src/commands/Yeet/internal/closeout/Closeout.schemas.ts:30`
with `PrCloseoutReport.retriggeredGreptile: S.Boolean` at 166. The classes
start at 24 and 156. `Closeout.ts:138` conditionally performs the explicit
request; `Closeout.ts:146` constructs a different report and echoes the
request into its result field at 155. This is not one co-carried pair.
The report's `reviewedHeadSha` at schema line 165 is a real independent
Option carrying a SHA; do not collapse or pair it with this request echo.
Withdraw the old row without inventing a replacement.

## Required diagnostics array versus real expiry Option

For `r26-cli-commands-l-q-allowlist-check-ok`, the actual declaration is
one Boolean (`ok`, `AllowlistCheck.ts:148`) and one **required**
`S.Array(S.String)` (`diagnostics`, 149), both with explicit defaults
(`false`, 148; empty array, 150–151). There is no optional/nullable array,
Option, tagged alternative, or declared `hasDiagnostics` Boolean.

The prior behavior receipt remains correct: the normal producer at
`packages/tooling/tool/cli/src/commands/Laws/AllowlistCheck.ts:346`
derives `ok` from array length at 347; missing-file, parse-failure, and
schema-failure writers occur at 302, 312, and 329. Tests explicitly observe
success/empty at `packages/tooling/tool/cli/test/allowlist-check.test.ts:117`
and failure/nonempty at 157. Constructor/decoding defaults support
failure/empty; do not erase that fact or reinterpret it as malformed.
The reporter branches on `ok` at `AllowlistCheck.ts:365` and prints the
count and every string at 370–373. The command separately fails on `!ok`
at `packages/tooling/tool/cli/src/commands/Laws/Laws.command.ts:619`.

Those observations establish behavior over an unbounded array. They do not
turn its required payload into a second Boolean/presence member. The old
4/3 quotient counts an invented empty/nonempty axis, like the withdrawn
required-number zero/nonzero cases. Recommend archive of canonical ID
`r26-cli-commands-l-q-allowlist-check-ok` and its design
`designs/r26-cli-commands-l-q-allowlist-check-ok.md`. Preserve
`data/design-refresh-2026-09-09-rust-allowlist-expiry.md` and the old
4/3/default-failure-empty reasoning as historical receipts, annotated by
the parent as superseded on **eligibility**, not falsified on behavior.
Do not manufacture a D1 row from this single actual Boolean.

In contrast, `OsvIgnoreEntry.ignoreUntil` is actually
`O.Option<DateTime.DateTime>` at
`packages/tooling/tool/cli/src/commands/Quality/Quality.osv-ignore.ts:26`.
Its sibling is `expiryMalformed: boolean` at 27. The sole producer parses
the raw token at 55–59 and returns the pair at 60–64. All legal abstract
tuples, with the full DateTime payload retained, are:

| `expiryMalformed` | `ignoreUntil` | Supported source behavior |
| --- | --- | --- |
| false | None | No matching expiry token; active |
| false | Some(any successfully parsed DateTime) | Valid expiry; compare the full instant inclusively with `now` |
| true | None | Matching token fails `DateTime.make`; inactive |

The fourth tuple, true/Some, is not produced. `osvIgnoreEntryIsActive`
rejects malformed at 73 and matches the Option at 78, preserving
`ignoreUntil >= now` at 80. Past, equal, and future instants remain payload
values, not extra Boolean members or hard-coded time variants.
The accepted regex is at 18, covering its existing quoted/bare token syntax;
an unmatched line keeps the existing absent-token behavior. This audit
does not broaden TOML parsing or strengthen fail-closed behavior beyond
what the current regex actually recognizes.

Current config provides real parsed instants at `osv-scanner.toml:23`
and 28. The explicit command fixture at
`packages/tooling/tool/cli/test/quality-tasks.test.ts:564` supplies an
absent expiry and at 569 a malformed token, asserting the exact retained
Bun argument and dropped-ID report at 579–580. The source example at
`Quality.osv-ignore.ts:142` supplies a future instant. The public helpers
at 105 and 154 expose raw text/DateTime inputs and ID-array outputs, not
the private entry. Retain its current 4/3 qualification, internal derived
exposure, full-payload union design, and stable ID. Its design still needs
normal exact-source review; this audit does not advance it.

## Straightforward named CLI and pure-planner repairs

`quality-tmpfs-reap-apply-json` belongs to the named Command configuration
at `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:3526`.
Both flags default false at 3529–3535. The handler calls
`runTmpfsReap({ apply })` at 3539 before independently selecting JSON at
3540 or text at 3545. The complete pair domain is
`(false,false), (false,true), (true,false), (true,true)`; all four select
supported operation/output combinations. Retain D1, repair the anchor to
3526 and kind to `object-literal` to identify the actual named config,
not the excluded destructured callback parameter at 3538. No cleanup
command was executed by this audit.

`laws-terse-effect-command-options` is the actual class at
`packages/tooling/tool/cli/src/commands/Laws/Laws.command.ts:85`.
`write`, `check`, and `advisory` are Boolean fields at 87, 91, and 97,
with constructor and decoding defaults false. `exclude` and `include`
are required strings at 95–96 with their existing defaults. The command
constructs the class at 380, forwards `write` at 383, and intentionally
derives `strictCheck = check && !advisory` at 384. All eight triples are
supported, including write+check+advisory, which writes with advisory
strictness disabled. This is supported normalization, not a rejected
operation. Retain D1 and the three members; repair line 68 to 85.

`YeetRunPlanModeOptions` has the real additional `ciParity` Boolean at
`packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:138`,
default false on construction and decoding at 139–140. Its named
`mode` domain at 84 contains all seven values: `repair`, `verify`,
`publish`, `monitor`, `closeout`, `status`, `pre-push-hook`. The imported
`YeetProofTier` preserves all three values (`full`, `cheap-gates`,
`review-fix`) from
`packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts:137`.
Do not collapse these to verify/not-verify or full/not-full members.

The pure planner has no `merged` member. It consumes `ciParity` only
inside the verify branch at `Planner.ts:744–751`: CI parity selects
its supported proof step; otherwise the tier and `collectAll` choose
ordinary proof. Other modes have their own defined branches at 742–757.
Publish explicitly applies `pushOnly`, then `startPrEarly`, then ordinary
publish precedence at 705, 712, and 725; monitor/pr attachments stay
independent. This public pure calculation does not call the runtime
cross-flag validator. Preserve its supported planning outputs rather than
importing operation guards from a different carrier.

`BuildYeetRunPlanTestOptions` is the explicit source-owned testing class at
`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:2013`,
not an excluded anonymous function parameter. `ciParity` at 2016 has a
constructor default false. Its real message is `S.Option(S.String)` at
2021; mode and tier at 2022/2029 keep the full domains above. The test
seam constructs this class at 2047 and the planner class at 2051, copying
`ciParity` at 2053 and the other fields at 2052–2064 without invoking
`validateMonitorGuards`. Explicit tests observe ordinary collect-all
verify at `packages/tooling/tool/cli/test/yeet.test.ts:818` and the
CI-parity-only plan at 833. The implementation defines the remaining
Boolean combinations through those pure branches, including unused
modifiers in modes that do not consume them. Both census bags remain D1;
add `ciParity` and repair their declaration anchors. These are app-owned
models, not external mirrors qualifying for D2.

The source-only test kit re-exports Handler and Planner at
`packages/tooling/tool/cli/src/test/Yeet.test-kit.ts:34` and 47. Preserve
this exposure and the actual optional message payload in any future
migration; no migration is justified by the omitted Boolean alone.

## Yeet runtime and SharedOptions: precise correction input, not universal D1

`yeet-run-options-flags` currently lists 17 actual Boolean fields of
`YeetRunOptions` but omits `ciParity` at
`packages/tooling/tool/cli/src/commands/Yeet/Yeet.schemas.ts:382`.
The class at 376 declares required `ciParity` and `merged` (387).
`defaultYeetRunOptions` at 546 supplies both false at 552/557 and accepts
explicit overrides at 579. `runYeetMode` constructs `SharedOptions` at
`packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts:506`, then
constructs `YeetRunOptions` at 509, preserving `ciParity` at 514 and
`merged` at 517. `runYeet` invokes `validateMonitorGuards` at
`packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts:1969`
before creating the successful operation's plan at 1979.

These are named carriers and therefore eligible for judging. Their ability
to carry a request that receives a deliberate error does not settle the
campaign's legitimate-operation domain. The following bounded cluster has
a concrete 4/3 **successful-operation** projection:

| Carrier | Exact members | Representable | Successful tuples | Rejected tuple and proof |
| --- | --- | --- | --- | --- |
| `YeetRunOptions`, `Yeet.schemas.ts:376` | `[ciParity, merged]` | 4 | 00, 10, 01 | 11 rejected by `internal/Guards.ts:183` |
| `SharedOptions`, `Yeet.command.ts:466` | `[ciParity, merged]` | 4 | 00, 10, 01 through full verify | 11 forwarded unchanged at 514/517 to the same guard |

Full verify supplies the required literal context for both nonzero tuples.
Explicit fixtures at
`packages/tooling/tool/cli/test/yeet-merged-preview.test.ts:186` and 196
assert successful merged-only and ci-parity-only operation validation.
The fixture at 209 asserts failure for both true. Default false/false
is the normal request (`Yeet.schemas.ts:546–579`). The guard also rejects
merged outside verify at `Guards.ts:160`, merged outside full at 168,
ciParity outside verify at 176, and ciParity outside full at 183.
Fixtures at `yeet-merged-preview.test.ts:166`, 176, and 206 assert the
corresponding failures. Thus neither optional fields nor some binary
fiction about required strings is needed to show the Boolean conflict.

The existing broad D1 prose also overlooks these directly encountered
successful-operation projections in the already-seeded Boolean members:

| Exact Boolean members, in the indicated order | Successful-operation tuples | Current guard |
| --- | --- | --- |
| `[fast, monitor]` | 00, 01, 11 | `packages/tooling/tool/cli/src/commands/Yeet/internal/Guards.ts:153` rejects 10 |
| `[startPrEarly, monitor]` | 00, 01, 11 | `Guards.ts:197` rejects 10 |
| `[noEdit, amend]` | 00, 01, 11 | `Guards.ts:223` rejects 10 |
| `[pushOnly, reuseVerified]` | 00, 01, 11 | `Guards.ts:237` rejects 10 |
| `[startPrEarly, fast]`, `[startPrEarly, pushOnly]`, `[startPrEarly, reuseVerified]`, `[startPrEarly, amend]`, `[startPrEarly, noEdit]` | each projects 00, 10, 01 | `Guards.ts:205` rejects each 11 |
| `[pushOnly, amend]`, `[pushOnly, noEdit]`, `[pushOnly, fast]` | each projects 00, 10, 01 | `Guards.ts:244` rejects each 11 |
| `[stagedOnly, pushOnly]`, `[stagedOnly, reuseVerified]`, `[stagedOnly, amend]` | each projects 00, 10, 01 | `Guards.ts:272` rejects each 11 |

Each table row projects four representable pairs to three operation pairs
when other fields satisfy their separate prerequisites. This is not a
complete cardinality for the 18-field bag, nor independent constructor/
fixture proof for admitting all these overlapping projections. The pairs
share prerequisites, so a future design must consolidate the actual
operation modes rather than create a union for every pair. Preserve all
seven mode literals, three tier literals, required-message conditions,
defaults, and exact diagnostics when proving that complete shape.

**Unresolved proof for the independent correction:** distinguish the
intentional raw request interface from an operation-state representation
and determine which of the source-supported constrained clusters passes
E2/E4 in that interface. Do not reaffirm either whole-bag D1 record merely
because `.make` admits requests later rejected by validation. Conversely,
do not erase those diagnostic inputs or make new unions solely from a
count of invalid requests. Preserve all current error outcomes. This audit
proposes no new qualified ID or full-bag cardinality for these two owners;
the exact candidate pairs, operation witnesses, and uncertainty are above.

Keep the existing `yeet-monitor-command-route` ruling unchanged. Its current
specific reasoning is: “Raw CLI adapter selections remain freely
constructible; the selector intentionally maps invalid until-event pairings
to an error route and otherwise applies precedence, so this is input
validation rather than stored domain state.” That ruling is not a blanket
proof that the different Yeet operation request bags have no invariant.

The exact metadata to consider after independent correction is:

```json
{
  "yeet-run-options-flags": {
    "line": 376,
    "members": ["allowStaleBase", "amend", "ciParity", "collectAll", "fast", "json", "merged", "monitor", "noEdit", "plan", "pr", "pushOnly", "remote", "retriggerGreptile", "reuseVerified", "stagedOnly", "summary", "startPrEarly"]
  },
  "yeet-command-shared-options": {
    "line": 466,
    "members": ["allowStaleBase", "amend", "collectAll", "fast", "json", "merged", "monitor", "noEdit", "plan", "pr", "pushOnly", "remote", "retriggerGreptile", "reuseVerified", "stagedOnly", "startPrEarly", "summary"]
  }
}
```

This block is a partial metadata handoff, not inventory JSONL. It
deliberately supplies no replacement D1 rationale before the boundary
question is independently resolved. `SharedOptions`' additional
`ciParity`/`noFailFast` pair already has its own canonical row; do not
duplicate it in the broad bag as a new discovery.

That particular pair remains independent: `ciParity` selects the verify
proof, while `noFailFast` participates only in the supported input
normalization `collectAll || noFailFast` at `Yeet.command.ts:515`.
The two aliases `collectAll` and `noFailFast` also accept all four input
pairs and map 00→false, 01→true, 10→true, 11→true. Combined true is
neither rejected nor an impossible internal tuple. `verifyFlags` at
389 includes CI parity and the shared flags from 378, whose two aliases
occur at 380/383. In full verify with merged false, all four
`[ciParity, noFailFast]` tuples are supported; no operation guard constrains
their conjunction. Do not join the output `YeetRunOptions.collectAll`
back to a differently owned raw field to invent a three-bit echo record.

## Expanded YeetStatusRemote phase: retain the stable ID and legacy payloads

`packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:206`
declares `available: S.Boolean` (208), `checked: S.Boolean` (209), and
`isDraft: S.optionalKey(S.Boolean)` (213). This is an app-owned persisted
remote summary: the available/checked workflow is authored locally around
the GitHub call. It is not the raw `GhStatusPullRequest` mirror beginning
at 317, whose `isDraft` Boolean is required. D2 does not erase the summary's
phase invariant merely because one payload originated at GitHub.

The complete draft-aware quotient is `2 × 2 × 3 = 12`, not eight.
Its five supported tuples are:

| `available` | `checked` | `isDraft` | Source / explicit supported observation |
| --- | --- | --- | --- |
| false | false | absent | `Status.ts:858–862`; rendered fixture `test/yeet-status-triage.test.ts:166` |
| false | true | absent | no-PR/truncated constructors `Status.ts:926–937` |
| true | true | absent | legacy rendered fixture `test/yeet-status-triage.test.ts:153–161`; actual artifact writer fixture `test/yeet-artifact-writers.test.ts:355–377` |
| true | true | false | producer `Status.ts:972–976`; `openRemote` fixture `test/yeet-status-triage.test.ts:93–99` |
| true | true | true | same producer; explicit draft fixture `test/yeet-status-triage.test.ts:358–374` |

Every abbreviated path in this table is under
`packages/tooling/tool/cli/src/commands/Yeet/internal/` for `Status.ts`,
or `packages/tooling/tool/cli/` for `test/...`.
The source/example/fixture constructor search found no supported draft
value on a skipped or checked-absent summary and no available/unchecked
summary. Generic codec permissiveness is not a sixth operation state.
The legacy available/checked/absent fixture is **not** merely arbitrary
round-trip input: it is rendered for legacy triage at 153–161, used for
legacy check summaries at 458–475, and written as a status artifact at
`yeet-artifact-writers.test.ts:372`.

`deriveYeetMergeReady` gates on checked+available at `Status.ts:1112`
and uses `remote.isDraft === false` at 1117. Absent draft therefore remains
distinct from explicit false and must not become “not draft” by default.
Both absent and explicit true currently fail the not-draft criterion, but
their encoded values remain distinct.

The expanded design can retain a payload-free LiteralKit phase with five
values: skipped, checked-absent, checked-present-draft-unknown,
checked-present-not-draft, checked-present-draft. A compatibility codec
maps those values to exactly the five tuples. Do not confuse “not draft”
with merge-ready. Keep every other sibling payload and its existing
optional/default behavior unchanged: `detail`, all count fields,
merge/state/review strings, PR identifiers and URL, rerun guidance,
`unresolvedReviewThreads`, and the full Option payloads
`unresolvedThreads`/`headSha` at `Status.ts:226–227`. No additional
relations over those fields are established by this bounded audit.

Repair `designs/yeet-status-remote-check-phase.md` in place after independent
correction. Its old three-phase codec plus independent optional `isDraft`
does not eliminate the residue. Required encoded `available` and `checked`
keep their names and lack of defaults; encoded `isDraft` keeps its omitted,
false, and true alternatives. Preserve the `yeet-status/v1` snapshot field
at `Status.ts:277`, its JSON codec at 311, and writer at 1386/1391/1398.
Public exports at `commands/Yeet/index.ts:31` and 34, the test kit at
`src/test/Yeet.test-kit.ts:8`, and every direct constructor in
`test/yeet.test.ts`, `test/yeet-status-triage.test.ts`, and
`test/yeet-artifact-writers.test.ts` form the decoded migration surface.
The new phase deletes the existing availability implication reconstruction
and absorbs the draft criterion; exact omission and legacy rendering
fixtures remain mandatory. This handoff writes no design or source changes.

## Proposed complete inventory records for parent integration

These seven JSONL rows are schema-valid proposals only: five bounded D1
repairs, the retained OSV row with its declaration anchor, and the expanded
status row. The status proposal uses `confirmed` to avoid claiming the
expanded 12/5 shape has already been designed/reviewed. This is not an
actual status mutation; the parent owns re-adjudication, integration, and
review. No new canonical ID is introduced by these proposals.

```jsonl
{"schemaVersion":"boolean-creep-inventory/v1","id":"quality-tmpfs-reap-apply-json","file":"packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts","line":3526,"symbol":"tmpfsReapCommand","kind":"object-literal","members":["apply","json"],"status":"disqualified","disqualifier":{"class":"D1","note":"Named Command config declares independent apply and json flags at 3529 and 3533. runTmpfsReap consumes apply before output selection at 3539-3545, supporting all four input pairs including applied JSON output. The anonymous handler parameter is not the census carrier."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"laws-terse-effect-command-options","file":"packages/tooling/tool/cli/src/commands/Laws/Laws.command.ts","line":85,"symbol":"TerseEffectCommandOptions","kind":"schema-struct","members":["write","check","advisory"],"status":"disqualified","disqualifier":{"class":"D1","note":"Named CLI schema supports all eight flag triples. The command constructs it at 380, forwards write at 383, and intentionally normalizes strictCheck to check && !advisory at 384. Advisory plus check is supported softening, including when write is also true."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"yeet-run-plan-mode-options","file":"packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts","line":131,"symbol":"YeetRunPlanModeOptions","kind":"schema-struct","members":["amend","ciParity","collectAll","fast","monitor","noEdit","pushOnly","remote","startPrEarly","pr","forceTurbo"],"status":"disqualified","disqualifier":{"class":"D1","note":"Public pure-plan options: ciParity defaults false at 138-140 and selects the verify proof at 744-751; other mode branches ignore it. Publish modifiers have supported priority behavior at 705-734. The pure planner does not invoke runtime request guards and has no merged member. Preserve all seven mode literals and three tier literals."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"yeet-handler-test-plan-options","file":"packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts","line":2013,"symbol":"BuildYeetRunPlanTestOptions","kind":"schema-struct","members":["amend","ciParity","collectAll","fast","forceTurbo","monitor","noEdit","pr","pushOnly","remote","startPrEarly"],"status":"disqualified","disqualifier":{"class":"D1","note":"Actual source-owned testing schema, including ciParity at 2016. The explicit pure-plan seam constructs this class at 2047 and forwards all flags to the planner at 2051-2064 without runtime operation validation. Its supported planning combinations and Option message payload are not an external D2 mirror or anonymous function flag bag."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r25-cli-yeet-shared-options-ci-parity-no-fail-fast","file":"packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts","line":472,"symbol":"SharedOptions","kind":"schema-struct","members":["ciParity","noFailFast"],"status":"disqualified","disqualifier":{"class":"D1","note":"This specific pair supports all four combinations in full verify with merged false. ciParity selects the proof lane; noFailFast is intentionally normalized into collectAll by OR at 515. This does not assert that every flag in the broader SharedOptions bag is independently valid."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r26-cli-commands-l-q-osv-ignore-expiry","file":"packages/tooling/tool/cli/src/commands/Quality/Quality.osv-ignore.ts","line":20,"symbol":"OsvIgnoreEntry","kind":"type-literal","members":["expiryMalformed","ignoreUntil"],"status":"designed","evidence":[{"class":"E1","cite":{"file":"packages/tooling/tool/cli/src/commands/Quality/Quality.osv-ignore.ts","line":63},"note":"The sole producer sets malformed only when a matching raw expiry token exists and DateTime.make returns None; true with Some(DateTime) is never emitted."},{"class":"E4","cite":{"file":"packages/tooling/tool/cli/src/commands/Quality/Quality.osv-ignore.ts","line":73},"note":"The active reader rejects malformed entries then matches the actual Option<DateTime>; preserve false/None, false/Some(full DateTime), and true/None."}],"cardinality":{"representable":4,"legal":3},"storage":"derived","exposure":"internal","targetShape":"tagged-union","tier":1,"notes":"Retain the existing private full-payload expiry union design and earlier source receipts. Preserve actual quoted/bare regex acceptance, absent-token behavior, inclusive instant comparison, ID order, console output, and Bun arguments. No decoded entry is externally exposed. Current source adjudication: data/design-refresh-2026-09-09-r27-cli-seed-drift.md."}
{"schemaVersion":"boolean-creep-inventory/v1","id":"yeet-status-remote-check-phase","file":"packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts","line":206,"symbol":"YeetStatusRemote","kind":"schema-struct","members":["available","checked","isDraft"],"status":"confirmed","evidence":[{"class":"E1","cite":{"file":"packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts","line":858},"note":"Skipped emits false/false with draft absent; checked-absent emits false/true with draft absent at 926-937; checked-present emits true/true with the complete Boolean draft value at 972-976."},{"class":"E4","cite":{"file":"packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts","line":972},"note":"Available implies checked, and a produced draft value implies checked-present. Preserve the separate supported legacy checked-present/draft-absent tuple rendered in yeet-status-triage.test.ts:153-161 and written in yeet-artifact-writers.test.ts:355-377."}],"cardinality":{"representable":12,"legal":5},"storage":"stored","exposure":"persisted","targetShape":"literalkit","tier":2,"notes":"PROPOSED stable-ID expansion pending independent correction and design repair. isDraft is optional Boolean with absent/false/true, not a two-state presence bit. Five phases preserve every legal tuple and every unrelated sibling payload. Keep status JSON property names, omissions, values and version; draft absent must not normalize to false. Current source adjudication: data/design-refresh-2026-09-09-r27-cli-seed-drift.md."}
```

## Exact parent actions and review boundary

1. Archive and withdraw these six IDs from the live inventory, preserving
   their prior records and receipts:
   `r3-tooling-quality-law-path-gates`,
   `r3-tooling-quality-tsconfig-profile-gates`,
   `r3-tooling-test-tsgo-collect-gates`,
   `r4-corpus-effect-imports-file-latches`,
   `r2-tooling-pr-closeout-retrigger-echo`, and
   `r26-cli-commands-l-q-allowlist-check-ok`.
   Only the last has an implicated active design to archive:
   `designs/r26-cli-commands-l-q-allowlist-check-ok.md`.
2. Integrate the five bounded D1 metadata repairs after validating this
   handoff. Retain the OSV qualification and full-payload design; optionally
   improve its anchor to the owning type declaration at 20.
3. Queue independent correction for the six eligibility withdrawals,
   the 12/5 expansion of `yeet-status-remote-check-phase`, and the precise
   Yeet runtime/SharedOptions operation-versus-request question. The two
   footer reports' “seeds still present” wording cannot certify carrier
   eligibility or universal D1 independence.
4. On acceptance of the status expansion, repair its existing design and
   obtain fresh review. Do not inherit the old reviewed claim for the
   newly added draft axis. No parallel new status ID or qualified
   `ciParity` record is admitted by this audit.
5. Preserve the independent raw candidate adjudications, the existing
   `yeet-monitor-command-route` reasoning, all explicit legal fixtures,
   every current error outcome, and all prior source receipts.

Validation: the seven complete proposal rows were extracted from the
`jsonl` block and validated with
`bun goals/boolean-creep/ops/validate-inventory.ts /dev/stdin` (read-only
input stream). Product tests are neither required nor claimed for this
source-only audit. No canonical inventory, design, source, test, dependency,
lockfile, status, branch, or git ref was changed by this lane.
