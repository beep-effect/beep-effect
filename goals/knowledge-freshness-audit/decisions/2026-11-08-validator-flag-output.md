---
title: "Escape control characters at the final flag output boundary"
date: 2026-11-08
kind: checkpoint
lane: "codex/audit-validator-cli"
reversal: "Revert the final print formatting call and its focused rendering regression if the boundary evidence is disproved; preserve all original reports and private counterfactual receipts."
---

Parent review validates that needed-evidence strings enter flags raw and the final CLI loop prints them raw, contrary to the existing safe_text flag-output contract. Reuse safe_text once at the final print boundary, preserving ordinary text and already-escaped text. A focused permanent CLI-boundary regression executes only the extracted pure formatter and output loop with an inert print sink; it passes after the fix and fails against the original rendering line. No full validator module, artifact-validation function, self-test suite or ontology artifacts were invoked. The argument-boundary regression also passes. P4 remains partial, with PM and ADHD held separately.
