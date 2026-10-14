# tstyche 8 migration and backend evidence

Checked 2026-10-14 against the exact npm 8.0.0-beta.0 artifact. Its tarball
SHA-512 matches the npm metadata integrity. Node v24.21.0 meets Node >=22.

## Upstream sources

- Release: https://github.com/tstyche/tstyche/releases/tag/v8.0.0-beta.0
- Release API: https://api.github.com/repos/tstyche/tstyche/releases/tags/v8.0.0-beta.0
- TS7 backend migration: https://github.com/tstyche/tstyche/pull/763
- Specifier migration: https://github.com/tstyche/tstyche/pull/770
- Timeout migration: https://github.com/tstyche/tstyche/pull/769
- API rename: https://github.com/tstyche/tstyche/pull/776
- Metadata: https://registry.npmjs.org/tstyche/8.0.0-beta.0

## Breaking changes reviewed before editing

| Release change | Effect on this lane |
| --- | --- |
| Add TypeScript 7 support | Native backend needs 7.1 API; original 7.0.2 is excluded. Revised next matrix passes. |
| FileLocation becomes FilePosition | Tests import only expect/it; no use of either API name. No migration. |
| TSTYCHE_TYPESCRIPT_MODULE becomes TSTYCHE_TYPESCRIPT_SPECIFIER | No old variable found in package, scripts or .github. If configured externally, use a package specifier or directory file URL. |
| Remove TSTYCHE_TIMEOUT in favor of TSTYCHE_FETCH_TIMEOUT | No old variable found in package, scripts or .github. External overrides must migrate. |

The enum-member toHaveProperty diagnostic fix does not touch current tests.
Existing testFileMatch, tsconfig and target configuration keys still exist.
No separate standalone v8 migration guide was located; release-linked PRs and
published runtime source establish the migration behavior.

## Compiler resolution from published runtime source

- dist/store/ManifestService.js:51 excludes stable versions starting with 7.0
  while collecting supported targets from npm's `typescript` package metadata.
- dist/store/PackageService.js downloads explicit targets to its own
  `typescript@<version>` store directory. For supported native versions it
  downloads the matching @typescript/typescript-<platform>-<arch> binary too.
- dist/store/Store.js:47 also rejects installed 7.0 packages. Version >=7 uses
  package exports `./sync` and `./ast` to construct NativeTypeScript; older
  versions load the JS compiler API through CompatTypeScript.
- Explicit numeric targets load from that store. Only target `*` can resolve
  the installed package through TSTYCHE_TYPESCRIPT_SPECIFIER (default
  `typescript`). It does not use the installed @typescript/native alias for
  the requested numeric target, nor its Effect-patched binary.
- package.json: optional peer `typescript >=5.4`, Node >=22, no dependencies.
  The explicit target-store route does not require root TypeScript 6. The
  requested matrix still downloads 5.9.3/6.0.3 for historical compatibility;
  this is separate from requiring the root's installed TypeScript 6 API.

## Runtime reproduction

From the repo root, using the disposable extracted beta:

```sh
TSTYCHE_STORE_PATH="$PWD/.cache/ts7-tstyche8/store" \
  node .cache/ts7-tstyche8/package/dist/bin.js \
  --config packages/ecosystem/effect-drizzle/tstyche.config.json \
  --root packages/ecosystem/effect-drizzle \
  --target '5.9.3 || 6.0.3 || 7.0.2'
```

Exit 1. Exact output is in ../history/target-7.0.2.log. No assertions ran and
there is no evidence of a TS7-vs-TS6 assertion difference. The older graduation
receipt was subsequently resolved for 7.1 coverage, with 7.0 still excluded.

## Resumed matrix (2026-10-14)

The installed exact beta reproduces the reviewed Store/ManifestService behavior.
`--list` returns 6.0.3 as newest stable and next = 7.1.0-dev.20261014.1.
ManifestService filters all hyphenated versions from versions; only the current
beta/latest/next/rc resolutions add prereleases. Exact 7.1.0-dev.20261008.1 is
therefore refused before assertions, despite the backend supporting 7.1.

The package script passes on 5.9.3 / 6.0.3 / next: 36 tests and 234 assertions
across three target runs. No tests or assertions changed and no divergence
appeared. Store directories contain all three compiler packages and the
matching TypeScript 7.1 native binary. Historical JS targets still use JS APIs;
the matrix does not depend on the root TypeScript 6 installation. The existing
package TypeScript devDependency remains; removal for other tools is separate.

Next is moving and is not the exact tsc-rs compiler snapshot. C-1 pins a supported
exact 7.1 beta/stable when listed. C-2 upgrades the held beta to stable tstyche
8.0 only after the same matrix passes. Public logs in history redact home paths.
