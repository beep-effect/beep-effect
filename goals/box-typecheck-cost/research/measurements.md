# Instantiation Measurements

Every row is produced by the canonical method in `SPEC.md` §1. Record the TS /
tsgo version with each run — thresholds are version-sensitive.

## Method (copy for each run)

```jsonc
// packages/drivers/box/tsconfig.measure.json  (temporary, do not commit)
{
  "extends": "./tsconfig.json",
  "include": [],
  "files": ["src/_generated/Box.models.gen.ts"],
  "compilerOptions": { "composite": false, "incremental": false, "noEmit": true }
}
```

```bash
bunx tsc -p packages/drivers/box/tsconfig.measure.json --extendedDiagnostics
```

> `files` does **not** clear an inherited `include`. Without `"include": []` the
> measurement silently covers the whole package and the file-level number is
> wrong. For the package-level number, drop `files` and use
> `"include": ["src"]`.

## Runs

| Date | Phase | Scope | Instantiations | Types | Check time | TS / tsgo | Notes |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| 2026-08-01 | P1 | `Box.models.gen.ts` | 4,809,560 | 1,259,027 | 6.797s | 7.0.2+effect-tsgo.0.24.3 | Baseline. 891 files, 2,489,299 symbols, 1.54 GB peak, 88,709 lines. |
| 2026-08-01 | P1 | package (`src`) | 7,472,755 | 1,845,559 | 6.580s | 7.0.2+effect-tsgo.0.24.3 | Baseline. 1,541 files, 3,684,246 symbols, 2.28 GB peak. |
| 2026-08-01 | P2 | **import floor** | **1,649,265** | 452,451 | 0.509s | 7.0.2+effect-tsgo.0.24.3 | Probe file importing only `@beep/identity`, `@beep/schema`, `effect/Schema` and declaring one trivial `LiteralKit` schema. See "The floor" below. |
| 2026-08-01 | P2 | `Box.models.gen.ts` | 1,987,845 | 533,027 | 0.816s | 7.0.2+effect-tsgo.0.24.3 | Post-prune. 9,822 lines. **Marginal over floor: 338,580.** |
| 2026-08-01 | P2 | package (`src`) | 2,503,112 | 647,830 | 0.989s | 7.0.2+effect-tsgo.0.24.3 | Post-prune. 1,412,259 symbols, 0.86 GB peak. |

### Result

| Scope | Baseline | Post-prune | Change |
| --- | ---: | ---: | ---: |
| `Box.models.gen.ts` absolute | 4,809,560 | 1,987,845 | **−58.7%** |
| `Box.models.gen.ts` marginal (minus floor) | 3,160,295 | 338,580 | **−89.3%** |
| package absolute | 7,472,755 | 2,503,112 | **−66.5%** |
| `Box.models.gen.ts` check time | 6.797s | 0.816s | **−88%** |
| `Box.models.gen.ts` lines | 88,709 | 9,822 | **−89%** |
| peak memory (package) | 2.28 GB | 0.86 GB | **−62%** |

## The floor

A file that imports `@beep/identity`, `@beep/schema`, and `effect/Schema` and
declares a single trivial schema already costs **1,649,265 instantiations**.
That is the fixed cost of the schema substrate, not of Box.

This invalidates the original ≤1.5M **absolute** per-file budget from
`SPEC.md` §D4 as first written: no file in this repo that imports
`effect/Schema` can ever be under it. The budget was specified against a
number whose dominant term is a constant.

Post-prune, `Box.models.gen.ts` is **83% floor** (1,649,265 of 1,987,845).
Box's own contribution is 338,580 instantiations — down from 3,160,295.

Consequence: the per-file budget is restated in **marginal** terms (see the
amended `SPEC.md` §D4). Measure marginal cost as
`total(Box.models.gen.ts) − total(floor probe)` in the same compiler version,
re-deriving the floor whenever `effect` or `@beep/schema` moves.

### Floor probe (recreate when re-measuring)

```ts
// packages/drivers/box/src/_generated/Box.floor.probe.ts (temporary)
import { $BoxId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $BoxId.create("_generated/Box.floor.probe");

export const Probe = LiteralKit(["a"]).pipe((schema) =>
  schema.pipe($I.annoteSchema("Probe", { description: "floor probe" }), SchemaUtils.withLiteralKitStatics(schema))
);
```

Budget (`SPEC.md` §D4, as amended): **≤750K marginal** for any single generated
file (total minus the import floor), **≤3M absolute** package-wide.

## Prior measured dead ends

| Attempt | Result |
| --- | --- |
| Remove `SchemaUtils.withCodecStatics` wrappers | ≤2.4% movement. Removing statics **increases** instantiations 41% — the explicit wrapper return type caps inference. |
| Remove `$I.annoteSchema` annotations | ≤2.4% movement. |

Do not re-run these as exploration; they are settled. The 41% result is the
evidence base for lever 2 (`SPEC.md` §D4).
