# Practice Gateway

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

One gateway `.mcpb`, a setup doctor and an onboarding skill that give a
lawyer on Windows the practice stack without developer setup, proved by a
recorded from-zero onboarding on a clean Windows VM. Graduated from
[`explorations/harness-the-harness`](../../explorations/harness-the-harness/README.md).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/practice-gateway/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - supporting research, if present.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P1 Implement — schemas first. P0 findings: [history/p0](history/p0/2026-10-14-research.md).

## Latest Evidence

P0 inventory and decisions recorded 2026-10-14.

## Notes

- Sibling goal `practice-claude-mod` owns plain-language rows and the matter
  band; ship the onboarding skill without touching them.
- Gated follow-ons in the exploration MAP: `practice-gateway-providers`,
  `practice-gateway-signed-release` (money), `practice-harness-improvement-loop`.
