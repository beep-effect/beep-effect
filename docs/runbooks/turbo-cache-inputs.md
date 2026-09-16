# Turbo cache input boundaries

This audit covers the root task graph and every workspace `turbo.json` at
Turbo 2.10.13. The proof-epoch fixture is test data, not workspace configuration.

## Rules used in the audit

Turbo's default inputs honor Git ignores. Explicit positive globs can also
include ignored files, even when `$TURBO_DEFAULT$` appears in the same array.
For example, `**/package.json` can include installed dependency manifests and
Next build manifests. Adding `$TURBO_DEFAULT$` does not restrict that glob to
Git-visible files.

Match each task's inputs to its consumer. A directory named `build` inside
source is still an input when the command scans it. Authored documentation and
tracked generated source must remain inputs when consumed. Apply exclusions to
the relevant task, rather than globally hiding outputs from tasks that read them.

Bun loads package-local `.env` and `.env.*` files. Cached executable package
tasks include those files, even though Git ignores them. Transit nodes retain
default Git-visible package inputs.

The Vitest instrumentation runtime tests create temporary `.runtime-*`
directories inside their fixture tree. The root Git ignore excludes only those
temporary directories, so interrupted tests cannot feed generated TypeScript
and traces back into default test and transit inputs. Authored fixtures remain
inputs. A native Turbo 2.10.13 probe verified both producer and downstream test
hashes before, during and after an equivalent artifact was created.

`outputs` specifies files to restore. Validation tasks can cache successful
results and logs without file outputs. An aggregate that invokes integration
checks or mutates source cannot safely skip those operations merely because its
subcommands have separate uncached Turbo definitions.

Use `dependsOn` to include implementation dependencies. Shared Vitest aliases
are real inputs, and docgen must include the generator's source dependency graph.
Package override arrays replace the parent array unless they use
`$TURBO_EXTENDS$`.

These rules were checked against the official
[configuration documentation](https://github.com/vercel/turborepo/blob/v2.10.13/apps/docs/content/docs/reference/configuration.mdx),
[caching documentation](https://github.com/vercel/turborepo/blob/v2.10.13/apps/docs/content/docs/crafting-your-repository/caching.mdx),
and [SCM input implementation](https://github.com/vercel/turborepo/blob/v2.10.13/crates/turborepo-scm/src/package_deps.rs).
Grok documentation research and independent Codex source audits were reconciled
against the installed binary's native hash probes. Suggestions that did not
match the actual task implementation were discarded.

## Package task review

| Task | Cache boundary |
| --- | --- |
| `doctest` | Source, tests, shared Vitest files and the utils dependency graph; no file outputs required. |
| `lint:deprecated-apis` | Explicit source globs must follow the ESLint scanner's output exclusions; policy fingerprint and transit carry implementation dependencies. |
| `lint:jsdoc` | Explicit source globs exclude artifacts ignored by the JSDoc scanner; policy fingerprint carries implementation changes. |
| `lint:laws` | Law inputs retain authored source and policy files; generated declarations and reports are excluded when the scanner excludes them. |
| `build` | Defaults retain package source and configuration; the workspace tsgo wrapper is an explicit input. Declared outputs restore build products. App exceptions are below. |
| `@beep/api-docs#build` | TypeScript validation emits no files; `outputs: []` is intentional. |
| `lint` | Defaults plus shared Biome/rule configuration; Storybook also scans sibling stories. |
| `lint:fix` | Uncached mutation. |
| `check` | Package inputs, the workspace tsgo wrapper and upstream builds; existing app-specific external inputs retained. |
| `test` | Defaults, shared Vitest files and aliases, package dependency transit and shared utils transit; fast-check seed/count are hashed. |
| `test:property` | Same test boundary with explicit fast-check settings. |
| `package-test-typecheck` | Uncached diagnostics/receipt task; outputs declare the package result receipt. |
| `test:integration` | Uncached external-state checks; shared aliases remain selection inputs. |
| `test:integration:parallel` | Same external-state boundary. |
| `test:integration:serial` | Same external-state boundary with its lane-specific environment. |
| `coverage` | Uncached coverage/ratchet computation; coverage files are declared outputs. |
| `codegen` | Uncached source generation. |
| `audit` | Uncached aggregate: implementations include integration checks and source generators. |
| `transit` | Defaults honor Git ignores and propagate dependency source changes. |
| `docgen` | Package transit plus `@beep/repo-docgen#transit`; generated docs/proof files remain outputs. |
| `dev` | Persistent and uncached; upstream builds run first. |
| `storybook` | Persistent and uncached. |
| `storybook:build` | Static outputs plus sibling stories, styles, assets and sources. |
| `storybook:start` | Persistent, uncached preview after static build. |
| `test:storybook` | Uncached browser checks. |

## Root task review

The policy fingerprint is generated by
`bun run beep lint policy-fingerprint --write`. Its precise source closure is
retained. Root task inputs must match the command's scan scope; the root JSDoc
scanner, for example, scans source outside workspaces under apps, packages and
infra, so excluding those entire trees would hide its real inputs.

| Tasks | Audit decision |
| --- | --- |
| `lint:policy-fingerprint` | Retain generated implementation closure. |
| `lint:jsdoc:root` | Include the source trees its scanner reads; exclude artifacts according to that scanner. |
| `lint:native-runtime:roots`, `lint:schema-first`, `lint:identity-registry`, `lint:effect-imports`, `lint:tsgo-rules`, `lint:allowlist` | Match source and configuration inputs to the corresponding scanner; preserve authored nested source. |
| `lint:package-scripts`, `config-sync:check`, `repo-sanity:changeset-graph`, `repo-sanity:syncpack`, `repo-sanity:sherif`, `repo-sanity:versions`, `topo-sort` | Workspace metadata inputs must not expand into installed dependency or generated build manifests. |
| `lint:roadmap-refs` | Read the roadmap and goal/exploration targets; retain arbitrary referenced target existence. Other repository trees are irrelevant. |
| `lint:judge-rubric` | Precise rubric input and policy implementation dependency retained. |
| `lint:circular`, `lint:ecosystem-polarity`, `lint:reflection-artifacts` | Keep precise source/reflection globs; do not exclude legitimate nested source by directory name. |
| `lint:effect-imports-markdown` | Retain authored Markdown consumed by the scanner, including internal docs it actually reads. |
| `goals:index-check` | Retain goal inputs and implementation dependency. |
| `knowledge:semantic-delta`, `knowledge:refs-check`, `goals:doctor`, `changeset:status` | Remain uncached; Git state and reference/packet checks are not qualified for result replay. |
| `lint:oxlint`, `lint:jsdoc-module-tags`, `lint:typos`, `knip:check`, `jsdoc:inventory:check` | Remain uncached; preserve each scanner/report contract. |
| `fallow:audit:check`, `fallow:health:check`, `fallow:health:advisory`, `fallow:boundaries:advisory`, `fallow:flags:advisory`, `fallow:security:advisory`, `fallow:fix-preview:advisory`, `fallow:dead-code:check`, `fallow:boundaries:config-check` | Remain uncached with their baseline/environment/report contracts. |
| `repo-sanity:bun-audit` | Remains uncached because vulnerability data can change independently of source. |

Root tasks also hash root workspace dependencies through Turbo's internal
dependency hash. A task's displayed `inputs` map alone does not explain every
possible invalidation.

## Workspace overrides

- `apps/oip-web`: build hashes its consumed `.env*` files and `ANALYZE`.
  Its script pins `NEXT_DISABLE_PWA=1`; a caller's value cannot change that build.
- `apps/professional-desktop`: build hashes `.env*` and the Vite-exposed
  `TAURI_*` family. Check extends inherited inputs before adding sibling stories
  and the external drizzle path.
- `apps/storybook`: lint includes the sibling stories it scans; existing check
  dependencies and uncached dev port passthrough remain. Dev-only HMR port
  settings do not affect the static build.
- `apps/labs/api-docs` and `infra`: no-output build overrides match their commands.
- `packages/tooling/library/ai-sync`: inherited check/audit inputs retain the
  consumed agent settings files.
- `packages/tooling/tool/cli`: test and property-test inputs include the root
  Turbo configuration read by their native configuration regressions; unrelated
  packages retain their narrower test inputs.
- `packages/foundation/primitive/types` and
  `packages/foundation/modeling/identity`: intentional uncached lint overrides
  remain. This audit does not promote their cache qualification status.

`packages/tooling/policy-pack/repo-configs` builds regenerate tracked allowlist
source. Its build remains fresh and includes the root allowlist as an input.

`infra/lambda/turbo-cache` is not a root workspace. Its standalone artifact
publisher is not an active Turbo build task, so adding a Turbo override there
would not fix any root task.

## Verify a suspected miss

Run the same root command twice with `--summarize`, keeping the checkout and
environment stable. A root command may launch several Turbo invocations; inspect
every new summary and match the exact `taskId`.

```sh
bun run test -- --filter=@beep/provenance --summarize
bun run test -- --filter=@beep/provenance --summarize
```

Compare the task hash, input map, dependency hashes and cache status. A different
hash indicates changed computation identity. The same hash with a miss points
to cache availability, read/write policy, cleanup or verification failures.
Transit nodes without executable scripts do not prove an executable cache miss.

For a boundary change, test both directions: unrelated output writes must leave
the hash stable, and consumed source/configuration changes must invalidate it.
The CLI's native Turbo fixture tests cover every root task's declared direct
input, artifact stability for the corrected boundaries, package test aliases/dependency propagation,
and the docgen tool dependency graph. The fixtures initialize a committed Git
repository so they exercise normal Git-ignore semantics.

`REGEN_GOLDENS=1` requests mutation. The variable is hashed globally so a
regeneration result cannot seed the ordinary test cache: Turbo still writes
cache entries during forced execution. The CLI forces execution for this mode,
including repeated invocations, while retaining normal caching when it is unset
or disabled. Invoke raw Turbo with `--force` if regenerating outside the CLI
wrapper.

Some scanners consume generated-looking files. For example, package law checks
read TypeScript under `docs` and `.beep`; those files must invalidate that task.
Changing scanner scope is a separate behavior change. Cache exclusions must not
conceal files the scanner still checks.

## Extra work after a cached root check

`bun run check` first runs Turbo's package check/build graph. An unscoped
invocation then runs `quality:test-tsgo` and `quality:tsgo-smoke` as separate
CLI steps. The graph's `FULL TURBO` result does not cover those steps.

The test-typecheck step discovers packages whose normal check does not cover
all tests, skips covered packages, and dispatches `package-test-typecheck` for
the remainder. That task is deliberately uncached and writes a result receipt.
The smoke step checks the installed compiler's Effect diagnostic behavior
outside Turbo. Reusing either result would require a separate reviewed contract
covering compiler/patch identity and, for test checks, restored receipts. This
input-boundary audit preserves those fresh checks.
