# Shared Memory & Code-KG Wiring

> **Historical (superseded 2026-08-29):** basic-memory + codegraph were removed from this
> repo and machine; see `standards/memory-architecture/04-decision-log.md`. Kept as a record.

## Status

Lifecycle: `completed-retained` (closed 2026-08-06; pilot review 2026-08-20)

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Wire the 2026-08-06 bake-off verdict into daily work: **basic-memory** as the
one shared memory store all four coding agents (Claude Code, Codex, Grok,
Cursor) read and write, **codegraph** as the deterministic code-KG for this
repo — both keyless — with cognee retired from the durable dev-memory role and
the standards updated to match.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/shared-memory-code-kg-wiring/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - bake-off provenance.
6. [`history/`](./history/) - evidence and closeouts, once they exist.

## Current Phase

Closed — all phases complete. Remaining follow-ups live in the closeout
reflection's todos: codex live-call evidence after quota reset (2026-08-08),
a Cursor GUI session check, and the 2026-08-20 pilot review.

## Latest Evidence

- [`history/2026-08-06-wiring-evidence.md`](./history/2026-08-06-wiring-evidence.md)
  — live cross-agent round-trip (claude wrote via repo `.mcp.json`; grok
  recalled verbatim over `basic-memory__read_note` +
  `codegraph__codegraph_explore`), per-CLI registration table, deviations.
- `bun run beep yeet verify`: all lanes passed (verdict under
  `.beep/yeet/runs/feat_shared-memory-code-kg-wiring-*/verdict.json`).
- [`history/reflections/2026-08-06-claude.md`](./history/reflections/2026-08-06-claude.md)
  — closeout reflection.

## Notes

- The shared store lives OUTSIDE the repo (machine-local `beep-shared` store) so
  every beep-effect clone sees the same memory — same pattern as the shared
  Claude auto-memory dir.
- basic-memory is AGPL-3.0: internal tooling only; the future Effect-native
  `@beep/memory` port is the exit ramp before anything customer-facing.
- Standing confidentiality rule applies: no pre-publication patent or client
  material in the shared store.
- Pilot review 2026-08-20 (see `PLAN.md` §Pilot).
