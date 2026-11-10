---
title: "A17 GraphQL truth: transport anchors, with samples admitted by calibration"
date: 2026-11-10
reversal: "Trust REST samples unconditionally, or drop them for GraphQL entirely."
---

GraphQL anchors and the GraphQL reserve use transport-basis readings, because REST `/rate_limit` misreports the GraphQL bucket. REST sample `graphql` readings are admitted only when at least 6 calibration pairs in 7 days show a median drift of at most 50 points. Calibration is a manual command costing 1 point per pair, run once at P1 exit.

Resolves SPEC ambiguity A17 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").
