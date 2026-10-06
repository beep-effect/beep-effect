# Stacked PR Adoption — Sources & Provenance

- **Cluster / origin:** 2026-10-05 merge burn-down (#1436 unblock window);
  operator-requested research into GitHub native stacked PRs.
- **Provenance:** [`../RESEARCH.md`](../RESEARCH.md) carries every claim; this
  ledger lists where each came from. All URLs accessed 2026-10-05.

## 2. Upstream repositories & licenses

No code is ported. Tools are evaluated for use, not vendored.

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| [github/gh-stack](https://github.com/github/gh-stack) | MIT | reference-only (used as a CLI) | native stack CLI; v0.1.0 used in E7 |
| [ejoffe/spr](https://github.com/ejoffe/spr) | MIT | reference-only | commit-per-PR stacks; `spr merge` collapses a stack into one PR |
| [ezyang/ghstack](https://github.com/ezyang/ghstack) | MIT | reference-only | `gh/<user>/N/{base,head,orig}` branches; lands outside the merge button |
| [git-town/git-town](https://www.git-town.com/stacked-changes) | MIT | reference-only | `hack`/`append`/`propose`/`sync`; linkable via `gh stack link` |
| Graphite (SaaS) | proprietary | reference-only | stack CLI plus app; merge queue in paid tiers |

## 3. External research sources

GitHub docs, stacked pull requests (public preview):

- About stacked PRs — https://docs.github.com/en/pull-requests/get-started/about-stacked-prs
- Stacked pull requests reference — https://docs.github.com/en/pull-requests/reference/stacked-pull-requests
- Creating stacked pull requests — https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-stacked-pull-requests
- Managing stacked pull requests — https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/managing-stacked-pull-requests
- Merging stacked pull requests — https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-stacked-pull-requests
- Optimizing CI for stacked pull requests — https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/optimizing-ci-for-stacked-pull-requests
- Troubleshooting stacked pull requests — https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-stacked-pull-requests
- Stacked PR APIs and webhooks — https://docs.github.com/en/pull-requests/reference/stacked-pull-requests-apis-and-webhooks
- Stacked PRs CLI commands — https://docs.github.com/en/pull-requests/reference/stacked-prs-cli-commands
- Rolling out stacked PRs — https://docs.github.com/en/pull-requests/tutorials/roll-out-stacked-prs
- Using other tools with stacked PRs — https://docs.github.com/en/pull-requests/reference/use-other-tools-with-stacked-pull-requests
- Changelog, public preview (2026-07-30) — https://github.blog/changelog/2026-07-30-stacked-pull-requests-are-now-in-public-preview/
- Community discussion (user reports only, UNVERIFIED claims) — https://github.com/orgs/community/discussions/201439

GitHub docs, merge queue and Actions:

- Managing a merge queue — https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue
- Events that trigger workflows (`pull_request`, `merge_group`) — https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- Workflow syntax (`branches` filter) — https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
- Webhook events, `pull_request` — https://docs.github.com/en/webhooks/webhook-events-and-payloads#pull_request

Alternatives:

- Graphite pricing — https://graphite.com/pricing
- Graphite startup/OSS program (2024) — https://graphite.com/blog/startup-program-announcement
- Graphite GitHub App auth — https://graphite.com/docs/authenticate-with-github-app

Live repo evidence (read-only `gh api` queries, recorded in RESEARCH.md Q0–Q2):
the Actions runs and jobs for 2026-10-05; PR timelines for #1433 and #1442;
`rules/branches/main`; and `pulls/<n>` for #1427, #1433, #1442 and #1444.

## 4. In-repo capability references

| Brick | Path | Disposition |
|-------|------|-------------|
| Heavy admission (`run`/`skip-satisfied`/`hold`) | `packages/tooling/tool/cli/src/commands/Ci/HeavyAdmission.ts` | extend (main-red hold, stack position) |
| Yeet PR creation | `packages/tooling/tool/cli/src/commands/Yeet/internal/PullRequest.ts` | extend (`--stack-on`) |
| Yeet ruleset read | `packages/tooling/tool/cli/src/commands/Yeet/internal/Settle.ts` | extend (trunk, not parent) |
| Yeet stale-base guard | `packages/tooling/tool/cli/src/commands/Yeet/internal/PublishScope.ts` | extend (parent and trunk freshness) |
| Yeet sweep | `packages/tooling/tool/cli/src/commands/Yeet/internal/Sweep.ts` | reuse |
| Stack model in Yeet | — | NET-NEW |

## 5. Cross-links & provenance

- E7/E8 trial and decisions: `goals/ship-velocity/research/stacked-pr-trial.md`,
  `goals/ship-velocity/research/merge-queue-evaluation.md`.
- Earlier rulings: `explorations/agent-pipeline-velocity/DECISIONS.md`
  (pr-topology), `explorations/beep-ci-operational-ontology/DECISIONS.md`
  (Ruling 21).
- Ledger items: `goals/speed-loop/research/OPPORTUNITIES.md` #22, #62, #80.
