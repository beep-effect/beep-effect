# Standards Inventory Zero — PLAN

Phases (driver = Claude session; lanes = codex:rescue background tasks).
Normative contract: [SPEC.md](./SPEC.md). Rulings: [research/decisions.md](./research/decisions.md).
Live state: [ops/progress.json](./ops/progress.json).

| Phase | Contents | Sessions | Lanes | Status |
|---|---|---|---|---|
| P0 | Packet + preflight + dep-bump commit + draft umbrella PR; close `schema-first-zero-actionables` | 1 | 0–1 | in_progress |
| P1 | Detector bug fixes (D1, D2, J1, J2, J3, family-prefix gap) + fixtures + regen + shrunken baselines | 1 | 2–4 | pending |
| P2 | Cluster audits + conversion pilots; driver verdict-challenge; lock rulings | 1–2 | 4–6 | pending |
| P3 | Dual-arity waves DA-1..DA-4 (post-P1 residue ≈ 45) | 1–2 | 8–12 | pending |
| P4 | Schema-first conversion waves SF-1..SF-4 (post-P2 residue) | 1–2 | 6–10 | pending |
| P5 | JSDoc waves JD-1..JD-9 (to zero, baseline tightened per wave) | 4–6 | 35–45 | pending |
| P6 | Knip burn-down (73 → 0, empty baseline) | 1 | 2–4 | pending |
| P7 | Effect-laws allowlist challenge (17 → 0 or user-approved residue) | 1 | 2–3 | pending |
| P8 | Enforcement flips + full battery + merge umbrella PR + `/reflect` closeout | 1 | 0–2 | pending |

## Burndown

Counters snapshot after every regen (source of truth: `ops/progress.json`).

### dual-arity (`beep laws dual-arity --check`)

| Checkpoint | candidates | exceptions |
|---|---|---|
| 2026-07-07 baseline | 107 | 13 |
| 2026-07-08 after P1 | 46 | 11 |
| target | 0 | 0 |

### schema-first (`beep lint schema-first`)

| Checkpoint | entries (all exception) |
|---|---|
| 2026-07-07 baseline | 326 |
| after P2 rulings | TBD |
| target | 0 |

### jsdoc (`beep quality jsdoc-ratchet`)

| Checkpoint | pkgs needing remediation | missing @example | @category | @since | unsafe | schemaAnnotation | exampleImport | forbidden |
|---|---|---|---|---|---|---|---|---|
| 2026-07-07 baseline | 78 | 2012 | 91 | 91 | 71 | 127 | 24 | 2 |
| 2026-07-08 after P1 | 45 | 1215 | 91 | 91 | 68 | 127 | 24 | 2 |
| target | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

(P1 also removed the 4 phantom packages: inventory now spans 100 real packages.)

### knip / allowlist

| File | baseline | target |
|---|---|---|
| knip.regression-baseline.jsonc | 73 | 0 |
| effect-laws.allowlist.jsonc | 17 | 0 (or user-approved residue) |

## Wave manifests

Authored at phase start (P1 regen re-baselines the math; do not pre-slice).
Prior-art family order: foundation → tooling → drivers → apps/slices.

- **DA-1** foundation/modeling (nlp 21, rdf 3, identity 2) — pilot, calibrates lanes
- **DA-2** foundation/capability + tooling/policy-pack
- **DA-3** tooling/library + tooling/tool + test-kit
- **DA-4** drivers + apps + slices
- **SF-1..4** sliced after P2 rulings (foundation → tooling → ui/capability → drivers/apps)
- **JD-1** pilot @beep/md + @beep/govinfo; **JD-2/3** @beep/schema sharded;
  **JD-4** @beep/html (post generator fix); **JD-5** tooling; **JD-6**
  ui-system/capability; **JD-7** modeling rest; **JD-8** drivers; **JD-9** apps/slices
- **KN-1** knip; **AL-1** allowlist

## Driver loop (per wave)

0. preflight: gates green; read `ops/progress.json` → next wave
1. dispatch: slice inventory → interpolate `ops/prompts/fixer.*.md` → codex:rescue `--background` (4–6 lanes)
2. collect: lane summaries; full reports only for non-`fixed` dispositions
2b. **challenge (D-C)**: driver re-investigates every non-`fixed` verdict; rulings → `research/decisions.md`
3. regen (serialized): `--write` / `jsdoc-inventory`
4. check: gates; regen-surfaced latent findings are same-wave work
5. proof: `TURBO_FORCE=true turbo run build check test docgen --filter=<touched>` → `bun run beep ci local --fast`
6. land: commit + push to umbrella PR; watch hosted CI; max 2 red rounds then split
7. record: `ops/progress.json` + burndown tables above
