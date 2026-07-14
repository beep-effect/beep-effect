# Yeet Publish Preflight

## Status

Lifecycle: `completed-retained`

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

## Outcome (2026-07-14)

Shipped as PR #402 (squash `31bedfeac1`, merged 2026-07-14):
`publish:00-head-install-preflight` runs a frozen-lockfile install in a
detached temp worktree of committed HEAD in verify's full tier and before
every publish push (guaranteed cleanup with warning-on-failure), and
`--start-pr-early` now fails fast at guard time unless `--pr` is present.
Proofs: 77/77 yeet tests, tsgo clean, three full local proofs, 25 hosted
checks green, Greptile finding fixed (`5d7e98ece3`), 0 unresolved threads.
Live positive probe: the preflight's first real execution gated its own
PR's push (~7s, warm bun cache). The SPEC's negative live probe is covered
by the unit test asserting the failure hint + temp-worktree cleanup.
Reflection:
[`history/reflections/2026-07-14-claude.md`](./history/reflections/2026-07-14-claude.md).

## Provenance

Codifies findings from
[`goals/pretext-driver/history/reflections/2026-07-14-claude.md`](../pretext-driver/history/reflections/2026-07-14-claude.md)
(trigger: closeout; both findings confidence `high`). Scope-guarded to
exactly these two fixes — the remaining reflection todos (canvas CI lane,
CauseTaggedError sweep) stay out.
