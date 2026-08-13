# Deprecated-API engine swap report

## 1. TL;DR

**Primary recommendation: replace the 24-process ESLint shard loop with one dedicated
repo-wide
Oxlint 1.78 type-aware invocation backed by `oxlint-tsgolint`, enabling only
`typescript/no-deprecated`.** Do not first spend a cycle trying to point
`typescript-eslint` project service at `tsconfig.check.json`: project service cannot select a
nonstandard config for ordinary in-project files, so that idea is not a small config change.

Projected hosted `Lint Policy` job wall: **~9.0 min**, down from ~19.8 min, saving
**~10.8 min (54%)**. This is a budgeted projection, not a measured Oxlint full-repo result:

- measured job: 66 s setup + 1,124 s policy = 1,190 s;
- measured non-deprecation step work: 564 s; target Oxlint scan: 90 s;
- two-worker compute model: `(564 + 90) / 2 = 327 s`;
- conservatively retain the observed `1,124 - 975 = 149 s` scheduling/orchestration tail;
- projected job: `66 + 327 + 149 = 542 s = 9.0 min`.

Sensitivity: a 30-150 s Oxlint scan projects **8.5-9.5 min** by the same model. Make
**150 s cold full-repo wall** the go/no-go threshold. The engine swap should not land until a
shadow parity corpus proves coverage of out-of-project scripts/fixtures and the intentional
deprecation suppressions.

## 2. Evidence

### Current cost and architecture

- The shared hosted measurement is 1,124 s for `beep lint policy`, including 975.199 s for
  `lint:deprecated-apis`; all other step work sums to about 564 s
  (`BRIEF.md:8-45`). The live lane uses two concurrent policy steps
  (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:119-124,1573-1577`).
- The hosted matrix puts `lint-policy` on `beep-ec2-heavy`, disables Turbo, and gives it 50
  minutes (`.github/workflows/check.yml:63-68`). The separate Docgen lane exists at
  `.github/workflows/check.yml:105-110`.
- The deprecated gate has 24 path shards
  (`packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts:49-74`). Each shard launches
  ESLint with one shared cache path, then the command waits for every shard sequentially
  (`packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts:461-503`).
- The selected ESLint profile is exactly one typed rule,
  `@typescript-eslint/no-deprecated`, over app/package/infra TypeScript sources
  (`packages/tooling/policy-pack/repo-configs/src/eslint/DeprecatedApisESLintConfig.ts:18-44,90-132`).
  Its project-service escape hatch allows up to 160 default-project files and literally warns
  that this slows linting (`DeprecatedApisESLintConfig.ts:103-125`).
- CI restores the Bun package cache and optionally `.turbo/cache`, not the ESLint cache path
  (`.github/actions/setup-monorepo-ci/action.yml:43-59,73-87`).

### Baseline shard

Read-only cold-style reference (cache explicitly disabled):

```text
env BEEP_ESLINT_PROFILE=deprecated-apis NODE_OPTIONS=--max-old-space-size=8192 \
  ./node_modules/.bin/eslint --no-cache --config eslint.config.mjs apps/architecture-lab-proof
exit 0; wall 13.56 s; max RSS 2,882,260 KiB
```

`apps/architecture-lab-proof` is the first configured shard
(`packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts:49-52`) and currently contains
three non-generated `.ts`/`.tsx` files. Even this tiny shard pays a 13.56 s typed-program
startup, so 24 sequential ESLint processes have a startup-only lower-bound signal of about
`24 * 13.56 = 325 s`; this is a reference, not a linear estimate of the 975 s full gate.

### Oxlint / tsgolint feasibility

- Oxlint **is installed** at 1.78.0 (`package.json:229`,
  `node_modules/oxlint/package.json:1-4`). Its CLI exposes `--type-aware`, `--type-check`,
  `--tsconfig`, and `--threads` (`./node_modules/.bin/oxlint --help`, observed 2026-08-13).
- The type-aware backend is **not installed**: `node_modules/oxlint-tsgolint` and
  `node_modules/.bin/tsgolint` are absent. Running the direct binary with
  `--type-aware -D typescript/no-deprecated` exits with “Failed to find tsgolint executable.”
  Oxlint declares `oxlint-tsgolint >=7.0.2001` as its optional peer
  (`node_modules/oxlint/package.json:48-57`), so it is installable as an ordinary dev
  dependency rather than requiring a repository-built tool.
- The installed 1.78 schema contains `typescript/no-deprecated`, including its `allow`
  option (`node_modules/oxlint/configuration_schema.json:7842-7860,13979-13992`), and says
  type-aware mode requires `oxlint-tsgolint`
  (`node_modules/oxlint/configuration_schema.json:17019-17027`). Upstream documents the rule
  as type-aware and added in v1.26.0: [Oxlint `typescript/no-deprecated`](https://oxc.rs/docs/guide/usage/linter/rules/typescript/no-deprecated.html).
- Upstream documents a split architecture: Oxlint discovers files/config and tsgolint builds
  TypeScript programs and runs typed rules, with monorepo workers and per-program debug output:
  [Oxlint type-aware linting](https://oxc.rs/docs/guide/usage/linter/type-aware.html).
- The repo already executes the TS 7.0.2 Effect tsgo shim (`./node_modules/.bin/tsgo
  --version`, observed 2026-08-13), so tsgolint's TS-7 basis is directionally aligned. It is
  still a distinct compiler build and needs parity proof.
- The existing root Oxlint config cannot be reused unchanged: it disables native categories,
  loads the custom Beep JS plugin, and globally ignores `**/scripts/**`
  (`.oxlintrc.json:1-21,22-35`). The deprecated ESLint profile intentionally includes several
  scripts and fixtures through `allowDefaultProject`
  (`DeprecatedApisESLintConfig.ts:103-122`). Use a dedicated config.

### Flat source-mode typescript-eslint

- PR #668's live pattern is real: `tsconfig.check.json` extends the package config, removes
  references, disables composite/declaration/incremental output, and sets `noEmit`
  (`packages/epistemic/server/tsconfig.check.json:1-12`). The package invokes it with
  `tsgo -p`, not build mode (`packages/epistemic/server/package.json:15-19`).
- Its measured representative win was 23.28 GiB / 22.8 s to 4.21 GiB / 3.3 s; the document
  attributes the delta to source resolution instead of serialized declaration types
  (`goals/ci-fleet-endgame/research/ci-graph-check-baseline.md:134-176`).
- That exact technique does **not** plug into the current project service. Upstream says
  project service uses the nearest file literally named `tsconfig.json`; `defaultProject`
  affects only exceptional `allowDefaultProject` files. Nonstandard lint configs require
  switching to `parserOptions.project`: [typescript-eslint typed-linting FAQ](https://typescript-eslint.io/troubleshooting/typed-linting/),
  [parser options](https://typescript-eslint.io/packages/parser/).
- Therefore the feasible ESLint variant is a different design: generate/maintain flat
  source-mode lint configs and use `parserOptions.project` (or pre-created `Program`s), then
  benchmark one ESLint process over selected projects. It may reduce declaration inflation,
  but it retains ESLint/ESTree overhead and loses project-service/editor parity. Estimate:
  **1-2 implementation days plus config maintenance**, with an uncertain **5-10 min gate**;
  keep it as fallback evidence, not the primary path.

### Custom scanner and other engines

- The CLI already has a small semantic ts-morph factory accepting a tsconfig and source globs
  (`packages/tooling/tool/cli/src/internal/tsmorph/ProjectFactory.ts:8-41`), and repo-utils has
  a read-only project service, but its current diagnostics method collects pre-emit diagnostics,
  not suggestion diagnostics (`packages/tooling/library/repo-utils/src/TSMorph/TSMorph.service.ts:1160-1172`).
- The installed ts-morph surface exposes `getSuggestionDiagnostics`
  (`node_modules/ts-morph/lib/ts-morph.d.ts:9301`). A temporary in-memory probe returned TS
  suggestion codes 6385/6387 for a deprecated import and call, proving the compiler can supply
  raw signals. Turning those into ESLint parity still requires project discovery, filtering
  duplicate import/call reports, alias/overload/JSX/computed-property behavior, ignores,
  suppressions, stable diagnostics, and fixtures. The current upstream rule visibly contains
  those cases (`node_modules/@typescript-eslint/eslint-plugin/dist/rules/no-deprecated.js:79-108,220-268,275-393`).
  Estimate: **3-5 days**, then likely **2-8 min** until measured. It duplicates functionality
  already delivered by tsgolint, so the payoff/risk ratio is worse.
- Plain `tsgo` is not a scanner option today: its CLI exposes compiler diagnostics but no
  deprecation/suggestion flag (`./node_modules/.bin/tsgo --help --all`, observed 2026-08-13).
- Biome 2.5.6 is the only other credible fast engine already present. Its
  `noDeprecatedImports` rule is already an error (`biome.jsonc:163-169`), but it guards
  deprecated **imports**, not arbitrary member/call/type uses. The corpus itself demonstrates
  the distinction by separately suppressing the Biome import and ESLint type-use findings
  (`packages/foundation/modeling/identity/test/shape-stable.test.ts:6-23`). It is useful
  defense-in-depth, not semantic replacement.

## 3. Implementation sketch

1. Add `oxlint-tsgolint` at a version satisfying Oxlint's `>=7.0.2001` peer and lock it. Keep
   `oxlint` pinned at 1.78.0 for the first migration so only one variable changes.
2. Add a dedicated JSONC config, e.g. `.oxlintrc.deprecated-apis.jsonc`: all categories off;
   TypeScript plugin enabled; `options.typeAware: true`;
   `typescript/no-deprecated: error`; copy the current source scope and ignores exactly.
3. Replace `DEPRECATED_API_LINT_SHARDS` and `runDeprecatedApiLintShard` with one direct local
   invocation over `apps packages infra`. Do not use `bunx`; invoke
   `./node_modules/.bin/oxlint -c .oxlintrc.deprecated-apis.jsonc --type-aware` and retain a
   clear success/failure message.
4. Before cutover, add canary fixtures for direct calls, member access, computed members,
   overload-specific deprecation, aliases/re-exports, JSX, type-only usage, and an
   out-of-project script. Run old and new engines over the same fixture/corpus and require the
   same normalized `(file,line,symbol)` set, allowing only reviewed diagnostic-text differences.
5. Migrate the intentional `@typescript-eslint/no-deprecated` directives (examples at
   `packages/foundation/modeling/md/test/Md.test.ts:91-96`) to Oxlint directives or a narrowly
   equivalent `allow` policy. Verify that every currently `allowDefaultProject` path is assigned
   to a tsgolint program; unmatched typed files are a hard failure, not a warning.
6. Capture cold `/usr/bin/time -v` evidence on the heavy runner. Land only if full scan is
   <=150 s, max RSS fits concurrent policy work, parity is green, and full `beep lint policy`
   is below 10 min. Remove the ESLint deprecated profile after the shadow period.

## 4. Risks / correctness tradeoffs

- **Unmatched files are the largest risk.** Oxlint type-aware mode auto-discovers normal
  tsconfigs; the current ESLint config explicitly forces scripts/fixtures through a default
  project. Silent typed-rule noncoverage would be worse than the current slow gate.
- **Rule parity is plausible, not assumed.** Both rules target `@deprecated`, and Oxlint claims
  option compatibility, but aliases, overload signatures, JSX, computed keys, and re-exports
  need corpus tests.
- **Suppression syntax/name changes.** Existing ESLint directives name
  `@typescript-eslint/no-deprecated`; Oxlint's rule is `typescript/no-deprecated`. Review each
  intentional exception rather than globally accepting old directives.
- **Compiler drift.** tsgolint uses its bundled TypeScript-go; ESLint currently uses the
  installed TypeScript API. The repo's tsgo version reduces, but does not eliminate, semantic
  drift.
- **Projection uncertainty.** No candidate full scan was possible read-only because the peer is
  absent. The 90 s estimate is an acceptance budget supported by single-process architecture,
  not a benchmark. The <=150 s gate protects the single-digit objective.

## 5. Open questions

1. How many of the current 3,779 non-generated TypeScript files does tsgolint report as
   unmatched, and can all required exceptions be covered without broadening canonical tsconfigs?
2. Does Oxlint 1.78 exactly honor the needed ESLint disable comments, or should all intentional
   exceptions become native Oxlint directives/config `allow` entries?
3. What are cold wall/RSS and normalized findings for old vs new engines on the heavy runner?
4. Does the Effect tsgo fork's language-service behavior materially differ from tsgolint's
   bundled upstream TS-go on Effect-heavy inferred types?
5. If the scan exceeds 150 s, does one carefully designed root/source-mode config reduce
   tsgolint program duplication, or does auto-discovery intentionally ignore `--tsconfig` for
   typed rules? Upstream currently cautions that typed mode always auto-discovers projects.
