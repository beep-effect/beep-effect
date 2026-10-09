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
counts by kind/month and recovery commands. All package manifests/versions
remain unchanged (`git diff da1a85157d HEAD -- '**/package.json'` is empty).
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
