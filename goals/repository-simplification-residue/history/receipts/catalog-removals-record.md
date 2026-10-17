# #1860 catalog removals and unused-entry detector: record

Third A-train PR (#1851/#1860), branch `chore/residue-a-train-3` off `main`
`4a9e6aacdc`. Source evidence: the H1 receipt
`goals/repository-simplification-confidence/history/receipts/stage-4-h1-catalog.md`
(13 original candidates, the derived `pdfjs-dist`, the inert jaeger override and
the Fallow detection gap).

## Census commands (run fresh at the branch base)

All searches exclude the provenance directories `goals/`, `research/`,
`explorations/` and `.repos/`.

- Manifests: every tracked `package.json` (all workspaces, the scratchpad and the
  root), searched for `"<candidate>":` keys in all four dependency fields.
- Overrides: the root `overrides` block, plus `.fallowrc.jsonc`
  `ignoreDependencyOverrides`.
- Imports: `from`, `import(` and `require(` of each candidate (subpaths included).
- Generators and scaffolders: `CreatePackage.command.ts`, its `templates/`,
  `Architecture/internal/PackageShell.ts`, the `standards/*-catalog/` shards, generated
  package scripts, syncpack and Turbo config. Literal search for each candidate name.
- Docs that instruct installing a candidate: the same literal search over `docs/`,
  `standards/` and the package READMEs and KNOWLEDGE files.
- Lockfile: the `packages` entries of `bun.lock` that depend on each candidate.

## Dispositions

| Candidate | Manifest / override (before) | Import | Generator / doc | Lockfile dependents | Disposition |
| --- | --- | --- | --- | --- | --- |
| `@google-cloud/pubsub` | catalog; `scratchpad/package.json` | `scratchpad/effect-ontology/Service/PubSubClient.ts:14-15`, `scratchpad/effect-ontology/Runtime/EventBroadcastRouter.ts:21` | none | direct | KEEP (live scratchpad import) |
| `@google-cloud/storage` | catalog; `scratchpad/package.json` | `scratchpad/effect-ontology/Service/Storage.ts:18` | none | direct | KEEP (live scratchpad import) |
| `@xenova/transformers` | catalog; `scratchpad/package.json` | `scratchpad/effect-ontology/Service/NomicNlp.ts:15` | none | direct | KEEP (live scratchpad import) |
| `@zip.js/zip.js` | catalog; `scratchpad/package.json` | none | none | none | REMOVE (catalog + scratchpad) |
| `ajv` | catalog only | none | prose only (scratchpad sbom/npm notes) | commitlint, MCP SDK, tsdoc-config, conf | REMOVE (catalog); stays transitive |
| `exifreader` | catalog; `scratchpad/package.json` | none | none | none | REMOVE (catalog + scratchpad) |
| `file-type` | catalog; `scratchpad/package.json` | none | none (the `FileTypeChecker` hits are the word "file-type") | `music-metadata`, `officeparser` (both removed) | REMOVE (catalog + scratchpad) |
| `gl-bench` | catalog only | none | comments in `apps/professional-desktop/vite.config.ts:107` and `packages/ontology/client/vitest.browser.config.ts:7` say no alias is needed | `@cosmos.gl/graph` | REMOVE (catalog); stays transitive |
| `gray-matter` | catalog; `scratchpad/package.json` | none | prose only (`scratchpad/effected/markdown` parity notes) | `@effect/markdown-toc` (pins 3.1.1) | REMOVE (catalog + scratchpad); 3.1.1 stays transitive |
| `mdast-util-find-and-replace` | catalog only | none | none | none | REMOVE (catalog) |
| `mediabunny` | catalog; `scratchpad/package.json` | none | none | none | REMOVE (catalog + scratchpad) |
| `music-metadata` | catalog; `scratchpad/package.json` | none | none | none | REMOVE (catalog + scratchpad) |
| `officeparser` | catalog; `scratchpad/package.json` | none | none | none | REMOVE (catalog + scratchpad) |
| `rehype-stringify` | catalog only | none | none | none | REMOVE (catalog) |
| `remark-gfm` | catalog only | none | none | none | REMOVE (catalog) |
| `typedoc` | already absent from the catalog | none | none | none | REMOVE (already done before this PR; nothing left) |
| `pdfjs-dist` | catalog; root override `catalog:`; `scratchpad/package.json` | none | JSDoc example string in `Turbopack.schema.ts:444` (regex literal, not an install) | `officeparser` only (pins `6.2.108`; the override lifted it to `6.4.299`) | REMOVE (catalog, override, scratchpad) |
| `@opentelemetry/propagator-jaeger` override | root override `2.10.0`; `.fallowrc.jsonc` ignore row | none | none | none (the lockfile listed it only in its `overrides` block) | REMOVE (inert override + Fallow ignore row) |
| `@types/estree` (found by the new detector) | catalog only | no `estree` type import | none | MDX, rollup and estree tooling | REMOVE (catalog); stays transitive |

`pdfjs-dist` override proof: `bun.lock` had exactly one dependent, `officeparser@8.1.1`
(`"pdfjs-dist": "6.2.108"`). OSV `querybatch` for `npm/pdfjs-dist@6.2.108`,
`npm/pdfjs-dist@6.4.299` and `npm/@opentelemetry/propagator-jaeger@2.10.0` returned no
advisories for any of them. The override was therefore a version-unification pin for
`officeparser`, not a security floor. It guarded no live transitive once `officeparser`
left, and after `bun install` no `pdfjs-dist` package remains in the lockfile.

## Removals landed

- Root `package.json` catalog: `@types/estree`, `@zip.js/zip.js`, `ajv`, `exifreader`,
  `file-type`, `gl-bench`, `gray-matter`, `mdast-util-find-and-replace`, `mediabunny`,
  `music-metadata`, `officeparser`, `pdfjs-dist`, `rehype-stringify`, `remark-gfm`
  (14 entries).
- Root `package.json` overrides: `@opentelemetry/propagator-jaeger`, `pdfjs-dist`.
- `scratchpad/package.json` dependencies: `@zip.js/zip.js`, `exifreader`, `file-type`,
  `gray-matter`, `mediabunny`, `music-metadata`, `officeparser`, `pdfjs-dist`.
- `.fallowrc.jsonc` `ignoreDependencyOverrides`: the jaeger row.
- `bun.lock`: regenerated by its owner, `bun install`. The first install removed 8
  packages. The `@types/estree` catalog removal changed only the lockfile's catalog
  block. `bun install --frozen-lockfile` is clean afterwards.

## Census after

The same searches find no manifest, override or import of any REMOVE row. The three
KEEP rows are unchanged. `bun run beep quality catalog-usage` reports
`catalog_entries=245 root_overrides=35 manifests=158 template_references=45 findings=0`.
At the branch base the catalog held 259 entries and 37 overrides.

## Detector design

It lives on the existing `beep quality` surface, beside `changeset-graph`, which already
owns workspace-manifest graph checks. It reuses that module's
`collectWorkspacePackageJsonFiles`. Fallow's `unused-catalog-entries` rule is off in
`.fallowrc.jsonc` and cannot model Bun root-override consumers (H1 "Detection gap"),
so this is option (b) from the H1 receipt.

- Schema (`Quality/CatalogUsage.schemas.ts`): `CatalogUsageSubject` (LiteralKit
  `catalog-entry | root-override`), `CatalogUsageRootManifest` (`catalog`, named
  `catalogs`, `overrides` as JSON), `CatalogUsageManifestDependencies` /
  `CatalogUsageManifest`, `CatalogUsageTemplateReference`, `CatalogUsageSnapshot`,
  `CatalogUsageFinding`, `CatalogUsageReport`. The typed error `CatalogUsageError` is in
  `Quality.errors.ts`.
- Service (`Quality/CatalogUsage.service.ts`): `CatalogUsageSource`
  (`snapshot(repoRoot)`), the port tests can substitute.
- Implementation (`Quality/CatalogUsage.ts`): `CatalogUsageSourceLive` reads the root
  manifest, the tracked workspace manifests, the `bun.lock` package names (both the
  installed key name and the resolved specifier name) and the `catalog:` spellings in
  the tracked generator sources (`CATALOG_USAGE_TEMPLATE_SOURCES`: `CreatePackage/` and
  `PackageShell.ts`). The pure `catalogUsageReport` applies the rules below, and
  `runCatalogUsageCheck` logs a summary and fails on any finding.
- A catalog entry is consumed by a `catalog:` (default, including `catalog:default`) or
  `catalog:<name>` reference for its own catalog. The reference can come from any
  manifest dependency field, any root override value (nested parent-scoped override
  objects included) or a generator template.
- A root override is consumed by a manifest dependency with the same package name or by
  a package that `bun.lock` resolves. A `name@range` selector matches on its name. The
  lockfile path is what closes the Fallow gap.
- No baseline or exception file (S31). The fix for a finding is to remove the entry or
  add its consumer.

Wiring: `bun run beep quality catalog-usage` (check-only, exits non-zero on findings).
It is lane `quality:catalog-usage` in the cheap-gates tier, as
`observability:catalog-check` is, and step `ci:repo-sanity:catalog-usage` in the hosted
repo-sanity CI lane, beside `lint:schema-catalog` and `ci:repo-sanity:changeset-graph`.
It is not in the gate-order seed: like the other cheap-tier-only catalog checks, it is
outside the pre-push set. No package scripts changed.

Paired fixtures (`packages/tooling/tool/cli/test/catalog-usage.test.ts`):

- Positive: a planted unused default entry, an unused named-catalog entry and two inert
  overrides (plain and `name@range` with a nested object) are all reported. The live gate
  fails on a planted `planted-unused` entry in a fixture git checkout.
- Negative: entries used only through a root override `catalog:` value (override consumed
  through the lockfile), only through a generator template, only through `catalog:tools`
  and only through `catalog:default` are not reported. A transitive-only override
  consumed through the lockfile is not reported. The live gate passes on the matching
  fixture checkout. A named-catalog reference does not credit a same-named default entry.
- Third check: the real repository reports zero.

## Reversal

`git revert` the PR, then run `bun install`. That restores the catalog, override,
scratchpad and lockfile entries and removes the detector, the lane and the CI step.
