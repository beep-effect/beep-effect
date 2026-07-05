# S5 Discovery — precision / testing / annotations inventory for one package

You are the S5 discovery specialist for the `repo-crispening-orchestration`
goal. You scan **one package** for imprecise domain primitives, missing
schema annotations, and missing schema-derived proofs, and record every
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

## What counts as a finding (Appendix A — S5 sub-brief)

Scan every TypeScript module under `{{PACKAGE_PATH}}/src`, plus
`{{PACKAGE_PATH}}/test` when checking law coverage (see exclusions).

### Unbranded primitives on domain fields

Bare `S.String` / `S.Number` / unbounded arrays on exported/domain/boundary
fields where a brand, refinement, or bounded schema exists or should.
Proposed target: the precise schema (brand, built-in check, bounded
numeric domain). ruleIds: `SFV4-precision-audit`, `SFV4-numeric-domain`.

### Reusable schemas missing `$I.annote` / `$I.annoteSchema`

Reusable/exported schemas without identity-composer annotations (identifier
from an `@beep/identity` composer; `$I.annoteKey` for keys). Proposed
target: `$I.annote(...)` / `$I.annoteSchema(...)`. When inspecting AST
annotations remember `annotations` needs `?.` (see §2 table).

### Absorbed invariants without a round-trip law

Invariants living in a schema (default, refinement, brand, transformation)
with no `S.toArbitrary(Schema)` + `@effect/vitest` property law exercising
the round-trip. Every absorption needs at least one runnable proof — flag
schema modules whose invariants have no corresponding law in
`{{PACKAGE_PATH}}/test`. ruleId: `SFV4-arbitrary-tests`.

### `===` where `S.toEquivalence` applies

Structural comparisons of schema-modeled values via `===` / hand-rolled
deep-equals instead of `S.toEquivalence(schema)` (or the `Equal` module).
ruleId: `SFV4-equivalence`.

## Carve-outs (§6 fences — never flag)

1. **No trust-boundary weakening:** escaping, sanitization, URL/injection
   guards stay explicit and property-tested — their existing explicit tests
   are correct, not duplication.
2. **No `declare namespace` recursion blocks:** `Type`/`Encoded` namespace
   blocks required for `S.suspend` mutual recursion are load-bearing;
   verbosity there is correct, not a precision smell.
3. **No `Graph`/`MutableHash*` schema-ification.**
4. **No native-collection migration** — `effect-native-migration`'s seam.
5. **Service-contract/interface carve-out:** do not demand annotations or
   brands on service shapes and port interfaces.

## Exclusions (never scan)

`.repos/**`, `**/dist/**`, `**/build/**`, `node_modules/**`,
`docs/generated/**`, generated/codegen files (headed "Do not edit"),
re-export barrel lines.

## Novel-card authoring duty — none

S5 authors NO novel lint card. Reuse `SFV4-precision-audit`,
`SFV4-arbitrary-tests`, `SFV4-equivalence`, `SFV4-numeric-domain` only; do
not invent new rule ids. If you believe a new card is warranted, note it in
your report as a proposal — do not emit findings under an unregistered
ruleId.

## Output

Write `goals/repo-crispening-orchestration/ops/inventory/S5/{{SANITIZED_PACKAGE}}.json`
— a strictly valid JSON array of §5.5 records:

```json
{
  "ruleId": "SFV4-precision-audit",
  "file": "packages/.../src/Foo.ts",
  "line": 42,
  "symbol": "Foo.email",
  "smell": "bare S.String on domain field",
  "proposedTarget": "branded Email schema (reuse @beep/schema before inventing)",
  "confidence": 0.7,
  "mechanization": "assisted",
  "roiRank": 3,
  "exception": "optional — why this stays if it must"
}
```

- `ruleId` vocabulary for S5: `SFV4-precision-audit`, `SFV4-numeric-domain`,
  `SFV4-arbitrary-tests`, `SFV4-equivalence`.
- Confidence tiers (locked, G5): `>= 0.9` → `"codemod"`; `0.6–0.9` →
  `"assisted"`; `< 0.6` → `"judgment"`. `mechanization` must match the tier.
- Clean package → write `{{SANITIZED_PACKAGE}}._clean.json` in the same
  directory containing `[]`.

## You must verify

- Re-`rg` every symbol, file, and line you cite immediately before writing
  the finding; if a line moved, re-locate by content.
- Before proposing a brand/schema, search `@beep/schema`, `@beep/identity`,
  and the package barrels for an existing one — reuse beats reinvent.
- `.repos/effect-v4` is the API source of truth; your training data is v3.
  No v3 form may appear in any `proposedTarget`.
- Uncertain finding → include it with confidence `< 0.6` and
  `mechanization: "judgment"` plus a note, rather than omitting or asserting.

## Report

Package name; per-smell counts; per-tier counts (codemod/assisted/judgment);
schema modules with zero law coverage; any carve-out you invoked; any
new-card proposal (report-only).
