# Adversarial review: C3 lane task table

**Verdict: REJECT pending amendments.** The proposed hash contract is not closed, two wrappers
would change behavior, and the manifest policy cannot represent its own preservation rules.
Blocking findings below are design failures, not claims that an implementation has already shipped.

Reviewed 2026-09-08 against the current tree, Turbo 2.10.12. Only this review file was written;
no temporary commit, tracked-file probe edit, install, test run, or mutating git command was used.
`git status --short` showed pre-existing `research/OPPORTUNITIES.md` changes and untracked design
and evidence documents; those were preserved. In citations below, **T** means
`goals/time-to-certainty/research/c3-lane-task-table.md`, **C** means
`goals/time-to-certainty/research/c3-sublane-inputs.md`, **F** means
`goals/time-to-certainty/research/c3-turbo-facts.md`, and **R** means
`goals/time-to-certainty/research/decisions.md`. Other paths are repo-relative except the explicitly
named Effect reference. Short `Quality/`, `Lint/`, `Ci/`, `Yeet/`, `Laws/`, `Goals/` and
`Knowledge/` citations resolve beneath `packages/tooling/tool/cli/src/commands/`; `internal/`
citations resolve beneath that CLI source root unless a full path is given. UNKNOWN means not established, not permission to ship.

## 1. Findings F1–F5 and independent probes

Commands below used `./node_modules/.bin/turbo run … --dry-run=json`; stdout was parsed to
`packages` and `tasks[].taskId`. All exited 0 except the absent probe names. Remote cache was
unavailable; this does not prevent task-selection inspection. No execution/cache-hit experiment
was performed.

| Arguments before `--dry-run=json` | Observed output |
| --- | --- |
| `check --affected` | `packages:["//"], tasks:[]`, `envMode:"strict"` |
| `check --affected --filter=//` | `packages:["//"], tasks:[]` |
| `check --affected --filter=@beep/schema` | `packages:[], tasks:[]` |
| `check --filter=@beep/schema` | `packages:["@beep/schema"]`; 7 tasks: data/fc-runs/identity/schema/types/utils build, schema check |
| `check --filter=@beep/repo-cli` | repo-cli selected; 34 build/check tasks; no root task |
| `check --filter=...[HEAD]` | `packages:["//"], tasks:[]` |
| `//#c3-probe --affected` / `c3-probe --affected` | exit 1: `Could not find task` |

**P3: PARTIAL**, empty task output confirmed, but this is not a no-diff tree and no root check
is registered. **P4/P6: UNKNOWN independently**: their temporary task definitions and edit deltas
are absent. The commands above attempt the available equivalent; creating those definitions or
editing `research/README.md`/`Lint.command.ts` would violate this review's instructions. A package
filter proves scheduling is available, not affected selection on an input edit. **P8: PARTIAL**:
intersection is demonstrated by unaffected schema disappearing; the package-only/root-task case
cannot be reproduced on this tree. T:32 explicitly says the original probes needed temporary
committed task definitions. F:22 and current `turbo.json:60` show the absent root-task setup.

| Finding | Verdict and exact amendment |
| --- | --- |
| F1 | **AMEND**: “With `affectedUsingTaskInputs`, root task selection follows declared inputs. Current-tree read-only probes do not independently establish P4/P6; retain an executable root-task selection fixture before implementation acceptance. Always-run non-file-dependent tasks need an unfiltered invocation.” Installed `node_modules/turbo/schema.json:294` supports input selection; F:107 already agrees, while F:403 contradicts it. Do not describe all of fact 14 as an independently refuted experiment. |
| F2 | **ACCEPT**, with the P8 limitation above. F:130 and the schema-filter command demonstrate intersection, not a root union. |
| F3 | **REJECT** the hosted backstop claim. Full scope selects every task but can still serve the same false cache hit. Replace with: “Hosted full scope protects selection only. Undeclared-input reuse requires cold/forced execution comparison or a demonstrably complete input closure; declared-input fixtures alone do not detect omissions.” T:68,215 enables cache; F:299 explains hits skip execution. |
| F4 | **AMEND**: “Lockfile/root configuration changes can widen selection; `global.inputs` are prepended per task and can be negated, so they are not an unconditional global-hash mechanism.” Installed schema:443 and F:245 explicitly allow task negation; `turbo.json:113` already negates root tsconfigs for lint. Actual mutation-dependent widening is UNKNOWN in this review. |
| F5 | **ACCEPT** missing-script/default distinction; absent `c3-probe` errors reproduced. `filterUsingTasks` is task-graph filtering, not placeholder support (`node_modules/turbo/schema.json:319`; F:211). Do not generalize to every package-qualified nonexistent selector without testing it. |

P1/P2/P5/P7/P10–P15: original experiment outcomes were not independently reproduced. Strict
`envMode` and task hashes were observed; inline env visibility, changed-env hashes, cache replay,
run-summary execution fields and root dependencies remain supported by cited evidence rather than
this review's dry runs. `turbo run --help` independently confirmed the three continue values/default (§5). Repeating `check --affected` with `TURBO_SCM_BASE=HEAD TURBO_SCM_HEAD=HEAD`, with and without `--filter=//`, still returned `packages:["//"], tasks:[]`; dirty root files remain, so this does not upgrade P3 to a clean-tree/root-task proof.

## 2. Decisions D1–D14 and A1

| Decision | Verdict, alternative, and evidence |
| --- | --- |
| D1 | **AMEND**: “Package diagnostic scope is insufficient: package tasks must hash runtime implementation, global ownership/config reads and resolved imports. Only scanners whose complete reads are bounded may use package-only data inputs.” C:51,53,221; `Lint/PackageTestImports.ts:305` resolves cwd and scans all owner manifests. Root ecosystem shape is reasonable (C:417); no blanket `^transit` for syntax. |
| D2 | **REJECT** reusable git hashes. A merge-base does not encode HEAD tree, ref census, index membership, shallow history, dirty-state provenance or wall clock. `cache:false` disables Turbo caching, not ProofLedger lookup. Replace with: “All git/history/time-dependent lanes run unfiltered with `cache:false`; record `undeclared` and no reusable proof until their complete non-file input model is separately ratified. An exported base must also be passed to the worker's actual `--base`/`--since` option.” C:89–101,452,542,603; R:46; T:103–109. This is a declared exception/amendment to R19, not a secretly honest `turbo-task-hash`. |
| D3 | **AMEND**: “Require impl presence only for unconditional indirections; `--if-present` permits absence. Preserve unknown impl/extras, validate tier disjointness, and independently test writer output against literal contracts.” D3 requires presence while the audit binding permits absence (T:113,314,423). Owned `codegen` is already an explicit strict-tier exception (T:316). Free implementation text preserves variants but cannot enforce audit semantics (D13). |
| D4 | **AMEND**: retain the existing indirection architecture and ratified docgen convergence; defer coverage-only normalization unless Benjamin explicitly includes it. Replace the cost claim with: “Every rewritten package manifest can invalidate all tasks hashing it, even tasks with `cache:false` whose hashes feed the ledger; measure the entire affected cold-lane set.” T:124, F:173, SPEC:36. `cache:false` is not “no cache loss” for other tasks in the same package. Live workspace census confirms 129 direct forms, but one is exempt; see §4. |
| D5 | **AMEND**: “The new worker accepts a package directory but resolves a separate repo root; build syntax projects without root preload/dependency resolution, preserve existing per-law diagnostic exclusions, hash all owner manifests for package-test-imports, and retain a root-scoped native-runtime check for scratchpad/effect-ontology.” Otherwise package migration loses a current scan root (C:134,1688) and cwd silently points owner lookup at `<package>/packages` (`PackageTestImports.ts:305`). Same-process composition requires exported worker functions, not CLI parsing five times. |
| A1 | **ACCEPT** explicit amendment of R21. Empty promoted-family list and early return are real (`commands/Laws/EffectImports.ts:43,1628`; C:177). **AMEND inputs separately**: the enabled-scope globs are deliberate future-proof over-inclusion today; do not call them actual current reads. Markdown remains distinct. |
| D6 | **AMEND**: “Keep separate bounded typed-lint invocation, but run cheap precise gates first; retain existing Labs/profile exclusions until their expansion is explicitly ratified. Verify cwd/config-base matching and source/declaration routing before removing shards.” Four × 4 GiB is a cap on heaps, not aggregate RSS proof; nested concurrency must stay within existing admission. C:62,75,1728,1732; SPEC:83. Giving Labs scripts does not undo ESLint ignore rules. No second scheduler is necessary. |
| D7 | **AMEND**: “Derive presence from the same source-selector semantics as the worker, over actual root workspace membership; reject a positive derivation with no runnable config/plugin. Exempt fixtures and report unowned marked sources. Preserve a missing-generator distinction from absence.” 365 sources/27 owners confirmed; 149 is the wrong fleet denominator (§4). Raw token grep can count prose, so parity with `internal/jsdoc/DoctestSource.ts:25` is required. |
| D8 | **AMEND**: add package config/setup/runtime input closure and a mode contract applied after package config merging (§6). `^transit` is appropriate only for verified declared dependencies; global aliases can resolve undeclared ones. Source aliases are explicit at `vitest.shared.ts:85,105`; package CLI global setup is `vitest.config.ts:11`. Remove defensive task env `BEEP_VITEST_DOCTEST` if the canonical inline assignment always overrides it; otherwise hash the actual effective mode. |
| D9 | **REJECT as written**: retain `knip: knip-bun`, add `knip:check: bun run beep quality knip`, register `//#knip:check`, and redirect consumers there. Changing `knip` to its caller recurses (`Quality/internal/KnipRatchet.ts:413`). Recount additions: D9 omits effect-imports and package-scripts while §2/§3 require them; `lint:deprecated-apis` already exists (`package.json:386`). |
| D10 | **REJECT** one-run wording and heavy-first execution. Replace with: “Use one shared plan definition, multiple invocations by cost/dependency class. Run cheap precise gates and stop on actionable failure before typed lint; explicitly run non-file-dependent tasks unfiltered. Run preflight writers before the checks they repair, then certify the resulting tree.” T:175 conflicts with D6/§4; root `package.json:346` currently repairs first; SPEC B3:83 requires fail-fast. Base selection must be explicit, not ambient default `main` (F:121–125). |
| D11 | **ACCEPT** ratified split/placeholder removal with explicit migration of every old CLI barrel caller (R:221). Live count confirms 25 no-op + one future placeholder + eight real commands. “Keeps text” has the stated identity exception. Do not register a root task wrapping root `turbo run codegen` itself (F:66). |
| D12 | **AMEND**: “Keep blind-spot inventory as its own CLI gate; it reads manifests/test configs, not package results. Ratchet compare consumes only a successful current inventory. Preserve test-tsgo's existing result freshness checks and propagate every failed producer.” C:234 and T:245 distinguish the inventory from the aggregate; R:248 supports dependent CLI aggregates, not consuming absent/stale outputs after failure. |
| D13 | **REJECT** the claim that a free `beep:audit` value can encode stricter ecosystem policy. Either preserve the existing value and explicitly say audit semantics are not enforced, or introduce a ratified semantic requirement. Also model real script capabilities rather than deleting app/infra docgen by path kind (§4; T:423). |
| D14 | **AMEND**: “Cache only deterministic checks with closed file/env/runtime inputs. Tracked-set scans are git-dependent; no ‘pure enough’ exception. Non-file-dependent tasks are unfiltered, uncached and ledger-non-reusable.” T:232,243 directly contradict D2/D14; F:312 says cache false forces execution only **when selected**. |

## 3. Task inputs and consumers

### Shared omission affecting all CLI-backed rows

**BLOCKING AMEND**: before narrowing any CLI hash, add the source-execution closure. A conservative
exact starting superset for package tasks is:

```json
[
  "$TURBO_ROOT$/bunfig.toml",
  "$TURBO_ROOT$/packages/**/package.json",
  "$TURBO_ROOT$/packages/**/src/**"
]
```

Use the same globs without `$TURBO_ROOT$/` for root tasks. This is intentionally broad; replace it
with a proven import closure later, not a guessed `commands/Laws/**` subset. Also include runtime
assets outside `src` when resolved. Root workspace dependency hashing does not cover repo-cli:
parsing root package.json showed its sole `workspace:` dependency is `@beep/tsgo-shim`.
`Lint/Lint.command.ts:10–33` imports schema, utils, identity, helpers and Quality outside its own
folder; `Lint/JudgeRubric.ts:25` imports an omitted CLI error helper. C:53 explicitly requires this
closure. Root package/config/toolchain inputs already supplied by `global.inputs` need not be
repeated (`turbo.json:10`). This superset is not a claim of minimal inputs; complete runtime asset
closure is UNKNOWN until traced. All rows below inherit this amendment where they execute CLI code.

### Every §2.1/§2.2 row

“ACCEPT data” means the declared data surface is supported, subject to the shared closure above;
it does not waive a named UNKNOWN. Negations must not remove positive read inputs. `WT` is a label,
not a Turbo expansion operator (T:215–217).

| Row | Verdict / exact input or behavior amendment |
| --- | --- |
| deprecated-apis | **AMEND** add `$TURBO_ROOT$/packages/**/package.json`, `$TURBO_ROOT$/apps/**/package.json`, `$TURBO_ROOT$/infra/package.json`; keep all referenced configs and verify root default-project/source routing. `^transit` cannot build required declarations. C:1712–1728; `DeprecatedApisESLintConfig.ts:103`. Q2's `tsdoc.json` is conservative for both imported profiles; actual deprecated-mode TSDoc read is UNKNOWN, not asserted blocking. |
| jsdoc | **AMEND** runtime closure; keep no type dependency. Current root `eslint .` also sees root JS/MJS/CJS, which package tasks omit: retain a root docs/parse task for root-owned eligible files, or explicitly ratify reduced coverage. C:83 and `Quality/Tasks.ts:2438`. JSX beyond configured TSX/default JS is conservative over-inclusion; no need to add tsconfig semantic dependencies solely for docs (C:1730). |
| laws | **AMEND** add `$TURBO_ROOT$/packages/**/package.json`, `$TURBO_ROOT$/packages/tooling/tool/cli/src/commands/Lint/PackageTestImports.ts`; ensure D5 removes preload before relying on local files. Remove `!dist/**` unless the new scanner prunes it before reading (C:1654). Standards allowlist JSONC is intentionally indirect policy over-inclusion for native runtime; snapshot is the actual read (C:1688). Preserve scratchpad check as above. No type edge after verified syntax isolation. |
| doctest | **AMEND** add `test/global-cleanup.ts` for repo-cli (or conservative `test/**` for all), `$TURBO_ROOT$/packages/foundation/modeling/utils/src/**`, and package setup/config imports not already in its dependency hash. Remove `!src/**/test/fixtures/**` unless imported fixture reads are forbidden: excluding test discovery does not prevent runtime import. `vitest.shared.ts:1`; repo-cli `vitest.config.ts:11`; C:516–520. Full general runtime closure remains UNKNOWN. |
| semantic-delta | **REJECT reusable/affected form**; D2 replacement. Files outside docs can break a referenced target; ref creation can change results without any file edit. C:88–90; `Knowledge.service.ts:1002,1568`. A whole-tree file glob still does not hash refs/history. `GITHUB_EVENT_PATH` contents and event policy need explicit preservation; env path alone is not content. |
| refs-check | **REJECT reusable/affected form**; D2 replacement. Reads archived HEAD, all tracked target paths; dirty docs hash is not that archive. C:99–101; `Knowledge.service.ts:1664`. |
| schema-first | **AMEND** add `**/package.json`, `**/tsconfig*.json` and verified type-resolution graph. The row calls its list WT but omits workspace manifests/config data. Root preload is **not** established here: `SchemaFirstProject.ts:59` uses `ProjectFactory.ts:39–49`, which deliberately loads only compiler options and explicit globs. C:111,114; `Lint/internal/SchemaFirstDetectors.ts:282`. Root explicit package task dependencies are possible (F:65); absence of `^transit` expressiveness is not proof of closure. |
| identity-registry | **AMEND** replace `packages/**/src/**`, `apps/**/src/**` with `{packages,apps,infra,tools,scratchpad}/**/*.{ts,tsx}` minus only the actual walk exclusions; remove nonexistent `packages/foundation/primitive/identity/src/packages.ts`, use `packages/foundation/modeling/identity/src/packages.ts`. `IdentityRegistry.ts:342` scans workspace directories, not src; C:199–200. |
| circular | **AMEND** declare imported source closure, not only entry roots; `dependsOn` may stay empty if that graph is hashed directly. Madge follows imports (`Lint.command.ts:423–442`; C:210). Exact resolved closure UNKNOWN; `packages/**/src/**` is a safe workspace-source superset, not proof of non-src closure. |
| effect-imports code | **ACCEPT data as deliberate over-inclusion** while default returns before scanning; C:177–178. Broad source/foundation globs are clearly not current scan reads. Hash runtime policy so promotion invalidates. |
| effect-imports Markdown | **AMEND** add `packages/foundation/**/package.json`; exports/publishConfig are actually read (`Laws/EffectImports.ts:588`; C:189). Keep foundation sources and no type-build edge; resolved graph closure still UNKNOWN. |
| tsgo-rules | **AMEND** add `{apps,packages,tooling,infra}/**/*.{cts,mts,ts,tsx}`, `{apps,packages,infra,scratchpad}/**/tsconfig*.json` with the actual walker excludes. `Quality.command.ts:2227–2253,2272`; C:391. Four config/lock files are nowhere near sufficient. No compiler/transit prerequisite. |
| oxlint | **REJECT cache claim until walk is bounded**. Current binary starts at cwd, so add root `*.{js,mjs,cjs,ts,tsx,jsx}`, `scripts/**`, ignore-policy files `.gitignore`, `**/.gitignore`, and audit remaining roots/extensions or retain `cache:false`/non-reuse. C:404–406; `.oxlintrc.json:23`. Existing list is not WT. No type edge; `--quiet --disable-nested-config` preserves policy behavior (`Tasks.ts:2463`). |
| ecosystem-polarity | **ACCEPT data**, runtime closure amendment applies. Exact member manifest/src extension list matches `EcosystemPolarity.ts:23,406` and C:417; no type edge. |
| allowlist | **AMEND** runtime policy closure; current broad source globs over-include files not named by entries (C:428). If entries may name outside src, enforce a path domain or use all target roots; do not silently assume only two roots forever. C:429; `Laws/AllowlistCheck.ts:337`. |
| jsdoc-module-tags | **REJECT cache:true**; D2. Add `tooling/**/*.{hbs,md,ts,tsx}` for selection coverage (C:439); tracked membership comes from `Quality.command.ts:2716`, not blob content alone. |
| goals:doctor | **AMEND** always unfiltered/undeclared as D2; add `explorations/**` for backlink existence if retaining explanatory inputs. C:450–452; `Goals/Doctor.ts:443,631`. No file change is needed for staleness to change. |
| goals:index-check | **ACCEPT data**, runtime closure amendment applies. Inventory excludes template/dot dirs; current broad immediate-goal globs over-include those, non-blocking (C:461; `Goals/Inventory.ts:159`). |
| reflection-artifacts | **ACCEPT data**, runtime closure amendment applies. Recursive reflections glob is broader than immediate dated Markdown actually inspected (C:472; `Lint/ReflectionArtifact.ts:37,279`). |
| roadmap-refs | **AMEND** target existence may be anywhere: use `**/*` with explicit safe tool-output exclusions until linked target roots are constrained; hashing all linked Markdown bodies is over-inclusion for an existence check. C:483; `Lint/RoadmapRefs.ts:303`. Source code, images or other non-MD targets are omitted today. |
| judge-rubric | **ACCEPT data**, runtime closure amendment applies. Qa lens + prompt are correct; command implementation itself is absent from the row (`Lint/JudgeRubric.ts:116`; C:494). |
| typos | **REJECT as an executable declaration**: “minus exclusions” is not an input array. Transcribe actual `_typos.toml` exclusions, preserve config/ignore files, pin installed typos (workflow pins 1.44.0 at `.github/workflows/heavy.yml:189`), and establish hidden/ignore traversal before cache reuse. C:505–507. No type edge. |
| knip | **REJECT** recursion plus impure traversal. Use `knip:check` from D9; include `scripts/**`, root tool/plugin configs and ignore files. `<gitDir>/info/exclude` is outside file inputs and must be neutralized/controlled or task remains uncached/non-reusable. C:527–535; installed `node_modules/knip/dist/util/glob-core.js:39,158`; root script `package.json:383`. `!**/dist/**` is not safe until plugin/declaration reads are closed. |
| fallow audit | **AMEND** no reuse, unfiltered, explicit worker base; preserve envelope validation. Add `.claude/skills/**`, `.fallow/plugins/**`, `fallow-plugin-*`, `pnpm-workspace.yaml`, `**/tsconfig*.json` and root tool configs for explanatory read set (C:540,561), determine native closure. Explicitly preserve/hash `FALLOW_TYPE_AWARE` if supported or reject non-default caller values; strict-mode stripping otherwise changes the old wrapper environment (C:561). Remove `standards/fallow.pilot.inventory.jsonc` as a purported read: only sourceRef metadata established (C:541). Outputs must include actual status/raw artifacts if consumed. |
| fallow dead-code | **AMEND** same non-reuse/base handling. **OVER-inclusion:** remove `standards/fallow.dead-code.regression-baseline.jsonc` as an established hosted read: the explicit baseline-write script uses it, but hosted `fallowArgs` does not pass it (C:554; `FallowQuality.command.ts:874–885`). Native implicit baseline behavior remains UNKNOWN. Replace inherited audit output names with `.beep/fallow/dead-code.check.json`, `.beep/fallow/raw/dead-code.check.*`. Current “as audit” names the wrong producer artifacts (T:240–241; `FallowQuality.command.ts:844`). |
| fallow advisory health/boundaries/flags/security/fix-preview | **ACCEPT** keeping envelope CLI execution and advisory status, but explicitly declare the exception to “every hosted script lane” (R:187). No cache claim; preserve workflow gate and post-run envelopes (`CiLane.ts:1557`; `.github/workflows/check.yml:767`). |
| jsdoc inventory | **REJECT cache:true** until tracked-set/timestamp semantics resolved. Add `infra/**` and any non-src `docgen.srcDir` paths; current table assumes fixed src despite configurable discovery. `Quality/internal/JSDocDocumentationInventory.ts:1273,1580`; C:590–593. Apps/labs and ecosystem sources are clear over-inclusion. Baseline belongs to compare, not inventory hash. |
| jsdoc ratchet compare | **ACCEPT CLI**, but require fresh successful producer; explicit baseline `standards/jsdoc-totals.regression-baseline.jsonc` and inventory path (`Quality/internal/JSDocRatchet.ts:97`; C:591). |
| package-test-typecheck inventory | **ACCEPT CLI**, correct D12's description. Manifest/test-tsconfig inventory is not the compiler aggregate (C:234). |
| test-tsgo aggregate | **ACCEPT existing CLI orchestration**, no new hash/cache claim; preserve package results/freshness and existing task graph (`turbo.json:152`; C:1416). |
| repo-sanity composite | **AMEND split into individual rows** for changeset graph/status, config sync, syncpack, sherif, version checks, audit, Fallow boundaries. `changeset-status` needs unfiltered git handling; config-sync is not git-dependent and needs `syncpack.config.ts`, export target existence and generator/runtime closure (C:612–615). Add `standards/changesets.retired-packages.json` for graph; preserve `osv-scanner.toml` and time/network handling for audit (C:661,668). Hosted version sync uses `--skip-network`, not the default network route (C:624). Keep these CLI until concrete contracts replace the slash-separated union in T:247. |
| topo-sort / docs:aggregate | **ACCEPT shapes**: topo manifests + runtime closure, no type edge; docs remains a generator consuming generated docs, not a transit-only check (C:634–649). `R` consumer claim is not established by current rootScriptStep callers; see below. |

**Additional §3 gate task — AMEND:** `//#lint:package-scripts` needs the common CLI runtime closure as well as the derivation source globs. Its scanner must use root workspace membership, exclude fixtures, and apply the same extensions/exclusions as doctest execution; otherwise task presence itself is falsely reusable (T:433–439; C:516). The current `**/package.json` input is a conservative over-inclusion of fixtures, not authorization to rewrite them.

### Consumer census verdict: AMEND

All explicitly named §2.3 source surfaces exist. Their symbols also exist: `Quality/Tasks.ts:2423`
(policy), `Lint/Lint.command.ts:485,516` (shards/cache), `Ci/CiLane.ts:1160,1664,1688,1707,1730`
(doctest helpers), `.github/workflows/heavy.yml:91,244`, root `package.json:339,346,352`,
`Yeet/internal/WaveOrder.ts:199,211,212,229,241`, and
`Quality/internal/TurboConfigProof.ts:26`. The three writer surfaces and
`standards/turbo-remote-cache.md` exist; the new internal package-scripts module does not yet exist
(T:278 is proposed). No nonexistent `.claude/rules` was used as an oracle. The writer paths are `commands/CreatePackage/CreatePackage.command.ts`, `commands/Architecture/OperationPlanPackageJson.ts`, and the `commands/DeletePackage/` implementation, as named by R:179–182,227–230.

Missing or misleading rewires:

- **Add `Quality/internal/GithubChecks.ts` explicitly**: repo-quality knip bypasses CiLane
  at :300; Fallow direct workers at :485,491; cheap config-sync/tsgo/effect-imports/schema-first/
  allowlist/doctor/jsdoc/knip/Fallow at :532–581. Changing CiLane does not migrate these consumers.
  §2 omits G for effect-imports, and goals-index also has a direct cheap-gate route at :521–524.
- **Correct R**: `rg -n 'rootScriptStep\(' CiLane.ts` returns :1102,1128,1132,1134,1310
  (generic Turbo root lane, docgen and build). Knip and JSDoc are `bunRunStep` at :1376,1393;
  Fallow constructs explicit `bun` steps at :1215. Remove R from knip/Fallow/topo-sort unless
  a real caller is named. Definition at :691 alone proves no consumer.
- **Keep envelope consumers** `.github/workflows/check.yml:767–806` and
  `Ci/CiLane.ts:1235,1557`. `--base` is currently forwarded at :1226; D2's new env variable
  does not replace that worker argument. Yeet reads Fallow artifacts in
  `Yeet/internal/Planner.ts:348–361`; hash-only metadata cannot replace them.
- **Account for every workflow entry**: `.github/workflows/check.yml:247,758,831,859` and
  `.github/workflows/heavy.yml:231,241`. Existing lane entrypoints can remain stable, but task
  summaries and artifacts must continue through these routes. The check.yml codegen path gate
  (:134–141) and driver `generate:check` calls (`CiLane.ts:1197`) should remain intact.
- **Lefthook is a separate route**: `lefthook.yml:15–18` runs
  `typos --exclude '.beep/**' --exclude 'scratchpad/**'`. Name whether it stays direct or
  calls the task with equivalent scope. Also retain `version-sync --skip-network` at `lefthook.yml:30–31`. Both are absent from §2.3 despite L in §2.2.
- **CLI exports and diagnostics**: removing `doctestStepForTesting` also changes its exported
  surface/JSDoc (`CiLane.ts:1148`); preserve lane IDs consumed by
  `Yeet/internal/IssueClassification.ts:247–263` and WaveOrder rather than silently renaming them
  to Turbo task IDs. Add producer/summary mapping to the plan; rewriting WaveOrder “basis” text
  does not record actual hashes (T:265–267).

A search is not runtime reachability proof. UNKNOWN: indirect dynamic consumers outside the
requested directories. The direct missing routes above already refute “all consumers.”

## 4. Schema sketch and fleet consistency

### Effect API audit

Reference **E** = `/home/elpresidank/YeeBois/dev/effect/packages/effect/src/`.
These are rc.112 source signatures, not v3 recollection. **No demonstrated v3-ism in the listed
constructor calls.** Compilation of the incomplete sketch was not claimed.

| API | Verdict and reference |
| --- | --- |
| `S.Class<Self>(id)(fields, annotations)` | **ACCEPT**, E/Schema.ts:13973–13982. Matches local `internal/repo-run/TmpfsReap.schemas.ts:147,159`. |
| `S.Record(S.String, S.String)` | **ACCEPT**, two arguments in E/Schema.ts:3794. Do not replace with v3-style `{key,value}`. |
| `S.HashMap(key,value)` | **ACCEPT** as an Effect HashMap on both Type and Encoded sides, E/Schema.ts:12569,12597. It does **not** encode to a flat JSON object. |
| `S.HashSet(value)` | **ACCEPT** Effect HashSet on both sides, E/Schema.ts:12664,12689; not a JSON array codec. |
| `S.TaggedUnion({ tag: fields })` | **ACCEPT**, fields maps are correct; `_tag` supplied by TaggedStruct (E/Schema.ts:6255–6267). No `S.Struct` wrapping needed. |
| `S.decodeTo(ScriptsBlock, transformation)` | **ACCEPT signature, AMEND helper types**. Decode maps `ScriptsRecord.Type` to `ScriptsBlock.Encoded`; encode receives `ScriptsBlock.Encoded`, not necessarily the class Type (E/Schema.ts:5367–5372). Type `partition`/`flatten` accordingly. |
| `SchemaTransformation.transform({decode,encode})` | **ACCEPT**, pure inverse functions are the intended API (E/SchemaTransformation.ts:382). Add missing `import * as SchemaTransformation from "effect/SchemaTransformation"`. Do not throw untyped errors from partition. |
| `S.Array(PackageScriptsDrift)` | **ACCEPT**, `ArraySchema` exported as Array (E/Schema.ts:4406–4449). |
| `S.Literal(...)` | **ACCEPT** single literal (E/Schema.ts:2629); protocol version and singleton codegen use is appropriate. |
| `S.Int` | **ACCEPT** API (E/Schema.ts:7544). **AMEND domain**: manifests is nonnegative, so use a named count schema with a nonnegative check. |
| `Context.Service<Self,Shape>()(id,{make})` | **ACCEPT**, E/Context.ts:209–224; exact local precedent `Yeet/internal/ProofLedger.ts:190–191`. Add Context/Effect imports; actual make implementation/error/environment closure is UNKNOWN. |
| `LiteralKit([...])`, `.is.lab`, `.is["lint:laws"]` | **ACCEPT**, const generic overload `LiteralKit.schema.ts:730`, guard construction :786,826. No `as const` needed. |
| `S.optionalKey`, `S.is` (claimed, not constructor calls in sketch) | **ACCEPT** availability at E/Schema.ts:2307 and :1391; the optional-key claim does not solve the missing optional presence case below. `S.is(TaskScriptRule)` is the appropriate derived guard; no handwritten predicate needed (AGENTS.md:35–53). |

**AMEND exact missing type alias** after the drift schema:

```ts
export type PackageScriptsDrift = typeof PackageScriptsDrift.Type;
```

Without it, `ReadonlyArray<PackageScriptsDrift>` in the service uses a const as a type (T:366,387).
`DerivationEvidence` and `PackageScriptsPolicyError` are only names/prose, not implemented schema
contracts. Define them schema-first with a typed error, as the existing
`internal/repo-run/QualityScheduler.schemas.ts:829` does. Export docs also need titled examples,
category/since and meaningful annotations before implementation, not the sketch's one-line comments
(AGENTS.md:35–53; `TmpfsReap.schemas.ts:127–161`). The inline nested derived-rule LiteralKit
should become a named schema reused by derivation evidence and dispatch (T:324; AGENTS.md).

**REJECT the policy model as complete**:

1. `test:integration:parallel` is “where present today, not stamped” (T:418), but Presence has
   only required/absent/two derived cases (T:321–325). Add `optional: {}` with exact semantics
   “validate binding if present; never synthesize or delete.” Do not use `actual` as an eternal
   baseline when deletion must be detected.
2. D7's universal iff rule conflicts with infra's absent doctest cell (T:430). Either scope D7
   explicitly to package/app source roots (matching today's lane), or add infra to derivation
   and execution together with a ratified scope change. `exempt` has no table row: specify
   “no validation or writes” and handle it before partitioning.
3. The table deletes app/infra docgen and app property/integration scripts that exist:
   `apps/architecture-lab-proof/package.json:27,31,32`,
   `apps/practice-kg-mcp/package.json:26`, `apps/professional-desktop/package.json:34,38–40`,
   `infra/package.json:22`. **Replace those absent cells with capability/optional rules that
   preserve actual tasks**, then ratify any required default. Do not let path kind silently
   remove verification coverage.
4. Disjointness is not encoded: `extras: HashMap(String,String)` may contain `check` or any
   impl key (T:345), and a caller can construct that directly. Reject overlapping maps and kind
   mismatch at encode; sort keys explicitly (HashMap iteration is not a specified lexical order).
   Specify whether empty/malformed scripts fail before `--write`; free `S.String` admits empty
   implementations (T:343–345).
5. Generator presence derived from “existing non-placeholder codegen” cannot detect a missing
   real generator after someone removes that key. State that the gate checks placeholders and
   bindings only, or add independent generator capability evidence (T:403–404).
6. D13's stricter audit and arbitrary existing `beep:audit` cannot both be enforced. Preserve
   free values as promised; add an explicit semantic contract only with a scoped decision.
   Package ownership should not be inferred from fixture paths; use root workspaces (T:405).
7. Report HashMap/HashSet fields need a separate JSON-safe codec if emitted as JSON. Native
   collection encoding is not a wire report; the APIs above show Encoded is still Effect
   collections. This is UNKNOWN implementation intent, not a constructor misuse.

**Live census, corrected denominator.** Python expanded root `package.json.workspaces`, deduped
`<pattern>/package.json`, then parsed scripts: **142 workspace manifests, 140 after scratchpad and
tools/tsgo-shim exemptions**. A filesystem census under packages/apps plus infra produces 147,
including seven fixtures and excluding those two workspace roots; adding those roots gives 149,
not 149 workspaces. The root manifest is separate. Do not run fleet `--write` over fixtures.

Actual workspace counts: docgen **132 = 129 direct + 2 indirect + 1 tool-owned**; coverage **134 / 6
variants**; beep:check **139 / 16 variants**; integration:parallel **24**; codegen **34 = 26
placeholders + 8 real**. Thus D4's 129 direct count and D3's variant counts are confirmed on the
correct workspace census. One direct docgen lives in exempt `scratchpad/package.json:32`, so rewriting all 129
contradicts exempt semantics; specify whether 128 non-exempt direct forms are the rewrite set.
The 365 eligible marked src files / 27 owners are independently confirmed after excluding fixtures;
none is in an app. Commands used Python `glob` over root workspaces and
`rg -l 'import.meta.vitest' packages apps -g '*.ts' -g '*.tsx' -g '!**/test/fixtures/**'`, assigning
files under src to their longest manifest-directory owner. These are token counts, not proof that
every token is an executable fence. T:98,563 needs the corrected manifest denominator.

## 5. Turbo contract and execution plan

**ACCEPT schema shape, REJECT behavioral completeness.** The requested schema URL could not be
fetched through the web tool (safe-open error), so the allowed fallback was used:
`node_modules/turbo/schema.json` from installed 2.10.12. A read-only `bun -e` loaded the nine §4
entries, wrapped them in `{tasks:…}` by merging with parsed current turbo.json, and ran installed
Ajv with `strict:false, allErrors:true`: **`{"valid":true,"errors":null,"sketchedTasks":9}`**.
Ajv warned about unrecognized `uint64` format; none of these additions uses it. The raw snippet is
JSONC object members, not a standalone JSON document; add outer braces for standalone use. This
establishes property/type validity, not scripts, read closure, or selection correctness.

**AMEND §4**: remove duplicate illustrative input lists and generate the contract from the ratified
§2 list. They already disagree: §4 laws adds foundation source despite A1 and omits the snapshot/
internal tsmorph; ESLint replaces recursive extension inputs with selected directories and drops
internal rule helpers; §4 semantic-delta retains the same incomplete git model (T:447–469 versus
T:208–211). An implementer choosing the code block would implement a different hash.

**Continue mode:** `turbo run --help` returned default `never` and descriptions matching F:255–264.
**ACCEPT `dependencies-successful` over `always` for collecting independent tasks within one
invocation**: siblings continue, failed-producer dependents stop. `always` has no advantage for
independent tasks and is wrong for producer consumers. **REJECT treating it as fail-fast**:
SPEC B3:83 wants immediate stop before heavy work. Define local fail-fast versus deliberate hosted
collection; do not conflate them. Two sequential runs also need an explicit policy for whether the
second runs after the first fails and a final nonzero exit retaining both failures (T:479–484).

Unfiltered non-file-dependent tasks require another execution group or equivalent explicit route.
`cache:false` does not override `--affected`; an env value changing the hash does not establish a
file-based selection trigger (installed schema:294; F:312). Pin `TURBO_SCM_BASE` and head/dirty scope
from the existing caller, rather than introducing `BEEP_PROOF_BASE_SHA` without forwarding it to
actual git readers (`CiLane.ts:1107,1226`).

**AMEND summaries**: capture invocation-specific summary paths/IDs; require successful execution or
valid cache evidence per task, distinguish skipped/missing/failed/uncacheable tasks, and reject stale
summaries from prior attempts. “Read every file the lane wrote” (T:545) is not a freshness protocol.
The `.turbo/runs` execution-field schema is UNKNOWN independently here because no task was executed;
this needs a representative runtime fixture before ledger ingestion (F:318,353).

## 6. Vitest mode branch

**AMEND §5's explanation** with:

> A package config that sets `test.include` while inheriting `includeSource` and the doctest plugin
> runs ordinary tests **as well as** doctests. A config that never inherits shared configuration can
> bypass doctest mode entirely. Validate the final resolved config, including setup files, environment,
> exclusions and concurrency, before enabling a package task.

Read-only probe:
`mergeConfig({plugins:[{name:"doctest"}],test:{include:[],includeSource:["src/**/*.ts"]}},
{test:{include:["test/**/*.test.ts"]}})` returned the plugin and **both** selection fields.
Installed Vitest explicitly appends in-source files to ordinary testFiles
(`node_modules/vitest/dist/chunks/cli-api.CnMVyzaz.js:10851–10865`).

Complete `rg 'include:|plugins:' packages apps -g 'vitest*.config.ts'` inventory, separating
`test.include` from unrelated fields:

| Config and line | Does §5 branch survive? |
| --- | --- |
| `packages/drivers/duckdb/vitest.config.ts:8` | Yes, mergeConfig keeps plugin/includeSource, but ordinary tests are added; timeout also becomes 20s (:9). |
| `apps/todox/vitest.config.ts:15` | Yes, adds ordinary tests and jsdom. |
| `apps/oip-web/vitest.config.ts:15` | Yes, adds ordinary tests, jsdom and test/setup.dom.ts (:16). |
| `apps/professional-desktop/vitest.config.ts:22` | Yes, adds ordinary tests, jsdom, setup and custom error suppression (:14–24). |
| `apps/practice-kg-mcp/vitest.config.ts:8` | Yes, adds ordinary tests. |
| `apps/labs/api-docs/vitest.config.ts:14` | Yes, adds ordinary tests. |
| `apps/labs/ciops/vitest.config.ts:14` | Yes, adds ordinary tests and thread pool. |
| `apps/labs/lejeune-bolt-workbench/vitest.config.ts:15` | Yes, adds ordinary tests/jsdom and 90s timeout. |
| `apps/labs/semantica/vitest.config.ts:15` | Yes, adds ordinary tests/jsdom. |
| `apps/labs/trustgraph-workbench/vitest.config.ts:15` | Yes, adds ordinary tests/jsdom. |
| `apps/storybook/vitest.config.ts:10` | **Bypasses**: does not import shared, plugin or includeSource. No current derived doctest owner here, but D7 must reject future false-green stamping. |
| `apps/professional-desktop/vitest.integration.config.ts:16` | Shared branch survives, adds integration tests. Not selected by proposed default `vitest run`. |
| `apps/professional-desktop/vitest.coverage.config.ts:9` | Base branch survives, ordinary test include/exclude replaced. Not selected by default command. |
| `packages/drivers/graph-3d/vitest.browser.config.ts:11` | **Bypasses**, standalone browser config, not selected by default command. |
| `packages/ontology/client/vitest.browser.config.ts:18` | **Bypasses**, standalone browser config, not selected by default command. |
| `apps/storybook/vitest.storybook.config.ts:10` (`plugins`) | **Bypasses**, standalone Storybook plugin config. :8 is optimizeDeps.include, not test.include. Not selected by default command. |

Remaining matches are **coverage.include only**, not doctest selection overrides, and all inherit
shared: `packages/workspace/tables/vitest.config.ts:20`,
`packages/epistemic/tables/vitest.config.ts:20`, `packages/shared/tables/vitest.config.ts:23`,
`packages/shared/domain/vitest.config.ts:23`,
`packages/foundation/modeling/skill-contract/vitest.config.ts:20`,
`packages/foundation/modeling/provenance/vitest.config.ts:20`,
`packages/foundation/modeling/rdf/vitest.config.ts:23`,
`packages/foundation/ui-system/ui/vitest.config.ts:9`. No default package vitest.config.ts sets
`plugins:` in the searched tree; only Storybook's separately named config does.

For the current 27 owners, the concrete new read is repo-cli's
`packages/tooling/tool/cli/test/global-cleanup.ts` via `vitest.config.ts:11`; today it is a no-op
Effect, but changing it would affect execution without changing the proposed hash. Keep shared
runtime imports/setup dependencies too (`vitest.shared.ts:1`, `vitest.setup.ts:14–20`).
`sequence.concurrent:false` only controls concurrent tests, not 27 Turbo processes or Vitest file
parallelism: preserve intended semantics and measure worker fanout (T:508; current docs config:15).

**Exact implementation amendment:** apply doctest selection/plugin guarantees to each final package
config (or make every package override explicitly conditional on exported `vitestDoctestActive`);
assert nonempty eligible discovery for positive derivation. Prefer `passWithNoTests:false` for such
positive tasks if fixture semantics permit it. Do not rely on `passWithNoTests:true` as proof of
running examples (T:501; D7).

## 7. Test migration audit

**AMEND; no additional top-level test file found for the exact requested retired strings.**
Both normal and `--hidden` searches covered `packages/tooling/tool/cli/test/`. Every match was in
create-package, ci-lane, ci-runner-security, doctest-lane, quality-tasks, or the listed doctest fixture
subtree. The following omissions are within files already named, and still require explicit scope:

| Retired string | Search result / missing migration detail |
| --- | --- |
| `vitest.docs.ts` | `ci-lane.test.ts:1087,1094,1314,1360,1398,1421,1444,1462,1522,1568,1604,1628,1657,1682`; §6's 1300–1400 description misses the latter block. Also `doctest-lane.test.ts:17`, `ci-runner-security.test.ts:355`, and **fixture `test/fixtures/doctest-lane/package/tsconfig.json:3`** (add explicit config migration). |
| `doctestStepForTesting` | `ci-lane.test.ts:13,1085,1089,1098`; migrate import as well as assertions. |
| `no codegen needed` | `create-package.test.ts:220,238`; covered. |
| `beep:policy` | `create-package.test.ts:195,202`; :195 embeds it inside `beep:audit`, not just a standalone key. Retiring the key while never editing existing impl values can leave dangling audit chains; migration must inspect generator defaults and fleet references. |
| `DEPRECATED_API_LINT_SHARDS` | **No test match**. Replace “lint*.test.ts … if any” with an explicit no-match result; new worker behavior needs meaningful coverage. |
| `rootLintPolicyStepsForTesting` | `quality-tasks.test.ts:99,2544,2592,2616,2659`; scope/no-source tests must verify no lost checks. |
| `ci:knip` | **No exact test match**. Knip assertions may use command text; do not invent an exact-label pin. |
| `ci:fallow` | `ci-lane.test.ts:1131–1137,1147`; **quality-tasks.test.ts:2137–2138** also asserts blocking/envelope behavior, not just policy spawn counts. Add that case to C3.5. |
| `ci:jsdoc-ratchet` | `ci-lane.test.ts:982`; preserve inventory→compare relationship. |
| `doctest_mode` | `ci-runner-security.test.ts:326`; covered. |
| `bun run beep codegen` | **No exact test match**. This does not prove no split callers elsewhere. |
| `"doctest": "vitest run --config vitest.docs.ts"` | `ci-runner-security.test.ts:355`; covered. |

**REJECT deriving every expected writer result from the same rule table it calls** (T:530–536).
That makes a wrong canonical rule validate itself. Keep independent literal/capability assertions
for app/infra retained docgen, optional parallel scripts, preservation of impl values and extras,
idempotent writes, fixture exclusion, and negative drift. Tests should prove observable migration
behavior, not mirror implementation. Existing `create-package.test.ts:195,220` is independent
contract evidence; replacing all such evidence with a shared function would hide §4's deletion bug.

## 8. Acceptance, PR train, and scope

- **ACCEPT estimated PR sizes**: 4/~160/~155/~150/~40/~30/~10 are each below the user's 500-file
  limit (T:561–567). **UNKNOWN actual final file counts** until manifests/configs/generated
  artifacts and lockfile are included in each PR. Actual workspace count is 142, not an estimate
  of 143 normalized manifests. Set an explicit `<=500 changed files` pre-publication gate.
- **ACCEPT implementation ranking**: C3.1 is a prerequisite; deprecated/docs policy, laws,
  doctest, then graph tasks agrees with PLAN:94–110 and R:198. **REJECT runtime ordering as
  equivalent to that ranking**: migration by hosted minutes does not authorize delaying
  second-precision gates behind typed ESLint (SPEC:83; T:479).
- **BLOCKING AMEND PR staging**: C3.1's canonical rules already require the four scripts before
  their workers exist in C3.2–C3.4 (T:426–430 versus :562–565). Introduce rules only in the same
  PR as runnable workers/task definitions, using a staged policy version; do not stamp broken
  scripts or make the new gate red. C3.1 also registers `//#lint:package-scripts` at T:435 while
  C3.5 claims root tasks land then. State exactly which root task exists in PR1.
- **REJECT universal docs-only hash equality fixture**: docs are true inputs for Markdown,
  refs/roadmap/typos tasks. Replace T:535 with “choose a file outside that lane's declared and
  actual input closure.” Add negative fixtures on omitted shared rule, owner manifest, setup,
  target deletion, git/index/ref and non-src reads; declared-input edits alone cannot test
  under-inclusion (C:51; F3 above).
- **AMEND accounting**: baseline and first cold measurements must precede claims and support
  key changes, not merely be promised after merge. Docgen/coverage manifest rewrites affect
  other task hashes (F:173); verify hit ratios per lane, not whole proof (SPEC:36, T:542).
- **AMEND package verification scope**: `@beep/repo-cli` alone does not discharge package
  handoff checks for every workspace whose manifest/config changes (AGENTS.md:93;
  T:569–570). Use justified quick checks where appropriate, and let Yeet's required full gates
  determine readiness; “filtered checks only” cannot override them.

The exact “brief / Explicitly out of scope” document is **UNKNOWN**: no such brief was supplied,
`rg --files goals/time-to-certainty` found no brief, and the matching phrase was absent in the
packet. Applying the exclusions explicitly supplied in this review request and SPEC:161–171:

| Exclusion | Verdict |
| --- | --- |
| Labs C3 item | **ACCEPT** leaving the Labs lane deferred (PLAN:109); **AMEND** D6's policy expansion separately because existing profile exclusions do not vanish with a script. |
| X→beep:X indirection layer itself | **AMEND** preserve the existing mechanism; R24 permits encoding/converging docgen, not an unbounded redesign. Coverage normalization is separable and needs explicit scope ratification (D4). |
| hosted `--affected` | **ACCEPT** absent from proposed hosted commands (T:480–483); validate no ambient wrapper injects it. |
| ops/infra root scripts | **ACCEPT** no general ops/infra rewrite proposed; **REJECT** incidental removal of infra docgen by kind table (infra/package.json:22). |
| oxlint advisory promotion | **ACCEPT** quiet/error-only invocation preserves current policy (`Quality/Tasks.ts:2463–2468`). |
| merge queues | **ACCEPT** none proposed; SPEC explicitly rejects (:165). |
| hosted-tier reuse | **ACCEPT** no new local-proof reuse in hosted proposed; remote-cache task reuse is distinct and R20 explicitly permits it (R:200). |
| cache-key changes without first-cold measurement | **AMEND** post-merge-only cold receipt is insufficient as an up-front justification; D4's collateral invalidations need measured baseline and acceptance accounting (SPEC:36,168). |
| second scheduler or lock | **ACCEPT** Turbo concurrency limits need no new admission system; keep existing wrapper lease/scope propagation (T:487; AGENTS.md Quality Operator). |

## Ranked BLOCKING issues

1. **Dishonest proof reuse / false skip**: D2 and cached tracked-set tasks omit non-file state;
   full-scope hosted cache hits do not backstop an incomplete hash. Run these unfiltered,
   uncached, ledger-undeclared pending a complete model (§1 F3, §2 D2; C:89–101,441,452,529).
2. **Under-included executable/data inputs**: shared CLI runtime, global owner manifests,
   identity non-src files, tsgo directive/config walks, Markdown export manifests and doctest
   setup all have concrete omissions (§3; C:53,199,221,391; repo-cli vitest.config.ts:11).
3. **Broken behavior through orchestration**: knip recursion; lost Fallow base/envelope contract;
   wrong dead-code artifact names; repair writers after failing checks; cheap gates after heavy
   ESLint (§2 D9/D10, §3; KnipRatchet.ts:413; CiLane.ts:1226; SPEC:83).
4. **Manifest gate removes real verification and cannot model preservation**: app/infra docgen,
   optional parallel scripts, exempt membership, free audit semantics and staged worker availability
   (§4, §8; T:321–325,418–430,562–565).
5. **Doctest false-green / wrong workload**: final configs can bypass shared mode or add ordinary
   tests; positive presence plus passWithNoTests masks discovery loss, and runtime inputs omit setup
   (§6; apps/storybook/vitest.config.ts:5; Vitest installed globAllTestFiles:10851).
6. **Incomplete consumer migration and acceptance**: direct GithubChecks routes remain plain
   workers, fixture strategy cannot discover omissions, and PR1 gate/worker timing is unspecified
   (§3 consumer census, §7, §8; GithubChecks.ts:300,532–581).

## NON-BLOCKING improvements

- Remove redundant env hashing for an always-inline mode, avoid whole-source over-inclusion for
  the currently no-op effect-imports, and quantify conservative runtime-closure reruns (§2 A1/D8).
- Replace duplicated table/code inputs with one generated contract; correct consumer legends and
  census denominators (§3–§5). Config validity alone is already established.
- Keep independent writer-contract tests, explicit per-lane cold accounting, and an actual PR file
  count instead of estimated fleet counts (§7–§8).
- Complete exported documentation, count-domain constraints, report wire codec and stable sorted
  serialization; constructor APIs themselves are valid v4 (§4).

## Three decisions for Benjamin

1. **D2/F3:** accept explicitly non-reusable git/time/administrative-state lanes, or fund a complete
   state model before any reuse claim? Merge-base alone cannot represent their result (§1–§3).
2. **D3/D4/D13:** should the gate preserve actual script capabilities and limit convergence to the
   ratified docgen change, or deliberately remove/standardize app, infra and audit behavior? The
   current kind table makes that decision implicitly (§4).
3. **D6/D10:** retain immediate cheap-gate failure and repair-before-check behavior, or explicitly
   amend SPEC B3 for a heavy-first collection plan? Two invocations solve only typed-lint concurrency,
   not ordering or git-task selection (§2, §5).

## Missing implementation decisions

The implementer still needs: a precise workspace membership/presence policy; staged rule versions;
repo-root versus package-cwd worker contracts; full import/type/runtime read closure; treatment of
root-owned JS and scratchpad laws; explicit non-file state/reuse policy; actual worker base forwarding;
resolved Vitest-config parity; failure/aggregate ordering; task-to-lane-to-summary provenance and
freshness; final artifact paths/envelope checks; per-package verification scope; and a pre/post cold
measurement protocol. Each is grounded in the counterexamples above, not a request for a new
scheduler or hashing engine (§2–§8). P4/P6/root-cache runtime proof remains UNKNOWN under this
review's no-edit probe constraints and must be established by implementation fixtures before ratification.

---

## Orchestrator disposition (Fable, 2026-09-08)

Seat validity: the reviewer read the cited code, ran read-only dry runs, validated the Turbo
schema with the installed Ajv, and inventoried every vitest config; the findings are grounded,
not theatre. Applied in `c3-lane-task-table.md` revision 2 unless struck below.

| Item | Disposition |
| --- | --- |
| Blocking 1 (D2/F3 dishonest reuse) | **Accepted.** Git/tree/ref/time/network lanes are non-reusable (`cache: false`, unfiltered, ledger `undeclared`); the env carrier is deferred (Q3). F3 now names the real backstop: negative closure fixtures per lane, `TURBO_FORCE` on lockfile diffs, ruling 6. |
| Blocking 2 (under-included runtime closure) | **Accepted as the hazard; remedy replaced.** Hashing `packages/**/src/**` into every task recreates the whole-tree hash ruling 19 rejects. D15 declares one generated policy-tool fingerprint (CLI, repo-utils, policy-pack) as an input of every policy task, kept fresh by a gate and preflight. Row-level data omissions (owner manifests, identity path, tsgo walk, setup files, ignore files, link targets) applied verbatim. |
| Blocking 3 (orchestration) | **Accepted.** `knip:check`; Fallow `--base` forwarded and envelopes kept; dead-code outputs corrected; writers before checks; cheap precise gates first in three ordered invocations (D10). |
| Blocking 4 (manifest gate) | **Accepted.** Presence kinds `required/optional/absent/derived` from the census; app and infra docgen kept; `coverage` stays package-owned (Q1); exempt domain = root workspaces only; no audit semantics; one fleet-wide touch with runnable thin workers in PR 1 (D16) and a rule version. |
| Blocking 5 (doctest) | **Accepted.** `passWithNoTests: false`, conditional package overrides, refusal on bypassing configs, setup inputs, non-empty discovery assertion. |
| Blocking 6 (consumers, acceptance) | **Accepted.** GithubChecks routes named; lefthook stays direct; lane ids preserved; summary freshness protocol; `<= 500 files` gate; package-verify scope corrected. |
| F1 | **Amended** as proposed; P4/P6 become C3.5 fixtures before ratification. |
| F4 | **Amended** as proposed. |
| D6 "retain Labs exclusions" | **Struck as a misread**: labs are a shard of both eslint lanes today, so the design keeps coverage equal; no expansion was proposed. The root-owned-files point stands and is applied (`//#lint:jsdoc:root`). |
| D13 | **Accepted**; the stricter-audit claim is withdrawn. |
| §4 duplicated lists | **Accepted**; §4 is now two shape examples and §2 is canonical. |
| §7 "REJECT deriving expected writer results from the rule table" | **Accepted**; literal contract tests stay. |
| "brief unknown" | The brief is the orchestrator prompt outside the repo; its out-of-scope list is now reproduced in §8. |
