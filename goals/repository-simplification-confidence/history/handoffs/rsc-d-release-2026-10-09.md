lane: rsc-d-release
head: pending reset commit   PR: pending
retired: 939 notes; parent da1a85157d7c8cc6b72fe43f12d01389db811ce9; tree d839776128c29c6c4cc7c2937329942d873b973c
package-verify: @beep/repo-cli pending admission
hosted-parity: test-tsgo / docgen local / jsdoc-ratchet / knowledge refs / fallow / coverage -> pending
handoff: goals/repository-simplification-confidence/history/handoffs/rsc-d-release-2026-10-09.md
open: GitHub Packages blocked by missing read:packages; external local consumer scan negative, private mirrors/deploys not establishable; E-09 pending E-owned verification; AGENTS.md replacement awaits rsc-shared; final proof and independent review pending

## Work and provenance

Census committed first (`da1a85157d`), with per-workspace npm results and the
61,378-manifest unbounded local consumer census. Reset parent and tree are in
`standards/changesets.reset-baseline.json`; retirement removes all 939 pending
Markdown notes except README in one commit with the gate and policy change.
Package manifests and all versions remain unchanged; 60 changelogs retained.
No version command was run. `@beep/repo-cli` is private and already ignored;
this PR establishes D policy and adds no changeset.

Status decodes `private`, derives publishEnabled and logs private_skipped.
Absent/false private remains publish-enabled. Graph fails on notes naming live
private workspaces even if a stale registry entry permits the name. Deletion
adds private-exempt with pending key pruning but no empty deletion note; labs
and publish-enabled deletion behavior remain compatible. Root/unowned paths
intentionally carry no independent note requirement.

Dormant config explicitly disables private versioning/tagging. Changesets
config/dependencies and changelog adapter are retained. Activation policy
establishes external contract/versioning obligations, reconciles ignore names,
flips private false and restores workflow/allowlist and changeset requirements.
E-19: no publication path is kept; E removes unused changesets/action allowlist
entry after D merges. Desktop execution is unchanged; explanatory comment only.
Manual npm/Tauri versions are 0.0.3; Cargo 0.0.0 drift recorded, not repaired.

## Exact AGENTS.md replacement for rsc-shared (R33)

Replace the release-note law at the orchestrator-owned target with:

> Private internal workspaces (`private: true`) require no changeset and must
> not accumulate pending release notes. Changed, versioned, publish-enabled
> product workspaces require an in-branch changeset unless explicitly ignored.
> Publication activation must deliberately establish release/versioning policy,
> audit external contracts, reconcile ignore exemptions, and restore appropriate
> changeset requirements and publication workflow/hosted allowlist wiring.
> Desktop versioning and releases remain separate.

The orchestrator applies this on the same PR through rsc-shared; this lane
has not edited AGENTS.md. R38 also requires its shared-policy review of
.changeset/config.json and standards/changesets.retired-packages.json.

## Recovery

Restore notes with `git checkout da1a85157d7c8cc6b72fe43f12d01389db811ce9 -- .changeset`.
Inspect the original tree with `git ls-tree --name-only d839776128c29c6c4cc7c2937329942d873b973c`.
The full-directory checkout also restores historical config/README. Restore
code/policy by reverting the PR with it, including the private-note graph guard;
restored private notes alone deliberately fail the current guard. The orchestrator records merge SHA
in stage-2-policy.md after merge (R34). Never merge or retire from this lane
until the orchestrator directs retirement.

## Verification and scope

Focused private/public/mixed status, graph private rejection and deletion/
geometry tests added. Heavy tests and package verification are admitted through
beep-heavy with the user-session bus; currently queued. Hosted parity, coverage,
independent claude-opus-5-5 medium review and hosted run are pending.
No unrelated refactoring is intended. Generated task/script manifests untouched.
