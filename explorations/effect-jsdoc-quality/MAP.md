# Map

<!--
Stage 4. Decomposition into candidate goal packets. Grilled 2026-07-30;
the primary candidate graduates in the same PR as this file.
-->

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `effect-jsdoc-quality` (GRADUATING) | Port Effect v4's JSDoc section grammar into beep law + inventory rules with compile validation preserved; pilot trio; ratchet-on-touch | none | `.patterns/jsdoc-documentation.md`; `JSDocDocumentationInventory.ts` rule chassis; `jsdoc-totals` ratchet + required CI lane; `@beep/repo-docgen` (`Parser.ts:163`, `Core.ts:268` `extractFencedCodeBlocks`, tsc gate); `jsdoc-annotation-specialist` skill; `JSDocCategories` LiteralKit |
| `jsdoc-link-resolution` (future, NOT graduated) | `{@link}`/`@see` targets must resolve to documented symbols (Effect `Jsdocs.ts:1524-1545` semantics) | `effect-jsdoc-quality` | needs a checker program pass in inventory — NET-NEW rule infrastructure |
| `jsdoc-example-quality-lane` (future, NOT graduated) | Wire `deterministic-rubric-v1` (15 codes, advisory today) into an advisory CI lane; optional LLM scoring per `goals/jsdoc-worker-eval` verdicts | `effect-jsdoc-quality` | `Quality.rubric.ts`/`Quality.schemas.ts`; worker-eval packet contract |
| `jsdoc-run-examples` (future, NOT graduated) | Flip `runExamples` pilot so `// Output:` comments become verified claims | `effect-jsdoc-quality` | docgen runner exists (`Configuration.ts:126`), default false |
| `jsdoc-category-vocabulary-repair` (future, NOT graduated) | Fix 113-vs-80 category leakage; split the 43% `models` monolith | none | `JSDocCategories.ts` alias/reject machinery; category distribution data in `RESEARCH.md` |
| `beep-llms-corpus` (future, NOT graduated) | `ai-docs/`-style typechecked corpus → generated LLMS.md analog | none | Effect pipeline mapped in `research/effect-doc-pipeline.md` — NET-NEW package/app |

## Sequencing

`effect-jsdoc-quality` first and alone — it changes the law every follow-on
builds on. Follow-ons are independent of each other afterward; none is
scheduled until the pilot proves the grammar.

## First Vertical Slice

Law rewrite (sections + described-@see + @remarks retirement) + ONE new
inventory rule (section order/shape) + `foundation/modeling/schema` pilot
conversion of a handful of exports, verified by: inventory green, docgen
compile green, and a before/after WebStorm hover screenshot pair matching the
Effect reference screenshots.

## Open Risks Inherited From The Brief

- Fence-aware markdown parsing in ts-morph comment text (validator complexity).
- Kind classification drift between inventory rule and docgen export view.
- `@remarks` cleanup-on-touch could snowball in heavily-remarked files.
- Category vocabulary leakage must stay quarantined from this goal.
