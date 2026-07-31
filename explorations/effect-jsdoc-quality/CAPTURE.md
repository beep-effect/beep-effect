# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-07-30

### Original brief (verbatim, from the kickoff session)

> # Exploration: Effect-level JSDoc quality for beep-effect
>
> ## Mission
>
> Mine Effect v4's documentation system (source JSDoc style + tooling +
> rendering story) and produce a concrete plan to close the quality gap between
> our docs and theirs — so IDE hovers and generated docs for `@beep/*` feel like
> Effect's: pedagogical, structured, example-rich, and visually crisp.
>
> This is **research → grill → goal**, not implementation. Do not start coding
> docgen changes or mass-rewriting JSDoc until a `goals/` packet exists and is
> approved.
>
> ## Why this exists
>
> [Effect](https://github.com/Effect-TS/effect) ships unusually good JSDoc. IDE
> hovers look intentional, not mechanical. Examples teach; sections guide;
> cross-links form a graph.
>
> Reference screenshots (local; open while researching):
>
> 1. `~/Pictures/Screenshots/Screenshot_20260730_095907.png` — `Option` type
>    hover: problem statement + **When to use** bullets + `@see` graph +
>    `@category` / `@since`
> 2. `~/Pictures/Screenshots/Screenshot_20260730_100034.png` — `Option.none`
>    hover: **When to use**, **Details**, titled **Example**, ASCII annotation
>    in the example, console output comment
> 3. `~/Pictures/Screenshots/Screenshot_20260730_100340.png` — `Schema.TaggedUnion`
>    hover: dense one-paragraph summary with `{@link}`, titled example that
>    exercises the full API (`match`), then `@see` / `@category` / `@since`
>
> Observable qualities I want (non-exhaustive; expand from evidence):
>
> | Signal | What Effect does (from screenshots) |
> | --- | --- |
> | Section structure | Bold markdown headings: **When to use**, **Details**, **Example (…)** |
> | Pedagogy | Explains *when* and *why*, not just *what the name says* |
> | Examples | Titled, compilable-looking, show result/output, sometimes ASCII diagrams |
> | Cross-links | Multiple `@see` / `{@link}` forming a local API graph |
> | Density | Short enough for hover; long enough to act without leaving the IDE |
> | Metadata | Real `@category` + meaningful `@since` (not decorative) |
>
> We already adopt pieces of this (`@since`, `@category`, `@example`, docgen
> compilation, quality inventory). Theirs still *looks and teaches better*. The
> gap may be prose craft, markdown conventions, tooling, codegen, linter rules,
> or all of the above — find out from evidence.
>
> ## Context you must load first
>
> ### Ours (baseline — do not rediscover from zero)
>
> | Area | Path / command |
> | --- | --- |
> | JSDoc standard of truth | `.patterns/jsdoc-documentation.md` |
> | Annotation skill | `.agents/skills/jsdoc-annotation-specialist/` (+ `references/*`) |
> | Docgen package | port of pre-v4 `@effect/docgen` → `@beep/docgen` (locate under `packages/`; root scripts `docgen`, `docgen:local`) |
> | Quality tooling | `bun run beep docgen quality`, `bun run beep quality jsdoc-inventory`, `standards/jsdoc-documentation.inventory.*` |
> | Custom tags | root `tsdoc.json` (`@effects`, `@precondition`, …) |
> | Categories | `packages/tooling/tool/cli/src/commands/Shared/JSDocCategories.ts` |
>
> ### Theirs (primary mine)
>
> | Area | Path |
> | --- | --- |
> | Effect v4 checkout | `.repos/effect` (git subtree) |
> | JSDoc source samples | Prefer symbols in the screenshots first: `Option` type, `none`/`some`, `Schema.TaggedUnion` — then expand to a representative set |
> | Docs / docgen config | `.repos/effect/jsdocs.config.json`, `docs/`, `ai-docs/`, `LLMS.md`, `MIGRATION.md`, package scripts related to docs |
> | Any remaining docgen / typedoc / api-extractor / website pipeline | Trace from `package.json` scripts and CI; Effect abandoned classic `@effect/docgen` post-v4 — document what replaced it |
>
> Also note: pre-v4 Effect used `@effect/docgen` for standards validation; we
> ported that style into `@beep/docgen`. v4 moved on. Part of this exploration
> is naming that migration precisely so we do not cargo-cult dead tooling.
>
> ## Research questions (answer with evidence, not vibes)
>
> 1. **Source shape** — What is the exact JSDoc/TSDoc template Effect authors use
>    (tag order, markdown section names, example fencing, `{@link}` vs `@see`,
>    release-stage tags)? Diff against `.patterns/jsdoc-documentation.md`.
> 2. **Prose craft vs structure** — Which "quality" is *convention* (enforceable
>    headings/tags) vs *editorial skill* (good sentences)? Separate the two;
>    only the former is a good automation target.
> 3. **Tooling stack (v4)** — What validates, compiles, renders, and publishes
>    docs now? TypeDoc? Custom? Website? AI docs (`ai-docs/`, `LLMs.md`)? What
>    was dropped with `@effect/docgen`?
> 4. **IDE hover fidelity** — Which markdown features actually survive WebStorm /
>    TS language service hovers (bold headings, lists, fenced code, links)?
>    Anything we write that never appears in hover is lower priority for the
>    "looks like Effect" goal.
> 5. **Example quality bar** — How do they title examples, annotate types in
>    comments, show outputs, and keep examples short? Compare to our
>    "compilable `@example` required on every export" rule — keep, tighten, or
>    split (e.g. type-only vs value exports).
> 6. **Enforcement surface** — Lint rules, CI checks, docgen validators, skills,
>    codegen (e.g. `$I.annote`)? Map Effect's enforcement to ours and list
>    missing ratchet points.
> 7. **Adoption path for beep** — Given our monorepo size and existing inventory/
>    ratchet, what is the lowest-risk path to Effect-level quality:
>    convention update only, skill/rubric update, docgen enhancements, partial
>    codegen, pilot packages then ratchet, or something else?
> 8. **Non-goals / traps** — What should we *not* copy (Effect-only website
>    chrome, version numbers we cannot maintain, `@since` semantics that fight
>    our `0.0.0` placeholder policy, etc.)?
>
> ## Method
>
> 1. **Orient** on our baseline files above; summarize current bar in ≤15 bullets.
> 2. **Mine Effect** starting from the three screenshot symbols, then widen to a
>    stratified sample (constructors, combinators, types, errors, Schema, modules
>    with package docs). Prefer reading source over secondary blogs.
> 3. **Trace tooling** from `.repos/effect` configs/scripts/CI — produce a
>    one-page "how Effect docs ship in v4" map.
> 4. **Diff** Effect vs beep on: tag set, section markdown, example shape,
>    validation, rendering. Tabular preferred.
> 5. **Score the gap** with a short quality rubric (what "Effect-level" means
>    operationally for us) and mark each gap as: prose | convention | tooling |
>    process.
> 6. **Options** — 2–4 candidate approaches (minimal → ambitious) with tradeoffs,
>    effort, and ratchet story. No single "the plan" yet.
> 7. **Stop for human interview** — invoke `/grill-with-docs` before proposing a
>    goal. Decisions to grill must include at least:
>    - Keep vs evolve `@beep/docgen` vs lean on Effect's new stack
>    - How hard we enforce markdown section templates
>    - Whether every export still needs a compilable example
>    - Pilot scope (which packages first)
>    - Relationship to existing `jsdoc-inventory` / quality ratchet
>    - Anything that would change `.patterns/jsdoc-documentation.md` law
>
> ## Deliverables (before goal creation)
>
> `CAPTURE.md`/`BRIEF.md`, `research/SOURCES.md`,
> `research/effect-doc-pipeline.md`, `research/diff-effect-vs-beep.md`,
> `research/quality-rubric.md`, `research/options.md`, `DECISIONS.md`
> (pending grill), packet README + manifest. After grill and alignment:
> graduate a `goals/<slug>/` packet implementable without re-mining Effect.
>
> ## Constraints
>
> - Schema → service → impl mindset for any new tooling service.
> - Prefer effect-native / existing repo patterns; search before proposing new
>   packages.
> - Do NOT mass-edit package JSDoc in this exploration.
> - Do NOT commit secrets; screenshots stay as local path references (or copy
>   into the packet `assets/` if needed in-repo).
> - Proof over assertion: every claim about Effect's stack cites a path or
>   symbol under `.repos/effect` (or a config/script that proves absence).
> - Context economy: distill findings to packet files.

### Screenshot evidence read-out (WebStorm quick-doc hovers, 2026-07-30)

Screenshots stay as local path references (public repo; they show the user's
IDE and project tree). Copy into `assets/` only if the user opts in later.

1. `~/Pictures/Screenshots/Screenshot_20260730_095907.png` — hover on
   `O.Option<string>` (`import * as O from "effect/Option"` scratch file).
   Renders: signature `type Option<A> = O.None<A> | O.Some<A>`; one dense
   lead paragraph with inline-code tokens; bold **When to use** heading; a
   lead sentence plus two bullets; three `@see` rows each with a purpose
   phrase ("some — for creating a `Some`", "none — for creating a `None`",
   "match — for pattern matching") rendered as links; `@category` — models;
   `@since` — 2.0.0.
2. `~/Pictures/Screenshots/Screenshot_20260730_100034.png` — hover on
   `Option.none()`. Renders: **When to use** sentence; **Details** bullets
   (`Option<never>` subtype note; singleton note); **Example** with
   parenthesized title "(Creating an empty Option)"; fenced code with named
   import, ASCII type-annotation arrow (`// ┌── Option<never>` / `// ▼`),
   `console.log(noValue)` and `// Output: { _id: 'Option', _tag: 'None' }`.
3. `~/Pictures/Screenshots/Screenshot_20260730_100340.png` — hover on
   `S.TaggedUnion(...)`. Renders: dense one-paragraph summary with a working
   `{@link TaggedStruct}` inline link and inline-code utility names (`cases`,
   `guards`, `isAnyOf`, `match`); titled **Example** "(Pattern matching a
   discriminated union)" exercising the full API (`Shape.match`); `@see` —
   toTaggedUnion "to augment an existing union instead"; `@category` —
   constructors; `@since` — 4.0.0.

Conclusion baked in from the screenshots alone: bold section headings,
bullets, fenced code (including ASCII art and output comments), `{@link}`
inline links, and described `@see` tags ALL survive WebStorm's quick-doc
renderer — so every "looks like Effect" convention is renderable on our side;
nothing depends on Effect-only website tooling. Note the `@since` semantics
visible in hovers: `2.0.0` on carried-over `Option`, `4.0.0` on new
`Schema.TaggedUnion` — real history, unlike our `0.0.0` placeholder policy.

### Stale-path corrections discovered while orienting (fix nothing yet; recorded for the goal)

- The brief's categories path `packages/tooling/tool/cli/src/commands/Shared/JSDocCategories.ts`
  does not exist; the real home is
  `packages/tooling/library/repo-utils/src/schemas/JSDocCategories.ts`.
- `.agents/skills/jsdoc-annotation-specialist` Source References cite the same
  stale CLI path plus two `packages/common/schema/src/*` paths; `packages/common/`
  is gone (real home `packages/foundation/modeling/schema/src/`).
