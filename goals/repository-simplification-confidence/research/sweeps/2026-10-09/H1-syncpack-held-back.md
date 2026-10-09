# Gap follow-up 2: syncpack compatibility holds (brief 2.H1)

## Gap follow-up (2.H1 ("for retained overrides and holds, record consumer, failure evidence, owner, and exit condition; when an exit condition is met, run compatibility proof and remove or explicitly renew"))

**Provenance.** Checkout `beep-effect3-worktrees/rsc-packet` (sibling worktree root), head `e62411d63f` (= main), swept 2026-10-09. The sweep was read-only: no installs and no writes to the checkout.
Commands used: `cat -n syncpack.config.ts`; `jq` over `package.json` and `node_modules/<pkg>/package.json`;
`git grep` over `**/package.json` and `*.ts(x)` imports; `git log -S/-G` on `syncpack.config.ts`, `package.json`, `tsconfig.base.json`;
`npm view <pkg> dist-tags|time|peerDependencies|dependencies|optionalDependencies --json`;
`gh api repos/<o>/<r>/issues/<n>`, `gh api repos/<o>/<r>/releases/tags/<t>`, `gh release list -R <o>/<r> --limit 5`.
The H1-syncpack-held-back sweep did not exist, so this file was written fresh.

### 1. The hold group itself

- `syncpack.config.ts` `updateGroups[0]` (lines 128-194): label `"Held back — do not auto-update (see changeset portless-default-react-grab-storybook)"`, `isIgnored: true`, with 15 dependency patterns: `typescript`, `lexical`, `@lexical/**`, `jsdom`, `fast-xml-validator`, `detailed-xml-validator`, `@biomejs/biome`, `@effect/tsgo` and its 7 platform binaries.
- The group is consumed by `package.json` script `deps:update` = `bunx syncpack update --target=latest --dependency-types=catalog` (line 396). Because of `--dependency-types=catalog`, only catalog entries are in scope. `detailed-xml-validator` exists only in root `overrides` (`"detailed-xml-validator": "2.1.0"`, line 333), so its hold entry is **inert** under this script. Only the override pin holds it.
- `versionGroups` (lines 195-232) contain no holds. They cover root unversioned (ignored), catalog highestSemver, `workspace:^` for `@beep/**`, peers ignored, and root third-party devDeps → `catalog:`.
- The only owner of record is `.github/CODEOWNERS`, which has the single rule `* @kriegcloud`. No hold names a per-hold owner.
- Holds were added in these commits:
  - `72c73cf0af` (#428, 2026-07-17): group created, with typescript and fast-xml.
  - `d1dfc4b3c1` (#587, 2026-08-06): biome 2.5.6 pin.
  - `4cb63ad058` (#639, 2026-08-10): tsgo plus binaries and the "0.33.0 / eleven rules" text.
  - `94c66a72ab` (#1173, 2026-09-22): lexical and jsdom.
  - `fa11bb4bec` (#1225, 2026-09-24): typescript-eslint#10940 text and the knip clause.

### 2. Comment facts that contradict head

| # | Comment claim (syncpack.config.ts) | Head fact | Evidence |
|---|---|---|---|
| C1 | "0.33.0 is adopted with eleven such rules parked at "off"… moving off 0.33.0 without clearing that queue lands them all at once" (lines 156-158) | Catalog and installed `@effect/tsgo` = **0.47.2** (`package.json` catalog line 37; `node_modules/@effect/tsgo` 0.47.2). Bumps since then: `90c199a25f` 0.39 (#958), `b1aa7e320c` 0.45.0 "every rule at error" (#1200), `886de7a261` 0.47.2 (#1367). `tsconfig.base.json` has **2** off rules, not 11. The tree at `4cb63ad058` itself had **0** `"off"` entries, so the "eleven parked" claim was already false when it landed. | `git show <rev>:tsconfig.base.json \| grep -c '"off"'` gives 0 at 4cb63ad058, 90c199a25f and b1aa7e320c, and 3 matches at 886de7a261 (2 rules plus 1 comment line) |
| C2 | "knip 6 parses with oxc, so [it doesn't] need this pin" (lines 137-139) | Knip is on the brief's RETIRE list (stage-1 facts: `patches/knip@6.40.0.patch` RETIRE). The clause is stale once workstream A lands. The same clause appears in `docs/runbooks/typescript-toolchain.md` ("Why `typescript@6` cannot go yet" table, knip row). | `git log -S "knip 6 parses with oxc"` points to `fa11bb4bec` |
| C3 | Label cites changeset `portless-default-react-grab-storybook` | The changeset exists (`.changeset/portless-default-react-grab-storybook.md`). It is the #428 portless/react-grab changeset, and its body mentions only the original typescript/tsgo-0.19/fast-xml-validator holds. Biome, tsgo-0.33, lexical and jsdom rationale live in other changesets: `.changeset/tsgo-033-adoption.md` and `.changeset/dependency-refresh-2026-09-21.md`. The label therefore points to an incomplete and partly stale source (it says tsgo "stays at 0.19"). | `grep -n -i "tsgo\|xml\|typescript" .changeset/portless-default-react-grab-storybook.md` matches lines 28-39 |
| C4 | "typescript-eslint#10940, still open 2026-09-24" | Still open as of 2026-10-09 (updated 2026-09-29, 23 comments). The claim is accurate but carries an old date. | `gh api repos/typescript-eslint/typescript-eslint/issues/10940` returns `open` |
| C5 | Biome note says the 2.5.7 regression is why it is "Pinned exactly" | Accurate: catalog `"@biomejs/biome": "2.5.6"` (line 9). No upstream Biome issue is cited anywhere: neither the commit body `d1dfc4b3c1` nor the comment links one. | `git show -s d1dfc4b3c1` |

### 3. Per-hold evidence

**typescript** (catalog `^6.0.3` line 250; root devDep `catalog:` line 304; installed 6.0.3; `@typescript/native` = `npm:typescript@^7.0.2` line 45)
- Manifest consumers: 19 manifests (apps/*, infra/*, `packages/ecosystem/effect-drizzle`, `packages/foundation/ui-system/editor`, scratchpad, and a repo-utils test fixture).
- Classic API importers in live source:
  - `packages/ecosystem/effect-drizzle/test/import-boundary.test.ts`
  - `packages/tooling/policy-pack/repo-configs/test/EffectTsgoEffectFnPolicy.test.ts`
  - Others are in `explorations/` and `scratchpad/`.
- Peer-driven consumers:
  - `@typescript-eslint/parser` 8.71.1 (catalog line 133), with peer `typescript >=4.8.4 <6.1.0` on both 8.71.1 and canary 8.71.2-alpha.1.
  - tstyche 7.2.2 installed (only `packages/ecosystem/effect-drizzle`), with peer `>=5.4`.
  - commitlint (`@commitlint/*` ^21.2.3).
- Upstream:
  - typescript `latest` = 7.0.2 (2026-07-08). `next` = 7.1.0-dev.20261009.1, so **7.1 is not released**.
  - typescript-eslint#10940 is open.
  - bun#33834 closed 2026-08-06; the comment already records this.
  - tstyche latest 7.2.5 (2026-09-10), with no TS7 backend noted.
- Exit met: **no**.

**lexical + @lexical/\*\*** (catalog `lexical ^0.50.0` line 194 and 11 `@lexical/*` entries at lines 56-66, all `^0.50.0`; installed 0.50.0, 26 dirs under `node_modules/@lexical`)
- Manifest consumers: `apps/professional-desktop`, `packages/foundation/modeling/lexical`, `packages/foundation/ui-system/editor`, `packages/foundation/ui-system/ui`, scratchpad.
- Import sites: editor 27 files, ui 5, modeling/lexical 1, professional-desktop 2. `LexicalComposer` appears in 16 files.
- Failure evidence: Biome `noDeprecatedImports` on 0.51 (`.changeset/dependency-refresh-2026-09-21.md` lines 26-31).
- Upstream: 0.51.0 (2026-09-17), 0.52.0 latest (2026-09-28). Exit = the `LexicalExtensionComposer` migration in-repo, so it is internal work.
- Exit met: **no**. `git grep LexicalComposer` still finds 16 files, and no migration packet was found.

**jsdom** (catalog `30.0.1` exact, line 190; installed 30.0.1)
- Consumers: 10 manifests (labs lejeune-bolt/semantica/trustgraph, oip-web, professional-desktop, todox, modeling/html, ui-system/brand, dock-react, editor) and 35 files with a jsdom vitest environment.
- Failure evidence: "'addEventListener' called on an object that is not a valid instance of EventTarget" from vitest `catchWindowErrors` on 30.1.0 (`.changeset/dependency-refresh-2026-09-21.md` line 31). No upstream issue is linked.
- Upstream:
  - jsdom 30.1.1 (2026-09-22) and 30.1.2 (2026-10-04): the notes fix several 30.1.0 regressions (focus/blur, slow DOM, negative sizing). None mentions EventTarget or addEventListener.
  - vitest 5.0.3 (installed, 2026-09-30) ships "Support Blob on jsdom 30.1" (vitest-dev/vitest#11379, closed).
  - `gh search issues` found no matching jsdom or vitest issue for the EventTarget symptom.
- Exit met: **unknown**. A candidate exists (vitest 5.0.3 + jsdom 30.1.2), but only a compatibility run can decide it.

**fast-xml-validator** (catalog `1.2.0` exact, line 178; installed 1.2.0)
- Consumers: `packages/foundation/modeling/schema/src/Xml.ts:16` and `packages/tooling/tool/cli/src/commands/Research/Library/Library.evidence.ts:18` (`SyntaxValidator`).
- Failure evidence: 1.3+ pulls `@nodable/flexible-xml-parser`, which references `Buffer` at module scope and breaks browser bundles.
- Upstream: 1.4.2 latest (2026-08-15) depends on `detailed-xml-validator ^2.2.0`, which depends on `@nodable/flexible-xml-parser ^1.11.2`. The chain is unchanged.
- Exit condition: none is written. Exit met: **no** (no exit condition is defined; the dependency chain is still present).

**detailed-xml-validator** (root `overrides` `2.1.0` line 333, not in the catalog; installed 2.1.0; parent `fast-xml-validator@1.2.0`, per `bun.lock` line 6979)
- Consumer: transitive only.
- Upstream: 2.2.0 latest (2026-07-16) still depends on `@nodable/flexible-xml-parser`.
- The hold entry is inert for `deps:update` (catalog-only).
- Exit met: **no** (no exit condition is defined).

**@biomejs/biome** (catalog `2.5.6` exact, line 9; root devDep line 270; installed 2.5.6)
- Consumers: `packages/tooling/library/repo-utils` (`src/schemas/BiomeJson.ts` `renderBiomeJson`) and `packages/tooling/policy-pack/lint-rules`. Further stdin callers: `packages/tooling/library/codegen-kit/src/internal/format.ts:73` and `packages/tooling/tool/cli/src/commands/Cache/Cache.pilot.ts:1241`.
- Failure evidence: the sync-drift proof failed on 2.5.7 (commit body `d1dfc4b3c1`).
- Upstream: 2.5.15 latest (2026-09-30). The 2.5.8-2.5.15 release notes mention stdin twice, and neither is a JSON-formatting fix:
  - 2.5.11 #11389 (Astro/Svelte/Vue HTML via `--stdin-file-path`)
  - 2.5.12 #11576 (unicode via stdin)
- Exit met: **unknown**. The fix is not confirmed in the notes, and no upstream issue was ever filed or linked.

**@effect/tsgo + 7 platform binaries** (catalog lines 37-44, all `0.47.2`; `devDependencies` line 276; root `overrides` lines 317-323 `catalog:`; installed 0.47.2, with only the `linux-x64` binary on disk)
- Consumer: `tools/tsgo-shim/package.json`. Mechanism: `docs/runbooks/typescript-toolchain.md` "Binary paths".
- Failure evidence: wrapper/binary drift (0.24.3 binaries under a 0.19.0 wrapper).
- The written exit condition is clearing an "eleven off rules" queue that does not exist (see C1). The real gate is `beep quality tsgo-rules` (rule set must equal the installed compiler; all `error` except `tsgoDisabledRules`).
- Upstream: 0.51.1 latest (2026-10-07), with 0.48.0, 0.48.1, 0.49.0, 0.50.0 and 0.51.0 released since 2026-10-02. 0.51.1 `optionalDependencies` pin all seven binaries exactly at 0.51.1.
- This is not a hold with an external exit. It is a "move in lockstep via a ratchet PR" policy, and head is 4 minors behind.
- Exit met: **n/a**. Renew it as a lockstep policy and replace the stale text.

### 4. tsconfig.base.json diagnosticSeverity "off" rules

`tsconfig.base.json` `compilerOptions.plugins[@effect/language-service].diagnosticSeverity` (lines 102-230) has 118 explicit entries: 116 `"error"` and 2 `"off"`.

| Rule | Line | Declared reason (`packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts` `tsgoDisabledRules`) | Parked by |
|---|---|---|---|
| `experimentalApiUsage` | 143 | "Experimental-tagged Effect APIs are adopted deliberately…" | `886de7a261` (#1367, 2026-10-01) via `git log -S '"experimentalApiUsage": "off"'` |
| `unstableApiUsage` | 229 | "The repository builds on effect/unstable/* modules by design…" | `886de7a261` (#1367, 2026-10-01) |

Both rules are permanent design waivers enforced by `beep quality tsgo-rules`. Neither waits on a ratchet, so the "parked off pending a one-rule-per-PR ratchet" hold is empty at head. Earlier `"off"` history in this file: `447ea2eb60` (2026-05-16, "enable all effect tsgo diagnostics") and `0c25ebdd55` / `90847441c6` / `3dcf77a7f9` (2026-02..04). Commits `4cb63ad058`, `90c199a25f` and `b1aa7e320c` have zero `"off"` entries.

### 5. Hold-register draft

| Package | Consumer | Failure evidence | Owner | Exit condition | Exit met | Evidence |
|---|---|---|---|---|---|---|
| typescript (^6 classic) | typescript-eslint parser 8.71.1, tstyche (effect-drizzle), commitlint, 2 live test files | typescript-eslint peer `<6.1.0`; TS 7.0 has no programmatic API | @kriegcloud (CODEOWNERS `*`) | typescript-eslint and tstyche release against the TS 7.1 API | no | `gh api repos/typescript-eslint/typescript-eslint/issues/10940` (open); `npm view typescript dist-tags` (7.1 only `-dev`); `npm view @typescript-eslint/parser@8.71.1 peerDependencies` |
| lexical, @lexical/** (0.50) | ui-system/editor (27 files), ui (5), modeling/lexical, professional-desktop | Biome `noDeprecatedImports` on `LexicalComposer` in 0.51 | @kriegcloud | in-repo `LexicalExtensionComposer` migration plus browser-QA | no | `git grep -l LexicalComposer` (16 files); lexical v0.52.0 latest |
| jsdom 30.0.1 | 10 manifests, 35 jsdom-env test files | vitest 5 worker-start EventTarget error on 30.1.0 | @kriegcloud | vitest or jsdom ships a fix | unknown | jsdom v30.1.2 notes (no EventTarget fix); vitest v5.0.3 "Support Blob on jsdom 30.1" (#11379); no upstream issue linked |
| fast-xml-validator 1.2.0 | `modeling/schema/src/Xml.ts`, `cli/.../Library.evidence.ts` | 1.3+ pulls `@nodable/flexible-xml-parser` (module-scope `Buffer`) and breaks browser bundles | @kriegcloud | none written | no | `npm view fast-xml-validator@1.4.2 dependencies`; `npm view detailed-xml-validator@2.2.0 dependencies` |
| detailed-xml-validator 2.1.0 (override) | transitive via fast-xml-validator 1.2.0 | same as above | @kriegcloud | none written; the hold entry is inert (not in the catalog) | no | `bun.lock` line 6979; `package.json` `overrides` line 333 |
| @biomejs/biome 2.5.6 | repo-utils `renderBiomeJson` (`beep tsconfig-sync`), codegen-kit `format.ts`, lint-rules | 2.5.7 emits compact JSON via `--stdin-file-path`; sync-drift proof failed | @kriegcloud | Biome stdin JSON formatting fixed | unknown | `gh api repos/biomejs/biome/releases/tags/@biomejs/biome@2.5.N` for N=8..15 (no matching fix); no upstream issue |
| @effect/tsgo + 7 binaries (0.47.2) | `tools/tsgo-shim`, `beep:check`, `beep:build`, `lint:tsgo-rules`, docgen | wrapper/binary drift swaps the compiler silently | @kriegcloud | stale ("clear 11 off rules"); real policy is a lockstep bump PR passing `beep quality tsgo-rules` | n/a (renew as policy) | `npm view @effect/tsgo dist-tags` (0.51.1); `git log -G` on `package.json` |
| diagnosticSeverity off ×2 | `tsconfig.base.json` lines 143, 229 | n/a (design waiver) | @kriegcloud | none, permanent | n/a | `tsgoDisabledRules` in `Quality.command.ts`; `886de7a261` |

### Proposed plan (implementing lane)

1. Rewrite the `updateGroups[0]` comment:
   - Drop the "0.33.0 / eleven parked off" sentence and state the lockstep-ratchet policy that `beep quality tsgo-rules` enforces.
   - Drop or retire the knip clause, in the same PR as the knip retirement.
   - Re-point the label from the #428 changeset to `docs/runbooks/typescript-toolchain.md` (or to a new hold-register section there).
2. Remove `detailed-xml-validator` from the hold group. The root override is the effective pin, so keep that and document it as an override hold. Alternatively, add `overrides` to the `deps:update` dependency types; that is a separate decision.
3. Run compatibility proofs for the two `unknown` exits, each in a disposable lane:
   - jsdom 30.1.2 with vitest 5.0.3, running one jsdom-env file per consumer package.
   - biome 2.5.15 with the `beep tsconfig-sync` drift proof plus `BiomeJson.test.ts`.
   - Then either remove the hold or renew it, recording the failing output and filing or linking an upstream issue.
4. Write an exit condition for fast-xml-validator, for example "upstream drops module-scope `Buffer` in `@nodable/flexible-xml-parser`, or the repo replaces the validator". Without one, the hold cannot exit.
5. Open a tsgo 0.47.2 → 0.51.1 lockstep bump as its own ratchet PR. It is not a hold exit.
6. Hold-register home: one table in `docs/runbooks/typescript-toolchain.md` or a new `standards/dependency-holds.md`. The table should have owner, consumer, failure evidence, exit condition, last-checked date and an evidence command. Optionally, a `beep` check could fail when a `syncpack.config.ts` held name lacks a register row.

### Open questions

- Whether jsdom 30.1.1/30.1.2 or vitest 5.0.3 fixed the EventTarget worker-start failure. Neither release note says so, and only a run can tell.
- Whether any Biome release after 2.5.7 fixed stdin JSON formatting. No upstream issue was ever linked, so the regression may never have been reported.
- Where the "eleven rules parked off" originated. It is not in `tsconfig.base.json` at `4cb63ad058` or its parent, so it may have existed only in an intermediate PR commit of #639.
- Whether commitlint's `cosmiconfig-typescript-loader` still needs classic `typescript` at ^21.2.3. Its peer range was not checked.
- Per-hold ownership beyond CODEOWNERS `* @kriegcloud`. None is recorded.
