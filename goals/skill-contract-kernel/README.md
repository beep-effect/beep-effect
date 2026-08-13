# Skill Contract Kernel

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Ship `@beep/skill-contract` — the schemas-only typed agent-work contract kernel
(`SkillContract`, fail-closed `Gate` registry, evidence-ladder ADT, in-toto-aligned
receipts) — proven by the `qa-inventory/v1` judge gate running as a contract instance and by
a re-extraction-gated SKILL.md projection rendered via `@beep/md`.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/skill-contract-kernel/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - inherited provenance ledger.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P0 Research — next concrete action: re-read the qa judge surfaces
(`packages/tooling/tool/cli/src/commands/Qa/Inventory.schemas.ts`, `JudgeCheck.ts`) and
confirm the first vertical slice (one `JudgeCheck` rule as a typed gate) against current code.

## Latest Evidence

Not started.

## Notes

- Graduated 2026-08-13 from
  [`explorations/typed-agent-skill-contracts`](../../explorations/typed-agent-skill-contracts/README.md);
  the exploration's `DECISIONS.md` carries the full locked decision log (home, name, scope,
  ACS posture, receipt shape, retrofit choice, projection scope) and its
  `research/` carries the verified inventory + landscape reports.
- The exploration stays `active` as the home of the later-wave candidates
  (KG ingestion contracts, ops evidence ladder, browser leases, memory routing, fleet
  protocols) mapped in its
  [`MAP.md`](../../explorations/typed-agent-skill-contracts/MAP.md).
