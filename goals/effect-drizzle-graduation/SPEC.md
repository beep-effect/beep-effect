# Effect-Drizzle Graduation Spec

## Objective

`scratchpad/bsl` (the effect v4 + drizzle SQL DSL proven through rounds 1-7.5,
two quality loops, and PR #651) ships as `@beep/effect-drizzle` (member root
`packages/ecosystem/effect-drizzle/**`, created in P1) inside a newly
chartered `ecosystem` package family,
with the family's doctrine, gates, and quality lanes landed in the standards
and repo tooling. Complete at P2; npm publication itself stays gated
(`private: true`) until effect v4 stable and drizzle 1.0 final.

## Non-Goals

- Beep adoption of the package (BaseEntity parity, `EntityTable` replacement,
  slice-table migration, backlog features). That is a FUTURE packet chartered
  by `scratchpad/bsl/research/baseentity-migration-plan.md`.
- Actually publishing to npm, or the unscoped `effect-drizzle` npm-name ask
  (operator's own action, independent of this packet).
- New DSL features. The module graduates as proven at PR #651's merge
  (`e92b8b7d9d`); feature work resumes post-graduation.
- Re-adding a repo-wide type-test surface. The tstyche lane here is scoped to
  ecosystem members only (see Constraints).

## Source Hierarchy

1. The graduation grill's locked decisions:
   `scratchpad/bsl/research/graduation-decisions.md`.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. `standards/ARCHITECTURE.md` + the numbered architecture docs (14 is created
   by this packet's P0 and becomes binding for P1/P2).
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- P0 (docs-only): `standards/architecture/14-ecosystem-packages.md` (new),
  `standards/architecture/07-non-slice-families.md` (family grammar),
  `standards/ARCHITECTURE.md` (binding summary + routing row),
  `standards/architecture/GLOSSARY.md` ("Ecosystem Package"),
  `standards/architecture/DECISIONS.md` (dated entry),
  `standards/architecture/README.md` (packet index row),
  `packages/shared/tables/README.md` (projection contract line),
  `goals/effect-drizzle-graduation/**`, `goals/INDEX.md`.
- P1: `packages/ecosystem/effect-drizzle/**` (git-mv from
  `scratchpad/bsl`), its manifest/tsconfig/turbo wiring, the scoped
  family-root `AGENTS.md` style-exception guide (under
  `packages/ecosystem/**`), `@effect/vitest`
  harness migration, the member tstyche lane (created with the package),
  inverted-import gate in repo lint, governance registrations, suppression
  removals, `scratchpad/bsl` retirement. Known family-encoding surfaces P1
  must extend (inventoried by the P0 review panel): `BeepPackageFamily` +
  manifest tagged union in
  `packages/tooling/library/repo-utils/src/schemas/PackageJson.ts`,
  `VALID_FAMILIES` + family roots in the create-package command, the root
  `package.json` workspaces globs, `syncpack.config.ts`, style-law scan
  scoping (`EffectImports.ts`, `TerseEffect.ts`), and the lint shard routing
  in `Lint.command.ts`.
- P2: family CI integration (bundle probe, CI wiring for the member lanes),
  docgen surface, closeout artifacts.

## Constraints

Locked by the graduation grill (2026-08-10); do not relitigate without the
operator:

1. **Family**: new top-level flat family `packages/ecosystem/<name>` →
   `@beep/<name>` (workspace name = npm name; operator owns the npm `beep`
   org). First member: `effect-drizzle`.
2. **Polarity law (inverted gate)**: member `src/` and runtime manifest edges
   (`dependencies`/`peerDependencies`/`optionalDependencies`) are 100%
   `@beep/*`-free, and bundled-dependency fields are prohibited; tests and
   `devDependencies` are unrestricted (`@beep/pglite` harness stays). The
   contract is "publishable from the monorepo," not "extractable repo-free."
3. **Style-law scoping**: published-package standards supersede repo
   effect-first laws inside members, per
   `scratchpad/bsl/research/publishing-standards.md` (named imports from
   effect module paths, natives-where-equivalent, line-leading `@` escaping,
   `@internal` marking). Repo law scripts must not flag members for following
   them.
4. **Role split**: `@beep/drizzle` (drivers) keeps EXECUTION — service,
   transactions, error normalization. `@beep/effect-drizzle` owns
   schema-derived PROJECTION/DDL/repositories and is consumed in-repo like any
   external library. The shared-tables contract line pointing generic
   projection at `@beep/drizzle` is updated in P0.
5. **Test harness**: migrate the hand-rolled live-scope support to
   `@effect/vitest` `layer()` in P1.
6. **Artifact**: ESM-only, exports map exposing exactly `"."`, `"./pg"`,
   `"./sqlite"`, `"./package.json"`; `sideEffects: false`; declarations built with
   `stripInternal` so `@internal` symbols vanish from published `.d.ts`; an
   explicit `files` allowlist verified by an npm-pack probe (the tarball must
   never carry research corpora, tests, or workspace files); the root `make`
   convenience stays, with its bundle cost documented.
7. **Publish gate**: `private: true` until effect v4 stable AND drizzle 1.0
   final (the drizzle-kit rc-skew preload must be dead first). Changesets +
   release lane wired but dormant; `publishConfig.access: "public"` (+ repo
   provenance setting) declared at creation since the repo changesets config
   is `restricted`; peers pinned exact meanwhile. Pre-npm feedback flows
   through the public repository.
8. **Gates**: standard workspace lanes + family additions — inverted-import
   gate promoted from the package boundary test into repo lint; a tstyche lane
   scoped to ecosystem members, created at package creation (P1; a deliberate,
   documented exception to the 2026-08 repo-wide type-test removal — the
   DECISIONS entry must cross-reference it) covering the derived-table/
   variant/metadata/FK/kit matrix with exact `~effect-drizzle.error` literal
   pinning via `.toRaiseError` and multi-TypeScript targets validating the
   peer range; instantiation budgets only after pinned-machine repeated
   sampling; bundle probe in CI (P2).
9. **Sequencing**: P0 docs-only PR → P1 package-creation PR → P2 quality
   integration PR. Each phase lands as its own PR driven to mergeable via
   yeet. Packet-state flips and the closeout reflection land in the same PR as
   the final work (repo law).

## Acceptance Criteria

- [ ] P0: doc 14 exists and is indexed; family grammar, binding summary,
      glossary term, decision entry, and the shared-tables projection line all
      agree; packet registered in `goals/INDEX.md`; PR merged.
- [ ] P1: `@beep/effect-drizzle` builds, checks, tests, and
      docgens green through standard lanes; the member tstyche lane exists and
      passes (matrix + exact `~effect-drizzle.error` literals via
      `.toRaiseError`); the inverted-import gate fails on a deliberate
      `@beep/*` import in `src/`; `scratchpad/bsl` is retired; PR merged.
- [ ] P2: family lanes (member tstyche, bundle probe) run in CI;
      manifest/README/INDEX flipped and closeout reflection landed in the
      final PR; PR merged.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/effect-drizzle-graduation/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/effect-drizzle-graduation/ops/manifest.json` | Passes |
| Goals index | `bun run beep goals index --check` | Passes |
| Whitespace | `git diff --check -- goals/effect-drizzle-graduation` | Passes |
| Phase PRs | `bun run beep yeet status --remote` | `merge-ready: yes` per phase |
| Reflection lint (P2) | `bun run beep lint reflection-artifacts` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope (beep adoption is out).
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| tstyche lane despite 2026-08 repo-wide type-test removal | `packages/ecosystem/*` only | operator (grill 2026-08-10) | Published `.d.ts` is the product; type-level regressions are user-facing | Family retired or a superseding type-test doctrine |
