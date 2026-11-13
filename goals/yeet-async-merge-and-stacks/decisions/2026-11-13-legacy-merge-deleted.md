---
title: "Legacy merge call, its switch and the endpoint field deleted"
date: 2026-11-13
lane: "chore/yeet-delete-legacy-merge"
reversal: "Revert this PR; the legacy call returns behind BEEP_YEET_MERGE_ENDPOINT=legacy."
---

The watch day set by the legacy-merge-switch decision ended on 2026-11-11. This PR deletes the legacy REST merge call from GithubRest, the BEEP_YEET_MERGE_ENDPOINT switch and its config from AsyncMerge.ts, and the endpoint field from YeetMergeSettlement and MergeGateMerged. A field that can hold one value distinguishes nothing, so it goes with the switch rather than staying as a one-literal union; merge lines keep ending 'via merge-async' through one constant. The merge queue, if it is ever routed, is a merge_action on the same endpoint, not a second endpoint.
