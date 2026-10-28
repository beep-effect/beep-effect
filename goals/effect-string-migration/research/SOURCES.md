# effect/String migration — Sources & Provenance

- **Source exploration:** original census files plus the 2026-10-28 compiler,
  profile, task-summary and merge-time completion audit.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|

## 3. External research sources

- `@effect/tsgo` 0.55.0 changelog (Effect-TS/tsgo `_packages/tsgo/CHANGELOG.md`):
  adds the opt-in `preferEffectString` rule with 32 `effect/String` counterparts.

## 4. In-repo capability references

## 5. Cross-links & provenance

## 6. Closeout qualification, 2026-10-28

- `package.json`, `tsconfig.base.json`, the five copied compiler profiles (including
  `scratchpad/effected/tsconfig.lab.json`) and
  `docs/runbooks/typescript-toolchain.md`: current pin, error severities and
  compiler exit-code policy.
- Original accepted head `5249b167984da46755522915418cc2a34cd7c3aa`:
  `tsconfig.base.json` plus `standards/effect-diagnostics.profile.json` prove
  the unchanged combined five-rule declared-off ledger.
- [Original diagnostics job](https://github.com/beep-effect/beep-effect/actions/runs/39760243138/job/119763331111):
  375 projects, 90,238 file visits, seven Array findings and zero String findings.
- `history/verification-2026-10-28.md`: current full Check and root configuration
  results, with scope, stable source head and cache accounting.
- [Closeout PR #2318](https://github.com/beep-effect/beep-effect/pull/2318):
  proposed final PR; completion remains subject to exact-head readiness and
  merge-time verification.
