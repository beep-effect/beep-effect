# Yeet Publish Preflight

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Harden the Yeet publish path with the two highest-leverage codification
todos from the pretext-driver closeout reflection: (1) a frozen-lockfile
`bun install` preflight against a clean temp-worktree checkout of HEAD
before every push — turning the PR #391 19-job CI wall into a ~6s local
failure — and (2) a probe-first fix for the `--start-pr-early` ⇄
`--monitor` circular validation so a PR-less branch's first publish either
works with `--pr` or fails fast with an actionable hint.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/yeet-publish-preflight/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - phased execution plan (P0 probe first).
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - incident evidence and
   code-site map.

## Current Phase

`P0 Probe` — reproduce both failure modes against current yeet before
writing any fix; the 2026-07-13 circular-gate incident may be partially
stale (`internal/Handler.ts:344` already composes `--pr` after the early
push).

## Provenance

Codifies findings from
[`goals/pretext-driver/history/reflections/2026-07-14-claude.md`](../pretext-driver/history/reflections/2026-07-14-claude.md)
(trigger: closeout; both findings confidence `high`). Scope-guarded to
exactly these two fixes — the remaining reflection todos (canvas CI lane,
CauseTaggedError sweep) stay out.
