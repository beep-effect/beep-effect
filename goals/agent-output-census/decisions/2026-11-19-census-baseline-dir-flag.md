---
title: "The census command takes --baseline-dir for the directory --write-baseline writes to"
date: 2026-11-19
lane: "goals/agent-output-census-library"
reversal: "Remove the flag and always write under standards/agent-output-census/runs at the repository root."
---

The default stays standards/agent-output-census/runs under the repository root. The flag lets the render test write a run into a temporary directory, and lets an operator record a run outside the checkout, without changing the default. The write opens with the exclusive-create flag, so a second run for the same window end and rule version fails and leaves the first file untouched.
