# Typed Agent Skill Contracts — Research

<!-- Stage 1. Cited external landscape + in-repo capability inventory. Dated
sections, newest first. Provenance ledger: research/SOURCES.md. -->

## 2026-08-13 — In-repo capability inventory (research close, part 1)

Two Codex lanes (gpt-5.6-sol, reasoning=medium) inventoried the live `@beep/*` surfaces against
SYNTHESIS's ten ports. Full reports with per-component verdict tables are vendored under
[`research/inventory/`](./research/inventory/):
[`contract-kernel-evidence.md`](./research/inventory/contract-kernel-evidence.md) (ports 1/2/4)
and [`protocol-query-memory.md`](./research/inventory/protocol-query-memory.md)
(ports 3/5/6/7/8/10). Every repo citation is package + `file:line` verified against the working
tree; spot-checked at distillation.

Headline: the repo owns an unusually strong **substrate** and none of the **composition layers**.

- **EXISTS (substrate):** `LiteralKit` literal domains + `$I` annotation composers +
  `withKeyDefaults` (`@beep/schema`, `@beep/identity`) for gate/severity/ladder vocabularies;
  yeet's `QualityIssue` evidence envelope, proof-freshness fingerprints (`ProofState`), and
  `attempts.ndjson` journal; the `qa-inventory/v1` judge gate that cross-checks cited artifacts
  and witness events before acceptance; `@beep/provenance`'s `VerifiedTextAnchor` split between
  serializable receipt and verifier-only capability; `@beep/epistemic-*` `ClaimGate` typed
  verdicts; `@beep/mcp-kit`'s fail-closed call-time `TierGate`; typed `HttpApi` clients
  (`@beep/pacer`, `@beep/govinfo`) and server (`@beep/qa-capture`); Toolkit-based MCP servers;
  a live bounded SPARQL path (`@beep/ontology-*` + oxigraph).
- **NET-NEW (confirmed by search, not assumption):** a `SkillContract` aggregate root; the
  evidence-ladder ADT (`Accepted → Persisted → Delivered → SemanticallyApplied` + terminal
  union); a reusable bounded-recovery service with schema-defined budgets and per-attempt
  receipts; any A2A/ActivityPub surface; the credential-chain state machine; browser ref-epochs
  / tab leases / handoff states; the intent→context routing manifest; the transcript-audit gate.
- **Corrections to the capture-stage candidate list:** better-auth is NOT in this repo;
  `@beep/acp` is the Agent *Client* Protocol, not A2A; no citation-extraction or `knowledge*`
  package exists (evidence spans live in `@beep/provenance` + `@beep/epistemic-domain`);
  `AgentSkillFrontmatter` (`@beep/ai-sync`) types only `name`/`description` and its normalizer
  deliberately drops everything else — `@beep/ai-sync` does, however, already treat cross-agent
  config provenance and lossy-transform evidence as typed data.

## 2026-08-13 — Broader external landscape (research close, part 2)

Two network-enabled Codex lanes surveyed prior art; full reports with per-claim URLs, licenses,
and paste-ready ledger rows are vendored under [`research/landscape/`](./research/landscape/):
[`skill-contract-formats.md`](./research/landscape/skill-contract-formats.md) (MCP, Anthropic
Agent Skills, OpenAI structured outputs, A2A, AGNTCY/OASF, Oracle Agent Spec, LangChain, Effect
AI Toolkit, Microsoft ACS) and
[`workflow-evidence-frameworks.md`](./research/landscape/workflow-evidence-frameworks.md)
(Temporal, Restate, XState, PROV-O, C2PA, in-toto/SLSA, VC 2.0, Guardrails/Outlines,
promptfoo/OpenAI Evals).

Two findings move the packet's position:

1. **Novelty narrowed, not killed.** Microsoft's draft Agent Control Specification (ACS, MIT)
   already implements machine-validated fail-closed policy gates whose verdicts can carry
   evidence artifacts with mandatory audit records — genuine "contract = executable gate +
   evidence receipt" prior art. Its boundary: it gates *policy acceptability* at intervention
   points; it does not define a skill's promised deliverable, semantic postconditions, or a
   multi-stage completion ladder. The packet's claim is therefore the Effect-native
   *composition* — skill promises + typed acceptance gates + mandatory evidence + domain
   completion ladders — and it should adopt ACS's fail-closed vocabulary (port-with-attribution)
   rather than reinvent it.
2. **Receipt vocabulary should come from in-toto.** The Statement (digest-bound subject) /
   typed predicate / signed envelope / independent-verifier-policy split maps directly onto
   `EvidenceReceipt`/`Gate`/`FailureReceipt`; SLSA's Verification Summary Attestation is named
   prior art for "all blocking gates passed"; classic in-toto *inspections* are the closest
   relative of authoritative-artifact re-extraction (pattern 3).

Pattern-by-pattern verdicts: **evidence ladder** — A2A and experimental MCP Tasks type transport
lifecycles, but `COMPLETED` is a server assertion, so the semantic ladder is open ground;
**discovery-before-invocation** — XState gives auditable transition topology, not compile-time
uncallability, so Effect-native phase typing is open ground; **re-extraction** — in-toto
inspections are the closest prior art; **bounded recovery** — Temporal/Restate own durable
execution and compensation vocabulary (interop, don't rebuild; their "completed" ≠ semantic
success); **provenance** — PROV-O standardizes no span selectors (pair it with Web Annotation
selectors + content digests), and C2PA is the signed-binding upgrade path for the existing XMP
QA stamping. Generation-side constraint systems (OpenAI strict mode, Outlines) and gate runners
(Guardrails) are first-rung only. Effect AI's `Tool`/`Toolkit` is the substrate to extend, not a
competitor.

## 2026-08-10 — OpenLink ai-agent-skills mining corpus (external landscape, part 1)

Seven parallel Codex lanes (gpt-5.6-sol, reasoning=high) mined
[OpenLinkSoftware/ai-agent-skills](https://github.com/OpenLinkSoftware/ai-agent-skills)
(MIT; machine-local `ai-agent-skills` clone in the daily research corpus), ~40 skills. Full
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

Both research-stage OPEN tasks (in-repo capability inventory; broader external landscape) were
closed by the 2026-08-13 sections above.
