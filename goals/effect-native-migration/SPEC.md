# SPEC — Effect-Native Migration

This is the normative source of truth for the goal. Agents MUST obey it exactly.
When this document and a sub-agent prompt disagree, this document wins.

## 1. Goal

Replace native JavaScript `Map`, `Set`, `String`, `Object`, `Date`, `JSON`, and
`Array` usage with Effect-native equivalents across first-party source, per
`.claude/skills/effect-first-development/` (Law #7). Prefer `@beep/utils/*`
wrappers where importable.

## 2. Scope

**In scope**

- First-party source under `packages/**` and `apps/**`.
- Test and fixture files (`**/test/**`, `**/*.test.ts`, fixtures) are in scope
  **only** for the JSON ban (`JSON.parse`/`JSON.stringify`) and the String ban
  (native `.split`/`.trim`/`.toLowerCase`/`.toUpperCase`/`.replace`, etc.). All
  other categories are ignored in tests/fixtures for this goal.

**What counts as a violation (normative).** A violation is a native **prototype
method call** (`arr.map(...)`, `s.replace(...)`, `date.getTime()`), a native
**static** (`Object.keys`, `JSON.parse`, `Date.now`), or a native **constructor**
(`new Map/Set/WeakSet/Date`). The following are **language syntax / property
access, NOT native helpers, and are out of scope** (the repo's own
`bun run lint` does not flag them):

- object-literal spread/merge `{ ...a, ...b }` and computed-key literals `{ [k]: v }`;
- bracket index access/assignment `arr[0]`, `record[key]`, `record[key] = v`, and
  `RegExpMatchArray` capture-group reads `match[n]`;
- `.length` reads and `.length`-based empty/non-empty branching.

(Migrating such sites to `A.head`/`A.get`/`R.get`/`R.set` is a *welcome* idiomatic
improvement but is never *required* by this goal and is never flagged as a
violation.)

**Out of scope (hard exclusions — never edit or scan)**

- `.repos/**` — vendored upstream subtrees, including the `effect-v4` source.
- `**/dist/**`, `**/build/**`, generated docgen output, and any generated files.
- `node_modules/**`.

**Deferred (explicitly not part of this goal)**

- `packages/foundation/modeling/utils/src/Number.ts` / native `Number` migration.
- Schema modeling for JSON sites that lack a schema (those are flagged, not
  authored here).
- Native `Math.random()` / randomness migration (tracked by the skill, not here).

## 3. Category → target mapping (normative)

| Native | Effect target(s) | `@beep/utils` wrapper? | Canonical alias |
|--------|------------------|------------------------|-----------------|
| `Map` | `effect/HashMap` (default) · `effect/MutableHashMap` (justified local only) · `effect/Record` (string keys) | none → raw `effect/*` | `HashMap` / `MutableHashMap` / `R` |
| `Set` | `effect/HashSet` (default) · `effect/MutableHashSet` (justified local only) | none → raw `effect/*` | `HashSet` / `MutableHashSet` |
| `String` | `effect/String` | **`@beep/utils/Str`** | `Str` |
| `Object` | `effect/Struct` (struct ops) · `effect/Record` (string-keyed records) | Struct → **`@beep/utils/Struct`**; Record → raw `effect/Record` | `Struct` / `R` |
| `Date` | `effect/DateTime` (instants) · `effect/Duration` (spans) | DateTime → **`@beep/utils/DateTime`**; Duration → raw `effect/Duration` | `DateTime` / `Duration` |
| `JSON` | `effect/Schema` JSON codecs | none → raw `effect/Schema` | `S` |
| `Array` | `effect/Array` | **`@beep/utils/Array`** | `A` |

## 4. Import-precedence & cycle rule (normative)

`@beep/utils` workspace-depends only on `@beep/identity`. Therefore:

- `@beep/utils` itself **and its transitive first-party dependencies** (the
  `@beep/identity` chain) **cannot** import `@beep/utils` → they MUST use raw
  `effect/*`.
- **`foundation/primitive` packages also have `canImportUtils: false`**, even
  though `@beep/utils` does not depend on them. `@beep/utils` is a
  `foundation/modeling` package, and the architecture kind rule
  (`standards/ARCHITECTURE.md`: kind `primitive` may depend **only** on
  `foundation/primitive`) forbids a `primitive` package from importing it. They
  MUST use raw `effect/*`. Any pre-existing `primitive → @beep/utils` dependency
  is topology drift this goal does not deepen (see
  `research/grill-with-docs-findings.md` F1).
- Every other in-scope package has `canImportUtils: true`.
- For categories **with** a wrapper (`Array`, `String`, `Struct`, `DateTime`):
  - `canImportUtils: true` → `import { A } from "@beep/utils"` (named namespace
    re-export from the barrel) or the subpath `import * as A from "@beep/utils/Array"`.
  - `canImportUtils: false` → raw `import * as A from "effect/Array"`.
- For categories **without** a wrapper (`Record`, `HashMap`, `MutableHashMap`,
  `HashSet`, `MutableHashSet`, `Schema`): always raw `effect/*`, regardless of
  `canImportUtils`.

`canImportUtils` is computed once from `bun run topo-sort` plus the dependency
graph: a package is `false` if it is in `@beep/utils`'s transitive first-party
dependency closure (the `@beep/identity` chain) **or** it is a
`foundation/primitive` package; every other in-scope package is `true`. It is
passed to each per-package agent. Agents MUST NOT guess it.

`@beep/utils` barrel aliases available (from `packages/foundation/modeling/utils/src/index.ts`):
`A` (Array), `Str` (String), `Struct`, `DateTime`, plus `O`, `P`, `Bool`, `Num`,
`Stream`, `Text`. Subpath imports (`@beep/utils/Array`, `@beep/utils/Str`, …)
are also valid via the package's `"./*"` export.

## 5. Decision rules (normative)

These resolve the choices the skill leaves open. Agents apply them
deterministically; only the listed ambiguous cases get `needsHumanDecision`.

- **Map/Set — immutable by default.** Use `HashMap`/`HashSet`. Use
  `MutableHashMap`/`MutableHashSet` **only** for local hot-loop accumulation
  that never escapes the function; flag such sites with `needsHumanDecision`.
  When keys are strings and the value is used as a record, prefer
  `effect/Record` over `HashMap`.
- **Date — split by intent.** `DateTime` for instants / timestamps / wall-clock
  and date arithmetic; `Duration` for spans / timeouts / intervals. Ban
  `new Date()` and `Date.now()` in domain logic — use `DateTime` + `Clock`.
  Sites where instant-vs-span is unclear get `needsHumanDecision`.
- **JSON — schema-first with a safe fallback.** Where a target `Schema` exists,
  use `S.fromJsonString(schema)` + `S.decodeUnknownEffect` (and
  `S.encodeUnknownEffect` for stringify). Where no schema exists, use
  `S.UnknownFromJsonString` (decodes to `unknown`) and set
  `needsHumanDecision` with a note to model a schema later. Never leave a raw
  `JSON.parse`/`JSON.stringify` in in-scope code.
- **Array/String — direct replacement of method calls.** Replace native
  prototype **method calls** with the mapped helper (e.g. `arr.find` →
  `A.findFirst`, `arr.sort` → `A.sort(order)` with an explicit `Order`,
  `arr.includes` → `A.contains`, `s.split` → `Str.split`). Resolve the import per
  §4. `.length` reads and bracket index access are not method calls — out of
  scope per §2.
- **Object — native static helpers only, never schema authoring.** Replace native
  object **static helpers** (`Object.keys/values/entries/assign/fromEntries/freeze`)
  with `effect/Struct` / `effect/Record` helpers. Object-literal spread/merge,
  computed-key literals, and string-keyed index access/assignment are syntax, not
  helpers — out of scope per §2. Do **NOT** convert a plain object into an
  `S.Class`/`S.Struct` schema — that is new schema authoring, a §8 non-goal.
  (SKILL Law #24 prefers `S.Class` for *domain object schemas*, a separate
  concern; see `research/grill-with-docs-findings.md` F2.)

## 6. Inventory schemas

### 6.1 Symbol inventory (Phase 1 output)

`ops/inventory/symbols/effect-native-<Category>.json` is an array of:

```ts
type EffectNativeModuleExportItem = {
  category: "Map" | "Set" | "String" | "Object" | "Date" | "JSON" | "Array"
  symbolName: string                 // e.g. "map", "findFirst", "NonEmptyArray"
  kind: "type" | "function"
  imports: {
    preferred: string                // the import line agents should emit by default
    effect: string                   // the raw effect/* form
    utils?: string                   // the @beep/utils form, when a wrapper exists
  }
  description: string                // top-level JSDoc description, tags stripped
  examples: Array<string>            // every @example block, code only
}
```

### 6.2 Usage-violation inventory (Phase 2 output)

`ops/inventory/usages/<sanitized-package>/<Category>.json` is an array of:

```ts
type UsageViolationItem = {
  category: "Map" | "Set" | "String" | "Object" | "Date" | "JSON" | "Array"
  package: string                    // e.g. "@beep/schema"
  filePath: string                   // repo-relative path
  line: number
  nativeSnippet: string              // the offending expression
  nativeSymbol: string               // e.g. "Array.prototype.find", "JSON.parse", "new Map"
  suggestedTarget: string            // mapped Effect/util symbol
  suggestedImport: string            // resolved per §4 (uses canImportUtils)
  needsHumanDecision?: boolean       // mutable-vs-immutable, DateTime-vs-Duration, missing-schema JSON
  note?: string
}
```

`<sanitized-package>` replaces `/` and `@` so the path is filesystem-safe (e.g.
`@beep/schema` → `beep__schema`).

## 7. Acceptance gates (normative)

Per-package, in topological order (dependencies first):

1. **Typecheck + lint** for the touched package via `beep-cli check` / `beep-cli lint`
   (root `bun run check` / `bun run lint`).
2. **Effect-first checks** from the skill's verification list, scoped to the
   package (e.g. `rg` for residual `JSON.parse|JSON.stringify`, native
   `.split|.trim|.toLowerCase|.toUpperCase|.replace`, `new Map|new Set|new Date`,
   `Date.now`).
3. Only when all pass are the package's edits accepted and committed. If the
   gate fails, stop the wave and report; do not advance dependents.

## 8. Non-goals

- No behavior changes beyond the native→Effect substitution.
- No edits to `.repos/**` or generated files.
- No new schema authoring (flag instead).
- No `Number` migration in this goal.
