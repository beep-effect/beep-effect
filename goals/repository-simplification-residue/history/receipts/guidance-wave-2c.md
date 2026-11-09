# #1856 guidance wave 2c: individual review of the remaining inline directive kinds

Lane `residue-guidance`, wave 2c, branch `feat/residue-guidance-wave2c` from `main` at
`04a3dc1e23`. Route: S39/S41 Claude chain, step 1 (`claude-opus-5-5` child). This wave
covers `biome-ignore`, `cspell:`, coverage ignores (`istanbul`, `c8`, `v8`), Python
`noqa`/`type: ignore`, `oxlint-disable` and `shellcheck disable=`. Wave 2a (#2064) owned
`fallow-ignore`; wave 2b (#2110) owns `@ts-expect-error`, `@ts-ignore` and
`@effect-diagnostics`. Wave 3 owns the Markdown TypeScript fence compile gate and the
upstream-copied `.patterns` decision.

## Census

Command, run from the repository root (the wave-1 comment-lead pattern, restricted to the
six kinds, with `--hidden -g '!.git'`):

```sh
rg --only-matching -P -n --hidden -g '!.git' -g '!node_modules' -g '!.beep' -g '!*.md' -g '!*.jsonl' \
  '(//|/\*|\{/\*|#|<!--|\*)\s*(biome-ignore|cspell:|istanbul ignore|c8 ignore|v8 ignore|noqa|type:\s*ignore|oxlint-disable|shellcheck disable=)[^\n]*' .
```

The base census has 192 matches. Every count below comes from that one run. Without
`--hidden` it finds 178: the 14 hidden-path matches are 11 `noqa` in
`.claude/skills/ontology-foundational-auditor`, 1 `shellcheck` in `.cursor/hooks` and 2
`biome-ignore` in `apps/storybook/.storybook`. A broader `(istanbul|c8|v8)\b` probe adds only
four `# v8.x.y` action-pin comments in workflows, which are not directives.

Ten matches are not directives and stay: one `biome-ignore` template string in
`packages/tooling/tool/cli/src/commands/Cache/Cache.profile.ts` (the writer of
`biome.identity.jsonc`; its text was updated together with the output), and nine quotes (4 `cspell:`,
5 coverage) in immutable effected-promotion review logs under `goals/effected-promotion`.

| Kind | Wave 1 (`e3ee18dfd7`) | Matches before | Real before | Fixed | Stale | Kept (real after) | Matches after |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `biome-ignore` | 57 | 61 | 60 | 0 | 26 | 34 | 35 |
| `cspell:` | 37 | 43 | 39 | 0 | 39 | 0 | 4 |
| coverage ignore | 32 | 36 | 31 | 1 | 6 | 24 | 29 |
| `noqa` / `type: ignore` | 29 | 40 | 40 | 1 | 16 | 23 | 23 |
| `oxlint-disable` | 10 | 10 | 10 | 0 | 2 | 8 | 8 |
| `shellcheck disable=` | 1 | 2 | 2 | 0 | 2 | 0 | 0 |
| **Total** | **166** | **192** | **182** | **2** | **91** | **89** | **99** |

Check: 182 = 2 + 91 + 89; 192 = 182 + 10; 99 = 89 + 10. No `type: ignore` directive exists;
all 40 Python matches are `noqa`. Wave 1 ran without `--hidden` and before later merges, so
its kind counts are lower (the 11 `.claude` `noqa`, the `.cursor` shellcheck and the two
`.storybook` directives were invisible to it).

By root, real directives before (182): packages 83, explorations 27, scratchpad 26, apps 23,
`.claude` 11, goals 7, infra 2, scripts 1, `.cursor` 1, `biome.identity.jsonc` 1. After (89):
packages 42, apps 17, `.claude` 11, explorations 11, goals 7, `biome.identity.jsonc` 1.
Non-directive matches (10, unchanged): goals 9, packages 1.

| Kind × root, real | Before | After |
| --- | --- | --- |
| `biome-ignore`: scratchpad / packages / apps / goals / `biome.identity.jsonc` | 26 / 17 / 9 / 7 / 1 | 0 / 17 / 9 / 7 / 1 |
| `cspell:`: packages / apps / explorations / infra | 27 / 6 / 4 / 2 | 0 / 0 / 0 / 0 |
| coverage: packages / explorations | 26 / 5 | 24 / 0 |
| `noqa`: explorations / `.claude` / packages | 18 / 11 / 11 | 11 / 11 / 1 |
| `oxlint-disable`: apps / packages | 8 / 2 | 8 / 0 |
| `shellcheck`: scripts / `.cursor` | 1 / 1 | 0 / 0 |

## Method, per kind

Every liveness experiment rewrote the directive token on its exact line to an inert token
(line numbers unchanged), ran the owning tool, and restored the files from a tar archive.

- **`biome-ignore`.** Biome 2.5.6 (`biome check`, lint + format + assist) on the 26 files
  holding the 34 directives outside `scratchpad`: base clean, stripped run 49 diagnostics,
  every directive attributable (next-line, `-all` file scope, or the `format` header). The
  same experiment on the final tree reproduced the same 49. `scratchpad` is excluded by
  `biome.jsonc` (`!scratchpad`), no scratchpad script runs Biome (the effected lab lints with
  oxlint and `.oxlintrc.effected.json`), and 18 of the 26 suppress
  `noControlCharactersInRegex`, which the root config sets `off`. Those 26 are dead weight.
- **`cspell:`.** No cspell package, config, hook or workflow exists; the spell gate is
  `typos` (`_typos.toml`, lefthook, the Heavy lane). All 39 real directives were deleted.
  `typos` over the changed files stays clean.
- **Coverage ignores.** The Node coverage provider is v8, and `ast-v8-to-istanbul` honors
  `istanbul|c8|v8 ignore if|else|next|file` hints. For `@beep/html`, `@beep/rdf`,
  `@beep/langextract`, `@beep/skill-contract` and `@beep/shared-domain` the package suite ran
  with lcov twice, base and stripped, and the uncovered lines, branches and functions were
  diffed and attributed. `@beep/repo-cli`'s one hint was checked with the full suite and
  `--coverage.include=src/internal/cli/Stdin.ts`. The five hints in
  `explorations/identity-as-iri/assets/ontology-prototype` have no package, runner or
  coverage run.
- **`noqa`.** Ruff runs only on `packages/tooling/tool/cli/python/photo-face`
  (`beep:lint:python`, ruff 0.12.12, default rule set). `ruff check --extend-select RUF100`
  there reported 9 unused `noqa` (`S310`, `BLE001`), and stripping the remaining `E402`
  makes ruff report it. No Python lint gate covers `explorations` or `.claude`.
- **`oxlint-disable`.** The root `lint:oxlint` config enables no native rule. The 8
  `typescript/no-deprecated` disables belong to the type-aware `lint:deprecated-apis` lane
  (`.oxlintrc.deprecated-apis.jsonc`); running it over `apps/oip-web` and
  `apps/professional-desktop` stripped reports exactly 8 errors, clean otherwise. No oxlint
  config enables `no-unsafe-declaration-merging`, so the two `@beep/chalk` file disables are
  dead weight.
- **`shellcheck`.** shellcheck is not installed and no hook or workflow runs it.

## Fixed in source (2)

- `packages/foundation/modeling/rdf/src/Uri.ts`: the `istanbul ignore next` guarded a
  default-port ternary that can never fire, because WHATWG `URL.host` already drops `:80`
  for `http:` and `:443` for `https:`. The ternary is gone and `host` is used directly; the
  default-port tests (`URI.test.ts`, `Rdf.test.ts`) still pass and the file stays at 100%.
- `packages/tooling/tool/cli/python/photo-face/beep_photo_face/worker.py`: `import numpy`
  moved into the third-party import block, so its `E402` suppression went. Only `cv2` reads
  the pixel limit at import time; its `noqa` stays.

## Stale (91)

- 26 `biome-ignore` in `scratchpad` (outside Biome's includes).
- 39 `cspell:` (cspell is not run). Blank comment lines left behind were removed, and the
  `@beep/utils` `Function.ts` module JSDoc lost its now-empty `**Details**` heading.
- 6 coverage: the five exploration-prototype hints, and `EntityRef.ts:141`, whose stripped
  run matched base exactly (tests already throw the mismatch error three times).
- 16 `noqa`: 9 photo-face (`RUF100`), 7 in unpinned exploration scripts
  (`validate_packet.py` 3, `run_cq_suite.py` 1, `test_run4_proof_ledger.py` 3). The photo-face
  reasons stay as plain comments (`# dependency boundary`, `# pragma: no cover - process boundary`).
- 2 `oxlint-disable` in `@beep/chalk`, 2 `shellcheck disable=`.

## Kept (89)

Each kept directive in an editable file now carries `<why>. Owner: <package>. Exit: <condition>.`
Biome's syntax (`biome-ignore <category>: <explanation>`), oxlint's `-- <reason>`, ruff's
`# noqa: <code> - <text>` and the coverage `-- <reason> */` forms all accept the trailing
text; each was re-proved live after the rewrite.

- **34 `biome-ignore`**: 10 `noUndeclaredEnvVars` on names declared in turbo.json
  `global.env`/`global.passThroughEnv` (Biome reads only the legacy top-level keys), 4
  `noUndeclaredEnvVars` on Vite's built-in `import.meta.env` keys, 6 in the two goal-packet
  standalone runners (2 `noConsole` file scopes, 4 env reads), the Storybook preview
  `noConsole` notice, 4 `noDangerouslySetInnerHtml` sinks with static or sanitized input,
  3 `noExplicitAny` (the `TUnsafe.Any` escape hatch and two Effect `Field<any>`
  existentials), the generated `format` headers of `biome.identity.jsonc` (its writer
  `Cache.profile.ts` emits the same text) and `schema-org` `vocabulary.ts`, the repo-utils
  docgen re-export order, `label.tsx`, `country-select.tsx` and the Semgrep fixture.
- **24 coverage**: fail-closed guards on schema-generated encoder output in `@beep/html`
  (15), parser and encoder guards in `@beep/rdf` (5), locator guards in `@beep/langextract`
  (2), the adapter-defect arm in `@beep/skill-contract` (1, a 100% threshold package) and the
  production stdin bridge in `@beep/repo-cli` (1). Every one suppresses an uncovered branch,
  line or function in its package suite, and none is reachable through well-typed public
  input; reaching them needs a forged value that breaks a schema or type invariant.
- **23 `noqa`**: the photo-face `cv2` `E402`, and 22 `BLE001` in byte-pinned engines that no
  lint gate runs: 11 in `.claude/skills/ontology-foundational-auditor/scripts/validate_artifacts.py`
  (validator v15, `validator_sha256_12` `fdbcefc9fd70` in the ratified
  `orun-2026-10-06T15:51:01Z` manifest) and 11 in the archived engine copy under
  `runs/history/orun-2026-08-29T08:20:55Z.engine/` (digest-locked replay provenance, excluded
  from Biome and oxlint for that reason). Editing either breaks a recorded digest, so their
  reasons live here, not inline.
- **8 `oxlint-disable-next-line typescript/no-deprecated`**: the `MediaQueryList` jsdom
  mocks in `@beep/oip-web` and `@beep/professional-desktop` must implement the deprecated
  `addListener`/`removeListener` members to satisfy the DOM type.

## #1855 hand-offs (rules unchanged)

1. **Biome cannot see turbo `global.*` env declarations** (10 directives: 9 `@beep/repo-cli`,
   `IpcStdoutGuard.prelude.ts`). `biome.jsonc` already lists five such names in
   `allowedEnvVars`. Frontier: derive that list from turbo.json, or a Biome option that
   reads `futureFlags.globalConfiguration` declarations.
2. **Biome flags Vite built-ins** (`import.meta.env.DEV`, `MODE`, `VITE_*`; 4 directives in
   `@beep/storybook` and `@beep/professional-desktop`). Frontier: allow Vite's built-in keys
   for Vite apps.
3. **No unused-suppression check for `noqa`, oxlint and coverage hints.** Ruff `RUF100` is
   not selected in photo-face (9 stale went unnoticed), oxlint runs without
   `--report-unused-disable-directives` (2 stale chalk disables), and no tool reports a
   coverage hint whose code is covered (`EntityRef.ts`). Frontier: make these checks
   mechanical, as the wave 2a hand-off asked for health and dupes.
4. **Directives for tools that are not run.** 39 `cspell:` and 2 `shellcheck` comments
   accumulated with no enforcing tool. Frontier: a GritQL guard that rejects `cspell:`
   directives (the gate is `typos`).

## Verification

Every command ran alone through `beep-heavy` with stdin from `/dev/null`.

| Gate | Result |
| --- | --- |
| Census after (same command) | 99 matches: 89 real directives + the same 10 non-directive quotes; per kind 35 / 4 / 29 / 23 / 8 / 0, per root packages 43, apps 17, goals 16, `.claude` 11, explorations 11, `biome.identity.jsonc` 1 |
| `bunx turbo run check` for the 25 changed workspace packages other than `@beep/scratchpad` (dependency dists built through `^build`) | 133/133 tasks successful |
| `tsc-rs -p scratchpad/tsconfig.json --noEmit` | 3,031 errors, identical (file, code, message) to the base file content; all inherited (mostly TS6305 unbuilt dists) |
| Coverage, base vs final lcov: `@beep/html` 196, `@beep/rdf` 112, `@beep/langextract` 99, `@beep/skill-contract` 48 (100% thresholds), `@beep/shared-domain` 122 tests | all pass; no file gains an uncovered line, branch or function; `Uri.ts` and `EntityRef.ts` stay at 100% |
| `@beep/repo-cli` full suite with coverage on `Stdin.ts`, hint stripped | 7,510/7,510 pass; lines 78-80 and three functions uncovered, so the hint is live. A first run timed out once in `cache-protocol-runner.test.ts` (`refuses missing-output`, 300 s under coverage load); the file passes alone (20/20) and in the rerun |
| Bun runtime (`bunx --bun vitest run`): `@beep/rdf` 112/112, `@beep/shared-domain` 122/122; repo-cli `cache-profile`, `cache-dispatch`, `cache-command`, `cli-stdin`, `goals-bootstrap-plan` 52/52 on Node and Bun | pass |
| `@beep/oip-web` `oip-web.test.tsx` 45/45, `@beep/professional-desktop` `theme-atoms.test.tsx` 6/6 | pass |
| photo-face `ruff check` + `ruff format --check` (pinned 0.12.12), `ruff --extend-select RUF100`, `beep:test:python` | clean, 0 unused `noqa`, 53 passed / 3 skipped |
| `bun run beep cache profile` | "Identity lint candidate profile is current" (generator and `biome.identity.jsonc` agree) |
| Biome `check` on the changed non-scratchpad files | clean after `biome format --write` on the langextract hint line and two exploration files |
| `oxlint --quiet --disable-nested-config` (root `lint:oxlint` config) on the changed TypeScript files; `lint:deprecated-apis` config on `apps/oip-web` and `apps/professional-desktop` | exit 0 |
| `typos --exclude '.beep/**' --exclude 'scratchpad/**'` (the lefthook spell gate) | exit 0 |
| `bun run beep lint effect-vitest` | introduced=0 resolved=1 |
| `bun run lint:schema-first` | introduced=0, stale_entries=0 |
| `jsdoc:inventory:check` + `jsdoc:ratchet:check` | increased=0 |
| `bun run beep lint schema-catalog` | current |
| `bun run beep laws retired-effect-paths` | findings=0 |
| `bun run beep knowledge refs --check` | 0 live gated observations |
| `bun run beep goals doctor` | no new blocking findings |
| `bun run beep quality fallow audit --base origin/main --check` | exit 0; introduced 0, inherited-adjacent 18 |
| `bun run beep quality package-verify` | `--quick` for the 24 comment-only packages (`@beep/scratchpad` included): all exit 0. Full: `@beep/rdf` exit 0; `@beep/repo-cli` audit runs 7,509/7,510: the one failure is `knowledge-doctor-evaluators` ("reads the same packets ... as the live filesystem"), which compares `HEAD` packet manifests with the working tree and trips on this lane's uncommitted `ops/manifest.json` statusNote; with the base manifest restored temporarily it passes 14/14 (environment-only, as in wave 2a; it clears once committed). Its docgen did not run after the audit stop, so `bun run docgen:local --full` (required because two docgen tooling files changed) ran instead: exit 0 |

No changeset: all 26 changed workspace packages are private, and `@beep/rdf`'s `Uri.ts`
change removes a dead branch without changing behavior or exports.

## Route, model and reversal

Route S39/S41 Claude chain, step 1: a `claude-opus-5-5` child working in the
`rsc-residue-guidance-w2c` worktree; no fallback was taken. Reversal: revert the PR. The
deleted directives and their blank lines return, the reasons return to their base text,
`Uri.ts` regains its default-port ternary and `worker.py` imports numpy after the OpenCV
environment line again.

## Per-directive dispositions (192 matches)

Line numbers are at the base `04a3dc1e23`. Kept reasons are quoted from the base text;
the `Owner`/`Exit` tail added by this wave is in the source line, except for the 22
digest-pinned `noqa` and the Semgrep fixture's `biome-ignore-all`, whose reasons are given here.

| Path | Line (base `04a3dc1e23`) | Kind | Disposition | Reason |
| --- | --- | --- | --- | --- |
| `apps/oip-web/src/app/layout.tsx` | 266 | biome-ignore `lint/security/noDangerouslySetInnerHtml` | kept | static theme controller without user input. Owner and exit in source. |
| `apps/oip-web/src/app/page.tsx` | 137 | biome-ignore `lint/security/noDangerouslySetInnerHtml` | kept | JSON-LD is generated server-side and escaped before injection. Owner and exit in source. |
| `apps/professional-desktop/server/IpcStdoutGuard.prelude.ts` | 42 | biome-ignore `lint/suspicious/noUndeclaredEnvVars` | kept | CHAT_TRANSPORT is declared in turbo.json under global.passThroughEnv. Owner and exit in source. |
| `apps/professional-desktop/src/App.tsx` | 107 | biome-ignore `lint/suspicious/noUndeclaredEnvVars` | kept | Vite injects DEV on import.meta.env. Owner and exit in source. |
| `apps/professional-desktop/src/intake/Intake.inspection.ts` | 42 | biome-ignore `lint/suspicious/noUndeclaredEnvVars` | kept | Vite injects DEV and VITE_* on import.meta.env. Owner and exit in source. |
| `apps/professional-desktop/src/main.tsx` | 16 | biome-ignore `lint/suspicious/noUndeclaredEnvVars` | kept | Vite injects DEV and VITE_* on import.meta.env. Owner and exit in source. |
| `apps/storybook/.storybook/preview.tsx` | 18 | biome-ignore `lint/suspicious/noUndeclaredEnvVars` | kept | Vite injects DEV and MODE on import.meta.env. Owner and exit in source. |
| `apps/storybook/.storybook/preview.tsx` | 26 | biome-ignore `lint/suspicious/noConsole` | kept | dev-only degradation notice; the console is the intended surface. Owner and exit in source. |
| `apps/todox/src/app/layout.tsx` | 102 | biome-ignore `lint/security/noDangerouslySetInnerHtml` | kept | static build-time direction contract, no user input. Owner and exit in source. |
| `biome.identity.jsonc` | 1 | biome-ignore `format` | kept | Generated by beep cache profile; regenerate instead of editing. Owner and exit in source. |
| `goals/lexical-playground-capability-atlas/ops/exercise/collab-peers.ts` | 1 | biome-ignore `lint/suspicious/noConsole` | kept | This standalone exercise prints its terminal result. Owner and exit in source. |
| `goals/lexical-playground-capability-atlas/ops/exercise/collab-peers.ts` | 48 | biome-ignore `lint/suspicious/noUndeclaredEnvVars` | kept | This standalone runner is not a cached Turbo task. Owner and exit in source. |
| `goals/lexical-playground-capability-atlas/ops/exercise/collab-peers.ts` | 428 | biome-ignore `lint/suspicious/noUndeclaredEnvVars` | kept | This standalone runner is not a cached Turbo task. Owner and exit in source. |
| `goals/lexical-playground-capability-atlas/ops/exercise/runner.ts` | 1 | biome-ignore `lint/suspicious/noConsole` | kept | This CLI prints its inventory, progress, and terminal result. Owner and exit in source. |
| `goals/lexical-playground-capability-atlas/ops/exercise/runner.ts` | 35 | biome-ignore `lint/suspicious/noUndeclaredEnvVars` | kept | This standalone runner is not a cached Turbo task. Owner and exit in source. |
| `goals/lexical-playground-capability-atlas/ops/exercise/runner.ts` | 761 | biome-ignore `lint/suspicious/noUndeclaredEnvVars` | kept | This standalone runner is not a cached Turbo task. Owner and exit in source. |
| [goals/repository-simplification-confidence/history/outputs/semgrep/first-party.ts](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/repository-simplification-confidence/history/outputs/semgrep/first-party.ts) | 1 | biome-ignore `lint` | kept | Semgrep rule fixture for .semgrep/first-party.yml; each line is a deliberate positive or negative case. File left byte-identical (immutable #2091 history output whose `ruleid:`/`ok:` lines are Semgrep test annotations, not suppressions). Owner: goals/repository-simplification-confidence. Exit: the fixture moves out of Biome's includes. |
| `packages/ecosystem/effect-drizzle/src/core/Field.ts` | 50 | biome-ignore `lint/suspicious/noExplicitAny` | kept | Effect uses Field<any> at invariant variant-field existential boundaries. Owner and exit in source. |
| `packages/ecosystem/effect-drizzle/src/core/variant.ts` | 150 | biome-ignore `lint/suspicious/noExplicitAny` | kept | Effect uses Field<any> as its invariant variant-field existential. Owner and exit in source. |
| `packages/foundation/modeling/schema-org/src/internal/vocabulary.ts` | 1 | biome-ignore `format` | kept | generated table; tabs keep it inside the byte budget. Owner and exit in source. |
| `packages/foundation/primitive/types/src/TUnsafe.types.ts` | 27 | biome-ignore `lint/suspicious/noExplicitAny` | kept | Let this be the only `any` in the repository. Owner and exit in source. |
| `packages/foundation/ui-system/editor/src/mermaid-view.tsx` | 773 | biome-ignore `lint/security/noDangerouslySetInnerHtml` | kept | DOMPurify sanitizes at the browser parser boundary and the inert SVG policy revalidates the exact bytes injected here. Owner and exit in source. |
| `packages/foundation/ui-system/ui/src/components/country-select.tsx` | 526 | biome-ignore `lint/performance/noDynamicNamespaceImportAccess` | kept | Country options are data-driven from ISO codes. Owner and exit in source. |
| `packages/foundation/ui-system/ui/src/components/label.tsx` | 28 | biome-ignore `lint/a11y/noLabelWithoutControl` | kept | generic component. Owner and exit in source. |
| `packages/tooling/library/repo-utils/src/index.ts` | 9 | biome-ignore `assist/source/organizeImports` | kept | docgen requires individually documented re-export declarations. Owner and exit in source. |
| `packages/tooling/tool/cli/src/commands/Cache/Cache.command.ts` | 167 | biome-ignore `lint/suspicious/noUndeclaredEnvVars` | kept | Declared in turbo.json global.passThroughEnv. Owner and exit in source. |
| `packages/tooling/tool/cli/src/commands/Cache/Cache.profile.ts` | 68 | biome-ignore `format` | not a directive | template string the cache profile writer emits into `biome.identity.jsonc`; reason text updated with its output |
| `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts` | 828 | biome-ignore `lint/suspicious/noUndeclaredEnvVars` | kept | Declared in turbo.json global.passThroughEnv. Owner and exit in source. |
| `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts` | 830 | biome-ignore `lint/suspicious/noUndeclaredEnvVars` | kept | Declared in turbo.json global.passThroughEnv. Owner and exit in source. |
| `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` | 2864 | biome-ignore `lint/suspicious/noUndeclaredEnvVars` | kept | Same declared boundary as the hosted Check lane. Owner and exit in source. |
| `packages/tooling/tool/cli/src/commands/Quality/internal/LaneProofReuse.ts` | 208 | biome-ignore `lint/suspicious/noUndeclaredEnvVars` | kept | Declared in turbo.json global.passThroughEnv. Owner and exit in source. |
| `packages/tooling/tool/cli/src/commands/Quality/internal/LaneProofReuse.ts` | 241 | biome-ignore `lint/suspicious/noUndeclaredEnvVars` | kept | Declared in turbo.json global.passThroughEnv. Owner and exit in source. |
| `packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts` | 435 | biome-ignore `lint/suspicious/noUndeclaredEnvVars` | kept | Declared in turbo.json global.passThroughEnv. Owner and exit in source. |
| `packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts` | 537 | biome-ignore `lint/suspicious/noUndeclaredEnvVars` | kept | Declared in turbo.json global.passThroughEnv. Owner and exit in source. |
| `packages/tooling/tool/cli/test/goals-bootstrap-plan.test.ts` | 58 | biome-ignore `lint/suspicious/noUndeclaredEnvVars` | kept | Local golden regeneration is an explicit uncached test-authoring mode. Owner and exit in source. |
| `scratchpad/effected/cli/Fmt.ts` | 34 | biome-ignore `lint/suspicious/noControlCharactersInRegex` | stale | Biome excludes `scratchpad` (`files.includes` `!scratchpad`); no lane runs Biome on this path; `noControlCharactersInRegex` is also `off` repo-wide |
| `scratchpad/effected/cli/internal/displayWidth.ts` | 6 | biome-ignore `lint/suspicious/noControlCharactersInRegex` | stale | Biome excludes `scratchpad` (`files.includes` `!scratchpad`); no lane runs Biome on this path; `noControlCharactersInRegex` is also `off` repo-wide |
| `scratchpad/effected/cli/ui/TextInput.ts` | 157 | biome-ignore `lint/suspicious/noControlCharactersInRegex` | stale | Biome excludes `scratchpad` (`files.includes` `!scratchpad`); no lane runs Biome on this path; `noControlCharactersInRegex` is also `off` repo-wide |
| `scratchpad/effected/cli/ui/TextInput.ts` | 160 | biome-ignore `lint/suspicious/noControlCharactersInRegex` | stale | Biome excludes `scratchpad` (`files.includes` `!scratchpad`); no lane runs Biome on this path; `noControlCharactersInRegex` is also `off` repo-wide |
| `scratchpad/effected/cli/ui/UiKey.ts` | 89 | biome-ignore `lint/suspicious/noControlCharactersInRegex` | stale | Biome excludes `scratchpad` (`files.includes` `!scratchpad`); no lane runs Biome on this path; `noControlCharactersInRegex` is also `off` repo-wide |
| `scratchpad/effected/cli/ui/testing/CliUiTest.ts` | 410 | biome-ignore `lint/suspicious/noControlCharactersInRegex` | stale | Biome excludes `scratchpad` (`files.includes` `!scratchpad`); no lane runs Biome on this path; `noControlCharactersInRegex` is also `off` repo-wide |
| `scratchpad/effected/cli/ui/testing/CliUiTest.ts` | 607 | biome-ignore `lint/suspicious/noControlCharactersInRegex` | stale | Biome excludes `scratchpad` (`files.includes` `!scratchpad`); no lane runs Biome on this path; `noControlCharactersInRegex` is also `off` repo-wide |
| `scratchpad/effected/cli/ui/testing/CliUiTest.ts` | 611 | biome-ignore `lint/suspicious/noControlCharactersInRegex` | stale | Biome excludes `scratchpad` (`files.includes` `!scratchpad`); no lane runs Biome on this path; `noControlCharactersInRegex` is also `off` repo-wide |
| `scratchpad/effected/cli/ui/testing/CliUiTest.ts` | 615 | biome-ignore `lint/suspicious/noControlCharactersInRegex` | stale | Biome excludes `scratchpad` (`files.includes` `!scratchpad`); no lane runs Biome on this path; `noControlCharactersInRegex` is also `off` repo-wide |
| `scratchpad/effected/package-json/Package.ts` | 440 | biome-ignore `lint/complexity/noArguments` | stale | Biome excludes `scratchpad` (`files.includes` `!scratchpad`); no lane runs Biome on this path |
| `scratchpad/effected/workspaces/SourceBoundary.ts` | 1 | biome-ignore `lint/suspicious/noTemplateCurlyInString` | stale | Biome excludes `scratchpad` (`files.includes` `!scratchpad`); no lane runs Biome on this path |
| `scratchpad/test/cli/CliLinks.test.ts` | 431 | biome-ignore `lint/suspicious/noControlCharactersInRegex` | stale | Biome excludes `scratchpad` (`files.includes` `!scratchpad`); no lane runs Biome on this path; `noControlCharactersInRegex` is also `off` repo-wide |
| `scratchpad/test/cli/Render.ansi.test.ts` | 43 | biome-ignore `lint/suspicious/noControlCharactersInRegex` | stale | Biome excludes `scratchpad` (`files.includes` `!scratchpad`); no lane runs Biome on this path; `noControlCharactersInRegex` is also `off` repo-wide |
| `scratchpad/test/cli/Render.ansi.test.ts` | 526 | biome-ignore `lint/suspicious/noControlCharactersInRegex` | stale | Biome excludes `scratchpad` (`files.includes` `!scratchpad`); no lane runs Biome on this path; `noControlCharactersInRegex` is also `off` repo-wide |
| `scratchpad/test/cli/Render.markdown.oracle.test.ts` | 616 | biome-ignore `lint/suspicious/noControlCharactersInRegex` | stale | Biome excludes `scratchpad` (`files.includes` `!scratchpad`); no lane runs Biome on this path; `noControlCharactersInRegex` is also `off` repo-wide |
| `scratchpad/test/cli/Render.markdown.oracle.test.ts` | 1103 | biome-ignore `lint/suspicious/noControlCharactersInRegex` | stale | Biome excludes `scratchpad` (`files.includes` `!scratchpad`); no lane runs Biome on this path; `noControlCharactersInRegex` is also `off` repo-wide |
| `scratchpad/test/cli/Render.plain.test.ts` | 46 | biome-ignore `lint/suspicious/noControlCharactersInRegex` | stale | Biome excludes `scratchpad` (`files.includes` `!scratchpad`); no lane runs Biome on this path; `noControlCharactersInRegex` is also `off` repo-wide |
| `scratchpad/test/cli/helpers/renderContext.ts` | 8 | biome-ignore `lint/suspicious/noControlCharactersInRegex` | stale | Biome excludes `scratchpad` (`files.includes` `!scratchpad`); no lane runs Biome on this path; `noControlCharactersInRegex` is also `off` repo-wide |
| `scratchpad/test/cli/helpers/renderContext.ts` | 10 | biome-ignore `lint/suspicious/noControlCharactersInRegex` | stale | Biome excludes `scratchpad` (`files.includes` `!scratchpad`); no lane runs Biome on this path; `noControlCharactersInRegex` is also `off` repo-wide |
| `scratchpad/test/cli/helpers/renderContext.ts` | 110 | biome-ignore `lint/suspicious/noControlCharactersInRegex` | stale | Biome excludes `scratchpad` (`files.includes` `!scratchpad`); no lane runs Biome on this path; `noControlCharactersInRegex` is also `off` repo-wide |
| `scratchpad/test/cli/layout.test.ts` | 161 | biome-ignore `lint/suspicious/noControlCharactersInRegex` | stale | Biome excludes `scratchpad` (`files.includes` `!scratchpad`); no lane runs Biome on this path; `noControlCharactersInRegex` is also `off` repo-wide |
| `scratchpad/test/engine/LaunchContext.test.ts` | 1 | biome-ignore `lint/suspicious/noTemplateCurlyInString` | stale | Biome excludes `scratchpad` (`files.includes` `!scratchpad`); no lane runs Biome on this path |
| `scratchpad/test/github-actions/ambientReads.test.ts` | 212 | biome-ignore `lint/suspicious/noTemplateCurlyInString` | stale | Biome excludes `scratchpad` (`files.includes` `!scratchpad`); no lane runs Biome on this path |
| `scratchpad/test/github-actions/ambientReads.test.ts` | 237 | biome-ignore `lint/suspicious/noTemplateCurlyInString` | stale | Biome excludes `scratchpad` (`files.includes` `!scratchpad`); no lane runs Biome on this path |
| `scratchpad/test/workspaces/SourceBoundary.test.ts` | 2 | biome-ignore `lint/suspicious/noTemplateCurlyInString` | stale | Biome excludes `scratchpad` (`files.includes` `!scratchpad`); no lane runs Biome on this path |
| `scratchpad/test/workspaces/e2e/PackedInstall.e2e.test.ts` | 2 | biome-ignore `lint/suspicious/noTemplateCurlyInString` | stale | Biome excludes `scratchpad` (`files.includes` `!scratchpad`); no lane runs Biome on this path |
| `explorations/identity-as-iri/assets/ontology-prototype/src/annotations.ts` | 270 | coverage `istanbul ignore next` | stale | the prototype has no package, test runner or coverage run |
| `explorations/identity-as-iri/assets/ontology-prototype/src/annotations.ts` | 337 | coverage `istanbul ignore next` | stale | the prototype has no package, test runner or coverage run |
| `explorations/identity-as-iri/assets/ontology-prototype/src/model.ts` | 50 | coverage `istanbul ignore else` | stale | the prototype has no package, test runner or coverage run |
| `explorations/identity-as-iri/assets/ontology-prototype/src/model.ts` | 55 | coverage `istanbul ignore next` | stale | the prototype has no package, test runner or coverage run |
| `explorations/identity-as-iri/assets/ontology-prototype/src/references.ts` | 54 | coverage `istanbul ignore next` | stale | the prototype has no package, test runner or coverage run |
| `goals/effected-promotion/history/port-reviews/jsonc/round-1/sol.log` | 1061 | coverage | not a directive | quoted in an immutable effected-promotion review log |
| `goals/effected-promotion/history/port-reviews/jsonc/round-2/sol.log` | 8464 | coverage | not a directive | quoted in an immutable effected-promotion review log |
| `goals/effected-promotion/history/port-reviews/jsonc/round-3/sol.log` | 1520 | coverage | not a directive | quoted in an immutable effected-promotion review log |
| `goals/effected-promotion/history/port-reviews/jsonl/round-1/sol.log` | 3580 | coverage | not a directive | quoted in an immutable effected-promotion review log |
| `goals/effected-promotion/history/port-reviews/jsonl/round-2/sol.log` | 18750 | coverage | not a directive | quoted in an immutable effected-promotion review log |
| `packages/foundation/capability/langextract/src/VerifiedSpan/VerifiedSpan.behavior.ts` | 545 | coverage `istanbul ignore next` | kept | successful location preserves one anchor per non-empty candidate batch. Owner and exit in source. |
| `packages/foundation/capability/langextract/src/VerifiedSpan/VerifiedSpan.behavior.ts` | 594 | coverage `istanbul ignore next` | kept | locator output already proves boundaries and exact slices; retain fail-closed defense. Owner and exit in source. |
| `packages/foundation/modeling/html/src/Html.conformance.ts` | 372 | coverage `istanbul ignore else` | kept | every generated equality and HTML keyword comparison is ASCII-case-insensitive. Owner and exit in source. |
| `packages/foundation/modeling/html/src/Html.conformance.ts` | 517 | coverage `istanbul ignore if` | kept | generation rejects a missing value for every non-present predicate. Owner and exit in source. |
| `packages/foundation/modeling/html/src/Html.conformance.ts` | 522 | coverage `istanbul ignore if` | kept | generation rejects a missing value for every non-present predicate. Owner and exit in source. |
| `packages/foundation/modeling/html/src/Html.conformance.ts` | 674 | coverage `istanbul ignore next` | kept | called only after the input tag has passed the root schema. Owner and exit in source. |
| `packages/foundation/modeling/html/src/Html.conformance.ts` | 681 | coverage `istanbul ignore next` | kept | Input.type is closed and both generated state registries are total. Owner and exit in source. |
| `packages/foundation/modeling/html/src/Html.conformance.ts` | 1746 | coverage `istanbul ignore next` | kept | inspectChild invokes order inspection only after deriving an HtmlTag. Owner and exit in source. |
| `packages/foundation/modeling/html/src/Html.policy.ts` | 705 | coverage `istanbul ignore next` | kept | HtmlRoot encoding emits string values for both generated URL attributes. Owner and exit in source. |
| `packages/foundation/modeling/html/src/Html.policy.ts` | 710 | coverage `istanbul ignore next` | kept | img is the only safe-policy element with a generated src attribute. Owner and exit in source. |
| `packages/foundation/modeling/html/src/Html.policy.ts` | 817 | coverage `istanbul ignore else` | kept | a successful HtmlRoot encoding always yields an object with a string discriminator. Owner and exit in source. |
| `packages/foundation/modeling/html/src/Html.serialize.ts` | 300 | coverage `istanbul ignore else` | kept | every encoded container node has a generated array-valued children field. Owner and exit in source. |
| `packages/foundation/modeling/html/src/Html.serialize.ts` | 302 | coverage `istanbul ignore next` | kept | the HtmlRoot encoder guarantees array-valued children for container nodes. Owner and exit in source. |
| `packages/foundation/modeling/html/src/Html.serialize.ts` | 350 | coverage `istanbul ignore else` | kept | encoded scalar attributes are presence booleans, strings, or numbers. Owner and exit in source. |
| `packages/foundation/modeling/html/src/Html.serialize.ts` | 363 | coverage `istanbul ignore else` | kept | HtmlRoot encoding emits dataset only from its generated record schema. Owner and exit in source. |
| `packages/foundation/modeling/html/src/Html.serialize.ts` | 396 | coverage `istanbul ignore else` | kept | HtmlRoot encoding emits foreign attributes only from its generated record schema. Owner and exit in source. |
| `packages/foundation/modeling/html/src/Html.serialize.ts` | 583 | coverage `istanbul ignore next` | kept | a successful HtmlRoot encoding always yields an object with a string discriminator. Owner and exit in source. |
| `packages/foundation/modeling/rdf/src/Iri.ts` | 212 | coverage `istanbul ignore next` | kept | loop bounds keep the code point lookup in range. Owner and exit in source. |
| `packages/foundation/modeling/rdf/src/Iri.ts` | 245 | coverage `istanbul ignore else` | kept | callers gate required-empty segments before scanning. Owner and exit in source. |
| `packages/foundation/modeling/rdf/src/Iri.ts` | 250 | coverage `istanbul ignore next` | kept | callers gate required-empty segments before scanning. Owner and exit in source. |
| `packages/foundation/modeling/rdf/src/ProvRdf.ts` | 220 | coverage `istanbul ignore next` | kept | Entity's schema admits only finite numeric prov:value inputs. Owner and exit in source. |
| `packages/foundation/modeling/rdf/src/ProvRdf.ts` | 474 | coverage `istanbul ignore next` | kept | every successful record encoder emits its RDF type quad. Owner and exit in source. |
| `packages/foundation/modeling/rdf/src/Uri.ts` | 160 | coverage `istanbul ignore next` | fixed in source | WHATWG URL already strips default ports from `url.host`; the dead normalization ternary is gone and `host` is used directly |
| `packages/foundation/modeling/skill-contract/src/SkillProjection.ts` | 479 | coverage `istanbul ignore next` | kept | Md.render fails only when an adapter throws; a well-typed projection cannot reach it, the arm stays for adapter defects. Owner and exit in source. |
| `packages/shared/domain/src/entity/EntityRef.ts` | 141 | coverage `istanbul ignore next` | stale | the stripped run reports nothing new: tests already reach the mismatch throw (3 hits) |
| `packages/tooling/tool/cli/src/internal/cli/Stdin.ts` | 78 | coverage `istanbul ignore next` | kept | the production stdin bridge: tests always provide a stub, because a real stdin.text() read blocks until the worker's held-open pipe reaches EOF. Owner and exit in source. |
| `apps/professional-desktop/src-tauri/build.rs` | 1 | cspell `cspell:words` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `apps/professional-desktop/src-tauri/src/lib.rs` | 1 | cspell `cspell:ignore` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `apps/professional-desktop/src-tauri/web-extension/youtube_referrer.c` | 1 | cspell `cspell:words` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `apps/professional-desktop/src-tauri/web-extension/youtube_referrer_test.c` | 1 | cspell `cspell:words` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `apps/professional-desktop/src/runtime/Pglite.ts` | 4 | cspell `cspell:words` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `apps/professional-desktop/src/transport/TauriIpcSocket.ts` | 4 | cspell `cspell:words` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `explorations/identity-as-iri/assets/ontology-prototype/src/model.ts` | 16 | cspell `cspell:words` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `explorations/identity-as-iri/assets/ontology-prototype/src/projections/jsonld.ts` | 1 | cspell `cspell:words` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `explorations/identity-as-iri/assets/ontology-prototype/src/projections/jsonld.ts` | 3 | cspell `cspell:words` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `explorations/identity-as-iri/assets/ontology-prototype/src/projections/turtle.ts` | 1 | cspell `cspell:words` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `goals/effected-promotion/history/port-reviews/jsonc/round-1/sol.log` | 12513 | cspell `cspell:ignore` | not a directive | quoted in an immutable effected-promotion review log |
| `goals/effected-promotion/history/port-reviews/jsonc/round-2/sol.log` | 3842 | cspell `cspell:ignore` | not a directive | quoted in an immutable effected-promotion review log |
| `goals/effected-promotion/history/port-reviews/jsonl/round-1/sol.log` | 14966 | cspell `cspell:ignore` | not a directive | quoted in an immutable effected-promotion review log |
| `goals/effected-promotion/history/port-reviews/jsonl/round-2/sol.log` | 27759 | cspell `cspell:ignore` | not a directive | quoted in an immutable effected-promotion review log |
| `infra/Pulumi.beep-ai-metrics-dankserver.yaml` | 13 | cspell `cspell:disable-next-line` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `infra/src/AIMetrics.ts` | 134 | cspell `cspell:ignore` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `packages/agents/server/src/AssistantTurn/AnthropicTurnCodec.ts` | 37 | cspell `cspell:words` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.fixtures.ts` | 36 | cspell `cspell:words` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `packages/foundation/modeling/html/src/Html.foreign.ts` | 86 | cspell `cspell:words` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `packages/foundation/modeling/lexical/src/Lexical.model.ts` | 18 | cspell `cspell:word` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `packages/foundation/modeling/lexical/src/Lexical.normalize.ts` | 15 | cspell `cspell:word` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `packages/foundation/modeling/rdf/src/Iri.ts` | 15 | cspell `cspell:words` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `packages/foundation/modeling/schema/src/AtURI.ts` | 28 | cspell `cspell:words` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `packages/foundation/modeling/utils/src/Function.ts` | 6 | cspell `cspell:words` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `packages/foundation/ui-system/editor/src/mermaid-view.tsx` | 765 | cspell `cspell:ignore` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `packages/foundation/ui-system/editor/src/nodes.ts` | 8 | cspell `cspell:ignore` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `packages/foundation/ui-system/ui/src/components/blocks/editor-00/nodes.ts` | 7 | cspell `cspell:ignore` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `packages/foundation/ui-system/ui/src/components/editor/themes/editor-theme.ts` | 7 | cspell `cspell:ignore` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `packages/tooling/library/repo-utils/src/JSDoc/JSDoc.ts` | 12 | cspell `cspell:ignore` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `packages/tooling/library/repo-utils/src/JSDoc/models/ASTDerivability.model.ts` | 10 | cspell `cspell:ignore` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `packages/tooling/library/repo-utils/src/JSDoc/models/JSDocTagDefinition.model.ts` | 16 | cspell `cspell:ignore` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `packages/tooling/library/repo-utils/src/JSDoc/models/index.ts` | 8 | cspell `cspell:ignore` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `packages/tooling/library/repo-utils/src/index.ts` | 8 | cspell `cspell:ignore` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `packages/tooling/library/repo-utils/src/schemas/JSDocCategories.ts` | 19 | cspell `cspell:ignore` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `packages/tooling/policy-pack/repo-configs/src/next/models/ConfigPrimitives.schema.ts` | 7 | cspell `cspell:words` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `packages/tooling/policy-pack/repo-configs/src/next/models/ExperimentalConfig.schema.ts` | 7 | cspell `cspell:words` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `packages/tooling/tool/cli/src/commands/AIMetrics/internal/Programs.ts` | 142 | cspell `cspell:words` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `packages/tooling/tool/cli/src/commands/Docgen/internal/QualityWorkerRunpodEval.ts` | 353 | cspell `cspell:ignore` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `packages/tooling/tool/cli/src/commands/Files/internal/ImageAudit.schemas.ts` | 16 | cspell `cspell:ignore` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `packages/tooling/tool/cli/src/commands/Files/internal/ImageCuration.ts` | 62 | cspell `cspell:ignore` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `packages/tooling/tool/cli/src/commands/Skills/Skills.command.ts` | 81 | cspell `cspell:ignore` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `packages/tooling/tool/cli/src/commands/Yeet/internal/Closeout.ts` | 7 | cspell `cspell:ignore` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `packages/tooling/tool/docgen/src/Configuration.ts` | 40 | cspell `cspell:ignore` | stale | cspell is not installed, configured or run; the spell gate is `typos` (`_typos.toml`) |
| `.claude/skills/ontology-foundational-auditor/scripts/validate_artifacts.py` | 1459 | noqa `BLE001` | kept | validator v15 bytes are pinned as `validator_sha256_12` `fdbcefc9fd70` by the ratified `orun-2026-10-06T15:51:01Z` manifest; no lint gate runs it |
| `.claude/skills/ontology-foundational-auditor/scripts/validate_artifacts.py` | 1744 | noqa `BLE001` | kept | validator v15 bytes are pinned as `validator_sha256_12` `fdbcefc9fd70` by the ratified `orun-2026-10-06T15:51:01Z` manifest; no lint gate runs it |
| `.claude/skills/ontology-foundational-auditor/scripts/validate_artifacts.py` | 1799 | noqa `BLE001` | kept | validator v15 bytes are pinned as `validator_sha256_12` `fdbcefc9fd70` by the ratified `orun-2026-10-06T15:51:01Z` manifest; no lint gate runs it |
| `.claude/skills/ontology-foundational-auditor/scripts/validate_artifacts.py` | 1840 | noqa `BLE001` | kept | validator v15 bytes are pinned as `validator_sha256_12` `fdbcefc9fd70` by the ratified `orun-2026-10-06T15:51:01Z` manifest; no lint gate runs it |
| `.claude/skills/ontology-foundational-auditor/scripts/validate_artifacts.py` | 1857 | noqa `BLE001` | kept | validator v15 bytes are pinned as `validator_sha256_12` `fdbcefc9fd70` by the ratified `orun-2026-10-06T15:51:01Z` manifest; no lint gate runs it |
| `.claude/skills/ontology-foundational-auditor/scripts/validate_artifacts.py` | 1999 | noqa `BLE001` | kept | validator v15 bytes are pinned as `validator_sha256_12` `fdbcefc9fd70` by the ratified `orun-2026-10-06T15:51:01Z` manifest; no lint gate runs it |
| `.claude/skills/ontology-foundational-auditor/scripts/validate_artifacts.py` | 2064 | noqa `BLE001` | kept | validator v15 bytes are pinned as `validator_sha256_12` `fdbcefc9fd70` by the ratified `orun-2026-10-06T15:51:01Z` manifest; no lint gate runs it |
| `.claude/skills/ontology-foundational-auditor/scripts/validate_artifacts.py` | 2114 | noqa `BLE001` | kept | validator v15 bytes are pinned as `validator_sha256_12` `fdbcefc9fd70` by the ratified `orun-2026-10-06T15:51:01Z` manifest; no lint gate runs it |
| `.claude/skills/ontology-foundational-auditor/scripts/validate_artifacts.py` | 2344 | noqa `BLE001` | kept | validator v15 bytes are pinned as `validator_sha256_12` `fdbcefc9fd70` by the ratified `orun-2026-10-06T15:51:01Z` manifest; no lint gate runs it |
| `.claude/skills/ontology-foundational-auditor/scripts/validate_artifacts.py` | 2452 | noqa `BLE001` | kept | validator v15 bytes are pinned as `validator_sha256_12` `fdbcefc9fd70` by the ratified `orun-2026-10-06T15:51:01Z` manifest; no lint gate runs it |
| `.claude/skills/ontology-foundational-auditor/scripts/validate_artifacts.py` | 3588 | noqa `BLE001` | kept | validator v15 bytes are pinned as `validator_sha256_12` `fdbcefc9fd70` by the ratified `orun-2026-10-06T15:51:01Z` manifest; no lint gate runs it |
| `explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/test_run4_proof_ledger.py` | 1207 | noqa `E731` | stale | no Python lint gate covers explorations; the scripts are not digest-pinned |
| `explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/test_run4_proof_ledger.py` | 1602 | noqa `E731` | stale | no Python lint gate covers explorations; the scripts are not digest-pinned |
| `explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/test_run4_proof_ledger.py` | 1608 | noqa `E731` | stale | no Python lint gate covers explorations; the scripts are not digest-pinned |
| `explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/runs/history/orun-2026-08-29T08:20:55Z.engine/ontology-foundational-auditor/scripts/validate_artifacts.py` | 1429 | noqa `BLE001` | kept | archived judging engine, byte-identical to the digest the run manifest pins; no lint gate runs it |
| `explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/runs/history/orun-2026-08-29T08:20:55Z.engine/ontology-foundational-auditor/scripts/validate_artifacts.py` | 1702 | noqa `BLE001` | kept | archived judging engine, byte-identical to the digest the run manifest pins; no lint gate runs it |
| `explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/runs/history/orun-2026-08-29T08:20:55Z.engine/ontology-foundational-auditor/scripts/validate_artifacts.py` | 1757 | noqa `BLE001` | kept | archived judging engine, byte-identical to the digest the run manifest pins; no lint gate runs it |
| `explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/runs/history/orun-2026-08-29T08:20:55Z.engine/ontology-foundational-auditor/scripts/validate_artifacts.py` | 1798 | noqa `BLE001` | kept | archived judging engine, byte-identical to the digest the run manifest pins; no lint gate runs it |
| `explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/runs/history/orun-2026-08-29T08:20:55Z.engine/ontology-foundational-auditor/scripts/validate_artifacts.py` | 1815 | noqa `BLE001` | kept | archived judging engine, byte-identical to the digest the run manifest pins; no lint gate runs it |
| `explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/runs/history/orun-2026-08-29T08:20:55Z.engine/ontology-foundational-auditor/scripts/validate_artifacts.py` | 1957 | noqa `BLE001` | kept | archived judging engine, byte-identical to the digest the run manifest pins; no lint gate runs it |
| `explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/runs/history/orun-2026-08-29T08:20:55Z.engine/ontology-foundational-auditor/scripts/validate_artifacts.py` | 2022 | noqa `BLE001` | kept | archived judging engine, byte-identical to the digest the run manifest pins; no lint gate runs it |
| `explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/runs/history/orun-2026-08-29T08:20:55Z.engine/ontology-foundational-auditor/scripts/validate_artifacts.py` | 2047 | noqa `BLE001` | kept | archived judging engine, byte-identical to the digest the run manifest pins; no lint gate runs it |
| `explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/runs/history/orun-2026-08-29T08:20:55Z.engine/ontology-foundational-auditor/scripts/validate_artifacts.py` | 2279 | noqa `BLE001` | kept | archived judging engine, byte-identical to the digest the run manifest pins; no lint gate runs it |
| `explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/runs/history/orun-2026-08-29T08:20:55Z.engine/ontology-foundational-auditor/scripts/validate_artifacts.py` | 2387 | noqa `BLE001` | kept | archived judging engine, byte-identical to the digest the run manifest pins; no lint gate runs it |
| `explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/runs/history/orun-2026-08-29T08:20:55Z.engine/ontology-foundational-auditor/scripts/validate_artifacts.py` | 3402 | noqa `BLE001` | kept | archived judging engine, byte-identical to the digest the run manifest pins; no lint gate runs it |
| `explorations/beep-ci-operational-ontology/research/scripts/run_cq_suite.py` | 215 | noqa `BLE001` | stale | no Python lint gate covers explorations; the scripts are not digest-pinned |
| `explorations/beep-ci-operational-ontology/research/scripts/validate_packet.py` | 222 | noqa `BLE001` | stale | no Python lint gate covers explorations; the scripts are not digest-pinned |
| `explorations/beep-ci-operational-ontology/research/scripts/validate_packet.py` | 903 | noqa `BLE001` | stale | no Python lint gate covers explorations; the scripts are not digest-pinned |
| `explorations/beep-ci-operational-ontology/research/scripts/validate_packet.py` | 916 | noqa `BLE001` | stale | no Python lint gate covers explorations; the scripts are not digest-pinned |
| `packages/tooling/tool/cli/python/photo-face/beep_photo_face/backends/adaface_kprpe.py` | 128 | noqa `BLE001` | stale | ruff 0.12.12 (the photo-face pin, default rule set) does not enable BLE001; RUF100 reports it unused |
| `packages/tooling/tool/cli/python/photo-face/beep_photo_face/backends/adaface_kprpe.py` | 161 | noqa `BLE001` | stale | ruff 0.12.12 (the photo-face pin, default rule set) does not enable BLE001; RUF100 reports it unused |
| `packages/tooling/tool/cli/python/photo-face/beep_photo_face/backends/adaface_kprpe.py` | 192 | noqa `BLE001` | stale | ruff 0.12.12 (the photo-face pin, default rule set) does not enable BLE001; RUF100 reports it unused |
| `packages/tooling/tool/cli/python/photo-face/beep_photo_face/backends/adaface_kprpe.py` | 637 | noqa `BLE001` | stale | ruff 0.12.12 (the photo-face pin, default rule set) does not enable BLE001; RUF100 reports it unused |
| `packages/tooling/tool/cli/python/photo-face/beep_photo_face/backends/adaface_kprpe.py` | 668 | noqa `BLE001` | stale | ruff 0.12.12 (the photo-face pin, default rule set) does not enable BLE001; RUF100 reports it unused |
| `packages/tooling/tool/cli/python/photo-face/beep_photo_face/backends/adaface_kprpe.py` | 778 | noqa `BLE001` | stale | ruff 0.12.12 (the photo-face pin, default rule set) does not enable BLE001; RUF100 reports it unused |
| `packages/tooling/tool/cli/python/photo-face/beep_photo_face/model_store.py` | 212 | noqa `S310` | stale | ruff 0.12.12 (the photo-face pin, default rule set) does not enable S310; RUF100 reports it unused |
| `packages/tooling/tool/cli/python/photo-face/beep_photo_face/worker.py` | 58 | noqa `E402` | kept | # noqa: E402 - OpenCV reads its pixel limit at import time. Owner and exit in source. |
| `packages/tooling/tool/cli/python/photo-face/beep_photo_face/worker.py` | 59 | noqa `E402` | fixed in source | `import numpy as np` moved to the third-party import block; it never depended on the OpenCV environment |
| `packages/tooling/tool/cli/python/photo-face/beep_photo_face/worker.py` | 490 | noqa `S310` | stale | ruff 0.12.12 (the photo-face pin, default rule set) does not enable S310; RUF100 reports it unused |
| `packages/tooling/tool/cli/python/photo-face/beep_photo_face/worker.py` | 1139 | noqa `BLE001` | stale | ruff 0.12.12 (the photo-face pin, default rule set) does not enable BLE001; RUF100 reports it unused |
| `apps/oip-web/test/oip-web.test.tsx` | 148 | oxlint-disable `typescript/no-deprecated` | kept | MediaQueryList compatibility mock must implement its legacy DOM members. Owner and exit in source. |
| `apps/oip-web/test/oip-web.test.tsx` | 155 | oxlint-disable `typescript/no-deprecated` | kept | MediaQueryList compatibility mock must implement its legacy DOM members. Owner and exit in source. |
| `apps/oip-web/test/setup.dom.ts` | 60 | oxlint-disable `typescript/no-deprecated` | kept | MediaQueryList compatibility mock must implement its legacy DOM members. Owner and exit in source. |
| `apps/oip-web/test/setup.dom.ts` | 62 | oxlint-disable `typescript/no-deprecated` | kept | MediaQueryList compatibility mock must implement its legacy DOM members. Owner and exit in source. |
| `apps/professional-desktop/test/setup.dom.ts` | 21 | oxlint-disable `typescript/no-deprecated` | kept | MediaQueryList compatibility mock must implement its legacy DOM members. Owner and exit in source. |
| `apps/professional-desktop/test/setup.dom.ts` | 23 | oxlint-disable `typescript/no-deprecated` | kept | MediaQueryList compatibility mock must implement its legacy DOM members. Owner and exit in source. |
| `apps/professional-desktop/test/theme-atoms.test.tsx` | 142 | oxlint-disable `typescript/no-deprecated` | kept | MediaQueryList compatibility mock must implement its legacy DOM members. Owner and exit in source. |
| `apps/professional-desktop/test/theme-atoms.test.tsx` | 144 | oxlint-disable `typescript/no-deprecated` | kept | MediaQueryList compatibility mock must implement its legacy DOM members. Owner and exit in source. |
| `packages/foundation/capability/chalk/src/Chalk.browser.ts` | 53 | oxlint-disable `typescript-eslint/no-unsafe-declaration-merging` | stale | no oxlint config enables `no-unsafe-declaration-merging`; the root lane enables no native rules |
| `packages/foundation/capability/chalk/src/Chalk.ts` | 57 | oxlint-disable `typescript-eslint/no-unsafe-declaration-merging` | stale | no oxlint config enables `no-unsafe-declaration-merging`; the root lane enables no native rules |
| `.cursor/hooks/deny-shell.sh` | 29 | shellcheck `SC2086` | stale | shellcheck is not installed or run by any hook or workflow |
| `scripts/cloud/bootstrap.sh` | 240 | shellcheck `SC1091` | stale | shellcheck is not installed or run by any hook or workflow |

## Review round 1 (#2124)

The first push edited [goals/repository-simplification-confidence/history/outputs/semgrep/first-party.ts](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/repository-simplification-confidence/history/outputs/semgrep/first-party.ts) to add an `Owner`/`Exit` tail to its `biome-ignore-all`. That file is the #2091 Semgrep rule fixture. The SAST lane passes changed files to Semgrep as explicit paths, which bypasses `.semgrepignore` (`goals/**/history/outputs/`), so the fixture's deliberate `eval`, `exec` and private-key cases fired as blocking findings.

The file is restored byte for byte to main. Its `biome-ignore-all` stays counted as kept, with the reason recorded only in the table above, the same treatment as the digest-pinned `noqa`. The fixture's `ruleid:` and `ok:` lines are Semgrep test annotations, not suppressions; they were never in this census, and future censuses must leave them out too. Counts are unchanged: 182 real directives, 2 fixed, 91 stale, 89 kept, of which 66 carry `Owner`/`Exit` in source and 23 are recorded only here. The SAST lane gap is the orchestrator's follow-up.

## Review round 2 (#2124): line numbers at head

The disposition table gives lines at the base `04a3dc1e23`. Stale rows exist only there.
I checked every row against base: all 192 path:line pairs hold the directive they name.
Checking the kept and fixed rows against this PR's head, nine kept directives sit on a
different line. They moved because of this wave's own edits (a reason tail reflowed onto a
second line, or the `Uri.ts` branch deleted above them) or the #2114 merge:

| Path | Base line | Head line |
| --- | --- | --- |
| `packages/foundation/ui-system/editor/src/mermaid-view.tsx` | 773 | 772 |
| `packages/tooling/library/repo-utils/src/index.ts` | 9 | 8 |
| `packages/foundation/capability/langextract/src/VerifiedSpan/VerifiedSpan.behavior.ts` | 545 | 546 |
| `packages/foundation/capability/langextract/src/VerifiedSpan/VerifiedSpan.behavior.ts` | 594 | 595 |
| `packages/foundation/modeling/rdf/src/Iri.ts` | 212 | 210 |
| `packages/foundation/modeling/rdf/src/Iri.ts` | 245 | 243 |
| `packages/foundation/modeling/rdf/src/Iri.ts` | 250 | 248 |
| `packages/foundation/modeling/skill-contract/src/SkillProjection.ts` | 479 | 472 |
| `packages/tooling/tool/cli/python/photo-face/beep_photo_face/worker.py` | 58 | 60 |

The two fixed rows have no head line, since their directive is gone: `Uri.ts:160`
(branch deleted) and `worker.py:59` (`E402` no longer needed).
