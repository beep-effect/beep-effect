# Per-Module Imports Plan

## Status

Status: `completed-retained` — terminal at the P2 measured stop. P1 and P2
shipped, P3 was not authorized, and P4 closeout is complete. The Professional
Desktop pilot remained inconclusive after its one permitted symmetric
extension, so the recorded stop condition prevents the mass migration.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Ground the migration: enforcement census, import census + mapping table, tooling evaluation, pilot/measurement design, community evidence. | Six cited reports under `research/` (2026-08-23 fan-out: 4 codex `gpt-5.6-sol` xhigh lanes + 2 grok CLI lanes). |
| P1 Vehicle & unblocks | complete (2026-09-03) | Invert `laws effect-imports` into the per-module law + ts-morph migration command (mapping table as data; code/JSDoc/Markdown modes; manual-review queue); land pilot-blocking foundation leaf exports; fix generator templates; extend the JSDoc example-import detector. | New law green on its own fixtures; dry-run over the pilot reports zero unmapped/ambiguous; new leaves resolve under NodeNext build, Bundler check, and docgen. Shipped via `/yeet`. |
| P2 Pilot gate | complete — inconclusive stop (2026-09-03) | Run the approved `apps/professional-desktop` before/after measurement protocol; apply win/no-win/stop rules. | The tracked verdict and raw samples record no stable qualifying win after the permitted extension; the stop rule applies. |
| P3 Batches & ratchet | complete — stopped by P2 gate; not executed | Would introduce and freeze the Biome `noRestrictedImports` warn rule; migrate the foundation kernel, vertical families, tools/tests/apps, and JSDoc/Markdown corpus; flip written laws/skills with enforcement; and finish with the single root-error flip. | Terminal disposition recorded under D14. None of the strict-pass-only work was authorized or claimed complete. |
| P4 Close | complete (2026-09-03) | Closeout reflection and packet state flip. The operator's global rules file remains unchanged because the convention did not land. | Reflection passes `bun run beep lint reflection-artifacts`; tracked packet files describe the terminal stop; the ignored local goals index projection regenerates and checks cleanly. |

## Working notes per phase

### P1 Vehicle & unblocks

- Invert `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts`: ban
  the `effect` root and live foundation roots; map bindings through the census
  table; emit named `pipe`/`flow`/`identity`/`cast` from `effect/Function`;
  cover type-only imports; drop the test/ecosystem exclusions; replace the
  reverse-conversion fixtures. P1 lands an **interim mode, not a global flip**:
  the reverse conversion is deleted everywhere, but both `--check` enforcement
  and Yeet-repair `--write` rewrites are scoped to a promoted-family list that
  starts empty (the pilot joins at P2; batches join during P3). Outside
  promoted families the law is a no-op, so `/yeet` stays green on the ~5k
  unmigrated root imports and no repo-wide repair run can mass-migrate ahead
  of the P2 gate. The approved pilot is promoted before both measurement
  states without a Biome override so P2 holds enforcement config fixed; every
  later family promotes in the same PR as its Biome error override. The
  unscoped check returns only at the final P3 error flip.
  Prototype prior art: `research/assets/ts-morph-prototype.ts`.
- Leaf exports (both workspace + `publishConfig` maps, then tsconfig-sync):
  `@beep/schema/SafeRemoteHost` and `@beep/schema/FileDiff`; `@beep/observability`'s 8
  routed modules + `VERSION` leaf; `@beep/dock` 17 modules; `@beep/dock-react`
  2 modules; `@beep/html` `Html` + `VERSION`; `@beep/ui` `VERSION`; remaining
  `VERSION` extractions per `research/import-census.md` §2.
- Generators: `CreatePackage/templates/app-service-*.hbs`,
  `Architecture/internal/PackageShell.ts`, `IdentityExportBlock.ts`.
- Extend `JSDocDocumentationInventory` example-import detection to banned
  roots (quote-style independent), with ratchet/test coverage.
- Extend the mapping table beyond effect/utils/schema to every in-scope
  foundation barrel the pilot imports (`@beep/lexical-schema`,
  `@beep/identity`, `@beep/dock`, `@beep/dock-react`, `@beep/observability`,
  `@beep/mcp-kit`, then per-batch), generated from each barrel's
  root-export→leaf graph and validated against export maps; publish the
  in-scope census baseline (gross vs in-scope) alongside it.
- Add a permanent Markdown-fence gate: the inverted law's Markdown `--check`
  mode runs over the authored guidance corpus (`.patterns/`, `standards/`,
  `.claude/skills/`, `docs/`, `goals/*/[A-Z]*.md`) as a Lint Policy step, so
  new fence violations cannot land after the corpus reaches zero — advisory
  until the P3 error flip, blocking after it. Biome, the source law, and the
  JSDoc detector do not see standalone Markdown; without this step the
  doc-fence acceptance criterion has no enforcement once the one-shot ends.

### P2 Pilot gate

- Grilling round 1 settled 2026-09-03: the operator approved
  `apps/professional-desktop` as the sole pilot workspace/application at its
  complete live scope. The reviewed inventory is 106 executable files (213
  root declarations to 505 per-module declarations) plus 25 JSDoc-bearing
  files (41 root declarations to 42 per-module declarations), with zero manual
  reviews or parser warnings. `apps/oip-web`, a paired pilot, a partial rewrite,
  and an entry-gate stop were rejected.
- Grilling round 2 settled 2026-09-03: a decisive stable P2 win with every
  prescribed correctness gate passing and no material regression is itself the
  operator sign-off to begin P3. Separate post-verdict approval and pilot-only
  completion were rejected. This authority includes P3 implementation and
  Yeet publication to merge-ready, but never merging a pull request.
- Shared understanding confirmed 2026-09-03. The grilling frontier was empty,
  and the complete pilot proceeded under those locked decisions.
- Freeze `apps/professional-desktop` as the sole promoted-family prefix before
  both measurement states. This is the P2 exception to the P3 rule that later
  family promotions land with a Biome error override; no Biome rule exists yet.
- Operator execution override 2026-09-03: do not wait for other clones'
  scheduler lanes; run checks with affected-package filters and publish through
  Yeet `--start-pr-early --monitor --pr`. Preserve every measurement sample and
  the existing stability/variance/stop rules; do not disturb healthy work.
- Enforcement config identical between states; no warn rule yet.
- Follow `research/pilot-and-measurement.md` "Paste-ready measurement gate"
  literally (7-run medians/MAD/IQR; 5-run build bytes; raw logs under
  `.beep/research/per-module-imports/measurements/`). When the gate closes,
  copy a tracked raw-sample bundle into `history/measurements/{before,after}/`
  — the per-run wall/RSS values, `dev-cold.tsv`, `bundle-bytes.tsv`, and the
  extendedDiagnostics counters — alongside the verdict and `stats-*.json`
  summaries, so the decisive-win/noise math is auditable from the packet on
  any checkout (the `.beep` originals are gitignored and machine-local).
- Attribute any newly surfaced tsgo diagnostics (direct imports expose Effect
  diagnostics the barrel hid — proven in `research/tooling-autofix-eval.md`).
- Final verdict 2026-09-03: **inconclusive — stop**. The valid extension has 15
  source-tsgo and Vitest samples per state, exact source file counts within
  each state, no stable qualifying improvement, and no stable material
  regression. P2 evidence is recorded in
  `history/p2-pilot-verdict.md` and `history/measurements/`; P3 was not entered.
  The pilot source remains as bounded evidence, while the default
  promoted-family list returns to empty after the stop.

### P3 Batches & ratchet

- Warn rule: one exact-path entry per barrel with a short message linking the
  mapping doc; per-family `error` overrides with positive includes
  (`research/assets/biome-severity-ratchet.jsonc` shape). Never tune the
  global rule between batches.
- Record `turbo run check --filter=... --dry-run=json` task counts per batch
  before its PR; a foundation-shaped count (~230) is a full-wave CI budget.
- Doc corpus: codemod fence modes + docgen after each batch; stale doc APIs
  (`TestClock` root, `TaggedErrorClass`, `VERSION` examples) go to manual
  review, never invented subpaths.

## P4 Closeout Checklist

1. [x] Write a closeout reflection via `/reflect` to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` (frontmatter must validate).
2. [x] Run `bun run beep lint reflection-artifacts`.
3. [x] Update `README.md`, `ops/manifest.json` phase statuses, and
   `initiative.status` in the same PR; then regenerate the ignored local
   `goals/INDEX.md` projection and pass `bun run beep goals index --check`.

## Execution Notes

- Preserve unrelated worktree changes; never `git add -A`.
- Keep `SPEC.md` normative; update it only when the contract changes.
- Friction receipts go to the active ledger at the moment they happen.

## Verification Commands

```sh
test "$(wc -m < goals/per-module-imports/GOAL.md)" -le 4000
jq . goals/per-module-imports/ops/manifest.json
rg -n "per-module-imports|GOAL.md|agentLaunchers|packetAnchorDocument" goals/per-module-imports
git diff --check -- goals/per-module-imports
```
