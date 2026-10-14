# TsNativeApi specification

## Objective

Remove first-party classic TypeScript compiler API imports while retaining the
existing scanner behavior through the TypeScript 7 unstable native API.

## Source hierarchy

The lane envelope, AGENTS.md, compiler runbook and tsc-rs-gates Decision Log govern
this packet. SPEC.md then governs PLAN.md and supporting evidence.

## Scope

- `@beep/repo-utils`: configuration, diagnostics, errors, scoped service and tests.
- effect-drizzle import-boundary and repo-configs compiler version tests.
- SBOM reachability and facet-census consumers.
- Retire three `.cjs` retirement scripts and scratchpad ontology audit script.
- TypeScript toolchain runbook and this packet.

Dependency/catalog exit, third-party classic APIs, prose examples, publishing,
reflection and completion are owned by the other lanes or orchestrator.

## Acceptance criteria

- First-party source has no classic compiler API imports.
- Native API acquires one Go process per layer and closes it with layer scope.
- Program/source snapshots live in consumer scopes, with typed boundary failures.
- Native AST fixture traversal and existing scanner assertions pass.
- Package verification for repo-utils, effect-drizzle and repo-configs passes.
- Root check passes, or failures are attributed with evidence.
- Report both import searches, including and excluding Markdown.
- Packet stays active until orchestrator merges and closes it.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-14 | Share native test services through timed @effect/vitest layers; build failing layers directly and explicitly close the shutdown-test scope. | Remove per-test Effect.provide and redundant whole-body scopes while retaining all assertions, typed acquisition failures and exactly-once shutdown. | Restore the two tests from the pre-wave revision. |
| 2026-10-14 | Keep check/build on tsc-rs and resolve the API executable through @effect/tsgo. | Preserve the compiler split and pinned Effect diagnostics after #1675. | Revert service executable resolution; gate scripts are untouched. |
| 2026-10-14 | Put the service and its models in repo-utils role files and export the service barrel. | Explicit operator target; architecture plan describes synthetic slice packages that do not apply to this tooling library. | Remove new files and exports. |
| 2026-10-14 | Use sync API parsing with pure-JS AST guards/walkers. | Installed unstable/ast exports no parser or createSourceFile. | Use a future pure-JS parser when upstream provides it. |
| 2026-10-14 | Add parseSource for in-memory scanner controls via a virtual filesystem. | Preserve source-string assertions without writing temporary inputs. | Replace controls with checked-in fixtures and remove parseSource. |
| 2026-10-14 | Retain one process per layer and one snapshot per consumer scope. | Native handles require explicit lifetimes, including earlier snapshots after updates. | Replace with callback-only inspection and release each snapshot immediately afterward. |
| 2026-10-14 | Delete the three retirement scripts and scratchpad ontology audit. | Operator explicitly retired these research scripts. Git retains recovery copies. | Orchestrator restores them from the base revision. |
| 2026-10-14 | Add native and Effect compiler dependencies to repo-utils; use test-only repo-utils/native deps in effect-drizzle. | Dependency declarations must match new imports without changing the ecosystem runtime DAG. | Remove declarations when imports are removed. |
| 2026-10-14 | Keep publishing and packet completion pending. | Lane envelope gives the orchestrator exclusive ownership. | Orchestrator advances the packet after merge. |
| 2026-10-14 | Run native-parser tests on Node after the remaining Bun tests; execute facet-census with Node. | Upstream sync transport requires Node private stdio handles. ImplScriptDefault stamps missing implementation keys only; generated wrappers were regenerated and verified. | Restore package-owned beep:test values once upstream supports Bun. |
| 2026-10-14 | Give each virtual source a distinct filename and release file/project opens with its snapshot. | A regression exposed stale text on same-path reparsing; ref-counted native opens need balanced closes. | Remove unique paths when upstream proves correct cache invalidation; retain snapshot tests. |
| 2026-10-14 | Give each virtual parse a fresh noLib/noResolve tsconfig and enumerate its virtual files. | Shared config caching omitted later files; explicit projects bound parsing and avoid inference into the repository graph. | Collapse projects only when upstream invalidation supports same-config additions reliably. |
| 2026-10-14 | Release syntax snapshots inside each walker call and clone census trees before release. | Walkers return detached strings/edges; retaining every snapshot caused SBOM controls to exceed their existing timeout. | Retain snapshots only for consumers requiring program/checker handles. |
| 2026-10-14 | Declare each new direct native/service/platform test dependency; remove the scratchpad classic compiler dependency. | Keep imports represented in package manifests; the retired/ported scripts were its classic API consumers. | Restore dependencies together with their original consumers. |
| 2026-10-14 | Remove the manifest command pointing at the retired ontology audit script. | Keep script discovery executable after the operator-requested deletion; generated wrapper audit reports zero drift. | Restore the script and its package-owned manifest command together. |
| 2026-10-14 | Reject Bun before constructing the sync API. | The observed upstream pipe-handle failure can occur after spawning; a typed runtime failure prevents a partial native process startup. | Remove the guard after upstream Bun transport support is verified. |
| 2026-10-14 | Return schema-decoded detached diagnostic fields and enforce config membership in sourceFile. | Consumers get category/code/text/optional filename/UTF-16 offsets without native snapshot metadata; missing project members get a typed error. | Extend the diagnostic schema or change the lookup contract with corresponding tests. |

| 2026-10-14 | Run the Effect executable resolver through scoped ChildProcessSpawner; infer the spawner requirement on TsNativeApi.layer and retain NodeServices.layer at consumers. | Repo process law requires injectable Effect process execution; check exit status and map resolver failures to TsNativeBinaryNotFound. NodeServices already supplies filesystem, path and spawner. | Restore the resolver implementation and remove the added spawner regression together. |
| 2026-10-14 | Replace createRequire with import.meta.resolve and Path.fromFileUrl. | Live repo precedent and Node Vitest execution prove package resolution works without a Node module builtin; the Effect Path service converts file URLs safely. | Restore createRequire only if a supported runtime cannot resolve the package, with evidence and a scoped exception. |

| 2026-10-14 | Add module package documentation to both native API source files. | Hosted full docgen preflight requires module-level @since metadata in addition to symbol documentation; original Lane D omitted it. | Revert these comment blocks if the module metadata policy changes. |
| 2026-10-14 | Record the two remaining EV010 `platform-resource-provenance-review` judgments (one `NodeServices` import per Node-hosted test file) in `standards/effect-vitest.inventory.jsonc` via `bun run beep lint effect-vitest --write`; the 18 EV002/EV004 findings were fixed with shared `it.layer` layers. | EV010 is a review-class judgment the detector emits for every `@effect/platform-node` import (1,638 baseline rows repo-wide); `it.layer` cannot remove it and the Node-hosted sync API needs `NodeServices`. The refresh adds exactly these two ids; every other diff line is a line-number shift from main. | Remove the two EV010 rows and drop `NodeServices` once the sync API runs under Bun or the detector learns the provenance. |

## Verification

Command receipts and exit codes will be recorded in README.md and report-D.md.
