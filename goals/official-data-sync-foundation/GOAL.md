# GOAL: Ship the official data sync foundation

Repo: `beep-effect` (this checkout).

Outcome: `@beep/data` owns automatically refreshed official data snapshots, and
`@beep/schema` derives robust literals/codecs from those snapshots.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/official-data-sync-foundation/README.md`
- `goals/official-data-sync-foundation/SPEC.md`
- `goals/official-data-sync-foundation/PLAN.md`
- `goals/official-data-sync-foundation/ops/manifest.json`

Read those first, then read repo instructions and governing package standards.
Higher-priority repo standards outrank packet prose when they conflict.

Scope:

- In: `SyncDataToTs`, `@beep/data`, `@beep/schema`, `.github/workflows/data-sync.yml`,
  root dependency metadata needed by sync, tests, generated data files, and this
  goal packet.
- Out: `Sha256` migration, unrelated package refactors, runtime network fetching
  from schema modules, and paid ISO 3166 integration.

Workflow:

1. Inspect current repo state and preserve unrelated worktree changes.
2. Keep raw official data, maps, metadata, and JSON sidecars in `@beep/data`.
3. Derive schema literals/codecs in `@beep/schema` from `@beep/data` using
   `@beep/utils/Struct` helpers.
4. Use Effect v4 services/APIs for source hashing and canonical diffs; use
   `@beep/md` for Markdown report output.
5. Keep source choices evidence-backed: SIX ISO 4217, IANA media registry, IANA
   tzdb, and CLDR JSON for free machine-readable territory/country-like data.
6. Update packet evidence/status if readiness changes.
7. At P3 Close, add a closeout reflection under `history/reflections/` and run
   the reflection-artifacts lint if required.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
bun run beep sync-data-to-ts --all --check --report-dir "$(mktemp -d)"
bun run --cwd packages/tooling/tool/cli check
bun run --cwd packages/tooling/tool/cli test sync-data-to-ts
bun run --cwd packages/foundation/primitive/data check
bun run --cwd packages/foundation/primitive/data test
bun run --cwd packages/foundation/modeling/schema check
bun run --cwd packages/foundation/modeling/schema test CurrencyCode Timezone TerritoryCode MimeType
bun run beep lint schema-topology
test "$(wc -m < goals/official-data-sync-foundation/GOAL.md)" -le 4000
jq . goals/official-data-sync-foundation/ops/manifest.json
git diff --check -- goals/official-data-sync-foundation
```

Stop and report before touching public API beyond this spec, auth, infra,
security behavior, paid data sources, destructive state, or unrelated dirty
files.
