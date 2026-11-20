---
title: "Warned and skipped items are no observation, and a retried pass is labelled flaky"
date: 2026-11-20
lane: "goals/gate-run-history-lane"
reversal: "Record warned items as passed observations and label only failed items flaky in classifyItem."
---

The SPEC names two observed outcomes, passed and failed, and leaves warned and skipped items open. A warned diagnostic is not a failure and a skipped test did not run, so neither records an observation and neither gets a label. The flaky rule is applied before the outcome split, so a passed item whose attempts disagree on one input (a retried pass) is labelled flaky; a passed item otherwise gets recovered only when the newest lane observation failed. This is what AC-H2's retried-pass row needs and what the quarantine reconciliation expects.
