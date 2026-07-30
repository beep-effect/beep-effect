# Effect v4 vs beep-effect: JSDoc conventions & tooling diff

Dated 2026-07-30. Effect paths relative to `.repos/effect/`; beep paths
relative to repo root. Line-cites verified (see `SOURCES.md`).

## Verdict in one paragraph

The two systems optimize opposite halves of the same problem. **beep enforces
presence and compilation** (every export has `@example`/`@category`/`@since`;
examples typecheck via `@beep/docgen`) but has **no pedagogical structure** —
no section grammar, near-zero cross-links (75 `@see` across ~18k exports),
and 60% of sampled examples are template-grade trivial. **Effect enforces
pedagogical structure** (section grammar, described links that must resolve,
titled examples with named imports) but **lost compilation** (the `@example`
ban orphaned its example-typechecking machinery) and doesn't fail CI on
violations. "Effect-level for beep" = their grammar + our compiler + our
ratchet discipline.

## 1. Tag universe & order

| | Effect v4 | beep |
| --- | --- | --- |
| Allowed tags | Exactly 5, per-scope subsets: `@deprecated @default @see @category @since` (`Jsdocs.ts:1395-1402`) | 15 registered in `tsdoc.json:3-30` incl. custom `@effects @precondition @postcondition @invariant`; conditional tags default-omit |
| Order | Fixed map `deprecated→default→see→category→since` (`Jsdocs.ts:425-431`), enforced (`tag-out-of-order`) | 14-position order in law (`.patterns/jsdoc-documentation.md:55-82`), enforced only in `packages/tooling/*/*/src` via `jsdoc/sort-tags` warn |
| `@example` | **Forbidden** (`Jsdocs.ts:1411-1413`) — sections instead | **Mandatory on every export** (law :77-82; ratcheted) |
| `@param`/`@returns`/`@throws` | Not allowed | Conditional; adoption: `@param` 1304, `@returns` 929, `@throws` **0** |
| Custom agent tags | None | `@effects` 310, `@precondition`/`@postcondition` **0**, `@invariant` 13 — the aspirational half is unadopted |
| Collision to resolve | — | Law routes details/gotchas semantics into `@remarks` (:183-186); Effect puts them in description-body sections. Both can't be canonical. |

## 2. Section grammar (the core gap)

| | Effect v4 | beep |
| --- | --- | --- |
| Description | Exactly one paragraph, no `#` headings, no leading/trailing blanks — 4 diagnostics | Free-form; `jsdoc/match-description` ≥20 chars warn (tooling packages only) |
| Sections | `**When to use**` → `**Details**` → `**Gotchas**` in exact order (`Jsdocs.ts:1020`); empty/dup/out-of-order = diagnostics | **None exist in law** (verified: "When to use" appears nowhere in the pattern doc) |
| When-to-use opener | Must start `Use to/when/as/with` (`Jsdocs.ts:1024`) | n/a |
| Example sections | `**Example** (Title)` last in prose; exactly one ```ts fence; unique titles; `loose-ts-fence` ban | n/a (but an organic pocket exists: law-practice models use bold `**Example**` headings — 3/20 in our sample) |

## 3. Example carrier & validation

| | Effect v4 | beep |
| --- | --- | --- |
| Carrier | `**Example** (Title)` markdown sections | `@example` tag |
| Typechecked? | **No — nothing compiles the fences** (docgen's `examplesCompilerOptions` idles, `packages/effect/docgen.json:5-8`; `Parser.ts:105` reads a tag that no longer exists) | **Yes** — extracted + `tsc --noEmit` (`Core.ts:450-456`), the surviving pre-v4 discipline |
| Executed? | No (only hand-written `ai-docs/` compiles as real source) | No (`runExamples` exists, default false everywhere) — `// Output:` claims unverified on both sides |
| Shape rules | Named imports required; one fence; titled | `no-any-in-examples`, `no-type-assertions-in-examples`, import-alias rules (inventory) |
| Quality bar | Editorial (showcase modules teach; ASCII `┌───` arrows, `// Output:` comments) | `deterministic-rubric-v1` detects trivial examples (15 codes) but is **advisory, wired to no CI lane** |
| Sampled reality | Titled + observable in showcase modules; Schema.ts only 14% examples | n=20 sample: 60% trivial, 0 `// Output:`, 3 titled, 0 `@see`; named imports 17/20 |

## 4. Cross-linking

| | Effect v4 | beep |
| --- | --- | --- |
| `@see` | Dense, each with a purpose phrase ("@see {@link some} for creating a `Some`"); bidirectional between siblings | **75 total** across ~18k documented exports |
| `{@link}` in prose | Idiomatic; must resolve to a *documented* symbol via `ts.createProgram` (`Jsdocs.ts:1524-1545`); URLs banned inside `{@link}` | Occasional; no resolution check of any kind |

## 5. Categories

| | Effect v4 | beep |
| --- | --- | --- |
| Vocabulary | Free-form per-module lowercase; no check (capitalized outliers `Reducer`/`Combiner` in Option.ts prove it) | 80 canonical slugs via LiteralKit + alias map + reject list (`JSDocCategories.ts:31-126,202-263`) |
| Usage reality | ~22 distinct values in Option.ts alone; fine-grained per-module navigation (`converting`, `sequencing`, `zipping`…) | 19,100 occurrences, 113 distinct values: 8,152 `models` (43%!), 39 non-canonical values (511 occurrences) of which some are tolerated aliases and ~25 normalize to "unknown" (`execution`, `filesystem`, `scoring`, `jsdoc`…); 6 canonical slugs have zero usage |
| Read | Their free-form yields *navigational* categories inside a module; our vocabulary yields *architectural* categories but `models` is doing 43% of the work — under-differentiated where it matters | |

## 6. `@since`

| | Effect v4 | beep |
| --- | --- | --- |
| Semantics | Real history — `2.0.0` carried-over, `4.0.0` new v4, long 3.x tail; stable-semver regex enforced (`Jsdocs.ts:435,1460`) | Uniform `0.0.0` placeholder by deliberate policy until v1.0 |
| Verdict | Do NOT copy — real semver is meaningful only with released version history; keep `0.0.0` (confirm at grill) | |

## 7. Enforcement surfaces & CI

| Surface | Effect v4 | beep |
| --- | --- | --- |
| Grammar/shape | `@effect/jsdocs` (private, ~30 diagnostics) inside `pnpm lint` — **but diagnostics fail only under `--check`, which CI never passes** (`bin.ts:13`) | 12 inventory rules (ts-morph) + presence checks |
| Ratchet | None | Fail-on-growth baseline (`standards/jsdoc-totals.regression-baseline.jsonc`), **required** CI check "JSDoc Ratchet" |
| Compile gate | None (dead) | docgen lane (required): `@since` + example compilation |
| Lint plugins | None (no jsdoc/tsdoc eslint/oxlint plugins) | `tsdoc/syntax` warn repo-wide; strict `jsdoc/*` block only in `packages/tooling/*/*/src` |
| Net | Stronger spec, weaker teeth | Weaker spec, stronger teeth |

## 8. Effect diagnostic → beep mapping (grill input)

| Effect diagnostic (Jsdocs.ts) | beep today | Proposed disposition |
| --- | --- | --- |
| `missing-jsdoc`, `missing-description` | inventory presence checks + rubric `missing-description` | HAVE |
| `missing-tag` (@category), `invalid-since` | inventory + docgen `enforceVersion` | HAVE (different `@since` semantics) |
| `multiple-description-paragraphs`, `leading-blank`, `trailing-blank`, `invalid-heading` | nothing | ADD (cheap regex/AST rules) |
| `section-out-of-order`, `duplicate-section`, `empty-section`, `section-after-example` | nothing | ADD — the core port |
| When-to-use prefix rule | nothing | ADD |
| `malformed-example` (×5), `duplicate-example`, `loose-ts-fence` | nothing (different carrier today) | ADD (adapted to chosen carrier B1/B2) |
| `example-import-style` (named imports) | import-alias inventory rules (namespace-style for `effect/*`!) | **CONFLICT** — our law mandates `import * as S from "effect/Schema"`; theirs mandates named. Keep OURS (repo-wide import law outranks doc style). |
| `tag-out-of-order` | eslint warn (tooling only) | ADD repo-wide (inventory) |
| `forbidden-tag` (@example) | opposite law | GRILL (B1 vs B2) |
| `unresolved-link`, `undocumented-see-target`, `url-link`, `malformed-link` | nothing | ADD (staged — needs checker program; most expensive rule) |
| `invalid-spacing` | `jsdoc/tag-lines` warn (tooling only) | ADD |

## 9. Adoption reality, both sides

Effect (denominator = `@since` per module): When-to-use 99% Option / 51%
Effect / 31% Schema / 19% Stream; Examples 87-97% except **Schema 14%**;
category+since ~universal. beep: presence universal (ratcheted), pedagogy
near-zero (`@see` 75, `@throws` 0, `@precondition` 0), example quality 60%
trivial in sample. Lesson: neither repo lives at its own target; enforcement
design must assume incremental adoption (ratchet-on-touch), and the
every-export example law should be re-examined per symbol kind (Schema
precedent).

## 10. Hover-fidelity matrix (RQ4 — WebStorm quick-doc)

Proven by the reference screenshots (Effect sources render fully):

| Feature | Renders in WebStorm? | Evidence |
| --- | --- | --- |
| Bold `**Section**` headings in description | YES | Screenshots 1-3 |
| Bullet lists | YES | Screenshots 1-2 |
| Fenced ```ts code in description sections | YES (syntax-highlighted) | Screenshots 2-3 |
| ASCII `┌───`/`▼` arrows + `// Output:` comments | YES (inside fences) | Screenshot 2 |
| `{@link X}` inline in prose | YES (rendered link) | Screenshot 3 |
| `@see {@link X} purpose phrase` | YES ("@see — some for creating a `Some`") | Screenshot 1 |
| `@category` / `@since` tag rows | YES | Screenshots 1-3 |

Pending user eyeball (probe file `scratchpad/jsdoc-hover-lab.ts`, ~2 min):

| Probe | Question |
| --- | --- |
| `hoverSectionsInDescription` | Same section rendering when authored on a beep export? |
| `hoverRemarksWithHeadings` | Does `@remarks` content render, incl. markdown inside it? |
| `hoverCustomTags` | Do `@effects`/`@precondition` render or vanish? (If invisible → lower priority for the "looks like Effect" goal) |
| `hoverDescribedSee` | Described `@see` + inline `{@link}` on our side? |
| `hoverExampleTagWithOutput` | `@example` tag with caption text vs Feature-1 section: which renders better? (Direct B1-vs-B2 evidence) |
