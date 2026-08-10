# Publishing standards ledger — @beep/effect-drizzle

Accumulating doctrine for the published package, distinct from beep repo laws.
Feeds the README, the round-6.5 style pass, and the graduation grill.

## Import & bundle law (operator, 2026-08-10)

- **Named imports from effect module paths**, never namespace imports, never the
  root barrel: `import { taggedEnum } from "effect/Data"` — effect's tree-shaking
  guidance for library authors; named imports give downstream bundlers the
  cleanest DCE.
- Companion requirements when the real package.json exists: `sideEffects: false`;
  `effect` and `drizzle-orm` as peerDependencies; zero runtime dependencies.
- **Natives-where-equivalent**: `["a", "b"].map(f)` is fine in published code —
  the repo's effect-helper-module preference does not apply here. Keep effect
  helpers where they carry type or semantic weight the native lacks
  (NonEmptyReadonlyArray preservation, Option/Match combinators, SchemaAST
  walking, dual/pipe APIs that are part of the public surface).
- Sequencing: round 6 (restructure/diet) lands in repo style; the ns→named import
  conversion and native-relaxation run as a dedicated 6.5 pass BEFORE the sqlite
  round, so all later code is born in published style.

## Tooling & law-script audit (operator flag, 2026-08-10)

Repo tooling enforces repo laws; published-package standards differ, so gates need
scoping before/at graduation. Known candidates:

- **effect-lsp plugin** — inherits into scratchpad/bsl via tsconfig `extends` and
  already fires there (round-2 `missedPipeableOpportunity`). The 6.5 style pass
  likely needs per-directory plugin tuning in the module tsconfig; at graduation
  the family needs its own plugin profile.
- **JSDoc/docgen law** — RESOLVED, no conflict: effect v4 itself uses titled
  `**Example** (Title)` sections (3,357 in `.repos/effect/packages/effect/src`
  vs 30 stray `@example` tags — the tag convention was v3-era). The repo law and
  the ecosystem convention agree; the published package keeps titled sections.
  Only the docgen *lane wiring* (which script runs on the family) remains a
  graduation logistics item.
- **Biome** — currently checks 0 files on scratchpad commits (effectively
  exempt); the family needs an explicit decision, not an accident of scoping.
- **Import-boundary gates** — the family's defining gate is NEW (no `@beep/*`
  imports allowed *into* members) and inverts the usual direction; existing
  boundary tooling (fallow boundaries, repo-symbol-discovery reuse law) must not
  demand @beep reuse inside members.
- **node-builtin import gate, instantiation budgets, coverage ratchet, docgen
  lanes, new-package governance gates** — each needs a family-profile decision
  when the real package.json lands (governance gates WILL fire on any new
  workspace package; see new-package memory).

All of these are graduation-grill agenda items; none block in-scratchpad rounds
except the effect-lsp tuning, which lands with the 6.5 pass if diagnostics fight
the published style.

## Previously locked (see round6-brief.md)

- One package, dialect subpath exports (`.`, `./pg`, `./sqlite`).
- Zero runtime deps; schema-is-truth scoped to boundaries (internal descriptor
  machinery on `Data.taggedEnum`, fields-are-schemas surface unchanged).
- No "bsl" on any public surface; type-perf budget via consumer fixture +
  `tsc --extendedDiagnostics`.
- Repo-law scoping principle: beep repo laws (helper modules, LiteralKit,
  namespace imports, @beep/* reuse) govern beep domain code; the published
  package follows THIS ledger. The graduation grill codifies that boundary in
  the new packages-family entry in ARCHITECTURE.md.
