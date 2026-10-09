# Sweep A-retire — Workstream A removal inventory

## Provenance

- Head: `e62411d63f` (= `origin/main`), read in lane checkout `beep-effect3-worktrees/rsc-packet`
  (branch `docs/repository-simplification-confidence-packet`). Local residue was also read in the
  primary clone `~/YeeBois/projects/beep-effect3` and the sibling clones `~/YeeBois/projects/beep-effect*`.
  `goals/repository-simplification-confidence/**` was excluded.
- Date: 2026-10-09. Read-only sweep. No checkout files were written and no install, turbo, knip, fallow,
  or test run was started.
- Commands used: `git grep -n -I [-i] <term> -- . ':!goals/repository-simplification-confidence' ':!bun.lock'`,
  `git ls-files`, `git check-ignore -v`, `git log -- <path>`, `rg`, `find`, `ls`, `du`, `sha256sum`, `jq`
  (on `standards/knip.regression-baseline.jsonc`, `harness-ledger/rows/*.jsonl`, `package.json`), and
  `gh api repos/<repo>/rules/branches/main` (read-only, one call).
- Classification key: **remove**: delete it, or edit the live reference out. **keep-as-history**: an immutable
  or historical record (goal/exploration packets, `research/`, `.changeset/`, decision logs, CI corpora) that
  stays unedited. **preserve-compact-record**: carry a short conclusion forward before the source is deleted.
  **regen**: a generated artifact that changes by rerunning its writer, never by hand.

Historical reference counts (files, keep-as-history unless a row says otherwise):

| Surface | goals/ | explorations/ | other history |
|---|---|---|---|
| Knip | 408 | 2257 (2220 under `explorations/beep-ci-operational-ontology` CI corpora) | `.changeset/` 7, `standards/memory-architecture/04-decision-log.md:418` |
| SkillOpt | 113 | 42 | `research/` 2, `harness-ledger/rows/` 2 files |
| Impeccable | 43 | 86 | `.changeset/` 2, `research/` 1 (`research/2026-08-28/REPORT.md`, `research/2026-09-23/{REPORT.md,claims.jsonl}`) |
| Serena | 7 | 5 | — |
| plugins/* | 2 | 2 | — |
| `.ai/mcp` | 2 | 6 | — |

---

## 1. SST residue

There is no SST dependency: `bun.lock` has 0 `sst` entries and `package.json` has no `sst` key. `infra/` is
Pulumi (`infra/Pulumi.yaml`), with no SST wiring, so it is preserved.

| Ref | Class | Note |
|---|---|---|
| `.gitignore:107-109` (`# SST`, `.sst/`, `sst-env.d.ts`) | remove | Brief calls these obsolete ignores. Remove them only after the local residue below has been deleted, because the residue files become untracked noise once unignored. |
| `packages/tooling/policy-pack/repo-configs/src/eslint/DeprecatedApisESLintConfig.ts:24` (`".sst/**"` in `generatedAndBuildOutputIgnores`) | remove | Inactive ESLint ignore glob. |
| `packages/tooling/policy-pack/repo-configs/src/eslint/DocsESLintConfig.ts:76` (`".sst/**"`) | remove | Same. |
| `standards/git-worktrees.md:386` ("`.turbo`, `.sst`, `.beep`, and `node_modules` are intentionally local") | remove (edit the word out) | Live standard. |
| `docs/runbooks/aws-cost-operations.md:194` ("old Terraform/SST state and lock tables") | keep-as-history | Records disposal of AWS resources, not wiring. |
| `goals/lint-policy-single-digit/research/p2-artifacts/oxlintrc-deprecated-apis.jsonc:20`, `goals/time-to-certainty/research/c3-sublane-inputs.md:945,1022` | keep-as-history | |
| `packages/foundation/modeling/html/data/iana/language-subtag-registry.txt:33295`, `.../Html.language-tag-registry.generated.ts:6927`, `explorations/_gold-intake/...` | not SST | The language subtag `sst` and an "SST/Anomaly" vendor mention. Leave them alone. |
| Local residue (ignored, untracked) | remove | Primary clone: `sst-env.d.ts`, `scratchpad/sst-env.d.ts`, `packages/_internal/db-admin/sst-env.d.ts`. `beep-effect2`: 10 files (`sst-env.d.ts` at the root, in `scratchpad/`, in `scripts/`, and in 7 packages). Two out-of-repo worktrees also hold `sst.config.ts`: `~/YeeBois/projects/beep-effect-worktrees/{ai-metrics-p6-proof,playground}/sst.config.ts`. Those belong to another clone's lanes; report them and do not touch them. |

Gate side effects: editing the two ESLint configs changes `//#lint:policy-fingerprint` inputs (`turbo.json:185-200`).
Regenerate `standards/policy-tools.fingerprint.json` and `standards/cache-qualification-baseline.json` with their
writers. Do not hand-edit them.

## 2. `map.html`

- Tracked: no (`git ls-files map.html` = 0). Ignored by `.gitignore:41` (`map.html`, under the `# Client` block
  next to `stats.html:40`).
- Present only in `~/YeeBois/projects/beep-effect2/map.html`: 4,949,263 bytes, dated 2026-08-17, title
  "fallow map: beep-effect2" (Fallow viz output). Absent from `beep-effect3` and from every other
  `beep-effect*` clone checked.
- There are no tracked consumers. Every `map\.html` grep hit is a substring match (`repomap.html`,
  `*-sitemap.html`, `goals/agentic-professional-runtime/docs/vision-map.html`).

| Ref | Class | Note |
|---|---|---|
| `~/YeeBois/projects/beep-effect2/map.html` | remove (local residue) | Delete it in that clone. Check that clone's ownership first, because it hosts a live peer session (build-pipeline). |
| `.gitignore:41` | decision (see Open questions) | Recommendation: keep the line as a cheap guard, since `fallow viz` can regenerate a 4.9 MB file at the root, and re-comment it as Fallow viz output. Removing it is also consistent with the brief. |

## 3. Knip (remove completely)

Facts: `knip@6.40.0`, patched. **"Knip" is a required status check on `main`.** `gh api .../rules/branches/main`
lists `Knip` among 16 required contexts. The `CiLane.ts:509-512` descriptor also declares
`required: true`. The ruleset edit (workstream E, hosted) has to land with the job removal or before it.
Otherwise every PR stays blocked waiting for a context that no longer reports.

Known findings to transfer first: `standards/knip.regression-baseline.jsonc` holds exactly the 41 findings
(`check.total_findings: 41`): exports 32, files 5, types 2, devDependencies 1, unresolved 1. The non-export rows:

- files: `packages/drivers/govinfo/src/_generated/Govinfo.gen.ts`, `packages/foundation/primitive/data/src/internal/data/{currency-codes.ts,index.ts,timezones.ts}`, `packages/foundation/primitive/data/src/internal/index.ts`
- types: `packages/drivers/wink/src/internal/bm25.ts#BM25Accessor`, `packages/tooling/library/codegen-kit/src/internal/format.ts#Formatter`
- devDependencies: `packages/drivers/freshbooks/package.json#@beep/test-utils`
- unresolved: `packages/drivers/freshbooks/tsconfig.test.json#bun-types`
- exports (32): concentrated in `packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts` (8), `packages/tooling/library/codegen-kit/src/internal/transforms.ts` (5), `packages/drivers/box-provisioning/src/internal/canonical.ts` (3), `Research/internal/*` (5), and singletons in box, occt (2), pdf-tools, colors, ai-metrics, Docgen, HarnessLedger (2), Lint, and Yeet.

Get the full list with `jq -r '.findings[]|[.kind,.file,.name]|@tsv'` on the baseline (strip comments first).

### Dependency, patch, scripts

| Ref | Class |
|---|---|
| `package.json:192` catalog `"knip": "^6.40.0"` | remove |
| `package.json:293` devDependency `"knip": "catalog:"` | remove |
| `package.json:358` patchedDependencies `"knip@6.40.0": "patches/knip@6.40.0.patch"` | remove |
| `package.json:418` script `"knip": "knip-bun"` | remove |
| `package.json:461` script `"knip:check": "bun run beep quality knip"` | remove. The scripts block is generated, so run `bun run beep lint package-scripts --write` rather than hand-editing it (AGENTS.md law). |
| `patches/knip@6.40.0.patch` (374 B, a `.ts` → `.tsx` `extensionAlias` fix in `dist/util/resolve.js`) | remove |
| `bun.lock` entry names: `knip`, `knip/oxc-parser`, `knip/oxc-parser/@oxc-project/types`, `knip/oxc-parser/@oxc-parser/binding-*` (25 lines total, plus `bun.lock:36,3471,3708`) | regen (`bun install` in the implementing lane) |
| `syncpack.config.ts:138` comment ("knip 6 parses with oxc") | remove / reword |
| `knip.jsonc` (10,565 B) | remove |
| `standards/knip.regression-baseline.jsonc` | preserve-compact-record (the 41 findings above), then remove |

### Turbo / CI / hosted

| Ref | Class |
|---|---|
| `turbo.json:893-920` task `//#knip:check` (inputs include `knip.jsonc`, `standards/knip.regression-baseline.jsonc:917`) | remove |
| `turbo.json:194` `knip.jsonc` in `//#lint:policy-fingerprint` inputs | remove |
| `.github/workflows/check.yml:858-880` job `knip` (name `Knip`, `bun run beep ci lane knip`) | remove |
| GitHub ruleset for `main`: required context `Knip` | remove (hosted, workstream E; sequence it with the job removal) |

### repo-cli source (`packages/tooling/tool/cli/src/**`)

| Ref | Class |
|---|---|
| `commands/Quality/internal/KnipRatchet.ts` (592 lines, whole file) | remove |
| `commands/Quality/Quality.command.ts:3768-3787` `knipCommand`, `:4447-4448` help lines, `:4473` registration | remove |
| `src/test/Quality.test-kit.ts:80` `export * from ".../KnipRatchet.ts"` | remove |
| `commands/Quality/internal/GithubChecks.ts:110` (JSDoc example), `:322-329` `knipLane`, `:377` (pre-push tier), `:828` (cheap-gates tier) | remove. Pick a different lane id for the `:110` example. |
| `commands/Quality/internal/TurboConfigProof.ts:58` `"//#knip:check"` | remove |
| `commands/Ci/CiLane.ts:214`, `:509-515` descriptor, `:1599` step, `:2184` JSDoc example, `:2408`, `:2527`, `:2603` | remove. Replace the examples. |
| `commands/Lint/Lint.command.ts:874` `knip.jsonc` in policy-fingerprint `rootConfigs` | remove |
| `commands/Yeet/internal/GateStaleness.ts:334-337` gate `knip-ratchet` | remove |
| `commands/Yeet/internal/IssueClassification.ts:267-270` `quality:knip` classifier | remove |
| `commands/Yeet/internal/WaveOrder.ts:286-287` `policyHostedRow("quality:knip", …)`, `:490` `laneRowCost` | remove |
| `commands/Yeet/internal/Status.ts:146-147,728,2097` (JSDoc examples using `quality:knip`) | remove (swap the example lane id) |
| `commands/DeletePackage/DeletePackage.command.ts:455` "Knip baseline" writer step; `DeletePackage.schemas.ts:307` example | remove |
| `internal/cli/RegistrationGeometry/RegistrationGeometry.plan.ts:142-154` writer `knip-baseline`; `RegistrationGeometry.schemas.ts:47` literal `"knip-baseline"` | remove |
| `internal/ratchet/RatchetDiff.ts:8-10,41` and `RatchetLifecycle.ts:6,53,55` (doc comments citing Knip) | reword. `diffMembership` is shared, so keep it. |
| `commands/CreatePackage/CreatePackage.command.ts:502,1743,1802,1826,1894,1901,2085` (comments justifying template deps "because Knip …") | reword. The template behaviour stays. Re-justify it or prune any dependency that only existed to satisfy Knip. |

### Tests and fixtures

| Ref | Class |
|---|---|
| `test/quality-tasks.test.ts:50,90,94` imports; `:3598-3640` two Knip-only tests ("normalizes Knip findings…", "compares Knip findings…") | remove |
| `test/quality-tasks.test.ts:1015,1041,1078,1133-1136` (lane lists/tiers expecting `quality:knip`) | update |
| `test/quality-tasks.test.ts:6548` (`planCoverageAffectedScope` input path) | update (use another path) |
| `test/ci-lane.test.ts:1450-1459` ("routes Knip and Fallow tasks…"), `:1835-1845` | update. Keep the Fallow half. |
| `test/ci-lane-timings.test.ts` (8 hits), `test/gate-order-handoff.test.ts` (2), `test/root-tasks-turbo-inputs.test.ts:82,120`, `test/package-scripts.policy.test.ts:302`, `test/yeet-gate-staleness.test.ts:129,206`, `test/yeet-status-triage.test.ts` (5), `test/yeet-settle.test.ts`, `test/yeet-status-chain.test.ts`, `test/yeet.test.ts`, `test/yeet-command-wiring.test.ts`, `test/proof-shadow.test.ts`, `test/create-package*.test.ts`, `test/delete-package.test.ts` | update |
| `test/fixtures/yeet-merge-gate/rules.json:29` (`"context": "Knip"`), `check-runs.json:256`, `test/fixtures/yeet-publish-plan/prove-first-plans.json` | update. These are recorded GitHub snapshots: either keep them as fixtures or drop the row, but keep the assertions consistent. |
| `apps/labs/ciops/test/fixtures/gate-order-handoff-v1.json:204,539-547`, `apps/labs/ciops/test/fixtures/lane-plan-v1.ttl:163` | decision. These are versioned (`-v1`) lab fixtures, so keep them as history unless the lab's tests derive them from the live lane list. |

### Generated / standards / docs

| Ref | Class |
|---|---|
| `standards/policy-tools.fingerprint.json:9` | regen |
| `standards/cache-qualification-baseline.json:1914-1947,2593` | regen |
| `standards/coverage.regression-baseline.jsonc:26406` (row for `KnipRatchet.ts`) | regen through the coverage baseline writer once the file is gone |
| `standards/schema-catalog.generated.jsonc` (28 hits, KnipRatchet schemas) | regen |
| `standards/fallow.pilot.inventory.jsonc:12-19,113-136` (`knipRole: reference-analyzer-parity-gate`, parity criteria) | update. The parity premise is retired by the brief: record "Knip retired 2026-10, narrower detection accepted" and drop the parity gate fields. |
| `.fallowrc.jsonc:110` ("Knip remains authoritative for unmigrated workspace/binary policy") | remove / reword |
| `AGENTS.md:214` (example lane id `quality:knip`) | update (swap the example, for instance `quality:fallow`) |
| `.claude/skills/yeet/SKILL.md:443` ("…Knip, Fallow…") | update |
| `docs/runbooks/turbo-cache-inputs.md:109` (`knip:check` in the uncached row) | update |
| `docs/runbooks/typescript-toolchain.md:57` (knip row) | remove row |
| `standards/turbo-remote-cache.md:203` ("Oxlint, typos, and knip also remain `cache: false`") | update |
| `standards/memory-architecture/04-decision-log.md:418` | keep-as-history |
| `goals/fallow-quality-enforcement/{ops/validate-knip-parity-baselines.ts,research/knip-parity.jsonc,research/knip-parity.schema.json}`, `goals/standards-remediation/ops/prompts/fixer.knip.md`, 408 goal files, 2257 exploration files, 7 changesets | keep-as-history. Check `validate-knip-parity-baselines.ts` for any live invocation: none was found outside its packet. |
| `.beep/yeet/{proof-ledger.ndjson,lane-proofs.json,logs/*,runs/*}` in the primary clone (Knip lane rows) | keep (workstream G owns `.beep` retention). No Knip-specific residue directory exists. |

Knip exclusions for the other retiring surfaces disappear with `knip.jsonc`: `knip.jsonc:130-132` (Impeccable
GitHub mirror), `:153-156` (`tools/skillopt/**`), `:158-170` (`.claude/skills/impeccable/**` ignoreIssues).

## 4. `tools/skillopt` (retire)

The tool is 54 tracked files (540 KB): a Python uv project (`pyproject.toml`, `uv.lock`, `src/beep_skillopt/{adapter,controls,export,ledger,preflight,rescreen,screen,train}.py`,
`tests/` (6 test files plus fixtures), `configs/beeplaw.{template,rerun-2026-09,rerun-2026-09-29}.yaml`, and `vendor/prompts/**`).
It is not a workspace: `package.json#workspaces` lists only `tools/tsgo-shim`.

### Integration points

| Ref | Class | Note |
|---|---|---|
| `tools/skillopt/**` | remove | |
| `docs/runbooks/skillopt-rerun.md` (whole runbook; `uv run --project tools/skillopt …`, the `skillopt-rerun-p4` systemd unit) | remove. Nothing links to it: `git grep skillopt-rerun` hits only the runbook and the two configs. | |
| `.gitignore:135-136` (`tools/skillopt/.venv/`) | remove | |
| `.gitignore:176-180` (harness-evidence-ledger `p2-rerun/out/`, `run.log`, `p4-rerun/out*/`, `run.log`, "SkillOpt out_root + run log") | remove (or keep as a guard). None of those ignored paths exist in any clone. | |
| `beep-effect.iml:154` (`tools/skillopt/.venv` exclude) | remove | |
| `beep-effect.iml:43` (`explorations/skillopt-training-pilot`), `:125` (`goals/skillopt-training-pilot`) | keep (the packets stay as history; indexing exclusions stay accurate) | |
| `flake.nix:23-25` (`python3`, `uv` under "SkillOpt training pilot") | update comment only. Keep `python3`/`uv`: `apps/labs/ciops/scripts/check-{emission,lane-plan}-cq.py` and the `ontology-foundational-auditor` skill also use Python. | |
| `knip.jsonc:153-156` | removed with Knip | |
| `packages/tooling/tool/cli/src/commands/AgentEffectiveness/**` (`evals score` scorer: `AgentEffectiveness.schemas.ts` `SkillOptTaskManifest`/`SkillOptTaskCompletionCriteria`/`SkillOptTaskWeights`, `internal/{EvalFixture,EvalRecord,EvalScorer,EvalScoring}.ts`, command flags `AgentEffectiveness.command.ts:97,100,657,680`) | **keep (independently useful); rename optional** | `docs/runbooks/agent-convention-comparisons.md:24-25` reuses `SkillOptTaskManifest` with `evals score` for the `evals compare` workflow, so the scorer has a use beyond the pilot. Retiring the trainer must not remove it. Renaming `SkillOpt*` to a neutral name would ripple into `standards/schema-catalog.generated.jsonc:34025-34081` and `standards/jsdoc-documentation.inventory.jsonc:375215-375220` (both regen) and into `test/agent-effectiveness-eval-scorer.test.ts`. |
| `QaJudgeSkillOptions` (`commands/Qa/JudgeSkill.ts`, `test/qa-judge-skill.test.ts`) | not SkillOpt | False positive on case-insensitive "SkillOpt", from "SkillOptions". |
| Local residue: `~/YeeBois/projects/beep-effect/tools/skillopt/.venv` (111 MB) | remove (another clone; coordinate) | The primary clone has no `.venv`. |

### Pilot records to preserve

- `goals/skillopt-training-pilot/` (lifecycle `completed-retained`, `ops/manifest.json`): `GOAL.md`, `SPEC.md`, `PLAN.md`,
  `README.md`, `corpus/` (benchmark-cases, splits, DERIVATION.md, `.proofs/`), and
  `history/{p1-gate,p1-spike,p3a-scorer,p3b-adapter,p3-smoke,p5-training}/FINDINGS.md|LANE-SUMMARY.md`, plus
  `history/reflections/2026-07-06-claude.md`. Keep as history.
- `goals/harness-evidence-ledger/history/p4-rerun/`: `FINDINGS.md` (125 lines; headline: "with the scorer fixed,
  the baseline skill has no headroom to measure"; baseline noise 0.9583/0.9583/0.8750, spread 0.0833 over 3 passes;
  loop baseline 0.9167; rows recorded `within_baseline_noise: true`), `baseline-noise.json`
  (schema `beep-skillopt-baseline-noise/v1`), `ledger-rows.json`, `rescreen.jsonl`, `steps.jsonl`, `screen-log.jsonl`,
  `prune-proposals.txt`, `run-summary.log`, and `skills/`. **This is the compact results record.** Brief §7 ("16 rollouts,
  retained baseline") matches it. Keep as history.
- `harness-ledger/rows/2026-09.jsonl` (14 rows) and `2026-10.jsonl` (5 rows) are append-only. SkillOpt rows:
  `hl-20260929-{5efc96ff,58b6caf6,df3f0899,3d7c119f,5ccfb1f4,81ff6e06,5ddf9e10,7abfe91a,672c2818,f88812b2}` (rerun steps 1-6;
  dispositions: 5 proposed, 4 rejected (`58b6caf6`, `5ccfb1f4`, `5ddf9e10`, `672c2818`), and step 2/6 superseded by
  `hl-20261001-f181b84d` and `hl-20261001-500b0523` = **deferred**). The fixture-tsconfig and precision-audit candidates
  (`hl-20260925-873a855c`, `hl-20260925-4fc1962c`) were rejected on 2026-10-01 (`hl-20261001-63ca64d3`, `hl-20261001-3b8c26c0`).
  Never edit these rows. If the retirement needs a ledger statement, append a new row.
- Recommended compact record: a short `RETIRED.md` (or a Decision Log entry in the program SPEC) naming the pilot,
  its final verdict (no adoption beyond baseline noise), the two evidence paths above, the ledger row ids, and the
  retirement commit. The 2026-10-01 dispositions above were read from the rows themselves. The 16-rollout count comes
  from brief §7 and the FINDINGS file, which the sweep did not re-derive.

## 5. `plugins/box`, `plugins/github`, `plugins/notion`

The bundles are 135 tracked files: box 19 (132 KB), github 28 (212 KB), notion 88 (544 KB). They are vendored
OpenAI Codex plugin bundles (`.codex-plugin/plugin.json`, author OpenAI, repository `github.com/openai/plugins`,
MIT, notion v0.1.5). `plugins/github/.mcp.json` points at a hosted GitHub MCP with `bearer_token_env_var`, and
`plugins/notion/.mcp.json` points at the hosted Notion MCP. `plugins/box` has no `.mcp.json`. Last touched
2026-10-01 (#1363).

| Ref | Class | Note |
|---|---|---|
| `plugins/{box,github,notion}/**` | remove | |
| `.agents/plugins/marketplace.json:1-44` (marketplace `beep-effect-local-plugins`, `../../plugins/{box,github,notion}`) | remove (whole file; `.agents/plugins/` then becomes empty) | This is the only in-repo loader. `.agents/agents` and `.agents/skills` are symlinks into `.claude/` and stay. |
| `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:472` (`"plugins/**/*.{ts,…}"` scan glob) | remove (dead glob once `plugins/` is gone) | Check for a test that pins the glob list. |
| `.claude/settings.json:298-308` `enabledPlugins` / `extraKnownMarketplaces` | not related | These are Claude marketplace plugins, not repo copies. |
| `explorations/effect-mcp-2026-07-28/{research/21-r2-hosts.md,research/21-r2-hosts.claims.jsonl:20,research/00-plan-review.md:47,ops/prompts/21-r2-hosts.md:20}`, 2 goal files | keep-as-history | |
| Workstation (workstream F): `~/.codex/config.toml:1739-1749` `[plugins."{box,github,notion,datamoat}@codex-marketplace-beep-effect-225b539d"] enabled = false`; cache `~/.codex/plugins/cache/codex-marketplace-beep-effect-225b539d/{box,datamoat,github,notion}`; per-worktree copies of the marketplace under `~/.codex/worktrees/*/beep-effect*/.agents/plugins/marketplace.json` | out of repo; report to F | All four are disabled. The separately installed `notion@openai-curated` is enabled (`~/.codex/config.toml`, about line 1769) and must be preserved. |
| Beep vendor drivers `packages/drivers/box`, `packages/drivers/box-provisioning` | keep | Independent; there are no github/notion drivers by those names. |

## 6. `.serena/`

- Untracked and ignored (`.gitignore:36` `.serena/`). Absent from the lane worktree. Present in 13 clones.
- Primary clone `.serena/` (20 KB): `.gitignore` (26 B: `/cache`, `/project.local.yml`), `project.local.yml`
  (402 B, comments only), `project.yml` (9,800 B; a stock Serena template with `project_name: "beep-effect3"`,
  `language_servers: [typescript]`, everything else default), and `memories/` (empty). No `cache/` directory in any clone.
- `memories/memory_maintenance.md` exists in 5 clones (`beep-effect`, `beep-effect2`, `beep-effect5`, `beep-effect6`, `beep-effect7`). All 5 copies are
  byte-identical (2,043 B, sha256 prefix `09d514088a02`), a generic "progressive discovery" memory-maintenance note,
  not project knowledge. **No unique useful records were found.**

| Ref | Class | Note |
|---|---|---|
| `.serena/` in each clone | remove (local residue) | Delete it in every clone after the owner check. If any copy is kept, keep one `memory_maintenance.md` copy only. |
| `.gitignore:36` (`.serena/`) | remove after the residue is gone, or keep as a guard (the user still has `serena` on PATH) | |
| `.vercelignore:12` (`.serena/`) | remove | |
| `beep-effect.iml:179` (`.serena` excludeFolder) | remove | |
| `.mcp.json:13-24` (`serena` stdio server, `--language-backend JetBrains --project-from-cwd`) | remove (dead reference) | Disabled by `.claude/settings.json:97-102` `disabledMcpjsonServers`. The rest of `.mcp.json` is live and stays. |
| `.claude/settings.json:100` (`"serena"` in `disabledMcpjsonServers`) | remove together with the `.mcp.json` entry | |
| `.claude/settings.json:300` (`"serena@claude-plugins-official": false`) | decision (workstream F) | A Claude plugin toggle, separate from the repo `.serena/`. `~/.claude.json` lists `plugin:serena:serena`. |
| `goals/cloud-agent-readiness/SPEC.md:89`, `goals/cloud-agent-readiness/research/2026-10-01-container-probe.md:24`, `goals/shared-memory-code-kg-wiring/**`, `goals/knowledge-surface-automation/research/p1-context-pruning-analysis.md:108`, `explorations/effect-mcp-2026-07-28/research/21-r2-hosts.md:213` | keep-as-history | |
| `explorations/atlas-synthesis/...:485`, venice-ai swagger voices "Serena" | not Serena-the-tool | |
| Workstation: `~/.codex/config.toml:1511` (a `[projects.…]` trust entry for an out-of-tree Serena checkout) | out of repo; report to F | |

## 7. Repository Impeccable (remove completely)

### Payloads

| Ref | Class |
|---|---|
| `.claude/skills/impeccable/**` (154 tracked files, 3.5 MB: `SKILL.md`, `agents/*.toml`, `reference/`, `scripts/` incl. `hook.mjs`, `detector/cli/main.mjs`, `live-*.mjs`) | remove |
| `.github/skills/impeccable/**` (149 files, 3.5 MB; Copilot mirror) | remove |
| `.github/agents/impeccable-{asset-producer,documenter,finish-reviewer,manual-edit-applier}.agent.md` | remove |
| `.github/hooks/impeccable.json` (postToolUse `edit\|create\|apply_patch` → `.github/skills/impeccable/scripts/hook.mjs`) [erratum 2026-10-09] | remove |
| `skills-lock.json:63-67` (`"impeccable"` repo-local entry) | remove (or regen through `beep skills` if that writer owns the file) |

### Codex wiring

| Ref | Class |
|---|---|
| `.codex/config.toml:50-52` (`[[skills.config]] name = "impeccable" enabled = true`) | remove |
| `.codex/hooks.json:60-70` (PostToolUse `Edit\|Write\|apply_patch` → `.agents/skills/impeccable/scripts/hook.mjs`, "Checking UI changes") [erratum 2026-10-09] | remove |
| `.codex/hooks.json:123-133` (Stop hook → same script, "Design deep pass") | remove. `.agents/skills` is a symlink to `.claude/skills`, so the hook is live today. |

### Scripts and dependencies

| Ref | Class |
|---|---|
| `package.json:415` script `"impeccable:detect"` | remove (via `beep lint package-scripts --write`) |
| `package.json:156,157,164,187` catalog `css-select`, `css-tree`, `domutils`, `htmlparser2`; `package.json:286,287,288,292` root devDependencies | remove. No other workspace declares or imports them: there are no hits in any `*/package.json` or under `packages/`, `apps/`, `infra/`, `scripts/`, `tools/`. They exist only for the detector (`.changeset/quality-sweep-root-lanes.md:16-17` records the move). |
| `bun.lock` entries for those four and their transitive deps | regen |
| `.fallowrc.jsonc:214-223` (`ignoreDependencies` css-select/css-tree/domutils/htmlparser2 with the Impeccable comment) | remove |
| `scripts/` | none. No Impeccable script lives in `scripts/`. |

### Exclusions in lint, format, security, and knowledge configs

| Ref | Class |
|---|---|
| `.fallowrc.jsonc:91-93` (entry `.claude/skills/impeccable/scripts/detector/cli/main.mjs`), `:112-113` (`.github/skills/impeccable/**`), `:185-188` (`ignoreFindings`), `:358-361` (duplicates ignore), `:375-378` (health ignore). Keep `.claude/helpers/**` in the last two. | remove |
| `biome.jsonc:26-29` (`!.claude/skills/impeccable`, `!.github/skills/impeccable`) | remove |
| `biome.identity.jsonc:2` (generated; contains the same negations) | regen |
| `eslint.config.mjs:24-25` comment, `:35`, `:42` | remove |
| `.semgrepignore:4-6` | remove |
| `knip.jsonc:130-132,158-170` | removed with Knip |
| `_typos.toml` | none. There is no Impeccable exclusion; `extend-exclude` at `_typos.toml:89-146` does not name it. |
| `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.refs.ts:1252-1253` (`EXCLUDED_PREFIXES`) | remove |
| `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:1338-1339` (semgrep candidate filter) | remove |
| `packages/tooling/tool/cli/src/commands/Models/Models.seed.ts:290-309` (4 `repo.skills.impeccable.*` codex seats → `.claude/skills/impeccable/agents/*.toml`) | remove |
| `Models.seed.ts:434-453` (4 `home.agents.impeccable.*` seats → `$HOME/.agents/skills/impeccable/agents/*.toml`) | decision (workstream F: the global install is evidence-policy-governed). `beep models check` and the manifest projection must agree. |

### Tests that exist solely for it

| Ref | Class |
|---|---|
| `packages/tooling/tool/cli/test/skills-provenance.test.ts:335-422` ("keeps browser-triggered skill workflows behind host trust boundaries") and `:490-~660` ("enforces the manual-edit operator capability across host mutation routes") | remove. Other tests in the file (`:131-334`, `:423` adapter sandbox) stay. |
| `packages/tooling/tool/cli/test/knowledge-refs.test.ts:177-180` ("excludes vendored Impeccable mirrors") | remove |
| Models seed / manifest tests that count seats | update (not enumerated; run the Models tests) |

### Product artifacts produced with Impeccable (apps/todox)

| Ref | Class |
|---|---|
| `apps/todox/.impeccable/design.json` (tracked "Design System: Todox" sidecar, schemaVersion 2) | decision. Recommendation: preserve-compact-record. `apps/todox/DESIGN.md` is the human-readable design system, so keep DESIGN.md and drop the tool-specific sidecar. Alternatively, keep both as product docs. |
| `apps/todox/.impeccable/questions/a394783f.{answer.json,log}` (tracked) | remove (tool session residue) |
| `apps/todox/PRODUCT.md:3` (`<!-- impeccable:product-schema 1 -->`) | remove the marker; keep the doc |
| `apps/todox/src/app/layout.tsx:15` (JSDoc "The Impeccable direction contract…"; `directionContract` is emitted into the HTML) | reword the JSDoc. The contract string is shipped product behaviour; keep it unless the product owner drops it. |
| `.impeccable/config.json` (tracked root; detector `ignoreValues` with triage reasons) | remove (detector-only configuration) |
| `.gitignore:119-120` (`**/.impeccable/questions/*.state.json`) | remove |
| `beep-effect.iml:175` (`.impeccable` exclude) | remove |
| `.changeset/quality-sweep-root-lanes.md`, `.changeset/todox-product-site.md`, `goals/todox-marketing-site/**`, `goals/codex-security-findings-2026-08-30/{ops/triage.json,findings/CSF-001.md}`, `explorations/todox-wealth-management-site/**`, CI corpora | keep-as-history |

### Local residue (named in the files above)

- Primary clone: `.impeccable/hook.cache.json` (ignored only through `.git/info/exclude:22`, so delete the exclude line too),
  `.impeccable/config.json`, and `apps/todox/.impeccable/**`. The same set exists under the two foreign Claude worktrees,
  `.claude/worktrees/{nifty-cray-f60103,priceless-kirch-c0261e}`: those are not ours, so leave them.
- `.impeccable/review/` (screenshots, named in `.github/agents/impeccable-finish-reviewer.agent.md:15,20`): not
  present in the primary clone.
- `plugins/impeccable-live.client.ts` / `$lib/impeccable/ImpeccableLiveRoot.svelte` (injected by `live-inject.mjs`): not present.
- A `.impeccable/` directory exists in 25 sibling clones (`ls ~/YeeBois/projects/beep-effect*/.impeccable`).

### Global installations (workstream F, not repo)

`~/.agents/skills/impeccable`, `~/.codex/skills/impeccable`, `~/.codex/plugins/cache/{impeccable,claude-cowork/impeccable}`,
`~/.claude/plugins/cache/impeccable/impeccable`. In `~/.codex/config.toml`: `[plugins."impeccable@impeccable"]` (about line 1772),
`[plugins."impeccable@claude-cowork"]` (about line 1796), hook-state rows (about lines 2179/2182/2737/2740/2776), and `[marketplaces.impeccable]`
(about line 2909). **`~/.codex/config.toml:30,34` pin skill paths inside the `beep-effect21` clone
(`.claude/skills/impeccable/SKILL.md`, `.agents/skills/impeccable/SKILL.md`), and those paths dangle once that clone pulls the removal.**

## 8. `.ai/mcp/mcp.json`

- Tracked, 0 bytes, the only file under `.ai/` (`git ls-files .ai` = 1). Added in `266a73394c` (2026-03-20, "setting up @effect/tsgo") and untouched since.
- No consumer reads that path. The only code that touches `.ai` at all is
  `packages/tooling/library/ai-metrics/src/config-snapshot.ts:29` `CONFIG_ROOTS = [".codex", ".claude", ".ai", ".aiassistant"]`,
  a generic config-root walker that hashes whatever is present. With `.ai/` gone it snapshots nothing there, so no change is needed.
  Optionally drop `.ai` from the root list if the program wants no dead roots (that is a behaviour change, so test the ai-metrics snapshot).
- `goals/lint-toolchain-modernization/research/p0-spike-result.md:132` records Biome's "Found 1 error" coming from this empty JSON file,
  so deleting it also removes a known Biome parse error.

| Ref | Class |
|---|---|
| `.ai/mcp/mcp.json` (and the then-empty `.ai/`) | remove |
| `beep-effect.iml:168` (`.ai` excludeFolder) | remove |
| `.mcp.json` (project MCP config) | keep (live). Only its `serena` entry is affected, see §6. |
| `explorations/effect-mcp-2026-07-28/{ops/prompts/21-r2-hosts.md:20,research/00-plan-review.md:47,research/21-r2-hosts.md:413}`, `goals/lint-toolchain-modernization/...:132`, `goals/turborepo-task-qualification/research/alias-file-open-review.json` | keep-as-history |

---

## Proposed plan (implementing lane)

1. **Record first (Stage 2 gate).** Copy the 41 Knip baseline findings into the program's one-time remediation list:
   kind, file, name, and an intended disposition (fix / document legitimate). Write the SkillOpt compact record that cites
   `goals/harness-evidence-ledger/history/p4-rerun/FINDINGS.md`, the 2026-09-29 and 2026-10-01 ledger row ids, and
   `goals/skillopt-training-pilot/`. If the program wants a ledger statement, append a new `harness-ledger` row rather than editing old ones.
2. **Hosted coordination (with workstream E).** Prepare the ruleset edit that drops the required `Knip` context. Apply it in
   the same window the Knip job leaves `.github/workflows/check.yml`, and confirm the ruleset no longer lists it before merging.
3. **One retirement PR (or two: Knip, then everything else)**, in this order:
   a. Knip: remove the `package.json` keys (catalog, devDep, patchedDependencies) and the patch, `knip.jsonc`, the baseline,
      the turbo task and input, the CI job, and the repo-cli modules and wiring listed in §3. Then update tests and fixtures, rerun
      `bun run beep lint package-scripts --write` and `bun install`, and regenerate the fingerprint, the cache-qualification
      baseline, the schema catalog, and the coverage baseline row.
   b. Impeccable: remove the payloads, Codex config and hooks, the GitHub hook and agents, `skills-lock.json`, the detector script, the four
      root deps and their catalog entries, every exclusion in §7, the Models seeds (repo seats now; home seats per F), the two tests, and the root
      `.impeccable/`, and fix the apps/todox markers. Regenerate `biome.identity.jsonc`.
   c. SkillOpt: remove `tools/skillopt/`, `docs/runbooks/skillopt-rerun.md`, `.gitignore:135-136` (and `:176-180` if guards are not wanted),
      `beep-effect.iml:154`, and the flake comment. Keep the `agent-effectiveness evals score` scorer.
   d. plugins: remove `plugins/{box,github,notion}`, `.agents/plugins/marketplace.json`, and the `EffectImports.ts:472` glob.
   e. Serena: remove the `.mcp.json` `serena` entry together with the `disabledMcpjsonServers` item, `.vercelignore:12`, `beep-effect.iml:179`,
      and (per decision) `.gitignore:36`.
   f. SST: remove `.gitignore:107-109`, the two ESLint `.sst/**` globs, and `standards/git-worktrees.md:386`.
   g. `.ai/mcp/mcp.json` plus `beep-effect.iml:168`.
   h. `map.html`: no tracked change, apart from the `.gitignore:41` decision.
   Then run `bun run beep quality package-verify @beep/repo-cli` (and for `@beep/repo-configs`), plus `lint:typos`/docgen as required.
4. **Local residue (after merge, with an owner check per clone):** delete `sst-env.d.ts` (3 files in the primary clone, 10 in `beep-effect2`),
   `beep-effect2/map.html`, `.serena/` (13 clones), `.impeccable/hook.cache.json` and its `.git/info/exclude:22` line, the
   `beep-effect/tools/skillopt/.venv` (111 MB), and the clone-local `.impeccable/` directories. Leave `.claude/worktrees/*` and
   `beep-effect-worktrees/*` that other sessions own.
5. **Hand to workstream F:** the Codex marketplace-plugin entries and cache, the global Impeccable installs and the dangling
   `~/.codex/config.toml:30,34` skill paths, the `serena@claude-plugins-official` toggle, the Serena project trust entry, and the
   `home.agents.impeccable.*` model seats.

## Open questions

1. `.gitignore` guards: should `.gitignore:41` (`map.html`), `:36` (`.serena/`), and `:176-180` (SkillOpt rerun outputs) stay as
   cheap guards after the residue is gone? The brief says to remove obsolete ignores explicitly only for SST.
2. Does the `main` ruleset get edited by agents, or by the operator through the GitHub UI? The sweep confirmed only that `Knip` is required. It did not check who owns ruleset edits, or whether a repo tool writes rulesets. `GithubRest.ts` reads them; no writer was found in a grep for `required_status_checks`.
3. `apps/todox/.impeccable/design.json` and the `directionContract` in `apps/todox/src/app/layout.tsx`: product-design records or tool residue? This needs a product-owner call; the sweep recommends keeping DESIGN.md and dropping the sidecar.
4. `apps/labs/ciops/test/fixtures/gate-order-handoff-v1.json` and `lane-plan-v1.ttl` contain `quality:knip`. The sweep did not establish whether ciops tests regenerate these from the live lane list or treat them as frozen v1 fixtures.
5. Should the `SkillOptTaskManifest` scorer types be renamed (for example `EvalTaskManifest`) now that SkillOpt is retired? Renaming changes the exported API, the schema catalog, and the JSDoc inventory, so it may need a changeset decision.
6. Is `skills-lock.json` hand-maintained, or written by a `beep skills` subcommand? `Skills.command.ts` only reports a would-be v2 entry, so no writer was confirmed.
7. Does the `EffectImports.ts` law glob list have a pinned test? It was not checked.
8. The exact end line of the second Impeccable-only test in `skills-provenance.test.ts`: the test starts at `:490` and the file is 691 lines. The implementer should take the block boundaries from the source.
9. `standards/coverage.regression-baseline.jsonc` and `standards/schema-catalog.generated.jsonc` writers: not run here, so the size of their regenerated diffs is unknown.
