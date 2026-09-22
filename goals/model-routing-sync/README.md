# Model Routing Sync

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

One role x surface routing manifest at `$HOME/.config/beep/models.yaml` is the operator truth, and
every place that hardcodes a model id — repo doctrine, runbooks, skills, code defaults, JSDoc, and
the workstation dotfiles — becomes a projection of it, computed against a layered model catalog that
knows both what exists upstream and what is routable on this box.

## Launch

```text
/goal follow the instructions in goals/model-routing-sync/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - source ledger.
6. [`research/2026-09-22-00-aligned-design.md`](./research/2026-09-22-00-aligned-design.md) - the 12
   grilled rulings (R1-R12), the role and surface lists, and the non-negotiables. Packet prose cites
   these as `(Rn)`.

## Current Phase

P1 Implement. **Slice 1 landed**: the `beep models` command group is registered with three
read-only subcommands — `check` (the default), `catalog`, and `init`, which seeds a manifest only
when none exists. It decodes the upstream catalog plus the Codex cache, the Grok cache,
`cursor-agent models`, and the proxy availability overlay, diffs against the home ledger, and
prints drift for every declared target. It writes no projection target: the only writes are that
ledger under `$HOME/.local/state/beep/models/` (R6), the optional `--report-dir` output, and the
`init` seed manifest, which refuses to overwrite an existing one (R12). The write path, the lint,
and the timer are slices 2 and 3.

## Latest Evidence

- **2026-09-22 slice-1 smoke run** (`beep models init` + `beep models check` against a scratch
  manifest, so the operator's `$HOME/.config/beep/` stayed untouched): **23 findings — 12
  `missing-locator`, 11 `stale` — across 318 catalog models**, with all five layers answering
  (`router-for-me`, `codex-cache`, `grok-cache`, `cursor-agent`, `proxy-v1-models`). Zero
  `missing-file`, `invalid-effort`, or `unknown-model`. All four predicted conflicts surfaced:
  - `defaultJSDocMigrateTitlesModel = "grok-4.5"` in
    `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocMigrateTitles.ts` — `stale`.
  - `$HOME/.zshrc` claudex `gpt-6-astra(xhigh)` against the ratified `medium` — `stale`.
  - `gpt-5.6-sol` and the `Extra High` effort label in both
    `$HOME/.config/JetBrains/WebStorm2026.{2,3}/options/CodexLauncher.xml` — `stale`.
  - `xhigh` in all four `$HOME/.agents/skills/impeccable/agents/*.toml` seats — `stale`.
  The twelve `missing-locator` findings are the generated blocks and TOML keys that do not exist
  yet; adopting them is slice 2. Two seed gaps are recorded as slice-2 items in
  [`PLAN.md`](./PLAN.md).
- [`research/2026-09-22-01-cliproxyapi-catalog.md`](./research/2026-09-22-01-cliproxyapi-catalog.md)
  — the consumable upstream manifest, the `model(effort)` suffix grammar, and why
  `GET /v1/models` cannot be the sole source.
- [`research/2026-09-22-02-repo-cli-sync-surface.md`](./research/2026-09-22-02-repo-cli-sync-surface.md)
  — why `version-sync`, `tsconfig-sync`, and `sync-data-to-ts` do not fit, and the machinery that
  does.
- [`research/2026-09-22-03-surface-census.md`](./research/2026-09-22-03-surface-census.md) — every
  repo and user surface carrying a model id, classified rewrite / prose / freeze.
- [`research/2026-09-22-04-home-sweep.md`](./research/2026-09-22-04-home-sweep.md) — the second
  live Codex config, the JetBrains XML targets, the `jetbrains-codex` surface, and the matcher's
  false positives.

## Trail

- 2026-09-22: three Opus 5 exploration lanes + `$HOME` sweep; grilled the same day; 12 rulings
  locked; packet materialized from the compiled bootstrap plan. No source exploration packet.

## Notes

- `home` is a parameter, never `os.homedir()` at a call site.
- Never edit the user's global files unprompted; slice 1 has no `--write` path and never writes
  a projection target. Its only writes are the R6 ledger under
  `$HOME/.local/state/beep/models/`, the optional `--report-dir` output, and the `init` seed
  manifest, which refuses to overwrite an existing one.
- Codex effort currently has three different values across four live files. Slice 2 is blocked until
  the operator ratifies one.
