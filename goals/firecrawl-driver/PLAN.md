# Firecrawl Driver Plan

This plan executes [SPEC.md](./SPEC.md). It creates a flat `drivers` package,
wraps the current Firecrawl v2 SDK surface, proves the service with fake/live
Layers, and carries the PR through CI, review, Greptile, and readiness.

## P0: Packet Bootstrap

Status: completed by this packet.

Goal: Record package placement, SDK cutline, source hierarchy, schema/Effect
rules, watcher requirements, test expectations, quality lane, and PR closure
rules.

Exit Criteria:

- [x] `README.md`, `SPEC.md`, `PLAN.md`, `GOAL.md`,
  `research/firecrawl-sdk-inventory.md`, and `ops/manifest.json` exist.
- [x] The packet targets `@beep/firecrawl` at
  `packages/drivers/firecrawl`.
- [x] The packet records the exact local clone path:
  `/home/elpresidank/YeeBois/dev/firecrawl`.
- [x] The packet records the exact scaffold command:
  `bun run create-package firecrawl --family drivers --description "Firecrawl driver package"`.
- [x] The packet includes watcher-as-stream, extract deferment,
  `$quality-review-fix-loop`, PR babysitting, and Greptile `5/5`.

Required Checks:

```sh
jq . goals/firecrawl-driver/ops/manifest.json
rg -n "@beep/firecrawl|packages/drivers/firecrawl|watcher|extract|quality-review-fix-loop|greptile|5/5|/home/elpresidank/YeeBois/dev/firecrawl|bun run create-package firecrawl --family drivers" goals/firecrawl-driver
git diff --check
```

## P1: Refresh Firecrawl Inventory

Status: pending.

Goal: Re-verify the Firecrawl SDK/docs/npm/local-source surface before writing
driver code.

Implementation Steps:

1. Load required skills:
   `$grill-with-docs`, `$effect-first-development`,
   `$schema-first-development`, `$jsdoc-annotation-specialist`,
   `$quality-review-fix-loop`, `github:yeet`, `github:gh-fix-ci`, and
   `github:gh-address-comments`.
2. Record Graphiti status and any relevant narrow memory facts if available.
3. In `/home/elpresidank/YeeBois/dev/firecrawl`, record:
   - `git rev-parse HEAD`
   - `git status -sb`
   - JS SDK package manifest version/dependencies
4. Query npm for current `firecrawl`:
   - `npm view firecrawl version dist-tags name description repository homepage license --json`
5. Query or fetch current docs:
   - `https://docs.firecrawl.dev/llms.txt`
   - `https://docs.firecrawl.dev/llms-full.txt`
   - `https://docs.firecrawl.dev/api-reference/errors.md`
   - `https://docs.firecrawl.dev/api-reference/v2-openapi.json`
6. Inspect local SDK files:
   - `src/index.ts`
   - `src/v2/client.ts`
   - `src/v2/types.ts`
   - `src/v2/watcher.ts`
   - `src/v2/methods/**`
7. Fill `research/firecrawl-sdk-inventory.md` with current method evidence,
   excluded methods, schema names, literal domains, tagged unions, watcher
   event model, live smoke scope, and drift notes.

Exit Criteria:

- [ ] Inventory records local clone commit, npm version, docs/OpenAPI
  references, inspected source files, in-scope/excluded methods, schema names,
  literal domains, unions, Option/nullish policy, watcher model, live smoke
  scope, and drift.
- [ ] Modern `firecrawl` package is confirmed viable, or the packet records
  the reason for using another package.
- [ ] Any mismatch among local clone, npm package, installed dependency, and
  live docs is classified before coding.

Stop Conditions:

- Docs/npm/local source drift makes the method surface ambiguous.
- The modern `firecrawl` package is not viable and the fallback decision needs
  human approval.

## P2: Scaffold Package

Status: pending.

Goal: Create `packages/drivers/firecrawl` through repo tooling.

Implementation Steps:

1. Confirm current branch and dirty worktree.
2. Preserve unrelated dirty files; do not stage unrelated changes.
3. Run:

```sh
bun run create-package firecrawl --family drivers --description "Firecrawl driver package" --dry-run
```

4. Run:

```sh
bun run create-package firecrawl --family drivers --description "Firecrawl driver package"
```

5. Let the scaffold update workspace, identity registration, lockfile, aliases,
   tstyche, tsconfig references, syncpack, and docgen surfaces as intended.
6. Add `firecrawl` dependency to `packages/drivers/firecrawl/package.json`
   using the current viable version policy.
7. Keep the scaffolded `AGENTS.md` concise but update it with Firecrawl-specific
   driver purpose, package-alias test import rule, live test env variable, and
   package commands.

Exit Criteria:

- [ ] `packages/drivers/firecrawl` exists and publishes `@beep/firecrawl`.
- [ ] Root workspace/config/identity updates include the package.
- [ ] Package metadata includes `beep.family = "drivers"`.
- [ ] `firecrawl` dependency is present and current drift is documented.

Required Checks:

```sh
bun run config-sync:check
bun run version-sync
```

## P3: Schema-First Models And Errors

Status: pending.

Goal: Model Firecrawl request, success, failure, literal, union, config, and
technical error surfaces with Effect Schema.

Implementation Steps:

1. Create role files following local driver patterns, for example:
   - `Firecrawl.config.ts`
   - `Firecrawl.errors.ts`
   - `Firecrawl.models.ts`
   - `Firecrawl.service.ts`
   - `Firecrawl.watcher.ts` if keeping watcher schemas separate is clearer
2. Use `$FirecrawlId.create(...)` for schema identities and service keys.
3. Define `Firecrawl<Method>Payload`, `Firecrawl<Method>Success`, and
   `Firecrawl<Method>Failure` for every in-scope method.
4. Model config with effectful Config/Redacted support:
   - API key from `FIRECRAWL_API_KEY`
   - optional API URL from `FIRECRAWL_API_URL`
   - timeout/retry SDK knobs as technical config
5. Convert all external optional/nullish fields into `Option` at schema
   boundaries.
6. Use named `LiteralKit` domains for statuses, formats, actions, source kinds,
   monitor states, trigger/billing states, browser status/language, watcher
   event tags, retryability, and failure reasons.
7. Use tagged unions for action formats, monitor targets, watcher events,
   job statuses, and other discriminated SDK shapes.
8. Define `FirecrawlError` typed technical variants carrying method, reason,
   decoded failure context where available, retry metadata, SDK version, and
   sanitized diagnostics.

Exit Criteria:

- [ ] No exported pure-data interface/type literal is introduced where Schema
  can model the shape.
- [ ] Every exported schema has JSDoc and `$I.annote(...)` or
  `$I.annoteSchema(...)`.
- [ ] No schema constant is suffixed `Schema`.
- [ ] Every non-class schema export has a same-name runtime type alias.
- [ ] Dynamic JSON Schema/Zod-like input is documented and constrained.

Required Checks:

```sh
bunx turbo run check --filter=@beep/firecrawl
bunx turbo run lint --filter=@beep/firecrawl
```

## P4: Effect Service And Layers

Status: pending.

Goal: Wrap the SDK behind a typed Effect service boundary.

Implementation Steps:

1. Build `Firecrawl` with `Context.Service`.
2. Expose `FirecrawlShape` with every required method returning decoded
   `Firecrawl<Method>Success` values or watcher streams.
3. Build an explicit SDK construction Layer from decoded config.
4. Lift SDK promise methods with `Effect.tryPromise`.
5. Decode payloads before SDK calls and decode SDK results before returning.
6. Normalize thrown SDK errors, API failures, schema decode failures, missing
   configuration, and timeouts into `FirecrawlError`.
7. Add `makeLayer`, live `layer`, and fake/test Layers.
8. Add technical spans/logs with sanitized low-cardinality attributes.

Exit Criteria:

- [ ] No raw SDK result or raw thrown value crosses the service boundary.
- [ ] No direct `process.env` reads appear in driver service logic.
- [ ] Secrets use Config/Redacted and are not logged.
- [ ] Service root remains product-neutral and server-oriented by default.

Required Checks:

```sh
bunx turbo run check test lint --filter=@beep/firecrawl
```

## P5: Watcher Stream

Status: pending.

Goal: Turn the SDK watcher into an Effect-native stream surface.

Implementation Steps:

1. Define `FirecrawlWatcherPayload`, `FirecrawlWatcherSuccess` or construction
   success, `FirecrawlWatcherFailure`, and `FirecrawlWatcherEvent`.
2. Convert SDK events `document`, `snapshot`, `done`, and `error` into decoded
   tagged union values.
3. Use `Stream.asyncScoped`, `Effect.acquireRelease`, or the clearest
   repo-legal stream/resource pattern so finalizers close the underlying SDK
   watcher.
4. Preserve interruption and completion finalizers.
5. Log websocket-to-polling fallback only as a noteworthy diagnostic.

Exit Criteria:

- [ ] `watcher` service method returns `Stream.Stream<FirecrawlWatcherEvent,
  FirecrawlError>`.
- [ ] Fake watcher tests prove event ordering, decode failure, done/error, and
  interruption cleanup.

Required Checks:

```sh
bunx turbo run test --filter=@beep/firecrawl
```

## P6: Tests, Docs, And Live Smoke

Status: pending.

Goal: Prove runtime behavior, public API types, documentation, and low-cost
live integration.

Implementation Steps:

1. Add deterministic fake SDK/service tests with `@effect/vitest`.
2. Add schema decode tests for representative payload/success/failure shapes.
3. Add error translation and sanitization tests.
4. Add watcher stream tests with fake event emission and finalizer coverage.
5. Add dtslint tests proving public service method return types and
   schema-derived types.
6. Add env-gated live integration smoke tests using `FIRECRAWL_API_KEY`.
7. Keep live tests minimal and low-cost by default:
   - `scrape` against a stable lightweight URL;
   - `map` against a stable lightweight docs/example URL;
   - usage/account reads where available through the in-scope SDK methods.
8. Add JSDoc for every public export and package docs explaining the technical
   driver boundary.

Exit Criteria:

- [ ] Tests skip cleanly without `FIRECRAWL_API_KEY`.
- [ ] Live tests do not create expensive or hard-to-clean resources by default.
- [ ] All examples compile under docgen.
- [ ] Dtslint imports through `@beep/firecrawl`.

Required Checks:

```sh
bunx turbo run test type-test --filter=@beep/firecrawl
bunx turbo run test:integration --filter=@beep/firecrawl
bun run docgen:local
```

## P7: Export Catalog And Local Quality Closure

Status: pending.

Goal: Close the package locally with generated exports and repo quality green.

Implementation Steps:

1. Refresh the repo export catalog:

```sh
bun run repo-exports:catalog
bun run repo-exports:catalog:check
```

2. Run focused package gates:

```sh
bunx turbo run check test lint type-test --filter=@beep/firecrawl
bunx turbo run test:integration --filter=@beep/firecrawl
```

3. Run repo closure:

```sh
bun run lint:fix
bun run audit:github quality
```

4. Use `$quality-review-fix-loop` reviewer/fixer workflow until zero required
   blockers remain in changed scope.
5. Record unrelated failures separately with reproduction evidence.

Exit Criteria:

- [ ] Package gates are green.
- [ ] Local docgen/export catalog are current.
- [ ] `bun run audit:github quality` is green, or unrelated failures are
  documented with evidence.
- [ ] Reviewer loop has zero required blockers or explicit waivers.

## P8: Commit, PR, CI, Review, Greptile

Status: pending.

Goal: Publish a focused draft PR and carry it to final readiness.

Implementation Steps:

1. Use `github:yeet` workflow for scope review, commit, push, and draft PR.
2. Prefer branch `codex/firecrawl-driver`.
3. Commit packet-only work with:

```text
feat: add firecrawl driver goal packet
```

4. Commit future implementation work with:

```text
feat: add firecrawl driver
```

5. Use `github:gh-fix-ci` to inspect failing GitHub Actions checks, fetch logs,
   fix CI issues, and push follow-up commits.
6. Use `github:gh-address-comments` to inspect unresolved review threads and
   address actionable comments.
7. After each follow-up commit, comment:

```text
@greptileai
```

8. Wait for the new Greptile review, parse/report the score, and continue
   fixing/retriggering until Greptile reports `5/5`.
9. Mark ready only after CI is green, actionable comments are resolved, and
   Greptile reports `5/5`.

Stop Conditions:

- GitHub CLI authentication is unavailable.
- CI failure is unrelated and cannot be reproduced locally after reasonable
  investigation.
- Greptile cannot be triggered or its score cannot be observed after
  documented attempts.
