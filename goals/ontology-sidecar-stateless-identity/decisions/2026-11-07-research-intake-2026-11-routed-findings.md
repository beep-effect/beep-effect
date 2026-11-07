---
title: "research-intake-2026-11 routed 126 affirmative findings here"
date: 2026-11-07
lane: "feat/research-intake-2026-11"
reversal: "Delete this decision file and regenerate the block; the findings stay in the library and in research-intake-2026-11/research/routing.jsonl"
---

The research-intake-2026-11 intake routed 214 findings to this packet (126 affirmative, 1 critiques or disputes; 204 public, the rest from the private partition and not quoted). Routing table and method: goals/research-intake-2026-11/research/ROUTING.md; per-finding rows with spans live in the research library, filtered by packet in goals/research-intake-2026-11/research/routing.jsonl. Contested claims, if any, are clustered in goals/research-intake-2026-11/research/CONTRADICTIONS.md. Strongest public evidence:

- citesAsEvidence: http://www.ietf.org/rfc/rfc3986.txt — URI persistence is not guaranteed by the syntax. Identity stability has to come from the naming authority's governance.
- citesAsEvidence: https://pypi.org/project/mcp/ — The package explicitly advertises all three named transports. This supplies a transport comparison reference for MCP implementation and adoption work, while providing no evidence here about stateless
- citesAsEvidence: https://help.harvey.ai/articles/joining-harvey-mcp-connector-library — Harvey's MCP client targets the 2025-11-25 MCP authorization spec, a concrete interop target for any beep MCP server meant to plug into Harvey.
- citesAsEvidence: https://modelcontextprotocol.io/specification/2026-07-28/changelog — The revision removes transport-level sessions, requiring MCP host and driver designs to stop depending on session identifiers.
- citesAsEvidence: https://github.com/modelcontextprotocol/experimental-ext-skills — The README explicitly identifies the base MCP protocol revision targeted by the stable Skills extension specification, giving protocol adoption work a concrete compatibility reference.

This amendment adds evidence only; it changes no acceptance criterion. The owning lane decides whether any finding changes its plan.
