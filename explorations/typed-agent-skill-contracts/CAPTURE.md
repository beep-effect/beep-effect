# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-08-10

Spark: Benjamin shared https://github.com/OpenLinkSoftware/ai-agent-skills/tree/main/agent-rdf-memory
("Check this out") — Kingsley Idehen's (OpenLink/Virtuoso founder) agent memory system: ALL
standing instructions as RDF Turtle, prompt-intent routing ontology, SPARQL-loadable, session
provenance, a post-session transcript validator proving memory reads happened before first
response. Fable pass verdict: architecture ideas strong (intent routing as data, hub-and-spoke
sparse manifest, typed memory-write triggers, transcript-audit gate, symbolic log offloading);
RDF-as-carrier weak (OWL decorative — no reasoner in the loop, Turtle token-hostile, validators
are regex, arms race of ASCII-art GATE boxes).

Then: full repo cloned into the machine-local daily research corpus as `ai-agent-skills/` — "there are
several other skills and items I think are worth a mining pass for an exploration packet. use
codex gpt 5.6 sol agents on high reasoning."

Mining pass ran same day: 7 parallel codex lanes (gpt-5.6-sol, reasoning=high) over ~40 skills.
Reports vendored into this packet at [`research/mining/`](./research/mining/) —
[`SYNTHESIS.md`](./research/mining/SYNTHESIS.md) is the cross-lane rollup.

Core thesis that emerged: **the corpus is contract-rich, enforcement-poor.** 65-gate infographic
delivery contract / 105-step preferences graph / 15-point report gates — all enforced by regex
validators that can't validate, generators violating their own contracts, prose copies drifting.
They discovered in production what agent-work contracts should SAY; they lack the type system to
make any of it executable. beep's schema-first stack is that missing layer. Parked
md-render-as-encode idea completes it: canonical typed model → projections rendered as S.encode
→ gates = re-extract + compare (YouID's PKCS#12 gate is the proof this works).

Five convergent patterns (see SYNTHESIS for receipts):
1. acceptance ≠ semantic success → evidence ladder ADT (ActivityPub persisted a Like under an
   HTTP 405; "deployable" vs "deployed" terminal states)
2. discovery before invocation as state machine (Agent Card / WebFinger→Actor / capability
   probes; guessed endpoints are their top documented failure)
3. authoritative-artifact re-extraction (YouID re-extracts pubkey from deployable .p12,
   compares all projections)
4. bounded recovery with audit receipts (uriburner budgets-as-data; structured no-result
   receipt instead of synthesized text)
5. provenance claimed, never proven (zero source spans anywhere — exactly the
   citation-verified-span gap)

Also captured: mid-mining, Benjamin dropped
https://openreview.net/pdf/42ef464c05efa3c750f623b7df2fe74aefe677c3.pdf — "Can we include this
in the packet?" → The AI Barrister Flight Simulator (Lewis & Zueco, ICLR 2026 workshop):
neuro-symbolic legal-reasoning benchmark; Legal KG + symbolic controller
(Retrieve→Generate→Check→Repair) + structure-aware metrics (CVR/HAR/PA/NC) grading HOW the
model reasons over legal structure, not whether the answer is right. Gold-reasoning-path
evaluation = the eval layer the legal/patent KG work is missing. Note + local PDF: see
[`research/mining/ai-barrister-flight-simulator.md`](./research/mining/ai-barrister-flight-simulator.md)
(PDF kept out of the public repo — local copy at
`ai-barrister-flight-simulator-iclr2026.pdf` in the machine-local daily research corpus).

Candidate tracks sketched in SYNTHESIS (not yet grilled): contract kernel
(SkillContract/Gate/Evidence/FailureReceipt), KG ingestion + gold-path eval, fleet protocol
surface (A2A/ActivityPub/OAuth/credential chain), query/browser ops (query-plan machine,
pinchtab ref-leases), memory routing (intent→context manifest + transcript-audit gate).

"yea lets /explore typed-agent-skill-contracts" — packet opened.
