---
title: "The durable file is the record; stdout does not repeat it"
date: 2026-11-18
reversal: "Print the lane and GitHub-check envelopes and the monitor submit line to stdout again"
---

Where a gate already writes a durable record, its stdout carries no copy: the lane-run and GitHub-check envelopes stay in their files when the artifact path is set, and the readiness-monitor submit line stays in its step log. The GitHub-check report gains a durable file first, because only the lane-run report has one today. Ruling: explorations/agent-verification-output/DECISIONS.md, entry record-is-the-source.
