lane: rsc-d-release
head: 749ce0758cf6940d206e584f9ac1a0f46ba81f1e (published source/evidence snapshot; final documentation/report commit follows)   PR: #1566
retired: 939 baseline notes; parent da1a85157d7c8cc6b72fe43f12d01389db811ce9; tree d839776128c29c6c4cc7c2937329942d873b973c; plus 1 later private note archived from main #1563
package-verify: @beep/repo-cli pass (full D audit/docgen before refresh; final refresh quick lint/check pass)
hosted-parity: test-tsgo pass / docgen local pass / jsdoc-ratchet pass / knowledge refs pass / fallow audit+health pass / coverage pass (316/316 scoped tests; cohort limitation below)
handoff: goals/repository-simplification-confidence/history/handoffs/rsc-d-release-2026-10-09.md
open: GitHub Packages externally blocked (read:packages absent); local external-consumer scan negative, remote mirrors/deploys not establishable; E-09 citation pending E-owned receipt (R35); exact AGENTS.md replacement below for rsc-shared (R33); rsc-shared policy and cache-baseline review; hosted checks/review window pending at orchestrator gate (S11); lane never merges

## Run 1 report (historical; superseded by Run 2)

lane: rsc-d-release
head: fde1791bfe43980d3138a0fcfd8038f9ed7a7c9d (pre-handoff snapshot)   PR: none (not published)
retired: 939 notes; parent da1a85157d7c8cc6b72fe43f12d01389db811ce9; tree d839776128c29c6c4cc7c2937329942d873b973c
package-verify: @beep/repo-cli pending; admitted and running, no terminal result
hosted-parity: test-tsgo pass earlier / docgen local pass earlier / jsdoc-ratchet pass earlier / knowledge refs fail (one inherited main reference) / fallow audit+health pass / coverage 131-test snapshot pass; expanded 316-test run had one stale assertion, repaired; final rerun queued
handoff: goals/repository-simplification-confidence/history/handoffs/rsc-d-release-2026-10-09.md
open: BLOCKED on inherited main knowledge-ref correction; GitHub Packages lacks read:packages; local external-consumer census negative, remote mirrors/deploys not establishable; E-09 pending E-owned verification; AGENTS.md exact replacement awaits rsc-shared; final package/test/coverage proof and publication pending

## Work and decisions

Census committed first at `da1a85157d`, before the single retirement commit
`ec2080bb68`. All 939 pending Markdown notes except README were removed in
that commit together with the gate, policy and reset baseline. Original counts:
784 package notes, 148 empty-object notes, 7 empty-frontmatter notes.
`standards/changesets.reset-baseline.json` records the parent, original tree,
counts by kind/month and recovery commands. All package versions remain unchanged. The D-only manifest diff is empty;
after the Run 2 main merge the reset-parent manifest diff includes only the
inherited #1564 tinyglobby dependency addition, not a version change.
The 60 historical changelogs and dormant Changesets config/dependencies/
changelog adapter remain. No version command was run. The live ontology name
was removed from the retired registry; the five other entries remain reuse
guards. `@beep/repo-cli` is private and already ignored; this D-policy PR adds
no changeset.

Status decodes private, derives publishEnabled and logs private_skipped.
Absent/false private is publish-enabled; existing version/ignore and lab
exemptions remain. Graph fails private-named notes before any stale registry
allowance. Private deletion prunes keys without emitting an empty note. Labs
and explicit-public deletion behavior remain compatible. A missing private
field now invokes the existing published-deletion refusal/override; all 152
live manifests explicitly declare private true. Root/unowned paths intentionally
carry no independent note obligation. Decisions and reversals are in SPEC.

Activation establishes release/versioning/compatibility and consumer policy,
reconciles ignore/public-access/provenance, flips private false and restores
appropriate notes, publication workflow and hosted action allowlist if E-19
removed it. E-19: no publish path is kept; E removes the unused changesets/action
entry after D merges (R36). Desktop workflow execution is unchanged; only an
explanatory comment changed. Manual npm/Tauri versions remain 0.0.3; Cargo
0.0.0 drift is recorded, not repaired. E owns final desktop verification (R35).

## Census

[Release-policy receipt](../receipts/stage-2-policy.md#external-contracts):
152 npm HTTP404 probes, explicit private manifests; registry config only Buf;
approved gh Packages query HTTP403 missing read:packages (R32; no credential
or scope modification); 61,378 local manifests at unbounded depth across four
roots, no external Beep version/git pins and no directory errors; remote tags
only six evidence tags; gh release list empty; no desktop tags. Private remote
mirrors/deploys are explicitly not establishable. APIs and versions preserved.

## Evidence and proof boundaries

All heavy local verification was admitted through beep-heavy; no queue bypass.
Earlier source-snapshot passes below preceded test-only commits `60f78a541b`
and `fde1791bfe`; they are NOT final-head proof of those new assertions.

| Command / check | Result | Evidence |
| --- | --- | --- |
| `beep quality test-tsgo` | pass on earlier source snapshot | `.beep/rsc-d-test-tsgo.log` |
| `beep docgen local --base origin/main` | pass; 2312 examples typechecked | `.beep/rsc-d-docgen.log` |
| `beep ci lane jsdoc-ratchet` | pass | `.beep/rsc-d-jsdoc-ratchet.log` |
| `CI=true beep knowledge refs --check` | red; rerun confirms exactly one inherited main finding | `.beep/rsc-d-knowledge-rerun.log` |
| `beep quality fallow audit --check` | pass; zero introduced findings, one inherited-adjacent advisory | `.beep/rsc-d-fallow-audit.log` |
| `beep quality fallow health --check` | pass, zero findings | `.beep/rsc-d-fallow-health.log` |
| scoped coverage, 8 files / 131 tests | pass; all release-specific status/graph/deletion tests passed | [normalized snapshot](../receipts/d-coverage-snapshot.json) |
| expanded coverage, 10 files / 316 tests | 315 passed, one stale Yeet remedy assertion; fixed at fde1791bfe; rerun queued | `.beep/rsc-d-coverage-rerun-first.log`, `.beep/rsc-d-final-rerun-admission.log` |
| `beep quality package-verify @beep/repo-cli` | admitted and running, no terminal result | `.beep/rsc-d-package-verify.log` |
| live status / graph | private_skipped=1; 152 workspaces, zero notes/references | command output captured during this lane |
| reset provenance / scope | 939 deletions match parent enumeration, tree matches, manifest diff empty, diff-check clean | baseline and git checks |
| independent Opus review | terminal zero at aeed1cb6a2; later incremental provenance finding addressed by the explicit earlier-snapshot qualifications above | [review receipt](../receipts/d-source-review-2026-10-09.md) |
| hosted run / PR readiness | not run; no PR | publication remains pending |

Source coverage reads: status 95.14/95.37/81.81/93.54 and graph
91.91/92.02/63.33/87.80 (lines/statements/branches/functions), above their
recorded baselines. Full per-file metrics are in the normalized snapshot.
This scoped cohort is not a full repository coverage-floor claim. The initial
geometry forward branch gap led to a new explicit forward-private test; its
fresh coverage is queued. Existing Yeet remedy assertions were updated to the
new publish-enabled/private-exempt policy without weakening them.

The first focused command used an incorrect Vitest cwd and found no tests;
the next caught an introduced filterMap/Option v4 mismatch, fixed at
8800e1545b. The subsequent successful 131-test coverage cohort includes those
same focused tests. Its superseded queued focused-only rerun was cancelled.
Friction and attribution were recorded when encountered in OPPORTUNITIES.

## Blocker and live jobs

`explorations/build-pipeline-simplification/RESEARCH.md:194` has a user-local
beep-heavy executable reference identical on origin/main. Its owner/orchestrator
must fix it once on main; D then merges main. Suggested portable wording:
resolve beep-heavy from PATH while retaining the documented /usr/bin/bash
requirement. This unrelated correction is not copied into D. Packet SPEC's
literal absolute-home prohibition example was reworded, and the knowledge
rerun confirms that row is gone.

Publication was planned and queued through Yeet, then the D publication unit
was stopped before execution while parity is blocked. No push/PR/ready/merge
was performed. The read-only package-verify is admitted and running; the final
test/coverage/knowledge rerun remains queued; inspect their lane-local logs and collect
terminal exit status before claiming a package handoff gate. They may finish
after this blocked report. Resume by merging the owner's main fix, collecting
those results, rerunning any affected proof, and using Yeet publish/ready/reply.
Never merge the PR from this lane; the orchestrator gates it. Retire the lane
worktree only after its merge and explicit orchestrator direction.

## Exact AGENTS.md replacement for rsc-shared (R33)

> Private internal workspaces (`private: true`) require no changeset and must
> not accumulate pending release notes. Changed, versioned, publish-enabled
> product workspaces require an in-branch changeset unless explicitly ignored.
> Publication activation must deliberately establish release/versioning policy,
> audit external contracts, reconcile ignore exemptions, and restore appropriate
> changeset requirements and publication workflow/hosted allowlist wiring.
> Desktop versioning and releases remain separate.

The orchestrator applies this on the same PR through rsc-shared. AGENTS.md
was not edited by D. R38 requires its shared-policy review of changeset config
and the retired-name registry. No generated manifests or inventories were
hand-edited. Main was merged twice; neither merge introduced pending notes.

## Recovery

`git checkout da1a85157d7c8cc6b72fe43f12d01389db811ce9 -- .changeset` restores
notes AND historical config/README. Pair it with a revert of the reset policy
PR, including the private-note graph guard; restored private notes alone fail
current validation deliberately. `git ls-tree --name-only d839776128c29c6c4cc7c2937329942d873b973c`
and `git show <parent>:.changeset/<name>.md` inspect history without changing it.
The orchestrator records the post-merge SHA (R34).

## Run 2 (after crash)

Resumed from `a30822664f`; no pre-existing uncommitted edits. Required fetch/main
merge reconciled the squash-packet add/add conflicts against `3dbf109066`,
retaining D decisions and main's stage-1 closure at merge `40f9ecb051`.
Authorized knowledge repair branch merged at `450e477efd` while #1565 is open.
No local edit to the inherited research file was made. Final expanded coverage
from the prior run has a terminal exit=0 record and 316/316 tests; package log
has successful audit/docgen but no separately persisted exit row. Both package
and parity are therefore rerunning through beep-heavy with explicit exit files.
This section supersedes the earlier live-job state; results follow below.

Run 2 parity terminal records at `.beep/rsc-d-run2-parity-results.txt`: test-tsgo,
docgen, jsdoc-ratchet, knowledge refs, Fallow audit and health all exit 0.
Knowledge has zero live gated observations. Fallow audit has zero introduced
findings and one inherited-adjacent advisory; health has zero findings.
Coverage stopped before tests with a shared `.vitest-cache` ENOTEMPTY startup
collision; rerun is serialized after package audit, not counted as a test red.
Independent source/scope review at `3897314253`: zero actionable P0–P3 findings;
receipt updated. Both main merges preserved the single retirement commit.

Run 2 terminal package proof: `.beep/rsc-d-run2-package-result.txt` exit 0
(audit 740.7s, docgen 24.5s). Serial coverage:
`.beep/rsc-d-run2-serial-coverage-result.txt` exit 0, 316/316 tests.
Normalized scoped metrics replace the historical snapshot; the narrower
IssueClassification cohort is explicitly below three broader baseline metrics,
with no executable D behavior change in that file. All other measured rows
meet every recorded metric. Full repository coverage floors are not claimed.

Publication attempt was terminated at the 16 GiB unit cap; journal records
oom-kill and 16 GiB peak. It also exposed an introduced cache-policy evidence
reference to a retired note. Exact original bytes/digest were preserved in
`history/receipts/d-cache-review-evidence.md`; the owner command regenerated
only four baseline reviews, keeping every non-review payload field identical.
This shared baseline hunk also needs rsc-shared review. Retrying publication
through admission at a 24 GiB cap; no machine-wide capacity or slot change.

## Run 2 publication and orchestrator handoff

PR [#1566](https://github.com/beep-effect/beep-effect/pull/1566) published through
Yeet at `749ce0758cf6940d206e584f9ac1a0f46ba81f1e`, then marked ready with
`beep yeet ready`; it carries `ready-for-heavy`. Yeet cheap gates and frozen
head-install preflight passed. The final documentation/report wave follows this snapshot;
its exact final SHA is delivered in the lane's terminal report.

The first remote read had zero unresolved threads, zero failing checks, and
pending/running hosted checks.
[Check run](https://github.com/beep-effect/beep-effect/actions/runs/37966763979)
and [Heavy Admit](https://github.com/beep-effect/beep-effect/actions/runs/37966779900)
are hosted evidence at the publication snapshot, not green/final-head claims.
The 20-minute review window begins at the later of ready and final push.
The orchestrator re-reads threads and applies S11 at its merge gate; no lane
merge or retirement was attempted.

The two memory-capped publication attempts ended at 16 and 24 GiB. Running
`lint:effect-imports` and `lint:schema-first` individually at Turbo concurrency 1
through beep-heavy passed both and populated their normal task caches; the
canonical publisher then passed every gate. No scanner, gate or admission slot
was disabled. D-owned executable source and tests are unchanged since the terminal Run 2 executions;
those earlier proofs cover the pre-final-main-refresh snapshot, while the refresh
incorporates substantive inherited accounts and security changes.
the final wave clarifies the module JSDoc exemption paragraph and updates
evidence/reports. Quick package, bounded docgen and knowledge checks cover
that documentation wave separately.

Under the crash-resume ruling, the lane must not exit with units it started
running. Its detached readiness monitor is cancelled at handoff with a terminal
job record; this is not merge-readiness proof. The orchestrator owns continued
hosted polling and the S11 gate, including the shared AGENTS.md policy edit
above, review of `.changeset/config.json`, retired registry and generated
cache-baseline review relocation. Cancellation affects only lane-owned monitor
units, not hosted CI or other sessions.

Final local checks after the main refresh all exited 0: quick package lint/check,
bounded docgen, knowledge references, test-tsgo, JSDoc ratchet, Fallow audit and
health, and scoped coverage (10 files, 316 tests). Each ran serially through
beep-heavy; terminal rows are in `.beep/rsc-d-final-doc-results.txt` and
`.beep/rsc-d-final-parity-parity-results.txt`. The admitted unit exited 0. Scoped coverage remains a read of the touched files; the narrow
IssueClassification cohort does not claim the broader repository floor.
No changeset is added: repo-cli is private and already ignored, and this PR
lands the D policy. Post-merge SHA recording remains R34; E-09 remains R35.

## Final main refresh and hosted attribution

Merged main `36027982f2` (accounts #1563 and OSV #1562) at `2cf3724e93`.
The only packet conflict was append-only friction evidence; both sides survive.
Main added one private repo-cli pending note after the 939-note reset. Its exact
bytes are archived at `history/receipts/d-post-baseline-accounts-note.md`, outside
`.changeset`; no version or original reset-baseline count changes.

The publication-snapshot hosted checks passed except Coverage Regression
([job](https://github.com/beep-effect/beep-effect/actions/runs/37966779900/job/113943662347)).
Its exact log reports only `EffectImports.ts`: functions 89.34 < 90.17,
lines 92.36 < 92.52, statements 92.02 < 92.13. That file is byte-identical
to main; it came from the inherited #1564 repair, not D. S11 routes that
red to the orchestrator consolidated fix. Zero review threads at this read.
These are publication-snapshot results, not the later final head.
