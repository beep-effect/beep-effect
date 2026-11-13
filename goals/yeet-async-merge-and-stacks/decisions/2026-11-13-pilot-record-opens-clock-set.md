---
title: "The pilot record opens before the first stack and its clock runs from 2026-11-13"
date: 2026-11-13
lane: "docs/stack-pilot-record"
reversal: "Restart the clock on the first routine stack's creation date and move the verdict date with it."
---

PLAN.md said to start the pilot record on the first routine stack. None was open on 2026-11-13: the stack listing held only the test, probe and acceptance stacks, and no open pull request had a base other than main. The record opens anyway (research/stack-pilot-2026-11.md), and its clock is set instead of left waiting: fourteen days from 2026-11-13, the day `yeet publish --stack-on` reached main (#3224), to the end of 2026-11-26. A clock that starts on the first stack never starts if nobody stacks, and then the first kill criterion, fewer than two stacks a week, could never fire. Lanes learn of the row from the orchestrator, which was told on 2026-11-13, and from a step in the yeet skill (references/stacks.md) that lands with the base-conflict fix PR. The verdict session adds a row for any stack whose lane left none. Stack #3190 is the reference row and is not counted.
