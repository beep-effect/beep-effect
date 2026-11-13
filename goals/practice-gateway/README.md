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

P1 Implement: slice 1 merged in #1771. Run 4 (2026-10-20) found four problems; #1935 fixes them, and run 5 (2026-10-21, agent-driven) proved all four on the VM and fixed a stale `claude://` handler. Open follow-ups: an expired Claude session still passes the sign-in step, Claude asks permission once per tool, and the BitLocker wording. P0 findings: [history/p0](history/p0/2026-10-14-research.md).

## Latest Evidence

[Knowledge-graph provider on Windows](history/p1/2026-11-12-gateway-kg-provider-windows.md) (2026-11-12): gateway 0.1.4 in the signed `bun.exe` plus script layout loads DuckDB 2, mounts all 13 knowledge-graph tools and answers a query on the clean VM image, with no `SetDllDirectoryW` step. No code change.

[Onboarding proof run 5](history/p1/2026-10-21-onboarding-proof-run5.md) (2026-10-21): an agent drove every console step; the operator only signed in to Claude. Update to 0.1.2, the Windows approval dialog, the signed-in check and the Microsoft 365 app-ID gate all pass. [Run 4](history/p1/2026-10-20-onboarding-proof-run4.md) (2026-10-20): gateway 0.1.0 → 0.1.1 update, interview and profile save pass, with a FreshBooks gap recorded. Four findings: no `.mcpb` file type, no approval prompt in Claude Desktop, a false signed-in negative, and Microsoft 365 offered without an app ID.

## Notes

- Sibling goal `practice-claude-mod` owns plain-language rows and the matter
  band; ship the onboarding skill without touching them.
- Gated follow-ons in the exploration MAP: `practice-gateway-providers`,
  `practice-gateway-signed-release` (money), `practice-harness-improvement-loop`.
