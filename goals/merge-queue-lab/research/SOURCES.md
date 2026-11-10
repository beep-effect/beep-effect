# Merge Queue Lab — Sources & Provenance

<!--
The provenance ledger an implementing agent reads to trace every decision back to
its origin. Inherited from the source exploration at graduate (reproduce the
corpus here for implementation convenience AND link the exploration's ledger as
the primary copy). If this goal was authored directly (no exploration), build it
during P0 Research.

RULES
- Never fabricate a URL/DOI/repo link. Reproduce only sources that actually
  appear on disk (here, the exploration's RESEARCH/research, or this goal's
  research/*.md); otherwise cite the section that carries the claim.
- Licenses are load-bearing: copyleft (AGPL/GPL/MPL) upstream is CLEAN-ROOM
  reimplement only (pattern, not vendored code); permissive (MIT/Apache/BSD) may
  be ported WITH attribution; missing/unverified LICENSE ⇒ reference only.
- Listed in ops/manifest.json `currentSourceOfTruth[]` by hand; `researchReports[]` is generated from `research/` by `bun run beep goals manifest --write` (never hand-edited);
  `provenance.exploration` ↔ source exploration `links.goals`.
-->

- **Source exploration:** `explorations/github-merge-queue` — primary ledger:
  `explorations/github-merge-queue/research/SOURCES.md`.
- **Provenance:** the exploration's `BRIEF.md`, `DECISIONS.md` (operator
  rulings of 2026-11-09), `MAP.md`, and its three research lane reports.

## 1. Mined source corpus

No source code is mined. The corpus is the exploration's research, which this
goal reads in place:

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `semantics` | GitHub merge queue semantics | this repo | `explorations/github-merge-queue/research/github-semantics.md` | what GitHub documents, and the 21 behaviours it does not | reference; the "Still unverified" list is this goal's Observations table |
| `inventory` | Repo inventory for `merge_group` | this repo | `explorations/github-merge-queue/research/repo-inventory.md` | workflows, CI admission, Yeet merge path | reference; section C names the driver gap this goal fills |
| `prior` | Prior-work ledger | this repo | `explorations/github-merge-queue/research/prior-work.md` | earlier rulings, measurements, obligations | reference |

**How these inform implementation:** each observation id in `SPEC.md` is the
id of an `UNVERIFIED` claim in `semantics`, and that claim names the lab
action that settles it. The driver calls follow the field lists in
`semantics` 9b and 9c.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| GitHub (hosted product) | not applicable | reference-only | documented rule, events, GraphQL and REST surface; no code |

## 3. External research sources

Every URL below appears on disk in
`explorations/github-merge-queue/research/github-semantics.md`, "Source keys".

- GitHub Docs, "Managing a merge queue":
  <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue>
- GitHub Docs, "Merging a pull request with a merge queue":
  <https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/merging-a-pull-request-with-a-merge-queue>
- GitHub Docs, "Events that trigger workflows" (`merge_group`):
  <https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows>
- GitHub Docs, REST "Rules" (the `merge_queue` rule schema):
  <https://docs.github.com/en/rest/repos/rules>
- GitHub Docs, GraphQL pull-request reference (`enqueuePullRequest`,
  `dequeuePullRequest`, `MergeQueueEntry`):
  <https://docs.github.com/en/graphql/reference/pulls>
- GitHub Docs, "Webhook events and payloads" (`merge_group`, `pull_request`
  `enqueued` and `dequeued`):
  <https://docs.github.com/en/webhooks/webhook-events-and-payloads>
- GitHub CLI manual, `gh pr merge`: <https://cli.github.com/manual/gh_pr_merge>

## 4. In-repo capability references

| Brick | Path | Disposition |
| --- | --- | --- |
| Ruleset create, update, delete | `packages/drivers/github/src/Ruleset.ts` (`@beep/github`) | reuse |
| Ruleset read and drift check | `packages/tooling/tool/cli/src/commands/Ci/CiGovernance.ts` (`beep ci ruleset`) | reuse |
| GraphQL mutation pattern, `enablePullRequestAutoMerge`, `MergeMethod` | `packages/drivers/github/src/PullRequest.ts` | extend |
| `enqueuePullRequest`, `dequeuePullRequest`, queue-entry read | `packages/drivers/github/src/PullRequest.ts` | NET-NEW |
| Token resolution for the merging identities | `packages/tooling/tool/cli/src/commands/Yeet/internal/GhOps.ts` (`provideYeetGhLogin`) | reuse |
| Probe-workflow precedent | `.github/workflows/fleet-lane-probe.yml` | reference |
| Toy required-check workflow | `.github/workflows/queue-lab.yml` on `queue-lab` only | NET-NEW |
| Lab driver script | `goals/merge-queue-lab/ops/` | NET-NEW |
| Readiness and completion readers the R1 and R2 observations exercise | `.../Yeet/internal/MergeReadiness.policy.ts`, `.../Goals/CompletionEvidence.ts` | reference |

## 5. Cross-links & provenance

- Source exploration: `explorations/github-merge-queue` (`links.goals`
  carries this packet).
- Operator rulings this goal serves: `s11-under-a-queue`, `gate-restatement`,
  `verdict-placement`, `first-slice`, `goal-split` in the exploration's
  `DECISIONS.md`.
- Standards: `standards/architecture/DECISIONS.md`, "2026-11-09: Merge Queue
  Activation Is Gated On The Merge-Group Run".
- Gated candidates that wait on this goal's verdict:
  `merge-group-parity`, `yeet-queue-states`, `merge-queue-activation`
  (exploration `MAP.md`).
