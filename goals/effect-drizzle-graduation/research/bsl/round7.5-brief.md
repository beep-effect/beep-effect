# Round 7.5 Brief — Effect-Grade JSDoc on Every Exported Symbol

Implementer: Codex GPT 5.6 Sol (xhigh). Reviewer: Fable. Protocol as always:
only `scratchpad/bsl/`, proofs green with unmasked exits, write
`research/round7.5-report.md`, do not commit.

**Governing documents, in authority order:**
1. `research/effect-jsdoc-conventions.md` — the measured convention; this round
   exists to match it. Follow its rubric (§ per-symbol-kind anatomy, example
   style, type-only patterns) and its deliberate beep adaptations (plain `ts`
   fences, `@since 0.0.0`, named subpath imports in examples, repo category
   slugs).
2. `research/publishing-standards.md` — style law, including the JSDoc
   line-leading-`@` rule.
3. Round-3 laws (zero assertions etc.) — unchanged; this round touches ONLY
   documentation comments and README. No runtime or type-signature changes of
   any kind: `git diff` on non-comment code must be empty (comment-only edits
   to .ts files are the round's entire code surface).

## Deliverables

### A. Documentation pass over every exported symbol

Every export reachable from `src/index.ts`, `src/pg/index.ts`, and
`src/sqlite/index.ts` gets the full grammar where each section is EARNED:

- purpose-first lead (decision-oriented, not restating the signature);
- `**When to use**` — exact casing, lowercase "use" — where a consumer faces a
  real choice (Entity vs Model, derive vs explicit combinators, varchar's three
  modes, optimistic repository vs SqlModel's native, enum naming, pg vs sqlite
  posture differences);
- `**Details**` where mechanism matters (truth-table consequences, variant
  membership, derivation policy, FK identity equality, assembly ordering);
- `**Gotchas**` where real misuse exists — earn them, don't stamp them
  (identity-always vs update-locator, two-clock hazard, enum CHECK
  per-table duplication in sqlite, spec-family smuggling, array absence in
  sqlite, version-field requiredness in update payloads, rc-skew notes where
  consumer-visible);
- titled `**Example** (Title)` sections LAST, converted to the measured example
  style: **expression + `// => result` comments** (4,723:3 over console.log in
  the corpus). `console.log` survives only where console behavior is the
  lesson. Effects shown via `runSync`/`runPromise` with their result. Examples
  import only future public entrypoints (`@beep/effect-drizzle`,
  `@beep/effect-drizzle/pg`, `@beep/effect-drizzle/sqlite`) — never relative
  paths, never internals;
- type-level exports use the catalogued type-only patterns (aliases +
  inferred-result comments; witnesses only when assignment is the lesson;
  `@ts-expect-error` only when rejection is the lesson) — validators show both
  the accepted reduction AND the readable `~effect-drizzle.error`;
- `@see` links between related exports where navigation genuinely helps;
  `@category` per the existing slugs; `@since 0.0.0`.

Module headers for `src/index.ts`, `src/pg/index.ts`, `src/sqlite/index.ts`,
and each core file: problem-space statements per the conventions report's
module-header exemplar — no export enumerations.

### B. The line-leading-`@` fix

Fix `src/pg/model.ts:297` (reword so the prose line no longer begins with a
bare `@beep`); sweep for any other prose line beginning with a bare non-tag `@`
(`^\s*\* @` against the real-tag whitelist) across src and test. Mid-prose
`@scope/name` is inert — do not churn it.

### C. Internal-symbol hygiene (lighter bar)

Non-exported internals need correct, terse leads only — no full grammar. Do not
pad. If an internal's doc already says the right thing, leave it.

### D. README cross-check

After the pass, verify README claims still match the documented surface
(section names it references, example style consistency). Update only where
the docs pass changed what the README quotes.

### E. Report

`research/round7.5-report.md`: coverage census (exports documented, per
section: how many earned When-to-use/Details/Gotchas — with the reasoning
standard applied), example-conversion counts (console.log → `// =>`),
line-leading-`@` findings, any conventions-report ambiguities you had to
resolve (and how), and confirmation of the zero-behavior-change invariant.

## Proofs

```sh
./node_modules/.bin/tsgo -p scratchpad/bsl/tsconfig.json --noEmit --pretty false
bun test scratchpad/bsl/
```

Unmasked exits; 56/56 and 78 negatives unchanged; zero assertions; boundary
test passing. The diff must be comments/README only — state that check
explicitly in the report.
