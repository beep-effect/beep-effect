# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-11-01

Operator ask, verbatim:

> I just added beep-effect to this session. I did this because I want to start
> using t3code as my primary driver for doing work in beep-effect, accross my
> various cloud, linux environments & on this workstation.
>
> I've just extracted the transcript from theo's youtube channel talking about
> all of the features of t3code in
> [the transcript file in the operator's local context-packet folder]
>
> I want to setup the MCP Server on all of my harnesses, Modify the ORCHESTRATOR
> related skills & documentation for messaging sessions cross provider using
> t3code, setup t3code on all of my linux environments:
>
> - beep-worker
> - tbk-worker
> - dankserver
> - grok-bot-box-1 if possible
> - tom-pc-1
> - also create a wsl environment on tom-pc-1 & setup everything there
>
> configure t3code through my tailnet
>
> Then as a follow up I'd like if possible to setup a routing policy for
> spinning up beep-effect work on those boxes when dankstation compute is
> constrained.
>
> If you could explore the relevant documentation and skills relevant to
> 'orchestration', 'handoffs', agent to agent messaging & other relevant
> information you find important
>
> I'm not sure what all of this looks like so I recommend we bootstrap a new
> exploration packet in beep-effect & see it through to a mergeable PR for me
> to launch in a different session inside the t3code app.

Source material (outside the repo, operator context packet): YouTube
transcript "T3 Code broke me" (Theo - t3.gg, uploaded 2026-10-29,
https://www.youtube.com/watch?v=uLGxb4F3SyI), auto-generated captions, at
the operator's local context-packet folder. Not copied
here; RESEARCH.md summarizes the features it names.

Same-session context (2026-11-01, before this packet opened):

- DankStation's installed T3 Code is now built from the fork
  `beep-effect/t3code` `main`, which a systemd user timer
  (`t3code-source-update.timer`: 4 min after login + daily 08:00) syncs with
  `pingdotgg/t3code`; conflicts and gate failures go to a headless Opus 5.5
  medium agent with Codex `gpt-6.1-sol` medium fallback. Script:
  `update-t3code-source` in the operator's local bin directory. Fork customizations therefore ship to
  the workstation install; other hosts have no equivalent yet.
- Prior art in this repo: `retired:cross-provider-agent-communication` ([last tree](https://github.com/beep-effect/beep-effect/tree/6bb8584b6dbc9aee927a200901c9eebc0abd63b1/explorations/cross-provider-agent-communication))
  (graduated 2026-10-09) qualified a T3-owned desktop host for autonomous
  Claude <-> Codex messaging through T3's MCP tools
  (`research/T3CODE-QUALIFICATION.md`), and graduated
  `retired:agent-message-router` ([last tree](https://github.com/beep-effect/beep-effect/tree/6bb8584b6dbc9aee927a200901c9eebc0abd63b1/goals/agent-message-router)) + `retired:agent-session-bridges` ([last tree](https://github.com/beep-effect/beep-effect/tree/6bb8584b6dbc9aee927a200901c9eebc0abd63b1/goals/agent-session-bridges)).
