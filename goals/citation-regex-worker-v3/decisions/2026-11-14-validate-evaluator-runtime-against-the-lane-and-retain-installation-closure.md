---
title: "Validate evaluator runtime against the lane and retain installation closure"
date: 2026-11-14
reversal: "Replace these guards only with equivalent lane-runtime and closed-installation refusal checks."
---

Hosted round 1 exposed fixtures whose invocation opened outside their counting spawner or captured Clock. Each evaluator must match the lane runtime on every evaluation, including the first. CitationNativeLane.matchesRuntime compares the actual captured handles; regexOwner caches only an adapter. Remove ineffective provides around Effect.succeed. The evaluator also retains an installation-Scope closed flag and refuses closed before runtime comparison, preserving the closed-owner failure rather than trying a deleted worker path and returning spawn-failed. This does not move physical children out of invocation Scope. Fixtures must open their invocation with the same spawner and Clock, including the Clock captured by their operation admission; matching sleep functions in different Clock objects is insufficient. Keep expected process counts and budget/refusal assertions; move capacity-return assertions after invocation closure where lane lifetime requires it.
