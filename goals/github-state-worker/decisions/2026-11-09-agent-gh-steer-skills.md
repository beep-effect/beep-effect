---
title: "Ad-hoc agent gh calls: steer to a cached status read through skills"
date: 2026-11-09
reversal: "Revert the yeet and orchestrate skill edits; the status --cached command can stay as an unused read."
---

Add `beep yeet status --cached` that reads the worker snapshot, and update the yeet and orchestrate skills to prefer it over raw `gh pr view` / `gh pr checks`. Raw gh stays allowed; goal 1's attribution shows whether steering is enough. A gh shim on PATH was rejected.

Source: exploration `explorations/github-api-quota/DECISIONS.md`.
