---
title: "research-intake-2026-11 routed 105 affirmative findings here"
date: 2026-11-07
lane: "feat/research-intake-2026-11"
reversal: "Delete this decision file and regenerate the block; the findings stay in the library and in research-intake-2026-11/research/routing.jsonl"
---

The research-intake-2026-11 intake routed 224 findings to this packet (105 affirmative, 1 critiques or disputes; 201 public, the rest from the private partition and not quoted). Routing table and method: goals/research-intake-2026-11/research/ROUTING.md; per-finding rows with spans live in the research library, filtered by packet in goals/research-intake-2026-11/research/routing.jsonl. Contested claims, if any, are clustered in goals/research-intake-2026-11/research/CONTRADICTIONS.md. Strongest public evidence:

- usesDataFrom: https://github.com/pipeworx-io/mcp-uspto-office-actions — Claim-level rejection data source usable for office-action extraction and prosecution reads.
- citesAsEvidence: https://docs.abigail.app/ — The advertised analysis surface combines claim parsing and amendment markup with rejection, prior-art, and examiner information. This is relevant prior art for the scope of an office-action extraction
- usesDataFrom: https://data.uspto.gov/apis/office-action-retrieval/search — Coverage and refresh cadence of the OA text corpus.
- supports: https://evolve-ip.com/ai-in-the-patent-industry-beware-the-mcp-trojan-horse/ — Claims that retrieval quality, not model reasoning, is the main failure mode for LLMs in patent work. This motivates dedicated patent-data connectors.
- citesAsEvidence: https://data.uspto.gov/apis/getting-started — ODP API transport contract: HTTP GET/POST with JSON responses, relevant to generated USPTO drivers.

This amendment adds evidence only; it changes no acceptance criterion. The owning lane decides whether any finding changes its plan.
