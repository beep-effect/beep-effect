# W0 retirements: zero-consumer census

Lane `refactor/beep-cli-w0-retirements`, base `origin/main` at
[f16d82e9f1](https://github.com/beep-effect/beep-effect/tree/f16d82e9f16d72f64d42b40284bf2867566e796b).
Every retired command can be restored from git history at that commit (SPEC
D11, D22).

## Method

A consumer is a live caller. These count:

- `.github` workflows, `lefthook.yml`, and root or package `package.json` scripts
- `.claude/` and `.codex/`, `AGENTS.md`, `scripts/` and `infra/`
- systemd unit renderers
- subprocess argv in kept code, and imports from kept code
- goal packets whose `ops/manifest.json` status is active, paused or in progress

These do not count: mentions in completed-retained packets, generated catalogs,
inventories or baselines that regenerate, and census data rows.

Each candidate had a census pass and then a separate adversarial pass that tried
to refute it.

## Census

| Candidate | Consumers found | Verdict |
| --- | --- | --- |
| `cache synthetic` | None. The completed-retained turborepo-cache-conformance packet records that `cache protocol-run` replaced it. | Retired. Cache.experiment.ts keeps only `inspectCacheFixtureCapture` (used by the pilot) and `equivalentCacheFixtureRuns`. The synthetic-only schemas are deleted. |
| `cache inspect` | None. It is a read-only ledger print, and kept code reads `standards/cache-qualification.json` directly. | Retired. The CLI command is removed. `CacheQualificationService.inspect` stays as the ledger reader that `test/cache-qualification.test.ts` uses as its oracle. |
| `cache fingerprint` | It is the only producer of the CacheLiveIdentity pins that `cache activation` and the candidate, shadow and qualified `cache transition` paths read. turborepo-quality-cache-adoption (active) ran it on 2026-10-29. | Kept (refuted by the adversarial pass). |
| `cache activation`, `cache dependencies` | Each is the only producer of the activation preview or the dependency receipt that the kept `cache pilot`, `pilot-signed` and producer upload read. Two active cache goals rely on this path. | Kept. |
| Cache tier B: `pilot`, `pilot-signed`, `accept`, `transition`, `protocol-run`, `protocol-review` | turborepo-cache-trust-observability (active) ran `protocol-run` on 2026-10-28 and requires new signed pilots. turborepo-quality-cache-adoption (active) routes all promotion through `transition` and `accept`. The hosted `quality:cache-policy` lane reads the ledger that only `accept` and `transition` write. | Kept (D22). The earlier hold on turborepo-cache-conformance has gone, but these two active goals replace it. |
| `docgen quality-worker-eval`, `quality-worker-eval-runpod` | None. Two SOURCES rows (tracked-changes-ingest-wedge, active; effect-native-legal-eval, paused) cited the source as a pattern. They now point at a permalink. | Retired. Both modules are deleted. repo-cli drops `@beep/runpod` and `@openai/codex-sdk`. The root catalog drops `@openai/codex-sdk`. The `repo.examples.docgen-worker` model target is retired by id (D23). |
| `quality jsdoc-migrate` (`extract`, `titles`, `apply`, `verify`) and the `jsdoc.migrate-titles` role | None for the command or the role. The active effected port runner (`scratchpad/effected/runner/DocsMigrate.ts`) imports `JSDocMigrateRewrite.ts`. | Partial. The command, Extract, Titles, Apply, Data, the seed binding and target, the role literal (now a retired role) and the AGENTS.md row are retired. The rewrite core and the remarks-routing schema were kept until effected-promotion deleted the runner; D24 retired them on 2026-11-01. |
| `lint schema-parity-codemod` | exact-optional-keys (active) reruns it after every base merge and uses it as an acceptance criterion. The EF-40 grit rule and the standard name it as the fix. Kept FallowQuality decodes its write reports. | Kept (D22). |
| `lint goal-packets` | None. It is an alias of `goals doctor`. | Retired. |
| `docs aggregate` | One package-owned script, `@beep/repo-docgen` `docs:aggregate`, which nothing calls. | Retired. That script now runs `docgen aggregate --clean`, which takes the same flags and calls the same helper. |
| `yeet pre-push-hook`, `plan-contract-check`, `fallow-fixture-check` | None. lefthook pre-push runs only `version-sync`. The completed-retained fallow-quality-enforcement validator holds these commands only as strings. | Retired. The `pre-push-hook` run mode and the pre-push SHA helpers are removed. The validator is marked frozen. |
| `goals migrate-conventions`, `repair-fork` | None. goals/README.md and explorations/README.md mentioned them in live guidance, and both now name `beep explore --check`. | Retired. Migration.command.ts and PacketMutation.ts are deleted. ManifestTranslation.ts and Migration.schemas.ts shrink to the fleet lint that `explore check` uses. The fleet-lint tests moved to `test/goals-fleet-lint.test.ts`. |
| `codex quality-review-fix-loop` and the root script `codex:quality-review-fix-loop` | None. The identically named skill is live, but it does not call the command. | Retired. The skill stays. |
| `quality github-checks plan-contract-check` | Different code from the yeet command. It was not a W0 candidate. | Kept (out of scope). |

## Size

Excluding regenerated `standards/*`, `bun.lock`, `turbo.json` and the
effect-vitest census, `git diff --shortstat` reports
`72 files changed, 106 insertions(+), 14580 deletions(-)`. The new
`test/goals-fleet-lint.test.ts` (151 lines) is not included in that count. Twelve
files were deleted outright, totalling 10,027 lines. Inside
`packages/tooling/tool/cli/src` the diff is 39 insertions and 10,109
deletions.

## Surface check

`beep --help` and the `cache`, `codex`, `docgen`, `docs`, `goals`, `lint`,
`quality` and `yeet` subtrees were captured before and after the change. They
differ only in the removed rows and the column padding of the remaining rows.
The other change is the `goals` group description, which drops
"convention migration" in both the command and the G3 dispatch manifest.

## Post-merge workstation step

Retiring the `jsdoc.migrate-titles` role changes the seed manifest's generated
table. The repo `AGENTS.md` block is updated in this PR. The home targets
(`home.claude.doctrine`, `home.codex.agents-md`, `home.junie.agents-md`) live
outside the repo and still carry the `jsdoc.migrate-titles` row, so
`beep models check` reports them as stale until they are re-rendered. After
the PR merges, run `bun run beep models apply --write` from the swept clone to rewrite
those blocks, then confirm `bun run beep models check` shows no
`jsdoc.migrate-titles` drift. The other stale home targets that `models check`
already reports on `main` (grok effort, settings model, zshrc forms) predate W0
and are not part of this step.

Some completed-retained packets (harness-evidence-ledger,
packet-convention-migration, skillopt-training-pilot, model-routing-sync) and
the fleet-coordination exploration named retired commands or deleted files.
Those mentions are not consumers under D11. They now carry permalinks at
f16d82e9f1 so the knowledge doctor's tracked-path and command checks stay
clean.
