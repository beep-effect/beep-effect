# #1853 retained patch regression and exit proofs: record

Lane `residue-patch-proofs`, branch `test/residue-patch-proofs` off `main`
`e3ee18dfd7`, 2026-10-17. Source evidence: the predecessor's
[retained patches section](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/repository-simplification-confidence/history/receipts/stage-5-acceptance.md#retained-patches),
which left all five fail-unpatched/pass-patched proofs pending.

## Patch census

Root `package.json` `patchedDependencies` holds exactly five entries, and the
installed versions match them: `effect@4.0.4`, `@effect/platform-node-shared@4.0.4`,
`drizzle-orm@1.0.0-rc.5-ab785fc`, `@xstate/effect@0.1.0-alpha.6` and
`onnxruntime-node@1.30.0`. The only override tied to a patch is the version-scoped
`"onnxruntime-node@1.30.0": { "adm-zip": "npm:fflate@0.8.3" }`. It stays in place,
together with its patch.

## Method

Each counterfactual runs in a disposable tree with its own `package.json` and
`bun install --ignore-scripts`. The trees live under the gitignored
`.beep/residue-patch-proofs/trees/`, and the repository install is never touched.
The unpatched tree pins the installed version with no patch. The patched tree adds
the repository's patch file (copied byte for byte) through `patchedDependencies`.
The exit tree pins the latest published version with no patch. Each tree runs a byte
copy of the repository test, and its log records the version and the test hash.
The ONNX trees alias `@beep/test-runner` to a one-line shim that re-exports `it`
from `@effect/vitest`. That alias is the only substitution in any copied test.

## Per-patch record

### `effect@4.0.4`: structural equality of `Error` values under Bun

- Patch: `patches/effect@4.0.4.patch`, sha256
  `5313e7afb13364436178445451613c3983df3480fbbbec6327083e253f4de73c` (narrowed in review rounds 1 and 2; the original was `f0850fa30121f7922fc53932b5bf1ca2f814a194ded9faf7ca0ca0380197ad85`).
- Behavior: `Equal.equals` compares records through all own keys. JavaScriptCore adds
  own `line`, `column`, `sourceURL`, `originalLine` and `originalColumn` keys to every
  `Error`, so two equal errors built at different sites compare unequal. Upstream deletes
  only `stack`. The patch also skips those five keys, but only when the own descriptor is
  non-enumerable (how JavaScriptCore defines them) and the error does not declare the key
  in its Data/Schema payload, `Symbol.for("effect/Data/Error/plainArgs")`. On
  JavaScriptCore a Schema payload `line` keeps the runtime's non-enumerable descriptor,
  so the declared-payload check is what keeps it in equality.
- Limitation: enumerable payload fields with those names stay in equality on every runtime,
  and so does a declared `Schema.TaggedError`/`Data` payload `line`. On JavaScriptCore only, a plain `Error`
  subclass that assigns its own `line` (or another of the five names) inherits the runtime's
  non-enumerable descriptor, so that field does not take part in equality. The test pins
  both behaviors, choosing per runtime by whether a fresh `Error` owns a non-enumerable `line`.
- Test (new):
  `packages/tooling/test-kit/test-utils/test/ErrorEqualityCompatibility.test.ts`
  (sha256 `3989a39de901b045a7250db250b537beadafbff0b37221a20097d3170aaf6886`). It
  covers plain `Error` and `Schema.TaggedError` (the repository's canonical tagged error), checking equality, hash agreement and
  inequality of different payloads, plus payload fields named like the location keys.
- Finding: Vitest installs `Error.prepareStackTrace`. While that hook is set, Bun
  resolves the location keys to 0, and it resolves them lazily on first read. That
  masks the bug inside Vitest. Production Bun installs no hook, so the test clears
  the hook for its block through a scoped `it.layer` resource and restores it on release.
- Counterfactual (`bunx --bun vitest run ErrorEqualityCompatibility.test.ts`):
  - unpatched 4.0.4: `Tests 2 failed | 1 passed (3)`, `AssertionError: expected false to be true`;
  - patched 4.0.4 (narrowed patch): `Tests 3 passed (3)`;
  - exit tree 4.0.5 (latest published): `Tests 2 failed | 1 passed (3)`.
  The plain `Error` case and the payload case fail unpatched. The Schema tagged case passes
  unpatched by design: `.make` constructs every instance at one site inside the class, so the
  location keys already agree. The patch matters for plain `Error` values and for errors
  constructed with `new` at different sites; repository source defines no `Data.TaggedError`.
  These were rerun in review round 2 with the final patch and test, under Bun (above) and
  under Node (`bunx vitest run`, patched tree: `Tests 3 passed (3)`).
- Upstream: no upstream issue or PR exists. `internal/equal.ts` on Effect-TS/effect
  `main` `84aeede040` (2026-10-17, version 4.0.5) still deletes only `stack`. No exit.

### `@effect/platform-node-shared@4.0.4`: positioned writes under Bun

- Patch: `patches/@effect%2Fplatform-node-shared@4.0.4.patch`, sha256
  `7590e9b5fea8a9bdd004d177f0690b9f07da08bb2c608d08da0df6bacdbc23a8`.
- Behavior: Bun's `fs.write` ignores `position` when offset and length are
  `undefined`, so `writeAll` after a seek appends instead of overwriting, and offset
  `Uint8Array` views write their whole backing buffer. The patch passes explicit
  offset and length.
- Test (existing, unchanged):
  `packages/tooling/test-kit/test-utils/test/FileSystemWriteCompatibility.test.ts`
  (sha256 `9eb4002d74c4f912fd5770be015f0d6e9df150541345897dc9e60f6053a1cb4d`),
  "writeAll honors a backward seek and advances by the full payload" and "write and
  writeAll write only the bytes of offset Uint8Array views". The third case, about
  append, passes in all trees.
- Counterfactual (`bunx --bun vitest run FileSystemWriteCompatibility.test.ts`):
  - unpatched 4.0.4: `Tests 2 failed | 1 passed (3)`, `'abcdefghijXYZ12'` against
    expected `"abcXYZ12ij"`, and `[65,66,67,120,121,122]` against `[65,120,121,122]`;
  - patched 4.0.4: `Tests 3 passed (3)`;
  - exit tree 4.0.5 (latest published): `Tests 2 failed | 1 passed (3)`.
- Upstream: [oven-sh/bun#45607](https://github.com/oven-sh/bun/issues/45607) is open.
  `packages/platform/node-shared/src/NodeFileSystem.ts` on Effect `main` still passes
  `undefined, undefined`. No exit; exit when Bun fixes `fs.write` or Effect passes
  explicit arguments in a published version.

### `drizzle-orm@1.0.0-rc.5-ab785fc`: `SqlError` resolving to `any`

- Patch: `patches/drizzle-orm@1.0.0-rc.5-ab785fc.patch` (46 `.d.ts`/`.d.cts` files),
  sha256 `9705f7cb50ff1b270449689e815b8da704772cde55918f664c6f542b771f1be2`.
- Behavior: Drizzle's declarations import the pre-move SQL error subpath (the
  `unstable` SQL module path that Effect retired), which Effect 4.0.4 does not export.
  Effect 4.0.4 has `effect/sql/SqlError`. Under `skipLibCheck`
  the import becomes `any`, which collapses every migrator error union to `any`.
- Test (new): `packages/ecosystem/effect-drizzle/typetests/drizzle-sql-error.tst.ts`
  (sha256 `9fee487bbe0d6391f823b67dcc6b67289715f4d68958fb78971e13e953daa49e`). It
  checks that `Extract<…, SqlError>` is exactly `SqlError` for the Effect Postgres
  migrator and for the pg-core Effect session migrator; `Extract` of `any` is `any`.
  It runs in the package's `beep:check` through `beep:type-test` on both tstyche
  targets (5.9.3 and 6.0.3).
- Counterfactual (`node_modules/.bin/tstyche --config tstyche.config.json --root .`,
  TypeScript 5.9.3):
  - unpatched ab785fc: `Assertions: 2 failed, 2 total`;
  - patched ab785fc: `Assertions: 2 passed, 2 total`;
  - exit tree `1.0.0-rc.5-5935859` (latest published rc5 build, 2026-09-09):
    `Assertions: 2 failed, 2 total`.
- Upstream: [drizzle-orm#6403](https://github.com/drizzle-team/drizzle-orm/issues/6403)
  was closed by [drizzle-orm#6429](https://github.com/drizzle-team/drizzle-orm/pull/6429),
  which merged into the `rc5` branch on 2026-10-04. No published build contains it
  (npm `latest` is 0.45.4). Exit condition: the first published rc5 or 1.0 build that
  passes this test unpatched.

### `@xstate/effect@0.1.0-alpha.6`: declaration emit for exported machines

- Patch: `patches/@xstate%2Feffect@0.1.0-alpha.6.patch`, sha256
  `986b449b61870b0760c79572d8438d30772c4704e1709c5c99559858e258896f`.
- Behavior: `setupEffect` brands actions with an unexported `unique symbol`
  (`effectActionBrand`), so any exported machine that registers Effect actions fails
  declaration emit with TS4023. The patch replaces it with the string key
  `"~xstate/effect/action"`.
- Test (new): `packages/drivers/xstate/test/DeclarationEmit.test.ts` (sha256
  `2437b2a718ef7e7ebbf60995204bb01d305685ca432e5516c18518f457d77892`). It runs the
  repository's `tsc` (TypeScript 7.0.2) with `--noEmit --declaration` against the
  fixture `packages/drivers/xstate/test/fixtures/declaration-emit/AuditedRelease.machine.ts`
  (sha256 `6bafa5d26c858040c2e0ff78fcb172e02b96188d2ab3dac48a8ff7345045fdee`). It
  asserts no TS4023 and exit code 0. It adds `@effect/platform-node` (catalog) to the
  package's devDependencies for `NodeChildProcessSpawner` and `NodePath`.
- Counterfactual (`node_modules/.bin/tsc --ignoreConfig --noEmit --declaration
  --strict --skipLibCheck --target es2022 --module esnext --moduleResolution bundler
  AuditedRelease.machine.ts`):
  - unpatched alpha.6: `AuditedRelease.machine.ts(7,14): error TS4023: Exported
    variable 'auditedReleaseMachine' has or is using name 'effectActionBrand' … but
    cannot be named.`, exit 1;
  - patched alpha.6: no output, exit 0;
  - exit tree `1.0.0-alpha.8` (latest published, with xstate `6.0.0-alpha.69` and
    effect 4.0.5): the same TS4023, exit 1.
- Upstream: the exit evidence is the failing latest published version,
  `@xstate/effect` 1.0.0-alpha.8 (TS4023 above). No upstream issue or PR exists, and the
  `@xstate/effect` source is not on statelyai/xstate `main`, so there is no upstream head
  to check. No exit.

### `onnxruntime-node@1.30.0`: installer extraction

- Patch: `patches/onnxruntime-node@1.30.0.patch`, sha256
  `bf80243e81de0e659eaa9315c0809e2107d827fa39da16e0cb788bc544e8e85d`.
  Companion note `patches/onnxruntime-node@1.30.0.md`, sha256
  `b9dcff4bd23450d24b719d175f25a49dc2c70905dd4f692dac1579a4e4f66c12`.
  Override `"onnxruntime-node@1.30.0": { "adm-zip": "npm:fflate@0.8.3" }`.
- Behavior: the patched installer extracts with fflate through the scoped override.
  It extracts only the selected manifest entry into a private temporary directory,
  never follows a planted symlink, and replaces a destination symlink without writing
  through it.
- Test (existing, unchanged): `retired:face-detection/test/OnnxRuntimeInstall.test.ts`
  (sha256 `18b010f76ea4a73dbda7f7721ad21862e89e6164fc23c1170df6808e36b6977b`), seven
  cases. The unpatched tree has neither the patch nor the override, which reproduces
  the coupled removal.
- Counterfactual (`bunx --bun vitest run OnnxRuntimeInstall.test.ts`):
  - unpatched 1.30.0 (resolves adm-zip 0.6.1): `Tests 3 failed | 4 passed (7)`:
    - `expected 'adm-zip' to be 'fflate'`;
    - the planted-symlink case aborts with `ADM-ZIP: There is a file in the way`;
    - the destination symlink overwrites the sentinel (`'test native binary'`
      against `"untouched"`);
  - patched 1.30.0: `Tests 7 passed (7)`.
- Upstream: onnxruntime-node 1.30.0 is the latest published version (the `dev` tag
  is 1.31.0-dev). [microsoft/onnxruntime#31193](https://github.com/microsoft/onnxruntime/issues/31193)
  is open. GHSA-vwc7-r8mq-g2x9 covers adm-zip `>=0.5.9, <=0.6.0` and lists no patched
  version. adm-zip 0.6.1 (2026-09-11) refuses the planted symlink but does not fix the
  installer's destination-symlink write. No exit.

## Summary

| Dependency | Installed | Patch sha256 (prefix) | Test | Unpatched | Patched | Latest published | Exit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `effect` | 4.0.4 | `5313e7af` | test-utils `ErrorEqualityCompatibility` (new) | 2/3 fail | pass | 4.0.5 fails | none; no upstream issue |
| `@effect/platform-node-shared` | 4.0.4 | `7590e9b5` | test-utils `FileSystemWriteCompatibility` | 2/3 fail | pass | 4.0.5 fails | none; bun#45607 open |
| `drizzle-orm` | 1.0.0-rc.5-ab785fc | `9705f7cb` | effect-drizzle `drizzle-sql-error.tst.ts` (new) | 2/2 assertions fail | pass | rc.5-5935859 fails | fix merged in rc5 branch (#6429), unpublished |
| `@xstate/effect` | 0.1.0-alpha.6 | `986b449b` | xstate `DeclarationEmit` (new) | TS4023 | exit 0 | 1.0.0-alpha.8 fails | none; no upstream issue |
| `onnxruntime-node` (with override) | 1.30.0 | `bf80243e` | retired:face-detection `OnnxRuntimeInstall` | 3/7 fail | pass | 1.30.0 is latest | none; onnxruntime#31193 open |

No patch has a published upstream exit, so none is dropped in this PR. For Effect
equality and XState there is no upstream issue or PR to cite. For Effect, the exit
evidence is the unfixed Effect `main` head plus the failing latest published 4.0.5. For
XState, whose package source is not on statelyai/xstate `main`, it is the failing latest
published 1.0.0-alpha.8. Both were re-checked here.

## Owners and recovery

Owner of record: rsc-a-retire, with the dependency owners: Effect platform/core for
the two Effect patches, the database ecosystem package owner for Drizzle, the xstate
driver owner for `@xstate/effect`, and the retired:face-detection driver owner for ONNX.

- Exit procedure for each patch: bump the dependency, drop its `patchedDependencies`
  entry and patch file, run `bun install`, and run the test named above unpatched. The
  patch is removed only when that test passes.
- ONNX: remove or re-apply the patch, its companion note and the `adm-zip` override
  together, with the lockfile. Never remove the override on its own.
- Reversal of this PR: `git revert` it. It adds three tests and one fixture, adds one
  catalog devDependency (with its `bun.lock` line), and revises the Effect patch
  (`patches/effect@4.0.4.patch`, narrowed in review; see its row above). Reverting also
  reverts that patch revision, so run `bun install` afterwards to reapply the previous patch.
