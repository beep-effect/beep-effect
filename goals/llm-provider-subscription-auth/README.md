# LLM Provider Subscription Auth via CLI Delegation

## Status

Lifecycle: `active` — P0–P3 complete; P4 close pending merge.

Source: [`ops/manifest.json`](./ops/manifest.json)

Latest evidence (2026-07-12): PR
[#392](https://github.com/beep-effect/beep-effect/pull/392) carries the full
vertical (driver probe/shadow-home isolation, agents domain/use-cases/tables/
server/client) on `feat/llm-provider-subscription-auth`; local
`bun run beep yeet verify` green; closeout reflection at
[`history/reflections/2026-07-12-claude.md`](./history/reflections/2026-07-12-claude.md).

## Mission

Let users of a local-first beep server authenticate to LLM providers with
their existing subscriptions (Claude Pro/Max, ChatGPT plans) through vendor-CLI
delegation — the t3code methodology: the vendor CLI owns login/tokens/refresh;
beep owns ProviderInstance management, HOME-based credential isolation, rich
auth probes, and login guidance. Beep never persists provider tokens.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/llm-provider-subscription-auth/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth (architecture mapping
   table is binding placement).
3. [`PLAN.md`](./PLAN.md) - active execution plan (P0 probe-transport
   decisions, P1 inward-out order).
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance: t3code (MIT)
   reference files, exploration lineage, in-repo capabilities.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P0 Research — next concrete action: resolve the per-provider probe-transport
decisions in `PLAN.md` P0 Tasks (exit-code probe vs richer account read for
`claude` and `codex`).

## Latest Evidence

Not started.

## Notes

- **Methodology finding that shaped this packet:** t3code implements zero
  provider OAuth. Its subscription support is CLI delegation + status probing
  + HOME isolation. In-app OAuth (opencode-style, first-party client IDs) was
  explicitly rejected here — ToS gray zone and unnecessary under local-first.
- **Partial graduation:** this packet graduates only the CLI subscription-auth
  leg of `explorations/multi-provider-llm-dispatch-fallback` (its Q5
  user>CLI>env precedence chain). Dispatch/registry/fallback stay in the
  exploration; the per-user vault stays parked in
  `explorations/ingestion-security-secret-governance`.
- **Prior art in-repo:** `packages/drivers/ai-provider-cli` already probes
  `claude auth status` / `codex login status` (boolean); this packet enriches
  it. `packages/drivers/m365/src/M365.auth.ts` is the OAuth reference kept
  only for a possible future revisit.
