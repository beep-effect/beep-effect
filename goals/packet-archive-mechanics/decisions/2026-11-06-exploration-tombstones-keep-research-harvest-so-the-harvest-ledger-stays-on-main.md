---
title: "Exploration tombstones keep research/harvest/** so the harvest ledger stays on main"
date: 2026-11-06
lane: "feat/packet-archive-mechanics"
reversal: "Drop research/harvest/** from TombstoneKeep.explorations once harvested-alpha-triage has closed and moved its inputs; re-run beep goals archive on the exploration"
---

The exploration tombstone decision keeps ops/manifest.json, README.md, DECISIONS.md and BRIEF.md, which would move explorations/packet-archive-and-alpha-harvest/research/harvest/ to the archive repo in the exploration batch. The ledger-home decision puts the harvest ledger and the panel verdicts on main under that path, and harvested-alpha-triage names it as its prerequisite and writes its merge output beside it. The two decisions only agree if the tombstone keeps that subtree, so TombstoneKeep.explorations gains research/harvest/**. Only this exploration has the directory, so the sweep is otherwise unchanged and no packet is exempted.
