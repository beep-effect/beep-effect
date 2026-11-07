---
title: "Repair hosted JSDoc since tags without weakening the ratchet"
date: 2026-11-07
kind: checkpoint
lane: "feat/citation-diff-kernel"
pullRequest: 2737
reversal: "Revert only the documentation tag/lead normalization; this reopens the observed hosted since/blank findings and does not change runtime semantics."
---

Hosted job 128250296967 reports nine missing since tags plus one leading/trailing blank. Public comments now separate category/since tags, and the mode alias has a lead description. The actual repository tag/shape parser passes 86 focused export comments. Main ce87ff21b2 is merged at 0ef0edc00a. Full hosted ratchet remains pending; baselines/thresholds unchanged. See history/evidence/2026-11-07-public-source-resolution.md.
