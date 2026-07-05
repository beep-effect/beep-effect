# ops/codemods — Codemod Contract & Triage Table

This directory is the **P1.5 Mechanize deliverable dir** (see
[PLAN.md](../../PLAN.md) P1.5). The actual codemod source is authored in P1.5,
after the P1 baseline exists — this README is **not** scaffolding for code that
exists today; it ships the binding codemod contract and the triage table now so
P1 discovery agents can record `mechanization` and `confidence` against known
transform classes.

## The codemod contract

Binding on every codemod that ever lands in this directory:

1. **ts-morph on TSMorphService only.** Every codemod is built on
   `packages/tooling/library/repo-utils/src/TSMorph/TSMorph.service.ts` and
   persists edits exclusively through `updateSourceFile` (interface at `:364`,
   implementation at `:1273`) — that is the only persisting edit path. No raw
   `fs` writes, no string-splicing on file contents.
2. **Golden-diff dry-run test, first.** Every codemod MUST have a golden-diff
   dry-run test — fixture input → expected unified diff — that passes **before
   any wave runs it**. A codemod without a green golden-diff test does not run,
   period (PLAN.md P1.5 acceptance).
3. **Fences.** Codemods never touch `.repos/**`, `**/dist/**`, `**/build/**`,
   `node_modules/**`, docgen output, or any generated files (SPEC.md Target
   Surfaces). The §6 fences (SPEC.md Non-Goals 1–9) bind codemods exactly as
   they bind agents.
4. **Tier discipline (G5, locked).** Confidence is recorded per finding in the
   §5.5 inventory record and per transform class in the triage table below:
   - **≥ 0.9** → pure codemod: applied mechanically, wave agent spot-checks the
     aggregate diff.
   - **0.6–0.9** → codemod proposes, agent reviews **each diff** before it is
     kept.
   - **< 0.6** → judgment-only: no codemod runs; the wave agent does the work
     by hand.

## Triage table

Smell → codemod class → tier → candidate transform. Confidence values are the
class prior; per-finding confidence in `ops/inventory/<Sn>/<pkg>.json` wins
where they disagree.

| # | Smell | Codemod class | Tier (G5) | Candidate transform | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | `R.getSomes({...})` on heterogeneous Option-structs | import-swap + call-swap | ≥ 0.9 (pure codemod) | `O.getSomesStruct` (`packages/foundation/modeling/utils/src/Option.ts:102`, re-exported via `@beep/utils`) | 124 call sites of `R.getSomes(` measured repo-wide on 2026-07-05; the heterogeneous subset is determined in P1 discovery (homogeneous dictionaries keep `R.getSomes`). **BLOCKED until the Law 20/47 amendment merges (D5).** |
| 2 | `?? defaultValue` on schema-constructed fields | constructor-default absorption | 0.6–0.9 (propose + review) | `S.withConstructorDefault` / `SchemaUtils.withKeyDefaults` | Wire-shape sensitive: §5.3 parity proof (byte-identical encoded snapshot) required per absorption. |
| 3 | Decode/guard helper wall (`const isX = S.is(X)` / `const decodeX = ...`) | colocation | 0.6–0.9 (propose + review) | `SchemaUtils.withCodecStatics` on branded/union consts; in-body `static readonly is = S.is(Self)` on classes | Import-graph sensitive: consumers of the deleted helpers must be re-pointed in the same diff (§5.4). |
| 4 | `switch`/if-chain over `_tag` discriminators | fold rewrite | < 0.6 judgment; 0.6–0.9 only when every arm is a pure return | `Match.tagsExhaustive` / kit `.$match` | Semantics review per arm — early returns, fallthrough, and side-effecting arms disqualify mechanization. |
| 5 | `*Defaults` object spreads | default absorption | 0.6–0.9 (propose + review) | Schema defaults (decoding/constructor) + one `S.toArbitrary` round-trip law per absorbed invariant | §5.3 parity proof required; the law test ships in the same PR as the absorption. |
| 6 | `\| null`-returning helpers | Option-ification | < 0.6 (judgment-only) | `O.fromNullishOr` at the boundary + signature change to `Option` | Public-form change: §5.4 ripple sweep of all call sites in the same PR. Fence 2 still holds — SQL absence encodes `null` at the wire. |

## Definition of ready — a codemod may run in a wave when

- [ ] Its golden-diff dry-run test exists and is green.
- [ ] Its tier is recorded here and matches the `confidence`/`mechanization`
      fields of the inventory rows it will consume.
- [ ] The inventory rows it targets (`ops/inventory/<Sn>/<pkg>.json`) link to
      it by codemod class, and the false-positive audit over those rows is
      done (PLAN.md P1 step 3).
- [ ] Fences checked: its file glob excludes `.repos/**` and generated files,
      and its touch set stays inside the current wave's family packages
      (fence 8).
- [ ] Any ordering precondition is met — for class 1, the Law 20/47 amendment
      (D5) has merged.
