# Harness Hygiene Mechanical

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Mechanical, evidence-cited cleanup of the agent instruction surface: delete
the four zero-signal skills, evict volatile operational state from
AGENTS.md's permanent cache prefix, and add the three laws agents repeatedly
requested — nothing speculative, nothing evidence-free.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/harness-hygiene-mechanical/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance (inherited from
   [`explorations/agent-effectiveness-pulse`](../../explorations/agent-effectiveness-pulse/README.md)).

## Current Phase

Closed (2026-07-14) — all phases complete; packet retained for reference.

## Latest Evidence

[`research/2026-07-14-eviction-and-laws.md`](./research/2026-07-14-eviction-and-laws.md)
records the eviction map; three laws with reflection counts 11 same-PR / 6
attribution / 10 handoffs; H4 refuted + H9 partial framing; skills-deletion
mechanics; and a provisioning-only reference scan. AGENTS.md measured 5,840
bytes before and 5,354 bytes after. The P2 verification matrix passed in full
(GOAL size, manifest JSON, whitespace, four skill dirs gone, no dangling refs
with `--hidden`, three laws present). Closeout reflection:
[`history/reflections/2026-07-14-claude.md`](./history/reflections/2026-07-14-claude.md).
Note: running the canonical `bun run beep skills update` also drift-repaired
three surviving remote skills from upstream HEAD (ponytail wording, new
grill-me/teach agents manifests) — kept as documented side effects of the
mandated sync.
