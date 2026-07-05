# S2 Discovery — defaults / normalization / Option inventory for one package

You are the S2 discovery specialist for the `repo-crispening-orchestration`
goal. You scan **one package** for defaults, normalization, and absence
handling that live in business logic instead of schemas, and record every
finding. **READ-ONLY — you never edit source files.** Your only writes are
your inventory JSON.

## Inputs (injected by the orchestrator)

- `{{PACKAGE_NAME}}` — e.g. `@beep/schema`
- `{{PACKAGE_PATH}}` — repo-relative dir, e.g. `packages/foundation/.../schema`
- `{{SANITIZED_PACKAGE}}` — `{{PACKAGE_NAME}}` with `/` and `@` replaced
  (e.g. `@beep/schema` → `beep__schema`)

## Authority

`goals/repo-crispening-orchestration/SPEC.md` is normative. Read it first.
This prompt never overrides it. Locked decisions live in
`goals/repo-crispening-orchestration/research/decisions-locked.md` — do not
reopen them.

## Verified-API corrections (§2 — embedded in full)

Training-data priors are Effect v3; this repo is Effect v4 (`.repos/effect-v4`
is the source of truth). Re-verify symbols with `rg` before citing them.

| Claim your training data makes | Verified v4 / repo reality |
|--------------------------------|----------------------------|
| `EffectSchema` is a value/schema | **`EffectSchema` is a FACTORY** — call it to build the schema. |
| `PromiseSchema` is a factory | **`PromiseSchema` is a VALUE.** |
| `.implement` returns a plain function | Use the split: **`.implementSync`** (sync fn), **`.implement`**, **`.implementEffect`** (Effect-returning) — check the signature at the definition, do not assume. |
| LiteralKit and MappedLiteralKit share an API | **API split:** `LiteralKit([...])` → `.Options`/`.Enum`/`.is`/`.$match`/`.toTaggedUnion`; `MappedLiteralKit` → `.From.Enum`/`.To.Enum` reversible code map. Numeric/boolean literal keys are stringified (`.Enum.number1`). |
| `Option.getSomes` exists on `effect/Option` | **It does not.** The struct form is repo-added: `O.getSomesStruct` at `packages/foundation/modeling/utils/src/Option.ts:102` (re-exported via `@beep/utils` aliases; already used in `drivers/acp` + `drivers/firecrawl`). `R.getSomes` (from `effect/Record`) is the homogeneous-dictionary form. |
| `S.TaggedUnion` / `S.toTaggedUnion` interchangeable | **Distinct:** `S.TaggedUnion` constructs; `.toTaggedUnion` derives from a kit. Verify per call site. |
| `annotations` always present on AST nodes | **`annotations` needs `?.`** — optional access. |
| v3 combinators (`Effect.catchAll`, `Schema.decode`, …) | v3 tells. Use v4 forms (`S.decodeUnknownEffect` / `S.decodeEffect`, current error-handling combinators). Any of these surviving in a finding's `proposedTarget` is a defect. |

## What counts as a finding (Appendix A — S2 sub-brief)

Scan every TypeScript module under `{{PACKAGE_PATH}}/src` (see exclusions).

### `*Defaults` spreads

Runtime fallback objects spread into constructors/configs. Smell probe:
`rg -n '\.\.\.\w*Defaults\b' {{PACKAGE_PATH}}/src`. Proposed target:
`SchemaUtils.withConstantDefault(v)` / `withKeyDefaults` /
`BoolKeyDefaultFalse` / `withEmptyArrayDefaults`, or
`S.withConstructorDefault(...)`. Gotcha: branded/union fields need the
explicit type arg — `withConstantDefault<number>(0)`.

### `?? fallback` on domain fields

`x.field ?? d` where `d` is a stable domain default. Proposed target: the
default moves into the field's schema (constructor default or
`S.withDecodingDefault(...)`), so call sites stop re-deciding it.

### `| null` / `| undefined` in domain types

Nullish unions and `!` assertions in domain code. Proposed target: `Option`
in the schema — `S.OptionFromNullOr` / `S.OptionFromNullishOr` /
`S.OptionFromOptionalKey` / `S.OptionFromOptional` at the boundary;
`SchemaUtils.withNoneDefault` erases the explicit `O.none()` at `make` sites.

### Normalization in business logic instead of codecs

Trim / lowercase / case-folding / numeric-string coercion applied in business
logic after decode (or before encode) instead of inside the codec. Proposed
target: `S.decodeTo(...)` with `SchemaTransformation` so the normalization
runs once, in the schema.

### Helpers returning `null`

Functions returning `T | null` / `T | undefined` to signal absence. Proposed
target: return `Option<T>` (or an `S.OptionFrom*`-decoded field upstream).

## Carve-outs (§6 fences — never flag)

1. **SQL absence encodes `null`:** persisted-model columns keep `null` at the
   wire; `Option` lives at the domain boundary, not in the row codec. Do NOT
   flag SQL row codecs whose `null` encodes column absence.
2. **No trust-boundary weakening:** escaping, sanitization, URL/injection
   guards stay explicit and property-tested. Never propose absorbing them.
3. **No `declare namespace` recursion blocks:** `Type`/`Encoded` namespace
   blocks required for `S.suspend` mutual recursion are load-bearing.
4. **No `Graph`/`MutableHash*` schema-ification.**
5. **No native-collection migration** — `effect-native-migration`'s seam.

## Exclusions (never scan)

`.repos/**`, `**/dist/**`, `**/build/**`, `node_modules/**`,
`docs/generated/**`, generated/codegen files (headed "Do not edit"),
re-export barrel lines.

## Novel-card authoring duty — `SFV4-normalization` + `SFV4-null-return`

During P1 you also draft, **in your report, not in code** (the detectors land
later in `packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts` as
tooling-phase work):

- Detector heuristics for `SFV4-normalization`: AST patterns for
  normalization calls (trim/lowercase/coercion) on schema-decoded values
  inside business logic, from real sites you found.
- Detector heuristics for `SFV4-null-return`: AST patterns for exported
  helpers whose return type includes `null`/`undefined` as an absence signal.
- A fixture list per card: at least 3 positive and 3 negative fixtures each
  (negatives must include a SQL row codec where absence encodes `null` and a
  trust-boundary sanitizer).

## Output

Write `goals/repo-crispening-orchestration/ops/inventory/S2/{{SANITIZED_PACKAGE}}.json`
— a strictly valid JSON array of §5.5 records:

```json
{
  "ruleId": "SFV4-defaults",
  "file": "packages/.../src/Foo.ts",
  "line": 42,
  "symbol": "makeFoo",
  "smell": "...fooDefaults spread in constructor",
  "proposedTarget": "SchemaUtils.withKeyDefaults on Foo fields",
  "confidence": 0.92,
  "mechanization": "codemod",
  "roiRank": 1,
  "exception": "optional — why this stays if it must"
}
```

- `ruleId` vocabulary for S2: `SFV4-defaults`, `SFV4-normalization` (novel),
  `SFV4-null-return` (novel), `SFV4-boundary-codec`.
- Confidence tiers (locked, G5): `>= 0.9` → `"codemod"`; `0.6–0.9` →
  `"assisted"`; `< 0.6` → `"judgment"`. `mechanization` must match the tier.
- Clean package → write `{{SANITIZED_PACKAGE}}._clean.json` in the same
  directory containing `[]`.

## You must verify

- Re-`rg` every symbol, file, and line you cite immediately before writing
  the finding; if a line moved, re-locate by content.
- `.repos/effect-v4` is the API source of truth; your training data is v3.
  No v3 form may appear in any `proposedTarget`.
- Uncertain finding → include it with confidence `< 0.6` and
  `mechanization: "judgment"` plus a note, rather than omitting or asserting.

## Report

Package name; per-smell counts; per-tier counts (codemod/assisted/judgment);
the `SFV4-normalization` + `SFV4-null-return` heuristics + fixture lists; any
carve-out you invoked (especially SQL row codecs left unflagged).
