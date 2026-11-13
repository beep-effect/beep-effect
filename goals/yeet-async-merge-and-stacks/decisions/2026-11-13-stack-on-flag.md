---
title: "A layer is published with --stack-on; Yeet's --base stays the trunk"
date: 2026-11-13
lane: "feat/yeet-two-layer-stacks"
reversal: "Remove the flag and StackPublish.ts; every Yeet pull request targets the default branch again."
---

`yeet publish --stack-on <pr>` and `yeet open --stack-on <pr>` create the pull request on the parent's branch and link the two through `POST stacks`. `--base` keeps meaning the trunk, so affected planning, final-check and the ruleset read stay on `origin/main` and cover a superset. Only what must see the layer alone changes: the title and body summary come from the commits above the parent's head, base freshness measures the layer's own paths (three-dot from the parent's head, so a parent that moved does not count as the layer's change), and a `--push-only` merge of the parent's branch is accepted. The decision is taken before any commit or push, so a refusal changes nothing: the parent must be open, on the trunk and unstacked, the branch must contain its head, and the trunk must be green. A later publish of the same layer needs no flag: Yeet reads the branch's pull request, finds the open layer below it in the stack, and skips the trunk read because that stack is already open. Yeet never retargets an existing pull request. A link that fails after the create is repaired by running the command again. The label step keeps reading the whole range from the trunk, so a docs-only layer on a code parent is still labelled; that errs toward more CI, never less.
