# What "Effect-level" means operationally for beep

Dated 2026-07-30. The rubric splits every observed quality into
**convention** (machine-checkable — a legitimate automation/ratchet target)
vs **editorial** (prose craft — a skill/review target, never a CI gate).
Marks per the brief: prose | convention | tooling | process.

## A. Machine-checkable (convention/tooling — automatable)

| # | Quality | Check | Gap class | Exists today? |
| --- | --- | --- | --- | --- |
| A1 | One-paragraph lead description (no heading soup, no blank padding) | paragraph count + blank-line + `#`-heading rules | convention | NO |
| A2 | Sections in exact order **When to use** → **Details** → **Gotchas**, non-empty, non-duplicated | section parser over the description body | convention | NO |
| A3 | **When to use** opens with `Use to/when/as/with` | prefix check | convention | NO |
| A4 | Examples titled and unique: `**Example** (Title)` or `@example` caption (carrier per grill B1/B2) | title presence + per-block uniqueness | convention | NO (3/20 organic) |
| A5 | Exactly one fence per example; no loose ts fences outside examples | fence counter | convention | NO |
| A6 | Example **compiles** (`tsc --noEmit`) | `@beep/docgen` | tooling | **YES — keep; Effect lost this** |
| A7 | Example shows an observable result (log/assert, not void-discard) | `deterministic-rubric-v1` codes (`example-lacks-observable-result`, `example-too-trivial`, …) | tooling | YES but advisory-only (0 CI teeth) |
| A8 | Described `@see`: every `@see` carries a purpose phrase | tag-text non-empty after link | convention | NO (75 `@see` repo-wide) |
| A9 | `{@link}` / `@see` targets resolve to real, documented symbols | checker-program resolution (most expensive rule; stage last) | tooling | NO |
| A10 | Tag order + tag whitelist per repo law | inventory rule (exists as eslint warn only in tooling pkgs) | convention | PARTIAL |
| A11 | `@category` canonical/alias (not "unknown") | `JSDocCategories` normalization — **today 39 non-canonical values / 511 occurrences live in src** | tooling | PARTIAL (vocabulary exists, gate tolerates unknowns) |
| A12 | `@since` present (`0.0.0` policy stands) | docgen `enforceVersion` | tooling | YES |
| A13 | Import style inside examples matches repo law (namespace `import * as S` — NOT Effect's named-import rule) | existing inventory import rules | convention | YES (keep ours; explicit divergence from Effect) |

## B. Editorial (prose — skill/rubric/review, never a hard gate)

| # | Quality | Where it lives |
| --- | --- | --- |
| B1 | Lead sentence teaches *when/why*, dense with inline-code tokens | pattern doc exemplars + `jsdoc-annotation-specialist` skill |
| B2 | **Details** bullets state non-obvious semantics (subtyping, singletons, laws), not signature restatement | skill rubric |
| B3 | ASCII type-annotation arrows (`┌───`/`▼`) where inference is non-obvious | skill; showcase idiom, not a rule |
| B4 | `// Output:` comments truthful | editorial until `runExamples` pilot lands (Option D) |
| B5 | Example exercises the *interesting* API surface (e.g. TaggedUnion demoing `match`) | skill + pilot review |
| B6 | Cross-link graph curated (bidirectional sibling `@see`) | skill; A8/A9 check form, not judgment |

## C. Proxies to track (process)

- % of touched exports with **When to use** per package family (ratchet-on-touch metric).
- Described-`@see` per 100 exports (baseline today: 0.4).
- `deterministic-rubric-v1` score distribution per package (baseline: 60% trivial in the n=20 sample).
- Pilot acceptance: before/after WebStorm hover screenshots on the pilot packages judged against the reference screenshots.

## D. Explicit non-goals inside the rubric

- Real-semver `@since` (needs release history we don't have; `0.0.0` policy stands).
- Named-import examples (conflicts with repo-wide namespace-import law — A13).
- Effect's free-form categories (our LiteralKit vocabulary stays; fix the
  "unknown" leakage instead).
- Universal example coverage as a *quality* metric — Schema.ts (14% examples,
  excellent hovers) proves presence ≠ pedagogy; quality gates target the
  examples that exist.
