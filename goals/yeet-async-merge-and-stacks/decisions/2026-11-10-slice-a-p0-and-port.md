---
title: "Slice A: P0 probes recorded and the async merge port published"
date: 2026-11-10
kind: checkpoint
lane: "claude/trusting-hamilton-1ad7d1"
reversal: "Revert the slice A PR; BEEP_YEET_MERGE_ENDPOINT=legacy restores the old call without a revert while the switch exists."
---

P0 research for slice A is recorded in research/merge-async-p0-probes-2026-11.md (live probes on throwaway-base PRs 3082 to 3085, nothing reached main). The port adds GithubAsyncMergeRequest and the GithubAsyncMergeOutcome tagged union, requestAsyncMerge and asyncMergeResult on GithubRest, and settleYeetMerge, which all four merge call sites use. Strict merges send bypass_rules false; only merge-gate --relaxed with a recorded red sends true. Next: the slice A PR merges through merge-async, the blocked-PR hold and that merge line are recorded under history/, and the legacy call is deleted on or after 2026-11-11.
