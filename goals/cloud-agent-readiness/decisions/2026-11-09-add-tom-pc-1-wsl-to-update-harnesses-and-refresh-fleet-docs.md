---
title: "Add tom-pc-1-wsl to update-harnesses and refresh fleet docs"
date: 2026-11-09
lane: "chore/tom-pc-1-wsl-fleet-parity"
reversal: "Revert the PR: drop the tom-pc-1-wsl HOSTS entry, its alias, the admin_agent and down Host fields and the Muse NOTE check; the host keeps working through ssh-tom-pc-1-wsl and T3 without the skill."
---

tom-pc-1-wsl joins /update-harnesses through its canonical wrapper ssh-tom-pc-1-wsl (YubiKey login, --admin -tt for agentadmin touch-to-sudo), with a host-specific unreachable note for a PC that is off, signed out or missing its T3AgentWSL keep-alive. The admin route starts the dankserver agent only for routes that forward it (beep-worker, grok-bot); tom-pc-1-wsl's wrapper keeps its own agent, so starting the dankserver agent there was wrong. A read-only check reports a Muse settings file without schema_version, which made muse serve exit 3 and broke T3's Muse provider on tom-pc-1-wsl. The fleet docs now match the host's live state, and the stranded 2026-11-07 access receipt moves into this packet because goals/t3code-fleet-rollout is archived. Receipt: history/2026-11-09-tom-pc-1-wsl-fleet-parity.md.
