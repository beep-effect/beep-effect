---
title: "Split the work into three PRs plus a final law PR"
date: 2026-11-13
lane: "chore/python-free-repo"
reversal: "Fold remaining lanes into one PR"
---

The packet allows three concurrently open PRs. Lane 1 (chore/python-free-repo): triage, per-packet probe deletion, small ports (ciops CQ checks into vitest, markdown corpus extractor, cloud-agent-readiness helpers, compute-profile renderer), the heavy.yml/fleet-shadow-check workflow Python and infra/r2-cache. Lane 2 (Codex Sol): photo-face to onnxruntime-node. Lane 3 (Codex Sol): .claude/skills scripts. The no-tracked-python law, lefthook, cheap-tier check and AGENTS.md line land last on chore/python-free-repo-law, because the law fails on main until every lane has merged and heavy.yml is consumed at @main (its old script can only be deleted after the switch merges).
