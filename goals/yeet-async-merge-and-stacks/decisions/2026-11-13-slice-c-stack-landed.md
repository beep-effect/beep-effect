---
title: "Slice C: a two-layer stack landed through Yeet and the tooling is published"
date: 2026-11-13
kind: checkpoint
lane: "feat/yeet-two-layer-stacks"
reversal: "Revert the slice C tooling PR; --stack-on and the stack gate go away, a stacked pull request holds on its parent branch's empty ruleset again, and step 2c returns to fold or publish-after-parent."
---

Stack #3190 landed on 2026-11-13: #3188 (parent) and #3189 (layer, published with yeet open --stack-on) were flipped by yeet ready with their heads unchanged, merged from the top by one yeet merge-gate 3189 request as 238dc10536 and b634505651 in a single push, and retired with yeet sweep --retire. The record is history/2026-11-13-slice-c-stack-landed.md. The tooling adds the Stacks REST read and create to GithubRest, the stack model (Stack.schemas.ts, Stack.ts), StackTrunk.ts, StackPublish.ts and StackGate.ts, the --stack-on and --alone flags, guards on yeet merge and yeet gh merge, and the skill text (step 2c, references/stacks.md). Next: slice D opens its pilot record on the first routine stack.
