# Typed Agent Skill Contracts

## Status

Stage: `research`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

OpenLink's `ai-agent-skills` corpus (mined 2026-08-10, seven Codex lanes) turned out to be
contract-rich and enforcement-poor: a year of production-discovered agent-work contracts —
delivery gates, evidence ladders, discovery state machines, bounded-recovery receipts — held
together by regex validators and drifting prose. The bet: port the contract *shapes* into
Effect Schema, where the contract and the gate are the same executable object, and wire the
evidence layer into beep's epistemic/citation-span/QA stacks.

## Next Open Question

In-repo capability inventory: which `@beep/*` bricks already cover the contract-kernel,
evidence/provenance, protocol, and memory-routing surfaces named in
[`RESEARCH.md`](./RESEARCH.md) §OPEN — and which candidate components are genuinely NET-NEW?
(Then: the broader external landscape sweep, same section.)

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - mining corpus + open research tasks (stage 1, current).
4. [`research/mining/SYNTHESIS.md`](./research/mining/SYNTHESIS.md) - cross-lane rollup: thesis, five patterns, ten ranked ports.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger (licenses, dispositions).

## Trail

- 2026-08-10: packet opened from the ai-agent-skills mining pass; 7 lane reports + synthesis +
  AI Barrister paper note vendored into `research/mining/`; SOURCES ledger seeded (upstream
  MIT, port-with-attribution); stage set to `research` with the in-repo capability inventory
  and broader landscape sweep as the open tasks.
