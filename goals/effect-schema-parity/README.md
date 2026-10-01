# Effect Schema Parity

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Retire or trim every `@beep/schema` concept upstream Effect covers at the
main snapshot `df77fff939` (rc.118 line), migrate
consumers by codemod, and leave an rc-pinned inventory plus a schema-first
gate that hold parity on every effect bump. Six phases, one PR train.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/effect-schema-parity/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth: phase contract, boundary table, facet census gate, decision log.
3. [`PLAN.md`](./PLAN.md) - active execution plan: PR list per phase, lanes, done-signals.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance carried from the exploration; [`research/OPPORTUNITIES.md`](./research/OPPORTUNITIES.md) - friction ledger.
6. Source exploration: [`explorations/effect-schema-parity`](../../explorations/effect-schema-parity/README.md) — `MAP.md` (decomposition), `BRIEF.md` (shape), `DECISIONS.md` (25 rulings, back-linked from `SPEC.md`).
7. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

Closed. All six phases shipped through thirteen train PRs plus the P5 close
(2026-10-01). The operator ruled the last two deferrals the same day: URL
(`URLStr`, `HttpsUrl`) is ADAPT and MimeType is KEEP (`SPEC.md` goal-time
rows 2026-10-01); no ruling remains open. Standing behaviour after close: every
Effect pin change regenerates the inventory in the bump PR and works the
parity lane (`bun run beep lint schema-first`) to zero.

## Latest Evidence

2026-10-01: P5 retired `SchemaUtils.withCodecStatics` and every codec facade
attached through `withStatics` (390 steps in 170 files; 833 compiler-located
reads rewritten by the codemod, 25 by hand), added the `SFV4-codec-static`
(F15) rule, fixed the F13 guard sites, and drove the schema-first parity
backlog to zero (`parity ratchet ok: current=0`). Decision rows, the
single-checker numbers and the reflection are in `SPEC.md` (goal-time rows
2026-10-01) and `history/reflections/2026-10-01-claude.md`.

2026-09-29: PR #1330 bumped the Effect snapshot to `df77fff939` without
regenerating the inventory. The catch-up PR regenerated it with the
prototype tools (2,232 rows, verifier PASS), moved `inventoryPin` in the
packet, and logged the miss in `research/OPPORTUNITIES.md`.

2026-09-28: the source exploration reopened at decompose because upstream
shipped schema compilers (effect #7908); see its `DECISIONS.md` 2026-09-28
entry. This packet was amended in place by the `SPEC.md` goal-time row of the
same date: pin `inventoryPin` `e5f7d12af9`, fixture `effect-schema-rc118`,
bump rule for any pin change, Opus 5.5 lanes, and the P5 precondition met by
PR #927. The SchemaUtils census landed in P2, P3 and P5. The operator ruled
the schema compilers DEFER (no compilers goal) and kept `isCodecDataFirst`;
the exploration graduated again the same day. No phase has started.

Earlier: exploration definition-of-ready passed on 2026-09-15
(`explorations/effect-schema-parity/MAP.md`, final section). Packet
fidelity reviewed twice by Codex on 2026-09-15:
`history/2026-09-15-codex-packet-review.md` (eleven findings, all fixed) and
`history/2026-09-15-codex-packet-rereview.md` (all resolved, none new).

## Notes

- Both packets were published through PR #1154 from the packet-only lane
  (branch `effect-schema-parity-graduate` under the `docs` prefix, 2026-09-16).
- `.repos/effect` is a machine-local symlink absent in linked worktrees until
  `scripts/setup-effect-ref.sh` runs there; P1 needs it locally.
- repo-cli is the largest LiteralKit consumer (230 files) and its lint rule
  domain is itself a kit: in P2, codemod `packages/tooling` first and boot
  `bun run beep` before rewriting the rest.
- Token-heavy lanes run on Opus 5.5 children pinned `claude-opus-5-5` per
  `AGENTS.md` (D5, 2026-09-28); lane prompts state the phase's done-signal and bounce condition from
  `SPEC.md` as acceptance criteria.
