# Effect rules on their own diagnostics lane Spec

## Objective

Run Effect language-service rules from the reviewed @effect/tsgo pin in a separate diagnostics lane. Keep shared rules gating required Check until that lane is promoted; the tsgo pin no longer waits on ts-rust.

## Non-Goals

- Upgrading tsc-rs or the stock TypeScript pins; unrelated source refactors; git commits and publishing.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- Catalog/lock, Effect policy, CLI quality lane, hosted/local quality wiring and toolchain docs.

## Constraints

- Keep tsc-rs 0.6.0; measure all discovered check/test projects before changing gates.
- NO-GO stops implementation. Orchestrator owns commits, publication and lifecycle completion.

## Acceptance Criteria

- [x] All-project spike completes with shared-rule coverage parity and new-rule census.
- [ ] On GO: standalone lane runs locally and hosted with identical command.
- [x] Required package proof, check and cheap gates pass or are attributed.
- [x] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/effect-rules-diagnostics-lane/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/effect-rules-diagnostics-lane/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/effect-rules-diagnostics-lane` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each in the Decision Log.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-14 | Spike 0.53.0, retaining tsc-rs 0.6.0. | Latest requested rules; actual npm tarball and CLI are available. | Restore the eight 0.51.1 catalog pins and reinstall. |
| 2026-10-15 | Derive diagnostics projects from workspace and root canonical check scripts, expanding tsc-rs build references; select root configs alongside changed workspaces and root files. | Required diagnostics must cover scripts, stories, examples, drizzle and configs after compiler Effect exit flags are ignored. A real-repository parity test prevents config-kind drift and missing declared programs fail discovery. | Restore embedded compiler rule gating before removing equivalent standalone coverage. |
| 2026-10-14 | Discover all 288 check/test configs instead of hardcoding 284. | Live tree has 152 check and 136 test projects. | Use an explicit reviewed project list. |
| 2026-10-14 | Retain full original plugin config in the spike; enable nine new rules at error only in its override. | Count all new findings without changing gate severity ahead of GO. | Remove the spike override. |
| 2026-10-14 | Use a serial scan inside one admitted job and retain time -v for every compiler process. | Repeatable wall/RSS evidence without multiplying compiler memory; queue time excluded from scan timing. | Re-run under an explicitly recorded concurrency. |
| 2026-10-14 | Attribute root check's strictEffectProvide failure with the preserved 0.51.1 binary. | Both versions report the same existing test line; the bump must not be blamed without comparison. | Re-run the two compiler versions after the owning lane repairs the test. |
| 2026-10-14 | Correct the spike's root override for effect-drizzle's two configs and the no-plugin mock-monorepo fixture; remeasure those targets. | A uniform override changes existing policy, producing a false shared-rule mismatch; the existing exception must remain. | Repeat a clearly labeled all-rules experiment without claiming parity against project policy. |
| 2026-10-14 | Production discovery uses declared workspace roots: 152 check and 135 test configs; the empty nested mock-monorepo fixture is excluded. | Its config is test input, has no Effect plugin and includes a nonexistent test directory; scanning it is not repo coverage. | Add an explicit reviewed extra-project list if fixture diagnostics become an acceptance target. |
| 2026-10-14 | Relax the tsc-rs/Effect pin coupling; Effect diagnostics own rule enforcement. | The complete workspace spike and positive canary preserve shared-rule coverage while arming newer rules. | Re-couple when tsc-rs ports the newest rules, prove parity, then remove the separate lane. |
| 2026-10-27 | Reversal taken by `goals/tsrs-gates`: the Effect-patched tsrs (`@effect/tsgo` 0.59.0) knows every rule, parity was proved on all check projects, the profile folded into the compiler maps, the ignore flags went false and this lane was removed. | The precondition named in the row above is met; Check gates the rules in about four minutes instead of a separate 20-minute job. | Restore the lane from the commit before `goals/tsrs-gates` PR 2 and set the flags back to true. |
| 2026-10-14 | Select 0.53.0 for all eight Effect packages; retain tsc-rs 0.6.0. | Actual latest package completes the spike with no shared-rule loss. | Restore the eight 0.51.1 pins and reinstall, restoring the old rule policy together. |
| 2026-10-14 | Put the serial CLI body in Quality/EffectDiagnostics.ts and invoke it from the heavy Check root task. | A 23m44s / 7.73 GiB scan is unsuitable for cheap gates; hosted/local Check share the existing task dispatcher. Architecture command exposes slice/package scaffolds, not helpers; this follows the adjacent CheckCensus module. | Remove the root task step and command registration; keep its proof before removing the independent gate. |
| 2026-10-14 | Set all ignoreEffect*InTscExitCode flags true; preserve diagnostics in editors and standalone CLI. | Canary proves only TypeScript errors determine compiler failure; the old port may print nonblocking diagnostics. | Restore false only when the compiler and independent rule policy are deliberately re-coupled. |
| 2026-10-14 | effectSleepZeroToYieldNow = error. | Lane H policy; zero spike findings. | Set off with a reviewed disabled-rule ledger entry. |
| 2026-10-14 | flatMapToTap = error. | Lane H policy; its earlier fixes leave zero findings. | Set off with a reviewed disabled-rule ledger entry. |
| 2026-10-14 | preferEffectArray = error. | Code law prefers Effect helpers; repair two Array.join sites. | Restore those calls and declare the rule off with a reason. |
| 2026-10-14 | preferEffectRecord = error. | Code law prefers Effect helpers; repair three test sites. | Restore those calls and declare the rule off with a reason. |
| 2026-10-14 | preferSchemaTaggedError = error. | Lane H policy; zero findings. | Declare the rule off with a reviewed reason. |
| 2026-10-14 | schemaClassMissingBrand = error. | schema-opaque-default SPEC D4/D7 requires arming at the bump; full spike finds zero. | Change only with that packet's owner and update the explicit disabled-rule ledger. |
| 2026-10-14 | errorPayloadShadowsName = error. | Six payload fields hide Error.name in logs; rename the fields and migrate callers. | Revert the migrations together and explicitly disable the rule. |
| 2026-10-14 | preferNamespaceImport = off. | Upstream opt-in; 3,874 intentional named-import locations need an independent migration, not an implicit reinterpretation of editor preferences. | Migrate the imports, remove the disabled-rule entry and arm at error. |
| 2026-10-14 | preferBarrelImport = off. | Upstream opt-in; barrel imports contradict the Effect module-path law. | Change the import law and package preferences, then arm the rule and remove its ledger entry. |
| 2026-10-14 | Rename five exported catalog error payloads to instrumentName and ship a major observability changeset; internal SqlNameError uses sqlName. | Avoid Error.name collisions without hiding the correctness rule; consumers and documentation migrate in the same diff. | Revert the major changeset and all payload migrations together before release; after release use a deliberate major compatibility change. |
| 2026-10-14 | Include existing test/tsconfig.json projects in production discovery. | The CLI test config is not named tsconfig.test.json; changing compiler exit policy must not lose its Effect-rule coverage. | Replace the fallback only with a proven equivalent target or a real root test overlay. |
| 2026-10-14 | Bound each diagnostic child to five minutes using the existing scoped process runner. | The slowest measured project takes 46.634 seconds; a stuck compiler must fail and be reaped rather than hold the lane forever. | Raise the duration after measuring a larger valid project. |
| 2026-10-14 | Use quick package proof only for oip-web/todox's copied plugin configuration. | Their runtime source is unchanged; lint and typecheck validate the profile edit. All five packages with implementation/test changes get full audit and docgen. | Run their default package proofs if the orchestrator wants the broader app suites. |
| 2026-10-14 | Keep the CLI registration Example compile-only; retain the complete titled code sample. | Doctest purity classifies effect/cli Command.make as child-process; no runtime marker is admitted by that analyzer. | Add the marker after the analyzer distinguishes CLI commands from child-process construction. |
| 2026-10-14 | Repair two additional CLI test Array.join sites and one Object.values site. | The newly included CLI test project reveals three new-rule findings beyond the original 287-project spike; helper replacements preserve fixture text and record traversal. | Restore the calls only if the corresponding rules are deliberately disabled with reasons. |
| 2026-10-14 | Keep the missing timestamp assertion with R.has<string, unknown>. | This deliberately probes outside the statically known encoded key union; an explicit read-only string-key domain preserves native own-property semantics without a cast. | Use a schema-derived runtime key check with equivalent own-property behavior. |
| 2026-10-14 | Acknowledge runtime-required audit inbox rows without creating commits. | The runtime guard overrides the lane's Yeet restriction for acknowledgements; local-shard rows reject observed-only acknowledgement. Semantica/drizzle scoped one-hour receipts are now backed by passing default proofs; CLI's remaining archive/live mismatch is checkout-state-only. | Fresh proofs resolve the corrected shards; the orchestrator commits the packet and reruns the CLI audit. No standing CI waiver is requested. |
| 2026-10-14 | Refresh the Effect Vitest inventory's existing EV014 occurrence through its owned writer. | A.join changes enclosing callback syntax, not the existing BunCrypto resource site; research/effect-vitest-inventory-review.md compares the rows. Statuses and severities remain unchanged. | Restore the old inventory together with the old fixture construction. |

| 2026-10-14 | Amended performance brief supersedes serial Check placement and the public rename decision above. | Orchestrator explicitly moves the full sweep outside Check and owns a separate API PR. | Restore only through a new reviewed placement/API decision. |
| 2026-10-14 | Keep tsc-rs exactly 0.6.0. | 0.7.0 exists as of 2026-10-14 and still ports effect-tsgo 0.51.1; it is irrelevant to independent 0.53 rules. Tagged primary source snapshot is in h2-logs/tsc-rs-070-readme.md. | Upgrade in the compiler owner's separate PR after its own proof. |
| 2026-10-14 | schemaClassMissingBrand = off in root and all copied profiles; six declared-off rules. | Amended owner instruction reserves the one-key activation for schema-opaque-default's closing PR; post-#1758 spike found zero sites. This supersedes the earlier error row. | Closing PR flips this key to error and removes its disabled-rule ledger entry. |
| 2026-10-14 | Split the five exported catalog payload renames and major changeset into the cache patch; retain private SqlNameError.sqlName. | Public API changes need their own PR; five exact next-line errorPayloadShadowsName suppressions preserve API compatibility while keeping the rule error elsewhere. | Apply the reviewed split patch and remove these five directives in the rename PR; PR number is assigned by orchestrator. |
| 2026-10-14 | Reuse workspaceCoverageScopeOwners and the shared inverted dependency walk for --base. | Diagnostics includes labs and non-coverage packages, unlike coverage policy. Extract an unfiltered mode without changing existing coverage selection. Root compiler/lockfile/runner changes invalidate all; repository prose selects none. | Remove the diagnostics selector and unfiltered wrapper if replaced by an equally tested shared planner. |
| 2026-10-14 | Add a separate heavy GithubCheckLaneSpec and Heavy / Effect Diagnostics matrix job; remove the root Check step. | PRs run --base origin/<base>; trusted main pushes run full. Both call quality effect-diagnostics, with hosted cgroup MemoryMax=19G and MemorySwapMax=0. | Restore the Check step only after proving its critical-path budget; remove duplicate hosted job together. |
| 2026-10-14 | Add bounded Effect.forEach concurrency with schema integer range 1..6, --concurrency and BEEP_EFFECT_DIAGNOSTICS_CONCURRENCY. | Docgen precedent uses Config.Int with flag precedence; invalid values fail decoding instead of silently widening load. Project reports aggregate after concurrent execution. | Restore serial traversal and remove flag/env together. |
| 2026-10-14 | Measure on taskset CPUs 0-7 and sample /proc/meminfo plus descendant RSS every second. | Host reports about 125.13 GiB MemTotal and has unrelated activity; retain absolute system use, baseline delta and attributable RSS separately instead of claiming a clean 32-GiB VM. | Remeasure on an isolated m7i.2xlarge runner. |
| 2026-10-14 | Do not merge main in the lane. | Owner reports #1792 fixes AgentMessage.runtime.test.ts:322; AgentMessage.store.ts:200 belongs to another owner. | Orchestrator merges main, then repeats affected proof. |

| 2026-10-14 | Use systemd transient service transport for the hosted 19-GiB cap, with no swap, named-unit cleanup and 85-minute RuntimeMaxSec. | The local scope bus probe fails, but the same service transport as beep-heavy succeeds with the exact memory properties. Preserve environment by name, never printing values. | Restore scope transport only after actual runner proof; keep equivalent hard cap and cleanup. |

| 2026-10-14 | Seed the new independent heavy lane under TTC ruling 76 with a post-A1 external-run cost source and regenerate its handoff fixture. | Full package audit requires every pre-push lane in the scheduler seed. Use measured eight-CPU serial 1497.811s as a conservative single-run proxy, explicitly not hosted P50; first-red share is zero by absence. | Remove the seed/source/fixture row with the lane, or reseed from actual hosted history. |
| 2026-10-14 | Encode P2 phase as in-progress, leaving the packet lifecycle active. | GoalPhaseStatus has pending/in-progress/complete/superseded; blocked is a session state, not a valid manifest phase. | Change to complete only after orchestrator merge/closeout. |

| 2026-10-14 | Separate the scoped project process/coverage boundary from selection and aggregate completed reports after Effect.forEach. | Fallow new-only audit identified cognitive complexity 10; separation and a flat diagnostic traversal yield zero findings without suppressions. | Inline only if equivalent structure passes the same complexity gate. |
| 2026-10-14 | Construct directive fixture strings from a shared prefix. | The language service treats a literal next-line directive string in a test as an unused directive (TS377000); constructed text keeps runtime assertions identical. | Restore literal text only after upstream stops interpreting it as a directive. |
| 2026-10-14 | Refresh the observability catalog through its writer, including inherited stale rows. | --check initially fails for the two H2 spans and existing stale AgentMessage/Knowledge/Session/Worktree entries; the canonical projection now passes. | Restore generated files with source that reproduces their old inventory. |

| 2026-10-14 | Final capped PR/full-coverage proof replays the hosted resource adapter and CI dispatcher before the same quality CLI body. | Wrapper processes count against MemoryMax too; direct CLI tuning alone cannot prove the hosted process tree fits 19 GiB. Root compiler/lockfile edits make --base origin/main select the full 291-project inventory; this replay also exercises the requested affected quality command. | Remove wrapper replay only if equivalent hosted measurements cover its overhead. |

| 2026-10-14 | Keep the default at concurrency 2 (CLI flag overrides Config.Int environment fallback). | All 291 projects complete in 717.407s with 11.89 GiB sampled cgroup memory, versus serial 1497.811s. Four workers reach 21.52 GiB and six already exceed 24.62 GiB, so both fail the approximately 19.2-GiB capacity criterion. | Remeasure the same inventory/CPU/cgroup conditions and select a faster capacity-safe setting; update docs and tests together. |
| 2026-10-14 | Exclude OP_* automation credentials from the capped service environment forwarding. | Diagnostics and resource sampling need no secret operation; the local capped proof also forwards no OP_* values, preserving the binding credential boundary. | If a future lane needs secrets, use its approved lane-scoped op wrapper rather than forwarding automation credentials. |
| 2026-10-14 | Give both new exported selectors dual data-first/data-last overloads and decode typed CLI options with Schema.decodeEffect. | Final log review found two missingPipeableSignature and one preferTypedSchemaDecoder errors introduced by H2. Preserve selection/runtime validation semantics and verify the full census after repair. | Revert only if the public helper laws and decoder typing contract are deliberately changed; never suppress these rules. |
| 2026-10-14 | Renew the two runtime-required local shard receipts after expiry during the long proof. | P0 reminders re-raised stale repaired Semantica/Drizzle rows; no lane commit SHA may be invented. All four wave acknowledgement commands return 0; latest expirations 2026-10-15T02:57:22Z / 2026-10-15T02:57:43Z. | Orchestrator replaces local receipts with committed fix evidence after integration; no hosted waiver is requested. |

### Review wave 1 decisions (2026-10-14)

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-14 | Review wave 1 supersedes the true ignore-flag decision: keep all three ignoreEffect*InTscExitCode flags false in root and copied profiles; keep Heavy / Effect Diagnostics required: false. | Required Heavy / Check must continue gating the shared embedded 0.51.1 Effect rules; newer 0.52/0.53 rules run only in the non-required diagnostics lane during rollout. | After one green main diagnostics run, mark the lane required, add its context to the main ruleset with repo ruleset tooling, then flip all three flags true. Never flip before both descriptor and live ruleset require the lane. |
| 2026-10-14 | Skip the diagnostics hosted step with a notice when its CLI module is absent from an older PR checkout. | The reusable heavy workflow runs from main while the PR checkout can predate the new lane id. | Remove the probe once every admitted checkout contains the lane. |
| 2026-10-14 | Capture stdout and stderr separately; decode only stdout and retain stderr in failure excerpts. | Runtime warnings must not corrupt valid JSON, while malformed output, incomplete coverage and unexpected exits still need diagnostic context. | Return to combined capture only if the process guarantees stderr is empty and the regression test is intentionally changed. |
| 2026-10-14 | Remove the temporary catalog suppression allowance after #1807; describe five armed 0.52 rules and deferred schemaClassMissingBrand accurately. | The public rename landed and no catalog directive remains; stale policy would admit new suppressions and misstate enforcement. | A new exception requires its own reviewed rationale and policy test; arm the brand rule only in schema-opaque-default's closing PR. |
| 2026-10-14 | Preserve the approved false ignore flags and report TS377134 unknownRuleName as a rollout blocker; retain the five-minute project bound with Effect.timeoutOrElse around scoped stream capture. | The old compiler exits 2 for nine newer rule names even on an empty package. A warning suppression or compiler-only severity profile changes the approved policy and is not hidden in this review repair. runCapturedStreams has no timeout option; the Effect combinator interrupts and closes its scoped child. | Orchestrator selects a compatible gate/profile policy or promotes the required lane before changing flags; replace the timeout only with equivalent bounded scoped cleanup. |

### Review wave 1b decisions (2026-10-14)

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-14 | Keep only the embedded 0.51.1 rule names in root and copied compiler profiles; keep all three ignore flags false. | Required Check continues gating shared rules without fatal unknownRuleName warnings. This supersedes the review-wave blocker disposition. | After one green main diagnostics run, require the lane descriptor, add its context to the main ruleset, fold the nine-key lane profile into root and copied maps, flip all three ignore flags true, then delete the lane profile. |
| 2026-10-14 | Store the nine newer severities in standards/effect-diagnostics.profile.json and decode a closed schema in the CLI. | One checked-in quality profile follows the standards configuration precedent; schemaClassMissingBrand remains off pending schema-opaque-default. Rule parity checks the combined maps. | Fold the profile into compiler maps and delete it only as part of the promotion sequence above. |
| 2026-10-14 | Resolve each effective project plugin with the installed compiler's --showConfig, preserve options and overrides, merge the lane severities, then encode --lspconfig with Schema. | --lspconfig replaces rather than merges; compiler resolution preserves extends semantics and effect-drizzle's exception without a second custom tsconfig parser or JS compiler dependency. Both scoped child captures have five-minute bounds. | Replace --showConfig only with an equally tested compiler-backed resolver; keep complete plugin merging until the profile is folded into shared config. |
| 2026-10-14 | Treat the checked-in lane profile as a global affected-selection input; retain tsc-rs 0.6.0 and Effect tooling 0.53.0. | A policy-only edit must run every project, and no compiler upgrade is needed for this separation. | Remove the selection entry together with the profile after promotion. |
| 2026-10-14 | Add the lane profile to cached parity/fingerprint and CLI test inputs, refresh the policy fingerprint through its writer, and re-record only // and @beep/repo-cli with a reviewed request. | The profile changes checker/test behavior; cache audit identifies exactly four configuration-drift blockers. Preserve all 153 other reviews, qualification scope, cache modes and commands. | Remove profile reads and these input declarations together, then review and re-record the resulting projection. |
| 2026-10-14 | Replace the attempted --showConfig resolver with get-tsconfig 4.14.3, already installed transitively and now declared through the catalog as a CLI dependency. | The real native compiler omits plugins from --showConfig output. The dedicated resolver preserves JSONC and extends without adding a hand-written parser or the JS compiler API; resolved objects are schema-decoded before merging. Integration tests use real project and temporary inherited plugin fixtures. This supersedes the earlier --showConfig row. | Replace the resolver only with an API that retains plugins and passes the same inheritance/override tests, then remove the direct dependency and catalog pin. |
| 2026-10-15 | Promote after the first green main run: descriptor required, ruleset context, all three ignore flags true; keep the standalone profile. | Main job 116271099290 passed with zero findings. A folded-map canary exits 0 with flags true but prints nine TS377134 unknown-rule warnings per tsc-rs project. | Set the descriptor required:false, remove the ruleset context and recapture, and set the flags false. |
| 2026-10-15 | Retain Go compiler programs alongside Rust programs; share test-tsgo discovery, coverage partition and synthetic-config rendering with the diagnostics lane. | Wave 2 restores t3-code check/tests and repo-cli tests: 331 candidates, including all 294 existing legacy candidates. Real-repository union and legacy-superset tests prevent either compiler from losing its rule gate; a temporary scripts finding proves Rust exit 0 and diagnostics exit 1. | Revert the shared planner and consumers together; restore compiler Effect exit-code enforcement before narrowing the lane. |

### Performance-wave GO/NO-GO numbers (2026-10-14)

| Projects in flight | Wall s | Process max RSS GiB | Peak tree RSS GiB | Peak job cgroup GiB | System peak GiB | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 1497.811 | 8.31 | 8.89 | not sampled | 94.03 | slower |
| 2 | 717.407 | 7.87 | 12.03 | 11.89 | 85.93 | GO default |
| 4 | 381.481 | 8.09 | 21.81 | 21.52 | 73.67 | NO-GO memory |
| 6 | 302.028 | 8.33 | 24.98 | 24.65 | 69.65 | NO-GO memory |

**GO at concurrency 2.** Every run completes 291 projects and 72,975 file visits.
C2/C4/C6 have identical census: two H2 missingPipeableSignature, one H2
preferTypedSchemaDecoder, and one inherited strictEffectProvide at
AgentMessage.runtime.test.ts:322. No added-version rule findings occur. C1 had
the same three H2 errors plus two unused-directive string warnings;
all five introduced occurrences are repaired. The CLI/Config default remains 2; four and six
exceed the approximate 19.2-GiB budget (60% of 32 GiB). C6 job peak above is the
kernel memory.peak; C2/C4 use sampled memory.current. Process RSS is time -v's
maximum child value; tree RSS is the sampled conservative sum. Host system peak
is MemTotal minus MemAvailable and includes unrelated work, so eligibility uses
job/tree measurements, not a host-baseline subtraction. Raw times and samples
are external; research/performance-wave.md records baseline/delta and cadence.
The repaired capped hosted PR replay completes the same full inventory in
793.080s at default 2, with 12.38 GiB kernel peak inside MemoryMax=19G,
MemorySwapMax=0. Exit 1 is solely the inherited AgentMessage finding. An independent
raw-diagnostic and full-census assertion passes, rejecting any additional rule.
--base selects the full inventory because this branch changes compiler
configuration and the lockfile. The first capped run (676.067s / 12.36 GiB) still
contained the three H2 errors and is retained as pre-repair evidence.




## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Runtime-required local audit acknowledgements (proofs now green) | Semantica and effect-drizzle | H2 | Latest runtime-required renewals expire 2026-10-15T02:57:22Z / 2026-10-15T02:57:43Z; prior default proofs and current quick proofs pass. | Corrected shards have fresh successful proofs; receipts remain as audit history. |
| Archive/live checkout-state attribution | CLI audit | Orchestrator | HEAD archive omits the untracked H2 packet while live filesystem inventory includes it. The lane is prohibited from committing. | Commit the packet, then rerun CLI audit / knowledge-doctor evaluator. |
