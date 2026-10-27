# Repository simplification residue plan

Status: `in-progress`. Lifecycle: `active`.

## Phases

| Phase | Status | Exit |
| --- | --- | --- |
| P0 Research and admission | in-progress | Issue acceptance and source paths reconciled; lane owners and fresh cap admission recorded. |
| P1 Implement waves | pending | All fifteen issue-owned implementations land with their acceptance proof. |
| P2 Verify program acceptance | pending | Fresh scans and all per-issue/runtime/coverage receipts reconcile; zero added inventory rows. |
| P3 Yeet and merge | pending | Final work passes the fleet-owned S11 thread/window/conflict gate and merges. |
| P4 Close | pending | Reflection validates; acceptance, phases and completed-retained lifecycle land together in the final PR. |

## Admission and wave order

Count **every open PR repo-wide**, drafts and unrelated programs included, before
admitting any wave or publishing another PR. The cap is six (repair-decision-3).
The fleet orchestrator grants capacity; plan for one or two residue lanes in
flight, not six dedicated slots. At a full cap continue local preparation and
verification. Do not publish until capacity is granted. Keep active work bounded
and make progress on independent admitted work under S23.

| Wave | Issues and lane names | Execution and exit |
| --- | --- | --- |
| 1 | #1851 `residue-a-retire` with #1860 `residue-catalog`; #1855 `residue-detectors` | One coordinated A/catalog retirement train plus an independent detector lane, at most two concurrent PRs when fleet capacity allows. Detector FIRST item is F-S31-EV010: paired fixtures and classification repair for all three models-apply-command/models-apply/models-catalog provenance findings, never exceptions. Then remaining detector/provenance work. |
| Deadline lane | #1861 `residue-hold-exits` | Reserve the next available slot after initial wave admission; start preparation immediately and land before 2026-10-30, with OSV recheck and evidence-backed resolution/renewal. It may interrupt later wave order to meet the deadline. |
| 2 | #1853 `residue-patch-proofs` | Current-version five-patch fail-unpatched/pass-patched train, with hashes and recovery. |
| 3 | #1856 `residue-guidance` | Reconcile every guidance/artifact preview to current source/reference before applying. |
| 4 | #1875 `residue-vitest-canon`; #1876 `residue-rdf-pacer` | Preserve original patches/identity maps and D13 tooling isolation; separate package/dual-runtime/coverage proof; coordinate detector overlap with #1855. |
| 5 | #1869 `residue-telemetry-completeness` | Separate completeness from qualification, including historical compatibility and malformed/refusal fixtures. |
| 6 | #1874 `residue-build-restore` | Agree file ownership with the separately owned build-pipeline exploration; cold/warm/changed-input SHA-256 output manifests. |
| 7 | #1878 `residue-completion-evidence` | Complete merge-time evidence provider; retain unknown for missing/deleted/partial evidence. |
| 8 | #1879 `residue-target-exchange`; #1880 `residue-exchange-recovery`; #1881 `residue-skill-publication` | Qualify target filesystem capability first, then journal recovery, then skill publication. At most two PRs when admitted; shared protocol files have one owner and sequential integration. Disposable target fixtures only, no implied native apply. |
| 9 | #1882 `residue-dependency-review` | Manifest-aware security integration and actual permission fixtures, retaining production transitive detection. |

Workstream status: #1860 `residue-catalog` is complete (third A-train PR,
`history/receipts/catalog-removals-record.md`). #1853 `residue-patch-proofs` is
complete (`history/receipts/patch-proofs-record.md`): all five retained patches have
a focused test and a current-version fail-unpatched/pass-patched pair, and none has
a published upstream exit.
#1861 `residue-hold-exits` is
complete (`history/receipts/hold-register.md`), ahead of the 2026-10-30 deadline.
#1851 `residue-a-retire` is complete (`history/receipts/a-retire-consumer-census.md`): the closeout census finds zero live consumers of any retired A-train surface.
#1856 `residue-guidance` is complete: wave 1 classified and fixed the
guidance surface (`history/receipts/guidance-classification.md`). Wave 2 reviewed
the 660 inline directives individually; wave 3 added the compile gate for the
Markdown TypeScript fences and decided the three upstream-copied `.patterns` files.
Wave 2a reviewed all 225 `fallow-ignore` directives and resolved #1910 (`history/receipts/guidance-wave-2a.md`); wave 2b takes the TypeScript suppressions.
Wave 2b reviewed every `@ts-expect-error` (2 fixed, 140 kept) and every `@effect-diagnostics` rule entry (13 stale removed, 3 fixed, 8 narrowed to next-line, 117 kept), each kept one with an inline owner and exit (`history/receipts/guidance-wave-2b.md`); wave 2c takes the remaining directive kinds.
Wave 2c reviewed the 182 `biome-ignore`, `cspell`, coverage, `noqa`, `oxlint-disable` and `shellcheck` directives (2 fixed, 91 stale removed, 89 kept with owner and exit; `history/receipts/guidance-wave-2c.md`); wave 3 takes the Markdown fence compile gate and the upstream-copied `.patterns` decision.
Wave 3 completes #1856: the `lint:markdown-fences` cheap gate compiles every guidance TypeScript fence (231 of 500 failed at `599b553267`; now 485 pass, 15 reviewed opt-outs, 590 docgen-generated), and the three upstream-copied `.patterns` files are decided (two rewritten for this repository, `module-organization.md` kept as a labeled upstream reference; `history/receipts/guidance-wave-3.md`).
#1855 `residue-detectors` is in progress: wave 1 closed F-S31-EV010, which #1899 had
already fixed on main, and extended the EV010 proof to same-file helpers, resolving 16
more rows (`history/receipts/detectors-wave-1.md`). Wave 2 is FP-1..FP-7.
Wave 2 repaired FP-1, FP-3, FP-4 and FP-5 and retired 155 rows with none added
(`history/receipts/detectors-wave-2.md`); wave 3 is the FP-2/FP-6 rulings, individual exception
review and the zero scan.
Wave 3 ruled FP-2 and FP-6 and retired 192 rows with no row or allowlist entry added
(`history/receipts/detectors-wave-3.md`); wave 4 is the EV014 named-test-layer frontier.
Wave 4 repaired the EV015 single-test-block, EV006 browser-project and EV002 repeated-lifecycle classes, retiring 79 rows and converting 7 to owner/exit exceptions (`history/receipts/detectors-wave-4.md`); waves 5-9 are the EV003 process-state ruling, the EV014 named test layers and the 693-row owner/exit register.
Wave 5 ruled EV003 process-state wrappers a judgment class, repaired the EV003 layer-factory and two EV008 classes, retiring 22 rows and converting 13 to owner/exit exceptions (`history/receipts/detectors-wave-5.md`); wave 6 is the EV014 named test layers.
Wave 6 closed EV014 by resolving imported test layers across files, ruling hermetic in-memory acquisitions acquisition-free and giving the 39 remaining layers an explicit 30 s hook timeout, retiring 233 exceptions with none added (`history/receipts/detectors-wave-6.md`); wave 7 is the EV010 owner/exit register.
Wave 7 repaired three EV010 false-positive classes (native FileSystem layers proven by link or mode operations, a runtime Node/Bun bundle choice, a bundle whose FileSystem a later memory layer replaces), retiring 17 rows, converted 80 open live-resource rows to owner/exit exceptions and rewrote all 128 surviving EV010 exceptions to owner/exit form (`history/receipts/detectors-wave-7.md`); the owner/exit register for the 298 other-rule exceptions remains.
Wave 8 repaired the EV015 nested fresh-clock and EV002 Context-factory classes, retiring 12 exceptions, converted 36 trial-backed open rows, reopened 6 unobserved step-capture scopes and rewrote 280 exceptions, so every exception names an owner and exit and 20 rows stay open (`history/receipts/detectors-wave-8.md`).
#1875 `residue-vitest-canon` is in progress after wave 1, which leaves 689 open rows
(`history/receipts/vitest-canon-wave-1.md`).
Wave 2 retired every open EV009 and EV014 row and left 26 EV015 rows for #1855
(`history/receipts/vitest-canon-wave-2.md`); wave 3 is law-practice-server and leaf packages.
Wave 3 retired 27 law-practice-server and leaf-package rows and handed 23 to #1855
(`history/receipts/vitest-canon-wave-3.md`); wave 4 is the repo-cli assertion and harness families.
Wave 4 retired 99 repo-cli assertion and harness rows and handed seven EV008/EV013 rows to #1855
(`history/receipts/vitest-canon-wave-4.md`); wave 5 is the resource-lifetime families.
The EV012 seams lane retired the three no-seam module mocks through production service seams, with no row or exception added (`history/receipts/vitest-canon-ev012-seams.md`).
Wave 6 retired 116 repo-cli EV002 rows and handed 19 to #1855
(`history/receipts/vitest-canon-wave-6.md`); waves 5 and 7 are EV004/EV003 and EV010.
Wave 7 moved portable-filesystem EV010 tests in 17 files to the memory filesystem, retiring 16 rows, and handed 127 live-resource rows to #1855 in eight evidence classes (`history/receipts/vitest-canon-wave-7.md`); wave 8 is the deferred `step-capture-lifecycle` rows and the wave 5 families.
Wave 9 dropped 32 redundant `Effect.scoped` wrappers in 12 repo-cli tests and kept 9 whose close is observed, with the 12 lane EV010 rows confirmed live-resource (`history/receipts/vitest-canon-wave-9.md`).
Wave 8 lane A retired 77 of the 84 open EV002, EV004, EV010 and EV015 rows in 11 repo-cli files with no row or exception added, and left 7 live-resource or cwd-seam rows open (`history/receipts/vitest-canon-wave-8.md`).
#1876 `residue-rdf-pacer` is complete (`history/receipts/rdf-pacer-ports.md`): the
RDF failure assertions and the Pacer logout witness are ported, and every export
hunk has a disposition.
#1869 `residue-telemetry-completeness` is complete
(`history/receipts/telemetry-completeness.md`): stored session stamps carry
independent completeness and qualification fields, historical rows decode as
`unknown`, and a run that cannot evaluate a session keeps its verified stamp
while the session's own contradicting evidence still clears it.
#1874 `residue-build-restore` is complete (`history/receipts/build-restore.md`): the
base incremental state lives inside `outDir`, so a dist-only clean can no longer leave
state that suppresses emit. Cold, warm and changed-input builds reproduce the complete
output manifest.
#1878 `residue-completion-evidence` is complete
(`history/receipts/completion-evidence.md`): completion verifies only on a merge-push
rule suite bound to the merge commit and green required checks at the accepted head.
Network failures, unrecoverable deleted rulesets and partial evidence stay `unknown`.
The five subject-only packets stay unmigrated, each with its reason.
#1879 `residue-target-exchange` is complete
(`history/receipts/target-exchange.md`): atomic-exchange capability is probed and
cached per target filesystem identity, using disposable files on the target's own
mount. Unsupported filesystems refuse before any backup or publication.
#1880 `residue-exchange-recovery` is complete
(`history/receipts/exchange-recovery.md`): every publication is a durable journal
state machine, and one idempotent reconciliation path recovers each crash point
byte-exact from the next apply, `beep models recover` or `restore`, refusing with
every artifact kept when a competing writer changed the target.
#1881 `residue-skill-publication` is complete
(`history/receipts/skill-publication.md`): skill files and directories are replaced
only by a qualified, verified atomic exchange, journaled with the same state machine,
and recovered byte-exact (tree hash for directories) by the next `skills update` or
`beep skills recover`; a replacing writer is refused with every artifact kept. Wave 8
is closed.
#1882 `residue-dependency-review` is complete
(`history/receipts/dependency-review.md`): the required `Security` job reviews
dependency changes through `beep ci dependency-review`, excluding only manifests under
the declared `**/test/**/fixtures/**` policy, keeping production transitive advisories
and the action's thresholds, and failing closed on any GitHub read failure.

Workstreams are one per issue even when a train shares a PR. Future owners must
record source acceptance and head-bound results per issue. Slot availability
changes concurrency, not ownership or acceptance. Size alone cannot park a lane.

## External measurement regime

#1868 is a cross-reference, not a sixteenth lane. Its 30-session window restarts
at **#1884's merge** (e4d6f44aa8), because deleting `.ai/mcp` changed the harness
regime. Count only qualifying native root sessions under the resulting fingerprint;
children, synthetic probes and historical samples contribute zero. Later relevant
configuration changes restart their own regime again. No arbitrary wait replaces
an executable step.

## Per-wave receipt and closeout

Record exact source head, issue acceptance, commands/results, inventories compared,
added rows (must be zero), coverage floors, generated-owner checks, hosted status,
red attribution and reversal in history/. Preserve original source patches and
native recovery material. Answer review threads through the owner; the fleet
orchestrator owns S11 merges. Count open PRs again before admitting replacements.

At final program closure reconcile all fifteen acceptances, use /reflect for a
validated history/reflections artifact, run reflection-artifacts, update README
and manifest phases, and land completed-retained in that same final PR. Opening
this packet leaves every implementation acceptance outstanding.
