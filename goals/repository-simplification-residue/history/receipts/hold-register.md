# #1861 hold register and compatibility exit proofs

Lane `residue-hold-exits`, branch `chore/residue-hold-exits` off `main`
`e3ee18dfd7`, census taken on 2026-10-17. Source evidence: the H1 receipt
`goals/repository-simplification-confidence/history/receipts/stage-4-h1-catalog.md`
and the H1 sweep `goals/repository-simplification-confidence/research/sweeps/2026-10-09/H1-catalog.md`.
A-train 3 (#1903, `catalog-removals-record.md`) had already removed the
`pdfjs-dist` and jaeger overrides.

Outcome: 24 overrides removed, 11 retained. Seven catalog entries removed (the
`@effect/tsgo-*` platform pins). One OSV exception resolved, two renewed with
evidence to 2027-01-14. `@effect/tsgo` bumped from 0.53.0 to 0.53.4. Five
patches retained under #1853. Held catalog pins re-checked: no exit was met;
the Biome hold's recorded failure was replaced with the current one. No standards
inventory row was added (S31). The two OSV rows changed in place, and the
Fallow `ignoreDependencyOverrides`/`ignoreDependencies` lists shrank by 18 rows.

Update 2026-10-21: removing the `retired:firecrawl` and `retired:face-detection`
driver packages met three exits recorded below. The `axios` override leaves
with firecrawl. The `onnxruntime-node@1.30.0` override and patch leave
together, with face-detection, in the same PR. Nine overrides and four
patches stay retained.

## Census commands

The lane hook denies shell globs and `$` expansion (D21), so the census ran as
ignored helper scripts under `.beep/residue-hold-exits/`:

- `bun .beep/residue-hold-exits/census.ts > .beep/residue-hold-exits/census.json`
  reads root `overrides`, `resolutions` (absent), `patchedDependencies` and
  `catalog`. For every override it lists the `bun.lock` resolutions, the lockfile
  dependents and their ranges, and the workspace manifests that declare it. It
  computes each dependent's natural resolution: the highest npm version that
  satisfies the range, prereleases excluded. It also fetches npm `dist-tags` for
  the patched and held packages, then runs OSV `querybatch` on every resolved,
  natural and latest version.
- `bun .beep/residue-hold-exits/lock-osv.ts <bun.lock> <out.json>` runs OSV
  `querybatch` over every versioned `bun.lock` package (before and after).
- `bun .beep/residue-hold-exits/lock-diff.ts <before> <after>` diffs resolutions
  key by key.
- Hold sources searched: `package.json`, `syncpack.config.ts` (the "Held back"
  update group and the infra TypeScript 6 version group), `renovate.json` (no
  holds), `osv-scanner.toml`, `.fallowrc.jsonc`, `bunfig.toml`, `SECURITY.md`,
  `.github/workflows/check.yml`, the `patches/` directory and `standards/` (no
  advisory exceptions).

## OSV exceptions (the 2026-10-30 expiry wave)

Each row was due to expire on 2026-10-30. One is resolved; the other two are renewed in place to 2027-01-14.

| Advisory | Package | Decision | Evidence |
| --- | --- | --- | --- |
| GHSA-ch52-4w7c-c8xp (CVE-2026-93748) | `http-cache-semantics` 4.2.0 | **Resolved.** `bun audit fix` moved the lock to 4.3.0, inside `make-fetch-happen@16.0.1`'s `^4.1.1`. That was the only lock change. Both exception rows were removed. | OSV `last_affected` is 4.2.0, and 4.3.0 queries clean. `diff` of the two published `index.js` files: 4.3.0 changes only Vary matching (an own-property check) and adds `status()`. The max-stale path (`satisfiesWithoutRevalidation`, `maxAge()` zeroing) is byte-identical. So the H1 cache-path proof fails on **both** versions: `node .beep/residue-hold-exits/cache-path-proof.cjs <dir>` prints `originHits=1 second=synthetic-response-1` for 4.2.0 and for 4.3.0. The H1 rejection of 4.3.0 was not a regression. Upstream closed kornelski/http-cache-semantics#56 without a code change: the maintainer says RFC 9111 §7.3 allows it and calls the report bogus. The dispute is github/advisory-database#10139. Not exploitable here: `make-fetch-happen` builds `CachePolicy` with `shared: false` (`lib/cache/policy.js:7`), a single-user local npm cache, and its request headers come from trusted tooling. Consumers: `@beep/infra` (Pulumi, arborist, npm-registry-fetch) and `@beep/scratchpad` (`@sigstore/sign`). |
| GHSA-vfj7-8cjw-p6xm (CVE-2026-93687) | `braces` 3.0.3 | **Renewed to 2027-01-14** (89 days). Owner `@beep/storybook`. | npm latest is 3.0.3, inside the range. micromatch/braces#70 is open. Real lock parents (bun.lock): `fast-glob` 3.3.3 only, under `shadcn`, `@shadcn/registry` and shadcn's nested `@ts-morph/common` 0.27.0. `bun audit`'s extra `@beep/box > ts-morph` path is name-based: `@ts-morph/common` 0.29.0 has no fast-glob. The globs are shadcn CLI patterns over local files, never untrusted input. Exit: a fixed braces release passes install and OSV, or the shadcn path is removed. |
| GHSA-hp3w-g68c-fv3c (CVE-2026-97058) | `sprintf-js` 1.0.3 | **Renewed to 2027-01-14.** Owner `@beep/doc-text` (`@beep/repo-docgen` left the list when effected-promotion R5b dropped `@effect/markdown-toc`). | npm latest is 1.1.3, also affected (OSV). alexei/sprintf.js#237 is open. The only parent is `argparse` 1.0.10, under the `mammoth` CLI. The `remarkable` CLI and gray-matter's `js-yaml` 3.15.2 CLI were parents until effected-promotion R5b dropped `@effect/markdown-toc` for `@beep/markdown`, which removed both from `bun.lock`. The advisory needs attacker-controlled format strings. Those templates are package-authored constants, and the library entrypoint never loads argparse. js-yaml 4/5 and sql-formatter use argparse 2, which has no sprintf-js. Exit: a fixed sprintf-js passes consumers and OSV, or every argparse 1 path is removed. |
| GHSA-gcqx-w48m-w2h4 (CVE-2026-93753) | `deepmerge` 4.3.1 | **Added 2026-10-27, until 2027-01-14.** Owner `@beep/storybook`. | Published after the 2026-10-17 recheck; OSV started failing the required Security job on 2026-10-27. Prototype pollution in `mergeObject` (CWE-1321), range 4.2.0-4.3.1, no fixed release: npm latest is 4.3.1 and TehShrike/deepmerge#273 is open. Real lock parents (`bun why deepmerge`): `shadcn` 4.22.1 and `@shadcn/registry` 0.2.0 only; `shadcn` 4.23.0 and `@shadcn/registry` 0.2.1 still require `^4.3.1`, so a bump does not exit. The shadcn CLI merges local `components.json` with registry items from developer-configured registries, only when a developer runs it, and its output is reviewed source. Exit: a fixed deepmerge release passes install and OSV, or the shadcn path is removed. |

**2026-10-27 update.** OSV scanner reported the two advisory-wide
`[[IgnoredVulns]]` mirrors of these exceptions (GHSA-vfj7-8cjw-p6xm,
GHSA-hp3w-g68c-fv3c) as unused: the exact `[[PackageOverrides]]` for
`braces` 3.0.3 and `sprintf-js` 1.0.3 already filter them, and both are still
the only locked resolutions (`bun why braces`, `bun why sprintf-js`). The local
Bun audit wrapper derives the same ids from those exact overrides while every
resolution matches, so the mirrors were removed and the overrides, expiry and
exits above are unchanged.

Fresh scans after the change: OSV scanner v2.3.3 through
`bun run beep ci lane security`: 3,281 packages, no issues, two exceptions
filtered. `bun run repo-sanity:bun-audit`: no vulnerabilities. Raw `bun audit`:
braces and sprintf-js only.

## Overrides removed (exit met)

Every row's exit was "each dependent's own range resolves a fixed or unified
version". `bun install` followed by the lockfile-wide OSV scan found 2,607
versions. The vulnerable set dropped from three packages to the two still excepted (braces and
sprintf-js), since http-cache-semantics resolved to 4.3.0, and no new advisory appeared. Natural resolutions come from `census.json`.

| Override (was) | Purpose | Dependents → natural resolution (OSV) | Lock effect |
| --- | --- | --- | --- |
| `@effect/tsgo-{darwin-arm64,darwin-x64,linux-arm,linux-arm64,linux-x64,win32-arm64,win32-x64}` `catalog:` (7) + 7 catalog entries | Platform binary pins | `@effect/tsgo` declares each binary at its own exact version (0.53.4 → 0.53.4) | none beyond the 0.53.4 bump. The override could only force a mismatched binary when the catalog drifted. tsc-rs ships six platform packages without overrides. |
| `@effect/platform-node` `catalog:` | Effect alignment | 43 workspaces declare it via `catalog:` (4.0.4); the only lockfile dependent is the `@effect/openapi-generator` peer `^4.0.4`, met by that hoisted 4.0.4 | identical resolution (trial diff empty); the patched `-shared` copy stays held below |
| `@grpc/grpc-js` 1.14.5 | floor (GHSA-f596-whhp-79r4, GHSA-m9gg-hp2v-232j) | all `^1.10`–`^1.14.3` → 1.14.6 clean | lock keeps 1.14.5 (clean). The exact pin was holding back 1.14.6. |
| `@hono/node-server` 2.0.11 | floor | MCP SDK `^1.19.9 \|\| ^2.0.5` → 2.1.5 clean | unchanged (2.0.11 clean) |
| `browserslist` `^4.28.7` | floor (#943) | all → 4.29.3 clean | hoisted 4.29.3; babel keeps a nested 4.28.8 (clean) |
| `brace-expansion` `^5.0.12` | floor (#437) | minimatch 10 → 5.0.12; restored minimatch 9/5 → 2.1.7, clean | nested 2.1.7 under wyw-in-js, archiver-utils, readdir-glob |
| `ip-address` 10.7.1 | pin | `^10.1.1`/`^10.2.0` → 10.7.4 clean | unchanged |
| `fast-uri` `^3.1.7` | floor | ajv `^3.0.1` → 3.1.8 clean | unchanged |
| `hono` 4.13.7 | floor | `^4`/`^4.11.4` → 4.13.13 clean | unchanged. The exact pin was holding back fixes. |
| `js-yaml` 5.4.1 | floor (CSF-003) forcing a major | Pulumi/cosmiconfig `^4.1.0` → 4.3.2; gray-matter `^3.10.0` → 3.15.2; both clean | 4.3.2 hoisted, 3.15.2 under gray-matter. This repairs gray-matter, which calls the `safeLoad` that js-yaml 4+ removed (probe parses front matter on 3.15.2). |
| `lodash-es` `^4.18.1` | floor (GHSA-f23m-r3pf-42rh, GHSA-r5fr-rjxr-66jc) | chevrotain consumer gone; dagre-d3-es `^4.17.21` → 4.18.1 clean | unchanged |
| `minimatch` 10.2.6 | exact pin across all parents | glob 10 → 9.0.9, readdir-glob → 5.1.9, others → 10.2.6; all clean | 9.0.9/5.1.9 restored for their declared majors |
| `nanoid` `^3.3.18` | floor forcing 3.x on docx | docx `^6.0.1` → 6.0.2; postcss `^3.3.17` → 3.3.20; clean | docx now gets its declared major 6 |
| `postcss` `^8.5.23` | floor | next pins 8.5.23; others → 8.5.30; all clean | next gets its exact 8.5.23. Nested 8.5.26 copies remain under shadcn and tailwind. |
| `proxy-addr` 2.0.8 | floor (#1435) | express `^2.0.7` → 2.0.8 clean | unchanged |
| `source-map-js` `^1.2.2` | floor (#1435) | all `^1.2.1` → 1.2.2 clean | unchanged |
| `tar` `catalog:` | floor | node-gyp `^7.5.4`, pacote `^7.4.3` → 7.5.22 clean | unchanged. The catalog entry stays for `@beep/repo-cli`. |
| `uuid` `^11.1.1` | floor | comunica/box `^11` → 11.1.1; mermaid → up to 14.0.3; clean | unchanged |

Compatibility proofs for the consumers whose graph changed (all pass):
`package-verify` for `@beep/repo-configs`, `@beep/repo-docgen` (gray-matter
js-yaml 3), `@beep/doc-text` (docx nanoid 6), `@beep/infra` (Pulumi js-yaml 4),
`@beep/ui` (wyw minimatch 9) and `@beep/brand`. Direct suites: `@beep/doc-text`
9/9, `@beep/workspace-server` 28/28 (docx), `@beep/repo-docgen` 107/107.

## Overrides retained

| Override | Held / latest | Consumer | Failure prevented | Owner | Exit |
| --- | --- | --- | --- | --- | --- |
| `@effect/platform-node-shared` `catalog:` | 4.0.4 / 4.0.5 | 9 workspaces; `@effect/platform-bun` and `@effect/platform-node` declare `^4.0.4` | Those ranges would install an unpatched 4.0.5 next to the 4.0.4 copy that `patches/@effect%2Fplatform-node-shared@4.0.4.patch` fixes | #1853 with the Effect ecosystem owner | Effect upgrade with the patch retired or re-keyed (#1853) |
| `@opentelemetry/exporter-trace-otlp-proto` `catalog:` | 0.223.0 / 0.223.0 | `@beep/observability`, `@beep/repo-ai-metrics`; `@arizeai/phoenix-otel` 2.2.0 (via `@arizeai/phoenix-client`) declares `^0.220.0` | Trial removal adds a second OTel exporter/SDK tree (0.220.0 / 2.9.0) under phoenix-otel | `@beep/observability` | phoenix-otel accepts `^0.223` or later |
| `axios` 1.20.0 | 1.20.0 / 1.20.0 | none since 2026-10-21; was `retired:firecrawl` (`firecrawl@4.37.0` pins exact 1.18.0) | 1.18.0 carries 12 GHSAs (GHSA-3pq3-5fj3-cg6v, GHSA-44g4-m2mj-wpvx, ...; full list in `census.json`) | — | **Exit met 2026-10-21:** firecrawl left the tree with `retired:firecrawl`; the override is removed in the same PR |
| `basic-ftp` 6.2.1 | 6.2.1 / 6.2.3 | `@beep/box` (box-node-sdk → proxy-agent → pac-proxy-agent → `get-uri@6.0.5` `^5.0.2`) | 5.3.1: GHSA-c475-qrg2-pj4r | `@beep/box` | get-uri accepts 6.2.1+, or the path is removed |
| `detailed-xml-validator` 2.1.0 | 2.1.0 / 2.2.0 | `@beep/schema`, `@beep/repo-cli` via `fast-xml-validator` 1.2.0 (`^2.1.0`) | 2.2.0 pulls `@nodable/flexible-xml-parser`. At 1.11.3 its module scope still runs `new EncodingRegistry()`, which calls `Buffer.from`, breaking every browser bundle | `@beep/schema` | flexible-xml-parser stops touching `Buffer` at module scope (then remove with the `fast-xml-validator` catalog hold) |
| `katex` `^0.18.2` | 0.18.11 / 0.19.0 | `@beep/editor` (`mermaid@12.1.0` `^0.16.47`) | 0.16.47: GHSA-238p-pmpm-9mq7 | `@beep/editor` | mermaid's katex range reaches a fixed version |
| `next` `catalog:` | 16.5.0-canary.3 / 16.4.2 | `@beep/oip-web`, `@beep/todox`, `@beep/ui`, `@beep/repo-configs`; peers `@serwist/next`, `@vercel/analytics`, `@vercel/speed-insights` | Began as the GHSA-vcvr-r3jv-pc5j floor (#1359). A canary prerelease does not satisfy plain `>=13`/`>=14` peer ranges, so a fresh resolve could add a second stable next. Removal left this lock unchanged only because of lockfile retention, so it is kept. | `@beep/repo-configs` | the catalog returns to a stable next |
| `onnxruntime-node@1.30.0` → `adm-zip: npm:fflate@0.8.3` | — | none since 2026-10-21; was `retired:face-detection` | GHSA-vwc7-r8mq-g2x9 (`patches/onnxruntime-node@1.30.0.md`) | #1853 | **Exit met 2026-10-21:** removed together with the patch below and its record when `retired:face-detection`, the only consumer, left the tree |
| `postcss-selector-parser` `^7.1.6` | 7.1.6 / 7.1.6 | `@beep/ui` (`@tailwindcss/typography@0.5.20` pins 6.0.10) | 6.0.10: GHSA-rj75-hqrm-r3gf | `@beep/ui` | typography depends on 7.1.6+ |
| `protobufjs` `^7.6.6` | 7.6.6 / 8.8.1 | `@beep/scratchpad` (`@xenova/transformers` → onnxruntime-node 1.14 → `onnx-proto@4.0.4` `^6.8.8`) | 6.11.6: 11 GHSAs (GHSA-2pr8-phx7-x9h3, ...) | scratchpad effect-ontology | effect-ontology/`@xenova/transformers` retirement, or onnx-proto moves to 7.x |
| `sharp` `catalog:` | 0.35.5 / 0.35.5 | `@beep/repo-cli`; `@xenova/transformers` `^0.32.0` | 0.32.6: GHSA-f88m-g3jw-g9cj, GHSA-rgj7-g3m4-5g8c, GHSA-wq5f-xc86-pv6w | scratchpad effect-ontology | `@xenova/transformers` path removed |

## Patches (retained; proofs owned by #1853)

Exit conditions come from `goals/repository-simplification-confidence/research/sweeps/2026-10-09/A-patches.md`. #1853 owns the
fail-unpatched/pass-patched proofs and their retirement.

| Patch | Pinned / latest | Failure prevented | Exit |
| --- | --- | --- | --- |
| `effect@4.0.4` | 4.0.4 / 4.0.5 | Bun/JSC error own-keys (`line`, `column`, ...) break `Equal`/`Hash` | an Effect release that strips them, proven by a focused test passing unpatched |
| `@effect/platform-node-shared@4.0.4` | 4.0.4 / 4.0.5 | offset `Uint8Array` views write extra bytes under Bun | upstream passes explicit offsets; `FileSystemWriteCompatibility.test.ts` passes unpatched |
| `drizzle-orm@1.0.0-rc.5-ab785fc` | rc.5-ab785fc / rc tag `1.0.0-rc.4` | `.d.ts` imports of a removed `SqlError` path silently become `any` | a drizzle build that emits `effect/sql/SqlError` |
| `@xstate/effect@0.1.0-alpha.6` | alpha.6 / `1.0.0-alpha.8` | TS4023 on exported machines with `actions` | an alpha that exports the brand or uses a string key, after an exported-machine declaration check passes unpatched |
| `onnxruntime-node@1.30.0` | 1.30.0 / 1.30.0 | adm-zip symlink extraction (with the override above) | **Exit met 2026-10-21:** removed with its override and record when `retired:face-detection` left the tree |

## Held catalog pins (`syncpack.config.ts` "Held back" group)

| Pin | Held / latest | Recheck on 2026-10-17 | Owner | Exit |
| --- | --- | --- | --- | --- |
| `tstyche` 8.0.0-beta.0 | beta.0 / latest 7.2.5, next beta.0 | no stable 8.0 is published | `@beep/effect-drizzle` | stable 8.0 passes the explicit-target matrix |
| `lexical`, `@lexical/*` `^0.50.0` | 0.50.0 / 0.52.0 | the `LexicalExtensionComposer` migration has not landed | `@beep/editor`, `@beep/ui` | migration plus browser QA |
| `jsdom` 30.0.1 | 30.0.1 / 30.1.3 | **Exit not met.** Trial at 30.1.3: suites pass under Node `bunx vitest`, but `package-verify @beep/brand` (package script `bunx --bun vitest`) fails at worker start with `'addEventListener' called on an object that is not a valid instance of EventTarget`. Reverted, and the lockfile restored byte-identical. | `@beep/brand` and the other jsdom suites | vitest or jsdom fixes the `--bun` worker start |
| `fast-xml-validator` 1.2.0 | 1.2.0 / 1.4.2 | 1.4.2 needs `detailed-xml-validator` `^2.2.0` (module-scope `Buffer`, above) | `@beep/schema` | as the `detailed-xml-validator` row |
| `@biomejs/biome` 2.5.6 | 2.5.6 / 2.5.15 | The original failure (stdin JSON formatting) no longer applies: `renderBiomeJson` stages a file and runs `biome format --write`. A new blocker replaces it. Root `biome check .` with 2.5.15 reports 122 errors against 117 on 2.5.6. The new ones are formatting in `@beep/html` (`Html.conformance.ts`, `Html.policy.ts`, `Html.serialize.ts`) and `@beep/provenance` (`VerifiedTextAnchor.ts`), `noDeprecatedImports` in `@beep/repo-cli` `Laws/EffectImports.ts`, and two CSS `noDescendingSpecificity` warnings. | Biome owner with those packages | a format/lint wave on those files lands with the bump |
| `@effect/tsgo` 0.53.4 | 0.53.4 / 0.53.4 | **Bumped** (see below). It stays a reviewed pin because the diagnostics map must move with it. | effect-diagnostics lane owner | tsc-rs ports the newer rules and the standalone diagnostics lane is folded away (toolchain runbook) |
| `tsc-rs` 0.6.0 | 0.6.0 / 0.7.0 | 0.7.0 contains only a README benchmark and a wasm memory fix (pingdotgg/ts-rust v0.7.0), with no newer effect-tsgo rule port | tsc-rs gate owner | tsc-rs ports effect-tsgo 0.52+ rules with parity proved |
| infra `typescript` `^6.0.3` (version group) | 6.0.3 / 7.0.2 | Pulumi's runtime and the ghaRunners SDK build still need the classic API | `@beep/infra` | Pulumi supports the TypeScript 7 API |

## tsgo pins

The obsolete 0.51.1 target refers only to tsc-rs 0.6.0's embedded rule port.
Main already carried `@effect/tsgo` 0.53.0. Latest is 0.53.4 (2026-10-17).
The 0.53.1–0.53.4 changes are patch-only: performance work, related-location
output, deduplicated `effectInFailure`/`anyUnknownInErrorContext`/
`promiseInEffectSuccess` reports, wider `experimentalApiUsage`/`unstableApiUsage`
coverage and TypeScript tag updates. They add no new rules. `@typescript/native-preview`
is not installed. TypeScript stays `^7.0.2` (latest). The bump moved only the
catalog entry, because `@effect/tsgo` pins its binaries exactly.

Proof: `tsc --version` and `tsgo --version` both print
`Version 7.0.2+effect-tsgo.0.53.4`. `bun run beep quality tsgo-rules`: 128
installed rules at error, 5 declared off, 28 options explicit.
`bun run beep quality tsgo-smoke`: `effectFnOpportunity` reported. It first failed
only because `node_modules/.tmp` did not exist; friction is recorded in
`research/OPPORTUNITIES.md`. `bun run beep quality effect-diagnostics --filter repo-cli`:
2 projects, 2,033 file visits, 0 findings. `EffectTsgoEffectFnPolicy.test.ts`
(updated pin assertion) passes 5/5, and `package-verify @beep/repo-configs`
passes. The repo-wide `Heavy / Effect Diagnostics` run is the hosted proof.

## Reversal

`git revert` the PR, then run `bun install`. That restores the 24 overrides, the
seven platform catalog entries, the Fallow rows, `@effect/tsgo` 0.53.0,
`http-cache-semantics` 4.2.0 and the 2026-10-30 exception expiries. Before
2026-10-30, the reverted exceptions would need this register's renewal again.
