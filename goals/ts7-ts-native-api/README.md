# TsNativeApi implementation lane

## Status

Lifecycle: `completed-retained`

Implementation and acceptance verified; the packet closes in the lane's PR.

## Result

- Schema-backed binary config, detached diagnostics and three typed failures.
- One Node-hosted Go sync API process per layer; scoped native snapshots with
  balanced project opens/closes. Default executable resolves via @effect/tsgo.
- Source lookup respects the configured project. In-memory syntax parsing uses
  isolated noLib/noResolve virtual projects; older snapshot text stays stable.
- All first-party classic compiler API imports migrated. Three retirement CJS
  scripts and the ontology audit script/manifest command retired as directed.
- The version policy proves native API package version 7 and retains the
  tsc/tsgo version equality check. Check/build scripts stay on tsc-rs.
- Native parser tests run on Node after the other package tests run on Bun.
  The sync service rejects Bun before starting a process; the runbook explains it.

## Final verification

| Check | Exit | Result |
| --- | --- | --- |
| repo-utils package-verify | 0 | Audit 13.9s; docgen 6.1s. |
| effect-drizzle package-verify | 0 | Audit 22.5s; docgen 3.1s. |
| repo-configs package-verify | 0 | Audit 8.6s; docgen 3.9s. |
| Root check | 0 | Turbo check and both Effect-rule checks pass. |
| Native API fixture | 0 | Six tests: AST walk, diagnostics, snapshots, failures and API closure. |
| Import boundary controls | 0 | Seven tests; assertions retained. |
| SBOM reachability | 0 | Ten tests within the existing timeout. |
| Facet census | 0 | Executes on Node; stdout matches original after removing admission status. |
| Facet standalone tsc-rs check | 0 | Strict NodeNext typecheck passes. |
| Source import search | 1 | Expected no matches when Markdown is excluded. |
| Search including Markdown | 0 | Only the pre-existing tsconfig-json README example at line 116. |
| Package script generation | 0 | 153 manifests; zero drift. |
| Whitespace, JSON and launcher bounds | 0 | Packet and diff valid. |

The original/current census has no remaining concept members; parity preserves
that retired-source behavior rather than establishing nonzero historic counts.

## Attribution and follow-ups

Initial introduced failures (config defaults, AST helper names, native cache
behavior, annotations and Effect diagnostics) are repaired. Fresh infra's
unbuilt ghaRunners SDK caused the first root failure; its existing preparation
command restored the precondition. That third-party preparation still uses
TS6 and belongs to the other exit-program lanes. The unstable native API and
its Node runtime requirement remain upgrade review surfaces.

The detailed verification history, decisions, file status and suggested commit
are in the orchestrator cache report. No packet completion or reflection flip
was performed; those remain with the orchestrator after merge.

## Repair wave 1

The resolver now runs through scoped Effect ChildProcessSpawner, checks the exit
status and maps resolver failures to TsNativeBinaryNotFound. Module resolution
uses import.meta.resolve plus Path.fromFileUrl; createRequire is removed.
NodeServices.layer already supplies the additional inferred spawner requirement.
The regression suite now includes an injected resolver-spawn failure (7 tests).
Both new source modules now carry package documentation and @since metadata.

Native-runtime, all three focused tests, all three package gates, test-tsgo,
jsdoc-ratchet and knowledge refs pass. docgen:local requires --full because of
bun.lock; after repairing the module metadata, full proof still exits 1 on
unrelated @beep/infra vendor @pulumi/gharunners TS1205/TS1294/TS4114 errors.
Infra matches origin/main. Final parity is blocked on orchestrator-owned infra
remediation; no packet completion or publishing occurred. Full command histories
and exit codes are appended under Repair wave 1 in report-D.md; logs are in
report-D-evidence/repair-wave-1/. The session-note command exited 1 without a
diagnostic; the packet and cache report retain this handoff.
