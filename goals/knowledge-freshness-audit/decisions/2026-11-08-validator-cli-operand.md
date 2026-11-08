---
title: "Reject a missing validator repository operand before artifact validation"
date: 2026-11-08
kind: checkpoint
lane: "codex/audit-validator-cli"
reversal: "Revert this checkpoint and the three-line guard with its focused regression; retain private original audit evidence."
---

Parent review of T37 confirms a trailing --repo raises IndexError at the CLI boundary. Add the existing usage exit-2 convention without changing valid argument dispatch. A synthetic extracted-main regression stops at a stubbed validation boundary; no ontology artifacts or validator functions execute. The old source fails that regression and the repaired source passes. P4 remains partial; PM, ADHD provenance and private teaching holds remain separate.
