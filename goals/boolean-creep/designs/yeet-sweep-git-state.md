# yeet-sweep-git-state — status observation

Native Codex P2 proposal, bound to source `1c07c15495aaa42f521b887b01e943e68804606c` and origin/main `3657f8f97f7135c53c3c0b9fa99aa19093c3e5ee`. Parent admission and independent Fable P3 review remain pending. This design concerns the independently adjudicated `worktreeDirty` / `statusProbeUnreliable` cluster in `SweepGitState`; it makes no qualification or D1 claim about the rest of that carrier. The companion `../data/r29-sweep-git-state-neighbor-adjudication.md` preserves those findings. The raw seven-bit 128/60 proposal is superseded by this narrower 4/3 proposal, using the same stable inventory id.

## Current shape

`packages/tooling/tool/cli/src/commands/Yeet/internal/Sweep.ts:177–200` defines an exported `S.Class` with three required nonempty strings, seven required Booleans and seven decoded `Option<NonEmptyString>` fields. The two selected members at182 and187 are real values carried by a named data model. They satisfy the original two-Boolean net; they are neither command descriptors nor excluded function flag parameters. The decoded class is public through `@beep/repo-cli/test/Yeet` (`src/test/Yeet.test-kit.ts:67`, package.json:68), and its pure planner inputs deliberately support constructed fixtures as well as live observations.

The class contract at119–146 describes observed facts and explicitly says an unreliable probe forces the fact it feeds to the conservative value. The sole production constructor at742–771 reads one captured `git status --porcelain` result from720. `captureCommand` at518–532 trims output and turns a capture failure into exit1/empty/nontruncated. `probeUnreliable` at534–537 means truncated OR nonzero exit. The constructor writes `worktreeDirty = probeUnreliable(status) || Str.isNonEmpty(status.output)` at749 and repeats the same probe decision in `statusProbeUnreliable` at755.

The complete directly known constructor set is that production writer, the two class/planner documentation examples at154–170 and457–473, and the single `stateWith` fixture constructor at test/yeet-sweep-plan.test.ts:66–67. All its concrete call sites were read. `mergedFacts` at46–64 constructs clean/reliable. The dirty case is constructed explicitly at295–308. The truncated fixture at199–231 constructs true/true together; the real observer failure fixture at533–541 asserts the same pair. No source, example or test constructs unreliable/clean as a supported observation.

`cleanWorktreePrecondition` at262–265 is the sole direct reader of this pair: unknown produces a failed/truncated-command blocker; a reliable observation produces a clean-worktree precondition whose Boolean is the negated dirty field. No other direct production or test reader was found by indexed search plus complete `packages`/`apps` text search. The latter is corroboration, because the graph initially reported no incoming edges for the class despite its actual users.

This is a derived observation captured in a local planning snapshot. There is no independent mutation, time-based transition or new authoritative state to store. The existing primitive command result remains the upstream observation.

## Cardinality gap

The order below is `(worktreeDirty, statusProbeUnreliable)`.

| Declared tuple | Supported meaning | Exact witness or constraint |
| --- | --- | --- |
| false, false | clean | Sweep.ts:749,755 for a successful untruncated empty result; test:46–69 and442–450 |
| true, false | dirty | Same writer with reliable nonempty output; test:295–308 explicitly constructs the state and checks blockers |
| true, true | unknown | Failed or truncated result, regardless of partial output; class:141–146, writer:749,755, tests:199–231 and533–541 |
| false, true | No supported fourth observed state | Excluded by the documented forcing contract and every writer/fixture for this pair |

The selected cluster therefore has **4 representable / 3 legal states**. Generic class-schema permissiveness is not proof that false/true is legitimate. Conversely, the reader's conservative handling of a fabricated false/true tuple cannot by itself prove it illegal: the positive evidence is the declared observation contract and complete supported producer inventory. A future documented diagnostic-request caller that intentionally supports that fourth tuple would require renewed adjudication before migration.

The rest of the class is expressly outside this cardinality number. Its full Boolean/presence projection has 16,384 syntactically representable combinations (seven Boolean domains times seven actual Option-presence domains); payload values make the concrete data domain unbounded. No claim of a complete legal count is made. In particular, the real constructor fixtures for main-held/no-path and unreliable worktree list with branch-held false prevent using the live observer's image as the whole constructor domain. Required branch/ref equality and string contents do not become invented Boolean members. This follows SPEC's allowance for independently adjudicated clusters within one declaration.

## Target schema

Keep `SweepGitState` in its current file and preserve its identity, annotations, remaining fields and public decoded API location. Add `LiteralKit` to the existing `@beep/schema` import. Define one annotation-bearing literal domain near the class:

```ts
const SweepWorktreeStatus = LiteralKit(["clean", "dirty", "unknown"]).pipe(
  $I.annoteSchema("SweepWorktreeStatus", {
    description: "The status probe observed a clean or dirty worktree, or could not be read reliably.",
  })
);
type SweepWorktreeStatus = typeof SweepWorktreeStatus.Type;
```

Use `worktreeStatus: SweepWorktreeStatus` as the required class field, replacing exactly `worktreeDirty` and `statusProbeUnreliable`. Give it no constructor or decoding default: the old two Boolean fields were required, and silently defaulting to clean would violate the conservative contract. This domain is payload-free, so LiteralKit is the correct taxonomy; a tagged object per case or Option-of-literal would add a second spelling of unknown. Keep the schema and same-name runtime type local unless an actual consumer needs their explicit export. The class is already exported; its named type can refer to a local schema without widening the package facade.

Construct the status once, at the existing status writer, from the same captured result and in the same observation sequence:

```ts
worktreeStatus: probeUnreliable(status)
  ? SweepWorktreeStatus.Enum.unknown
  : Str.isNonEmpty(status.output)
    ? SweepWorktreeStatus.Enum.dirty
    : SweepWorktreeStatus.Enum.clean,
```

This is a classification of a real probe, not a custom predicate or extra stored flag. The flattest three-arm expression is sufficient; introduce no generic helper wall or conversion service. Keep `probeUnreliable` because independent worktree, remote-deletion and lockfile paths use it. Do not normalize or truncate payloads beyond the current `captureCommand` behavior. The annotation-preserving LiteralKit helper surface is already used by `SweepStepId` in Sweep.schemas.ts:72–93 and `$match` in Sweep.ts:1195; its exact local implementation is bound in `source-bindings.json`.

Replace the paired-field reader by an exhaustive schema-owned match:

```ts
const cleanWorktreePrecondition = (state: SweepGitState): SweepPrecondition =>
  SweepWorktreeStatus.$match(state.worktreeStatus, {
    clean: () => precondition("worktree is clean", true),
    dirty: () => precondition("worktree is clean", false),
    unknown: () => unreliableProbePrecondition(statusProbeCommand),
  });
```

Keep this existing helper's name and callers. No ad-hoc `isClean` / `isUnknown` helpers or parallel literal arrays are needed. Where a guard is actually required, use LiteralKit's generated `.is` or `S.is(SweepWorktreeStatus)`; do not add unused guards merely to satisfy a checklist. The only TypeScript migration is the decoded internal observation field and its known constructions/readers. Do not add an old-shape alias, legacy normalizer or public codec without an actual encoded/consumer requirement.

## Migration inventory

All relative source references in this document are under `packages/tooling/tool/cli/` unless written out fully.

| Site | Concrete migration and preserved behavior |
| --- | --- |
| Sweep.ts:67–75,119–200 | Add LiteralKit import/local schema; replace two class fields with required `worktreeStatus`; update the status-specific class explanation and examples. Keep every other declaration byte/semantic contract below. |
| Sweep.ts:712–771 | Preserve all command ordering, argv, error recovery and sampled times. Derive the new literal from the existing status result. Remove exactly the two paired field assignments. Other worktree, tip, ancestry, lockfile and PR assignments stay as-is. |
| Sweep.ts:262–265 | Replace paired-field precedence with the three-arm match above. Preserve exact blocker text and satisfaction values. |
| Sweep.ts:304–317,383–410 | Existing ff-main, lockfile-install and end-state helpers keep calling `cleanWorktreePrecondition`. Preconditions retain order and content; no new command is run during planning. |
| Sweep.ts:485–505,798–803 | Keep both data-first/data-last `buildSweepPlan` signatures, pure state-to-plan behavior and `planSweep` effect requirements. Decode/construction changes propagate through the existing class type; the output stays `SweepPlan`. |
| Sweep.ts:1186–1252,1312–1335 | Keep the same observed state for the entire sequential run, the precondition gate, step order, timing capture, skipped outcome behavior and report encoding. Do not resample status mid-plan as part of this migration. |
| Sweep.ts:154–170 and457–473 | Replace each pair of false fields with `worktreeStatus: "clean"`; all omitted Options and explicit payloads stay exactly as before. |
| test/yeet-sweep-plan.test.ts:46–75 | Replace clean/reliable merged-facts pair by a narrow `worktreeStatus` type backed by the schema. Avoid widening a string to an unconstrained string; annotate the fixture through the decoded class field type or the existing schema-derived constructor type. Keep `stateWith` supported override semantics for every untouched member. |
| Tests:199–231,295–325 | Replace only `truncatedStatusProbe` by unknown and dirty status overrides by dirty. The separate `truncatedWorktreeProbe` object and every occupancy Boolean remain unchanged. Preserve all assertion strings and plan actions. |
| Tests:533–541 | Replace the two raw status-field assertions by `worktreeStatus === "unknown"`; keep the exact failed-status blocker assertion and real capture-failure stub. |
| src/test/Yeet.test-kit.ts:66–67; package.json:65–68 | Preserve the wildcard test export and stable `SweepGitState`/planner/helper exported symbols. No new production facade, package export, dependency or test-only compatibility alias is required. |

The exhaustive type users `pullRequestIsMerged`, `mainFreePrecondition`, `branchFreePrecondition`, `pullRequestIdentityPrecondition`, the local/remote deletion plan helpers, leased-deletion argument/command helpers, runRemoteDeletionStep, both revalidation functions, refreshNotCompletedHandoff, runLockfileInstallStep, runEndStateStep, performSweepStep and runSweepStep need no field-level migration beyond the class type. Their uses are at Sweep.ts:249–250,267–291,319–381,840–862,891–975,1026–1116,1186–1252. The full source file and complete test file were read, including the late handoff fixtures at769–823.

Every unselected member must remain intact:

| Member(s) and actual type | Preserved constructor, producer and reader contract |
| --- | --- |
| `branch`, `mainBranch`, `headBranch`: required `S.NonEmptyString` | No new enum, equality bit, trimming or identifier constraint. Keep name guards at715–716, HEAD fallback at745–748, quoting and head/main routing. `branch === mainBranch` remains possible; different probes occur at different times. |
| `mainCheckedOutElsewhere`, `branchCheckedOutElsewhere`, `worktreeProbeUnreliable`: required Boolean | Preserve the current producer OR rules at750–756 and read precedence at267–278. The known-held-with-no-path tests279/285 and the unknown worktree fixture816 remain constructible, with their existing main/branch flags. Do not collapse occupancy in this change. |
| `branchMergedIntoBase`: required Boolean | Preserve ancestry.exitCode===0 AND localTip presence at753; preserve pure constructor overrides and the -d/-D action choice at326–344 and1216. Do not couple it to later PR state, remote tip or main tip. |
| `lockfileMovedOnMainUpdate`: required Boolean | Keep the pre-refresh forecast at754 and informational always-satisfied precondition at388–397, including either forecast value. The real install decision still rechecks the post-refresh window at1052–1101. |
| `mainWorktreePath`: `Option<NonEmptyString>` with optional-key/None default | Keep None for unreliable worktree probes at757–762; preserve exact path text when present. Explicit constructors allow held-with-None at tests279/285 and held-with-Some at775/789/798/807. Preserve no-path command and shell quoting at1033–1047 and tests814–821. Do not impose a bidirectional path/Boolean invariant. |
| `mainTip`: same Option/default | Preserve sampled local-main text and absence. Main is probed at723, before ancestry/lockfile; do not infer presence from a later successful command. Omission is an explicit supported documentation constructor at154–170. Unknown starting tip still installs conservatively at1062–1064. |
| `localTip`: same Option/default | Preserve exact observed value from724 and None on missing/failed/empty result; tests151–155 explicitly require two local-deletion blockers when None. Preserve ancestry and fresh-tip checks at753,902–909 and1212–1219; no reordering. |
| `remoteTip`: same Option/default | Preserve exact local remote-tracking value from725 and absence; tests255–259 require both missing-remote blockers. Keep the separately sampled server revalidation and lease at945–974 and371–381. |
| `pullRequestState`, `pullRequestHeadBranch`, `pullRequestHeadOid`: three independent declared `Option<NonEmptyString>` domains/defaults | Preserve each existing trim-to-Option projection at766–770, full nonempty string payloads and all absence distinctions. Do not narrow state to OPEN/CLOSED/MERGED. GhPrView has String state/headRefName plus optional String oid atGhSchema.ts:124–136; its one observation does not justify inventing a stricter PR data model here. Explicit fixtures include OPEN/CLOSED, missing head oid, missing head branch and mismatching identities at tests127–160,169–196,262–265. Keep independent eligibility, identity, equality and quoting checks. |

Transitive command consumers remain unchanged: Porcelain.ts:92–107,134–150 encodes/renders plan or report; Merge.ts:257 includes executeSweep's report; MonitorLoop.ts:988 invokes the sweep upon the merged route. Neither receives the raw `SweepGitState`. The production command facade does not re-export that class; its supported decoded test surface remains mapped as above. Refresh those source/consumer hashes before implementation if main moves.

## Guard-deletion accounting

The change deletes one representable incoherent tuple and its redundant representation, not any safety decision.

| Current site | Delete or replace | What remains and why |
| --- | --- | --- |
| Class fields at182,187 | Delete both parallel Boolean declarations; replace with one required literal field. | Unknown is one state and cannot accidentally claim a clean observation. |
| Constructor at749,755 | Delete the conservative OR assignment and duplicated reliability field write. | One three-way classification from the exact same probe remains; failed/nonzero/truncated still means unknown. |
| cleanWorktreePrecondition at263–265 | Delete the precedence check over reliability plus negation of the separate dirty bit. | Exhaustive literal match emits the same two descriptions and same satisfied values. The blocker itself is required output, not removable validation. |
| Status-specific prose at141–146,691–695 and fixture comment199–207 | Remove the status-pair instruction that callers must keep two bits coherent. | Keep the still-true worktree-list forcing explanation because occupancy has not migrated. Update comments to distinguish the two models. |
| No status-field normalizer exists | None claimed deleted. | Do not create a legacy-normalization wall just to remove it later. |

This is a net removal of one stored observation member and one producer Boolean-OR coherence expression, with the direct reader reduced to one exhaustive domain match. It is not honest to claim deletion of `probeUnreliable`, `holdsBranch`, `tipsMatch`, the Option matches in refreshNotCompletedHandoff, any local/remote lease check, plan preconditions, operator routing, or post-refresh rechecks. Every one of those still protects independent behavior or produces required explanation text.

## Encoded-side impact

Exposure for this selected cluster is **internal, Tier 1**, despite the existing decoded test export. The schema has an encoded side structurally, but no production code or test encodes/decodes `SweepGitState` itself. Exhaustive searches found its class, constructor, planner/helper signatures, documentation examples and one fixture file only. The package denies `./commands/Yeet/internal/*` and `./internal/*`; `./test/*` explicitly maps the test kit. Do not introduce a new wire or persisted schema for the status literal.

The actual documents remain `SweepPlan` (`Sweep.schemas.ts:182–192`) and `SweepReport` (349–360), with `SweepPlanJson` at383 and `SweepReportJson` at412. The plan contains version, creation time, branch and ordered steps; steps carry action, preconditions and `requiresOperator`, and reports echo the plan plus outcomes/times. It never includes the raw Git-state record. `SweepPrecondition` retains its `description`/`satisfied` properties at120–128. Keep every encoded key, version literal, value, array order, omission/default, quoted command and blocker message unchanged.

CLI `--plan`, `--json`, rendered text, post-merge sweeps and `.beep/yeet/sweep-report.json` therefore require output-equivalence proof, not a wire migration. The status rewrite must not alter the payloads or defaults of any of the seven untouched Options. It must not change the clean/dirty/unknown admission behavior, planning side effects, execution outcomes, or permission handoffs. If implementation discovers an actual encoded raw-state consumer, stop before deleting the old fields and repair this design with a concrete compatible boundary; no such consumer is currently evidenced.

## Test impact

No product tests were run or changed during this private P2 preparation. The complete existing `test/yeet-sweep-plan.test.ts` was inspected and source-hashed.

Implementation must migrate only the listed constructor/assertion sites, then keep all existing tests and outputs. Add focused behavior proof for the missing observer-status cases using the existing stub spawner: reliable empty output produces clean, reliable nonempty output produces dirty, nonzero/spawn failure produces unknown, and truncation produces unknown for either surviving empty or nonempty captured output. Existing failed-status coverage at533–541 is retained; the status truncation case must go through the real capture bound or a properly scoped capture seam, not merely a guessed object cast.

For each of clean, dirty and unknown, verify the in-place ff-main, lockfile-install and off-main end-state preconditions, exact blocker text and order. Keep a representative reliable-dirty observation proof that fetch-prune and remote deletion remain unaffected. Keep both forecasts and the later update-window decision separate. Use the unchanged schema codecs to compare complete encoded `SweepPlan` documents for representative pre/post migration fixtures, and preserve the existing persisted `SweepReportJson` round-trip at492–506. Use a fixed timestamp and deterministic stub outcomes for encoded comparisons; do not compare nondeterministic measured durations.

Retain all partial helper fixtures, especially main-held/None, main-held/path with spaces or quotes, unknown occupancy with its existing branch flag, missing local/remote/PR payloads, unrelated PR identity, tip drift, stale lease and generic remote denial. This selected status migration cannot be used to rewrite those fixtures into observer-only states. Add schema-derived validation coverage that the new required field accepts exactly the three literals and does not supply a clean default when omitted. Do not keep the old pair as an accepted legacy wire input without a supported consumer.

Required implementation verification is the focused sweep test file, then full `bun run beep quality package-verify @beep/repo-cli` for the touched package, including its audit/docgen expectations, and the campaign/Yeet verification required for the ordered Tier 1E batch. The parent owns admission validators for the proposed inventory row/design; independent Fable P3 must review this exact design and source first. No implementation, P3, dry round or merge claim is made here.

## Risk

The chief risk is mistaking a safe reader for an unrestricted diagnostic-request contract. Current positive documentation and complete supported status constructors establish the three-state observation; `statusProbeUnreliable=true, worktreeDirty=false` is merely representable, with no supported witness. If a new external test-kit consumer or fixture establishes that tuple as a legitimate fourth semantic observation, do not silently normalize or reject it: revisit this cluster's qualification. This finding is independent of the explicit occupancy counterexamples, which this design preserves.

The next risk is broadening this small migration into occupancy/path, PR, ancestry or lockfile cleanup. The owner note retains those findings with their uncertainties. No full-domain legal count, new D1 assertion or same-observation coupling is smuggled into the target. The old D1 seed and raw128/60 report remain historical evidence; parent integration must replace the stable row's selected members rather than add an overlapping duplicate.

This is a shared internal Yeet file. Land only after independent source-bound P3 approval and the campaign's implementation gate, in the ordered **Tier 1E internal tooling subsystem batch**, with serial edits to Sweep.ts coordinated with other records. Tier 2 schemas remain separate singleton work. Preserve the conservative status fallback, exact output and every existing mutation/revalidation rail. Do not change dependencies, package exports, generated files, capture budgets, probe timing, CLI flags or branch deletion authority. Revalidate source and known consumers after any forward main merge.
