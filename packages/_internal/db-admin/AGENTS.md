# db-admin Agent Notes

- Internal migration aggregation package for repo-owned database proof targets.
- Import slice table schemas into db-admin for migration generation only; production apps must not depend on `_internal/db-admin`.
- Migration authoring is drizzle-kit driven since the `20260813130540_baseline`
  snapshot (history was wiped and re-baselined 2026-08-13 with zero users):
  schema changes go through `bun run generate -- --name <slug>`
  (hand-written SQL through `generate:custom` — snapshot-less folders are
  invisible to drizzle-kit's chain). `migrations:check` in `beep:check` fails
  on schema-vs-migration drift. Every table must be re-exported FLAT from
  `src/schema.ts` (drizzle-kit scans one export level deep). Entity models own
  their effect-drizzle column metadata; tables packages project them with
  `toPgTable`, and db-admin only aggregates those concrete table exports. Treat drizzle
  catalog bumps as toolchain changes: rerun `migrations:check` and the desktop
  `codegen:check` immediately. After landing a migration, re-sync the desktop
  bundle: `bun run --cwd apps/professional-desktop codegen`.
- plpgsql in migration SQL is legal but splitter-constrained: the
  `LegacyStatementBoundary` splitter is not dollar-quote-aware, so a function
  body must never contain `;` + newline followed by one of its 12 boundary
  keywords (ALTER/BEGIN/COMMENT/CREATE/DELETE/DROP/GRANT/INSERT/REVOKE/SET/
  TRUNCATE/UPDATE/WITH — note `BEGIN` is one). A single-`RAISE` guard body is
  safe (pre-baseline precedent: the 2026-07-26 epistemic execution ledger
  migration, now folded into the baseline); a body that
  issues INSERT/UPDATE statements would be split mid-function and fail loudly
  at migration time. Extend the splitter before writing such a body.
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
