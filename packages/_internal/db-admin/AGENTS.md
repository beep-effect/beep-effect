# db-admin Agent Notes

- Internal migration aggregation package for repo-owned database proof targets.
- Import slice table schemas into db-admin for migration generation only; production apps must not depend on `_internal/db-admin`.
- Use current `@beep/postgres`, `@beep/drizzle`, and `@beep/test-utils` primitives for live database proof work.
- Treat older Effect v3 db-admin packages as capability references, not topology templates.

## Adding `CREATE EXTENSION` to a shared migration

A single `CREATE EXTENSION` line is replayed by every migration consumer; one such
line had a nine-consumer blast radius (2026-07-25 epistemic edge migration —
evidence in `goals/epistemic-bitemporal-edge-core/history/2026-07-25-p1-implementation.md`).
Sweep all of these before landing:

- PGlite in-process test lanes: wire the extension bundle through the
  `@beep/test-utils` `SqlTest` `inProcess.extensions` seam — plain PGlite ships
  no contrib extensions.
- Bundled/compiled PGlite consumers (e.g. the professional-desktop sidecar):
  embed the extension tarball with a `with { type: "file" }` import and
  materialize it to a real temp file before handing it to PGlite — extension
  loaders use `node:fs`, which cannot open `$bunfs` paths
  (`apps/professional-desktop/src/runtime/Pglite.ts` is the pattern).
- Vitest configs that import such suites: add the asset glob (e.g.
  `**/*.tar.gz`) to `assetsInclude` or Vite fails parsing the import.
- External-server lanes (real Postgres): the extension must exist server-side
  (contrib package installed); `CREATE EXTENSION IF NOT EXISTS` does not
  install binaries.
- Migration proof manifests: regenerate/extend the accepted-operation entries
  (`AcceptedProofManifest`) — the operation-plan test is a byte-equality proof.
