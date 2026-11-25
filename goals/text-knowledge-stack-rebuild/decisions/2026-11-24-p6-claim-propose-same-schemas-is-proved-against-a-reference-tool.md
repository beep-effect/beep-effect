---
title: "claim_propose same-schemas is proved against a reference tool on the wire"
date: 2026-11-24
lane: "p6"
reversal: "Export a testing seam for toolJsonSchema from mcp-kit and compare against it directly."
---

Property (e) for claim_propose mounts LawClaimToolkit through the mcp-kit Conformance harness beside a reference tool declared directly over ClaimProposalRequest, LawProposedClaimRecord and ClaimProposeFailure, and asserts the two listed inputSchema and outputSchema values are equal. The wire conversion (`toolJsonSchema` in SanitizedSpan.ts) is module-private, so the reference tool runs the same conversion without exporting a testing seam from mcp-kit. The unmounted law-practice tools compare `S.toJsonSchemaDocument` of their parameter and success schemas with the domain schemas they are declared over, in one table that must cover every PracticeKg and ReviewHub tool.
