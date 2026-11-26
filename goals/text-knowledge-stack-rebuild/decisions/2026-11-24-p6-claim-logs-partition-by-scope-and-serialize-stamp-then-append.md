---
title: "P6: law claim logs partition by scope, and propose stamps and appends under the partition's one permit with the floor at its last knowledgeStart"
date: 2026-11-24
lane: "p6"
reversal: "Hold one append-ordered claim log for every scope and drop the partition semaphore and floor"
---

Independent review of the P6 design. ClaimLog refuses an entry whose knowledgeStart is earlier than the last row's, whatever its scope (epistemics/src/ClaimLog.ts:53-57). The ActivityFloor clamp covers only composeLogged pipelines; separate or concurrent claim_propose calls read the stamp inside withActivity and append afterwards, so an interleaving or a clock step back between calls would be refused as KnowledgeStartRegression, and with one log for every scope B's appends would cause A's refusals, which leaks across the wall. LawClaimProposals holds one log per ScopeRef. withPartition(scope, f) runs f under that partition's one-permit Semaphore (effect/Semaphore.ts:438,489; the partition's semaphore is created once, atomically, in a SynchronizedRef of partitions, effect/SynchronizedRef.ts:320) and hands f the partition's last knowledgeStart, which the proposer sets as ActivityFloor before withActivity runs. effect/PartitionedSemaphore (PartitionedSemaphore.ts:367) was read and not used: it shares one permit pool across partitions. The write-tools test asserts two concurrent proposals in one scope, a backward clock step between two separate calls, and that a proposal in B leaves A's log unchanged. The review's office-action flow appends through the same withPartition.
