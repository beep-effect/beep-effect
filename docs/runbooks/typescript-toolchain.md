# TypeScript toolchain: which compiler runs where

Use this runbook when a tool, an editor, or a dependency bump asks "which
TypeScript is this repo on?" The root uses TypeScript 7 under two names, with a separate
TS6 bridge for classic API scripts. The Effect compiler patches both the native Go binary and the installed tsrs
binary; the Effect-patched tsrs is the build/check gate.

## Installed compilers and API bridge

| Package (catalog) | Version | Role |
| --- | --- | --- |
| `typescript` | `^7.0.2` | Native TypeScript 7 package; no classic `lib/typescript.js` API. |
| `@typescript/native` | `npm:typescript@^7.0.2` | The same TypeScript 7 package under the retained alias, used by patching and unstable API consumers. Alias consolidation is a separate follow-up. |
| `@typescript/typescript6` | `6.0.2` (exact) | Microsoft’s classic JS API bridge for the schema-opaque codemod/fixup, scratchpad JSDoc census; declared at root and in scratchpad. |
| `@effect/tsgo` (pins its seven `@effect/tsgo-<platform>` packages exactly) | `0.63.0` | The Effect language service build of TypeScript 7. Editors and the tsgo-only quality lanes use this reviewed pin. Since 0.59.0 the platform packages also ship the Effect build of one `tsrs` version each, so the `tsrs` pin moves with this one. |
| `tsrs` + seven `@tsrs/<platform>` optional packages | `0.20.1-ts7.1.0-beta` | The Rust port of the TypeScript 7 compiler ([oxc-project/tsrs](https://github.com/oxc-project/tsrs)); the version tag names the TypeScript it ports (`7.1.0-beta`). `effect-tsgo patch --tsrs` replaces the installed `@tsrs/<platform>` binary with the Effect build of that exact tsrs version, which `@effect/tsgo` 0.63.0 ships for linux-x64, linux-arm64 and darwin-arm64 (Effect-TS/tsgo #901, the 1:1 Rust port of the language service). Runs generated library `beep:build`, `beep:check` and `beep:check:tests` gates, the root `check:configs`, and infra's `-b` check. Framework apps retain their own build commands. |

The root `prepare` script (`effect-tsgo unpatch --tsrs && node scripts/prune-tsgo-backups.mjs && effect-tsgo patch --tsrs`)
copies the Effect binaries over the native package's Go binary and over the
`@tsrs/<platform>` binary, keeping the stock ones beside them as `tsc.original`
and `tsrs.original`. After install, both of these print
`Version 7.0.2+effect-tsgo.0.63.0`:

```text
node_modules/.bin/tsc      -> @typescript/native/bin/tsc  (patched Go binary)
node_modules/.bin/tsgo     -> tools/tsgo-shim/tsgo.js     (execs the Effect artifact directly)
```

Docgen's example compile, `beep quality test-tsgo`, the Effect smoke canary,
rule-parity tools and the editors use the Go Effect compiler; the gates use the
Effect-patched tsrs, and both enforce the same reviewed rule set (below).
The shim bypasses the patch on purpose: a preserved
`.original` backup can make a newer patcher mistake an older Effect compiler for
the current one (`tools/tsgo-shim/tsgo.js`).

The typecheck and build gates run on the Effect-patched `tsrs` (adopted in
`goals/tsrs-gates`, which succeeded the tsc-rs gates of 2026-10-14), which
prints `Version 7.1.0-beta+effect-tsgo.0.63.0 (tsrs 0.20.1-ts7.1.0-beta, …)`:

```text
node_modules/.bin/tsrs     -> tsrs/bin/tsrs  (tsrs's JS launcher; execs the patched @tsrs/<platform>/tsrs)
```

`beep:build` (`tsrs -p tsconfig.json && bun run babel`), `beep:check`
(`tsrs -p tsconfig.check.json`), `beep:check:tests`
(`tsrs -p tsconfig.test.json --noEmit`), the root `check:configs` and infra's
`tsrs -b tsconfig.json` all run the Rust compiler. Measured on 2026-10-26
against tsc-rs 0.8.0 (`goals/tsrs-gates/research/measurements-2026-10-26.md`):
identical diagnostics on all 181 check projects and infra's `-b` build, serial
wall 21.3 s against 26.4 s at a higher peak RSS per project, and every rule of
the standalone profile known to the compiler (tsc-rs printed eleven TS377134
unknown-rule warnings). The 2026-10-13 tsc-rs measurement against the Go
compiler (3.7× faster at half the RSS) is in `goals/tsc-rs-gates`. Rules of the road:

- The bin is tsrs's own JavaScript launcher (`bin/tsrs` imports `lib/tsrs.js`),
  with no postinstall; it costs about 20 ms per run. The `effect-tsgo tsrs`
  proxy command that 0.59.0 added runs the same Effect build without patching,
  but its Node start-up costs about 160 ms per invocation, so the generated
  scripts call the patched `tsrs` bin directly.
- `--fast` stays off in generated scripts and CI: tsrs documents it as
  "performance modes that may differ from pinned TypeScript behavior", and the
  tsc-rs measurement (−7 % wall for +35 % CPU and +4.7 GB peak on the test
  projects) has not been repeated on tsrs. If it is ever added, it goes after
  `-b`: `tsrs -b --fast`, never `--fast -b`.
- A failing `tsrs` exits 2, not 1. Yeet's issue parser keys on the
  diagnostic text, so the code does not matter to the gates.
- `tsrs --version` prints the `+effect-tsgo.<version>` suffix and the installed
  tsrs version; a stock `Version 7.1.0-beta (tsrs …)` means the patcher found no
  Effect build for that tsrs version. The `.bin/tsc` ↔ `.bin/tsgo` version
  equality test covers the Go binary; `EffectTsgoEffectFnPolicy.test.ts`
  verifies that the tsrs identity matches both catalog pins, that an Effect-only
  finding leaves tsrs at exit 0 (the standalone diagnostics lane gates Effect
  rules), and that type errors still fail Check.

### Updating tsrs and @effect/tsgo

Both pins sit in syncpack's held-back group, so `bun run deps:update` leaves
them alone and a bump is one reviewed PR. `@effect/tsgo` ships the Effect build
of exactly one tsrs version per release (`node_modules/@effect/tsgo-<platform>/lib/upstream.json`,
`tags.tsrs.latest` and `components.tsrs`), and `effect-tsgo patch --tsrs` only
patches an installed `tsrs` of that version, so:

1. Read the `@effect/tsgo` release notes for the tsrs version it bumps to, set
   the catalog `@effect/tsgo` and `tsrs` entries together, and run
   `bun install`; `prepare` patches both binaries. `node_modules/.bin/tsrs --version`
   must print `+effect-tsgo.<new version> (tsrs <new tsrs version>, …)`.
2. Update the table row above: both versions and the TypeScript the tsrs tag
   names. Recheck these rules of the road and the known problems.
3. Run `bun run check` and `bun run check:configs` across the repo, and fix new
   TypeScript errors at their source. Effect-rule (377xxx) findings do not fail
   these gates while the three ignore flags are true.
4. Run the `@beep/repo-configs` tests (`bunx vitest run` in
   `packages/tooling/policy-pack/repo-configs`). `bun run check` does not run
   them. `EffectTsgoEffectFnPolicy.test.ts` pins the exact `@effect/tsgo`
   version and the tsrs identity line, the root-map unknown-rule canary and the
   exit-code policy.
5. A bump that adds rules follows the rule-map procedure under "Effect rules
   gate through Check": the root severity map and copied profiles, the
   declared-off ledger and the full check graph as the census.

## Binary paths (Linux x64)

Verified at 0.63.0. Substitute the platform triple on other machines.

- `node_modules/@effect/tsgo-linux-x64/lib/tsc` is the latest TypeScript (7.0.2)
  Effect artifact. Since 0.52 it is shipped once in `lib`, not duplicated under
  `artifacts/typescript/7.0.2`. Other upstream versions remain under
  `artifacts/typescript/<version>/tsc`.
- `effect-tsgo get-exe-path` and the `tsgo` shim resolve the correct binary from
  installed upstream metadata. Avoid hardcoding an artifact-version directory.
- `node_modules/@typescript/typescript-linux-x64/lib/tsc` is the patched native
  binary; `tsc.original` beside it remains the stock TypeScript backup.
- `node_modules/@tsrs/linux-x64-gnu/tsrs` is the patched Rust binary;
  `tsrs.original` beside it is the stock tsrs backup. The Effect build it was
  copied from is `node_modules/@effect/tsgo-linux-x64/artifacts/tsrs/<tsrs version>/tsrs`,
  shipped with its `lib.*.d.ts` files beside it (the tsrs build loads them from
  disk, matching upstream's `noembed` packaging).

## Effect rules gate through Check

Every Effect rule gates inside the compiler: the three
`ignoreEffect*InTscExitCode` options are **false** in `tsconfig.base.json` and
every copied compiler profile, so `tsrs` in `beep:build`, `beep:check` and
`beep:check:*` (and `tsgo` in the test-tsgo lanes) fails on an Effect error the
same way it fails on a TypeScript error. `Heavy / Check` is the Effect-rule
gate; there is no separate diagnostics job. A policy fixture in
`@beep/repo-configs` proves an Effect-only finding fails `tsrs`, an empty-project
canary proves the root map produces no unknown-rule warnings, and
`beep quality tsgo-rules` checks that every installed rule is configured, that
the copied profiles match the root map (effect-drizzle's documented
`missedPipeableOpportunity` exception aside), and that the documented plugin
options are explicit.

The root map in `tsconfig.base.json` holds all 135 rules of the installed
`@effect/tsgo` (130 errors, five declared off: `apiStabilityLeak`,
`experimentalApiUsage`, `unstableApiUsage`, `preferBarrelImport`,
`preferNamespaceImport`). The import-style rules stay off because intentional
named helper imports are pervasive and Effect barrel imports violate the
module-path law.

History: from 2026-10-14 to `goals/tsrs-gates` PR 2 (2026-10-27) the newest
rules ran in a standalone `Heavy / Effect Diagnostics` job
(`goals/effect-rules-diagnostics-lane`), because the gate compiler then was
tsc-rs with an older rule set compiled in. That job needed an 8-vCPU runner, a
19 GiB cgroup and 20 to 25 minutes per PR; the Effect-patched tsrs runs the same
rules inside the four-minute `Heavy / Check`. A bump that adds rules must
update the complete root severity map and the copied profiles, keep the
declared-off ledger explicit, remove retired plugin options, and run the full
check graph as the census.

## New compiler option values

`beep tsconfig-sync` decodes every tsconfig it reads through
`@beep/tsconfig/TsconfigJson`, whose `target`, `module`, `moduleResolution`,
`jsx`, `newLine`, `moduleDetection`, `lib` and `ignoreDeprecations` fields are
closed vocabularies in
`packages/foundation/modeling/tsconfig/src/CompilerOptions.ts`. Before a
tsconfig adopts a value a TypeScript bump introduces (a new `target`, an
`esnext.*` lib), add it to the matching literal set in the same PR. Otherwise
the sync, and with it `create-package` and the cheap gates, fails with
`Failed to parse JSONC in "<file>"` naming the field. Decision record:
`goals/effected-promotion/SPEC.md` (3-A7 row).

## Programmatic access

Run sync API consumers with Node: the upstream transport requires Node private
stdio handles and currently cannot run under Bun. Native-parser tests therefore
run on Node after the remaining Bun test suite.

First-party compiler tools use `TsNativeApi` from `@beep/repo-utils/TsNativeApi`.
Provide `TsNativeApi.layer(TsNativeConfig.make({ cwd, tsconfig }))` with platform
filesystem/path/child-process services at the entrypoint (for example,
`NodeServices.layer`). The layer owns one Go API process
and closes it when its scope ends. Its default executable is the installed
`@effect/tsgo` artifact; `executable` accepts an explicit override.

Call `program(tsconfig)` or `sourceFile(path)` inside `Effect.scoped`; native
handles remain valid only within that scope. `parseSource(fileName, text)` uses
a distinct virtual path per parse for syntax controls and research walkers.
Walk nodes with `node.forEachChild` and guards from
`@typescript/native/unstable/ast`. `diagnostics(tsconfig)` returns detached,
schema-decoded diagnostics. Binary resolution, protocol and missing-file
failures have typed errors. These unstable API calls are validated against the
installed package declarations and require review when upgrading TypeScript.
The programmatic API uses the Go compiler; check/build gates remain on the
Effect-patched tsrs.

## What still needs TS6

- **infra/Pulumi:** Pulumi's nodejs runtime loads the classic compiler API at
  deploy time (ts-node registration and the closure serializer) and declares a
  `< 7` TypeScript peer. The requirement stays inside `infra/`: infra pins its
  own nested `typescript: ^6.0.3`, and every infra `Pulumi.yaml` preloads
  `infra/pulumi-typescript6.cjs` through `runtime.options.nodeargs`, which
  resolves `typescript` to that nested copy (the hoisted `@pulumi/pulumi` would
  otherwise find the root TypeScript 7). A local file-backend `pulumi preview`
  logs "Found typescript version 6.0.3 at infra/node_modules/typescript". The
  ghaRunners SDK build uses the same nested compiler through
  `infra:prepare-gha-runners`. A narrowly scoped syncpack version group permits
  only this package/dependency divergence. Remove the preload once Pulumi's
  nodejs runtime supports TypeScript 7. An Alchemy migration was considered and
  rejected (`explorations/pulumi-to-alchemy`).
- **Classic API scripts:** the schema-opaque goal codemod/fixup and scratchpad
  JSDoc census import `@typescript/typescript6` explicitly. Microsoft's bridge
  keeps these live tools usable without putting the classic API back under the
  root `typescript` name. The census accepts `--help` without writing reports.
- **Frozen ontology replay:** reproducing the frozen 2026-08-29
  `beep-ci-operational-ontology` TypeScript adapter needs a 6.x `typescript`
  (for example in a scratch install); preserve its bytes and digest.

The bridge is supported on the repo's Bun pin: oven-sh/bun#33834 was fixed
before Bun 1.4.0. Remove it when these scripts migrate to a supported native
API or are explicitly retired.

Effect-drizzle stays on exact tstyche `8.0.0-beta.0`. Its hosted matrix is
`5.9.3 || 6.0.3`, both exact; explicit targets load compilers from tstyche's
own store and do not load root `typescript`. TypeScript 7 coverage is on demand:

```sh
bun run --cwd packages/ecosystem/effect-drizzle beep:type-test --target next
```

On 2026-10-14 `next` resolved to `7.1.0-dev.20261014.1` and all 78 assertions
passed. It stays out of hosted checks because it moves daily; the beta excludes
7.0 (including 7.0.2) and refuses exact prerelease targets. Add an accepted exact
7.1 beta/stable to the hosted matrix when available. See
`goals/ts7-tstyche8-type-tests` for the lane-C ruling and migration evidence.
Commitlint loads its config through jiti; ts-morph vendors its compiler.
Deprecated API scanning uses oxlint + oxlint-tsgolint's bundled native compiler.

Circular dependency lint uses oxlint’s native `import/no-cycle` rule on the two
tooling source roots. It ignores type-only cycles and requires a positive checked
file count. Madge and its classic compiler parser stack are removed.

Next's build-time type checks use `experimental.useTypeScriptCli: true` in
oip-web and todox. This avoids loading the absent classic `lib/typescript.js`;
Next's native-preview auto-detection does not recognize our native alias.

## Editors

WebStorm's **Languages & Frameworks > TypeScript** picker only lists packages
named `typescript` that carry `lib/tsserver.js`. Native TypeScript 7 has no
`tsserver.js`. The old root 6.0.3 picker entry is gone on purpose. Choose
JetBrains' bundled **TypeScript 7 (Native)** service for plain TS diagnostics
and the Effect plugin’s language server for Effect diagnostics.

Effect diagnostics come from the Effect JetBrains plugin's language server,
which launches the native binary with `--lsp --stdio`. Point its **Binary mode**
at `MANUAL` with the `lib/tsc` path above, never at the
`effect-tsgo` CLI wrapper. `MANUAL` keeps the editor on the catalog's exact
`@effect/tsgo` version; `LATEST` pulls whatever npm tags latest, which can run
ahead of the repo. The plugin setting is stored in the machine-local
`.idea/effect.intellij.xml`, which `beep worktree new` copies into sibling
worktrees (`standards/git-worktrees.md`). A `MANUAL` path is absolute, so a
copied file still points at the source worktree's `node_modules`; re-point it
per worktree if the worktrees drift in `@effect/tsgo` version.

Documentation lint uses repo-owned oxlint plugins. Both lint lanes use oxlint;
ESLint and its TypeScript parser were removed in TS7 exit lane B2.
