# Repo Context Topology

## Status

Superseded — the repo-exports catalog was retired; discovery moved to live
search (`rg` over live source and barrels) plus the `repo-symbol-discovery`
skill. Manifest: `initiative.status: superseded`, `lifecycle: reference`.

### Closeout reconciliation (2026-07-11)

The Phase 1 artifact (`standards/repo-exports.catalog.jsonc`/`.md`) shipped on
2026-05-14 (`af57941c10` added the generator, `ff1445f6c2` surfaced the
catalog to agents, and PR #148 — merged 2026-05-14 — landed the
`repo-symbol-discovery` skill). The generated catalog was later deleted in
`8852619f04` (2026-06-18) and formally retired in CLAUDE.md, which now
directs agents to live ripgrep search and the `repo-symbol-discovery` skill
instead. This packet is retained as reference for the context-topology idea;
the manifest was reconciled to `superseded` on 2026-07-11.

## Mission

Make repo topology carry more coding-agent context. The first proof is a
generated public export catalog that lets agents find existing symbols, legal
current import specifiers, summaries, and source locations before recreating
local helpers.

This initiative starts from the observation that paths, package subpaths, role
suffixes, export maps, JSDoc summaries, and generated catalogs can compress
repo knowledge more reliably than another long prompt.

## First Proof

Phase 1 generates:

- `standards/repo-exports.catalog.jsonc`
- `standards/repo-exports.catalog.md`

The catalog is derived from package export maps, TypeScript exported
declarations, and JSDoc. It is descriptive current-state metadata, not an
architecture authority. `UnknownRecord` from `@beep/schema` is the seed proof:
an agent should be able to discover the repo-owned schema by name, intent text,
package, current legal import specifier, and source location without a
hand-maintained duplicate registry.

## Reading Order

- [SPEC.md](./SPEC.md) - binding contract for the context-topology proof
- [PLAN.md](./PLAN.md) - implementation and follow-up path
- [ops/manifest.json](./ops/manifest.json) - machine-readable routing metadata
