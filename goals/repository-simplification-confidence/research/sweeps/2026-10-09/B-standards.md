# Sweep B — standards, .patterns, docs: classification and stale guidance

## Provenance

- Checkout: lane `rsc-packet` (sibling worktree root), branch `docs/repository-simplification-confidence-packet`, head `e62411d63f` (= `origin/main`). Date 2026-10-09.
- Installed tool versions used for API checks: `effect` 4.0.2 (`node_modules/effect/dist/*.d.ts`), `.repos/effect` at `66257d2922` (`packages/effect` 4.0.2).
- Read-only commands: `git ls-files`, `git log` (`-S`, `--diff-filter=D`, `--follow`), `rg`, `jq` (comment lines stripped from `.jsonc`), `grep -c` over installed `.d.ts`, `bun run beep models --help`. A small scratch script listed every `Effect.x`/`Layer.x`/`Schema.x`/`S.x`/`Config.x` member named in Markdown under `standards/`, `.patterns/`, `docs/runbooks/` and checked each against the installed v4 `.d.ts` exports, then checked each backticked repo path for existence. No checkout writes; no scanners re-run. Every count below is read from committed artifacts, not a fresh scan.
- Ownership: `.github/CODEOWNERS` assigns `*` to the operator. The "Owner" column below names the **functional** owner: the CLI command family under `packages/tooling/tool/cli/src/commands/` (writer or gate), or the doctrine document that governs the file.

## 1. Classification

Categories: **policy** (binding law or operating procedure) · **remediation inventory** (open debt plus a ratchet) · **exception registry** (reviewed, owner-carrying exceptions) · **catalog** (useful reference data, not debt) · **coverage floor** (a fail-on-regression floor) · **generated projection** (written only by a tool) · **historical evidence** (dated record, not instruction).

### 1a. `standards/` data artifacts (25)

| File | Class | Writer / refresh command (as named in file header or code) | Owner (code) | Committed counts |
|---|---|---|---|---|
| `schema-first.inventory.jsonc` | exception registry (+ empty remediation backlog) | `bun run beep lint schema-first --write` (`Lint/SchemaFirst.ts`, flag `write`, ~l.459) | Lint / `SchemaFirst.ts` | 115 entries, all `status: exception`; `backlog` = 0. Kinds: schema-policy-advisory 48, exported-interface 34, object-struct-schema 17, exported-type-literal 16. ruleId: none 67, SFV4-arbitrary-tests 32, SFV4-fn-schema 10, SFV4-precision-audit 4, SFV4-null-return 2. 84 files, 32 in tests. All 115 have reason and owner. `generatedOn` 2026-10-09 |
| `effect-vitest.inventory.jsonc` | remediation inventory + exception registry (mixed) | header: `bun run beep lint effect-vitest --write` (`Lint/internal/EffectVitestScan.ts`) | Lint / EffectVitestScan | 1,879 findings: open 741, exception 1,138. Lens: resource 1,544, detector 335. 93 packages. Open by rule: EV002 208, EV010 183, EV004 73, EV006 73, EV009 45, EV014 44, EV003 32, EV001 29, EV015 24, EV011 9, EV007 6, EV008 5, EV013 5, EV005 3, EV012 2. Exceptions all carry a reason, but they are templated (the most common reason string appears 62 times, the next 37, 28, 26, 25, 24) |
| `effect-vitest.primitives.jsonc` | catalog | header: "Regenerate anchors, review semantic diffs, update the pin as one change"; no CLI writer found | Lint (`Lint.schemas.ts` reads it) | 102 entries, pinned `@effect/vitest@4.0.2` sha `269a7c8643` |
| `jsdoc-documentation.inventory.jsonc` | generated projection (remediation inventory) | `bun run beep quality jsdoc-inventory` (`Quality/internal/JSDocDocumentationInventory.ts`) | Quality / JSDoc | generatedAt **2026-10-05T23:45Z**, which predates PR #1552 (per-module imports, `aa9ce19cff`). Totals: packages 141, clean 19, needing remediation 120, openModules 366, openExports 2,949, missingExportExamples 9, exampleImportFindings 3,111, no-root-package-import 3,110, multiple-description-paragraphs 426, undescribed-see 11, invalid-when-to-use-prefix 4, invalid-heading 1, forbidden-remarks 0 |
| `jsdoc-documentation.inventory.md` | generated projection | same writer (`defaultJSDocDocumentationInventoryMarkdownPath`, l.231) | Quality / JSDoc | same totals, Generated 2026-10-05 |
| `jsdoc-totals.regression-baseline.jsonc` | coverage floor (fail-on-growth ratchet) | `bun run beep quality jsdoc-ratchet --write-baseline` (after the inventory) | Quality / `JSDocRatchet.ts` | packagesNeedingRemediation 120, missingExportExamples 9, multiple-description-paragraphs 426, undescribed-see 11, invalid-heading 1; generated 2026-10-05 |
| `schema-catalog.generated.jsonc` | catalog (generated projection) | `bun run beep lint schema-catalog --write` (`Lint/SchemaCatalog.ts` ~l.800) | Lint / SchemaCatalog | 6,211 entries (schema-class 3,346, literal-kit 1,055, tagged-error 506, tagged-class 393, brand 234, tagged-union 221, codec 154, union 153, schema-const 114, struct-const 29, tagged-struct 6) |
| `fallow.pilot.inventory.jsonc` | historical evidence (used as a live input) | none; hand-recorded 2026-06-08, fallow **2.89.0** | Quality / `FallowQuality.command.ts` uses it only as `fallbackSourceRef` (l.84, 563, 679) | Knip probe 31 issues; decision `advisory-pilot`, `replaceKnipNow: false`. Also an input of 8 `turbo.json` tasks (l.941–1241) and 2 cache-baseline nodes |
| `fallow.boundaries.generated.jsonc` | generated projection | `bun run fallow:boundaries:write` → `bun run beep fallow boundaries --write` (`Fallow/Fallow.command.ts`, `DEFAULT_BOUNDARY_CONFIG_PATH`) | Fallow | 152 zones |
| `fallow.boundaries.provenance.jsonc` (+ `.schema.json`) | catalog, **stale** | none. `RegistrationGeometry.plan.ts:92` names the `fallow-boundaries` writer as producing it, but `Fallow.command.ts` contains no "provenance" string. No validator for `fallow-quality-enforcement-validator/v1` exists in source | unowned in code | 97 rules vs 152 generated zones; `updated` 2026-07-06 |
| `fallow.health.regression-baseline.jsonc` | remediation inventory (ratchet) | `bun run fallow:health:baseline:write` (root script, `fallow health --save-baseline`) | Quality / FallowQuality (gate l.923) | 181 findings (sum of `finding_counts`) |
| `fallow.dead-code.regression-baseline.jsonc` | coverage floor (zero floor) | `bun run fallow:dead-code:baseline:write` | Quality / FallowQuality (l.878) | total_issues 0; recorded with fallow **3.15.0** (installed 3.32.0), sha `48b0a590d6` |
| `knip.regression-baseline.jsonc` | remediation inventory (ratchet) | `bun run beep quality knip --write-baseline` (`Quality/internal/KnipRatchet.ts:33`) | Quality / KnipRatchet | 41 findings: exports 32, files 5, types 2, devDependencies 1, unresolved 1. **Workstream A retires Knip, so this file goes with it** |
| `coverage.regression-baseline.jsonc` | coverage floor | header: `bun run coverage -- --filter=<pkg> --write-baseline` (rows) / `bun run coverage:baseline:write` (whole) | Quality / `CoverageRegression.ts`, `CoverageScope.ts` | 138 packages, 40 follow_ups, 3 exemptions (`@beep/scratchpad`, `@beep/storybook`, `@beep/tsgo-shim`); minimum lines 70 / statements 70 / branches 50 / functions 60; header `generated_at` 2026-08-29 (rows updated since, last commit 2026-10-07) |
| `check-census.regression-baseline.jsonc` | coverage floor (instantiation ratchet) | `bun run beep quality check-census --write-baseline` (needs a built tree) | Quality / `CheckCensus.ts`, `CheckCensusGate.ts` | 3 packages; measured 2026-10-01 with compiler `7.0.2+effect-tsgo.0.45.0` (installed `@effect/tsgo` is 0.47.2) |
| `test-typecheck.blindspot-baseline.jsonc` | remediation inventory (shrink-only) | `bun run beep lint package-test-typecheck --write-baseline` (`Lint/PackageTestTypecheck.ts:67`) | Lint | 1 finding (`@beep/repo-cli` missing-test-tsconfig), with a hand note |
| `cache-qualification-baseline.json` | generated projection (reviewed baseline) | `bun run beep cache baseline --request <file>` (`Cache/Cache.command.ts:701`; writes via `Cache.service.ts:485`) | Cache | schema v2, profile `local-linux-x64-bun1.4.2`, 2,087 projection nodes, 15 sources, 3 global-config entries, 152 review records, scope 4 lint computations |
| `cache-qualification.json` | generated projection (tuple store) | `Cache.service.ts:480/618` (cache baseline / transition) | Cache | 5 entries, revision 5; profile still `bun1.4.1` / epoch `qualification-v1` (baseline is bun1.4.2 / v2) |
| `effect-laws.allowlist.jsonc` (+ `.schema.json`) | exception registry (hand-edited) | hand-edited; snapshot codegen `bun run codegen` in `packages/tooling/policy-pack/repo-configs` (`scripts/GenerateEffectLawsAllowlistSnapshot.ts`) | Laws / `AllowlistCheck.ts`; repo-configs ESLint | 27 entries (new-map-set 13, object-method 11, native-error 2, date-static 1), each with owner and issue id |
| `changesets.retired-packages.json` | exception registry | written by `beep delete-package` (`DeletePackage.command.ts:63`) | DeletePackage / Quality ChangesetGraph | 6 packages (pending changesets kept "until release cleanup drains them"; this ties into workstream D) |
| `policy-tools.fingerprint.json` | generated projection | `beep lint policy-fingerprint --write` (check: `bun run lint:policy-fingerprint`) | Lint (`Lint.command.ts:867`) | 88 inputs; includes `knip.jsonc`, so the Knip retirement must regenerate it |
| `lint-policy.sweeps.jsonc` | policy (config) | hand-edited | Lint / Quality Tasks | 1 key (`deprecatedApis: "shards"`) |
| `schema-crispening.policy.jsonc` | policy (config) | hand-edited | Lint / `SchemaFirstPolicy.ts` | 4 cards, 4 blocking families |

### 1b. `standards/` prose (36)

| File | Class | Owner / note |
|---|---|---|
| `ARCHITECTURE.md` | policy (binding constitution) | canonical authority (AGENTS.md) |
| `architecture/00`–`15-*.md` (16 files) | policy (rationale packet) | canonical authority; stale examples listed in §2 |
| `architecture/README.md`, `GLOSSARY.md` | policy | canonical |
| `architecture/DECISIONS.md` | historical evidence (decision log; binding for its rulings) | canonical |
| `effect-laws-v1.md` | policy (short laws) | Laws; links two `.patterns` files (l.89–90) |
| `effect-first-development.md` | policy (long-form companion) | consumed by the schema-first skill (`SKILL.md:18`); has stale v4-prerelease APIs (§2) |
| `schema-first-development-prompt.md` | policy-adjacent operational prompt ("not a new source of repository law", l.7–9) | duplicates the schema-first skill and carries obsolete JSDoc advice (§2) |
| `generated-artifacts.policy.md` | policy | lists only 3 generated artifacts. `RegistrationGeometry.plan.ts` is the real registry (§2) |
| `git-worktrees.md` | policy | overlaps AGENTS.md worktree/sweep laws |
| `turbo-remote-cache.md` | policy (operator runbook kept in `standards/`) | calls `scripts/enable-turbo-remote-reads.sh` (l.36, 56), which workstream C ports; names knip as `cache: false` (l.203) |
| `cache-qualification-dependency-review.md` | historical evidence | no consumer found by `rg` |
| `memory-architecture/04-decision-log.md` | historical evidence (binding rulings) | canonical for memory |
| `memory-architecture/README.md` | policy (framework, with status amendment) | file table marks 06/07 superseded |
| `memory-architecture/00-no-escape-theorem.md`, `01-memory-layer-taxonomy.md` | policy (theory) | 01 l.55 is current-tense stale (§2) |
| `memory-architecture/02-thread-triage.md`, `05-context-graph-capability-assessment.md`, `06-agent-memory-operations.md`, `07-shared-memory-adoption.md` | historical evidence (each has a SUPERSEDED/Historical banner) | fine as history |
| `memory-architecture/03-saas-landscape-assessment.md` | historical evidence (no banner) | l.24–29 still says Graphiti is under write-freeze |

### 1c. `.patterns/` (6)

| File | Class | Note |
|---|---|---|
| `jsdoc-documentation.md` | policy (binding; retain per brief) | referenced by AGENTS.md:161, 338, by 2 skills and by 4 `.codex/agents/*.toml` |
| `error-handling.md` | policy, **stale** | teaches the removed `S.TaggedErrorClass` and v3 combinators (§2) |
| `effect-library-development.md` | policy, **stale / copied upstream** | `packages/effect/src/...` workflow, `.ts-morph` corruption, `biome check . --write` |
| `module-organization.md` | copied upstream guidance (effect-smol library internals); not repo law | 38 `.ts-morph` corruptions; 0 `beep` mentions |
| `testing-patterns.md` | copied upstream guidance | `Effect.fork`/`Effect.join` (l.98–124), which are absent in 4.0.2; referenced by the effect-first skill (`SKILL.md:33`) |
| `README.md` | copied upstream guidance | l.56 recommends whole-repo `biome check . --write`; l.57 recommends full `bun run docgen` (AGENTS.md:240 says `docgen:local` for edit loops) |

`git log --follow` traces `module-organization.md` back to the `.repos/effect-smol` squash (2026-02-18). The `.ts-morph` text was introduced in `17c00aa92e` (2026-02-28, "chore: stabilize repo quality gates"). It looks like a bulk `.ts` → `.ts-morph` replace.

### 1d. `docs/` (top two levels; 67 tracked files)

| Path | Class | Note |
|---|---|---|
| `docs/README.md` | policy (layout law) | table omits `agent-memory-infra/`, `graphs/`, `mirror/`, `runbooks/evidence/`. Its rule "raw brainstorm and research material lives in exploration packets, not under docs/" is contradicted by those directories |
| `docs/ROADMAP.md` | policy (priority layer; Freshness 2026-10-05) | — |
| `docs/BEEPGRAPH_ARCHITECTURE.md`, `PROSE_TO_PROOF_{ARCHITECTURE_MAP,VISION,USER_STORY,FOR_TOM}.md` | policy (product identity docs) | dead links: `goals/ip-law-knowledge-graph/**`, `goals/trustgraph-port`, `goals/knowledge-workspace/...`, `goals/ontology-modeling-foundation/SPEC.md` (deleted by #401, 2026-07-14), and `packages/repo-memory` (deleted 2026-04-27) |
| `docs/PROSE_TO_PROOF_{CHAT,GRAPH,VISUALIZATION}.html`, `docs/AI_GRAPH_ENGINEERING.jpeg` (310 KB) | historical evidence (static mockups/assets) | `rg` found no consumer outside `docs/` and root `README.md` |
| `docs/product/*.md` (7) | policy (product specs) | `prose-to-proof.md` links missing `docs/approval-and-autonomy-policy.md`, `docs/runtime-data-loop.md`, `goals/ip-law-knowledge-graph/SPEC.md` |
| `docs/security/threat-model.md` | policy | consumed by Codex Security |
| `docs/agent-memory-infra/*.md` (15) | historical evidence (2026-07-08 research run) | **no superseded banner**; Role B recommendation is current-tense (§2) |
| `docs/graphs/*.md` (4) | catalog (scraped third-party spreadsheet tables) | external data, not repo-authored guidance; it belongs in research/explorations per `docs/README.md` |
| `docs/mirror/*.md` (2) | historical evidence (personal record, self-described "deliberately peripheral") | points at untracked `docs/_internal/mirror/` |
| `docs/runbooks/*.md` (27) | policy (operational owners) | see list below |

Runbooks (by name): agent-convention-comparisons, agent-notifications, agent-pools (contains generated block `beep-models:begin cursor-seats`, l.132–141; `Models.render.ts:8` says `check` only, "a future `--write`"), aws-cost-operations, ci-runner-reliability, cloud-environments, codex-security, codex-security-cloud, design-system-lint, docket-intake-entra-registration, docket-intake-first-run, fallow-audit-cache, graft-local-recovery, lab-promotion, m365-agent-outbox-registration, onepassword-beep-secrets-layout (calls `scripts/onepassword/beep-secrets-layout.sh` l.31–32, a workstream C port target), practice-box-content-migration, practice-box-drive-windows, practice-box-how-to, practice-mail-tagging, research-library, **skillopt-rerun** (becomes historical evidence when workstream A retires `tools/skillopt`; 27 SkillOpt references), systemd-timers (calls `scripts/setup-effect-ref.sh` l.14, 46, a port target), turbo-cache-inputs (lists `knip:check` l.109), typescript-toolchain (knip row l.57), xstate-effect-statecharts. Deeper level: `docs/runbooks/evidence/2026-10-01-spot-pool-spread-launches.md` (historical evidence, linked from ci-runner-reliability).

**Totals:** standards 61 (25 data + 36 prose), .patterns 6, docs 67 = **134 files**. By class:

| Class | Files |
|---|---:|
| Policy | about 70 (16 architecture chapters + 27 runbooks + product/identity docs) |
| Historical evidence | about 30 |
| Generated projection | 8 |
| Remediation inventory | 5 |
| Exception registry | 3 (+ the mixed effect-vitest inventory) |
| Coverage floor | 4 |
| Catalog | 4 (+ docs/graphs) |
| Copied-upstream policy to retire or rewrite | 3 (`.patterns` module-organization, testing-patterns, README) |

## 2. Stale-guidance candidates (file:line)

### 2a. Obsolete JSDoc tags (contradict `.patterns/jsdoc-documentation.md` "Carrier policy", l.54–70)

- `standards/schema-first-development-prompt.md:278` recommends "a useful fenced `@example`". Line 280 recommends "`@remarks`". Line 324 shows an `@example` tag. Line 677 says "`@example` demonstrates…".
- `.patterns/effect-library-development.md:479, 495`: `@example` in JSDoc samples.
- `.patterns/module-organization.md:305, 410`: `@example` in samples.
- `@remarks` inside sample code blocks of the binding architecture packet: `standards/architecture/04-rich-domain-model.md:212, 271, 292`; `05-layer-composition.md:109, 233`; `08-testing.md:250`; `10-cross-slice-coordination.md:124`; `12-observability.md:88, 127, 161, 195`.
- Tooling label drift: `JSDocDocumentationInventory.ts:232` (`requiredExportTags = ["@example", …]`) emits `requiredExportTags: ["@example", "@category", "@since"]` into `standards/jsdoc-documentation.inventory.jsonc`. The law forbids `@example`; the code treats a titled Example as satisfying it (l.369, and the "scoring detail" note in the law, l.68–70). Rename or relabel the field.
- Acceptable as counter-examples: `.patterns/jsdoc-documentation.md:146–155` (a labeled "Before" block).

### 2b. Legacy error helpers and Effect v3 / v4-prerelease APIs (checked against installed `effect` 4.0.2 `.d.ts`)

| Location | Mention | 4.0.2 fact |
|---|---|---|
| `.patterns/error-handling.md:60, 72, 88, 114, 245, 265, 626`; `.patterns/effect-library-development.md:209, 211, 222, 234` | `S.TaggedErrorClass` | absent from `Schema.d.ts` and from all `packages/**/src`. The current helper is `S.TaggedError` (Schema.d.ts:10908; 583 source uses; `effect-laws-v1.md` law 7 already names it). The only use left is a test fixture string, `cli/test/schema-first-parity.test.ts:853` |
| `.patterns/error-handling.md:414` | heading "Effect.catchAll Pattern" (body uses `Effect.catch`) | `catchAll` absent; `catch` exported (Effect.d.ts:4281) |
| `.patterns/error-handling.md:454, 464` | `Effect.catchSome` | absent (`catchFilter`/`catchIf` exist) |
| `.patterns/error-handling.md:573` | `Effect.tapErrorCause` | absent (`tapCause` exists) |
| `.patterns/error-handling.md:617` | `Effect.orElse` | absent from Effect (`orElseSucceed` exists) |
| `.patterns/error-handling.md:589–590` | `Schedule.whileInput`, `Schedule.compose` | absent from Schedule.d.ts |
| `.patterns/testing-patterns.md:98, 108, 119, 124`; `.patterns/effect-library-development.md:551, 558` | `Effect.fork`, `Effect.join` | absent (`forkChild`/`forkScoped`/`forkDetach`; join lives on Fiber) |
| `standards/effect-first-development.md:713, 1313` | `Config.int(...)` | absent (`Config.Int`, Config.d.ts:1081) |
| `standards/effect-first-development.md:719, 730, 1314, 1359` | `Config.redacted(...)` | absent (`Config.Redacted`, l.1406) |
| `standards/effect-first-development.md:722` | reference link `.repos/effect/packages/effect/src/Config.ts:1161` | that line is now `Config.Array` |
| `standards/effect-first-development.md:251`; `standards/schema-first-development-prompt.md:223, 395, 608, 626` | `S.toArbitrary` | absent from Schema; `effect/Arbitrary` exports `schema`, `make`, … (the primitives header says upstream moved it in rc.118) |
| `standards/effect-first-development.md:893` | `S.isIncludes` | absent; `S.isIncluding` exists |
| `.patterns/jsdoc-documentation.md:128` (the binding law's own example) | `S.NonEmptyTrimmedString` | absent from effect and from `packages/**` |
| `standards/architecture/13-onboarding-the-minimum-viable-slice.md:39, 149` | ports as "`Context.Tag`" | v4 uses `Context.Service` (Context.d.ts:196; `effect-first-development.md` EF-8, l.215) |

Not stale (verified): `effect/http` is a real 4.0.2 export (`package.json` exports `./http`), so `effect-laws-v1.md:20` and `effect-first-development.md:1374` are correct for the installed version.

### 2c. Whole-repository formatting advice

- `.patterns/README.md:56`: "`biome check . --write` after editing TypeScript files".
- `.patterns/effect-library-development.md:377, 391`: `biome check . --write packages/effect/src/…` (the `.` makes it whole-repo, and the path is an upstream path). `:400` runs `bun run test packages/effect/test/…`.
- `.patterns/README.md:57` (full `bun run docgen` as the edit-loop gate) conflicts with AGENTS.md:240–242.
- Acceptable: `docs/runbooks/graft-local-recovery.md:113` (single file).

### 2d. Current-tense memory-service recommendations superseded by `04-decision-log.md` (2026-08-06, 2026-08-29)

- `docs/agent-memory-infra/00-recommendation.md:21–25`: "Role B … Cognee survives as the single always-on memory incumbent". This was superseded twice (08-06 handed the role to basic-memory + codegraph; 08-29 made file memory the memory layer). The file has no banner.
- `docs/agent-memory-infra/README.md:10–11`: "Role B — dev-tooling memory … resolves the current Graphiti-vs-Cognee drift; final rec picks one winner". No banner.
- `standards/memory-architecture/01-memory-layer-taxonomy.md:55`: "Graphiti itself is write-frozen pending decommission". The 2026-07-25 entry fired retirement.
- `standards/memory-architecture/03-saas-landscape-assessment.md:24–29`: same write-freeze phrasing. No historical banner.
- `docs/runbooks/onepassword-beep-secrets-layout.md:62`: `COGNEE_CLOUD_API_KEY` mapping row. Check whether the secret still has a consumer.
- Already correctly bannered: 02, 05, 06, 07.

### 2e. Copied guidance that duplicates a canonical authority

1. `.patterns/{module-organization,testing-patterns,README}.md` are upstream effect-smol library guidance, not beep law. Only `testing-patterns.md` has a live consumer (`.claude/skills/effect-first-development/SKILL.md:33`).
2. `.patterns/error-handling.md` and `effect-library-development.md` restate `effect-laws-v1.md` law 7 and `effect-first-development.md`, and they contradict them on the error helper.
3. `standards/schema-first-development-prompt.md` (727 lines) restates the schema-first skill (`.claude/skills/schema-first-development/` with 4 references) plus the effect laws, and drifts (§2a, §2b).
4. `docs/runbooks/agent-pools.md:18–23` and the cursor-seat tables restate AGENTS.md "Volume pools". The `beep-models` blocks are check-only (`Models.render.ts:8`), so they are hand-maintained copies under a drift checker.
5. `standards/generated-artifacts.policy.md:9–14` lists 3 generated artifacts. The code registry `internal/cli/RegistrationGeometry/RegistrationGeometry.plan.ts:89–144` lists 9 generated surfaces under `standards/`, and 3 of its writer labels are wrong:
   - `fallow-health-baseline` (l.112–114) names writer `fallow-boundaries`; the real writer is root `fallow:health:baseline:write`.
   - `fallow-dead-code-baseline` (l.118–120) also names `fallow-boundaries`.
   - the `fallow-boundaries` surface claims it outputs `fallow.boundaries.provenance.jsonc` (l.92), which nothing writes.
6. `standards/git-worktrees.md` overlaps AGENTS.md "Full git checkouts…" and `yeet sweep --retire` laws. Its framing "replace duplicate full clones like beep-effect2 and beep-effect3" (l.3–5) is not the current fleet layout. Unverified beyond the header.
7. `docs/README.md` layout table (l.7–15) is incomplete, and its rule is contradicted (see §1d).

### 2f. Callers coupled to other workstreams (update with A/C, not separately)

- Knip retirement (A): `standards/knip.regression-baseline.jsonc`; `policy-tools.fingerprint.json` input `knip.jsonc`; `fallow.pilot.inventory.jsonc` (records `knipRole`); `standards/turbo-remote-cache.md:203`; `docs/runbooks/turbo-cache-inputs.md:109`; `docs/runbooks/typescript-toolchain.md:57`.
- Script ports (C): `standards/turbo-remote-cache.md:36, 56`; `docs/runbooks/systemd-timers.md:14, 46`; `standards/effect-first-development.md:16`; `docs/runbooks/onepassword-beep-secrets-layout.md:31–32`.
- SkillOpt retirement (A): `docs/runbooks/skillopt-rerun.md` (27 refs) becomes historical.

### 2g. Freshness facts that should not be read as current results

- The JSDoc inventory and its totals (2026-10-05) predate PR #1552, so `no-root-package-import` = 3,110 is very likely stale.
- `check-census` was measured with effect-tsgo 0.45.0 (installed 0.47.2).
- `fallow.dead-code` baseline is from fallow 3.15.0 (installed 3.32.0).
- The `fallow.pilot` inventory is from fallow 2.89.0.
- `cache-qualification.json` store profile is bun1.4.1 / `qualification-v1`, while the baseline is bun1.4.2 / v2.

## 3. Proposed plan for the implementing lane

1. **Freeze the taxonomy.** Add a per-file class column to `standards/generated-artifacts.policy.md`, or replace its table with a pointer to `RegistrationGeometry.plan.ts` plus a generated table. Fix the 3 wrong writer labels in that plan. Decide the fate of `fallow.boundaries.provenance.jsonc`: add a writer and validator, or retire it with its schema. A test should assert that each plan surface's writer actually emits each declared output.
2. **Refresh generated artifacts in one dedicated chore PR from clean `main`,** following the policy file. Order: `beep quality jsdoc-inventory` → `jsdoc-ratchet --write-baseline`; `beep lint schema-catalog --write`; `beep lint schema-first --write`; `fallow:dead-code:baseline:write` and `fallow:health:baseline:write` under 3.32; `beep quality check-census --write-baseline` on a built tree; `beep lint policy-fingerprint --write` after the Knip removal. Hold `effect-vitest --write` until the effect-vitest-canon lanes are reconciled (brief B.6). Record before/after counts per artifact; never hand-edit totals.
3. **Fix `.patterns`.**
   - Rewrite `error-handling.md` and `effect-library-development.md` against 4.0.2: `S.TaggedError`, `Effect.catch`/`catchFilter`/`tapCause`/`forkChild`, valid Schedule combinators, beep paths, no `.ts-morph`, scoped Biome.
   - Delete or collapse `module-organization.md`, `testing-patterns.md` and `README.md` into short pointers to `standards/effect-laws-v1.md`, `standards/architecture/08-testing.md` and the skills.
   - Repoint `effect-first-development/SKILL.md:33`.
   - Fix the `S.NonEmptyTrimmedString` example in the binding JSDoc law.
   - Make examples compile through the existing markdown/docgen gate where possible (`beep laws effect-imports --mode markdown --check` already scans import paths but not API names).
4. **Fix `standards/` prose.**
   - `effect-first-development.md`: `Config.Int`/`Config.Redacted`, `S.isIncluding`, Arbitrary module, refreshed reference line anchors.
   - `schema-first-development-prompt.md`: Example-carrier wording and Arbitrary API, or shrink it to a pointer to the skill.
   - Replace `@remarks` in the 12 architecture samples with `**Details**`/`**Gotchas**`.
   - `13-onboarding`: `Context.Service`.
5. **Fix memory docs.** Add SUPERSEDED banners to `docs/agent-memory-infra/00-recommendation.md` and `README.md` (pointing at 04's 2026-08-29 entry). Make `01` l.55 and `03` l.24–29 past tense. Check whether the `COGNEE_CLOUD_API_KEY` row still has a consumer.
6. **Fix `docs/`.** Update the `docs/README.md` layout table. Move `docs/graphs/` (scraped data) and possibly `docs/mirror/` into research/explorations, or label them in the table. Repair or mark the dead `goals/*` and `packages/repo-memory` links in the product/identity docs.
7. **Review exceptions.** Re-review the 1,138 effect-vitest exceptions; their reasons are templated, and the brief forbids relabelling debt. Re-review the 115 schema-first exceptions individually (67 carry no ruleId). For each, require a specific reason, an owner and a reconsideration condition.
8. **Ensure agent discovery.** After consolidation, `rg` for every removed `.patterns`/`standards` path across `.claude/`, `.codex/`, AGENTS.md, skills and `scripts/knowledge-refs-rewrite.rules.json`. Then run `bun run beep knowledge refs --check`.

## 4. Open questions

- Whether `no-root-package-import` (3,110) and `exampleImportFindings` (3,111) drop to near zero after #1552. This needs a fresh `beep quality jsdoc-inventory` run, which this read-only sweep could not do.
- Whether the effect-vitest open count (741) still holds at `e62411d63f`. The file was last touched by #1555; the canon lanes in the other clone carry unpublished deltas.
- Live false-positive rates of the scanners. Workstream B step 2 requires reruns; none were run here.
- Whether any CI step consumes `fallow.boundaries.provenance.jsonc`. No source consumer was found, and `turbo.json` inputs were not exhaustively checked for it.
- Whether the `cache-qualification.json` store's bun1.4.1/v1 profile is intentionally separate from the v2 baseline, or is stale.
- Whether `docs/*.html` mockups and `AI_GRAPH_ENGINEERING.jpeg` are consumed by any site build (none found by `rg`).
- Whether `standards/git-worktrees.md` beyond its header contradicts the current fleet layout. It was not read in full.
- Whether the `beep-models` blocks will get a writer (`Models.render.ts:8` "future `--write`"), which would make the agent-pools tables a generated projection.
