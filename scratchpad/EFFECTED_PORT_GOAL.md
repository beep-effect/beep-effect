# EFFECTED_PORT_GOAL — port the `@effected/*` kit into the beep-effect lab

Launch, from a `claude` session in `~/YeeBois/projects/beep-effect` on branch
`@lab/effected`:

```text
/goal follow the instructions in scratchpad/EFFECTED_PORT_GOAL.md
```

> **Operator revision, 2026-10-08. Where it conflicts with the text below, this wins.**
>
> Work breadth first, across all modules, in this order. Tests keep passing at every step.
>
> 1. **Copy.** S0 (copy verbatim) for every module, in ledger order, one commit each. No fixing,
>    no crispening, no documentation work. *Done 2026-10-08: 27 modules, 4,066 files, each
>    identical to upstream apart from import specifiers.*
> 2. **Green.** Change nothing except what it takes to clear every type error, lint error and
>    `@effect/tsgo` diagnostic, with the upstream tests passing.
> 3. **Imports.** Rewrite imports to the beep-effect style, one Effect module per import
>    (`import * as Effect from "effect/Effect";`).
> 4. **Identity.** Every schema and `Context.Service` takes its identity from the
>    `@beep/identity` IdentityComposer, with annotations on fields and schemas.
> 5. **Review.** Review rounds (S4, section 12) start only after everything above passes.
>
> No review round runs before step 5. D18 (two modules in flight) and D19 (wave-0 confirmation
> round) do not gate steps 1 to 4. The `jsonc` round-3 and `jsonl` round-2 reports already on
> disk are input for step 5, not work to do now. The end state (section 0.1) is unchanged.
>
> Not yet placed by the operator: the remaining beep laws (`effect-fn`, `terse-effect`,
> `native-runtime`), the JSDoc conversion (S2) and full coverage (S3). They are not part of
> steps 2 to 4; ask before starting them.

This file is the whole contract. The `/goal` evaluator only reads the
transcript, so section 0 defines what you print and when. Everything else is
the work. Decisions D1–D12 were grilled and locked with Benjamin on
2026-10-06; do not re-open them. Defaults D13–D20 are yours to override only
with a written reason in the ledger.

---

## 0. The `/goal` contract

### 0.1 End state

Print the literal line `EFFECTED_PORT_COMPLETE` **only** immediately after
this command has printed `ledger: 29/29 done`:

```bash
bun run --cwd scratchpad audit:effected -- ledger --verify
```

The 29 rows are the 27 new modules in section 4 plus `jsonl` and `jsonc`
(wave 0 retrofit). Until that line exists in the transcript, the goal is not
met: keep working. Never print the marker early, never print it from memory,
always from the verifier's output in the same turn.

### 0.2 Checkpoints you must print

At every ledger transition print one line, so the evaluator can see progress:

```text
EFFECTED_PORT_CHECKPOINT <module> <stage-reached> <commit-sha>
```

When a module cannot leave a stage under the protocol in section 12.6 or
section 14, print:

```text
EFFECTED_PORT_BLOCKED <module> <stage> <one-line reason> <ledger-row-id>
```

and continue with the next module. A blocked row withholds the completion
marker; section 0.5 says what to do when only blocked rows remain.

### 0.3 Resume protocol (every session start)

1. `git -C ~/YeeBois/projects/beep-effect status --short` and
   `git log --oneline -5`. Branch must be `@lab/effected`; if not, stop and
   print `EFFECTED_PORT_BLOCKED setup 0 wrong-branch -`.
2. Read `scratchpad/effected/PORT_LEDGER.json`. If absent, wave 0 has not
   started: begin at section 9.
3. Pick the first row whose stage is below `done`, in ledger order (wave,
   then position). Re-run that row's **previous** stage gate once
   (`audit:effected -- audit <module>`), then continue. Never redo a stage the
   ledger marks done unless its gate now fails; if it fails, roll the row back
   to that stage, note why, and fix forward.
4. Record a session row:
   `bun run beep session note --state open --next "effected-port: <module> S<n>"`.

### 0.4 Session rules

- **Autonomy.** No permission questions mid-goal. Decide, record the call in
  the ledger row's `notes`, keep moving. The only stop is the closeout prompt
  (the `closeout` skill, `AskUserQuestion`) after `EFFECTED_PORT_COMPLETE` or
  when section 0.5 applies.
- **Heavy commands** (tsgo, vitest, docgen, bun install, codemods over a
  module) run through the admission wrapper: `beep-heavy <command...>`. Never
  bypass the queue; never run two heavy commands for the same module at once.
- **Git.** Local commits only, Conventional Commits, one commit per
  (module, stage) and one per review round. Never push, never open a PR,
  never touch `main`. Commit bodies wrap under 100 characters.
- **Never write under `~/YeeBois/references/**`.** It is the upstream oracle.
- **Model routing.** You (Fable 5.1) orchestrate, integrate, run gates and
  commit. Volume work (copy-rewrites, codemods, fixes) goes to Codex
  `gpt-6.1-sol` lanes at `high` effort. Reviewer seats are in section 12.
  You are authorized to use the Workflow tool for the reviewer panel and for
  fix fan-out inside one module, and the Agent tool only for the Fable seat.
- **Friction receipts.** When something is slower, harder or riskier than it
  should be, append a receipt to `scratchpad/effected/OPPORTUNITIES.md` at
  that moment (what, evidence, what would have prevented it; `~` for home,
  no secrets).
- **Checkpoint note** at every ledger transition:
  `bun run beep session note --state open --summary "<module> S<n> <sha>" --next "<next module/stage>"`.

### 0.5 When only blocked rows remain

If every row is `done` or `blocked`, do not print the completion marker. Run
the closeout prompt with: the list of blocked rows, each with its remaining
required findings or failing gate, the two or three concrete options per row,
and "stop here". That is the one legitimate hand-off before completion.

---

## 1. Mission

Port the following `@effected/*` modules from the upstream checkout
`~/YeeBois/references/effect/effected/packages/<m>/` into the lab under
`scratchpad/effected/<m>/` (source) and `scratchpad/test/<m>/` (tests), with
attribution, so that each module is a reference-quality beep-effect module:
same files, same exports, upstream documentation carried over, zero type
errors, zero `@effect/tsgo` diagnostics, zero lint errors, zero unsafe type
assertions, docgen green to `.patterns/jsdoc-documentation.md`, 100 percent
per-file test coverage with property-based tests on canonical
`@effect/vitest` idioms, and a three-seat review loop closed at zero required
findings.

The motive is to see what the kit looks like as beep-native code before
deciding what to promote, and to reduce dependence on third-party packages
(the repo already consumes `@effected/github` 0.15.1 from
`packages/tooling/tool/cli`). This is a lab: nothing here creates packages,
publishes, pushes, or edits the real CLI package.

Already done on this branch (the recipe you are scaling): `jsonl` and `jsonc`
under `scratchpad/effected/{jsonl,jsonc}` with tests under
`scratchpad/test/{jsonl,jsonc}` and `scratchpad/test/jsonl.test.ts`. Read
`scratchpad/effected/jsonl/README.md`, `scratchpad/effected/jsonl/tsconfig.json`,
`scratchpad/docgen.jsonl.json`, `scratchpad/vitest.jsonl.config.ts` and
`scratchpad/test/jsonl/fixtures.ts` before touching anything: they are the
proven shapes, and wave 0 generalizes them.

### 1.1 Non-goals

- No `bun run beep create-package`, no promotion, no `packages/**` edits.
- No replacement of third-party runtime dependencies inside this goal (D3);
  replacements are ledgered as backlog (section 13).
- No behaviour changes beyond section 14.
- No edits to `goals/`, `explorations/`, `standards/`, `AGENTS.md`.
- No push, no PR, no `yeet publish`.

---

## 2. Locked decisions and defaults

| Id | Decision | Why |
| --- | --- | --- |
| D1 | Topological waves (section 4) with a resumable ledger (section 7); one `/goal` re-run resumes. | 27 modules, ~150k source and ~125k test lines; no single session finishes. |
| D2 | **Superset export rule**: every upstream export exists in the lab with the same name and the same kind (value or type). Beep-idiomatic shape is allowed (LiteralKit, `S.Class`, kits). Additions are allowed and listed in the module README under *Port notes → Added exports*. Wave 0 retrofits `jsonl` and `jsonc` to this rule and restores upstream test files. | Parity is checkable; schema-first byproducts (`JournalConfig`) need a home. |
| D3 | Keep upstream third-party runtime deps in the verbatim port, added lab-only to `scratchpad/package.json`; oracle devDeps allowed; every third-party dep gets a ledger backlog row naming its Effect-native replacement candidate. | Verbatim first; replacement is a separate decision per dep. |
| D4 | Carried documentation surfaces: `README.md` (adapted), `LICENSE` (verbatim plus vendored-engine notices), `KNOWLEDGE.md` (upstream `CLAUDE.md` + linked `okf/` concepts verbatim), and every JSDoc body (converted carriers, never dropped). Not carried: `CHANGELOG.md`, `website/`, `package.json`, `savvy.build.ts`, `biome.json`. | Upstream prose is good and must survive; release boilerplate must not. |
| D5 | End-state idiom bar is **full beep-native**: `$ScratchpadId` identity annotations on every exported schema, service and error; `LiteralKit` for literal domains; `@beep/schema` kits where an equivalent exists; `Effect.fn`/`fnUntraced`; `effect/HashMap|HashSet|MutableHashMap|MutableHashSet` only; errors per `.patterns/error-handling.md`; beep laws green. Applied in stage order: laws at S1, identity and kits during S4. | Same bar `jsonl`/`jsonc` reached. |
| D6 | Copy all upstream `__test__/fixtures/**` verbatim, including yaml-test-suite (13 MB) and toml-test (3.5 MB). Suites stay at 100 percent with empty skip maps. | Self-contained everywhere, including cloud lanes. |
| D7 | One generic runner `scratchpad/effected/audit.ts` plus a per-module `tsconfig.json`; one shared `vitest.effected.config.ts` and one docgen template. Package scripts take the module as an argument. | 180 hand-written config files would drift. |
| D8 | Review loop per module, max 5 rounds. Reviewer seats read-only and headless (Grok 4.7 xhigh, GPT-6.1-Sol high, Fable 5.1 xhigh); findings written to `scratchpad/effected/<m>/.review/round-N/<seat>.md`; fixes by Codex lanes; Fable integrates, gates, commits. Round closes at zero required findings from all three seats. | Preserves Claude quota; resumable. |
| D9 | **Behaviour-preserving by default.** Upstream tests and fixtures are the contract. A deviation is allowed only when a beep law forces it or a verified upstream bug is fixed; each is recorded in README *Port notes → Deviations* and the ledger, citing the adjusted upstream test. | Oracle suites must keep meaning. |
| D10 | Property floor per module: every exported schema or codec gets an encode/decode round-trip property through `Arbitrary.schema` (`effect/Arbitrary`); every parser or formatter gets idempotence and fidelity properties; upstream oracle and differential suites are retained with their devDeps. Run counts through `@beep/fc-runs` `fcRuns(n)`. | Checkable PBT criterion. |
| D11 | **Required finding** = law violation, bug, unsafe type assertion, tsgo diagnostic, JSDoc-law break, schema or effect idiom violation with a cited standard, or performance only with a measured regression versus upstream or an algorithmic-class win. Everything else is backlog in the ledger. | Three xhigh models never run out of opinions. |
| D12 | Record a **provisional** beep home per module (section 4), routed through `standards/architecture/07-non-slice-families.md`; re-grill at promotion. | Categories and identity choices need a target. |
| D13 | Imports: `.js` → `.ts`; sibling modules by relative path (`../<dep>/index.ts` in source, `../../effected/<dep>/index.ts` in tests); never `@effected/*` inside `scratchpad/effected/**`; module internals in tests by relative path too. | Promotion later is a path rewrite. |
| D14 | Filesystem double for new modules' tests is the ported `memfs` (upstream parity). `jsonl` stays on `@beep/test-utils/MemoryFileSystem` (already promoted via effect-vitest-canon D8). | Keeps upstream tests verbatim. |
| D15 | Unsafe type assertion = any `as` other than `as const`, any `!` non-null assertion, any `<T>expr` cast, any `any`. `satisfies` is fine. Gate in the runner. | Matches the jsonc bar. |
| D16 | Node vitest (`bunx --no-install vitest run`) is the test gate. A Bun run (`bun run beep test`) is advisory per module and recorded. | Same gate the repo uses. |
| D17 | Review evidence (`.review/`) is committed. Coverage output goes to the git-ignored `coverage/scratchpad-effected/<m>/`. | Durable on-disk hand-offs. |
| D18 | Within a wave, modules proceed in the listed order; at most two modules in flight (one may sit in S4 while the next runs S0–S2). | Bounded parallelism, three heavy slots. |
| D19 | `jsonl` and `jsonc` get one confirmation review round in wave 0 (not five): both already closed earlier loops at zero findings. | Don't re-spend. |
| D20 | `bun run beep quality package-verify @beep/scratchpad` is not the gate here (it would run the unrelated ontology lab). The runner is the gate. | Scope. |

---

## 3. Sources, references, law

### 3.1 Upstream

- Checkout: `~/YeeBois/references/effect/effected` (registered as `effected`,
  tier deep, in `scripts/references.json`). Record its commit once in the
  ledger header: `git -C ~/YeeBois/references/effect/effected rev-parse HEAD`.
- Effect is 4.0.1 on both sides (`node_modules/effect/package.json` here,
  `pnpm-workspace.yaml` catalog there). Never introduce v3 APIs.
- Graft is indexed upstream. **Run it from inside that checkout**, otherwise
  it resolves the beep graph and reports no definitions:

  ```bash
  cd ~/YeeBois/references/effect/effected && graft skeleton packages/semver/src/SemVer.ts
  cd ~/YeeBois/references/effect/effected && graft ask "how does YamlLint autofix apply edits" --source
  cd ~/YeeBois/references/effect/effected && graft callers Journal --depth 2
  ```

- Upstream conventions you must read once: `CLAUDE.md`,
  `okf/conventions/testing-standards.md`, `okf/conventions/format-package-convention.md`,
  `okf/project.md` (tiers table). Per module: `packages/<m>/CLAUDE.md`,
  `okf/modules/<m>.md`, and every `okf/**` file that `CLAUDE.md` links.

### 3.2 Effect references

- Effect API truth: `graft ask "<q>" .repos/effect` from the beep root
  (`~/YeeBois/references/effect/effect` is the same checkout).
- Schema best practices: `~/YeeBois/references/effect/effect/packages/effect/SCHEMA.md`.
- `@effect/tsgo` diagnostics: `~/YeeBois/references/effect/effect-tsgo`
  (`etsdiagnostics/`, `docs/`). The beep `tsgo` binary
  (`node_modules/.bin/tsgo` → `@beep/tsgo-shim`) is the patched effect tsgo, so
  `tsgo -p <module tsconfig> --noEmit --pretty false` reports both TypeScript
  errors and effect diagnostics. Zero of each is the gate.
- Installed-vs-reference drift exists; check `node_modules/effect/dist/**/*.d.ts`
  before trusting a reference API (memory: `effect-v4-installed-vs-reference-api-drift`).

### 3.3 Beep law surfaces (read before reviewing or fixing)

`AGENTS.md`, `standards/ARCHITECTURE.md`, `standards/effect-laws-v1.md`,
`standards/effect-first-development.md`,
`standards/schema-first-development-prompt.md`,
`.patterns/jsdoc-documentation.md`, `.patterns/error-handling.md`,
`.patterns/module-organization.md`, `.patterns/testing-patterns.md`,
`goals/effect-vitest-canon/SPEC.md` (D1–D14; D5 assert helpers, D14 `it.layer`,
D6 no flakyTest), `packages/tooling/library/repo-utils/src/schemas/JSDocCategories.ts`.

Skills to load at the named stage: `schema-first-development`,
`effect-first-development`, `jsdoc-annotation-specialist`, `crispen`,
`quality-review-fix-loop`, `graft`, `closeout`.

Beep helpers the ports use: `@beep/identity/packages` (`$ScratchpadId`),
`@beep/schema` (`LiteralKit`, kits), `@beep/utils` (`@beep/utils/Option`),
`@beep/fc-runs` (`fcRuns`), `@beep/test-utils` (vitest helpers;
`MemoryFileSystem` for `jsonl` only).

---

## 4. Module inventory, waves, homes

Dependency levels come from upstream `peerDependencies` + `dependencies`
restricted to kit packages. Within a wave, work in the listed order. `memfs`
is first in wave 1 because later tests use it as the filesystem double.

| Wave | Module | Kit deps (all ported earlier or same wave) | New runtime deps (not in catalog) | Oracle devDeps | Upstream size src / test (lines) | Subpath entries | Provisional home |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | `jsonl` (retrofit) | — | — | — | 2,894 / 3,689 | — | foundation/modeling |
| 0 | `jsonc` (retrofit) | — | — | — | 3,771 / 1,846 | — | foundation/modeling |
| 1 | `memfs` | — | — | — | 5,409 / 3,119 | `./node-sync` → `NodeSyncFileSystem.ts` | tooling/test-kit (overlaps `@beep/test-utils/MemoryFileSystem`) |
| 1 | `yaml` | — | — | `yaml` (catalog ^2.9.1) | 18,429 / 7,076 | — | foundation/modeling |
| 1 | `toml` | — | — | `smol-toml` (catalog) | 4,244 / 3,686 | — | foundation/modeling |
| 1 | `glob` | — | — | `minimatch` (catalog 10.2.5) | 3,368 / 1,606 | — | foundation/modeling |
| 1 | `semver` | — | — | — | 2,652 / 1,111 | — | foundation/modeling |
| 1 | `spdx` | — | — | `spdx-exceptions`, `spdx-expression-parse`, `spdx-license-ids`, `oxc-parser` | 2,756 / 621 | — | foundation/modeling |
| 1 | `schema-org` | — | — | `oxc-parser` | 6,165 / 1,273 | `./validate` → `conformance-entry.ts` | foundation/modeling |
| 1 | `github-references` | — | — | — | 801 / 580 | — | foundation/modeling |
| 1 | `github-commands` | — | — | — | 246 / 201 | — | foundation/modeling |
| 1 | `commands` | — | — | — | 2,148 / 1,955 | — | drivers (process spawning) |
| 1 | `templates` | — | — | — | 1,602 / 1,800 | — | tooling/library |
| 1 | `env` | — | — | — | 1,629 / 1,943 | — | tooling/library |
| 1 | `engine` | — | — | — | 518 / 597 | `./guard` → `guard.ts` | tooling/library |
| 1 | `git` | — | — | — | 7,185 / 6,696 | — | drivers |
| 2 | `walker` | glob | — | — | 918 / 1,296 | — | tooling/library |
| 2 | `npm` | commands, semver | — | — | 4,111 / 3,470 | — | drivers (registry) |
| 2 | `markdown` | jsonc, toml, yaml | — | `commonmark` | 13,517 / 11,497 | — | foundation/modeling (overlaps `@beep/md`; note, do not merge) |
| 2 | `github` | github-references, semver | `@octokit/core`, `@octokit/plugin-paginate-rest`, `@octokit/types`, `blakejs`, `tweetnacl`, `universal-github-app-jwt` | — | 8,398 / 5,722 | — | drivers |
| 3 | `lockfiles` | jsonc, npm, semver, yaml | — | — | 3,244 / 3,858 | — | foundation/modeling |
| 3 | `tsconfig-json` | glob, jsonc, walker | — | — | 2,762 / 2,321 | — | foundation/modeling |
| 3 | `config-file` | glob, jsonc, toml, walker, yaml | — | — | 2,602 / 3,393 | — | tooling/library |
| 3 | `package-json` | jsonc, npm, semver, spdx | — | — | 4,284 / 3,971 | — | foundation/modeling |
| 4 | `xdg` | config-file, glob, jsonc, toml, walker, yaml | — | — | 798 / 791 | — | tooling/library |
| 4 | `sbom` | package-json, spdx | `@sigstore/bundle`, `@sigstore/sign` | — | 1,895 / 1,862 | — | drivers |
| 4 | `workspaces` | commands, git, glob, jsonc, lockfiles, npm, package-json, semver, walker, yaml | `@pnpm/catalogs.config`, `@pnpm/catalogs.protocol-parser`, `@pnpm/catalogs.resolver`, `@pnpm/catalogs.types` | — | 15,616 / 17,118 | `./node-sync` → `node-sync.ts`, `./testing` → `testing.ts` | tooling/library |
| 4 | `cli` | github-commands, config-file, env, glob, walker | `ink` (react 19.3.0 is in the catalog) | `string-width` | 15,371 / 24,360 | `./testing` → `testing.ts`, `./ui` → `ui.ts`, `./ui/testing` → `ui-testing.ts`, `./ui/testing/serializer` → `ui-testing-serializer.ts` | tooling/library |
| 5 | `github-actions` | github, github-commands, glob, markdown, npm, sbom, semver, templates, walker | `@azure/storage-blob` | — | 11,203 / 11,724 | — | drivers |

Homes are provisional (D12): format parsers and pure grammars go to
`foundation/modeling`; wrappers over external engines, binaries or services go
to `drivers`; repo-operational substrate goes to `tooling`. Two overlaps must
be recorded, not resolved: `markdown` versus `@beep/md`, and `memfs` versus
`@beep/test-utils/MemoryFileSystem`.

Dependency versions for new deps: copy the exact specifier from upstream
`packages/<m>/package.json` (`pnpm-workspace.yaml` catalogs resolve them) into
`scratchpad/package.json` (`dependencies` for runtime, `devDependencies` for
oracles), then `beep-heavy bun install` from the repo root. Use `catalog:`
only when the root `package.json` catalog already carries the package.

---

## 5. Layout and mapping rules

### 5.1 Paths

| Upstream | Lab |
| --- | --- |
| `packages/<m>/src/**/*.ts` | `scratchpad/effected/<m>/**/*.ts` (same relative paths, `src/` dropped) |
| `packages/<m>/__test__/**` | `scratchpad/test/<m>/**` (same subdirectories: `e2e/`, `integration/`, `rules/`, `fixtures/`, `support/`, `helpers/`, `tools/`) |
| subpath export `./x` → `src/<file>.ts` | `scratchpad/effected/<m>/<file>.ts` (filename unchanged, see section 4) |
| `packages/<m>/README.md` | `scratchpad/effected/<m>/README.md` (adapted, section 10.3) |
| `packages/<m>/LICENSE` | `scratchpad/effected/<m>/LICENSE` (verbatim) |
| `packages/<m>/CLAUDE.md` + linked `okf/**` | `scratchpad/effected/<m>/KNOWLEDGE.md` (section 10.4) |
| — | `scratchpad/effected/<m>/tsconfig.json` (from the jsonl shape) |
| — | `scratchpad/effected/<m>/.review/round-N/*.md` (section 12) |

Fixtures are copied byte-exact (`cp -a`). Byte-pinned fixtures and oracle
literals marked "never regenerate" upstream are never regenerated here.
`VENDORED.md` files travel with their corpora.

### 5.2 Import rewrites (S0, mechanical)

1. `.js` import specifiers → `.ts` (the repo uses `rewriteRelativeImportExtensions`).
2. Tests: `../src/index.js` → `../../effected/<m>/index.ts`; `../src/<file>.js`
   → `../../effected/<m>/<file>.ts`; deeper test directories add one `../`.
3. `@effected/<dep>` → `../<dep>/index.ts` in source, `../../effected/<dep>/index.ts`
   in tests; `@effected/<dep>/<subpath>` → the subpath file from section 4.
4. `@effected/memfs` in tests → `../../effected/memfs/index.ts` (D14), except
   `jsonl`.
5. Never leave an `@effected/*` specifier inside `scratchpad/effected/**` or
   `scratchpad/test/<m>/**`. The runner's `parity` step fails on one.
6. `node:` imports stay as upstream wrote them in S0. The `native-runtime`
   law decides at S1 what must move to `effect/*` (FileSystem, Path,
   ChildProcess, etc.); record each move in the ledger.

### 5.3 Per-module tsconfig

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../tsconfig.json",
  "include": ["./**/*.ts", "../../test/<m>/**/*.ts"]
}
```

Relative imports into sibling modules resolve without listing them.

---

## 6. Stages per module

Each module moves through stages 0–4 and ends at `done` (stage 5). A stage is
left only when its gate passes through the runner and the commit exists.
Print the checkpoint line after each commit.

### S0 — Copy verbatim

- Copy source, subpath entries, tests, fixtures, README, LICENSE; assemble
  KNOWLEDGE.md; write `tsconfig.json`; apply section 5.2 rewrites; add deps
  (section 4); `beep-heavy bun install`.
- Create the ledger row (section 7) with `upstreamPaths`, `exportsExpected`
  (names and kinds parsed from upstream `src/index.ts` and subpath entries),
  `newDeps`, `fixturesBytes`.
- Gate: files exist, `parity` passes (names present, no `@effected/*`
  specifiers). Type errors are expected here and are not a gate.
- Commit: `feat(scratchpad): copy @effected/<m> verbatim (effected-port S0)`.

### S1 — Green under tsgo, oxlint, laws; upstream tests pass

- `audit:effected -- check <m>`: zero tsgo diagnostics.
- `audit:effected -- lint <m>`: zero oxlint errors; zero unsafe type
  assertions (D15); beep laws `effect-imports --check`, `effect-fn --check`,
  `terse-effect --check`, `native-runtime --check` with `--include` scoped to
  the module and its tests.
- `audit:effected -- test <m>`: every upstream test passes under Node
  vitest, no skips added, compliance suites at 100 percent.
- Load `effect-first-development` for any non-mechanical change. Fix forward
  through Codex lanes for volume; you integrate.
- Commit: `fix(scratchpad): <m> green under tsgo, oxlint and laws (effected-port S1)`.

### S2 — Documentation to beep standard

- Section 10 rules. `audit:effected -- docgen <m>` generates
  `scratchpad/docgen.<m>.json` from the template, runs docgen with
  `enforceDescriptions`, `enforceExamples`, `enforceVersion` all true, then
  `bun run beep docgen doctest verify` on the module.
- Load `jsdoc-annotation-specialist` for the editorial pass after the
  mechanical carrier conversion.
- Commit: `docs(scratchpad): <m> JSDoc on beep carriers (effected-port S2)`.

### S3 — Full coverage, property floor, vitest canon

- `audit:effected -- test <m> --coverage`: per-file 100 percent statements,
  branches, functions, lines over `scratchpad/effected/<m>/**/*.ts`.
- Section 11 rules (canon migration, PBT floor, no weakening).
- Commit: `test(scratchpad): <m> full coverage and canon idioms (effected-port S3)`.

### S4 — Review loop

- Section 12. At most five rounds. Each round: three seats on the same
  commit, merged inventory, Codex fixes, your integration, full
  `audit:effected -- audit <m>`, commit
  `refactor(scratchpad): <m> review round N (effected-port S4)`.
- Load `schema-first-development`, `crispen` (ultra), `effect-first-development`
  when integrating fixes. Identity annotations and kit substitutions (D5)
  land here if S1–S3 did not already need them.
- Exit at a round with zero required findings from all three seats.

### done

- Ledger row `stage: 5`, `status: done`, `closedAt` set; README Port notes
  complete; `audit:effected -- audit <m>` green on the final commit.
- Commit: `chore(scratchpad): <m> ledger done (effected-port S5)`.
- Print `EFFECTED_PORT_CHECKPOINT <m> done <sha>`.

---

## 7. The ledger

Path: `scratchpad/effected/PORT_LEDGER.json`. Validated by an `S.Class` in
the runner (schema first, then the runner). Shape:

```jsonc
{
  "version": 1,
  "effectedCommit": "<sha of ~/YeeBois/references/effect/effected>",
  "startedAt": "2026-10-07T00:00:00Z",
  "lastCheckpoint": { "module": "yaml", "stage": 2, "commit": "<sha>", "at": "<iso>" },
  "rows": [
    {
      "id": "w1-yaml",
      "module": "yaml",
      "wave": 1,
      "position": 2,
      "stage": 2,                       // 0..5
      "status": "in-progress",          // pending | in-progress | done | blocked
      "provisionalHome": "foundation/modeling",
      "upstreamPaths": { "src": "packages/yaml/src", "test": "packages/yaml/__test__" },
      "exportsExpected": [{ "name": "Yaml", "kind": "value", "entry": "." }],
      "exportsAdded": [],
      "newDeps": [{ "name": "yaml", "kind": "dev", "spec": "^2.9.1", "replacement": null }],
      "fixturesBytes": 13631488,
      "deviations": [],                 // { test, upstreamBehaviour, labBehaviour, reason: "law:<id>" | "upstream-bug:<evidence>" }
      "backlog": [],                    // { seat, round, finding, reason }
      "reviewRounds": [],               // { round, commit, seats: { grok: {required, backlog}, sol: {...}, fable: {...} } }
      "commits": [{ "stage": 0, "sha": "<sha>" }],
      "blocked": null,                  // { stage, reason, findings: [] }
      "notes": []
    }
  ]
}
```

`ledger --verify` fails unless every row is `done`, every `done` row has
commits for stages 0–5, `exportsExpected` ⊆ lab exports, and no row is
`blocked`. It prints `ledger: <done>/29 done` and lists blocked or stale rows.

---

## 8. The runner — `scratchpad/effected/audit.ts`

Built in wave 0, before any copy. Design order: schema → service → CLI.

- Schemas: `ModuleName` (`LiteralKit` of the 29 names), `Stage` (literal
  domain 0–5), `LedgerRow`, `Ledger` (`S.Class`), `RunnerConfig`.
- Service: `Audit` (`Context.Service`) with `copy`, `parity`, `check`, `lint`,
  `test`, `docgen`, `audit`, `ledger` methods; `Effect.fn` everywhere;
  `effect/cli` for the command surface (installed 4.0.1 exports `./cli`,
  `./http`, `./http-api`; there is no `./unstable/*` entry, so the
  "effect/unstable/http" wording in the standing coding rules means these
  modules); `effect/ChildProcess` (or the
  platform spawner the repo already uses in `packages/tooling/tool/cli`) for
  subprocesses; no `node:http`, no native `Set`/`Map`.
- It is itself part of the lab and must pass the same gates (tsgo, oxlint,
  laws, docgen) as a module; add a `runner` pseudo-row is **not** required,
  but `audit:effected -- audit runner` must exist and be green before wave 1.

Package scripts (added to `scratchpad/package.json`; run
`bun run beep lint package-scripts` afterwards and keep the generated form if
it rewrites them):

```json
"audit:effected": "bun effected/audit.ts",
"check:effected": "bun effected/audit.ts check",
"lint:effected": "bun effected/audit.ts lint",
"test:effected": "bun effected/audit.ts test",
"coverage:effected": "bun effected/audit.ts test --coverage",
"docgen:effected": "bun effected/audit.ts docgen"
```

What each subcommand runs (verbatim shell equivalents, so a session without
the runner can still reproduce a gate; `<m>` is the module, cwd is the repo
root unless stated):

| Subcommand | Runs |
| --- | --- |
| `copy <m>` | `cp -a` per section 5.1; rewrites per section 5.2; writes tsconfig; assembles KNOWLEDGE.md (section 10.4); appends deps to `scratchpad/package.json`; creates the ledger row. |
| `parity <m>` | Parses exports of upstream `src/index.ts` + subpath entries and of the lab entries with the TypeScript API; fails on a missing name or kind mismatch; fails on any `@effected/` specifier under `scratchpad/effected/<m>` or `scratchpad/test/<m>`; counts unsafe assertions (D15) via the AST and fails when > 0 from S1 onward. |
| `check <m>` | `beep-heavy bun run --cwd scratchpad tsgo -p effected/<m>/tsconfig.json --noEmit --pretty false` |
| `lint <m>` | `bunx --no-install oxlint --quiet --disable-nested-config scratchpad/effected/<m> scratchpad/test/<m>` then, with `I='scratchpad/effected/<m>/**/*.ts,scratchpad/test/<m>/**/*.ts'`: `bun run beep laws effect-imports --check --include "$I"`, `bun run beep laws effect-fn --check --include "$I"`, `bun run beep laws terse-effect --check --include "$I"`, `bun run beep laws native-runtime --check --include "$I"` (the laws take comma-separated repo-relative files; expand the globs first). |
| `test <m> [--coverage]` | `EFFECTED_MODULE=<m> beep-heavy bunx --no-install vitest run --config scratchpad/vitest.effected.config.ts scratchpad/test/<m>` (+ `--coverage`). The config reads `EFFECTED_MODULE` to set `include`, `includeSource`, coverage `include: ["scratchpad/effected/<m>/**/*.ts"]`, `reportsDirectory: "coverage/scratchpad-effected/<m>"`, `thresholds: { perFile: true, statements: 100, branches: 100, functions: 100, lines: 100 }`, and the `@effect/doctest` plugin as `scratchpad/vitest.config.ts` does. |
| `docgen <m>` | Writes `scratchpad/docgen.<m>.json` from `scratchpad/docgen.effected.template.json` (the jsonl config with `srcDir`, `srcLink`, `outDir` substituted); `beep-heavy bun run --cwd scratchpad bunx --bun --no-install docgen --config-file docgen.<m>.json`; then `bun run beep docgen doctest verify` scoped to the module. |
| `audit <m>` | `parity`, `check`, `lint`, `test` (with `--coverage` from S3), `docgen` (from S2), in that order; stops at the first red; prints a one-line verdict per gate. |
| `ledger --verify` / `--show` / `--set <m> <stage> [--commit <sha>]` / `--block <m> <reason>` | Section 7 semantics. `--set` refuses to skip a stage. |

Keep `scratchpad/vitest.jsonl.config.ts`, `scratchpad/docgen.jsonl.json` and
the `*:jsonl` scripts working until the wave-0 retrofit moves `jsonl` onto the
generic config; then delete them in the retrofit commit.

---

## 9. Wave 0 — scaffolding and the jsonl/jsonc retrofit

Order matters; each bullet is a commit.

1. **Runner and ledger.** Section 8. Commit
   `feat(scratchpad): add the effected port runner and ledger (effected-port W0)`.
2. **Shared configs.** `scratchpad/vitest.effected.config.ts`,
   `scratchpad/docgen.effected.template.json`, package scripts. Commit
   `chore(scratchpad): wire effected gates through the runner (effected-port W0)`.
3. **jsonl retrofit.**
   - Restore `export type { JsonlError } from "./JsonlError.ts"` in `index.ts`
     (dropped; upstream exports it). Keep the lab's additions
     (`AppendOptions`, `JournalConfig`, `ByteCount`, value-level `Slice`,
     `CursoredSlice`) and list them under README *Port notes → Added exports*.
   - Restore the upstream test files the lab dropped, adapted per section 5.2
     and kept next to the lab's extra suites: `EnvelopeTypes.test.ts`,
     `LineProperty.test.ts`, `helpers/`, `integration/Journal.int.test.ts`.
     `MemFsHelper.test.ts` targets upstream `memfs`; land it right after
     `memfs` reaches S1 in wave 1 (ledger note on the jsonl row), not now.
   - Add `KNOWLEDGE.md` (section 10.4). README exists: append Port notes.
   - Move jsonl onto the generic runner; delete `vitest.jsonl.config.ts`,
     `docgen.jsonl.json`, the `*:jsonl` scripts.
   - Run S1–S3 gates through the runner; one confirmation review round (D19).
   - Commit `refactor(scratchpad): retrofit jsonl to the effected port contract (effected-port W0)`.
4. **jsonc retrofit.**
   - Restore value exports `JsoncEdit`, `JsoncFormattingOptions`, `JsoncRange`
     and the type export `JsoncFormattingOptionsLike` (upstream `index.ts`).
   - Add `LICENSE` (upstream `packages/jsonc/LICENSE`, verbatim), `README.md`
     (adapted upstream README + Port notes recording the five documented
     deviations: `toJSON` failure typed as `SerializationFailed`; multi-line
     insert re-indentation in `JsoncModifier.modify`; typed
     `JsoncEditOverlapError` from `applyAll` with `applyAllResult` as the value
     form; `navigate` taking a non-empty path; `{ bad }` error order), and
     `KNOWLEDGE.md`.
   - Run S1–S3 gates through the runner; one confirmation review round.
   - Commit `refactor(scratchpad): retrofit jsonc to the effected port contract (effected-port W0)`.
5. Set both rows `done`; print both checkpoints; `session note`.

Gotcha carried from the jsonc port: the Bash tool unescapes `\uXXXX` in
command text, including quoted heredocs. Write unicode escapes into files
through a script (`chr(92)`), never through a heredoc.

---

## 10. Documentation rules (S2)

### 10.1 What "carried, not replaced" means

Every upstream doc block's prose survives in the lab block. You may reorder
into the beep section grammar, tighten a lead that restates the signature, and
add what the law requires. You may not delete an upstream sentence that
teaches behaviour, a warning, or a rationale; if it is wrong after a law-driven
change, rewrite it and cite the change in Port notes.

### 10.2 Carrier conversion (mechanical first, editorial second)

Upstream carriers across the 27 modules: ~1,540 `@remarks`, ~300 `@example`,
~320 `@internal`, 36 `@packageDocumentation`, zero `@since`/`@category`, about
2,360 exported declarations. Rules:

- Lead paragraph: one paragraph, purpose not signature.
- `@remarks` → `**Details**`; a `@remarks` that warns becomes `**Gotchas**`.
  One of each at most, in the law's order (When to use, Details, Gotchas,
  Examples).
- `@example` → `**Example** (Title)` with a specific, unique title and exactly
  one `ts` fence; Examples last in the body; every value-level export has at
  least one observable, compiling Example; never delete an Example to pass.
- Add `@category <canonical slug>` from `JSDocCategories.ts` and
  `@since 0.0.0` to every export. `@see` always carries a purpose phrase.
- `@internal` stays where upstream put it. `internal/**` files are documented
  to the same standard (docgen includes them), as `jsonl/internal/*` are.
- `@packageDocumentation` on `index.ts` and on every subpath entry file.
- Namespace-import law in Examples: `import * as S from "effect/Schema"`,
  `A`, `O`, `P`, `R` likewise; core combinators from `effect`.
- Forbidden anywhere in new blocks: `@remarks`, `@module`, `@template`,
  `{type}` braces, `@returns -`, `any`, type assertions, `declare`.
- Mechanical conversion may be a codemod (TypeScript API; dry-run diff first;
  one commit); the `jsdoc-annotation-specialist` pass follows and is not
  optional. Run `bun run beep docgen doctest mark --write` for the safe
  runnable-fence rewrites, then `doctest verify`.

### 10.3 README adaptation

Start from the upstream README verbatim, then:

- Replace the title with `# <m> (lab port of @effected/<m>)`.
- Remove npm/version/Node/TypeScript badges, the Install section, the
  pre-1.0 stability block, and `pnpm-plugin-effect` references.
- Keep *Why*, API prose, examples (rewritten to lab imports), fidelity and
  hardening guarantees.
- Append a `## Port notes` section with four fixed subsections, each present
  even if "none": **Attribution** (upstream package, version from upstream
  `package.json`, commit, LICENSE pointer, and every vendored-engine notice
  found in upstream source headers, e.g. yaml → `yaml` package; glob →
  minimatch, brace-expansion, balanced-match; markdown → commonmark.js, mdast;
  spdx → spdx-license-ids; schema-org → schemaorg JSON-LD), **Added exports**,
  **Deviations** (section 14 format), **Dependency backlog** (section 13 rows
  for this module).

### 10.4 KNOWLEDGE.md assembly

```markdown
# <m> — upstream knowledge bundle (verbatim)

Provenance: ~/YeeBois/references/effect/effected @ <commit>; files listed below.
Relative `okf/...` links refer to that checkout. Content is carried verbatim; port
decisions live in README.md → Port notes, not here.

---
<!-- packages/<m>/CLAUDE.md -->
<verbatim>

---
<!-- okf/modules/<m>.md -->
<verbatim, including its YAML frontmatter>

---
<!-- okf/<every other file packages/<m>/CLAUDE.md links, in link order> -->
<verbatim>
```

Do not editorialize inside KNOWLEDGE.md. If a linked concept is shared by
several modules (e.g. `okf/conventions/format-package-convention.md`), include
it in each module that links it; duplication is acceptable in a lab.

---

## 11. Testing rules (S1 and S3)

### 11.1 S1: upstream tests verbatim, green

- Rewrites per section 5.2 only. No test deleted, renamed, skipped, or
  weakened; no timeout raised; no `flakyTest` added. Compliance suites keep
  empty skip maps and their README-pinned counts.
- Tests that need a real binary or network keep upstream's classification
  (`integration/`, `e2e/`); they must pass offline wherever upstream's did.
  `git` integration suites may keep upstream's sanctioned
  `beforeAll`/`afterAll` + `Effect.runPromise` fixture shape.
- `vi.mock` (ten upstream files): keep in S1. In S3 replace with Layer-based
  doubles where a service seam exists; otherwise keep with a one-line reason
  comment and a ledger backlog row.

### 11.2 S3: canon migration

Apply the pinned `effect-vitest-canon` contract (SPEC D1–D14) to every test
file of the module, in the lens order scope → assertions → property → flake →
observability:

- `it.effect` default; `it.live` only with a reason comment (real clock or
  console); never plain `it` + `Effect.runPromise` for Effect code.
- Option/Result/Exit assertions through `@effect/vitest/utils`
  (`assertSome`, `assertNone`, `assertSuccess`, `assertFailure`,
  `assertExitSuccess`, `assertExitFailure`…); upstream's `assert.*` for plain
  values stays. No `expect` introduced where upstream used `assert`.
- `it.layer` for any scoped or effectful layer (D14); per-test
  `Effect.provide` only for pure `Layer.succeed`/`Layer.mock` stubs.
- Flakes: root cause (TestClock, event-driven waits, scope); no `flakyTest`,
  no longer timeouts (D6).
- Test files import package source through relative paths (section 5.2);
  `@beep/*` test helpers through their aliases.

### 11.3 S3: coverage

Per-file 100 percent over `scratchpad/effected/<m>/**/*.ts`. Close gaps with
tests that assert behaviour, never with `/* c8 ignore */`, `istanbul ignore`,
or by deleting branches. A branch that is unreachable by construction is a
finding against the source: simplify it (section 14 applies if behaviour
would change) and record it.

### 11.4 S3: property floor (D10)

- Every exported schema or codec: `it.effect.prop` with `Arbitrary.schema(schema)`
  from `effect/Arbitrary` (upstream tests write `import { Arbitrary } from "effect"`),
  asserting encode∘decode identity (Effect equality) and that decode of an
  encoded value never fails. Run counts through `fcRuns(n)` from
  `@beep/fc-runs` (a floor the env can raise, never lower).
- Every parser/formatter: idempotence (`format(format(x))` equals
  `format(x)`), fidelity (`parse(stringify(parse(x)))` equals `parse(x)`), and
  the module's own fidelity guarantee from its README.
- Keep every upstream `oracle`, `differential`, `compliance` and `.property`
  suite and add their devDeps (section 4).
- Vacuous properties (asserting `true`, asserting the arbitrary's own
  invariant) are findings, not coverage.

---

## 12. Review loop protocol (S4)

### 12.1 Scope the seats review

The seats review the module's source, tests, README and KNOWLEDGE.md on one
commit SHA against:

- beep-effect laws and canonical patterns (`AGENTS.md`, `standards/effect-laws-v1.md`)
- `jsdoc-annotation-specialist` rubric and `.patterns/jsdoc-documentation.md`
- `schema-first-development` and `standards/schema-first-development-prompt.md`
- `effect-first-development` and `standards/effect-first-development.md`
- `crispen` at ultra: invariants absorbed into schemas, helper walls, literal
  families, Option-ified nullish fields
- `.patterns/error-handling.md`, `.patterns/module-organization.md`
- bugs, type safety (D15), performance (D11 evidence rule)
- schema best practices (`SCHEMA.md` in the Effect reference)
- idiomatic Effect module usage (verified with graft against `.repos/effect`)
- `@effect/tsgo` diagnostics (reference checkout `effect-tsgo`)

### 12.2 Seats and exact commands

Run all three in parallel on the same SHA from the repo root. `BRIEF` is the
brief file from section 12.3 written to
`scratchpad/effected/<m>/.review/round-N/BRIEF.md`.

- **Grok 4.7, xhigh**:

  ```bash
  grok -m grok-4.7 --reasoning-effort xhigh --prompt-file "$BRIEF" \
    --output-format plain --max-turns 80 \
    > scratchpad/effected/<m>/.review/round-N/grok.md
  ```

- **GPT-6.1-Sol, high** (prompt is the brief's text; output is its final
  message):

  ```bash
  ~/.local/bin/codex exec --model gpt-6.1-sol -c 'model_reasoning_effort="high"' \
    -s read-only --skip-git-repo-check --cd ~/YeeBois/projects/beep-effect \
    "$(cat "$BRIEF")" </dev/null \
    > scratchpad/effected/<m>/.review/round-N/sol.md
  ```

- **Fable 5.1, xhigh**: Workflow `agent(brief, { model: "fable", effort: "xhigh",
  label: "review:<m>:fable" })` with a schema matching section 12.4; write the
  result to `.review/round-N/fable.md`. (The Agent tool is acceptable when the
  Workflow tool is unavailable; it inherits the session model.)

After each seat returns, `git status --porcelain` must show nothing outside
`scratchpad/effected/<m>/.review/`. Any other change is reverted
(`git checkout -- <path>`), the seat's report is kept, and a receipt is written
to OPPORTUNITIES.md. Reviewers never edit.

If a seat fails on quota, availability, or an unsupported model, rerun once;
then record the round with that seat `unavailable` and proceed with two seats
only for that round (the closing round still needs all three). Never switch a
seat to another model on an unfavourable review.

### 12.3 Reviewer brief (template)

```markdown
You are a read-only reviewer. Module: <m>. Commit: <sha>. Round: N.
Surface: scratchpad/effected/<m>/** and scratchpad/test/<m>/** (and nothing else).
Upstream oracle: ~/YeeBois/references/effect/effected/packages/<m> (read-only).
Law surfaces: <section 3.3 list>. Decisions D1–D20 in scratchpad/EFFECTED_PORT_GOAL.md bind you.
Previous rounds: scratchpad/effected/<m>/.review/round-<N-1>/INVENTORY.md (do not repeat closed items).

Report findings only. Do not edit any file. Do not run commands that write.
For each finding give: id, file:line, class (law|bug|type-safety|tsgo|jsdoc|schema|effect-idiom|perf|test|docs),
severity (required|backlog) under D11, the standard or evidence you cite, the observable failure,
and the smallest fix. Mark perf findings required only with a measurement or an algorithmic-class argument.
End with a line `REQUIRED: <n>` and a line `BACKLOG: <n>`. If both are zero, say `NO FINDINGS`.
```

### 12.4 Finding record

```markdown
### <seat>-<round>-<n>
- file: scratchpad/effected/<m>/<file>.ts:<line>
- class: <class>   severity: required|backlog
- standard: <doc or rule id>   evidence: <command/output or reasoning>
- failure: <what breaks or diverges>
- fix: <smallest change>
```

### 12.5 Round mechanics

1. Write the brief; run the seats; collect the three reports.
2. Merge into `.review/round-N/INVENTORY.md`: dedupe by file:line and class;
   reject findings without evidence or a concrete fix (record the rejection
   with a reason); reclassify to backlog anything outside D11.
3. Group required findings by non-overlapping write surface (source file
   groups, tests, docs). Dispatch one Codex lane per group:

   ```bash
   ~/.local/bin/codex exec --model gpt-6.1-sol -c 'model_reasoning_effort="high"' \
     -s workspace-write --skip-git-repo-check --cd ~/YeeBois/projects/beep-effect \
     "<fix brief: the group's findings verbatim, D9 behaviour rule, D15, section 11.1 no-weakening rule, 'other lanes edit sibling files; touch only: <files>'>" </dev/null
   ```

   Codex edits; you review the diff, resolve overlaps, and commit. Trivial
   fixes you may apply directly.
4. `audit:effected -- audit <m>` green; commit
   `refactor(scratchpad): <m> review round N (effected-port S4)`; append the
   round to the ledger row (`reviewRounds`), backlog rows to `backlog`.
5. Next round on the new SHA. Close when a round's three reports all end in
   `REQUIRED: 0`.

### 12.6 Round limit

After round 5 with required findings still open: set the row `blocked` with
the open findings, print `EFFECTED_PORT_BLOCKED <m> 4 review-limit <row-id>`,
and continue with the next module. Section 0.5 handles the end.

---

## 13. Third-party dependency ledger

Every new runtime dep gets a backlog row on its module with a replacement
candidate. Candidates (not decisions):

| Dep | Module | Candidate |
| --- | --- | --- |
| `@octokit/core`, `@octokit/plugin-paginate-rest`, `@octokit/types` | github | `effect/http/HttpClient` + an `effect/http-api` client (the live import paths across `packages/**`); pagination as a `Stream` |
| `universal-github-app-jwt`, `tweetnacl`, `blakejs` | github | Effect crypto surface where it exists; otherwise a `drivers/*` home at promotion |
| `@azure/storage-blob` | github-actions | HttpClient against the blob REST surface |
| `@sigstore/bundle`, `@sigstore/sign` | sbom | keep; isolate behind a port interface at promotion |
| `@pnpm/catalogs.*` (4) | workspaces | port the small resolver logic (see `lockfiles`) |
| `ink` | cli/ui | keep (UI renderer); already an optional peer upstream |

Oracle devDeps (`yaml`, `smol-toml`, `minimatch`, `commonmark`, `oxc-parser`,
`spdx-*`, `string-width`) are permanent test oracles, not backlog.

---

## 14. Behaviour deviation protocol (D9)

A deviation is any observable difference from upstream: a different error
tag or order, a different formatted byte, a different accepted input, a
different default. Allowed causes, exactly two:

1. `law:<id>` — a beep law or lint forces it (name the rule).
2. `upstream-bug:<evidence>` — a verified bug, shown by a failing property or
   a spec citation that upstream's own test did not cover.

Procedure: write the ledger `deviations` entry first; then change the code;
then adjust the smallest possible upstream test and cite it in the entry;
then add it to README *Port notes → Deviations*. A reviewer finding that
proposes a deviation without one of the two causes is backlog, never required.

---

## 15. Transcript blocks

Print these exactly; the evaluator and the next session rely on them.

```text
EFFECTED_PORT_STAGE_START <module> S<n> <base-sha>
EFFECTED_PORT_CHECKPOINT <module> <stage-reached|done> <commit-sha>
EFFECTED_PORT_REVIEW_ROUND <module> <round> grok=<req>/<back> sol=<req>/<back> fable=<req>/<back>
EFFECTED_PORT_BLOCKED <module> <stage> <reason> <row-id>
EFFECTED_PORT_COMPLETE
```

`EFFECTED_PORT_COMPLETE` appears once, on its own line, directly after the
`ledger: 29/29 done` output of `audit:effected -- ledger --verify`.

---

## 16. Hard rules (never)

- Never write under `~/YeeBois/references/**`; never regenerate pinned fixtures.
- Never delete, skip, or weaken a test; never raise a timeout; never add
  `flakyTest`; never add coverage-ignore comments.
- Never leave `@effected/*` imports inside the lab; never import `node:http`;
  never use native `Set`/`Map`; never return a bare `Effect.gen` from a
  reusable function.
- Never use `as` (other than `as const`), `!`, `<T>` casts, or `any` in
  module source or tests.
- Never remove an Example to make docgen pass; never author `@example`,
  `@remarks`, `@module`, `@template`.
- Never push, publish, open a PR, or commit to `main`.
- Never substitute a reviewer seat's model to obtain a cleaner review.
- Never print `EFFECTED_PORT_COMPLETE` without the verifier line in the same
  turn.

---

## 17. Evidence and hand-offs

- Ledger: `scratchpad/effected/PORT_LEDGER.json` (truth).
- Review evidence: `scratchpad/effected/<m>/.review/round-N/`.
- Friction: `scratchpad/effected/OPPORTUNITIES.md`.
- Session ledger rows through `bun run beep session note` at every checkpoint.
- Commit history on `@lab/effected` with the `(effected-port S<n>)` suffix is
  the audit trail; `git log --grep effected-port` reconstructs progress.
