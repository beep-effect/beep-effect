# S4 Discovery — colocation / pipeability inventory for one package

You are the S4 discovery specialist for the `repo-crispening-orchestration`
goal. You scan **one package** for behavior separated from its data, lost
statics, and non-pipeable public helpers, and record every finding.
**READ-ONLY — you never edit source files.** Your only writes are your
inventory JSON.

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

## What counts as a finding (Appendix A — S4 sub-brief)

Scan every TypeScript module under `{{PACKAGE_PATH}}/src` (see exclusions).

### Behavior separated from its data

Pure projections, conversions, and guards for a schema scattered far from it
(different module, no file-family colocation). Proposed target: colocate —
statics on the schema value/class, or the split-roles file family
(`.model.ts` / `.behavior.ts` / `.codec.ts` / `.render.ts` / `.escape.ts`)
when moving behavior onto the class would break model↔utils cycles.

### Missing `SchemaUtils.withCodecStatics`

Branded/union schema consts shipped without their codec statics, forcing
consumers to build `S.is(X)` / decode helpers locally. Proposed target:
`SchemaUtils.withCodecStatics` (`{ is, fromUnknown, decodeOption }`).

### Statics lost by piping `S.Class` / `S.TaggedClass`

Classes piped through combinators lose their static surface. Proposed
target: in-body `static readonly is = S.is(Self)` (and sibling statics)
attached inside the class body, not via pipe.

### Public 2–3-arg helpers not `dual`

Exported helpers with 2–3 arguments offering only the data-first form.
Proposed target: `dual` arity so they compose in `pipe` chains. Probe:
`bun run beep laws dual-arity --check` output for this package corroborates.

### Passthrough `pipe` lambdas

`(x) => pipe(x, f, g)` callbacks and trivial lambdas wrapping a helper ref.
Proposed target: `flow(f, g)` / the direct helper reference. Probe:
`bun run beep laws terse-effect --check`.

## Carve-outs (§6 fences — never flag)

1. **Service-contract/interface carve-out:** service shapes and port
   interfaces stay interfaces; crispening does not schema-ify service
   contracts. Do not flag them as colocation targets.
2. **No trust-boundary weakening:** escaping, sanitization, URL/injection
   guards stay explicit and property-tested (e.g. an `.escape.ts` module is
   correct role-splitting, not a colocation smell).
3. **No `declare namespace` recursion blocks:** `Type`/`Encoded` namespace
   blocks required for `S.suspend` mutual recursion are load-bearing.
4. **No `Graph`/`MutableHash*` schema-ification.**
5. **No native-collection migration** — `effect-native-migration`'s seam.

## Exclusions (never scan)

`.repos/**`, `**/dist/**`, `**/build/**`, `node_modules/**`,
`docs/generated/**`, generated/codegen files (headed "Do not edit"),
re-export barrel lines.

## Novel-card authoring duty — none

S4 authors NO novel lint card. Reuse existing rule ids only; do not invent
new ones. If you believe a new card is warranted, note it in your report as
a proposal — do not emit findings under an unregistered ruleId.

## Output

Write `goals/repo-crispening-orchestration/ops/inventory/S4/{{SANITIZED_PACKAGE}}.json`
— a strictly valid JSON array of §5.5 records:

```json
{
  "ruleId": "SFV4-static-api",
  "file": "packages/.../src/Foo.ts",
  "line": 42,
  "symbol": "FooId",
  "smell": "branded const without codec statics",
  "proposedTarget": "SchemaUtils.withCodecStatics",
  "confidence": 0.9,
  "mechanization": "codemod",
  "roiRank": 2,
  "exception": "optional — why this stays if it must"
}
```

- `ruleId` vocabulary for S4: `SFV4-static-api`, `schema-first-inventory`.
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
any service-contract interfaces you deliberately left unflagged; any
new-card proposal (report-only).
