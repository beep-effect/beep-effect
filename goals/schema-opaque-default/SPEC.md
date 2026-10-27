# Schema shape default: branded S.Opaque for data Spec

## Objective

Make branded S.Opaque the default shape for plain data schemas, brand every schema class, and arm schemaClassMissingBrand

## Non-Goals

- Moving plain-`S.Class` persisted rows onto the `@beep/effect-drizzle` model kit (tracked follow-up; D5).
- Reshaping `scratchpad/effected` classes beyond adding the brand (D6).
- Bumping `@effect/tsgo` past 0.51.1: the pin waits for tsc-rs to port the 0.52 rule set (#1636).
- Converting error classes, entities, behaviour classes or `.extend` chains to `S.Opaque` (D2).

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- Every `S.Class`, `S.TaggedClass`, `S.Error`, `S.TaggedError` and `S.Opaque` declaration under `apps/`, `packages/`, `infra/`, `scratchpad/` and `goals/`/`explorations/` scripts.
- A committed, re-runnable AST codemod (`packages/tooling/tool/cli` command or script) and its tests.
- Schema guidance: `standards/effect-first-development.md`, `.claude/skills/schema-first-development/**`, `.claude/skills/effect-first-development/**`, `.patterns/effect-library-development.md`, `standards/architecture/DECISIONS.md`.
- The `lint schema-first` detector set and the tooling `$I.annote` lint regex in `Lint.command.ts`.

## Constraints

- Behaviour-preserving: runtime values change from class instances to plain objects only where D1 applies; `_tag`, field names, encodings and `X.make` call sites stay identical.
- Conflicts with concurrent lanes are resolved by re-running the codemod on `origin/main`, never by hand-merging its output (D7).
- No `@effect-diagnostics` disables, no new casts, no `{}` brand opt-outs without a schema-first exception (D4).

## Acceptance Criteria

- [x] Plain data schemas (empty or statics-only body, no `.extend` relation, no instance members) are `S.Opaque<X, { readonly brand: unique symbol }>()(S.Struct | S.TaggedStruct)`.
- [x] Every remaining `S.Class`/`S.TaggedClass`/`S.Error`/`S.TaggedError`/`S.Opaque` declaration carries `{ readonly brand: unique symbol }` (168 documented structural `{}` exceptions, D9); `schemaClassMissingBrand` is `"error"` in the Effect diagnostics lane.
- [x] With `@effect/tsgo` 0.52.0 installed and `schemaClassMissingBrand: "error"`, repo-wide `bun run check` reports zero diagnostics (the pin itself stays 0.51.1).
- [x] Guidance documents the new default; a `DECISIONS.md` entry records it; `lint schema-first` flags a new empty/statics-only `S.Class` that is not an error, entity or `.extend` root.
- [x] The `$I.annote` tooling lint recognises brand type arguments.
- [x] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/schema-opaque-default/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/schema-opaque-default/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/schema-opaque-default` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each in the Decision Log.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-14 | D1: Plain data schemas default to `class X extends S.Opaque<X, { readonly brand: unique symbol }>()(S.Struct({...}).pipe($I.annoteSchema(...))) { static ... }`. | Operator grill: S.Class validates `instanceof`, so structurally valid plain objects fail `S.is`/encode/HttpApiClient payloads and `structuredClone` strips the class; census shows 93% of 6,736 non-error classes have empty bodies, 0 `instanceof`, ~3 `new`. Opaque keeps the opaque type and statics (the original reasons for S.Class) with shape validation. Rejected: S.Class + brand everywhere (keeps instance-check pitfalls), plain S.Struct + alias (loses opaque type and statics). | Re-run the codemod in reverse mode (Opaque → S.Class) or revert the PR. |
| 2026-10-14 | D2: Stay `S.Class` (branded): errors, persisted entities (on `@beep/effect-drizzle`), classes with instance members, `.extend` chain roots and subclasses. | Errors must be yieldable classes; ARCHITECTURE.md §5 / DECISIONS.md:626 make entities schema classes; `schemaOpaqueInstanceMember` forbids instance members; Opaque has no `.extend`. | Widen D1's predicate and re-run the codemod. |
| 2026-10-14 | D3: `S.TaggedClass` data becomes `S.Opaque<X, Brand>()(S.TaggedStruct("X", {...}))`, keeping `_tag`. | Same rule as D1; `_tag` keeps Match/catchTag dispatch. Rejected: keep TaggedClass + brand. | Reverse codemod for TaggedStruct sources. |
| 2026-10-14 | D4: Every Class/Opaque declaration carries `{ readonly brand: unique symbol }`; a structural `{}` needs a documented schema-first exception. | Nominal typing everywhere; `schemaClassMissingBrand` flips straight to error at the 0.52 bump with nothing to triage. Rejected: `{}` freely allowed. | Allow `{}` in the lint and drop the exception requirement. |
| 2026-10-14 | D5: Persisted entities are branded only; moving plain-`S.Class` persisted rows onto the effect-drizzle kit is a tracked follow-up. | Moving a row onto the kit changes its table and column wiring, so it doesn't belong in a mechanical codemod. | N/A (scope). |
| 2026-10-14 | D6: `scratchpad/effected` (the verbatim upstream port) gets brands only; class shapes stay. | Keeps the port close to upstream (10-08 breadth-first ruling) while the brand rule passes. Rejected: full conversion, exclusion. | Run the full codemod over `scratchpad/effected`. |
| 2026-10-14 | D7: One packet plus one PR landing a committed, re-runnable AST codemod and its output; conflicts resolved by re-running on `origin/main`. Proof: repo-wide check with 0.52 installed and the brand rule at error, as #1636 did. | The operator wants it landed tonight (S23). A deterministic codemod makes conflicts cheap with 12+ live lanes. Rejected: per-family PRs, or no packet. | Revert the PR. |
| 2026-10-14 | D8: Enforce with docs, a `DECISIONS.md` entry and a new `lint schema-first` kind for a plain-data `S.Class`, and fix the `$I.annote` regex for brand arguments. | Keeps the default from drifting back. Rejected: docs only, or lint as a follow-up. | Remove the lint kind. |
| 2026-10-14 | D8 implementation: `lint schema-first` gains two kinds. `unbranded-schema-class` flags every `S.Class`/`S.TaggedClass`/`S.Error`/`S.TaggedError`/`S.Opaque` declaration with no brand argument or a `{}` brand (generated files included, since the generators now emit brands). `plain-data-schema-class` flags an `S.Class`/`S.TaggedClass` with no instance members and no class-level `to*` Declaration hooks whose name no project file (tests included) uses as an `.extend` root, base class, `instanceof`/`new` target or `S.instanceOf` argument; it skips header-generated files and `scratchpad/effected/**`. `object-struct-schema` stays, reworded to "branded S.Opaque over that S.Struct", and a struct used as an `S.Opaque` source no longer counts. The tooling `$I.annote` check parses heritage instead of matching `<[^>]+>`, and also requires `$I.annoteSchema` on inline `S.Opaque` sources. | The name index matches the codemod's keep-class rule within the lint's scope; cross-file keep reasons it cannot see (keep-class allowlist, non-literal `_tag`, fields expressions the codemod could not classify) are inventory exceptions with reasons (156 new on the 2026-10-14 tree: 108 structural brands mirrored from `keep-class.jsonc`, 48 plain-data classes), not heuristics; 19 advisory rows were re-keyed to the codemod's line shifts and one `exported-interface` row (`OfficeActionReviewDeps`) was recorded. Declaration hooks are a structural reason to stay a class, so they are checked in-file. Rejected: an `exception` kind for the structural brands only, which would leave D8 without a plain-data rule. | Remove the two kinds from `SchemaFirstEntryKind`, `SchemaFirstSchemaClass.ts` and their inventory rows, and restore the `<[^>]+>` regex. |
| 2026-10-14 | D9: 168 declarations keep a structural `{}` brand as documented schema-first exceptions: the recursive Markdown/Pandoc/Lexical/TOML ASTs, law-practice `Citation`/`PinciteInfo`, xstate `DocumentIntake` models, `PortableTsconfig`/`ResolvedTsconfig`, chalk builder state and nlp `SpanFields`. Five schemas whose fields already own a `brand` key use `{ readonly nominal: unique symbol }`. | Measured in the codemod run: recursive children decoded through `S.suspend` carry the hand-written unbranded namespace `Type`, so a nominal brand fails every consumer (38 sites in `Lexical.codec.ts` alone), and pointing the unions at the branded classes makes the base types circular (TS2506/TS7022/TS2310). Reasons live in `ops/codemod/keep-class.jsonc` and `standards/schema-first.inventory.jsonc`. | Thread per-class unique symbols through the hand-written `Type`/`Encoded` namespaces, then drop the exceptions. |
| 2026-10-14 | D10: D6 (brand-only) also covers the upstream tests copied beside the port, `scratchpad/test/<module>/**` and `scratchpad/test/<module>.test.ts`, for every `<module>` with a `scratchpad/effected/<module>/` source. | The test sweep found the port's own tests converted while their sources stayed classes; the port must stay byte-close to upstream as a unit. | Narrow the codemod matcher. |
| 2026-10-14 | D11: Generated schemas are branded by their generators (box, runpod, html, ai-sync, codegen-kit), and generated output is regenerated rather than hand-edited. The plain-data lint kind skips generated files. | D4 covers generated code too; editing output by hand is undone by the next generation. | Revert the generator changes. |
| 2026-10-14 | D12: The codemod keeps a schema as a branded `S.Class` when its static members call `super.*` (keep reason `static-super`), adding to D2's list. | `S.Opaque` replaces a static `make` override that calls `super.make` with the base method after the first call (`OipPulumiStateBackendConfig`). | Rewrite the override as decode-time defaults and convert. |
| 2026-10-15 | D13: Arm `schemaClassMissingBrand` at `"error"` in the standards/effect-diagnostics.profile.json profile (retired by goals/tsrs-gates) (and its closed schema in `EffectDiagnostics.ts`), not in `tsconfig.base.json`; drop it from `tsgoDisabledRules`. | #1810 runs the Effect rules from `@effect/tsgo` 0.53 as a separate lane while tsc-rs 0.6.0 gates only the 0.51.1 rules and exits 2 on unknown names; the post-#1758 spike and this PR's full run find 0 sites. | Set the key and the schema literal back to `"off"` and restore the `tsgoDisabledRules` entry. |
| 2026-10-15 | D14: Add `lint:opaque-roundtrips` (`beep lint opaque-roundtrips`, Lint Policy medium tier): a type-checked scan that fails a `toStrictEqual` between a raw `Arbitrary` sample and a freshly built value whose type contains an `S.Opaque` class. | `effect/Arbitrary` builds some struct samples with a null prototype, so such asserts fail by seed (main-red episode 14); 0 sites on main, 4 on the pre-fix positive control. | Remove the subcommand, the root script and turbo task, and its Lint Policy entries. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| `scratchpad/effected` shapes stay `S.Class` | `scratchpad/effected/**` | session local_aeabc5d2 | D6: verbatim upstream port | Port graduates out of scratchpad or upstream adopts Opaque |
