# GitHub Merge Queue — Sources & Provenance

<!--
The provenance ledger for this packet. Pre-seeded at capture with the on-disk
sources the capture cites; research extends it.

RULES
- Never fabricate a URL/DOI/repo link. Reproduce only sources that actually
  appear on disk in RESEARCH.md / research/*.md; if a claim has no on-disk URL,
  cite the RESEARCH.md section that carries it instead.
- Register this file in ops/manifest.json `exploration.sources`.
-->

- **Cluster / origin:** time-to-certainty B9, promised by the B8 heavy-check
  admission brief (PR C) and ruling 56 (B8-7).
- **Provenance:** `goals/time-to-certainty/research/b8-brief.md`,
  `goals/time-to-certainty/research/decisions.md` (rulings 56–57),
  [goals/ship-velocity/research/merge-queue-evaluation.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/ship-velocity/research/merge-queue-evaluation.md) (E8, 2026-08-27).

## 1. Research lane reports (2026-11-09)

| Report | What it holds |
| --- | --- |
| [`github-semantics.md`](./github-semantics.md) | GitHub's merge-queue behaviour from primary sources: about 56 verified claims, 12 secondary, 21 unverified with the lab observation that settles each. Carries every external URL this packet cites. |
| [`repo-inventory.md`](./repo-inventory.md) | What a `merge_group` event meets in this repo, read at `b730601053f`: the 15 required contexts, about 30 event-conditional scoping sites, the Yeet merge path, red-handling machinery, doctrine rows, and the work list by file. |
| [`prior-work.md`](./prior-work.md) | Every earlier ruling, measurement, cost figure, obligation and rejected option across the repo and the goals archive, with `path:line` and date. Section 7 is the full in-repo source table. |
| `../RESEARCH.md`, "Measurements (2026-11-09)" | The flip condition re-read on live `check.yml` history, red-episode structure, merge composition, per-run cost and pull-request load. Method is stated in the section. |

## 2. Upstream and licenses

No code is ported or vendored. The only upstream is GitHub's hosted product,
used through its documented rule, events and API. Third-party queue products
(Graphite, Mergify, Aviator, Trunk) appear in earlier research as deferred
options and are reference only; each is a paid service, so any adoption is an
operator purchase decision.

## 3. External research sources

Every URL is reproduced in `github-semantics.md` under "Source keys". The
load-bearing ones:

- GitHub Docs, "Managing a merge queue":
  <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue>
- GitHub Docs, "Merging a pull request with a merge queue":
  <https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/merging-a-pull-request-with-a-merge-queue>
- GitHub Docs, "Events that trigger workflows" (`merge_group`):
  <https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows>
- GitHub Docs, REST "Rules" (the `merge_queue` rule schema):
  <https://docs.github.com/en/rest/repos/rules>
- GitHub Docs, "Troubleshooting required status checks" (skipped, pending):
  <https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks>
- GitHub Docs, GraphQL pull-request reference (`enqueuePullRequest`,
  `MergeQueueEntry`): <https://docs.github.com/en/graphql/reference/pulls>
- GitHub CLI manual, `gh pr merge`: <https://cli.github.com/manual/gh_pr_merge>
- GitHub changelog, merge queue general availability (secondary; plan
  coverage): <https://github.blog/changelog/2023-07-12-pull-request-merge-queue-is-now-generally-available/>
- GitHub status incident of 2026-04-23 (secondary; multi-PR squash groups):
  <https://www.githubstatus.com/incidents/zsg1lk7w13cf>

The capture's "GitHub facts" list (2026-09-16) recorded no URL; the report
above supersedes it.

## 4. In-repo capability references

| Brick | Path | Disposition |
| --- | --- | --- |
| `HeavyAdmissionSource` (`"merge-group"`), `HeavyAdmissionEventName` (`merge_group`), `decideHeavyAdmission` | `packages/tooling/tool/cli/src/commands/Ci/HeavyAdmission.ts` (`@beep/repo-cli`) | reuse; extend with a merge-group payload schema and a docs-only verdict |
| `classifyChangedPaths`, change-profile event guard | `packages/tooling/tool/cli/src/commands/Ci/CiOperational.service.ts`, `CiOperational.patterns.json` | reuse (pure over base and head); widen the guard |
| Verification-route classifier and per-lane `skip-satisfied` | `packages/tooling/tool/cli/src/commands/Ci/Route*.ts`; `goals/verification-route/` | reuse |
| `check.yml` triggers, per-ref `concurrency`, about 30 pull-request-only scoping sites; `heavy.yml@main` | `.github/workflows/check.yml`, `.github/workflows/heavy.yml` | extend (`merge_group` trigger and arms) |
| Workflow lint and ruleset capture | `packages/tooling/tool/cli/src/commands/Ci/CiGovernance.ts` | extend (required-context workflows must trigger on `merge_group`; capture the `merge_queue` rule) |
| Runner-loss rerun | `.github/workflows/rerun-runner-loss.yml`, `packages/tooling/tool/cli/src/commands/Ci/CiRerunRunnerLoss.ts`, `RunnerLossRerun.ts` | decide (re-enqueue or leave unsupported) |
| Yeet merge path | `packages/tooling/tool/cli/src/commands/Yeet/internal/MergeGate.ts`, `Merge.ts`, `GhOps.ts`, `SquashCommitlint.ts` | extend (enqueue path, NET-NEW) |
| Yeet state model | `.../Yeet/internal/MonitorPolicy.ts`, `MonitorLoop.ts`, `Settle.ts`, `Settle.schemas.ts`, `Inbox.ts`, `Session.schemas.ts` | extend (queue states, NET-NEW) |
| Auto-merge driver method with no caller | `packages/drivers/github/src/PullRequest.ts` (`@beep/github`) | reuse |
| A5 attempt-journal fingerprints, M4 false-red proxy (16 of 1,060) | `goals/time-to-certainty/research/economics-close.md`, `baseline.md` | reuse (flake budget input) |
| E8 flip-condition measurement | [goals/ship-velocity/research/merge-queue-evaluation.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/ship-velocity/research/merge-queue-evaluation.md) | reuse the method, restate the basis |
| `main` red per required context | `explorations/stacked-pr-adoption/DECISIONS.md` (`main-red-definition`) | reuse (basis) |
| Per-SHA `main` verdict plan and cost | `explorations/ten-minute-certainty/DECISIONS.md` (D7, D9, D11), `MAP.md` | compose with |

The remaining rows (speed-loop ledger items, fleet-coordination tracks,
ruleset history, the inbound deferrals) are in `prior-work.md` section 7.

## 5. Cross-links & provenance

- Goal packet: `goals/time-to-certainty/` (GOAL.md rule "no merge queue
  before the recorded flip condition"; SPEC.md "Explicitly rejected"). Paused
  since 2026-09-28.
- Standards: `standards/architecture/DECISIONS.md`, "2026-08-27: Merge Queue
  Stays Off Until the Recorded Reliability Gate" (Active).
- Live sibling: `explorations/ten-minute-certainty/` (active at `decompose`;
  candidate goal `main-verdict-every-commit`, gated candidates "Per-SHA main
  groups" and "Merge queue").
- Packets that defer to this one: `explorations/stacked-pr-adoption/`
  (parked), `explorations/github-api-quota/` (graduated) and its goals
  `goals/github-state-worker/`, `goals/yeet-monitor-app-identity/`,
  `goals/github-budget-ledger/`.
- Sibling exploration: `explorations/pr-event-awareness/` (graduated to
  `goals/yeet-pr-events`; neither covers queue entry or ejection events).
- This packet: `CAPTURE.md` (2026-09-16), `RESEARCH.md` (2026-11-09).
