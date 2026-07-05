---
name: crispen
description: >
  Refactoring operator: "crispen", "crisp this up", "reduce helpers", "colocate
  behavior", "helper-wall cleanup", "schema is truth" as a refactor request.
  Absorbs invariants from existing business logic into existing schemas —
  decode/guard-wall deletion, *Defaults removal, literal-family collapse,
  Option-ifying nullish fields. NOT for authoring new schemas or domain models
  (use schema-first-development).
argument-hint: "[lite|full|ultra]"
version: 0.2.0
status: active
---

# Crispen

**The schema is truth; behavior precipitates.** Crispening is a *refactoring
operator*: it pushes invariants and pure behavior already living in business
logic *into the schema and onto the data*, so business-logic files shrink to
intent. Win condition: **the first ~200 lines of any business-logic module read
as pure intent** — no decode/guard helper wall, no `*Defaults` spreads, no
imperative `let`/`for`/`push` loops.

This is ponytail's minimalism aimed at existing schema-shaped code. It is a
*lens*, not a law source: the schema laws live in **`schema-first-development`**
(and `effect-first-development` for anything broader). When crispening instinct
conflicts with those laws, **the laws win**. Authoring *new* schemas or domain
models is `schema-first-development`'s lane, not this skill's.

## Persistence

ACTIVE EVERY RESPONSE while engaged. No drift back to helper-wall habits. Still
active if unsure. Off only: "stop crispen" / "normal mode". Default: **full**.
Switch: `/crispen lite|full|ultra`. Level persists until changed or session end.

## The crispening ladder

Before you keep a helper, climb. **Stop at the first rung that removes the
noise** — but only *after* you understand the module and trace the real flow.
Absorbing logic into the wrong schema is a second bug wearing a smaller diff.

1. **Can the schema carry this invariant instead of code?** (default, refinement,
   brand, `Option` field)
2. **Does a schema/combinator/primitive already exist?** Search `@beep/schema` and
   `@beep/identity` before inventing — see `schema-first-development` →
   `references/local-primitives.md`.
3. **Absence/nullish → `Option` in the schema**, not a null-check.
4. **Constant/bool default → the schema**, not a `*Defaults` spread.
5. **Decode/guard wall → colocated statics** on the schema const/class.
6. **Repeated literal/variant family → one node + a kit** (`LiteralKit` /
   `MappedLiteralKit`).
7. **Branching → a fold; passthrough → point-free.**
8. **Split roles**: `.model.ts` / `.behavior.ts` / `.codec.ts` / `.render.ts` /
   `.escape.ts` — specialize per package, no package needs all five.

For every rung, the exact combinator, its signature, and a real usage site are in
**`references/crispening.md`** (this skill). The governing rules for *which*
pattern is lawful are in **`schema-first-development`**: `references/repo-laws.md`
(enforced laws), `references/pattern-catalog.md` (pattern selection +
anti-patterns), `references/local-primitives.md` (shared `@beep/schema`
primitives), `references/examples.md` (real exemplars). Load those, don't
re-derive them here.

## Output discipline

Code first. Then at most three short lines: **what invariant moved into the
schema, what helper wall was deleted, what was deliberately left.** No essays.
If the explanation is longer than the deletion, delete the explanation.

Mark deliberately un-absorbed logic with a `crispen:` comment naming *why* and
the *upgrade path*:

```ts
// crispen: kept as a helper — the refinement needs a cross-field check S.filterGroup
// can't express yet; fold into the schema when it can.
```

## Intensity

| Level | What changes |
|-------|--------------|
| **lite** | Build/leave what's asked, but name the crispening opportunity in one line — the schema or combinator that would absorb it. User picks. |
| **full** | The ladder enforced. Absorb invariants into the schema, colocate statics, collapse literals, delete the helper wall. Shortest diff. Default. |
| **ultra** | Absorption extremist. Deletion before addition; challenge whether the helper/field/variant needs to exist at all; refuse to write a helper a combinator already provides. |

## When NOT to crispen

- **Authoring-intent work** (new schemas, new domain models, boundary decode
  design) → `schema-first-development`.
- **Never weaken a trust boundary.** Escaping, sanitization, URL/injection guards
  stay explicit and property-tested. Behavior parity over cleverness.
- **Never touch load-bearing `declare namespace Type/Encoded` blocks** — required
  for `S.suspend` mutual recursion. Verbosity there is correct, not debt.
- **Don't collapse a union that needs distinct per-variant behavior**; an
  exhaustive-match arm per real variant is the feature, not the noise.
- **Keep one runnable proof behind every absorption** — a law/round-trip test
  that fails if the moved invariant breaks.
- Never lazy about understanding: the ladder shortens the code, never the reading.

## Verify

```bash
bun run beep laws terse-effect --check
bun run beep laws dual-arity --check
bun run beep laws effect-fn --check
bun run beep laws native-runtime --check
bun run beep laws effect-imports --check
bun run beep lint schema-first
bun run beep lint schema-topology
bun run beep yeet verify                    # full proof
```

Smell-checks before you start — the walls to demolish:

```bash
rg -n 'const (is|decode)\w+ = S\.(is|decodeUnknown)' path/   # decode/guard wall
rg -n '\.\.\.\w*Defaults\b' path/                            # *Defaults spreads
rg -n ' as [A-Z]| as unknown|![.)\]]' path/                  # assertions / non-null
```

Do not run manual `turbo`/`docgen`/`vitest` while a background `yeet verify` is
in flight — daemon contention emits spurious failures; use read-only probes.

## Reference & escalation

- **`references/crispening.md`** (this skill) — the crispening toolkit map:
  every combinator, its signature, the noise it kills, a real usage site; plus
  the before→after moves catalog from the `@beep/md` / `@beep/lexical-schema`
  refactor.
- **`schema-first-development`** — THE law source: `references/repo-laws.md`,
  `references/pattern-catalog.md`, `references/local-primitives.md`,
  `references/examples.md`.
- **`effect-first-development`** — anything broader than schema work (services,
  errors, concurrency).
- **`ponytail`** — the parent lazy-minimal ethos when the task isn't
  schema-shaped.
