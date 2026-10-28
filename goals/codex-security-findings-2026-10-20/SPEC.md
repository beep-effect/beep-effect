# Codex Security Findings (2026-10-20) Spec

## Objective

Remediate every open Codex Cloud security finding visible at
`https://chatgpt.com/mcp-app/connector_openai_defense_factory/open_defense_factory#/findings` for
`kriegcloud/beep-effect` in the 8-finding batch captured on 2026-10-20. Publish
the work through Yeet, reach mergeable hosted state, merge, then resolve the
exact captured findings until no packet-applicable finding remains open.

The operator expanded this same single-PR goal to include all 123 captured GitHub
Dependabot alerts captured in `ops/dependabot.json` (63 unique advisories after the post-publication refresh).
Keep this separate from the exact eight Cloud identities. Every captured alert
requires a source-backed disposition and merged-revision closure evidence;
fixture location alone does not establish an invalid alert.

## Non-Goals

- No accepted-risk or `Won't fix` disposition.
- No raw report bodies, signed artifact URLs, auth headers, cookie values,
  email addresses, secret material, or developer-local absolute paths in tracked
  files.
- No Codex Create PR or patch-apply actions.
- No unrelated refactors, dependency churn, or broad formatting.
- No weakening of quality, security, CI, or review gates.

## Source Hierarchy

1. The user objective that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture and package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, `findings/`, and `history/` files.

## Target Surfaces

- `goals/codex-security-findings-2026-10-20/**`.
- Gitignored raw evidence under `goals/codex-security-findings-2026-10-20/raw/**`.
- Maintained repo paths named by `findings/INDEX.md` after current-HEAD validation.

## Constraints

- Default disposition is `remediate`. `already-fixed` or `false-positive`
  requires strict current-HEAD proof recorded in the finding and triage ledger.
- Minimal root-cause fixes plus one focused regression check per executable-code
  finding. Reuse canonical path-safety, schema, and bounds helpers after live
  source/barrel discovery.
- Schema-first and Effect-first laws govern all production changes.
- Security controls may not be simplified away for diff size.
- Captured summaries stay in ignored `raw/`; tracked records contain only sanitized
  metadata, summaries, validation, decisions, changed files, and proof.
- Browser closure happens after merge, against the exact 8-ID allowlist.
- Preserve unrelated work and stage only reviewed packet intent.

## Acceptance Criteria

- [ ] All 123 captured Dependabot alerts have a source-backed disposition,
      remediation and merged-revision dependency-graph or closure evidence.
- [ ] The Cloud fixes and Dependabot remediation ship in the same PR.

- [ ] All 8 findings have sanitized tracked CSF records with Codex ID, severity,
      title, source commit, and public summary.
- [ ] Every finding has a current-HEAD verdict, disposition, lane, rationale,
      remediation state, changed-file set, and verification evidence.
- [ ] Every real finding is fixed at the shared root cause with a focused
      regression check where executable behavior changes.
- [ ] Packet counts, manifest, triage ledger, launcher size, sanitation, and
      whitespace checks pass.
- [ ] Yeet repair and verify are green on the complete remediation scope.
- [ ] The branch is published, hosted checks and reviews are closed, and the PR
      is mergeable and merged.
- [ ] All 8 captured Codex findings are resolved after merge and the live view
      shows zero packet-applicable open findings.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher size | `test "$(wc -m < goals/codex-security-findings-2026-10-20/GOAL.md)" -le 4000` | Pass |
| JSON shape | `jq .` over both files in `ops/` | Pass |
| Finding count | CSF file count equals 8 | Pass |
| Severity count | 3 Low, 5 Informational | Pass |
| Raw tracking | Exact tracked-file allowlist check below | Only `raw/.gitignore` tracked |
| Sanitization | tracked packet secret/path pattern scan | No matches |
| Per-finding proof | command recorded in finding and triage ledger | Pass |
| Repo proof | `bun run beep yeet verify` | Green |
| Hosted proof | Yeet monitor and review closeout | Green and mergeable |
| Final closure | supported connector or signed-in in-app findings view | Zero packet-open |

### Raw tracked-file allowlist

Run from the repository root. This checks the index, including clean committed
files; ignored working-tree status alone cannot establish the invariant.
Any additional tracked raw entry makes the exact comparison fail.

```sh
test "$(git ls-files -- goals/codex-security-findings-2026-10-20/raw/)" = \
  "goals/codex-security-findings-2026-10-20/raw/.gitignore"
```

## Stop Conditions

- The signed-in CSV export cannot be produced from the findings page.
- Tracked evidence contains a secret, signed URL, auth value, email address, or
  raw local path.
- A fix requires a product or architecture decision outside this packet.
- A proposed security control would rely on a platform-specific fail-open path.
- The same blocking condition repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None retained for hub authentication | Hub runtime | Security remediation | Bun global Crypto exposes the native constant-time comparator; no import suppression is needed | Not applicable |

## Decision Log

- 2026-10-21: PR #1930 merged before classic monitoring could persist its
  verdict. All eight Cloud and 123 Dependabot IDs are verified fixed. Recover
  completion explicitly from the original successful detached monitor job and
  its pre-merge, exact-head status through `goals completion refresh
  --readiness-job`. Keep the accepted declaration and verdict bytes unchanged.
  A separate maintenance change adds validation and negative controls; revert
  that change to remove the new recovery path. This supersedes the classic-only
  closeout instruction for this already merged PR.

- 2026-10-20: Operator holds all verification, quality checks, and publication
  until PR #1928 merges. Source inspection and draft remediation may proceed.
  After merge, fetch and merge main into this branch before running proof.
  This overrides the default immediate package handoff and proof sequence.
- 2026-10-20: Keep the CSV repository identity (`kriegcloud/beep-effect`)
  intact; GitHub currently resolves PR #1928 under `beep-effect/beep-effect`.
  Resolve Cloud scope from the captured full IDs rather than rewriting identities.
- 2026-10-20: Draft changes are reversible working-tree edits. No finding is
  declared fixed until detail enrichment and deferred regression proof succeed.

- 2026-10-20: Add an application bearer credential to the hub's existing
  loopback-plus-Tailscale boundary. Client and service provisioning is required
  before deployment; missing configuration prevents startup. The update does
  not provision or rotate any live credential. Rollback keeps the hub stopped
  until an equally authenticated boundary is available.
- 2026-10-20: DOCX preflight validates actual streamed output and rebuilds a
  stored archive before Mammoth reads it. ZIP declarations alone are untrusted.
  Reuse fflate plus the saxes streaming XML parser rather than hand-writing
  archive/XML parsers. Aggregate output is capped at 8 MiB, 512 entries,
  50000 XML nodes, and depth 128; limits produce typed extraction failures.
  Resource-limited child-process isolation remains a separate defense; it is
  not claimed by these changes.
- 2026-10-20: Source-bound budgets protect PDF candidate discovery and claim
  traversal/evaluation. Exhaustion rejects PDF inspection or explicitly marks
  antecedent coverage incomplete, never silently passing a partial analysis.

- 2026-10-20: Operator adds all captured open Dependabot alerts to the same
  PR and authorizes parallel source work during the #1928 hold. Preserve
  historical fixture bytes; distinguish inert parser inputs from installed
  dependencies. Keep the original Cloud inventory and allowlist unchanged.
  Reversal is the ordinary feature-branch diff; no live alert is dismissed
  during draft triage.

- 2026-10-20: Backport the exact upstream VariantStrIter pointer-mutability
  fix into one licensed, provenance-preserving `vendor/rust/glib-0.18.5`
  source copy shared by both desktop Cargo roots. GTK 0.18 requires GLib
  0.18 and no compatible fixed release exists in the reviewed metadata.
  Retain the true crate version, generate locks after the hold, test release
  behavior and keep scanner status separate from source-fix proof. Reverse
  through the feature diff or retire the patch when supported upstream
  dependencies incorporate the fix.

- 2026-10-21: Exclude only the preserved upstream GLib crate from the spelling
  checker, matching the existing third-party SDK/API-document policy. Upstream
  identifiers and prose retain their recorded provenance; authored maintenance
  documentation outside the crate remains checked. Rust compilation, tests,
  dependency provenance and security review still apply. Reverse by removing
  this spelling entry when the backport is retired.

- 2026-10-21: Use Bun's global `crypto.timingSafeEqual` at the hub platform
  boundary. Installed Bun types expose the Node-compatible comparator API;
  the Bun runtime probe confirms native implementation and equal/unequal behavior. Remove the
  earlier Node import and diagnostic suppression, which the global policy
  correctly rejects. The existing Node/V8 Bun-API test shim supplies Node's
  native comparator only when the global method is absent; its existing
  closed allowlist and all six directives remain unchanged. This is a test
  platform adapter, not a production fallback or handwritten comparison.
  Both runtimes retain the length guard and real authentication assertions.
  Reverse by restoring an equivalent supported native platform binding and
  rerunning both runtime suites and the global diagnostic policy; do not
  restore the rejected suppression. Proof: `research/hub-native-crypto-proof.md`.
  The dual overloads and JSON codec test behavior remain unchanged.

- 2026-10-21: Reconcile the published packet to PR #1930 and parent-confirmed
  remote head `02b5bd3f47`. Scoped remediation covers eight Cloud IDs and 123
  Dependabot IDs; initial hosted coverage repair passed locally without baseline
  lowering and awaits consolidated publication. Retain `active` lifecycle and the interim same-PR reflection because
  merge, merged-revision proof and external closure are acceptance criteria.
  Final reflection/addendum and `completed-retained` flip must accompany actual
  completion evidence; the same-PR documentation convention cannot justify a
  prospective claim. Reversal is a packet-only documentation revert, preserving
  exact captured identities and historical receipts.

- 2026-10-21: Separate CSF-008 dependency/copy work from term evaluation after
  review reproduced premature abstention on ten ordinary multi-parent claims.
  Retain the fixed 8192-unit traversal/path/advisory-copy budget and depth 128;
  allocate term scans `min(262144, 8192 + 512 * locatedTermCount)` units per
  invocation. The input allowance preserves ordinary coverage, while the fixed
  ceiling prevents attacker input from increasing scan work without bound.
  Both budgets charge before work and retain explicit abstention; global
  `antecedent-outside-chain` semantics remain unchanged. Proof:
  `research/claim-budget-review-proof.md`. Reverse this compatibility adjustment
  by restoring the preceding shared-budget implementation and its matching
  tests; retain the enumeration/depth controls and rerun ordinary-input,
  exhaustion and Node/V8 coverage checks before release.

- 2026-10-20, PDF round-one compatibility repair: retain the shared 128-candidate
  / 64 KiB-per-header discovery budget, but return normal structure with the
  additive `containerDiscovery` status (`complete`, `limit-reached`, `encrypted`)
  instead of throwing on raw marker overflow. `streamCheck` remains specific to
  inflation; an exhaustive result requires both fields complete. Defaults retain
  existing constructor/decode compatibility. Reason: harmless markers and large
  valid PDFs must remain inspectable; a new linear parser's rewinds introduced
  uncertainty in the CPU bound. Reverse by reverting this review repair, which
  restores the earlier typed overflow rejection and preserves its CPU bound.

- 2026-10-21: Round-two review demonstrated that DOCX node accounting over all
  archive XML and inflation of ignored media rejected legitimate workloads.
  Supersede the initial 50,000-node/all-entry policy with inventory-first
  selective expansion of exactly Mammoth-consumed XML and relationship parts.
  Retain 20 MiB source, 512 entries, depth 128, DTD rejection and 1,024-byte
  compressed pushes. Charge selected output against min(operation allowance,
  8 MiB), with XML events limited to max(1, min(1,000,000, floor(bytes / 8))).
  Unused media and unrelated XML are never inflated or retained in the repack.
  Keep only the first existing target for each of six fixed relationship types;
  this avoids growing immutable relationship arrays and preserves Mammoth's
  order. Actual prior-source controls fail on 20/60-page-segment XML and 10 MiB
  media; the revised engine passes these controls, including a referenced image,
  plus dense relationship and adversarial XML/ZIP regressions. See
  `research/docx-review-proof.md`. Reversal restores the prior preflight and its
  tests, retaining original security controls but also its documented workload
  rejections; no live input or user document is changed.

- 2026-10-21: Round-two claim review showed that input-scaled allowance alone
  did not fix repeated whole-input scans. Keep the 262,144 ceiling, 8,192
  expansion/copy units and depth 128. Pre-reserve three full term passes before
  building complete claim and global-introduction-head indexes. Query chain-local
  buckets with a six-pass copy/filter/match allowance plus conservative depth
  ordering cost; separately charge the global matching-head fallback. Replace
  eager count-classification tail copies with indexed/lazy access. An incomplete
  index or exhausted query yields explicit abstention. First-global-candidate
  and outside-chain semantics remain unchanged. The 10/45/100-claim controls
  pass without a ceiling increase. See `research/claim-index-review-proof.md`
  for actual tests, coverage and reversal.

- 2026-10-21: Use the supported proposed-closeout contract from `goals/README.md`
  rather than a premature lifecycle flip. The final fix PR carries reflection
  and `proposedCloseout`; operative status stays active. After exact-head hosted
  readiness, retain the genuine classic-monitor verdict and digest, merge
  through the pinned gate, verify merged source, and close the exact external
  IDs. Then `goals completion refresh` writes the clone-scoped derived completion
  receipt. The command checks merge/readiness, while exact dashboard closure
  remains a separately verified acceptance requirement. This supersedes the
  earlier wording about a tracked post-merge status flip and preserves one PR.

## Resumed scope — 2026-10-28

The user requires current Security Cloud findings in addition to historical
closeout. The supplemental packet `../codex-security-findings-2026-10-28/`
is part of this goal. Its seven exact identities require full-detail validation,
remediation, focused regression and package proof, a merged Yeet PR, and observed
post-merge closure. The original eight Cloud and 123 Dependabot requirements
remain intact. The original single remediation PR already merged as #1930.

Decision: use the canonical importer's separate capture and link its exact-ID
inventory here. The current export is not a historical full-snapshot superset,
so refresh cannot preserve provenance; forcing it would discard prior triage.
The change is reversible through this branch's documentation diff. No Cloud
status, credential, deployment or external permission changes during capture.
