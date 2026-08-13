# Graduation Grill — Locked Decisions (2026-08-10)

Product of the /grill-with-docs session over the @beep/effect-drizzle
graduation. These decisions seed the goals packet's P0 docs PR; canonical doc
text is authored there, not here.

1. **Family**: new top-level `packages/ecosystem/` — publishable,
   beep-independent packages. Grammar row:
   `packages/ecosystem/effect-drizzle → @beep/effect-drizzle` (workspace name
   = npm name; operator owns the npm `beep` org).
2. **Polarity law**: `src/` + `dependencies`/`peerDependencies` are 100%
   `@beep/*`-free (the published artifact); tests/devDependencies
   unrestricted (`@beep/pglite` harness stays). Contract is "publishable from
   the monorepo," not "extractable repo-free."
3. **Doctrine home**: new `standards/architecture/14-ecosystem-packages.md`
   (inverted gate, style-law scoping — published-package standards supersede
   repo effect-first laws inside members —, peer policy, release lane, gate
   profile, promotion/demotion) + grammar row in 07 + binding summary in
   ARCHITECTURE.md + DECISIONS.md entry + GLOSSARY term "ecosystem package".
4. **Role split vs @beep/drizzle**: @beep/drizzle (drivers) keeps EXECUTION
   (service, transactions, error normalization); @beep/effect-drizzle owns
   schema-derived PROJECTION/DDL/repositories, consumed in-repo like any
   external library. The shared-tables contract line "generic projection
   belongs in @beep/drizzle" is updated in P0 to point projection at
   @beep/effect-drizzle.
5. **Test harness**: migrate to `@effect/vitest` in the graduation packet —
   `layer()` subsumes the hand-rolled live-scope support; repo lanes run it
   natively; polarity-legal.
6. **Artifact**: ESM-only (`type: module`), exports map exposing exactly
   `.`, `@beep/effect-drizzle/pg`, `@beep/effect-drizzle/sqlite`,
   `@beep/effect-drizzle/package.json` — no wildcards, deep imports
   impossible; `sideEffects: false`; declarations built with `stripInternal`
   (the 214 `@internal` symbols vanish from published `.d.ts`); root `make`
   stays as the documented-bundle-cost convenience.
7. **Publish gate**: `private: true` until effect v4 stable AND drizzle 1.0
   final (the drizzle-kit rc-skew preload must be dead first). Changesets +
   release lane wired but dormant. Peers pinned to exact working beta/rc
   meanwhile. Pre-npm feedback via the public repo; the pigoz unscoped-name
   ask proceeds independently (operator's action).
8. **Gates**: standard workspace lanes (check/test/lint/docgen) + family
   additions: inverted-import gate promoted from the package boundary test
   into repo lint; tstyche lane at package creation (matrix + exact
   `~effect-drizzle.error` message pinning via .toRaiseError); instantiation
   budgets only after pinned-machine repeated sampling; bundle probe in CI.
9. **Packet**: slug `effect-drizzle-graduation`; P0 docs-only PR → P1
   package-creation PR (git-mv move, manifest, harness migration, gate,
   governance, suppression removals, scratchpad/bsl retired) → P2 quality
   integration. COMPLETE at P2. Beep adoption (BaseEntity parity,
   EntityTable replacement, backlog features) is a FUTURE separate packet
   chartered by research/baseentity-migration-plan.md.
