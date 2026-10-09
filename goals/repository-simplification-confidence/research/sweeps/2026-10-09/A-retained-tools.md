# Sweep A — retained tools needing a documented purpose

## Provenance

- Checkout: `~/YeeBois/projects/beep-effect3-worktrees/rsc-packet`, branch `docs/repository-simplification-confidence-packet`, head `e62411d63f` (= `main`). `goals/repository-simplification-confidence/**` (another agent's work, untracked) ignored.
- Date: 2026-10-09. Sweeper: read-only, Opus 5.5.
- Commands used: `rg`, `fd`, `ls`, `du`, `jq`, `sha256sum`, `git ls-files`, `git log`, `git check-ignore`; `node_modules/.bin/statelyai scan --json` (0.12.5); `node_modules/.bin/oxlint --disable-nested-config --deny-warnings -c .oxlintrc.shadcn.json apps packages` (1.87.0); `typos` (system typos-cli 1.50.3), plus `typos --isolated --config <scratch copy>` once per word with that word removed; `bun run beep cache profile` (check mode); `bun run beep tsconfig-sync --check`; `node node_modules/@effect/tsgo/dist/effect-tsgo.cjs get-exe-path`; `tsgo --version`, `tsc --version`. `git status --porcelain` before and after showed only the pre-existing untracked packet directory. No writes inside any checkout.
- Tool versions at head: statelyai 0.12.5, @statelyai/sdk 0.37.4, xstate 6.0.0-alpha.64, @effect/tsgo 0.47.2, @typescript/native 7.0.2, typescript 6.0.3, oxlint 1.87.0, typos-cli 1.50.3 locally vs `typos-cli@1.44.0` in CI (`.github/workflows/heavy.yml:189`).

## Summary table

| Surface | Generator / owner command | Live check at head | Existing docs | Gap for the acceptance row |
|---|---|---|---|---|
| `vitest.aliases.generated.json` | `bun run beep tsconfig-sync` (`planRootVitestAliasSync`) | `tsconfig-sync --check`: no drift; 797 aliases = root `tsconfig.json` `compilerOptions.paths` exactly; 0 missing targets | None outside code JSDoc | Runbook entry; a test or doctest proving one alias resolves under Vitest |
| `statelyai.json` + Stately CLI | Hand-authored; `bunx statelyai scan` / `open` | `scan` finds 2 machines, both exist | `docs/runbooks/xstate-effect-statecharts.md` | Version drift in the runbook; the visual `open` flow has not been exercised; MCP needs OAuth |
| `biome.identity.jsonc` | `bun run beep cache profile --write` (check without `--write`) | `cache profile`: "current" | None outside code JSDoc | Doc; regenerate after Impeccable and stale-path removals |
| `_typos.toml` | Hand-authored vocabulary | `typos`: exit 0, 0 findings over 7,104 files | No prose docs | 4 dead words, 3 dead excludes, 2 redundant excludes, list duplicated in `turbo.json`; CI/local version skew |
| `.oxlintrc.shadcn.json` | Hand-authored; `bun run lint:shadcn` | oxlint exit 0 | `docs/runbooks/design-system-lint.md`, `AGENTS.md` | Already met; record the receipt |
| `beep-effect.iml` | Hand-curated (tracked since #676) | 181 `excludeFolder`; 6 missing in this worktree, 2 in the primary clone; no absolute paths | `standards/git-worktrees.md:118-123` | Stale and partial packet exclusions; entries that disappear with Workstream A removals; `docs` excluded wholesale |
| `tools/tsgo-shim` | Workspace `@beep/tsgo-shim`; root `prepare` | `tsgo` and `tsc` both print `Version 7.0.2+effect-tsgo.0.47.2`; patched binary sha256 equals the artifact | `docs/runbooks/typescript-toolchain.md` | Stale comment in `tsgo.js:10`; re-verify after `prune-tsgo-backups.mjs` is ported |
| `.semgrep/` | Hand-authored; `bun run beep ci lane sast` | Not run (needs Docker and the registry) | Header of `.semgrep/first-party.yml` only | **No positive or negative fixtures exist**; unpinned image; stale `.semgrepignore` entry |
| `harness-ledger/` | `bun run beep harness-ledger` (single writer) | 4 files, 32 KB, 19 rows | `harness-ledger/README.md` | No always-loaded repo file references it; nothing excludes it from default search |

## Evidence

### 1. `vitest.aliases.generated.json` (78.8 KB, 797 keys)

- Generator: `packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.plan.ts`, `VITEST_ALIASES_FILENAME` (l.679) and `planRootVitestAliasSync` (l.729). It is called from `TsconfigSync.service.ts:126`, and the schemas are `RootVitestAliasesChange` and `RootVitestAliasesPlannedFileChange` in `TsconfigSync.schemas.ts`. Invocation: `bun run beep tsconfig-sync`, or `config-sync` / `config-sync:check` (`package.json:391-392`). The command also runs inside `beep:preflight` (`package.json:381`).
- Parity check: `Quality/Quality.command.ts`, `collectGeneratedVitestAliasDiagnostics` (l.2712), used by `runTsgoRulesCheck` (l.2887, reads the file at l.2895). The message reads "...differs from tsconfig.json compilerOptions.paths; regenerate the alias data".
- Consumers:
  - `vitest.shared.ts:15` (JSON import) and `:180` (`rootTsconfigPathEntries` becomes `resolve.alias`). The file is sorted longest-first so `/*` wildcards resolve correctly.
  - Turbo inputs: `turbo.json:71,367,399,420,439,452,475,764,910,1254`.
  - 10 app `tsconfig.json` `include` lists (e.g. `apps/todox/tsconfig.json:13`).
  - `standards/cache-qualification-baseline.json` (many rows).
  - Tests: `packages/tooling/tool/cli/test/coverage-turbo-inputs.test.ts:28,162` and `doctest-turbo-inputs.test.ts:96,179,262`.
- Live evidence: `bun run beep tsconfig-sync --check` printed "no drift detected" (exit 0). A JSONC parse of `tsconfig.json` showed `paths` has 797 keys and is deep-equal to the generated file. 0 of the alias targets are missing on disk.
- Docs: none in `docs/`, `standards/`, or `.patterns/`.
- What the acceptance row still needs:
  - "Working aliases" is not yet proven at runtime. Parity and target existence are proven.
  - Wanted: one receipt from a Vitest run that imports through a `@beep/*` alias and a `@beep/*/*` wildcard. The implementing lane runs it; this sweep was not allowed to.

### 2. `statelyai.json` and the Stately CLI

- Config (`statelyai.json`): `include: ["packages/**/src/**/*.machine.ts", "apps/**/src/**/*.machine.ts"]`, `exclude: node_modules, dist, *.test.ts`, `defaultXStateVersion: 6`.
- Dependency: `statelyai` catalog `0.12.5` (`package.json:236`), root devDependency (`package.json:300`). `@statelyai/sdk` is `0.37.4` (`package.json:105`). `.fallowrc.jsonc:227-229` keeps the CLI as a declared tool dependency.
- Machine files matching `*.machine.ts`:
  - `apps/professional-desktop/src/intake/DocumentIntake.machine.ts`: discovered, `documentIntakeMachine` at l.214.
  - `apps/professional-desktop/src/intake/IntakeBatch.machine.ts`: discovered, `intakeBatchMachine` at l.132.
  - `packages/drivers/xstate/test/fixtures/Release.machine.ts`: correctly not discovered (under `test/`, not `src/`).
- `statelyai scan --json` returned exactly those 2 machines. It wrote nothing (git status unchanged).
- Visual flow:
  - The runbook path is `bunx statelyai open apps/professional-desktop/src/intake/DocumentIntake.machine.ts` (`docs/runbooks/xstate-effect-statecharts.md:164`). It opens a local editor and was not exercised here (interactive).
  - The code-side equivalent is `toMachineJsonText` (`packages/drivers/xstate/src/MachineExport.ts:80`), with the test "exports a Stately-compatible definition of both regions" (`apps/professional-desktop/test/intake-model.test.ts:74`).
  - The hosted MCP `stately` (`.mcp.json:59-61`, enabled at `.claude/settings.json:96`) reported "requires authentication" in this session.
- Stale docs:
  - `docs/runbooks/xstate-effect-statecharts.md:16-17` names `@statelyai/sdk 0.37.2` and `statelyai 0.12.3`. The installed and catalog versions are 0.37.4 and 0.12.5.
  - `:167-168` describes the globs as `**/src/**/*.machine.ts`. The actual globs are scoped to `packages/` and `apps/`. This is minor but inexact.
- Acceptance needs:
  - The `scan` receipt above (2/2 machines).
  - A recorded `statelyai open` session (screenshot or QA artifact) showing both regions of `documentIntakeMachine`.
  - Either a Stately sign-in for the MCP, or a recorded decision that the MCP route is optional.

### 3. `biome.identity.jsonc` (5.9 KB, single-line JSON)

- Header: "Generated by beep cache profile; regenerate instead of editing."
- Generator: `packages/tooling/tool/cli/src/commands/Cache/Cache.profile.ts` (`profilePath` l.30, `renderCacheIdentityLintProfile` l.52, `verifyCacheIdentityLintProfile` l.90, `writeCacheIdentityLintProfile` l.117). It projects root `biome.jsonc` scoped to `packages/foundation/modeling/identity/**` and `packages/foundation/primitive/types/**`.
- Command: `cacheProfileCommand`, `Cache/Cache.command.ts:760-771`. `bun run beep cache profile` checks the file; `--write` regenerates it.
- Consumers:
  - `Cache/Cache.runtime.ts:104-129`: when `@beep/identity#lint` passes `BIOME_CONFIG_PATH` through, the profile is verified and the env var is injected. A caller override is refused.
  - `Cache/Cache.census.ts:344`.
  - `Cache/Cache.pilot.ts:406,713,1326`.
  - `packages/foundation/modeling/identity/turbo.json:33` (`passThroughEnv: ["BIOME_CONFIG_PATH"]`).
  - Tests: `cache-runtime.test.ts:291-316`, `cache-profile.test.ts:75,88`, `cache-pilot-orchestration.test.ts:381-392`.
- Live evidence: `bun run beep cache profile` printed "Identity lint candidate profile is current."
- Removal coupling: the projected excludes contain `!.claude/skills/impeccable`, `!.github/skills/impeccable`, `!standards/repo-exports.catalog.jsonc` (file deleted in 8852619f04, 2026-06-18) and `!specs` (no such directory). All of these come from `biome.jsonc` (e.g. `biome.jsonc:58`). After the Impeccable removal and the `biome.jsonc` cleanup, run `beep cache profile --write`, otherwise the check fails.
- Docs: none in `docs/` or `standards/`.

### 4. `_typos.toml` (146 lines)

- Gate wiring:
  - `package.json:460` `"lint:typos": "typos"`.
  - `turbo.json:845-` `//#lint:typos`.
  - `Quality/Tasks.ts:2963` (policy state tasks).
  - `Lint/Lint.command.ts:873` (policy fingerprint inputs, written to `standards/policy-tools.fingerprint.json`).
  - `lefthook.yml:15-18` (pre-commit).
  - `flake.nix:28`.
  - CI: `heavy.yml` lane `lint-policy` with `install_typos: "true"` (l.47) and `typos-cli@1.44.0` (l.189).
  - Remediation text: `Yeet/internal/IssueClassification.ts:340-344`.
- Live evidence: `typos` exited 0 with 0 findings; `typos --files` lists 7,104 files.
- Word probe: each `extend-words` key was removed in turn and typos rerun with the rest of the config.
  - **Dead (no occurrence in any checked file):** `Uncommited` (l.16), `Definely` (l.22), `pxat` (l.33), `colorts` (l.69).
  - **Not flagged by 1.50.3 when removed** (present in files, so likely dictionary-safe now; confirm against the CI 1.44.0 dictionary before deleting): Struct, Fnc, Ser, Eff, retriev, libpff, tika, Tika, ALIS, LOV, Inferrable, noInferrableTypes, exat, cose, Cose, beep, monorepo, turborepo, bunfig, syncpack, lefthook, vitest, tstyche, docgen, dedup, dtslint, tsbuildinfo, IST, gam, iif, odf, opf, vor (33 words).
  - **Still required** (findings when removed, count in parentheses): wdth 18, Somes 1046, annote 11420, bimap 12, fpr 1, Overrideable 1, Clas 1, unparseable 43, sherif 16, Compensacion 3, JOD 8, Nam 3, ND 41, Som 5, HPE 1, BA 25, GES 1, PN 178, AKS 2, mis 5, aas 8, anser 8, aso 8, caf 4, commonspace 8, exstream 16, fo 13, nervana 8, recordare 16, sycle 8, ue 40, uper 8, vas 32, metalness 4.
- Excludes:
  - **Dead:**
    - `outputs/agent-reliability/**` (l.123): directory removed in 5ed33caf4f (2026-03-08).
    - `standards/repo-exports.catalog.jsonc` and `standards/repo-exports.catalog.md` (l.125-126): removed in 8852619f04.
  - **Redundant:**
    - `explorations/*/CAPTURE.md` (l.101), covered by `explorations/**` (l.122).
    - `patches/*.patch` (l.107), covered by `patches/**` (l.145).
  - **Already ignored by git:** `.repos/**`, `node_modules/**`, `build/**`, `tmp/**`, `dist/**`, `coverage/**`, `.next/**`, `.beep/**`, `**/src-tauri/*`. These are harmless; keep or drop by policy.
- Duplication: `turbo.json` `//#lint:typos` inputs (l.845-890) copy the exclude list as negations, including the dead `!outputs/agent-reliability/**` (l.877) and `!standards/repo-exports.catalog.{jsonc,md}` (l.879-880). Any `_typos.toml` exclude change needs the same edit there. Generating one list from the other is worth considering.
- Version skew: CI pins 1.44.0, the local system binary is 1.50.3, and `flake.nix` pins its own. The spelling receipt should name the version used.
- Adjacent finding (out of scope for A, report to B): `infra/package.json:40` script `repo-exports:shard` invokes the removed `quality repo-exports-catalog`.

### 5. `.oxlintrc.shadcn.json` (3.0 KB)

- Invocation: `package.json:426` `oxlint --disable-nested-config --deny-warnings -c .oxlintrc.shadcn.json apps packages`. `--disable-nested-config` isolates the lane from the main `.oxlintrc.json` (the only other oxlintrc).
- Turbo and CI wiring:
  - `turbo.json:786-` `//#lint:shadcn`.
  - `.github/workflows/check.yml:155-158,304-305` (`ci lane shadcn-lint`).
  - `Quality/internal/GithubChecks.ts:380-384`, `TurboConfigProof.ts:51`, `Tasks.ts:2962`.
  - `Yeet/internal/WaveOrder.ts:293-296,491`, `IssueClassification.ts:274-277`.
- Reviewed exceptions: there are no allow-lists and no inline disables (`rg 'disable.*shadcn'` over apps and packages finds 0). The only scoped exceptions are the three `overrides` blocks: scan-all-strings on UI `.ts`; MUI themes and `lib/utils.ts`; design-system components with `no-restyle` and `require-static-classes` off.
- Live evidence: the scoped command exited 0 (oxlint 1.87.0).
- Docs: `docs/runbooks/design-system-lint.md`, `AGENTS.md` (Touch table). This row is effectively satisfied; record the receipt.

### 6. `beep-effect.iml` (15.1 KB, 181 `excludeFolder` and 7 `excludePattern`)

- Tracking: `.idea/.gitignore` whitelists `modules.xml`, `vcs.xml` and the inspection profile, and the module lives at the root (`.idea/modules.xml`). History: added in b2fe0c1705 (#676, 2026-08-13), last touched in 7980e5aaa1 (#1284, 2026-09-26). Documented in `standards/git-worktrees.md:118-123`.
- Machine leakage: none. There are no absolute or home paths in `beep-effect.iml` or the tracked `.idea/*`; everything uses `$MODULE_DIR$`. The machine-local files (`compiler.xml`, `effect.intellij.xml`) are untracked and copied by `beep worktree new`.
- Entries missing on disk:
  - This worktree: `tools/skillopt/.venv` (l.154), `packages/tooling/tool/cli/python/photo-face/.venv`, `.fallow`, `.serena` (l.179), `docs/generated` (l.181), `graft`.
  - Primary clone: only `tools/skillopt/.venv` and `docs/generated`.
  - Local residue directories (`.venv`, `.fallow`, `graft`, `.serena`) are legitimate per-machine exclusions. `docs/generated` has no producer and is also redundant with `docs` (l.185).
- Entries that Workstream A removals make stale: `tools/skillopt/.venv` (l.154), `.impeccable` (l.175), `.serena` (l.179).
- Partial packet coverage: 159 entries are individual `goals/<slug>` / `explorations/<slug>` directories, out of 299 such directories at head, so **140 are not excluded**. Unexcluded examples: `goals/boolean-creep`, `explorations/build-pipeline-simplification`. The list is a hand snapshot that drifts with every new packet. Excluding `goals/` and `explorations/` wholesale, or generating the list, would fix it. Both are decisions for the lane.
- Indexing scope worth confirming:
  - `docs` (l.185), `research` (l.184), `.patterns` (l.177) and `.semgrep` (l.178) are excluded entirely. The IDE will not index authored docs or the pattern laws.
  - Excluding these may be intentional, for search noise. Record that intent or narrow the exclusions.

### 7. `tools/tsgo-shim`

- `tools/tsgo-shim/package.json`: `@beep/tsgo-shim` 0.0.0, bin `tsgo` → `./tsgo.js`, dependency `@effect/tsgo: catalog:`. It is a root workspace (`package.json:491`) and root devDependency (`package.json:268`). Other references: `syncpack.config.ts:8`, `.fallowrc.jsonc:132-134,239`, and turbo inputs `turbo.json:287-288` (build) and `:350-351` (check).
- `tools/tsgo-shim/tsgo.js`: resolves `@effect/tsgo/dist/effect-tsgo.cjs get-exe-path`, then uses `process.execve` (falling back to `execFileSync`) and propagates the exit status. The comment at l.10 still cites "0.39 platform packages" while the installed version is 0.47.2. Refresh or generalize the comment.
- Root `prepare` (`package.json:433`): `effect-tsgo unpatch && node scripts/prune-tsgo-backups.mjs && effect-tsgo patch`. The brief routes `scripts/prune-tsgo-backups.mjs` to Workstream C ("keep lightweight install-safe entry"), so provenance must be re-proven after that port.
- Live provenance at head:
  - `get-exe-path` returns `node_modules/@effect/tsgo-linux-x64/artifacts/typescript/7.0.2/tsc`. The artifacts directory also holds `7.1.0-dev.20260929.1`.
  - `node_modules/.bin/tsgo` resolves to `tools/tsgo-shim/tsgo.js`; `node_modules/.bin/tsc` resolves to `@typescript/native/bin/tsc`.
  - Both print `Version 7.0.2+effect-tsgo.0.47.2`.
  - sha256 prefix `8f5c30610ffe8493` is shared by the artifact and `@typescript/typescript-linux-x64/lib/tsc`. `tsc.original` is `4f2de67828640175` (stock binary, preserved).
  - No `.original.N` rotations are present.
- Docs: `docs/runbooks/typescript-toolchain.md:13-41` matches what was observed (verified 2026-09-24 in that file).

### 8. `.semgrep/` (one file, `first-party.yml`, 3.7 KB)

- Rules: `beep-no-eval` (l.19), `beep-no-dynamic-shell-exec` (l.35), `beep-hardcoded-private-key` (l.78), all ERROR. Escape hatches are documented in the header (l.16-17): `// nosemgrep` and `.semgrepignore`.
- Invocation: `bun run beep ci lane sast` leads to `runSastScan`, `Quality/Quality.command.ts:1303-1407`.
  - It runs `docker run ... semgrep/semgrep semgrep scan --error` with `p/typescript p/javascript p/security-audit p/secrets` plus `/src/.semgrep/first-party.yml`, `--timeout 20`.
  - The scan covers **only** files changed in `origin/main...HEAD` (l.1312-1327).
  - It filters `.repos/`, both Impeccable trees and `infra/ci-runners/sdks/` (l.1336-1340).
  - It deliberately fails open when no JS/TS files changed (l.1368-1372).
- Hosted wiring: `.github/workflows/check.yml:1219-1227`.
- Determinism caveats:
  - The image is untagged (`semgrep/semgrep`, l.1385).
  - The four `p/*` packs are fetched from the registry at run time.
  - Only `first-party.yml` is actually vendored and offline, which contradicts the header's claim of byte-identical determinism for the whole scan.
- **Fixtures: none.** No file references the three rule ids outside `.semgrep/`. There is no `semgrep --test` layout (`// ruleid:` / `// ok:` annotated targets) and no CLI test exercising the lane's argv. The acceptance row requires positive and negative fixtures; they have to be created.
- `.semgrepignore`:
  - `apps/desktop/scripts/dev-with-portless.ts` does not exist (stale).
  - The Impeccable entries go away with that removal, in both `.semgrepignore` and `Quality.command.ts:1338-1339`.
- Existing `nosemgrep` suppressions (registry rules): `packages/foundation/ui-system/editor/src/mermaid-view.tsx:770`, `editor/test/mermaid-race.test.tsx:587`, `cli/test/research-library-views.test.ts:202,218,223`.
- Docs: none outside the rule-file header and code comments.

### 9. `harness-ledger/`

- Size: 32 KB, 4 files.
  - `README.md` (6.0 KB).
  - `rows/2026-09.jsonl` (14 rows, 13.0 KB).
  - `rows/2026-10.jsonl` (5 rows, 6.1 KB).
  - `rows/.gitkeep`.
- Dispositions: 10 proposed, 6 rejected, 2 deferred, 1 accepted.
- Owner: `bun run beep harness-ledger {propose,disposition,list,prune-proposals}`.
  - CLI: `packages/tooling/tool/cli/src/commands/HarnessLedger/HarnessLedger.service.ts`.
  - Schema: `packages/tooling/library/ai-metrics/src/harness-ledger.ts` (`HarnessLedgerRow`, `deriveHarnessHash`).
  - Hook stamp: `.claude/hooks/hook-pulse.sh:368-370`.
  - Packet: `goals/harness-evidence-ledger`.
- SkillOpt coupling: `tools/skillopt/src/beep_skillopt/ledger.py` and `docs/runbooks/skillopt-rerun.md:203,221` write rows through the CLI. Both go away with the SkillOpt retirement; the rows themselves stay immutable.
- Default context exposure:
  - **No always-loaded repo surface references `harness-ledger`.** `AGENTS.md`/`CLAUDE.md`, `.claude/settings.json`, `.claude/rules`, skill `SKILL.md` frontmatter, `.agents`, `.codex`, `.cursor`, `.junie` and `.github` all have zero hits.
  - The only always-loaded mention found is outside the repo: the operator's private auto-memory index line linking `harness-evidence-ledger-close-state.md`.
  - The directory is not listed in `.aiignore`, `.rgignore`, `.ignore`, `.graftignore`, `.analysisignore` or `beep-effect.iml`, so default `rg` / `graft` / IDE / agent search sees the JSONL rows.
  - Plausible meanings of "reduce default context exposure":
    - (a) add `harness-ledger/rows/` to `.rgignore` / `.aiignore` / `.graftignore` / the iml so rows surface only on purpose;
    - (b) keep `README.md` as the compact presentation and point to `harness-ledger list` for folded chains;
    - (c) move the directory under an existing evidence root. Option (c) conflicts with the immutable-path law and the CLI's fixed `harness-ledger/rows` path.

## Proposed plan (implementing lane)

1. Write one runbook section or table, e.g. extend `docs/runbooks/` with "Retained repository tools". Give one row per surface above: purpose, owner command, consumers, invocation, check command, and the reconsider-when condition (brief §1.6).
2. `_typos.toml`:
   - Delete the 4 dead words and the 3 dead and 2 redundant excludes.
   - Mirror the edits into `turbo.json` `//#lint:typos` inputs.
   - Before deleting any of the 33 "not flagged" words, rerun the probe with the CI typos 1.44.0. Optionally align the CI pin with flake and local.
   - Then run `bun run beep lint policy-fingerprint --write`.
3. `biome.jsonc`: drop `!standards/repo-exports.catalog.jsonc` and `!specs`, and drop the Impeccable entries when Impeccable is removed. Then run `bun run beep cache profile --write` and commit the regenerated `biome.identity.jsonc`.
4. `beep-effect.iml`:
   - Remove `tools/skillopt/.venv`, `.impeccable`, `.serena` (with their removals) and the redundant `docs/generated`.
   - Replace the 159 per-packet entries with whole `goals/` and `explorations/` exclusions, or generate them. Make a recorded decision.
   - Record why `docs`, `.patterns` and `research` are excluded, or narrow those exclusions.
5. `.semgrep/`:
   - Add `.semgrep/first-party.test.ts` (or `tests/`) fixtures with `// ruleid:` and `// ok:` cases per rule. These are runnable with `semgrep --test .semgrep/` in the same Docker image.
   - Add a CLI test pinning the `runSastScan` argv.
   - Pin the image by digest.
   - Remove the stale `.semgrepignore` path and, with Impeccable, the Impeccable filters.
   - Correct the "byte-identical" header wording about the `p/*` packs.
6. `tools/tsgo-shim/tsgo.js:10`: refresh the version-specific comment. After the C-port of `prune-tsgo-backups.mjs`, re-capture the provenance receipt: `get-exe-path`, both `--version` outputs, the sha256 equality, and no `.original.N`.
7. `docs/runbooks/xstate-effect-statecharts.md:16-17,167`: correct the versions and glob text. Capture the `statelyai scan --json` receipt and one `statelyai open` visual-flow screenshot. Decide whether the Stately MCP stays enabled in `.claude/settings.json:96` given that it needs OAuth.
8. Vitest aliases: capture `tsconfig-sync --check` plus one Vitest run that imports through both a direct alias and a wildcard alias as the "working aliases" receipt.
9. `harness-ledger/`: add `harness-ledger/rows/` to `.rgignore`, `.aiignore` and `.graftignore` (and optionally the iml). Keep the README as the compact view. Do not touch rows.

## Open questions

- Whether the 33 words that typos 1.50.3 no longer needs are still flagged by the CI-pinned 1.44.0. This could not be tested: only 1.50.3 is installed, and installing would be a write.
- Whether `statelyai open` renders both regions of `documentIntakeMachine` correctly. Not exercised; it is interactive and opens a browser.
- Semgrep behaviour at head (findings and timing). Not run; it requires Docker and registry fetches, and on `main` the changed-file list is empty, so the lane fails open.
- Whether excluding `docs`, `.patterns`, `research` and `.semgrep` from WebStorm indexing is deliberate. The history (#676 onward) records no rationale.
- Which concrete mechanism the operator means by "reduce default context exposure" for `harness-ledger/`. No in-repo always-loaded reference exists to trim.
- Why the 10 app `tsconfig.json` files `include` `vitest.aliases.generated.json`. Presumably so the JSON import in `vitest.shared.ts` typechecks; not confirmed.
