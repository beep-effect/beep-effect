# Prior art: expiry / re-check dates encoded on facts in a repository (time-bombed annotations)

Classification used below:
- **Self-expiring (condition-based)**: fails automatically when an observable condition flips (a version is reached, a dependency appears or disappears, an issue closes, a suppressed error stops occurring). No date to guess.
- **Date-based**: fails or lapses when the wall clock passes a written date.
- **Lifetime-based (relative)**: a platform computes staleness from age against an expected lifetime (no date written in the repo).

## Expiring TODOs (JS/TS, Ruby, Rust, Python, Go, PHP) and condition-based expiry

### Takeaway
eslint-plugin-unicorn `expiring-todo-comments` is the richest maintained in-comment syntax. It supports date conditions and also condition-based expiry on the package's own version, a dependency being added or removed, a dependency or peer-dependency version, and the Node engine version. Date checks are off by default (`checkDates: false`), so out of the box it is a purely condition-based (self-expiring) tool. Rust `todo-or-die` goes further, with compile errors on GitHub issue or PR closure, crates.io latest version, and rustc version. Ruby `todo_or_die` (the origin of the name) is a runtime call taking a date or an arbitrary boolean/callable.

### Cited Findings
- **unicorn syntax, verbatim:** `// TODO [2019-11-15]: ...` (date), `// TODO [>=1.0.0]: ...` (root package.json `version`), `// TODO [engine:node@>=8]: ...`, `// TODO [-vue-function-api]: ...` (fires once the dep is removed), `// FIXME [+read-pkg]: ...` (fires once the dep is added), `// TODO [vue@>=3]: ...`, `// TODO [peer:eslint@>=9]: ...`, plus combined forms like `[2200-12-25, +popura, lodash@>10]` where each condition reports on its own — [unicorn rule docs](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/expiring-todo-comments.md)
- **unicorn semantics:** comparisons support only `>` and `>=`. Pre-releases don't trigger `>=` until the release version ships. Dependency checks read `dependencies` and `devDependencies`. **`catalog:` references are not resolved and are reported as unsupported**, which matters for Bun/pnpm catalog monorepos. Peer ranges compare against the range floor (`"^8 || ^9"` counts as 8). Only the `node` engine is supported. Multiple dates in one comment are invalid. Dates are UTC ISO 8601 — [unicorn rule docs](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/expiring-todo-comments.md)
- **unicorn options:** `checkDates` (default `false`; the date syntax is still validated when off), `checkDatesOnPullRequests` (default `false`; skips date expiry on PRs so a PR doesn't go red just because a date passed), `terms` (default todo/fixme/xxx), `allowWarningComments` (when false, TODOs without a valid condition are reported), `ignore`, `date` (overrides the reference date). The rule is enabled in `recommended` and `unopinionated` plus CSS/HTML/JSON/Markdown/TOML/YAML recommended configs, and the docs page carries no deprecation notice — [unicorn rule docs](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/expiring-todo-comments.md)
- **Ruby `todo_or_die` (searls):** `TodoOrDie("delete after JS app has propagated", by: "2019-02-04")`. `if:` takes a boolean or callable (`if: User.count > 1000000`). With both `by:` and `if:`, both must hold. Passing neither raises immediately. Outside Rails it raises `TodoOrDie::OverdueError` ("came due on 2016-11-09. Do it!"). Under Rails it raises in dev/test and only `Rails.logger.warn`s in production. The hook can be replaced with `TodoOrDie.config(die: ->(message, due_at) { ... })`. The repo has no tagged GitHub releases and the page doesn't show commit dates — [searls/todo_or_die](https://github.com/searls/todo_or_die)
- **Ports listed by the Ruby README:** Swift (searls/swift-todo_or_die), JavaScript (danieldiekmeier/todo-or-die), Rust (davidpdrsn/todo-or-die), PHP (robertology/todo_or_die), Kotlin (serpro69/todo-or-die), Python (achedeuzot/py-todo-or-die, walshyb/todo-or-die-python), Elixir (dsdshcym/todo_or_die_elixir) — [searls/todo_or_die](https://github.com/searls/todo_or_die)
- **Rust `todo-or-die` 0.1.2:** macros `after_date!` (feature `time`), `crates_io!` (feature `crate`; fails when the latest crates.io version matches an expression), `issue_closed!` and `pr_closed!` (feature `github`), and `rust_version!` (feature `rust`). No features are on by default. A met condition produces a **compile error**. Network or GitHub errors print a warning instead of failing. `TODO_OR_DIE_SKIP` env var no-ops all macros ("skip locally, run on CI") — [docs.rs todo-or-die](https://docs.rs/todo-or-die/latest/todo_or_die/)
- **Go:** `gostale` scans Go `todo`/`fixme` comments carrying a `stale:` date and optional `expires:` date, and can warn or fail. Latest release v1.0.18, reported as published Aug 25, 2026 (from a search snippet; not re-verified on pkg.go.dev). `godox`, the linter golangci-lint wraps, only flags keywords like TODO/FIXME and has no dates. `todolint` enforces TODO format (author/ticket), not expiry — [pkg.go.dev gostale](https://pkg.go.dev/github.com/cbrgm/gostale); [godox](https://pkg.go.dev/github.com/matoous/godox); [todolint](https://beta.pkg.go.dev/github.com/akupila/todolint)
- **PHP:** `staabm/phpstan-todo-by` is a PHPStan extension supporting date-based TODO expiry in `YYYY-MM-DD` format — [packagist phpstan-todo-by](https://packagist.org/packages/staabm/phpstan-todo-by). The Ruby `do_by` gem is another date-based TODO variant — [andyw8/do_by](https://www.github.com/andyw8/do_by)

### Inferences
- Condition-based expiry needs a resolvable source of truth for the condition: a manifest (unicorn), a registry or forge API (Rust `crates_io!`, `issue_closed!`), or runtime state (Ruby `if:`). Network-backed conditions bring flakiness, which the Rust crate handles by downgrading to a warning, and that in turn means a silent miss.
- Two standard patterns stop date expiry from breaking unrelated PRs: skip date checks on PRs and enforce them on main or a schedule (`checkDatesOnPullRequests`), or skip locally and enforce in CI (`TODO_OR_DIE_SKIP`).
- unicorn's unresolved `catalog:` is a real gap for a Bun/pnpm catalog monorepo: `[effect@>=4.1]` conditions would report as unsupported unless the tool resolves catalogs itself.

### Gaps
- Maintenance status (last commit or release dates) of the Ruby gem and the Python ports (`py-todo-or-die`, `todo-or-die-python`) was not verified. They are likely low-activity.
- The latest release date of eslint-plugin-unicorn was not fetched. The rule docs are current (they mention flat-config-era configs and `catalog:`), which implies active maintenance.
- No mainstream Python linter (ruff, pylint) rule with date or condition expiry was found in this pass.

## Dependency holds with reasons / expiry (Renovate, Dependabot, pnpm/Bun overrides, syncpack)

### Takeaway
None of the mainstream dependency-update or override tools reviewed has a first-class expiry or re-check date on a hold. They offer relative delays (Renovate `minimumReleaseAge`, Dependabot `cooldown`), age-based flags (Renovate `abandonmentThreshold`), and free-text labels (syncpack `label`), but the "why are we pinned, and when do we look again" fact is unmodelled. This is the clearest gap in prior art.

### Cited Findings
- **Renovate `abandonmentThreshold`** "Flags packages that have not been updated within this period as abandoned". It is duration-based and sets `isAbandoned`; it disables nothing. It can be scoped per packageRule (e.g. npm, `"1 year"`) — [Renovate config options](https://docs.renovatebot.com/configuration-options/)
- **Renovate `minimumReleaseAge`:** "Suppress branch/PR creation for X days" / "Await X time duration before Automerging". A relative delay after release, not a fixed expiry. No `expires` or `until` field appeared in the first ~100k characters of the options page — [Renovate config options](https://docs.renovatebot.com/configuration-options/)
- The only temporary-disable guidance found for Renovate is setting `"enabled": false` (or deleting `renovate.json`), with no time bound — [Cambridge UIS DevOps guidebook](https://guidebook.devops.uis.cam.ac.uk/howtos/disable-renovatebot)
- **Dependabot `ignore`** fields are `dependency-name` (wildcards), `versions` (ecosystem range syntax), and `update-types` (`version-update:semver-major|minor|patch`). No expiry option was documented in the portion read. **`cooldown`** (`default-days`, `semver-major-days`/`-minor-days`/`-patch-days`, `include`/`exclude`, up to 150 items) delays version updates after release, doesn't apply to security updates, and defaults to 3 days even when unset — [Dependabot options reference](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference)
- **syncpack `versionGroups`** take a `label` (the field for explaining why a rule exists) and one policy (`preferVersion`, `pinVersion`, `isBanned`, `isIgnored`). `dependencyTypes` can target `pnpmOverrides`. `updateGroups` with `isIgnored: true` opts a dependency out of updates. No reason or expiry fields were found — [syncpack docs index (Algolia)](https://docsearch.algolia.com/mcp/docs/repo/jamiemason/syncpack); this is a secondary or third-party source, see Gaps
- **pnpm `overrides`** can only be set at the project root. The docs describe purpose and syntax but no reason, comment, or expiry field — [pnpm settings](https://pnpm.io/settings)

### Inferences
- The closest you can get to a re-check today is to encode the hold as a condition the tooling can evaluate: for example, a unicorn `// TODO [foo@>=2.1]` next to the override's consumer, or a tripwire test (next section) asserting the upstream bug still reproduces. A date-based re-check needs a custom ledger.
- Renovate's Dependency Dashboard surfaces held updates for human review, but that is a UI affordance, not an expiry.

### Gaps
- The Renovate options page was only partly read (100k of 354k characters). A per-rule date-bounded `schedule` or `dependencyDashboardApproval` still might not give expiry. No Renovate feature named "expires" or "until" was found.
- The `@dependabot ignore this major version` / `ignore this dependency` comment commands were not in the portion of the reference read. No evidence was found that they carry expiry.
- Bun `overrides` and `patchedDependencies` were not fetched. From prior knowledge (unverified), they carry no reason or expiry metadata.
- Official syncpack docs were not fetched directly; findings come from a doc index mirror.

## Vulnerability ignores with expiry (Snyk, OSV-Scanner, Trivy, audit-ci, GitHub)

### Takeaway
This is the most mature domain for date-expiring facts in a repo. Snyk, OSV-Scanner, Trivy, and audit-ci all support an optional expiry date on an ignore entry, usually paired with a reason or notes field. After expiry the finding resurfaces and fails the scan. All of them are date-based; none re-checks a condition such as "a fixed version now exists" (see Gaps).

### Cited Findings
- **Snyk `.snyk`:**
  ```yaml
  ignore:
    SNYK-JS-BSON-561052:
      - mongodb > mongodb-core > bson:
          reason: None given
          expires: '2020-06-19T20:36:54.553Z'
  ```
  `expires` is optional and omitting it makes the ignore permanent. **If `expires` is malformed, the ignore persists indefinitely** — a silent fail-open. CLI form: `snyk ignore --id='...' --expiry='date-string' --reason='...'` — [Snyk .snyk file docs](https://docs.snyk.io/manage-risk/policies/the-.snyk-file)
- **OSV-Scanner `osv-scanner.toml`:**
  ```toml
  [[IgnoredVulns]]
  id = "GO-2022-0968"
  # ignoreUntil = 2022-11-09
  reason = "No ssh servers are connected to or hosted in Go lang"
  ```
  Ignoring a vuln also ignores its aliases. `[[PackageOverrides]]` matches on `name`/`nameIsRegex`/`version`/`ecosystem`/`group`, with actions `ignore`, `vulnerability.ignore`, `license.ignore`, `license.override`. Its expiry field is **`effectiveUntil`** ("after which the override will no longer apply"), not `ignoreUntil` — [OSV-Scanner configuration](https://google.github.io/osv-scanner/configuration/)
- **Trivy:** `.trivyignore` line syntax `CVE-2019-14697 exp:2023-01-01`. The experimental `.trivyignore.yaml` uses `expired_at: 2023-09-01` per entry and must be passed explicitly via `--ignorefile`. Without `expired_at` the ignore "is always valid" — [Trivy filtering docs](https://trivy.dev/latest/docs/configuration/filtering/)
- **audit-ci (IBM) allowlist:** string entries (module `"axios"`, advisory `"GHSA-42xw-2xvc-qx8m"`, path `"GHSA-...|react-scripts>...>nth-check"` with wildcards) carry no expiry. The NSPRecord object form adds `active`, `notes`, `expiry` (human-readable date or epoch ms):
  ```json
  { "axios": { "active": true, "notes": "Ignore this until November 20th", "expiry": "20 November 2022 11:00" } }
  ```
  The two forms can be mixed — [IBM/audit-ci](https://github.com/IBM/audit-ci)

### Inferences
- The common record shape across tools is `{ subject id, scope/path, reason, expiresAt? }`. This makes a good baseline schema for a generic "repo fact with expiry" ledger.
- Expiry formats and field names differ across tools (`expires`, `ignoreUntil`, `effectiveUntil`, `exp:`, `expired_at`, `expiry`), and Snyk fails open on a bad format. A unified ledger should strictly decode dates and fail closed.

### Gaps
- The OSV-Scanner docs don't state the post-expiry behavior of `IgnoredVulns.ignoreUntil` (only `effectiveUntil` is explicit). The plain `.trivyignore` `exp:` post-expiry behavior is also undocumented on the page read. Both are presumed to resurface the finding.
- GitHub code-scanning and Dependabot alert dismissals were not researched in this pass. From prior knowledge (unverified), dismissals record a reason (false positive, won't fix, used in tests) and a comment but have no expiry.
- npm audit has no native allowlist or expiry; audit-ci and similar wrappers fill that role (prior knowledge, unverified).
- No vulnerability tool found re-checks a condition (e.g. "un-ignore when a fixed version is published"). All are date-based.

## Feature-flag expiry and automated removal (Unleash, LaunchDarkly, Piranha)

### Takeaway
Flag platforms use lifetime-based staleness, computed from flag type and age plus code-reference scans, not dates written in the repo. Uber's Piranha closes the loop with an automated codemod that deletes the stale flag's dead branch. It is the strongest prior art for "when the fact expires, a bot proposes the removal".

### Cited Findings
- **Unleash expected lifetimes:** Release 40 days, Experiment 40 days, Operational 7 days, Kill switch permanent, Permission permanent — [Unleash feature flag types](https://docs.getunleash.io/reference/feature-toggles)
- Unleash automatically marks flags **potentially stale** once they pass their expected lifetime. Users can also mark them **stale** manually. Stale state doesn't change runtime behavior. Marking stale emits a `feature-stale-on` event that integrations can use to post to Slack, "fail builds when stale flags are in code", or open PRs. A project-level "technical debt rating" tracks the healthy/stale ratio — [Unleash technical debt](https://docs.getunleash.io/reference/technical-debt)
- **LaunchDarkly** "Ready for code removal" means temporary, Launched in all critical environments, 30 or more days old, still has code references, and not a prerequisite. "Ready to archive" means temporary, Inactive in critical environments, 30 or more days old, **no code references**, and not a prerequisite. Code references come from the open-source `ld-find-code-refs` scanner, and an "extinction event" is recorded once all references are removed — [LaunchDarkly flag status](https://launchdarkly.com/docs/home/flags/flag-status); [LaunchDarkly code references](https://launchdarkly.com/docs/home/observability/code-references); [LaunchDarkly blog: automated flag archival](https://launchdarkly.com/blog/declutter-your-flags-with-automated-flag-archival-/)
- **Uber Piranha / PolyglotPiranha:** described as "a lightweight code transformation toolset for automating large scale changes", used mainly to clean up stale feature flags. Given a flag name, its expected value, and flag-API specs, it rewrites code to delete the dead path. Rules are a graph of `Rule` objects (query, replacement, seed flag) linked by `OutgoingEdges`, with language cleanup rules in `src/cleanup_rules`. It supports only languages used at Uber (topics list Java, JavaScript, Objective-C, Swift). The repo isn't archived (about 524 commits, 2.5k stars), and older per-language implementations live under a legacy tag. A PLDI 2024 paper covers it (doi 10.1145/3656429), along with an Uber Engineering blog post (eng.uber.com/piranha/) — [uber/piranha](https://github.com/uber/piranha)

### Inferences
- The flag-platform model splits a fact's lifecycle into stages ("needs code removal" → "ready to archive" → "extinct"), where the platform state is the condition and a repo scan is the evidence. This maps well onto a fact ledger entry that moves `active → due → resolved` based on a probe.
- Piranha shows that "expired fact → automated PR" is feasible when the fact has a mechanical removal (a flag's dead branch). Most repo facts (pins, workarounds) would need a human or agent fixer, not a codemod.

### Gaps
- Piranha's latest release date and commit cadence in 2025–2026 were not verified. OpenFeature stale-flag tooling was not researched.

## Architecture Decision Records with review dates

### Takeaway
The MADR template has no structured review-date field: `date` records the last update, and "re-visit" timing is free text. In mainstream ADR tooling, ADR review dates are a convention, not a mechanism.

### Cited Findings
- MADR front matter has `status` ("proposed | rejected | accepted | deprecated | … | superseded by ADR-0123"), `date` ("when the decision was last updated"), `decision-makers`, `consulted`, `informed`. Re-visit timing goes in the "More Information" section as prose ("if/when it should be re-visited") — [MADR template](https://raw.githubusercontent.com/adr/madr/develop/template/adr-template.md)

### Inferences
- An ADR re-check would need either a front-matter extension (e.g. `review-by:` or `revisit-when:`) plus a linter, or a ledger entry pointing at the ADR.

### Gaps
- adr-tools and log4brains were not fetched. From prior knowledge (unverified), neither enforces review dates, and adr-tools has been low-activity for years.

## Generic "assertion that something is still true" mechanisms (self-expiring)

### Takeaway
The cleanest self-expiring primitive is TypeScript's `// @ts-expect-error`. It suppresses an error and turns into an error itself ("Unused '@ts-expect-error' directive.") once the underlying error disappears, for example after an upstream type fix. Tripwire or canary tests that assert a known bug still reproduces generalize the same idea to runtime behavior. Condition-based TODOs (unicorn, Rust `crates_io!` / `issue_closed!`) are the comment-level equivalent.

### Cited Findings
- TS 3.9: "When a line is preceded by a `// @ts-expect-error` comment, TypeScript will suppress that error from being reported; but if there's no error, TypeScript will report that `// @ts-expect-error` wasn't necessary". The error text is `Unused '@ts-expect-error' directive.` By contrast, `// @ts-ignore` never reports when unused — [TypeScript 3.9 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-9.html)
- Rust `todo-or-die` `issue_closed!` / `pr_closed!` fail compilation when the tracked upstream issue or PR closes. This is a condition-based tripwire on an external fact — [docs.rs todo-or-die](https://docs.rs/todo-or-die/latest/todo_or_die/)
- unicorn `[+pkg]` / `[-pkg]` / `[pkg@>=x]` fire when manifest facts flip — [unicorn rule docs](https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/expiring-todo-comments.md)

### Inferences
- Taxonomy for a ledger design:
  - **Self-expiring, local:** `@ts-expect-error`, unicorn manifest and engine conditions, tripwire tests asserting a bug still exists. They are deterministic, offline, and CI-safe.
  - **Self-expiring, remote:** Rust `crates_io!` / `issue_closed!`, Ruby `if:` callables. They need network or runtime access and degrade to warnings on failure.
  - **Date-based:** unicorn `[YYYY-MM-DD]`, Ruby `by:`, Rust `after_date!`, gostale, phpstan-todo-by, plus all the vuln-ignore tools. They need PR-skip or local-skip valves so unrelated PRs don't go red.
  - **Lifetime-based:** Unleash and LaunchDarkly staleness.
- The strongest design pairs a date (a backstop "re-check by") with a condition probe (the actual truth test). Ruby `todo_or_die` composes the two with AND semantics (`by:` + `if:`), while unicorn reports each condition independently, which is OR-like.

### Gaps
- No primary source was fetched for "tripwire/canary test" as a named convention, or for Rust `#[deprecated(since = "...", note = "...")]`. From prior knowledge (unverified), `since` is informational only and doesn't make the attribute expire. Tripwire tests are folklore, not a named tool. Both need a source before they are reported as fact.
- ESLint's `reportUnusedDisableDirectives` (making `eslint-disable` self-expiring like `@ts-expect-error`) was not fetched. It is a likely analogous mechanism, unverified here.
