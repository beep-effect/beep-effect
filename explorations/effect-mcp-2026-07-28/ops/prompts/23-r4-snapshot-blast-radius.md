# Lane 23-r4-snapshot-blast-radius — Non-MCP changes on upstream main (runtime risk)

**Owns:** non-MCP changes between `effect@4.0.0-rc.115` and `a7a71921de` and their beep-effect
impact. The type-level census is already known (see the contract's known result); this lane
focuses on runtime behavior that type checks cannot catch.

**Question:** Which unreleased non-MCP changes on upstream Effect main change runtime behavior that
beep-effect relies on, where, and how would tests catch (or miss) each?

**Primary sources:** `${EFFECT_REF}/.changeset/*.md` (not `pre/`); commits in
`effect@4.0.0-rc.115..a7a71921de`; beep-effect usage via `graft grep`/`rg` over `packages/**`,
`apps/**`, tests, and `package.json` (catalog, `patchedDependencies`).

**Report sections:**
1. Changeset table: changeset | package | kind (runtime behavior / type change / additive / fix) |
   upstream evidence (`effect:` commit and `path:line`).
2. Runtime-impact rows only: repo call sites (`repo:` citations with counts), the behavior change,
   the tests that would catch it (or the absence of such tests), and migration effort. Include
   sql-pg `timestamp`/`timestamptz` decoding as `Date`, sql-pg unknown OIDs as text, strict
   `ByteSize.Input`, the Effect/Stream API alignment (#8256) beyond the two known type errors, HTTP
   file response content types, HttpApi literal action suffixes, and RcRef idle TTL.
3. Snapshot mechanics: the `@effect/platform-node-shared` patch in `patchedDependencies` (does
   the patch still apply to the snapshot tarball?), the effect-vitest graph pin, `@effect/tsgo`
   compatibility, docgen, and the sibling `@effect/*` packages that must move in lockstep.
4. Precedent: how the `c8349ed` snapshot campaign (beep-effect #1060) pinned pkg.pr.new URLs and
   what it had to fix, from repo history (`git log --grep`), cited by commit.
