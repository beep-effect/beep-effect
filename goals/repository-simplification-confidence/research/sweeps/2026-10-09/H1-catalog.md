# H1 sweep: dependency catalog and compatibility holds

## Provenance

- Head: `e62411d63f` (lane `rsc-packet`, equal to `main`). Date: 2026-10-09. Read-only sweep.
- Commands: `git ls-files '*package.json'` (162 tracked manifests) + `grep -l '"<name>": "'` per candidate;
  `git grep` over all tracked files for names and for `from "<name>"` / `import("<name>")` imports;
  `bun.lock` scan (packages section from line 3780) for resolved instances and lock parents;
  `git log -S/-G` on `package.json` and `patches/*` for introduction commits, then commit-body grep
  for rationale; reads of `syncpack.config.ts`, `knip.jsonc`, `.fallowrc.jsonc`, `osv-scanner.toml`,
  `patches/onnxruntime-node@1.30.0.md`, CreatePackage / Architecture PackageShell templates, and
  VersionSync `RootCatalog.ts`. Census scripts kept in the sweep scratch directory (`h1-census.sh`,
  `h1-hist.sh`, raw outputs `h1-overrides-raw.txt`, `h1-hist-raw.txt`).
- Excluded: `goals/repository-simplification-confidence/**` (being written by another agent).

## Headline

- 16 candidates checked. **6 have zero consumers anywhere** (no manifest, no import, no generator):
  `ajv`, `gl-bench`, `mdast-util-find-and-replace`, `rehype-stringify`, `remark-gfm`, `typedoc`.
- **10 are still declared by `scratchpad/package.json` as `catalog:`** (lines 49-62). The census
  reported them unused because both Knip (`knip.jsonc` `ignoreWorkspaces: ["scratchpad", ...]`,
  line 198) and Fallow skip the scratchpad workspace. Of those 10:
  - 3 are imported by live, typechecked scratchpad code (`scratchpad/effect-ontology`, which has
    `check:effect-ontology` / `test:effect-ontology` scripts and was touched by #1552 today):
    `@google-cloud/pubsub`, `@google-cloud/storage`, `@xenova/transformers`.
  - 7 are declared but never imported: `@zip.js/zip.js`, `exifreader`, `file-type`, `gray-matter`,
    `mediabunny`, `music-metadata`, `officeparser`.
- Derived 17th candidate: `pdfjs-dist` (catalog line 212, override line 345). Only consumers are
  `scratchpad/package.json:63` (never imported) and the `officeparser` lock parent. Removing the
  unused scratchpad declarations leaves its catalog entry and override with no consumer.
- No generator or scaffolder references any candidate: CreatePackage templates and
  `Architecture/internal/PackageShell.ts` only emit `effect`, `drizzle-orm`, `@effect/vitest`,
  `@types/node`, `bun-types`, `@testing-library/*` as `catalog:`; VersionSync `RootCatalog.ts`
  is read only by the Biome, Effect and Turbo resolvers; `syncpack.config.ts` treats the catalog
  generically (`customTypes.catalog`, "Catalog (Pinned)" group) and names no candidate.
  The only `typedoc` string in tooling source is a JSDoc specification label
  (`packages/tooling/library/repo-utils/src/JSDoc/JSDoc.ts`, `specifications: [..., "typedoc"]`),
  not a dependency.
- Why the reservations accumulated: `.fallowrc.jsonc` turns off `unused-catalog-entries` and
  `empty-catalog-groups` (lines 605-608) because Fallow does not count catalog references under
  Bun root overrides and would flag the seven `@effect/tsgo-*` pins. No other gate detects unused
  catalog entries.

## Candidate table

Catalog line = line in root `package.json` (`catalog` block starts line 2). None of the 16 appears
in root `overrides`, root `dependencies`/`devDependencies`, or `patchedDependencies`; there is no
`resolutions` block (only a stale `"resolutions#"` comment key, line 371).

| package | catalog line | manifests | imports | generators | recommendation |
|---|---|---|---|---|---|
| `@google-cloud/pubsub` | 54 `^6.2.0` | `scratchpad/package.json:49` | `scratchpad/effect-ontology/Runtime/EventBroadcastRouter.ts`, `scratchpad/effect-ontology/Service/PubSubClient.ts` | none | retain while `scratchpad/effect-ontology` keeps `PubSubClient`; record as scratchpad-only hold (owner: effect-ontology scratch) |
| `@google-cloud/storage` | 55 `^8.3.0` | `scratchpad/package.json:50` | `scratchpad/effect-ontology/Service/Storage.ts` (used by `Cli/index.ts`, `Cli/Commands/{Ingest,Reconcile,Storage}.ts`) | none | retain, same scratchpad-only hold |
| `@zip.js/zip.js` | 141 `^2.23.0` | `scratchpad/package.json:52` | none | none | remove (catalog + scratchpad declaration) |
| `@xenova/transformers` | 142 `^2.17.2` | `scratchpad/package.json:51` | `scratchpad/effect-ontology/Service/NomicNlp.ts` | none | retain, same scratchpad-only hold (note: it is one of two lock parents of `sharp`) |
| `ajv` | 145 `^8.20.0` | none (last direct consumer removed in b311763ee4, 2025-11-01) | none (only transitive copies under `ajv-formats`, `conf`, `@commitlint/config-validator`, `@microsoft/tsdoc-config`, `@modelcontextprotocol/sdk`) | none | remove |
| `exifreader` | 174 `^4.46.0` | `scratchpad/package.json:55` | none | none | remove (catalog + scratchpad) |
| `file-type` | 180 `^22.1.1` | `scratchpad/package.json:56` | none | none | remove (catalog + scratchpad) |
| `gl-bench` | 183 `^1.0.42` | none (devDependencies dropped in #1173, 94c66a72ab) | none; `apps/professional-desktop/vite.config.ts` (~line 107) and `packages/ontology/client/vitest.browser.config.ts` (~line 7) carry comments explaining `@cosmos.gl/graph` 3.4.2 imports gl-bench by deep path, so no alias is needed | none | remove |
| `gray-matter` | 185 `^4.0.3` | `scratchpad/package.json:57` | none | none | remove (catalog + scratchpad). `@effect/markdown-toc` still brings its own copy, so the `js-yaml` override keeps consumers |
| `mdast-util-find-and-replace` | 198 `^3.0.3` | none (never in any manifest per `git log -S`) | none | none | remove |
| `mediabunny` | 199 `^1.61.3` | `scratchpad/package.json:59` | none | none | remove (catalog + scratchpad) |
| `music-metadata` | 203 `^12.0.0` | `scratchpad/package.json:60` | none | none | remove (catalog + scratchpad) |
| `officeparser` | 207 `^8.1.1` | `scratchpad/package.json:62` | none | none | remove (catalog + scratchpad); then remove `pdfjs-dist` catalog line 212, override line 345 and `scratchpad/package.json:63` |
| `rehype-stringify` | 224 `^10.0.1` | none (never in any manifest) | none | none | remove |
| `remark-gfm` | 225 `^4.0.1` | none (last manifest use removed by 1f403bea76, 2026-02-18) | none | none | remove |
| `typedoc` | 249 `^0.28.20` | none (never in any manifest) | none; no `typedoc` binary in any script, turbo task or workflow | none | remove |

Net: remove 13 catalog entries + `pdfjs-dist` (14 catalog lines, 1 override, 8 scratchpad
declarations); retain 3 with a scratchpad-only hold record.

## Other holds in root package.json

Override lines are in the `overrides` block (lines 314-355). "Lock parents" are packages in
`bun.lock` whose dependency map names the package (first few shown). "Evidence" is the recorded
reason found in commit bodies, `osv-scanner.toml`, or repo docs.

### Catalog-backed overrides (force one version graph-wide)

| override | line | consumer | evidence | proposed hold record |
|---|---|---|---|---|
| `@effect/platform-node` | 315 | 41 workspace manifests; lock parent `@effect/openapi-generator` | Effect snapshot alignment (changesets `effect-catalog-snapshot-*`) | retain; exit when Effect is published non-snapshot and all parents accept the catalog range |
| `@effect/platform-node-shared` | 316 | 9 manifests; lock parents `@effect/platform-bun`, `@effect/platform-node` | same; also required so the patch (below) applies to one copy | retain with the patch |
| `@effect/tsgo-{darwin-arm64,darwin-x64,linux-arm,linux-arm64,linux-x64,win32-arm64,win32-x64}` | 317-323 | lock parent `@effect/tsgo` (optional platform binaries); no direct manifest | `.fallowrc.jsonc` comment above `ignoreDependencyOverrides`; `docs/runbooks/typescript-toolchain.md` ~line 35 (shim resolves the linux-x64 artifact) | retain; exit when `@effect/tsgo` pins its own binaries exactly |
| `@opentelemetry/exporter-trace-otlp-proto` | 326 | `packages/foundation/capability/observability`, `packages/tooling/library/ai-metrics`; lock parent `@arizeai/phoenix-otel` | no recorded failure found | retain; record reason (single exporter version across Phoenix and own OTel) or prove removal |
| `next` | 341 | `apps/oip-web`, `apps/todox`, `packages/foundation/ui-system/ui`, `packages/tooling/policy-pack/repo-configs`; lock parents `@serwist/next`, `@vercel/analytics`, `@vercel/speed-insights` | #1359 (c16f6bd5bf): GHSA-vcvr-r3jv-pc5j fixed in 16.3.6; catalog now `16.5.0-canary.3` | retain; record canary reason and exit to stable |
| `pdfjs-dist` | 345 | only `scratchpad/package.json:63` (unused) and lock parent `officeparser` | added in #882 (3435c24f94), no reason in body | remove with `officeparser` |
| `sharp` | 350 | `packages/drivers/face-detection`, `packages/tooling/tool/cli`; lock parents `next`, `@xenova/transformers` | no recorded failure found | retain; record (native binary single copy) |
| `tar` | 353 | `packages/tooling/tool/cli`; lock parents `node-gyp`, `pacote` | `.changeset/otel-ghsa-8988-dep-bump.md` context; security floor | retain as security floor |

### Transitive security floors and pins (plain versions)

| override | line | value | lock parents | evidence | status |
|---|---|---|---|---|---|
| `@grpc/grpc-js` | 324 | `1.14.5` | dockerode, google-gax, OTel grpc exporters, @pulumi/pulumi | #1359: GHSA-f596-whhp-79r4, GHSA-m9gg-hp2v-232j | retain; exit when all parents' ranges resolve >=1.14.5 |
| `@hono/node-server` | 325 | `2.0.11` | @modelcontextprotocol/sdk | introduced 869cba5bfd (2026-03-06), bumped #437; no advisory id recorded | needs reason or removal proof |
| `@opentelemetry/propagator-jaeger` | 327 | `2.10.0` | **none**: `bun.lock` mentions it only in its own `overrides` section (line 3489); no installed instance | added #437 (fb56ab60bf) | **inert; remove** (also drop it from `.fallowrc.jsonc` `ignoreDependencyOverrides`) |
| `axios` | 328 | `1.20.0` | firecrawl | #1359: 12 GHSA ids fixed in 1.20.0 | retain |
| `basic-ftp` | 329 | `6.2.1` | get-uri | ed09a085f3 "override vulnerable basic-ftp"; `goals/effect-vitest-canon/research/basic-ftp-security-repair.md` | retain |
| `browserslist` | 330 | `^4.28.7` | @babel/helper-compilation-targets, @serwist/next, ... | #943 "resolve security advisories" (no id) | needs advisory id |
| `brace-expansion` | 331 | `^5.0.12` | minimatch | #437 "patch brace expansion advisory" | retain |
| `ip-address` | 332 | `10.7.1` | express-rate-limit, socks | d7dc347cc3, no id recorded | needs reason |
| `detailed-xml-validator` | 333 | `2.1.0` | fast-xml-validator | #428 (72c73cf0af), no id recorded | needs reason |
| `fast-uri` | 334 | `^3.1.7` | ajv copies (ajv-formats, conf, commitlint, tsdoc-config, MCP sdk) | #437; mentioned in `goals/boolean-creep/DECISIONS.md` and turborepo-task-qualification research | retain |
| `hono` | 335 | `4.13.7` | @hono/node-server, @modelcontextprotocol/sdk | `.changeset/security-findings-september.md` | retain |
| `js-yaml` | 336 | `5.4.1` | cosmiconfig, gray-matter (scratchpad + @effect/markdown-toc), @pulumi/pulumi | `goals/codex-security-findings-2026-06-17/findings/CSF-003.md` | retain (major-version force; record compatibility) |
| `katex` | 337 | `^0.18.2` | mermaid | #1435 body: fix 0.18.2 outside mermaid 12's range; resolves 0.18.11 | retain; record out-of-range force |
| `lodash-es` | 338 | `^4.18.1` | dagre-d3-es (chevrotain/mermaid path) | ed016ba972 body: GHSA-f23m-r3pf-42rh, GHSA-r5fr-rjxr-66jc | retain |
| `minimatch` | 339 | `10.2.5` | 18 parents incl. eslint, @typescript-eslint/* | no id recorded; in `.fallowrc.jsonc` ignore list | needs reason (exact pin across 18 parents) |
| `nanoid` | 340 | `^3.3.18` | docx, postcss | no id recorded | needs reason |
| `onnxruntime-node@1.30.0` -> `adm-zip: npm:fflate@0.8.3` | 342-344 | scoped alias | onnxruntime-node | `patches/onnxruntime-node@1.30.0.md`: GHSA-vwc7-r8mq-g2x9, no patched adm-zip; exit condition written there | retain; already a complete hold record (model for the others) |
| `postcss` | 346 | `^8.5.23` | next, shadcn, detective-postcss, ... | no id recorded | needs reason |
| `postcss-selector-parser` | 347 | `^7.1.6` | @tailwindcss/typography, shadcn, @npmcli/query | #1435 (61d1b494f0): GHSA-rj75-hqrm-r3gf | retain |
| `proxy-addr` | 348 | `2.0.8` | express | #1435: 2026-10-05 OSV advisories, in-range patch | retain |
| `protobufjs` | 349 | `^7.6.6` | dockerode, google-gax, @grpc/proto-loader, onnx-proto | fd7c8c2bfc, no id recorded | needs reason |
| `smol-toml` | 351 | `^1.9.0` | knip | dacb5bf00d "patch smol-toml security override"; #1435 | retain |
| `source-map-js` | 352 | `^1.2.2` | css-tree, postcss, @tailwindcss/node, ... | #1435: 2026-10-05 OSV advisories | retain |
| `uuid` | 354 | `^11.1.1` | box-node-sdk, mermaid, @comunica/* | no id recorded | needs reason |

### patchedDependencies (lines 357-364)

| patch | consumer | evidence | exit condition |
|---|---|---|---|
| `knip@6.40.0` | root devDependency `knip` | adds `.ts -> [.ts, .tsx]` extension alias in `dist/util/resolve.js`; family introduced with relative-import-extension lint in #435 (abd0c901d7) | depends on workstream A's Knip decision; if Knip is retired, remove with it |
| `onnxruntime-node@1.30.0` | `packages/drivers/face-detection` (via onnxruntime-node) | `patches/onnxruntime-node@1.30.0.md`; test `packages/drivers/face-detection/test/OnnxRuntimeInstall.test.ts`; `scripts/test-onnxruntime-installer-patch.mjs` | upstream release removing the vulnerable extraction path (recorded) |
| `@effect/platform-node-shared@4.0.2` | Effect platform stack | `NodeFileSystem.js` `write`/`writeAllChunk` pass `0, buffer.length` explicitly; family since #1047 (03faddd538), re-keyed in #1234 | no written exit condition found; record upstream issue/fix version |
| `drizzle-orm@1.0.0-rc.5-ab785fc` | drizzle drivers | #1234 (308a3855aa): declaration patch pointing the Effect adapter at `effect/sql/SqlError` | drizzle release built against the current Effect module layout |
| `effect@4.0.2` | everything on Effect | #1234 body: Bun/JSC `Error` own `line`/`column`/`sourceURL`/`originalLine`/`originalColumn` break `Equal`/`Hash.structure`; "retire the patch with the effect bump that carries the upstream fix" | effect release with upstream fix |
| `@xstate/effect@0.1.0-alpha.6` | `apps/professional-desktop` statecharts | #1387 (6cbe90d5c1): `/atom` entry imports `effect/unstable/reactivity`, moved to `effect/reactivity`; also string-keyed action brand for declaration emit | upstream publish of the fix |

### OSV scanner exceptions (`osv-scanner.toml`), expiring in 7 days

`braces 3.0.3` (GHSA-vfj7-8cjw-p6xm), `http-cache-semantics 4.2.0` (GHSA-ch52-4w7c-c8xp),
`sprintf-js 1.0.3` (GHSA-hp3w-g68c-fv3c): each has `[[PackageOverrides]] effectiveUntil` and
`[[IgnoredVulns]] ignoreUntil = 2026-10-16T00:00:00Z`. After that date the required Security
check goes red unless they are renewed or the dependency path is removed.

### Stale guidance found in passing

- `docs/runbooks/xstate-effect-statecharts.md:183` names `patches/@xstate%2Feffect@0.1.0-alpha.5.patch`;
  the live patch is `alpha.6`.
- `package.json:371` `"resolutions#": { "@beep/*": "Needed to force PNPM ..." }` is a comment key
  for a block that no longer exists; the repo uses Bun.
- `.fallowrc.jsonc` `ignoreDependencyOverrides` lists only part of the transitive overrides
  (no `axios`, `basic-ftp`, `@grpc/grpc-js`, `ip-address`, ...) while its comment says it covers
  "the remaining entries"; it includes the inert `@opentelemetry/propagator-jaeger`.

## Proposed plan

1. One PR: delete the 13 catalog entries (all except pubsub/storage/xenova), the 7 unused
   `scratchpad/package.json` declarations plus `pdfjs-dist` (scratchpad line 63, catalog line 212,
   override line 345), and the inert `@opentelemetry/propagator-jaeger` override (and its Fallow
   ignore entry). Regenerate `bun.lock` with `bun install`; confirm the diff only drops those
   packages and their exclusive transitive deps (expect `pdfjs-dist`, gray-matter copy under
   scratchpad, etc.). Run the Security (OSV) lane: removing packages can only shrink advisories.
2. Add a hold register (e.g. a JSONC beside `osv-scanner.toml`, or a section in an existing
   dependency standard) with one row per override and patch: package, line, consumer, failure
   evidence (advisory id or failing test), owner, exit condition. Use
   `patches/onnxruntime-node@1.30.0.md` as the template. Fill the 10 "needs reason" rows by
   checking OSV for the pre-override version; drop any override whose parents already resolve a
   fixed version without it (prove with `bun install` + OSV scan per removal).
3. Close the detection gap: either enable Fallow `unused-catalog-entries` with an allowlist for
   the seven `@effect/tsgo-*` pins (if Fallow supports per-entry ignores) or add a small
   `beep lint` check that every catalog key is referenced by a workspace manifest (including
   scratchpad), a root dependency, or an override.
4. Record the three scratchpad-only catalog entries as holds owned by `scratchpad/effect-ontology`,
   exit = that experiment's retirement.
5. Renew or retire the three OSV exceptions before 2026-10-16.
6. Fix the alpha.5 runbook reference and the stale `resolutions#` key.

## Open questions

- Whether `scratchpad/effect-ontology` is intended to stay (it is live and typechecked); if it is
  retired, `@google-cloud/pubsub`, `@google-cloud/storage` and `@xenova/transformers` become
  removable too, and `sharp` loses one lock parent.
- Advisory ids for `@hono/node-server`, `browserslist`, `ip-address`, `detailed-xml-validator`,
  `minimatch`, `nanoid`, `postcss`, `protobufjs`, `uuid`, `@opentelemetry/exporter-trace-otlp-proto`
  and `sharp` overrides: not recorded in commit bodies, changesets, docs or standards found here.
  Whether each is still needed was not proven (that requires install + OSV runs, out of scope).
- Whether Fallow supports per-entry ignores for `unused-catalog-entries` (not checked against the
  Fallow 3.30 docs).
- Whether upstream Effect 4.0.x already contains the JSC Error-key fix or the
  platform-node-shared `write` fix (not checked against the Effect reference checkout).
- The `infra/lambda/turbo-cache` sub-project has its own `bun.lock` with `ajv` and
  `@google-cloud/storage` as transitive entries; it is not affected by root catalog changes, but
  that was inferred from its separate lockfile, not proven by an install.
