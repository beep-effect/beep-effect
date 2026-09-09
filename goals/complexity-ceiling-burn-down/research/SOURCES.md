# Complexity Ceiling Burn-Down — Sources & Provenance

- **Source exploration:** none — authored directly from the 2026-07-30
  CYCLOMATIC_COMPLEXITY_STANDARD calibration session (grill-with-docs
  interview; all seven decisions recorded in
  [`calibration.md`](./calibration.md)).
- **Provenance:** full-repo `fallow health` scan + 21-function judged panel
  (methodology and numbers in `calibration.md`); repo recon of enforcement
  wiring and codification precedent (summarized below with live paths).

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `calibration` | 2026-07-30 distribution + panel evidence | this repo | `research/calibration.md` | threshold calibration | normative input |
| `tail` | live >15 tail (49 fns, Fallow 3.22.0) | this repo | `research/tail-inventory.md` | target list | completed inventory |
| `lanes` | fallow lane blocking/advisory split | this repo | `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:631` | promotion wiring | implemented and verified |
| `predicate` | per-lane blocking predicate + argv | this repo | `packages/tooling/tool/cli/src/commands/Quality/FallowQuality.command.ts:513` | promotion wiring | implemented and verified |
| `dead-code` | prior fallow campaign (triage-first, 3 clean runs) | this repo | `goals/fallow-zero-dead-code/SPEC.md` | campaign template | pattern reuse |
| `ratchets` | health-lane deferral this packet closes | this repo | `goals/fallow-advisory-ratchets/` | provenance | reference |
| `worked` | function-decomposition worked examples | this repo | `goals/standards-remediation/ops/reports/{DA-2,SF-2}` | refactor motion | pattern reuse |
| `health-rr` | 2026-06-08 health lane research report | this repo | `goals/fallow-quality-enforcement/research/health.md` | prior inventory | reference |

**How these inform implementation:** triage-first with per-function verdicts
before any remediation (dead-code campaign); refactor shape follows the
standards-remediation reports (extract named single-purpose functions, not
helper walls); promotion follows the ratchet pattern (baseline measured →
3 clean runs → blocking).

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| fallow-rs/fallow (v3.22.0 latest, npm devDependency; v3.10.0 historical calibration) | per its distribution | tool usage only | CLI/MCP behavior; no code ported |

## 3. External research sources

- fallow documentation (live, fetched 2026-07-30): `https://fallow.mintlify.app/llms.txt`,
  `/explanations/health`, `/integrations/mcp`, `/integrations/agent-skills`,
  `/cli/audit`, `/cli/health`, `/configuration/suppression`. Key verified facts
  reproduced in `calibration.md` §Mechanics (including the
  `--save-regression-baseline` health no-op and the working
  `--save-baseline`/`--baseline` pair).

## 4. In-repo capability references

- `.fallowrc.jsonc` — ceilings, overrides, `require-suppression-reason` (reuse).
- `standards/fallow.health.regression-baseline.jsonc` +
  `fallow:health:baseline:{write,check}` scripts (reuse; written this PR).
- `bun run beep quality fallow <lane>` envelope machinery (reused and extended
  with baseline-comparison argv for the blocking health lane).
- fallow MCP (`.mcp.json` `fallow`) — triage instrumentation: `inspect_target`,
  `check_health` + `complexity_breakdown`, `trace_export` (reuse).

## 5. Cross-links & provenance

- Law: `standards/effect-laws-v1.md` law 23.
- Decision: `standards/architecture/DECISIONS.md` 2026-07-30 entry (mechanism +
  revisit-6 hook); closes the health deferral recorded in
  `goals/fallow-advisory-ratchets`.
- Suppression backfill evidence: 78 pragmas across 45 files backfilled
  2026-07-30 (report archived in session scratchpad; verification =
  `fallow suppressions` shows 0 missing reasons).
- Original refreshed P0 baseline: Fallow 3.22.0 reported 194 suppressions
  across 112 files with zero missing/stale reasons.
- Final latest-main comparator: after synchronizing to
  `53193e5a5e93a3231282eaead455f7d06a85ac4d`, Fallow 3.22.0 reports 207
  suppressions across 114 files with zero missing/stale reasons: 120
  `code-duplication`, 73 `complexity`, and 14 other. No added suppression
  marker appears in the campaign diff; the +13 landed on main, so 207 is the
  current no-growth comparator and 194 remains provenance.
