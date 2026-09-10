# Instance

- id: `ci-lane-timings-render-mode`
- file:line: `packages/tooling/tool/cli/src/commands/Ci/LaneTimings.ts:2291`
- symbol: `ciLaneTimingsCommand`
- members: `markdown`, `tsv`, `window`
- evidence: E2 at `LaneTimings.ts:2299-2324` — recent mode ignores Markdown;
  bounded mode rejects dual formats and selects one of three renderers.

Audited at checkout `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
against main corpus `52fcc8d1353db9481ef9edb6cc9619500f95568d`.
Replacement P3 review remains pending.

# Current shape and cardinality

The three default-false flags admit all eight raw triples. Seven are accepted:

| window | tsv | markdown | result |
| --- | --- | --- | --- |
| false | false | false | recent summary |
| false | false | true | recent summary; Markdown ignored |
| false | true | false | recent TSV |
| false | true | true | recent TSV; Markdown ignored |
| true | false | false | window summary |
| true | false | true | window Markdown |
| true | true | false | window TSV |
| true | true | true | exact dual-format error |

Thus cardinality is 8/7, while the accepted triples resolve to five report
modes. Recent mode returns before the conflict check or bounded-option decode.

# Cardinality gap

The three raw flags represent eight triples. Seven are accepted because only
window plus both render flags errors; those seven collapse to five resolved
collection/render modes through the two intentional recent-mode aliases.

# Target schema

Reuse `LaneTimings.ts`'s existing `$I` and `LiteralKit`:

```ts
const CiLaneTimingsRenderMode = LiteralKit([
  "recent-summary",
  "recent-tsv",
  "window-summary",
  "window-tsv",
  "window-markdown",
]).pipe(
  $I.annoteSchema("CiLaneTimingsRenderMode", {
    description: "Resolved collection scope and renderer for CI lane timing reports.",
  })
);
type CiLaneTimingsRenderMode = typeof CiLaneTimingsRenderMode.Type;
```

Keep all three raw `Flag.boolean` fields. After the current repository-root
lookup, resolve recent modes first: TSV wins and Markdown is ignored exactly as
today. Only when window is true, reject TSV plus Markdown with the exact current
error before timestamp decoding or GitHub-client construction, then resolve
the three window modes. Match the five modes to the same collectors and
renderers.

# Migration inventory

- `LaneTimings.ts:2221-2269` — retain every flag name, default, and description;
  add the private mode kit nearby.
- `LaneTimings.ts:2285-2325` — preserve repo-root fallback, raw option
  destructuring, conflict message/order, bounded option decode, client
  construction, collectors, renderer functions, and one console write per run;
  replace early-return/ternaries with resolution plus exhaustive mode match.
- `ci-lane-timings.test.ts:831-915` — extend the current CLI coverage to all
  eight triples, exact output selection, conflict order, and request counts.
- Exported renderer and collector APIs are unchanged.

# Guard-deletion accounting

Delete the `!window` early-return branch as the long-lived mode carrier, the
recent TSV ternary, and the nested bounded TSV/Markdown ternary. The raw
window-only conflict guard remains to preserve the eighth input's diagnostic.

# Encoded-side impact

None. The mode is internal CLI state. Raw flags, ignored recent Markdown,
timestamp and event options, GitHub queries, report schemas, TSV/Markdown/text
bytes, console output, and error text remain unchanged.

# Test impact

Use an eight-row CLI table. Assert both recent Markdown combinations remain
successful and identical to their Markdown-false counterparts; recent
TSV+Markdown still emits TSV. Assert all three bounded renderers, and that only
window+TSV+Markdown fails with the current message before bounds decoding or
GitHub calls. Retain reversed-bound and provenance-filter tests.

# Risk and sequencing

Tier 1. The main risk is accidentally applying the bounded format conflict to
recent mode or validating ignored bounded options before the current early
return. Resolve recent cases first and keep exact operation order.
