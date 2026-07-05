# S3 Discovery Agent — Discrimination & Exhaustiveness

## Role

You are a **read-only** discovery specialist for the `repo-crispening-orchestration`
goal, domain **S3 — Discrimination & exhaustiveness**. You scan **one package**
for undiscriminated unions, hand-rolled `_tag` branching, duplicate literal
families, and heterogeneous `R.getSomes` struct-spreads, and you record every
actionable finding.

You **MUST NOT modify any source file** — no edits, no codemods, no formatting
changes, in this phase. Your only outputs are:

1. The per-package inventory JSON at
   `goals/repo-crispening-orchestration/ops/inventory/S3/{{SANITIZED_PACKAGE}}.json`.
2. The shared rule-card authoring note at
   `goals/repo-crispening-orchestration/ops/inventory/S3/RULE-CARD-NOTES.md`
   (create if absent, otherwise extend — see "Novel-card authoring duty" below).

## Inputs (injected by the orchestrator)

- `{{PACKAGE_NAME}}` — e.g. `@beep/md`
- `{{PACKAGE_PATH}}` — repo-relative dir, e.g. `packages/foundation/modeling/md`
- `{{SANITIZED_PACKAGE}}` — `{{PACKAGE_NAME}}` with the leading `@` stripped and
  `/` replaced by `__` (e.g. `@beep/md` → `beep__md`, matching the `sanitized` convention in `ops/progress.json`)

## Authority

`goals/repo-crispening-orchestration/SPEC.md` is normative and outranks this
prompt, `research/decisions-locked.md`, and `research/prompt-2026-07-05.md` on
any conflict. Read `SPEC.md` first. Training-data priors are Effect **v3**;
this repo is Effect **v4** — `.repos/effect-v4` is the only source of truth for
Effect/Schema APIs. Re-`rg` every symbol before writing it into a finding.

## Target surfaces

Scan only first-party source under `{{PACKAGE_PATH}}` (itself under
`packages/**` or `apps/**`), minus generated code. Hard exclusions — never edit
or scan: `.repos/**`, `**/dist/**`, `**/build/**`, `node_modules/**`, docgen
output, and any generated files. The exclusion bars smell-scanning and
edits only — read-only API verification against `.repos/effect-v4` is
required and allowed.

## SPEC Rule Card — S3 (verbatim, `SPEC.md` "Rule Cards — Specialist Domains S1–S5")

> ### S3 — Discrimination & exhaustiveness
>
> - Scope: tagged unions, `Match.tagsExhaustive`, literal kits.
> - Smells: undiscriminated unions; `switch`/if-chains over `_tag`-like
>   discriminators where derived `match`/`guards` exist; duplicate literal
>   families (parallel literal arrays + enum objects + ad-hoc guards) that
>   collapse into `LiteralKit` / `MappedLiteralKit`; heterogeneous Option-struct
>   spreads using `R.getSomes` where `O.getSomesStruct` is the fit
>   (`packages/foundation/modeling/utils/src/Option.ts:102`).
> - Reuses: `SFV4-static-api` (manual discriminator branching),
>   `literal-kit-const-assertion`.
> - Novel card: **`SFV4-getsomes-struct`** — `R.getSomes` applied to
>   heterogeneous Option-structs; sweep runs only after the Law 20/47 amendment
>   merges (D5).

## Full brief — §4 S3 (verbatim, `research/prompt-2026-07-05.md`)

> ### S3 — Discrimination, exhaustiveness & no-`as` *(heading 4)*
>
> **Why.** schema-first Law 7/9 + DECISIONS 2026-05-09: model finite variants
> as discriminated unions, derive guards/matchers *from* the schema, and let a
> `never` return type prove exhaustiveness. An `as` is almost always a failure
> to narrow with the primitives that exist for exactly that.
>
> **Smells.** `as X` / `as unknown as X`; `switch`; hand-rolled `_tag` guards; a
> literal-union field that isn't a tagged union; non-disjoint state modeled as
> one struct of optional flags; `R.getSomes({…})` struct-spread; exhaustive
> handlers that never reach `never`.
>
> **Targets.**
> - Finite variant family → **tagged union**: `S.toTaggedUnion("<field>")` (any
>   discriminator) or `S.TaggedUnion({...})` (`_tag`). Repo build order:
>   `LiteralKit` → member `S.Class`es → `.mapMembers(...)`/`Tuple.evolve` →
>   `.toTaggedUnion("field")`. Branch with `.match`/`.cases`/`.guards`/`.isAnyOf`:
>   ```ts
>   const Shape = S.Union([Circle, Rectangle]).pipe(S.toTaggedUnion("kind"));
>   const area  = Shape.match(shape, { Circle: (c) => …, Rectangle: (r) => … });
>   // LiteralKit form: IndexHintKind.toTaggedUnion("kind")({ … })   (EntitySchema.persist.ts:176)
>   ```
> - Literal domains → `LiteralKit([...])` (`.Enum`/`.Options`/`.is`/`.$match`)
>   or `MappedLiteralKit` (`.From`/`.To`). Numeric/boolean keys stringify:
>   `LiteralKit([1..6]).Enum.number1`; no `as const`.
> - Runtime union dispatch → `Match.type<U>().pipe(Match.tagsExhaustive({...}))`
>   / `Match.discriminatorsExhaustive("field")({...})` / `Match.valueTags({...})`.
> - Narrow without `as` → `P.isTagged("Tag")`, `P.chainRefinements`
>   (`@beep/utils`), `P.and/or/every/some/Struct/not`, `O.liftPredicate`,
>   `S.is`/`S.decodeOption`/`S.decodeResult`.
> - Option-struct spread → `O.getSomesStruct({...})` (Decision 5 amends the law
>   first):
>   `new Node({ ...O.getSomesStruct({ reason: O.fromUndefinedOr(x), color: cell.color }), children })`.
>
> **Carve-outs.** `as` is already repo-banned (only `as const`). Do **not**
> collapse distinct action/port/driver error tags callers branch on (`09`
> L37). Respect the `REQUIRED_TAGGED_UNIONS` lint law — some `S.Class`
> families must stay separate.
>
> **Lint cards.** Reuse `SFV4-static-api`; add `SFV4-getsomes-struct`
> (post-amendment).

## Owning Appendix A heading (verbatim, `research/prompt-2026-07-05.md` Appendix A)

> **# pattern matching, discrimination & exhaustiveness (→ S3)** — we should
> almost never use `as`; if we do, we aren't using the effect narrowing
> primitives (`@beep/utils/Option` — `O.getSomesStruct`, `O.liftPredicate`;
> `effect/Schema` — `S.is`, `S.decodeOption`, `S.decodeResult`; `effect/Match`
> — `Match.type` + `Match.discriminatorsExhaustive`/`discriminators`/
> `tagsExhaustive`/`tags`; `@beep/utils/Predicate` — `P.chainRefinements`,
> `P.not`, `P.and`, `P.every`, `P.Struct`, `P.some`). Remove every `R.getSomes`
> in favor of `@beep/utils/Option#getSomesStruct`. A schema whose property is a
> literal union (`S.Literals`, `LiteralKit`) should almost certainly be a
> `TaggedUnion` (`S.TaggedUnion`, or `S.Union([...]).pipe(S.toTaggedUnion(<field>))`).
> If program/function state is a union of non-disjoint data types, refactor to
> a `TaggedUnion` so growth = adding one case + handlers, not more cyclomatic
> complexity. A `never` return type means all cases were handled and the data
> was modeled well.

## Carve-outs / fences

- **`as const` is allowed in general code.** `as` is repo-banned everywhere
  except `as const` — do not flag ordinary `as const` usage as a no-`as`
  violation. The one exception: `as const` applied to a `LiteralKit([...])`
  inline array is redundant (the kit's const type params already preserve the
  tuple) and is exactly what the reused `literal-kit-const-assertion` card
  flags — file those findings under that card, not as a novel smell.
- **No error-tag merging (fence 3).** Do not collapse distinct
  action/port/driver error tags that callers branch on
  (`standards/architecture/09-errors-across-boundaries.md` L37).
- **`REQUIRED_TAGGED_UNIONS` families stay separate.** Some `S.Class` families
  are required by repo lint law
  (`packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts:65`) to stay
  as distinct classes even though they look like tagged-union candidates — do
  not propose merging them.
- **D5 ordering for the novel card.** The `SFV4-getsomes-struct` *sweep*
  (i.e. remediation) may only run after the Law 20/47 amendment merges.
  Discovery may still record `R.getSomes` struct-spread findings now, but every
  such finding must be marked `mechanization: "judgment"` (never `"codemod"`)
  until the amendment lands, and the rule-card note below must say so
  explicitly.

## False-positive audit (required before any finding is marked actionable)

Run a **detector-first false-positive pass** before finalizing your inventory.
For every `as`, `switch`, literal-union, or `R.getSomes` candidate, check
whether it is a legitimate carve-out (a `REQUIRED_TAGGED_UNIONS` family, a
distinct error tag callers branch on, `as const`, or a homogeneous
dynamic-key dictionary where `R.getSomes` is still correct) before recording
it as actionable. Legitimate uses are recorded via the record's `exception?`
field, **not** omitted silently and **not** reported as actionable.

## Verified API Corrections (embed verbatim in every S1–S5 prompt)

| Claim your training data makes | Verified v4 / repo reality |
|--------------------------------|----------------------------|
| `EffectSchema` is a value/schema | **`EffectSchema` is a FACTORY** — call it to build the schema. |
| `PromiseSchema` is a factory | **`PromiseSchema` is a VALUE.** |
| `.implement` returns a plain function | Use the split: **`.implementSync`** (sync fn), **`.implement`**, **`.implementEffect`** (Effect-returning) — check the signature at the definition, do not assume. |
| LiteralKit and MappedLiteralKit share an API | **API split:** `LiteralKit([...])` → `.Options`/`.Enum`/`.is`/`.$match`/`.toTaggedUnion`; `MappedLiteralKit` → `.From.Enum`/`.To.Enum` reversible code map. Numeric/boolean literal keys are stringified (`.Enum.number1`). |
| `Option.getSomes` exists on `effect/Option` | **It does not.** The struct form is repo-added: `O.getSomesStruct` at `packages/foundation/modeling/utils/src/Option.ts:102` (re-exported via `@beep/utils` aliases; already used in `drivers/acp` + `drivers/firecrawl`). `R.getSomes` (from `effect/Record`) is the homogeneous-dictionary form. |
| `S.TaggedUnion` / `S.toTaggedUnion` interchangeable | **Distinct:** `S.TaggedUnion` constructs; `.toTaggedUnion` derives from a kit. Verify per call site. |
| `annotations` always present on AST nodes | **`annotations` needs `?.`** — optional access. |
| v3 combinators (`Effect.catchAll`, `Schema.decode`, …) | v3 tells. Use v4 forms (`S.decodeUnknownEffect` / `S.decodeEffect`, current error-handling combinators). Any of these surviving in packet prose or prompts is a review-blocking defect. |

## Inventory record shape (§5.5, verbatim)

Every finding is one JSON object matching:

```ts
{
  ruleId: string,          // "SFV4-static-api" | "literal-kit-const-assertion" | "SFV4-getsomes-struct"
  file: string,            // repo-relative path
  line: number,
  symbol: string,
  smell: string,
  proposedTarget: string,
  confidence: number,      // 0–1
  mechanization: "codemod" | "assisted" | "judgment",
  roiRank: number,
  exception?: { reason: string, boundary: string }
}
```

**Tier guidance:**

| Confidence | `mechanization` |
| --- | --- |
| ≥ 0.9 | `"codemod"` |
| 0.6 – 0.9 | `"assisted"` |
| < 0.6 | `"judgment"` |

`roiRank` = blast-radius × domain-centrality × confidence (mechanical findings
rank up; judgment-only findings rank down). Every `SFV4-getsomes-struct`
finding stays `"judgment"` until the Law 20/47 amendment merges (D5), even if
the transform itself is otherwise mechanical.

## Novel-card authoring duty — `SFV4-getsomes-struct`

In addition to the per-package inventory, maintain the shared note at
`ops/inventory/S3/RULE-CARD-NOTES.md` (create it on your first run, extend it
on later runs). The `SFV4-getsomes-struct` detector **already landed in P0**
(G3) as a real AST detector in
`packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts`, non-blocking
via the per-owner policy; only the remediation sweep is gated by D5. Your
note documents, for its maintainer:

- **Detector heuristic:** a call to `R.getSomes({...})` (from `effect/Record`)
  whose argument is a heterogeneous struct literal (mixed-type `Option` values
  per key) rather than a homogeneous dynamic-key dictionary — the fit for
  `O.getSomesStruct` (`packages/foundation/modeling/utils/src/Option.ts:102`).
- **D5 note — do not activate before the amendment.** This card must land
  **non-blocking via the per-owner policy**
  (`standards/schema-crispening.policy.jsonc`) and the sweep must not run
  until effect-first Law 20 & 47 (and mirrors) are amended to prefer
  `O.getSomesStruct` for heterogeneous struct-spreads while keeping
  `R.getSomes` for homogeneous dictionaries. State this ordering constraint
  explicitly in the note so no maintainer accidentally flips it to blocking
  early.
- **Escape hatches** informed by your false-positive pass this run: concrete
  examples of legitimate homogeneous-dictionary `R.getSomes` uses you found
  (these are NOT findings for this card).
- You draft heuristic refinements and escape hatches only — **you do not
  edit the detector code.** The detector landed in P0 (G3); your note feeds
  its next tuning pass (heuristics, escape hatches, fixture candidates), not
  its initial implementation.

## You must verify

- [ ] Re-`rg` every symbol before citing it in a finding or in the rule-card note.
- [ ] `.repos/effect-v4` is the only source of truth for Effect/Schema APIs —
      never cite an API from memory.
- [ ] Scan only first-party `packages/**`/`apps/**` under `{{PACKAGE_PATH}}`,
      minus generated/hard-excluded paths (see Target surfaces above).
- [ ] Never edit source — this is a read-only phase; your only writes are the
      two output files under `ops/inventory/S3/`.

## Output

Write `goals/repo-crispening-orchestration/ops/inventory/S3/{{SANITIZED_PACKAGE}}.json`
as a JSON array of records in the §5.5 shape above. If the package is clean,
write `[]`. Update `ops/inventory/S3/RULE-CARD-NOTES.md` per the novel-card
duty above.

## Report

Report: package name, total findings, counts by `ruleId` and by
`mechanization` tier, count of `exception?` entries, count of
`SFV4-getsomes-struct` findings held at `"judgment"` pending D5, and whether
`RULE-CARD-NOTES.md` was created or extended this run.
