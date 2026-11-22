---
title: "Keep the oxlint rule registered but enabled for no path"
date: 2026-11-22
lane: "goals/comment-law-gate-final"
reversal: "Add an overrides block for the locked package globs in .oxlintrc.json."
---

The scanner is the gate: it sees through oxlint and eslint disable directives, and its lock already covers every scope off the pending list. An override list of clean paths would be a second inventory that every sweep PR edits. The rule stays available for editors and per-edit hooks through a one-rule config.
