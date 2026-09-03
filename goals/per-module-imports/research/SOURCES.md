# Per-Module Imports — Sources & Provenance

Authored directly (no source exploration). The corpus was produced by a
six-lane research fan-out on 2026-08-23 — four codex `gpt-5.6-sol` (xhigh)
repo lanes and two grok CLI web/X lanes — after a `/grilling` session locked
the decisions now recorded in `SPEC.md` § Decision Log. Raw lane logs and the
executed tooling sandbox live under `.beep/research/per-module-imports/`
(gitignored, machine-local); the reports here are the durable copies.

## 1. Mined source corpus (this packet's reports)

| Source | Title | Lane | Theme | Disposition |
|--------|-------|------|-------|-------------|
| `research/enforcement-census.md` | Enforcement & guidance census | codex Sol xhigh | Everything that enforces/teaches import style; law-flip checklist (§B); mechanisms that fight the migration (§C) | authoritative inventory |
| `research/import-census.md` | Import census & mapping table | codex Sol xhigh | 2,089 + 2,820 executable statements; validated binding→module maps (§3); edge-case register (§4); codemod invariants (§5) | codemod data spec |
| `research/tooling-autofix-eval.md` | Tooling evaluation (executed) | codex Sol xhigh | Biome/GritQL/ESLint/oxlint/tsgo/@effect-codemod/ts-morph, with executed proofs and hashes | decision basis for #9/#10 |
| `research/pilot-and-measurement.md` | Pilot & measurement protocol | codex Sol xhigh | Ranked pilot candidates; paste-ready gate with win/no-win/stop rules; CI cache-bust ordering | normative for the P2 gate |
| `research/effect-community-guidance.md` | Effect community & upstream guidance | grok CLI (web/X) | Premise verdict: strong for module-graph/TS-graph/esbuild-class, weak for production bytes on modern bundlers; core-team split policy | premise evidence |
| `research/lint-tool-landscape.md` | Lint/autofix tool landscape | grok CLI (web) | Landscape ranking; barrel-tool survey (all emit the wrong target form); Atlassian wave template | corroborating landscape |
| `research/assets/ts-morph-prototype.ts` | 125-line executed codemod prototype | codex Sol xhigh | Namespace/named split, alias + type-only preservation, idempotence | prior art for the P1 command |
| `research/assets/biome-*.jsonc` | Executed Biome configs | codex Sol xhigh | Exact-path ban, per-name patterns, warn→error family override | shapes for the P3 rule |
| `research/p1-census-baseline.md` | P1 executable census baseline | Codex goal execution | Historical gross reconciliation, live family-sized structured scans, manual-review inventory, and zero-review pilot proof | P1 delivery evidence |

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| Effect-TS/effect (v4, `.repos/effect` checkout) | MIT | reference | Export-map shape; `packages/tools/oxc` `no-import-from-barrel-package` rule intent and fixtures |
| Effect-TS/eslint-plugin | MIT | port-with-attribution (semantics only) | The only published fixer emitting `import * as X from "pkg/X"`; single-specifier-only and naive path mapping — reference for the P1 fixer semantics, not a runner |
| Effect-TS/language-service / @effect/tsgo | MIT | reference | `namespaceImportPackages`, `importFromBarrel`, `topLevelNamedReexports`; auto-import namespace policy already active in `tsconfig.base.json` |
| ~/YeeBois/dev/effect-tsgo clone (0.36.5) | MIT | reference only | Rule/fixable architecture proving diagnostics are compiled Go — reason tsgo is not this packet's enforcement surface |

## 3. External research sources

Key cited URLs (full trails inside the reports):

- Biome `noRestrictedImports` — https://biomejs.dev/linter/rules/no-restricted-imports/ (no fix; `patterns` since 2.2.0)
- Biome plugins (GritQL rewrites ship) — https://biomejs.dev/linter/plugins/
- Oxlint rules/CLI — https://oxc.rs/docs/guide/usage/linter/rules ; JS-plugins alpha https://oxc.rs/blog/2026-03-11-oxlint-js-plugins-alpha.html
- `@effect/codemod` 0.0.16 — https://www.npmjs.com/package/%40effect/codemod (no barrel transform; executed 3-file dry-run proof)
- Arnaldi on lib-vs-user import policy — https://x.com/MichaelArnaldi/status/1917588446522048748 ; https://x.com/MichaelArnaldi/status/1943700660907589698
- Effect docs import guidance — https://effect.website/docs/getting-started/importing-effect/
- Vercel barrel optimization — https://vercel.com/blog/how-we-optimized-package-imports-in-next-js
- Atlassian 75% faster builds (90k-file wave template) — https://www.atlassian.com/blog/atlassian-engineering/faster-builds-when-removing-barrel-files
- TkDodo barrel files — https://tkdodo.eu/blog/please-stop-using-barrel-files ; Hagemeister module-graph costs — https://marvinh.dev/blog/speeding-up-javascript-ecosystem-part-7
- Zod esbuild analogue (244 kB vs 68 kB) — https://x.com/hichaelmart/status/1975328481669226946
- t3code namespace migration — https://github.com/pingdotgg/t3code/pull/2596

## 4. In-repo capability references

| Brick | Path | Use |
|-------|------|-----|
| `laws effect-imports` (ts-morph law) | `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts` | **extend/invert** — becomes the per-module law + migration command |
| Lint Policy battery | `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` | reuse — hosts the inverted check |
| Yeet repair planner | `packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts` | reuse — auto-applies the new `--write` |
| Biome config + GritQL plugins | `biome.jsonc`, `packages/tooling/policy-pack/lint-rules` | extend — `noRestrictedImports` + family overrides |
| JSDoc example-import detector | `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts` | extend — ban roots in examples |
| tsconfig-sync planner | `packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.plan.ts` | reuse — regenerates aliases after leaf exports |
| Package generators | `CreatePackage/templates/*.hbs`, `Architecture/internal/PackageShell.ts`, `IdentityExportBlock.ts` | fix — stop emitting root imports |
| Box typecheck-cost method | `goals/box-typecheck-cost/research/measurements.md` | reuse — instantiation-floor probe for the pilot |

## 5. Cross-links & provenance

- Decisions: `SPEC.md` § Decision Log (grilled 2026-08-23, options + rejections recorded).
- Gate: `research/pilot-and-measurement.md` § Paste-ready measurement gate is normative for P2.
- Raw lane transcripts/sandbox: `.beep/research/per-module-imports/` (machine-local; not tracked).
