# PLAN — Effect-Native Migration

Historical execution plan for the goal defined in [SPEC.md](./SPEC.md). All five
recorded phases are complete in [ops/progress.json](./ops/progress.json).

## Phase 0 — Bootstrap (COMPLETE)

Scaffold, `README.md`, `SPEC.md`, this `PLAN.md`, the discovery/remediation
prompt templates, `ops/manifest.json`, and `ops/progress.json` already exist.
No further action.

## Phase 1 — Symbol inventories (COMPLETE)

**Goal:** produce one symbol map per category so downstream agents have a
complete picture of the available Effect/`@beep/utils` helpers.

- Spawn **7 parallel agents**, one per category (`Map`, `Set`, `String`,
  `Object`, `Date`, `JSON`, `Array`).
- Each agent emits `ops/inventory/symbols/effect-native-<Category>.json`
  (schema: SPEC §6.1), parsing the target module source + JSDoc:
  - `Map` → `effect/HashMap`, `effect/MutableHashMap`, `effect/Record`
  - `Set` → `effect/HashSet`, `effect/MutableHashSet`
  - `String` → `effect/String` + `@beep/utils/Str`
  - `Object` → `effect/Struct` + `@beep/utils/Struct`, `effect/Record`
  - `Date` → `effect/DateTime` + `@beep/utils/DateTime`, `effect/Duration`
  - `JSON` → `effect/Schema` JSON codecs (`fromJsonString`,
    `UnknownFromJsonString`, `decodeUnknownEffect`, `encodeUnknownEffect`)
  - `Array` → `effect/Array` + `@beep/utils/Array`
- The historical inventory outputs retain the descriptions used by the completed
  run. Any future symbol discovery must use live source and barrel searches.
- Populate `imports.preferred/effect/utils` per SPEC §4 (wrapper form is the
  default `preferred` when one exists).

**Acceptance:** 7 well-formed JSON files exist and parse.

## Phase 1.5 — Stress-test the plan (COMPLETE)

Run the `grill-with-docs` skill against this `PLAN.md` and `SPEC.md` to check
them against `standards/ARCHITECTURE.md`, `GLOSSARY.md`, and `DECISIONS.md`.
Resolve or record any findings **before** making source edits. No code changes
in this phase.

## Phase 2 — Discovery (per-package, all categories) (COMPLETE)

**Goal:** a complete, machine-readable inventory of native-usage violations.

1. `bun run topo-sort` to list in-scope packages in dependency order.
2. Compute `canImportUtils` per package from the dependency graph (SPEC §4).
3. For each in-scope package, run one discovery agent using
   [ops/prompts/discovery.agent.md](./ops/prompts/discovery.agent.md), injecting:
   the package path, its `canImportUtils` flag, and the 7 symbol inventories.
4. Each agent walks every in-scope module in its package and writes
   `ops/inventory/usages/<sanitized-package>/<Category>.json` (schema SPEC §6.2),
   one file per category that has findings.
5. Run in **bounded parallel waves** (~4–6 concurrent). Update `ops/progress.json`
   per package as `discovery: done`.

**Acceptance:** every in-scope package has a discovery entry (a set of category
files, or an explicit empty/clean marker) and `progress.json` reflects it.

## Phase 3 — Remediation (per-package, topo order) (COMPLETE)

**Goal:** apply the substitutions and keep every touched package green.

1. Process packages in **topological order** (dependencies first), in bounded
   parallel waves where independent.
2. For each package, run one remediation agent using
   [ops/prompts/remediation.agent.md](./ops/prompts/remediation.agent.md),
   injecting: the package path, `canImportUtils`, the package's Phase 2 usage
   files, and **only** the symbol inventories for categories that have findings
   in that package.
3. The agent applies SPEC §3/§4/§5 substitutions, then runs the SPEC §7 gate
   (typecheck + lint + effect-first checks scoped to the package).
4. On green: commit the package's changes; mark `progress.json`
   `remediation: done`. On failure: stop the wave, leave the package
   `remediation: blocked` with the failing output, and report.

**Acceptance:** all in-scope packages `remediation: done`; repo `bun run check`
and `bun run lint` pass; no residual native usage in scope (effect-first checks
clean).

## Operating constraints

- Never edit `.repos/**` or generated files.
- One branch for the whole goal; **one commit per package** in Phase 3 for
  reviewability and resumability.
- The run is resumable: always reconcile against `ops/progress.json` before
  starting a wave; skip packages already `done`.

## Completion reconciliation

The completed ledger contains 7 symbol inventories and 75 package entries, all
marked done. The 2026-07-14 reconciliation checked only whether each recorded
package path still exists at HEAD; it did not perform fresh source discovery or
re-audit the historical migration. See
[history/2026-07-14-tree-reconciliation.md](./history/2026-07-14-tree-reconciliation.md).
