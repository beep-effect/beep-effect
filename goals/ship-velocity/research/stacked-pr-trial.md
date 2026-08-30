# E7 stacked pull requests — live two-layer trial

Date: 2026-08-27

Live evidence captured: 2026-08-27T13:46:59Z

## Trial

GitHub's official `github/gh-stack` extension v0.1.0 created a two-layer stack from an isolated
checkout of `origin/main`:

| Layer | Pull request | Base | Base SHA | Head | Head SHA | End state |
| --- | --- | --- | --- | --- | --- | --- |
| Bottom | [#859](https://github.com/beep-effect/beep-effect/pull/859) | `main` | `a3232ce91c3a6ce20ca61761d917058ff343025e` | `trial/ship-velocity-stack-bottom-20260827` | `287528f6e7c93262e12a1926fd0b7c4d458e4d27` | closed, branch deleted |
| Top | [#860](https://github.com/beep-effect/beep-effect/pull/860) | bottom layer | `287528f6e7c93262e12a1926fd0b7c4d458e4d27` | `trial/ship-velocity-stack-top-20260827` | `8d2549e5dd16689b623cd0b548c4aede9e40f63a` | closed, branch deleted |

`gh stack submit --auto` created both draft pull requests and GitHub stack #861. Both layers
registered their own Check, Storybook, Greptile, and Vercel work. A read-only `gh pr checks`
capture for each exact head contained every context in the live 17-context snapshot at
[`branch-protection-contexts.json`](./branch-protection-contexts.json), including the qualified
`Heavy / ...` reusable-workflow names. The trial was based on `main` before E6, so its goals-only
changes exercised the old full-lane cost rather than the skip-success path in this change.

The closeout audit used `gh pr view <number> --json baseRefOid,headRefOid,state,isDraft` for the
recorded SHAs and `gh pr checks <number> --json name,state,workflow` for each context set.

GitHub owned the dependency edge after stacking. A direct `gh pr edit 860 --base main` failed
with `Cannot change the base branch because the pull request is part of a stack`. A subsequent
non-interactive `gh stack sync --prune=false` fetched the trunk, pushed both layers, retained the
`main <- #859 <- #860` chain, and reported stack #861 current. The stack was then unstacked;
both drafts were closed and both remote branches were deleted without merging.

GitHub's public-preview documentation says final-target branch protections apply to every layer,
stack merges are all-or-nothing through the selected layer, and a partial bottom merge
automatically rebases and retargets the remaining layers. The trial deliberately did not merge
throwaway commits into `main`.

Sources:

- [Creating stacked pull requests](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-stacked-pull-requests)
- [Stacked pull requests reference](https://docs.github.com/en/pull-requests/reference/stacked-pull-requests)
- [GitHub public-preview announcement](https://github.blog/changelog/2026-07-30-stacked-pull-requests-are-now-in-public-preview/)

## Decision

Native stacks are operational, but `yeet publish --stack` is deferred. Yeet currently binds its
reviewed proof, poison state, PR lease, closeout report, and merge-ready verdict to one head and
one pull request. Treating a stack as one publish without a multi-head proof model would weaken
exact-head guarantees. Treating every layer as an independent publish preserves proof but makes
each code layer buy the full required suite, multiplying the cost this packet is reducing.

Manual use of the public-preview extension is acceptable for experiments. Revisit integration
when GitHub declares the feature stable and either proof reuse makes per-layer CI economical or
Yeet has an explicit stack artifact that proves and monitors every head independently.
