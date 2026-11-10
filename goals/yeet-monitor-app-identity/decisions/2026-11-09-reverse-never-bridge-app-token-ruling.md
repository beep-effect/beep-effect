---
title: "Reverse the 2026-10-31 ruling: never bridge the App token into yeet monitor"
date: 2026-11-09
reversal: "Point the worker back at the user token (set the per-host worker identity to user)"
---

Answer: the 2026-10-31 orchestrator ruling (orchestrator HANDOFF.md) forbade bridging the App token into yeet monitor because the monitor merged (App lacked Workflows permission), spawned raw gh reads, and reran jobs. Once 3a moves reruns to Rerun Runner Loss and the polling reads run in the github-state worker on the in-process client, none of those reasons applies to the reader. The App token is minted in-process by GitHubApp.ts from a LoadCredential= credential; it is never given to monitor writes, merges or operator commands. Takes effect only when 3b lands. Source: exploration `explorations/github-api-quota/DECISIONS.md`, entry 'identity'; RESEARCH.md Constraints.
