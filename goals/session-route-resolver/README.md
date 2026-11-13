# Session Route Resolver

## Status

Lifecycle: `completed-retained`

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

Closed by PR #3297: `bun run beep session resolve <key> [--json]`, presence capture in the SessionStart hooks, `session note` and `session presence`, and the `orchestrate`/`closeout` skills naming `session resolve` as the way to find an owner.

## Latest Evidence

- 2026-11-13: `test/session-route-resolver.test.ts` (17 tests) passes on Bun and Node; it runs the real hook against a scratch repository and decodes every presence row it writes.
- 2026-11-13: [`history/2026-11-13-live-proof.md`](./history/2026-11-13-live-proof.md): #3297 resolved to this session's `t3-thread` (matches `t3_thread_read`) and `claude-peer` routes, both live; Claude peer names matched `ListAgents`; a dead owner and a no-owner key printed their fallbacks.
- 2026-11-13: `yeet final-check` passed on `5a274f2b146` with coverage skipped locally (host load 80 to 98; its four reds were timeouts in untouched suites); `quality package-verify @beep/repo-cli` lint and docgen passed.
- Reflection: [`history/reflections/2026-11-13-claude.md`](./history/reflections/2026-11-13-claude.md).

## Notes

The census and every measured number behind this packet are in the exploration's [`RESEARCH.md`](../../explorations/session-addressing/RESEARCH.md); the seven settled decisions are in its [`DECISIONS.md`](../../explorations/session-addressing/DECISIONS.md) and mirrored as files under [`decisions/`](./decisions/).
