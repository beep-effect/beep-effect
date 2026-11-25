---
title: "claim_propose is strict and returns the gate refusal as a value"
date: 2026-11-24
lane: "p6"
reversal: "Drop the Tool.Strict annotation and fail the handler with the gate refusal instead of returning ClaimProposeFailure."
---

`claim_propose` is annotated `Tool.Strict`, so a host that mounts it through `sanitizedToolkit` decodes its parameters with `onExcessProperty: "error"` and an extra field (such as a smuggled admission token) is refused before the handler runs. The tool failure schema is `ClaimProposeFailure`: the three `ClaimProposalRefused` cases plus `TierGateRefused { reason }`, the audit reason of a refused dispatch, so a refused call returns a value the agent can read instead of failing the stream.
