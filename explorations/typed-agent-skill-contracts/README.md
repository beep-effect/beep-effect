# Typed Agent Skill Contracts

## Status

Stage: `graduate`
Status: `active` (later-wave candidates remain; see [`MAP.md`](./MAP.md))

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

OpenLink's `ai-agent-skills` corpus (mined 2026-08-10, seven Codex lanes) turned out to be
contract-rich and enforcement-poor: a year of production-discovered agent-work contracts —
delivery gates, evidence ladders, discovery state machines, bounded-recovery receipts — held
together by regex validators and drifting prose. The bet: port the contract *shapes* into
Effect Schema, where the contract and the gate are the same executable object, and wire the
evidence layer into beep's epistemic/citation-span/QA stacks.

## Next Open Question

The spine graduated: [`goals/skill-contract-kernel/`](../../goals/skill-contract-kernel/)
(2026-08-13). Next: when a later-wave candidate from [`MAP.md`](./MAP.md) is picked up
(provisional order: kg-ingestion-contracts → ops-evidence-ladder → browser-lease-capabilities
→ memory-routing-manifest → fleet-protocol-contracts), run its own shape pass before
graduating it. All shape decisions for the spine are locked in
[`DECISIONS.md`](./DECISIONS.md) (ten entries, 2026-08-13).

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - dated research record, newest first (stage 1, closed).
4. [`research/mining/SYNTHESIS.md`](./research/mining/SYNTHESIS.md) - cross-lane rollup: thesis, five patterns, ten ranked ports.
5. [`research/inventory/`](./research/inventory/) - in-repo capability verdicts (EXISTS/PARTIAL/NET-NEW per port component).
6. [`research/landscape/`](./research/landscape/) - external prior-art surveys with per-URL ledgers.
7. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger (licenses, dispositions).

## Trail

- 2026-08-10: packet opened from the ai-agent-skills mining pass; 7 lane reports + synthesis +
  AI Barrister paper note vendored into `research/mining/`; SOURCES ledger seeded (upstream
  MIT, port-with-attribution); stage set to `research` with the in-repo capability inventory
  and broader landscape sweep as the open tasks.
- 2026-08-13: research closed via four Codex lanes (2 in-repo inventory, 2 external landscape;
  gpt-5.6-sol medium). Reports vendored under `research/inventory/` + `research/landscape/`;
  RESEARCH.md and SOURCES.md updated; citations spot-verified. Headlines: substrate EXISTS /
  composition NET-NEW; Microsoft ACS narrows the novelty claim to skill-outcome ladders;
  in-toto supplies the receipt vocabulary. Stage advanced to `align` with three open
  questions (spine track, ACS posture, receipt vocabulary).
- 2026-08-13 (same session): align resolved all three via operator grilling — spine = contract
  kernel + evidence ladder, all five tracks retained as sequenced waves; ACS vocabulary now,
  adapter later; in-toto-aligned receipts, unsigned first (`DECISIONS.md`). Stage advanced to
  `shape`; `BRIEF.md` drafted at fat-marker fidelity with appetite + package-name flags open
  for review.
- 2026-08-13 (same session): operator approved the brief; grill-with-docs round locked seven
  more decisions against `standards/` doctrine (home = foundation/modeling schemas-only;
  name = `@beep/skill-contract`; recovery service deferred; qa judge gate first consumer;
  verdicts-as-values; SKILL.md projection in wave 1 via `@beep/md` — operator override;
  single-goal graduation). `MAP.md` written; definition-of-ready passed;
  `goals/skill-contract-kernel/` scaffolded and cross-linked. Stage `graduate`, status stays
  `active` as the home of waves 2–6.
