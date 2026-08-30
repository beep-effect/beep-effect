# Typed Agent Skill Contracts

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `decompose`
Status: `active`
<!-- END GENERATED: EXPLORATION STATUS -->

Spine graduated 2026-08-13 ([`goals/skill-contract-kernel/`](../../goals/skill-contract-kernel/),
merged via PR #694); status flipped 2026-08-24 per the graduation contract.
**Reopened at `decompose` 2026-08-26** by packet-system-redesign D22/D24:
Amendment J belongs to the next `@beep/skill-contract` version and this
exploration owns its shape pass. The completed kernel goal stays closed.

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

OpenLink's `ai-agent-skills` corpus (mined 2026-08-10, seven Codex lanes) turned out to be
contract-rich and enforcement-poor: a year of production-discovered agent-work contracts —
delivery gates, evidence ladders, discovery state machines, bounded-recovery receipts — held
together by regex validators and drifting prose. The bet: port the contract *shapes* into
Effect Schema, where the contract and the gate are the same executable object, and wire the
evidence layer into beep's epistemic/citation-span/QA stacks.

## Next Open Question

Determine Amendment J's exact candidate boundary: a new
`skill-contract-gate-certificates` goal or an amendment to an existing later
wave. The fixed shape is a digest-bound in-toto Statement envelope, EARL/ACT's
five outcomes, explicit complete/incomplete/unknown reach, producer-side
exclusion of inconclusive checks from aggregate success, and a separate
apply-by-id plan. The fixed first consumer is one certificate-producing QA
judge settlement. See `MAP.md` §Amendment J re-entry.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - dated research record, newest first (stage 1, closed).
4. [`research/mining/SYNTHESIS.md`](./research/mining/SYNTHESIS.md) - cross-lane rollup: thesis, five patterns, ten ranked ports.
5. [`research/inventory/`](./research/inventory/) - in-repo capability verdicts (EXISTS/PARTIAL/NET-NEW per port component).
6. [`research/landscape/`](./research/landscape/) - external prior-art surveys with per-URL ledgers.
7. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger (licenses, dispositions).

## Trail

- 2026-08-26: reopened at `decompose` by packet-system-redesign D22/D24.
  Amendment J moved out of packet-core/candidate 6 and into this exploration's
  existing `@beep/skill-contract` authority. Exact goal/candidate placement is
  the sole open shaping question; the completed kernel goal is not reopened.

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
- 2026-08-24: grill-with-docs session flipped status `active` → `graduated`: the 2026-08-13
  "keep active if candidates remain" reading misquoted the graduation contract (which says
  flip once promised-now goals exist; gated candidates stay in `MAP.md` as re-entry points),
  and the deliberate hold ("another clone is finishing it") expired when PR #694 merged.
  Kernel-goal drift corrected after 11 days (Sol xhigh premise check): `S.TaggedError`
  replaces the retired `TaggedErrorClass`; `render`/`renderUnsafe` replace the deprecated
  `DocumentToMarkdown`; `ClaimGateResult` cited at `@beep/epistemic-domain`; parity matrix
  enumerated in the goal SPEC; receipt digest seam locked (today's digest types + explicit
  migration seam, not waiting on protocol-as-value); Effect rc.108→rc.111 revalidation added
  to P0. `MAP.md` gains a protocol-as-value coordination section.
