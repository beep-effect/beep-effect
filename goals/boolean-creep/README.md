# Boolean-Creep Eradication

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Find every place AI-generated code flattened one domain state variable into
parallel correlated booleans, prove each with cited evidence (E1–E4), and
refactor the confirmed instances to schema-first shapes (LiteralKit literal,
tagged union, or Option-of-literal) that delete the guards the booleans made
necessary.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/boolean-creep/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract;
[`DECISIONS.md`](./DECISIONS.md) holds the ratified campaign decisions.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`DECISIONS.md`](./DECISIONS.md) - ratified decisions (binding).
4. [`PLAN.md`](./PLAN.md) - active execution plan.
5. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
6. [`data/inventory.jsonl`](./data/inventory.jsonl) - campaign state of truth.
7. [`research/`](./research/) - supporting research.
8. [`history/`](./history/) - evidence and closeouts.

## Current Phase

The moving-main census and design refresh remain in progress. GATE 1 passed on
2026-08-17. Benjamin's 2026-09-03 amendment revoked the stale zero-findings
assertion and delegated GATE 2's transition to the packet evidence:
implementation becomes authorized only after two current-source dry census
rounds, the replacement exact-source zero-finding review receipt, and the
packet-only ratification PR are complete. That bounded mandate admits newly
introduced E1-E4 cases without another user gate; all original qualification
and compatibility laws remain binding.

## Latest Evidence

The canonical inventory contains **674 records: 139 qualified and 535 disqualified**
(D1 369 / D2 166). The qualified set is **110 Tier 1 and 29 Tier 2**; statuses are 23
historically `reviewed`, 116 `designed`, and 0 `confirmed`. All await replacement
independent review.

The current source is `f03850b762e41217b5a0c26f26041daee490a070`, after merging
main `4f13d83e13d61275a57004050ffc62a90d86c014` forward. The
[merge receipt](./data/design-refresh-2026-09-09-main-4f13d8-merge.json) verifies
the exact merge tree and preservation of all 897 staged paths, the unstaged
ledger edit, local settings and graph contents. Package/app source and dependency
files equal main. The additional 142 package manifests change only scripts;
the lockfile and dependency declarations are unchanged. Focused impact audits
cover the 26 changed authored source paths. Their proposed inventory and design
corrections await parent integration before the next census. No new dry-round,
independent-review or implementation credit is claimed.

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

All 139 current qualified cases have design documents. Inventory and design
coverage validate structurally. Modeling, chart-layout, graph-worker retry,
transcript, Hero playback and receipt occupancy corrections are integrated.
The L–Q integration adds resolved coverage/test lanes and corrects raw requests.
ScaffoldShape and the Worktree/Yeet corrections are also integrated.
The final retained CLI owner audit and full report reconciliation remain;
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

Round 24 admitted `html-img-sizes-disposition`, then Desktop continuation
interrupted three lanes after twelve primary lanes completed. Main advanced
before recovery, so that wet, incomplete round is historical evidence only.
Its [reconciliation](./data/sweeps/refresh-2026-09-08-r24-main-be8995/reconciliation.md)
records the admissions and corrections. Prior rounds and their failures remain
in the sweep history; none supplies current-source convergence proof.

The pretext engine-family and shared SHACL-result records are now D1. Public
API reproductions proved every original boolean combination meaningful; their
three-state designs are archived. Other corrections preserve null Vault
reasons and any coherent stored Yeet blocker, restore complete consumer maps,
and correct inspector, DMS, and verdict cardinality proofs.

The [pre-refresh inventory](./history/inventory/2026-09-03-pre-refresh.jsonl)
contains the original 294 records including 46 qualified, and the
[pre-round-24 inventory](./history/inventory/2026-09-08-pre-r24.jsonl) preserves
the later 764-record snapshot. Stable ids remain for surviving declarations.
The old review receipt cannot pass GATE 2; the replacement must name its exact
source SHA and cover every current qualified record and its corrected design.

## Notes

- The inventory is schema-validated JSONL; the record union makes
  "disqualified but designed against" unrepresentable
  ([`ops/validate-inventory.ts`](./ops/validate-inventory.ts)).
- The original two user gates were honored. The 2026-09-03 amendment grants a
  narrow evidence-triggered GATE 2 transition for completion of this campaign.
- Tier 2 instances (persisted/wire encoded exposure) land one PR each with an
  encoded-compat proof; Tier 1 lands batched by package/app.
- The agent never merges. Completion means all implementation and closeout PRs
  are merged by Benjamin and the completed packet is verified on `main`.
