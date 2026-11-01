# repo-cli gh/git consolidation

## Status

Lifecycle: `paused`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Move repo-cli and its tests off hand-rolled gh and git spawning onto @beep/github, @beep/git and @beep/commands, extending the kits where they lack the feature

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/repo-cli-gh-git-consolidation/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - supporting research, if present.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P0 Research — not started (paused).

## Latest Evidence

Not started.

## Notes

Created paused by effected-promotion closeout PR C from its W4-l decision. Resume when someone picks up
the gh/git kit features. Start with the `Git.isAncestor` and fail-closed-parser gaps, which unblock the most
git-wrapper rows. The site list is [`research/site-list.md`](./research/site-list.md).
