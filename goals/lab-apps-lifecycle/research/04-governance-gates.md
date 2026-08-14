# Lane 4 (rerun): governance gates × locked lab-app law posture

Locked posture (the SPEC.md Decision Log): **CODE LAWS FULL**, **CEREMONY EXEMPT BY CONSTRUCTION** via `apps/labs/**` path scoping — not per-package waivers. Lab CI lanes are not required-check blockers for unrelated PRs. Zero-root-churn after the one-time glob PR.

Scratchpad is the existing **total-exclude** precedent. Labs must **not** copy it for code laws. They **should** copy its *mechanism* (path glob / workspace ignore) for ceremony gates only.

---

## 0. Scratchpad exclusion — HOW it works today (copy the pattern, not the scope)

| Surface | Exact entry | What it does |
| --- | --- | --- |
| Biome | `biome.jsonc:47` `"!scratchpad"` inside `files.includes` | Entire tree dropped from format/lint |
| Knip ignore | `knip.jsonc:73` `"scratchpad/**"` | Files never analyzed |
| Knip workspaces | `knip.jsonc:184-187` `ignoreWorkspaces: ["scratchpad", ...]` | Workspace member stays in install graph, out of knip package graph |
| Lefthook biome/typos | `lefthook.yml:6,17-18` `exclude: "...\|scratchpad/**"` | Pre-commit skips scratchpad |
| Fallow | `.fallowrc.jsonc:73` `"scratchpad/**"` in `ignorePatterns` | Dead-code/audit ignore |
| Syncpack | `syncpack.config.ts:7` `"scratchpad/package.json"` | Version-policy ignore |
| Changesets | `.changeset/config.json:13` `"ignore": [..., "@beep/scratchpad"]` | Name-list ignore, **not a path glob** |
| Workspaces | `package.json:435` `"scratchpad"` **is** a workspace | Install/TS trials still work |
| tsconfig | `tsconfig.packages.json:397` `"path": "scratchpad"` | Still project-referenced |

Labs: keep workspace membership + typecheck/lint. Reuse the **glob-ignore** shape (`apps/labs/**`) on ceremony surfaces only.

---

## 1. GATE × MECHANISM TABLE

Legend for **posture**: `LAW` = enforce on labs; `CEREMONY` = path-exempt by construction; `ORTHO` = orthogonal (commits/secrets/nix; still run, no labs concept).

### 1.1 New-package first-CI / closeout gates

There is no single `new-package` job. A new workspace member trips a **bundle** that agents keep rediscovering:

| Gate | Enforcement | Path inclusion today | New-package behavior |
| --- | --- | --- | --- |
| Workspace membership | `package.json:433-537` `workspaces` | Apps are **enumerated** (`apps/oip-web`, `apps/professional-desktop`, `apps/storybook`, `apps/architecture-lab-proof`, `apps/practice-kg-mcp`) — **no** `apps/*` glob | `create-package` appends a workspace entry **only if no existing glob covers the path** (lane 2: `CreatePackage.command.ts` `ensureRootWorkspaceEntry`) |
| tsconfig project refs | `tsconfig.packages.json:10-22` one `{ "path": "apps/<name>" }` per app | Enumerated; **suspected holdout for zero-root-churn** | `ConfigUpdater.ts:263-290` always adds a reference |
| Root path aliases | `tsconfig.json` via `ConfigUpdater.ts` | Per-package `@beep/<name>` | Apps that publish no public API should not need aliases (ARCHITECTURE.md:61-66) |
| tsconfig-sync | Repo Sanity `config-sync:check` — `GithubChecks.ts:304-308` | Regenerated aliases/refs must match live workspace | First-CI fail if create-package / hand-edit drifts |
| Identity registration | `lint identity-registry` — `IdentityRegistry.ts:175-204` | Walks **all** workspace slugs; missing `$I.compose` + `$FooId` export fails | Locked: labs **do** participate under a dedicated labs namespace |
| Fallow boundaries regen | Repo Sanity `fallow boundaries config-check` — `GithubChecks.ts:310-314`; generated `standards/fallow.boundaries.generated.jsonc` | New cross-package import needs an allow-edge | First-CI fail until `fallow:boundaries:write` |
| Fallow audit (new functions) | Hosted `Fallow Advisory Envelopes` (non-required) + pre-push `fallow:audit` | `.fallowrc.jsonc` ignorePatterns; `apps/` is **in** scope | New high-CC / duplication on a lab is a **code-law** smell, not ceremony |
| Changeset status | `changeset status --since=origin/main` (`package.json:366`); CI only on PRs (`check.yml:234-238`) | Every changed workspace package not in `.changeset/config.json` `ignore` | First-CI fail without a changeset — **ceremony** |
| Schema-first inventory | `bun run beep lint schema-first` | `apps/**/*.{ts,tsx}` already in scope (`Lint.schemas.ts:53`, inventory `standards/schema-first.inventory.jsonc:7-10`) | New exported interfaces / SFV4 cards must be schema or inventoried — **code law** |
| Schema-crispening family | `SchemaFirstPolicy.ts:62-72` | `apps/` → family `apps-slices`; `packages/architecture-lab/` also `apps-slices` | `standards/schema-crispening.policy.jsonc:13` `apps-slices.blocking: true` |
| Knip | `knip.jsonc` workspace discovery `packages/**` + named app workspaces | New workspace is analyzed unless `ignore` / `ignoreWorkspaces` | Keep clean or rewrite baseline (`KnipRatchet.ts:30-33`) — **code law** for dead code |
| Coverage ratchet | `standards/coverage.regression-baseline.jsonc`; compare in `CoverageRegression.ts` | Any workspace package with a `coverage` script (`:257-258`, `:303-316`) | **New packages are warning-only** (`:887-896`). Deletion / missing summary **fails** (`:857-862`) |
| Docgen orphan + coverage | `Docgen/internal/Workspace.ts:28` scan `apps/**/docgen.json` | Any leftover `docgen.json` outside workspaces fails (`:60-61`) | Scaffolded `docgen.json` pulls the package into Docgen — **ceremony** |
| JSDoc inventory / ratchet | `JSDocDocumentationInventory.ts:1469-1487` universe = `bun run topo-sort` minus `packages/ecosystem/` | New workspace appears in inventory totals | Fail-on-growth (`standards/jsdoc-totals.regression-baseline.jsonc`) — **ceremony** |
| Test-typecheck blindspot | `PackageTestTypecheck.ts:59` roots `apps`, `infra`, `packages` | Fail-on-growth vs `standards/test-typecheck.blindspot-baseline.jsonc` | create-package wires `beep:check:tests` — keep labs **out** of the baseline (`:78-79`) |
| Syncpack / sherif | Repo Sanity `GithubChecks.ts:321-332` | Syncpack already special-cases scratchpad | New workspace versions must match catalog |
| Version-sync | `GithubChecks.ts:315-319` | Workspace versions | Mechanical |

Historical “four first-CI gates” (reflections): **tsconfig-sync, fallow boundaries, committed changeset, schema-first**. Labs keep 1, 2, 4; drop 3 by construction.

### 1.2 Lint Policy lanes (hosted required check `Lint Policy`)

Hosted: `check.yml:64-69` → `bun run beep ci lane lint-policy` → `beep lint policy` (`CiLane.ts:349-355`, `:905`).

Local/CI full battery (`Tasks.ts:1655-1700`, log at `:1763`):

| Step label | Command | Labs posture | Path scope today |
| --- | --- | --- | --- |
| `lint:deprecated-apis` | `beep lint deprecated-apis` | LAW | Repo TS |
| `lint:docgen` | `beep docgen check --reuse-proof-manifest` | CEREMONY | Discovers `apps/**/docgen.json` |
| `knowledge:semantic-delta` | `beep knowledge semantic-delta` | ORTHO / docs | Merge-base delta |
| `lint:schema-first` | `beep lint schema-first` | LAW | `apps/**/*.{ts,tsx}` already |
| `lint:terse-effect` | `beep laws terse-effect --check` | LAW (effect-first) | `isLawSourcePath` = `apps/\|packages/\|infra/` + ts/tsx (`Tasks.ts:1603-1605`) |
| `lint:jsdoc` | `eslint . --max-warnings=0` | CEREMONY (JSDoc on exports) | ESLint docs lane |
| `lint:native-runtime` | `beep laws native-runtime --check` | LAW | Same law-source globs |
| `lint:identity-registry` | `beep lint identity-registry` | LAW (locked: labs namespace) | All workspace slugs |
| `lint:frozen-grant-set` | `beep laws frozen-grant-set --check` | LAW | Law sources |
| `lint:circular` | `beep lint circular` | LAW | Import graph |
| `lint:effect-fn` | `beep laws effect-fn --check` | LAW | Law sources |
| `lint:package-test-imports` | `beep lint package-test-imports` | LAW if tests exist | **`packages/` only** (`Tasks.ts:1619-1626`) — apps already out |
| `lint:effect-imports` | `beep laws effect-imports --check` | LAW | Law sources |
| `lint:package-test-typecheck` | `beep lint package-test-typecheck` | LAW | Roots include `apps` |
| `lint:tsgo-rules` | `beep quality tsgo-rules` | LAW (effect-lsp profile + `nodeBuiltinImport`) | tsconfig plugin map |
| `lint:oxlint` | `oxlint --quiet` | LAW | Repo |
| `lint:ecosystem-polarity` | `beep lint ecosystem-polarity` | n/a | `packages/ecosystem/*` only |
| `lint:allowlist` | `beep laws allowlist-check` | LAW | Effect-governance allowlist |
| `lint:jsdoc-module-tags` | `beep quality jsdoc-module-tags` | CEREMONY | Doc modules |
| goals doctor / index / reflection / roadmap / judge-rubric | packet gates | ORTHO | `goals/` |
| `lint:typos` | `typos` | LAW (prose/code spelling) | Lefthook already excludes scratchpad; labs should stay **in** |

**Schema-first exception keys (not a path waiver):**

- Inventory path: `standards/schema-first.inventory.jsonc` (`Lint.schemas.ts:34`).
- Status enum: `candidate | exception | advisory` (`:198`).
- Reconciliation key: `file::symbol::kind::ruleId::line` (`makeSchemaFirstEntryKey`, `Lint.schemas.ts:583-584`).
- Live vs committed: `diffMembership` (`SchemaFirstScan.ts:358-366`). Untracked live findings = fail; stale committed entries = fail unless `--write`.
- `status: "exception"` + documented `reason` is the **per-symbol** escape hatch. Policy cards (`SFV4-*`) can also be family-exempt via `isSchemaCrispeningPolicyExempt` (`SchemaFirstPolicy.ts`).
- **Do not** use exception-key waivers to implement lab ceremony exemption. Labs stay in the scan; they just must write schemas.

**Lint (Biome) required check** is separate: turbo `lint` (`check.yml:58-62`, `CiLane.ts:341-347`). Biome `files.includes` currently **includes** `apps/**` (only scratchpad is negated). Labs stay in Biome — LAW.

### 1.3 Docgen coverage

| Piece | Path | Include/exclude |
| --- | --- | --- |
| Scan globs | `Docgen/internal/Workspace.ts:28` `apps/**/docgen.json`, `packages/**/docgen.json`, `infra/docgen.json` | **Would pick up every lab** that has `docgen.json` |
| Orphan guard | same file `:60-61` | `docgen.json` left after delete, or written outside workspaces, **fails Docgen** |
| Hosted lane | `check.yml:106-111`, lane-gate `:154-170` | PR skip unless change matches `^apps/\|^packages/\|^infra/\|docgen.json\|\.(ts\|tsx\|md)$`. Full if docgen tooling / lockfile / tsconfig / turbo change |
| Required? | **YES** — context `Docgen` (`CiLane.ts:398-405`, frozen set `ci-lane.test.ts:43`) | |
| Local yeet | `githubCheckQualityLanes` `docgen:local --allow-full` (`GithubChecks.ts:247-252`) | Bounded to `origin/main...HEAD` + dirty; escalates |
| ARCHITECTURE | `ARCHITECTURE.md:61-66` | Framework apps **should not** publish a docgen surface. Labs match this doctrine |

Ceremony exemption = **do not scaffold `docgen.json`** + **exclude `apps/labs/**` from `DOCGEN_CONFIG_SCAN_GLOBS`** so a stray file cannot become an orphan-or-coverage trap.

### 1.4 Coverage ratchet

| Piece | Path |
| --- | --- |
| Baseline | `standards/coverage.regression-baseline.jsonc` (`CoverageRegression.ts:32`) |
| Schema | `CoverageRegressionBaseline` `:126-138` — per-package `lines/statements/branches/functions` + optional `uncovered` |
| Who is measured | Workspace packages whose `package.json` has a `coverage` script (`:257-258`, `:303-316`) |
| Compare | `compareCoverage` `:728-765` |
| Fail | metric drop below baseline (`:739-748`, render `:848-855`); **missing current summary** for a required package (`:749-752`, `:857-862`) |
| New package | warning only (`:753-757`, `:887-896`) — “run regen and review the baseline diff” |
| Regen | `bun run coverage:baseline:write` (Quality.command.ts:2520-2521); scoped regen refuses if selected packages lack summaries (`:622`) |
| Hosted | required `Coverage Regression` (`CiLane.ts:389-396`); PR shape `--affected --summarize` (`check.yml:227-228`, `ci-lane.test.ts:143-145`) |
| Yeet local quality | **not** in `githubCheckQualityLanes` — hosted/CI lane + `bun run coverage` |

**Deletion penalty:** a package that remains in the baseline but has no `coverage/coverage-summary.json` is `missingActuals` → **hard fail**, unless the run is `--affected`/`scoped` and the deleted name is not in `expectedPackageNames`. Full-repo coverage (main push, unscoped local) **always** needs the baseline rewritten.

**Escape hatch today:** regenerate the committed baseline in the same PR. There is **no path-glob exemption**. Labs: omit the `coverage` script **and** never add them to the baseline (do not run baseline write over `apps/labs/**`).

### 1.5 Changesets

| Piece | Path | Labs |
| --- | --- | --- |
| Status (PR must have a changeset) | `changeset status --since=origin/main`; Repo Sanity `--changeset-status` on PRs (`check.yml:234-238`, `CiLane.ts:357-363`) | CEREMONY — would block every lab-only PR |
| Ignore list | `.changeset/config.json:13` `["@beep/repo-cli", "@beep/repo-utils", "@beep/scratchpad"]` | **Package names**, not globs. Cannot zero-root-churn per lab without a prefix/glob feature or a **path-aware status wrapper** |
| Graph guard | `beep quality changeset-graph` (`ChangesetGraph.ts`); Repo Sanity `GithubChecks.ts:297-302` | Fails if a changeset names a package that is not a live workspace name, unless listed in `standards/changesets.retired-packages.json` (`ChangesetGraph.ts:34`, file `:1-27`) |
| Release | `.github/workflows/release.yml:35-82` | Ignored packages never version |

Existing reusable mechanism: name ignore (scratchpad). **Not glob-capable as committed.** Implementing “all `@beep/labs-*`” or wrapping `changeset:status` to skip `apps/labs/**` diffs is the ceremony work.

### 1.6 Commitlint

| Piece | Path |
| --- | --- |
| Config | `commitlint.config.ts:46-55` — conventional + `body-max-line-length` 100; ignores only subtree-squash markers |
| Hook | `lefthook.yml:23-26` `commit-msg` |
| CI | required `Commitlint` (`check.yml:607-665`, `CiLane.ts:470-477`) |

**ORTHO.** No path scope. Lab PRs still write conventional commits. No labs concept.

### 1.7 Knip

| Piece | Path |
| --- | --- |
| Config | `knip.jsonc` — workspace `packages/**` + named `apps/oip-web`, `apps/storybook`; ignore `scratchpad/**`; `ignoreWorkspaces` includes `scratchpad` |
| Gate | required `Knip` (`check.yml:509-530`, `CiLane.ts:444-451`) → `beep ci lane knip` |
| Ratchet | `KnipRatchet.ts` — new packages in discovery must be clean |

Once `apps/labs/*` is a workspace glob, knip will see labs unless `ignoreWorkspaces` / `ignore` gets `apps/labs/**`. Dead-code on a lab is closer to **code law** than ceremony. Recommendation: **keep knip ON** (LAW). Optional: `ignoreWorkspaces` only if knip’s app-entry heuristics drown in Next/Vite noise — that would be a **mechanical** knip workspace stanza, not a ceremony waiver.

### 1.8 Gitleaks / Secret Scanning

| Piece | Path |
| --- | --- |
| Hook | `lefthook.yml:13-14` `gitleaks protect --staged` |
| CI | required `Secret Scanning` (`check.yml:667-724`); PR uses **base-pinned** `.gitleaks.toml` + `.gitleaksignore` (`:698-715`) so a PR cannot waive itself |
| Local | `beep quality github-checks secrets` |

**ORTHO / LAW.** No path exemption. Labs stay scanned.

### 1.9 Node-builtin import gate

Two stacked enforcers (code law):

1. **Effect language-service** diagnostic `nodeBuiltinImport: "error"` written into every create-package tsconfig plugin map (`CreatePackage.command.ts:204`). Inherited via `tsconfig.base.json` plugin; `beep quality tsgo-rules` refuses package-local overrides except ecosystem (`Quality.command.ts:1511-1635`).
2. **Oxlint/Biome rule** `namespace-node-imports` (`packages/tooling/policy-pack/lint-rules/src/rules/namespace-node-imports.ts:41`).
3. Skip-file: `/** @effect-diagnostics nodeBuiltinImport:skip-file */` (e.g. `vitest.shared.ts:1`) — per-file, not a family waiver.

Labs inherit this automatically. **LAW. No glob change.**

### 1.10 Effect-LSP on tests

- create-package / architecture shells wire `beep:check:tests` = `tsgo -p tsconfig.test.json --noEmit` (`CreatePackage.command.ts:1557-1572`, `OperationPlanPackageJson.ts:107-108`).
- Blind-spot ratchet `beep lint package-test-typecheck` (`PackageTestTypecheck.ts:1-35`, roots include `apps` at `:59`).
- Repo-wide `beep quality test-tsgo` is the late net (`PackageTestTypecheck.ts:6-8`).
- Effect-LSP rules (including `nodeBuiltinImport`, missing Effect error/context, etc.) run wherever tsgo loads the plugin — tests included if `tsconfig.test.json` extends the base plugin.

**LAW.** Labs must keep the scaffolded `beep:check:tests` wiring. Do not add labs to `standards/test-typecheck.blindspot-baseline.jsonc`.

### 1.11 Architecture / topology checks

| Piece | Path | Labs? |
| --- | --- | --- |
| Binding standard | `standards/ARCHITECTURE.md` | Apps are **executable workspaces**, not a non-slice family (`:61-66`, `:1654-1674`). Canonical non-slice families are only foundation/drivers/tooling/ecosystem (`:448-455`). `apps/labs/*` is a **subdirectory of apps**, not a new family root |
| `beep architecture` schemas | `Architecture.schemas.ts` | Domain kinds `aggregates\|entities\|values` (`:33`); plan stages (`:71`); slice roles include `proof-app` (`:109-118`); package roles are slice roles only (`:157-164`). **No `labs` role.** Architecture command still creates **slices + proof apps**, not lab apps |
| File-role topology | `Architecture.plan.ts` / `RoleTopology.ts` | Governs slice file placement, not `apps/labs` |
| Schema topology | `beep lint schema-topology` | `@beep/schema` only |
| Import boundaries | Law sources `apps/\|packages/\|infra/` (`Tasks.ts:1603-1605`); Fallow generated edges; ecosystem-polarity for ecosystem | Labs **in** law-source globs — LAW |
| Package metadata `beep.family` | `ARCHITECTURE.md:540-577` | Required for **non-slice** artifacts. Apps typically have **no** `beep` field (architecture-lab-proof / create-package app path). Labs stay apps → no family metadata required |
| architecture-lab precedent | `ARCHITECTURE.md:14-17`; workspaces `package.json:493-500` | Full **slice** `packages/architecture-lab/{domain,use-cases,config,server,tables,client,ui}` + proof app `apps/architecture-lab-proof`. **Not ceremony-exempt.** Mapped to schema-crispening `apps-slices` (`SchemaFirstPolicy.ts:68`). Executable proof of the standard, with docgen, coverage scripts, identity, changesets like any slice |

`bun run beep architecture` does **not** need a new family to allow `apps/labs`. Lab scaffolding is `create-package --type app --parent-dir apps/labs` (or a `beep labs` wrapper) after the one-time glob.

### 1.12 GitHub required checks — which of the ~17 see labs

Frozen required **context names** (ruleset `10240248`, read 2026-08-13): **16**, not 17 (`ci-lane.test.ts:37-55`, asserted `:70-78`).

| # | Context | Job | Sees labs if `apps/labs/*` is a workspace? | Should block unrelated PRs? |
| --- | --- | --- | --- | --- |
| 1 | Check | turbo `check --affected` | **YES** — lab is a dependent of any `@beep/*` it imports | **NO** — must filter `!./apps/labs/**` on this required lane |
| 2 | Lint | turbo `lint --affected` | YES | NO — same filter |
| 3 | Lint Policy | full `beep lint policy` | YES (schema-first/laws already glob `apps/**`) | **Partial** — policy is repo-wide, not turbo-affected. Lab schema-first failures **would block every PR** that runs the full lane (hosted always full). Needs `apps/labs/**` **kept** for law steps and **dropped** for docgen/jsdoc steps |
| 4 | Test Unit | turbo test `--unit --affected` | YES | NO — filter |
| 5 | Test Integration | turbo `--integration --affected` | YES if lab has integration tests | NO — filter |
| 6 | Coverage Regression | turbo `coverage --affected` + ratchet | YES if lab has `coverage` script | NO — omit script + exclude from baseline |
| 7 | Docgen | `beep ci lane docgen` | YES if `docgen.json` exists under `apps/labs` | NO — exclude scan glob |
| 8 | Codegen Drift | desktop/codegen | Only if lab is professional-desktop | n/a |
| 9 | Repo Sanity | changeset-graph, tsconfig-sync, fallow config, versions, syncpack, sherif, bun-audit | YES (workspace graph) | tsconfig-sync/fallow/syncpack stay LAW; changeset-status is CEREMONY |
| 10 | Knip | full knip | YES once workspace-globbed | Keep LAW (or workspace-ignore if noisy) |
| 11 | Commitlint | commit range | No path | ORTHO |
| 12 | Secret Scanning | gitleaks | YES (all diffs) | LAW |
| 13 | Security | OSV + dependency-review | Lockfile / deps | ORTHO |
| 14 | Nix Shell | flake | Only if flake touches labs | ORTHO |
| 15 | SAST | semgrep lane | YES if rules match | LAW |
| 16 | Professional Desktop IPC Stdio | path-filtered (`check.yml:292-300`) | **NO** unless path regex widened | Already scoped |

Non-required visible lanes (must **stay** non-required; do not add labs jobs to the ruleset): `JSDoc Ratchet`, `Ecosystem Contracts`, `Fallow Advisory Envelopes`, `Property Laws`, `Build` (push-only), `PR Size Label`. Storybook is a **separate workflow** (`.github/workflows/storybook.yml`) — not in the frozen 16.

**`Security` is listed twice** in descriptors (`security` + `dependency-review` share context name, `CiLane.ts:489-508`) — still one required context.

---

## 2. CONCRETE CHANGE PER GATE (locked posture)

| Gate | Add `apps/labs/**` where? | Reuse existing exemption? | Must grow a labs concept? | Cost |
| --- | --- | --- | --- | --- |
| **Workspaces** | One-time `"apps/labs/*"` in `package.json:433` | create-package already skips if glob covers | No | **trivial** |
| **Biome** | Do **not** add `!apps/labs` (that is scratchpad’s law-off switch) | n/a | No | none |
| **Lefthook biome/typos** | Do **not** exclude labs | scratchpad exclude is the anti-pattern | No | none |
| **tsconfig.packages.json** | Holdout: still enumerated (`:10-22`) | None — no glob refs | Yes: either (a) generate-from-workspaces in tsconfig-sync so labs never touch the file, or (b) accept one ref per lab (breaks zero-root-churn) | **needs-design** (P1 census item) |
| **tsconfig paths** | Apps should not publish `@beep/<lab>` (`ARCHITECTURE.md:61-66`) | Skip alias for `--type app` without public API | create-package may still write aliases — gate the writer | **mechanical** |
| **Identity** | Dedicated namespace segment in `@beep/identity` `src/packages.ts` | Existing completeness lint | Yes: slug convention e.g. `labs/<name>` so prune is mechanical (locked) | **mechanical** (schema + composer folder) |
| **Schema-first / effect-first / laws** | Already `apps/**` | Exception keys are **per-symbol**, not path | **Do not** add a labs family exemption | none (already LAW) |
| **Schema-crispening** | `apps/` already → `apps-slices` blocking | Family policy | No new family | none |
| **Lint Policy docgen step** | `DOCGEN_CONFIG_SCAN_GLOBS` += ignore `apps/labs/**` | Scan-ignore list already exists (`Workspace.ts:29-38`) | No | **trivial** |
| **JSDoc eslint + inventory + ratchet** | Filter topo-sort / inventory universe: drop `apps/labs/**` (same move as ecosystem at `JSDocDocumentationInventory.ts:1478-1486`) | Ecosystem path prefix filter is the reusable pattern | No | **mechanical** |
| **Docgen hosted + yeet** | Same scan ignore; **do not scaffold** `docgen.json` | ARCHITECTURE already says apps have no docgen surface | No | **trivial** |
| **Coverage ratchet** | Never give labs a `coverage` script; filter `workspaceCoveragePackages` to exclude `apps/labs/**` so a future baseline write cannot ingest them | New-package warning-only is **not** enough (deletion still fails if ingested) | Optional path filter in `CoverageRegression.ts:303-316` | **mechanical** |
| **Changesets status** | Cannot glob-ignore in stock config | Name ignore works for scratchpad but **churns per lab** | Yes: either prefix ignore if changesets supports it, or wrap `changeset:status` to drop `apps/labs/**` changed packages; RegistrationSurface owns this | **needs-design** |
| **Changeset graph / retired** | Deletion: drop pending files **or** add to `standards/changesets.retired-packages.json` | Retired-packages file is the deletion escape hatch | delete-package must invert | **mechanical** |
| **Knip** | Optional `ignore: ["apps/labs/**"]` / workspace stanza only if app-entry noise | scratchpad `ignoreWorkspaces` | Prefer keep ON | **trivial** if ignore; none if keep |
| **Commitlint** | — | — | No | none |
| **Gitleaks / Security / SAST / Nix** | — | — | No | none |
| **nodeBuiltin / effect-lsp / test-tsgo** | Inherit scaffold | skip-file is per-file only | No | none |
| **package-test-typecheck** | Already includes `apps` | shrink-only baseline | Keep labs compliant by construction | none |
| **Fallow ignore** | Do **not** add `apps/labs/**` to `.fallowrc.jsonc` ignorePatterns | scratchpad ignore is law-off | No | none |
| **Fallow boundaries generated** | New lab→package imports add edges | regen command | delete-package must regen | **mechanical** |
| **Storybook** | `apps/storybook` globs package stories; labs must **not** be registered | No app-story auto-discovery of `apps/labs` today | Do not add a labs glob to `.storybook/main.ts` | **trivial** (do nothing) |
| **Portless** | Locked namespace `<name>.labs.beep.localhost` | `portlessUrlForApp` is `<app>.beep.localhost` (`Qa.session.ts:81`) | Writer + QA helper need `*.labs.beep` | **mechanical** |
| **Turbo required lanes** | `--filter=!./apps/labs/**` on Check/Lint/Test/(Coverage) in `CiLane.ts` PR/push shapes | desktop-ipc path filter is the “don’t let this required job see unrelated trees” precedent (`check.yml:298`) | Separate **non-required** `labs` lane that typechecks/tests `apps/labs/**` | **mechanical** (lane filter) + **needs-design** (ruleset: do not add the new lane) |
| **Property laws** | Already non-required (`CiLane.ts:527-535`) | — | May include labs; still non-blocking | none |
| **architecture-lab** | Do **not** treat as the lab-app template for ceremony | It is the **full-ceremony slice proof** | Opposite of `apps/labs` | n/a |

Zero-root-churn test after the one-time PR: `beep labs` / create+delete a lab must not touch `package.json`, `knip.jsonc`, `biome.jsonc`, `.changeset/config.json`, `tsconfig.packages.json`, identity **except** the labs namespace file if that file is a generated segment keyed by glob.

---

## 3. `beep architecture` + `ARCHITECTURE.md` + architecture-lab

### 3.1 How the apps family is governed

Apps are **not** a non-slice family. The standard’s family table is foundation / drivers / tooling / ecosystem (`ARCHITECTURE.md:448-455`). Apps are:

- Default home for “App runtime wiring” (`:59`).
- “Executable workspaces, not reusable package surfaces” (`:61-66`). Framework apps keep runtime modules app-local via `@/*`, and **must not** publish `@beep/<app>` TS API, root `src/index.ts`, package exports, or **docgen surface**.
- Exception: **runtime proof apps** may stay package-like (`:64-66`) — this is `apps/architecture-lab-proof` (`Architecture.schemas.ts:117` role `proof-app`).
- App Layer helper may live at `apps/<app>/src/runtime/Layer.ts` (`:1654-1674`) with a God-Layer rejection test.

`beep architecture` generates **slices** (roles domain…ui) plus optional proof-app. It does not generate Next/Vite labs. Lab variants belong to `create-package` / `beep labs`, not a new `ArchitectureSliceRole`.

### 3.2 Does `apps/labs` violate the binding standard?

**No**, if labs remain apps (private, no public `@beep/*` API, no docgen, app-local layers). It is not a new `packages/labs` family and does not collide with doctrine-11 “feature-flag-gated experiments” (that is why the name is `lab`, not `experiment` — locked).

It **would** violate the standard if:

- Labs were modeled as a sixth non-slice family without amending `ARCHITECTURE.md:448-455`.
- Labs published reusable `@beep/<lab>` surfaces (they become packages, not labs).
- Product slices imported lab apps (same ban as scratchpad: `GLOSSARY.md:407-412` Scratchpad Lane — “product slices and public package exports must not import it”).
- Lab tables landed in `packages/*/tables` (locked: in-app only).

North star already says: “experiments should be easy to create, easy to delete, and still shaped like production-quality code” (`ARCHITECTURE.md:32-33`). Locked posture is that sentence, operationalized.

### 3.3 Doc / decision updates owed

Per locked interview + standard amendment rule (`ARCHITECTURE.md:5-7`):

| Surface | Why |
| --- | --- |
| `standards/architecture/GLOSSARY.md` | New term **lab app**. Disambiguate from **Scratchpad Lane** (`:407-412`) and from feature-flag **experiment** (doctrine 11). |
| `standards/ARCHITECTURE.md` How-To table / apps paragraph | Mention `apps/labs/*` as the durable-but-deletable app home; keep scratchpad as throwaway. |
| `standards/architecture/DECISIONS.md` | Zero-root-churn registration + `apps/labs` family-of-apps convention is architecture-wide and hard to reverse — meets the DECISIONS bar (confirm at packet-PR time; locked). |
| `AGENTS.md` / portless law | `<name>.labs.beep.localhost`. |
| Packet PR also: `docs` only if product-facing; no `docs/_internal`. |

Do **not** add `labs` to `ArchitectureDomainKind` / `ArchitecturePackageRole` unless someone tries to generate labs via `beep architecture` — that would confuse slice topology.

### 3.4 `packages/architecture-lab` as precedent

| Dimension | architecture-lab | `apps/labs/*` (locked) |
| --- | --- | --- |
| Home | Full slice under `packages/architecture-lab/*` + `apps/architecture-lab-proof` | App-only under `apps/labs/<name>` |
| Purpose | Canonical **executable examples** of the binding standard (`ARCHITECTURE.md:14-17`) | End-to-end experimental **products** |
| Ceremony | Full: docgen.json, coverage script, identity, workspaces enumerated, likely changesets | Exempt by path |
| Code laws | Full | Full |
| Family metadata | Slice path grammar; crispening family `apps-slices` | App; same crispening prefix `apps/` |
| Deletability | Expensive (seven packages + proof app + all surfaces) | Easy leaf (locked) |
| `beep architecture` | This **is** what the command proves | Out of scope for that command |

Use architecture-lab as the **promotion target shape**, not the lab v1 scaffold. Promotion runbook (locked): move + full `create-package` registration + ceremony onboarding; keep identity ids.

---

## 4. Deletion-side gate effects

`delete-package` is general + leaf-only (locked). Gates that go red when a package **vanishes** if surfaces are not inverted:

| Gate | Failure mode | What delete-package must regenerate / remove |
| --- | --- | --- |
| **Coverage ratchet** | Baseline still lists the package → `missingActuals` fail (`CoverageRegression.ts:749-752,857-862`). Affected PR may hide it; full/main will not | Rewrite `standards/coverage.regression-baseline.jsonc` (drop key). Labs: no-op if never ingested |
| **Changeset graph** | Pending `.changeset/*.md` names a dead package → fail unless in `standards/changesets.retired-packages.json` | Delete those changeset files **or** append a retired record with rationale (existing hatch used for honest-repo-signal deletions) |
| **Changeset status** | Harmless if the package is gone and no ignore entry remains | If ignore-list grew a per-lab name, remove it (another reason to avoid name-list) |
| **Docgen orphan** | Leftover `apps/labs/x/docgen.json` or `docs/generated` for a removed workspace → `Found docgen.json file(s) outside current workspaces` (`Workspace.ts:60-61`) | Delete dir including `docgen.json`; do not leave generated docs. Labs: never write these |
| **JSDoc inventory / ratchet** | Totals **shrink** (OK — fail-on-growth). Stale package rows in committed inventory if the writer dumps per-package lists | Regen inventory in the same PR (`jsdoc-inventory` / `--write-baseline`). Shrink is allowed |
| **Schema-first inventory** | Deleted files → `staleEntries` fail (`SchemaFirstScan.ts:369,444`) | `beep lint schema-first --write` to drop keys. Labs with schemas will have entries |
| **Knip ratchet** | Resolved findings nudge tighten; leftover named workspace config | Drop any `knip.jsonc` per-app stanza; rewrite baseline if needed |
| **Identity registry** | Extra `$LabId` left behind is residue (doctor), not a lint fail. Missing is the fail | Remove the labs-namespace segment ids (locked: mechanical prune). `identity-registry --fix` only **adds** |
| **Fallow boundaries** | Generated allow-edges to/from deleted name drift `config-check` | `fallow:boundaries:write` |
| **tsconfig-sync** | Dangling project ref / path alias | Invert `ConfigUpdater` + `tsconfig-sync` |
| **Root workspaces** | Enumerated entry left → ghost workspace; glob `apps/labs/*` → delete directory + `bun install` only | Glob path is why labs are the easy case |
| **Test-typecheck baseline** | Name left in `standards/test-typecheck.blindspot-baseline.jsonc` | Remove if present (labs should never be listed) |
| **Turbo / lockfile** | `bun.lock` stale | `bun install` |
| **Syncpack / sherif** | `non-existent-packages` (`GithubChecks.ts:331`) | Dir + workspace gone is enough under a glob |
| **Architecture inventory** | No separate committed “architecture package list” beyond operation-plan fixtures. architecture-lab itself is a real slice — deleting it would be a standard-amendment event, not a lab delete | n/a for `apps/labs` |
| **Storybook** | Only if a stories glob pointed at the lab | Don’t register |
| **Portless / QA** | Stale app name in session helpers | Convention-only if names are derived from directory |
| **Per-lab Postgres schema** | Runtime residue, not a yeet gate | delete-package data phase (locked) |
| **Yeet proof** | `yeet verify` = `quality github-checks pre-push` (`RepoRun.proofs.ts:145-150`) which includes quality + fallow + repo-sanity + secrets/security/sast/nix — **not** hosted coverage, but **does** include docgen:local, knip, jsdoc-ratchet, changeset-graph, tsconfig-sync | Doctor mode (locked: tool first) diffs RegistrationSurface declared-vs-actual after delete |

**Minimum yeet-green delete for a glob-registered lab:** remove tree, invert identity labs-segment, drop schema-first stale keys, `bun install`, fallow boundaries if any edges existed, run doctor. No changeset, no coverage baseline, no docgen, no tsconfig.packages edit — **if and only if** P1 actually made those surfaces glob-keyed.

---

## 5. Required-check topology (lab lanes non-blocking)

### 5.1 How sharding / affected works today

- Verify matrix jobs (`check.yml:56-117`): on `pull_request`, turbo lanes get `--affected --base origin/${GITHUB_BASE_REF}` (`:220-228`). Turbo affected = changed packages **plus dependents** (`turbo.json` `affectedUsingTaskInputs: true`).
- `lint-policy`, `codegen`, `ecosystem` run **unscoped** (`:230-232`).
- Docgen has its own path gate (`:154-170`) then `--mode affected|full`.
- Desktop IPC has a **hard path allowlist** (`:298`) and skips with a green job when unmatched (`:324-326`) — required check still **passes**.
- Property laws use `--affected` but are **not** required (`:328-332`, `:527-535`).

So today, **a broken lab that depends on `@beep/schema` fails required `Check` / `Lint` / `Test *` on every schema PR.** That violates the locked “not required-check blockers for unrelated PRs.”

### 5.2 What to do (no ruleset growth)

1. **Do not** add a `Labs` context to ruleset `10240248`. The frozen 16 is a fence (`goals/one-round-loop` / `ci-lane.test.ts:70-78`).
2. **Filter labs out of required turbo lanes** in `CiLane.ts` step builders for `check`, `lint`, `test-unit`, `test-integration`, `coverage`:
   - `--filter=!./apps/labs/**` (or turbo equivalent) on both PR and push shapes.
   - One-time change; new labs inherit the filter (zero-root-churn).
3. **Add a non-required job** (e.g. `Labs` / `lab-check`) that runs `turbo run check lint test --filter=./apps/labs/**` (and maybe typecheck on lab-touching PRs). Visible, CI still “builds/typechecks labs” (locked), but a red lab does not block a `schema` PR.
4. **Lint Policy** cannot turbo-filter. Split internally:
   - LAW steps keep `apps/labs/**` (schema-first, laws, identity, circular, oxlint, tsgo-rules, package-test-typecheck).
   - CEREMONY steps (`docgen check`, jsdoc eslint, jsdoc-module-tags) exclude `apps/labs/**`.
   - Hosted Lint Policy stays one required context; it must not fail solely because a lab lacks JSDoc/docgen.
5. **Repo Sanity changeset-status:** wrap so lab-only file diffs do not require a changeset (ceremony). tsconfig-sync / fallow / syncpack stay on.
6. **Docgen lane-gate** already keys `^apps/`. After scan-ignore, lab-only PRs either skip Docgen (green) or run affected without lab packages — both fine.
7. **Coverage:** with no lab `coverage` script and a collector filter, affected coverage of a lab-only PR compares only packages that have summaries; ratchet does not see labs.
8. **Unrelated PRs that do not touch labs and do not share dependents:** already skip labs via `--affected` **if labs are not dependents**. The filter in (2) is still required because first-wave labs (trustgraph, cognee, …) **will** depend on foundation packages.

### 5.3 Proof that a lab lane is non-blocking

- `CI_LANE_DESCRIPTORS[].required === false` for the new lane (test next to `ci-lane.test.ts:81-91` ecosystem/jsdoc-ratchet).
- Required context set stays exactly the 16 names.
- A fixture PR that only breaks `apps/labs/fixture` must keep `Check`/`Lint`/`Test Unit` green and may go red only on the non-required labs job.

---

## 6. Mapping summary (locked posture → gates)

**CODE LAWS FULL (enforce, include `apps/labs/**`):**
typecheck (`Check` + `beep:check:tests` + tsgo-rules), Biome `Lint`, Lint Policy **law** steps (schema-first, terse-effect, effect-fn, effect-imports, native-runtime, frozen-grant-set, circular, oxlint, identity-registry, package-test-typecheck, deprecated-apis), import-boundary/fallow **audit** (not ignore), portless namespace, knip (prefer on), gitleaks, SAST, node-builtin, effect-lsp on tests.

**CEREMONY EXEMPT BY CONSTRUCTION (path-scope `apps/labs/**`, no per-package waiver):**
docgen scan + `docgen.json` + hosted Docgen contents, JSDoc inventory/ratchet + eslint jsdoc lane, coverage script + coverage baseline, changesets status/ignore, storybook registration, root public-export / docgen surface.

**ORTHOGONAL (no labs concept):**
commitlint, nix, OSV/dependency-review, PR size, goals doctor.

**architecture-lab:** full-ceremony slice proof — promotion target, not v1 lab template.

**Scratchpad:** total-exclude pattern to **copy for ceremony globs only**.

**Zero-root-churn holdout:** `tsconfig.packages.json` enumerated refs + changeset ignore-by-name + identity composer file unless the labs segment is generated from the glob.

**Required-check holdout:** turbo `--affected` dependents. Filter `!./apps/labs/**` on required turbo lanes; run labs on a non-required lane.
