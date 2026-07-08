# KN-1a — conflict-free knip burn-down

Lane scope: the conflict-free portion of the knip baseline (`standards/knip.regression-baseline.jsonc`,
73 findings), package by package, sequentially. Skipped all conflicted scopes named in the task
(`apps/professional-desktop`, `drivers/{box,ecfr,govinfo,wink}`,
`capability/{api-transport,langextract,mcp-kit}`, `modeling/html`, `ui-system/form`) — zero edits in
those trees.

## Root-cause diagnosis (per task note #1)

All 26 `unresolved: bun-types` findings share ONE cause: `tsconfig.test.json` across 26 packages
declares `"types": ["node", "bun-types"]`, but only 5 packages (`acp`, `venice-ai`, `xai`, `anthropic`,
`pacer`) actually list `"bun-types": "catalog:"` in `devDependencies`. TypeScript itself resolves fine
(bun-types is hoisted at repo root), so this never broke builds — it's purely a per-package manifest
gap. Fix: add the missing devDependency (matching the existing `catalog:` convention), verified via
`bun run knip --workspace <pkg>` — **no `bun install` needed** (confirmed: TS resolution and knip's
check are independent of a fresh install once the manifest line exists). Fixed on my 11 in-scope driver
packages + 5 foundation packages + ai-sync (17 total). The other 9 occurrences live in conflicted
scopes (`box`, `ecfr`, `govinfo`, `wink`, `api-transport`, `langextract`, `mcp-kit`, `html`, `form`) —
untouched; their owning lanes need the identical one-line fix.

`anthropic` had the mirror case (`bun-types` devDependency present but package has no
`tsconfig.test.json` at all and no Bun-specific usage) — removed as genuinely unused.

## Disposition table

| Kind | File | Name | Disposition | Evidence |
|---|---|---|---|---|
| unresolved | packages/drivers/{courtlistener,dol,federal-register,firecrawl,libpff,m365-mcp,m365,nlp-mcp,tika,uspto-mcp,uspto}/tsconfig.test.json | bun-types | **fixed** | added `"bun-types": "catalog:"` devDependency (11 files); `knip --workspace` clean each |
| unresolved | packages/foundation/{capability/file-processing,modeling/lexical,modeling/ontology,modeling/pandoc-ast,ui-system/editor}/tsconfig.test.json | bun-types | **fixed** | same fix (5 files) |
| unresolved | packages/tooling/library/ai-sync/tsconfig.test.json | bun-types | **fixed** | same fix |
| devDependencies | packages/drivers/anthropic/package.json | bun-types | **fixed** | removed; no tsconfig.test.json, no Bun-specific usage anywhere in package |
| devDependencies | packages/drivers/m365/package.json | @microsoft/microsoft-graph-types | **fixed (detector-scope)** | genuinely used, but only by `dtslint/M365.tst.ts`; dtslint is knip-ignored (`**/dtslint/**`), so it read as unused. Added to `knip.jsonc` `ignoreDependencies` with rationale comment. `type-test` is a real, wired turbo task — not dead. |
| devDependencies | packages/foundation/modeling/lexical/package.json | @lexical/code, @lexical/link, @lexical/list, @lexical/rich-text, lexical | **fixed (detector-scope)** | same dtslint-blind-spot pattern (`dtslint/Lexical.tst.ts`); all other mentions in `src/*.ts`/`test/*.ts` are prose in JSDoc/comments, not real imports (confirmed via grep). Added to `ignoreDependencies`. |
| devDependencies | packages/foundation/modeling/ontology/package.json | @types/n3 | **fixed** | removed; zero usage anywhere (no `n3`/N3 reference in src, test, or dtslint) |
| binaries | package.json (root) | oxlint | **fixed** | root's own `lint:oxlint` script invokes the binary but the root manifest only had it in the version `catalog`, never as an actual devDependency. Added `"oxlint": "catalog:"` to root devDependencies. |
| binaries | package.json (root) | readlink | **fixed (detector-scope)** | POSIX/coreutils system binary (root `instructions:drift` script: `$(readlink CLAUDE.md)`), never an npm-installable dependency — added to `ignoreBinaries` (same category as existing `op`/`beep-cli`/`portless` entries). |
| devDependencies | package.json (root) | @effect/platform-bun, @types/geojson, @typescript-eslint/eslint-plugin, madge | **fixed** | @types/geojson: zero real usage anywhere (only a `geo+json` mime-string coincidence, no `@types/geojson` import). The other three are redundant root-level copies — each already declared as its own devDependency by the actual consumer (`apps/professional-desktop` for @effect/platform-bun, `packages/tooling/policy-pack/repo-configs` for @typescript-eslint/eslint-plugin, `packages/tooling/tool/cli` for madge); root itself never references them. Removed from root only. |
| files/exports/dependencies | apps/oip-web (serwist dep, sw.ts, MattersCarousel.tsx, OipContactHttpApiGroup export) | — | **fixed** | see below |
| exports | apps/oip-web/src/content/OipContent.model.ts | ReviewGate, ExternalLink, SiteAsset, HeroClip, HeroContent, ContactContent | **must-keep (driver-challenge requested)** | see below — NOT deleted |
| dependencies/files | apps/storybook (6 findings) | — | **fixed**, config-only | see below |
| files | packages/architecture-lab/{server,tables,use-cases}/src/entities/index.ts | — | **fixed** | deleted; confirmed dead in all three — each package's public `exports` map and top-level `src/index.ts` reach directly into `./entities/Worker/index.js`, bypassing this barrel entirely; no importer anywhere |
| files | explorations/identity-as-iri/... (10 files) | — | **fixed (detector-scope)** | per task note: checked scope config first. Not a workspace member (absent from root `package.json` workspaces array); the only exploration dir with any `.ts` files; nothing outside `explorations/`/docs references it. Added `explorations/**` to `knip.jsonc` `ignore`, mirroring the existing `goals/**`/`scratchpad/**` entries (same fuzzy-front-end category per `explorations/CLAUDE.md`). |
| devDependencies | packages/tooling/policy-pack/lint-rules/package.json | oxlint | **fixed (detector-scope)** | genuinely used — `test/oxlint-harness.ts` spawns it via `Bun.spawnSync(["bunx","oxlint",...])`, a subprocess call knip can't trace. Added to `ignoreDependencies` (same category as the existing `tsgo` entry). |
| exports | packages/tooling/policy-pack/lint-rules/src/rules/utils.ts | asExpression | **fixed** | deleted (function + JSDoc); zero usage anywhere, including internally |
| types | packages/tooling/policy-pack/lint-rules/test/oxlint-sources.ts | OxlintCase | **fixed** | removed `export` keyword; used only internally in the same file, no external importer |

### apps/oip-web detail (10 findings)

- `dependencies: serwist` + `files: src/app/sw.ts` — same root cause: `sw.ts` is the real PWA service
  worker (compiled by `@serwist/webpack-plugin`, imports `Serwist` from `serwist`), deliberately
  excluded from the app's tsgo project (WebWorker lib conflicts with DOM lib) and not reachable via
  the Next.js App Router conventions knip's plugin auto-detects. **Fixed (detector-scope):** registered
  `src/app/sw.ts` as an explicit `entry` for the `apps/oip-web` workspace in `knip.jsonc`.
- `files: src/components/MattersCarousel.tsx` — genuinely unmounted (commented out in
  `OipHomePage.tsx`), but the file's own header doc says "Temporarily unmounted ... retained for
  re-enable" and it already carries a `// fallow-ignore-file unused-file` pragma (an existing
  intentional-retention marker for the sibling dead-code tool). **Fixed (detector-scope):** registered
  as an explicit `entry` alongside `sw.ts`, not deleted — this is a "must-keep," not dead code.
- `exports: OipContactHttpApiGroup` (contact/ContactSubmission.http.ts) — zero external consumers
  (only used internally to build the exported `OipHttpApi`, which IS consumed by
  `app/api/contact/ContactHttpApiRoute.ts`). **Fixed:** dropped the `export` keyword and rewrote its
  JSDoc `@example` to a real, compiling alternative (`OipHttpApi.groups.contact.identifier`, verified
  against `.repos/effect-v4/.../HttpApi.ts` — `groups` is a real field keyed by group identifier).
- `exports: ReviewGate, ExternalLink, SiteAsset, HeroClip, HeroContent, ContactContent`
  (content/OipContent.model.ts) — **NOT fixed, flagged must-keep.** These are `S.Class` schema field
  types with zero external importers (confirmed repo-wide), BUT each is also the exact importable name
  used inside OTHER, non-flagged classes' own compiling `@example` blocks in the same file (e.g.
  `PracticeArea`'s example imports `ExternalLink, MatterItem, ReviewGate, SiteAsset` to construct an
  instance; `AboutPanel`, `PressItem`, `ClientLogo` similarly depend on these names being exported).
  Un-exporting any of the 6 would break several sibling classes' real, currently-compiling
  documentation examples elsewhere in the same file. This needs a driver call (delete the dependent
  examples too, rewrite them, or accept the exports) rather than a lane-level force-fix.

### apps/storybook detail (6 findings, config-only — no storybook source touched)

Same "config-driven reference knip can't trace" family as oip-web:

- `.storybook/utils-browser.ts` (unused file) + `effect` (unused dep) — `utils-browser.ts` is
  referenced only via a Vite `resolve.alias` path string in `vitest.storybook.config.ts`, and it
  re-exports from `effect/Function`. Registered as an explicit workspace `entry`.
- `vitest.storybook.config.ts` (unused file) — invoked via `vitest run --config
  vitest.storybook.config.ts` from `scripts/run-storybook-tests.mjs` (a CLI flag knip can't trace).
  Registered as an explicit entry.
- `vitest.storybook.setup.ts` (unused file) — referenced only via `setupFiles` inside
  `vitest.storybook.config.ts` (string path, not an import). Registered as an explicit entry.
- `@beep/form` (unused dep) — genuinely needed: `main.ts`'s `stories` glob pulls in
  `packages/foundation/ui-system/form/stories/**`, which import `@beep/form` directly — a sibling
  workspace's files, invisible to knip's per-workspace scan of `apps/storybook`. Added to
  `ignoreDependencies`.
- `emojibase-data` (unused dep) — referenced by path string in `.storybook/main.ts`'s `staticDirs`,
  not a static import. Added to `ignoreDependencies`.

## Detector-scope changes (all in `knip.jsonc`, all explained above and here again per fence 11 note)

`knip.jsonc` is a third-party tool config, not the custom detector code in
`packages/tooling/tool/cli/**`/`repo-utils/TSMorph/**` that fence 11's regression-fixture-pair rule
targets — no code detector was touched. Changes made (all additive, all with inline rationale
comments in the file itself):
1. `workspaces["apps/oip-web"].entry` — `sw.ts`, `MattersCarousel.tsx`.
2. `workspaces["apps/storybook"].entry` — `vitest.storybook.config.ts`, `vitest.storybook.setup.ts`,
   `.storybook/utils-browser.ts`.
3. `ignore`: added `explorations/**`.
4. `ignoreDependencies`: added `@microsoft/microsoft-graph-types`, `@lexical/code`, `@lexical/link`,
   `@lexical/list`, `@lexical/rich-text`, `lexical`, `@beep/form`, `emojibase-data`, `oxlint`.
5. `ignoreBinaries`: added `readlink`.

`standards/knip.regression-baseline.jsonc` was **not** touched (driver-owned, per instructions).

## Files touched (26)

- `knip.jsonc`, `package.json` (root)
- `packages/drivers/{anthropic,courtlistener,dol,federal-register,firecrawl,libpff,m365-mcp,m365,nlp-mcp,tika,uspto-mcp,uspto}/package.json`
- `packages/foundation/capability/file-processing/package.json`
- `packages/foundation/modeling/{lexical,ontology,pandoc-ast}/package.json`
- `packages/foundation/ui-system/editor/package.json`
- `packages/tooling/library/ai-sync/package.json`
- `packages/architecture-lab/{server,tables,use-cases}/src/entities/index.ts` (deleted)
- `packages/tooling/policy-pack/lint-rules/src/rules/utils.ts`
- `packages/tooling/policy-pack/lint-rules/test/oxlint-sources.ts`
- `apps/oip-web/src/contact/ContactSubmission.http.ts`

No commits made. The working tree also carries substantial concurrent changes from other lanes
(e.g. `govinfo`, `mcp-kit`, `html`, `semantic-web`, `observability`, CLI `src/commands/**`,
`apps/professional-desktop/scripts/build-sidecar.ts`) — none of those are mine; listed here only so
the driver doesn't misattribute them during closeout.

## Verification

- Per-package `turbo run build check test --filter=<pkg>` green for all 18 touched
  packages-with-manifest-changes (drivers ×12, foundation ×5, ai-sync) plus the 3 architecture-lab
  packages and `@beep/lint-rules` — all passed. (One unrelated pre-existing issue found and fixed in
  passing: `@beep/drizzle`'s composite build output was stale/missing `dist/index.d.ts`, unconnected
  to anything in this lane's diff; a `--force` rebuild resolved it and `architecture-lab-tables#check`
  passed clean afterward.)
- `apps/oip-web`: full `turbo run build check test --filter=@beep/oip-web` green (27/27 tasks,
  including a real Next.js production build).
- Final read-only `bun run knip --reporter json` (whole repo): **16 findings remain**, down from the
  73-item baseline. All 16 are accounted for: 9 `unresolved: bun-types` + 1 `binaries: rustc` belong
  to the 10 conflicted scopes this lane explicitly skipped (their owning lanes need the identical
  bun-types fix documented above), and the remaining 6 are the `OipContent.model.ts` must-keep
  exports flagged for driver challenge. Every other finding in this lane's conflict-free assignment
  (~63 of the 73) is resolved.

## Addendum — driver ruling on the OipContent.model.ts must-keep (2026-07-08)

Driver verified the flag and ruled: fix `ReviewGate` for real first (a genuine local-duplicate shape
existed), then check the other five for the same pattern, then scope-ignore whatever's left.

- **`ReviewGate` — real fix, not an ignore.** `apps/oip-web/src/content/OipContent.data.ts` had a
  hand-rolled `ReviewGateInput` type (`{ note: string; status: ReviewStatusType }`) duplicating
  `ReviewGate`'s exact shape, used only because the `needsReview`/`approved` helpers needed a return
  type and nobody had wired them to the real class. Replaced: import `ReviewGate` from
  `OipContent.model.ts`, retyped both helpers to return `typeof ReviewGate.Encoded` (the raw content
  literal is checked via `satisfies typeof OipSiteContent.Encoded`, so the encoded form — not a
  constructed instance — is correct here; confirmed real by cross-referencing
  `.repos/effect-v4/.../HttpApi.ts`-style `S.Class` Encoded/Type statics). `knip --workspace
  apps/oip-web` confirms `ReviewGate` no longer appears in `exports` findings.
- **The other five (ExternalLink, SiteAsset, HeroClip, HeroContent, ContactContent) — no equivalent
  duplicate-shape found.** Searched all of `apps/oip-web/src` (components, app routes, contact
  service) for any hand-rolled local type mirroring these five classes' fields: none exist.
  `OipHomePage.tsx`'s section components (`Hero`, `Contact`, `Nav`, `About`, `Practice`, `Footer`)
  all take the full `content: OipSiteContent` prop and access `.hero`/`.contact`/etc. structurally —
  the same convention already used for the non-flagged `SocialLink`/`SocialPlatform`
  (`OipSiteContent["socials"]` indexed access) — so there's no real cross-file import to wire for
  these five; they're genuinely reachable only through the composite `OipSiteContent` schema and each
  other's `@example` blocks, both internal to the same file.
- **Scoped fix, not a blanket rule.** Added `"ignoreExportsUsedInFile": true` to the
  `apps/oip-web` workspace entry in `knip.jsonc` (with an inline rationale comment naming all five
  symbols and the composition/example evidence) instead of a bare file-glob `ignore`. This knip option
  relaxes exactly one check — an export used elsewhere in its own file no longer counts as "unused" —
  so it only affects these five (and any future same-file-only-used export in this one workspace); it
  does not blanket-suppress unrelated files/deps/binaries findings the way adding
  `OipContent.model.ts` to a path-glob `ignore` would have. `knip --workspace apps/oip-web` now
  returns zero issues.

### Verification

- `turbo run test --filter=@beep/oip-web`: 48/48 tests pass, including
  `derives valid OIP content and contact form values from production schemas`, which exercises the
  real `decodeOipSiteContentResult`/`oipSiteContent` decode path using the updated
  `needsReview`/`approved` helpers.
- `turbo run build check test docgen --filter=@beep/oip-web`: **could not complete `check` end-to-end**
  — blocked by unrelated, currently in-progress concurrent work in `@beep/schema` (a transitive
  dependency): `src/BufferEncoding.ts(78,30)` and `src/Timestamp/Timestamp.schema.ts(160,27)` both
  fail the `effect(unnecessaryTypeofType)` lint rule right now (this is literally P7 effect-laws
  allowlist-challenge work landing live on the shared branch — confirmed transient: an unrelated
  scratch file in `@beep/identity` that caused an earlier failed attempt had already vanished by the
  next retry). `build`, `test`, and `docgen` all ran fine for every package in the chain including
  `@beep/schema` itself; only `@beep/schema:check` (a lint-rule check, not a compile) fails, and it is
  not something this lane touched or is scoped to fix. In place of the blocked aggregate check, ran
  `tsgo --noEmit -p apps/oip-web/tsconfig.json` directly (bypasses composite `-b` rebuild of upstream
  project references, uses `@beep/schema`'s already-built `dist/*.d.ts`) — **clean, zero errors** —
  confirming both edited files type-check correctly. Recommend the driver re-run the full
  `build check test docgen` once `@beep/schema`'s lane lands.
- Final read-only `bun run knip --reporter json`: **11 findings** (down from 16). Expected 10 (16 − 6
  fixed here); the 11th is `files: __scratch_probe_objectassign.ts` at repo root, a transient file
  that appeared during this verification pass from unrelated concurrent lane activity (same pattern as
  the `@beep/identity` scratch file above) — not authored by this lane, likely to disappear on the
  next run. The remaining 10 are exactly the conflicted-scope findings (9 bun-types + 1 rustc)
  documented above; the `OipContent.model.ts` must-keep case is now fully resolved, zero exceptions
  left in this lane's assignment.

**Re-verification (same session, ~10 min later, re-run after the driver's second message):** re-ran
`turbo run build check test docgen --filter=@beep/oip-web`, `tsgo --noEmit -p apps/oip-web/tsconfig.json`,
`git diff --stat -- apps/oip-web/ knip.jsonc`, and the full-repo knip check — all results unchanged
and stable: `@beep/schema:check` still fails on the same two pre-existing `unnecessaryTypeofType`
diagnostics (confirmed genuinely unrelated: `git diff --stat` shows 61 files changed under
`packages/foundation/modeling/schema/` that this lane never touched — active P4 schema-first-wave
work, not P6 knip); `tsgo --noEmit` for oip-web is still clean; full-repo knip is still 11 (same 10
conflicted-scope findings + the same still-present `__scratch_probe_objectassign.ts`, confirmed
untracked (`git status --short` → `??`), not authored by this lane. `git diff --stat` for this lane's
oip-web + knip.jsonc changes:

```
 apps/oip-web/src/contact/ContactSubmission.http.ts |  8 ++--
 apps/oip-web/src/content/OipContent.data.ts        | 13 ++---
 knip.jsonc                                         | 56 +++++++++++++++++++++-
 3 files changed, 62 insertions(+), 15 deletions(-)
```

No commits made.
