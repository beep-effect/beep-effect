# Lockfile fixtures

One directory per fixture, grouped by format: `<format>/<name>/<lockfile>`.
Unless an entry below says otherwise, each file is a package manager's own
output, committed verbatim. Do not reformat or hand-edit a real fixture: the
byte shape is part of what the parser is tested against.

Two naming rules matter here, and `okf/modules/lockfiles.md` explains both:

- A directory named `unsupported-*` holds input the parser must reject. The
  version-gate guard in `Lockfile.test.ts` skips exactly that prefix.
- A pnpm directory named `env-configonly-*` was captured from a workspace with
  no root `package.json`. The version-gate guard parses exactly those with
  `configOnly`, the assertion their real caller would make.
- The `v*` names are fixture **sets**, not lockfile versions. `npm/v1` and
  `npm/v2` are both `lockfileVersion: 3`.

Where the producing tool, command or date was never recorded, this file says
so. It does not guess.

## pnpm env-preamble fixtures (`pnpm/env-*`)

These are real pnpm output, captured on 2026-09-27 on darwin-arm64. Each file
is the full two-document YAML stream pnpm wrote: the env preamble first, then
the lockfile. `PnpmEnvLockfile.test.ts` reads them.

The input project for all three was a `package.json` declaring
`devEngines.packageManager` (with `onFail: "download"`) and one dependency,
`is-number`, which resolved to `7.0.0`.

| Fixture | Command | Input difference | Pins |
| --- | --- | --- | --- |
| `pnpm/env-pnpm12` | `npx pnpm@12.6.0 --dir <d> install` | `devEngines.packageManager` only, no `configDependencies` | pnpm 12 writes the preamble on `devEngines.packageManager` alone. The `pnpm@12.6.0` snapshot lists one `@pnpm/exe.<target>` optional dependency per platform, so `nativeIntegrity` has one SRI entry per native, keyed without a version. |
| `pnpm/env-pnpm11` | `npx pnpm@11.27.1 --dir <d> install` | `devEngines.packageManager` only, no `configDependencies` | pnpm 11 also writes the preamble on `devEngines.packageManager` alone. Its `pnpm@11.27.1` snapshot lists no natives, which hang off a separate `@pnpm/exe` entry, so `nativeIntegrity` is empty. |
| `pnpm/env-configdeps` | `npx pnpm@12.6.0 --dir <d> install` | a `+sha512.<hex>` suffix on the declared pnpm version, plus one `configDependencies` entry (`@effected/pnpm-plugin-effect`, recorded at `0.11.1`) | `specifier` keeps its `+sha512` suffix verbatim, and a preamble carrying both `configDependencies` and `packageManagerDependencies` still yields the pinned manager. |

`pnpm/env-configdeps-pnpm11` and `pnpm/env-configdeps-pnpm12` were captured
the same day from a second input project: a `package.json` depending on
`is-number@7.0.0` and a `pnpm-workspace.yaml` declaring one bare
`configDependencies` entry, `'@effected/pnpm-plugin-effect': 0.11.1`, with no
`devEngines`. In a separate probe, writing the legacy inline form
(`0.11.1+sha512-<base64>`) produced the same preamble on both majors: pnpm
records the bare version as the `specifier` either way.

| Fixture | Command | Input difference | Pins |
| --- | --- | --- | --- |
| `pnpm/env-configdeps-pnpm11` | `npx pnpm@11.27.1 install --dir <d> --store-dir <tmp>` | one bare `configDependencies` entry, no `devEngines` | The preamble records the config dependency's integrity and nothing else. This is where a bare `configDependencies` entry keeps its integrity (effected#842). pnpm 11 also writes `pnpmfileChecksum` into the lockfile document. |
| `pnpm/env-configdeps-pnpm12` | `npx pnpm@12.6.0 install --dir <d> --store-dir <tmp>` | as above | The same preamble as pnpm 11, byte for byte. The lockfile document carries no `pnpmfileChecksum`. |

`pnpm/env-configonly-pnpm11` and `pnpm/env-configonly-pnpm12` were captured
on 2026-09-27 on darwin-arm64 from a third input project. It had no
`package.json` at all, only a `pnpm-workspace.yaml` declaring the same bare
`configDependencies` entry. Each command was run from outside `<d>`. The
empty main document needs the missing `package.json`: a `package.json` with
no dependencies, with or without `devEngines.packageManager`, makes both
majors write a main document holding `importers: {.: {}}` instead.

| Fixture | Command | Input difference | Pins |
| --- | --- | --- | --- |
| `pnpm/env-configonly-pnpm11` | `npx pnpm@11.28.0 install --dir <d> --store-dir <tmp>` | no `package.json`, one bare `configDependencies` entry | The preamble is followed by an **empty** main document. By default `Lockfile.parse` fails it `noLockfileDocument`; with `configOnly` it reads as an empty lockfile versioned by the preamble. The env reader reads the preamble either way (effected#845). |
| `pnpm/env-configonly-pnpm12` | `npx pnpm@12.7.0 install --dir <d> --store-dir <tmp>` | as above | Byte-identical to the pnpm 11 capture. |

`pnpm/unsupported-interrupted-pnpm12` was captured on 2026-09-27 on
darwin-arm64 from a fourth input project: the same `pnpm-workspace.yaml`,
plus a root `package.json` depending on a package that does not exist
(`@effected/this-package-does-not-exist-xyz@^1.0.0`). The install failed after
the config dependency was installed, and left this file on disk.

| Fixture | Command | Input difference | Pins |
| --- | --- | --- | --- |
| `pnpm/unsupported-interrupted-pnpm12` | `npx -y pnpm@12.7.0 install --store-dir <tmp>`, which failed (pnpm 11.28.0 left the same bytes) | a root `package.json` whose one dependency cannot resolve | **Byte-identical** to `pnpm/env-configonly-pnpm12`. The bytes cannot tell a config-only workspace from an interrupted install, which is why `Lockfile.parse` fails this stream unless the caller asserts `configOnly`. It carries the `unsupported-` prefix because its caller, which sees a root `package.json`, must reject it. |

To regenerate one, recreate its input project in an empty directory `<d>`, run
the command in its row, and copy `<d>/pnpm-lock.yaml` over the fixture
unchanged. The assertions in `PnpmEnvLockfile.test.ts` pin exact versions and
integrities, so a re-capture against a newer pnpm means updating them too.

The failure cases in `PnpmEnvLockfile.test.ts` do not use these files. They
build a preamble in the test itself and break one edge per test.

## Fixtures with recorded provenance

The test that reads each fixture records where it came from. These entries
cite that record.

| Fixture | Provenance | Pins |
| --- | --- | --- |
| `pnpm/peers`, `npm/peers`, `bun/peers`, `yarn/peers` | Real output of pnpm 11.22.0, npm 11.19.0, bun 1.3.14 and yarn 4.9.1, one per manager, over one workspace. An app pins `react@17.0.2` against `react-dom@18.3.1` (an unmet required peer) and `react-redux@9.2.0` (two optional peers). A workspace library declares one required peer and two optional ones. Added in #432. | Peer declarations and `peerDependenciesMeta`, recorded the same way in all four formats. |
| `pnpm/variants`, `npm/nested`, `bun/nested` | Real manager output over trees built to duplicate a package. `pnpm/variants` installs `react-dom` against two different `react` versions. The shared `nested` workspace shadows `react@18.3.1` under a workspace directory against a hoisted `17.0.2`, and `ms@2.0.0` under `debug` against a hoisted `2.1.3`. The test does not record each manager's version. Added in #432. | Package *instance* identity and resolved edges, as distinct from name@version. |
| `pnpm/linkedpeer` | Real pnpm 11.22.0 output, from a workspace overriding `react` to `link:packages/fakereact`. Added in #432. | A registry package's peer satisfied by a linked workspace directory, which pnpm spells two different ways. |
| `pnpm/unnameablelink` | Real pnpm 11.22.0 output, from an override pointing a registry name at `link:vendor/react-stub`, a directory that is not a workspace importer. Added in #432. | An edge that resolves, one that is recorded but cannot be named (`unresolvedEdges`), and one that is absent, all in one snapshot. |
| `pnpm/filepeer` | Real pnpm 12.6.0 output, byte-identical under pnpm 11.28.0, over one workspace: `packages/host` depends on a `file:` directory `lib` that peers on `react` and `react-dom`, a `file:` tarball `tarlib`, a `file:` directory at `vendor/paren(lib)`, and a `link:` to `vendor/linklib` outside the globs, each declaring peers. | pnpm suffixes `file:` directories and tarballs like registry versions (nested chains included) and never suffixes `link:`; a path ending in a group is keyed the way pnpm keys its own `packages:` entry. |
| `pnpm/alias` | Real pnpm 11.22.0 output. `glob@10.4.5` pulls in `@isaacs/cliui`, which records aliased edges such as `string-width-cjs: string-width@4.2.3`. The root importer declares `semver-classic: npm:semver@7.6.3`. Added in #453. | npm-alias edges resolve, and the whole lockfile has no `unresolvedEdges`. |
| `pnpm/publishdir` | Real pnpm 11.22.0 output. `packages/react` declares `publishConfig.directory: dist/pkg` and `linkDirectory`. Added in #453. | A `link:` edge into a declared publish directory resolves to its importer. |
| `yarn/devdeps` | Real yarn 4.9.1 output. `typescript` is declared only in `devDependencies`, and `chalk` only in `dependencies`. Added in #432. | A Berry lockfile writes dev edges under `dependencies:`, and both edges resolve. |
| `pnpm/unsupported-v6` | Real pnpm 8 output (`lockfileVersion: '6.0'`), workspace-shaped. The exact pnpm 8 patch is not recorded. Added in #432. | A pre-v9 pnpm lockfile fails typed at `stage: "validation"`. |
| `pnpm/unsupported-v6-single` | Real pnpm 8.15.9 output for a non-workspace project, which has no `importers` map. Added in #432. | The version gate runs before the shape decode, so this file fails as too old rather than as malformed. |
| `npm/unsupported-v1` | Real npm 11.19.0 output from `npm install --lockfile-version=1`. Added in #432. | A `lockfileVersion: 1` tree, which has no `packages` object, fails as too old rather than as malformed. |

## Hand-authored fixtures

These files are not install output. Do not regenerate them with a package
manager: the property each one pins is one no install produces.

| Fixture | Why it is hand-authored | Pins |
| --- | --- | --- |
| `npm/ancestor-walk` | npm's hoisting avoids this shape, so no install produces it on demand. The file's own `__comment` key says so. Added in #432. | Resolution walks through an intermediate ancestor's `node_modules`, not just "own, else root". |
| `npm/unsupported-v2` | Hand-authored because the subject is the `lockfileVersion: 2` field, not the tree (`okf/modules/lockfiles.md`). Added in #432. | An npm v2 lockfile fails typed at validation. |
| `pnpm/emptysnapshots` | Hand-authored: a dependency-free v9 workspace document (`okf/modules/lockfiles.md`). Added in #432. | The version gate keys on `lockfileVersion`, not on whether `snapshots:` is empty. |
| `pnpm/multidoc` | At least partly hand-authored. Its preamble's integrity is a visible placeholder (`sha512-cfgDepPreambleOnlyDoNotReadThisDocumentAsTheLockfile…`), not a real hash. The tool and command behind its second document are not recorded. Added in #58. | `Lockfile.parse` reads the last document of a two-document pnpm stream, not the `configDependencies` preamble. |

## Fixtures with no recorded provenance

The original fixture sets arrived with the package in #38 (2026-07-10):
`pnpm/v1`, `pnpm/v2`, `pnpm/v3`, `npm/v1`, `npm/v2`, `bun/v1`, `bun/v2`,
`bun/v3`, `yarn/v1` and `yarn/v2`. Neither that commit nor the tests that read
these files record the producing tool version or command. `okf/modules/lockfiles.md`
counts them as real manager output. The files agree with that: the yarn ones
carry yarn's generated-file header, and the formats are pnpm `lockfileVersion
'9.0'`, npm `3`, bun `1` and yarn Berry `__metadata.version: 8`. The exact
versions and commands are unknown, so re-baselining one of these means
recording its provenance here at the same time.
