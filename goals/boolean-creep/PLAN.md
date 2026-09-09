# PLAN — Boolean-Creep Eradication

Mutable execution plan. Contract: [`SPEC.md`](./SPEC.md); binding decisions:
[`DECISIONS.md`](./DECISIONS.md).

## Phases

| Phase | Name | Status | Exit |
| --- | --- | --- | --- |
| P0 | Bootstrap packet | complete | Packet on disk; inventory seeded (10 confirmed + 4 disqualified) and schema-valid; decisions seeded. |
| P1 | Original inventory sweep (grok lanes) | complete | Original corpus swept until dry; lane outputs merged; 100% of qualified evidence verified. |
| G1 | GATE 1 — inventory ratification | **passed 2026-08-17** | Benjamin ratified all 46; no strikes, Tier 2 included. |
| P2 | Design (codex Sol medium) | complete | 46 per-instance documents plus one shared CLI-family design. |
| P2R | Moving-main inventory and design refresh | **in progress** | Current corpus is dry for two consecutive rounds; every qualified record has verified evidence and a corrected design. |
| P3 | Independent design review | pending | Replacement exact-source receipt covers 100% of qualified ids with zero findings. |
| G2 | GATE 2 — delegated transition | pending | P2R and P3 evidence satisfy Benjamin's 2026-09-03 bounded mandate. |
| P4 | Apply + land (codex, yeet) | pending | Tiered PRs mergeable; inventory statuses advanced to `applied`. |
| P5 | Exact-main dryness and close | pending | Two dry rounds, reflection, and `completed-retained` closeout are merged to `main`. |

## Current lane

The scanner prerequisite [PR #1059](https://github.com/beep-effect/beep-effect/pull/1059)
is merged as `be5b589aa013c8350a4fad5cdfe36a6f6188db1f`. Its [local full proof](./data/scanner-prerequisite-main702-proof.json)
passed all 35 reported steps and the 134-package coverage ratchet on the exact
published head. The canonical monitor observed required checks green before
merge; the final review-thread inspection found no threads. The recorded two
Vercel failures are provider rate limits. The monitor is terminal and the merged
scanner configuration is now available to the packet's eventual publication.

Merged main's 2026-09-09 AGENTS default is `gpt-6-astra` with `medium`
reasoning. Active operator instructions take precedence for an individual task;
record the actual model and effort in every new receipt. Completed Sol and
Astra/xhigh runs retain their original provenance. Grok remains the census route;
Fable performs independent P3 review under DECISIONS.md. The installed Claude
CLI documents the Fable model alias. The [Fable transport preparation](./data/p3-fable-transport-preparation.json)
now includes a separate prompt, model-aware result parser and proposed packet
validator. Five transport test methods and six validator fixtures pass on
synthetic inputs. A separate [review admission preparation](./data/p3-fable-admission-preparation.json)
now validates two consecutive finalized dry-round receipts and their artifact,
source, coverage and predecessor bindings. Four synthetic test methods, including
31 negative mutation cases, pass; the historical wet/source-invalid rounds are
rejected. No model call or formal review ran. The separate [input preparation](./data/p3-fable-input-preparation.json)
now implements complete bounded assignment and live repository snapshot checks.
Seven synthetic test methods pass; the current observation covers 6,376 files
and assigns all 146 qualifications to 35 lanes. These observations grant no
review admission. Actual dry evidence, the full process controller and durable
launcher, runtime/advisory-reference bindings and capability proof, final input
binding and canonical validator transition remain pending.
Historical Grok helpers and receipts retain their original provenance.

The 2026-09-03 ratification audit revoked the old zero-findings claim. All 46
original opportunities still existed and none had been implemented, but three
were wrongly classified as internal and several designs had incomplete reader,
compatibility, or sequencing inventories. The historical baseline is now 40
Tier 1 and 6 Tier 2 records before new admissions.

P2R rebuilt the current-corpus inventory and continues its residue census and design
refresh. The live inventory is **738 records: 146 qualified and 592 disqualified** (D1
382 / D2 210), with **115 Tier 1 and 31 Tier 2**. Statuses are 23 historically
`reviewed`, 123 `designed`, and 0 `confirmed`; all need replacement P3 review.

The branch now includes main `284294ee24177f13f6d3a763c5d987206d351c51`,
brought forward in commit `131603144e0b361422bd77167c64d9ff192759b2`. The
[latest merge receipt](./data/post-r31-main284-source-forward.json) preserves all
1,448 then-present packet files and records five new Graft command source files
plus the Root command registration. The CLI manifest adds only the Graft export;
existing exports and dependency declarations are unchanged. These new files need
coverage in the next census; Round 31's admitted source remains historical.

The earlier Round 31 checkpoint is `40849660801c03bcdc7e6c78dbd7695866002a5d`.
Its [main-a203 merge](./data/post-r31-main-a203-source-forward.json) preserved all
1,439 packet files and brought in six changed census files. The later
[scanner merge](./data/post-r31-scanner-merged-source-forward.json) preserved all
1,447 then-present packet files and added no census source change. Its sole
conflict was resolved to the exact verified main configuration after proving
equality of all 46 rule/path/line allowlist entries. The commit/merge hooks passed.

The [current-source installation](./data/post-r31-main-a203-parent-integration.json)
reclassifies the Runners and Tsconfig raw request owners as D1, archives their
qualified designs, and replaces the CLI family document with its complete
zero-cohort disposition. Supported combined flags and diagnostics remain part
of the public request contract. The full Runners freshness design retains its
128/27 Tier 2 qualification, with both current producers and its unresolved
encoded-input proof obligation documented. The EBS source locator is refreshed;
the TypeScript-overlay wire row is unchanged. These are packet corrections,
with no source implementation, replacement independent review, or dry credit.

The earlier Round 31 launch used main `d68f1a11dd41579660a6c72f3d3e060d6b61352d`
and source HEAD `4509872869eb87071250c67717769260f850bcf5`. Its
[source-forward receipt](./data/pre-r31-main-d68-source-forward.json) and all
frozen inputs remain historical evidence for the 3,051-file, 27-lane round.

The [pre-round installation](./data/pre-r31-main-d68-parent-integration.json)
refreshes twelve complete design documents and retains one audited design
exactly. It incorporates ten native P2 owner audits and three parent cross-file
audits, including thirteen moved disqualified source locators. Qualifications,
state counts, tiers, statuses, complete payloads and guard ownership remain
unchanged. Original inventory and design bytes are archived. These are P2
corrections; independent P3 and implementation remain pending.

Round 29 launched at `115b761d533684c5abf4ab9de83d970243c79dfc` over main
`5fc065daff16300b8435eca3f32d55564664f57c`. Its intermediate main-forward
corrections, raw settings-commit source failure and finalization bindings remain
immutable historical evidence. The current installation does not rewrite them.

[Round 29](./data/sweeps/refresh-2026-09-09-r29-main-5fc065/lane-map.json)
finished all 27 primary lanes over 3,044 source files. Every lane command
and report validator passed; native reconciliation is finalized below.
The [launch admission](./data/sweeps/refresh-2026-09-09-r29-main-5fc065/launch-admission.json)
binds the launch-time 674-record inventory, every included file, all 139 designs,
dependencies, runner, formatter and completed preceding verdict. The
[created-input check](./data/sweeps/refresh-2026-09-09-r29-main-5fc065/launch-created-inputs.json)
confirms the actual seed and lane map match those inputs. These launch checks
grant no dry-round, independent-review or implementation credit; full report
and assigned-area reconciliation follows execution.

The [terminal execution audit](./data/sweeps/refresh-2026-09-09-r29-main-5fc065/execution-audit.json)
verifies that all 3,044 admitted files, 158 dependency inputs and 139 designs
still matched launch bytes after execution. The settings commit changed exact
HEAD, so the controller correctly exited 1 with `complete: false` and
`sourceStable: false`. Twelve rendered prompts used the launch HEAD and fifteen
used the later settings HEAD; raw receipts and actual prompt provenance are
preserved separately. This round earns no exact-head dry credit.

All 27 primary completion reports and both bounded correction reports have been
read. The [parent installation](./data/r29-parent-integration.json) records
21 withdrawals, 44 new census owners and 12 corrected surviving rows; the
other 641 rows retain their exact bytes. It installs the complete Runpod
template output design at 48/7, the independently proven SweepGitState status
pair at 4/3, both scheduler staging-cleanup refreshes and the XAi citation
correction. The excluded Codegen parameter design is archived. All 141
qualified cases now have complete design surfaces; inventory and design coverage
validate structurally, with no implementation or independent-review credit.

The [dispositions](./data/r29-parent-dispositions.json) account for all 674
seeds and 39 raw occurrences. Both bounded UI and ACP corrections passed on
HEAD `1c07c15495aaa42f521b887b01e943e68804606c`, adding no qualified case.
Native review includes inherited HTML controls and two distinct ACP constructor
objects. The [final neighboring-contract installation](./data/r29-sweep-neighbor-integration.json)
adds the separately justified Sweep worktree-reliability/address case at 4/3.
The ancestry/local-tip relation remains explicitly non-admitted on insufficient
class-wide contract evidence; no D1 or broad 128/60 qualification is invented.
All raw reports remain unchanged. The [final R29 verdict](./data/sweeps/refresh-2026-09-09-r29-main-5fc065/round-verdict.json)
closes reconciliation as source-invalid and wet, with three new qualifications,
one qualified withdrawal and zero dry credit. Both packet validators pass.

[Round 30](./data/sweeps/refresh-2026-09-09-r30-main-bed30c/lane-map.json)
completed all 27 lanes across 3,049 source files without source drift. Its [launch admission](./data/sweeps/refresh-2026-09-09-r30-main-bed30c/launch-admission.json)
and [created-input verification](./data/sweeps/refresh-2026-09-09-r30-main-bed30c/launch-created-inputs.json)
bind the installed 698-record inventory, all 141 designs, source files,
dependencies and runner. The private runner pins every rendered prompt to the
admitted source and refuses HEAD/pointer drift. It accepts Round 29 as a
finalized source-invalid predecessor without granting completion or dry credit.
The [final round verdict](./data/sweeps/refresh-2026-09-09-r30-main-bed30c/round-verdict.json)
records complete native reconciliation: all 27 footers, 698 seed dispositions
and 50 raw occurrences. The [parent integration](./data/r30-parent-integration.json)
adds five designed qualifications and 35 census exclusions, corrects seven
existing anchors/kinds, and preserves original inventory and design bytes.
Both packet validators pass for 738 records and 146 designs. This round is wet
and earns no dry or independent-review credit. Main advanced
to `d68f1a11dd41579660a6c72f3d3e060d6b61352d` after execution. That update is now merged, and the source-forward design refresh is
installed. [Round 31](./data/sweeps/refresh-2026-09-09-r31-main-d68f1a/lane-map.json)
completed all 27 lanes across 3,051 files. Its [terminal execution audit](./data/sweeps/refresh-2026-09-09-r31-main-d68f1a/execution-audit.json) confirms all 3,838 frozen inputs remain unchanged and all completion footers have been read. Parent semantic reconciliation remains in progress. The [settled installation](./data/r31-settled-parent-integration.json) adds 18 disqualified census records, corrects four surviving rows, archives five obsolete rows, and installs the complete Statutes at Large design. All 36 raw occurrences are accounted in the [reconciliation progress receipt](./data/sweeps/refresh-2026-09-09-r31-main-d68f1a/reconciliation-progress.json). Four held owners still prevent final reconciliation; no dry-round credit is claimed. Its [launch admission](./data/sweeps/refresh-2026-09-09-r31-main-d68f1a/launch-admission.json)
and [created-input verification](./data/sweeps/refresh-2026-09-09-r31-main-d68f1a/launch-created-inputs.json)
bind the actual 738-record seed, all 146 designs, all 3,051 included files,
dependencies, source, runner and completed wet predecessor. This grants no
completion, dry or independent-review credit. Two current-source dry rounds
remain required. The [remote-main advance](./data/r31-remote-main-advance.json)
records newer upstream source while R31 retains its admitted inputs. The complete runner and CLI-family audits have now been installed against merged main a203: freshness retains its explicit encoded-input P3 obligation, and the Runners/Tsconfig request owners are D1. The installation preserves all earlier source-bound audit bytes. The Statutes at Large range/end audit supplies the installed complete 4/3 design under its existing ID. Three citation provenance contracts and the constitutional preamble-presence rule remain explicitly unsettled; the two precise user questions are pending. These are P2 proposals, with no implementation or current independent-review credit.

The [scanner prerequisite proof](./data/scanner-prerequisite-main-bed30-proof.json)
records the failed publication and its source/base attribution. The old-source
preview met its original coverage floors but was compared with later main floors.
No push or PR creation occurred in that attempt. The isolated branch merged main
bed30 at `a7e15be843bd0142aff7a9903302b73394f7b156`; the reviewed .gitleaks.toml
patch was then its only diff from main. The frozen install passed, but canonical
full Yeet verification failed three inherited QualityScheduler.ts coverage floors
with source and baseline both on bed30. All other lanes passed. A public
admissionStatus regression test now passes all five focused-suite tests and full
package verification (audit and docgen). Scheduler source and coverage floors
remain unchanged. That publication passed head proof but failed the bed30 merge-preview
coverage lane for Planner.ts. Its source and floors are unchanged on d68;
main d68 adds direct planner behavior tests. The [current prerequisite receipt](./data/scanner-prerequisite-main-d68-proof.json)
preserves the failed proof and records the clean merge of d68 at
`12cd15340dd99d052f99951ed80718556ed13d12`. The reviewed scanner configuration
and scheduler test retain exact bytes. Frozen installation passed, and canonical
full Yeet verification now passes all 35 reported steps on that exact commit.
Yeet reused that proof and pushed the branch, but PR creation failed to identify
the pushed head. Remote main separately advanced to `702e815971a4030806cdbd9e8f6aa9260d0d3b62`.
The [new prerequisite proof](./data/scanner-prerequisite-main702-proof.json)
records its clean merge at `04cc73e733758e39a4e15ec294f86ef74ecc66c5`,
unchanged scanner/test bytes, a passing frozen install and a running full proof.
The explicit repository/head PR fallback follows successful current proof.
Hosted checks and merge remain pending.

The preceding R28 source was `93217d998f851e2e93d9864e2b5315552eaa58a7`, after merging
main `d1b4d769fbaffddd55717f3b1ba461897dd545c5` forward. The packages/apps
corpus equals that main tree, and its frozen lock is installed with Bun 1.4.2.
The merge preserved all 846 packet files, staging for 409 packet paths, and
5,205 local graph files. The [impact receipt](./data/design-refresh-2026-09-09-main-d1b4d7-impact.md)
identifies 39 changed census files and 18 affected design documents. Completed
native audits have corrected source ownership, refreshed scheduler/Docgen
designs, and moved the existing Docgen JSON result contract to Tier 2. The
[tool approval integration](./data/r28-tier-gate-integration.json) and
[tool-name collision integration](./data/r28-driver-collision-integration.json)
admit two independently confirmed qualifications with designs. The
[quality/scheduler integration](./data/r28-quality-scheduler-integration.json)
and [callable withdrawals](./data/r28-architecture-driver-callables-integration.json)
archive excluded function/parameter owners. These changes receive no
implementation or independent P3 approval credit.

[Round 28](./data/sweeps/refresh-2026-09-09-r28-main-d1b4d7/lane-map.json)
completed all 27 primary owners successfully. Its original map contains 3,061
paths and its frozen seed has 921 records and 165 qualifications. Eleven bounded
corrections also completed. All 921 seeds and 126 raw occurrences now have
recorded dispositions, with no unresolved IDs.
The separate [scope correction](./data/r28-generated-scope-correction.json)
excludes 20 generated outputs, leaving an effective authored corpus of 3,041
files. All 15 generated-source census rows are archived and withdrawn; the
original map, seed and reports remain unchanged.
The [preflight](./data/preflight-2026-09-09-r28.json) records structural inventory
and design validation, clean source/dependencies, and the live remote main check.
The [verdict](./data/sweeps/refresh-2026-09-09-r28-main-d1b4d7/round-verdict.json)
seals the round complete and wet: 18 new qualifications, 13 corrected surviving
qualified clusters and 44 withdrawn qualifications. It grants zero dry credit.
HEAD and source bytes stayed fixed, but an external fetch advanced origin/main
to `3bb59f37c02b7d677c6a5b58651fe85bb4bb5943` after the source-bound audits.
The [advance receipt](./data/r28-finalization-main-advance.json) preserves both
pins. This is historical-source evidence. The newer main merge is complete;
its impact corrections must be integrated before the next census.

The [agent/app integration](./data/r28-agent-app-integration.json) corrects Hero
playback to 16/6 and receipt occupancy to 6/3, preserving complete payloads and
archiving two unsupported qualifications. The [observability integration](./data/r28-observability-integration.json)
admits the deployment projection at 4/2 and archives nine out-of-net qualified
owners. The [CLI first-owner integration](./data/r28-cli-first-owners-integration.json)
admits Tmpfs discovery at 26/6 and two Docgen operation objects at 8/3; it also
preserves raw request diagnostics and archives unsupported command owners.
The [command metadata repair](./data/r28-command-data-integration.json) identifies
the actual Docgen load object and restores distinct filesystem-call locators.
The [L–Q integration](./data/r28-cli-l-q-integration.json) adds coverage at 16/7,
function-scan mode at 4/3 and resolved test lanes at 4/3. It archives 33 duplicate or
excluded records and preserves raw Effect Imports requests and diagnostics;
the successful summary retains its separate exact-JSON design.
The [ScaffoldShape integration](./data/r28-cli-a-c-integration.json) promotes the
complete private 24/11 owner and preserves generated output contracts. The
[Worktree/Yeet installation](./data/r28-cli-last-parent-integration.json) adds
three qualifications, corrects full Worktree/readiness designs and archives 24
unsupported or duplicate records. The [execution audit](./data/design-refresh-2026-09-09-r28-execution-coverage-audit.md)
verifies all 38 runs and preserves the UI prompt-rendering exception.
The [retained CLI installation](./data/r28-cli-retained-parent-integration.json)
integrates the complete TemplateContext, transition, migration and Files models;
seven raw request owners return to D1 and five records are archived as excluded
or covered. All 658 unrelated inventory rows retain their bytes. The
[Tmpfs installation](./data/r28-tmpfs-owner-integration.json) adds the complete
72/14 observation owner and expands discovery to 312/13, preserving stat errors,
temporal observations, full paths and public report behavior. The final
[reconciliation](./data/sweeps/refresh-2026-09-09-r28-main-d1b4d7/reconciliation.md)
binds all 24 actual installations and the immutable pre/post-round inventories. Two earlier frozen audit documents retain their
recorded EOF whitespace; the broader HEAD-to-worktree diff check reports that
packaging issue. Inventory, design validation and GOAL.md's unstaged diff check
pass.
All original rows, designs and independent reports remain in the linked archives.

Round 25 is frozen complete and wet at its older 3,060-file corpus. Round 26 is
now fully reconciled and frozen wet/incomplete: 24 of 25 primary lanes
succeeded, one tooling lane failed at a provider output limit, and all four
bounded corrections succeeded. Its
[verdict](./data/sweeps/refresh-2026-09-08-r26-main-9b7553/round-verdict.json)
records 24 newly qualified cases, four expanded qualified clusters and eleven
qualified callable withdrawals. It receives no dry credit. Its immutable
941-record snapshot contains 162 qualified cases; the later Tika callable
withdrawal produced the 940-record immutable seed for round 27.

All 146 current qualified cases have design documents. Inventory and design
coverage validate structurally. Modeling, chart-layout, graph-worker retry,
transcript, Hero playback and receipt occupancy corrections are integrated.
The L–Q integration adds resolved coverage/test lanes and corrects raw requests.
ScaffoldShape and the Worktree/Yeet corrections are also integrated.
The retained CLI and bounded Tmpfs owner audits are integrated, and full raw/seed
reconciliation is complete. All current designs still await independent review;
historical review statuses supply no replacement P3 approval. The [UI integration](./data/r27-boolean-ui-integration.json)
admits SpinnerState 8/4, UseScribeResult 6/3 and SidebarContextValue 4/2, and
coordinates the existing speech design with its new hook-result companion.
The [remote-status integration](./data/r27-remote-status-integration.json)
expands its stable record to 12/5 and covers artifact and generic CLI encoding.
Both corrected historical reviews are reset to `designed`; no historical
`reviewed` status supplies replacement P3 approval. The seven observability
designs have exact hashes in the [attribution receipt](./data/r27-attribution-design-integration.json)
and [dataset/HookPulse receipt](./data/r27-datasets-hook-design-integration.json).

[Round 27](./data/sweeps/refresh-2026-09-09-r27-main-663904/lane-map.json)
completed all 27 primary attempts over 3,061 files. Twenty-six succeeded; the
modeling attempt exhausted its allowance, then its bounded continuation completed
all eleven assigned roots. The original incomplete execution summary remains
unchanged. The successful recovery supplies that owner's effective coverage.
All three supplemental Boolean-state jobs also completed, covering 185 files and
reporting three new UI cases. The [reconciliation](./data/sweeps/refresh-2026-09-09-r27-main-663904/reconciliation.md)
tracks primary, recovery, supplemental and correction evidence separately.

The [first seed integration](./data/r27-first-seed-integration.json),
[ontology integration](./data/r27-ontology-toolbar-integration.json), and
[configuration integration](./data/r27-tooling-config-integration.json) preserve
withdrawn rows and consolidate actual owners. The [CLI census integration](./data/r27-cli-d-census-integration.json)
adds eight disqualified records and corrects the external compiler-config
classification. The [CLI seed audit integration](./data/r27-cli-seed-drift-integration.json)
withdraws six invalid records, archives the AllowlistCheckSummary design, and
repairs five D1 records plus the retained full-payload OSV qualification.
The allowance checker behavior remains valid historical evidence; its required
array was not an eligible second Boolean or optional-payload member.

Both initial independent corrections finished successfully. The
[Normalize/proof-reuse integration](./data/r27-normalize-and-proof-reuse-integration.json)
admits two designed qualifications and retains four supported public Normalize
request tuples. The [observability withdrawals](./data/r27-observability-withdrawals-integration.json)
preserve six invalid prior owners and two archived designs. The later
[qualified integration](./data/r27-observability-qualified-integration.json)
admits seven source-verified cases, including HookPulse 162/14, three distinct
attribution carriers at 9/5 and the historical OTLP join at 9/7. The
[attribution design receipt](./data/r27-attribution-design-integration.json)
records four completed drafts and their exact hashes.

The bounded independent Yeet correction completed successfully and confirms
its concrete corrections. Its immutable [receipt](./data/sweeps/refresh-2026-09-09-r27-main-663904/r27-cli-yeet-contract-correction1.execution.json)
leaves two broad runtime-request D1 classifications unresolved. The later
[native source audit](./data/design-refresh-2026-09-09-r27-yeet-request-boundary.md)
and [parent integration](./data/r27-yeet-request-boundary-integration.json)
resolve their documented raw-request boundary: specified refusals are supported
request outcomes, while successful operation combinations remain constrained.
The source proof covers actual flags, diagnostics, fixtures and downstream
reuse. It does not claim a second independent correction or exempt other CLI
models. SharedOptions retains the disjoint 17+2 field census.

R27 is complete and wet: effective coverage includes all 27 owners, one
successful modeling recovery, three Boolean-state supplements and three bounded
corrections. Twelve new qualifications are admitted, three old qualifications
are withdrawn, and one surviving cluster expands. The [round verdict](./data/sweeps/refresh-2026-09-09-r27-main-663904/round-verdict.json)
binds the preserved reports, receipts, audits, designs and final inventory
snapshot. It gives zero dry credit. The current Round 28 census revalidates
request-owner adjudications and the remaining seed against the merged source.
Two consecutive complete dry rounds and a replacement independent zero-finding
review remain required before the packet-only ratification PR is merged and
verified on main. No product implementation has begun.

Round 24 admitted the HTML sizes disposition, then automatic continuation
terminated three active lanes after twelve primary completions; ten lanes had
not started. Its completed reports remain historical evidence, but that wet,
incomplete round cannot count as dry. Main subsequently changed five source
files, so round 25 restarts the full census at the merged source. Earlier
failed or stale rounds likewise supply no current-source convergence proof.

The pretext engine-family and shared SHACL-result qualifications were
withdrawn after public API reproductions proved all four boolean pairs legal.
Their designs are archived. The removed LegacyUrlPolicy record remains only
in the historical inventory. Current design repairs preserve null Vault
reasons, all five disconnect reasons, any coherent stored Yeet blocker, and
complete callsite/encoding inventories. Inspector cardinality is 29, internal
DMS coarse cardinality 3, and the persisted Yeet verdict cardinality 1,025.

P3 independently reviews every qualified record's evidence and design. GATE 2
passes under Benjamin's delegated authority only when the replacement
exact-source review receipt reports zero findings. No source implementation is
authorized before the packet-only PR is merged and verified on `main`.

Landing is serial: Tier 1A backend/driver state, Tier 1B DMS connection, Tier 1C
foundation UI/capability, Tier 1D application/ontology UI, Tier 1E internal tooling,
then 32 Tier 2 singleton PRs. Re-resolve and merge `origin/main` forward before every
review and publication operation; never rebase or merge a PR as the agent.

The current 113-record Tier 1 landing map is:

- **1A — backend and driver state (15):**
  `scan-state-json-lexer-flags`, `duckdb-transaction-began-closed`,
  `drivers-stream-state`, `drivers-migration-journal-shape-row`,
  `phoenix-prompt-read-exists`, `venice-sse-done-payload`, `xai-sse-done-payload`,
  `xai-websocket-message-binary`, `cosmos-backend-selection-webgl2`,
  `r3-arch-ecosystem-internal-pg-timestamp-timezone`,
  `r3-drivers-arch-folder-resolution-blocked-provider`, `obs-qa-scene-provisioning`,
  `vault-sync-push-failure-disposition`, `receipt-fallback-draft-occupancy`,
  `r3-drivers-arch-tool-name-collision-stage-flags`.
- **1B — DMS connection probe (1):**
  `dms-mirror-probe-connected`.
- **1C — foundation, shared-domain, UI, and capability state (31):**
  `color-support-level-flags`, `dock-tab-drag-phase`,
  `foundation-ui-system-menus-open`, `r3-foundation-mention-plugin-lookup-phase`,
  `link-preview-fetch-machine`, `foundation-ui-system-speech-input-connection`,
  `tour-state-open-payload`, `langextract-minimal-fold-segment-kind`,
  `html-select-child-grammar`, `html-dl-child-grammar`,
  `r2-foundation-unique-match-search`, `r2-foundation-graph-validation-result`,
  `organization-tenant-placement-bits`, `html-img-sizes-disposition`,
  `html-link-imagesizes-disposition`, `tabstrip-overflow-disposition`,
  `epistemic-review-dialog-reason-gates`,
  `r3-foundation-invariant-enforcement-channels`,
  `r3-foundation-notification-action-busy`, `todo-item-due-tone`,
  `r3-foundation-todo-item-presence`, `epistemic-candidate-comparison-action-gates`,
  `epistemic-proposal-card-action-flags`,
  `r27-boolean-state-foundation-spinner-state`,
  `r27-boolean-state-foundation-use-scribe-result-connected`,
  `r27-boolean-state-foundation-sidebar-context-open-state`,
  `r3-foundation-tier-gate-tool-hints`, `html-datalist-child-grammar`,
  `r28-foundation-ui-chart-tooltip-indicator-flags`,
  `r28-foundation-ui-chart-tooltip-default-item-flags`,
  `r28-foundation-ui-chart-tooltip-item-flags`.
- **1D — application runtime and ontology UI state (17):**
  `r2-apps-contact-form-submit-phase`, `desktop-panel-menu-item-state`,
  `r2-apps-sidebar-thread-list-phase`, `thread-transcript-load-state`,
  `thread-load-state-props`, `intake-vault-status`,
  `r2-apps-vault-sync-command-busy`, `ontology-inspector-form-state`,
  `document-toolbar-busy-disabled`, `r3-apps-pglite-data-dir-probe`,
  `r3-apps-sidecar-devtools-gates`, `ontology-infer-session-recompute-latches`,
  `document-violation-flags`, `r2-domains-ontology-graph-worker-requeue-latches`,
  `composer-shell-edit-content`, `r2-apps-hero-clip-playback`,
  `r26-apps-sidecar-ipc-ready-latch`.
- **1E — internal tooling domains (49):**
  `package-verify-step-outcome`, `create-package-template-type-flags`,
  `r2-tooling-bin-main-fast-paths`, `corpus-legacy-word-terminal`,
  `yeet-ack-resolution-flags`, `worktree-removal-mode`,
  `r3-tooling-docker-tag-kind-flags`, `r3-tooling-ecosystem-polarity-specifier-call`,
  `r2-tooling-packet-transition-stream-trace`,
  `r3-tooling-registration-deletion-note-phase`,
  `effect-import-source-transform-phase`, `contained-file-read-outcome`,
  `scheduler-admission-attempt-origin`, `scheduler-promotion-tick-origin`,
  `yeet-prepared-publish-commit`, `corpus-pst-terminal`,
  `docgen-subject-collection-outcome`, `docgen-worker-packet-review`,
  `goals-packet-migration-kind`, `goals-transition-plan-disposition`,
  `worktree-process-cwd-reading`, `worktree-idle-reading`,
  `worktree-pr-classification`, `worktree-branch-diff-reading`,
  `worktree-policy-reading`, `files-worker-score-thresholds`, `jsdoc-fence-state`,
  `codex-findings-packet-commit-kind`, `r26-cli-commands-l-q-osv-ignore-expiry`,
  `sync-data-target-selection`, `create-package-retired-name-reconciliation`,
  `r27-cli-commands-l-q-github-check-lane-proof-reuse`,
  `r28-tooling-library-observability-deployment-remote-fields`,
  `r28-cli-internal-root-tmpfs-discovered-classified-skip`,
  `r28-cli-commands-d-k-docgen-quality-worker-eval-source`,
  `r28-cli-commands-d-k-docgen-quality-worker-runpod-eval-source`,
  `r3-tooling-schema-first-fn-eligibility`,
  `r28-cli-quality-coverage-resolved-operation`,
  `r28-cli-quality-test-lane-resolved-selection`, `create-package-scaffold-shape`,
  `r3-tooling-bun-report-drift-flags`,
  `r3-tooling-version-sync-category-filter-gates`,
  `r28-cli-internal-root-tmpfs-stub-observations`, `yeet-sweep-git-state`,
  `r29-yeet-sweep-worktree-probe-address`,
  `r30-tooling-library-support-open-mode`,
  `r30-tooling-library-support-open-file-descriptor`,
  `r30-cli-commands-l-q-github-check-lane-outcome`,
  `r30-cli-yeet-portfolio-index-staged-deletion`.

The 32 Tier 2 records are singleton PRs in this order:
`tool-name-collision-row-truncated-digest`, `nlp-mcp-file-info-exists`,
`ontology-inference-recompute-cause`, `vault-sync-status-connected`,
`runners-bake-freshness`, `effect-import-rules-summary-operation`,
`yeet-status-remote-check-phase`, `yeet-merge-ready-verdict`,
`ids-statement-presence-kind`, `citation-blank-page`, `pincite-range-endpoints`,
`statutes-at-large-pincite-is-range`,
`ai-metrics-config-snapshot-bounds`, `ai-metrics-canonical-root-kind`,
`docgen-quality-package-outcome`, `docgen-runpod-cleanup-outcome`,
`worktree-fleet-epoch-target`, `worktree-reap-candidate-retirement`,
`files-face-detection-presence`, `files-border-classification`,
`files-image-orientation-state`, `files-person-reference-disposition`,
`m365-tool-error-retryability`, `runtime-activity-payload-kind`,
`package-inventory-docgen-coverage`,
`r27-cli-commands-d-k-normalize-manifest-dedupe-move`,
`r27-tooling-library-observability-outcomes-dataset-scorecard-presence`,
`r27-tooling-library-observability-config-snapshots-dataset-presence`,
`docgen-generation-outcome`, `yeet-merge-ready-criterion-changed`,
`docgen-runpod-template-search-scopes`,
`corpus-mail-store-exception-approved-disposition`.
A later newly admitted Tier 2 record also receives a singleton PR.

## Recorded browser-QA matrix

Successful portless record -> extract -> judge evidence with
`requiredCount: 0` is required for each affected gesture surface:

- Tier 1C: dock dragging and tab overflow; editor menus and mention typeahead;
  coordinated speech hook/context connection, token delay and settlement paths;
  spinner hold/restart/release/unmount with timing and TTL evidence; foundation
  sidebar desktop/mobile controls, hydration and controlled callbacks; link
  preview; tour start/step/back/close; contradiction-review reason entry,
  disabled confirmation, and submission; chart tooltip indicator/layout cases;
  Todo due/presence styling and actions.
- Tier 1D: contact submission; desktop menu, sidebar, and thread-load flows;
  Vault controls; ontology inspector and document-toolbar actions; Hero media
  autoplay, playing, rotation, reduced-motion and cleanup behavior.
- Tier 2: Vault sync badge, disconnect guidance, trigger, and conflict review.

Unit/component tests remain mandatory. Store the resulting QA artifact paths
and verdicts in each implementation PR's evidence rather than claiming a
package-level UI check covers an unrecorded gesture.

Historical P1 evidence follows.

P1 sweep rounds executed (2026-08-17):

- **Round 1** — 13 area-scoped grok lanes: 15 confirmed, 189 disqualified.
- **Round 2** — 5 residue-hunt lanes (useState/class-field/piped-boolean
  angles): 5 confirmed, 31 disqualified.
- **Round 3** — 5 lanes (let-latches, AsyncResult projections, tuples):
  9 confirmed, 18 disqualified.
- **Round 4** — single broad convergence lane: 0 confirmed, 2 disqualified.
- **Round 5** — exhaustive mechanical-residual triage (every remaining corpus
  file with a same-scope boolean cluster): 4 confirmed + orchestrator closed
  the exclusive-CLI-mode-flag family by exhaustive grep (3 more confirmed).
- **Round 6** — broad falsification pass, fresh angles: 0 confirmed,
  1 disqualified.
- **Round 7** — second consecutive dryness confirmation: 0 confirmed,
  0 disqualified ("DRY: nothing new"). Rounds 6+7 are the two consecutive
  empty rounds; P1 is dry.

Final inventory: **294 records — 46 qualified, 248 disqualified**
(D1 207 / D2 41). GATE 1 passed on 2026-08-17; all 46 qualified records are
currently `reviewed` while GATE 2 awaits ratification.

Every confirmed entry was evidence-verified by the orchestrator (100%, not
the 20% minimum). The exclusive-CLI-mode-flag family's collapse
infrastructure already exists at
`packages/tooling/tool/cli/src/internal/cli/RunMode.ts` — designs should
reuse it.

## Sweep lane map (round 1)

| Lane | Areas | ~files |
| --- | --- | --- |
| tooling-tool | packages/tooling/tool | 447 |
| foundation-modeling | packages/foundation/modeling | 377 |
| law-practice | packages/law-practice | 304 |
| drivers | packages/drivers | 288 |
| foundation-ui-system | packages/foundation/ui-system | 196 |
| foundation-cap-prim | packages/foundation/capability + primitive | 189 |
| epistemic | packages/epistemic | 152 |
| shared-documents | packages/shared + packages/documents | 212 |
| tooling-rest | packages/tooling/library + policy-pack + test-kit | 155 |
| workspace-agents | packages/workspace + packages/agents | 144 |
| arch-eco-internal | packages/architecture-lab + ecosystem + _internal | 114 |
| ontology-mcp | packages/ontology + apps/practice-kg-mcp + apps/architecture-lab-proof | 78 |
| apps | apps/professional-desktop + apps/oip-web | 91 |

## Verification lane

```sh
bun goals/boolean-creep/ops/validate-inventory.ts
bun goals/boolean-creep/ops/validate-designs.ts
jq . goals/boolean-creep/ops/manifest.json
test "$(wc -m < goals/boolean-creep/GOAL.md)" -le 4000
```

## Blockers

No user design decision is open. The prior Grok HTTP 402 blocker cleared at
the 2026-09-08 preflight. P2R still requires two complete current-source dry
rounds and corrected designs. P3 and P4 remain evidence-gated on that census,
the replacement zero-finding review, and the merged packet-only ratification
PR. The working branch also contains four pre-existing committed
`scratchpad/yeet-effect/` files; preserve them and isolate packet changes at
publication so the ratification PR remains packet-only.
