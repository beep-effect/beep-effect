# Session Route Resolver

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Any agent runs one command with a PR, branch, lane or checkout and gets the owning session, its message routes, their liveness and the exact send call.

Graduated from [`explorations/session-addressing`](../../explorations/session-addressing/README.md). This packet builds addressing and discovery metadata only; it sends nothing.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/session-route-resolver/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing; its `researchReports` array is a generated projection of `research/` (`bun run beep goals manifest --write`), never hand-edited.
5. [`research/`](./research/) - supporting research, if present.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P0 Research. Next: from inside a T3-hosted Codex session, check whether `T3CODE_THREAD_ID` is set, then write the schemas.

## Latest Evidence

Not started.

## Notes

The census and every measured number behind this packet are in the exploration's [`RESEARCH.md`](../../explorations/session-addressing/RESEARCH.md); the seven settled decisions are in its [`DECISIONS.md`](../../explorations/session-addressing/DECISIONS.md) and mirrored as files under [`decisions/`](./decisions/).
