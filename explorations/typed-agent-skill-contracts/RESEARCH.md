# Typed Agent Skill Contracts — Research

<!-- Stage 1. Cited external landscape + in-repo capability inventory. Dated
sections, newest first. Provenance ledger: research/SOURCES.md. -->

## 2026-08-10 — OpenLink ai-agent-skills mining corpus (external landscape, part 1)

Seven parallel Codex lanes (gpt-5.6-sol, reasoning=high) mined
[OpenLinkSoftware/ai-agent-skills](https://github.com/OpenLinkSoftware/ai-agent-skills)
(MIT; local clone `~/YeeBois/research/daily/08-10-2026/ai-agent-skills/`), ~40 skills. Full
reports vendored under [`research/mining/`](./research/mining/); cross-lane rollup in
[`research/mining/SYNTHESIS.md`](./research/mining/SYNTHESIS.md). A prior same-day Fable pass
covered the `agent-rdf-memory/` skill (hub-and-spoke sparse manifest, PromptIntent routing
ontology, MemoryWriteTrigger vocabulary, transcript-audit gate, symbolic log offloading);
findings summarized in [`CAPTURE.md`](./CAPTURE.md).

Headline: the corpus is **contract-rich, enforcement-poor** — battle-tested contract *shapes*
(65-gate artifact delivery, five-gate RDF-View deployment, evidence ladders, bounded recovery
receipts, credential re-extraction gates) with no type system behind them; regex validators,
drifting prose copies, generators violating their own contracts. The exploration bet: port the
shapes into Effect Schema where contract = gate.

Five convergent patterns with per-lane receipts, ten ranked ports, and per-lane dead-end lists
are in SYNTHESIS §Cross-lane convergences / §Top ten ports / report index.

## 2026-08-10 — AI Barrister Flight Simulator (external landscape, part 2)

Lewis & Zueco, *The AI Barrister Flight Simulator: A Neuro-Symbolic Benchmark for Structured
Legal Reasoning*, ICLR 2026 workshop —
https://openreview.net/pdf/42ef464c05efa3c750f623b7df2fe74aefe677c3.pdf (content-addressed link
behind a browser-verification wall; local PDF outside repo, see SOURCES §3). Note:
[`research/mining/ai-barrister-flight-simulator.md`](./research/mining/ai-barrister-flight-simulator.md).

Relevance: gold-reasoning-path evaluation (Path Alignment / Node Coverage / Constraint
Violation Rate / Hallucination Rate against annotated scenario subgraphs) grades *how* an agent
reasons over a legal KG rather than endpoint accuracy — the missing eval layer for the
citation-span / legal-position work, and the same generate→check→repair controller shape the
OpenLink harness contracts converge on. Caveats: workshop paper, 50 scenarios, artifacts
unreleased; only pp. 1–2 close-read at capture.

## OPEN — in-repo capability inventory (NOT DONE)

The mining brief described beep to the miners secondhand; no lane verified an actual `@beep/*`
surface. Before align, inventory which bricks already cover each candidate track — candidates
to verify (not yet cited, do not treat as claims):

- Contract kernel: `@beep/schema` (LiteralKit, `$I` composers), yeet gate/verdict machinery,
  reflection-artifact lint, `qa-inventory/v1` schema validation.
- Evidence/provenance: epistemic evidence-span substrate, citation-extraction packages,
  `beep qa` witness/event artifacts + exif provenance stamping.
- Protocol surface: effect/unstable/http + httpapi usage, existing MCP/AI wiring
  (`effect-v4-mcp-ai` patterns), better-auth integration.
- Memory routing: basic-memory store, codegraph, skill frontmatter routing,
  `standards/memory-architecture/`.

## OPEN — broader external landscape (NOT DONE)

One corpus plus one paper is not a landscape. Missing sweeps: agent-skill/contract
formalization prior art (MCP tool schemas, Anthropic skills format, OpenAI function-calling
contracts, A2A spec proper), typed-workflow/evidence frameworks (e.g. temporal-style sagas,
provenance standards PROV-O/C2PA adjacent), and LLM-output verification harnesses. Needed
before shape to avoid reinventing named prior art.
