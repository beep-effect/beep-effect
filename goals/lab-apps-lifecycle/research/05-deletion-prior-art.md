# Lane 5 — Package deletion prior art, residue, and `beep delete-package` requirements

**Lane:** 5 of 6. **Checkout:** `feat/experiment-apps-lifecycle` @ `343fc60735` (contains `#680` / `623392c2a7`).
**Scope:** read-only git archaeology + live-tree residue + repo-cli surfaces.
**In-tree companion:** `goals/speed-loop/research/r3-package-deletions.md` (2026-08-04). This lane field-tests that recipe against real deletion commits and today’s residue.

---

## 0. Verdict

There is **no** `beep delete-package`. `beep create-package` is a one-way registrar. Historical deletes were hand mega-commits that almost inverted registration and then leaked residue. The newest (`#680`, 2026-08-13) still left:

1. Untracked `node_modules/`, `dist/`, `.turbo/`, `.beep/`, package-local `docs/` for `@beep/courtlistener`, `@beep/dol`, `@beep/federal-register`, and `@beep/form`.
2. Stale committed rows in `standards/jsdoc-documentation.inventory.jsonc` (`.md` was edited; `.jsonc` was not).
3. Pending changesets still naming the deleted drivers, papered over by `standards/changesets.retired-packages.json`.
4. Stale `.beep/ci/` JSDoc mirrors (all three drivers **and** `@beep/form`).
5. Packets that still claim the deliverable (`goals/canvas` is `completed-retained`; `goals/repo-codegraph-jsdoc` is still listed).

`delete-package` = inverse of `create-package` **plus** surfaces create never writes (coverage, JSDoc, Fallow, schema-first, test-typecheck, changesets, knip, docs, packet honesty, leftover artifacts). Default: **refuse if dependents exist**. Cascade is a flagged exception.

Architecture `11-evolution-and-deprecation.md` requires a five-step slice sunset. **No historical deletion followed it.** Pre-v1 remotes used a DECISIONS waiver (`Retired 2026-06-15`, Stack Installer). Experiments should inherit that waiver, not a fake quarter-long sunset.

> **Errata (2026-08-13, PR #710 review):** the "residue today" observations in §0/§2/Appendix A
> were captured on the research author's worktree. Review verified that the untracked artifact
> dirs were machine-local and the stale committed rows have since been cleaned on main (#705
> inventory rewrite, #690 hygiene sweep). Treat Appendix A as a catalog of residue *classes* for
> the synthetic doctor fixture, not as live tree state.

---

## 1. Method

Commands and scans used (all read-only):

- `git log --diff-filter=D --name-only --format='%h %s%n%ci' -- '*/package.json'`
- Per-commit `git show --stat` / `--name-only` on first-party deletions (ignored `.repos/**` subtree remotes).
- Follow-up search: `git log <sha>..HEAD --grep='<package>'` plus path-limited logs.
- Live residue: `rg` over configs, `standards/*`, `.changeset/`, `bun.lock`, identity, inventories; `git ls-files` vs working-tree `find` to separate tracked source from leftover artifacts.
- Tooling inventory: `packages/tooling/tool/cli/src/commands/{CreatePackage,TsconfigSync,Quality,Lint,Yeet,Purge,TopoSort,Architecture,Fallow}` and `@beep/repo-utils` `{Graph,Dependencies,DependencyIndex,Workspaces,UniqueDeps}`.

**Non-cases excluded from the six deep dives:**

| Commit | Why excluded |
| --- | --- |
| Repeated `.repos/effect-v4` untracks (`6e45fb2df7`, `132d64c8a3`, `50597faa2b`, `a1f05a86fe`, …) | Vendor subtree hygiene, not `@beep/*` packages. |
| `3e66095768` installer-slice consolidation | Merge/rename of `installer-*` into one slice, not a terminal delete. Later deleted entirely in `33c584b179`. |
| `0d08357712` `packages/tenancy/domain` | Promotion into shared kernel, not retirement. |
| `6c8bab5b25` editor / repo-memory / desktop | Mid-rewrite “saving” squash; packages later reappeared under new paths. |
| `c029b9e30d` `packages/common/knowledge-graph` | Pre-topology leftover, no modern registration surfaces. |

---

## 2. Case studies (six first-party deletions)

Each case lists: what died, every *registration* surface the commit touched, whether a follow-up was needed, and what remains **today** on this checkout.

### 2.1 `#680` / `623392c2a7` — empty government-driver stubs (2026-08-13)

**Commit:** `docs(repo): rewrite README and retarget deleted-driver knowledge refs (#680)`
**Packages:** `@beep/courtlistener`, `@beep/dol`, `@beep/federal-register`
**Trees:** `packages/drivers/{courtlistener,dol,federal-register}/`
**Why this is the gold standard:** newest deletion, done after `r3-package-deletions.md` existed, and the only one that invented `standards/changesets.retired-packages.json`. Still incomplete.

#### What the packages were

VERSION-only scaffolds (`VERSION = "0.0.0"`). Manifests declared only catalog `devDependencies` (`@effect/vitest`, `@types/node`, `bun-types`). Zero production consumers (`r3` E1: `0p/0t`). Cheap to delete, expensive to *register* — they still occupied workspace slots, identity composers, tsconfig aliases, syncpack rows, Fallow nodes, coverage rows, and JSDoc inventory rows.

#### Every file family the commit touched (93 files, +1104 / −1284)

**Deleted package trees (tracked source only):**

For each of the three drivers, the commit removed:

- `LICENSE`, `README.md`, `docgen.json`, `package.json`
- `src/index.ts`, `test/index.test.ts` (plus `test/.gitkeep` on dol / federal-register)
- `tsconfig.json`, `tsconfig.test.json`, `vitest.config.ts`

**Registration / generated surfaces (this is the inverse-create checklist in the wild):**

| Surface | Path | What `#680` did |
| --- | --- | --- |
| Workspace membership | `package.json` `workspaces` | Removed the three `packages/drivers/{courtlistener,dol,federal-register}` entries. Also dropped unrelated `@better-auth/*` / `better-auth` root deps in the same commit. |
| Path aliases | `tsconfig.json` | Removed `@beep/<name>` and `@beep/<name>/*` aliases. |
| Project references | `tsconfig.packages.json` | Removed the three `{ "path": "packages/drivers/…" }` entries. |
| Syncpack | `syncpack.config.ts` | Removed the three `packages/drivers/*/package.json` source rows. |
| Identity registry | `packages/foundation/modeling/identity/src/packages.ts` | Removed `"federal-register"`, `"dol"`, `"courtlistener"` from `$I.compose(...)` and deleted `$FederalRegisterId`, `$DolId`, `$CourtlistenerId` export blocks. Also accidentally dropped a duplicate `"doc-text"` compose argument. |
| Identity shape test | `packages/foundation/modeling/identity/test/shape-stable.test.ts` | Dropped the three composer names. |
| Lockfile | `bun.lock` | Regenerated (−43 lines). No leftover workspace protocol entries today. |
| Coverage ratchet | `standards/coverage.regression-baseline.jsonc` | Rebaselined (also rebaselined `@beep/oip-web` after a jsdom teardown fix in the same PR). |
| Fallow | `standards/fallow.boundaries.generated.jsonc` + `.provenance.jsonc` | Removed the three package nodes (−45 / −42). |
| JSDoc inventory (markdown) | `standards/jsdoc-documentation.inventory.md` | 11-line edit. |
| JSDoc inventory (jsonc) | `standards/jsdoc-documentation.inventory.jsonc` | **Not in the commit.** Residue (see below). |
| Changesets (this PR) | `.changeset/honest-repo-signal.md` | Empty frontmatter `{}` — “No release”. Correct: a vanished package cannot take a bump. |
| Changesets (historical) | `standards/changesets.retired-packages.json` | **Created/extended** with the three names so `beep quality changeset-graph` would not fail. Did **not** delete `.changeset/crispening-p2-beep__{courtlistener,dol,federal-register}.md` or the multi-package files that still list them. |
| Turbo | `turbo.json` | Only dropped `BETTER_AUTH_*` env passthrough. **No package-specific turbo keys** — confirms `r3` E8. |
| Docs / goals honesty | `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `goals/honest-repo-signal/**`, delivery packets | Retargeted “skeleton exists” claims to “recreate when product-pulled”. |

Unrelated files in the same squash (do **not** cargo-cult into `delete-package`): `SECURITY.md`, GitHub templates, `CODEOWNERS`, `apps/oip-web/src/components/HeroVideo.tsx`, nanoid bump.

#### Follow-up commits after `#680`

No dedicated “oops we missed courtlistener” commit. Subsequent hits are merges of `origin/main` into long-lived branches and unrelated inventory regenerations (`4fb2304e7f` JSDoc carrier retirement, `20f6b8efc0` tstyche retirement). The JSDoc `.jsonc` residue was **never** repaired.

#### Residue today

| Class | Still present? | Evidence |
| --- | --- | --- |
| Tracked source | **No** | `git ls-files packages/drivers/courtlistener` → empty. |
| Untracked artifacts | **Yes** | Each of the three dirs still holds `.beep/docgen/`, `.turbo/turbo-{build,check,lint,test,docgen}.log`, `dist/index.{js,d.ts,map}`, `node_modules/`, `docs/index.md`. `git ls-files` count = 0. |
| `bun.lock` / workspaces / tsconfig / syncpack / identity / coverage / Fallow | **No** | Exact-name `rg` on those files is empty. |
| Committed JSDoc `.jsonc` | **Yes** | `standards/jsdoc-documentation.inventory.jsonc:72914` `@beep/courtlistener`; `:419572` `@beep/federal-register`; plus `@beep/dol`. |
| `.beep/ci/` JSDoc cache | **Yes** | `.beep/ci/jsdoc-documentation.inventory.jsonc` still has all three (and even an old `$CourtlistenerId` symbol row). |
| Pending changesets | **Yes** | `.changeset/crispening-p2-beep__courtlistener.md` (`"@beep/courtlistener": patch`), same for dol / federal-register; plus `"@beep/courtlistener"` rows inside `.changeset/docgen-paths-prune.md` and `.changeset/standards-remediation-wave2.md`. Gate stays green only because of `standards/changesets.retired-packages.json`. |
| Goals / explorations | **Intentional history** | `goals/honest-repo-signal/**`, `goals/gov-legal-data-driver-delivery/**`, `goals/speed-loop/research/r3-package-deletions.md`, plus stale `_gold-intake` shards that still say “bare skeleton exists”. |
| Historical fleet timings | **Yes, harmless** | `goals/quality-speedup/research/data/fleet-turbo-task-timings.tsv` still names `@beep/courtlistener#test` etc. |

**Lesson:** `git rm` + tsconfig-sync + identity + coverage/Fallow is necessary and not sufficient. Also `rm -rf` leftover artifacts, regen **both** JSDoc artifacts, decide retire-vs-delete for pending changesets, invalidate `.beep/ci`.

---

### 2.2 `33c584b179` — retired slices and apps (2026-06-15)

**Commit:** `chore: remove retired slices and apps`
**Scale:** 416 files, +14 432 / −65 348. The largest first-party deletion.

**Packages / apps removed:**

| Kind | Name | Path |
| --- | --- | --- |
| App (Tauri) | `@beep/canvas` | `apps/canvas` |
| App (Next) | `@beep/codedank-web` | `apps/codedank-web` |
| App (proof) | `@beep/professional-runtime-proof` | `apps/professional-runtime-proof` |
| App (Tauri) | `@beep/stack-installer` | `apps/stack-installer` (+ `src-tauri/**`, icons, Cargo) |
| Slice | `@beep/canvas-{domain,use-cases,server,client,ui}` | `packages/canvas/*` |
| Slice | `@beep/installer-{domain,use-cases,server}` | `packages/installer/*` |
| Domain | `@beep/wealth-management-domain` | `packages/wealth-management/domain` |

This is the closest historical analog to “delete an experimental app + its slice”.

#### Registration surfaces touched (non-tree)

From `git show --name-only` minus `apps/`, `packages/`, `docs/`:

```
.aiignore
.beep/repo-exports/catalog.shard.jsonc     # catalog era; subsystem later deleted
.changeset/giant-lilies-chew.md
README.md
_typos.toml
bun.lock
explorations/ATLAS.md
explorations/agent-chat-interface/{MAP,RESEARCH}.md
explorations/docx-roundtrip-interop/BRIEF.md
knip.jsonc
package.json                               # workspaces
standards/architecture/DECISIONS.md        # Retired 2026-06-15 waiver
standards/clone.inventory.jsonc
standards/effect-laws.allowlist.jsonc
standards/fallow.boundaries.generated.jsonc
standards/fallow.boundaries.provenance.jsonc
standards/jsdoc-documentation.inventory.jsonc
standards/jsdoc-documentation.inventory.md
standards/repo-exports.catalog.jsonc       # catalog era
standards/repo-exports.catalog.md
standards/schema-first.inventory.jsonc
syncpack.config.ts
tsconfig.json
tsconfig.packages.json
tsconfig.quality.packages.json             # deleted wholesale
tstyche.json
```

Plus the entire `docs/{canvas,codedank-web,installer,professional-runtime-proof,stack-installer,wealth-management}/**` generated doc tree.

**Identity:** removed compose slugs and export blocks for `professional-runtime-proof`, `wealth-management-domain`, `codedank-web`, `canvas-domain`, `canvas-use-cases`, `canvas-server`, `canvas-client`, `canvas-ui`, `stack-installer`, `installer-domain`, `installer-use-cases`, `installer-server`, `canvas`. Also dropped leftover `iam-*` / `billing-*` composers that were already dead.

**Workspaces** removed (from the `package.json` hunk):

```
packages/installer/*
apps/codedank-web
apps/stack-installer
apps/professional-runtime-proof
packages/wealth-management/domain
packages/canvas/{domain,use-cases,server,client,ui}
apps/canvas
```

**Knip:** dropped `packages/canvas/client` and `packages/canvas/ui` from `ignoreWorkspaces`. Left `packages/drivers/konva` and the `packages/shared/{client,config,…}` stub ignores in place — those were deleted six days later in `f96c60ae42`.

**DECISIONS waiver** (`standards/architecture/DECISIONS.md`, “2026-05-20: Stack Installer Pre-v1 Slice”, status **Retired 2026-06-15**):

> Because the correction happens before v1 compatibility exists, all known consumers migrate in the same PR. No compatibility wrappers, re-export packages, or sunset aliases are required.

That is the actual legal template for experimental-app deletion. Architecture doc 11’s “2 minor releases or 1 quarter” sunset was **not** observed.

#### Follow-ups

No “fix leftover canvas workspace” commit. Later `canvas` hits are the `goals/canvas` packet staying `completed-retained`, plus `graph-3d` work that is a different product. `cd7670d5d0` (portfolio consolidation) and `f72b130230` (roadmap) rewrote packet indexes around the deletion rather than repairing registration.

`knip.jsonc` leftover stub ignores were cleaned by `f96c60ae42` when those stubs themselves died.

#### Residue today

| Class | Still present? |
| --- | --- |
| Package / app trees (tracked or leftover artifacts) | **No** — `packages/canvas`, `apps/canvas`, `apps/stack-installer`, `apps/codedank-web`, `apps/professional-runtime-proof`, `packages/installer`, `packages/wealth-management` are gone (older deletion; a later `bun install` / purge swept artifacts). |
| Live configs (package.json, tsconfig, syncpack, identity, bun.lock, coverage, Fallow) | **No** |
| `docs/canvas` etc. | **No** |
| `goals/canvas` | **Yes** — still in `goals/INDEX.md` as `@beep/canvas`, status `completed-retained`, `ops/manifest.json` still names `@beep/canvas-*` filters and `apps/canvas` as P1 evidence. Honesty residue: a completed packet whose deliverable no longer exists. |
| `goals/effect-native-migration/ops/progress.json` | **Yes** — historical migration ledger still lists `@beep/canvas-*`. |
| `goals/fallow-quality-enforcement/ops/validate-knip-parity-baselines.ts` | **Yes** — still mentions `packages/canvas/client` and `packages/canvas/ui`. |
| Security findings CSF-045 / CSF-025 | **Yes** — historical, pointing at deleted trees. Acceptable as findings archive. |

**Lesson:** deleting the app/slice ≠ closing the packet. Refuse if a `completed-retained`/`active` packet still claims the package, or rewrite behind `--rewrite-packets`.

`stack-installer` is the Tauri analog: also delete `src-tauri/{Cargo.toml,Cargo.lock,build.rs,tauri.conf.json,capabilities,icons,src}`.

---

### 2.3 `8ae9c8e4f5` — retired foundation packages (2026-06-15)

**Commit:** `chore: remove retired beep packages` (140 files, +1 261 / −57 126)

**Packages:**

| Name | Path | Notes |
| --- | --- | --- |
| `@beep/sandbox` | `packages/foundation/capability/sandbox` | Large capability (Agent/Orchestrator/Worktree). Gone for good. |
| `@beep/messages` | `packages/foundation/modeling/messages` | i18n helper. Gone for good. |
| `@beep/ontology` | `packages/foundation/modeling/ontology` | **Name reused.** Recreated 2026-07 (`ec5c9c4056` semantic-foundation m1) at the **same path** with the **same package name**. |

#### Surfaces touched

- `.changeset/remove-retired-beep-packages.md` — **`"@beep/identity": major`** plus patch on observability/schema. This is the only deletion that treated identity-composer removal as a **breaking `@beep/identity` release**.
- `bun.lock`
- Generated `docs/foundation/capability/sandbox/**`, `docs/foundation/modeling/{messages,ontology}/**`
- Identity `packages.ts` (removed `"messages"`, `"ontology"`, `"sandbox"` + `$MessagesId`, `$OntologyId`, `$SandboxId`)
- Per-package `.beep/repo-exports/catalog.shard.jsonc` (catalog era)
- `standards/{fallow.boundaries.*, jsdoc-documentation.inventory.*, repo-exports.catalog.*, schema-first.inventory.jsonc}`
- `tsconfig.json`, `tsconfig.packages.json`, `tsconfig.quality.packages.json`
- `packages/tooling/tool/cli/test/tsconfig-sync.test.ts` (fixture update)
- `scratchpad/tsconfig.json`

#### Follow-ups / recreate

- `ccc6faa5a2` later centralized the identity registry + lint (`beep lint identity-registry`). That lint is **completeness-only** (missing slugs fail; extra slugs do not).
- `ec5c9c4056` / `1b0124d4f0` **recreated** `@beep/ontology` at `packages/foundation/modeling/ontology` as the semantic-foundation SKOS/taxonomy package. Identity `$OntologyId` came back.
- `623392c2a7` added `@beep/ontology` to `standards/changesets.retired-packages.json` **even though the package is live again.**

#### Residue today

| Item | Status |
| --- | --- |
| `@beep/sandbox`, `@beep/messages` trees | Gone (no leftover artifacts). |
| `@beep/ontology` | **Live** at the same path. Different product, same name, same `$OntologyId`. |
| `.changeset/remove-retired-beep-packages.md` | **Still pending**, 2+ months later. Frontmatter does not name the deleted packages (it bumps identity/schema). Harmless for changeset-graph. |
| `standards/changesets.retired-packages.json` | Still lists `@beep/messages`, `@beep/ontology`, `@beep/sandbox`. **`@beep/ontology` is a name-reuse landmine:** the retired allow-list will silently accept *future* changesets for a deleted-again ontology even if they belong to the *new* package. |
| Artifact dirs | Gone. |

**Lesson:** retirement must be `(name, deletedAtSha)` or drop the retired entry on recreate. `#680` did not bump `@beep/identity`; `8ae9c8e4f5` did (`major`). Policy in §5.

---

### 2.4 `8852619f04` — `@beep/repo-codegraph` + catalog/reuse (2026-06-18)

**Commit:** `chore: remove repo-exports catalog + Reuse + effect-capability-kg` (175 files, +41 080 / −819 996)

This is the deletion of a **tooling subsystem**, not a product slice. It is the best analog for “the command must tear down generated per-package state, hooks, and turbo tasks that `create-package` never created.”

#### Deleted

- Entire `packages/tooling/library/repo-codegraph/**`
- `quality repo-exports-catalog` generator + `reuse` CLI
- `@beep/repo-utils` Reuse services
- ~84 tracked `**/.beep/repo-exports/catalog.shard.jsonc` shards (one of them, `packages/drivers/box`, was 324 578 lines)
- `standards/repo-exports.catalog.{jsonc,md}` (~5.6 MB)
- `effect-capability-kg` module + its goal/exploration packets
- `$RepoCodegraphId` composer
- `repo-exports:*` package scripts, `repo-exports:shard` turbo task, pre-push lefthook hook, `.gitignore` shard-tracking exceptions

#### Changeset

`.changeset/remove-repo-exports-catalog-reuse.md` uses empty frontmatter `{}` (“No package releases required”). Still pending today. Correct shape for a tooling-only delete.

#### Residue today

| Item | Status |
| --- | --- |
| `packages/tooling/library/repo-codegraph` | Gone. |
| Identity `$RepoCodegraphId` | Gone. |
| `goals/repo-codegraph-jsdoc` | **Still listed** in `goals/INDEX.md` as Exploratory. The packet is about a future slice inspired by the deleted catalog, not the deleted package itself — but the name collision will confuse `delete-package` packet scans. |
| `goals/codex-security-findings-2026-06-17/findings/CSF-034.md` | Historical “already-fixed by deletion” record. Correct. |
| `.codegraph/` at repo root | Unrelated modern CodeGraph index (gitignored). Not leftover from this package. |

**Lesson:** some packages own **repo-wide generated state** (catalog shards, hooks, turbo tasks). `delete-package` must have a “subsystem extras” hook: grep for the package name in `lefthook.yml`, `turbo.json` `tasks`, root `package.json` scripts, `.gitignore` exceptions, and `**/.beep/**`. `create-package` does not create those; deletion still has to look.

---

### 2.5 `f96c60ae42` — Konva + shared stub roles (2026-06-21, `#277`)

**Commit:** `chore: harden schema-first formatting models (#277)` (177 files, +1 683 / −3 902)

A schema-first PR that **also** deleted five empty-ish workspaces. Mixed intent is itself a finding: package deletion buried in an unrelated quality PR is how residue happens.

**Deleted:**

| Name | Path |
| --- | --- |
| `@beep/konva` | `packages/drivers/konva` (effect-only stub) |
| `@beep/shared-client` | `packages/shared/client` |
| `@beep/shared-config` | `packages/shared/config` |
| `@beep/shared-server` | `packages/shared/server` |
| `@beep/shared-ui` | `packages/shared/ui` |
| `@beep/shared-use-cases` | `packages/shared/use-cases` |

Identity lost ~97 lines (all six slugs + exports). `bun.lock` −101 lines. Knip ignore-workspace rows for those stubs were removed in the same commit (they had been left behind by `33c584b179`).

#### Recreate

`@beep/shared-use-cases` **exists again today** (`packages/shared/use-cases`, live in identity, tsconfig, Fallow, bun.lock). It is now the real PromotionGate / public-contract package, not the 2026-06 stub. Same name-reuse pattern as `@beep/ontology`.

`@beep/konva`, `@beep/shared-client`, `@beep/shared-config`, `@beep/shared-server`, `@beep/shared-ui` stay dead. No leftover artifacts.

#### Residue today

- Live configs are clean for the *dead* names.
- Architecture docs still say “the future `@beep/shared-use-cases/public`” in places — now accidentally true again.
- `goals/effect-native-migration/ops/progress.json` still lists the 2026-06 stub names.
- Fleet timing TSVs still mention `@beep/konva#test`.

**Lesson:** stub-role packages (`shared/{client,config,server,ui,use-cases}`) are cheap to delete and expensive to name. `delete-package` should warn when the slug is a **role noun** that architecture docs already reserved.

---

### 2.6 Form: delete → recreate → delete (`7b12960e2b` then `49b70014b1`)

**First delete:** `7b12960e2b` “saving” (2026-06-18) — 41 files, −14 507. A checkpoint that wiped `packages/foundation/ui-system/form` including a 3 837-line React test.

**Recreate:** `95675d42a3` / `1835383813` / PR `#259` (`ui-system-forms`) — full P1 form substrate, 17 fields, stories.

**Second delete:** `49b70014b1` `chore(repo): align packet redesign and refresh Effect reference (#661)` (2026-08-11) — 321 files, mixed with packet redesign and Effect refresh. Form was **one slice of a kitchen-sink commit**.

`@beep/form` at deletion time was a real package, not a stub:

- deps: `@beep/{identity,schema,ui}`, `@tanstack/react-form`, `effect`
- peers: `react` / `react-dom` ^19
- stories + `tsconfig.stories.json` + `beep:check:stories`
- Storybook wiring in `apps/storybook/{package.json,tsconfig.json,tsconfig.stories.json}`

#### Surfaces `49b70014b1` did update for form

- Identity `packages.ts` + `shape-stable.test.ts`
- Root `package.json`, `tsconfig.json`, `tsconfig.packages.json`
- `knip.jsonc`, `.fallowrc.jsonc`
- `standards/coverage.regression-baseline.jsonc`
- `standards/fallow.boundaries.{generated,provenance}.jsonc`
- `standards/fallow.health.regression-baseline.jsonc`
- `standards/jsdoc-documentation.inventory.{jsonc,md}` — **both** (unlike `#680`)
- `.changeset/crispening-p2-beep__form.md` — **deleted** (the opposite of `#680`’s retire-in-place strategy)
- Storybook app configs

`@beep/form` is **not** in `standards/changesets.retired-packages.json`. That is consistent with “delete the pending form changeset” rather than “allow the name to linger.”

#### Residue today

| Item | Status |
| --- | --- |
| Tracked source | Gone. |
| Untracked artifacts | **Yes** — `packages/foundation/ui-system/form/{.beep, .turbo, dist, node_modules}` still on disk (`git ls-files` = 0). Same class of leak as `#680`. |
| Committed JSDoc / coverage / identity / lockfile | Clean. |
| `.beep/ci/jsdoc-documentation.inventory.jsonc` | **Still has `@beep/form`** (1 hit). CI cache not invalidated. |
| Goals packet | No leftover `goals/form` directory. |

**Lesson:** even when the committed inventories are regenerated correctly, leftover `dist/` + `node_modules/` + `.turbo/` + `.beep/` remain until someone runs a purge. `delete-package` must delete the directory with `force + recursive`, not `git rm` alone.

Also: **kitchen-sink deletion commits hide misses.** `#661` is 321 files. Form’s leftover artifacts were invisible in review. A dedicated command with a printed checklist would have caught the untracked tree.

---

### 2.7 Honorable mention — `a39d949c9f` Tauri app `apps/V2T`

A “saving” commit that deleted a full Tauri + Vite app (`apps/V2T`) plus `infra/src/V2T.ts`, `infra/scripts/v2t-workstation.sh`, a Python sidecar, and 5 457 lines of `Cargo.lock`. Relevant to experimental **Tauri** apps:

- Must delete `src-tauri/**` (Cargo.toml/lock, icons, gen/schemas, capabilities).
- Must delete infra/Pulumi consumers if the app had a workstation stack.
- Must delete root/infra `package.json` script hooks.
- Cargo artifacts are not in `bun.lock`; `bun install` will not touch them.

No leftover `apps/V2T` today. Infra references are gone.

---

## 3. Reverse-dependency safety

### 3.1 What exists today

| Tool | Location | What it computes | Usable for delete? |
| --- | --- | --- | --- |
| `buildRepoDependencyIndex` | `packages/tooling/library/repo-utils/src/DependencyIndex.ts` | Every workspace + `@beep/root` → classified workspace vs npm deps (deps/dev/peer/optional). | **Yes — invert it.** |
| `extractWorkspaceDependencies` | `Dependencies.ts` | One manifest → workspace/npm split. | Building block. |
| `topologicalSort` / `detectCycles` / `computeTransitiveClosure` | `Graph.ts` | Edges are **package → dependency**. Closure is “what this package depends on,” not “what depends on this package.” | Invert the adjacency first. |
| `beep topo-sort` | `TopoSort.command.ts` | Prints dependency-first build order. | Not a dependents report. |
| `syncTsconfigAtRoot` | `TsconfigSync.service.ts` | Builds the same adjacency, plans references/aliases/syncpack/docgen. Fails on cycles. | Use after delete to prune derived configs; not a dependents gate. |
| `turbo query ls` | `Yeet/internal/TurboQuery.ts` | Workspace `{name, path}` catalog. Already decoded. | Resolve name → path. |
| `turbo query affected` | same | Affected **tasks** vs `--base/--head`. | Useful post-delete to see blast radius of the PR; **not** a dependents graph. |
| Turbo GraphQL `query` | used only for `ls` + `affected` | Turbo can answer dependents (`packages { items { name, dependents { items { name } } } }` in upstream Turbo), but **this repo does not call that query**. | Optional second opinion; do not make it the source of truth (Turbo sees the workspace graph, not file-path / script / Storybook consumers). |
| `bun pm ls` | not wrapped | bun’s package lister. | Not wired. Inferior to `buildRepoDependencyIndex` (no workspace/npm split, no typed errors). |
| `r3` E1 importer | `goals/speed-loop/research/r3-package-deletions.md` | Static `import` / `export` / `require` / `import()` whose specifier is exactly the package name or a subpath. | **Required second pass.** Manifest dependents ≠ import dependents. |
| `r3` E15 false-zero list | same | Root binaries, Storybook globs, `infra/**`, Biome Grit file-path loads, MCP hosts, db-admin migration bundles. | **Required third pass.** |

There is **no** `dependentsOf(pkg)` helper. `delete-package` should add one in `@beep/repo-utils` (or a DeletePackage internal module) that:

1. Builds `buildRepoDependencyIndex`.
2. Inverts workspace edges (all four dep fields).
3. Computes direct dependents and, via inverted `computeTransitiveClosure`, the reverse transitive set.
4. Runs an E1-style import scan over `packages/**` + `apps/**` + `infra/**` + `scratchpad/**`.
5. Runs an E15-style non-import scan:
   - root `package.json` `scripts` mentioning `--filter=@beep/<name>` or the path
   - `apps/storybook/.storybook/main.ts` globs
   - `biome.jsonc` plugin/file-path refs
   - `lefthook.yml`
   - `turbo.json` `tasks` (rare; currently generic)
   - `infra/src/**` string refs
   - `docgen.json` in *other* packages
   - `beep architecture` accepted-proof file-path reads
   - `standards/**` baselines (coverage, JSDoc, Fallow, schema-first, test-typecheck)
6. Classifies each hit: `manifest-prod`, `manifest-dev`, `import-prod`, `import-test`, `script`, `file-path`, `packet`, `baseline`, `historical-doc`.

### 3.2 What to do when dependents exist

| Situation | Default | Flagged escape |
| --- | --- | --- |
| Any `manifest-prod` or `import-prod` dependent | **Refuse.** Print the cascade (direct + reverse-transitive). | `--cascade` deletes/rewrites dependents **only** if every dependent is itself an `apps/experiments/*` or a `--also` listed package. Never cascade into `packages/foundation/**` or `@beep/identity`. |
| `manifest-dev` / `import-test` only | **Refuse.** Tests are still a contract. | `--allow-test-dependents` is too sharp; prefer rewriting the tests in the same PR (command prints the files, does not edit them unless `--rewrite-test-imports`). |
| `script` / `file-path` / Storybook glob | **Refuse.** | `--rewrite-refs` for mechanical path/name edits the command knows how to do (tsconfig-sync already covers aliases). |
| `baseline` only | Do not refuse — regen is a later phase. | n/a |
| `packet` / `historical-doc` | Warn. Refuse if packet `status` ∈ {`active`, `completed-retained`} **and** the packet’s `targets` / `appPackage` still names this package. | `--rewrite-packets` or `--allow-stale-packets`. |
| Slice with a live `shared/use-cases` promotion | **Refuse.** Architecture 11: dependents must migrate first; DECISIONS entry required. | No flag. This is a human process. |
| Published (`private: false`) package | **Refuse.** | `--allow-published` after a changeset policy is chosen. |

`r3` already proved that import-count = 0 is **not** “safe to delete” (`@beep/repo-cli` is the CLI, `@beep/db-admin` feeds the desktop migration bundle, `@beep/lint-rules` is loaded by file path). The command must encode those exceptions as scanners, not folklore.

---

## 4. Lockfile and install

### 4.1 What historical deletes did

Every first-party deletion regenerated `bun.lock` in the same commit. Deltas:

| Commit | `bun.lock` |
| --- | --- |
| `#680` | −43 lines (three workspace members + the unrelated better-auth drop) |
| `33c584b179` | −305 lines (apps + slices + their unique third-party edges) |
| `8ae9c8e4f5` | −65 lines |
| `8852619f04` | −19 lines |
| `f96c60ae42` | −101 lines |
| `49b70014b1` | present (form + Effect refresh noise) |

`create-package` already documents the inverse operation:

```ts
// CreatePackage.command.ts — refreshBunLockfile
args = ["install", "--lockfile-only"]
```

Dry-run text: `Lockfile: bun install --lockfile-only` (unless `--skip-lockfile`).

### 4.2 Is `bun install` after removal sufficient?

**For workspace protocol entries: yes.** After the directory and the `package.json` `workspaces` row are gone, `bun install --lockfile-only` drops `"@beep/courtlistener": ["@beep/courtlistener@workspace:packages/drivers/courtlistener"]`-style records. Confirmed: live `bun.lock` has **zero** hits for the six deleted names.

**For third-party deps only that package used:**

- Bun **does** drop lockfile nodes that no remaining workspace manifest references.
- Bun does **not** drop root `package.json` `catalog` pins. Knip’s `catalog` rule is explicitly `"off"` (`knip.jsonc`) because the catalog is a curated pre-provision registry.
- Bun does **not** drop root `devDependencies` that were only justified by the deleted package (the `#680` better-auth drop was a human call, bundled into the same PR for unrelated reasons).

`@beep/repo-utils` already has `collectUniqueNpmDependencies` (`UniqueDeps.ts`) — union of every remaining manifest’s npm deps/devDeps (peers/optionals folded into runtime). `delete-package` should:

1. Snapshot unique npm names **before** delete.
2. Delete + `bun install --lockfile-only`.
3. Snapshot again.
4. Report `npm deps that left the lockfile` vs `npm deps that remain only via catalog/root`.
5. **Never** auto-edit the catalog. Print candidates. Require `--prune-catalog` for catalog edits, and only after proving no other workspace lists that name.

`#680`’s deleted drivers had **no unique runtime deps** (catalog-only test tooling). Form had `@tanstack/react-form` (catalog) — leftover is a catalog pin, not a lockfile orphan. Stack-installer had `@tauri-apps/{api,cli}` (catalog) plus a whole Cargo.lock; JS install cannot prune Rust crates. Tauri deletes need a Cargo step (`cargo metadata` / just delete `src-tauri`).

**`bun install` (full, not `--lockfile-only`)** is still required locally to unlink `node_modules/@beep/<name>` and to delete the leftover package-local `node_modules/` that `#680` and the form delete left behind. `create-package`’s next-steps text already says “Run bun install to link the new package.” The inverse is “Run bun install to unlink, then rm the leftover dir.” Prefer the command doing both.

**Recommendation:** default `bun install` (not `--lockfile-only`) after delete, with `--lockfile-only` available for CI/check mode. Then `fs.remove(packageDir, { recursive: true, force: true })` if the directory still exists (untracked artifacts).

---

## 5. Changesets and versioning

### 5.1 The gate

`beep quality changeset-graph` (`ChangesetGraph.ts`):

1. Collects every workspace `package.json` `name` via `git ls-files` + workspace globs.
2. Parses every tracked `.changeset/*.md` frontmatter as a `{ [packageName]: bump }` map.
3. Fails if a referenced name is not in the workspace set **unless** it appears in `standards/changesets.retired-packages.json`.

Retired record schema: `{ packages: [{ name, rationale }] }`.

Live retired list:

```jsonc
@beep/messages          // deleted 2026-06-15, never recreated
@beep/ontology          // deleted 2026-06-15, RECREATED 2026-07, still listed
@beep/sandbox           // deleted 2026-06-15
@beep/courtlistener     // deleted 2026-08-13
@beep/dol               // deleted 2026-08-13
@beep/federal-register  // deleted 2026-08-13
```

### 5.2 Does a deletion need a changeset?

| Strategy | Used by | When it is right |
| --- | --- | --- |
| Empty frontmatter `{}` “No release” | `#680` (`honest-repo-signal.md`), `8852619f04` (`remove-repo-exports-catalog-reuse.md`) | Private workspaces, no published contract, no identity-composer consumers outside the deleted tree. |
| Bump `@beep/identity` **major** (+ maybe schema/observability) | `8ae9c8e4f5` | Composer exports are part of `@beep/identity`’s public surface. Removing `$SandboxId` is a breaking change for anyone who imported it. |
| Delete the package’s pending changesets | `49b70014b1` deleted `.changeset/crispening-p2-beep__form.md` | The pending bump is meaningless; dropping it avoids retired-list growth. |
| Keep pending changesets + add to retired list | `#680` | Historical crispening/docgen bumps remain as fossil records; the gate stays green. |

**Policy for `delete-package`:**

1. Always emit **one** changeset for the deletion itself:
   - default: `{}` “No release: remove `<name>` from the workspace.”
   - if the command removed identity composers that other *remaining* packages import (it should have refused — see §3), or if `@beep/identity` is treated as published: `"@beep/identity": major`.
2. For **pending** changesets that name only the deleted package: **delete the file** (form strategy). Cleaner than retirement.
3. For **pending** multi-package changesets that include the deleted name (e.g. `docgen-paths-prune.md`, `standards-remediation-wave2.md`): strip the key from frontmatter. If that leaves an empty map, convert to `{}` or delete if the body is only about the deleted package.
4. Add to `retired-packages.json` **only** if a changeset cannot be rewritten (merge-base already shipped the file to other branches, or the operator passes `--retire-changesets`). Record `deletedAt` / `sha` / `rationale`.
5. On **recreate** (`create-package` of a retired name): refuse unless `--reuse-retired-name`, and then **remove** the retired entry. Today `create-package` does not consult the retired list — that is a bug the sibling lane should close.

`#680` chose (4) for everything. That is why three dedicated crispening changesets still sit in `.changeset/` naming packages that do not exist. It works. It is not the shape `delete-package` should default to — it grows an allow-list that later name-reuse will corrupt (`@beep/ontology`).

### 5.3 Versioning / private

All six deep-dive packages were `"private": true`. Canvas-domain was `0.0.3`, stack-installer `0.0.4` — versions exist for changeset bookkeeping, not npm publish. `delete-package` should still refuse `private: false` without `--allow-published`, because a published disappearance is a registry event this repo has never performed.

---

## 6. Identity: structure, un-registration, breakage

### 6.1 How IDs are built

`packages/foundation/modeling/identity/src/Id.ts` + `src/packages.ts`:

- Root: `export const $I = Identity.make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" }).$BeepId`
- Registry: `const generatedComposers = $I.compose("infra", "chalk", …, "<slug>", …)`
- Export: `export const $FooBarId: Identity.IdentityComposer<"@beep/foo-bar"> = composers.$FooBarId`
- Accessor naming: `$${pascalCase(slug)}Id` (`courtlistener` → `$CourtlistenerId`, `federal-register` → `$FederalRegisterId`). Manual aliases exist (`$LangExtractId` → generated `$LangextractId`).
- Values: branded strings `@beep/{package}/{path}`, interned `Symbol.for(identifier)`, plus `iri` / `curie` metadata on annotations.

`create-package` writes both the compose argument and the export block (`CreatePackage/internal/IdentityRegistration.ts`). `beep lint identity-registry --fix` only **adds** missing slugs. It never removes extras.

`shape-stable.test.ts` enumerates a subset of composer exports as a public-surface freeze. `#680` and the form delete both edited this file. Extra leftover names in the freeze would fail the test; missing names in the freeze are allowed (older packages “lack shape-test entries” — `r3` E7).

### 6.2 What un-registration means

Invert of `ensureIdentityPackageRegistration`:

1. Remove `"<slug>"` from the `$I.compose(...)` argument list.
2. Remove the `export const $SlugId = …` block (and any manual casing alias).
3. Remove the name from `shape-stable.test.ts` if present.
4. Run `beep lint identity-registry` (must stay green — it will, because it does not flag extras; the value of running it is catching a *partial* edit).
5. Grep remaining source for `$SlugId` and `@beep/identity` imports of that binding. Any hit is a dependent the earlier phase should have refused.

Identity lint **gap** (must close, either in this command or in the lint): leftover composers after a hand-delete are silent. `delete-package` should own extra-composer removal so the gap is not load-bearing.

### 6.3 Is removing the id a breaking change?

| Consumer | Breaks? |
| --- | --- |
| TypeScript imports of `$CourtlistenerId` in remaining packages | Yes, immediately. `#680` had none (VERSION-only stub). Canvas had `packages/canvas/domain/src/identity/Canvas.ts` using its own composer — deleted in the same commit. |
| `@beep/identity` public export list | Yes, if anything outside the repo imported the composer. Treated as `major` by `8ae9c8e4f5`, ignored by `#680`. |
| Serialized Effect Schema annotations (`identifier`, `schemaId` symbol string, `iri`) already written to disk / DB / fixtures | **The string remains valid as a string.** Nothing in the runtime *resolves* a composer to accept a payload. Old `@beep/ontology/Fold` identifiers in fixtures keep decoding if the schema still uses that identifier; they do **not** start failing because the composer export disappeared. |
| Recreated package with the same slug | **Collision.** New `$OntologyId.make("Fold")` produces the same `@beep/ontology/Fold` as the 2026-06 package. Telemetry, fixtures, and baselines cannot tell them apart. |
| JSDoc inventory / docgen | Rows that name `$CourtlistenerId` go stale until regen. `.beep/ci` still has one. |
| Coverage / test-typecheck / Fallow baselines | Keyed by **package name**, not composer. Separate regen. |
| OpenTelemetry / AI metrics | No evidence that package-composer IDs are emitted as metric attributes today. Service keys use the composer at process start; a deleted package is not running. Low risk. |

**Policy:**

- Un-registering a composer is **source-breaking** for `@beep/identity` and for any remaining importer. Default: refuse if importers exist; if none exist, emit `{}` changeset unless `--identity-major`.
- Un-registering is **not** data-breaking for stored `@beep/<slug>/…` strings. Do not rewrite historical fixtures.
- Recreate of a retired slug is **data-ambiguous**. `create-package` must warn and require `--reuse-retired-name`. Prefer a new slug (`ontology-skos` vs reusing `ontology`).

Experiments under `apps/experiments/<name>` will mint `$<Name>Id`. Deleting the experiment must drop that composer or the identity registry will accumulate experiment fossils. That is the #1 reason `delete-package` has to exist before `create-package` grows an experiments variant.

---

## 7. Turbo, CI caches, and generated state

### 7.1 What is derived vs what is committed

| Artifact | Tracked? | How it is produced | After delete |
| --- | --- | --- | --- |
| `tsconfig.json` paths | yes | `beep tsconfig-sync` (`planRootAliasSync`) | **Regen** (sync). |
| `tsconfig.packages.json` refs | yes | `planRootReferenceSync` | **Regen**. |
| `syncpack.config.ts` source list | yes | `planRootSyncpackSync` | **Regen**. |
| Per-package `tsconfig.json` refs + `docgen.json` | yes | `planPackageReferenceSync`, `planPackageDocgenSync` | Drop with the tree; remaining packages lose edges automatically on sync. |
| `bun.lock` | yes | `bun install` | **Regen**. |
| `standards/coverage.regression-baseline.jsonc` | yes | `bun run coverage:baseline:write` | **Replace, not merge.** `CoverageRegression.ts` documents: “A replacement legitimately prunes packages that no longer exist.” `mergeCoverageBaselinePackagesForTesting` **keeps** stale names. `delete-package` must call the replacement writer, not the merge path. |
| `standards/jsdoc-documentation.inventory.{jsonc,md}` | yes | `bun run beep quality jsdoc-inventory` | **Regen both.** `#680` only touched `.md`. |
| `standards/fallow.boundaries.{generated,provenance}.jsonc` | yes | `bun run fallow:boundaries:write` / `beep fallow boundaries --write` | **Regen.** `--check` fails on drift. |
| `standards/fallow.health.regression-baseline.jsonc` | yes | fallow health writer | Regen (form delete did). |
| `standards/schema-first.inventory.jsonc` | yes | `beep lint schema-first --write` | Regen. `8ae9c8e4f5` / `33c584b179` did; `#680` had nothing to drop (stubs had no schemas). |
| `standards/schema-catalog.generated.jsonc` | yes | schema-catalog lint | Regen if the package contributed rows. Live file has no leftover driver rows. |
| `standards/test-typecheck.blindspot-baseline.jsonc` | yes | `beep lint package-test-typecheck --write-baseline` | Membership ratchet: **new** blinds fail; stale names sitting in the baseline stay green forever. Must rewrite so deleted packages leave. Live file is already clean for the six cases. |
| `standards/clone.inventory.jsonc` | yes | clone inventory | `33c584b179` updated. Regen if the package was a clone target. |
| `standards/effect-laws.allowlist.jsonc` | yes | laws snapshot | `33c584b179` / `8852619f04` updated. Regen if the package was on the allowlist. |
| `standards/changesets.retired-packages.json` | yes | hand-edited | See §5. |
| `knip.jsonc` | yes | hand-edited | Strip `ignoreWorkspaces` / `ignoreDependencies` rows that name the package (`33c584b179` did this for canvas). Current file has no leftover deleted names. |
| `turbo.json` | yes | generic tasks | **Do not edit** unless a named task/pipeline mentions the package (`8852619f04` removed `repo-exports:shard`). `#680`’s turbo edit was unrelated env. |
| `docs/<pkg>/**` | yes (generated) | `beep docgen` | Delete the tree; run bounded docgen so aggregates drop the row. `33c584b179` deleted `docs/canvas` etc. in-commit. |
| `.beep/**` (per package) | **gitignored** (`**/.beep/*`) | docgen/cache | **Must rm.** Leftover today for courtlistener/dol/federal-register/form. |
| `.beep/ci/jsdoc-documentation.inventory.*` | gitignored | CI mirror | Stale today for all four names including form. Delete or regenerate. |
| `.beep/yeet/**` | gitignored | yeet journals | Harmless; next yeet run rewrites. |
| `.beep/fallow/**` | gitignored | fallow raw | Regen with boundaries write. |
| `.turbo/` (root + per package) | gitignored | Turbo local cache | Leftover per-package logs today. `beep purge` already lists `.turbo` as a workspace artifact. Call purge for that path or `fs.remove`. Remote Turbo cache keys include package name; stale remote entries expire, no prune API required. |
| `.codegraph/` | gitignored | CodeGraph index | Not leftover-named today. After delete, operators re-run `scripts/setup-agent-memory.sh` / codegraph index. Command should **not** try to surgically edit the index. |
| `dist/`, `coverage/`, `node_modules/` | gitignored | build/test/install | Leftover today. Delete with the directory. |
| `docs/` inside the package dir | gitignored-or-tracked | docgen | Leftover untracked `docs/index.md` today for the three drivers. |
| Fleet timing TSVs / quality-speedup research | yes (research) | historical | **Leave.** Do not rewrite research packets. |
| `goals/**`, `explorations/**` | yes | authored | Honesty rewrite or `--allow-stale-packets`. |

`beep:preflight` already chains the regen set:

```
tsconfig-sync && fallow:boundaries:write && quality jsdoc-inventory
&& lint schema-first --write && quality test-tsgo
&& ci lane repo-sanity && ci lane jsdoc-ratchet && ci lane knip && lint policy
```

`delete-package` should invoke that chain (or the subset that is package-membership-sensitive) rather than inventing a parallel writer. Coverage baseline write is **not** in preflight; it must be called explicitly (`coverage:baseline:write`) because it is expensive.

### 7.2 `beep purge` vs `delete-package`

`Purge.command.ts` removes workspace artifacts (`.tsbuildinfo`, `dist`, `docs`, `.next`, `coverage`, `.turbo`, `storybook-static`, `node_modules`) and optional root `bun.lock`. It is **not** a package deleter. `delete-package` may call the same artifact list against the target path *before* `fs.remove` of the directory, so leftover ignored files cannot block the rmdir on some filesystems.

Architecture already has `ensure-absent-path` / `remove-if-present` (`Architecture.plan.ts`) for fixture cleanup. Reuse that operation kind if delete-package wants a plan/apply/check split like `beep architecture`.

---

## 8. Inverse of `create-package` (registration blast radius)

`create-package` currently writes, in order (`CreatePackage.command.ts`):

1. Package files from Handlebars templates (library / tool / `app` × `{nextjs, tauri, runtime-proof}`).
2. `package.json` (schema-encoded, `beep.family` / `beep.kind` metadata).
3. `CLAUDE.md` → `AGENTS.md` symlink.
4. Root `package.json` `workspaces` row **only if** no existing glob covers the path (`ensureRootWorkspaceEntry`). Most packages live under an explicit list, not a glob — experiments will likely need an explicit `apps/experiments/<name>` row unless a glob `apps/experiments/*` is added.
5. Identity compose + export (`ensureIdentityPackageRegistration`).
6. `syncTsconfigAtRoot({ mode: "sync" })` → tsconfig refs/aliases, syncpack, per-package docgen.
7. `bun install --lockfile-only`.

Dry-run prints: files, workspace add/skip, identity add/skip, “shared sync runs after scaffolding…”, lockfile action.

**`create-package` does not write** (so `delete-package` must still know about them):

- coverage baseline
- JSDoc inventory
- Fallow boundaries / health
- schema-first inventory / schema catalog
- test-typecheck baseline
- knip ignore rows
- changesets / retired-packages
- `docs/<pkg>`
- goals/explorations honesty
- leftover artifact dirs (it never creates `dist/`, but the first `beep:build` will)
- Storybook globs (form needed a manual storybook edit)
- `lefthook.yml` / extra turbo tasks
- DECISIONS.md
- CODEOWNERS
- Tauri `src-tauri` beyond the templates (icons are templated; `Cargo.lock` is generated on first `tauri dev`)

`delete-package` is therefore **not** a literal undo of `create-package`. It is undo + “everything the package accumulated while it lived.”

App-kind extras the command must know (from templates + V2T / stack-installer / canvas history):

| Kind | Extra delete set |
| --- | --- |
| `nextjs` | `.next/`, `next-env.d.ts`, `next.config.ts`, `src/app/**` |
| `tauri` | `src-tauri/**` (Cargo.toml/lock, `target/` if present, icons, capabilities, gen/schemas), `index.html`, Vite configs, possible `infra/src/<Name>.ts` |
| `runtime-proof` | proof scripts under `src/proof/**` |
| slice (`beep architecture`) | role packages (`domain`/`use-cases`/`server`/`client`/`ui`/`tables`/`config`) + app + `docs/<slice>` + identity composers for **each** role slug |

---

## 9. Requirements checklist for `beep delete-package`

### 9.1 CLI shape (mirror create-package)

```
beep delete-package <name-or-path>
  --dry-run
  --check                  # exit non-zero if residue would remain / dependents exist
  --skip-lockfile
  --skip-baselines         # dangerous; refuse on CI
  --retire-changesets      # keep fossils + retired-packages.json (non-default)
  --identity-major         # bump @beep/identity in the deletion changeset
  --cascade                # only for experiment-to-experiment edges
  --also <name>            # explicit extra targets for cascade
  --rewrite-packets        # honesty edits in goals/*/ops/manifest.json
  --allow-stale-packets
  --allow-published
  --prune-catalog          # still requires uniqueness proof
  --force                  # does NOT override dependents; only overrides "dirty extra files in the package dir"
```

Resolve `<name-or-path>` via `turbo query ls` / `resolveWorkspaceDirs`: accept `@beep/foo`, `foo`, or `packages/drivers/foo`.

### 9.2 Ordered phases

**Phase 0 — resolve.** Load manifest. Record `name`, `path`, `private`, `beep.family`/`kind`, `version`, dep sets, whether `src-tauri` exists, whether a goals packet claims it.

**Phase 1 — dependents (hard gate).** Run the three-pass scan (§3). Print the cascade. **Refuse** per the table in §3.2. `--check` / `--dry-run` still run this and report.

**Phase 2 — classify + refuse-without-flag.** See §9.4. Exit here if any hard refuse fires.

**Phase 3 — plan (always printed).** A schema-versioned plan (steal `CanonicalSliceOperationPlan` / `ensure-absent-path`):

- files to delete (tracked `git ls-files <path>` + untracked artifact glob)
- config keys to drop (workspace row, identity slug, shape-stable name)
- derived sync (`tsconfig-sync`)
- changesets to delete / rewrite / retire
- baselines to regenerate
- lockfile action
- packet honesty edits
- extra subsystem grep hits (`lefthook.yml`, `turbo.json` tasks, root scripts)

`--dry-run` stops here. `--check` computes the plan against a hypothetical post-delete tree (or applies in a temp worktree) and exits 1 if the plan is non-empty *or* if dependents exist *or* if live residue already exists for a previously deleted name (doctor mode).

**Phase 4 — prune configs that still point at a living tree.** Identity un-register. Strip root workspace entry if it is an exact path (do not break a glob `apps/experiments/*`). Do **not** hand-edit tsconfig/syncpack — leave that to Phase 6.

**Phase 5 — changesets.** Apply §5.2. Write the deletion changeset.

**Phase 6 — remove files.** `git rm -r --ignore-unmatch -- <path>` for tracked files (or invoke `git rm` only for the non-empty result of `git ls-files -- <path>`; a wholly untracked scaffold — e.g. a lab created and deleted in one session — makes plain `git rm` exit 128 with "pathspec did not match"), then `fs.remove(path, { recursive, force })` for the leftover ignored tree. For Tauri, also remove `src-tauri/target` if present. For slices, iterate every role path from the architecture plan.

**Phase 7 — derived sync.** `syncTsconfigAtRoot({ mode: "sync" })`. This is the same function create-package uses; it will drop aliases/refs/syncpack rows because the workspace is gone.

**Phase 8 — reinstall.** `bun install` (default) or `bun install --lockfile-only`. UniqueDeps before/after report. Optional `--prune-catalog`.

**Phase 9 — regen baselines.** In this order (cheap → expensive):

1. `beep fallow boundaries --write`
2. `beep quality jsdoc-inventory` (both artifacts)
3. `beep lint schema-first --write` (if the family used schemas)
4. `beep lint package-test-typecheck --write-baseline` (membership only; do not grow the baseline)
5. schema-catalog write if the package had catalog rows
6. `bun run coverage:baseline:write` (replacement, not merge)
7. Delete `.beep/ci/jsdoc-documentation.inventory.*` so CI cannot reuse a stale mirror

**Phase 10 — verify.**

- `rg` exact `@beep/<name>` over `package.json`, `bun.lock`, `tsconfig.json`, `tsconfig.packages.json`, `syncpack.config.ts`, `packages/foundation/modeling/identity/src/packages.ts`, `standards/*.{jsonc,json}`, `knip.jsonc`, `lefthook.yml`, `turbo.json`.
- `test ! -d <path>` (the `#680` honest-repo-signal acceptance test).
- `beep lint identity-registry`
- `beep quality changeset-graph`
- `beep tsconfig-sync --mode check`
- `beep fallow boundaries --check`
- `beep lint package-test-typecheck`
- Import-scan E1 == 0
- Optional: `beep yeet verify` (operator, not default — too heavy)

**Phase 11 — honesty (optional / flagged).** Packet manifest rewrite; DECISIONS entry for slices; architecture-11 sunset skipped only with the pre-v1 waiver text.

### 9.3 What dry-run / check must show

Mirror create-package’s printer, inverted:

```
[dry-run] Would delete package @beep/courtlistener (family: drivers)
[dry-run] Path: packages/drivers/courtlistener
[dry-run] Dependents:
  - manifest-prod: (none)
  - import-prod:   (none)
  - import-test:   (none)
  - script:        (none)
  - file-path:     (none)
  - packet:        goals/honest-repo-signal (status=active, honesty-ok)
                   goals/gov-legal-data-driver-delivery (status=won't-do-until-product-pull)
  - baseline:      standards/jsdoc-documentation.inventory.jsonc (stale row)
                   .beep/ci/jsdoc-documentation.inventory.jsonc (stale cache)
[dry-run] Tracked files: 10
[dry-run] Untracked artifacts:
  - packages/drivers/courtlistener/{.beep,.turbo,dist,node_modules,docs}
[dry-run] Root bootstrap removals:
  - package.json workspaces: remove "packages/drivers/courtlistener"
  - identity packages.ts: remove "courtlistener" and export $CourtlistenerId
  - shape-stable.test.ts: remove $CourtlistenerId
[dry-run] Derived repo configs: tsconfig-sync (aliases, references, syncpack, docgen)
[dry-run] Changesets:
  - write .changeset/delete-<name>.md with frontmatter {}
  - delete .changeset/crispening-p2-beep__courtlistener.md
  - rewrite .changeset/docgen-paths-prune.md (strip key)
  - rewrite .changeset/standards-remediation-wave2.md (strip key)
[dry-run] Baselines: fallow, jsdoc (jsonc+md), coverage replacement, invalidate .beep/ci
[dry-run] Lockfile: bun install
[dry-run] Refuse: (none)
```

`--check` uses the same plan, applies nothing, exits:

- `0` if dependents empty **and** a live delete would produce an empty residue set after the planned edits
- `1` if dependents exist, or if residue already exists for a name that is not a workspace (doctor: “this package was deleted dirty”)
- `2` reserved for plan/IO errors

Doctor mode (`beep delete-package --check courtlistener` after `#680`) would fail **today** on leftover artifacts + JSDoc jsonc + pending changesets. That is the acceptance test for the command.

### 9.4 What MUST refuse without a flag

Hard refuses (no `--force` override — `--force` is only for dirty extra files inside the target dir):

1. **Any production dependent** (manifest or import), including `infra/**` and root binaries (`r3` E15).
2. **Test-only dependents** (unless a future `--rewrite-test-imports` lands and actually rewrites them).
3. **Live identity-composer importers** outside the target tree.
4. **`private: false`** without `--allow-published`.
5. **Slice with a live shared-kernel promotion record** (architecture 11). No flag.
6. **Protected slugs:** `identity`, `schema`, `utils`, `types`, `repo-cli`, `repo-utils`, `repo-configs`. Experiments must not be allowed to collide with these.
7. **Name is in `retired-packages.json` and a *different* live package now owns it** — that is a recreate, not a delete. (Delete of the *new* ontology should not inherit the old retirement rationale.)
8. **`--cascade` whose closure includes a non-experiment, non-`--also` package.**
9. **`--skip-baselines` in CI** (`CI=true` / `GITHUB_ACTIONS`).
10. **`--prune-catalog` without a uniqueness proof** (another workspace still lists the npm name).

Soft refuses (warn + require an explicit yes-flag):

- Active / completed-retained packet still claims the package (`--rewrite-packets` or `--allow-stale-packets`).
- Pending multi-package changeset cannot be rewritten cleanly (`--retire-changesets`).
- Tauri app with an `infra/` stack (`--also infra-target` or a printed manual step).
- Uncommitted dirty files **outside** the target path (do not sweep the operator’s other work).
- Running on `main` (PR-only culture; print “open a branch”). Not a hard refuse — operators can delete on a feature branch named anything.

`--force` must **not** mean “ignore dependents.” Historical kitchen-sink commits already proved that override would be used to ship residue.

---

## 10. Experiments-specific implications

The overall mission wants `apps/experiments/*` via `create-package` variants. Deletion prior art says:

1. Add a **glob** `apps/experiments/*` to `package.json` workspaces so create does not append one row per experiment and delete does not have to edit `package.json` for membership. `#680` had to edit an explicit list because drivers are listed explicitly.
2. Identity composers for experiments **will** accumulate. `delete-package` is mandatory, not optional, the first time someone scaffolds `apps/experiments/foo`.
3. Treat experiments as **pre-v1** (Stack Installer waiver): no sunset window, no compatibility alias, same-PR consumer migration, DECISIONS optional unless the experiment promoted a shared export.
4. Default `--cascade` allowed **only** among `apps/experiments/*` (e.g. experiment app + its throwaway `packages/experiments/foo-domain`). Never cascade into `packages/foundation/**`.
5. Packet honesty: an experiment that graduated into `goals/` must not be deleted without rewriting the packet. An experiment with no packet can die silently.
6. Tauri / Next extras from §8 apply unchanged.
7. Doctor mode should be what `beep yeet verify` calls after an experiment is removed by hand, until the command exists.

---

## 11. Mapping onto `r3-package-deletions.md`

`r3`’s mechanical recipe is still correct as a *minimum* and is now field-tested:

1. Delete the directory (but `git rm` alone leaves ignored artifacts — **amend r3**).
2. Remove workspace path, run tsconfig-sync (do not hand-edit).
3. Remove identity slug + export + shape-stable; `rg` not assume all three exist.
4. Regen `bun.lock`; do not drop catalog versions without a consumer audit.
5. Regen coverage, test-typecheck, Fallow, JSDoc **jsonc and md**, schema catalog, schema-first.
6. Delete `docs/**`; turbo.json usually untouched.
7. Prove absence with E1 + exact-name search + Yeet lanes.

**Amendments this lane adds to r3:**

8. `fs.remove` the leftover ignored tree; call the purge artifact list.
9. Invalidate `.beep/ci` inventory mirrors.
10. Changeset policy: delete/rewrite first, retire last; never leave a live name on the retired list.
11. Packet honesty gate.
12. Three-pass dependents (manifest / import / non-import).
13. Identity extra-composer removal (lint will not save you).
14. Coverage **replacement** writer, not merge.
15. Name-reuse / retired-list hygiene.
16. Do not bury deletes inside unrelated PRs (`#277`, `#661`).

Remaining `r3` candidates (`@beep/acp`, `@beep/pacer`, `@beep/discord`, `@beep/tailscale`, `@beep/protobuf`) are still live. `delete-package` should be the vehicle for those PRs, not another hand commit.

---

## 12. Open questions for the other lanes

- **Lane 1 (create-package anatomy):** should create grow `--type app --app-kind experiment` that registers under a glob and stamps `beep.experiment = true` so delete can detect the waiver class without path heuristics?
- **Lane 2 (registration blast radius):** confirm the full tsconfig-sync change set and whether syncpack source lists can stay glob-only (`packages/foundation/ui-system/*/package.json` already is — form died without a syncpack *row* if the glob stayed). Explicit driver rows are the failure mode.
- **Lane 3 (apps anatomy):** Tauri `Cargo.lock` + infra stack ownership for experiments.
- **Lane 4 (governance gates):** whether identity-composer removal is always `major` on `@beep/identity` once experiments start minting composers daily (probably **no** — that would make experiment delete a release event; keep `{}` and treat identity majors as “a non-experiment composer died”).
- **Lane 6 (goals packets):** `goals/canvas` `completed-retained` after deletion is a packet-status bug. Delete-package should not be the thing that invents a `completed-withdrawn` status, but it needs a status to write.

---

## Appendix A — Live residue cheat sheet (this checkout, 2026-08-13)

| Target | Tracked source | Untracked dir | bun.lock / tsconfig / identity / coverage / Fallow | JSDoc jsonc | `.beep/ci` JSDoc | Pending changesets | Packets |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `@beep/courtlistener` | gone | **yes** | clean | **stale** | **stale** | **3 files** (retired) | honesty-rewritten |
| `@beep/dol` | gone | **yes** | clean | **stale** | **stale** | **3 files** (retired) | honesty-rewritten |
| `@beep/federal-register` | gone | **yes** | clean | **stale** | **stale** | **3 files** (retired) | honesty-rewritten |
| `@beep/form` | gone | **yes** | clean | clean | **stale** | clean (changeset deleted) | no packet |
| `@beep/canvas*` / apps | gone | gone | clean | clean | n/a | clean | **`goals/canvas` completed-retained** |
| `@beep/stack-installer` | gone | gone | clean | clean | n/a | clean | DECISIONS retired |
| `@beep/sandbox` / `@beep/messages` | gone | gone | clean | clean | n/a | identity-major changeset still pending | retired list |
| `@beep/ontology` | **LIVE (recreated)** | n/a | live | live | live | retired list **still names it** | new packet |
| `@beep/shared-use-cases` | **LIVE (recreated)** | n/a | live | live | live | n/a | architecture docs |
| `@beep/konva` / other shared stubs | gone | gone | clean | clean | n/a | clean | migration ledger only |
| `@beep/repo-codegraph` | gone | gone | clean | clean | n/a | `{}` changeset pending | `goals/repo-codegraph-jsdoc` still listed |

## Appendix B — Command inventory (nothing to extend vs something to write)

| Existing command | Relationship to delete |
| --- | --- |
| `beep create-package` | Inverse registrar. Steal dry-run, identity helpers, lockfile refresh, `syncTsconfigAtRoot`. |
| `beep tsconfig-sync` | Phase 7. Already has `sync` / `check` / `dry-run`. |
| `beep lint identity-registry` | Completeness only. Needs an extras check or delete-package owns extras. |
| `beep quality changeset-graph` | Phase 10 verifier. Retired-list reader. |
| `beep fallow boundaries` | Phase 9 writer + Phase 10 `--check`. |
| `beep quality jsdoc-inventory` | Phase 9. Must write **both** artifacts. |
| `beep lint schema-first` / schema-catalog / package-test-typecheck | Phase 9. |
| `beep coverage --write-baseline` | Phase 9 replacement writer. |
| `beep purge` | Artifact glob. Call on the target path. |
| `beep topo-sort` | Not dependents. |
| `beep architecture` | `ensure-absent-path` plan/apply/check is the UX to copy; slice delete should reuse role topology. |
| `beep yeet verify` | Optional Phase 10. `turbo query ls/affected` already wrapped. |
| **`beep delete-package`** | **Does not exist. Write it.** |

## Appendix C — Suggested first implementation slice

Do not boil the ocean. First PR:

1. `beep delete-package` for a **zero-consumer VERSION-only driver** (replay `#680` against `@beep/protobuf` or a freshly created experiment).
2. Phases 1, 4–8, 10 exact-name `rg`, leftover-dir `rm`.
3. Changeset strategy: delete dedicated files + `{}` deletion note (no retired-list growth).
4. Doctor mode that fails on today’s courtlistener residue (artifacts + JSDoc jsonc + pending changesets) — fix that residue in the same PR as the command’s acceptance test.
5. Defer cascade, catalog prune, packet rewrite, identity-major, and slice/tauri extras to PR 2.

That is the smallest command that would have made `#680` complete.

---

*End of lane 5 report.*
