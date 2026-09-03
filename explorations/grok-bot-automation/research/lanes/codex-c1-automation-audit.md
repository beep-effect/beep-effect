# Codex C1 — repo automation-opportunity audit for Grok Bot

Date: 2026-09-03  
Checkout: `~/YeeBois/projects/beep-effect9`  
Audited head: `<redacted-commit>` (`main`)  
Mode: read-only repo audit; no web research; no package installation; no full Turborepo graph.

## Executive verdict

The repo already has a broad deterministic control plane. The strongest Grok Bot opportunities are therefore not “run another lint.” They are agents that take the existing ratchet output, compare it with authored intent and recent code movement, and make a bounded disposition: fix, explain, re-baseline with evidence, park, or propose a law change.

The three seed ideas survive, with one important reshape:

1. **Documentation enhancement — GO.** The committed JSDoc inventory has 58 packages needing remediation, 347 open modules, 99 open exports, 4 missing export examples, 12 undescribed `@see` links, and 427 multiple-description-paragraph findings. Five real workspaces have no README and 14 package READMEs are older than 90 days while their packages continued changing. The bot should improve meaning and examples after deterministic selection; it should not regenerate inventories or spray prose across every export.
2. **Knowledge/documentation staleness — GO.** `knowledge refs --check` finds 29,335 references, including 2,446 broken targets, but correctly gates none because the broken observations are inherited/non-live classes. `knowledge semantic-delta` reports 491 unchanged findings and zero introduced. This is exactly the gap for judgment: the gates prevent regression, while a bot decides which inherited findings have become misleading enough to repair.
3. **Beep style & law enhancer — RESHAPE.** Four strict Effect law scanners are clean, one advisory terse-Effect candidate remains, and package test imports are clean. In contrast, the manually invoked tooling schema-first check finds 221 violations and the schema inventory carries 92 reviewed exceptions. The useful bot is a law non-vacuity/exception reviewer plus narrow fixer; a generic style rewriter would duplicate lint and create high-noise PRs.

The most valuable cross-cutting finding is the asymmetry between **zero new regressions** and **large inherited inventories**. That is where hosted reasoning quota earns its keep.

## Audit method and interpretation

- I read `AGENTS.md` first, then the requested `.patterns`, standards, goals, exploration packets, generated portfolio surfaces, research packets, skill frontmatter, agent names, and the upstream pstack playbooks/automation examples.
- Every requested repo command was time-boxed with `timeout 600`. No full `bun run check`, `build`, `test`, or repo-wide `lint`/Turbo graph was run.
- “Current” below means one of:
  - **live** — measured by a command at audited head;
  - **tracked baseline** — read from a committed inventory as explicitly requested;
  - **derived snapshot** — computed read-only from manifests/git history at audited head.
- A ratchet that reports zero introduced findings can still coexist with a large inherited backlog. Both numbers are shown rather than collapsing them into a single green/red verdict.
- Costs are observed warm-start wall times on this workstation: tiny `<3s`, cheap `3–15s`, moderate `15–60s`, expensive `>60s`. They are not CI fleet p95s.

## A. Existing command surface

### Command-group inventory

| Group | Subcommands observed | What it checks or produces | Gate/report shape | Current consumers |
| --- | --- | --- | --- | --- |
| `laws` | `effect-imports`, `native-runtime`, `effect-fn`, `frozen-grant-set`, `terse-effect`, `allowlist-check` | Effect import/runtime/function/grant-set/terse-form doctrine and allowlist hygiene | Per-law report by default; `--check` promotes supported scans; allowlist check is strict | Yeet/CI policy lanes, maintainers, law authors |
| `docs` | `laws`, `skills`, `policies`, `find`, `aggregate` | Discovers agent-facing laws, skills and policy help without embedding paths | Reports/static discovery only; there is no `docs check` or `docs lint` in the live CLI | Humans and agents finding canonical guidance |
| `docgen` | `status`, `init`, `generate`, `run`, `aggregate`, `local`, `analyze`, `check`, `quality`, `worker eval`, `worker runpod`, `doctest` | Generates package API docs, analyzes doc quality, compiles examples, and supports review workers | Mixed producer/check/report surface; full generation is intentionally expensive | `package-verify`, Yeet/docgen lanes, package authors, quality workers |
| `knowledge` | `refs`, `semantic-delta` | Reference census/classification and merge-base-to-HEAD semantic finding delta | `refs --check` gates only live host debt; `semantic-delta` is a new-finding ratchet/report | Knowledge-surface packet, roadmap ref lint, CI/Yeet, maintainers |
| `lint` | `circular`, `deprecated-apis`, `ecosystem-polarity`, `goal-packets`, `identity-registry`, `judge-rubric`, `package-test-imports`, `package-test-typecheck`, `policy`, `reflection-artifacts`, `roadmap-refs`, `schema-catalog`, `schema-first`, `schema-topology`, `tooling-schema-first` | Repo-specific architecture, API, packet, test, schema and governance rules | Mixed strict checks and fail-on-growth baselines | CI lint/repo-sanity lanes, Yeet, package authors |
| `quality` | `dev`, `github-checks`, `bun-audit`, `test-tsgo`, `tsgo-smoke`, `tsgo-rules`, `jsdoc-module-tags`, `jsdoc-inventory`, `jsdoc-quality`, `jsdoc-ratchet`, `jsdoc-migrate`, `knip`, `turbo-config-proof`, `profile`, `scheduler`, `tmpfs-reap`, `package-verify`, `changeset-graph`, `changeset-status`, `fallow` | Operational quality orchestration, baselines, package proof, dependency/release checks, scheduler and Fallow wrappers | Mixed reports, generators and blocking gates; the root command is a catalog, not one audit | Yeet, pre-push/CI, package handoffs, operators |
| `fallow` | `boundaries` | Renders/checks the generated Fallow boundary projection | `--check` deterministic projection gate; `--write` generator | Fallow quality wrappers and repo-sanity |
| `goals` | `doctor`, `index`, `set-status`, `set-risk-tier`, `bootstrap`, `adopt`, `repair-fork`, `migrate-conventions` | Goal packet consistency, projection, lifecycle and pure planning/migration operations | Doctor is a baseline ratchet; index is generated projection; mutations are explicit commands | Goal owners, Yeet publish, portfolio work |
| `explore` | root `--check`; `atlas` | Validates exploration roots/links and renders Atlas/README status projections | Root has blocking/advisory validation; Atlas `--check` is deterministic projection gate | Exploration authors, packet graduation, Yeet |
| `research` | `capture`, `cognify`, `daily`, `digest`, `history-sift`, `install-timers`, `notion-pull`, `repo-card`, `status` | Source capture, curation and local research utilities | Mostly producers/reports; **no `nightly` command exists** despite the nightly goal SPEC | Human research workflow and local timer operators |
| `skills` | `update`, `provenance` | Maintains repo-local skill mirrors and provenance | Producer plus report/gate | Agents and skill-contract/knowledge-surface packets |
| `codex` | `quality-review-fix-loop`, `findings` | Runs bounded quality review and ingests exported Codex security findings | Workflow/packet producer, not a broad scan | Codex findings packets and closeout operators |
| `qa` | `record`, `stop`, `mark`, `extract`, `report`, `doctor`, `judge-pack`, `ingest`, `lint`, `skill` | Records, extracts, validates and judges gesture/motion evidence | Artifact producer plus schema validation/judgment gates | Professional desktop QA bot, browser-qa-loop, reviewers |
| `agent-effectiveness` | `doctor`, `annotations`, `datasets`, `prompts`, `experiments`, `evals`, `phoenix` | Inspects and synchronizes agent effectiveness evidence | Reports and explicitly controlled sync/eval operations | Agent-effectiveness/reflection loops and experiment owners |
| `yeet` | `verify`, `repair`, `publish`, `monitor`, `closeout`, `status`, `sweep`, `merge`, `reply`, `inbox`, `pre-push-hook`, `fallow-feedback`, `fallow-fixture-check`, `plan-contract-check` | Canonical local proof, PR publication, hosted checks, review-thread closure and lifecycle | Blocking workflow; `monitor` owns complete merge-ready truth | Every implementation/PR bot and human maintainer |

### Deterministic gates and report baselines

| Command or inventory | What it measures | Ratchet or report | Current count/backlog | Observed cost | Consumer today |
| --- | --- | --- | --- | --- | --- |
| `beep laws effect-imports` | Root-vs-module Effect import migration candidates | Dry-run report; checkable | **0** touched, alias renames, or stable conversions (live) | 7.95s | Effect governance |
| `beep laws native-runtime` | Native runtime/helper use that violates Effect law | Report; checkable | 3,428 files; **0** warnings/errors; 25 allowlisted; **2 unused allowlist entries** (live) | 13.35s | Effect governance and allowlist owners |
| `beep laws effect-fn` | Reusable effectful functions missing the expected helper form | Report; checkable | 3,249 files; **0 violations** (live) | 10.76s | Effect governance |
| `beep laws frozen-grant-set` | Mutable/late authority grants rather than session-frozen grants | Report; checkable | 3,248 files; **0 violations** (live) | 11.12s | Execution-authority law owners |
| `beep laws terse-effect --advisory` | Trivial lambdas/passthroughs and terse equivalent Effect forms | Advisory report/check | **1** `flow-candidate`, one blocking file, zero mechanical rewrites (live) | 23.45s | Style/law maintainers |
| `beep laws allowlist-check` | Expired/stale/invalid law exceptions | Strict check | OK; native-runtime separately identifies **2 unused entries** | 2.30s | CI/Yeet policy |
| `beep docs policies` | Human-readable policy gate discovery | Static report | Four policy bullets; no finding count | 1.88s | Agents/operators |
| `beep docs check` / `docs lint` | Intended broad documentation validation | **Absent commands** | N/A; both fail as unknown subcommands | 1.95s / 2.15s | Nobody; use JSDoc/docgen/knowledge gates instead |
| `beep knowledge refs --check` | All tracked references, classified by liveness/portability/ownership | Ratchet only for live gated host-path debt plus census report | 29,335 observations; 23,088 verified; **2,446 broken-target**; 1,757 archival provenance; 1,820 audit literals; 140 producer-owned; 69 portable-home; 15 ungoverned syntax; **0 live gated** | 16.38s | Knowledge-surface/roadmap gates |
| `beep knowledge semantic-delta` | Findings introduced/resolved against merge-base archive | New-finding ratchet/report | **0 introduced, 0 resolved, 491 unchanged** (live) | 47.93s | Knowledge-surface Stage 1 |
| `beep lint circular` | Circular workspace dependencies | Strict check | **0** | 6.10s | CI/architecture |
| `beep lint deprecated-apis` | Deprecated vendor API usage via 25 sharded ESLint scans | Strict check | **0** | 194.52s | CI/API migration |
| `beep lint tooling-schema-first` | CLI naming, exported-interface, tagged-union and service-id policy | Strict command, currently not green on main | **221**: 186 PascalCase-file, 24 exported-interface, 10 tagged-union-pattern, 1 service-id | 2.23s | Manual tooling cleanup; not an effective main gate today |
| `beep lint schema-first` | Live schema-first candidates versus reviewed inventory | Baseline equality plus candidate enforcement | 92 live = 92 tracked; **0 missing/stale/enforced candidates**. All 92 are reviewed exceptions: 29 interfaces, 13 type literals, 7 object-struct schemas, 43 policy advisories | 31.52s | Schema-first governance |
| `beep lint schema-topology` | Canonical schema file placement/topology | Strict check | canonical; **0 findings** | 1.72s | Architecture/CI |
| `beep lint roadmap-refs` | Roadmap reference integrity | Strict/advisory report | **0 blocking, 0 advisory** | 1.77s | Roadmap/knowledge owners |
| `beep lint reflection-artifacts` | Reflection paths and packet artifact consistency | Strict/advisory report | **0 blocking, 0 advisory** | 1.74s | Reflection/closeout |
| `beep lint package-test-imports` | Package tests importing workspace `src` relatively | Strict check | **0**; package aliases clean | 8.81s | Package tests/CI |
| `beep lint package-test-typecheck` | Packages whose tests are absent from a wired test tsconfig | Fail-on-growth baseline | **66 inherited, 0 introduced**: 65 missing test tsconfig, 1 unwired | 3.39s | Test governance |
| `beep goals doctor` / `lint goal-packets` | Manifest/filesystem/git contradictions and packet structure | Baseline ratchet | 170 packets; **0 new/inherited blocking, 0 advisories** | 1.81s / 1.90s | Portfolio/CI |
| `beep explore atlas --check` | Generated Atlas/status projection determinism | Projection check | current; **0 drift** | 1.78s | Exploration authors/Yeet |
| `beep explore --check` | Exploration root/link validation | Blocking + advisory report | 69 roots; 66 streams; **1 advisory** (`practice-box-provisioning` prose parsed as an unreachable packet ref) | 1.85s | Exploration authors |
| JSDoc inventory + `quality jsdoc-ratchet` | Public package module/export documentation grammar and regression totals | Committed inventory; fail-on-growth ratchet | 136 packages; **58 needing remediation**, 347 open modules, 99 open exports, 4 missing examples, 12 undescribed `@see`, 427 multi-paragraph shape findings, 1 example-import finding, 1 trailing blank, 1 bad heading, 4 bad when-to-use prefixes. Ratchet: tracked metrics 20, increased 0; official package-scope legacy carriers 0 | 2.05s for ratchet; inventory generation intentionally not run | Package verify/docgen/CI |
| Fallow dead-code baseline | Unused files/exports/deps plus boundary defects | Fail-on-growth baseline | **0 total** at tracked 2026-08-16 snapshot | Not rerun; report wrappers write artifacts | Fallow/Yeet/CI |
| Fallow health baseline | Complexity and CRAP findings | Fail-on-growth baseline | **385 findings across 157 files**: 28 complexity-critical, 27 high, 174 moderate; 30 CRAP-critical, 38 high, 88 moderate | Not rerun; tracked snapshot last changed 2026-08-16 | Fallow/complexity packet |
| Knip baseline | Unused files/exports/dependencies | Fail-on-growth baseline | **0 findings** | Not rerun | Quality/CI |
| Coverage baseline | Per-package line/statement/branch/function coverage | Fail-on-regression + minimum policy | 132 packages, 40 follow-ups; **30 below at least one minimum**; 21,498 uncovered lines. By threshold: 25 line, 25 statement, 18 branch, 29 function | Inventory read only | Coverage gate/quality work |
| Schema catalog | Public schema surface projection | Generated artifact/check | **5,256 entries** | Inventory read only | Schema catalog lint/docgen |
| Changeset status | Changed product workspace coverage by new changesets | Diff-scoped strict gate | Main diff empty; 0 lab/product/neutral/blocking paths; enforced | 2.04s | Release/PR policy |

### Backlogs that are not represented by a red gate

1. **README staleness:** among 144 `apps`/`packages` package roots, 133 have a README. Excluding fixture packages, five real workspaces lack one: `@beep/storybook`, `@beep/anthropic`, `@beep/face-detection`, `@beep/graph-3d`, and `@beep/shacl`. Fourteen package READMEs are older than 90 days while non-README package content changed later: `@beep/db-admin`, `duckdb`, `ffmpeg`, `chalk`, `colors`, `identity`, `rdf`, `utils`, `data`, `types`, `law-practice-domain`, `repo-configs`, `test-utils`, and `workspace-domain`.
2. **Portfolio aging:** the generated goal index is structurally green at 170 packets (54 active, 8 paused, 105 completed-retained, 3 reference). Derived from manifests, **20 active packets have `updated` older than 28 days**, **15 older than 42 days**, **33 active packets have zero completed phases**, and **14 combine zero completed phases with >28-day manifest age**. These are triage signals, not proof of abandonment.
3. **Exploration decision lag:** 69 exploration packets comprise 5 active, 14 parked and 50 graduated. No active packet is older than 28 days; one active exploration (`beep-mode`) has an empty question frontier but remains in `align`, a good “advance or explicitly hold” nudge rather than an error.
4. **Research action disposition:** five partial hosted research packets contain **101 suggested actions** (34 + 15 + 10 + 21 + 21), while there is no machine-readable per-action fired/rejected/deferred ledger. The watchlist has 23 entries (19 `keep`, 4 `add`). A bot can reconcile proposals to subsequent captures/packets without auto-admitting them.
5. **Legacy JSDoc scope gap:** the official package inventory/ratchet reports zero legacy non-generated carriers in its scope. A raw production-oriented scan finds **87 carrier lines outside that effective scope**: 79 in `infra/src` and 8 in `apps/professional-desktop/server`. This is first a scope/law decision, not permission to mass-rewrite them. Test fixtures and detector implementations were excluded from this count.
6. **Authored-doc cadence:** since 2026-06-01, the exact requested governance/doc pathspec appears in 549 commits versus 982 code-path commits. `standards/` alone appears in 481 commits, while authored `docs` + `.patterns` + `AGENTS.md` + `.claude/skills` appear in 145 commits (about 0.148 authored-surface commits per code commit). The high standards churn is mostly evidence that generated baselines move with code; it is not evidence that prose remains semantically current.

### Timed command log

All commands below were run from the audited checkout. “Number” is the extracted result, not the process output line count.

#### Surface/help discovery

| Command | Wall | Exit | Number/result |
| --- | ---: | ---: | --- |
| `bun run beep laws --help` | 1.855s | 0 | 6 subcommands |
| `bun run beep docs --help` | 1.806s | 0 | 5 subcommands |
| `bun run beep docgen --help` | 1.807s | 0 | 13 top-level/nested operations |
| `bun run beep knowledge --help` | 1.786s | 0 | 2 subcommands |
| `bun run beep lint --help` | 1.812s | 0 | 16 subcommands |
| `bun run beep quality --help` | 1.803s | 0 | 25 top-level/nested operations |
| `bun run beep fallow --help` | 1.822s | 0 | 1 subcommand |
| `bun run beep goals doctor --help` | 1.786s | 0 | baseline-write option confirmed |
| `bun run beep explore atlas --help` | 1.802s | 0 | check/write modes confirmed |
| `bun run beep research --help` | 1.927s | 0 | 9 subcommands; nightly absent |
| `bun run beep skills --help` | 1.784s | 0 | 2 subcommands |
| `bun run beep codex --help` | 1.818s | 0 | 2 subcommands |
| `bun run beep qa --help` | 1.839s | 0 | 11 subcommands |
| `bun run beep agent-effectiveness --help` | 2.279s | 0 | 7 subcommands |
| `bun run beep yeet --help` | 1.920s | 0 | 16 subcommands |
| `bun run beep knowledge refs --help` | 1.832s | 0 | `--tree`, `--surface`, `--json`, `--check` |
| `bun run beep knowledge semantic-delta --help` | 1.891s | 0 | `--base`, `--json` |
| `bun run beep quality jsdoc-ratchet --help` | 1.894s | 0 | baseline/inventory/write-baseline options |
| `bun run beep quality jsdoc-inventory --help` | 1.962s | 0 | JSON/Markdown output options |
| `bun run beep quality fallow dead-code --help` | 1.933s | 0 | advisory/check/out/quiet modes |
| `bun run beep quality fallow health --help` | 1.807s | 0 | advisory/check/out/quiet modes |
| `bun run beep quality fallow audit --help` | 1.949s | 0 | advisory/check/out/quiet modes |

#### Reports/checks

| Command | Wall | Exit | Number/result |
| --- | ---: | ---: | --- |
| `bun run beep laws report` | 2.07s | 1 | Unknown subcommand; no aggregate report exists |
| `bun run beep laws effect-imports` | 7.95s | 0 | 0 findings |
| `bun run beep laws native-runtime` | 13.35s | 0 | 0 violations; 25 allowlisted; 2 unused allowlist entries |
| `bun run beep laws effect-fn` | 10.76s | 0 | 0 findings |
| `bun run beep laws frozen-grant-set` | 11.12s | 0 | 0 findings |
| `bun run beep laws terse-effect --advisory` | 23.45s | 0 | 1 flow candidate |
| `bun run beep laws allowlist-check` | 2.30s | 0 | OK |
| `bun run beep docs check` | 1.95s | 1 | Unknown subcommand |
| `bun run beep docs lint` | 2.15s | 1 | Unknown subcommand; suggests `find` |
| `bun run beep docs policies` | 1.88s | 0 | static policy report |
| `bun run beep knowledge refs --check --json` | 14.05s | 0 | advertised JSON emitted through logging; output truncated before valid JSON completion |
| `bun run beep knowledge refs --check` | 16.38s | 0 | 29,335 observations; 0 gated |
| JSON parse attempt over `knowledge refs --check --json` | 14.81s | 1 | `SyntaxError: JSON Parse error: Unterminated string` |
| `bun run beep knowledge semantic-delta --json` | 50.18s | 0 | 491 unchanged; detailed payload too large for logged output |
| `bun run beep knowledge semantic-delta` | 47.93s | 0 | introduced 0, resolved 0, unchanged 491 |
| `bun run beep lint circular` | 6.10s | 0 | 0 circular dependencies |
| `bun run beep lint deprecated-apis` | 194.52s | 0 | 0 deprecated API findings across 25 shards |
| `bun run beep lint tooling-schema-first` | 2.23s | 1 | 221 violations |
| `bun run beep lint schema-first --help` | 1.78s | 0 | baseline/write modes confirmed |
| `bun run beep lint schema-first` | 31.52s | 0 | 92 live = 92 tracked; 0 drift/candidates |
| `bun run beep lint schema-topology` | 1.72s | 0 | 0 findings |
| `bun run beep lint roadmap-refs` | 1.77s | 0 | 0 blocking/advisory |
| `bun run beep lint reflection-artifacts` | 1.74s | 0 | 0 blocking/advisory |
| `bun run beep lint goal-packets` | 1.90s | 0 | 170 packets; 0 blocking/advisory |
| `bun run beep lint package-test-imports` | 8.81s | 0 | 0 findings |
| `bun run beep lint package-test-typecheck` | 3.39s | 0 | 66 inherited, 0 introduced |
| `bun run beep goals doctor` | 1.81s | 0 | 170 packets; 0 blocking/advisory |
| `bun run beep explore atlas --check` | 1.78s | 0 | projection current |
| `bun run beep explore --check` | 1.85s | 0 | 69 roots, 66 streams, 1 advisory |
| `bun run beep quality jsdoc-ratchet` | 2.05s | 0 | tracked metrics 20, increased 0, current totals 31, legacy findings 0 in official scope |
| `bun run beep quality changeset-status --help` | 1.84s | 0 | diff-scoped semantics confirmed |
| `bun run beep quality changeset-status` | 2.04s | 0 | 0 changed paths, verdict enforced |
| Requested `git log --since=2026-06-01 ...` | <0.01s | 0 | 549 governance/doc-surface commits |

Failures were not retried blindly. The three unknown commands are genuine live CLI drift from the requested command names. The JSON issue is also actionable: `--json` exists, but sufficiently large payloads are routed through a logger that truncates/escapes the record, so a downstream bot cannot reliably parse stdout. The human summary modes remain usable.

Failure excerpts (first lines):

```text
$ bun run packages/tooling/tool/cli/src/bin.ts -- laws report
ERROR Unknown subcommand "report" for "beep-cli laws"

$ bun run packages/tooling/tool/cli/src/bin.ts -- docs check
ERROR Unknown subcommand "check" for "beep-cli docs"

$ bun run packages/tooling/tool/cli/src/bin.ts -- docs lint
ERROR Unknown subcommand "lint" for "beep-cli docs"
Did you mean this? find

$ bun run packages/tooling/tool/cli/src/bin.ts -- lint tooling-schema-first
[check-tooling-schema-first] found 221 violation(s).
packages/tooling/tool/cli/src/bin-main.ts:1 [pascal-case-file] ...
```

## B. Seed automations

### B1. Documentation enhancement bot — GO

**Purpose.** Convert an evidence-selected documentation deficit into a small, technically meaningful PR. The differentiator is judgment: choose the concepts whose explanations/examples are actually inadequate, then write examples that teach behavior and compile. Do not merely satisfy tags.

**Trigger.** Weekly scheduled selection plus manual runs; optionally on-merge when a package’s public exports changed without its README/JSDoc narrative changing. Do not run as a blocking on-PR author.

**Inputs.**

- `.patterns/jsdoc-documentation.md`, `.patterns/README.md`, `AGENTS.md`.
- `standards/jsdoc-documentation.inventory.{jsonc,md}` and `standards/jsdoc-totals.regression-baseline.jsonc`.
- `bun run beep quality jsdoc-ratchet`; `bun run docgen:local` (or the equivalent `bun run beep docgen local`) for a proposed change; `bun run beep quality package-verify <package>` after a package edit.
- Package `src/index.ts` barrels, named source exports, package README, tests and downstream examples. Search live source before inventing a helper or model.
- Staleness selector: five real workspaces without README; 14 >90-day changed-package READMEs; public export diff since last README/JSDoc edit.

**Decision procedure beyond lint.**

1. Select at most one package or one tightly related concept family per run.
2. Read implementation, tests and call sites to infer the user-facing mental model.
3. Classify each inventory finding: mechanical grammar; missing behavioral contract; missing failure/gotcha; intentionally type-only; false positive/scope issue.
4. Prefer one high-quality executable example over broad comment inflation. The example must import the public `@beep/*` surface, show an observable result/assertion, and avoid private implementation paths.
5. Use titled `**Example** (Title)` sections; use `**Details**` or `**Gotchas**` only where the extra prose earns its cost. Never restore `@example`/`@remarks` carriers in official package scope.
6. If the scan exposes a policy-scope hole (for example the 87 infra/app-server carriers), produce a decision report first; do not silently widen the law.

**Output.** Default to a feature-branch PR through `bun run beep yeet publish` after package verification. Cap each PR at one package/semantic theme. If the work requires a policy or scope decision, write a report under the owning active goal’s `research/` and let a human admit the implementation. Never merge automatically. GitHub issue is acceptable for a missing owner; X DM is a notification link only, not the evidence surface.

**Guardrails.** PR-only `main`; no `docs/_internal`; generated inventories and docgen outputs are regenerated by their commands, never hand-edited; generated-artifact policy controls which baselines may move in a feature PR; no new package is hand-created; tests use `@beep/*` aliases; packet research is mutable only inside an active packet and top-level nightly packets remain immutable; record any real workflow friction immediately and sanitized in `research/OPPORTUNITIES.md` when an active packet exists.

**Required proof.** Exact selected findings before/after; public barrel search; diff-scoped docgen/doctest output; `quality jsdoc-ratchet`; package verify; `git diff --check`; generated-artifact diff explanation; Yeet receipt and hosted merge-ready state if it opens a PR. For prose-only README work, attach call-site/test evidence supporting every behavioral claim.

**Failure modes.** Hallucinated APIs; examples that compile only via internal paths; repetitive low-information prose; ratchet laundering; huge documentation PRs; editing generated Markdown/JSONC by hand; assuming every multi-paragraph finding needs Details; widening package JSDoc law to infra without a decision; accidental private docs.

**Quota pool.** Hosted Grok Bot for weekly semantic selection and drafting. GitHub Actions/local repo CLI for deterministic selection and proof. Use a `claudeg`/`claudex` proxy review lane for a second-model accuracy/readability check on substantive docs. A local Grok CLI timer is a fallback when hosted Bot cannot receive a trustworthy checkout artifact.

**Quantified backlog.** 58 packages, 347 open modules, 99 open exports, 4 missing export examples, 12 undescribed `@see`, 427 likely section-shape candidates, 5 real missing READMEs, 14 stale-and-changed READMEs, and 87 out-of-official-scope legacy carriers requiring a scope decision. Official current ratchet growth is zero.

**Existing overlap.** `jsdoc-ratchet`, `jsdoc-inventory`, `docgen check`, `docgen local`, doctest, package verification and the completed JSDoc carrier-migration/effect-jsdoc-quality goals already own syntax and regression. The bot adds prioritization, semantic truth-checking and pedagogical quality.

### B2. Knowledge and documentation staleness bot — GO

**Purpose.** Turn inherited, allowed knowledge debt into evidence-backed repair proposals without weakening the new-violation gates.

**Trigger.** Nightly or twice-weekly read-only triage; on-merge only when changed code intersects a reference/doc ownership surface; manual deep audit for a selected package/goal.

**Inputs.**

- `bun run beep knowledge refs --check`; `knowledge semantic-delta`; `lint roadmap-refs`; `goals doctor`; `explore --check`; `explore atlas --check`.
- `AGENTS.md`, `.patterns`, `docs/ROADMAP.md`, `goals/INDEX.md`, `explorations/ATLAS.md`, manifests/READMEs, skill frontmatter, `.claude/agents` names.
- `standards/*.jsonc`, `standards/jsdoc-documentation.inventory.md`, `research/ledger/WATCHLIST.md`, and immutable packet `RUN.json`/`SUGGESTED_ACTIONS.md` files.
- Git history for the assertion owner and the implementation it describes; `.repos/effect` only for Effect v3/v4 truth.

**Decision procedure beyond lint.**

1. Partition findings by liveness and audience. Broken archival provenance is not equivalent to a broken live instruction.
2. For each candidate, identify the authoritative source, the consumer and the last code/doc changes.
3. Test semantic contradiction: command renamed/removed; path still exists but role changed; lifecycle status structurally valid but dormant; README claims surface no longer exported; law mentions a check that is not in CI; research proposal was already actioned elsewhere.
4. Assign `repair`, `explain/exception`, `propose owner`, `park`, or `no action`, each with evidence and confidence.
5. Enforce a novelty threshold and deduplicate against existing packet reports, watchlist rows, open goals and prior bot runs.

**Output.** Default report under the owning active goal packet’s `research/`, or a GitHub issue when there is no admitted owner. Use a narrow feature-branch PR through Yeet only for high-confidence live-doc repairs. Never mutate completed top-level research packets, `goals/INDEX.md`, `explorations/ATLAS.md`, `explorations/INBOX.md`, or create/admit a goal automatically. X DM may link to the run digest but cannot be the sole record.

**Guardrails.** Preserve archival evidence; do not “fix” intentional host-pattern test literals; do not use absolute home paths in committed output; never hand-edit projections; packet state flips and reflection land with final work; sanitize friction receipts; no docs under `_internal`; human admits research proposals.

**Required proof.** Before/after reference classifications; exact authoritative source; git dates/commits for both code and prose; owner/consumer; command help when a CLI claim is involved; projection checks; knowledge refs and semantic-delta after repair; package proof for source changes; Yeet receipt for PRs.

**Failure modes.** Treating 2,446 archival broken targets as 2,446 bugs; rewriting quotes/provenance; generating churn from age alone; trusting manifest `updated` as proof of inactivity; editing ignored/generated indexes; auto-opening goals; duplicate issues; false confidence from logger-truncated JSON.

**Quota pool.** Local/GitHub Actions produce compact deterministic censuses. Hosted Grok Bot consumes only bounded candidate bundles and makes the semantic disposition. A second-model proxy verifies contentious claims. Use local Grok timer only when repository-scale history must stay local.

**Quantified backlog.** 29,335 references; 2,446 broken targets but zero live gated; 491 unchanged semantic findings; 14 stale-and-changed READMEs; five real missing READMEs; 20 active goals with >28-day manifest age; 14 active zero-progress/>28-day goal candidates; one active exploration with an empty frontier; 101 research suggestions without machine-readable dispositions; 23 watchlist entries.

**Existing overlap.** `knowledge refs`, `semantic-delta`, roadmap refs, goals doctor, exploration checks, skill provenance, generated Atlas/Index and packet schemas already answer “is it structurally new/broken?” The bot answers “is the inherited statement now misleading, material, and worth changing?”

### B3. Beep style & law enhancer — RESHAPE

**Purpose.** Audit whether written laws are enforced, non-vacuous, correctly scoped and still useful; then propose narrow source fixes or law/tooling upgrades with differential proof.

**Trigger.** Weekly read-only audit; on-merge when `AGENTS.md`, `.patterns`, law scanner source, allowlists or baseline policy change; manual batch for one law/family. Do not run a prose/style rewrite on every PR.

**Inputs.**

- `AGENTS.md`, `.patterns/*.md`, `standards/effect-laws-v1.md`, generated-artifacts policy and architecture rules.
- All `beep laws` reports/checks; relevant `beep lint` checks; `schema-first.inventory.jsonc`; `schema-crispening.policy.jsonc`; Fallow/Knip/JSDoc/test-typecheck baselines.
- Scanner implementation, glob/scope, tests and CI/Yeet wiring. Use `.repos/effect` for Effect API law claims.
- Existing exceptions: 92 schema-first rows, 27 Effect-law allowlist rows (25 live + 2 unused in current native-runtime report), 66 test-typecheck blindspots.

**Decision procedure beyond lint.**

1. Build a law-to-scanner-to-CI-to-test matrix. A scanner that is never invoked, has an empty/wrong glob, or is clean only because its scope excludes the intended surface is a finding.
2. Run mutation/non-vacuity probes in a disposable worktree in an implementation lane: introduce one controlled violation, prove the scanner fails, then revert the probe. This audit lane itself does not mutate.
3. Review inherited exceptions for expired rationale, narrower replacement and ownership. Never auto-delete an exception just because it is old.
4. Separate mechanical transformations from semantic ones. `flow`/direct-helper candidates can be proposed mechanically; schemas, errors and service boundaries require Effect/schema-first specialists and package proof.
5. A proposed law change must name the false-negative/false-positive evidence, migration inventory, staged ratchet and non-vacuity test.

**Output.** Weekly law-health report and, for one proven issue, either a narrow feature-branch PR via Yeet or a design report under `agentic-governance-laws/research/`. Never mass-edit the repo or raise a baseline without explicit rationale. Open an issue only when the owner/packet is absent.

**Guardrails.** Schema-first and Effect-first skills for substantive changes; direct helper forms only when behavior is unchanged; search for reuse before helpers; `S.tag`/tagged constructors follow repo convention; test imports use aliases; generated baselines only move through commands and permitted PR types; main remains PR-only; no auto-merge.

**Required proof.** Law matrix, live counts, exact scanner scope, controlled non-vacuity failure, false-positive sample review, before/after report, targeted tests, package verify, Yeet receipt and full review-thread closure. A law proposal includes a migration estimate and baseline policy.

**Failure modes.** Generic “AI style” churn; weakening laws to make a report green; treating all 221 tooling findings as safe renames; breaking public imports with PascalCase file renames; scanner self-exemption; broad generated-baseline changes; using training-memory Effect APIs; duplicating Greptile/linters.

**Quota pool.** Hosted Grok Bot for law/intent comparison and exception review. Local/GitHub Actions for scanners and mutation proof. `claudeg`/`claudex` proxy lane for adversarial law review. Source-changing work remains a repo-capable execution lane, not hosted prose generation alone.

**Quantified backlog.** One live terse-Effect candidate; 2 unused Effect-law allowlist entries; 221 tooling schema-first/style violations (186/24/10/1); 92 reviewed schema-first exceptions; 66 test typecheck blindspots; 385 tracked Fallow health findings; and a possible 87-carrier policy-scope gap. Strict Effect violations, schema inventory drift, schema topology, circular deps, deprecated APIs and test-import violations are currently zero.

**Existing overlap.** Effect law scanners, schema-first inventory, architecture command, lint policy, Fallow, Knip, JSDoc ratchet, Yeet and Greptile already catch deterministic patterns. The bot owns non-vacuity, exception quality, cross-law contradictions and staged upgrades.

## C. Broader candidate catalog

Scoring is 1–5. `value`, `frequency`, `evidence`, and `grok_fit` reward higher values; `risk` is change/false-positive risk, so lower is better. Weighted score is `3×value + 2×frequency + 2×evidence + 2×grok_fit − risk` (maximum 44). The canonical machine-readable rows are in `codex-c1-candidates.jsonl`.

| Rank | Candidate | Evidence/backlog | Pool | V/F/E/G/R | Score |
| ---: | --- | --- | --- | --- | ---: |
| 1 | Knowledge/staleness disposition | 491 inherited semantic findings, 2,446 non-gated broken refs, 14 stale READMEs | Hosted judgment + local census | 5/5/5/5/2 | 43 |
| 2 | Documentation enhancement batches | 58 packages, 347 modules, 99 exports, 427 prose-shape findings | Hosted draft + local proof | 5/4/5/5/2 | 41 |
| 3 | Research-action reconciliation/nudges | 101 suggestions, 23 watchlist rows, no disposition ledger | Hosted synthesis | 5/5/4/5/2 | 41 |
| 4 | Beep law non-vacuity/exception review | 221 tooling findings, 92 schema exceptions, 2 unused allowlist rows | Hosted review + local probes | 5/4/5/5/3 | 40 |
| 5 | Goals/explorations portfolio doctor | 20 aged active goals; 14 zero-progress/aged; one empty exploration frontier | Hosted judgment + deterministic manifests | 5/4/5/4/2 | 39 |
| 6 | Effect v4 RC upstream impact watch | Repo pins rc.112 while local reference contains later upstream work; watchlist already tracks rc.113/MCP | Hosted diff judgment + local reference | 5/4/4/5/3 | 38 |
| 7 | CI flake/hang/economics triage | Watchdog paused at P0; economics active 3/4; known hang class | Actions evidence + hosted clustering | 5/5/4/4/3 | 38 |
| 8 | Test-typecheck blindspot burn-down | 66 inherited blindspots, 0 introduced | Local/GHA mechanical + hosted batching | 4/4/5/4/2 | 36 |
| 9 | Greptile/review-thread triage assistant | Yeet already owns exact closure; bot can classify/draft only | Yeet/GitHub + hosted drafting | 4/5/5/3/4 | 34 |
| 10 | QA evidence auditor and scenario proposer | Mature recorded QA substrate and two active bot/goal contexts | QA artifacts + hosted judgment | 4/4/5/4/4 | 34 |
| 11 | Docgen example compile fixer | Four missing examples; one import finding; doctest lane exists | Local doctest + hosted repair | 4/3/5/4/4 | 32 |
| 12 | Dependency digest with Effect-aware impact | Frequent dependency commits; Effect RC pin and reference checkout | Hosted analysis + local usage search | 4/4/4/4/4 | 32 |
| 13 | Coverage/test-gap planner | 30 packages below a minimum; 21,498 uncovered lines; 40 follow-ups | Local coverage + hosted semantic prioritization | 4/3/5/4/4 | 32 |
| 14 | Fallow health remediation selector | 385 findings across 157 files; dead-code baseline zero | Local report + hosted risk selection | 4/3/4/4/3 | 31 |
| 15 | Codex security finding packet triage | Existing ingest command and recurring completed batches | Export + local packetization + hosted triage | 5/3/4/3/4 | 31 |
| 16 | Skill A/B effectiveness evaluator | beep-mode decision 18 defines blinded isolated evaluation; 34 skills | Proxy/local experiment | 4/2/4/5/3 | 31 |
| 17 | Schema exception revalidation | 92 reviewed exceptions; no live drift | Hosted review + schema specialist | 4/2/5/4/4 | 30 |
| 18 | Weekly friction-ledger rollup | Friction capture is law; reports are distributed across active packets | Hosted synthesis, no source mutation | 3/4/3/4/2 | 29 |
| 19 | Changeset/version-sync drift reviewer | Deterministic diff gate clean at main; dependency/release churn recurring | GHA/local report | 3/4/5/2/2 | 29 |
| 20 | Ontology/schema catalog semantic consistency review | 5,256 catalog entries; ontology skills and validators exist | Local ontology validation + hosted review | 3/2/4/4/4 | 25 |
| 21 | Deprecation-purge campaign | Current deprecated API count zero; recurring only after upgrades | Local lint; hosted only for impact | 3/2/5/2/2 | 25 |
| 22 | Reflection-to-skill proposal miner | Reflection loop exists; auto edits could overfit | Hosted synthesis + human admission | 3/2/3/4/4 | 23 |
| 23 | PR babysitter / full autopilot | Yeet already owns monitoring/replies/merge-ready truth | Yeet, not a new Grok bot | 2/5/5/1/5 | 23 |
| 24 | Fallow dead-code sweep PRs | Current tracked baseline is zero | Local report only when regression appears | 2/2/5/1/2 | 20 |
| 25 | Memory-file consolidation reminder | File memory only; no shared memory service; private/user-scoped | Local/manual session | 2/2/2/2/4 | 14 |

The table intentionally includes low-ranked/drop candidates. A candidate can be useful without deserving scarce hosted quota. In particular, dead-code, deprecation, changeset and PR-state monitoring are deterministic-first jobs; Grok should enter only when an actual ambiguous finding appears.

### Recommended operating order

1. Start with **read-only weekly staleness disposition** and **research-action reconciliation**. Both consume existing immutable artifacts and can prove usefulness without source mutation.
2. Add **one-package documentation batches** after the staleness selector demonstrates acceptable precision.
3. Pilot **law non-vacuity** on one scanner and one controlled mutation in a disposable implementation worktree.
4. Add upstream/CI jobs only after the external research lanes confirm Grok Bot trigger/artifact/repo constraints.
5. Keep deterministic-only candidates in GitHub Actions/local timers and invoke hosted judgment only on non-empty deltas.

## D. Nightly research routine: planned architecture versus reality

### Planned in the goal packet

`goals/nightly-research-routine/{SPEC,PLAN}.md` describes a local orchestrated pipeline:

1. deterministic prelude;
2. blind `claudeg` search using Grok;
3. independent Sol/Luna verification;
4. a single Fable writer;
5. deterministic publisher;
6. `beep research nightly run|digest|install-timer|status` CLI and a systemd timer in a dedicated clone;
7. PR-only publication and human merge.

The plan has only P0 complete; P1–P4 remain unchecked. The live `research` CLI has no `nightly` subcommand.

### Actual five-packet system

The five `research/*/RUN.json` records (2026-08-26, 28, 29, 30, 31) are all `partial` and total **106 claims** (34 + 15 + 15 + 21 + 21). Reality is:

- search: hosted Grok Bot with web/GitHub/arXiv inputs;
- writer: hosted Grok Bot;
- publisher: Cursor Cloud Agent;
- X source: blocked in all five;
- cross-provider verification: absent in all five;
- GitHub MCP: DCR/`needsAuth` friction in all five;
- one publisher payload truncation on 2026-08-31;
- additional partial causes include a prior closed-unmerged packet, Sunday arXiv gaps, LawNext gaps and USPTO authentication.

The hosted routine is productive—106 claims and 101 actionable suggestions—but it is not the independently verified, deterministic-publisher system the goal claims it will become.

### Recommendation: formalize a hybrid, do not replace the working search/writer

Keep hosted Grok Bot for discovery and first-pass writing. Build only the missing deterministic spine locally/repo-side:

1. **Artifact contract and preflight.** Accept a bounded, schema-validated claim/source bundle with digest, source inventory, prompt snapshot and run metadata. Reject missing/oversized fields before publication.
2. **Independent verify stage.** Dispatch the compact claims to Sol/Luna or a `claudeg`/`claudex` proxy without showing the writer answer, record verdict/evidence, and preserve partial status when no verifier is available. Do not mark an unverified packet complete.
3. **Repository-native publisher.** Use `gh`/git through a dedicated, least-privileged, 1Password-injected environment rather than depending on GitHub MCP authentication. Preflight auth without exposing values, write the feature branch, run packet validation/Yeet, and never merge.
4. **Payload transfer.** Stop embedding a whole packet/base64 bundle in a cloud-agent prompt. Exchange bounded files/artifacts with a manifest, per-file digest, size cap, chunk/resume semantics and post-transfer validation.
5. **Source capability model.** Record X, GitHub, arXiv, LawNext and authenticated USPTO as independent typed capabilities. A source outage produces a named partial result and retry window, not a misleading complete packet.
6. **Action reconciliation.** Add machine-readable disposition outside immutable packets (single-writer ledger/projection): suggested, captured, watchlisted, superseded, rejected, or admitted by a human. Never auto-append to `explorations/INBOX.md` or `goals/`.
7. **Reconcile the goal docs.** Amend the SPEC/PLAN through a normal PR to describe the successful hosted front half plus local verifier/publisher back half, and either implement the missing `beep research nightly` surface or remove that unimplemented command promise.

This fixes the recurring failure classes at the repo boundary:

- **X blocked:** capability-specific partial status and retry/native hosted-source routing; no repeated auth loop.
- **No Sol/Luna verify:** independent local/proxy verifier with blinded compact inputs.
- **GitHub MCP `needsAuth`:** publisher preflight and dedicated `gh` credential injection; MCP becomes optional.
- **Payload truncation:** digest-addressed bounded file transfer instead of prompt embedding.
- **Closed/unmerged or commitlint failures:** deterministic publisher owns branch state, conventional message and Yeet receipt.
- **Source schedule gaps:** typed source-unavailable evidence and scheduled retry, never fabricated coverage.

## Boundaries and non-recommendations

- This report does not design the bot-pack file convention, schemas or architecture; C2 owns that.
- No automation should merge. `bun run beep yeet monitor` and review-thread closure remain the authority for “merge-ready.”
- A hosted bot should not edit an immutable top-level research packet after merge, admit goals/explorations, hand-edit projections/baselines, or write `docs/_internal`.
- Do not resurrect basic-memory or codegraph. Memory is file-based and per-agent/repo-local.
- The pstack `automations/benny` material is useful prior art for fail-closed, event-driven issue reproduction and draft-PR evidence, but its full-autopilot/stack/shipping assumptions were explicitly dropped by the beep-mode decisions. Borrow the evidence discipline, not its ownership model.
- Automated cleanup must be delta-driven. If dead-code/deprecation/changeset gates are empty, the correct bot action is “no run,” not a speculative refactor.

## Evidence map

- Laws/patterns: `AGENTS.md`, `.patterns/*.md`, `standards/effect-laws-v1.md`, `standards/generated-artifacts.policy.md`.
- Baselines: `standards/*.jsonc`, `standards/jsdoc-documentation.inventory.md`.
- Knowledge design: `goals/knowledge-surface-automation/` and its `research/` decisions.
- Quality goals: `effect-jsdoc-quality`, `jsdoc-carrier-migration`, `quality-gate-ratchets`, `agentic-governance-laws`, `speed-loop`, `ci-step-watchdog`, `ci-lane-economics`, `agent-reflection-loop`, `agent-effectiveness-loop`, `skill-contract-kernel`.
- Research design/reality: `goals/nightly-research-routine/`, `research/README.md`, five `research/*/RUN.json` packets, `research/ledger/WATCHLIST.md`.
- QA: `goals/professional-desktop-adversarial-qa/`, `goals/recorded-qa-acceptance/`.
- Agent-mode prior art: `explorations/beep-mode/`, its pstack distillation, and `~/YeeBois/dev/cursor-plugins/pstack` README/playbooks/`automations/benny`.
- Portfolios: `explorations/{INBOX,ATLAS}.md`, `goals/INDEX.md`, `docs/ROADMAP.md`.
- Agent capability inventory: 34 `.claude/skills/*/SKILL.md` frontmatter records and 7 `.claude/agents/*.md` definitions.
