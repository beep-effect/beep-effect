# Lane 3 (rerun): existing apps anatomy → nextjs / vite / service / tauri variant requirements

**Locked constraints this lane treats as fixed** (from the SPEC.md Decision Log (D1–D14)):

- Root is `apps/labs/*` (zero-root-churn glob).
- v1 variants: **nextjs + vite + service**. Service = pure Effect server on `effect/unstable/httpapi`.
- Tauri is **phase 2** on the same abstraction.
- Portless namespace: `<name>.labs.beep.localhost`.
- Per-lab Postgres schema, dropped on delete.
- Code laws full; ceremony exempt by construction (docgen, coverage ratchet, changesets, storybook).
- Each lab carries a schema-validated manifest (purpose, created date, disposition).

**This report answers:** what create-package already emits, how existing `apps/*` are actually wired, and the minimal file lists each v1 variant must emit.

---

## 1. create-package templates inventory

**Source of truth:** `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts` + `templates/*.hbs` (35 Handlebars files).

### 1.1 Kinds that exist TODAY

`VALID_APP_KINDS = ["nextjs", "tauri", "runtime-proof"]` (`CreatePackage.command.ts:120`). `--type app` requires `--app-kind`. There is **no `vite` kind** and **no `service` kind**.

| Kind | Path default | Template set | Real app? |
| --- | --- | --- | --- |
| `library` / `tool` (not `--type app`) | `packages/tooling/{library,tool}/<name>` | package templates | no |
| `--type app --app-kind nextjs` | `apps/<name>` | `NEXTJS_APP_TEMPLATE_SPECS` | yes |
| `--type app --app-kind tauri` | `apps/<name>` | `TAURI_APP_TEMPLATE_SPECS` | yes |
| `--type app --app-kind runtime-proof` | `apps/<name>` | package templates (library-shaped) | **no** — package-like proof harness |

`--parent-dir` is legal for apps (family is not). `apps/labs` / `apps/experiments` would both parse as `ParentDir` (`CreatePackage.command.ts:125`, `327-333`). Untested for labs; the default is still `apps` (`1117-1133`).

### 1.2 Next.js template — file manifest

Directories (`597`): `src`, `src/app`, `test`.

Emitted files (`NEXTJS_APP_FILES`, `533-547`):

| Output | Template |
| --- | --- |
| `package.json` | **generated**, not Handlebars (`1461-1500`) |
| `tsconfig.json` | `app-next-tsconfig.json.hbs` |
| `next-env.d.ts` | `app-next-next-env.d.ts.hbs` |
| `next.config.ts` | `app-next-next.config.ts.hbs` |
| `src/app/globals.css` | `app-next-src-app-globals.css.hbs` |
| `src/app/layout.tsx` | `app-next-src-app-layout.tsx.hbs` |
| `src/app/page.tsx` | `app-next-src-app-page.tsx.hbs` |
| `test/app.test.tsx` | `app-next-test-app.test.tsx.hbs` |
| `LICENSE` | `LICENSE.hbs` |
| `README.md` | `app-real-README.md.hbs` |
| `AGENTS.md` | `app-real-AGENTS.md.hbs` |
| `CLAUDE.md` | symlink → `AGENTS.md` |
| `vitest.config.ts` | `app-next-vitest.config.ts.hbs` |

**Not emitted (present on live `oip-web`):** `postcss.config.mjs`, Tailwind, `@beep/ui`, atom runtime, `tsconfig.next.json`, `vercel.json`, `components.json`, PWA/serwist, env/secret wiring, lab manifest, identity ids, postgres schema, `src/runtime/`.

**`package.json` scripts** (`1464-1480`):

```
dev:        portless ${name}.beep next dev --turbopack
beep:build: next build --turbopack
start:      next start
beep:check: tsgo -b tsconfig.json
beep:lint:  biome check .
beep:test:  bunx --bun vitest run
```

Deps: `next`, `react`, `react-dom` from catalog. Dev: `@effect/vitest`, testing-library, jsdom, typescript. **No `@beep/*` workspace deps.** No `exports` / `files` / `publishConfig` / `docgen`.

**Completeness vs a working Next app:**

- Layout/page is a title-only stub (`app-next-src-app-layout.tsx.hbs`, `app-next-src-app-page.tsx.hbs`).
- `next.config.ts` is an empty `NextConfig` (`app-next-next.config.ts.hbs:1-5`).
- tsconfig extends `{{rootRelative}}tsconfig.base.json`, local `@/*` → `./src/*`, Next plugin, includes vitest.shared (`app-next-tsconfig.json.hbs`).
- Portless hostname is **`${name}.beep`**, not the locked **`${name}.labs.beep`**.
- No lab manifest. No ceremony files (docgen is correctly omitted for real apps).

This is a **working Next App Router skeleton** that typechecks/tests and obeys portless wrapping — it is **not** an oip-web-equivalent product app and **not** labs-ready.

### 1.3 Tauri template — file manifest

Directories (`598`): `src`, `test`, `src-tauri`, `src-tauri/capabilities`, `src-tauri/src`.

Emitted files (`TAURI_APP_FILES`, `549-568`):

| Output | Template |
| --- | --- |
| `package.json` | generated (`1503-1545`) |
| `tsconfig.json` | `app-tauri-tsconfig.json.hbs` |
| `index.html` | `app-tauri-index.html.hbs` |
| `src/App.tsx` | `app-tauri-src-App.tsx.hbs` |
| `src/main.tsx` | `app-tauri-src-main.tsx.hbs` |
| `test/App.test.tsx` | `app-tauri-test-App.test.tsx.hbs` |
| `vite.config.ts` | `app-tauri-vite.config.ts.hbs` |
| `vitest.config.ts` | `app-tauri-vitest.config.ts.hbs` |
| `src-tauri/Cargo.toml` | `app-tauri-src-tauri-Cargo.toml.hbs` |
| `src-tauri/build.rs` | `app-tauri-src-tauri-build.rs.hbs` |
| `src-tauri/tauri.conf.json` | `app-tauri-src-tauri-tauri.conf.json.hbs` |
| `src-tauri/capabilities/default.json` | `app-tauri-src-tauri-capabilities-default.json.hbs` |
| `src-tauri/src/main.rs` | `app-tauri-src-tauri-src-main.rs.hbs` |
| `src-tauri/src/lib.rs` | `app-tauri-src-tauri-src-lib.rs.hbs` |
| `LICENSE` / `README.md` / `AGENTS.md` / `CLAUDE.md` | shared real-app templates |

**`package.json` scripts** (`1506-1522`):

```
dev:        portless ${name}.beep sh -c 'vite --host 127.0.0.1 --port "${PORT:-1420}" --strictPort'
dev:tauri:  tauri dev
beep:build: vite build
```

Deps: `@tauri-apps/api`, react, react-dom. Dev: `@tauri-apps/cli`, `@vitejs/plugin-react`, vite, testing-library. **No `@beep/*`.**

**Tauri config already understands portless** (`app-tauri-src-tauri-tauri.conf.json.hbs:7-8, 22`):

- `beforeDevCommand`: `bun run dev`
- `devUrl`: `http://{{kebabCase name}}.beep.localhost:1355`
- `devCsp` allows `ws://` + `http://` to that host
- `identifier`: `dev.beep.{{kebabCase name}}`

**Not emitted vs live `professional-desktop`:** `src-tauri/icons/`, Cargo.lock, sidecar/server, postcss/tailwind, `@beep/*` slice stack, `tsconfig.check.json`, `turbo.json`, rust web-extension, migration-bundle scripts, rust CI.

The Tauri template is a **real, compile-shaped scaffold** (Rust crate + Vite React + portless webview URL). It is **not** a professional-desktop clone and is **phase 2** for labs.

### 1.4 Runtime-proof / package templates (used by architecture-lab-proof shape)

`runtime-proof` falls through to `PACKAGE_TEMPLATE_SPECS` (`493-507`): `tsconfig.json`, `tsconfig.test.json`, `src/index.ts`, LICENSE, README, AGENTS, `docgen.json`, `vitest.config.ts`, `docs/index.md`, plus generated `package.json` with exports + docgen script. `test/.gitkeep` is emitted (`619-622`).

This is **architecture-lab-proof's cousin** (package-as-app), not a user-facing lab.

### 1.5 Gaps vs locked v1 variants

| Locked v1 variant | Exists today? | Gap |
| --- | --- | --- |
| **nextjs** | yes, as `--app-kind nextjs` | Parent defaults to `apps/` not `apps/labs/`; portless `*.beep` not `*.labs.beep`; no lab manifest; no `@beep/ui`/tailwind/postcss; no identity labs namespace; no per-lab postgres; no env/secret pattern |
| **vite** | **no standalone kind** | Closest is Tauri's Vite shell (`app-tauri-vite.config.ts.hbs` + `dev` script). Need a new kind that emits Vite+React **without** `src-tauri` |
| **service** | **no kind** | No httpapi template anywhere. Closest live analog is `professional-desktop/server/` (RPC sidecar) and slice `*-server` packages — neither is a standalone Effect httpapi app |
| **tauri (P3)** | yes, as `--app-kind tauri` | Rename namespace; rust/CI spike; do not treat as v1 |

### 1.6 TsconfigSync — what it syncs (zero-root-churn holdout)

Command: `beep tsconfig-sync` (`TsconfigSync.command.ts:49-99`). Create-package **already calls** `syncTsconfigAtRoot` after execute (`CreatePackage.command.ts:1307-1311` per lane-1 report).

`syncTsconfigAtRoot` (`TsconfigSync.service.ts:99-131`) plans **five surfaces**:

1. **Root project references** → `tsconfig.packages.json` (`planRootReferenceSync`, `TsconfigSync.plan.ts:447-475`). Every workspace with `hasProjectTsconfig` is listed. **This is the suspected zero-root-churn holdout:** creating/deleting a lab rewrites a root file unless `apps/labs/*` can be excluded or globbed.
2. **Root path aliases** → `tsconfig.json` `compilerOptions.paths` (`planRootAliasSync`, `606-662`). Only workspaces that are `@beep/*` **and** have a `rootAliasTarget` (i.e. package exports). Real apps (nextjs/tauri) have **no exports**, so they should **not** get root aliases — create-package comments and lane 1 confirm this.
3. **Root syncpack sources** → `planRootSyncpackSync` (`667+`).
4. **Per-package tsconfig references** → `planPackageReferenceSync` (workspace dep graph).
5. **Per-package `docgen.json`** → `planPackageDocgenSync`. Real apps omit docgen files.

**Implication for labs:** if a lab is a workspace package with a project tsconfig, TsconfigSync will add it to `tsconfig.packages.json` on every create and remove it on delete-sync. P1 must decide: (a) labs participate in root refs (create/delete still churn that one file), (b) labs are excluded from `hasProjectTsconfig` / a path filter, or (c) `tsconfig.packages.json` grows a glob (TypeScript project references do **not** support globs — this is why it's the holdout). Option (a) is **not** zero-root-churn. Options (b)/(c) need a schema in RegistrationSurface.

### 1.7 Portless generator / wrapper

There is **no repo-authored portless code generator**. Portless is the **`portless` CLI** wrapping each app's `dev` script:

- Next template: `portless ${name}.beep next dev --turbopack` (`CreatePackage.command.ts:1467`)
- Tauri template: `portless ${name}.beep sh -c 'vite --host 127.0.0.1 --port "${PORT:-1420}" --strictPort'` (`1509`)
- Live oip-web: `NEXT_DISABLE_PWA=1 portless oip-web.beep next dev --turbopack` (`apps/oip-web/package.json:17`)
- Live professional-desktop: `portless professional-desktop.beep sh -c 'vite --host 127.0.0.1 --port "${PORT:-1421}" --strictPort'` (`apps/professional-desktop/package.json:18`)
- Live storybook: `portless storybook.beep sh -c 'storybook dev -p "${PORT:-6006}"'` (`apps/storybook/package.json:27`)

QA helper: `portlessUrlForApp` → `http://${app}.beep.localhost:${PORTLESS_PORT}` with `PORTLESS_PORT = 1355` (`Qa.session.ts:29`, `81`). **No `labs` segment today.** Labs need either:

- `portless ${name}.labs.beep …` (hostname `<name>.labs.beep.localhost`), **or**
- a portless config map if the CLI only accepts a single label segment.

The Vite comment in the Tauri template (`app-tauri-vite.config.ts.hbs:14-17`) documents the contract: portless assigns `PORT`; `--strictPort` + `PORT:-1420` keeps `PORTLESS=0` diagnostic bypass usable.

**Portless lives as a workspace/devDependency binary**, not a Handlebars generator. Search for a generator that writes Caddy/nginx/portless JSON config: the *script string* in `generatePackageJson` **is** the generator. No separate `portless.json` is emitted.

---

## 2. Per existing app anatomy

Root `package.json` workspaces lists **each app as an explicit path**, not `apps/*` (`package.json:450-452`, `500-501`):

```
apps/oip-web
apps/professional-desktop
apps/storybook
apps/architecture-lab-proof
apps/practice-kg-mcp
```

`tsconfig.packages.json` mirrors that with five explicit `{ "path": "apps/…" }` entries (`:10-22`). Create-package's `ensureRootWorkspaceEntry` **skips** the root write when a glob already covers the path (`CreatePackage.command.ts:833-834`). A one-time `apps/labs/*` workspace glob therefore stops **workspace-list** churn. It does **not** stop `tsconfig.packages.json` churn — TypeScript project references have no glob (`TsconfigSync.plan.ts:447-475`, `hasProjectTsconfig` is "has a `tsconfig.json`", `:294`).

Identity today is a **flat** `$I.compose("oip-web", "professional-desktop", …)` list (`packages.ts:48-183`). Every existing app including scratchpad has a composer (`$OipWebId`, `$ProfessionalDesktopId`, `$StorybookId`, `$ArchitectureLabProofId`, `$PracticeKgMcpId`, `$ScratchpadId`). Create-package always registers the **unscoped name** (`ensureIdentityPackageRegistration(…, name)` at `CreatePackage.command.ts:1306`). Locked labs namespace requires a **new segment** (e.g. compose `"labs"` then `"<name>"`, or a single `"labs/<name>"` if the composer API allows `/`). Current registration cannot prune "exactly that segment's ids" without that change.

Coverage ratchet includes `@beep/architecture-lab-proof`, `@beep/oip-web`, `@beep/professional-desktop` only (`standards/coverage.regression-baseline.jsonc:181`, `:974`, `:1208`). Storybook and practice-kg-mcp are absent. Labs must be path-scoped **out** of this file (locked ceremony exemption).

CI: `.github/workflows/check.yml` verify matrix is repo-wide turbo (`lint`, `check`, `test-unit`, `test-integration`, `coverage`, `docgen`, … `:57-117`). `apps/` in the changed-file regex is a **docgen lane gate**, not an app allowlist (`:165`). Extra jobs: `professional-desktop-ipc-stdio` (path-filtered, rust cache `apps/professional-desktop/src-tauri`, `:266-311`); `storybook.yml`; `release-desktop.yml` (tag `professional-desktop-v*`, rust + sidecar + tauri-action). Labs must not inherit those extra jobs.

### 2.1 `apps/oip-web` — Next.js canary product app

| Surface | Live fact |
| --- | --- |
| Framework | Next App Router (`src/app/`). Catalog `next`. PWA via serwist; default `dev`/`beep:build` set `NEXT_DISABLE_PWA=1` (`package.json:17-20`). |
| Portless | `NEXT_DISABLE_PWA=1 portless oip-web.beep next dev --turbopack` (`package.json:17`). README URL: `http://oip-web.beep.localhost:1355` (`README.md:24-25`). `PORTLESS=0` is documented diagnostic-only (`README.md:12-13`). |
| Scripts | Standard `beep:{audit,build,check,lint,test}` + aliases. `start` = `next start`. Extra `build:pwa`. |
| tsconfig | Extends `../../tsconfig.base.json` (`tsconfig.json:3`). Include: `next-env.d.ts`, `src`, `test`, `.next/types`, `next.config.ts`. Local `@/*` plus **hard-coded** `@beep/ui` / `@beep/ui/*` paths (`:30-33`). Project `references` to hubspot, sanity, identity, schema, utils, ui, repo-utils, repo-configs, test-utils (`:38-66`). Sibling `tsconfig.next.json` only sets `"composite": false` (`tsconfig.next.json:4-6`) — required because `defineBeepNextConfig` sets `typescript.tsconfigPath: "tsconfig.next.json"` (`SharedNextConfig.model.ts:478-480`). |
| next.config | **Not** the empty template. Uses `defineBeepNextConfig` from `@beep/repo-configs/next` (`next.config.ts:2,43-47`) with `allowedDevOrigins: ["oip-web.beep.localhost", …]`, extra transpile `@beep/hubspot`/`@beep/sanity`, security headers, webpack `node:` stub for PWA. Default transpile already includes `@beep/ui`, `@beep/identity`, `@beep/schema`, `@beep/utils` (`SharedNextConfig.model.ts:35`). |
| CSS | `postcss.config.mjs` re-exports `@beep/ui/postcss.config` (`:1`). `globals.css` starts `@import "@beep/ui/styles/globals.css"` (`src/app/globals.css:1`). |
| Env/secrets | Effect `Config` / `Config.redacted` via `OipRuntimeConfig.ts` (`:61-101`). Layout reads `NODE_ENV`, `NEXT_PUBLIC_REACT_GRAB`, `VERCEL`, `NEXT_PUBLIC_ENABLE_VERCEL_INSIGHTS` (`layout.tsx:24-49`). Contact service uses HubSpot + redacted readers (`ContactSubmission.service.ts:8-21`). **Lab template should copy the Config/Redacted pattern, not HubSpot/Vercel.** |
| @beep/* | `@beep/ui`, `@beep/schema`, `@beep/utils`, `@beep/identity`, `@beep/repo-configs`, `@beep/hubspot`, `@beep/sanity`. Runtime `@effect/atom-react`. Dev: `@beep/repo-utils`, `@beep/test-utils`. Identity: `$OipWebId` (`packages.ts:103`, `:872`). |
| Entry layers | UI: `@beep/ui` + local components. Atom: `src/runtime/OipAtomProvider.tsx` (`RegistryProvider` + `useAtomMount`). HttpApi **already used** as a Next route bridge: `ContactHttpApiRoute.ts` imports `HttpApiBuilder` from `effect/unstable/httpapi` (`:10-17`). That is a **Next-hosted** httpapi, not the standalone service variant. |
| Turbo/CI | No app-local `turbo.json`. Participates in root turbo `build` (`.next/**` outputs, `NEXT_PUBLIC_*` env — `turbo.json:34-66`). Coverage-ratcheted. `vercel.json`. Ceremony **on**. |
| Lab takeaway | Clone: portless wrap, App Router, `defineBeepNextConfig` + `allowedDevOrigins: ["<name>.labs.beep.localhost"]`, `tsconfig.next.json`, `@beep/ui` CSS + postcss, Effect Config, `tsgo -b`, vitest, biome. Do **not** clone PWA/Sanity/HubSpot/Vercel/MDX/serwist. |

### 2.2 `apps/professional-desktop` — Tauri 2 + Vite + Effect sidecar

**Not Electron.** Description still says "Minimal Tauri and React shell" (`package.json:4`); the tree is a full workbench.

| Surface | Live fact |
| --- | --- |
| Framework | Tauri 2 (`src-tauri/`, identifier `cloud.beep.professional-desktop` — `tauri.conf.json:5`) + Vite + React. Sidecar is bun Effect RPC (`server/main.ts`), **not** httpapi. |
| Portless | `portless professional-desktop.beep sh -c 'vite --host 127.0.0.1 --port "${PORT:-1421}" --strictPort'` (`package.json:18`). `dev:tauri` = `tauri dev` (`:22`). `tauri.conf.json` `beforeDevCommand: "bun run dev"`, `devUrl: "http://professional-desktop.beep.localhost:1355"` (`:7-9`). This is the **canonical nested-portless webview** pattern the tauri template already copies. Sidecar is **not** portless: `CHAT_SIDECAR_PORT` default 3939 (`server/main.ts:51-53`); Vite proxies `/rpc` → `127.0.0.1:3939` (`vite.config.ts:110-118`). |
| Scripts | codegen migration-bundle; `build:sidecar`; `beep:check` = `tsgo -p tsconfig.check.json && bun run codegen:check`; biome **allowlists** specific files including `src-tauri/tauri.conf.json` (`package.json:26`); **has `docgen`**. Integration IPC tests. |
| tsconfig | `tsconfig.json` extends base, includes `src`, `server`, `test`, vite/vitest configs (`:3-13`). Huge **hand-written** `@beep/*` `paths` + `references` (`:26-264`) — TsconfigSync also maintains per-package refs. Check uses `tsconfig.check.json` (`composite: false`, empty `references`, `:1-12`) so `tsgo -p` is a single-project check. |
| CSS | Same postcss re-export as oip-web (`postcss.config.mjs:1`). `src/main.tsx` imports `./styles/globals.css` + dock CSS (`:1-2`). |
| Env/secrets | Vite `envPrefix: ["VITE_", "TAURI_"]` (`vite.config.ts:136`). Sidecar: `CHAT_AGENT`, `CHAT_TRANSPORT` (`http` \| `ipc`), `CHAT_SIDECAR_PORT`, `ONTOLOGY_WORKSPACE_ROOT` under `.beep/professional-desktop/`, `AI_ANTHROPIC_API_KEY` (`server/main.ts:8-20`, `package.json:19-20`). Renderer pulls observability via Tauri `invoke` (`src/main.tsx:29-40`). Turbo pass-through includes `PORTLESS_*`, `CHAT_TRANSPORT`, ontology flags (`turbo.json:19-30`). |
| @beep/* | Composition root: agents / documents / epistemic / ontology / workspace slices + dock, editor, graph-3d, pglite, postgres, identity, ui, schema, observability, mcp-kit, … (`package.json:42-96`). Identity: `$ProfessionalDesktopId` (`packages.ts:84`). |
| Entry layers | Renderer: `src/main.tsx` → `ProfessionalAtomProvider` + theme. Server: `RpcServer` + `HttpRouter` from `effect/unstable/rpc` and `effect/unstable/http` (`server/main.ts:39-41`) — **RPC, not HttpApi**. Rust: `src-tauri` with plugins (dialog, log, opener, shell, updater), `externalBin: ["binaries/sidecar"]`, updater pubkey (`tauri.conf.json:29-45`). Cargo edition 2021, extra `cc`/`pkg-config` for the youtube referrer C extension (`Cargo.toml:12-28`). |
| Turbo/CI | App-local `turbo.json` only tweaks `check` inputs (`apps/professional-desktop/turbo.json:4-12`). Dedicated CI: rust cache, sidecar IPC job, `release-desktop.yml`. Coverage-ratcheted. |
| Lab takeaway | **v1 vite** = this portless Vite idiom minus rust/sidecar/slice fan-in. **v1 service** ≠ this sidecar (wrong protocol). **P3 tauri** = template + this `devUrl`/`beforeDevCommand` pattern, **not** this product. |

### 2.3 `apps/storybook` — Storybook host (Vite builder)

| Surface | Live fact |
| --- | --- |
| Framework | Storybook + `@storybook/react-vite` + Vite. Ceremony host, not a product app. |
| Portless | `portless storybook.beep sh -c 'storybook dev -p "${PORT:-6006}"'` and `storybook:start` via `vite preview` on the same hostname (`package.json:27-29`). **No `dev` script.** |
| tsconfig | `tsconfig.json` extends base; includes only `.storybook` + vitest configs (`:3-10`). Hard-coded `@beep/ui` paths (`:23-26`). `tsconfig.stories.json` typechecks `packages/foundation/ui-system/*/stories` and `packages/drivers/graph-3d/stories` (`:4-13`). |
| @beep/* | `@beep/ui`, `@beep/graph-3d`. Identity: `$StorybookId` (`packages.ts:174`). |
| Turbo/CI | App-local `turbo.json` makes `check` depend on `@beep/dock-react#check` and `@beep/editor#check`. Root turbo has dedicated `storybook` / `storybook:build` / `test:storybook` tasks (`turbo.json:242-270`). `.github/workflows/storybook.yml`. `vercel.json`. **Not** in coverage baseline. |
| Lab takeaway | Do **not** scaffold Storybook into labs (locked ceremony exemption). Vite `PORT` interpolation is a second data point for the vite `dev` script. |

### 2.4 `apps/architecture-lab-proof` — package-shaped proof harness

| Surface | Live fact |
| --- | --- |
| Framework | None. Effect library published as an **app workspace**. Matches `--app-kind runtime-proof` / architecture `proof-app`. |
| Portless | **None.** No `dev` script. |
| Scripts | Library `beep:{build,check,lint,test}` + babel + **docgen** (`package.json:14-33`). `exports` / `files` / `publishConfig` present (`:34-55`). |
| tsconfig | Package-style: `include: ["src"]`, `rootDir: "src"`, `outDir: "dist"`, references to architecture-lab slice roles + test-utils (`tsconfig.json:1-29`). |
| @beep/* | `@beep/architecture-lab-{config,domain,server,ui,use-cases}`. Identity: `$ArchitectureLabProofId` (`packages.ts:125`). Source uses `$ArchitectureLabProofId.create("index")` (`src/index.ts:18`). |
| Tests | `@effect/vitest` + FastCheck; imports package **through `@beep/architecture-lab-proof`** (`test/ArchitectureLabProof.test.ts:1`) — law: tests use `@beep/*` aliases. |
| Turbo/CI | No app turbo.json. Coverage-ratcheted. Docgen on. |
| Lab takeaway | Vocabulary collision only (`lab` in the name). A lab **app** is runnable; this is a contract harness. Do not emit `exports`/`docgen`/`publishConfig`. |

### 2.5 `apps/practice-kg-mcp` — bun CLI / MCP host (closest live "service-shaped" app, wrong protocol)

| Surface | Live fact |
| --- | --- |
| Framework | bun TypeScript bins (`practice-kg-mcp`, `practice-kg-build`, `practice-kg-claims` — `package.json:32-36`). DuckDB + PGlite. **Not** a web app. **Not** httpapi. |
| Portless | **None.** |
| Scripts | `tsc -b` build, `tsgo -p tsconfig.check.json`, mcpb packaging, smoke (`:14-30`). Has `docgen`. |
| tsconfig | Package-style `src` + refs to anthropic, duckdb, pglite, identity, schema, utils, law-practice-server (`tsconfig.json:1-32`). |
| Env | `PRACTICE_KG_BUNDLE_DIR` / `BUNDLE_DIR` / `PRACTICE_KG_CORPUS_ROOT` via Effect `Config` (`src/bin.ts:29-32`). Entry is `Effect.fnUntraced` (`:28`). |
| Storage | App-local PGlite: `makePracticeKgPgliteLayer(dataDir)` (`src/runtime/Pglite.ts:34`). Matches locked "in-memory/pglite labs trivially allowed" and "labs define their own tables in-app". |
| @beep/* | `@beep/anthropic`, `@beep/duckdb`, `@beep/identity`, `@beep/law-practice-server`, `@beep/pglite`, `@beep/schema`, `@beep/utils`. Identity: `$PracticeKgMcpId`. |
| Turbo/CI | No extra job. **Not** in coverage baseline. |
| Lab takeaway | Storage + `Effect.fnUntraced` + Config are reusable. Protocol is MCP/stdio — **do not** clone as the service variant. |

### 2.6 Cross-app comparison (what a lab must copy vs ignore)

| Concern | oip-web | professional-desktop | storybook | arch-lab-proof | practice-kg-mcp | Lab default |
| --- | --- | --- | --- | --- | --- | --- |
| Portless `*.beep` | yes | yes (vite) | yes | no | no | `*.labs.beep` |
| `@beep/ui` + postcss | yes | yes | yes | no | no | yes for next/vite |
| `defineBeepNextConfig` | yes | n/a | n/a | n/a | n/a | yes for nextjs |
| Atom provider | yes | yes | no | no | no | optional |
| HttpApi | Next route bridge | no (RPC sidecar) | no | no | no | service variant |
| Identity composer | flat name | flat name | flat name | flat name | flat name | **labs segment** |
| Docgen / exports | no / no | yes / no | no / no | yes / yes | yes / bins | **no** |
| Coverage ratchet | yes | yes | no | yes | no | **exempt** |
| Root workspace | explicit path | explicit | explicit | explicit | explicit | **glob `apps/labs/*`** |
| Root tsconfig ref | explicit | explicit | explicit | explicit | explicit | **holdout** |

---

## 3. Minimal viable template spec per v1 variant

*(locked laws: code laws full, ceremony exempt, portless `<name>.labs.beep.localhost`, lab manifest, identity labs namespace, per-lab postgres schema optional)*

Shared emit for **every** lab (all three variants):

| File | Why |
| --- | --- |
| `package.json` | `@beep/<name>`, `private: true`, **no** `exports`/`publishConfig`/`docgen`. `dev` uses `portless ${name}.labs.beep …`. Standard `beep:{build,check,lint,test}` aliases. |
| `lab.manifest.json` (name TBD by schema lane) | Schema-validated: purpose, created, disposition `active\|promote\|expired`, optional `postgresSchema`. |
| `AGENTS.md` + `CLAUDE.md` symlink | Real-app agents template, plus one line: this is a lab; ceremony exempt; do not add docgen/changesets/storybook. |
| `README.md` | Purpose + portless URL `http://<name>.labs.beep.localhost:1355`. |
| `LICENSE` | MIT, matches current templates. |
| `tsconfig.json` | Extends `../../../tsconfig.base.json` (three hops from `apps/labs/<name>`). **No** root `@beep/<name>` alias. Local `@/*` → `./src/*` for UI variants. |
| `vitest.config.ts` | Extends repo shared vitest. |
| `test/…` | One smoke test so `beep:test` is real (not `--passWithNoTests` as the only path). |
| **Not emitted** | `docgen.json`, `docs/`, `CHANGELOG.md`, changesets, `.storybook`, `vercel.json`, `turbo.json` (unless turbo already globs `apps/**`). |

Identity: create-package already registers `@beep/identity` composers. Labs must land under a **dedicated labs namespace segment** (locked). That is an identity-registration delta, not a template file.

Postgres: do **not** emit tables in `packages/*/tables`. If the manifest declares a schema name, emit either nothing (app owns migrations) or a stub `src/storage/LabSchema.ts` that documents the namespace. Delete-package reads the manifest.

### 3.1 nextjs (`--type app --app-kind nextjs --parent-dir apps/labs`)

Reuse today's Next templates, then add/change.

**Keep (already emitted):** `next-env.d.ts`, `src/app/page.tsx`, `test/app.test.tsx` (already imports `@/app/page` — `app-next-test-app.test.tsx.hbs:3`), `vitest.config.ts`, agents/readme/license.

**Change:**

- `dev`: `portless ${name}.labs.beep next dev --turbopack`
- `tsconfig.json` `rootRelative` = `../../../` (`toRootRelative` already does this).
- `next.config.ts`: **replace the empty stub**. Emit `defineBeepNextConfig({ repoRoot, allowedDevOrigins: ["{{kebabCase name}}.labs.beep.localhost"] })` (`SharedNextConfig.model.ts:612-616`). That pulls default transpile `@beep/ui|identity|schema|utils` (`:35`) and **requires** `tsconfig.next.json` (`:478-480`).
- `globals.css`: `@import "@beep/ui/styles/globals.css";` (oip-web `:1`), not the template's raw `:root` colors.
- `layout.tsx`: keep metadata stub; do not copy OIP theme/Vercel/react-grab unless opted in.

**Add vs today's template:**

| File | Why |
| --- | --- |
| `tsconfig.next.json` | `{ "extends": "./tsconfig.json", "compilerOptions": { "composite": false } }` — oip-web `:1-7`. Without it `defineBeepNextConfig` points Next at a missing file. |
| `postcss.config.mjs` | `export { default } from "@beep/ui/postcss.config"` — oip-web and professional-desktop both do this. |
| `lab.manifest.json` | locked |
| `package.json` deps | `@beep/ui`, `@beep/schema`, `@beep/identity`, `@beep/utils`, `@beep/repo-configs`, `effect`; catalog `next`/`react`/`react-dom`; tailwind comes via `@beep/ui` postcss (root already ignores those knip deps). |
| optional `src/runtime/` | Atom provider is **product**, not law. Defer unless the first lab (trustgraph workbench) needs it on day one. |

**Do not add:** serwist/PWA, Sanity, HubSpot, Vercel, MDX, `vercel.json`, webpack `node:` stubs, `tsconfig.json` hard-coded `@beep/ui` paths (workspace resolution + default transpile is enough; oip-web's extra paths are historical).

### 3.2 vite (`--type app --app-kind vite --parent-dir apps/labs`) — **NEW kind**

No template set exists. Closest copy source: Tauri web half **minus** `src-tauri`, plus professional-desktop's `dev` idiom.

**Must emit:**

| File | Source to port |
| --- | --- |
| `index.html` | `app-tauri-index.html.hbs` |
| `src/main.tsx` | `app-tauri-src-main.tsx.hbs` |
| `src/App.tsx` | title stub, not "Desktop shell ready" |
| `src/styles/globals.css` | professional-desktop / `@beep/ui` entry |
| `vite.config.ts` | `app-tauri-vite.config.ts.hbs` (host 127.0.0.1, PORT from portless) |
| `vitest.config.ts` | tauri vitest template |
| `test/App.test.tsx` | tauri test template |
| `postcss.config.mjs` | same as nextjs lab |
| `tsconfig.json` | tauri tsconfig minus rust-unrelated noise |
| `lab.manifest.json` | locked |
| `package.json` | `dev: portless ${name}.labs.beep sh -c 'vite --host 127.0.0.1 --port "${PORT:-5173}" --strictPort'` ; `beep:build: vite build` ; deps: react, react-dom, vite, `@vitejs/plugin-react`, `@beep/ui`, `@beep/schema`, effect |

**Must not emit:** anything under `src-tauri/`, `@tauri-apps/*`, `dev:tauri`.

### 3.3 service (`--type app --app-kind service --parent-dir apps/labs`) — **NEW kind**

Most repo-native locked variant. No existing app is this.

**Must emit:**

| File | Why / copy source |
| --- | --- |
| `src/Api.ts` | `HttpApi` + `HttpApiGroup` + `HttpApiEndpoint.get("health", "/health", …)` — copy shape from `packages/tooling/library/qa-capture/src/Collector.api.ts:14-80` (schema-first health). Also oip-web `OipHttpApi` / `ContactHttpApiRoute.ts:10-17` for the Next-hosted cousin. |
| `src/main.ts` | `Effect.fnUntraced` entry (practice-kg `src/bin.ts:28`). Serve via `HttpApiBuilder` + `@effect/platform-bun` `BunHttpServer` — **same stack as** `Collector.service.ts:18-22`. Bind `127.0.0.1` + `Config.port("PORT").pipe(Config.withDefault(8787))` so portless-injected `PORT` wins. Validate symbols against `.repos/effect`. **Never** `node:http`. |
| `src/runtime/Layer.ts` | `Layer` composition; no global state. |
| `src/storage/.gitkeep` or `src/storage/LabSchema.ts` | in-app tables only; optional `@beep/pglite` via `makePracticeKgPgliteLayer`-style helper (`apps/practice-kg-mcp/src/runtime/Pglite.ts:34`). Never `packages/*/tables`. |
| `test/health.test.ts` | hits health route through `@beep/<name>` or local server layer. |
| `tsconfig.json` | node/bun, no jsx. |
| `vitest.config.ts` | shared. |
| `lab.manifest.json` | include `postgresSchema` when storage is opted in. |
| `package.json` | `dev: portless ${name}.labs.beep sh -c 'bun --watch src/main.ts'` (process must honor `${PORT}`). `beep:build`: `tsgo -b` or bun. deps: `effect`, `@beep/schema`, `@beep/utils`, `@beep/identity`; optional `@beep/pglite` / `@beep/postgres`. **No** react/next/vite/tauri. |

**Portless contract:** the process must listen on `127.0.0.1:${PORT}` (portless injects PORT). Fallback e.g. `PORT:-8787` for `PORTLESS=0`.

**Do not emit:** Next/Vite UI, rust, MCP packaging, slice-server role files.

**Full-stack lab:** compose `vite` or `nextjs` **plus** `service` as two workspace packages under `apps/labs/` (e.g. `apps/labs/cognee` + `apps/labs/cognee-api`) **or** a single package with both `src/app` and `src/server`. Locked text: "full-stack lab composes frontend variant + service". Prefer **two packages** if delete-package is leaf-only (deleting UI first is easy); prefer **one package** if zero-root-churn + one manifest is the product. Recommend **one package, two scripts** (`dev` + `dev:api` or a process-composer) for v1 to keep one manifest / one postgres schema / one identity segment. Call this out in P2.

---

## 4. Tauri phase-2 delta

### 4.1 What the existing template already covers

Verified real: 14 Handlebars files + generated `package.json`. Covers:

- Vite React shell + portless `dev` (same as future vite variant). `vite.config.ts` documents PORT/`PORTLESS=0` (`app-tauri-vite.config.ts.hbs:14-17`).
- `src-tauri` crate: Cargo.toml tauri 2 + serde (`app-tauri-src-tauri-Cargo.toml.hbs`), `build.rs` = `tauri_build::build()`, `main.rs` calls `{{snakeCase name}}_lib::run()`, `lib.rs` exposes `app_health` command + `tauri::Builder::default()`.
- Capabilities: `core:default` on window `main` (`app-tauri-src-tauri-capabilities-default.json.hbs`).
- `tauri.conf.json` with **already-wired** `devUrl` `http://{{kebabCase name}}.beep.localhost:1355`, `beforeDevCommand: "bun run dev"`, `devCsp` allowing that host (`app-tauri-src-tauri-tauri.conf.json.hbs:6-22`).
- `dev:tauri` script + `@tauri-apps/api` / `@tauri-apps/cli` catalog deps.
- vitest smoke for `App` (`app-tauri-test-App.test.tsx.hbs`).
- `index.html` + `createRoot` `main.tsx` (`app-tauri-index.html.hbs`, `app-tauri-src-main.tsx.hbs`).

### 4.2 Net-new for a labs tauri variant

| Item | Why net-new |
| --- | --- |
| Portless hostname `*.labs.beep.localhost` | template and QA helper are `*.beep` |
| Icons | template `"icon": []` — `tauri build` may fail without icons; professional-desktop has `src-tauri/icons/icon.png` |
| Cargo.lock policy | live app vendors lock; template does not emit one |
| Rust toolchain in mise / CI | hosted checks do not obviously compile every `src-tauri` (professional-desktop is special). Labs must **not** become required rust blockers (locked: lab lanes not required for unrelated PRs) |
| Webview + portless semantics | `tauri dev` runs `beforeDevCommand` = `bun run dev` = portless vite. Nested portless is already the professional-desktop pattern. Document: `dev` = web-only; `dev:tauri` = webview. Do not portless-wrap `tauri dev` itself |
| Sidecar | do **not** copy professional-desktop `server/` into the template. A lab that needs a backend uses the **service** variant |
| Identity / manifest / parent-dir | same as v1 |

### 4.3 Overlap / conflict with `professional-desktop`

| Surface | Overlap | Conflict |
| --- | --- | --- |
| Stack | Same: Tauri 2 + Vite + React + portless vite + `dev:tauri` | professional-desktop is a **product composition root** with 30+ `@beep/*` slices; labs must stay thin |
| Port default | template `PORT:-1420`; live desktop `PORT:-1421` | fine — portless assigns PORT; fallbacks only for `PORTLESS=0` |
| Sidecar / RPC / pglite / ontology | none in template | do not absorb sidecar into the variant or labs become a second professional-desktop |
| CI rust | desktop already forces rust awareness | a second tauri app in `apps/labs/*` doubles rust CI unless lab tauri is path-filtered |
| `identifier` | template `dev.beep.{{kebabCase name}}` (`tauri.conf.json.hbs:5`) | live desktop is `cloud.beep.professional-desktop` (`tauri.conf.json:5`). Labs: `dev.beep.labs.<name>` to avoid both collisions |
| Vite config | template is the clean source | desktop vite is specialized; do not "upgrade" the template toward desktop |

**Phase-2 landing rule (locked):** tauri is another `AppKind` on the same RegistrationSurface / create-package `--app-kind` switch, not a redesign. Implementation: add labs parent-dir + `*.labs.beep` to the **existing** tauri kind; do not invent `lab-tauri`.

---

## 5. Scratchpad workspace — how experiments happen today, and which laws labs must not escape

`scratchpad/` is a **first-class bun workspace** named `@beep/scratchpad` (`scratchpad/package.json:2`, root `package.json:435`). It is **not** under `apps/`. It is listed in `tsconfig.packages.json` (`:397`) and has `$ScratchpadId` (`packages.ts:110`, `:1623`). That is the opposite of a hidden folder — it is a registered package that then **opts out of ceremony and most code-law enforcement**.

### 5.1 What lives there (experiment styles)

| Area | What it is | Runner |
| --- | --- | --- |
| `scratchpad/claudecode/` | Ported Claude-runtime schemas + tests | own `biome.jsonc`, `tsconfig.json`, `vitest.config.ts`; scripts on the scratchpad package (`package.json:11-15`) |
| `scratchpad/codemode/` | Interpreter / OpenAPI / stdlib spike | typechecked via root scratchpad tsconfig |
| `scratchpad/effect-ontology/` | **Full port** of effect-ontology (Domain/Service/Runtime/HttpServer, SQL under `Runtime/Persistence/`) | own biome + vitest + `tsgo -p effect-ontology/tsconfig.json` (`package.json:8-18`). Uses `effect/unstable/http` (`Runtime/HttpServer.ts:14`), **not** the locked httpapi service shape. This is the **closest existing "service lab"** and it is **outside** `apps/` on purpose. |
| `scratchpad/dockview-demo/` | Vite + React demo for `@beep/dock-react` | README says `bunx vite scratchpad/dockview-demo` at **`http://localhost:5199`** (`dockview-demo/README.md:12`) — **raw localhost, no portless**. |
| `scratchpad/graph-3d-bench/` | Headless bench | README **does** document `portless graph3d-bench.beep …` (`graph-3d-bench/README.md:13`) — optional, not a package script. |
| `scratchpad/bubbles/`, `computable-layout/`, `template/` | Isolated schema/layout spikes | tests beside source |

Root `scratchpad/tsconfig.json` extends `../tsconfig.base.json`, `include: ["**/*.ts", "**/*.tsx"]`, `noEmit`/`composite: false`, plus a pile of `@beep/*` project references (`:1-79`). There is **no** `dev` script on `@beep/scratchpad`. Experiments are ad-hoc `bunx vite` / `tsgo -p <subfolder>`.

### 5.2 Laws scratchpad **escapes** (labs must **not**)

| Law / surface | Scratchpad | Labs (locked) |
| --- | --- | --- |
| Biome repo config | `!scratchpad` in `biome.jsonc:47` | Full biome (`beep:lint`) |
| Lefthook biome + typos | `exclude: … scratchpad/**` (`lefthook.yml:6,17`) | Hooks apply |
| Knip | `ignore: scratchpad/**` + `ignoreWorkspaces: ["scratchpad"]` (`knip.jsonc:73,185`) | Analyzed (except ceremony) |
| Fallow / dead-code | `ignorePatterns: scratchpad/**` (`.fallowrc.jsonc:73`) | Lint-policy applies |
| Portless dev-server law | dockview-demo uses `localhost:5199`; most spikes have no `dev` script | **Required** `<name>.labs.beep.localhost:1355` |
| Schema-first / effect-first | Mixed: some folders are careful, effect-ontology is a bulk port with its own biome and `effect/unstable/http` | Full code laws |
| Import boundaries / fallow.boundaries | `@beep/scratchpad` is a special node in generated boundaries | Lab apps are normal workspace members with UI/server import rules |
| Identity | One catch-all `$ScratchpadId` for the whole tree | **Per-lab** composer under labs namespace |
| create-package / delete-package | Hand-grown; no variant; no manifest | create/delete + manifest |
| Storage | effect-ontology has in-tree SQL (`Runtime/Persistence/`) — acceptable *location*, but not schema-validated per-lab | Manifest-declared per-lab Postgres schema, dropped on delete |
| CI / turbo | Not a required lane; optional local scripts only | CI typechecks/builds labs; not a required blocker for unrelated PRs |
| Docgen | scratchpad **has** `docgen.json` + `docs/` and a `docgen` script (`package.json:16`) — leftover ceremony | Ceremony **exempt** — do not emit docgen |
| Storybook / changesets / coverage ratchet | Escapes by not being an app | Exempt by **path-scoped** rules, not by living in scratchpad |

### 5.3 What scratchpad gets **right** that labs should keep

- **Workspace membership** so `@beep/*` source resolution works without publishing (`dockview-demo/README.md:15-17`).
- **Local storage** next to the experiment (PGlite / SQL files), never `packages/*/tables`.
- **Optional** extra biome configs for a sub-tree (`claudecode/biome.jsonc`, `effect-ontology/biome.jsonc`) — labs should instead use the **repo** biome.
- Graduation path today is informal (scratchpad → package, e.g. fallow comments about `scratchpad/bsl` merging into ecosystem). Labs replace this with the locked **promote runbook**.

### 5.4 Do not put labs in scratchpad

`apps/labs/*` exists specifically so experiments stop using scratchpad's exemptions. First-wave named labs (trustgraph/ts workbench, effect-ontology, cognee, semantica) currently live **outside** the repo (the SPEC.md Decision Log port sources). `scratchpad/effect-ontology` is a prior in-tree port of one of those — P2 should **not** keep growing it; the service-variant lab is the legal home.

---

## 6. Registration / create-package deltas this lane owes P1–P2

Concrete changes implied by the anatomy (for the packet, not this lane to implement):

1. **One-time glob:** add `"apps/labs/*"` to root `workspaces` (`package.json:433+`). After that, `ensureRootWorkspaceEntry` no-ops (`CreatePackage.command.ts:833-834`).
2. **Default parent for lab apps:** either a new `--labs` flag or `--parent-dir apps/labs` as the documented create-package invocation. Today's default is `apps` (`:1117-1133`).
3. **New `AppKind` literals:** add `vite` and `service` next to `nextjs` / `tauri` / `runtime-proof` (`:120`). Tauri stays; it is P3.
4. **Portless label:** every generated `dev` script uses `${name}.labs.beep`. Update `portlessUrlForApp` **or** pass the full hostname (`Qa.session.ts:81` currently `${app}.beep.localhost`).
5. **Identity:** register under a labs segment, not `compose("<name>")` (`IdentityRegistration.ts:156-158`). Delete-package prunes that segment.
6. **TsconfigSync holdout:** every lab `tsconfig.json` sets `hasProjectTsconfig=true` (`TsconfigSync.plan.ts:294`) and lands in `tsconfig.packages.json`. P1 must exclude `apps/labs/**` from `planRootReferenceSync` **or** accept one-file churn. Aliases should stay quiet (no `exports` → no `rootAliasTarget`).
7. **Ceremony path-scopes:** exclude `apps/labs/**` from docgen inventory, coverage baseline, changesets, storybook registration. Do **not** copy scratchpad's biome/knip/lefthook ignores.
8. **CI:** labs ride existing turbo `check`/`test-unit`/`lint`. Do **not** add rust jobs until P3. Lab failures must not be required on unrelated PRs (path filters / continue-on-error / non-required check name).

---

## Appendix: TsconfigSync + portless (cross-cutting)

See §1.6–1.7 and §6.

- **TsconfigSync surfaces:** `tsconfig.packages.json` (refs), `tsconfig.json` (aliases), syncpack sources, per-package refs, `docgen.json`. Real apps skip aliases + docgen. Labs still hit **root refs** unless filtered.
- **Portless is a script convention**, not a generated config file. The "generator" is `generatePackageJson`'s `dev` string (`CreatePackage.command.ts:1467`, `:1509`). Binary is undeclared (`knip.jsonc:167-176` `ignoreBinaries: ["portless"]`); source `vercel-labs/portless` (`skills-lock.json:78-83`).
- Labs change the **label** from `<name>.beep` to `<name>.labs.beep`. QA helper and tauri `devUrl`/`devCsp` must follow.

---

## Verdict (for synthesis)

- Next.js and Tauri templates are **real and complete as skeletons**, not product clones. Vite-as-kind and service-as-kind **do not exist**.
- v1 can ship by (a) forking next templates onto `apps/labs` + `*.labs.beep` + `defineBeepNextConfig` + `@beep/ui` postcss + manifest, (b) extracting Tauri's Vite half as `--app-kind vite`, (c) new `--app-kind service` modeled on `qa-capture` HttpApi + bun listen-on-`PORT`.
- Tauri P3 is a **rename + CI spike**, not a greenfield template.
- Scratchpad is the **anti-pattern** labs replace: workspace-visible, law-exempt. Labs invert that: law-full, ceremony-exempt, glob-registered.
