# beep-effect.com web app on Alchemy

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Ship apps/beep-effect-web to beep-effect.com on Cloudflare via Alchemy v2, following Alchemy monorepo and state-store guidance

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/beep-effect-web-alchemy/GOAL.md
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

P3 and P4 done 2026-10-31: PR #2435 merged as `441c6d94de`, and its merge push deployed prod from CI (run 41244684210). P5 Close is in progress.

## Latest Evidence

- `research/alchemy-fit-2026-10-28.md`: Alchemy docs fit and live zone snapshot.
- SPEC Decision Log: 9 operator-confirmed decisions (2026-10-28).
- P1 (2026-10-28): `apps/beep-effect-web` created with `create-package --app-kind vite` and converted to TanStack Start 1.169.4.
  `alchemy.run.ts` declares Stack `BeepEffectWeb` with a prod-only apex domain. Results: package-verify audit ok;
  schema-first, effect-vitest, package-scripts, and fallow audit report 0 introduced; SSR renders at
  `http://beep-effect-web.beep.localhost:1355/` with no console errors.

- P2 (2026-10-28): `history/2026-10-28-p2-first-deploy.md`: apex 200, www 301 with path and query kept, redeploy no-op, state in the Cloudflare store.
- P3 (2026-10-31): `history/2026-10-31-p3-ci-deploy.md`: first CI deploy green; smoke check apex 200, www 301.
- P5 (2026-10-31): `history/reflections/2026-10-31-claude.md`.

## Notes

Alchemy v2 is beta (`2.0.0-beta.84`). Re-check the pinned version and docs before P1.
