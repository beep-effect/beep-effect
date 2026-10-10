I'll review this GitHub slice against the pinned upstream oracle and the port decisions, and report only findings. First I'm loading the binding decisions, port notes, and the files in scope.The review is still open. I'll re-check the three candidate defects against the oracle and the port before writing findings.The `return yield*` sites need a closer look: some PATCH writers may already discard the body. I'll read those functions and the upstream counterparts.### grok-1-1
- file: scratchpad/effected/github/GitHubRepository.ts:413
- class: bug   severity: required
- standard: D9, section 14; effect-tsgo `effectFnIife` (TS377011) remediation   evidence: Upstream `settings` and `ownerType` are `Effect.fn("GitHubRepository.settings")(function* () { ... })()` and `Effect.fn("GitHubRepository.ownerType")(...)()` (oracle `GitHubRepository.ts:403` and `:409`). The port replaced both IIFEs with bare `Effect.gen` at lines 413 and 419. The rule's replacement is `Effect.gen` piped to `Effect.withSpan("<name>")` so the span remains. `Effect.annotateCurrentSpan` on lines 415 and 421 therefore writes `owner`/`repo` onto the surrounding span. No Port notes or ledger deviation records this.
- failure: Running `settings`, `defaultBranch`, `nodeId`, or `ownerType` no longer opens a child span named `GitHubRepository.settings` or `GitHubRepository.ownerType`. The coordinate annotation lands on the caller span.
- fix: Pipe each generator through `Effect.withSpan("GitHubRepository.settings")` and `Effect.withSpan("GitHubRepository.ownerType")`.

### grok-1-2
- file: scratchpad/effected/github/RepositorySecret.ts:221
- class: bug   severity: required
- standard: D9, section 14   evidence: `delete` and `deleteForEnvironment` are declared `Effect<void>` (lines 62 and 73). Both `return yield*` the DELETE (`:221` and `:284`). Upstream yields and falls off the generator (oracle `RepositorySecret.ts:208` and `:257`). `Rest.Data` maps a `never` body to `""` (`Rest.ts:70-72`). OpenAPI `actions/delete-repo-secret`, `dependabot/delete-repo-secret`, `codespaces/delete-repo-secret`, and `actions/delete-environment-secret` are 204 `content: never`. `GitHubClient` returns `response.data` (`GitHubClient.ts:389`). Effect's iterator adapter succeeds with the generator's return value (`succeed(state.value)` in `effect/src/internal/effect.ts:1422`). The PUT writers in this file already discard the body with a bare `yield*`.
- failure: A successful delete succeeds with `""`. Upstream succeeds with `undefined`.
- fix: Remove `return` on both deletes so the generator completes with `undefined`.

### grok-1-3
- file: scratchpad/effected/github/RepositoryVariable.ts:212
- class: bug   severity: required
- standard: D9, section 14   evidence: `delete` and `deleteForEnvironment` are declared `Effect<void>` (lines 72 and 83) and `return yield*` the DELETE (`:212` and `:296`). Upstream yields without returning (oracle `RepositoryVariable.ts:182` and `:249`). OpenAPI `actions/delete-repo-variable` and `actions/delete-environment-variable` are 204 `content: never`, so `Rest.Data` is `""` and `response.data` is that empty string. The PATCH branches in this file already pipe `Effect.asVoid` (`:183` and `:256`).
- failure: A successful variable delete succeeds with `""`. Upstream succeeds with `undefined`.
- fix: Remove `return` on both deletes, or pipe `Effect.asVoid` the way the PATCH branches do.

### grok-1-4
- file: scratchpad/effected/github/Ruleset.ts:471
- class: bug   severity: required
- standard: D9, section 14   evidence: `delete` is declared `Effect<void>` (line 316) and `return yield*` `DELETE /repos/{owner}/{repo}/rulesets/{ruleset_id}`. Upstream yields without returning (oracle `Ruleset.ts:222`). OpenAPI `repos/delete-repo-ruleset` is 204 `content: never`, so the success value is `""`. `upsert` in this file already uses a bare `yield*` and a bare `return`.
- failure: A successful ruleset delete succeeds with `""`. Upstream succeeds with `undefined`.
- fix: Remove `return` so the generator completes with `undefined`.

### grok-1-5
- file: scratchpad/effected/github/GitTag.ts:248
- class: bug   severity: required
- standard: D9, section 14   evidence: `delete` is declared `Effect<void>` (line 98) and `return yield*` `DELETE /repos/{owner}/{repo}/git/refs/{ref}`. Upstream yields without returning (oracle `GitTag.ts:235`). OpenAPI `git/delete-ref` succeeds as 204 `content: never`, so `Rest.Data` is `""`.
- failure: A successful tag delete succeeds with `""`. Upstream succeeds with `undefined`.
- fix: Remove `return` so the generator completes with `undefined`.

### grok-1-6
- file: scratchpad/effected/github/PullRequestComment.ts:203
- class: bug   severity: required
- standard: D9, section 14   evidence: `delete` is declared `Effect<void>` (line 91) and `return yield*` `DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}`. Upstream yields without returning (oracle `PullRequestComment.ts:192`). OpenAPI `issues/delete-comment` is 204 `content: never`, so the success value is `""`.
- failure: A successful comment delete succeeds with `""`. Upstream succeeds with `undefined`.
- fix: Remove `return` so the generator completes with `undefined`.

### grok-1-7
- file: scratchpad/effected/github/RepositorySecurity.ts:144
- class: bug   severity: required
- standard: D9, section 14   evidence: `setVulnerabilityAlerts`, `setAutomatedSecurityFixes`, and `setPrivateVulnerabilityReporting` are declared `Effect<void>` (lines 27, 32, and 37). Each `return yield*`s the PUT or the DELETE (`:144`, `:170`, and `:196`). Upstream yields the same ternary without returning (oracle `RepositorySecurity.ts:136-138`, `:155-157`, and `:173-175`). OpenAPI enable/disable for vulnerability alerts, automated security fixes, and private vulnerability reporting are 204 with `content: never` or `responses.no_content`, so both arms succeed with `""`.
- failure: Each setter succeeds with `""` whether it enables or disables the feature. Upstream succeeds with `undefined`.
- fix: Remove `return` on all three setters so the generator completes with `undefined`.

### grok-1-8
- file: scratchpad/effected/github/Ruleset.ts:281
- class: bug   severity: required
- standard: D9, section 14; D2   evidence: Upstream `RulesetPayload` is an interface whose `target` and `enforcement` are `string` and whose `conditions`, `rules`, and `bypass_actors` are optional `unknown`, with the remark that the rule vocabulary is passed through because pinning it would date the package (oracle `Ruleset.ts:30-49`). `upsert` takes that interface. The port's `RulesetPayload` is a closed `S.Struct`: three-literal `target` and `enforcement`, `RulesetConditions` with only `ref_name`, and `rules` as `S.toTaggedUnion("type")` over a fixed variant list (`Ruleset.ts:107-291`). `upsert` still forwards the object (`:430`) and does not decode it, so the break is the parameter type. `index.ts:152` exports the schema value; upstream exports `type RulesetPayload` only (oracle `index.ts:152`). README Port notes list no deviation and no added export.
- failure: A payload upstream accepted — a `string` target, a future rule `type`, a partial `pull_request` parameter object, or push-ruleset `conditions` beyond `ref_name` — is rejected at the `upsert` boundary.
- fix: Make `target` and `enforcement` `S.String`, and `conditions`, `rules`, and `bypass_actors` optional `S.Unknown`. Keep the closed Octokit union as a helper that `upsert` does not require. List the value export under Added exports if the const stays public.

### grok-1-9
- file: scratchpad/effected/github/README.md:341
- class: docs   severity: backlog
- standard: section 14; D3; D5 stage order   evidence: Port notes say `Deviations: None` and `Dependency backlog: None`. Law-forced shifts are already in the tree: `throw new Error` became `UnstubbedError` (law 7; `GitHubRepository.ts:408` and the same helper in the other services), and zero-argument methods such as `Ruleset.list` (`Ruleset.ts:314` and `:450`) and `RepositorySecurity.vulnerabilityAlerts` (`RepositorySecurity.ts:121`) are `Effect` values under `lazy-effect` (TS377091), so the call parentheses are gone. The ledger `newDeps` rows for this module still have `replacement: null` for the Octokit, `tweetnacl`, `blakejs`, and `universal-github-app-jwt` dependencies D3 tells the backlog to name.
- failure: A later round cannot tell a recorded, law-forced contract change from an accidental one, and the dependency backlog does not name the Effect-native candidates.
- fix: Record those deviations in Port notes and the ledger with `law:<id>`, and fill the section 13 replacement candidates. S2 owns the write-up.

REQUIRED: 8
BACKLOG: 1
