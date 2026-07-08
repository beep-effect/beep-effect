# /goal — standards-remediation

Drive every violation-enumerating `standards/*.jsonc` to ZERO items, then
tighten gates so zero stays zero. Normative contract:
`goals/standards-remediation/SPEC.md` (outranks this file). Live state:
`ops/progress.json`. Locked rulings: `research/decisions.md` — do not reopen.

## Scope (baseline 2026-07-07)

- `dual-arity.inventory.jsonc` — 107 candidate + 13 exception → `entries: []`
- `schema-first.inventory.jsonc` — 326 exception → `entries: []`
- `jsdoc-documentation.inventory.jsonc` — 2,418 findings / 78 pkgs → all clean,
  baseline zeros
- `knip.regression-baseline.jsonc` — 73 → empty
- `effect-laws.allowlist.jsonc` — 17 → empty (residue needs user approval)

## Rules of engagement

1. Convert code aggressively (interfaces→S.Class, dual() wraps, real compiling
   examples). Detector fixes only for verified detector bugs; fixture pair
   mandatory (SPEC fence 11).
2. Verdict-challenge: any lane claim of justified/unconvertible/false-positive
   is re-investigated by the driver personally before it stands.
3. One writer per package; lanes never touch `standards/*.jsonc` or baselines
   (driver-owned); no repo-wide turbo/yeet from lanes.
4. One umbrella PR on `standards-remediation` (draft; wave commits pushed;
   merge at zero). Max 2 red hosted-CI rounds per push, then split the wave.
5. Effect v4 only — verify every API in `.repos/effect-v4`; embed SPEC's
   Verified API Corrections table in every fixer lane.

## Phases

P0 packet+preflight → P1 detector bugs (D1 dual-arity static-property
exclusion, D2 callable 3rd param, J1 barrel @example, J2 phantom packages,
J3 import-strip, crispening family-prefix gap) → P2 cluster audits +
conversion pilots (rulings locked) → P3 dual-arity waves → P4 schema-first
waves → P5 jsdoc waves (ratchet tightened per wave) → P6 knip → P7 allowlist
challenge → P8 enforcement flips + full battery + merge + /reflect.

## Driver loop (per wave)

preflight gates green → slice inventory → dispatch `ops/prompts/fixer.*.md`
lanes (codex:rescue, background, 4–6) → collect summaries → CHALLENGE
non-fixed verdicts → regen (`beep laws dual-arity --write` / `beep lint
schema-first --write` / `beep quality jsdoc-inventory`) → gates
(`--check` / bare / `jsdoc-ratchet` + `--write-baseline` when improved) →
`TURBO_FORCE=true turbo run build check test docgen --filter=<touched>` →
`bun run beep ci local --fast` → commit+push → record progress.json + PLAN.md
burndown.

## Resume protocol

Read PLAN.md → ops/progress.json → run the five gate commands → reconcile
counters → resume at first non-done step. Regen is idempotent; inventories are
the source of truth for slices.

## Definition of Done

All five files zero; clean-checkout regen diff-free; enforcement flips landed
with fixtures (ENFORCED_ROOTS repo-wide, schema-first zero-entry fixture,
jsdoc baseline zeros + extended ratchet totals); full `beep ci local` green;
umbrella PR merged via yeet; `/reflect` closeout passing
`bun run beep lint reflection-artifacts`.
