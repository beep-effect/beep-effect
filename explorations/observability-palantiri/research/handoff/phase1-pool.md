# ADHD phase 1 pool — observability Palantiri (2026-10-14)

Scores: N novelty, V viability, F fit (0-10). Weighted = .35N + .40V + .25F.

## Cluster 1 — "the privilege tier lives in the signal itself"
- C4 tasteless pheromones: strict tier emits salted shape hashes only (latency bucket, error class, tool name); dev tier emits full trails; gap between signatures is itself an anomaly  [N8 V8 F9] 8.25
- R1 signed privilege-tier attestation per span; collector REFUSES (not redacts) tier mismatches vs host enrollment  [N8 V7 F9] 7.85
- L2 customs border at the tom-pc-1 edge: tariff schedule of attribute keys (allowed / duty-redacted / contraband); dad's box holds a lower-duty trade agreement  [N7 V8 F9] 7.9
- X5 capability token minted per machine inside the data; readers without the token see shape only  [N8 V5 F8] 6.8
- A3 attorney PC never pages anyone; signed content-free heartbeat; failures surface as a morning card for the attorney's Claude  [N6 V9 F9] 7.95

## Cluster 2 — "prove the absence"
- R4 canary tracers: fake-privileged strings injected on the attorney machine; any sighting in Phoenix/Prometheus/CI/transcripts alarms  [N7 V9 F9] 8.3
- R2 negative telemetry ledger: append-only record of every attribute key dropped/hashed/blocked, counts not values  [N8 V8 F8] 8.0
- R6 custody-chain id per pipeline hop, each hop publishes drop/transform counts  [N7 V6 F7] 6.6
- L1 bill of lading per span batch: signed manifest ahead of payload; mismatch → quarantine  [N7 V6 F7] 6.6

## Cluster 3 — "agents are the on-call AND the consumer"
- L6 parcel lockers: Palantiri pre-stages sealed per-question parcels keyed by session; MCP picks up a bundle, not raw query access  [N8 V8 F9] 8.25
- L4 RMA desk: an agent that finds a signal misleading files a return with a reason code → instrumentation defect ticket to the owning package  [N8 V8 F8] 8.0
- A1 every signal carries "who owns the fix"; alerts route to the orchestrator inbox first; human paged only after an agent tried and filed a blocker  [N6 V8 F9] 7.55
- X6 wrap every MCP tool call / CLI invocation once; the agents' transcripts become the primary fleet trace  [N7 V8 F8] 7.65
- A5 every alert ships a replay link (MCP) + a proven-reversible safe action  [N6 V6 F8] 6.5
- C5 attribution quorum: several agents converge on introduced/inherited/env-only → auto "known flake" trail  [N8 V7 F7] 7.35
- C1 scent files: failure-signature spans in a shared bucket; recurring signatures become panels nobody designed  [N8 V6 F7] 6.95
- C6 usefulness deposits on panels/queries; nightly Luna child rewrites MCP tool descriptions from the strongest trails  [N7 V6 F6] 6.35
- X3 no screen: an agent writes a daily prose diff of behaviour into the session ledger  [N7 V7 F6] 6.75
- R3 purpose code declared before an agent may query; mismatched purpose refused  [N7 V5 F6] 5.95 — TRAP: friction tax on every agent query; purpose is unverifiable

## Cluster 4 — "noise economics"
- R5 freshness SLO per panel/alert; stale → "unknown", never a number  [N5 V9 F8] 7.35
- A2 alerts expire: TTL + "last time this paged and mattered"; no remediation commit → digest-only  [N7 V7 F6] 6.75
- A4 declared quiet-hours expected-load manifest; only deviations page  [N8 V5 F6] 6.3
- L3 cold chain for high-cardinality debug spans: spoil TTL, discard un-consumed  [N7 V7 F6] 6.75
- C2 half-life retention by attention  [N8 V5 F5] 6.05 — TRAP: unqueried ≠ unimportant (backup integrity, compliance series)

## Cluster 5 — "surviving the monitor dying"
- A6 tailnet boxes cross-witness; dead-man's switch on a cheap external host; stack-down = one low-urgency ticket  [N5 V8 F8] 6.95
- C3 neighbour carries a quiet host's last-known state with a staleness tag  [N6 V5 F6] 5.6
- X1 no central backend: per-process SQLite ring buffer + federated tailnet query  [N9 V4 F6] 6.25 — TRAP as the primary store (intermittent Windows hosts, retention, N-box fan-in); VIABLE as the edge spool
- L5 milk-run collector loop visiting each box  [N6 V6 F5] 5.75 — TRAP: Prometheus already pulls; intermittent hosts miss stops by design

## Cluster 6 — "replace the substrate"
- X2 one signal: typed Effect Schema events; derive logs/metrics/traces on demand  [N8 V4 F6] 5.9 — TRAP: re-implements OTel, loses the whole backend/MCP ecosystem; KEEP the kernel idea (schema-first event contract that *compiles to* OTLP)
- X4 telemetry as git orphan branch  [N9 V3 F4] 5.35 — TRAP: time-series in git

## Deepen (top 3 by weighted score, distinct clusters)
1. Cluster 1 composite: tier-in-the-signal (C4 + R1 + L2)
2. Cluster 3: L6 parcel lockers as the agent-facing Palantiri, provider-agnostic (Claude/Codex/Cursor/Grok/Muse)
3. Cluster 2 composite: proof-of-absence harness (R4 + R2)
