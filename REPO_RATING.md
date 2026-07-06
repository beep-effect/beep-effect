# beep-effect Repo Rating — 7.25 / 10

**Rated by:** Claude Fable 5 · **Date:** 2026-07-05 · **HEAD:** `2c2727f830` (main)
**Method:** 11-dimension weighted rubric. Nine parallel evidence-gathering assessors (one per dimension, read-only, ~444k tokens) plus inline git-history analysis. Every score is anchored: **2** = active hazard, **5** = median professional repo, **7** = disciplined, **9** = exemplary. Every claim below cites a file or a command run against this tree on the rating date.

> **Delta note (2026-07-05, same day, post-assessment):** the
> `agent-pipeline-velocity` initiative (PR #295) landed against this report's
> top findings: main's last red check fixed (CI/CD), review lineup cut to one
> bot, PRs read the turbo cache, instruction files single-sourced with a
> drift gate (~150KB agent-context reduction), lint-policy lane 4.4× faster
> with per-step timing, `beep worktree` shipped. Scores stand until the next
> ritual re-rate; expected movement: CI/CD 3.5→~7, agent-friendliness 8.0→~9,
> git hygiene rising with the worktree/publish discipline now tooled.

**Prior rating (ritual):** 7.2/10 on 2026-06-11 by the same model, on a different (self-chosen) rubric. The headline number barely moved, but the composition changed: the June rating docked *testing* (5) and *product completeness* (4); this one docks *process* — the in-tree engineering has kept improving while the trunk workflow has decayed.

## Scorecard

| # | Dimension | Weight | Score | Weighted |
|---|-----------|-------:|------:|---------:|
| 1 | Architecture & boundaries | 15% | **8.3** | 1.25 |
| 2 | Correctness & test rigor | 15% | **7.5** | 1.13 |
| 3 | Type safety & domain modeling | 12% | **8.8** | 1.06 |
| 4 | Developer experience & feedback loops | 10% | **6.5** | 0.65 |
| 5 | Documentation & knowledge capture | 10% | **7.3** | 0.73 |
| 6 | CI/CD & quality gates | 8% | **3.5** | 0.28 |
| 7 | Agent friendliness | 8% | **8.0** | 0.64 |
| 8 | Dependency & supply-chain health | 7% | **7.5** | 0.53 |
| 9 | Security & secrets hygiene | 7% | **7.8** | 0.55 |
| 10 | Consistency & code quality | 5% | **7.3** | 0.37 |
| 11 | Git & change hygiene | 3% | **3.0** | 0.09 |
| | **Weighted total** | 100% | | **7.25** |

**The spread is the story.** This is not a uniform 7. The tree itself — types, architecture, schema discipline, agent infrastructure — runs 8–9, verifiably cleaner than almost any professional repo. The *process around the trunk* runs 3–4: main has had **zero green workflow runs in its last 40** (2026-07-01 → 2026-07-05), branch protection is absent, and the recent history is "saving" commits averaging **310 files each** pushed directly to main. The repo is a cathedral whose front door doesn't lock.

## The five moves that matter most

Everything below has a per-dimension path-to-10, but these five cut across dimensions and would move the total more than anything else:

1. **Get main green once, then protect it.** Fix the 7 failing checks on HEAD (Lint Policy jsdoc backlog, Docgen TS18048, storybook import in Build And Test, gitleaks BASE-config FP, fallow envelopes, Lint, Release PR), then enable branch protection requiring the verify matrix. This single move lifts CI/CD from 3.5 toward 8 and raises DX, security, and consistency scores that are all dragged down by the same red trunk.
2. **Kill the "saving" workflow.** Route all work through `yeet publish` (which already writes conventional messages) or add a CI-side commitlint job over the pushed range so `--no-verify` can't land on main. 151 of the last 1000 commits are wip-class; last 30 average 310 files. Bisect and blame are currently unusable.
3. **Close the local/hosted gate gap.** Make `yeet verify` run the same Lint Policy, full-config gitleaks, and Fallow advisory lanes the hosted Check runs, so a green local proof predicts a green PR. Today they verifiably diverge — the exact failure mode visible on main.
4. **Turn declared gates into blocking gates.** Coverage thresholds exist but are zeroed (`VITEST_COVERAGE_REPORT_ONLY=1`); knip is configured but wired into nothing; boundary rules are all consistency-only and self-heal via regeneration; the jsdoc inventory tracks 2,003 missing @examples with no ratchet. Each has the infrastructure already built — flip them from report-only to fail-on-regression.
5. **Backfill behavioral tests in the vertical slices.** ~200 of 329 test files sit in foundation/tooling; agents/workspace/law-practice/epistemic use-cases and most drivers are thin or smoke-only. The business logic is the least-tested layer.

---

## 1. Architecture & boundaries — 8.3/10 (15%)

**Verdict:** Deliberate hexagonal vertical-slice design with an unusually complete binding standard and real machine enforcement. The gap: enforcement proves *consistency*, not *doctrine* — an illegal dependency added to `package.json` self-heals into the allowlist instead of failing.

**Evidence highlights:**
- 10 package groups; slices follow a `<slice>/{domain,use-cases,server,client,tables,ui,config}` grammar; 34 drivers quarantined under `packages/drivers/*`; no generic "common" bucket.
- `standards/ARCHITECTURE.md` (1,913 lines) is a binding constitution backed by a 14-doc rationale packet, `GLOSSARY.md`, `DECISIONS.md`, and an *executable* proof (`packages/architecture-lab` + `apps/architecture-lab-proof`).
- Boundaries machine-checked three ways: `bun run beep fallow boundaries --check`, a CI lane in `check.yml`, and the yeet pipeline; madge gates cycles. Spot checks found zero doctrine violations (domains import no drivers, no cross-slice src leakage, apps only compose slice public APIs).
- **But:** all 70 provenance rules are `manifest-derived` / `declared-dependency-consistency`, and the yeet planner auto-runs `fallow:boundaries:write` (`Planner.ts:262-265`), so the allowlist tracks `package.json` rather than the doctrine graph. Coverage drift: 98 zones vs 70 rules vs 92 packages.

**Path to 10:**
- Add doctrine-pinned deny rules (a `sourceClass: "doctrine-pinned"` / `enforcementScope: "layer-legality"`) encoding the ARCHITECTURE.md dependency graph (domain ↛ drivers/tables/server; tables ↛ server; ui ↛ server) that regeneration cannot overwrite.
- Remove `fallow:boundaries:write` from the yeet prepare phase; verify must run `--check` against the committed file and fail on diff, requiring a human-approved regeneration commit.
- Fail `--check` when any zone lacks a provenance rule (close the 98/70/92 gap).
- Add a redundant enforcer (turbo boundaries tags or `eslint import/no-restricted-paths` in `@beep/repo-configs`) so one custom-tool bug can't silently open the graph.
- Make the CI boundaries lane a required status check and state that enforcement contract inside ARCHITECTURE.md itself.

## 2. Correctness & test rigor — 7.5/10 (15%)

**Verdict:** Well above median — 329 test files (~69k LOC) across 54/72 packages, best-in-class type-level testing (108 tstyche files, CI-enforced), routine property-based testing (74 files), zero snapshot tests. Falls short because volume concentrates in foundation/tooling while vertical slices and drivers are thin, and coverage thresholds are never actually enforced.

**Evidence highlights:**
- 254/329 test files use `@effect/vitest`; 74 use fast-check/Arbitrary; 0 snapshots. Clean unit/integration split in both turbo.json and CI lanes.
- Coverage thresholds in `vitest.shared.ts:23-34` are zeroed by `VITEST_COVERAGE_REPORT_ONLY=1` (`package.json:313`) and no CI lane runs coverage at all — the thresholds are theater.
- Distribution skew: foundation/modeling has 105 test files; agents/workspace/law-practice/epistemic domain+use-case packages don't crack the top 12. `drivers/anthropic` tests are smoke-only (`toBeDefined` + restating constants) with `--passWithNoTests` on its coverage script.

**Path to 10:**
- Run coverage in CI without the report-only flag and ratchet lines/statements up from 30%.
- Backfill behavioral suites for `packages/{agents,workspace}/use-cases` and `packages/law-practice/domain` asserting business rules, not type shape.
- Replace smoke-only driver tests with layered contract tests (stubbed `FetchHttpClient`) asserting request shaping, error mapping, and retry behavior.
- Remove `--passWithNoTests` from driver coverage scripts.
- Nightly scheduled run of the live-key `test:integration` lane so integration rot surfaces.
- Policy lint: fail when a `{domain,use-cases,server}` package has src exports but an empty/missing `test/` dir.

## 3. Type safety & domain modeling — 8.8/10 (12%)

**Verdict:** Near best-in-class. Across ~1,648 src files (~560k LOC): effectively **zero** unsafe escape hatches, total typed-error discipline, and a ~90-rule Effect language-service diagnostic suite enforced at error severity in the tsc exit code. Docked only for missing `noUncheckedIndexedAccess` and biome's `noExplicitAny` at "warn". (An earlier draft also docked missing `isolatedDeclarations`; retracted after measurement — see path-to-10.)

**Evidence highlights:**
- Escape hatches in src: 0 real `as any` (2 hits are prose in comments), 0 `@ts-ignore`, 2 documented `@ts-expect-error` (React `inert` gap), 42 `as unknown as` concentrated at driver interop.
- 754 `TaggedError` occurrences across 138 files in per-aggregate `*.errors.ts` modules vs a single real `throw new Error` (vendored shadcn hook).
- 525 files decode at boundaries; 326 use Option; 260 use LiteralKit/toTaggedUnion. Branded EntityIds + `BaseEntity.Class` with colocated persistence mapping verified in `workspace/domain`.

**Path to 10:**
- Enable `noUncheckedIndexedAccess` in `tsconfig.base.json` (largest remaining soundness hole) and fix fallout.
- ~~Enable `isolatedDeclarations`~~ — **retracted after measurement (2026-07-05)**: the flag structurally bans this repo's core idiom. 5,158 classes extend call expressions (`S.Class`, `Data.TaggedError`, `Effect.Service`, `BaseEntity.Class`, …) → TS9021 with no annotation escape, plus ~2,778 exported schema consts would need hand-written annotations for types Effect deliberately leaves inferred. Measured ~3.5 errors/src file (142 in `shared/domain` alone) → ~5,000–8,000 sites repo-wide. Not viable while Effect class APIs are house style; tsgo already delivers the fast declaration emit this flag exists to enable. Add `noImplicitReturns` and `noPropertyAccessFromIndexSignature` instead.
- Raise biome `noExplicitAny` from warn to error so the lint lane independently blocks `any`.
- Replace the 42 driver double-casts with typed adapters (e.g. a minimal structural interface for the drizzle session in `PostgresDrizzle.service.ts:155`).
- Kill the last two suppressions via a typed `inert` module augmentation in ui-system.

## 4. Developer experience & feedback loops — 6.5/10 (10%)

**Verdict:** Tooling ergonomics well above median (28-subcommand `beep` CLI, affected-aware turbo graph, fast staged-only hooks, nix+direnv+docker trio) — but the newcomer path is undocumented and the primary feedback signal (main CI) is red, so nobody can tell their breakage from inherited breakage.

**Evidence highlights:**
- README (264 lines) contains **zero** setup steps — no `bun install`, no env, no services; "Start Here" links to architecture doctrine.
- Excellent incremental loop exists: `bun run beep quality dev` (`--affected --summarize`), clean-tree short-circuits, remote-cached turbo with cache-poisoning exclusions.
- No `.vscode/`; `intellij.yaml` is shared-index-only.
- Footgun: root `nuke` script runs `docker system prune -a -f` — wipes every image/volume on the machine, not just this project's.

**Path to 10:**
- Add a README Quickstart: prerequisites, then `bun install && cp .env.example .env && bun run services:up && bun run beep quality dev` — and keep it honest with a CI job (or `beep quality doctor`) that executes that exact chain on a clean checkout.
- Get main green and protect it, so red means "your change".
- Commit `.vscode/extensions.json` + `settings.json` (biome formatter, tsdk) alongside intellij.yaml.
- Document the incremental loop (`quality dev`, `--affected`, yeet) in the Contributing section.
- Scope `nuke` to the project (`docker compose down -v --rmi local`).
- Document TURBO_TOKEN setup so local cold clones hit the CI-warmed remote cache.

## 5. Documentation & knowledge capture — 7.3/10 (10%)

**Verdict:** A genuine strength — three interlocking layers (README → 1,913-line standard → 14 chapters + 41-entry dated decision log + 419-line glossary) and best-in-class docgen ambition (custom tsdoc tag registry, 87 per-package docgen.json, self-auditing JSDoc inventory). Docked for *verified* drift and a large self-reported reference backlog.

**Evidence highlights (5-claim drift check: 3 pass, 2 fail):**
- FAIL: `README.md:249` instructs `bun run repo-exports:catalog:check` — the script does not exist.
- FAIL: the slice table (`README.md:195-207`) is stale in 4 of 5 rows (missing server/use-cases/tables/client roles that exist on disk); apps list omits `apps/storybook`.
- PASS: onboarding doc, docgen commands, and all referenced package READMEs exist and match.
- The repo honestly self-reports its reference gap: `standards/jsdoc-documentation.inventory.md` → 2,003 exports missing @example, 82/100 packages needing remediation.

**Path to 10:**
- Fix `README.md:249` to the real command (`bun run beep quality repo-exports-catalog --check`) or add the script.
- Generate the README slice/apps tables from the workspace graph (`beep docs readme-topology --check`) and fail CI on drift — same pattern as the exports catalog.
- Burn down the JSDoc inventory backlog toward the 11 clean packages, then promote the inventory from report-only to a blocking ratchet.
- Add a link-and-command lint: every relative link and named command in README/docs/standards must resolve to a real file or script.
- Delete checkout-specific prose claims (shared-kernel "active leaves") or generate them.

## 6. CI/CD & quality gates — 3.5/10 (8%)

**Verdict:** The most damning dimension. The *infrastructure* is well above median — an 8-lane affected-aware matrix, SAST/OSV/secret lanes, changesets release automation with manual-approval publish, timeouts and concurrency everywhere. But **none of it gates anything**: 0 green runs in the last 40 on main (4+ days), 7 named checks red on HEAD, branch protection 404, "saving" commits pushed directly. A sophisticated pipeline whose red state is ignored is closer to a hazard than a gate.

**Evidence highlights:**
- `gh run list --branch main --limit 40`: every run failure/cancelled (2026-07-01 → 2026-07-05); last green 2026-06-29.
- HEAD check-runs: 7 fail (Secret Scanning, Release PR, Lint Policy, Lint, Fallow Advisory, Docgen, Build And Test) vs 10 pass.
- `branches/main/protection` → 404. Release train dead: ~30+ pending changesets, Release PR job fails every push.
- Local yeet proof and hosted CI verifiably diverge (gitleaks BASE-config pinning, Fallow advisory, full docgen vs docgen:local).

**Path to 10:**
- Fix the 7 failing checks on HEAD (each has a known cause — jsdoc backlog, Docgen TS18048, storybook import, gitleaks FP, fallow envelopes).
- Enable branch protection/rulesets on main requiring the verify matrix; disallow direct pushes.
- Close local/hosted parity so green `yeet verify` implies green hosted Check.
- Add a red-main alert (issue/notification on failed main push) so streaks can't silently reach 4 days.
- Unblock the release train: fix the Release PR job, land one full release through the approval environment to prove the path.
- Add retry hygiene for known flakes (storybook TS6305/Vercel 429) instead of manual re-runs.

## 7. Agent friendliness — 8.0/10 (8%)

**Verdict:** A repo genuinely built to be operated by agents, with the investment verifiably in the tree: lean law-like instruction files (CLAUDE.md 55 lines, AGENTS.md 62), 29 hash-pinned repo-local skills, a single-command unsupervised proof (`bun run beep yeet verify`), custom lint rules, and a knowledge lifecycle (explorations → goals → standards). Docked because enforcement lags legislation and the agent-tooling package is itself context-hostile.

**Evidence highlights:**
- `skills-lock.json` hash-pins all 29 skills — skills treated as supply-chain artifacts.
- Only 7 custom lint rules vs dozens of prose laws; agents must self-police most of CLAUDE.md/AGENTS.md.
- 40 hand-written files exceed 1,500 lines; the worst are the agent-operated tooling itself (`Files.service.ts` 5,679; `Quality.command.ts` 2,840; `Yeet/internal/Handler.ts` 2,897).
- `.claude/settings.json` has no hooks and no permission allowlist; `rg 'export const LiteralKit'` misses first try (barrel-only hit).

**Path to 10:**
- Codify the top prose-only laws as lint rules (test-imports-via-aliases, tersest-helper-form, LiteralKit conventions) so `yeet verify` enforces what the instruction files state.
- Split the >2,500-line tooling command files into per-concern modules; add a max-file-LOC gate for hand-written src.
- Add a curated `permissions.allow` list and PostToolUse/Stop hooks so unsupervised sessions run the proof loop without prompts.
- Generate CLAUDE.md and AGENTS.md from one canonical source to stop rule drift.
- Make definition sites first-try greppable (lint for `export const <Name>` at the defining module, or ship a checked-in symbol index).
- Put generated behemoths (Box.models.gen.ts 88k LOC) behind a single `_generated/` convention with `.gitattributes linguist-generated` + agent-ignore.

## 8. Dependency & supply-chain health — 7.5/10 (7%)

**Verdict:** Disciplined and mechanically enforced: 237-entry bun catalog + syncpack version groups, thoughtful renovate (Effect grouped/not automerged; types/actions automerged), one patched dep, OSV ignores with mandatory reason+expiry. The risk is deliberate but large: the whole stack rides pre-release pins, plus a 2,075-file vendored effect-v4 subtree.

**Evidence highlights:**
- `effect 4.0.0-beta.93` across ~15 packages, Next 16.3.0-canary, MUI 9 beta/alpha, better-auth beta — one upstream beta bump can red the repo (beta.90 renames already forced migrations).
- `osv-scanner.toml` header claims form-data/protobufjs are "pinned in root overrides" — `package.json` has no overrides key. Config/doc drift.
- ~3,330 lockfile entries; syncpack and knip exist as configs but no CI lane runs them.

**Path to 10:**
- Add the claimed `overrides`/resolutions block (form-data ≥4.0.6, protobufjs ≥7.6.4) or fix the stale osv-scanner comment.
- Move `.repos/effect-v4` out of the tracked tree (pinned submodule or fetch script) — it inflates scans, checkout, and has already broken CI via orphaned gitlinks.
- Wire `syncpack lint` and `knip` into check.yml or yeet verify so drift blocks merge.
- Document the beta exit plan: renovate packageRule blocking >beta.93 until a tested migration branch exists.
- Prune unused heavy toolchains via knip production mode to shrink the lockfile.

## 9. Security & secrets hygiene — 7.8/10 (7%)

**Verdict:** Unusually thought-through for a solo repo — the gitleaks BASE-config pinning is a deliberate anti-tampering design with in-file rationale, dependency-review fails closed, secret sweep found only synthetic fixtures, `docs/_internal` is verifiably untracked. Docked because the strongest gates are advisory in practice (unprotected main) and the legal-privilege wall is convention, not mechanism.

**Evidence highlights:**
- `check.yml:556-593`: PR gitleaks reads BASE-branch config (defeats allowlist tampering), scanner image digest-pinned; `check.yml:380-383` empties TURBO_TOKEN on non-push events to prevent exfiltration.
- Defense in depth: pre-commit gitleaks + hosted gitleaks + OSV + fail-closed dependency-review + SAST lane.
- No lefthook pre-push lane; `audit:github pre-push` is manual-only. A direct push of a secret to unprotected main would land despite all tooling.

**Path to 10:**
- Branch protection requiring Secret Scanning, Security, and SAST jobs — convert advisory to blocking.
- Lefthook pre-push: `gitleaks detect --log-opts origin/main..HEAD` + `bun run audit:github pre-push`.
- Enable GitHub-native secret scanning + push protection (catches provider-verified tokens gitleaks heuristics miss).
- Add CodeQL weekly as a second SAST opinion beside the beep-cli Semgrep-parity lane.
- Mechanize the law-practice privilege wall: CI check requiring synthetic-provenance markers on fixtures, replacing prose.

## 10. Consistency & code quality — 7.3/10 (5%)

**Verdict:** Near-exemplary suppression hygiene (6 biome-ignore, 0 eslint-disable across ~1,648 files — most repos carry hundreds) and strikingly uniform idioms across 67 packages. Docked where policy and practice diverge: commitlint exists but is bypassed, and jsdoc enforcement covers only the tooling group while 82/100 packages carry a tracked backlog.

**Evidence highlights:**
- Coherent dual-linter split: biome owns format+lint+GritQL plugins; eslint is a thin 21-line profile selector for the jsdoc/deprecated-APIs lanes only.
- Idiom spot-check across drivers/shared/law-practice: identical `$I` identity-composer preambles, namespace-alias imports, doc headers — unusually uniform.
- knip configured but wired into no gate; several 3,000–5,700-LOC hand-written CLI monoliths.

**Path to 10:**
- CI-side commitlint over the pushed range so `--no-verify` can't land "saving".
- Ratchet the jsdoc inventory (fail on increase vs baseline), expanding enforcement one package group per milestone.
- Wire knip into the quality tasks + a CI lane with a committed baseline.
- Split `Files.service.ts` (5,679) and `AIMetrics.command.ts` (3,644) per the existing `Yeet/internal/` pattern; add a max-LOC advisory rule.
- Promote the staged advisory rules (noConsole, no-native-error GritQL) to error per the P2 plan already noted in biome.jsonc.

## 11. Git & change hygiene — 3.0/10 (3%)

**Verdict:** The infrastructure exists (commitlint + conventional config, changesets actively used, occasional well-formed `test(...)`/`style(...)` commits) but the dominant practice defeats it: **151 of the last 1000 commits are "saving"/wip-class** (~a third of the last 200), merge messages like "merged in main", and the last 30 commits average **310 files each**. Bisect and blame are effectively unusable over recent history; history reads as a save button, not a changelog.

**Path to 10:**
- Make `yeet publish --message` the only path to main: it already writes real messages and runs the proof. Pair with branch protection so direct "saving" pushes are impossible.
- Commit per logical change; a 310-file average means every regression hunt lands on an unreviewable blob. Target <20 files outside generated/lockfile churn.
- Enforce commitlint server-side (CI job over the push range) — the local hook is demonstrably bypassed.
- Keep the changesets discipline (it's the bright spot); make the release train consume them (see CI dimension).

---

## Closing note

The June rating said the weak spots were testing and product completeness. Both improved. What decayed is the loop that keeps everything else honest: the trunk. Nearly every sub-8 score above — CI 3.5, git 3.0, DX 6.5, and points shaved off security, consistency, and docs — traces to the same three facts: *main is red, main is unprotected, and work lands as "saving" mega-commits.* The repo has already built every tool needed to fix this (yeet, changesets, commitlint, the full CI matrix). The path from 7.25 to ~8.5 is not new engineering; it is turning on the gates that already exist and refusing to bypass them. The path from 8.5 to 10 is the per-dimension lists above.
