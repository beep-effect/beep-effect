# Storybook App

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Move Storybook hosting out of `@beep/ui` into a single executable app workspace,
`@beep/storybook` at `apps/storybook`, while keeping package-local stories in
foundation UI-system packages.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/storybook-app/GOAL.md
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

Implementation complete. Pulumi preview is proven; remote CI should be re-run
from GitHub on the branch/PR carrying this patch.

## Latest Evidence

[`history/2026-06-07-implementation-verification.md`](./history/2026-06-07-implementation-verification.md)

## Notes

- Story files stay package-local. This packet does not move
  `packages/foundation/ui-system/ui/stories/**`.
- `@beep/storybook` is an executable app, not a reusable API package.
- Storybook scope is foundation UI-system packages only.
