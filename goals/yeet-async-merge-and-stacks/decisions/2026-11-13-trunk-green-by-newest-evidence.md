---
title: "main is green when each required check's newest completed run passed"
date: 2026-11-13
lane: "feat/yeet-two-layer-stacks"
reversal: "Judge the trunk by its head commit alone, or drop the read and let the lane assert green."
---

`yeet publish --stack-on` opens a stack only on a green trunk (decision 2026-11-10-stack-only-on-green-main), so green needs a definition a command can read. main lands a pull request every few minutes and each push cancels the previous Check run: on 2026-11-13 the head and the nine commits under it carried no completed run for eleven of the fifteen required contexts. Yeet therefore reads the newest 30 first-parent commits and, per required context, takes the newest completed run that was not cancelled. Every context passing is green; any context whose newest evidence failed is red and names it; a context with no completed run in those commits is unknown. Red and unknown both refuse, and there is no override flag: the reversal is this file. The read runs only when a lane opens a new layer, never on a later push of an existing one, because that stack is already open.
