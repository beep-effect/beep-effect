# Quality Review Fix Loop

## Rounds 1-2 status

- Baseline commit: `f2322856de0d2b51d0e0c73ca1a76671b9a93f3c`
- Initial review base: `origin/main`; final refresh base: `642331b86c`; merge
  HEAD: `8337a21710`.
- Review scope: the security-remediation diff plus direct tests, package
  metadata, public APIs, generated configuration, and packet evidence.
- Dedupe result: 21 unique Round 1 findings, four initial Round 2 gate findings,
  and 17 unique Round 2 re-review/adversarial findings: 42 accepted reviewer
  and gate items. No new item was deduplicated because each identifies a
  distinct invariant, diagnostic, documentation, or test failure.
- Fix status: all 42 findings are repaired in the working tree; the fix commit
  is pending.
- Closure status: aggregate and refreshed baseline proof are green. Two final
  compatibility reviewers each returned literal `0 changes suggested`; the
  user ended further review rounds.
- Publication status: publication is executing only for the ordered `CSF-002`
  then `CSF-007` then `CSF-010` sequence. Every other finding remains held
  unless the user later expands the sequence.

## Reviewer verdicts

| Reviewer | Suggestions | Unique accepted findings | Verdict after triage |
| --- | ---: | --- | --- |
| Quality Gate Reviewer | 1 | `QG-001` | Repaired; aggregate proof green. |
| Architecture Boundary Reviewer | 2 | `ARCH-001`, `ARCH-002` | Repaired; aggregate proof green. |
| Schema And Domain Reviewer | 4 | `R1-SD-001` through `R1-SD-004` | Repaired; aggregate proof green. |
| Effect Law Reviewer | 2 | `R1-EF-001`; `R1-EF-002` absorbed by `TEST-002` | Repaired; aggregate proof green. |
| Error Boundary Reviewer | 2 | `EB-001`, `EB-002` | Repaired; aggregate proof green. |
| Testing Reviewer | 1 | `TEST-002` | Repaired; aggregate proof green. |
| Observability Reviewer | 1 | `OBS-001` | Repaired; aggregate proof green. |
| Documentation And API Reviewer | 3 | `R1-DOCAPI-001` through `R1-DOCAPI-003` | Repaired; aggregate proof green. |
| Reuse And Duplication Reviewer | 1 | `REUSE-001` | Repaired; aggregate proof green. |
| Evolution And Deprecation Reviewer | 0 | none | `0 changes suggested`; `0 required findings`. |
| Adversarial critic | 2 | `R1-ADV-001`, `R1-ADV-002` | Repaired; aggregate proof green. |

The integration cross-review reported five suggestions. `INT-003` was the same
test-seam routing defect as `ARCH-001`, and `INT-004` was the same undeclared
dependency as `ARCH-002`; both were absorbed. `INT-001`, `INT-002`, and
`INT-005` remain distinct, producing the final 21-item inventory.

## Accepted inventory

### QG-001: Coverage ratchet allows a covered baseline file to disappear

- `round`: 1
- `reviewer`: Quality Gate Reviewer
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: `AGENTS.md` Quality Operator; `standards/effect-first-development.md` EF-10
- `affectedFiles`: `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageRegression.ts:919`; `packages/tooling/tool/cli/test/quality-tasks.test.ts:1680`
- `evidence`: A covered baseline path could disappear while package aggregates stayed flat or rose, so the aggregate comparison emitted no failure.
- `impact`: Test coverage could be removed without failing the release ratchet.
- `suggestedFix`: Fail closed for metrics on a disappeared baseline file that carried covered units and add a flat-or-rising aggregate regression.
- `recommendedSkillOrAgent`: quality gate fixer
- `fixerGroup`: repo-cli coverage
- `acceptanceCommands`: `node node_modules/vitest/vitest.mjs run packages/tooling/tool/cli/test/quality-tasks.test.ts --pool=forks --maxWorkers=1 --no-file-parallelism`; `bun run --filter @beep/repo-cli check`
- `testsNeeded`: focused coverage-ratchet regression
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: pending

### TEST-002: Changed Effect tests bypass the repository assertion style

- `round`: 1
- `reviewer`: Testing Reviewer; absorbs `R1-EF-002` from Effect Law Reviewer
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: `standards/effect-first-development.md` EF-10; `AGENTS.md` Code Laws
- `affectedFiles`: `infra/test/CiTurboCache.test.ts`; `packages/tooling/library/ai-sync/test/ai-sync.test.ts`; `packages/tooling/tool/cli/test/ci-runner-security.test.ts`; `packages/tooling/tool/cli/test/knowledge-semantic-delta.test.ts`; `packages/tooling/tool/cli/test/quality-tasks.test.ts`; `packages/tooling/tool/cli/test/tsconfig-sync.test.ts`; `packages/tooling/tool/cli/test/yeet-pr-provenance.test.ts`
- `evidence`: New or touched effectful tests used plain Vitest assertions or escaped the Effect test runtime.
- `impact`: The initiative bypassed the repository's Effect-native test diagnostics and lifecycle guarantees.
- `suggestedFix`: Use `@effect/vitest`, `it.effect`, Effect assertion helpers, and Effect-managed resource scopes throughout the changed assertions.
- `recommendedSkillOrAgent`: effect-first-development
- `fixerGroup`: changed tests
- `acceptanceCommands`: focused Node Vitest suites for repo-cli, ai-sync, and infra; package checks and Biome
- `testsNeeded`: convert the changed assertions without weakening behavior coverage
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: pending

### R1-SD-001: Claude Bash permission LiteralKit lacks a domain annotation

- `round`: 1
- `reviewer`: Schema And Domain Reviewer
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: `AGENTS.md` Code Laws; `standards/schema-first.inventory.jsonc`
- `affectedFiles`: `packages/tooling/library/ai-sync/src/validation.ts:61`
- `evidence`: The new 47-value `LiteralKit` encoded a security domain without a meaningful schema identifier and description.
- `impact`: Generated schema diagnostics could not explain the governed allowlist boundary.
- `suggestedFix`: Add a named `$I.annoteSchema` description stating the exact 47-value repository grant domain.
- `recommendedSkillOrAgent`: schema-first-development
- `fixerGroup`: ai-sync validation
- `acceptanceCommands`: `bun run --filter @beep/ai-sync check`; `bun run --filter @beep/ai-sync lint`
- `testsNeeded`: existing safety-policy regression suite
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: pending

### R1-SD-002: Coverage baseline numeric and path domains are underconstrained

- `round`: 1
- `reviewer`: Schema And Domain Reviewer
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: `AGENTS.md` Code Laws; `standards/schema-first.inventory.jsonc`
- `affectedFiles`: `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageRegression.ts:65-212`; `packages/tooling/tool/cli/test/quality-tasks.test.ts:1454`
- `evidence`: Percentages, uncovered counts, epsilon, and per-file keys admitted invalid values that do not represent a valid coverage baseline.
- `impact`: Malformed committed state could weaken or destabilize the ratchet.
- `suggestedFix`: Constrain percentages, nonnegative integer counts, supported epsilon, and normalized nonempty repo-relative file keys in schema v2.
- `recommendedSkillOrAgent`: schema-first-development
- `fixerGroup`: repo-cli coverage
- `acceptanceCommands`: focused quality-tasks Node Vitest; repo-cli check; focused Biome
- `testsNeeded`: invalid-domain decode regressions
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: pending

### R1-SD-003: Coverage schema version uses a manual structural guard

- `round`: 1
- `reviewer`: Schema And Domain Reviewer
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: `AGENTS.md` Code Laws
- `affectedFiles`: `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageRegression.ts:249`
- `evidence`: Version selection duplicated schema knowledge with a handwritten object/version predicate.
- `impact`: The migration boundary could drift from the actual v2 schema.
- `suggestedFix`: Derive the current-document guard with `S.is(CoverageRegressionBaseline)`.
- `recommendedSkillOrAgent`: schema-first-development
- `fixerGroup`: repo-cli coverage
- `acceptanceCommands`: repo-cli check; focused quality-tasks Node Vitest
- `testsNeeded`: v1 refusal and full v1-to-v2 migration regression
- `dependencies`: `R1-SD-002`
- `status`: fixed
- `fixedCommit`: pending

### R1-SD-004: Coverage Option documentation describes the retired shape

- `round`: 1
- `reviewer`: Schema And Domain Reviewer
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P3-low
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: `.patterns/jsdoc-documentation.md`; `AGENTS.md` Code Laws
- `affectedFiles`: `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageRegression.ts`
- `evidence`: A touched comment still described the pre-v2 optional/migration behavior after the schema boundary changed.
- `impact`: Maintainers could implement future migration behavior against obsolete semantics.
- `suggestedFix`: Rewrite the comment to match strict v2 decode and one-way full-writer migration.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: repo-cli coverage
- `acceptanceCommands`: focused Biome; repo-cli check
- `testsNeeded`: none
- `dependencies`: `R1-SD-003`
- `status`: fixed
- `fixedCommit`: pending

### R1-EF-001: AI safety findings use conditional collection branching

- `round`: 1
- `reviewer`: Effect Law Reviewer
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: `AGENTS.md` Code Laws; `standards/effect-first-development.md`
- `affectedFiles`: `packages/tooling/library/ai-sync/src/validation.ts:161`; `packages/tooling/library/ai-sync/src/validation.ts:186`
- `evidence`: The new validator checked array length and branched manually instead of matching the empty/nonempty domain.
- `impact`: The changed logic diverged from the repository's canonical Effect Array composition.
- `suggestedFix`: Use `A.match` to select success versus the typed safety-policy failure.
- `recommendedSkillOrAgent`: effect-first-development
- `fixerGroup`: ai-sync validation
- `acceptanceCommands`: ai-sync Node Vitest; ai-sync check and lint
- `testsNeeded`: existing policy failure tests
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: pending

### R1-DOCAPI-001: AI safety JSDoc overclaims GitHub authority rejection

- `round`: 1
- `reviewer`: Documentation And API Reviewer
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: `.patterns/jsdoc-documentation.md`; `AGENTS.md` Code Laws
- `affectedFiles`: `packages/tooling/library/ai-sync/src/validation.ts:309`; `packages/tooling/library/ai-sync/README.md`
- `evidence`: Public prose said authenticated GitHub authority was rejected even though named read-only GitHub commands and intentional Git/Yeet publication grants remain allowed.
- `impact`: Operators could misunderstand the exact trust boundary enforced by the validator.
- `suggestedFix`: Document exact Codex values, Claude mode policy, the 47-value domain, retained named queries, and intentional publication grants.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: ai-sync docs
- `acceptanceCommands`: ai-sync docgen; ai-sync check and lint
- `testsNeeded`: none
- `dependencies`: `R1-ADV-002`
- `status`: fixed
- `fixedCommit`: pending

### R1-DOCAPI-002: Provenance API docs still promise public local resume data

- `round`: 1
- `reviewer`: Documentation And API Reviewer
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: `.patterns/jsdoc-documentation.md`; `AGENTS.md` Code Laws
- `affectedFiles`: `packages/tooling/tool/cli/src/commands/Yeet/internal/Provenance.ts:121-171`
- `evidence`: JSDoc for the local/public provenance boundary still described sessions or paths as part of the public footer after the security projection removed them.
- `impact`: The published API contract contradicted the privacy fix.
- `suggestedFix`: State that local resume fields stay local and public provenance contains only schema version, branch, and harness.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: Yeet provenance
- `acceptanceCommands`: provenance Node Vitest; repo-cli check; docgen
- `testsNeeded`: public schema encode/decode regression
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: pending

### R1-DOCAPI-003: CSF-009 current-HEAD prose contradicts the implemented oracle

- `round`: 1
- `reviewer`: Documentation And API Reviewer
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: not-doctrine
- `sourceRefs`: `goals/codex-security-findings-2026-08-13/findings/CSF-009.md`; `.patterns/jsdoc-documentation.md`
- `affectedFiles`: `goals/codex-security-findings-2026-08-13/findings/CSF-009.md`
- `evidence`: The record labeled captured vulnerable behavior as current-HEAD validation after current-checkout-only execution had been implemented.
- `impact`: The public security packet misstated whether the local fix existed.
- `suggestedFix`: Separate captured-baseline validation from the post-remediation current-checkout-code verdict.
- `recommendedSkillOrAgent`: packet reconciler
- `fixerGroup`: security packet
- `acceptanceCommands`: strict triage decode; goals doctor; sensitive-text scan
- `testsNeeded`: none
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: pending

### ARCH-001: Knowledge test seam is not registered as a canonical source-only alias

- `round`: 1
- `reviewer`: Architecture Boundary Reviewer; absorbs `INT-003`
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: `AGENTS.md` test import law; `standards/ARCHITECTURE.md`
- `affectedFiles`: `packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.schemas.ts:275`; `packages/tooling/tool/cli/src/test/Knowledge.test-kit.ts`; `packages/tooling/tool/cli/test/tsconfig-sync.test.ts:308`; `tsconfig.json:633`
- `evidence`: Tests needed the private archive oracle but the public Knowledge facade correctly excluded it, leaving deep or relative source imports and an ungenerated root alias.
- `impact`: Tests either violated the package boundary or risked accidentally publishing the security-sensitive test seam.
- `suggestedFix`: Register `@beep/repo-cli/test/Knowledge`, generate the root path, add a generator contract, and keep the public facade curated.
- `recommendedSkillOrAgent`: Architecture Boundary Reviewer
- `fixerGroup`: repo-cli Knowledge routing
- `acceptanceCommands`: Knowledge and tsconfig-sync Node Vitest; repo-cli check; facade/seam runtime proof
- `testsNeeded`: generated-alias contract and public-export exclusion
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: pending

### ARCH-002: Repo-configs uses TypeScript without declaring it

- `round`: 1
- `reviewer`: Architecture Boundary Reviewer; absorbs `INT-004`
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: `standards/ARCHITECTURE.md`; package dependency law
- `affectedFiles`: `packages/tooling/policy-pack/repo-configs/package.json:51`; `packages/tooling/policy-pack/repo-configs/test/EffectTsgoEffectFnPolicy.test.ts`
- `evidence`: The changed test imported the TypeScript API while the owning package did not declare `typescript`.
- `impact`: Isolated installs and package-level cache/proof could resolve an undeclared transitive dependency.
- `suggestedFix`: Declare the catalog TypeScript dev dependency and refresh the lockfile.
- `recommendedSkillOrAgent`: package boundary fixer
- `fixerGroup`: repo-configs metadata
- `acceptanceCommands`: repo-configs check, lint, and focused test; lockfile validation
- `testsNeeded`: existing policy test
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: pending

### REUSE-001: Combined AI validation reads every config twice

- `round`: 1
- `reviewer`: Reuse And Duplication Reviewer
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: `AGENTS.md` Discovery And Reuse; `standards/effect-first-development.md`
- `affectedFiles`: `packages/tooling/library/ai-sync/src/validation.ts:258-274`; `packages/tooling/library/ai-sync/src/validation.ts:348-355`; `packages/tooling/library/ai-sync/test/ai-sync.test.ts:389`
- `evidence`: Combined native-schema and safety-policy validation independently called the public file-reading APIs, creating two reads per config.
- `impact`: Validation could observe different content between passes and duplicated I/O unnecessarily.
- `suggestedFix`: Share content-level validation seams so the combined API reads once while standalone public APIs retain their behavior.
- `recommendedSkillOrAgent`: effect-first-development
- `fixerGroup`: ai-sync validation
- `acceptanceCommands`: ai-sync Node Vitest; ai-sync check and lint
- `testsNeeded`: instrumented filesystem proving one read per governed path
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: pending

### EB-001: Base-first semantic probing misclassifies current-code boot failures

- `round`: 1
- `reviewer`: Error Boundary Reviewer
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: `standards/effect-first-development.md`; `AGENTS.md` Quality Operator
- `affectedFiles`: `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.service.ts:1299`; `packages/tooling/tool/cli/test/knowledge-semantic-delta.test.ts`
- `evidence`: Probing base first allowed a shared current-checkout boot failure to be reported as base-only compatibility degradation.
- `impact`: Operational failures in the trusted current code could be silently downgraded.
- `suggestedFix`: Boot the HEAD-data oracle first; only degrade a base-data failure after the same current code succeeds for HEAD.
- `recommendedSkillOrAgent`: error-boundary reviewer
- `fixerGroup`: Knowledge semantic oracle
- `acceptanceCommands`: Knowledge Node Vitest; repo-cli check
- `testsNeeded`: both-side failure and base-only degradation regressions
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: pending

### EB-002: Semantic command probe discards useful captured diagnostics

- `round`: 1
- `reviewer`: Error Boundary Reviewer
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: `standards/effect-first-development.md`; `AGENTS.md` Quality Operator
- `affectedFiles`: `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.service.ts:913-989`; `packages/tooling/tool/cli/test/knowledge-semantic-delta.test.ts:857`
- `evidence`: Malformed or unknown command output collapsed to a generic error even though `CapturedStreams` held the diagnostic context.
- `impact`: Operators could not distinguish output-count, unknown-status, stdout, or stderr failures.
- `suggestedFix`: Preserve streams, expected/actual counts, and labeled bounded diagnostic sections in the typed error.
- `recommendedSkillOrAgent`: error-boundary reviewer
- `fixerGroup`: Knowledge semantic oracle
- `acceptanceCommands`: Knowledge Node Vitest; focused Biome; repo-cli check
- `testsNeeded`: malformed and unknown-output regressions
- `dependencies`: `OBS-001`
- `status`: fixed
- `fixedCommit`: pending

### OBS-001: Probe failure excerpts can leak paths and control text

- `round`: 1
- `reviewer`: Observability Reviewer
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: `AGENTS.md` Docs And Knowledge sanitation law; observability safety law
- `affectedFiles`: `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.service.ts:121-128`; `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.service.ts:907-921`; `packages/tooling/tool/cli/test/knowledge-semantic-delta.test.ts:897`
- `evidence`: Captured probe text could include checkout, archive, scratch, or home paths plus ANSI/control sequences and unbounded output.
- `impact`: Public diagnostics could expose developer-local data or produce hostile terminal/report framing.
- `suggestedFix`: Bound, sanitize, path-tokenize, and label probe excerpts before they enter human or JSON diagnostics.
- `recommendedSkillOrAgent`: Observability Reviewer
- `fixerGroup`: Knowledge semantic oracle
- `acceptanceCommands`: Knowledge Node Vitest; facade/seam runtime proof; docgen
- `testsNeeded`: path, ANSI, control-character, and output-bound regressions
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: pending

### R1-ADV-001: Git-valid branch text breaks provenance framing

- `round`: 1
- `reviewer`: Adversarial critic
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: forbidden-in-new-work
- `sourceRefs`: public-output encoding boundary; `AGENTS.md` Docs And Knowledge sanitation law
- `affectedFiles`: `packages/tooling/tool/cli/src/commands/Yeet/internal/Provenance.ts:361-414`; `packages/tooling/tool/cli/test/yeet-pr-provenance.test.ts:307`
- `evidence`: Git permits backticks and `-->` in branch names; inserting the raw value into Markdown code and an HTML-comment JSON envelope breaks one or both framing contexts.
- `impact`: A local branch could corrupt or inject content into the public PR footer.
- `suggestedFix`: Escape visible HTML text and comment-contained JSON independently, then decode the hidden payload in a regression.
- `recommendedSkillOrAgent`: adversarial security fixer
- `fixerGroup`: Yeet provenance
- `acceptanceCommands`: provenance Node Vitest; repo-cli check; sensitive-text scan
- `testsNeeded`: backtick and comment-terminator branch regression
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: pending

### R1-ADV-002: Agent safety policy accepts approval-mode drift

- `round`: 1
- `reviewer`: Adversarial critic
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: forbidden-in-new-work
- `sourceRefs`: repository agent policy; `AGENTS.md` Code Laws
- `affectedFiles`: `packages/tooling/library/ai-sync/src/validation.ts:27-43`; `packages/tooling/library/ai-sync/src/validation.ts:139-189`; `packages/tooling/library/ai-sync/test/ai-sync.test.ts:308-370`
- `evidence`: Rejecting only the most permissive historical values still admitted Codex `on-failure` and Claude `bypassPermissions`, `acceptEdits`, or other non-default modes.
- `impact`: A syntactically valid config could silently weaken the intended approval boundary.
- `suggestedFix`: Pin Codex exactly to `on-request`/`workspace-write`; require Claude mode to be explicitly `default`; test omission and all modeled drift values.
- `recommendedSkillOrAgent`: schema-first-development and effect-first-development
- `fixerGroup`: ai-sync validation
- `acceptanceCommands`: ai-sync Node Vitest; ai-sync check and lint
- `testsNeeded`: Codex and Claude mode-drift regressions
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: pending

### INT-001: New-path coverage can offset a same-package regression

- `round`: 1
- `reviewer`: Integration cross-review
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: coverage-ratchet release contract; `AGENTS.md` Quality Operator
- `affectedFiles`: `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageRegression.ts:957-1013`; `packages/tooling/tool/cli/test/quality-tasks.test.ts:1780`
- `evidence`: A regressed baseline file could be offset by covered units under a newly introduced path while package totals remained acceptable.
- `impact`: Renames or file-set churn could hide lost coverage identity.
- `suggestedFix`: Compare baseline identities and fail closed for same-file/new-path offsets and ambiguous file-set changes.
- `recommendedSkillOrAgent`: quality gate fixer
- `fixerGroup`: repo-cli coverage
- `acceptanceCommands`: focused quality-tasks Node Vitest; repo-cli check; Fallow audit
- `testsNeeded`: new-path and file-set ambiguity regressions
- `dependencies`: `QG-001`
- `status`: fixed
- `fixedCommit`: pending

### INT-002: AI config changes do not invalidate the cached check task

- `round`: 1
- `reviewer`: Integration cross-review
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: Turborepo package-configuration guidance; `AGENTS.md` Quality Operator
- `affectedFiles`: `packages/tooling/library/ai-sync/turbo.json`
- `evidence`: The package check reads root `.codex/config.toml` and `.claude/settings.json`, but neither was in the task hash inputs.
- `impact`: Turbo could restore a green cached safety check after either governed config changed.
- `suggestedFix`: Add a package-local config extending `//` and append both root paths with `$TURBO_EXTENDS$`.
- `recommendedSkillOrAgent`: turborepo
- `fixerGroup`: ai-sync Turbo configuration
- `acceptanceCommands`: `bunx turbo run check --filter=@beep/ai-sync --dry=json` and assert both resolved inputs
- `testsNeeded`: dry-run input contract
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: pending

### INT-005: Active fleet packet still authorizes the retired launcher

- `round`: 1
- `reviewer`: Integration cross-review
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: transitional-compatibility
- `sourceRefs`: `goals/ci-fleet-endgame/**`; `goals/codex-security-findings-2026-08-13/findings/CSF-002.md`
- `affectedFiles`: `goals/ci-fleet-endgame/GOAL.md:29`; `goals/ci-fleet-endgame/PLAN.md:16-28`; `goals/ci-fleet-endgame/README.md:50`; `goals/ci-fleet-endgame/ops/manifest.json`; `goals/ci-fleet-endgame/research/runner-endgame-decision-record.md`; `goals/ci-fleet-endgame/research/p3-cache-design.md`; `goals/ci-fleet-endgame/research/lane-reopen-relay.md`
- `evidence`: The active CI plan retained the non-ephemeral burst launcher as break-glass capacity after CSF-002 deleted it as a security remediation.
- `impact`: Operators could follow contradictory packet instructions and attempt to restore a retired vulnerable path.
- `suggestedFix`: Record CSF-002 as the superseding decision, keep the launcher retired, and retain teardown only for cleanup.
- `recommendedSkillOrAgent`: packet reconciler
- `fixerGroup`: ci-fleet-endgame packet
- `acceptanceCommands`: goals index check; goals doctor; CI runner security regression
- `testsNeeded`: launcher-absence regression
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: pending

## Round 2 gate inventory

The first Round 2 full audit built successfully across 131/131 tasks, then
lint and check failed on four changed-scope diagnostics. All four were accepted
as blocking, repaired, and retained here with a pending fix commit.

### R2-DOC-001: Exported semantic-delta human renderer lacks its public documentation contract

- `round`: 2
- `reviewer`: Documentation gate
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: `AGENTS.md` Code Laws; `.patterns/jsdoc-documentation.md`
- `affectedFiles`: `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.command.ts:73-100`
- `evidence`: The newly exported `renderKnowledgeSemanticDeltaHumanReport` lacked the full repository JSDoc contract, including an example, parameter and return descriptions, category, and since metadata.
- `impact`: The public test seam failed docgen and did not communicate the stable formatting contract to consumers.
- `suggestedFix`: Add repository-standard JSDoc with a titled example and complete `@param`, `@returns`, `@category`, and `@since` tags.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: Knowledge documentation
- `acceptanceCommands`: `bun run docgen:local --full`; repo-cli lint and check
- `testsNeeded`: existing Knowledge command and docgen coverage
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: pending

### R2-SCHEMA-001: Expanded public provenance codec assertions lack schema-derived property coverage

- `round`: 2
- `reviewer`: Schema-first gate
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: `AGENTS.md` Code Laws; `.patterns/schema-first-development.md`
- `affectedFiles`: `packages/tooling/tool/cli/test/yeet-pr-provenance.test.ts:35-43`
- `evidence`: The expanded `PublicPrProvenance` encode/decode assertions crossed the schema-first testing threshold without property coverage generated from the codec.
- `impact`: Example-only assertions could miss representable provenance values that fail the public round trip.
- `suggestedFix`: Generate values with `S.toArbitrary(PublicPrProvenance)` and assert an encode/decode round trip under the repository fast-check budget.
- `recommendedSkillOrAgent`: schema-first-development
- `fixerGroup`: Yeet provenance tests
- `acceptanceCommands`: schema-first audit with zero advisories; focused provenance Node Vitest
- `testsNeeded`: schema-derived public provenance round-trip property
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: pending

### R2-EFFECT-001: Invalid-baseline test bypasses schema-safe diagnostic construction

- `round`: 2
- `reviewer`: Effect law gate
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: `AGENTS.md` Code Laws; `.patterns/effect-first-development.md`; `.patterns/schema-first-development.md`
- `affectedFiles`: `packages/tooling/tool/cli/test/quality-tasks.test.ts`
- `evidence`: The new invalid-baseline regression used native `JSON.stringify` at a schema and diagnostic boundary.
- `impact`: The test modeled a different serialization path from the production schema boundary and bypassed repository-safe diagnostic handling.
- `suggestedFix`: Construct and exercise invalid input through the Schema and Effect boundary without native JSON serialization.
- `recommendedSkillOrAgent`: effect-first-development and schema-first-development
- `fixerGroup`: repo-cli coverage tests
- `acceptanceCommands`: Effect law audit; focused quality Node Vitest; repo-cli check
- `testsNeeded`: invalid-baseline decode regression
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: pending

### R2-EFFECT-002: Provenance property test decodes typed encoded output as unknown

- `round`: 2
- `reviewer`: Effect law gate
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: `AGENTS.md` Code Laws; `.patterns/effect-first-development.md`; `.patterns/schema-first-development.md`
- `affectedFiles`: `packages/tooling/tool/cli/test/yeet-pr-provenance.test.ts:35-43`
- `evidence`: The new property test fed the typed output of `S.encodeSync` into `S.decodeUnknownSync` instead of preserving the known encoded type with `S.decodeSync`.
- `impact`: The test erased useful type information and obscured the intended typed codec round trip.
- `suggestedFix`: Decode the typed encoded value with `S.decodeSync(PublicPrProvenance)`.
- `recommendedSkillOrAgent`: effect-first-development
- `fixerGroup`: Yeet provenance tests
- `acceptanceCommands`: Effect law audit; focused provenance Node Vitest; repo-cli check
- `testsNeeded`: schema-derived public provenance round-trip property
- `dependencies`: `R2-SCHEMA-001`
- `status`: fixed
- `fixedCommit`: pending

## Round 2 re-review inventory

### R2R-QG-001: Coverage follow-up is red and over-expands regression semantics

- `round`: 2 re-review
- `reviewer`: Focused source/test re-review
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: original coverage fixer acceptance; `AGENTS.md` Quality Operator
- `affectedFiles`: `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageRegression.ts:925-1041`; `packages/tooling/tool/cli/test/quality-tasks.test.ts:1716-1843`
- `evidence`: `fileMetricRegressed` was percentage-only and `newFileUncoveredMetrics` treated every new file as having a 100% baseline; focused Vitest failed two tests with eight failures where four were expected.
- `impact`: Legitimate deletions and ordinary new files could become false regressions; focused proof was red.
- `suggestedFix`: Restore uncovered-count discrimination for surviving files and scope new-path fail-closed behavior to an identity-ambiguous offset.
- `recommendedSkillOrAgent`: quality gate fixer
- `fixerGroup`: repo-cli coverage
- `acceptanceCommands`: focused quality Vitest; repo-cli check; Biome
- `testsNeeded`: same-file covered-code deletion, rename/new-path offset, flat-total offset
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: pending

### R2R-TEST-001: Coverage-summary count refinement lacks a rejection regression

- `round`: 2 re-review
- `reviewer`: Focused source/test re-review
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: schema-first executable-invariant law
- `affectedFiles`: `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageRegression.ts:261-302`; `packages/tooling/tool/cli/test/quality-tasks.test.ts:1403-1515`
- `evidence`: The new `covered <= total` and `skipped <= total` refinement initially had no focused rejection test.
- `impact`: The relational invariant could regress or become unwired without detection.
- `suggestedFix`: Add invalid-summary decode regressions through the production conversion seam.
- `recommendedSkillOrAgent`: schema-first-development
- `fixerGroup`: repo-cli coverage tests
- `acceptanceCommands`: focused quality Vitest
- `testsNeeded`: both count-order violations
- `dependencies`: `R2R-QG-001`
- `status`: fixed
- `fixedCommit`: pending

### R2R-SCHEMA-001: Provenance branch schemas generate non-Git branch values

- `round`: 2 re-review
- `reviewer`: Schema policy re-review
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: `.claude/skills/schema-first-development/references/repo-laws.md` section 9b
- `affectedFiles`: `packages/tooling/tool/cli/src/commands/Yeet/internal/Provenance.ts`; `packages/tooling/tool/cli/test/yeet-pr-provenance.test.ts`
- `evidence`: Both models used `branch: S.String`; with seed 20260813, 16 of 32 schema-generated samples failed `git check-ref-format --branch`.
- `impact`: The exported schema and property test overstated the valid domain.
- `suggestedFix`: Introduce one named annotated Git-valid branch schema shared by local/public provenance while preserving hostile-but-valid punctuation and contextual escaping.
- `recommendedSkillOrAgent`: schema-first-development
- `fixerGroup`: Yeet provenance
- `acceptanceCommands`: focused provenance Vitest; schema-first audit; repo-cli check
- `testsNeeded`: schema-derived round trip, valid hostile branch, invalid refs
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: pending

### R2R-DOC-001: Renderer JSDoc tags are out of canonical order

- `round`: 2 re-review
- `reviewer`: Documentation/API re-review
- `label`: suggestion
- `blockingStatus`: non-blocking
- `severity`: P3-low
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: `.patterns/jsdoc-documentation.md` tag order
- `affectedFiles`: `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.command.ts`
- `evidence`: `@internal` preceded `@param` and `@returns`.
- `impact`: New export documentation did not follow repository grammar.
- `suggestedFix`: Order tags as params/returns, release tag, category, since.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: Knowledge documentation
- `acceptanceCommands`: full docgen; targeted Biome
- `testsNeeded`: none
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: pending

### R2R-TEST-002: Multi-case invalid-input diagnostics do not identify the failing case

- `round`: 2 re-review
- `reviewer`: Testing re-review
- `label`: suggestion
- `blockingStatus`: non-blocking
- `severity`: P3-low
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: `.patterns/testing-patterns.md`
- `affectedFiles`: `packages/tooling/tool/cli/test/quality-tasks.test.ts`
- `evidence`: Ten invalid documents shared one assertion line and generic message.
- `impact`: Unexpected decode success did not identify which invariant failed.
- `suggestedFix`: Label invalid cases and include only the case label in assertion diagnostics.
- `recommendedSkillOrAgent`: Testing Reviewer
- `fixerGroup`: repo-cli coverage tests
- `acceptanceCommands`: focused quality Vitest; Effect-law audit
- `testsNeeded`: existing invalid-decode table
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: pending

### R2R-ADV-001: Omitted Claude mode inherits ambient approval authority

- `round`: 2 re-review
- `reviewer`: Adversarial security re-review
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: forbidden-in-new-work
- `sourceRefs`: repository agent policy; CSF-010 safe-default contract
- `affectedFiles`: `.codex/config.toml`; `.claude/settings.json`; `packages/tooling/library/ai-sync/src/validation.ts`; `packages/tooling/library/ai-sync/test/ai-sync.test.ts`; `packages/tooling/library/ai-sync/README.md`
- `evidence`: Treating an omitted `permissions.defaultMode` as safe allowed a user/global Claude mode to supply broader ambient authority.
- `impact`: Checked-in configuration could pass while effective approval behavior drifted outside the repository contract.
- `suggestedFix`: Require Claude `permissions.defaultMode` to be explicitly `default`, pin Codex exactly to `approval_policy = "on-request"` and `sandbox_mode = "workspace-write"`, and test omission plus modeled drift.
- `recommendedSkillOrAgent`: schema-first-development and effect-first-development
- `fixerGroup`: ai-sync validation
- `acceptanceCommands`: focused ai-sync Vitest; ai-sync check and lint; targeted Biome
- `testsNeeded`: omitted Claude mode; non-default Claude modes; Codex approval/sandbox drift
- `dependencies`: `R1-ADV-002`
- `status`: fixed
- `fixedCommit`: pending

### R2RR-EFFECT-001: New AI-sync fixture encoder uses a synchronous Schema codec

- `round`: 2 re-review
- `reviewer`: Effect Law Reviewer
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: `standards/effect-first-development.md` schema codec law
- `affectedFiles`: `packages/tooling/library/ai-sync/test/ai-sync.test.ts`
- `evidence`: The new security-policy fixtures used `S.encodeUnknownSync(S.fromJsonString(S.Unknown))` inside Effect tests.
- `impact`: New tests established a throwing synchronous codec pattern contrary to the repository boundary doctrine.
- `suggestedFix`: Use `S.encodeUnknownEffect` and yield fixture encoding within the existing `it.effect` cases.
- `recommendedSkillOrAgent`: effect-first-development
- `fixerGroup`: ai-sync tests
- `acceptanceCommands`: focused ai-sync/provenance Vitest; ai-sync check and lint; Biome
- `testsNeeded`: preserve Bash-family and permission-mode drift cases
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: pending

### R2RR-EFFECT-002: Provenance property test uses synchronous throwing codecs

- `round`: 2 re-review
- `reviewer`: Effect Law Reviewer
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: `standards/effect-first-development.md` schema codec law
- `affectedFiles`: `packages/tooling/tool/cli/test/yeet-pr-provenance.test.ts`
- `evidence`: The new schema-derived property test used `S.encodeSync` and `S.decodeSync` for every generated value.
- `impact`: The Round 2 property coverage fix contradicted the current Effect-first codec rule.
- `suggestedFix`: Use `S.encodeResult` and `S.decodeResult` with explicit failure assertions while preserving all 32 generated round trips.
- `recommendedSkillOrAgent`: effect-first-development
- `fixerGroup`: Yeet provenance tests
- `acceptanceCommands`: focused ai-sync/provenance Vitest; repo-cli check; targeted Biome
- `testsNeeded`: schema-derived public-provenance round trip
- `dependencies`: `R2-SCHEMA-001`
- `status`: fixed
- `fixedCommit`: pending

## Round 2 focused adversarial inventory

### R2-FR-COV-001: Coverage percentages can contradict counts and bypass the ratchet

- `round`: 2
- `reviewer`: Focused Coverage/Knowledge Adversarial Reviewer
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: `AGENTS.md` Code Laws; CSF-012 strict-schema contract
- `affectedFiles`: `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageRegression.ts`; `packages/tooling/tool/cli/test/quality-tasks.test.ts`
- `evidence`: `{ total: 10, covered: 0, skipped: 0, pct: 100 }` decoded as 100% with 10 uncovered units and bypassed a 50% baseline.
- `impact`: An internally contradictory summary could bypass CSF-012.
- `suggestedFix`: Derive percentage from trusted counts, including zero-total behavior.
- `recommendedSkillOrAgent`: schema-first-development
- `fixerGroup`: repo-cli coverage
- `acceptanceCommands`: focused quality Vitest; repo-cli check; Biome
- `testsNeeded`: contradictory percentage/count and zero-total regressions
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: pending

### R2-FR-COV-002: Distinct raw coverage paths can collapse after normalization

- `round`: 2
- `reviewer`: Focused Coverage/Knowledge Adversarial Reviewer
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: CSF-012 per-file provenance contract
- `affectedFiles`: `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageRegression.ts`
- `evidence`: Absolute and package-relative keys for the same file normalized to one key and `R.fromEntries` silently kept one value.
- `impact`: Normalization collisions could discard lower-coverage provenance.
- `suggestedFix`: Reject duplicate normalized keys with a typed error in both source orders.
- `recommendedSkillOrAgent`: schema-first-development
- `fixerGroup`: repo-cli coverage
- `acceptanceCommands`: focused quality Vitest; repo-cli check
- `testsNeeded`: absolute/relative collision in both orders
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: pending

### R2-FR-COV-003: Coverage paths permit terminal control injection

- `round`: 2
- `reviewer`: Focused Coverage/Knowledge Adversarial Reviewer
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: security-safe observability contract
- `affectedFiles`: `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageRegression.ts`; `packages/tooling/tool/cli/test/quality-tasks.test.ts`
- `evidence`: Schema v2 accepted an ESC-bearing file path and failure rendering interpolated it directly.
- `impact`: Quality output admitted terminal control injection.
- `suggestedFix`: Reject C0/C1 controls at path schemas and render paths safely.
- `recommendedSkillOrAgent`: schema-first-development
- `fixerGroup`: repo-cli coverage
- `acceptanceCommands`: focused quality Vitest; Biome
- `testsNeeded`: ESC, CR, newline, and other control-path decode/render cases
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: pending

### R2-FR-COV-004: New-file witnesses fabricate a committed 100% baseline

- `round`: 2
- `reviewer`: Focused Coverage/Knowledge Adversarial Reviewer
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P3-low
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: zero-suggestion closure requirement
- `affectedFiles`: `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageRegression.ts`
- `evidence`: A new uncovered file was represented with `baseline: 100` although no committed file baseline existed.
- `impact`: Diagnostics misstated the policy reason for failure.
- `suggestedFix`: Add a distinct tagged reason or variant for a new uncovered file.
- `recommendedSkillOrAgent`: schema-first-development
- `fixerGroup`: repo-cli coverage
- `acceptanceCommands`: focused quality Vitest; repo-cli check
- `testsNeeded`: reason-specific new-file diagnostic
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: pending

### R2-FR-COV-005: Invalid summary diagnostics emit an unbounded schema AST

- `round`: 2
- `reviewer`: Focused Coverage/Knowledge Adversarial Reviewer
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: actionable CLI diagnostic contract
- `affectedFiles`: `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageRegression.ts`; `packages/tooling/tool/cli/test/quality-tasks.test.ts`
- `evidence`: The count-order rejection produced a typed error whose message exceeded 16 KiB with the full Schema AST.
- `impact`: Fail-closed logs were noisy and amplifiable.
- `suggestedFix`: Retain the cause but expose a bounded path/issue summary.
- `recommendedSkillOrAgent`: Error Boundary Reviewer
- `fixerGroup`: repo-cli coverage
- `acceptanceCommands`: focused quality Vitest
- `testsNeeded`: bounded actionable diagnostic
- `dependencies`: `R2-FR-COV-001`
- `status`: fixed
- `fixedCommit`: pending

### R2-FR-KNOW-001: Successful truncated probe output is treated as authoritative

- `round`: 2
- `reviewer`: Focused Coverage/Knowledge Adversarial Reviewer
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: CSF-009 fail-closed probe boundary
- `affectedFiles`: `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.service.ts`; `packages/tooling/tool/cli/test/knowledge-semantic-delta.test.ts`
- `evidence`: An exit-zero index probe over the stream bound was accepted as a partial expected projection ending in the truncation marker.
- `impact`: Matching partial archived bytes could conceal an omitted suffix.
- `suggestedFix`: Convert any exit-zero truncated capture to bounded `KnowledgeOperationalError` before decoding.
- `recommendedSkillOrAgent`: effect-first-development
- `fixerGroup`: repo-cli Knowledge
- `acceptanceCommands`: focused Knowledge Vitest; repo-cli check
- `testsNeeded`: truncated command and index success-output cases
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: pending

### R2-FR-KNOW-002: Probe sanitizer retains bare CR and short absolute paths

- `round`: 2
- `reviewer`: Focused Coverage/Knowledge Adversarial Reviewer
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: security-safe observability contract
- `affectedFiles`: `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.service.ts`; `packages/tooling/tool/cli/test/knowledge-semantic-delta.test.ts`
- `evidence`: Bare CR, `/secret`, and `C:\\secret` survived into probe-skip detail.
- `impact`: Human output allowed terminal rewriting and reports leaked absolute paths.
- `suggestedFix`: Normalize CRLF, remove bare CR/unsafe controls, and redact one-component POSIX/Windows absolute paths.
- `recommendedSkillOrAgent`: Observability Reviewer
- `fixerGroup`: repo-cli Knowledge
- `acceptanceCommands`: focused Knowledge Vitest; Biome
- `testsNeeded`: human/JSON CR and short-path cases
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: pending

### R2-FR-KNOW-003: Archive-derived finding fields bypass diagnostic sanitization

- `round`: 2
- `reviewer`: Focused Coverage/Knowledge Adversarial Reviewer
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: security-safe observability contract
- `affectedFiles`: `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.service.ts`; `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.command.ts`; `packages/tooling/tool/cli/test/knowledge-semantic-delta.test.ts`
- `evidence`: A control-bearing archived inline command retained ESC in finding subject/message and human rendering interpolated archive-derived fields directly.
- `impact`: Repository archive data could inject controls into semantic-delta output.
- `suggestedFix`: Constrain and sanitize archive-derived report strings at the boundary and render safely in human and JSON forms.
- `recommendedSkillOrAgent`: schema-first-development
- `fixerGroup`: repo-cli Knowledge
- `acceptanceCommands`: focused Knowledge Vitest; repo-cli check
- `testsNeeded`: control-bearing command and tracked-path human/JSON cases
- `dependencies`: `R2-FR-KNOW-002`
- `status`: fixed
- `fixedCommit`: pending

### R2-FR-KNOW-004: Base-only commands evade the HEAD current-code preflight

- `round`: 2
- `reviewer`: Focused Coverage/Knowledge Adversarial Reviewer
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: CSF-009 HEAD-first fail-closed contract
- `affectedFiles`: `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.service.ts`; `packages/tooling/tool/cli/test/knowledge-semantic-delta.test.ts`
- `evidence`: A base-only command was absent from the HEAD probe input, so a current-code failure was misclassified as base-data degradation.
- `impact`: A branch regression affecting merge-base-only documentation could suppress all probe-derived findings.
- `suggestedFix`: Preflight the union of base and HEAD commands against HEAD data before allowing base-only degradation.
- `recommendedSkillOrAgent`: effect-first-development
- `fixerGroup`: repo-cli Knowledge
- `acceptanceCommands`: focused Knowledge Vitest; repo-cli check
- `testsNeeded`: base-only current-code failure and legitimate base-data-only degradation
- `dependencies`: none
- `status`: fixed
- `fixedCommit`: pending

## Post-merge aggregate proof

`bun run audit:github quality` exited 0. All 15 lanes passed:

- preflight: `changeset`, `graph`, `tsconfig`, `fallow`, `versions`, `syncpack`,
  `sherif`, `bun-audit`, and `knip`;
- execution: `build`, `lint`, `check`, `test`, `jsdoc-ratchet`, and `docgen`;
- tests: unit Turbo 133/133, integration 139/139, and serial integration 13/13;
- JSDoc ratchet: `tracked=20`, `increased=0`, and
  `zero-legacy findings=0`;
- full docgen: 133 packages.

The remote Turbo authentication warning was nonfatal. It did not change the
successful aggregate audit result.

## Final refresh and review closure

- Refreshed base: `origin/main` `642331b86c`.
- Merge HEAD: `8337a21710`.
- Dependency install: `bun install` complete.
- Coverage baseline: `bun run beep coverage -- --write-baseline --concurrency=1`
  exited 0; Turbo 230/230 in 22m54.534s; schema v2 with 127 packages.
- Final review: two compatibility reviewers independently returned literal
  `0 changes suggested`.
- Review state: the user ended further review rounds and directed narrow
  publication.

## Fixer routing and proof state

| Fixer group | Finding IDs | Status | Focused evidence |
| --- | --- | --- | --- |
| Repo-cli coverage | `QG-001`, `R1-SD-002`, `R1-SD-003`, `R1-SD-004`, `INT-001`, coverage portion of `TEST-002` | fixed; commit pending | Focused quality plus tsconfig-sync Node Vitest passed 93/93; repo-cli check, Biome, and Fallow audit are green. |
| AI-sync policy/docs/Turbo | `R1-SD-001`, `R1-EF-001`, `R1-DOCAPI-001`, `REUSE-001`, `R1-ADV-002`, `INT-002`, ai-sync portion of `TEST-002` | fixed; commit pending | Node Vitest 12/12, package check, 17-file lint, focused Biome, and Turbo dry-run input assertion are green. |
| Knowledge oracle/routing | `R1-DOCAPI-003`, `ARCH-001`, `EB-001`, `EB-002`, `OBS-001`, Knowledge portion of `TEST-002` | fixed; commit pending | Knowledge plus tsconfig-sync Node Vitest 50/50, repo-cli check, 10-file Biome, facade/seam runtime proof, and full docgen 129/129 are green. |
| Yeet provenance | `R1-DOCAPI-002`, `R1-ADV-001`, provenance portion of `TEST-002` | fixed; commit pending | Focused provenance tests and repo-cli checks are repaired; aggregate proof is green. |
| Package metadata and infra tests | `ARCH-002`, infra/repo-configs portions of `TEST-002` | fixed; commit pending | Required package dependencies and Effect-native test assertions are present; aggregate proof is green. |
| CI fleet and security packet | `INT-005` | fixed; commit pending | Active fleet documents consistently supersede the retired launcher; packet validators are rerun in this reconciliation. |
| Round 2 Knowledge documentation | `R2-DOC-001` | fixed; commit pending | Repository-standard export JSDoc is present; full docgen passed 129/129. |
| Round 2 provenance schema/Effect law | `R2-SCHEMA-001`, `R2-EFFECT-002` | fixed; commit pending | Schema-first audit reports zero advisories and the focused Round 2 test set passed within 98/98. |
| Round 2 coverage Effect law | `R2-EFFECT-001` | fixed; commit pending | Effect-law diagnostics are clear and the focused Round 2 test set passed 98/98. |
| Round 2 focused re-review | `R2R-QG-001`, `R2R-TEST-001`, `R2R-SCHEMA-001`, `R2R-DOC-001`, `R2R-TEST-002` | fixed; commit pending | Each cited regression or doctrine gap is repaired; exact post-merge aggregate proof is green. |
| Round 2 AI authority | `R2R-ADV-001` | fixed; commit pending | Claude requires explicit `default`; Codex requires exact `on-request`/`workspace-write`; focused AI checks are green. |
| Round 2 sync-codec cleanup | `R2RR-EFFECT-001`, `R2RR-EFFECT-002` | fixed; commit pending | Focused AI-sync plus provenance Vitest passed 27/27; both package checks, AI-sync lint, Biome, and diff-check passed. |
| Franklin coverage adversarial | `R2-FR-COV-001` through `R2-FR-COV-005` | fixed; commit pending | Refreshed schema-v2 regeneration passed 230/230 in 22m54.534s from merge HEAD `8337a21710`; focused quality Vitest passed 92/92; repo-cli check, 2-file Biome, and diff-check passed. |
| Franklin Knowledge adversarial | `R2-FR-KNOW-001` through `R2-FR-KNOW-004` | fixed; commit pending | Focused Node Vitest passed 46/46; repo-cli check, 8-file Biome, full docgen 133 packages, and scoped diff-check passed. |

No finding is waived, rejected, or placed in backlog. Earlier Round 2 focused
proof was green: schema-first reported zero advisories; 98/98 focused tests,
ESLint, Biome, repo-cli check, and full docgen 129/129 passed. That proof
predates the nine Franklin repairs and the merge from current `origin/main`.
Post-merge schema-v2 baseline regeneration and focused fixer proof are green.
Exact aggregate quality proof is also green. Two final compatibility reviewers
returned literal `0 changes suggested`; further review rounds are closed, and
narrow publication is executing.
