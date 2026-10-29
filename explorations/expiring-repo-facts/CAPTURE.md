# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-10-22

Operator, verbatim:

> I've realized that we need some sort of way to deal with things that have an expiration date or need to be followed up on in some sort of routine or cron in order to keep this repository from growing stale bits.
>
> For example recently I had an agent fix this issue I was having with `bun deps:update` where statelyai would break `bun install` after `deps:update` was ran. @syncpack.config.ts#L185-187
>
> This is a perfect example of a thing that likely has an expiration date.
>
> I'm curious what is out there in terms of how people handle this. Specifically what sorts of skills, plugins, CI/CD & related setups exist that would allow agents to add 'things' (unsure of taxonomy) to some sort of 'store or ledger' where in each 'thing' has a sort of 're-check', 'validate still true', 'remove stale thing', 'update stale thing' timer that would run either a claude routine or job using a date. Allow for agents to extend the 'check' window on those 'things'.
>
> Capabilities
> - agents have a dedicated skill in this repo to explain the process
> - dedicated cli or mcp that allows items to be consistently added to a store or ledger to make it consistent & conformant to some specification or schema
> - some sort of cron or routine that runs on a schedule which checks this ledger or store regularly & kicks off expired 'things' or (and even better) something that simply kicks off the agent on a box like beep-worker or dankstation as soon as the 'datetime/event' occurs.
>  - is LLM provider agnostic or has adapters allowing for the creation of mergeable PR's to address or updating 'things'. Reasoning is if for example the default provider (likely opus 5.5) is out of usage then codex -> cursor -> grok-build -> muse wonderful -> junie could be used to accomplish the task instead
>
> What do you think about this? I want your takes. You can challenge any of the ideas (all though loose) I've had if you have better ideas or language. use /deep-research & /adhd

Agent observation the same day: on `main` the statelyai fix has no syncpack
hold at all. It is an exact catalog pin, `"statelyai": "0.14.3"` in the root
`package.json`, added inside #2005 with no reason recorded next to it. The
example has already lost its "why".

A deep-research pass (three research lanes plus a report writer) and an
`/adhd` ideation pass (five frames, three deepened ideas) ran that day. Their
outputs are under [`research/`](./research/); the review page was a private
claude.ai artifact.

## 2026-10-27

Operator pointed at a reference checkout:
`$HOME/YeeBois/references/effect/kitlangton-skulk` ("I just found something
very relevant to this i think"). Agent read the source; notes are in
[`RESEARCH.md`](./RESEARCH.md) under the skulk section.

## 2026-10-28

Operator asked whether this had graduated to a goal or landed as an
exploration packet on `main`. It had not; this packet is the capture.
