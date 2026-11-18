---
title: "P2 quiet surfaces built"
date: 2026-11-18
kind: checkpoint
lane: "fix/gate-output-quiet-surfaces"
reversal: "Revert the three commits on the lane."
---

Fixes 3, 4 and 5 are implemented with tests. AC5: a test walks every command path; a subcommand help page fell from 2,490 to 1,911 characters and root help is unchanged at 4,776. AC6: with the side channel set, both envelopes go to their files and stdout carries neither; without it stdout is byte-identical to before. AC7: the detached submit step runs on the split executor, its JSON line stays in the step log, and the parent still prints the readiness monitor job id. The attached fallback, which shares the step id without `--detach`, keeps streaming.
