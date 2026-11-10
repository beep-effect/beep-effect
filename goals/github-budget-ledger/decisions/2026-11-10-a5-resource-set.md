---
title: "A5 Resource set: a driver LiteralKit with an unknown member"
date: 2026-11-10
reversal: "Extend the literal list."
---

The driver owns a `LiteralKit` with the documented resource keys plus `unknown`. A GraphQL response without a resource header becomes `graphql`; a REST one becomes `unknown`. Unknown `/rate_limit` body keys are dropped.

Resolves SPEC ambiguity A5 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").
