# L1 — peripheral hosted verification audit

## Verdict

Remove redundant setup before narrowing proof. The best supported opportunity is the standalone Shadcn job: 79 runner-seconds in both sampled PR runs, while the same uncached task is already in Lint Policy. Security/SAST still install the workspace merely to dispatch external checks. Nix also installs it only to invoke two Nix commands. These are compute opportunities, not evidence that required-context p95 falls below ten minutes: the sampled jobs are already short and run concurrently with the long poles.

Vercel remains an unpriced potentially large surface. All three tracked configurations perform full installs and have no `ignoreCommand`; that does not prove dashboard ignore settings are absent or that all projects deploy on every PR. Do not rank three hypothetical builds as measured runner savings. The compiled binary saves pre-install gating cost today; it is not a general replacement for the head's verification implementation.

Read-only audit of `~/YeeBois/projects/beep-effect`, observed HEAD `16370d15737f2daddc10e43c4d00a42e09648ed6`, clean at observation. The shared checkout advanced beyond the inventory's `7a31078ddd3`. No tracked edits, installs, proofs, worktrees, or sibling Opus output used. #3005/#3007/#3014 are assumed merged and excluded from proposals. Source abbreviations: **C** = `packages/tooling/tool/cli/src/commands`; **W** = `.github/workflows`; **A** = `.github/actions`. Required means the 15 contexts in `standards/branch-protection-contexts.json`, captured October 27; this audit did not assert a fresh live ruleset snapshot.

## Measured this pass

Commands: file reads/targeted ripgrep; read-only git status/rev-parse/show/diff; `gh run list --workflow check.yml --event pull_request --limit 100 --json databaseId,createdAt,conclusion`; `gh api repos/beep-effect/beep-effect/actions/runs/<id>/jobs?per_page=100`; workflow run lists for side surfaces; `bun run beep yeet economics`. No bounded package execution was needed. Raw job and volume JSON are beside this report under `astra-l1-*`.

The 100 Check PR runs span November 8 16:49:31Z–November 9 16:33:53Z (23.739 hours): 21/79 by UTC date, 46 success, 12 failure, 42 cancelled. Burst extrapolation is 101.1 runs/day or 707.7/week, **not a representative weekly rate**. For ranking use 410.5 noncancelled runs/week (58% of that rate) as a conservative exposed-volume scenario; cancellation is not free, but its partial costs are unmeasured. Latest-100 truncation means neither day's count is a complete day census. Local economics confirms 188 publish and 157 verify attempts August 8–November 9, about 14.1/11.8 per week over 93 days. Fleet 2,596 is the brief's supplied all-mode total, not a multiplier for every lever. No local savings are credited below because no local installs occur in these hosted jobs.

Job wall is completed minus started, excluding queue; setup includes checkout, toolchain/dependency provisioning, binary fetch and native prerequisite setup. Percentages are approximate and do not count cache restores or external scanner image pulls as proof. CPU-seconds are unavailable: runner-seconds must not be relabelled CPU time. Skipped API jobs sometimes have -1-second synthetic durations; exclude them.

| Surface | PR run 42637312401 wall / setup seconds | PR run 42656046751 wall / setup seconds |
|---|---:|---:|
| Commitlint | 33 / 29 (88%) | 35 / 29 (83%) |
| Secret Scanning | 29 / 20 (69%) | 28 / 21 (75%) |
| Security | 61 / 34 (56%); install 14 | 85 / 45 (53%); install 23 |
| SAST | 93 / 44 (47%); install 23 | 89 / 40 (45%); install 22 |
| Nix Shell | 104 / 79 (76%) | 88 / 62 (70%) |
| Desktop IPC | 154 / 103 (67%) | 144 / 87 (60%) |
| Labs | 128 / 60 (47%) | 165 / 76 (46%) |
| Ecosystem Contracts | 85 / 59 (69%) | 86 / 68 (79%) |
| Codegen Drift | 22 / 18; body skipped | 74 / 59 (80%) |
| Shadcn Lint | 79 / 64 (81%) | 79 / 60 (76%) |

Additional observations (single samples, different events/heads):

- Storybook run **42662846392**, main push: 196s, checkout 22, setup 47, browser restore 3, Chromium install 10, lane body 102. Latest 100 runs: 76 PR and 24 push, all November 9. The sample is not a cold-browser timing or PR p95.
- Binary publish **42662846439**: 79s, checkout 20, setup 43, compile **2**, smoke 0, upload 9. Latest 68 runs since November 7: 68 pushes, 16/33/19 by date. The compile is cheap; building a release for every broad path match is the cost.
- Context probe **42656046409**: one 4s echo job, three skipped contexts.
- Skills replay **42612353311**: 90s, checkout 15 + setup 62 (86%), actual replay 4. Latest 100: 98 PR, two schedule; October 24–November 9. This is a truncated observation, roughly 41 PR replays/week if extrapolated over 17 calendar days.
- Windows pipe **40835632217**: collector 6s, Windows test 32s (27s test, 2s artifact download). No monorepo install.
- History notes **42339731476**: 75s, checkout 19 + setup 48 (89%), rebuild/check 2, push 3. Only one listed historical run.
- Cache warm **41311146014**: failed, 1,601s; checkout 19 + setup 26 (3%). Failure is not evidence warming is unnecessary; inspect failure before any implementation. Cache inspection **42333355378**: 186s, checkout 19, setup 26, native sandbox dependency 58, inspection 34, dependency diagnosis 44.
- Knowledge mint **42654877718**: 245s, checkout 72 + setup 60 (54%), mint 97, PR update 8. Weekly cadence already exists.
- Mistyped discovery queries for `cache-qualification.yml`, `cache-local-observation.yml`, `cache-protected-producer.yml` returned 404. Actual files are `cache-local-observe.yml`, `cache-producer.yml`, `cache-producer-prepare.yml`, `cache-producer-inspect.yml`, `cache-warm.yml`. No absent-workflow inference is drawn from those errors. Preparation has five listed dispatch runs; observation/producer timings remain unmeasured.

## Component map

Sources in each row identify executable contracts, not merely documentation. “None” for skip means retain execution every relevant event; non-required does not mean disposable, and Yeet may still wait on it.

| Component / required? | Actual proof, trigger and install | Sound skip / grain / local replay | Cost and lever |
|---|---|---|---|
| Vercel Storybook / no | `apps/storybook/vercel.json`: full frozen install then root `storybook:build`, output `storybook-static`; Git integration triggers/settings unknown | Affected dependency closure plus build config/toolchain/assets/env invalidation; never app-directory-only. No tracked ignore command. Deployment itself not replayed by verify/final-check | Vercel minutes unknown, not Actions minutes; L1-07 |
| Vercel OIP / no | `apps/oip-web/vercel.json`: delete root node_modules, temporary npx Bun install pinned by `.bun-version`, full install; second temporary npx Bun for `build:pwa` | Same closure requirement, include PWA assets and root/global inputs; deployment unknown | Unknown; L1-07; do not remove cleanup or merge temporary installs without build-parity proof |
| Vercel Todox / no | `apps/todox/vercel.json`: same full clean install; removes tsbuildinfo under five roots then Turbo build filtered to `@beep/todox` | Closure and global inputs; include generated/build-state semantics | Unknown; L1-07 |
| Storybook / no | W/storybook.yml PR/main; docs gate before install; Turbo affected selection after install, before browser setup. Cached Chromium by resolved Playwright version, trusted push writes only. C/Ci/CiLane.ts:1970–2055,1768: build, test:storybook, require index.html | PR only: no selected Storybook task; main executes. Existing graph probe already sounder than path-only gate. pre-push yes; final-check no dedicated lane | 196s main sample, setup 69s + browser 13s; L1-03 |
| Commitlint / **yes** | W/check.yml:1457: full blobless history, PR own-commit merge-base range, push before..head, fallback last. Node pin; tool-only npm install exact lock pins; config copied beside tools | No file skip: commit messages can violate on docs PR. Repo/commit-range grain. pre-push yes; final-check no | 33–35s; only 3–5s install, already optimized; no credible incremental install lever |
| Secret Scanning / **yes** | W/check.yml:1573: pinned Docker Gitleaks, no Bun/install. Base-owned config/ignore on PR, blob prefetch, git-log and nonvacuous-scan guards | Scan commit additions including docs; preserve history and base suppression policy. pre-push secrets lane exists, hosted guards are extra parity obligations; final-check no | 28–29s; retain, no counted lever |
| Security / **yes** | W/check.yml:1701: full script-free install for CLI; OSV v2.7 lockfile scan; PR dependency-review with fixture exclusions; ruleset/settings/held-group live checks | No lockfile-only skip: vulnerability DB and hosted settings are external changing inputs. pre-push security exists, not full hosted governance equivalent; final-check no | 61–85s; L1-02 removes dispatch install only |
| SAST / **yes** | W/check.yml:1821; C/Ci/CiLane.ts dispatch to Quality GithubChecks: Semgrep four registry packs + `.semgrep/first-party.yml`, error on findings. Full script-free install, no lifecycle/Node needed | Keep repo scan/config and registry semantics; path-only skips not admitted. pre-push yes; final-check no | 89–93s, install 22–23s; L1-02 |
| Nix Shell / **yes** | W/check.yml:1757: docs skip; PR flake/workflow/CiLane path gate before full monorepo setup. `nix --option warn-dirty false flake check --all-systems`, `nix ... develop --command echo 'Dev shell OK'`. flake.nix tools-only shell | Existing PR flake closure gate; main executes. Add workflow/dispatch/config inputs to any future refinement. pre-push yes; final-check no | 88–104s; L1-04 remove monorepo dispatch setup |
| Desktop IPC Stdio / **yes** | W/check.yml:1006: desktop/foundation/agents/workspace/shared/epistemic/pglite/postgres/root gate; rust relevance separately gates apt/cargo. Always provision rustc when IPC runs. `beep:test:integration:ipc`: build sidecar + real stdio Vitest; cargo check/clippy separately | Dependency closure including runtime sidecar/imports and migration inputs, not just app path. pre-push IPC yes, **cargo checks not in CiLane desktop-ipc**; final-check no | 144–154s; current native gates already save setup; L1-03 only after closure proof |
| Labs / no, permanently | W/check.yml:425; direct apps/labs/root/workflow gate controls full labs check/lint/test; coverage selection still runs for transitive dependents on every nondocs run, Node 22.23.4 + raw coverage upload | Never skip from labs path alone: empty owner selection must still produce correct run/head evidence. pre-push no dedicated Labs lane (root tasks may include labs); `ci local` does; final-check no dedicated Labs lane | 128–165s; L1-03, retain coverage census and artifact contract |
| Codegen Drift / **yes** | W/check.yml:408,262; C/Ci/CiLane.ts:1455,1600: four driver generate:check tasks (acp/ecfr/govinfo/runpod), desktop migration bundle from db-admin drizzle, merge-driver bootstrap assertion | PR input regex includes specs/scripts/generated/codegen-kit/CiLane/db-admin/migration/package/lock; main runs all. Must include indirect generator dependencies in refinements. pre-push exclusive yes; final-check no | 22s skip, 74s active; L1-03 setup only; no credit for already shipped regex |
| Ecosystem Contracts / no | W/check.yml:382,272: effect-drizzle Tstyche type tests + bundle-size probe; family/root toolchain/CiLane/workflow regex, no workspace src imports claimed by workflow | Package + toolchain/config closure; full main. `ci local` yes, no dedicated pre-push/final-check (package check already invokes type-test, not necessarily bundle probe) | 85–86s; L1-03 setup and routing proof |
| Shadcn Lint / no | W/check.yml:395; C/Ci/CiLane.ts:1765: uncached root lint:shadcn strict apps/packages scan. C/Quality/Tasks.ts:3705 includes identical task in both full and unscoped affected policy state | No scan removal; delete duplicate hosted execution only after same-head receipt parity. pre-push through policy, final-check through policy, no separate local job | 79s; L1-01 |
| job-context-contract-pr / no | W/job-context-contract-pr.yml invokes reusable static echo once active, once all-skipped; PR changes to check/heavy/contract files | Existing exact workflow path gate; do not substitute local YAML check for actual GitHub context behavior | 4s; retain, zero credited savings |
| skills-update-train / no | W/skills-update-train.yml: lock/patch PR => full vendored patch replay + report; clean Renovate-only guarded relock/materialize/check/push; Monday weekly batch issue | Per-skill selection only after lock/patch/license/materialization closure proof. No skipping unclean replay; preserve head/author/foreign-commit guards | Replay 90s, setup 77; L1-06 |
| hub-pipe-security / no | W/hub-pipe-security.yml Windows deploy path or workflow PR/main; sparse Linux collector -> Windows test-send-token.ps1 same-user and foreign-owner tests | Existing deploy path gate; preserve both adversarial cases and platform | 38 runner-seconds sum; retain, negligible setup lever |
| history-notes-publish / no | Map-only main push + dispatch; full-history notes write and published check, notes-ref-only push; full install | Exact map idempotence already present; preserve reachability/full history and sole writer | 75s; L1-06 not PR target |
| cache-warm / no | Twice monthly + dispatch; heavy runner; build/check/lint then bounded tests through `beep cache warm`; optional exact reviewed-main R2 probe | Do not turn receipt into verdict, cache coverage, broaden PR writers, or suppress cold repair without evidence | 26.68min failed observation; retain cadence, no quantified savings |
| cache-producer-inspect / no | Main-only dispatch via heavy.yml: bounded source/tool/dependency diagnostic, native sandbox, one-day artifacts | Dispatch already opt-in; never auto-start paused qualification | 3.10min sample; no PR saving |
| cache-producer-prepare / no | Main-only dispatch via heavy.yml: isolated pinned Rust/portable build/ELF candidate, digest evidence, cleanup | Preserve independent candidate approval, exact inputs; not routine PR work | Five runs listed, duration unmeasured; no PR saving |
| cache-producer / no | Main-only dispatch, stable/canary separately approved signed candidate/runtime/issuer, sandbox, bounded public digest, private cleanup | Do not share capability-bearing setup with ordinary jobs | Unmeasured; no PR saving |
| cache-local-observe / no | Main-only dispatch, approved channel, types/identity lint recipes, sandboxed no-capability local observation, digest/count report | Preserve opt-in bounded recipes | Unmeasured; no PR saving |
| knowledge-baseline-mint / no | Weekly Monday + dispatch; history-aware mint sole writer, App identity, sealed baseline-only PR, byte remint checked later | Cadence already reduced; no source-only skip for lineage/clock-sensitive baseline | 245s; L1-06 limited install optimization, no PR savings |
| beep-ci-binary / no | W/beep-ci-binary.yml: main push broad CLI/library/foundation/drivers/lock/Bun paths or dispatch; full install; compile slim bootstrap, smoke/checksum, immutable main release | Input-closure equivalence could suppress unrelated release builds, never consumer verdicts. No PR publish; pinned fetch before setup | 79s, 80% checkout/setup; L1-05 |

## Ranked levers

Ranking uses expected weekly saved runner-minutes plus local wall, divided by a transparent risk weight (low=1, medium=2, high=4). These weights are ordinal prioritization assumptions, not probabilities. Eligibility fractions below are **guesses**, because two active PR samples cannot establish the week's routing mix. Central estimates use 410.5 noncancelled-equivalent runs/week; upper burst exposure is 707.7. Scores are not additive forecasts. Required critical-path credit is zero until measured on paired runs including queue time; reducing aggregate runner occupancy may help queueing, but that is not quantified.

### 1. L1-01 — Remove the duplicate hosted Shadcn execution

- **Area/mechanism:** L1; remove W/check.yml's standalone non-required Shadcn job once policy receipts prove identical `lint:shadcn` execution. Keep C/Quality/Tasks.ts policy task and local replay unchanged; adjust workflow inventory/contract fixtures.
- **Grain:** repo. Same full strict scan remains; no file selection or merged oxlint config.
- **Savings:** derived **0.92 hosted runner-min/PR run** = 79/60 × guessed 70% active eligibility; range 0–1.32. Required critical path **0**, local publish **0**, verify **0**. Weekly 378min / risk 2 = **189 score**. CPU unmeasured.
- **Trust risk:** medium. Policy can be held, skipped or fail before Shadcn, leaving the old independent early verdict absent. Gate landing on verified policy execution for every previously active profile, same head/config/command and injected finding; retain standalone context if that cannot be demonstrated. A blocked policy must never become green by omission.
- **Admission gate:** parity ledger plus mutation fixture, including full/affected/docs/hold/fork/main cases. No timing-only admission.
- **Prior art:** local duplicate removed in R6, GithubChecks.ts:428; rejected merged oxlint P35 remains rejected (rejected-questions-gaps lines 53,59). This is a remaining hosted duplicate, not a repeat of local savings.
- **Dependencies/slices:** depends on policy ownership, no dependency on excluded PRs; one M PR “Retire duplicate hosted Shadcn after parity” touching workflow, inventory/tests/receipts. Do not merge without the parity record.
- **Confidence/open question:** high duplication, medium savings. Does every held/profile route preserve the desired independent signal? Reuse this estimate with area E, do not sum twice.

### 2. L1-02 — Remove installs used only for security dispatch

- **Area/mechanism:** L1; W/check.yml Security/SAST; extract the exact platform-only dispatch/governance commands from C/Quality/internal/GithubChecks.ts and Ci into the slim binary surface, preserving shared command implementation. Compare reviewed bootstrap semantics with head implementation; mismatch must fall back to head install/execution, never silently use old logic.
- **Grain:** repo and live external state; all existing scans and live policy reads still execute.
- **Savings:** derived **0.60 hosted runner-min/PR** (14–23 + 22–23 seconds installs, less 1–2s fetch; range ~0.57–0.75). Required critical-path **0** credited, although these contexts individually shorten; local publish/verify **0**. Weekly 246 / risk 2 = **123 score**. CPU unmeasured.
- **Trust risk:** medium. Stale pinned scanner argv, fixture exclusions, policy thresholds or remote reads can miss a red. Use exact source/input compatibility and conservative fallback; OSV registry freshness and all governance reads remain per run.
- **Admission gate:** parity ledger (argv/env, red exits, API unavailable, fixture-exclusion, Semgrep planted findings, fork semantics); A/B setup timing controls. Not verdict caching.
- **Prior art:** script-free installs already shipped; Commitlint K4 and Secrets no-install are precedents, not new savings. No rejected dependency archive restored.
- **Dependencies/slices:** two M PRs: extract shared slim dispatch; publish reviewed main asset then separate consumer pin/compatibility migration. Coordinate binary ownership/L1-05, but do not require narrowing producer triggers first.
- **Confidence/open question:** medium. Can governance imports be isolated without a large binary or an effectively second CLI? Decline if extraction expands trust surface beyond saved setup.

### 3. L1-03 — Pre-install dependency-aware selection for peripheral lanes

- **Area/mechanism:** L1; W/storybook.yml and check.yml Labs/IPC/Codegen/Ecosystem; reuse the existing route machinery, extending it with complete package/config closures. Start with Storybook's Turbo plan and a minimal pinned tool-only selector, not a new path regex. If Bun/Turbo cannot resolve the workspace without full install, use a generated, parity-proven closure consumed by the existing route, or retain the install. Return unknown as run.
- **Grain:** affected-set. Shared imports, root toolchain, generated inputs, assets and test setup must select dependent apps. Labs empty-selection path must emit a valid same-run/head empty artifact that Coverage Regression accepts; never bypass coverage ownership validation.
- **Savings:** guess **0.25 hosted runner-min/PR**; scenario 30% avoid one 50s setup. Range 0–0.8 depending on real eligibility and selector overhead. Critical path/local publish/local verify **0**. Weekly 103 / risk 2 = **51 score**. No credit for already existing Codegen/Ecosystem/IPC path skips or cached Chromium.
- **Trust risk:** medium (high until closure fixtures pass). Missing transitive dependency yields stale green or absent raw counters. Required Codegen/IPC contexts must remain explicit skip-satisfied, not disappear.
- **Admission gate:** route replay + mutation fixtures, 100% required recall; compare selector to full Turbo/workspace plan and coverage census; A/B net install savings after selector cost.
- **Prior art:** Storybook dependency-aware probe is already shipped (PR #1054 comment), browser selection precedes provisioning; route inventory has only one enforced refinement. Rejections against changed-packages-only propagation and path-only AST shortcuts still bind.
- **Dependencies/slices:** M Storybook-only prototype; separate M Labs artifact-preserving selection only after coverage owner review; optional later S/M peripheral closure refinements. Depend on package-aware route area I, not another scheduler. No #3005/#3007/#3014 re-proposal.
- **Confidence/open question:** low-medium. Install-free Turbo semantics and empty coverage cost need proof; stop if selector costs exceed setup saved.

### 4. L1-04 — Run Nix without installing the JavaScript workspace

- **Area/mechanism:** L1; W/check.yml Nix setup and C/Ci/CiLane.ts Nix command definitions. Run same two commands through a shared slim dispatch with compatibility guard, or a generated workflow command projection with drift check; retain Nix/Cachix and full history/routing.
- **Grain:** repo/flake closure; existing PR skip remains, all main pushes still run.
- **Savings:** derived active-run 0.60–0.87min, central 0.73; guessed 10% active PR mix => **0.073 hosted runner-min/PR**, weekly 30 / risk 1 = **30 score**. Required critical path/local publish/verify **0**. Main savings extra, not included in PR estimate.
- **Trust risk:** low. Divergent command arguments or shellHook expectations. Preserve `--all-systems`, exact shell probe, inherited env and errors; flake currently reads no repository runtime inputs.
- **Admission gate:** parity ledger + broken flake/shell fixture; A/B measurement. This is execution setup removal, not narrower Nix proof.
- **Prior art:** flake-input regex already shipped; inventory calling Nix always-on is outdated. No shallow checkout/cache change.
- **Dependencies/slices:** S/M “Decouple Nix proof from workspace install”, workflow plus shared command/projection tests; can share L1-02 bootstrap work without counting its savings twice.
- **Confidence/open question:** high active-run opportunity, low active fraction. Measure actual Nix selection rate before prioritizing against L1-03.

### 5. L1-05 — Build CI release assets only when their reachable inputs change

- **Area/mechanism:** L1; W/beep-ci-binary.yml broad triggers; C/Ci/CiBinary.ts, CiBootstrap.command.ts and bin-ci.ts. Gate expensive setup/compile on a complete source+dependency input digest compared with last published artifact provenance; retain dispatch repair. Only asset production is suppressed; no main Check verdict is cancelled.
- **Grain:** affected-set (binary import closure plus compiler/lock/config/package metadata), conservatively run on unknown.
- **Savings:** **0 hosted runner-min per PR run** directly. Derived 1.32min per avoided main binary build. With observed 68/3 calendar days ×7 ≈159 builds/week and guessed 50% irrelevant, ~105min/week / risk 4 = **26 score**. Calendar-day normalization includes partial days; not measured sustained rate. Required critical path/local publish/verify **0**.
- **Trust risk:** high before closure qualification: stale asset omits bootstrap fixes. Never key on entrypoint alone, and never auto-pin an unreviewed asset. Existence of an asset is not proof that consumers use it.
- **Admission gate:** route replay + mutation fixtures across transitive modules, lock/Bun/compiler/config; source-to-artifact provenance; compatibility tests of current head against pinned consumer.
- **Prior art:** November 7 release-asset decision requires separate pin PR; preserve it. No dependency cache or PR-built gate binary proposed. Current pin `beep-ci-d15ecf4ca610` dates Nov 7 19:21:05Z, about 46h old at measurement, despite newer published assets. Current service diff is deterministic apt-list sorting; patterns changed but the pinned service already loads checkout pattern JSON. Therefore age alone **does not prove stale classification**. Current binary also adds cache bootstrap commands: capability parity needs explicit inspection, not just pattern comparison.
- **Dependencies/slices:** M provenance/closure PR; separate S producer selection PR after replay. No automatic pin churn per main commit.
- **Confidence/open question:** high measured production cost, low unnecessary-build fraction. Source closure may be broad enough that most current triggers are warranted.

### 6. L1-06 — Use minimal head-derived installs for administrative workflows

- **Area/mechanism:** L1; W/skills-update-train.yml first, then history-notes-publish and knowledge-baseline-mint. Isolate actual CLI import closure with a frozen, script-free/scoped install where supported. Keep head semantics for replay/mint; do not use a stale binary to write canonical state.
- **Grain:** package/import closure; preserve full repo/history inputs of the checks and all author/seal/write protections.
- **Savings:** guess **0.03 hosted runner-min/PR** averaged over all Check PRs, approximately 12min/week from ~41 skill PRs/week ×0.3min net setup saved; risk 2 => **6 score**. Conditional replay upper setup opportunity is 62s, but no measurement establishes how much a scoped install removes. History/mint occur outside PR proof and add unknown small weekly savings. Critical path/local publish/verify **0**.
- **Trust risk:** medium. Hoisted imports, prepare hooks, patch tools or generated bins absent; canonical writer output changes. Preserve exact replay, relock, materialization, seal re-mint and full-history assertions; fallback full install on incomplete closure.
- **Admission gate:** parity ledger of emitted bytes and rejection cases + A/B install timings. Cache qualification only if a result cache is subsequently proposed (none here).
- **Prior art:** Commitlint tool-only pattern exists but cannot simply be copied to Effect CLI imports; dependency filter feasibility is explicitly open in inventory H. Weekly mint cadence already shipped. No consolidation of privileged signed producer jobs.
- **Dependencies/slices:** M skills replay proof and installer isolation; later independent S/M history/mint after measured gain. Coordinate dependency-area scoped-install experiment; count once.
- **Confidence/open question:** low savings, medium scope. Does full installation already outperform filtered installation under hoisted linker? Retain full setup if so.

### 7. L1-07 — Admit Vercel ignore decisions from the complete app dependency closure

- **Area/mechanism:** L1; three app vercel.json files and shared reviewed selection command. First retrieve authorized deployment receipts and project Git/build settings; then add ignoreCommand only for proven unaffected PR previews. Fail open to build on missing base, graph/env/config ambiguity. Keep production deployment behavior and app build commands unchanged.
- **Grain:** affected-set, including transitive packages, lock/toolchain, public/PWA/static assets, generated inputs and environment configuration changes; app-directory globs are unsound.
- **Savings:** **unknown Vercel build-min/PR**, formula sum over apps of skip probability × (install + build minutes) minus selector overhead. **0 Actions runner-min credited**; critical path/local publish/verify **0**. Weekly score **unrankable**, placed last until receipts; not assumed lower real value than other levers. CPU unknown.
- **Trust risk:** medium. A missing graph/config edge cancels a needed preview and hides build failure; no installation cache proposed. Preserve a visible ignored-deployment reason, exercise all app closure mutations, and distinguish Git ignore from post-install Turbo no-op.
- **Admission gate:** route replay + mutation fixtures against real deployment history, then A/B measurement; CI build parity does not establish environment-specific Vercel parity.
- **Prior art:** no ignoreCommand in tracked configs; rate-limit exemption is a merge policy, not proof deployments are redundant or expensive. Clean node_modules/tsbuildinfo steps may encode prior correctness repairs and remain.
- **Dependencies/slices:** S read-only deployment/settings census, then one M shared selector and app-specific S rollouts. No purchases or new paid endpoints.
- **Confidence/open question:** high tracked-config observation, low trigger/cost knowledge. Dashboard settings and accessible deployment telemetry are needed before a numerical business case.

## Rejected mechanisms considered

- Reinstall/cache the full Bun dependency archive: rejected on measured restore economics (inventory K, rejected-questions-gaps lines 81,118). No new evidence here reopens it.
- A shallow history clone for Commitlint/Secrets/history notes: merge-base/reachability and nonvacuous scanning remain required (lines 84,116). Blobless checkout is already deployed, not a new lever.
- Disable OSV/SAST on docs or unchanged lockfiles: external advisory/rule state can change. No trust-policy exemption was authorized.
- Remove required contexts from a selected matrix: rejected line 94; explicit successful skip receipts stay mandatory.
- Cache coverage or bypass Labs on direct paths only: violates run/head raw-counter evidence and transitive coverage ownership. Existing direct Labs checks gate is not authority to skip its coverage producer.
- Merge all oxlint/Shadcn configurations: P35 rejected for scope leakage and replay-contract breakage. L1-01 retains the exact existing task.
- Remove Rust provisioning from non-Rust IPC changes: rustc target discovery is a runtime dependency of sidecar build/tests, explicitly documented in check.yml. Only apt/cargo are currently gated separately.
- Rebuild PR bootstrap gates from unreviewed PR head or auto-update binary pins: defeats reviewed-main gate provenance. Static pin age alone is not a measured stale-green.
- Suspend cache warm, native pilots or knowledge mint because they are non-required: no evidence that consumers are absent; native qualification is opt-in/paused and must not be restarted by this audit. The failed warm run needs attribution, not cancellation of the service.
- Reduce test corpus, property floors, coverage floors, doctest scope, main verdict frequency, or review window; add a scheduler; increase paid capacity: outside scope or explicitly rejected. No such savings counted.

## Contradictions with the inventory

1. “Every hosted job does a full unscoped frozen install” is false at live HEAD and even sampled runs: Commitlint installs two pinned tools; Secrets and context/Windows jobs install no workspace. Security/SAST install with scripts disabled. Do not budget a 44–62s full install for every row.
2. “Always-on ... Nix” is false: docs job gate plus explicit flake/workflow/CiLane PR regex, before setup. Main always runs. Required context presence remains a contract to test separately from execution.
3. Chromium is not downloaded on every Storybook run: version-keyed restore precedes install, and affected selection precedes both. Current main example browser restore+install is 13s, not the cost of a cold 290MB browser fetch. Remaining selector setup is 47s in that sample.
4. IPC's 103/154s setup is reproducible for the first sample, but second is 87/144; 70–90% is not a universal setup share (Labs ~46–47%, Security ~53–56%).
5. Final-check does not replay every hosted gate. Codegen, desktop IPC and Storybook are explicit pre-push lanes but absent as dedicated final-check gates; Ecosystem/Labs occur in `ci local`, not dedicated pre-push lanes. Hosted Desktop additionally runs cargo check/clippy outside CiLane. Local-security naming also does not establish hosted governance parity.
6. The binary does not execute current TS implementation just because the checkout changed. It reads checkout patterns already at the pinned revision; semantic/capability changes require compatibility checks or pin updates. Its build cost is mostly install, not compilation.
7. Side workflows mix PR verification, scheduled writers, manual research pilots and artifact production. Counting every one once per PR overstates cost. Vercel minutes cannot be silently added to GitHub runner-minutes.
8. Shared HEAD changed during the wider audit; report source state and sampled historical runs separately. No paired speedup/p95 claim follows from these samples.

## Operator-only questions

None blocks the read-only findings or the first parity experiments. Existing rulings settle target, scheduler, proof floors and money. Do not ask permission to remove installation waste after parity passes. If Vercel receipts require a new paid endpoint or higher plan, that spend is operator-only; this report assumes neither. Whether to reduce the assurance cadence or change required contexts would be a separate policy decision, and is deliberately not proposed. Implementation questions (closure completeness, selector net cost, available telemetry, exact same-head parity) belong to agents, not an operator questionnaire.

```json
{
  "area": "L1 peripheral hosted surfaces",
  "levers": [
    {
      "id": "L1-01",
      "title": "Remove duplicate hosted Shadcn execution",
      "grain": "repo",
      "savings": {
        "hostedRunnerMinPerPrRun": 0.92,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "derived"
      },
      "trustRisk": {
        "level": "medium",
        "failureMode": "Policy profile or hold can omit the sole remaining scan"
      },
      "admissionGate": "parity ledger + mutation fixture",
      "confidence": "medium"
    },
    {
      "id": "L1-02",
      "title": "Remove security dispatch-only installs",
      "grain": "repo",
      "savings": {
        "hostedRunnerMinPerPrRun": 0.6,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "derived"
      },
      "trustRisk": {
        "level": "medium",
        "failureMode": "Pinned dispatcher misses head policy changes"
      },
      "admissionGate": "parity ledger + A/B measurement with controls",
      "confidence": "medium"
    },
    {
      "id": "L1-03",
      "title": "Select peripheral dependency closures before install",
      "grain": "affected-set",
      "savings": {
        "hostedRunnerMinPerPrRun": 0.25,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "guess"
      },
      "trustRisk": {
        "level": "medium",
        "failureMode": "Missing transitive inputs or invalid empty coverage evidence"
      },
      "admissionGate": "route replay + mutation fixture",
      "confidence": "low-medium"
    },
    {
      "id": "L1-04",
      "title": "Run Nix without workspace installation",
      "grain": "repo",
      "savings": {
        "hostedRunnerMinPerPrRun": 0.073,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "derived"
      },
      "trustRisk": {
        "level": "low",
        "failureMode": "Hosted and local Nix argv diverge"
      },
      "admissionGate": "parity ledger + mutation fixture",
      "confidence": "medium"
    },
    {
      "id": "L1-05",
      "title": "Gate binary releases on complete build inputs",
      "grain": "affected-set",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "derived"
      },
      "trustRisk": {
        "level": "high",
        "failureMode": "Incomplete build closure suppresses necessary bootstrap release"
      },
      "admissionGate": "route replay + mutation fixture",
      "confidence": "low-medium"
    },
    {
      "id": "L1-06",
      "title": "Minimize administrative workflow installs",
      "grain": "package",
      "savings": {
        "hostedRunnerMinPerPrRun": 0.03,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "guess"
      },
      "trustRisk": {
        "level": "medium",
        "failureMode": "Missing hoisted or generated dependencies alter writer output"
      },
      "admissionGate": "parity ledger + A/B measurement with controls",
      "confidence": "low"
    },
    {
      "id": "L1-07",
      "title": "Add dependency-aware Vercel preview ignore decisions",
      "grain": "affected-set",
      "savings": {
        "hostedRunnerMinPerPrRun": 0,
        "criticalPathMinPerPrRun": 0,
        "localWallMinPerPublish": 0,
        "localWallMinPerVerify": 0,
        "basis": "guess"
      },
      "trustRisk": {
        "level": "medium",
        "failureMode": "Unmapped app or environment dependency suppresses necessary deployment"
      },
      "admissionGate": "route replay + mutation fixture",
      "confidence": "low"
    }
  ]
}
```
