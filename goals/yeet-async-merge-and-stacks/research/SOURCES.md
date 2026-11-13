# Yeet Async Merge and Native Stacks — Sources & Provenance

- **Source exploration:** `explorations/stacked-pr-adoption` — primary ledger:
  `explorations/stacked-pr-adoption/research/SOURCES.md`.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| [github/gh-stack](https://github.com/github/gh-stack) | MIT | reference-only (used as a CLI) | the native stack CLI, v0.3.0 |

## 3. External research sources

The exploration's ledger lists every URL. The ones this goal builds on:

- REST pulls reference, `merge-async` and its poll endpoint — https://docs.github.com/en/rest/pulls/pulls
- Stacked pull requests reference — https://docs.github.com/en/pull-requests/reference/stacked-pull-requests
- Stacked PR APIs and webhooks — https://docs.github.com/en/pull-requests/reference/stacked-pull-requests-apis-and-webhooks
- Changelog, general availability (2026-10-06) — https://github.blog/changelog/2026-10-06-stacked-pull-requests-generally-available
- `gh stack` releases — https://github.com/github/gh-stack/releases

## 4. In-repo capability references

| Brick | Path | Disposition |
|-------|------|-------------|
| Legacy merge call | `packages/tooling/tool/cli/src/internal/github/GithubRest.ts` | replaced by the async request and poll in slice A; deleted 2026-11-13 |
| Merge gate and merge porcelain | `packages/tooling/tool/cli/src/commands/Yeet/internal/MergeGate.ts` and its neighbours for merge, GitHub operations and owner-checkpoint merge | extend |
| Review window | `packages/tooling/tool/cli/src/commands/Yeet/internal/ReviewWindow.ts` | extend |
| Receipt carry rule | `packages/tooling/tool/cli/src/commands/Yeet/internal/FinalCheckRefresh.ts` | extend |
| Ready flip and the S32 commit | `packages/tooling/tool/cli/src/commands/Yeet/internal/ReadyGate.ts` | extend |
| PR creation | `packages/tooling/tool/cli/src/commands/Yeet/internal/PullRequest.ts` | extend |
| Sweep and retire | `packages/tooling/tool/cli/src/commands/Yeet/internal/Sweep.ts` and the retire module beside it | extend |
| Head-move classifier, async merge client, stack model | none | NET-NEW |

## 5. Cross-links & provenance

- Shape and decomposition: `explorations/stacked-pr-adoption/BRIEF.md` and
  `explorations/stacked-pr-adoption/MAP.md`.
- Evidence: `explorations/stacked-pr-adoption/research/stack-test-2026-11.md`
  (the test) and `explorations/stacked-pr-adoption/RESEARCH.md`, 2026-11-09
  section (the measurements).
- Rulings: `explorations/stacked-pr-adoption/DECISIONS.md`.
- Sibling exploration: `explorations/github-merge-queue`.
