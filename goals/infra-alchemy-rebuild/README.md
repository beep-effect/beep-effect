# Rebuild beep-effect infrastructure on Alchemy and distilled, Pulumi retired

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Rebuild beep-effect infrastructure on Alchemy and distilled, Pulumi retired (graduated from explorations/pulumi-to-alchemy).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/infra-alchemy-rebuild/GOAL.md
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

P1 Foundations (started 2026-11-09). P0 closed the same day: the matrix's ten open questions
resolve to D17–D21 plus the 2026-11-09 decision files (Storybook on Cloudflare StaticSite, runner
group and App webhook outside IaC). Landed in P1 so far: tooling kind `infra` (doctrine tables,
`create-package --kind infra`; the `packages/tooling/infra/*` workspace glob waits for the first package), the shared S3 state store bootstrapped with
SSE-KMS, the GitHub OIDC state role, `BeepEffectWeb` pointed at the shared store with a plan step
in its deploy workflow, the `@alchemy.run/aws` catalog pin and the `Artifacts.cached` bun patch,
and `docs/runbooks/alchemy-infra.md`. P1 exit still owed: the first `prod` deploy on the shared
store showing no create or replace (runs on merge).

## Latest Evidence

- 2026-11-09 P1 bootstrap receipts: `decisions/2026-11-09-*.md` (state bucket, OIDC role, state move, bun patch).
- 2026-11-06 grill session: decisions D1–D16 in [`explorations/pulumi-to-alchemy/DECISIONS.md`](../../explorations/pulumi-to-alchemy/DECISIONS.md); doctrine entry "Infrastructure Stacks Are A Tooling Kind" in `standards/architecture/DECISIONS.md`.
- [explorations/pulumi-to-alchemy/RESEARCH.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/explorations/pulumi-to-alchemy/RESEARCH.md) (2026-11-02): coverage matrix, gaps G1–G9.

## Notes

<Record high-signal constraints or resume notes that do not belong in the
normative spec.>
