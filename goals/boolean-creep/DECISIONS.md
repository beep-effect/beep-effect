# Boolean-Creep Eradication — ratified decisions

> Routing update (2026-09-09): new token-heavy Codex work uses `gpt-6-astra`
> with `medium` reasoning, per [root agent guidance](../../AGENTS.md#token-heavy-codex-work).
> This supersedes earlier model/effort choices below for future work. Completed
> runs retain their recorded provenance; lightweight and Grok routes retain
> their intended roles.

Ratified by Benjamin 2026-08-17 (from the three-lane sample session and the
operator-prompt grill). These are binding for the campaign; changes require a
new ratification line with a date.

Benjamin ratified the following narrow campaign amendment on 2026-09-03 after
reviewing the current-state audit. It supersedes the original two-gate cadence
only for completing this already-started campaign; it is not a standing
autonomy exception for other goals.

1. **Qualifier**: cardinality gap + cited evidence class (E1–E4), never bare
   count; scanner net ≥2 booleans/scope. Rejected: ≥3 threshold (misses the
   `{loading,error}` pair), ungated ≥2 (floods design with D1 false positives).
2. **Sweep scope**: types/interfaces + `S.Struct` + React props/sibling state.
   Rejected for this campaign: function flag params (different refactor shape),
   driver wire shapes (transformation-risk class, census only).
3. **Target shape**: per-instance taxonomy (literalkit / tagged-union /
   option-literal). Rejected: TaggedUnion-everywhere — violates the LiteralKit
   repo law; sample showed ~10 of 12 instances want literals, not unions.
4. **Venue**: Fable orchestrates; grok CLI inventory, codex Sol medium
   design/apply, Fable review. Rejected: claudex Workflow venue (loses
   independent Fable judgment). Note "grok-build" is not an agent type — it was
   always a session/CLI lane.
5. **Artifacts**: goal packet `goals/boolean-creep/` with schema-validated
   JSONL inventory (jsdoc-carrier-migration precedent). Rejected: loose
   `.beep/` files, exploration-packet ceremony.
6. **Gates**: two user gates — inventory ratification before design; design
   ratification before apply. Rejected: fully autonomous run.
7. **Corpus**: `packages/**/src` + `apps/**/src`, excluding tests/generated/
   labs/scratchpad/.repos. Sample: ~80 raw clusters, dominant mass D1/D2
   config/wire; expected confirmed inventory 15–30.
8. **Landing**: risk-tiered batched PRs (Tier 1 internal/derived by package;
   Tier 2 persisted/wire one-PR-each with encoded-compat proof). Rejected: one
   campaign PR, per-instance PRs.
9. **Operator prompt**: crisp operator prompt; essay intro dropped (write the
   blog post from the packet's evidence afterwards, if wanted).

## Gate rulings

- **GATE 1 (2026-08-17): Benjamin ratified all 46 confirmed instances.** No
  strikes, no demotions, Tier 2 not parked. P2 design is authorized for the
  full confirmed inventory.
- **CURRENT-CORPUS AMENDMENT (2026-09-03): Benjamin ratified a bounded
  completion mandate against moving `origin/main`.** Revalidate the original
  46 records, admit every newly introduced current-corpus case that satisfies
  E1-E4, repair stale or incomplete designs against live source, independently
  review 100% of qualified evidence and designs, and apply reviewed designs
  without returning for another user decision. The original corpus boundary,
  exclusions, evidence gate, cardinality proof, target-shape law,
  guard-deletion accounting, architecture checks, compatibility requirements,
  and independent review remain binding. Function parameters remain out of
  scope; driver wire mirrors remain D2 census records.
- **GATE 2 (delegated transition, 2026-09-03):** the prior zero-findings claim
  is revoked. GATE 2 passes under Benjamin's delegated authority only when the
  refreshed exact-source inventory, corrected designs, and a replacement
  zero-finding independent-review receipt are complete. Qualified records may
  advance `confirmed -> designed -> reviewed` under that mandate without
  reopening GATE 1 or requesting another Benjamin decision.
- **Completion ruling (2026-09-03):** locally verified or merge-ready work is
  insufficient. Every implementation and the final closeout PR must be merged
  to `main`; the agent publishes and closes review through Yeet but never
  merges. Final acceptance also requires two consecutive no-new-qualified
  census rounds against the merged exact `main` head.

## 2026-09-03 execution riders

- Preserve schema version `boolean-creep-inventory/v1`. Archive the pre-refresh
  inventory and superseded review receipt under `history/`; keep stable ids for
  surviving file-and-symbol pairs. Historical records removed from the live
  census remain in the archived snapshot rather than gaining a new `retired`
  status.
- Resolve `origin/main` immediately before every census, review, verification,
  and publish operation. Merge it forward; do not rebase. Every census and
  review receipt records its exact source SHA.
- Tier 2 transformations preserve encoded property names, values, defaults,
  accepted legitimate inputs, persisted artifacts, and CLI/MCP/RPC behavior.
  Honest decoded unions or literals live behind those compatibility codecs.
- Exported decoded TypeScript shapes may migrate atomically inside the repo.
  Update every known consumer in the same PR and remove never-shipped,
  zero-consumer exports; do not add aliases unless an encoded or actually
  supported external contract requires them.
- The corrected historical baseline is 40 Tier 1 and 6 Tier 2 records before
  newly admitted cases. `ontology-inference-recompute-cause`,
  `runners-bake-freshness`, and `yeet-status-remote-check-phase` are Tier 2.
- The DMS internal connection union lands before the Vault compatibility codec;
  the first change temporarily projects the union to the existing Vault wire
  fields. `nlp-mcp-file-info-exists` normalizes `exists: false` plus stale
  statistics to the missing case, but rejects `exists: true` with missing or
  partial statistics.
- Gesture-bearing UI migrations require successful recorded `browser-qa-loop`
  record, extract, and judge evidence with `requiredCount: 0`, in addition to
  focused unit and component tests.
- The final closeout runs the `reflect` skill, transitions the canonical goal
  status to `completed-retained`, and permits the required ignored local
  Goals-index projection refresh without staging that projection.
- Keep `@beep/chalk` in its current capability package and repair its README's
  named-consumer placement proof when that package is touched. Record the
  pre-existing ontology `/public` export-boundary drift as a separate
  architecture opportunity; do not expand this campaign into that rewrite.

## Evidence classes (gate)

A suspect is CONFIRMED only with at least one cited evidence class, proven by
reading the surrounding code (file:line proof in the inventory entry):

- **E1 exclusive-write** — a write site sets one flag true and siblings false
  in the same operation.
- **E2 exclusive-read** — `if/else-if` or match over the flags that never
  handles a combined-true case.
- **E3 flag↔payload** — a boolean duplicating a sibling field's presence
  (`{ isError: boolean, error?: E }`).
- **E4 phase implication** — ordered flags where one implies another
  (`finished ⇒ started`): a state machine flattened into bits.

Disqualified (recorded for the census, never designed against):

- **D1 independent flags** — all `2^n` combos legal: config toggles,
  permissions, independently observed facts.
- **D2 encoded/wire mirror** — the shape mirrors an external SDK/DB/API
  contract at a driver boundary.

## Design law riders

- `derived` instances (parallel booleans projected from ONE upstream source —
  an AsyncResult, a date, draft strings) are fixed by deriving a single literal
  (or keeping the source type in the view), never by inventing stored state.
- Every design must include **guard-deletion accounting**: the runtime
  coherence checks, if-chains, legacy normalizers, and comment-only invariants
  the new type deletes (crispen doctrine). A design that deletes nothing is
  suspect — the instance was misqualified or the design missed the point.
- All PRs through yeet; commit messages cite the `boolean-creep` slug;
  **never merge — Benjamin merges.**

## 2026-09-22 Knowledge classifier input ruling

Benjamin answered the independent adjudication question: **Require kind-specific
grammar flags.** For the exported Knowledge reference classifier input,
`pairingAmbiguous` implies `kind = goal-uri`, and `ungoverned` implies
`kind = repo-path`. Wrong-kind and simultaneous grammar flags are not legitimate
raw inputs. Ordered runtime precedence does not grant them supported status.

Preserve independent `patternContext`, existing host Option fallbacks, reserved
upstream references, and all resolution statuses. This ruling settles this
owner contract only; qualification, the complete P2 design, independent P3 and
GATE 2 remain evidence requirements. It does not resolve the separate citation
contract questions.

## 2026-09-22 inherited pincite stable-ID ruling

Benjamin answered **Allow stable ID without index** for inherited pincites.
When `pinciteInherited = true`, `pinciteInheritedFromId` may be present while
`pinciteInheritedFrom` is absent. Apply this contract to IdCitation, SupraCitation
and ShortFormCaseCitation; do not erase stable-ID-only provenance or require an
index to construct it. This resolves the shared contract question, not their
qualification/design/review gates. The constitutional preamble question remains
unanswered.

## 2026-09-22 packet migration operation constraints

Benjamin ruled: **Require those operation-specific constraints.**

- A parked plan forbids backfill and both manifest/README output texts.
- A backfill requires manifest text; README output remains optional.
- Explicit `isBackfill: false` remains supported as a non-backfill representation.
- Empty strings and arrays remain legitimate payloads; add no nonempty checks.

This resolves the public-domain ambiguity recorded in
`data/goals-packet-migration-contract-hold-2026-09-22.md`. Re-derive the full
finite domain and restore the owner only with a corrected design and evidence.
The ruling supplies no independent P3, implementation or dry-round credit.

## 2026-09-24 constitutional citation and remote status rulings

Benjamin settled both remaining owner-contract holds through the documented
interview and explicitly authorized implementation of the resulting plan.

For ConstitutionalCitation, allow `preamble: Some(false)` alongside an article
or amendment locator. Preserve false versus absence through the compatibility
codec. Article plus amendment is invalid; `preamble: Some(true)` with either
locator is invalid. Add no unrelated section, clause, or payload restrictions.

For YeetStatusRemote, `available: true` requires `checked: true`. Present
`isDraft`, including false, requires both available and checked. An available,
checked summary may omit draft status. The supported (available, checked, draft)
combinations are (false, false, absent), (false, true, absent),
(true, true, absent), (true, true, false), and (true, true, true). Rejection of
the other seven combinations is an explicitly authorized contract restriction.
Preserve unrelated fields/defaults, artifact and CLI JSON boundaries, and each
consumer's existing policy for unknown draft status. Do not normalize unknown
draft to false globally.

These are owner-specific rulings, not architecture-wide doctrine. Re-audit each
complete owner against current source, refresh qualification and compatibility
designs, and require finite-domain and round-trip tests before implementation.
Historical hold receipts remain historical; these rulings confer no census dry
credit, independent P3 approval, GATE 2 transition, or implementation credit.

## 2026-09-25 — Cache non-execution observation grammar

Benjamin authorizes a consistent public grammar for `CachePilotNonExecution`,
resolving the complete-owner contract question found during R32. This is an
owner-specific restriction on previously accepted values, not architecture-wide
doctrine or a claim that current producer coverage defines public legality.

- `selectedExecutionObserved` requires `summaryPresent`.
- For `reason = absent-script`, `passed` is exactly equivalent to no selected
  execution, zero exit code, and a present summary.
- For the three configuration-refusal reasons, `passed` requires no selected
  execution, a nonzero exit code, and an absent summary. A failed record remains
  supported when those visible prerequisites hold: the stored stderr hash cannot
  establish that the diagnostic matched.
- Preserve arbitrary nonempty IDs, all four reason values, integer exit codes,
  both hashes, and the existing encoded fields. Do not require ID equality with
  reason and do not introduce a diagnostic witness field.

The reason (4) × exit-zero/nonzero (2) × three Booleans (8) projection therefore
has 64 representable strata and 27 supported strata. This count abstracts exit
integers and hash payloads; it is not a claim that native execution reaches every
stratum. Compatibility design must preserve payloads and the specified failed
records while rejecting the other 37 strata.

The original R32 8/6 proposal is superseded: it missed the summary implication
and reason-specific pass conditions. Qualification/design, independent review,
ratification, runtime implementation, and exact-main closeout remain separate
evidence gates. No source implementation is authorized ahead of those gates.

## 2026-09-28 — delegated decisions and one remaining PR

Benjamin delegates judgment on all further campaign blockers and questions,
authorizes the agent to merge its own PR through the ChatGPT Chrome extension,
and directs that the entire remaining goal land in one PR to reduce hosted
CI costs and queue contention. This supersedes the campaign's earlier
Benjamin-only merge rule, packet-only ratification merge, Tier 1/Tier 2 PR
partitioning, and separate closeout PR requirements. Preserve the dated
historical decisions and evidence; this amendment changes the remaining workflow.

Use the existing open PR #1328 for the remainder. Resolve contract and incidental
verification blockers within the campaign using documented recommendations and
independent review. The inherited fast-uri advisory is authorized for a narrow
compatible lockfile update. Do not treat delegated judgment as evidence that a
contract, review, census, implementation, or quality gate has passed.

Keep two complete current-source dry census rounds and replacement independent
zero-finding P3 before implementation. Ratify the packet under the delegated
GATE 2 transition in this PR. Implement in dependency order with per-owner
compatibility and guard-deletion proof, package verification and required UI QA.
Batch pushes for substantive review or final integration rather than launching
hosted CI for each local checkpoint. Complete the final candidate residue rounds,
reflection and lifecycle change in the same PR. Merge only after exact-head
quality, review closure, and merge readiness are verified, using the authorized
Chrome extension route.

After merge, verify the merged source and run both required exact-main residue
rounds. Preserve their receipts locally and report the resulting main SHA and
outcomes. These read-only post-merge checks do not require another PR. Completion
is unproven until they pass; a pre-merge lifecycle change does not override a
failed or incomplete post-merge acceptance audit. If substantive work remains,
continue remediation rather than claiming the single-PR constraint proves success.

## 2026-09-29 — push available fixes before local full proof

Benjamin directs that ready fixes be pushed immediately instead of waiting for
local proof. This supersedes the 2026-09-28 batching instruction and the local
full-proof prerequisite for publishing. Use hosted checks and review closure
to establish exact-head merge readiness. Keep the census, compatibility,
independent review, implementation and exact-main acceptance requirements.
Continue using PR #1328 for all remaining work.

## 2026-09-29: continuation after PR #1328 merged

Hosted state confirms PR #1328 merged at `3bfb7d0f33` on 2026-09-29 before
campaign completion. Under the existing delegated judgment and one-remaining-PR
mandate, use one successor PR for all remaining work. This is an execution
reconciliation, not a new user ruling or acceptance claim. Preserve the dated
instructions above as history. Keep every substantive census, compatibility,
independent review, implementation and exact-main completion requirement.

The R46 runtime probe remains rejected after a scripted payload mismatch.
Prepare a new independently reviewed fixture and source binding; do not retry
the failed attempt in place or grant it retrospective acceptance.

## 2026-10-01: R48 source-refresh dispositions

Main deleted the JSONSchema source that owned the disqualified
`json-schema-node-keywords` record. Apply the live-projection rule from the
inventory contract: preserve the 726-row projection at
`history/inventory/2026-10-01-pre-r48-source-refresh.jsonl` and remove that
record from the live inventory. The current inventory is 725 rows: 108
qualified, 617 disqualified and zero applied.

Re-derive the R48 partition from existing source paths and retire the 40 lane
areas removed by main. Do not spend provider calls proving paths already known
to be absent. The R46 empty report root's filesystem device number may change
across the documented workstation reboot; its unchanged inode, owner, mode and
emptiness remain the relevant preservation facts. These dispositions authorize
input preparation only. They grant no admission, census, dry-round, P3 or
implementation credit.

## 2026-10-01: R49 LiteralKit source-anchor refresh

Main's keyed-API migration retained both LiteralKit PropertyDescriptor owners
but moved them within the shortened file. Preserve the previous 725-row
projection at
`history/inventory/2026-10-01-pre-r49-literalkit-reanchor.jsonl` and re-anchor
`literalkit-attach-helper-descriptors` to line 308 and
`literalkit-readonly-property` to line 437. Their D1 classifications remain:
the three ECMAScript descriptor attributes are independent controls. This is a
source-citation repair only and grants no census, dry-round, P3 or
implementation credit.

## 2026-10-01: R50 schema-retirement anchor reconciliation

Main `90517df719fa1eb1a24c00b6ba8bdad2d26d8b8f` was merged into the
campaign branch at `2d38ac6827c599248f7fd643feaf75e2a0fe406b`. Because that
advance occurred before R49 materialized any census stage, its independently
approved inputs and 105-case runtime remain historical preparation with no
launch, probe, census or convergence credit.

R50 recomputed the source partition as 3,152 files across 27 lanes with 82
exclusions. It retired 53 absent scan areas, including eight newly removed
Schema areas, and found no missing owner files or designs. Independent review
adjudicated all 76 inventory-anchor conflicts: apply 72 reviewed row changes
and retain four rows unchanged. Ten changes correct pre-existing owner
citations, sixty re-anchor retained owners, and two reselect ambiguous spans.
The status projection remains 725 rows: 108 qualified, 617 disqualified and
zero applied.

Preserve the exact pre-change projection at
`history/inventory/2026-10-01-pre-r50-anchor-drift.jsonl`, whose SHA-256 is
`0078790a38a060c7ac40c1e75f79974d012c6b9b0758e6d85f3ee379f9123a46`.
The approved patch produced SHA-256
`90709fd80b90660493849f106c6e417b37452c7dbf1469c92583e412c95dbfff`.
A hosted follow-up review then found that the `practice-kg-options` owner
citation selected the unrelated `bundleOut` field at line 80. Re-anchor that
owner to its `PracticeKgOptions` declaration at line 78; the corrected live
projection has SHA-256
`4e64ea1832090715bca8d92a966b6f1290a5d4d882074ceb824d1fd66652d91f`.
Retain the Practice knowledge-graph owner: its Schema defect and equivalence
configuration still represents the same independent policy choices after the
old `includeStack` constructor moved. The informational stale StepExec note on
`r28-cli-commands-a-c-eval-law-lanes-spawn-options` is outside this anchor
patch and grants no additional finding or disposition.

These rulings install reviewed current-source citations plus that hosted
follow-up correction only. Rebuild and
independently review the complete R50 admission inputs after this packet edit
and recheck exact source identity before any runtime or provider execution.
They grant no current-source admission, probe, census, dry-round, P3,
ratification or implementation credit.

## 2026-10-01: R51/R52 source and design-map reconciliation

PR #1339 merged at `04993ae26acd6f93f308a1ae949e4f2a5a4e864c`
before campaign completion. Continue the remaining work in one successor PR,
#1372, under the existing delegated merge authority and immediate-push ruling.
This execution reconciliation changes no semantic owner contract.

R51 independently approved four current-source citation repairs. Preserve the
pre-change inventory at
`history/inventory/2026-10-01-pre-r51-source-refresh.jsonl`. Hosted review then
corrected the retained StepExec locator and removed stale test-map references;
preserve that prior inventory at
`history/inventory/2026-10-01-pre-r51-pr-review-corrections.jsonl`. The live
inventory SHA-256 is
`6e1026fd7b98d89550cfa3ec448cb4de08b22eb4377c12c1bcd9bc8b3576df6f`.

After main `cf97523f40d690a0da02233b2e4a734d4e6fae9e` moved Effect to the
4.0.0 snapshot, R52 independently reviewed 13 stale design maps and approved
their exact replacement bytes. Install those replacements at
`f61291298581fdf28ea3e12f26acd8df1d792a3f`. The review also authorizes these
source-citation dispositions:

- rebind the 12 R39 title maps to `f612912985`;
- retain the package-verify prose citation as historical, with successor line
  298 recorded in the deferred ledger;
- retain the ai-metrics source citation as historical, with successor line 157
  recorded in the deferred ledger;
- relabel runners freshness to the `b5a2d4c1d6` Effect snapshot; and
- leave the ai-metrics package-manifest citation unchanged because it refers to
  that package's still-current exports block.

The fresh independent R52 input review approves candidate hash
`51f1f70c979eb174e55f319e35e8a83e57ad599d3d4ab4670c3b032a3adb62f5`:
40 reproducible inputs, 3,152 corpus files, 27 lanes, 82 exclusions, 53 retired
areas, 725 inventory rows and 4,114 frozen inputs. Its private title matcher
must still reject `describe`, `layer`, `suite` and prefix-only title matches
before the next rebuild. Because this decision entry changes the exact tree,
perform a final input rebind and independent review before runtime or provider
execution. No R51/R52 preparation grants probe, census, dry-round, P3,
ratification or implementation credit.
