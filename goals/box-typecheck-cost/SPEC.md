# Box Typecheck Cost — Decision Document

Authored 2026-08-01 from a `/grill-with-docs` session. This is the authoritative
contract for reducing `@beep/box`'s type-checking cost. Architecture doctrine
outranks this prose wherever they conflict.

## 1. Problem

`packages/drivers/box/src/_generated/Box.models.gen.ts` is 88,709 lines emitted
by `packages/drivers/box/scripts/generate.ts`. Measured in isolation it costs
**~4.8M type instantiations / ~1.26M types**. The whole package costs **~7.3M
instantiations** and periodically trips the nondeterministic no-location TS2589
flake during full local proofs (see the `ts2589-native-compiler-flake-class`
memory: that flake class is TS7-native and environment-attributable, but a
7.3M-instantiation package is the surface that keeps exposing it).

### Measurement method (canonical, reused for every re-measurement)

Write a temporary tsconfig extending the package tsconfig:

```jsonc
{
  "extends": "./tsconfig.json",
  "include": [],
  "files": ["src/_generated/Box.models.gen.ts"],
  "compilerOptions": { "composite": false, "incremental": false, "noEmit": true }
}
```

Then `bunx tsc -p <tmp> --extendedDiagnostics`.

> `files` does **not** clear an inherited `include`. `"include": []` is required
> or the measurement silently covers the whole package.

### Where the mass lives

| Surface in `Box.models.gen.ts` | Count | Instantiation behaviour |
| --- | ---: | --- |
| `S.Class` model declarations | 2,563 | Eager struct-field inference per declaration — the dominant cost |
| `.extend`-based subclass chains | 27 | Eager; constrains file ordering under any split |
| Type-alias schema consts (`withCodecStatics`) | ~537 | Already inference-capped by the wrapper's explicit return type |
| Payload classes | 333 | One per wrapped SDK method |
| Success schemas + type aliases | 333 + 333 | One pair per wrapped SDK method |
| `S.suspend(() => X)` cross-references | 2,957 | Lazy — does not force eager instantiation, and is split-safe |

### Measured dead ends (do not repeat)

- Removing `SchemaUtils.withCodecStatics` wrappers: moves ≤2.4%. Worse —
  removing statics **increases** instantiations by 41%, because the wrapper's
  explicit return type is what caps inference. This is load-bearing evidence
  for lever 2, not an argument against statics.
- Removing `$I.annoteSchema` annotations: moves ≤2.4%.

## 2. Demand analysis

The generator wraps **85 managers / 333 methods** — everything reachable from
`BoxClient`. Actual repo demand is far smaller:

| Consumer | Managers used |
| --- | --- |
| `packages/documents/server/src/aggregates/Sync/DmsMirrorBox.ts` | `folders`, `files`, `uploads`, `events` (+ ~6 model imports: `File`, `Folder`, `FolderMini`, `Event`, `EventSource`, `Item`) |
| `packages/drivers/box/src/Box.streaming.ts` (hand-written) | `uploads`, `chunkedUploads`, `downloads`, `zipDownloads`, `avatars`, `events`, `files` (+ 26 distinct `M.*` model roots) |
| `packages/drivers/box/test`, `dtslint` | `downloads`, `events`, `uploads`, `users` |
| `apps/professional-desktop/src/runtime/Layer.ts` | none — imports `Box`, `BoxDeveloperTokenConfig` only |

**Demand is 9 of 85 managers.** The remaining 76 are generated, type-checked,
and documented on every proof for zero callers.

## 3. Doctrine position

`standards/architecture/03-driver-boundaries.md` defines drivers as repo-level
external boundary wrappers and forbids them becoming *product-aware*. It does
**not** require vendor-complete coverage. Scoping a generated surface to
declared capabilities is capability selection, not product semantics leaking
into the driver — the manifest names Box SDK managers, never product concepts.

This supersedes the **mission framing** of `goals/box-driver`
("full-surface, generated") but contradicts **none of its 10 locked
`keyDecisions`**. In particular `generate-from-sdk-types` (generate from the
SDK's own `.d.ts`, never hand-write) survives intact — we are changing the
generator's input scope, not its method.

No `standards/architecture/DECISIONS.md` entry. This follows the precedent set
by that packet's own `pragmatic-generated-fidelity` decision, which is
explicitly recorded as "a driver-level decision [that] was not promoted to
standards/architecture/DECISIONS.md".

## 4. Decisions

### D1 — Coverage is demand-scoped, not vendor-complete

The generator consumes an explicit manager allowlist and emits only the models
transitively reachable from the kept payloads and successes. Initial set is
**strictly demand-only, 9 managers**:

```text
avatars, chunkedUploads, downloads, events, files,
folders, uploads, users, zipDownloads
```

Nothing speculative. Regrow is one manifest line plus `bun run generate`.

### D2 — Manifest is driver-local; model roots are discovered driver-locally

- The manager allowlist is an explicit, reviewed manifest **inside the driver**
  (`packages/drivers/box/scripts/box.surface.ts`).
- Additional model roots are discovered by scanning **only the driver's own
  hand-written `src/`** for `M.*` references (26 of them today, all in
  `Box.streaming.ts`). Package-local, so no product-awareness.
- The generator does **not** scan the monorepo for `@beep/box` importers.
  Auto-deriving the driver's surface from product code would make the driver
  product-aware and would make generated output change when unrelated slices
  change — a direct conflict with `03-driver-boundaries.md`.

Product needs a new manager → edit the manifest, regenerate. That edit is the
review chokepoint.

### D3 — A missing manager is a compile error

`box.retentionPolicies` simply does not exist on `BoxGeneratedOperations`. No
catch-all operation surface, no `BoxUnsupportedManager` runtime error. The
driver README documents the regrow procedure. Unsupported calls cannot ship.

### D4 — Explicit instantiation budget, staged levers

> **Amended 2026-08-01 (P2).** The per-file budget was originally written as
> "≤1.5M instantiations, absolute". Measurement showed that a file importing
> only `@beep/identity`, `@beep/schema`, and `effect/Schema` — declaring one
> trivial schema — already costs **1,649,265 instantiations**. The original
> threshold sat *below that floor*, so it was unachievable by construction and
> measured mostly a constant. The per-file budget is therefore restated in
> marginal terms. The package-wide budget is unchanged and was met.

Budget, measured by the §1 method:

- **≤ 750K marginal instantiations** for any single generated file, where
  marginal = `total(file) − total(floor probe)` under the same compiler
  version. Re-derive the floor whenever `effect` or `@beep/schema` moves; the
  probe lives in `research/measurements.md`.
- **≤ 3M instantiations** package-wide (absolute — whole-package cost is the
  number that actually bounds a proof run).

Current standing after P2: marginal **338,580** (budget 750K), package
**2,503,112** (budget 3M). Both met.

Lever order — fire the next only if the previous misses budget:

1. **Prune** (D1/D2). Then re-measure. If under budget, **stop**: levers 2 and 3
   stay designed-but-unbuilt in this document.
2. **Generator-emitted explicit type annotations** (interface-extraction
   pattern), extending the return-type-caps-inference mechanism already proven
   by `withCodecStatics` from const wrappers to `S.Class` declarations. This is
   the only remaining lever that removes work rather than redistributing it.
3. **Per-manager file split.**

#### Why split is lever 3, not lever 1

Splitting the file does **not** reduce total instantiations. The checker still
instantiates every schema in one program; a per-manager split changes
*distribution* (helping wall-clock under tsgo's parallel checker), not *mass*.
TS2589 fires on instantiation depth/budget within a check context, so a split
is a wall-clock lever with only speculative flake benefit. If lever 3 is ever
reached, validate the parallel-checker assumption with a throwaway mechanical
half-split measurement before committing to per-manager output.

The 2,957 `S.suspend` cross-references are already lazy and split-safe; only
the 27 `.extend` chains constrain file ordering.

### D5 — Budget is a documented ritual, not a CI gate

Re-measurement is required whenever the manager manifest changes — a rare,
reviewed event — and the numbers are recorded in that PR. No CI lane is added.
The manifest is a single-file chokepoint: mass can only creep in through it, so
a slow full-typecheck lane buys little over reviewing the one file that moves.
Promote to a CI gate only if mass demonstrably creeps back unnoticed.

### D6 — `@beep/ui` is out of scope

`@beep/ui` (~3.5M instantiations) is second-tier but shares almost no design
surface with Box: its mass is hand-written component/prop generics, so no
allowlist lever exists there. What transfers is the §1 measurement method and
the return-type-caps-inference lever. It gets its own packet once lever 2 is
proven here.

## 5. Non-goals

- Changing generated schema fidelity (`S.optionalKey` over `Option`, open enums,
  permissive decode) — `pragmatic-generated-fidelity` stands.
- Hand-writing any model or operation — `generate-from-sdk-types` stands.
- Removing `withCodecStatics` or `$I.annoteSchema` — both measured as dead ends,
  and statics are inference-capping.
- Fixing the TS2589 flake class itself. It is TS7-native and
  environment-attributable; this work reduces exposure, not the underlying bug.

## 5a. Outcome (P2, 2026-08-01)

Lever 1 alone met budget. Levers 2 and 3 stay designed-but-unbuilt.

| Scope | Baseline | Post-prune | Change |
| --- | ---: | ---: | ---: |
| `Box.models.gen.ts` absolute | 4,809,560 | 1,987,845 | −58.7% |
| `Box.models.gen.ts` marginal | 3,160,295 | 338,580 | −89.3% |
| package absolute | 7,472,755 | 2,503,112 | −66.5% |
| check time (file) | 6.797s | 0.816s | −88% |
| generated lines | 88,709 | 9,822 | −89% |

Surface: 9 of 85 managers wrapped, 34 JSON operations (from 333), 294 of 2,763
model schemas retained. 14 byte/event operations skipped as before and supplied
by `Box.streaming.ts`; 0 deprecated.

Verification: `@beep/box` `beep:check` (src + tests + scripts) clean, 21 unit
tests and 4 tstyche type tests pass, `@beep/documents-server` `beep:check`
clean. `apps/professional-desktop` has 168 typecheck errors both before and
after the change (byte-identical error sets) — inherited, not introduced.

One latent bug fixed in passing: `resolveBoxPaths` hardcoded
`repoRoot/node_modules/box-node-sdk`, which does not exist in a git worktree.
It now walks up for the installed SDK, so `bun run generate` works from any
checkout.

## 6. Acceptance

1. `bun run generate` emits only the 9 allowlisted managers plus the reachable
   model closure, and logs the dropped manager list (no silent caps — consistent
   with the existing `exclude-deprecated` decision's logging discipline).
2. `packages/drivers/box`, `packages/documents/server`, and
   `apps/professional-desktop` typecheck with no source edits outside the driver.
3. Re-measurement recorded against the §4 budget.
4. Driver README documents the manifest, the regrow procedure, and the
   re-measurement obligation.
5. `goals/box-driver` carries a supersede note so its "full-surface" mission
   does not read as current.
